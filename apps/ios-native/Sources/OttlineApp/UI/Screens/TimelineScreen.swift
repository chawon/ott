import SwiftUI

public struct TimelineScreen: View {
    public let repository: OttlineRepository
    public var initialPlaceFilter: Place?
    public var initialOccasionFilter: Occasion?
    public var onClearInitialMomentFilter: () -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenReport: () -> Void
    public var onOpenBookshelf: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var typeFilter: String = "all" // "all" | "video" | "book"
    @State private var statusFilter: LogStatus?
    @State private var placeFilter: Place?
    @State private var occasionFilter: Occasion?
    @State private var searchQuery: String = ""
    @State private var filterExpanded: Bool = false

    // Server cursor pagination (`GET /api/logs/page`)
    @State private var nextCursor: String?
    @State private var hasMorePages: Bool = false
    @State private var loadingMore: Bool = false

    // "내 미래는?" OpenAI Next Watch Recommendations
    @State private var nextWatchExpanded: Bool = false
    @State private var nextWatchLoading: Bool = false
    @State private var nextWatchResponse: NextWatchRecommendResponse?
    @State private var dismissedNextWatch: Set<String> = []

    @State private var shareCardLog: WatchLog?
    @State private var revealedSpoilers: Set<String> = []

    public var body: some View {
        let allLogs = repository.logs
        let filteredLogs = allLogs.filter { log in
            if typeFilter == "video" && log.title.type == .book { return false }
            if typeFilter == "book" && log.title.type != .book { return false }
            if let sf = statusFilter, log.status != sf { return false }
            if let pf = placeFilter, log.place != pf { return false }
            if let of = occasionFilter, log.occasion != of { return false }
            let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                let hay = "\(log.title.name) \(log.note ?? "") \(log.ott ?? "")".lowercased()
                if !hay.contains(trimmed.lowercased()) { return false }
            }
            return true
        }
        let monthGroups = TimelineMoments.groupLogsByMonth(filteredLogs)
        let hasActiveFilters = statusFilter != nil || placeFilter != nil || occasionFilter != nil || !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                // Header & Report Entry
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(OttlineStrings.tr("타임라인", "Timeline", locale: locale))
                            .font(OttlineFont.semiBold(24))
                            .foregroundStyle(palette.ink)
                        Text(OttlineStrings.tr(
                            "남겨둔 이야기 \(allLogs.count)편",
                            "\(allLogs.count) stories on your timeline",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13))
                        .foregroundStyle(palette.mutedInk)
                    }
                    Spacer()
                    Button(action: onOpenReport) {
                        HStack(spacing: 4) {
                            Image(systemName: "chart.bar.doc.horizontal")
                                .font(.system(size: 13))
                            Text(OttlineStrings.tr("이용 리포트", "Report", locale: locale))
                                .font(OttlineFont.semiBold(13))
                        }
                        .foregroundStyle(palette.primaryAccent)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                // Type Filter Tabs (`전체` / `영상` / `책`)
                HStack(spacing: 8) {
                    ForEach([
                        ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                        ("video", OttlineStrings.tr("영상", "Video", locale: locale)),
                        ("book", OttlineStrings.tr("책", "Books", locale: locale))
                    ], id: \.0) { key, label in
                        let selected = typeFilter == key
                        Button {
                            typeFilter = key
                        } label: {
                            Text(label)
                                .font(selected ? OttlineFont.semiBold(13.5) : OttlineFont.medium(13.5))
                                .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(selected ? palette.brandNavy : palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(selected ? palette.brandNavy : palette.border, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }

                    Spacer()

                    if typeFilter == "book" && locale == "ko" {
                        Button(action: onOpenBookshelf) {
                            HStack(spacing: 4) {
                                Image(systemName: "books.vertical")
                                    .font(.system(size: 12))
                                Text("내 서가")
                                    .font(OttlineFont.semiBold(13))
                            }
                            .foregroundStyle(palette.primaryAccent)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Foldable Moment Filter (`그날의 순간으로 찾기`)
                DisclosureGroup(isExpanded: $filterExpanded) {
                    VStack(alignment: .leading, spacing: 14) {
                        TextField(
                            OttlineStrings.tr("제목, 메모, 플랫폼으로 찾기", "Search title, note, or platform", locale: locale),
                            text: $searchQuery
                        )
                        .font(OttlineFont.regular(14))
                        .padding(10)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding(.top, 8)

                        // Status filter
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(LogStatus.allCases, id: \.self) { st in
                                    filterChip(
                                        label: OttlineStrings.statusLabel(st, type: typeFilter == "book" ? .book : .movie, locale: locale),
                                        selected: statusFilter == st
                                    ) {
                                        statusFilter = (statusFilter == st) ? nil : st
                                    }
                                }
                            }
                        }

                        // Place filter
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(Place.allCases, id: \.self) { p in
                                    filterChip(
                                        label: OttlineStrings.placeLabel(p, locale: locale),
                                        selected: placeFilter == p
                                    ) {
                                        placeFilter = (placeFilter == p) ? nil : p
                                    }
                                }
                            }
                        }

                        // Occasion filter
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(Occasion.allCases, id: \.self) { occ in
                                    filterChip(
                                        label: OttlineStrings.occasionLabel(occ, locale: locale),
                                        selected: occasionFilter == occ
                                    ) {
                                        occasionFilter = (occasionFilter == occ) ? nil : occ
                                    }
                                }
                            }
                        }

                        if hasActiveFilters {
                            Button {
                                statusFilter = nil
                                placeFilter = nil
                                occasionFilter = nil
                                searchQuery = ""
                            } label: {
                                Text(OttlineStrings.tr("필터 초기화", "Clear filters", locale: locale))
                                    .font(OttlineFont.medium(13))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundStyle(palette.primaryAccent)
                        Text(OttlineStrings.tr("그날의 순간으로 찾기", "Find by moment", locale: locale))
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.ink)
                        if hasActiveFilters {
                            Text("•")
                                .foregroundStyle(palette.brandOrange)
                        }
                    }
                }
                .padding(14)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                // "내 미래는?" OpenAI Next Watch Section (when >= 3 logs)
                if allLogs.count >= 3 {
                    nextWatchSection
                }

                // Timeline Month Groups
                if filteredLogs.isEmpty {
                    VStack(spacing: 12) {
                        Text(hasActiveFilters
                            ? OttlineStrings.tr("조건에 맞는 기록이 없어요.", "No matching records found.", locale: locale)
                            : OttlineStrings.tr("아직 남겨둔 기록이 없어요.", "No records yet.", locale: locale)
                        )
                        .font(OttlineFont.medium(15))
                        .foregroundStyle(palette.mutedInk)

                        if !hasActiveFilters {
                            Button {
                                onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                            } label: {
                                Text(OttlineStrings.tr("첫 기록 남기기", "Leave your first record", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.onBrandOrange)
                                    .padding(.horizontal, 18)
                                    .padding(.vertical, 11)
                                    .background(palette.brandOrange)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else {
                    ForEach(monthGroups) { group in
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text(RecordDate.formatMonthLabel(group.monthKey, locale: locale))
                                    .font(OttlineFont.semiBold(17))
                                    .foregroundStyle(palette.ink)
                                Spacer()
                                Text("\(group.logs.count)")
                                    .font(OttlineFont.medium(13))
                                    .foregroundStyle(palette.mutedInk)
                            }

                            ForEach(group.logs) { log in
                                timelineLogCard(log)
                            }
                        }
                    }

                    // Server cursor infinite scroll button / trigger
                    if hasMorePages {
                        Button {
                            Task { await loadNextPage() }
                        } label: {
                            HStack {
                                Spacer()
                                if loadingMore {
                                    ProgressView()
                                } else {
                                    Text(OttlineStrings.tr("이전 기록 더 불러오기", "Load older records", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                Spacer()
                            }
                            .padding(.vertical, 14)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .task {
                            await loadNextPage()
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(palette.background)
        .sheet(item: $shareCardLog) { log in
            ShareCardDialog(
                log: log,
                nickname: repository.prefs.snapshot.nickname,
                personaKey: repository.prefs.snapshot.personaKey,
                onDismiss: { shareCardLog = nil }
            )
        }
        .onAppear {
            if initialPlaceFilter != nil || initialOccasionFilter != nil {
                placeFilter = initialPlaceFilter
                occasionFilter = initialOccasionFilter
                filterExpanded = true
                onClearInitialMomentFilter()
            }
            dismissedNextWatch = repository.prefs.dismissedNextWatchSignatures()
        }
        .task {
            await loadFirstServerPage()
            let books = repository.logs.map(\.title).filter { $0.type == .book }
            if !books.isEmpty {
                await repository.ensureBookClassificationsCached(titles: books)
            }
        }
    }

    // MARK: - Timeline Log Card

    private func timelineLogCard(_ log: WatchLog) -> some View {
        let isBook = log.title.type == .book
        let isbn13 = isBook ? BookshelfBuilder.normalizeBookIsbn13(log.title) : nil
        let kdcMajor = isbn13.flatMap { repository.bookClassifications[$0]?.kdcMajor }
        let spoilerHidden = log.spoiler && !revealedSpoilers.contains(log.id)

        return VStack(alignment: .leading, spacing: 12) {
            Button {
                onOpenTitleDetail(log.title.id)
            } label: {
                HStack(alignment: .top, spacing: 14) {
                    PosterImage(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type,
                        width: 62,
                        height: 92
                    )
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                                .font(OttlineFont.semiBold(12))
                                .foregroundStyle(palette.primaryAccent)
                            Text("·")
                                .foregroundStyle(palette.subtleInk)
                            Text(RecordDate.formatDisplayDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale))
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }

                        Text(log.title.name)
                            .font(OttlineFont.semiBold(16.5))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 6) {
                            RecordFeelingBadge(rating: log.rating, isBook: isBook, compact: true)
                            if isBook, locale == "ko", let kdcMajor {
                                Text(BookshelfBuilder.kdcSectionName(major: kdcMajor, locale: locale))
                                    .font(OttlineFont.medium(11.5))
                                    .foregroundStyle(palette.mutedInk)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(palette.paperStrong)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                        }

                        let meta = [
                            log.ott,
                            log.seasonNumber.map { "S\($0)" },
                            log.episodeNumber.map { "E\($0)" },
                            log.place.map { OttlineStrings.placeLabel($0, locale: locale) },
                            log.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) }
                        ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")

                        if !meta.isEmpty {
                            Text(meta)
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                    Spacer()
                }
            }
            .buttonStyle(.plain)

            if let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                if spoilerHidden {
                    Button {
                        revealedSpoilers.insert(log.id)
                    } label: {
                        Text(OttlineStrings.tr("스포일러가 포함된 메모예요 (눌러서 보기)", "Spoiler note (Tap to reveal)", locale: locale))
                            .font(OttlineFont.medium(12.5))
                            .foregroundStyle(palette.mutedInk)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                } else {
                    Text(note)
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.ink)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            HStack {
                Button {
                    onOpenQuickRecord(QuickRecordRequest(existingLog: log, autoFocusSearch: false))
                } label: {
                    Text(OttlineStrings.tr("다듬기", "Refine", locale: locale))
                        .font(OttlineFont.medium(12.5))
                        .foregroundStyle(palette.mutedInk)
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    shareCardLog = log
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 11.5))
                        Text(OttlineStrings.tr("공유 카드", "Share", locale: locale))
                            .font(OttlineFont.medium(12.5))
                    }
                    .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    // MARK: - Next Watch Section ("내 미래는?")

    private var nextWatchSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(OttlineStrings.tr("내 미래는?", "What's next on my timeline?", locale: locale))
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr(
                        "남겨온 기록 결을 바탕으로 다음 이야기를 조용히 제안해 드려요.",
                        "Quiet suggestions based on your timeline history.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
                }
                Spacer()
                Button {
                    nextWatchExpanded.toggle()
                    if nextWatchExpanded && nextWatchResponse == nil {
                        Task { await fetchNextWatch(forceRefresh: false) }
                    }
                } label: {
                    Text(nextWatchExpanded
                        ? OttlineStrings.tr("접기", "Hide", locale: locale)
                        : OttlineStrings.tr("펼쳐보기", "Explore", locale: locale)
                    )
                    .font(OttlineFont.semiBold(12.5))
                    .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }

            if nextWatchExpanded {
                if nextWatchLoading {
                    ProgressView()
                        .padding(.vertical, 12)
                } else if let resp = nextWatchResponse {
                    let visibleItems = resp.items.filter { !dismissedNextWatch.contains("\($0.provider.rawValue):\($0.providerId)") }
                    if visibleItems.isEmpty {
                        Button {
                            Task { await fetchNextWatch(forceRefresh: true) }
                        } label: {
                            Text(OttlineStrings.tr("새로운 제안 받아보기", "Refresh suggestions", locale: locale))
                                .font(OttlineFont.semiBold(13))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .buttonStyle(.plain)
                    } else {
                        ForEach(visibleItems) { item in
                            HStack(alignment: .top, spacing: 12) {
                                PosterImage(
                                    posterUrl: item.posterUrl,
                                    titleName: item.name,
                                    titleType: item.type,
                                    width: 52,
                                    height: 76
                                )
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(item.name)
                                        .font(OttlineFont.semiBold(14.5))
                                        .foregroundStyle(palette.ink)
                                    Text(item.reason)
                                        .font(OttlineFont.regular(12.5))
                                        .foregroundStyle(palette.mutedInk)
                                    HStack(spacing: 12) {
                                        Button {
                                            let candidate = Title(
                                                id: item.titleId ?? UUID().uuidString.lowercased(),
                                                provider: item.provider,
                                                providerId: item.providerId,
                                                type: item.type,
                                                name: item.name,
                                                year: item.year,
                                                posterUrl: item.posterUrl,
                                                overview: item.overview
                                            )
                                            onOpenQuickRecord(
                                                QuickRecordRequest(
                                                    preselectedTitle: candidate,
                                                    preferredStatus: .wishlist,
                                                    selectSource: "next_watch_recommend",
                                                    prefilledPlatform: item.recommendedOtt,
                                                    autoFocusSearch: false
                                                )
                                            )
                                        } label: {
                                            Text(OttlineStrings.tr("보고 싶어요에 담기", "Save to wishlist", locale: locale))
                                                .font(OttlineFont.semiBold(12))
                                                .foregroundStyle(palette.primaryAccent)
                                        }
                                        .buttonStyle(.plain)

                                        Button {
                                            let sig = "\(item.provider.rawValue):\(item.providerId)"
                                            repository.prefs.dismissNextWatchRecommendation(signature: sig)
                                            dismissedNextWatch.insert(sig)
                                        } label: {
                                            Text(OttlineStrings.tr("관심 없음", "Dismiss", locale: locale))
                                                .font(OttlineFont.regular(12))
                                                .foregroundStyle(palette.subtleInk)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                Spacer()
                            }
                            .padding(10)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func filterChip(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(selected ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                .padding(.horizontal, 11)
                .padding(.vertical, 6)
                .background(selected ? palette.brandNavy : palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(selected ? palette.brandNavy : palette.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Pagination & Recommendations

    private func loadFirstServerPage() async {
        guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
        if let page = try? await repository.api.getLogsPage(limit: 50, cursor: nil) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
    }

    private func loadNextPage() async {
        guard hasMorePages, !loadingMore, let cursor = nextCursor else { return }
        loadingMore = true
        if let page = try? await repository.api.getLogsPage(limit: 50, cursor: cursor) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
        loadingMore = false
    }

    private func fetchNextWatch(forceRefresh: Bool) async {
        nextWatchLoading = true
        _ = try? await repository.ensureAuthenticated()
        nextWatchResponse = try? await repository.api.getNextWatchRecommendations(forceRefresh: forceRefresh)
        nextWatchLoading = false
    }
}
