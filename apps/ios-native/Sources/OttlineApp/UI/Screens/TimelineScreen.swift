import SwiftUI
import OttlineCore

public struct TimelineScreen: View {
    public let repository: OttlineRepository
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
    @State private var typeFilter: String = "all" // "all" | "movie" | "series" | "book"
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
    @State private var recState: RecommendationState = RecommendationState()
    @State private var recLoading: Bool = false
    @State private var recGeneratingAction: Bool = false
    @State private var recError: String?
    @State private var lastExcludedItem: RecommendationExclusion?
    @State private var showExcludedSheet: Bool = false
    @State private var catalogResolvingKey: String?
    @State private var editionPickerCandidates: [TitleSearchItem] = []
    @State private var editionPickerSourceTitle: String = ""
    @State private var showEditionPicker: Bool = false

    // Share note to Together state
    @State private var sharedNoteLogIds: Set<String> = []
    @State private var sharingNoteLogId: String?

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
        self.repository = repository
        self.initialPlaceFilter = initialPlaceFilter
        self.initialOccasionFilter = initialOccasionFilter
        self.onClearInitialMomentFilter = onClearInitialMomentFilter
        self.onOpenQuickRecord = onOpenQuickRecord
        self.onOpenTitleDetail = onOpenTitleDetail
        self.onOpenReport = onOpenReport
        self.onOpenBookshelf = onOpenBookshelf
        self.onOpenShareCard = onOpenShareCard
    }

    public var body: some View {
        let allLogs = repository.logs
        let snap = repository.prefs.snapshot
        let nickname = snap.nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let personaTitle: String? = snap.personaKey.map { OttlineStrings.personaPreset($0).title(locale) }

        let filteredLogs = allLogs.filter { log in
            if typeFilter == "movie" && log.title.type != .movie { return false }
            if typeFilter == "series" && log.title.type != .series { return false }
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
        let sortedLogs = filteredLogs.sorted {
            RecordDate.parseInstantMillis(TimelineMoments.timelineSortKey($0)) >
                RecordDate.parseInstantMillis(TimelineMoments.timelineSortKey($1))
        }
        let monthGroups = TimelineMoments.groupLogsByMonth(sortedLogs)
        let momentFilterCount = [
            !platformFilter.isEmpty,
            placeFilter != nil,
            occasionFilter != nil,
            originFilter != nil
        ].filter { $0 }.count
        let hasActiveFilters = momentFilterCount > 0
            || statusFilter != nil
            || !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || typeFilter != "all"

        let filterTriggerKey = "\(typeFilter)-\(statusFilter?.rawValue ?? "")-\(platformFilter)-\(placeFilter?.rawValue ?? "")-\(occasionFilter?.rawValue ?? "")-\(originFilter?.rawValue ?? "")-\(searchQuery)"

        GeometryReader { scrollGeo in
            ScrollView {
                OttlineStickyFooterLayout(
                    minHeight: scrollGeo.size.height,
                    topPadding: metrics.isSpread ? 24 : 18,
                    bottomPadding: metrics.isSpread ? 24 : 110,
                    minSpacing: 20
                ) {
                    LazyVStack(alignment: .leading, spacing: 20) {
                // 1. Page Heading
                VStack(alignment: .leading, spacing: 14) {
                    if metrics.isSpread {
                        HStack(alignment: .bottom, spacing: 20) {
                            timelineHeaderText(nickname: nickname, personaTitle: personaTitle)
                            Spacer(minLength: 16)
                            timelineToolsRow(snap: snap, nickname: nickname, filteredLogs: filteredLogs)
                        }
                    } else {
                        timelineHeaderText(nickname: nickname, personaTitle: personaTitle)
                        timelineToolsRow(snap: snap, nickname: nickname, filteredLogs: filteredLogs)
                    }
                }
                .padding(.bottom, 14)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(palette.border).frame(height: 1)
                }

                // 2. Report Entry Row (Compact only — spread places it cleanly in header tools)
                if !futureMode && !metrics.isSpread {
                    Button(action: onOpenReport) {
                        HStack(spacing: 8) {
                            OttlineLucideIcon(kind: .clock3, size: 15, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text(OttlineStrings.tr("이용 리포트", "Usage Report", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                            Spacer()
                            Text("→")
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                // 3. Sync Notice Banner
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

                // 4. Future Timeline Mode vs Present Timeline Mode
                if futureMode {
                    futureTimelineContent(allLogsCount: allLogs.count)
                } else {
                    if metrics.isSpread {
                        spreadFiltersBarSection(momentFilterCount: momentFilterCount, hasActiveFilters: hasActiveFilters)
                    } else {
                        filtersBarSection(momentFilterCount: momentFilterCount, hasActiveFilters: hasActiveFilters)
                    }

                    if typeFilter == "book" && locale == "ko" {
                        Button {
                            onOpenBookshelf(nil)
                        } label: {
                            HStack(spacing: 10) {
                                OttlineLucideIcon(kind: .bookOpen, size: 16, color: palette.primaryAccent, strokeWidth: 2.0)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("내 서가 펼치기")
                                        .font(OttlineFont.semiBold(14.5))
                                        .foregroundStyle(palette.ink)
                                    Text("남긴 책을 KDC 주제별 서가로 모아볼 수 있어요.")
                                        .font(OttlineFont.regular(12))
                                        .foregroundStyle(palette.mutedInk)
                                }
                                Spacer()
                                Text("→")
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .padding(14)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    if sortedLogs.isEmpty {
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
                    } else if metrics.isSpread {
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

                        if hasMorePages {
                            Button {
                                Task { await loadNextPage() }
                            } label: {
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
                            }
                            .buttonStyle(.plain)
                            .disabled(loadingMore)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 26) {
                            ForEach(monthGroups) { group in
                                VStack(alignment: .leading, spacing: 0) {
                                    HStack(alignment: .firstTextBaseline) {
                                        Text(RecordDate.formatMonthLabel(group.monthKey, locale: locale))
                                            .font(OttlineFont.semiBold(19))
                                            .foregroundStyle(palette.ink)
                                        Spacer()
                                        Text(OttlineStrings.tr("최근 기록·수정한 날 기준", "By last recorded or updated", locale: locale))
                                            .font(OttlineFont.regular(12))
                                            .foregroundStyle(palette.mutedInk)
                                    }
                                    .padding(.bottom, 10)
                                    .overlay(alignment: .bottom) {
                                        Rectangle().fill(palette.border).frame(height: 1)
                                    }

                                    ForEach(group.logs) { log in
                                        timelineRecordRow(log)
                                        Rectangle()
                                            .fill(palette.border)
                                            .frame(height: 1)
                                    }
                                }
                            }
                        }

                        if hasMorePages {
                            Button {
                                Task { await loadNextPage() }
                            } label: {
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
                            .buttonStyle(.plain)
                        }
                    }
                }
                    }

                    OttlineAppFooter(bottomPadding: 0)
                }
                .ottlineContentContainer(metrics)
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
    private func timelineToolsRow(snap: PreferencesSnapshot, nickname: String, filteredLogs: [WatchLog]) -> some View {
        let controlMinHeight: CGFloat = metrics.isSpread ? 40 : 44
        FlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
            if !futureMode {
                // Header `OttlinePadHeader` already exposes `기록 남기기` in spread mode (`pref_mw6ez7ie_51c36197`).
                if !metrics.isSpread {
                    Button {
                        onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                    } label: {
                        HStack(spacing: 6) {
                            OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                            Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                                .font(OttlineFont.semiBold(14))
                        }
                        .foregroundStyle(palette.onBrandOrange)
                        .padding(.horizontal, 14)
                        .frame(minHeight: controlMinHeight)
                        .background(palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }

                if !(snap.userId ?? "").isEmpty {
                    Button {
                        futureMode = true
                        Task { await loadRecommendationState() }
                    } label: {
                        HStack(spacing: 6) {
                            OttlineLucideIcon(kind: .sparkles, size: 14, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text(!nickname.isEmpty
                                ? OttlineStrings.tr("\(nickname)의 미래는?", "\(nickname)'s future?", locale: locale)
                                : OttlineStrings.tr("미래의 타임라인", "Future timeline", locale: locale)
                            )
                            .font(OttlineFont.semiBold(13.5))
                        }
                        .foregroundStyle(palette.primaryAccent)
                        .padding(.horizontal, 13)
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

                if metrics.isSpread {
                    Button(action: onOpenReport) {
                        Text(OttlineStrings.tr("이용 리포트", "Usage Report", locale: locale))
                            .font(OttlineFont.medium(13.5))
                            .foregroundStyle(palette.ink)
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

                    if locale == "ko" {
                        Button {
                            onOpenBookshelf(nil)
                        } label: {
                            HStack(spacing: 5) {
                                OttlineLucideIcon(kind: .bookOpen, size: 14, color: palette.ink)
                                Text("내 서가")
                                    .font(OttlineFont.medium(13.5))
                                    .foregroundStyle(palette.ink)
                            }
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

                if !filteredLogs.isEmpty,
                   let csvUrl = CsvExporter.writeTemporaryCsvFile(logs: filteredLogs, locale: locale) {
                    ShareLink(item: csvUrl) {
                        if metrics.isSpread {
                            HStack(spacing: 5) {
                                OttlineLucideIcon(kind: .download, size: 14, color: palette.ink, strokeWidth: 2.0)
                                Text(OttlineStrings.tr("CSV 저장", "Export CSV", locale: locale))
                                    .font(OttlineFont.medium(13.5))
                                    .foregroundStyle(palette.ink)
                            }
                            .padding(.horizontal, 12)
                            .frame(minHeight: controlMinHeight)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        } else {
                            OttlineLucideIcon(kind: .download, size: 16, color: palette.ink, strokeWidth: 2.0)
                                .frame(width: controlMinHeight, height: controlMinHeight)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(OttlineStrings.tr("CSV 내보내기", "Export CSV", locale: locale))
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
                        "제외한 작품 (\(recState.exclusions.count))",
                        "Excluded (\(recState.exclusions.count))",
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
                        ("movie", OttlineStrings.tr("영화", "Movie", locale: locale)),
                        ("series", OttlineStrings.tr("시리즈", "Series", locale: locale)),
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
                }
            }

            FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                spreadStatusChip(nil, OttlineStrings.tr("전체 상태", "All states", locale: locale))
                ForEach(LogStatus.allCases, id: \.self) { st in
                    spreadStatusChip(
                        st,
                        OttlineStrings.statusLabel(st, type: isBookTab ? .book : .movie, locale: locale)
                    )
                }

                Button {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        filterExpanded.toggle()
                    }
                } label: {
                    HStack(spacing: 5) {
                        OttlineLucideIcon(kind: .slidersHorizontal, size: 13, color: momentFilterCount > 0 ? palette.primaryAccent : palette.mutedInk, strokeWidth: 2.0)
                        Text(OttlineStrings.tr("그날의 순간으로 찾기", "Find a moment", locale: locale))
                            .font(momentFilterCount > 0 ? OttlineFont.semiBold(12) : OttlineFont.medium(12))
                            .foregroundStyle(momentFilterCount > 0 ? palette.primaryAccent : palette.mutedInk)
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
                    .padding(.horizontal, 10)
                    .frame(height: 32)
                    .background((filterExpanded || momentFilterCount > 0) ? palette.paperStrong : palette.card)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke((filterExpanded || momentFilterCount > 0) ? palette.primaryAccent : palette.border, lineWidth: (filterExpanded || momentFilterCount > 0) ? 1.4 : 1)
                    )
                }
                .buttonStyle(.plain)

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

            if filterExpanded {
                momentFilterExpandedCard(hasActiveFilters: hasActiveFilters)
            }
        }
    }

    private func spreadStatusChip(_ value: LogStatus?, _ label: String) -> some View {
        let active = statusFilter == value
        return Button {
            statusFilter = value
        } label: {
            Text(label)
                .font(active ? OttlineFont.semiBold(12) : OttlineFont.regular(12))
                .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                .padding(.horizontal, 10)
                .frame(height: 32)
                .background(active ? palette.paperStrong : palette.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.4 : 1))
        }
        .buttonStyle(.plain)
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
            : ((typeFilter == "movie" || typeFilter == "series") ? Place.videoCases : Place.allCases)

        return VStack(alignment: .leading, spacing: 14) {
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

        return VStack(alignment: .leading, spacing: 12) {
            // Underline Content-Type Tabs (`전체` | `영화` | `시리즈` | `책`)
            HStack(spacing: 0) {
                ForEach([
                    ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                    ("movie", OttlineStrings.tr("영화", "Movie", locale: locale)),
                    ("series", OttlineStrings.tr("시리즈", "Series", locale: locale)),
                    ("book", OttlineStrings.tr("책", "Book", locale: locale))
                ], id: \.0) { key, label in
                    let selected = typeFilter == key
                    Button {
                        typeFilter = key
                    } label: {
                        VStack(spacing: 8) {
                            Text(label)
                                .font(selected ? OttlineFont.semiBold(14.5) : OttlineFont.medium(14.5))
                                .foregroundStyle(selected ? palette.ink : palette.mutedInk)
                            Rectangle()
                                .fill(selected ? palette.ink : Color.clear)
                                .frame(height: 2)
                        }
                        .frame(maxWidth: .infinity, minHeight: 42)
                    }
                    .buttonStyle(.plain)
                }
            }
            .overlay(alignment: .bottom) {
                Rectangle().fill(palette.border).frame(height: 1)
            }

            // Status filter row
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    statusChip(label: OttlineStrings.tr("모든 상태", "All states", locale: locale), active: statusFilter == nil) {
                        statusFilter = nil
                    }
                    ForEach(LogStatus.allCases, id: \.self) { st in
                        statusChip(
                            label: OttlineStrings.statusLabel(st, type: isBookTab ? .book : .movie, locale: locale),
                            active: statusFilter == st
                        ) {
                            statusFilter = (statusFilter == st) ? nil : st
                        }
                    }
                }
            }

            // 48pt Search Bar (matches title, author, publisher, note, ott)
            HStack(spacing: 8) {
                OttlineLucideIcon(kind: .search, size: 16, color: palette.mutedInk, strokeWidth: 2.0)
                TextField(
                    OttlineStrings.tr("제목, 작가·출판사, 메모 검색", "Title, author, publisher, note", locale: locale),
                    text: $searchQuery
                )
                .font(OttlineFont.regular(15))
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
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )

            // Full-width white `"그날의 순간으로 찾기"` toggle
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    filterExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    OttlineLucideIcon(kind: .slidersHorizontal, size: 15, color: palette.ink, strokeWidth: 2.0)
                    Text(OttlineStrings.tr("그날의 순간으로 찾기", "Find a moment", locale: locale))
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.ink)
                    if momentFilterCount > 0 {
                        Text("\(momentFilterCount)")
                            .font(OttlineFont.semiBold(11.5))
                            .foregroundStyle(palette.primaryAccent)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(palette.border, lineWidth: 1))
                    }
                    Spacer()
                    OttlineLucideIcon(
                        kind: filterExpanded ? .chevronUp : .chevronDown,
                        size: 15,
                        color: palette.mutedInk,
                        strokeWidth: 2.0
                    )
                }
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            if filterExpanded {
                momentFilterExpandedCard(hasActiveFilters: hasActiveFilters)
            }
        }
    }

    private func statusChip(label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.medium(12.5))
                .foregroundStyle(active ? palette.ink : palette.mutedInk)
                .padding(.horizontal, 12)
                .frame(minHeight: 34)
                .background(active ? palette.paperStrong : palette.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(active ? palette.ink : palette.border, lineWidth: 1))
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
        let displayYear = log.seasonYear ?? log.title.year
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

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 14) {
                Button {
                    onOpenTitleDetail(log.title.id)
                } label: {
                    PosterImage(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type,
                        width: 72,
                        height: 108,
                        cornerRadius: 4
                    )
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Text([
                            OttlineStrings.titleTypeLabel(log.title.type, locale: locale),
                            displayYear.map(String.init)
                        ].compactMap { $0 }.joined(separator: " · "))
                        .font(OttlineFont.medium(11.5))
                        .foregroundStyle(palette.mutedInk)

                        Spacer(minLength: 4)

                        Text(dateStr)
                            .font(OttlineFont.regular(11.5))
                            .foregroundStyle(palette.subtleInk)
                            .lineLimit(1)
                    }

                    if let editionText {
                        Text(editionText)
                            .font(OttlineFont.regular(11.5))
                            .foregroundStyle(palette.mutedInk)
                            .lineLimit(1)
                    }

                    if isStoredLocally || log.origin == .comment {
                        FlowLayout(horizontalSpacing: 6, verticalSpacing: 4) {
                            if isStoredLocally {
                                Text(OttlineStrings.tr("이 기기에 보관 중", "Kept on this device", locale: locale))
                                    .font(OttlineFont.medium(11))
                                    .foregroundStyle(palette.mutedInk)
                                    .padding(.horizontal, 7)
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
                        }
                    }

                    Button {
                        onOpenTitleDetail(log.title.id)
                    } label: {
                        Text(log.title.name)
                            .font(OttlineFont.bold(16))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    .buttonStyle(.plain)

                    HStack(spacing: 6) {
                        Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                            .font(OttlineFont.semiBold(11.5))
                            .foregroundStyle(palette.ink)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                        RecordFeelingBadge(rating: log.rating, isBook: isBook, compact: true)
                    }

                    RecordMomentList(ott: log.ott, place: log.place, occasion: log.occasion, compact: true)

                    if isBook, locale == "ko", let kdcMajor {
                        Button {
                            onOpenBookshelf(kdcMajor)
                        } label: {
                            Text("\(BookshelfBuilder.kdcSectionName(major: kdcMajor, locale: locale)) 서가에도 함께 꽂혔어요.")
                                .font(OttlineFont.medium(11.5))
                                .foregroundStyle(palette.primaryAccent)
                                .underline()
                                .lineLimit(1)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if log.spoiler {
                Text(OttlineStrings.tr("스포일러가 포함된 메모는 상세 보기에서 볼 수 있어요.", "Spoiler note hidden here — open details to read.", locale: locale))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.subtleInk)
            } else if !note.isEmpty {
                InlineNoteText(text: note, fontSize: 15, lineLimit: 3, preserveNewlines: true)
            }

            Spacer(minLength: 0)

            HStack(spacing: 12) {
                Button {
                    onOpenTitleDetail(log.title.id)
                } label: {
                    Text(OttlineStrings.tr("상세 보기 →", "Open detail →", locale: locale))
                        .font(OttlineFont.semiBold(12.5))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)

                Button {
                    onOpenQuickRecord(
                        QuickRecordRequest(
                            existingLog: log,
                            autoFocusSearch: false,
                            openNoteStage: true
                        )
                    )
                } label: {
                    Text(OttlineStrings.tr("수정", "Edit", locale: locale))
                        .font(OttlineFont.medium(12))
                        .foregroundStyle(palette.mutedInk)
                }
                .buttonStyle(.plain)

                if !note.isEmpty {
                    let alreadyShared = sharedNoteLogIds.contains(log.id)
                    Button {
                        Task { await shareNote(log: log, note: note) }
                    } label: {
                        Text(alreadyShared
                            ? OttlineStrings.tr("나눔 완료", "Shared", locale: locale)
                            : (sharingNoteLogId == log.id
                                ? OttlineStrings.tr("나누는 중…", "Sharing…", locale: locale)
                                : OttlineStrings.tr("함께 나누기", "Share in Together", locale: locale))
                        )
                        .font(OttlineFont.medium(12))
                        .foregroundStyle(palette.mutedInk)
                    }
                    .buttonStyle(.plain)
                    .disabled(alreadyShared || sharingNoteLogId == log.id)
                }

                Spacer(minLength: 4)

                Button {
                    onOpenShareCard(log)
                } label: {
                    HStack(spacing: 4) {
                        OttlineLucideIcon(kind: .share2, size: 13, color: palette.mutedInk)
                        Text(OttlineStrings.tr("공유 카드", "Share card", locale: locale))
                            .font(OttlineFont.medium(12))
                            .foregroundStyle(palette.mutedInk)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func timelineRecordRow(_ log: WatchLog) -> some View {
        let isBook = log.title.type == .book
        let isbn13 = isBook ? BookshelfBuilder.normalizeBookIsbn13(log.title) : nil
        let cls = isbn13.flatMap { repository.bookClassifications[$0] }
        let kdcMajor = (cls?.isResolved == true) ? cls?.kdcMajor : nil
        let syncStatus = repository.logSyncStatuses[log.id]
        let isStoredLocally = (syncStatus == "PENDING" || syncStatus == "FAILED")
        let dateIso = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
        let displayYear = log.seasonYear ?? log.title.year

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

        return HStack(alignment: .top, spacing: metrics.isSpread ? 18 : 14) {
            // Left Date Column (`34pt` day number)
            VStack(alignment: .leading, spacing: 1) {
                Text(RecordDate.formatTimelineMonth(dateIso, locale: locale))
                    .font(OttlineFont.regular(11.5))
                    .foregroundStyle(palette.mutedInk)
                Text(RecordDate.formatTimelineDay(dateIso))
                    .font(OttlineFont.semiBold(34))
                    .foregroundStyle(palette.ink)
                if log.watchedAt.isEmpty {
                    Text(OttlineStrings.tr("기록한 날", "Recorded", locale: locale))
                        .font(OttlineFont.regular(10.5))
                        .foregroundStyle(palette.mutedInk)
                }
            }
            .frame(width: metrics.isSpread ? 58 : 50, alignment: .leading)

            // Middle Poster (`58x87` compact / `68x102` spread)
            Button {
                onOpenTitleDetail(log.title.id)
            } label: {
                PosterImage(
                    posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                    titleName: log.title.name,
                    titleType: log.title.type,
                    width: metrics.isSpread ? 68 : 58,
                    height: metrics.isSpread ? 102 : 87
                )
            }
            .buttonStyle(.plain)

            // Right Content
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text([
                        OttlineStrings.titleTypeLabel(log.title.type, locale: locale),
                        displayYear.map(String.init)
                    ].compactMap { $0 }.joined(separator: " · "))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)

                    if let editionText {
                        Text("· \(editionText)")
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                            .lineLimit(1)
                    }
                }

                if isStoredLocally || log.origin == .comment {
                    FlowLayout(horizontalSpacing: 6, verticalSpacing: 4) {
                        if isStoredLocally {
                            Text(OttlineStrings.tr("이 기기에 보관 중", "Kept on this device", locale: locale))
                                .font(OttlineFont.medium(11))
                                .foregroundStyle(palette.mutedInk)
                                .padding(.horizontal, 8)
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
                    }
                }

                Button {
                    onOpenTitleDetail(log.title.id)
                } label: {
                    Text(log.title.name)
                        .font(OttlineFont.semiBold(17.5))
                        .foregroundStyle(palette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .buttonStyle(.plain)

                HStack(spacing: 8) {
                    Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                        .font(OttlineFont.semiBold(12.5))
                        .foregroundStyle(palette.primaryAccent)
                    RecordFeelingBadge(rating: log.rating, isBook: isBook, compact: true)
                }

                RecordMomentList(ott: log.ott, place: log.place, occasion: log.occasion, compact: true)

                if isBook, locale == "ko", let kdcMajor {
                    Button {
                        onOpenBookshelf(kdcMajor)
                    } label: {
                        Text("\(BookshelfBuilder.kdcSectionName(major: kdcMajor, locale: locale)) 서가에도 함께 꽂혔어요.")
                            .font(OttlineFont.medium(12))
                            .foregroundStyle(palette.primaryAccent)
                            .underline()
                    }
                    .buttonStyle(.plain)
                }

                if let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                    InlineNoteText(text: note, fontSize: 15.5, lineLimit: metrics.isSpread ? 6 : 4)
                        .padding(.top, 2)
                }

                FlowLayout(horizontalSpacing: 12, verticalSpacing: 6) {
                    Button {
                        onOpenTitleDetail(log.title.id)
                    } label: {
                        Text(OttlineStrings.tr("상세 보기", "Details", locale: locale))
                            .font(OttlineFont.semiBold(12.5))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .buttonStyle(.plain)

                    Button {
                        onOpenQuickRecord(
                            QuickRecordRequest(
                                existingLog: log,
                                autoFocusSearch: false,
                                openNoteStage: true
                            )
                        )
                    } label: {
                        Text(OttlineStrings.tr("수정", "Edit", locale: locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                    .buttonStyle(.plain)

                    Button {
                        onOpenShareCard(log)
                    } label: {
                        Text(OttlineStrings.tr("공유 카드", "Share card", locale: locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                    .buttonStyle(.plain)

                    if let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                        let alreadyShared = sharedNoteLogIds.contains(log.id)
                        Button {
                            Task { await shareNote(log: log, note: note) }
                        } label: {
                            Text(alreadyShared
                                ? OttlineStrings.tr("함께에 나눴어요", "Shared", locale: locale)
                                : (sharingNoteLogId == log.id
                                    ? OttlineStrings.tr("나누는 중…", "Sharing…", locale: locale)
                                    : OttlineStrings.tr("함께 나누기", "Share in Together", locale: locale))
                            )
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                        }
                        .buttonStyle(.plain)
                        .disabled(alreadyShared || sharingNoteLogId == log.id)
                    }
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 16)
    }

    // MARK: - OpenAI v2 Future Timeline (`RecommendationDeck.tsx` 1:1 Parity)

    @ViewBuilder
    private func futureTimelineContent(allLogsCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if let excluded = lastExcludedItem {
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

            if allLogsCount < 5 || !recState.eligible {
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
                            if recGeneratingAction || recState.generating {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(palette.onBrandOrange)
                            } else {
                                OttlineLucideIcon(kind: .sparkles, size: 15, color: palette.onBrandOrange, strokeWidth: 2.0)
                            }
                            Text(recState.hasBatch
                                ? OttlineStrings.tr("새로 추천받기", "Generate new", locale: locale)
                                : OttlineStrings.tr("다음 작품 추천받기", "Find next stories", locale: locale)
                            )
                            .font(OttlineFont.semiBold(13.5))
                        }
                        .foregroundStyle((recState.quota.remaining <= 0 || recGeneratingAction || recState.generating) ? palette.mutedInk : palette.onBrandOrange)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background((recState.quota.remaining <= 0 || recGeneratingAction || recState.generating) ? palette.mutedBg : palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .disabled(recState.quota.remaining <= 0 || recGeneratingAction || recState.generating)
                }
                .padding(14)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                if let recError, !recError.isEmpty {
                    Text(recError)
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.danger)
                }

                if recLoading || recState.generating {
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
                    .padding(.vertical, 16)
                } else if recState.items.isEmpty {
                    Text(recState.hasBatch
                        ? OttlineStrings.tr("표시할 추천 작품이 남아 있지 않아요. 새로 생성해 보세요.", "No recommendations left in this batch.", locale: locale)
                        : OttlineStrings.tr("위의 버튼을 눌러 다음에 만날 작품을 받아보세요.", "Tap the button above to generate recommendations.", locale: locale)
                    )
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                    .padding(.vertical, 16)
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
        NavigationStack {
            List {
                if recState.exclusions.isEmpty {
                    Text(OttlineStrings.tr("제외한 작품이 없어요.", "No excluded titles.", locale: locale))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                } else {
                    ForEach(recState.exclusions) { ex in
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
        recLoading = true
        recError = nil
        do {
            _ = try await repository.ensureAuthenticated()
            let state = try await repository.api.getRecommendationState()
            recState = state
            recLoading = false
            if state.generating {
                await pollRecommendationsWhileGenerating()
            }
        } catch {
            recLoading = false
            recError = OttlineStrings.tr(
                "추천 상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
                "Couldn't load recommendations.",
                locale: locale
            )
        }
    }

    private func requestNewRecommendations() async {
        recGeneratingAction = true
        recError = nil
        do {
            _ = try await repository.ensureAuthenticated()
            let (statusCode, state) = try await repository.api.generateRecommendations(
                requestId: UUID().uuidString.lowercased()
            )
            recState = state
            recGeneratingAction = false
            if statusCode == 429 {
                recError = OttlineStrings.tr(
                    "오늘 사용할 수 있는 생성 횟수를 모두 썼어요.",
                    "You've reached today's generation limit.",
                    locale: locale
                )
            } else if state.generating {
                await pollRecommendationsWhileGenerating()
            }
        } catch let apiErr as ApiError where apiErr.statusCode == 429 {
            recGeneratingAction = false
            recError = OttlineStrings.tr(
                "오늘 사용할 수 있는 생성 횟수를 모두 썼어요.",
                "You've reached today's generation limit.",
                locale: locale
            )
        } catch {
            recGeneratingAction = false
            recError = OttlineStrings.tr(
                "다음 작품을 찾지 못했어요. 잠시 후 다시 시도해 주세요.",
                "Could not generate new recommendations right now.",
                locale: locale
            )
        }
    }

    private func pollRecommendationsWhileGenerating() async {
        for _ in 0..<24 {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            if Task.isCancelled || !futureMode { return }
            if let polled = try? await repository.api.getRecommendationState() {
                recState = polled
                if !polled.generating { return }
            }
        }
    }

    private func excludeItem(_ item: RecommendationItem) async {
        do {
            let exclusion = try await repository.api.excludeRecommendation(item)
            lastExcludedItem = exclusion
            if let refreshed = try? await repository.api.getRecommendationState() {
                recState = refreshed
            } else {
                var nextState = recState
                nextState.items.removeAll { $0.id == item.id }
                nextState.exclusions.insert(exclusion, at: 0)
                recState = nextState
            }
        } catch {
            recError = OttlineStrings.tr("제외하지 못했어요.", "Couldn't exclude.", locale: locale)
        }
    }

    private func restoreExclusion(key: String) async {
        do {
            try await repository.api.restoreRecommendationExclusion(key: key)
            if lastExcludedItem?.key == key {
                lastExcludedItem = nil
            }
            if let refreshed = try? await repository.api.getRecommendationState() {
                recState = refreshed
            } else {
                var nextState = recState
                nextState.exclusions.removeAll { $0.key == key }
                recState = nextState
            }
        } catch {
            recError = OttlineStrings.tr("되돌리지 못했어요.", "Couldn't restore.", locale: locale)
        }
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

    private func shareNote(log: WatchLog, note: String) async {
        sharingNoteLogId = log.id
        if (try? await repository.shareNoteToTogether(log: log, noteBody: note)) != nil {
            sharedNoteLogIds.insert(log.id)
        }
        sharingNoteLogId = nil
    }
}
