import SwiftUI

public struct TitleDetailScreen: View {
    public let titleId: String
    public let repository: OttlineRepository
    public var onBack: () -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onReportUgc: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var remoteTitle: Title?
    @State private var historyItems: [WatchLogHistoryItem] = []
    @State private var comments: [TitleCommentItem] = []
    @State private var reactions: [DiscussionReactionItem] = []
    @State private var commentText: String = ""
    @State private var submittingComment: Bool = false

    // `@` Title Mention state
    @State private var mentionQuery: String = ""
    @State private var mentionResults: [TitleSearchItem] = []
    @State private var selectedMentions: [MentionCandidateDto] = []
    @State private var showMentionSearch: Bool = false

    @State private var shareCardLog: WatchLog?

    public var body: some View {
        let localLog = repository.logs.first { $0.title.id == titleId }
        let title = localLog?.title ?? repository.db.getTitleById(titleId) ?? remoteTitle

        VStack(spacing: 0) {
            // Top bar
            HStack {
                Button(action: onBack) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                        Text(OttlineStrings.tr("뒤로", "Back", locale: locale))
                            .font(OttlineFont.medium(15))
                    }
                    .foregroundStyle(palette.ink)
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(palette.background)

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if let title {
                        // 1. Title Hero
                        HStack(alignment: .top, spacing: 16) {
                            PosterImage(
                                posterUrl: localLog?.seasonPosterUrl ?? title.posterUrl,
                                titleName: title.name,
                                titleType: title.type,
                                width: 96,
                                height: 142
                            )
                            VStack(alignment: .leading, spacing: 6) {
                                Text(OttlineStrings.titleTypeLabel(title.type, locale: locale))
                                    .font(OttlineFont.semiBold(12))
                                    .foregroundStyle(palette.primaryAccent)
                                Text(title.name)
                                    .font(OttlineFont.semiBold(21))
                                    .foregroundStyle(palette.ink)
                                if let year = localLog?.seasonYear ?? title.year {
                                    Text(String(year))
                                        .font(OttlineFont.regular(13))
                                        .foregroundStyle(palette.mutedInk)
                                }
                                if let author = title.author, !author.isEmpty {
                                    Text(author)
                                        .font(OttlineFont.regular(13))
                                        .foregroundStyle(palette.mutedInk)
                                }
                                if let genres = title.genres, !genres.isEmpty {
                                    Text(genres.joined(separator: " · "))
                                        .font(OttlineFont.regular(12.5))
                                        .foregroundStyle(palette.mutedInk)
                                }
                            }
                            Spacer()
                        }

                        if let overview = title.overview?.trimmingCharacters(in: .whitespacesAndNewlines), !overview.isEmpty {
                            Text(overview)
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.mutedInk)
                                .lineSpacing(4)
                        }

                        // 2. My Record ("그날의 온기") OR Leave Record CTA
                        if let log = localLog {
                            myRecordSection(log: log, title: title)
                        } else {
                            Button {
                                onOpenQuickRecord(
                                    QuickRecordRequest(
                                        preselectedTitle: title,
                                        selectSource: "title_detail",
                                        autoFocusSearch: false
                                    )
                                )
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus")
                                        .font(.system(size: 14, weight: .bold))
                                    Text(OttlineStrings.tr("이 작품 기록 남기기", "Keep a record for this title", locale: locale))
                                        .font(OttlineFont.semiBold(14.5))
                                }
                                .foregroundStyle(palette.onBrandOrange)
                                .frame(maxWidth: .infinity, minHeight: 46)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }

                        // 3. Revision History ("남겨온 기록")
                        if !historyItems.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(OttlineStrings.tr("남겨온 기록", "Records along the way", locale: locale))
                                    .font(OttlineFont.semiBold(16))
                                    .foregroundStyle(palette.ink)
                                Text(OttlineStrings.tr(
                                    "기록을 고칠 때마다 그때의 모습이 차곡차곡 남아요.",
                                    "Each edit keeps a record of how it looked at the time.",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(12.5))
                                .foregroundStyle(palette.mutedInk)

                                ForEach(historyItems) { h in
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack {
                                            Text(OttlineStrings.statusLabel(h.status, type: title.type, locale: locale))
                                                .font(OttlineFont.semiBold(12.5))
                                                .foregroundStyle(palette.primaryAccent)
                                            Spacer()
                                            Text(RecordDate.formatDisplayDate(h.recordedAt, locale: locale))
                                                .font(OttlineFont.regular(11.5))
                                                .foregroundStyle(palette.mutedInk)
                                        }
                                        if let note = h.note, !note.isEmpty {
                                            Text(note)
                                                .font(OttlineFont.regular(13))
                                                .foregroundStyle(palette.ink)
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
                            }
                        }

                        // 4. Reactions & Together Comments (`CommentsSection.tsx` parity)
                        togetherCommentsSection(title: title)
                    } else {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 48)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 36)
            }
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
        .task(id: titleId) {
            await loadTitleDetailData()
        }
        .task(id: mentionQuery) {
            await searchMentionCandidates()
        }
    }

    private func myRecordSection(log: WatchLog, title: Title) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(OttlineStrings.tr("내 기록", "My record", locale: locale))
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.primaryAccent)
                Spacer()
                Text(RecordDate.formatDisplayDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
            }

            Text(OttlineStrings.tr(
                "바꾸고 싶은 내용을 고치면 지난 기록도 함께 남아요.",
                "Change what you need. Your earlier records stay here too.",
                locale: locale
            ))
            .font(OttlineFont.regular(12.5))
            .foregroundStyle(palette.mutedInk)

            HStack(spacing: 8) {
                Text(OttlineStrings.statusLabel(log.status, type: title.type, locale: locale))
                    .font(OttlineFont.semiBold(13.5))
                    .foregroundStyle(palette.ink)
                RecordFeelingBadge(rating: log.rating, isBook: title.type == .book, compact: false)
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
                    .font(OttlineFont.regular(13))
                    .foregroundStyle(palette.mutedInk)
            }

            if let note = log.note, !note.isEmpty {
                Text("“\(note)”")
                    .font(OttlineFont.regular(14.5))
                    .foregroundStyle(palette.ink)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            HStack(spacing: 10) {
                Button {
                    onOpenQuickRecord(QuickRecordRequest(existingLog: log, autoFocusSearch: false))
                } label: {
                    Text(OttlineStrings.tr("수정하기", "Save changes", locale: locale))
                        .font(OttlineFont.semiBold(13.5))
                        .foregroundStyle(palette.ink)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button {
                    shareCardLog = log
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "square.and.arrow.up")
                        Text(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                            .font(OttlineFont.semiBold(13.5))
                    }
                    .foregroundStyle(palette.primaryAccent)
                    .frame(maxWidth: .infinity, minHeight: 42)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.primaryAccent, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
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

    private func togetherCommentsSection(title: Title) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(OttlineStrings.tr("함께 기록", "Together Records", locale: locale))
                    .font(OttlineFont.semiBold(17))
                    .foregroundStyle(palette.ink)
                Text(OttlineStrings.tr(
                    "한 줄 남기면 내 타임라인에도 함께 기록돼요.",
                    "Leave a line and it becomes part of your timeline too.",
                    locale: locale
                ))
                .font(OttlineFont.regular(12.5))
                .foregroundStyle(palette.mutedInk)
            }

            // 3 Reaction Chips (`나도 봤어요/읽었어요`, `궁금해요`, `저장해둘래요`)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(DiscussionReactionType.allCases, id: \.self) { rType in
                        let item = reactions.first { $0.type == rType }
                        let count = item?.count ?? 0
                        let active = item?.viewerReacted ?? false
                        Button {
                            Task { await handleReactionTap(rType, title: title) }
                        } label: {
                            HStack(spacing: 5) {
                                Text(OttlineStrings.reactionLabel(rType, titleType: title.type, locale: locale))
                                    .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                                if count > 0 {
                                    Text("\(count)")
                                        .font(OttlineFont.semiBold(12))
                                }
                            }
                            .foregroundStyle(active ? palette.onBrandNavy : palette.ink)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
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

            // Comment Composer + `@` Title Mention
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    TextField(
                        OttlineStrings.tr("이 작품에 대한 한 줄을 남겨주세요.", "Leave a line about this title.", locale: locale),
                        text: $commentText,
                        axis: .vertical
                    )
                    .lineLimit(1...4)
                    .font(OttlineFont.regular(14))
                    .padding(10)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                    Button {
                        showMentionSearch.toggle()
                    } label: {
                        Text("@")
                            .font(OttlineFont.bold(15))
                            .foregroundStyle(palette.primaryAccent)
                            .frame(width: 36, height: 38)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)

                    Button {
                        Task { await submitComment(title: title) }
                    } label: {
                        Text(OttlineStrings.tr("댓글 등록", "Post Comment", locale: locale))
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(palette.onBrandNavy)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(palette.brandNavy)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .disabled(commentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || submittingComment)
                }

                if !selectedMentions.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(selectedMentions, id: \.providerId) { m in
                                HStack(spacing: 4) {
                                    Text("@\(m.name)")
                                        .font(OttlineFont.medium(12))
                                    Button {
                                        selectedMentions.removeAll { $0.providerId == m.providerId }
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 10))
                                    }
                                    .buttonStyle(.plain)
                                }
                                .foregroundStyle(palette.primaryAccent)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                        }
                    }
                }

                if showMentionSearch {
                    VStack(alignment: .leading, spacing: 6) {
                        TextField(
                            OttlineStrings.tr("함께 언급할 작품 검색", "Search title to mention", locale: locale),
                            text: $mentionQuery
                        )
                        .font(OttlineFont.regular(13))
                        .padding(8)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                        ForEach(mentionResults.prefix(4)) { mItem in
                            Button {
                                let candidate = MentionCandidateDto(
                                    provider: mItem.provider,
                                    providerId: mItem.providerId,
                                    type: mItem.type,
                                    name: mItem.name,
                                    year: mItem.year,
                                    posterUrl: mItem.posterUrl,
                                    overview: mItem.overview
                                )
                                if !selectedMentions.contains(where: { $0.providerId == candidate.providerId }) {
                                    selectedMentions.append(candidate)
                                }
                                showMentionSearch = false
                                mentionQuery = ""
                            } label: {
                                Text("\(mItem.name) (\(OttlineStrings.titleTypeLabel(mItem.type, locale: locale)))")
                                    .font(OttlineFont.medium(13))
                                    .foregroundStyle(palette.ink)
                                    .padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(10)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            // Comment List
            ForEach(comments) { c in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        let isCurator = c.authorName.contains("큐레이터") || c.authorName.lowercased().contains("curator")
                        Text(c.authorName)
                            .font(OttlineFont.semiBold(13))
                            .foregroundStyle(isCurator ? palette.primaryAccent : palette.ink)
                        if isCurator {
                            Text(OttlineStrings.tr("AI 운영 계정", "AI Curator", locale: locale))
                                .font(OttlineFont.medium(10.5))
                                .foregroundStyle(palette.primaryAccent)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                        Spacer()
                        Button {
                            onReportUgc("[\(title.name)] 댓글 신고 (\(c.id)): \(c.body)")
                        } label: {
                            Text(OttlineStrings.tr("신고", "Report", locale: locale))
                                .font(OttlineFont.regular(11.5))
                                .foregroundStyle(palette.subtleInk)
                        }
                        .buttonStyle(.plain)
                    }
                    Text(c.body)
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.ink)

                    if let mentioned = c.mentionedTitles, !mentioned.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(mentioned, id: \.titleId) { mt in
                                    Button {
                                        onOpenTitleDetail(mt.titleId)
                                    } label: {
                                        Text("@\(mt.name)")
                                            .font(OttlineFont.medium(12))
                                            .foregroundStyle(palette.primaryAccent)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(palette.paperStrong)
                                            .clipShape(RoundedRectangle(cornerRadius: 6))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
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
        }
    }

    // MARK: - Actions

    private func loadTitleDetailData() async {
        if let localLog = repository.logs.first(where: { $0.title.id == titleId }) {
            let localHist = repository.db.getHistoryForLog(localLog.id)
            historyItems = localHist
            if let remoteHist = try? await repository.api.getLogHistory(logId: localLog.id), !remoteHist.isEmpty {
                historyItems = remoteHist
            }
        }
        if let fetched = try? await repository.api.getTitleById(id: titleId) {
            remoteTitle = fetched
        }
        if let resp = try? await repository.api.getComments(titleId: titleId, limit: 30) {
            comments = resp.comments
        }
    }

    private func handleReactionTap(_ type: DiscussionReactionType, title: Title) async {
        _ = try? await repository.ensureAuthenticated()
        if let summary = try? await repository.api.toggleDiscussionReaction(titleId: title.id, type: type) {
            reactions = summary.items
            if type == .bookmark,
               summary.items.first(where: { $0.type == .bookmark })?.viewerReacted == true,
               repository.db.getActiveLogsByTitleId(title.id).isEmpty {
                _ = await repository.saveLogForTitle(
                    candidateTitle: title,
                    draft: LogDraft(status: .wishlist, watchedAt: RecordDate.nowIso()),
                    source: "together_bookmark_reaction"
                )
            }
        }
    }

    private func submitComment(title: Title) async {
        let trimmed = commentText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !submittingComment else { return }
        submittingComment = true
        _ = try? await repository.ensureAuthenticated()
        if let created = try? await repository.api.createComment(
            titleId: title.id,
            payload: CreateCommentRequest(
                body: trimmed,
                authorName: repository.prefs.snapshot.nickname,
                userId: repository.prefs.snapshot.userId,
                syncToLog: true,
                mentions: selectedMentions
            )
        ) {
            comments.insert(created, at: 0)
            commentText = ""
            selectedMentions = []
        }
        submittingComment = false
    }

    private func searchMentionCandidates() async {
        let q = mentionQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else {
            mentionResults = []
            return
        }
        try? await Task.sleep(nanoseconds: 250_000_000)
        if Task.isCancelled { return }
        mentionResults = (try? await repository.api.searchTitles(query: q, typeFilter: nil)) ?? []
    }
}
