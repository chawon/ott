import SwiftUI
import OttlineCore

// MARK: - 1. TOGETHER SCREEN (CURATED QUESTIONS + PUBLIC DISCUSSIONS)

public struct TogetherScreen: View {
    public let repository: OttlineRepository
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenPublicDiscussion: (String) -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onReportUgc: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var curated: [CuratedContentItem] = []
    @State private var discussions: [DiscussionListItem] = []
    @State private var loading: Bool = true
    @State private var searchQuery: String = ""
    @State private var selectedType: String = "all" // "all" | "movie" | "series" | "book"
    @State private var sortBy: String = "latest" // "latest" | "comments"
    @State private var reactionStates: [String: DiscussionReactionState] = [:]
    @State private var busyReactionIds: Set<String> = []
    @State private var resolvingCuratedId: String?

    private var filteredDiscussions: [DiscussionListItem] {
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let base = discussions.filter { item in
            let typeOk = selectedType == "all" || item.titleType.rawValue == selectedType
            let queryOk = q.isEmpty || item.titleName.lowercased().contains(q)
            return typeOk && queryOk
        }
        if sortBy == "comments" {
            return base.sorted {
                if $0.commentCount != $1.commentCount {
                    return $0.commentCount > $1.commentCount
                }
                return RecordDate.parseInstantMillis($0.createdAt) > RecordDate.parseInstantMillis($1.createdAt)
            }
        }
        return base.sorted {
            RecordDate.parseInstantMillis($0.createdAt) > RecordDate.parseInstantMillis($1.createdAt)
        }
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 6) {
                    Text(OttlineStrings.tr("함께", "TOGETHER", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.88)
                        .foregroundStyle(palette.mutedInk)

                    Text(OttlineStrings.tr("같이 보는 이야기", "Stories people are talking about", locale: locale))
                        .font(OttlineFont.semiBold(25))
                        .kerning(-0.7)
                        .foregroundStyle(palette.ink)

                    Text(OttlineStrings.tr(
                        "작품마다 열린 작은 대화방에서 다른 사람의 시선을 읽어보세요.",
                        "Read quiet notes and reactions from others around stories worth talking about.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 16)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(palette.border).frame(height: 1)
                }

                // Curated Questions
                if !curated.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 6) {
                            OttlineLucideIcon(kind: .sparkles, size: 15, color: palette.primaryAccent)
                            Text(OttlineStrings.tr("요즘 함께 건네는 질문", "Prompts worth sharing", locale: locale))
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)
                        }

                        ForEach(curated) { item in
                            Button {
                                Task { await openCuratedDiscussion(item) }
                            } label: {
                                HStack(alignment: .top, spacing: 12) {
                                    PosterImage(
                                        posterUrl: item.posterUrl,
                                        titleName: item.titleName,
                                        titleType: item.titleType,
                                        width: 44,
                                        height: 66,
                                        cornerRadius: 6
                                    )

                                    VStack(alignment: .leading, spacing: 5) {
                                        HStack(spacing: 6) {
                                            OttlineLucideIcon(kind: .sparkles, size: 13, color: palette.primaryAccent)
                                            Text(item.titleName)
                                                .font(OttlineFont.semiBold(13.5))
                                                .foregroundStyle(palette.primaryAccent)
                                                .lineLimit(1)
                                            if let y = item.titleYear {
                                                Text("(\(String(y)))")
                                                    .font(OttlineFont.regular(12))
                                                    .foregroundStyle(palette.mutedInk)
                                            }
                                        }

                                        Text(item.body)
                                            .font(OttlineFont.medium(14))
                                            .foregroundStyle(palette.ink)
                                            .lineSpacing(3)
                                            .multilineTextAlignment(.leading)

                                        if !item.disclosure.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                            Text(item.disclosure)
                                                .font(OttlineFont.regular(11.5))
                                                .foregroundStyle(palette.subtleInk)
                                        }
                                    }

                                    Spacer(minLength: 0)

                                    if resolvingCuratedId == item.id {
                                        ProgressView()
                                            .scaleEffect(0.8)
                                    } else {
                                        OttlineLucideIcon(kind: .chevronRight, size: 16, color: palette.subtleInk)
                                    }
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                            .disabled(resolvingCuratedId == item.id)
                        }
                    }
                }

                // Controls: Search + Type Tabs + Sort Toggle
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        OttlineLucideIcon(kind: .search, size: 17, color: palette.subtleInk)

                        TextField(
                            OttlineStrings.tr("작품 제목 찾기", "Search titles", locale: locale),
                            text: $searchQuery
                        )
                        .font(OttlineFont.regular(15))
                        .foregroundStyle(palette.ink)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                        if !searchQuery.isEmpty {
                            Button {
                                searchQuery = ""
                            } label: {
                                OttlineLucideIcon(kind: .x, size: 16, color: palette.mutedInk)
                                    .frame(width: 28, height: 28)
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

                    HStack(spacing: 12) {
                        HStack(spacing: 4) {
                            ForEach([
                                ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                                ("movie", OttlineStrings.tr("영화", "Movie", locale: locale)),
                                ("series", OttlineStrings.tr("시리즈", "Series", locale: locale)),
                                ("book", OttlineStrings.tr("책", "Book", locale: locale))
                            ], id: \.0) { key, label in
                                let active = selectedType == key
                                Button {
                                    selectedType = key
                                } label: {
                                    Text(label)
                                        .font(active ? OttlineFont.semiBold(13.5) : OttlineFont.medium(13.5))
                                        .foregroundStyle(active ? palette.ink : palette.mutedInk)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 8)
                                        .overlay(alignment: .bottom) {
                                            Rectangle()
                                                .fill(active ? palette.ink : Color.clear)
                                                .frame(height: 2)
                                        }
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Spacer(minLength: 4)

                        HStack(spacing: 4) {
                            sortButton(key: "latest", label: OttlineStrings.tr("최신", "Latest", locale: locale))
                            sortButton(key: "comments", label: OttlineStrings.tr("이야기 많은순", "Most comments", locale: locale))
                        }
                    }
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(palette.border).frame(height: 1)
                    }
                }

                // Discussions in Single Outer White Card
                let rows = filteredDiscussions
                if loading && rows.isEmpty {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text(OttlineStrings.tr("이야기를 불러오고 있어요.", "Loading discussions.", locale: locale))
                            .font(OttlineFont.regular(13.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 44)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                } else if rows.isEmpty {
                    VStack(spacing: 10) {
                        Text(OttlineStrings.tr("조건에 맞는 이야기가 없어요.", "No stories match your filter.", locale: locale))
                            .font(OttlineFont.medium(14.5))
                            .foregroundStyle(palette.mutedInk)
                        if !searchQuery.isEmpty || selectedType != "all" {
                            Button {
                                searchQuery = ""
                                selectedType = "all"
                            } label: {
                                Text(OttlineStrings.tr("전체 보기", "Show all", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.primaryAccent)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 40)
                                    .background(palette.paperStrong)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 44)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { idx, disc in
                            if idx > 0 {
                                Rectangle()
                                    .fill(palette.border)
                                    .frame(height: 1)
                            }
                            discussionRow(disc)
                        }
                    }
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }

                OttlineAppFooter()
            }
            .padding(.horizontal, 18)
            .padding(.top, 20)
        }
        .background(palette.background)
        .task {
            await loadTogetherData()
        }
        .refreshable {
            await loadTogetherData()
        }
    }

    private func sortButton(key: String, label: String) -> some View {
        let active = sortBy == key
        return Button {
            sortBy = key
        } label: {
            Text(label)
                .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(active ? palette.paperStrong : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func discussionRow(_ disc: DiscussionListItem) -> some View {
        let state = reactionStates[disc.id] ?? DiscussionReactionState(summary: disc.reactionSummary ?? .empty)

        VStack(alignment: .leading, spacing: 10) {
            Button {
                onOpenPublicDiscussion(disc.id)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    PosterImage(
                        posterUrl: disc.posterUrl,
                        titleName: disc.titleName,
                        titleType: disc.titleType,
                        width: 52,
                        height: 78,
                        cornerRadius: 6
                    )

                    VStack(alignment: .leading, spacing: 5) {
                        Text(disc.titleName)
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.ink)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 6) {
                            Text(OttlineStrings.titleTypeLabel(disc.titleType, locale: locale))
                                .font(OttlineFont.medium(12.5))
                                .foregroundStyle(palette.mutedInk)
                            if let year = disc.titleYear {
                                Text("· \(String(year))")
                                    .font(OttlineFont.regular(12.5))
                                    .foregroundStyle(palette.mutedInk)
                            }
                        }

                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .messageCircle, size: 13, color: palette.primaryAccent)
                            Text(locale == "en"
                                ? "\(disc.commentCount) notes"
                                : "이야기 \(disc.commentCount)개"
                            )
                            .font(OttlineFont.medium(12.5))
                            .foregroundStyle(palette.primaryAccent)
                        }
                    }

                    Spacer(minLength: 0)

                    OttlineLucideIcon(kind: .chevronRight, size: 16, color: palette.subtleInk)
                        .padding(.top, 4)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            DiscussionReactionChipsView(
                titleType: disc.titleType,
                state: state,
                isBusy: busyReactionIds.contains(disc.id),
                indented: true,
                onToggle: { reactionType in
                    Task { await toggleReaction(disc: disc, type: reactionType) }
                }
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .task(id: disc.id) {
            guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
            if reactionStates[disc.id] == nil,
               let fetched = try? await repository.api.getMyDiscussionReactions(discussionId: disc.id) {
                reactionStates[disc.id] = fetched
            }
        }
    }

    private func loadTogetherData() async {
        loading = discussions.isEmpty
        async let curatedFetch = repository.api.getCuratedContents(limit: 6)
        async let discFetch = repository.api.getAllDiscussions(limit: 100)
        curated = (try? await curatedFetch) ?? curated
        if let loaded = try? await discFetch {
            discussions = loaded
        }
        loading = false
    }

    private func openCuratedDiscussion(_ item: CuratedContentItem) async {
        guard resolvingCuratedId == nil else { return }
        resolvingCuratedId = item.id
        defer { resolvingCuratedId = nil }
        if let existing = try? await repository.api.getDiscussionByTitle(titleId: item.titleId) {
            onOpenPublicDiscussion(existing.id)
            return
        }
        if let ensured = try? await repository.api.ensureDiscussion(titleId: item.titleId) {
            onOpenPublicDiscussion(ensured.id)
            return
        }
        onOpenTitleDetail(item.titleId)
    }

    private func toggleReaction(disc: DiscussionListItem, type: DiscussionReactionType) async {
        guard !busyReactionIds.contains(disc.id) else { return }
        busyReactionIds.insert(disc.id)
        defer { busyReactionIds.remove(disc.id) }

        let syntheticTitle = Title(
            id: disc.titleId,
            provider: disc.titleProvider ?? .tmdb,
            providerId: disc.titleProviderId,
            type: disc.titleType,
            name: disc.titleName,
            year: disc.titleYear,
            posterUrl: disc.posterUrl
        )
        if let nextState = try? await repository.toggleReactionAndAutoLog(
            discussionId: disc.id,
            title: syntheticTitle,
            type: type
        ) {
            reactionStates[disc.id] = nextState
        }
    }
}

// MARK: - 2. PUBLIC DISCUSSION DETAIL SCREEN

public struct PublicDiscussionDetailScreen: View {
    public let discussionId: String
    public let repository: OttlineRepository
    public var onBack: () -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var discussion: DiscussionListItem?
    @State private var fullTitle: Title?
    @State private var reactionState: DiscussionReactionState = DiscussionReactionState()
    @State private var loading: Bool = true
    @State private var busyReaction: Bool = false

    private var resolvedTitle: Title? {
        if let fullTitle { return fullTitle }
        guard let disc = discussion else { return nil }
        return Title(
            id: disc.titleId,
            provider: disc.titleProvider ?? .tmdb,
            providerId: disc.titleProviderId,
            type: disc.titleType,
            name: disc.titleName,
            year: disc.titleYear,
            posterUrl: disc.posterUrl
        )
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Inline back bar
                Button(action: onBack) {
                    HStack(spacing: 4) {
                        OttlineLucideIcon(kind: .chevronLeft, size: 18, color: palette.ink)
                        Text(OttlineStrings.tr("함께", "Together", locale: locale))
                            .font(OttlineFont.medium(14))
                            .foregroundStyle(palette.ink)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if loading && discussion == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text(OttlineStrings.tr("이야기를 불러오고 있어요.", "Loading discussion.", locale: locale))
                            .font(OttlineFont.regular(13.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                } else if let disc = discussion, let titleObj = resolvedTitle {
                    // Title Hero Card
                    VStack(alignment: .leading, spacing: 14) {
                        Button {
                            onOpenTitleDetail(disc.titleId)
                        } label: {
                            HStack(alignment: .top, spacing: 14) {
                                PosterImage(
                                    posterUrl: titleObj.posterUrl ?? disc.posterUrl,
                                    titleName: titleObj.name,
                                    titleType: titleObj.type,
                                    width: 72,
                                    height: 108,
                                    cornerRadius: 6
                                )

                                VStack(alignment: .leading, spacing: 6) {
                                    Text(OttlineStrings.titleTypeLabel(titleObj.type, locale: locale))
                                        .font(OttlineFont.medium(11.5))
                                        .foregroundStyle(palette.mutedInk)

                                    Text(titleObj.name)
                                        .font(OttlineFont.semiBold(20))
                                        .foregroundStyle(palette.ink)
                                        .multilineTextAlignment(.leading)

                                    if let year = titleObj.year {
                                        Text(String(year))
                                            .font(OttlineFont.regular(13))
                                            .foregroundStyle(palette.mutedInk)
                                    }

                                    Text(OttlineStrings.tr("작품 상세 보기 →", "View title details →", locale: locale))
                                        .font(OttlineFont.semiBold(13))
                                        .foregroundStyle(palette.primaryAccent)
                                        .padding(.top, 2)
                                }
                                Spacer(minLength: 0)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        DiscussionReactionChipsView(
                            titleType: titleObj.type,
                            state: reactionState,
                            isBusy: busyReaction,
                            indented: false,
                            onToggle: { reactionType in
                                Task { await toggleReaction(type: reactionType, title: titleObj) }
                            }
                        )

                        Button {
                            onOpenQuickRecord(
                                QuickRecordRequest(
                                    preselectedTitle: titleObj,
                                    selectSource: "public_discussion_detail",
                                    autoFocusSearch: false
                                )
                            )
                        } label: {
                            HStack(spacing: 6) {
                                OttlineLucideIcon(kind: .plus, size: 16, color: palette.onBrandOrange)
                                Text(OttlineStrings.tr("내 타임라인에 남기기", "Save to my timeline", locale: locale))
                                    .font(OttlineFont.semiBold(14.5))
                            }
                            .foregroundStyle(palette.onBrandOrange)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(palette.brandOrange)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(16)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )

                    CommentsPanelView(
                        title: titleObj,
                        initialDiscussionId: discussionId,
                        repository: repository,
                        showSyncLogCheckbox: true,
                        onSelectTitle: onOpenTitleDetail
                    )
                } else {
                    Text(OttlineStrings.tr("이 대화를 찾을 수 없어요.", "Couldn't find this discussion.", locale: locale))
                        .font(OttlineFont.regular(14.5))
                        .foregroundStyle(palette.mutedInk)
                        .padding(.vertical, 40)
                        .frame(maxWidth: .infinity)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                }

                OttlineAppFooter()
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)
        }
        .background(palette.background)
        .task(id: discussionId) {
            await loadDetail()
        }
    }

    private func loadDetail() async {
        loading = true
        async let discTask = repository.api.getDiscussionById(discussionId)
        let loadedDisc = try? await discTask
        discussion = loadedDisc
        if let disc = loadedDisc {
            reactionState = DiscussionReactionState(summary: disc.reactionSummary ?? .empty)
            if let localTitle = repository.db.getTitleById(disc.titleId) {
                fullTitle = localTitle
            } else if let remoteTitle = try? await repository.api.getTitleById(id: disc.titleId) {
                fullTitle = remoteTitle
            }
            if !(repository.prefs.snapshot.userId ?? "").isEmpty,
               let myReactions = try? await repository.api.getMyDiscussionReactions(discussionId: discussionId) {
                reactionState = myReactions
            }
        }
        loading = false
    }

    private func toggleReaction(type: DiscussionReactionType, title: Title) async {
        guard !busyReaction else { return }
        busyReaction = true
        defer { busyReaction = false }
        if let nextState = try? await repository.toggleReactionAndAutoLog(
            discussionId: discussionId,
            title: title,
            type: type
        ) {
            reactionState = nextState
        }
    }
}
