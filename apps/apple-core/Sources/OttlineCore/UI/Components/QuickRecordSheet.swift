import SwiftUI

public enum QuickRecordStage: String, Codable, Sendable {
    case search = "SEARCH"
    case status = "STATUS"
    case saved = "SAVED"
    case edit = "EDIT"
}

public struct QuickRecordRequest: Equatable, Identifiable, Sendable {
    public let id: String = UUID().uuidString
    public var initialQuery: String
    public var initialTypeTab: String // "all" | "movie" | "series" | "book"
    public var preselectedTitle: Title?
    public var preselectedSearchItem: TitleSearchItem?
    public var preferredStatus: LogStatus?
    public var selectSource: String?
    public var existingLog: WatchLog?
    public var prefilledPlatform: String?
    public var autoFocusSearch: Bool
    public var openNoteStage: Bool

    public init(
        initialQuery: String = "",
        initialTypeTab: String = "all",
        preselectedTitle: Title? = nil,
        preselectedSearchItem: TitleSearchItem? = nil,
        preferredStatus: LogStatus? = nil,
        selectSource: String? = nil,
        existingLog: WatchLog? = nil,
        prefilledPlatform: String? = nil,
        autoFocusSearch: Bool = true,
        openNoteStage: Bool = false
    ) {
        self.initialQuery = initialQuery
        self.initialTypeTab = initialTypeTab
        self.preselectedTitle = preselectedTitle
        self.preselectedSearchItem = preselectedSearchItem
        self.preferredStatus = preferredStatus
        self.selectSource = selectSource
        self.existingLog = existingLog
        self.prefilledPlatform = prefilledPlatform
        self.autoFocusSearch = autoFocusSearch
        self.openNoteStage = openNoteStage
    }
}

public struct QuickRecordSheet: View {
    public let request: QuickRecordRequest
    public let repository: OttlineRepository
    public var onDismiss: () -> Void
    public var onOpenTimeline: () -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenPublicDiscussion: (String) -> Void
    public var onOpenShareCard: (WatchLog) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.openURL) private var openURL
    @FocusState private var searchFieldFocused: Bool

    @State private var stage: QuickRecordStage = .search
    @State private var initializedRequestId: String?
    @State private var query: String = ""
    @State private var searchTab: String = "all"
    @State private var selectedTitle: Title?
    @State private var googleBooksInfoUrl: String?
    @State private var savedLog: WatchLog?
    @State private var isEditingExisting: Bool = false

    // Draft fields
    @State private var chosenStatus: LogStatus?
    @State private var watchedDate: Date = Date()
    @State private var selectedPlatform: String = ""
    @State private var customPlatformInput: String = ""
    @State private var showCustomPlatformField: Bool = false
    @State private var selectedPlace: Place?
    @State private var selectedOccasion: Occasion?
    @State private var feelingScore: Double?
    @State private var selectedSeason: Int?
    @State private var selectedEpisode: Int?
    @State private var seasonPosterUrl: String?
    @State private var seasonYear: Int?
    @State private var noteText: String = ""
    @State private var spoiler: Bool = false
    @State private var shareInTogether: Bool = false
    @State private var openShareCardAfterSave: Bool = false
    @State private var momentExpanded: Bool = false
    @State private var showCalendarPopover: Bool = false

    // Search & Catalog state
    @State private var searchResults: [TitleSearchItem] = []
    @State private var recentDiscussions: [DiscussionListItem] = []
    @State private var popularSuggestions: [TitleSearchItem] = []
    @State private var recentLoading: Bool = false
    @State private var recentError: String?
    @State private var searching: Bool = false
    @State private var searchError: String?
    @State private var partialSearch: Bool = false
    @State private var seasons: [SeasonOption] = []
    @State private var episodes: [EpisodeOption] = []
    @State private var saving: Bool = false
    @State private var savedBookShelfMajor: Int?
    @State private var savedDiscussionId: String?
    @State private var loadingDiscussionLink: Bool = false

    public init(
        request: QuickRecordRequest,
        repository: OttlineRepository,
        onDismiss: @escaping () -> Void,
        onOpenTimeline: @escaping () -> Void,
        onOpenTitleDetail: @escaping (String) -> Void,
        onOpenPublicDiscussion: @escaping (String) -> Void = { _ in },
        onOpenShareCard: @escaping (WatchLog) -> Void = { _ in }
    ) {
        self.request = request
        self.repository = repository
        self.onDismiss = onDismiss
        self.onOpenTimeline = onOpenTimeline
        self.onOpenTitleDetail = onOpenTitleDetail
        self.onOpenPublicDiscussion = onOpenPublicDiscussion
        self.onOpenShareCard = onOpenShareCard
    }

    public var body: some View {
        VStack(spacing: 0) {
            headerView
            Divider().overlay(palette.border)

            switch stage {
            case .search:
                searchStageView
            case .status, .edit:
                recordFormStageView
            case .saved:
                savedStageView
            }
        }
        .background(palette.card)
        .task(id: request.id) {
            if initializedRequestId != request.id {
                initializedRequestId = request.id
                initializeFromRequest()
            }
            if stage == .search && request.autoFocusSearch {
                try? await Task.sleep(nanoseconds: 80_000_000)
                searchFieldFocused = true
            }
            if recentDiscussions.isEmpty && popularSuggestions.isEmpty {
                await loadInitialSuggestions()
            }
        }
        .task(id: "\(query)-\(searchTab)-\(stage.rawValue)") {
            await performDebouncedSearch()
        }
        .task(id: selectedTitle?.id) {
            await loadCatalogForSelectedTitle()
        }
        .task(id: selectedSeason) {
            await loadEpisodesForSelectedSeason()
        }
    }

    // MARK: - Header (`QuickLogDialog.tsx` + `recording.module.css` Mobile 1:1 Parity)

    private var headerView: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 8) {
                Text(headerTitle)
                    .font(OttlineFont.semiBold(20))
                    .kerning(-0.8)
                    .foregroundStyle(palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)

                if stage != .search {
                    Text(OttlineStrings.tr(
                        "영화, 시리즈, 책. 남겨두고 싶은 만큼만 적어요.",
                        "Films, series, books. Keep as much as you want.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .lineSpacing(3)
                    .foregroundStyle(palette.mutedInk)
                }
            }
            Spacer(minLength: 8)
            Button(action: onDismiss) {
                OttlineLucideIcon(
                    kind: .x,
                    size: 22,
                    color: palette.ink,
                    strokeWidth: 2.0
                )
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(OttlineStrings.tr("기록 창 닫기", "Close recording", locale: locale))
        }
        .padding(.top, 16)
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }

    private var headerTitle: String {
        switch stage {
        case .search:
            return OttlineStrings.tr("오늘은 어떤 이야기를 남길까요?", "What story will you keep today?", locale: locale)
        case .saved:
            return OttlineStrings.tr("타임라인에 한 순간이 더해졌어요.", "One more moment on your timeline.", locale: locale)
        case .status, .edit:
            return OttlineStrings.tr("그날의 순간을 남겨요", "Keep this moment", locale: locale)
        }
    }

    // MARK: - Stage 1: SEARCH (`TitleSearchBox.tsx` + `recording.module.css` Mobile 1:1 Parity)

    private var searchStageView: some View {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let contentTypeIsBook = (searchTab == "book")
        let googleBooksSearch = locale == "en" && (
            contentTypeIsBook || searchResults.contains(where: { $0.provider == .google })
        )

        let typedRecent = recentDiscussions.filter { disc in
            contentTypeIsBook
                ? disc.titleType == .book
                : (disc.titleType == .movie || disc.titleType == .series)
        }
        let filteredRecent = Array(
            typedRecent
                .filter { searchTab == "all" || $0.titleType.rawValue == searchTab }
                .prefix(6)
        )
        let videoRecent = Array(
            recentDiscussions
                .filter { $0.titleType == .movie || $0.titleType == .series }
                .prefix(6)
        )
        let missingPopularCount = max(0, 6 - videoRecent.count)
        let popularBase = contentTypeIsBook
            ? []
            : TitleFallback.selectPopularTitleFillers(
                discussions: videoRecent,
                popularTitles: popularSuggestions,
                missingCount: missingPopularCount
            )
        let filteredPopular = popularBase.filter {
            searchTab == "all" || $0.type.rawValue == searchTab
        }

        return VStack(alignment: .leading, spacing: 16) {
            // Search input (`.searchInput` — 52pt minHeight, 16pt padding, orange focus ring, no leading icon)
            HStack(spacing: 8) {
                TextField(
                    OttlineStrings.tr("작품 검색 (예: 듄, 더 베어)", "Search titles (e.g., Dune, The Bear)", locale: locale),
                    text: $query
                )
                .textFieldStyle(.plain)
                .focused($searchFieldFocused)
                .font(OttlineFont.regular(16))
                .foregroundStyle(palette.ink)
                .submitLabel(.search)
                .autocorrectionDisabled()

                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(palette.mutedInk)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(OttlineStrings.tr("검색어 지우기", "Clear search", locale: locale))
                }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(searchFieldFocused ? palette.brandOrange : palette.border, lineWidth: 1)
            )
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(
                        searchFieldFocused ? palette.brandOrange.opacity(0.22) : Color.clear,
                        lineWidth: 3
                    )
            )

            // Type tabs (`전체` / `영화` / `시리즈` / `책` — `.typeChoices`)
            let typeTabs: [SearchTypeTab] = [
                SearchTypeTab(key: "all", label: OttlineStrings.tr("전체", "All", locale: locale)),
                SearchTypeTab(key: "movie", label: OttlineStrings.tr("영화", "Movie", locale: locale)),
                SearchTypeTab(key: "series", label: OttlineStrings.tr("시리즈", "Series", locale: locale)),
                SearchTypeTab(key: "book", label: OttlineStrings.tr("책", "Book", locale: locale))
            ]
            HStack(spacing: 6) {
                ForEach(typeTabs) { tab in
                    let selected = searchTab == tab.key
                    Button {
                        guard searchTab != tab.key else { return }
                        searchTab = tab.key
                        searchResults = []
                        partialSearch = false
                        searchError = nil
                    } label: {
                        Text(tab.label)
                            .font(selected ? OttlineFont.semiBold(14) : OttlineFont.regular(14))
                            .foregroundStyle(selected ? palette.primaryAccent : palette.mutedInk)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(selected ? palette.paperStrong : palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
                            )
                            .contentShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }

            if googleBooksSearch {
                GoogleBooksAttributionView(urlString: "https://books.google.com/")
                    .padding(.top, -8)
            }

            // `.searchResults` (`border-top: 1px solid var(--border)`)
            VStack(spacing: 0) {
                Divider().overlay(palette.border)

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        if trimmedQuery.isEmpty {
                            // Empty-query suggestions: Together (`요즘 함께 하는 작품들`) + Popular (`요즘 인기 작품`)
                            VStack(alignment: .leading, spacing: 0) {
                                if recentLoading || recentError != nil || !filteredRecent.isEmpty {
                                    Text(OttlineStrings.tr("요즘 함께 하는 작품들", "Titles shared together", locale: locale))
                                        .font(OttlineFont.bold(10))
                                        .kerning(1.0)
                                        .textCase(.uppercase)
                                        .foregroundStyle(palette.mutedInk)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                }

                                if recentLoading {
                                    Text(OttlineStrings.tr("불러오는 중...", "Loading...", locale: locale))
                                        .font(OttlineFont.bold(14))
                                        .foregroundStyle(palette.ink)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                } else if let recentError {
                                    Text(recentError)
                                        .font(OttlineFont.bold(14))
                                        .foregroundStyle(palette.danger)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                } else if filteredRecent.isEmpty && filteredPopular.isEmpty {
                                    Text(OttlineStrings.tr("아직 없어요", "Nothing here yet", locale: locale))
                                        .font(OttlineFont.bold(14))
                                        .foregroundStyle(palette.mutedInk)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                } else {
                                    ForEach(filteredRecent) { disc in
                                        recentDiscussionSuggestionRow(disc)
                                    }

                                    if !popularBase.isEmpty {
                                        if !filteredRecent.isEmpty && !filteredPopular.isEmpty {
                                            Divider().overlay(palette.border)
                                        }
                                        if !filteredPopular.isEmpty {
                                            Text(OttlineStrings.tr("요즘 인기 작품", "Popular now", locale: locale))
                                                .font(OttlineFont.bold(10))
                                                .kerning(1.0)
                                                .textCase(.uppercase)
                                                .foregroundStyle(palette.mutedInk)
                                                .padding(.horizontal, 16)
                                                .padding(.vertical, 8)

                                            ForEach(filteredPopular) { item in
                                                popularSuggestionRow(item)
                                            }
                                        }
                                    }
                                }

                                Divider().overlay(palette.border)
                            }

                            if !contentTypeIsBook && !popularBase.isEmpty {
                                tmdbAttributionFooter(showTopDivider: false)
                            }
                        } else {
                            // Live search results
                            if partialSearch && !searching {
                                Text(OttlineStrings.tr(
                                    "일부 종류의 작품을 불러오지 못했어요. 종류를 골라 다시 찾아보세요.",
                                    "Some title types could not be loaded. Choose a type to try again.",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(13))
                                .foregroundStyle(palette.mutedInk)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                            }

                            if searching {
                                Text(OttlineStrings.tr("검색 중...", "Searching...", locale: locale))
                                    .font(OttlineFont.bold(14))
                                    .foregroundStyle(palette.ink)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                            } else if let searchError {
                                Text(searchError)
                                    .font(OttlineFont.bold(14))
                                    .foregroundStyle(palette.danger)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                            } else if searchResults.isEmpty {
                                Text(OttlineStrings.tr("결과가 없어요", "No results found", locale: locale))
                                    .font(OttlineFont.bold(14))
                                    .foregroundStyle(palette.mutedInk)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                            } else {
                                ForEach(Array(searchResults.enumerated()), id: \.element.id) { idx, item in
                                    searchResultRow(
                                        item: item,
                                        source: "search_result",
                                        highlighted: idx == 0
                                    )
                                }
                            }

                            if !contentTypeIsBook {
                                tmdbAttributionFooter(showTopDivider: true)
                            }
                        }
                    }
                    .padding(.bottom, 16)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .padding(.top, 20)
        .padding(.horizontal, 20)
    }

    private func recentDiscussionSuggestionRow(_ disc: DiscussionListItem) -> some View {
        let typeLabel = OttlineStrings.titleTypeLabel(disc.titleType, locale: locale)
        let meta = disc.titleYear.map { "\(typeLabel) · \($0)" } ?? typeLabel
        return Button {
            let candidate = Title(
                id: disc.titleId,
                provider: disc.titleProvider ?? .local,
                providerId: disc.titleProviderId ?? disc.titleId,
                type: disc.titleType,
                name: disc.titleName,
                year: disc.titleYear,
                posterUrl: disc.posterUrl
            )
            selectTitle(candidate, source: "recent_discussion", infoUrl: nil)
        } label: {
            HStack(alignment: .center, spacing: 16) {
                PosterImage(
                    posterUrl: disc.posterUrl,
                    titleName: disc.titleName,
                    titleType: disc.titleType,
                    width: 56,
                    height: 80,
                    cornerRadius: 4,
                    widthBucket: "w185"
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(disc.titleName)
                        .font(OttlineFont.semiBold(16))
                        .foregroundStyle(palette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(meta)
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                        .padding(.top, 1)

                    Text(locale == "en" ? "Comments \(disc.commentCount)" : "댓글 \(disc.commentCount)")
                        .font(OttlineFont.semiBold(12))
                        .foregroundStyle(palette.mutedInk)
                        .padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func popularSuggestionRow(_ item: TitleSearchItem) -> some View {
        let typeLabel = OttlineStrings.titleTypeLabel(item.type, locale: locale)
        let meta = item.year.map { "\(typeLabel) · \($0)" } ?? typeLabel
        return Button {
            selectTitle(item.toNewTitle(), source: "popular_title", infoUrl: item.resolvedGoogleBooksUrl)
        } label: {
            HStack(alignment: .center, spacing: 16) {
                PosterImage(
                    posterUrl: item.posterUrl,
                    titleName: item.name,
                    titleType: item.type,
                    width: 56,
                    height: 80,
                    cornerRadius: 4,
                    widthBucket: "w185"
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(OttlineFont.semiBold(16))
                        .foregroundStyle(palette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(meta)
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                        .padding(.top, 1)

                    Text(OttlineStrings.tr("인기 작품", "Popular title", locale: locale))
                        .font(OttlineFont.semiBold(12))
                        .foregroundStyle(palette.mutedInk)
                        .padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func searchResultRow(item: TitleSearchItem, source: String, highlighted: Bool) -> some View {
        let typeLabel = OttlineStrings.titleTypeLabel(item.type, locale: locale)
        let meta: String = {
            if item.type == .book {
                let parts = [
                    typeLabel,
                    item.author?.trimmingCharacters(in: .whitespacesAndNewlines),
                    item.publisher?.trimmingCharacters(in: .whitespacesAndNewlines),
                    item.year.map(String.init)
                ].compactMap { val -> String? in
                    guard let v = val, !v.isEmpty else { return nil }
                    return v
                }
                return parts.joined(separator: " · ")
            } else {
                return item.year.map { "\(typeLabel) · \($0)" } ?? typeLabel
            }
        }()

        let detailLine: String? = {
            if item.type == .book {
                let isbn = (item.isbn13 ?? item.isbn10)?.trimmingCharacters(in: .whitespacesAndNewlines)
                if let isbn, !isbn.isEmpty {
                    return "ISBN \(isbn)"
                }
            }
            let ov = item.overview?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (ov?.isEmpty == false) ? ov : nil
        }()

        return VStack(alignment: .trailing, spacing: 0) {
            Button {
                selectTitle(item.toNewTitle(), source: source, infoUrl: item.resolvedGoogleBooksUrl)
            } label: {
                HStack(alignment: .center, spacing: 16) {
                    PosterImage(
                        posterUrl: item.posterUrl,
                        titleName: item.name,
                        titleType: item.type,
                        width: 64,
                        height: 96,
                        cornerRadius: 4,
                        widthBucket: "w185"
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name)
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Text(meta)
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                            .lineLimit(1)
                            .padding(.top, 1)

                        if let detailLine {
                            Text(detailLine)
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                                .lineLimit(1)
                                .padding(.top, 2)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(highlighted ? palette.paperStrong : Color.clear)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if let gbUrl = item.resolvedGoogleBooksUrl {
                GoogleBooksAttributionView(urlString: gbUrl)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }
        }
    }

    private func tmdbAttributionFooter(showTopDivider: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if showTopDivider {
                Divider().overlay(palette.border)
            }
            Text("THIS PRODUCT USES THE TMDB API BUT IS NOT ENDORSED OR CERTIFIED BY TMDB.")
                .font(OttlineFont.bold(8))
                .foregroundStyle(palette.mutedInk)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
        }
    }

    // MARK: - Stage 2 & 4: STATUS + MOMENT FORM (`QuickLogCard.tsx` 1:1 Parity)

    private var recordFormStageView: some View {
        let title = selectedTitle ?? Title(id: "unknown", name: "")
        let isBook = title.type == .book

        return VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    selectedTitleSummaryCard(title: title, isBook: isBook)

                    if stage == .status {
                        statusChoiceSection(title: title)
                        seriesSeasonEpisodeSection(title: title)
                        momentDetailsSection(
                            title: title,
                            isBook: isBook,
                            label: OttlineStrings.tr("그날의 순간 (선택)", "The moment (optional)", locale: locale),
                            includeStatusAndSeries: false
                        )
                    } else {
                        // Stage 4: Feelings first, then Moment refine, then Note + Share checkboxes
                        VStack(alignment: .leading, spacing: 8) {
                            Text(OttlineStrings.tr("어떤 느낌으로 남았나요? (선택)", "How did it feel? (optional)", locale: locale))
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.ink)
                            RecordFeelingsPicker(rating: $feelingScore, isBook: isBook)
                        }

                        momentDetailsSection(
                            title: title,
                            isBook: isBook,
                            label: OttlineStrings.tr("그날의 순간", "The moment", locale: locale),
                            includeStatusAndSeries: true
                        )

                        VStack(alignment: .leading, spacing: 8) {
                            Text(OttlineStrings.tr("메모", "Note", locale: locale))
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.ink)

                            TextField(
                                OttlineStrings.tr(
                                    "나중에 떠올리고 싶은 장면이나 마음을 적어두세요.",
                                    "Keep a scene, line, or feeling you may want later.",
                                    locale: locale
                                ),
                                text: $noteText,
                                axis: .vertical
                            )
                            .textFieldStyle(.plain)
                            .lineLimit(5...8)
                            .font(OttlineFont.regular(14.5))
                            .padding(14)
                            .frame(minHeight: 128, alignment: .topLeading)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                            OttlineCheckbox(
                                isChecked: $shareInTogether,
                                label: OttlineStrings.tr("함께 나누기", "Also share in Together", locale: locale),
                                subtitle: OttlineStrings.tr(
                                    "남긴 메모를 이 작품의 공개 이야기에도 함께 올릴게요.",
                                    "Share this note in Together for this title too.",
                                    locale: locale
                                )
                            )

                            OttlineCheckbox(
                                isChecked: $openShareCardAfterSave,
                                label: OttlineStrings.tr("저장 후 공유 카드 만들기", "Create a share card after saving", locale: locale)
                            )
                        }
                    }
                }
                .padding(20)
            }

            // Bottom Sticky Footer (`QuickLogCard.tsx` `.stickyFooter` parity)
            VStack(spacing: 0) {
                Divider().overlay(palette.border)
                HStack(spacing: 12) {
                    if stage == .edit {
                        Button {
                            if isEditingExisting {
                                onDismiss()
                            } else {
                                stage = .saved
                            }
                        } label: {
                            Text(OttlineStrings.tr("나중에 더할게요", "Maybe later", locale: locale))
                                .font(OttlineFont.medium(13.5))
                                .foregroundStyle(palette.mutedInk)
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Text(chosenStatus.map { OttlineStrings.statusLabel($0, type: title.type, locale: locale) }
                            ?? OttlineStrings.tr("상태를 골라주세요.", "Choose a status.", locale: locale)
                        )
                        .font(OttlineFont.regular(13))
                        .foregroundStyle(palette.mutedInk)
                    }

                    Spacer()

                    Button {
                        Task { await submitRecord() }
                    } label: {
                        HStack(spacing: 8) {
                            if saving {
                                ProgressView()
                                    .tint(palette.onBrandOrange)
                            }
                            Text(stage == .edit
                                ? OttlineStrings.tr("이 순간 보관하기", "Keep this moment", locale: locale)
                                : OttlineStrings.tr("기록 남기기", "Keep this record", locale: locale)
                            )
                            .font(OttlineFont.semiBold(15))
                        }
                        .foregroundStyle(chosenStatus == nil ? palette.mutedInk : palette.onBrandOrange)
                        .padding(.horizontal, 22)
                        .frame(minHeight: 48)
                        .background(chosenStatus == nil ? palette.mutedBg : palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .disabled(chosenStatus == nil || saving)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(palette.card)
            }
        }
    }

    private func selectedTitleSummaryCard(title: Title, isBook: Bool) -> some View {
        HStack(alignment: .top, spacing: 14) {
            PosterImage(
                posterUrl: seasonPosterUrl ?? title.posterUrl,
                titleName: title.name,
                titleType: title.type,
                width: 56,
                height: 84
            )
            VStack(alignment: .leading, spacing: 4) {
                Text([
                    OttlineStrings.titleTypeLabel(title.type, locale: locale),
                    (seasonYear ?? title.year).map(String.init)
                ].compactMap { $0 }.joined(separator: " · "))
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)

                Text(title.name)
                    .font(OttlineFont.semiBold(17))
                    .foregroundStyle(palette.ink)
                    .lineLimit(2)

                if isBook, let author = title.author, !author.isEmpty {
                    Text(author)
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                }
            }
            Spacer()
            if !isEditingExisting && stage == .status {
                Button {
                    stage = .search
                } label: {
                    OttlineLucideIcon(kind: .x, size: 15, color: palette.mutedInk, strokeWidth: 2.0)
                        .frame(width: 36, height: 36)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(OttlineStrings.tr("다른 작품 찾기", "Find another title", locale: locale))
            }
        }
        .padding(14)
        .background(palette.paperStrong)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func statusChoiceSection(title: Title) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(stage == .edit
                ? OttlineStrings.tr("상태", "Status", locale: locale)
                : OttlineStrings.tr("어떻게 기억해 둘까요?", "How would you like to remember it?", locale: locale)
            )
            .font(OttlineFont.semiBold(15))
            .foregroundStyle(palette.ink)

            HStack(spacing: 8) {
                ForEach([LogStatus.done, LogStatus.inProgress, LogStatus.wishlist], id: \.self) { st in
                    let selected = chosenStatus == st
                    Button {
                        chosenStatus = st
                    } label: {
                        Text(OttlineStrings.statusLabel(st, type: title.type, locale: locale))
                            .font(selected ? OttlineFont.semiBold(14) : OttlineFont.medium(14))
                            .foregroundStyle(palette.ink)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity, minHeight: 64)
                            .background(selected ? palette.paperStrong : palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(selected ? palette.ink : palette.border, lineWidth: selected ? 1.5 : 1)
                            )
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            if stage == .status {
                Text(OttlineStrings.tr(
                    "상태를 고른 뒤 아래의 ‘기록 남기기’를 눌러요. 그날의 순간은 원할 때만 더해요.",
                    "Choose a status, then tap ‘Keep this record’ below. Add the moment only if you want.",
                    locale: locale
                ))
                .font(OttlineFont.regular(12.5))
                .foregroundStyle(palette.mutedInk)
            }
        }
    }

    @ViewBuilder
    private func seriesSeasonEpisodeSection(title: Title) -> some View {
        if title.type == .series && !seasons.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(OttlineStrings.tr("시즌 · 에피소드 (선택)", "Season & Episode (optional)", locale: locale))
                    .font(OttlineFont.semiBold(13.5))
                    .foregroundStyle(palette.ink)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        chipButton(
                            label: OttlineStrings.tr("전체 시즌", "All seasons", locale: locale),
                            selected: selectedSeason == nil
                        ) {
                            selectedSeason = nil
                            selectedEpisode = nil
                            seasonPosterUrl = nil
                            seasonYear = nil
                        }
                        ForEach(seasons) { s in
                            chipButton(
                                label: s.name,
                                selected: selectedSeason == s.seasonNumber
                            ) {
                                selectedSeason = s.seasonNumber
                                selectedEpisode = nil
                                seasonPosterUrl = s.posterUrl
                                seasonYear = s.year
                            }
                        }
                    }
                }

                if !episodes.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(episodes) { ep in
                                chipButton(
                                    label: "E\(ep.episodeNumber)",
                                    selected: selectedEpisode == ep.episodeNumber
                                ) {
                                    selectedEpisode = selectedEpisode == ep.episodeNumber ? nil : ep.episodeNumber
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func momentDetailsSection(
        title: Title,
        isBook: Bool,
        label: String,
        includeStatusAndSeries: Bool
    ) -> some View {
        #if os(macOS)
        VStack(alignment: .leading, spacing: 14) {
            Divider().overlay(palette.border)

            VStack(alignment: .leading, spacing: 3) {
                Text(label)
                    .font(OttlineFont.semiBold(15.5))
                    .foregroundStyle(palette.ink)
                Text(OttlineStrings.tr(
                    "날짜와 본 곳, 머문 장소, 함께한 사람을 원할 때만 남겨두세요.",
                    "Add the date, service, place, or company whenever you like.",
                    locale: locale
                ))
                .font(OttlineFont.regular(12.5))
                .foregroundStyle(palette.mutedInk)
            }
            .padding(.top, 2)

            momentFieldsBody(
                title: title,
                isBook: isBook,
                includeStatusAndSeries: includeStatusAndSeries
            )
        }
        #else
        if stage == .edit {
            VStack(alignment: .leading, spacing: 14) {
                Divider().overlay(palette.border)

                Text(label)
                    .font(OttlineFont.semiBold(15.5))
                    .foregroundStyle(palette.ink)
                    .padding(.top, 2)

                momentFieldsBody(
                    title: title,
                    isBook: isBook,
                    includeStatusAndSeries: includeStatusAndSeries
                )
            }
        } else {
            DisclosureGroup(isExpanded: $momentExpanded) {
                momentFieldsBody(
                    title: title,
                    isBook: isBook,
                    includeStatusAndSeries: includeStatusAndSeries
                )
                .padding(.top, 10)
            } label: {
                Text(label)
                    .font(OttlineFont.semiBold(14.5))
                    .foregroundStyle(palette.ink)
            }
            .tint(palette.ink)
            .padding(14)
            .background(palette.background)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )
        }
        #endif
    }

    @ViewBuilder
    private func momentFieldsBody(
        title: Title,
        isBook: Bool,
        includeStatusAndSeries: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if includeStatusAndSeries {
                statusChoiceSection(title: title)
                seriesSeasonEpisodeSection(title: title)
            }

            momentDateCard(isBook: isBook)
            momentPlatformCard(isBook: isBook)

            #if os(macOS)
            HStack(alignment: .top, spacing: 12) {
                momentPlaceCard(title: title)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                momentOccasionCard()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            #else
            VStack(spacing: 12) {
                momentPlaceCard(title: title)
                momentOccasionCard()
            }
            #endif
        }
    }

    private func momentDateCard(isBook: Bool) -> some View {
        let calendar = Calendar.current
        let isToday = calendar.isDateInToday(watchedDate)
        let isYesterday = calendar.isDateInYesterday(watchedDate)

        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                OttlineLucideIcon(kind: .calendar, size: 16, color: palette.primaryAccent)
                Text(isBook
                    ? OttlineStrings.tr("읽은 날", "Date read", locale: locale)
                    : OttlineStrings.tr("본 날", "Date watched", locale: locale)
                )
                .font(OttlineFont.semiBold(14))
                .foregroundStyle(palette.ink)

                Spacer()

                Text(OttlineStrings.tr("달력에서 날짜 선택", "Calendar date", locale: locale))
                    .font(OttlineFont.regular(11.5))
                    .foregroundStyle(palette.subtleInk)
            }

            HStack(spacing: 8) {
                Button {
                    showCalendarPopover.toggle()
                } label: {
                    HStack(spacing: 8) {
                        OttlineLucideIcon(kind: .calendar, size: 14, color: palette.primaryAccent)
                        Text(formatWatchedCalendarLabel(watchedDate, locale: locale))
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(palette.primaryAccent)
                        OttlineLucideIcon(kind: .chevronDown, size: 13, color: palette.primaryAccent)
                    }
                    .padding(.horizontal, 12)
                    .frame(minHeight: 40)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.primaryAccent.opacity(0.45), lineWidth: 1)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .popover(isPresented: $showCalendarPopover, arrowEdge: .bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        DatePicker(
                            "",
                            selection: $watchedDate,
                            displayedComponents: .date
                        )
                        .datePickerStyle(.graphical)
                        .labelsHidden()
                        .environment(\.locale, Locale(identifier: locale == "en" ? "en_US" : "ko_KR"))
                        .tint(palette.brandNavy)
                    }
                    .padding(12)
                    .frame(width: 300)
                    .onChange(of: watchedDate) { _, _ in
                        showCalendarPopover = false
                    }
                }

                chipButton(
                    label: OttlineStrings.tr("오늘", "Today", locale: locale),
                    selected: isToday
                ) {
                    watchedDate = Date()
                }

                chipButton(
                    label: OttlineStrings.tr("어제", "Yesterday", locale: locale),
                    selected: isYesterday
                ) {
                    watchedDate = calendar.date(byAdding: .day, value: -1, to: Date()) ?? Date()
                }

                Spacer(minLength: 0)
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
    }

    private func formatWatchedCalendarLabel(_ date: Date, locale: String) -> String {
        let df = DateFormatter()
        df.calendar = Calendar(identifier: .gregorian)
        df.timeZone = RecordDate.kstTimeZone
        df.locale = Locale(identifier: locale == "en" ? "en_US" : "ko_KR")
        df.dateFormat = locale == "en" ? "MMM d, yyyy (EEE)" : "yyyy년 M월 d일 (E)"
        return df.string(from: date)
    }

    private func momentPlatformCard(isBook: Bool) -> some View {
        let groups = PlatformCatalog.groups(isBook: isBook, locale: locale)
        let flatDefaults = groups.flatMap(\.items)
        let customs = isBook
            ? repository.prefs.snapshot.customBookPlatforms
            : repository.prefs.snapshot.customVideoPlatforms
        let extraCustoms = customs.filter { !flatDefaults.contains($0) }

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 8) {
                OttlineLucideIcon(kind: isBook ? .bookOpen : .tv, size: 16, color: palette.primaryAccent)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 2) {
                    Text(isBook
                        ? OttlineStrings.tr("읽은 곳 · 서비스", "Where you got or read it", locale: locale)
                        : OttlineStrings.tr("본 곳 · 플랫폼", "Platform & service", locale: locale)
                    )
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.ink)

                    Text(isBook
                        ? OttlineStrings.tr(
                            "서점, 전자책 앱, 도서관처럼 책을 만난 경로",
                            "Bookstore, e-book app, or library",
                            locale: locale
                        )
                        : OttlineStrings.tr(
                            "OTT, TV, 영화관 브랜드처럼 작품을 본 채널",
                            "Streaming service, TV, or cinema chain",
                            locale: locale
                        )
                    )
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
                }

                Spacer(minLength: 8)

                if !selectedPlatform.isEmpty {
                    Button {
                        selectedPlatform = ""
                    } label: {
                        Text(OttlineStrings.tr("선택 해제", "Clear", locale: locale))
                            .font(OttlineFont.medium(11.5))
                            .foregroundStyle(palette.mutedInk)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                ForEach(groups, id: \.id) { group in
                    HStack(alignment: .top, spacing: 12) {
                        Text(group.label)
                            .font(OttlineFont.semiBold(12))
                            .foregroundStyle(palette.mutedInk)
                            .frame(width: 92, alignment: .leading)
                            .padding(.top, 7)

                        FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                            ForEach(group.items, id: \.self) { plat in
                                chipButton(label: plat, selected: selectedPlatform == plat) {
                                    selectedPlatform = (selectedPlatform == plat) ? "" : plat
                                }
                            }
                        }
                    }

                    Divider().overlay(palette.border)
                }

                HStack(alignment: .top, spacing: 12) {
                    Text(OttlineStrings.tr("직접 입력", "Custom", locale: locale))
                        .font(OttlineFont.semiBold(12))
                        .foregroundStyle(palette.mutedInk)
                        .frame(width: 92, alignment: .leading)
                        .padding(.top, 7)

                    VStack(alignment: .leading, spacing: 8) {
                        FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                            ForEach(extraCustoms, id: \.self) { plat in
                                chipButton(label: plat, selected: selectedPlatform == plat) {
                                    selectedPlatform = (selectedPlatform == plat) ? "" : plat
                                }
                            }
                            chipButton(
                                label: OttlineStrings.tr("+ 직접 입력", "+ Custom", locale: locale),
                                selected: showCustomPlatformField
                            ) {
                                showCustomPlatformField.toggle()
                            }
                        }

                        if showCustomPlatformField {
                            HStack(spacing: 8) {
                                TextField(
                                    OttlineStrings.tr("예: 킨들, 도서관, 오더블", "e.g. Kindle, Library, Audible", locale: locale),
                                    text: $customPlatformInput
                                )
                                .textFieldStyle(.plain)
                                .font(OttlineFont.regular(13.5))
                                .padding(10)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                                Button {
                                    let trimmed = customPlatformInput.trimmingCharacters(in: .whitespacesAndNewlines)
                                    if !trimmed.isEmpty {
                                        selectedPlatform = trimmed
                                        repository.prefs.addCustomPlatform(trimmed, isBook: isBook)
                                        showCustomPlatformField = false
                                        customPlatformInput = ""
                                    }
                                } label: {
                                    Text(OttlineStrings.tr("적용", "Apply", locale: locale))
                                        .font(OttlineFont.semiBold(13))
                                        .foregroundStyle(palette.onBrandNavy)
                                        .padding(.horizontal, 12)
                                        .frame(minHeight: 40)
                                        .background(palette.brandNavy)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
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
    }

    private func momentPlaceCard(title: Title) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                OttlineLucideIcon(kind: .mapPin, size: 16, color: palette.primaryAccent)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 2) {
                    Text(OttlineStrings.tr("머문 장소", "Place", locale: locale))
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr(
                        "집, 극장, 이동 중 같은 물리적 공간",
                        "Physical space where you were",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
                }

                Spacer(minLength: 6)

                if selectedPlace != nil {
                    Button {
                        selectedPlace = nil
                    } label: {
                        Text(OttlineStrings.tr("선택 해제", "Clear", locale: locale))
                            .font(OttlineFont.medium(11.5))
                            .foregroundStyle(palette.mutedInk)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                ForEach(Place.cases(for: title.type), id: \.self) { p in
                    chipButton(
                        label: OttlineStrings.placeLabel(p, locale: locale),
                        selected: selectedPlace == p
                    ) {
                        selectedPlace = (selectedPlace == p) ? nil : p
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func momentOccasionCard() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                OttlineLucideIcon(kind: .users, size: 16, color: palette.primaryAccent)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 2) {
                    Text(OttlineStrings.tr("누구와 · 어떤 상황", "Company & occasion", locale: locale))
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr(
                        "함께한 사람이나 그날의 분위기",
                        "Who you were with or the mood",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
                }

                Spacer(minLength: 6)

                if selectedOccasion != nil {
                    Button {
                        selectedOccasion = nil
                    } label: {
                        Text(OttlineStrings.tr("선택 해제", "Clear", locale: locale))
                            .font(OttlineFont.medium(11.5))
                            .foregroundStyle(palette.mutedInk)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                ForEach(Occasion.allCases, id: \.self) { occ in
                    chipButton(
                        label: OttlineStrings.occasionLabel(occ, locale: locale),
                        selected: selectedOccasion == occ
                    ) {
                        selectedOccasion = (selectedOccasion == occ) ? nil : occ
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    // MARK: - Stage 3: SAVED (`QuickLogCard.tsx` `stage === "saved"` 1:1 Parity)

    private var savedStageView: some View {
        let log = savedLog
        let title = log?.title ?? selectedTitle ?? Title(id: "unknown", name: "")
        return ScrollView {
            VStack(alignment: .center, spacing: 18) {
                selectedTitleSummaryCard(title: title, isBook: title.type == .book)

                VStack(alignment: .center, spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(palette.paperStrong)
                            .frame(width: 48, height: 48)
                        OttlineLucideIcon(kind: .check, size: 24, color: palette.primaryAccent, strokeWidth: 2.2)
                    }

                    Text(OttlineStrings.tr("타임라인에 남겨두었어요.", "Kept on your timeline.", locale: locale))
                        .font(OttlineFont.semiBold(20))
                        .foregroundStyle(palette.ink)
                        .multilineTextAlignment(.center)

                    Text(OttlineStrings.tr(
                        "더 남기고 싶을 때 그날의 순간과 메모를 더해요.",
                        "Add the moment and a note whenever you want.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                    .multilineTextAlignment(.center)

                    Text(OttlineStrings.tr(
                        "이 기기에 보관했어요. 연결되면 다른 기기에도 이어져요.",
                        "Saved on this device. It will sync to your other devices when connected.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(12.5))
                    .foregroundStyle(palette.subtleInk)
                    .multilineTextAlignment(.center)

                    if title.type == .book, locale == "ko" {
                        Text(savedBookShelfMajor != nil
                            ? "내 서가의 \(BookshelfBuilder.kdcSectionName(major: savedBookShelfMajor, locale: locale)) 칸에도 함께 두었어요."
                            : "알맞은 서가를 찾고 있어요."
                        )
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                        .multilineTextAlignment(.center)
                    }

                    if let did = savedDiscussionId, !did.isEmpty {
                        Button {
                            onDismiss()
                            onOpenPublicDiscussion(did)
                        } label: {
                            Text(OttlineStrings.tr("함께 나눈 이야기 보기 →", "See shared thoughts →", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                                .frame(minHeight: 38)
                        }
                        .buttonStyle(.plain)
                    } else if loadingDiscussionLink {
                        ProgressView()
                            .controlSize(.small)
                    }

                    HStack(spacing: 8) {
                        Button {
                            momentExpanded = false
                            stage = .edit
                        } label: {
                            Text(OttlineStrings.tr("그날의 순간·메모 더하기", "Add to this moment", locale: locale))
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.ink)
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

                        Button(action: onDismiss) {
                            Text(OttlineStrings.tr("완료", "Done", locale: locale))
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.onBrandOrange)
                                .padding(.horizontal, 20)
                                .frame(minHeight: 48)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.top, 6)

                    VStack(spacing: 8) {
                        if let log {
                            Button {
                                onDismiss()
                                onOpenShareCard(log)
                            } label: {
                                Text(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                                    .font(OttlineFont.medium(13.5))
                                    .foregroundStyle(palette.mutedInk)
                                    .underline()
                                    .frame(minHeight: 36)
                            }
                            .buttonStyle(.plain)
                        }

                        HStack(spacing: 18) {
                            Button {
                                resetDraftForAnotherTitle()
                            } label: {
                                Text(OttlineStrings.tr("다른 작품 더 남기기", "Log another title", locale: locale))
                                    .font(OttlineFont.medium(13.5))
                                    .foregroundStyle(palette.mutedInk)
                                    .frame(minHeight: 36)
                            }
                            .buttonStyle(.plain)

                            Button {
                                onDismiss()
                                onOpenTimeline()
                            } label: {
                                Text(OttlineStrings.tr("타임라인에서 보기 →", "View my timeline →", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.primaryAccent)
                                    .frame(minHeight: 36)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 4)
                }
                .padding(.top, 8)
            }
            .padding(20)
        }
    }

    // MARK: - Helpers & Actions

    private func chipButton(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if selected {
                    OttlineLucideIcon(kind: .check, size: 11, color: palette.primaryAccent, strokeWidth: 2.4)
                }
                Text(label)
                    .font(selected ? OttlineFont.semiBold(13) : OttlineFont.regular(13))
                    .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(selected ? palette.paperStrong : palette.background)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func resetDraftForAnotherTitle() {
        query = ""
        selectedTitle = nil
        googleBooksInfoUrl = nil
        savedLog = nil
        isEditingExisting = false
        chosenStatus = nil
        watchedDate = Date()
        selectedPlatform = ""
        customPlatformInput = ""
        showCustomPlatformField = false
        showCalendarPopover = false
        selectedPlace = nil
        selectedOccasion = nil
        feelingScore = nil
        selectedSeason = nil
        selectedEpisode = nil
        seasonPosterUrl = nil
        seasonYear = nil
        noteText = ""
        spoiler = false
        shareInTogether = false
        openShareCardAfterSave = false
        momentExpanded = false
        savedBookShelfMajor = nil
        savedDiscussionId = nil
        stage = .search
    }

    private func initializeFromRequest() {
        query = request.initialQuery
        let allowedTabs: Set<String> = ["all", "movie", "series", "book"]
        searchTab = allowedTabs.contains(request.initialTypeTab) ? request.initialTypeTab : "all"
        if let plat = request.prefilledPlatform {
            selectedPlatform = plat
        }
        if let prefStatus = request.preferredStatus {
            chosenStatus = prefStatus
        }

        if let existing = request.existingLog {
            isEditingExisting = true
            selectedTitle = existing.title
            savedLog = existing
            chosenStatus = existing.status
            watchedDate = RecordDate.parseDate(existing.watchedAt) ?? Date()
            selectedPlatform = existing.ott ?? ""
            selectedPlace = existing.place
            selectedOccasion = existing.occasion
            feelingScore = existing.rating
            selectedSeason = existing.seasonNumber
            selectedEpisode = existing.episodeNumber
            seasonPosterUrl = existing.seasonPosterUrl
            seasonYear = existing.seasonYear
            noteText = existing.note ?? ""
            spoiler = existing.spoiler
            momentExpanded = !request.openNoteStage
            stage = .edit
        } else if let preTitle = request.preselectedTitle {
            selectTitle(preTitle, source: request.selectSource ?? "preselected", infoUrl: nil)
        } else if let preSearch = request.preselectedSearchItem {
            selectTitle(preSearch.toNewTitle(), source: request.selectSource ?? "preselected", infoUrl: preSearch.resolvedGoogleBooksUrl)
        }
    }

    private func selectTitle(_ candidate: Title, source: String, infoUrl: String?) {
        let localMatch = repository.findMatchingLocalTitle(candidate)
        let finalTitle = localMatch ?? candidate
        selectedTitle = finalTitle
        googleBooksInfoUrl = infoUrl
        repository.trackTitleSelect(finalTitle, source: source)

        if let existing = repository.db.getActiveLogsByTitleId(finalTitle.id).first {
            savedLog = existing
            chosenStatus = existing.status
            watchedDate = RecordDate.parseDate(existing.watchedAt) ?? Date()
            selectedPlatform = existing.ott ?? selectedPlatform
            selectedPlace = existing.place
            selectedOccasion = existing.occasion
            feelingScore = existing.rating
            selectedSeason = existing.seasonNumber
            selectedEpisode = existing.episodeNumber
            seasonPosterUrl = existing.seasonPosterUrl
            seasonYear = existing.seasonYear
            noteText = existing.note ?? ""
            spoiler = existing.spoiler
        }
        momentExpanded = false
        stage = .status
    }

    private func loadInitialSuggestions() async {
        recentLoading = true
        recentError = nil
        do {
            let latest = try await repository.api.getDiscussionsLatest(limit: 6, days: 14)
            recentDiscussions = latest
            let videoRecentCount = latest.filter { $0.titleType == .movie || $0.titleType == .series }.prefix(6).count
            if videoRecentCount < 6 {
                popularSuggestions = (try? await repository.api.getPopularTitles(limit: 12)) ?? []
            } else {
                popularSuggestions = []
            }
        } catch {
            recentDiscussions = []
            popularSuggestions = []
            recentError = OttlineStrings.tr(
                "목록을 불러오지 못했어요. 잠시 후 다시 찾아보세요.",
                "Failed to load discussions.",
                locale: locale
            )
        }
        recentLoading = false
    }

    private func performDebouncedSearch() async {
        guard stage == .search else { return }
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            searchResults = []
            searchError = nil
            partialSearch = false
            searching = false
            return
        }
        searching = true
        searchError = nil
        partialSearch = false
        try? await Task.sleep(nanoseconds: 250_000_000)
        if Task.isCancelled { return }

        if searchTab == "all" {
            async let vOutcome: Result<[TitleSearchItem], Error> = {
                do { return .success(try await repository.api.searchTitles(query: trimmed, typeFilter: nil)) }
                catch { return .failure(error) }
            }()
            async let bOutcome: Result<[TitleSearchItem], Error> = {
                do { return .success(try await repository.api.searchTitles(query: trimmed, typeFilter: "book")) }
                catch { return .failure(error) }
            }()
            let (vRes, bRes) = await (vOutcome, bOutcome)
            if Task.isCancelled { return }

            var combined: [TitleSearchItem] = []
            var successCount = 0
            if case .success(let vItems) = vRes {
                combined.append(contentsOf: vItems)
                successCount += 1
            }
            if case .success(let bItems) = bRes {
                combined.append(contentsOf: bItems)
                successCount += 1
            }

            if successCount == 0 {
                searchResults = []
                searchError = OttlineStrings.tr(
                    "검색을 불러오지 못했어요. 잠시 후 다시 찾아보세요.",
                    "Search is unavailable. Please try again.",
                    locale: locale
                )
            } else {
                searchResults = combined
                partialSearch = (successCount == 1)
                repository.trackTitleSearch(queryLength: trimmed.count, resultCount: combined.count, category: "all")
            }
            searching = false
        } else {
            do {
                let items = try await repository.api.searchTitles(query: trimmed, typeFilter: searchTab)
                if Task.isCancelled { return }
                searchResults = items
                searching = false
                repository.trackTitleSearch(queryLength: trimmed.count, resultCount: items.count, category: searchTab)
            } catch {
                if Task.isCancelled { return }
                searchResults = []
                searchError = OttlineStrings.tr(
                    "검색을 불러오지 못했어요. 잠시 후 다시 찾아보세요.",
                    "Search is unavailable. Please try again.",
                    locale: locale
                )
                searching = false
            }
        }
    }

    private func loadCatalogForSelectedTitle() async {
        guard let t = selectedTitle else { return }
        if t.type == .series, t.provider == .tmdb, let pid = t.providerId, !pid.isEmpty {
            seasons = (try? await repository.api.getTvSeasons(providerId: pid)) ?? []
        } else {
            seasons = []
            episodes = []
        }
        if (t.type == .movie || t.type == .series),
           t.provider == .tmdb,
           let pid = t.providerId,
           !pid.isEmpty,
           (t.genres ?? []).isEmpty,
           let meta = try? await repository.api.getTmdbMetadata(type: t.type, providerId: pid) {
            var enriched = t
            enriched.genres = meta.genres ?? t.genres
            enriched.directors = meta.directors ?? t.directors
            enriched.cast = meta.cast ?? t.cast
            enriched.overview = meta.overview ?? t.overview
            selectedTitle = enriched
        }
    }

    private func loadEpisodesForSelectedSeason() async {
        guard let t = selectedTitle,
              t.type == .series,
              t.provider == .tmdb,
              let pid = t.providerId,
              let sNum = selectedSeason else {
            episodes = []
            return
        }
        episodes = (try? await repository.api.getTvEpisodes(providerId: pid, seasonNumber: sNum)) ?? []
    }

    private func submitRecord() async {
        guard let title = selectedTitle, let status = chosenStatus, !saving else { return }
        let wasEditStage = (stage == .edit)
        saving = true
        let df = DateFormatter()
        df.calendar = Calendar(identifier: .gregorian)
        df.timeZone = RecordDate.kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        let dateStr = df.string(from: watchedDate)
        let watchedIso = RecordDate.resolveWatchedAt(dateStr, existingIso: savedLog?.watchedAt)

        let trimmedNote = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedOtt = selectedPlatform.trimmingCharacters(in: .whitespacesAndNewlines)

        let draft = LogDraft(
            status: status,
            rating: feelingScore,
            note: trimmedNote.isEmpty ? nil : trimmedNote,
            spoiler: false,
            ott: trimmedOtt.isEmpty ? nil : trimmedOtt,
            seasonNumber: selectedSeason,
            episodeNumber: selectedEpisode,
            seasonPosterUrl: seasonPosterUrl,
            seasonYear: seasonYear,
            watchedAt: watchedIso,
            place: selectedPlace,
            occasion: selectedOccasion
        )

        let saved = await repository.saveLogForTitle(
            candidateTitle: title,
            draft: draft,
            existingLogId: savedLog?.id,
            source: isEditingExisting ? "edit_log" : "quick_record"
        )
        savedLog = saved

        if wasEditStage, shareInTogether, let body = draft.note, !body.isEmpty {
            _ = try? await repository.shareNoteToTogether(log: saved, noteBody: body)
        }

        if saved.title.type == .book, locale == "ko" {
            await repository.ensureBookClassificationsCached(titles: [saved.title])
            if let isbn = BookshelfBuilder.normalizeBookIsbn13(saved.title) {
                savedBookShelfMajor = repository.db.getBookClassifications(isbns: [isbn]).first?.kdcMajor
            }
        }

        if !wasEditStage {
            loadingDiscussionLink = true
            Task {
                if let conn = try? await repository.api.getDiscussionConnection(titleId: saved.title.id),
                   !conn.discussionId.isEmpty {
                    savedDiscussionId = conn.discussionId
                } else if let dto = try? await repository.api.getDiscussionByTitle(titleId: saved.title.id) {
                    savedDiscussionId = dto.id
                }
                loadingDiscussionLink = false
            }
        }

        saving = false
        if wasEditStage {
            if openShareCardAfterSave {
                onDismiss()
                onOpenShareCard(saved)
            } else if isEditingExisting {
                onDismiss()
            } else {
                stage = .saved
            }
        } else {
            stage = .saved
        }
    }
}

private struct SearchTypeTab: Identifiable {
    let key: String
    let label: String
    var id: String { key }
}
