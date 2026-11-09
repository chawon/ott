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
    @State private var sortMode: String = "latest" // "latest" | "comments"
    @State private var reactionOverrides: [String: [DiscussionReactionItem]] = [:]

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                // 1. Page Header (`app/[locale]/public/page.tsx` `.pageHeader` 1:1 parity)
                VStack(alignment: .leading, spacing: 6) {
                    Text(OttlineStrings.tr("함께 나누는 이야기", "STORIES, SHARED", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.88)
                        .foregroundStyle(palette.mutedInk)

                    Text(OttlineStrings.tr("같은 이야기, 다른 마음", "Same story, different feelings", locale: locale))
                        .font(OttlineFont.semiBold(25))
                        .kerning(-0.7)
                        .foregroundStyle(palette.ink)

                    Text(OttlineStrings.tr(
                        "같은 작품에서 만난 장면과 생각을 함께 나눠요.",
                        "Share the scenes and thoughts that stayed with you.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14.5))
                    .foregroundStyle(palette.mutedInk)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 16)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(palette.border).frame(height: 1)
                }

                // 2. AI Curator Section (`CuratedContentList.tsx` 1:1 parity)
                if !curatedItems.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(palette.primaryAccent)
                                .padding(.top, 2)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(OttlineStrings.tr("ottline 큐레이터의 질문", "A question from the ottline curator", locale: locale))
                                    .font(OttlineFont.semiBold(15))
                                    .foregroundStyle(palette.ink)
                                Text(OttlineStrings.tr(
                                    "사람의 기록과는 구분된, 오늘의 대화 소재예요.",
                                    "A conversation starter, kept separate from people's records.",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(12.5))
                                .foregroundStyle(palette.mutedInk)
                            }

                            Spacer()

                            Text(OttlineStrings.tr("AI 운영 계정", "AI-operated account", locale: locale))
                                .font(OttlineFont.semiBold(11))
                                .foregroundStyle(palette.mutedInk)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(palette.paperStrong)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule().stroke(palette.border, lineWidth: 1)
                                )
                        }

                        VStack(spacing: 10) {
                            ForEach(curatedItems) { item in
                                Button {
                                    onOpenTitleDetail(item.titleId)
                                } label: {
                                    HStack(alignment: .top, spacing: 12) {
                                        PosterImage(
                                            posterUrl: item.posterUrl,
                                            titleName: item.titleName,
                                            titleType: item.titleType,
                                            width: 56,
                                            height: 80
                                        )
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(item.titleName)
                                                .font(OttlineFont.semiBold(15))
                                                .foregroundStyle(palette.ink)
                                                .lineLimit(1)

                                            Text([
                                                OttlineStrings.titleTypeLabel(item.titleType, locale: locale),
                                                item.latestAuthorName ?? OttlineStrings.tr("ottline 큐레이터", "ottline curator", locale: locale)
                                            ].joined(separator: " · "))
                                            .font(OttlineFont.regular(11.5))
                                            .foregroundStyle(palette.mutedInk)

                                            if let body = item.latestCommentBody, !body.isEmpty {
                                                Text(body)
                                                    .font(OttlineFont.regular(13.5))
                                                    .foregroundStyle(palette.ink)
                                                    .lineLimit(3)
                                                    .multilineTextAlignment(.leading)
                                                    .padding(.top, 2)
                                            }
                                        }
                                        Spacer()
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
                    .padding(16)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }

                // 3. Sub-description & Search/Sort Bar (`PublicDiscussionsClient.tsx` 1:1 parity)
                VStack(alignment: .leading, spacing: 12) {
                    Text(OttlineStrings.tr(
                        "다른 사람들은 요즘 무엇을 보고 읽을까요?",
                        "What are others watching and reading these days?",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)

                    HStack(spacing: 10) {
                        HStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 13.5))
                                .foregroundStyle(palette.mutedInk)
                            TextField(
                                OttlineStrings.tr("제목 검색", "Search title", locale: locale),
                                text: $searchQuery
                            )
                            .font(OttlineFont.regular(14))
                            .foregroundStyle(palette.ink)

                            if !searchQuery.isEmpty {
                                Button {
                                    searchQuery = ""
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(palette.mutedInk)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 12)
                        .frame(minHeight: 38)
                        .background(palette.background)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )

                        HStack(spacing: 6) {
                            Text(OttlineStrings.tr("정렬", "Sort", locale: locale))
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)

                            Menu {
                                Button(OttlineStrings.tr("최신", "Latest", locale: locale)) {
                                    sortMode = "latest"
                                }
                                Button(OttlineStrings.tr("댓글 많은 순", "Most Comments", locale: locale)) {
                                    sortMode = "comments"
                                }
                            } label: {
                                HStack(spacing: 4) {
                                    Text(sortMode == "comments"
                                        ? OttlineStrings.tr("댓글 많은 순", "Most Comments", locale: locale)
                                        : OttlineStrings.tr("최신", "Latest", locale: locale)
                                    )
                                    .font(OttlineFont.medium(13))
                                    .foregroundStyle(palette.ink)
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.system(size: 10))
                                        .foregroundStyle(palette.mutedInk)
                                }
                                .padding(.horizontal, 10)
                                .frame(minHeight: 38)
                                .background(palette.background)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(12)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }

                // 4. Discussion List (`DiscussionList.tsx` with `showReactions=true`)
                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 36)
                } else if discussions.isEmpty {
                    Text(OttlineStrings.tr("아직 공개된 이야기가 없어요.", "No stories shared yet.", locale: locale))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 12)
                } else {
                    VStack(spacing: 8) {
                        ForEach(discussions) { disc in
                            discussionRowCard(disc)
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 20)
            .padding(.bottom, 36)
        }
        .background(palette.background)
        .task(id: "\(searchQuery)-\(sortMode)") {
            await loadTogetherFeeds()
        }
    }

    private func discussionRowCard(_ disc: DiscussionListItem) -> some View {
        let currentReactions = reactionOverrides[disc.titleId] ?? disc.reactions ?? []
        return VStack(alignment: .leading, spacing: 10) {
            Button {
                onOpenTitleDetail(disc.titleId)
            } label: {
                HStack(spacing: 12) {
                    PosterImage(
                        posterUrl: disc.posterUrl,
                        titleName: disc.titleName,
                        titleType: disc.titleType,
                        width: 48,
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
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(RecordDate.formatShortMonthDay(disc.latestCommentAt, locale: locale))
                            .font(OttlineFont.regular(11.5))
                            .foregroundStyle(palette.mutedInk)
                        Text(locale == "en" ? "\(disc.commentCount) comments" : "\(disc.commentCount)개의 이야기들")
                            .font(OttlineFont.semiBold(12))
                            .foregroundStyle(palette.primaryAccent)
                    }
                }
            }
            .buttonStyle(.plain)

            // 3 Reaction Chips (`DiscussionReactionButtons.tsx` parity)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(DiscussionReactionType.allCases, id: \.self) { rType in
                        let item = currentReactions.first { $0.type == rType }
                        let count = item?.count ?? 0
                        let active = item?.viewerReacted ?? false
                        Button {
                            Task { await toggleReaction(disc: disc, type: rType) }
                        } label: {
                            HStack(spacing: 5) {
                                Text(OttlineStrings.reactionLabel(rType, titleType: disc.titleType, locale: locale))
                                    .font(active ? OttlineFont.semiBold(12) : OttlineFont.regular(12))
                                if count > 0 {
                                    Text("\(count)")
                                        .font(OttlineFont.semiBold(11.5))
                                }
                            }
                            .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(active ? palette.paperStrong : palette.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(active ? palette.primaryAccent : palette.border, lineWidth: 1)
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
            curatedItems = (try? await repository.api.getCuratedDiscussions(limit: 4)) ?? []
        }
        let wireSort = sortMode == "comments" ? "popular" : "recent"
        discussions = (try? await repository.api.getDiscussionsLatest(
            limit: 50,
            days: nil,
            query: searchQuery,
            typeFilter: "all",
            sort: wireSort
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
