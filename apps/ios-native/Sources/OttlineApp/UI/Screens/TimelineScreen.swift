import SwiftUI
import OttlineCore

public struct TimelineScreen: View {
    @ObservedObject public var repository: OttlineRepository
    public var initialPlaceFilter: Place?
    public var initialOccasionFilter: Occasion?
    public var onClearInitialMomentFilter: () -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenReport: () -> Void
    public var onOpenBookshelf: (Int?) -> Void
    public var onOpenShareCard: (WatchLog) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.ottlineViewportWidth) private var viewportWidth

    private var metrics: PadLayoutMetrics {
        PadLayoutMetrics.resolve(horizontalSizeClass: horizontalSizeClass, viewportWidth: viewportWidth)
    }

    // Filters
    @State private var typeFilter: String = "all" // "all" | "video" | "book"
    @State private var statusFilter: LogStatus?
    @State private var platformFilter: String = ""
    @State private var placeFilter: Place?
    @State private var occasionFilter: Occasion?
    @State private var originFilter: LogOrigin?
    @State private var searchQuery: String = ""
    @State private var filterExpanded: Bool = false

    // Server cursor pagination (`GET /api/logs/page`)
    @State private var nextCursor: String?
    @State private var hasMorePages: Bool = false
    @State private var loadingMore: Bool = false

    // OpenAI v2 Future Timeline (`futureMode`)
    @State private var futureMode: Bool = false
    @StateObject private var recCoordinator: FutureTimelineCoordinator
    @State private var showExcludedSheet: Bool = false
    @State private var catalogResolvingKey: String?
    @State private var editionPickerCandidates: [TitleSearchItem] = []
    @State private var editionPickerSourceTitle: String = ""
    // Edition picker for Future Timeline catalog connection
    @State private var showEditionPicker: Bool = false

    public init(
        repository: OttlineRepository,
        initialPlaceFilter: Place? = nil,
        initialOccasionFilter: Occasion? = nil,
        onClearInitialMomentFilter: @escaping () -> Void = {},
        onOpenQuickRecord: @escaping (QuickRecordRequest) -> Void,
        onOpenTitleDetail: @escaping (String) -> Void,
        onOpenReport: @escaping () -> Void,
        onOpenBookshelf: @escaping (Int?) -> Void = { _ in },
        onOpenShareCard: @escaping (WatchLog) -> Void = { _ in }
    ) {
        self._repository = ObservedObject(wrappedValue: repository)
        self.initialPlaceFilter = initialPlaceFilter
        self.initialOccasionFilter = initialOccasionFilter
        self.onClearInitialMomentFilter = onClearInitialMomentFilter
        self.onOpenQuickRecord = onOpenQuickRecord
        self.onOpenTitleDetail = onOpenTitleDetail
        self.onOpenReport = onOpenReport
        self.onOpenBookshelf = onOpenBookshelf
        self.onOpenShareCard = onOpenShareCard
        self._recCoordinator = StateObject(wrappedValue: FutureTimelineCoordinator(repository: repository))
    }

    public var body: some View {
        let allLogs = repository.logs
        let snap = repository.prefs.snapshot
        let nickname = snap.nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let personaTitle: String? = snap.personaKey.map { OttlineStrings.personaPreset($0).title(locale) }

        let filteredLogs = allLogs.filter { log in
            if typeFilter == "video" && log.title.type == .book { return false }
            if typeFilter == "book" && log.title.type != .book { return false }
            if let sf = statusFilter, log.status != sf { return false }
            if !platformFilter.isEmpty {
                let hayOtt = (log.ott ?? "").lowercased()
                if !hayOtt.contains(platformFilter.lowercased()) { return false }
            }
            if let pf = placeFilter, log.place != pf { return false }
            if let of = occasionFilter, log.occasion != of { return false }
            if let orf = originFilter, log.origin != orf { return false }
            let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                let hay = [
                    log.title.name,
                    log.title.author ?? "",
                    log.title.publisher ?? "",
                    log.note ?? "",
                    log.ott ?? ""
                ].joined(separator: " ").lowercased()
                if !hay.contains(trimmed.lowercased()) { return false }
            }
            return true
        }
        let monthGroups = TimelineMoments.groupLogsByMonth(filteredLogs)
        let totalFilteredCount = filteredLogs.count
        let momentFilterCount = [
            statusFilter != nil,
            !platformFilter.isEmpty,
            placeFilter != nil,
            occasionFilter != nil,
            originFilter != nil
        ].filter { $0 }.count
        let hasActiveFilters = momentFilterCount > 0
            || !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || typeFilter != "all"

        let filterTriggerKey = "\(typeFilter)-\(statusFilter?.rawValue ?? "")-\(platformFilter)-\(placeFilter?.rawValue ?? "")-\(occasionFilter?.rawValue ?? "")-\(originFilter?.rawValue ?? "")-\(searchQuery)"
        let useStickyFooter = futureMode || totalFilteredCount <= 4

        Group {
            if useStickyFooter {
                GeometryReader { scrollGeo in
                    ScrollView {
                        OttlineStickyFooterLayout(
                            minHeight: scrollGeo.size.height,
                            topPadding: metrics.isSpread ? 24 : 18,
                            bottomPadding: 24,
                            minSpacing: 20
                        ) {
                            VStack(alignment: .leading, spacing: 20) {
                                OttlineDeferredSection {
                                    timelineTopHeaderSections(
                                        snap: snap,
                                        nickname: nickname,
                                        personaTitle: personaTitle,
                                        momentFilterCount: momentFilterCount,
                                        hasActiveFilters: hasActiveFilters
                                    )
                                }

                                if futureMode {
                                    OttlineDeferredSection {
                                        futureTimelineContent(allLogsCount: allLogs.count)
                                    }
                                } else if totalFilteredCount == 0 {
                                    OttlineDeferredSection {
                                        timelineEmptyState(hasActiveFilters: hasActiveFilters)
                                    }
                                } else {
                                    OttlineDeferredSection {
                                        timelineShortMonthList(monthGroups: monthGroups)
                                    }
                                }
                            }

                            OttlineAppFooter(bottomPadding: 0)
                        }
                        .ottlineContentContainer(metrics)
                    }
                }
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        VStack(alignment: .leading, spacing: 18) {
                            OttlineDeferredSection {
                                timelineTopHeaderSections(
                                    snap: snap,
                                    nickname: nickname,
                                    personaTitle: personaTitle,
                                    momentFilterCount: momentFilterCount,
                                    hasActiveFilters: hasActiveFilters
                                )
                            }
                        }
                        .padding(.bottom, 18)

                        if metrics.isSpread {
                            ForEach(Array(monthGroups.enumerated()), id: \.element.id) { index, group in
                                HStack(alignment: .firstTextBaseline) {
                                    Text(RecordDate.formatMonthLabel(group.monthKey, locale: locale))
                                        .font(OttlineFont.bold(18))
                                        .foregroundStyle(palette.ink)
                                    Spacer()
                                    Text(OttlineStrings.tr("최근 기록·수정한 날 기준", "By last recorded or updated", locale: locale))
                                        .font(OttlineFont.regular(12))
                                        .foregroundStyle(palette.mutedInk)
                                }
                                .padding(.top, index == 0 ? 0 : 26)
                                .padding(.bottom, 12)

                                LazyVGrid(
                                    columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                                    spacing: 16
                                ) {
                                    ForEach(group.logs) { log in
                                        timelineSpreadCard(log)
                                    }
                                }
                            }
                        } else {
                            let compactEntries = buildCompactTimelineEntries(monthGroups)
                            ForEach(compactEntries) { entry in
                                switch entry {
                                case .monthHeader(let monthKey, let isFirst):
                                    HStack(alignment: .firstTextBaseline) {
                                        Text(RecordDate.formatMonthLabel(monthKey, locale: locale))
                                            .font(OttlineFont.semiBold(18))
                                            .foregroundStyle(palette.ink)
                                        Spacer()
                                        Text(OttlineStrings.tr("최근 기록·수정한 날 기준", "By last recorded or updated", locale: locale))
                                            .font(OttlineFont.regular(12))
                                            .foregroundStyle(palette.mutedInk)
                                    }
                                    .padding(.top, isFirst ? 0 : 14)
                                    .padding(.bottom, 10)
                                case .log(let log):
                                    timelineRecordRow(log)
                                        .padding(.bottom, 12)
                                }
                            }
                        }

                        if hasMorePages {
                            loadMoreButton
                                .padding(.top, 8)
                        }

                        OttlineAppFooter(bottomPadding: 24)
                            .padding(.top, 12)
                    }
                    .ottlineContentContainer(metrics)
                    .padding(.top, metrics.isSpread ? 24 : 18)
                }
            }
        }
        .background(palette.background)
        .sheet(isPresented: $showExcludedSheet) {
            excludedRecommendationsSheet
        }
        .sheet(isPresented: $showEditionPicker) {
            catalogEditionPickerSheet
        }
        .onAppear {
            if initialPlaceFilter != nil || initialOccasionFilter != nil {
                placeFilter = initialPlaceFilter
                occasionFilter = initialOccasionFilter
                filterExpanded = true
                onClearInitialMomentFilter()
            }
        }
        .task(id: filterTriggerKey) {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if !Task.isCancelled {
                await loadFirstServerPage()
            }
        }
        .task {
            let books = repository.logs.map(\.title).filter { $0.type == .book }
            if !books.isEmpty {
                await repository.ensureBookClassificationsCached(titles: books)
            }
        }
        .onChange(of: locale) { nextLocale in
            if futureMode {
                Task { await recCoordinator.loadState(locale: nextLocale) }
            }
        }
    }

    private enum CompactTimelineEntry: Identifiable {
        case monthHeader(monthKey: String, isFirst: Bool)
        case log(WatchLog)

        var id: String {
            switch self {
            case .monthHeader(let monthKey, _): return "month:\(monthKey)"
            case .log(let log): return "log:\(log.id)"
            }
        }
    }

    private func buildCompactTimelineEntries(_ monthGroups: [MonthLogGroup]) -> [CompactTimelineEntry] {
        var result: [CompactTimelineEntry] = []
        result.reserveCapacity(monthGroups.reduce(monthGroups.count) { $0 + $1.logs.count })
        for (index, group) in monthGroups.enumerated() {
            result.append(.monthHeader(monthKey: group.monthKey, isFirst: index == 0))
            for log in group.logs {
                result.append(.log(log))
            }
        }
        return result
    }

    @ViewBuilder
    private func timelineTopHeaderSections(
        snap: PreferencesSnapshot,
        nickname: String,
        personaTitle: String?,
        momentFilterCount: Int,
        hasActiveFilters: Bool
    ) -> some View {
        // 1. Page Heading + Top Utility Buttons
        VStack(alignment: .leading, spacing: 14) {
            if metrics.isSpread {
                HStack(alignment: .bottom, spacing: 20) {
                    timelineHeaderText(nickname: nickname, personaTitle: personaTitle)
                    Spacer(minLength: 16)
                    timelineToolsRow(snap: snap, nickname: nickname)
                }
            } else {
                timelineHeaderText(nickname: nickname, personaTitle: personaTitle)
                timelineToolsRow(snap: snap, nickname: nickname)
            }
        }
        .padding(.bottom, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(palette.border).frame(height: 1)
        }

        // 2. Sync Notice Banner
        if !futureMode && (
            repository.outboxCount > 0
            || repository.syncState.status != .idle
            || repository.logSyncStatuses.values.contains { $0 == "PENDING" || $0 == "FAILED" }
        ) {
            SyncNoticeBanner(
                syncState: repository.syncState,
                outboxCount: max(
                    repository.outboxCount,
                    repository.logSyncStatuses.values.filter { $0 == "PENDING" || $0 == "FAILED" }.count
                ),
                onRetryTap: { repository.triggerSyncAsync() }
            )
        }

        // 3. Filters (Present mode only)
        if !futureMode {
            if metrics.isSpread {
                spreadFiltersBarSection(momentFilterCount: momentFilterCount, hasActiveFilters: hasActiveFilters)
            } else {
                filtersBarSection(momentFilterCount: momentFilterCount, hasActiveFilters: hasActiveFilters)
            }
        }
    }

    @ViewBuilder
    private func timelineEmptyState(hasActiveFilters: Bool) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(hasActiveFilters
                ? OttlineStrings.tr("조건에 맞는 기록이 없어요.", "No records match these filters.", locale: locale)
                : OttlineStrings.tr("첫 기록을 남겨보세요. 타임라인이 시작됩니다.", "Leave your first record. Your timeline starts here.", locale: locale)
            )
            .font(OttlineFont.regular(15))
            .foregroundStyle(palette.mutedInk)

            if !hasActiveFilters {
                Button {
                    onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                } label: {
                    HStack(spacing: 6) {
                        OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                        Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                            .font(OttlineFont.semiBold(14.5))
                    }
                    .foregroundStyle(palette.onBrandOrange)
                    .padding(.horizontal, 18)
                    .frame(minHeight: 48)
                    .background(palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(metrics.isSpread ? 24 : 0)
        .padding(.vertical, metrics.isSpread ? 0 : 24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(metrics.isSpread ? palette.paperStrong : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay {
            if metrics.isSpread {
                RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1)
            }
        }
    }

    @ViewBuilder
    private func timelineShortMonthList(monthGroups: [MonthLogGroup]) -> some View {
        if metrics.isSpread {
            VStack(alignment: .leading, spacing: 26) {
                ForEach(monthGroups) { group in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(RecordDate.formatMonthLabel(group.monthKey, locale: locale))
                                .font(OttlineFont.bold(18))
                                .foregroundStyle(palette.ink)
                            Spacer()
                            Text(OttlineStrings.tr("최근 기록·수정한 날 기준", "By last recorded or updated", locale: locale))
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }

                        LazyVGrid(
                            columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                            spacing: 16
                        ) {
                            ForEach(group.logs) { log in
                                timelineSpreadCard(log)
                            }
                        }
                    }
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 22) {
                ForEach(monthGroups) { group in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(RecordDate.formatMonthLabel(group.monthKey, locale: locale))
                                .font(OttlineFont.semiBold(18))
                                .foregroundStyle(palette.ink)
                            Spacer()
                            Text(OttlineStrings.tr("최근 기록·수정한 날 기준", "By last recorded or updated", locale: locale))
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }

                        ForEach(group.logs) { log in
                            timelineRecordRow(log)
                        }
                    }
                }
            }
        }

        if hasMorePages {
            loadMoreButton
        }
    }

    @ViewBuilder
    private var loadMoreButton: some View {
        Button {
            Task { await loadNextPage() }
        } label: {
            if metrics.isSpread {
                HStack(spacing: 6) {
                    if loadingMore { ProgressView() }
                    Text(OttlineStrings.tr("이전 기록 더 보기", "Load earlier records", locale: locale))
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.primaryAccent)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
            } else {
                HStack {
                    Spacer()
                    if loadingMore {
                        ProgressView()
                    } else {
                        Text(OttlineStrings.tr("더 불러오기", "Load more", locale: locale))
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    Spacer()
                }
                .frame(minHeight: 48)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
            }
        }
        .buttonStyle(.plain)
        .disabled(loadingMore)
    }

    private func timelineHeaderText(nickname: String, personaTitle: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(OttlineStrings.tr("남겨둔 이야기", "THE STORIES YOU KEPT", locale: locale))
                .font(OttlineFont.medium(11))
                .kerning(0.88)
                .foregroundStyle(palette.mutedInk)

            Text(headerTitle(nickname: nickname))
                .font(OttlineFont.semiBold(metrics.isSpread ? 30 : 27))
                .kerning(-0.7)
                .foregroundStyle(palette.ink)

            Text(headerSubtitle(personaTitle: personaTitle))
                .font(OttlineFont.regular(metrics.isSpread ? 14 : 13.5))
                .foregroundStyle(palette.mutedInk)
        }
    }

    @ViewBuilder
    private func timelineToolsRow(snap: PreferencesSnapshot, nickname: String) -> some View {
        let controlMinHeight: CGFloat = metrics.isSpread ? 40 : 42
        let fontSize: CGFloat = metrics.isSpread ? 13.5 : 13
        let horizontalPad: CGFloat = metrics.isSpread ? 12 : 10
        FlowLayout(horizontalSpacing: metrics.isSpread ? 8 : 6, verticalSpacing: 8) {
            if !futureMode {
                Button(action: onOpenReport) {
                    HStack(spacing: 5) {
                        OttlineLucideIcon(kind: .clock3, size: 13.5, color: palette.primaryAccent, strokeWidth: 2.0)
                        Text(OttlineStrings.tr("내 이용 리포트", "Usage report", locale: locale))
                            .font(OttlineFont.semiBold(fontSize))
                            .foregroundStyle(palette.ink)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, horizontalPad)
                    .frame(minHeight: controlMinHeight)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                if !(snap.userId ?? "").isEmpty {
                    Button {
                        futureMode = true
                        Task { await loadRecommendationState() }
                    } label: {
                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .sparkles, size: 13.5, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text(!nickname.isEmpty
                                ? OttlineStrings.tr("\(nickname)의 미래는?", "\(nickname)'s future?", locale: locale)
                                : OttlineStrings.tr("내 미래는?", "My future?", locale: locale)
                            )
                            .font(OttlineFont.semiBold(fontSize))
                            .lineLimit(1)
                        }
                        .foregroundStyle(palette.primaryAccent)
                        .padding(.horizontal, horizontalPad)
                        .frame(minHeight: controlMinHeight)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.primaryAccent.opacity(0.35), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                if locale == "ko" {
                    Button {
                        onOpenBookshelf(nil)
                    } label: {
                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .bookOpen, size: 13.5, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text("서가 보기")
                                .font(OttlineFont.semiBold(fontSize))
                                .foregroundStyle(palette.ink)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, horizontalPad)
                        .frame(minHeight: controlMinHeight)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Button {
                    futureMode = false
                } label: {
                    Text(OttlineStrings.tr("← 타임라인으로 돌아오기", "← Back to timeline", locale: locale))
                        .font(OttlineFont.semiBold(13.5))
                        .foregroundStyle(palette.ink)
                        .padding(.horizontal, 14)
                        .frame(minHeight: controlMinHeight)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button {
                    showExcludedSheet = true
                } label: {
                    Text(OttlineStrings.tr(
                        "제외한 작품 (\(recCoordinator.state.exclusions.count))",
                        "Excluded (\(recCoordinator.state.exclusions.count))",
                        locale: locale
                    ))
                    .font(OttlineFont.medium(13))
                    .foregroundStyle(palette.mutedInk)
                    .padding(.horizontal, 12)
                    .frame(minHeight: controlMinHeight)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func headerTitle(nickname: String) -> String {
        if futureMode {
            return OttlineStrings.tr("미래의 타임라인", "Future timeline", locale: locale)
        }
        if !nickname.isEmpty {
            return OttlineStrings.tr("\(nickname)의 타임라인", "\(nickname)'s Timeline", locale: locale)
        }
        return OttlineStrings.tr("내 타임라인", "My Timeline", locale: locale)
    }

    private func headerSubtitle(personaTitle: String?) -> String {
        if futureMode {
            return OttlineStrings.tr(
                "지금까지 쌓인 기록의 결로 다음 이야기를 펼쳐봐요",
                "The records you keep now will help us choose your next stories.",
                locale: locale
            )
        }
        if let personaTitle, !personaTitle.isEmpty {
            return OttlineStrings.tr(
                "\(personaTitle)로 쌓아가는 기록이에요",
                "Recorded with your \(personaTitle) point of view",
                locale: locale
            )
        }
        return OttlineStrings.tr(
            "내가 본 것들이 시간 순서로 모여요",
            "Your records are gathered in chronological order",
            locale: locale
        )
    }

    // MARK: - FiltersBar (`FiltersBar.tsx` 1:1 Parity)

    private func spreadFiltersBarSection(momentFilterCount: Int, hasActiveFilters: Bool) -> some View {
        let isBookTab = typeFilter == "book"
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    OttlineLucideIcon(kind: .search, size: 15, color: palette.mutedInk, strokeWidth: 2.0)
                    TextField(
                        OttlineStrings.tr("제목, 저자, 출판사, 메모 검색", "Search title, author, publisher, or note", locale: locale),
                        text: $searchQuery
                    )
                    .font(OttlineFont.regular(14.5))
                    .foregroundStyle(palette.ink)
                    .autocorrectionDisabled()

                    if !searchQuery.isEmpty {
                        Button {
                            searchQuery = ""
                        } label: {
                            OttlineLucideIcon(kind: .x, size: 14, color: palette.mutedInk, strokeWidth: 2.0)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                HStack(spacing: 6) {
                    ForEach([
                        ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                        ("video", OttlineStrings.tr("영상", "Video", locale: locale)),
                        ("book", OttlineStrings.tr("책", "Book", locale: locale))
                    ], id: \.0) { key, label in
                        let selected = typeFilter == key
                        Button {
                            typeFilter = key
                        } label: {
                            Text(label)
                                .font(selected ? OttlineFont.semiBold(13) : OttlineFont.regular(13))
                                .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                .padding(.horizontal, 12)
                                .frame(height: 38)
                                .background(selected ? palette.paperStrong : palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }

                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            filterExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .slidersHorizontal, size: 13, color: (filterExpanded || momentFilterCount > 0) ? palette.primaryAccent : palette.ink, strokeWidth: 2.0)
                            Text(OttlineStrings.tr("그날의 순간으로 찾기", "Find a moment", locale: locale))
                                .font((filterExpanded || momentFilterCount > 0) ? OttlineFont.semiBold(13) : OttlineFont.medium(13))
                                .foregroundStyle((filterExpanded || momentFilterCount > 0) ? palette.primaryAccent : palette.ink)
                                .lineLimit(1)
                            if momentFilterCount > 0 {
                                Text("\(momentFilterCount)")
                                    .font(OttlineFont.semiBold(11))
                                    .foregroundStyle(palette.primaryAccent)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1)
                                    .background(palette.background)
                                    .clipShape(Capsule())
                            }
                            OttlineLucideIcon(kind: filterExpanded ? .chevronUp : .chevronDown, size: 13, color: palette.mutedInk, strokeWidth: 2.0)
                        }
                        .padding(.horizontal, 12)
                        .frame(height: 38)
                        .background((filterExpanded || momentFilterCount > 0) ? palette.paperStrong : palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke((filterExpanded || momentFilterCount > 0) ? palette.primaryAccent : palette.border, lineWidth: (filterExpanded || momentFilterCount > 0) ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            if momentFilterCount > 0 || hasActiveFilters {
                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    if let sf = statusFilter {
                        activeMomentRemovableChip("\(OttlineStrings.statusLabel(sf, type: isBookTab ? .book : .movie, locale: locale)) ×") {
                            statusFilter = nil
                        }
                    }
                    if !platformFilter.isEmpty {
                        activeMomentRemovableChip("\(platformFilter) ×") {
                            platformFilter = ""
                        }
                    }
                    if let pf = placeFilter {
                        activeMomentRemovableChip("\(OttlineStrings.placeLabel(pf, locale: locale)) ×") {
                            placeFilter = nil
                        }
                    }
                    if let of = occasionFilter {
                        activeMomentRemovableChip("\(OttlineStrings.occasionLabel(of, locale: locale)) ×") {
                            occasionFilter = nil
                        }
                    }
                    if let orf = originFilter {
                        let originText = orf == .log
                            ? OttlineStrings.tr("내 기록", "My record", locale: locale)
                            : OttlineStrings.tr("함께 남긴 기록", "From Together", locale: locale)
                        activeMomentRemovableChip("\(originText) ×") {
                            originFilter = nil
                        }
                    }
                    if hasActiveFilters {
                        Button {
                            clearAllFilters()
                        } label: {
                            Text(OttlineStrings.tr("필터 초기화", "Reset filters", locale: locale))
                                .font(OttlineFont.semiBold(12))
                                .foregroundStyle(palette.primaryAccent)
                                .padding(.horizontal, 10)
                                .frame(height: 32)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if filterExpanded {
                momentFilterExpandedCard(hasActiveFilters: hasActiveFilters)
            }
        }
    }

    private func activeMomentRemovableChip(_ label: String, onRemove: @escaping () -> Void) -> some View {
        Button(action: onRemove) {
            Text(label)
                .font(OttlineFont.semiBold(12))
                .foregroundStyle(palette.primaryAccent)
                .padding(.horizontal, 10)
                .frame(height: 32)
                .background(palette.paperStrong)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func clearAllFilters() {
        typeFilter = "all"
        statusFilter = nil
        platformFilter = ""
        placeFilter = nil
        occasionFilter = nil
        originFilter = nil
        searchQuery = ""
    }

    private func momentFilterExpandedCard(hasActiveFilters: Bool) -> some View {
        let isBookTab = typeFilter == "book"
        let groups = PlatformCatalog.groups(isBook: isBookTab, locale: locale)
        let flatDefaults = groups.flatMap(\.items)
        let customs = isBookTab
            ? repository.prefs.snapshot.customBookPlatforms
            : repository.prefs.snapshot.customVideoPlatforms
        let extraCustoms = customs.filter { !flatDefaults.contains($0) }
        let availablePlaces = isBookTab
            ? Place.bookCases
            : (typeFilter == "video" ? Place.videoCases : Place.allCases)

        return VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text(OttlineStrings.tr("상태", "Status", locale: locale))
                    .font(OttlineFont.semiBold(12.5))
                    .foregroundStyle(palette.mutedInk)
                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    filterChip(
                        label: OttlineStrings.tr("모든 상태", "All states", locale: locale),
                        active: statusFilter == nil
                    ) {
                        statusFilter = nil
                    }
                    ForEach(LogStatus.allCases, id: \.self) { st in
                        filterChip(
                            label: OttlineStrings.statusLabel(st, type: isBookTab ? .book : .movie, locale: locale),
                            active: statusFilter == st
                        ) {
                            statusFilter = (statusFilter == st) ? nil : st
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(isBookTab
                    ? OttlineStrings.tr("읽은 곳·플랫폼", "Where you read", locale: locale)
                    : OttlineStrings.tr("플랫폼", "Platform", locale: locale)
                )
                .font(OttlineFont.semiBold(12.5))
                .foregroundStyle(palette.mutedInk)

                ForEach(groups, id: \.id) { grp in
                    VStack(alignment: .leading, spacing: 5) {
                        if !grp.label.isEmpty {
                            Text(grp.label)
                                .font(OttlineFont.medium(11))
                                .foregroundStyle(palette.subtleInk)
                        }
                        FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                            ForEach(grp.items, id: \.self) { plat in
                                filterChip(label: plat, active: platformFilter == plat) {
                                    platformFilter = (platformFilter == plat) ? "" : plat
                                }
                            }
                        }
                    }
                }

                if !extraCustoms.isEmpty {
                    FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                        ForEach(extraCustoms, id: \.self) { plat in
                            filterChip(label: plat, active: platformFilter == plat) {
                                platformFilter = (platformFilter == plat) ? "" : plat
                            }
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(OttlineStrings.tr("장소", "Place", locale: locale))
                    .font(OttlineFont.semiBold(12.5))
                    .foregroundStyle(palette.mutedInk)
                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    ForEach(availablePlaces, id: \.self) { p in
                        filterChip(
                            label: OttlineStrings.placeLabel(p, locale: locale),
                            active: placeFilter == p
                        ) {
                            placeFilter = (placeFilter == p) ? nil : p
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(OttlineStrings.tr("누구와·어떤 상황", "With whom / occasion", locale: locale))
                    .font(OttlineFont.semiBold(12.5))
                    .foregroundStyle(palette.mutedInk)
                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    ForEach(Occasion.allCases, id: \.self) { occ in
                        filterChip(
                            label: OttlineStrings.occasionLabel(occ, locale: locale),
                            active: occasionFilter == occ
                        ) {
                            occasionFilter = (occasionFilter == occ) ? nil : occ
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(OttlineStrings.tr("구분", "Origin", locale: locale))
                    .font(OttlineFont.semiBold(12.5))
                    .foregroundStyle(palette.mutedInk)
                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    filterChip(
                        label: OttlineStrings.tr("내 기록", "My record", locale: locale),
                        active: originFilter == .log
                    ) {
                        originFilter = (originFilter == .log) ? nil : .log
                    }
                    filterChip(
                        label: OttlineStrings.tr("함께 남긴 기록", "From Together", locale: locale),
                        active: originFilter == .comment
                    ) {
                        originFilter = (originFilter == .comment) ? nil : .comment
                    }
                }
            }

            if hasActiveFilters {
                Button {
                    clearAllFilters()
                } label: {
                    Text(OttlineStrings.tr("조건 지우기", "Clear filters", locale: locale))
                        .font(OttlineFont.semiBold(13))
                        .foregroundStyle(palette.primaryAccent)
                        .frame(minHeight: 38)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func filtersBarSection(momentFilterCount: Int, hasActiveFilters: Bool) -> some View {
        let isBookTab = typeFilter == "book"
        let typeItems: [(String, String)] = [
            ("all", OttlineStrings.tr("전체", "All", locale: locale)),
            ("video", OttlineStrings.tr("영상", "Video", locale: locale)),
            ("book", OttlineStrings.tr("책", "Book", locale: locale))
        ]
        let momentActive = filterExpanded || momentFilterCount > 0

        return VStack(alignment: .leading, spacing: 10) {
            // Search Bar (matches title, author, publisher, note, ott)
            HStack(spacing: 8) {
                OttlineLucideIcon(kind: .search, size: 15, color: palette.mutedInk, strokeWidth: 2.0)
                TextField(
                    OttlineStrings.tr("제목, 작가·출판사, 메모 검색", "Title, author, publisher, note", locale: locale),
                    text: $searchQuery
                )
                .font(OttlineFont.regular(14.5))
                .foregroundStyle(palette.ink)
                .autocorrectionDisabled()

                if !searchQuery.isEmpty {
                    Button {
                        searchQuery = ""
                    } label: {
                        OttlineLucideIcon(kind: .x, size: 15, color: palette.mutedInk, strokeWidth: 2.0)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )

            // Single-row Filter Buttons (`전체` · `영상` · `책` · `그날의 순간으로 찾기`)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 6) {
                    ForEach(typeItems, id: \.0) { key, label in
                        compactTypeFilterButton(key: key, label: label)
                    }
                    compactMomentFilterButton(momentFilterCount: momentFilterCount, active: momentActive, expandToFill: true)
                }

                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    ForEach(typeItems, id: \.0) { key, label in
                        compactTypeFilterButton(key: key, label: label)
                    }
                    compactMomentFilterButton(momentFilterCount: momentFilterCount, active: momentActive, expandToFill: false)
                }
            }

            if !filterExpanded && momentFilterCount > 0 {
                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    if let sf = statusFilter {
                        activeMomentRemovableChip("\(OttlineStrings.statusLabel(sf, type: isBookTab ? .book : .movie, locale: locale)) ×") {
                            statusFilter = nil
                        }
                    }
                    if !platformFilter.isEmpty {
                        activeMomentRemovableChip("\(platformFilter) ×") {
                            platformFilter = ""
                        }
                    }
                    if let pf = placeFilter {
                        activeMomentRemovableChip("\(OttlineStrings.placeLabel(pf, locale: locale)) ×") {
                            placeFilter = nil
                        }
                    }
                    if let of = occasionFilter {
                        activeMomentRemovableChip("\(OttlineStrings.occasionLabel(of, locale: locale)) ×") {
                            occasionFilter = nil
                        }
                    }
                    if let orf = originFilter {
                        let originText = orf == .log
                            ? OttlineStrings.tr("내 기록", "My record", locale: locale)
                            : OttlineStrings.tr("함께 남긴 기록", "From Together", locale: locale)
                        activeMomentRemovableChip("\(originText) ×") {
                            originFilter = nil
                        }
                    }
                    Button {
                        clearAllFilters()
                    } label: {
                        Text(OttlineStrings.tr("초기화", "Reset", locale: locale))
                            .font(OttlineFont.semiBold(12))
                            .foregroundStyle(palette.primaryAccent)
                            .padding(.horizontal, 8)
                            .frame(height: 32)
                    }
                    .buttonStyle(.plain)
                }
            }

            if filterExpanded {
                momentFilterExpandedCard(hasActiveFilters: hasActiveFilters)
            }
        }
    }

    private func compactTypeFilterButton(key: String, label: String) -> some View {
        let selected = typeFilter == key
        return Button {
            typeFilter = key
        } label: {
            Text(label)
                .font(selected ? OttlineFont.semiBold(13) : OttlineFont.medium(13))
                .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.horizontal, 11)
                .frame(minHeight: 38)
                .background(selected ? palette.paperStrong : palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func compactMomentFilterButton(momentFilterCount: Int, active: Bool, expandToFill: Bool) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                filterExpanded.toggle()
            }
        } label: {
            HStack(spacing: 5) {
                OttlineLucideIcon(kind: .slidersHorizontal, size: 13.5, color: active ? palette.primaryAccent : palette.ink, strokeWidth: 2.0)
                Text(OttlineStrings.tr("그날의 순간으로 찾기", "Find a moment", locale: locale))
                    .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.medium(12.5))
                    .foregroundStyle(active ? palette.primaryAccent : palette.ink)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                if momentFilterCount > 0 {
                    Text("\(momentFilterCount)")
                        .font(OttlineFont.semiBold(11))
                        .foregroundStyle(palette.primaryAccent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(palette.background)
                        .clipShape(Capsule())
                }
                if expandToFill {
                    Spacer(minLength: 2)
                }
                OttlineLucideIcon(
                    kind: filterExpanded ? .chevronUp : .chevronDown,
                    size: 13,
                    color: active ? palette.primaryAccent : palette.mutedInk,
                    strokeWidth: 2.0
                )
            }
            .padding(.horizontal, 10)
            .frame(maxWidth: expandToFill ? .infinity : nil, minHeight: 38)
            .background(active ? palette.paperStrong : palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func filterChip(label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                .foregroundStyle(active ? palette.onBrandNavy : palette.ink)
                .padding(.horizontal, 10)
                .frame(minHeight: 34)
                .background(active ? palette.brandNavy : palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(active ? palette.brandNavy : palette.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Timeline Spread 2-Column Card & Compact Record Row

    private func timelineSpreadCard(_ log: WatchLog) -> some View {
        let isBook = log.title.type == .book
        let isbn13 = isBook ? BookshelfBuilder.normalizeBookIsbn13(log.title) : nil
        let cls = isbn13.flatMap { repository.bookClassifications[$0] }
        let kdcMajor = (cls?.isResolved == true) ? cls?.kdcMajor : nil
        let syncStatus = repository.logSyncStatuses[log.id]
        let isStoredLocally = (syncStatus == "PENDING" || syncStatus == "FAILED")
        let dateIso = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
        let dateStr = RecordDate.formatDisplayDate(dateIso, locale: locale)
        let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        let editionText: String? = {
            if isBook {
                let parts = [log.title.author, log.title.publisher].compactMap { $0 }.filter { !$0.isEmpty }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            } else {
                let parts = [
                    log.seasonNumber.map { locale == "en" ? "Season \($0)" : "시즌 \($0)" },
                    log.episodeNumber.map { locale == "en" ? "Ep \($0)" : "\($0)화" }
                ].compactMap { $0 }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            }
        }()

        let momentLabels = buildMomentLabels(log)

        return Button {
            onOpenTitleDetail(log.title.id)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 14) {
                    PosterImage(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type,
                        width: 68,
                        height: 100,
                        cornerRadius: 6
                    )

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(log.title.name)
                                .font(OttlineFont.bold(16))
                                .foregroundStyle(palette.ink)
                                .lineLimit(1)

                            Spacer(minLength: 4)

                            Text(dateStr)
                                .font(OttlineFont.regular(11.5))
                                .foregroundStyle(palette.subtleInk)
                                .lineLimit(1)
                                .fixedSize(horizontal: true, vertical: false)
                        }

                        HStack(spacing: 6) {
                            Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                                .font(OttlineFont.semiBold(12.5))
                                .foregroundStyle(palette.primaryAccent)
                                .fixedSize(horizontal: true, vertical: false)

                            RecordFeelingBadge(rating: log.rating, isBook: isBook, compact: true)
                                .fixedSize(horizontal: true, vertical: false)

                            if let editionText {
                                Text("· \(editionText)")
                                    .font(OttlineFont.regular(12))
                                    .foregroundStyle(palette.mutedInk)
                                    .lineLimit(1)
                            }
                        }

                        if !momentLabels.isEmpty {
                            momentLabelRow(momentLabels)
                        }

                        if isStoredLocally || log.origin == .comment || (isBook && locale == "ko" && kdcMajor != nil) {
                            HStack(spacing: 6) {
                                if isStoredLocally {
                                    Text(OttlineStrings.tr("이 기기에 보관 중", "Kept on this device", locale: locale))
                                        .font(OttlineFont.medium(11))
                                        .foregroundStyle(palette.mutedInk)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 4))
                                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(palette.border, lineWidth: 1))
                                }
                                if log.origin == .comment {
                                    Text(OttlineStrings.tr("함께 남긴 기록", "From Together", locale: locale))
                                        .font(OttlineFont.medium(11))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                if isBook, locale == "ko", let kdcMajor {
                                    Text("\(BookshelfBuilder.kdcSectionName(major: kdcMajor, locale: locale)) 서가")
                                        .font(OttlineFont.medium(11))
                                        .foregroundStyle(palette.primaryAccent)
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                }

                if log.spoiler {
                    Text(OttlineStrings.tr("스포일러가 포함된 메모는 상세 보기에서 볼 수 있어요.", "Spoiler note hidden here — open details to read.", locale: locale))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.subtleInk)
                } else if !note.isEmpty {
                    InlineNoteText(text: note, fontSize: 14.5, lineLimit: 3, preserveNewlines: true, lineSpacing: 7)
                }

                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private func buildMomentLabels(_ log: WatchLog) -> [String] {
        var labels: [String] = []
        if let ott = log.ott?.trimmingCharacters(in: .whitespacesAndNewlines), !ott.isEmpty {
            labels.append(ott)
        }
        if let place = log.place {
            labels.append(OttlineStrings.placeLabel(place, locale: locale))
        }
        if let occasion = log.occasion {
            labels.append(OttlineStrings.occasionLabel(occasion, locale: locale))
        }
        return labels
    }

    private func momentLabelRow(_ labels: [String]) -> some View {
        HStack(spacing: 5) {
            ForEach(Array(labels.enumerated()), id: \.offset) { _, label in
                Text(label)
                    .font(OttlineFont.medium(11.5))
                    .foregroundStyle(palette.mutedInk)
                    .lineLimit(1)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(palette.border, lineWidth: 1)
                    )
            }
        }
    }

    private func timelineRecordRow(_ log: WatchLog) -> some View {
        let isBook = log.title.type == .book
        let isbn13 = isBook ? BookshelfBuilder.normalizeBookIsbn13(log.title) : nil
        let cls = isbn13.flatMap { repository.bookClassifications[$0] }
        let kdcMajor = (cls?.isResolved == true) ? cls?.kdcMajor : nil
        let syncStatus = repository.logSyncStatuses[log.id]
        let isStoredLocally = (syncStatus == "PENDING" || syncStatus == "FAILED")
        let dateIso = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
        let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let momentLabels = buildMomentLabels(log)

        let editionText: String? = {
            if isBook {
                let author = log.title.author?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if !author.isEmpty { return author }
                if locale == "ko", let kdcMajor {
                    return "\(BookshelfBuilder.kdcSectionName(major: kdcMajor, locale: locale)) 서가"
                }
                return nil
            } else {
                let parts = [
                    log.seasonNumber.map { locale == "en" ? "Season \($0)" : "시즌 \($0)" },
                    log.episodeNumber.map { locale == "en" ? "Ep \($0)" : "\($0)화" }
                ].compactMap { $0 }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            }
        }()

        return Button {
            onOpenTitleDetail(log.title.id)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    // Left Date Column
                    VStack(alignment: .leading, spacing: 1) {
                        Text(RecordDate.formatTimelineMonth(dateIso, locale: locale))
                            .font(OttlineFont.regular(11.5))
                            .foregroundStyle(palette.mutedInk)
                        Text(RecordDate.formatTimelineDay(dateIso))
                            .font(OttlineFont.semiBold(28))
                            .foregroundStyle(palette.ink)
                        if log.watchedAt.isEmpty {
                            Text(OttlineStrings.tr("기록한 날", "Recorded", locale: locale))
                                .font(OttlineFont.regular(10))
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                    .frame(width: 40, alignment: .leading)

                    // Middle Poster
                    PosterImage(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type,
                        width: 56,
                        height: 84,
                        cornerRadius: 6
                    )

                    // Right 3-Line Content Stack:
                    // 1) Title (1 line)
                    // 2) Status + Feeling + Season/Author (1 line)
                    // 3) Platform + Place + Occasion labels (1 line)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Text(log.title.name)
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)
                                .lineLimit(1)

                            if isStoredLocally {
                                Text(OttlineStrings.tr("보관 중", "Local", locale: locale))
                                    .font(OttlineFont.medium(10.5))
                                    .foregroundStyle(palette.mutedInk)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1.5)
                                    .background(palette.paperStrong)
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(palette.border, lineWidth: 1))
                                    .fixedSize(horizontal: true, vertical: false)
                            } else if log.origin == .comment {
                                Text(OttlineStrings.tr("함께", "Together", locale: locale))
                                    .font(OttlineFont.medium(10.5))
                                    .foregroundStyle(palette.primaryAccent)
                                    .fixedSize(horizontal: true, vertical: false)
                            }
                        }

                        HStack(spacing: 6) {
                            Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                                .font(OttlineFont.semiBold(12.5))
                                .foregroundStyle(palette.primaryAccent)
                                .fixedSize(horizontal: true, vertical: false)

                            RecordFeelingBadge(rating: log.rating, isBook: isBook, compact: true)
                                .fixedSize(horizontal: true, vertical: false)

                            if let editionText {
                                Text("· \(editionText)")
                                    .font(OttlineFont.regular(12))
                                    .foregroundStyle(palette.mutedInk)
                                    .lineLimit(1)
                            }
                        }

                        if !momentLabels.isEmpty {
                            momentLabelRow(momentLabels)
                        }
                    }

                    Spacer(minLength: 0)
                }

                if log.spoiler {
                    Text(OttlineStrings.tr("스포일러가 포함된 메모는 상세 보기에서 볼 수 있어요.", "Spoiler note hidden here — open details to read.", locale: locale))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.subtleInk)
                } else if !note.isEmpty {
                    InlineNoteText(text: note, fontSize: 14.5, lineLimit: 3, lineSpacing: 7)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    // MARK: - OpenAI v2 Future Timeline (`RecommendationDeck.tsx` 1:1 Parity)

    @ViewBuilder
    private func futureTimelineContent(allLogsCount: Int) -> some View {
        let recState = recCoordinator.state
        let busy = recCoordinator.isGenerating || recState.generating
        let canRequest = !busy && (recState.quota.remaining > 0 || recCoordinator.hasPendingAttempt)

        VStack(alignment: .leading, spacing: 16) {
            if let excluded = recCoordinator.lastExcludedItem {
                HStack(spacing: 10) {
                    Text(OttlineStrings.tr("‘\(excluded.name)’을(를) 제외했어요.", "Excluded ‘\(excluded.name)’.", locale: locale))
                        .font(OttlineFont.regular(13))
                        .foregroundStyle(palette.ink)
                    Spacer()
                    Button {
                        Task { await restoreExclusion(key: excluded.key) }
                    } label: {
                        HStack(spacing: 4) {
                            OttlineLucideIcon(kind: .rotateCcw, size: 13, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text(OttlineStrings.tr("되돌리기", "Undo", locale: locale))
                                .font(OttlineFont.semiBold(13))
                        }
                        .foregroundStyle(palette.primaryAccent)
                    }
                    .buttonStyle(.plain)
                }
                .padding(12)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }

            if recCoordinator.isLoadingState && !recState.eligible && recState.items.isEmpty && !recState.hasBatch {
                HStack(spacing: 10) {
                    ProgressView()
                    Text(OttlineStrings.tr(
                        "추천 상태를 불러오고 있어요...",
                        "Loading recommendations...",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                }
                .padding(.vertical, 16)
            } else if allLogsCount < 5 || !recState.eligible {
                Text(OttlineStrings.tr(
                    "기록이 다섯 개 이상 쌓이면, 지금까지 남긴 작품의 결을 따라 다음에 만날 이야기를 찾아볼 수 있어요.",
                    "With five or more records, we can suggest a few stories to meet next.",
                    locale: locale
                ))
                .font(OttlineFont.regular(15))
                .foregroundStyle(palette.mutedInk)
                .padding(.vertical, 16)
            } else {
                // Quota + Generate Header Bar
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(OttlineStrings.tr(
                            "오늘 남은 생성 \(recState.quota.remaining)/\(recState.quota.limit)",
                            "Generations left today: \(recState.quota.remaining)/\(recState.quota.limit)",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(13.5))
                        .foregroundStyle(palette.ink)
                        if let genAt = recState.generatedAt, !genAt.isEmpty {
                            Text(OttlineStrings.tr(
                                "마지막 생성: \(RecordDate.formatDisplayDate(genAt, locale: locale))",
                                "Last generated: \(RecordDate.formatDisplayDate(genAt, locale: locale))",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(11.5))
                            .foregroundStyle(palette.mutedInk)
                        }
                    }
                    Spacer()
                    Button {
                        Task { await requestNewRecommendations() }
                    } label: {
                        HStack(spacing: 6) {
                            if busy {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(palette.onBrandOrange)
                            } else {
                                OttlineLucideIcon(kind: .sparkles, size: 15, color: canRequest ? palette.onBrandOrange : palette.mutedInk, strokeWidth: 2.0)
                            }
                            Text(recCoordinator.hasPendingAttempt && !busy
                                ? OttlineStrings.tr("다시 확인·시도하기", "Retry check", locale: locale)
                                : (recState.hasBatch
                                    ? OttlineStrings.tr("새로 추천받기", "Generate new", locale: locale)
                                    : OttlineStrings.tr("다음 작품 추천받기", "Find next stories", locale: locale))
                            )
                            .font(OttlineFont.semiBold(13.5))
                        }
                        .foregroundStyle(canRequest ? palette.onBrandOrange : palette.mutedInk)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(canRequest ? palette.brandOrange : palette.mutedBg)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canRequest)
                }
                .padding(14)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                if let recError = recCoordinator.errorMessage, !recError.isEmpty {
                    Text(recError)
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.danger)
                }

                if busy || (recCoordinator.isLoadingState && recState.items.isEmpty) {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text(OttlineStrings.tr(
                            "남겨둔 기록의 결을 따라 다음 이야기를 고르고 있어요...",
                            "Choosing next stories from your timeline...",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                    }
                    .padding(.vertical, 10)
                }

                if recState.items.isEmpty {
                    if !busy && !recCoordinator.isLoadingState {
                        Text(recState.hasBatch
                            ? OttlineStrings.tr("표시할 추천 작품이 남아 있지 않아요. 새로 생성해 보세요.", "No recommendations left in this batch.", locale: locale)
                            : OttlineStrings.tr("위의 버튼을 눌러 다음에 만날 작품을 받아보세요.", "Tap the button above to generate recommendations.", locale: locale)
                        )
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                        .padding(.vertical, 16)
                    }
                } else if metrics.isSpread {
                    LazyVGrid(
                        columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
                        spacing: 12
                    ) {
                        ForEach(recState.items) { item in
                            recommendationCard(item)
                                .frame(maxHeight: .infinity, alignment: .topLeading)
                        }
                    }
                } else {
                    ForEach(recState.items) { item in
                        recommendationCard(item)
                    }
                }
            }

            // OpenAI data usage disclosure
            VStack(alignment: .leading, spacing: 6) {
                Text(OttlineStrings.tr(
                    "추천을 요청하면 최근 기록한 작품 제목·유형·장르·느낌, 남긴 경우 메모와 장소·상황, 제외 작품 목록을 OpenAI에 전송해 다음 작품을 추천받아요.",
                    "When you request new stories, OpenAI receives your recent titles, types, genres, feelings, any notes, places or occasions, and excluded titles.",
                    locale: locale
                ))
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)
                .lineSpacing(3)
            }
            .padding(14)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
        }
    }

    private func recommendationCard(_ item: RecommendationItem) -> some View {
        let itemType = item.type
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 14) {
                PosterImage(
                    posterUrl: item.posterUrl,
                    titleName: item.name,
                    titleType: itemType,
                    width: 64,
                    height: 96
                )
                VStack(alignment: .leading, spacing: 6) {
                    Text([
                        OttlineStrings.titleTypeLabel(itemType, locale: locale),
                        item.year.map(String.init),
                        item.author
                    ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)

                    Text(item.name)
                        .font(OttlineFont.semiBold(17))
                        .foregroundStyle(palette.ink)

                    let reason = item.reason.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !reason.isEmpty {
                        Text(reason)
                            .font(OttlineFont.regular(13.5))
                            .foregroundStyle(palette.ink)
                            .lineSpacing(3)
                    }

                    FlowLayout(horizontalSpacing: 12, verticalSpacing: 8) {
                        Button {
                            Task { await connectRecommendationToRecord(item) }
                        } label: {
                            HStack(spacing: 5) {
                                if catalogResolvingKey == item.id {
                                    ProgressView().controlSize(.mini)
                                }
                                Text(OttlineStrings.tr("기록 남기기", "Keep a record", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(catalogResolvingKey == item.id)

                        Button {
                            Task { await excludeItem(item) }
                        } label: {
                            Text(OttlineStrings.tr("제외", "Exclude", locale: locale))
                                .font(OttlineFont.regular(13))
                                .foregroundStyle(palette.mutedInk)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(14)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private var excludedRecommendationsSheet: some View {
        let exclusions = recCoordinator.state.exclusions
        return NavigationStack {
            List {
                if exclusions.isEmpty {
                    Text(OttlineStrings.tr("제외한 작품이 없어요.", "No excluded titles.", locale: locale))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                } else {
                    ForEach(exclusions) { ex in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(ex.name)
                                    .font(OttlineFont.semiBold(15))
                                    .foregroundStyle(palette.ink)
                                if let t = ex.type {
                                    Text(OttlineStrings.titleTypeLabel(t, locale: locale))
                                        .font(OttlineFont.regular(12))
                                        .foregroundStyle(palette.mutedInk)
                                }
                            }
                            Spacer()
                            Button {
                                Task { await restoreExclusion(key: ex.key) }
                            } label: {
                                Text(OttlineStrings.tr("되돌리기", "Restore", locale: locale))
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .navigationTitle(OttlineStrings.tr("제외한 작품", "Excluded titles", locale: locale))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) {
                        showExcludedSheet = false
                    }
                }
            }
        }
    }

    private var catalogEditionPickerSheet: some View {
        NavigationStack {
            List(editionPickerCandidates) { item in
                Button {
                    showEditionPicker = false
                    onOpenQuickRecord(
                        QuickRecordRequest(
                            preselectedSearchItem: item,
                            preferredStatus: .wishlist,
                            selectSource: "future_timeline",
                            autoFocusSearch: false
                        )
                    )
                } label: {
                    HStack(spacing: 12) {
                        PosterImage(
                            posterUrl: item.posterUrl,
                            titleName: item.name,
                            titleType: item.type,
                            width: 44,
                            height: 64
                        )
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.name)
                                .font(OttlineFont.semiBold(15))
                                .foregroundStyle(palette.ink)
                            Text([
                                OttlineStrings.titleTypeLabel(item.type, locale: locale),
                                item.author,
                                item.publisher,
                                item.year.map(String.init)
                            ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .navigationTitle(editionPickerSourceTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) {
                        showEditionPicker = false
                    }
                }
            }
        }
    }

    // MARK: - Pagination & Actions

    private func loadFirstServerPage() async {
        guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
        let ct = typeFilter == "all" ? nil : typeFilter
        let qTrimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if let page = try? await repository.api.getLogsPage(
            limit: 50,
            cursor: nil,
            contentType: ct,
            status: statusFilter,
            origin: originFilter,
            ott: platformFilter.isEmpty ? nil : platformFilter,
            place: placeFilter,
            occasion: occasionFilter,
            query: qTrimmed.isEmpty ? nil : qTrimmed
        ) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
    }

    private func loadNextPage() async {
        guard hasMorePages, !loadingMore, let cursor = nextCursor else { return }
        loadingMore = true
        let ct = typeFilter == "all" ? nil : typeFilter
        let qTrimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if let page = try? await repository.api.getLogsPage(
            limit: 50,
            cursor: cursor,
            contentType: ct,
            status: statusFilter,
            origin: originFilter,
            ott: platformFilter.isEmpty ? nil : platformFilter,
            place: placeFilter,
            occasion: occasionFilter,
            query: qTrimmed.isEmpty ? nil : qTrimmed
        ) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
        loadingMore = false
    }

    private func loadRecommendationState() async {
        await recCoordinator.loadState(locale: locale)
    }

    private func requestNewRecommendations() async {
        await recCoordinator.requestGeneration(locale: locale)
    }

    private func excludeItem(_ item: RecommendationItem) async {
        await recCoordinator.excludeItem(item, locale: locale)
    }

    private func restoreExclusion(key: String) async {
        await recCoordinator.restoreExclusion(key: key, locale: locale)
    }

    private func connectRecommendationToRecord(_ item: RecommendationItem) async {
        if let cat = item.catalogTitle {
            onOpenQuickRecord(
                QuickRecordRequest(
                    preselectedSearchItem: cat,
                    preferredStatus: .wishlist,
                    selectSource: "future_timeline",
                    autoFocusSearch: false
                )
            )
            return
        }
        catalogResolvingKey = item.id
        defer { catalogResolvingKey = nil }
        let query = item.name
        let results = (try? await repository.api.searchRecommendationCatalog(
            name: item.name,
            type: item.type,
            year: item.year,
            author: item.author
        )) ?? []
        if results.isEmpty {
            onOpenQuickRecord(
                QuickRecordRequest(
                    initialQuery: query,
                    initialTypeTab: item.type.rawValue,
                    preferredStatus: .wishlist,
                    autoFocusSearch: false
                )
            )
        } else if results.count == 1 && item.type != .book {
            onOpenQuickRecord(
                QuickRecordRequest(
                    preselectedSearchItem: results[0],
                    preferredStatus: .wishlist,
                    selectSource: "future_timeline",
                    autoFocusSearch: false
                )
            )
        } else {
            editionPickerSourceTitle = item.name
            editionPickerCandidates = results
            showEditionPicker = true
        }
    }
}
