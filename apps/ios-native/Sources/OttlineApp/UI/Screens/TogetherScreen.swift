import SwiftUI
import OttlineCore

// MARK: - 1. TOGETHER SCREEN (PUBLIC DISCUSSIONS — ADAPTIVE COMPACT & IPAD 2-COLUMN SPREAD)

public struct TogetherScreen: View {
    @ObservedObject public var repository: OttlineRepository
    @Binding public var selectedDiscussionId: String?
    public var directDiscussionId: String?
    public var onConsumeDirectDiscussion: () -> Void
    public var onExplicitSelectDiscussion: (String) -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenPublicDiscussion: (String) -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onReportUgc: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.ottlineViewportWidth) private var viewportWidth

    private var metrics: PadLayoutMetrics {
        PadLayoutMetrics.resolve(horizontalSizeClass: horizontalSizeClass, viewportWidth: viewportWidth)
    }

    @State private var discussions: [DiscussionListItem] = []
    @State private var loading: Bool = true
    @State private var loadError: Bool = false
    @State private var searchQuery: String = ""
    @State private var selectedType: String = "all" // "all" | "movie" | "series" | "book"
    @State private var sortBy: String = "latest" // "latest" | "comments"
    @State private var reactionStates: [String: DiscussionReactionState] = [:]
    @State private var busyReactionIds: Set<String> = []
    @State private var reactionGuard = TogetherReactionGuard()

    public init(
        repository: OttlineRepository,
        selectedDiscussionId: Binding<String?>,
        directDiscussionId: String? = nil,
        onConsumeDirectDiscussion: @escaping () -> Void = {},
        onExplicitSelectDiscussion: @escaping (String) -> Void = { _ in },
        onOpenTitleDetail: @escaping (String) -> Void,
        onOpenPublicDiscussion: @escaping (String) -> Void,
        onOpenQuickRecord: @escaping (QuickRecordRequest) -> Void,
        onReportUgc: @escaping (String) -> Void
    ) {
        self._repository = ObservedObject(wrappedValue: repository)
        self._selectedDiscussionId = selectedDiscussionId
        self.directDiscussionId = directDiscussionId
        self.onConsumeDirectDiscussion = onConsumeDirectDiscussion
        self.onExplicitSelectDiscussion = onExplicitSelectDiscussion
        self.onOpenTitleDetail = onOpenTitleDetail
        self.onOpenPublicDiscussion = onOpenPublicDiscussion
        self.onOpenQuickRecord = onOpenQuickRecord
        self.onReportUgc = onReportUgc
    }

    private var filteredDiscussions: [DiscussionListItem] {
        TogetherFilterSort.filterAndSort(
            discussions,
            selectedType: selectedType,
            searchQuery: searchQuery,
            sortBy: sortBy
        )
    }

    private var selectedDiscussion: DiscussionListItem? {
        let rows = filteredDiscussions
        if let selectedDiscussionId, let match = rows.first(where: { $0.id == selectedDiscussionId }) {
            return match
        }
        return rows.first
    }

    public var body: some View {
        Group {
            if metrics.isSpread {
                spreadBody
            } else {
                compactBody
            }
        }
        .background(palette.background)
        .task {
            await loadTogetherData()
            if let directDiscussionId, !directDiscussionId.isEmpty {
                await focusDiscussion(id: directDiscussionId, clearConflictingFilters: true)
                onConsumeDirectDiscussion()
            }
        }
        .onChange(of: directDiscussionId) { nextDirect in
            guard let nextDirect, !nextDirect.isEmpty else { return }
            Task {
                await focusDiscussion(id: nextDirect, clearConflictingFilters: true)
                onConsumeDirectDiscussion()
            }
        }
        .onChange(of: selectedType) { _ in
            syncSelectedDiscussion()
        }
        .onChange(of: searchQuery) { _ in
            syncSelectedDiscussion()
        }
        .onChange(of: sortBy) { _ in
            syncSelectedDiscussion()
        }
        .onChange(of: metrics.isSpread) { isSpread in
            if isSpread {
                syncSelectedDiscussion()
            }
        }
    }

    private var spreadBody: some View {
        let rows = filteredDiscussions
        let leftPaneWidth: CGFloat = viewportWidth >= 1000 ? 350 : 300
        let filterHPad: CGFloat = viewportWidth >= 1000 ? 9 : 7

        return HStack(alignment: .top, spacing: 20) {
            // Left Pane: Search, Filters, Sort & Discussion List
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(OttlineStrings.tr("함께", "TOGETHER", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.88)
                        .foregroundStyle(palette.mutedInk)

                    Text(OttlineStrings.tr("같이 보는 이야기", "Stories people are talking about", locale: locale))
                        .font(OttlineFont.bold(22))
                        .kerning(-0.5)
                        .foregroundStyle(palette.ink)
                }

                HStack(spacing: 8) {
                    OttlineLucideIcon(kind: .search, size: 15, color: palette.subtleInk)
                    TextField(
                        OttlineStrings.tr("작품 제목 찾기", "Filter by title", locale: locale),
                        text: $searchQuery
                    )
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.ink)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                    if !searchQuery.isEmpty {
                        Button {
                            searchQuery = ""
                        } label: {
                            OttlineLucideIcon(kind: .x, size: 14, color: palette.mutedInk)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 10)
                .frame(height: 38)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                HStack(spacing: 5) {
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
                                .font(active ? OttlineFont.semiBold(12) : OttlineFont.regular(12))
                                .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                                .lineLimit(1)
                                .fixedSize(horizontal: true, vertical: false)
                                .padding(.horizontal, filterHPad)
                                .frame(height: 28)
                                .background(active ? palette.paperStrong : palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.4 : 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }

                    Spacer(minLength: 4)

                    Menu {
                        Button {
                            sortBy = "latest"
                        } label: {
                            Text(OttlineStrings.tr("최신", "Latest", locale: locale))
                        }
                        Button {
                            sortBy = "comments"
                        } label: {
                            Text(OttlineStrings.tr("이야기 많은순", "Most comments", locale: locale))
                        }
                    } label: {
                        HStack(spacing: 3) {
                            Text(sortBy == "comments"
                                ? OttlineStrings.tr("많은순", "Top", locale: locale)
                                : OttlineStrings.tr("최신", "Latest", locale: locale)
                            )
                            .font(OttlineFont.medium(11.5))
                            .foregroundStyle(palette.mutedInk)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                            OttlineLucideIcon(kind: .chevronDown, size: 12, color: palette.mutedInk)
                        }
                        .padding(.horizontal, 8)
                        .frame(height: 28)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(palette.border, lineWidth: 1))
                    }
                }

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        if loading && discussions.isEmpty {
                            ProgressView()
                                .frame(maxWidth: .infinity, minHeight: 120)
                        } else if loadError && discussions.isEmpty {
                            togetherErrorCard
                        } else if rows.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("조건에 맞는 이야기가 없어요.", "No stories match your filter.", locale: locale))
                                    .font(OttlineFont.medium(13.5))
                                    .foregroundStyle(palette.mutedInk)
                                if !searchQuery.isEmpty || selectedType != "all" {
                                    Button {
                                        searchQuery = ""
                                        selectedType = "all"
                                    } label: {
                                        Text(OttlineStrings.tr("전체 보기", "Show all", locale: locale))
                                            .font(OttlineFont.semiBold(12.5))
                                            .foregroundStyle(palette.primaryAccent)
                                            .padding(.horizontal, 10)
                                            .frame(height: 32)
                                            .background(palette.paperStrong)
                                            .clipShape(RoundedRectangle(cornerRadius: 6))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                        } else {
                            ForEach(rows) { disc in
                                spreadDiscussionListRow(disc)
                            }
                        }
                    }
                    .padding(.bottom, 16)
                }
                .refreshable {
                    await loadTogetherData()
                }
            }
            .frame(width: leftPaneWidth)
            .frame(maxHeight: .infinity, alignment: .topLeading)

            // Right Pane: Inline Title Hero + Reactions + Comments Reader
            GeometryReader { rightGeo in
                ScrollView {
                    OttlineStickyFooterLayout(
                        minHeight: rightGeo.size.height,
                        topPadding: 0,
                        bottomPadding: 24,
                        minSpacing: 20
                    ) {
                        VStack(alignment: .leading, spacing: 0) {
                            if let disc = selectedDiscussion {
                                let discTitle = Title(
                                    id: disc.titleId,
                                    provider: disc.titleProvider ?? .tmdb,
                                    providerId: disc.titleProviderId,
                                    type: disc.titleType,
                                    name: disc.titleName,
                                    year: disc.titleYear,
                                    posterUrl: disc.posterUrl
                                )
                                let state = reactionStates[disc.id] ?? DiscussionReactionState(summary: disc.reactionSummary ?? .empty)

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
                                                .fixedSize(horizontal: false, vertical: true)

                                            DiscussionReactionChipsView(
                                                titleType: disc.titleType,
                                                state: state,
                                                isBusy: busyReactionIds.contains(disc.id),
                                                onToggle: { reactionType in
                                                    Task { await toggleReaction(disc: disc, type: reactionType) }
                                                }
                                            )

                                            FlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
                                                Button {
                                                    onOpenQuickRecord(
                                                        QuickRecordRequest(
                                                            preselectedTitle: discTitle,
                                                            selectSource: "together",
                                                            autoFocusSearch: false
                                                        )
                                                    )
                                                } label: {
                                                    Text(OttlineStrings.tr("이 작품 기록하기", "Log this title", locale: locale))
                                                        .font(OttlineFont.semiBold(13))
                                                        .foregroundStyle(palette.onBrandOrange)
                                                        .padding(.horizontal, 14)
                                                        .frame(height: 38)
                                                        .background(palette.brandOrange)
                                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                                }
                                                .buttonStyle(.plain)

                                                Button {
                                                    onOpenTitleDetail(disc.titleId)
                                                } label: {
                                                    Text(OttlineStrings.tr("상세 보기", "Open detail", locale: locale))
                                                        .font(OttlineFont.medium(13))
                                                        .foregroundStyle(palette.primaryAccent)
                                                        .padding(.horizontal, 12)
                                                        .frame(height: 38)
                                                        .background(palette.card)
                                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                                }
                                                .buttonStyle(.plain)

                                                Button {
                                                    let prefix = OttlineStrings.tr(
                                                        "[신고/문의] 작품: \(disc.titleName) (\(disc.titleId))\n사유: ",
                                                        "[Report] Title: \(disc.titleName) (\(disc.titleId))\nReason: ",
                                                        locale: locale
                                                    )
                                                    onReportUgc(prefix)
                                                } label: {
                                                    Text(OttlineStrings.tr("신고", "Report", locale: locale))
                                                        .font(OttlineFont.regular(12.5))
                                                        .foregroundStyle(palette.subtleInk)
                                                        .padding(.horizontal, 8)
                                                        .frame(height: 38)
                                                }
                                                .buttonStyle(.plain)
                                            }
                                            .padding(.top, 2)
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
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
                                        onSelectTitle: onOpenTitleDetail,
                                        onReportComment: onReportUgc
                                    )
                                    .id(disc.id)
                                }
                            } else if loading {
                                VStack(spacing: 12) {
                                    ProgressView()
                                    Text(OttlineStrings.tr("이야기를 불러오고 있어요.", "Loading discussions.", locale: locale))
                                        .font(OttlineFont.regular(13.5))
                                        .foregroundStyle(palette.mutedInk)
                                }
                                .frame(maxWidth: .infinity, minHeight: 260)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            } else if loadError {
                                togetherErrorCard
                            } else {
                                Text(OttlineStrings.tr("왼쪽에서 이야기를 선택해 읽어보세요.", "Select a conversation from the left list.", locale: locale))
                                    .font(OttlineFont.regular(15))
                                    .foregroundStyle(palette.mutedInk)
                                    .frame(maxWidth: .infinity, minHeight: 260)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                        }

                        OttlineAppFooter(bottomPadding: 0)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .ottlineContentContainer(metrics)
        .padding(.top, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var togetherErrorCard: some View {
        VStack(spacing: 12) {
            Text(OttlineStrings.tr(
                "이야기를 불러오지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.",
                "Couldn't load discussions. Check your connection and try again.",
                locale: locale
            ))
            .font(OttlineFont.regular(14))
            .foregroundStyle(palette.mutedInk)
            .multilineTextAlignment(.center)

            Button {
                Task { await loadTogetherData() }
            } label: {
                Text(OttlineStrings.tr("다시 시도", "Try again", locale: locale))
                    .font(OttlineFont.semiBold(13.5))
                    .foregroundStyle(palette.primaryAccent)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 40)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func spreadDiscussionListRow(_ disc: DiscussionListItem) -> some View {
        let active = selectedDiscussion?.id == disc.id
        return Button {
            selectedDiscussionId = disc.id
            onExplicitSelectDiscussion(disc.id)
            Task { await ensureReactionsLoaded(for: disc.id) }
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
                        locale == "en" ? "\(disc.commentCount) notes" : "이야기 \(disc.commentCount)"
                    ].compactMap { $0 }.joined(separator: " · "))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                    .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(active ? palette.paperStrong : palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.5 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var compactBody: some View {
        GeometryReader { scrollGeo in
            ScrollView {
                OttlineStickyFooterLayout(
                    minHeight: scrollGeo.size.height,
                    topPadding: 20,
                    bottomPadding: 24,
                    minSpacing: 20
                ) {
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

                            HStack(spacing: 8) {
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
                                                .lineLimit(1)
                                                .fixedSize(horizontal: true, vertical: false)
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

                                Menu {
                                    Button {
                                        sortBy = "latest"
                                    } label: {
                                        Text(OttlineStrings.tr("최신", "Latest", locale: locale))
                                    }
                                    Button {
                                        sortBy = "comments"
                                    } label: {
                                        Text(OttlineStrings.tr("이야기 많은순", "Most comments", locale: locale))
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Text(sortBy == "comments"
                                            ? OttlineStrings.tr("많은순", "Top", locale: locale)
                                            : OttlineStrings.tr("최신", "Latest", locale: locale)
                                        )
                                        .font(OttlineFont.medium(12.5))
                                        .foregroundStyle(palette.mutedInk)
                                        .lineLimit(1)
                                        .fixedSize(horizontal: true, vertical: false)
                                        OttlineLucideIcon(kind: .chevronDown, size: 13, color: palette.mutedInk)
                                    }
                                    .padding(.horizontal, 10)
                                    .frame(minHeight: 32)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.border, lineWidth: 1)
                                    )
                                }
                                .padding(.bottom, 4)
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
                        } else if loadError && discussions.isEmpty {
                            togetherErrorCard
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
                    }

                    OttlineAppFooter(bottomPadding: 0)
                }
                .ottlineContentContainer(metrics)
            }
            .refreshable {
                await loadTogetherData()
            }
        }
    }

    @ViewBuilder
    private func discussionRow(_ disc: DiscussionListItem) -> some View {
        let state = reactionStates[disc.id] ?? DiscussionReactionState(summary: disc.reactionSummary ?? .empty)

        VStack(alignment: .leading, spacing: 10) {
            Button {
                selectedDiscussionId = disc.id
                onExplicitSelectDiscussion(disc.id)
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
            await ensureReactionsLoaded(for: disc.id)
        }
    }

    private func loadTogetherData() async {
        loading = discussions.isEmpty
        loadError = false
        do {
            let loaded = try await repository.api.getAllDiscussions(limit: 100)
            guard !Task.isCancelled else { return }
            discussions = loaded
            loadError = false
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            if discussions.isEmpty {
                loadError = true
            }
        }
        loading = false
        syncSelectedDiscussion()
    }

    private func focusDiscussion(id: String, clearConflictingFilters: Bool) async {
        if !discussions.contains(where: { $0.id == id }) {
            if let direct = try? await repository.api.getDiscussionById(id) {
                guard !Task.isCancelled else { return }
                if !discussions.contains(where: { $0.id == direct.id }) {
                    discussions.insert(direct, at: 0)
                }
                loadError = false
            }
        }
        if clearConflictingFilters, let match = discussions.first(where: { $0.id == id }) {
            if !searchQuery.isEmpty && !match.titleName.lowercased().contains(searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) {
                searchQuery = ""
            }
            if selectedType != "all" && match.titleType.rawValue != selectedType {
                selectedType = "all"
            }
        }
        selectedDiscussionId = id
        await ensureReactionsLoaded(for: id)
    }

    private func syncSelectedDiscussion() {
        let rows = filteredDiscussions
        let resolved = TogetherFilterSort.resolveSelectedDiscussionId(
            currentId: selectedDiscussionId,
            initialId: directDiscussionId,
            filtered: rows
        )
        selectedDiscussionId = resolved
        if let resolved {
            Task { await ensureReactionsLoaded(for: resolved) }
        }
    }

    private func ensureReactionsLoaded(for discussionId: String) async {
        guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
        guard reactionStates[discussionId] == nil else { return }
        let token = reactionGuard.beginLoad(for: discussionId)
        if let fetched = try? await repository.api.getMyDiscussionReactions(discussionId: discussionId) {
            guard !Task.isCancelled, reactionGuard.shouldApplyLoad(for: discussionId, token: token) else { return }
            reactionStates[discussionId] = fetched
        }
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
            reactionGuard.markMutation(for: disc.id)
            reactionStates[disc.id] = nextState
        }
    }
}

// MARK: - 2. PUBLIC DISCUSSION DETAIL SCREEN

public struct PublicDiscussionDetailScreen: View {
    public let discussionId: String
    @ObservedObject public var repository: OttlineRepository
    public var onBack: () -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.ottlineViewportWidth) private var viewportWidth
    @Environment(\.openOttlineOverlay) private var openOverlay

    private var metrics: PadLayoutMetrics {
        PadLayoutMetrics.resolve(horizontalSizeClass: horizontalSizeClass, viewportWidth: viewportWidth)
    }

    @State private var discussion: DiscussionListItem?
    @State private var fullTitle: Title?
    @State private var reactionState: DiscussionReactionState = DiscussionReactionState()
    @State private var loading: Bool = true
    @State private var loadError: Bool = false
    @State private var notFound: Bool = false
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
        GeometryReader { scrollGeo in
            ScrollView {
                OttlineStickyFooterLayout(
                    minHeight: scrollGeo.size.height,
                    topPadding: metrics.isSpread ? 20 : 12,
                    bottomPadding: 24,
                    minSpacing: 18
                ) {
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
                            if metrics.detailTwoColumns {
                                HStack(alignment: .top, spacing: 24) {
                                    titleHeroCard(disc: disc, titleObj: titleObj)
                                        .frame(width: 360)

                                    CommentsPanelView(
                                        title: titleObj,
                                        initialDiscussionId: discussionId,
                                        repository: repository,
                                        showSyncLogCheckbox: true,
                                        onSelectTitle: onOpenTitleDetail,
                                        onReportComment: { prefill in openOverlay(.feedback(prefill)) }
                                    )
                                    .id(discussionId)
                                    .frame(maxWidth: .infinity)
                                }
                            } else {
                                titleHeroCard(disc: disc, titleObj: titleObj)

                                CommentsPanelView(
                                    title: titleObj,
                                    initialDiscussionId: discussionId,
                                    repository: repository,
                                    showSyncLogCheckbox: true,
                                    onSelectTitle: onOpenTitleDetail,
                                    onReportComment: { prefill in openOverlay(.feedback(prefill)) }
                                )
                                .id(discussionId)
                            }
                        } else if loadError && !notFound {
                            VStack(spacing: 12) {
                                Text(OttlineStrings.tr(
                                    "이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
                                    "Couldn't load this discussion. Please try again.",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(14.5))
                                .foregroundStyle(palette.mutedInk)
                                .multilineTextAlignment(.center)

                                Button {
                                    Task { await loadDetail() }
                                } label: {
                                    Text(OttlineStrings.tr("다시 시도", "Try again", locale: locale))
                                        .font(OttlineFont.semiBold(13.5))
                                        .foregroundStyle(palette.primaryAccent)
                                        .padding(.horizontal, 16)
                                        .frame(minHeight: 40)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(24)
                            .frame(maxWidth: .infinity)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
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
                    }

                    OttlineAppFooter(bottomPadding: 0)
                }
                .ottlineContentContainer(metrics)
            }
        }
        .background(palette.background)
        .task(id: discussionId) {
            await loadDetail()
        }
    }

    @ViewBuilder
    private func titleHeroCard(disc: DiscussionListItem, titleObj: Title) -> some View {
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
    }

    private func loadDetail() async {
        loading = true
        loadError = false
        notFound = false
        discussion = nil
        fullTitle = nil
        reactionState = DiscussionReactionState()
        defer {
            if !Task.isCancelled {
                loading = false
            }
        }
        do {
            let loadedDisc = try await repository.api.getDiscussionById(discussionId)
            guard !Task.isCancelled else { return }
            discussion = loadedDisc
            reactionState = DiscussionReactionState(summary: loadedDisc.reactionSummary ?? .empty)
            if let localTitle = repository.db.getTitleById(loadedDisc.titleId) {
                fullTitle = localTitle
            } else if let remoteTitle = try? await repository.api.getTitleById(id: loadedDisc.titleId) {
                guard !Task.isCancelled else { return }
                fullTitle = remoteTitle
            }
            if !(repository.prefs.snapshot.userId ?? "").isEmpty,
               let myReactions = try? await repository.api.getMyDiscussionReactions(discussionId: discussionId) {
                guard !Task.isCancelled else { return }
                reactionState = myReactions
            }
        } catch is CancellationError {
            return
        } catch let apiError as ApiError where apiError.statusCode == 404 {
            guard !Task.isCancelled else { return }
            notFound = true
        } catch {
            guard !Task.isCancelled else { return }
            loadError = true
        }
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
