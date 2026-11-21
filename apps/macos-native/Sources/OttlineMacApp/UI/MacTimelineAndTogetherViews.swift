import SwiftUI
import OttlineCore

// MARK: - Mac Timeline Spread View (2-Column Grid + Future Timeline `gpt-6-luna`)

public struct MacTimelineSpreadView: View {
    @ObservedObject public var repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var typeFilter: String = "all" // "all" | "video" | "book"
    @State private var statusFilter: LogStatus?
    @State private var platformFilter: String = ""
    @State private var placeFilter: Place?
    @State private var occasionFilter: Occasion?
    @State private var originFilter: LogOrigin?
    @State private var searchQuery: String = ""
    @State private var filterExpanded: Bool = false

    @State private var nextCursor: String?
    @State private var hasMorePages: Bool = false
    @State private var loadingMore: Bool = false

    @State private var futureMode: Bool = false
    @StateObject private var recCoordinator: FutureTimelineCoordinator
    @State private var showExcludedSheet: Bool = false
    @State private var editionCandidates: [TitleSearchItem] = []
    @State private var editionPickerTitle: String = ""
    @State private var showEditionPicker: Bool = false

    public init(repository: OttlineRepository, appState: OttlineMacAppState) {
        self._repository = ObservedObject(wrappedValue: repository)
        self.appState = appState
        self._recCoordinator = StateObject(wrappedValue: FutureTimelineCoordinator(repository: repository))
    }

    public var body: some View {
        let snap = repository.prefs.snapshot
        let nickname = snap.nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let personaTitle = snap.personaKey.map { OttlineStrings.personaPreset($0).title(locale) }

        let filteredLogs = repository.logs.filter { log in
            if typeFilter == "video" && log.title.type == .book { return false }
            if typeFilter == "book" && log.title.type != .book { return false }
            if let sf = statusFilter, log.status != sf { return false }
            if !platformFilter.isEmpty {
                if !(log.ott ?? "").lowercased().contains(platformFilter.lowercased()) { return false }
            }
            if let pf = placeFilter, log.place != pf { return false }
            if let of = occasionFilter, log.occasion != of { return false }
            if let orf = originFilter, log.origin != orf { return false }
            let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if !q.isEmpty {
                let hay = [log.title.name, log.title.author ?? "", log.title.publisher ?? "", log.note ?? "", log.ott ?? ""].joined(separator: " ").lowercased()
                if !hay.contains(q) { return false }
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
        let useStickyFooter = futureMode || totalFilteredCount <= 4
        let filterTriggerKey = "\(typeFilter)-\(statusFilter?.rawValue ?? "")-\(platformFilter)-\(placeFilter?.rawValue ?? "")-\(occasionFilter?.rawValue ?? "")-\(originFilter?.rawValue ?? "")-\(searchQuery)"

        Group {
            if useStickyFooter {
                GeometryReader { scrollGeo in
                    ScrollView {
                        OttlineStickyFooterLayout(
                            minHeight: scrollGeo.size.height,
                            topPadding: 24,
                            bottomPadding: 28,
                            minSpacing: 24
                        ) {
                            VStack(alignment: .leading, spacing: 20) {
                                desktopHeaderBar(snap: snap, nickname: nickname, personaTitle: personaTitle)

                                if futureMode {
                                    futureTimelineDesktopSection
                                } else {
                                    filterDesktopBar(momentFilterCount: momentFilterCount, hasActiveFilters: hasActiveFilters)

                                    if repository.logs.isEmpty {
                                        emptyNoLogsCard
                                    } else if monthGroups.isEmpty {
                                        emptyFilteredCard
                                    } else {
                                        ForEach(monthGroups) { group in
                                            VStack(alignment: .leading, spacing: 12) {
                                                desktopMonthHeader(group.monthKey)
                                                LazyVGrid(
                                                    columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                                                    spacing: 16
                                                ) {
                                                    ForEach(group.logs) { log in
                                                        timelineDesktopCard(log)
                                                    }
                                                }
                                            }
                                        }
                                        if hasMorePages { desktopLoadMoreButton }
                                    }
                                }
                            }

                            OttlineAppFooter(bottomPadding: 0)
                        }
                        .frame(maxWidth: 1280, alignment: .leading)
                        .padding(.horizontal, 32)
                        .frame(maxWidth: .infinity)
                    }
                }
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        VStack(alignment: .leading, spacing: 20) {
                            desktopHeaderBar(snap: snap, nickname: nickname, personaTitle: personaTitle)
                            filterDesktopBar(momentFilterCount: momentFilterCount, hasActiveFilters: hasActiveFilters)
                        }
                        .padding(.bottom, 20)

                        ForEach(Array(monthGroups.enumerated()), id: \.element.id) { index, group in
                            desktopMonthHeader(group.monthKey)
                                .padding(.top, index == 0 ? 0 : 26)
                                .padding(.bottom, 12)

                            LazyVGrid(
                                columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                                spacing: 16
                            ) {
                                ForEach(group.logs) { log in
                                    timelineDesktopCard(log)
                                }
                            }
                        }

                        if hasMorePages {
                            desktopLoadMoreButton
                                .padding(.top, 20)
                        }

                        OttlineAppFooter(bottomPadding: 28)
                            .padding(.top, 24)
                    }
                    .frame(maxWidth: 1280, alignment: .leading)
                    .padding(.horizontal, 32)
                    .padding(.top, 24)
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .onAppear {
            if let pf = appState.pendingPlaceFilter {
                placeFilter = pf
                filterExpanded = true
                appState.pendingPlaceFilter = nil
            }
            if let of = appState.pendingOccasionFilter {
                occasionFilter = of
                filterExpanded = true
                appState.pendingOccasionFilter = nil
            }
        }
        .task(id: filterTriggerKey) {
            await loadFirstServerPage()
        }
        .onChange(of: locale) { _, nextLocale in
            if futureMode {
                Task { await recCoordinator.loadState(locale: nextLocale) }
            }
        }
        .sheet(isPresented: $showExcludedSheet) {
            excludedDesktopSheet
        }
        .sheet(isPresented: $showEditionPicker) {
            editionPickerDesktopSheet
        }
    }

    private func desktopHeaderBar(snap: PreferencesSnapshot, nickname: String, personaTitle: String?) -> some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Text(OttlineStrings.tr("남겨둔 이야기", "THE STORIES YOU KEPT", locale: locale))
                    .font(OttlineFont.medium(11))
                    .kerning(0.9)
                    .foregroundStyle(palette.mutedInk)

                Text(futureMode
                    ? OttlineStrings.tr("미래의 타임라인", "Future timeline", locale: locale)
                    : (nickname.isEmpty
                        ? OttlineStrings.tr("내 타임라인", "My Timeline", locale: locale)
                        : OttlineStrings.tr("\(nickname)의 타임라인", "\(nickname)'s Timeline", locale: locale))
                )
                .font(OttlineFont.semiBold(28))
                .foregroundStyle(palette.ink)

                if futureMode {
                    Text(OttlineStrings.tr(
                        "지금까지 쌓인 기록의 결로 다음 이야기를 펼쳐봐요",
                        "The records you keep now will help us choose your next stories.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)
                } else if let personaTitle {
                    Text(OttlineStrings.tr("\(personaTitle)로 쌓아가는 기록이에요", "Recorded with your \(personaTitle) point of view", locale: locale))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                }
            }

            Spacer()

            FlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
                if !futureMode {
                    Button {
                        appState.overlayStack.append(.report)
                    } label: {
                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .clock3, size: 13.5, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text(OttlineStrings.tr("내 이용 리포트", "Usage report", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.ink)
                        }
                        .padding(.horizontal, 12)
                        .frame(height: 38)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
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
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                            }
                            .padding(.horizontal, 12)
                            .frame(height: 38)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.primaryAccent.opacity(0.35), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }

                    if locale == "ko" {
                        Button {
                            appState.overlayStack.append(.bookshelf(nil))
                        } label: {
                            HStack(spacing: 5) {
                                OttlineLucideIcon(kind: .bookOpen, size: 13.5, color: palette.primaryAccent, strokeWidth: 2.0)
                                Text("서가 보기")
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.ink)
                            }
                            .padding(.horizontal, 12)
                            .frame(height: 38)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
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
                            .frame(height: 38)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button {
                        showExcludedSheet = true
                    } label: {
                        Text(OttlineStrings.tr("제외한 작품 (\(recCoordinator.state.exclusions.count))", "Excluded (\(recCoordinator.state.exclusions.count))", locale: locale))
                            .font(OttlineFont.medium(13))
                            .foregroundStyle(palette.mutedInk)
                            .padding(.horizontal, 12)
                            .frame(height: 38)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.bottom, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(palette.border).frame(height: 1)
        }
    }

    private func desktopMonthHeader(_ monthKey: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(RecordDate.formatMonthLabel(monthKey, locale: locale))
                .font(OttlineFont.bold(18))
                .foregroundStyle(palette.ink)
            Spacer()
            Text(OttlineStrings.tr("최근 기록·수정한 날 기준", "By last recorded or updated", locale: locale))
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)
        }
    }

    private var emptyNoLogsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(OttlineStrings.tr("첫 기록을 남겨보세요. 타임라인이 바로 시작돼요.", "Leave your first record. Your timeline starts here.", locale: locale))
                .font(OttlineFont.semiBold(16))
                .foregroundStyle(palette.ink)

            Button {
                appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
            } label: {
                HStack(spacing: 6) {
                    OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                    Text(OttlineStrings.tr("새로운 기록 남기기", "Leave a new record", locale: locale))
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.onBrandOrange)
                }
                .padding(.horizontal, 16)
                .frame(height: 44)
                .background(palette.brandOrange)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.paperStrong)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private var emptyFilteredCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(OttlineStrings.tr("조건에 맞는 기록이 아직 없어요.", "No matching records yet.", locale: locale))
                .font(OttlineFont.regular(15))
                .foregroundStyle(palette.mutedInk)

            Button {
                clearAllFilters()
            } label: {
                Text(OttlineStrings.tr("필터 초기화", "Reset filters", locale: locale))
                    .font(OttlineFont.semiBold(13.5))
                    .foregroundStyle(palette.primaryAccent)
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .background(palette.background)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private var desktopLoadMoreButton: some View {
        Button {
            Task { await loadNextPage() }
        } label: {
            HStack(spacing: 6) {
                if loadingMore { ProgressView() }
                Text(OttlineStrings.tr("이전 기록 더 보기", "Load earlier records", locale: locale))
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.primaryAccent)
            }
            .frame(maxWidth: .infinity, minHeight: 42)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(loadingMore)
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

    private func filterDesktopBar(momentFilterCount: Int, hasActiveFilters: Bool) -> some View {
        let isBookTab = typeFilter == "book"
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    OttlineLucideIcon(kind: .search, size: 15, color: palette.mutedInk, strokeWidth: 2.0)
                    TextField(
                        OttlineStrings.tr("제목, 저자, 출판사, 메모 검색", "Search title, author, publisher, or note", locale: locale),
                        text: $searchQuery
                    )
                    .textFieldStyle(.plain)
                    .font(OttlineFont.regular(14.5))

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
                .frame(height: 40)
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
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1))
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
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke((filterExpanded || momentFilterCount > 0) ? palette.primaryAccent : palette.border, lineWidth: (filterExpanded || momentFilterCount > 0) ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            if momentFilterCount > 0 || hasActiveFilters {
                FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                    if let sf = statusFilter {
                        desktopActiveChip("\(OttlineStrings.statusLabel(sf, type: isBookTab ? .book : .movie, locale: locale)) ×") {
                            statusFilter = nil
                        }
                    }
                    if !platformFilter.isEmpty {
                        desktopActiveChip("\(platformFilter) ×") {
                            platformFilter = ""
                        }
                    }
                    if let pf = placeFilter {
                        desktopActiveChip("\(OttlineStrings.placeLabel(pf, locale: locale)) ×") {
                            placeFilter = nil
                        }
                    }
                    if let of = occasionFilter {
                        desktopActiveChip("\(OttlineStrings.occasionLabel(of, locale: locale)) ×") {
                            occasionFilter = nil
                        }
                    }
                    if let orf = originFilter {
                        let originText = orf == .log
                            ? OttlineStrings.tr("내 기록", "My record", locale: locale)
                            : OttlineStrings.tr("함께 남긴 기록", "From Together", locale: locale)
                        desktopActiveChip("\(originText) ×") {
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
                                .frame(height: 30)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if filterExpanded {
                desktopMomentFilterCard(hasActiveFilters: hasActiveFilters)
            }
        }
    }

    private func desktopActiveChip(_ label: String, onRemove: @escaping () -> Void) -> some View {
        Button(action: onRemove) {
            Text(label)
                .font(OttlineFont.semiBold(12))
                .foregroundStyle(palette.primaryAccent)
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(palette.paperStrong)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func desktopFilterChip(label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                .foregroundStyle(active ? palette.onBrandNavy : palette.ink)
                .padding(.horizontal, 10)
                .frame(minHeight: 32)
                .background(active ? palette.brandNavy : palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? palette.brandNavy : palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func desktopMomentFilterCard(hasActiveFilters: Bool) -> some View {
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
                    desktopFilterChip(label: OttlineStrings.tr("모든 상태", "All states", locale: locale), active: statusFilter == nil) {
                        statusFilter = nil
                    }
                    ForEach(LogStatus.allCases, id: \.self) { st in
                        desktopFilterChip(
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
                    FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                        ForEach(grp.items, id: \.self) { plat in
                            desktopFilterChip(label: plat, active: platformFilter == plat) {
                                platformFilter = (platformFilter == plat) ? "" : plat
                            }
                        }
                    }
                }
                if !extraCustoms.isEmpty {
                    FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                        ForEach(extraCustoms, id: \.self) { plat in
                            desktopFilterChip(label: plat, active: platformFilter == plat) {
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
                        desktopFilterChip(label: OttlineStrings.placeLabel(p, locale: locale), active: placeFilter == p) {
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
                        desktopFilterChip(label: OttlineStrings.occasionLabel(occ, locale: locale), active: occasionFilter == occ) {
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
                    desktopFilterChip(label: OttlineStrings.tr("내 기록", "My record", locale: locale), active: originFilter == .log) {
                        originFilter = (originFilter == .log) ? nil : .log
                    }
                    desktopFilterChip(label: OttlineStrings.tr("함께 남긴 기록", "From Together", locale: locale), active: originFilter == .comment) {
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
                        .frame(minHeight: 34)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func timelineDesktopCard(_ log: WatchLog) -> some View {
        let isBook = log.title.type == .book
        let dateStr = RecordDate.formatDisplayDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale)
        let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let editionText: String? = {
            if isBook {
                let author = log.title.author?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return author.isEmpty ? nil : author
            } else {
                let parts = [
                    log.seasonNumber.map { locale == "en" ? "Season \($0)" : "시즌 \($0)" },
                    log.episodeNumber.map { locale == "en" ? "Ep \($0)" : "\($0)화" }
                ].compactMap { $0 }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            }
        }()
        let momentLabels: [String] = [
            log.ott?.trimmingCharacters(in: .whitespacesAndNewlines),
            log.place.map { OttlineStrings.placeLabel($0, locale: locale) },
            log.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) }
        ].compactMap { $0 }.filter { !$0.isEmpty }

        return Button {
            appState.overlayStack.append(.titleDetail(log.title.id))
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
                            HStack(spacing: 5) {
                                ForEach(Array(momentLabels.enumerated()), id: \.offset) { _, label in
                                    Text(label)
                                        .font(OttlineFont.medium(11.5))
                                        .foregroundStyle(palette.mutedInk)
                                        .lineLimit(1)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 3)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(palette.border, lineWidth: 1))
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

    @ViewBuilder
    private var futureTimelineDesktopSection: some View {
        let recState = recCoordinator.state
        let busy = recCoordinator.isGenerating || recState.generating
        let eligible = repository.logs.count >= 5 && recState.eligible
        let canRequest = eligible && !busy && (recState.quota.remaining > 0 || recCoordinator.hasPendingAttempt)

        VStack(alignment: .leading, spacing: 16) {
            if let excluded = recCoordinator.lastExcludedItem {
                HStack(spacing: 10) {
                    Text(OttlineStrings.tr("‘\(excluded.name)’을(를) 제외했어요.", "Excluded ‘\(excluded.name)’.", locale: locale))
                        .font(OttlineFont.regular(13))
                        .foregroundStyle(palette.ink)
                    Spacer()
                    Button {
                        Task { await recCoordinator.restoreExclusion(key: excluded.key, locale: locale) }
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
                    ProgressView().controlSize(.small)
                    Text(OttlineStrings.tr("추천 상태를 불러오고 있어요...", "Loading recommendations...", locale: locale))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                }
                .padding(.vertical, 16)
            } else if !eligible {
                Text(OttlineStrings.tr(
                    "기록이 다섯 개 이상 쌓이면, 지금까지 남긴 작품의 결을 따라 다음에 만날 이야기를 찾아볼 수 있어요.",
                    "With five or more records, we can suggest a few stories to meet next.",
                    locale: locale
                ))
                .font(OttlineFont.regular(15))
                .foregroundStyle(palette.mutedInk)
                .padding(.vertical, 16)
            } else {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(OttlineStrings.tr("미래의 타임라인", "Future timeline", locale: locale))
                            .font(OttlineFont.bold(20))
                            .foregroundStyle(palette.ink)
                        Text(OttlineStrings.tr(
                            "오늘 남은 생성 \(recState.quota.remaining)/\(recState.quota.limit) · 지금까지 남긴 기록의 결로 다음 이야기를 골라드려요.",
                            "Generations left today: \(recState.quota.remaining)/\(recState.quota.limit) · Suggestions drawn from your timeline.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                    }

                    Spacer()

                    Button {
                        Task { await generateRecommendations() }
                    } label: {
                        HStack(spacing: 6) {
                            if busy { ProgressView().controlSize(.small) }
                            Text(recCoordinator.hasPendingAttempt && !busy
                                ? OttlineStrings.tr("다시 확인·시도하기", "Retry check", locale: locale)
                                : (recState.hasBatch
                                    ? OttlineStrings.tr("새로 추천받기", "Generate new", locale: locale)
                                    : OttlineStrings.tr("다음 작품 추천받기", "Find next stories", locale: locale))
                            )
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(canRequest ? palette.onBrandOrange : palette.mutedInk)
                        }
                        .padding(.horizontal, 16)
                        .frame(height: 40)
                        .background(canRequest ? palette.brandOrange : palette.mutedBg)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canRequest)
                }
                .padding(16)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                if let recError = recCoordinator.errorMessage, !recError.isEmpty {
                    Text(recError)
                        .font(OttlineFont.medium(13))
                        .foregroundStyle(palette.danger)
                }

                if busy || (recCoordinator.isLoadingState && recState.items.isEmpty) {
                    HStack(spacing: 10) {
                        ProgressView().controlSize(.small)
                        Text(OttlineStrings.tr(
                            "남겨둔 기록의 결을 따라 다음 이야기를 고르고 있어요...",
                            "Choosing next stories from your timeline...",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                    }
                    .padding(.vertical, 8)
                }

                if recState.items.isEmpty {
                    if !busy && !recCoordinator.isLoadingState {
                        Text(OttlineStrings.tr("‘다음 작품 추천받기’를 누르면 지금 타임라인과 어울리는 작품들을 보여드려요.", "Click Find next stories to discover titles matching your timeline.", locale: locale))
                            .font(OttlineFont.regular(14))
                            .foregroundStyle(palette.mutedInk)
                            .padding(20)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                } else {
                    LazyVGrid(
                        columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                        spacing: 16
                    ) {
                        ForEach(recState.items) { item in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(alignment: .top, spacing: 12) {
                                    PosterImage(
                                        posterUrl: item.posterUrl,
                                        titleName: item.name,
                                        titleType: item.type,
                                        width: 60,
                                        height: 90,
                                        cornerRadius: 4
                                    )
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text([
                                            OttlineStrings.titleTypeLabel(item.type, locale: locale),
                                            item.year.map(String.init),
                                            item.author
                                        ].compactMap { $0 }.joined(separator: " · "))
                                        .font(OttlineFont.medium(11.5))
                                        .foregroundStyle(palette.mutedInk)

                                        Text(item.name)
                                            .font(OttlineFont.bold(16))
                                            .foregroundStyle(palette.ink)

                                        Text(item.reason)
                                            .font(OttlineFont.regular(13.5))
                                            .foregroundStyle(palette.mutedInk)
                                    }
                                }

                                HStack(spacing: 8) {
                                    Button {
                                        Task { await connectRecommendation(item) }
                                    } label: {
                                        Text(OttlineStrings.tr("타임라인에 담기", "Save to timeline", locale: locale))
                                            .font(OttlineFont.semiBold(13))
                                            .foregroundStyle(palette.onBrandOrange)
                                            .padding(.horizontal, 12)
                                            .frame(height: 34)
                                            .background(palette.brandOrange)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                    .buttonStyle(.plain)

                                    Button {
                                        Task { await excludeRecommendation(item) }
                                    } label: {
                                        Text(OttlineStrings.tr("제외하기", "Exclude", locale: locale))
                                            .font(OttlineFont.medium(12.5))
                                            .foregroundStyle(palette.mutedInk)
                                            .padding(.horizontal, 10)
                                            .frame(height: 34)
                                            .background(palette.background)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
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
                    }
                }
            }
        }
    }

    private var excludedDesktopSheet: some View {
        NavigationStack {
            List(recCoordinator.state.exclusions) { ex in
                HStack {
                    Text(ex.name)
                        .font(OttlineFont.medium(14))
                    Spacer()
                    Button(OttlineStrings.tr("되돌리기", "Restore", locale: locale)) {
                        Task {
                            await recCoordinator.restoreExclusion(key: ex.key, locale: locale)
                        }
                    }
                }
            }
            .navigationTitle(OttlineStrings.tr("제외한 작품", "Excluded titles", locale: locale))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) { showExcludedSheet = false }
                }
            }
        }
        .frame(minWidth: 420, minHeight: 360)
    }

    private var editionPickerDesktopSheet: some View {
        NavigationStack {
            List(editionCandidates) { item in
                Button {
                    showEditionPicker = false
                    appState.quickRecordRequest = QuickRecordRequest(
                        preselectedSearchItem: item,
                        preferredStatus: .wishlist,
                        selectSource: "future_timeline",
                        autoFocusSearch: false
                    )
                } label: {
                    HStack(spacing: 12) {
                        PosterImage(posterUrl: item.posterUrl, titleName: item.name, titleType: item.type, width: 40, height: 58)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name).font(OttlineFont.semiBold(14.5))
                            Text([item.author, item.publisher, item.year.map(String.init)].compactMap { $0 }.joined(separator: " · "))
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .navigationTitle(editionPickerTitle)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) { showEditionPicker = false }
                }
            }
        }
        .frame(minWidth: 460, minHeight: 400)
    }

    private func loadFirstServerPage() async {
        guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
        let ct = typeFilter == "all" ? nil : typeFilter
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if let page = try? await repository.api.getLogsPage(
            limit: 50,
            cursor: nil,
            contentType: ct,
            status: statusFilter,
            origin: originFilter,
            ott: platformFilter.isEmpty ? nil : platformFilter,
            place: placeFilter,
            occasion: occasionFilter,
            query: q.isEmpty ? nil : q
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
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if let page = try? await repository.api.getLogsPage(
            limit: 50,
            cursor: cursor,
            contentType: ct,
            status: statusFilter,
            origin: originFilter,
            ott: platformFilter.isEmpty ? nil : platformFilter,
            place: placeFilter,
            occasion: occasionFilter,
            query: q.isEmpty ? nil : q
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

    private func generateRecommendations() async {
        await recCoordinator.requestGeneration(locale: locale)
    }

    private func excludeRecommendation(_ item: RecommendationItem) async {
        await recCoordinator.excludeItem(item, locale: locale)
    }

    private func connectRecommendation(_ item: RecommendationItem) async {
        if let cat = item.catalogTitle {
            appState.quickRecordRequest = QuickRecordRequest(
                preselectedSearchItem: cat,
                preferredStatus: .wishlist,
                selectSource: "future_timeline",
                autoFocusSearch: false
            )
            return
        }
        let results = (try? await repository.api.searchRecommendationCatalog(
            name: item.name,
            type: item.type,
            year: item.year,
            author: item.author
        )) ?? []
        if results.isEmpty {
            appState.quickRecordRequest = QuickRecordRequest(
                initialQuery: item.name,
                initialTypeTab: item.type.rawValue,
                preferredStatus: .wishlist,
                autoFocusSearch: false
            )
        } else if results.count == 1 && item.type != .book {
            appState.quickRecordRequest = QuickRecordRequest(
                preselectedSearchItem: results[0],
                preferredStatus: .wishlist,
                selectSource: "future_timeline",
                autoFocusSearch: false
            )
        } else {
            editionPickerTitle = item.name
            editionCandidates = results
            showEditionPicker = true
        }
    }
}

// MARK: - Mac Together Split Reader View (2-Column Desktop Reader)

public struct MacTogetherSpreadView: View {
    @ObservedObject public var repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState
    public var initialDiscussionId: String? = nil

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var curated: [CuratedContentItem] = []
    @State private var discussions: [DiscussionListItem] = []
    @State private var selectedDiscussion: DiscussionListItem?
    @State private var reactionState = DiscussionReactionState()
    @State private var reactionBusy: Bool = false
    @State private var searchQuery: String = ""
    @State private var loading: Bool = true

    public var body: some View {
        let filtered = discussions.filter { disc in
            let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return q.isEmpty || disc.titleName.lowercased().contains(q)
        }

        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 24) {
                // Left Pane: Curated Prompts & Discussion List
                VStack(alignment: .leading, spacing: 12) {
                    Text(OttlineStrings.tr("함께 기록", "TOGETHER", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.9)
                        .foregroundStyle(palette.mutedInk)

                    Text(OttlineStrings.tr("모두의 감상과 이야기", "Shared thoughts & stories", locale: locale))
                        .font(OttlineFont.bold(22))
                        .foregroundStyle(palette.ink)

                    TextField(
                        OttlineStrings.tr("작품명 검색", "Filter by title", locale: locale),
                        text: $searchQuery
                    )
                    .textFieldStyle(.plain)
                    .font(OttlineFont.regular(13.5))
                    .padding(.horizontal, 12)
                    .frame(height: 38)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 10) {
                            if !curated.isEmpty && searchQuery.isEmpty {
                                Text(OttlineStrings.tr("오늘의 글감", "Curated prompts", locale: locale))
                                    .font(OttlineFont.semiBold(12))
                                    .foregroundStyle(palette.primaryAccent)
                                ForEach(curated.prefix(3)) { item in
                                    Button {
                                        appState.overlayStack.append(.titleDetail(item.titleId))
                                    } label: {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(item.titleName)
                                                .font(OttlineFont.semiBold(13.5))
                                                .foregroundStyle(palette.ink)
                                            Text(item.body)
                                                .font(OttlineFont.regular(12.5))
                                                .foregroundStyle(palette.mutedInk)
                                                .lineLimit(2)
                                        }
                                        .padding(10)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }

                            if loading && discussions.isEmpty {
                                ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                            } else {
                                ForEach(filtered) { disc in
                                    let active = selectedDiscussion?.id == disc.id
                                    Button {
                                        selectedDiscussion = disc
                                        Task { await loadReactions(for: disc.id) }
                                    } label: {
                                        HStack(spacing: 10) {
                                            PosterImage(
                                                posterUrl: disc.posterUrl,
                                                titleName: disc.titleName,
                                                titleType: disc.titleType,
                                                width: 42,
                                                height: 62,
                                                cornerRadius: 4
                                            )
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(disc.titleName)
                                                    .font(OttlineFont.semiBold(14))
                                                    .foregroundStyle(palette.ink)
                                                    .lineLimit(1)
                                                Text([
                                                    OttlineStrings.titleTypeLabel(disc.titleType, locale: locale),
                                                    disc.titleYear.map(String.init),
                                                    locale == "en" ? "\(disc.commentCount) comments" : "이야기 \(disc.commentCount)"
                                                ].compactMap { $0 }.joined(separator: " · "))
                                                .font(OttlineFont.regular(12))
                                                .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                                            }
                                            Spacer()
                                        }
                                        .padding(10)
                                        .background(active ? palette.paperStrong : palette.card)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.5 : 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(.bottom, 28)
                    }
                    .scrollIndicators(.never)
                }
                .frame(width: 360)

                // Right Pane: Selected Title & Full Comments Reader
                ScrollView(.vertical, showsIndicators: false) {
                    if let disc = selectedDiscussion {
                        let discTitle = Title(
                            id: disc.titleId,
                            provider: disc.titleProvider ?? .local,
                            providerId: disc.titleProviderId,
                            type: disc.titleType,
                            name: disc.titleName,
                            year: disc.titleYear,
                            posterUrl: disc.posterUrl
                        )

                        VStack(alignment: .leading, spacing: 18) {
                            HStack(alignment: .top, spacing: 18) {
                                PosterImage(
                                    posterUrl: disc.posterUrl,
                                    titleName: disc.titleName,
                                    titleType: disc.titleType,
                                    width: 96,
                                    height: 144,
                                    cornerRadius: 5
                                )
                                VStack(alignment: .leading, spacing: 8) {
                                    Text([
                                        OttlineStrings.titleTypeLabel(disc.titleType, locale: locale),
                                        disc.titleYear.map(String.init)
                                    ].compactMap { $0 }.joined(separator: " · "))
                                    .font(OttlineFont.medium(12))
                                    .foregroundStyle(palette.mutedInk)

                                    Text(disc.titleName)
                                        .font(OttlineFont.bold(24))
                                        .foregroundStyle(palette.ink)

                                    DiscussionReactionChipsView(
                                        titleType: disc.titleType,
                                        state: reactionState,
                                        isBusy: reactionBusy
                                    ) { type in
                                        Task {
                                            reactionBusy = true
                                            if let updated = try? await repository.toggleReactionAndAutoLog(
                                                discussionId: disc.id,
                                                title: discTitle,
                                                type: type
                                            ) {
                                                reactionState = updated
                                            }
                                            reactionBusy = false
                                        }
                                    }

                                    HStack(spacing: 8) {
                                        Button {
                                            appState.quickRecordRequest = QuickRecordRequest(
                                                preselectedTitle: discTitle,
                                                selectSource: "together",
                                                autoFocusSearch: false
                                            )
                                        } label: {
                                            Text(OttlineStrings.tr("이 작품 기록하기", "Log this title", locale: locale))
                                                .font(OttlineFont.semiBold(13))
                                                .foregroundStyle(palette.onBrandOrange)
                                                .padding(.horizontal, 14)
                                                .frame(height: 36)
                                                .background(palette.brandOrange)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                        }
                                        .buttonStyle(.plain)

                                        Button {
                                            appState.overlayStack.append(.titleDetail(disc.titleId))
                                        } label: {
                                            Text(OttlineStrings.tr("상세 보기", "Open detail", locale: locale))
                                                .font(OttlineFont.medium(13))
                                                .foregroundStyle(palette.primaryAccent)
                                                .padding(.horizontal, 12)
                                                .frame(height: 36)
                                                .background(palette.card)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                            .padding(18)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                            CommentsPanelView(
                                title: discTitle,
                                initialDiscussionId: disc.id,
                                repository: repository,
                                showSyncLogCheckbox: true,
                                onSelectTitle: { tid in appState.overlayStack.append(.titleDetail(tid)) },
                                onReportComment: { prefill in appState.overlayStack.append(.feedback(prefill)) }
                            )

                            OttlineAppFooter()
                        }
                    } else {
                        Text(OttlineStrings.tr("왼쪽에서 이야기를 선택해 읽어보세요.", "Select a conversation from the left list.", locale: locale))
                            .font(OttlineFont.regular(15))
                            .foregroundStyle(palette.mutedInk)
                            .frame(maxWidth: .infinity, minHeight: 240)
                    }
                }
                .scrollIndicators(.never)
            }
            .frame(maxWidth: 1280)
            .padding(.horizontal, 32)
            .padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .task(id: initialDiscussionId ?? "root") {
            await loadTogetherFeed()
        }
    }

    private func loadTogetherFeed() async {
        loading = true
        async let cTask = try? repository.api.getCuratedContents(limit: 6)
        async let dTask = try? repository.api.getAllDiscussions(limit: 100)
        curated = (await cTask) ?? []
        discussions = (await dTask) ?? []
        if let initialId = initialDiscussionId {
            if let match = discussions.first(where: { $0.id == initialId }) {
                selectedDiscussion = match
            } else if let direct = try? await repository.api.getDiscussionById(initialId) {
                selectedDiscussion = direct
            }
        } else if selectedDiscussion == nil {
            selectedDiscussion = discussions.first
        }
        if let sel = selectedDiscussion {
            await loadReactions(for: sel.id)
        }
        loading = false
    }

    private func loadReactions(for discussionId: String) async {
        if let state = try? await repository.api.getMyDiscussionReactions(discussionId: discussionId) {
            reactionState = state
        }
    }
}
