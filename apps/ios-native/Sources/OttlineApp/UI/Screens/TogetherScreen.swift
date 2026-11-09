import SwiftUI

public struct TogetherScreen: View {
    public let repository: OttlineRepository
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onReportUgc: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var curatedItems: [DiscussionListItem] = []
    @State private var discussions: [DiscussionListItem] = []
    @State private var loading: Bool = true
    @State private var searchQuery: String = ""
    @State private var typeFilter: String = "all" // "all" | "movie" | "series" | "book"
    @State private var sortMode: String = "recent" // "recent" | "popular"
    @State private var reactionOverrides: [String: [DiscussionReactionItem]] = [:]

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text(OttlineStrings.tr("함께", "Together", locale: locale))
                        .font(OttlineFont.semiBold(24))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr(
                        "다른 사람들이 남긴 여운과 작품 이야기를 조용히 둘러봐요.",
                        "Quietly browse lingering notes and stories from others.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)
                }

                // AI Curator Section (`AI 운영 계정`)
                if !curatedItems.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 6) {
                            Text(OttlineStrings.tr("오늘의 질문", "Today's prompt", locale: locale))
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)
                            Text(OttlineStrings.tr("AI 운영 계정", "AI Curator", locale: locale))
                                .font(OttlineFont.medium(11))
                                .foregroundStyle(palette.primaryAccent)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(curatedItems) { item in
                                    Button {
                                        onOpenTitleDetail(item.titleId)
                                    } label: {
                                        HStack(alignment: .top, spacing: 12) {
                                            PosterImage(
                                                posterUrl: item.posterUrl,
                                                titleName: item.titleName,
                                                titleType: item.titleType,
                                                width: 54,
                                                height: 80
                                            )
                                            VStack(alignment: .leading, spacing: 5) {
                                                Text(item.titleName)
                                                    .font(OttlineFont.semiBold(15))
                                                    .foregroundStyle(palette.ink)
                                                    .lineLimit(1)
                                                if let body = item.latestCommentBody {
                                                    Text(body)
                                                        .font(OttlineFont.regular(13))
                                                        .foregroundStyle(palette.mutedInk)
                                                        .lineLimit(3)
                                                        .multilineTextAlignment(.leading)
                                                }
                                            }
                                            .frame(width: 210, alignment: .leading)
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
                            }
                        }
                    }
                }

                // Search & Filters
                VStack(alignment: .leading, spacing: 10) {
                    TextField(
                        OttlineStrings.tr("작품이나 대화 검색", "Search titles or thoughts", locale: locale),
                        text: $searchQuery
                    )
                    .font(OttlineFont.regular(14))
                    .padding(11)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )

                    HStack {
                        ScrollView(.horizontal, showsIndicators: false) {
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
                                            .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 7)
                                            .background(selected ? palette.brandNavy : palette.card)
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
                        Spacer()
                        Button {
                            sortMode = (sortMode == "recent") ? "popular" : "recent"
                        } label: {
                            Text(sortMode == "recent"
                                ? OttlineStrings.tr("최신순", "Recent", locale: locale)
                                : OttlineStrings.tr("공감순", "Popular", locale: locale)
                            )
                            .font(OttlineFont.medium(12.5))
                            .foregroundStyle(palette.primaryAccent)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Discussion Cards
                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 36)
                } else if discussions.isEmpty {
                    Text(OttlineStrings.tr("아직 나누어진 이야기가 없어요.", "No shared stories yet.", locale: locale))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 36)
                } else {
                    ForEach(discussions) { disc in
                        discussionCard(disc)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(palette.background)
        .task(id: "\(searchQuery)-\(typeFilter)-\(sortMode)") {
            await loadTogetherFeeds()
        }
    }

    private func discussionCard(_ disc: DiscussionListItem) -> some View {
        let currentReactions = reactionOverrides[disc.titleId] ?? disc.reactions ?? []
        return VStack(alignment: .leading, spacing: 12) {
            Button {
                onOpenTitleDetail(disc.titleId)
            } label: {
                HStack(alignment: .top, spacing: 14) {
                    PosterImage(
                        posterUrl: disc.posterUrl,
                        titleName: disc.titleName,
                        titleType: disc.titleType,
                        width: 58,
                        height: 86
                    )
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(OttlineStrings.titleTypeLabel(disc.titleType, locale: locale))
                                .font(OttlineFont.semiBold(11.5))
                                .foregroundStyle(palette.primaryAccent)
                            if disc.isCurated {
                                Text(OttlineStrings.tr("AI 운영 계정", "AI Curator", locale: locale))
                                    .font(OttlineFont.medium(10.5))
                                    .foregroundStyle(palette.primaryAccent)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(palette.paperStrong)
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                            }
                            Spacer()
                            Text("💬 \(disc.commentCount)")
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }

                        Text(disc.titleName)
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        if let body = disc.latestCommentBody, !body.isEmpty {
                            Text(body)
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.mutedInk)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    Spacer()
                }
            }
            .buttonStyle(.plain)

            // 3 Reaction Chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(DiscussionReactionType.allCases, id: \.self) { rType in
                        let item = currentReactions.first { $0.type == rType }
                        let count = item?.count ?? 0
                        let active = item?.viewerReacted ?? false
                        Button {
                            Task { await toggleReaction(disc: disc, type: rType) }
                        } label: {
                            HStack(spacing: 4) {
                                Text(OttlineStrings.reactionLabel(rType, titleType: disc.titleType, locale: locale))
                                    .font(active ? OttlineFont.semiBold(12) : OttlineFont.regular(12))
                                if count > 0 {
                                    Text("\(count)")
                                        .font(OttlineFont.semiBold(11.5))
                                }
                            }
                            .foregroundStyle(active ? palette.onBrandNavy : palette.ink)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(active ? palette.brandNavy : palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(active ? palette.brandNavy : palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
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

    private func loadTogetherFeeds() async {
        loading = true
        if curatedItems.isEmpty {
            curatedItems = (try? await repository.api.getCuratedDiscussions(limit: 5)) ?? []
        }
        discussions = (try? await repository.api.getDiscussionsLatest(
            limit: 30,
            days: nil,
            query: searchQuery,
            typeFilter: typeFilter,
            sort: sortMode
        )) ?? []
        loading = false
    }

    private func toggleReaction(disc: DiscussionListItem, type: DiscussionReactionType) async {
        _ = try? await repository.ensureAuthenticated()
        if let summary = try? await repository.api.toggleDiscussionReaction(titleId: disc.titleId, type: type) {
            reactionOverrides[disc.titleId] = summary.items
            if type == .bookmark,
               summary.items.first(where: { $0.type == .bookmark })?.viewerReacted == true,
               repository.db.getActiveLogsByTitleId(disc.titleId).isEmpty {
                let candidate = Title(
                    id: disc.titleId,
                    provider: disc.provider ?? .tmdb,
                    providerId: disc.providerId,
                    type: disc.titleType,
                    name: disc.titleName,
                    posterUrl: disc.posterUrl
                )
                _ = await repository.saveLogForTitle(
                    candidateTitle: candidate,
                    draft: LogDraft(status: .wishlist, watchedAt: RecordDate.nowIso()),
                    source: "together_bookmark_reaction"
                )
            }
        }
    }
}
