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

    public init(
        initialQuery: String = "",
        initialTypeTab: String = "all",
        preselectedTitle: Title? = nil,
        preselectedSearchItem: TitleSearchItem? = nil,
        preferredStatus: LogStatus? = nil,
        selectSource: String? = nil,
        existingLog: WatchLog? = nil,
        prefilledPlatform: String? = nil,
        autoFocusSearch: Bool = true
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
    }
}

public struct QuickRecordSheet: View {
    public let request: QuickRecordRequest
    public let repository: OttlineRepository
    public var onDismiss: () -> Void
    public var onOpenTimeline: () -> Void
    public var onOpenTitleDetail: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var stage: QuickRecordStage = .search
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
    @State private var momentExpanded: Bool = true

    // Search & Catalog state
    @State private var searchResults: [TitleSearchItem] = []
    @State private var recentDiscussions: [DiscussionListItem] = []
    @State private var popularSuggestions: [TitleSearchItem] = []
    @State private var searching: Bool = false
    @State private var searchError: String?
    @State private var seasons: [SeasonOption] = []
    @State private var episodes: [EpisodeOption] = []
    @State private var saving: Bool = false
    @State private var showShareCard: Bool = false
    @State private var savedBookShelfMajor: Int?

    public init(
        request: QuickRecordRequest,
        repository: OttlineRepository,
        onDismiss: @escaping () -> Void,
        onOpenTimeline: @escaping () -> Void,
        onOpenTitleDetail: @escaping (String) -> Void
    ) {
        self.request = request
        self.repository = repository
        self.onDismiss = onDismiss
        self.onOpenTimeline = onOpenTimeline
        self.onOpenTitleDetail = onOpenTitleDetail
    }

    public var body: some View {
        NavigationStack {
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
            .sheet(isPresented: $showShareCard) {
                if let log = savedLog {
                    ShareCardDialog(
                        log: log,
                        nickname: repository.prefs.snapshot.nickname,
                        personaKey: repository.prefs.snapshot.personaKey,
                        onDismiss: { showShareCard = false }
                    )
                }
            }
            .task {
                initializeFromRequest()
                await loadInitialSuggestions()
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
    }

    // MARK: - Header

    private var headerView: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(headerTitle)
                    .font(OttlineFont.semiBold(20))
                    .foregroundStyle(palette.ink)
                if stage != .search {
                    Text(OttlineStrings.tr(
                        "영화, 시리즈, 책. 남겨두고 싶은 만큼만 적어요.",
                        "Films, series, books. Keep as much as you want.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)
                }
            }
            Spacer()
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(palette.ink)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
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

    // MARK: - Stage 1: SEARCH

    private var searchStageView: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(palette.mutedInk)
                TextField(
                    OttlineStrings.tr("작품 검색 (예: 듄, 더 베어)", "Search titles (e.g., Dune, The Bear)", locale: locale),
                    text: $query
                )
                .font(OttlineFont.regular(15))
                .foregroundStyle(palette.ink)
                .submitLabel(.search)

                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(palette.mutedInk)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.brandNavy.opacity(0.6), lineWidth: 1)
            )
            .padding(.horizontal, 20)
            .padding(.top, 16)

            // Type tabs (`전체` / `영화` / `시리즈` / `책`)
            HStack(spacing: 6) {
                ForEach([
                    ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                    ("movie", OttlineStrings.tr("영화", "Movie", locale: locale)),
                    ("series", OttlineStrings.tr("시리즈", "Series", locale: locale)),
                    ("book", OttlineStrings.tr("책", "Book", locale: locale))
                ], id: \.0) { key, label in
                    let selected = searchTab == key
                    Button {
                        searchTab = key
                    } label: {
                        Text(label)
                            .font(selected ? OttlineFont.semiBold(13.5) : OttlineFont.regular(13.5))
                            .foregroundStyle(selected ? palette.ink : palette.mutedInk)
                            .frame(maxWidth: .infinity, minHeight: 40)
                            .background(selected ? palette.paperStrong : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(selected ? palette.ink : palette.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)

            Divider().overlay(palette.border)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if searching {
                        HStack {
                            Spacer()
                            ProgressView(OttlineStrings.tr("검색 중...", "Searching...", locale: locale))
                                .padding(.vertical, 32)
                            Spacer()
                        }
                    } else if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        if let searchError {
                            Text(searchError)
                                .font(OttlineFont.regular(13))
                                .foregroundStyle(palette.danger)
                                .padding(20)
                        } else if searchResults.isEmpty {
                            Text(OttlineStrings.tr("결과가 없어요", "No results found", locale: locale))
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.mutedInk)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 32)
                        } else {
                            ForEach(searchResults) { item in
                                searchResultRow(item: item, source: "search_result")
                                Divider().overlay(palette.border)
                            }
                            if searchResults.contains(where: { $0.provider == .google }) {
                                HStack {
                                    Spacer()
                                    Image("google_books_powered_by")
                                        .resizable()
                                        .scaledToFit()
                                        .frame(height: 22)
                                        .padding(.vertical, 10)
                                }
                                .padding(.horizontal, 20)
                            }
                        }
                    } else {
                        // Empty-query suggestions: Together + Popular
                        if !recentDiscussions.isEmpty {
                            Text(OttlineStrings.tr("요즘 함께 기록하는 작품", "Recently logged together", locale: locale))
                                .font(OttlineFont.semiBold(12.5))
                                .foregroundStyle(palette.mutedInk)
                                .padding(.horizontal, 20)
                                .padding(.top, 14)
                                .padding(.bottom, 6)

                            ForEach(recentDiscussions.prefix(6)) { disc in
                                Button {
                                    let candidate = Title(
                                        id: disc.titleId,
                                        provider: disc.provider ?? .tmdb,
                                        providerId: disc.providerId,
                                        type: disc.titleType,
                                        name: disc.titleName,
                                        posterUrl: disc.posterUrl
                                    )
                                    selectTitle(candidate, source: "together_suggestion", infoUrl: nil)
                                } label: {
                                    HStack(spacing: 12) {
                                        PosterImage(
                                            posterUrl: disc.posterUrl,
                                            titleName: disc.titleName,
                                            titleType: disc.titleType,
                                            width: 44,
                                            height: 64
                                        )
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(disc.titleName)
                                                .font(OttlineFont.semiBold(15))
                                                .foregroundStyle(palette.ink)
                                                .lineLimit(1)
                                            Text(OttlineStrings.titleTypeLabel(disc.titleType, locale: locale))
                                                .font(OttlineFont.regular(12))
                                                .foregroundStyle(palette.mutedInk)
                                        }
                                        Spacer()
                                    }
                                    .padding(.horizontal, 20)
                                    .padding(.vertical, 10)
                                }
                                .buttonStyle(.plain)
                                Divider().overlay(palette.border)
                            }
                        }

                        if searchTab != "book" && !popularSuggestions.isEmpty {
                            Text(OttlineStrings.tr("요즘 인기 작품", "Popular right now", locale: locale))
                                .font(OttlineFont.semiBold(12.5))
                                .foregroundStyle(palette.mutedInk)
                                .padding(.horizontal, 20)
                                .padding(.top, 16)
                                .padding(.bottom, 6)

                            ForEach(popularSuggestions.prefix(6)) { item in
                                searchResultRow(item: item, source: "popular_title")
                                Divider().overlay(palette.border)
                            }
                        }
                    }
                }
            }
        }
    }

    private func searchResultRow(item: TitleSearchItem, source: String) -> some View {
        Button {
            selectTitle(item.toNewTitle(), source: source, infoUrl: item.infoUrl)
        } label: {
            HStack(spacing: 12) {
                PosterImage(
                    posterUrl: item.posterUrl,
                    titleName: item.name,
                    titleType: item.type,
                    width: 46,
                    height: 68
                )
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name)
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        Text(OttlineStrings.titleTypeLabel(item.type, locale: locale))
                            .font(OttlineFont.medium(12))
                            .foregroundStyle(palette.primaryAccent)
                        if let year = item.year {
                            Text(String(year))
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }
                        if let author = item.author, !author.isEmpty {
                            Text(author)
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Stage 2 & 4: STATUS + MOMENT FORM

    private var recordFormStageView: some View {
        let title = selectedTitle ?? Title(id: "unknown", name: "")
        let isBook = title.type == .book

        return VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Selected Title Summary
                    HStack(alignment: .top, spacing: 14) {
                        PosterImage(
                            posterUrl: seasonPosterUrl ?? title.posterUrl,
                            titleName: title.name,
                            titleType: title.type,
                            width: 64,
                            height: 94
                        )
                        VStack(alignment: .leading, spacing: 5) {
                            Text(OttlineStrings.titleTypeLabel(title.type, locale: locale))
                                .font(OttlineFont.medium(12))
                                .foregroundStyle(palette.primaryAccent)
                            Text(title.name)
                                .font(OttlineFont.semiBold(17))
                                .foregroundStyle(palette.ink)
                                .lineLimit(2)
                            if let year = seasonYear ?? title.year {
                                Text(String(year))
                                    .font(OttlineFont.regular(12.5))
                                    .foregroundStyle(palette.mutedInk)
                            }
                            if !isEditingExisting {
                                Button {
                                    stage = .search
                                } label: {
                                    Text(OttlineStrings.tr("다른 작품 고르기", "Change title", locale: locale))
                                        .font(OttlineFont.medium(12.5))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .buttonStyle(.plain)
                                .padding(.top, 2)
                            }
                        }
                        Spacer()
                    }

                    // 1. Status Choice (`봤어요/읽었어요`, `보는 중/읽는 중`, `보고 싶어요/읽고 싶어요`)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(OttlineStrings.tr("어떻게 남길까요?", "How would you like to keep it?", locale: locale))
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.ink)

                        HStack(spacing: 8) {
                            ForEach([LogStatus.done, LogStatus.inProgress, LogStatus.wishlist], id: \.self) { st in
                                let selected = chosenStatus == st
                                Button {
                                    chosenStatus = st
                                } label: {
                                    Text(OttlineStrings.statusLabel(st, type: title.type, locale: locale))
                                        .font(selected ? OttlineFont.semiBold(14) : OttlineFont.medium(14))
                                        .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                                        .frame(maxWidth: .infinity, minHeight: 46)
                                        .background(selected ? palette.brandNavy : palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(selected ? palette.brandNavy : palette.border, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // 2. Series Season / Episode Picker
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

                    // 3. Moment Details Section (`그날의 순간`)
                    DisclosureGroup(isExpanded: $momentExpanded) {
                        VStack(alignment: .leading, spacing: 18) {
                            // Date Picker
                            DatePicker(
                                OttlineStrings.tr("기록 날짜", "Date", locale: locale),
                                selection: $watchedDate,
                                displayedComponents: .date
                            )
                            .font(OttlineFont.medium(14))
                            .tint(palette.brandNavy)
                            .padding(.top, 8)

                            // 3-Level Feeling Selector
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("남은 여운", "How it stayed with you", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.ink)

                                let feelingOptions = RecordFeelings.options(isBook: isBook, locale: locale)
                                let currentVal = RecordFeelings.ratingToFeelingValue(feelingScore)
                                VStack(spacing: 8) {
                                    ForEach(feelingOptions, id: \.value) { opt in
                                        let selected = currentVal == opt.value
                                        Button {
                                            feelingScore = selected ? nil : opt.score
                                        } label: {
                                            HStack(spacing: 10) {
                                                FeelingIcon(
                                                    value: opt.value,
                                                    isBook: isBook,
                                                    size: 18,
                                                    tint: selected ? palette.primaryAccent : palette.mutedInk
                                                )
                                                Text(opt.label)
                                                    .font(selected ? OttlineFont.semiBold(14) : OttlineFont.regular(14))
                                                    .foregroundStyle(palette.ink)
                                                Spacer()
                                                if selected {
                                                    Image(systemName: "checkmark")
                                                        .font(.system(size: 13, weight: .bold))
                                                        .foregroundStyle(palette.primaryAccent)
                                                }
                                            }
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 11)
                                            .background(selected ? palette.paperStrong : palette.card)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 8)
                                                    .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: 1)
                                            )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            // Platform / Medium Chips
                            VStack(alignment: .leading, spacing: 8) {
                                Text(isBook
                                    ? OttlineStrings.tr("읽은 방식 · 서점", "Format or bookstore", locale: locale)
                                    : OttlineStrings.tr("어디서 보셨나요? (플랫폼)", "Where did you watch?", locale: locale)
                                )
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.ink)

                                let defaults = isBook
                                    ? OttlineStrings.bookPlatforms(locale)
                                    : OttlineStrings.videoPlatforms(locale)
                                let customs = isBook
                                    ? repository.prefs.snapshot.customBookPlatforms
                                    : repository.prefs.snapshot.customVideoPlatforms
                                let allPlatforms = defaults + customs.filter { !defaults.contains($0) }

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(allPlatforms, id: \.self) { plat in
                                            chipButton(
                                                label: plat,
                                                selected: selectedPlatform == plat
                                            ) {
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
                                }

                                if showCustomPlatformField {
                                    HStack(spacing: 8) {
                                        TextField(
                                            OttlineStrings.tr("플랫폼 직접 입력", "Enter platform", locale: locale),
                                            text: $customPlatformInput
                                        )
                                        .font(OttlineFont.regular(13.5))
                                        .padding(10)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))

                                        Button {
                                            let trimmed = customPlatformInput.trimmingCharacters(in: .whitespacesAndNewlines)
                                            if !trimmed.isEmpty {
                                                selectedPlatform = trimmed
                                                showCustomPlatformField = false
                                                customPlatformInput = ""
                                            }
                                        } label: {
                                            Text(OttlineStrings.tr("적용", "Apply", locale: locale))
                                                .font(OttlineFont.semiBold(13))
                                                .foregroundStyle(palette.onBrandNavy)
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 10)
                                                .background(palette.brandNavy)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            // Place Chips
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("함께한 공간", "Place", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.ink)
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(Place.allCases, id: \.self) { p in
                                            chipButton(
                                                label: OttlineStrings.placeLabel(p, locale: locale),
                                                selected: selectedPlace == p
                                            ) {
                                                selectedPlace = (selectedPlace == p) ? nil : p
                                            }
                                        }
                                    }
                                }
                            }

                            // Occasion Chips
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("함께한 순간", "Occasion", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.ink)
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
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
                            }

                            // Note Field
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("남겨두고 싶은 한 줄 (선택)", "A line to keep (optional)", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.ink)

                                TextField(
                                    OttlineStrings.tr(
                                        "기억하고 싶은 대사나 그날의 기분을 적어도 좋아요.",
                                        "Write a favorite quote or how the moment felt.",
                                        locale: locale
                                    ),
                                    text: $noteText,
                                    axis: .vertical
                                )
                                .lineLimit(3...6)
                                .font(OttlineFont.regular(14))
                                .padding(12)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )

                                Toggle(
                                    OttlineStrings.tr("스포일러 포함", "Contains spoilers", locale: locale),
                                    isOn: $spoiler
                                )
                                .font(OttlineFont.regular(13))
                                .tint(palette.brandNavy)

                                if !noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                    Toggle(
                                        OttlineStrings.tr("함께 화면에도 이 이야기 나누기", "Also share this note in Together", locale: locale),
                                        isOn: $shareInTogether
                                    )
                                    .font(OttlineFont.regular(13))
                                    .tint(palette.brandNavy)
                                }
                            }
                        }
                    } label: {
                        Text(OttlineStrings.tr("그날의 순간 더 적기 (선택)", "Moment details (optional)", locale: locale))
                            .font(OttlineFont.semiBold(14.5))
                            .foregroundStyle(palette.ink)
                    }
                    .tint(palette.ink)
                }
                .padding(20)
            }

            // Bottom Sticky Primary Action (`#FF9933` with `#0F0F0F` text per `DESIGN.md`)
            VStack(spacing: 0) {
                Divider().overlay(palette.border)
                Button {
                    Task { await submitRecord() }
                } label: {
                    HStack(spacing: 8) {
                        if saving {
                            ProgressView()
                                .tint(palette.onBrandOrange)
                        }
                        Text(chosenStatus == nil
                            ? OttlineStrings.tr("위에서 감상 상태를 먼저 골라주세요", "Choose a status above first", locale: locale)
                            : OttlineStrings.tr("기록 남기기", "Save to timeline", locale: locale)
                        )
                        .font(OttlineFont.semiBold(15))
                    }
                    .foregroundStyle(chosenStatus == nil ? palette.mutedInk : palette.onBrandOrange)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(chosenStatus == nil ? palette.mutedBg : palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(chosenStatus == nil || saving)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(palette.card)
            }
        }
    }

    // MARK: - Stage 3: SAVED

    private var savedStageView: some View {
        let log = savedLog
        let title = log?.title ?? selectedTitle ?? Title(id: "unknown", name: "")
        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 14) {
                    PosterImage(
                        posterUrl: log?.seasonPosterUrl ?? title.posterUrl,
                        titleName: title.name,
                        titleType: title.type,
                        width: 64,
                        height: 94
                    )
                    VStack(alignment: .leading, spacing: 6) {
                        Text(title.name)
                            .font(OttlineFont.semiBold(17))
                            .foregroundStyle(palette.ink)
                        if let st = log?.status {
                            Text(OttlineStrings.statusLabel(st, type: title.type, locale: locale))
                                .font(OttlineFont.medium(13))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        RecordFeelingBadge(rating: log?.rating, isBook: title.type == .book, compact: true)

                        if title.type == .book, locale == "ko" {
                            Text(BookshelfBuilder.kdcSectionName(major: savedBookShelfMajor, locale: locale))
                                .font(OttlineFont.medium(12))
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                    Spacer()
                }
                .padding(16)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(palette.border, lineWidth: 1)
                )

                HStack(spacing: 10) {
                    Button {
                        stage = .edit
                    } label: {
                        Text(OttlineStrings.tr("순간 더 다듬기", "Refine moment", locale: locale))
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.ink)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)

                    Button {
                        showShareCard = true
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "square.and.arrow.up")
                            Text(OttlineStrings.tr("공유 카드", "Share card", locale: locale))
                                .font(OttlineFont.semiBold(14))
                        }
                        .foregroundStyle(palette.primaryAccent)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.primaryAccent, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    onDismiss()
                    onOpenTimeline()
                } label: {
                    Text(OttlineStrings.tr("내 타임라인에서 보기", "View on my timeline", locale: locale))
                        .font(OttlineFont.semiBold(14.5))
                        .foregroundStyle(palette.onBrandNavy)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(palette.brandNavy)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            .padding(20)
        }
    }

    // MARK: - Helpers & Actions

    private func chipButton(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(selected ? OttlineFont.semiBold(13) : OttlineFont.regular(13))
                .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(selected ? palette.brandNavy : palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(selected ? palette.brandNavy : palette.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func initializeFromRequest() {
        query = request.initialQuery
        searchTab = request.initialTypeTab
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
            stage = .edit
        } else if let preTitle = request.preselectedTitle {
            selectTitle(preTitle, source: request.selectSource ?? "preselected", infoUrl: nil)
        } else if let preSearch = request.preselectedSearchItem {
            selectTitle(preSearch.toNewTitle(), source: request.selectSource ?? "preselected", infoUrl: preSearch.infoUrl)
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
        stage = .status
    }

    private func loadInitialSuggestions() async {
        if let latest = try? await repository.api.getDiscussionsLatest(limit: 6, days: 14) {
            recentDiscussions = latest
        }
        if let popular = try? await repository.api.getPopularTitles(limit: 8) {
            popularSuggestions = popular
        }
    }

    private func performDebouncedSearch() async {
        guard stage == .search else { return }
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            searchResults = []
            searchError = nil
            searching = false
            return
        }
        searching = true
        searchError = nil
        try? await Task.sleep(nanoseconds: 250_000_000)
        if Task.isCancelled { return }

        if searchTab == "all" {
            async let vTask = try? repository.api.searchTitles(query: trimmed, typeFilter: nil)
            async let bTask = try? repository.api.searchTitles(query: trimmed, typeFilter: "book")
            let (vRes, bRes) = await (vTask, bTask)
            var combined: [TitleSearchItem] = []
            if let vRes { combined.append(contentsOf: vRes) }
            if let bRes { combined.append(contentsOf: bRes) }
            searchResults = combined
            searching = false
            repository.trackTitleSearch(queryLength: trimmed.count, resultCount: combined.count, category: "all")
        } else {
            do {
                let items = try await repository.api.searchTitles(query: trimmed, typeFilter: searchTab)
                searchResults = items
                searching = false
                repository.trackTitleSearch(queryLength: trimmed.count, resultCount: items.count, category: searchTab)
            } catch {
                searchResults = []
                searchError = OttlineStrings.tr(
                    "검색 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
                    "Search failed. Please try again.",
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
        saving = true
        let df = DateFormatter()
        df.calendar = Calendar(identifier: .gregorian)
        df.timeZone = RecordDate.kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        let dateStr = df.string(from: watchedDate)
        let watchedIso = RecordDate.resolveWatchedAt(dateStr, existingIso: savedLog?.watchedAt)

        let draft = LogDraft(
            status: status,
            rating: feelingScore,
            note: noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : noteText.trimmingCharacters(in: .whitespacesAndNewlines),
            spoiler: spoiler,
            ott: selectedPlatform.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : selectedPlatform.trimmingCharacters(in: .whitespacesAndNewlines),
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

        if shareInTogether, let body = draft.note, !body.isEmpty {
            _ = try? await repository.ensureAuthenticated()
            _ = try? await repository.api.createComment(
                titleId: saved.title.id,
                payload: CreateCommentRequest(
                    body: body,
                    authorName: repository.prefs.snapshot.nickname,
                    userId: repository.prefs.snapshot.userId,
                    syncToLog: false
                )
            )
        }

        if saved.title.type == .book, locale == "ko" {
            await repository.ensureBookClassificationsCached(titles: [saved.title])
            if let isbn = BookshelfBuilder.normalizeBookIsbn13(saved.title) {
                savedBookShelfMajor = repository.db.getBookClassifications(isbns: [isbn]).first?.kdcMajor
            }
        }

        saving = false
        if isEditingExisting {
            onDismiss()
        } else {
            stage = .saved
        }
    }
}
