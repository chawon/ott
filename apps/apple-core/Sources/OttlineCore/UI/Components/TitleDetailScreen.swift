import SwiftUI

public struct TitleDetailScreen: View {
    public let titleId: String
    @ObservedObject public var repository: OttlineRepository
    public var onBack: () -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenShareCard: (WatchLog) -> Void
    public var onReportUgc: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    #endif

    @State private var loadedTitle: Title?
    @State private var historyItems: [WatchLogHistoryItem] = []
    @State private var loadingHistory: Bool = false

    private var matchingLogs: [WatchLog] {
        repository.logs
            .filter { $0.title.id == titleId }
            .sorted { ($0.updatedAt ?? $0.createdAt) > ($1.updatedAt ?? $1.createdAt) }
    }

    private var currentLog: WatchLog? {
        matchingLogs.first
    }

    private var resolvedTitle: Title? {
        loadedTitle ?? currentLog?.title ?? repository.db.getTitleById(titleId)
    }

    public init(
        titleId: String,
        repository: OttlineRepository,
        onBack: @escaping () -> Void,
        onOpenQuickRecord: @escaping (QuickRecordRequest) -> Void,
        onOpenTitleDetail: @escaping (String) -> Void,
        onOpenShareCard: @escaping (WatchLog) -> Void,
        onReportUgc: @escaping (String) -> Void
    ) {
        self.titleId = titleId
        self._repository = ObservedObject(wrappedValue: repository)
        self.onBack = onBack
        self.onOpenQuickRecord = onOpenQuickRecord
        self.onOpenTitleDetail = onOpenTitleDetail
        self.onOpenShareCard = onOpenShareCard
        self.onReportUgc = onReportUgc
    }

    public var body: some View {
        #if os(iOS)
        GeometryReader { detailGeo in
            let fallbackWidth: CGFloat = horizontalSizeClass == .regular ? 1024 : 390
            let liveWidth: CGFloat = detailGeo.size.width > 0 ? detailGeo.size.width : fallbackWidth
            let isRegularLayout = horizontalSizeClass == .regular && liveWidth >= 700
            let useTwoColumnSpread = horizontalSizeClass == .regular && liveWidth >= 820

            ScrollView {
                OttlineStickyFooterLayout(
                    minHeight: detailGeo.size.height,
                    topPadding: isRegularLayout ? 20 : 8,
                    bottomPadding: 24,
                    minSpacing: 20
                ) {
                    VStack(alignment: .leading, spacing: 20) {
                        topBar

                        if let title = resolvedTitle {
                            if useTwoColumnSpread {
                                HStack(alignment: .top, spacing: 28) {
                                    primaryDetailColumn(title: title)
                                        .frame(width: 360, alignment: .topLeading)

                                    secondaryDetailColumn(title: title)
                                        .frame(maxWidth: .infinity, alignment: .topLeading)
                                }
                            } else {
                                primaryDetailColumn(title: title)
                                secondaryDetailColumn(title: title)
                            }
                        } else {
                            loadingTitleView
                        }
                    }

                    OttlineAppFooter(bottomPadding: 0)
                }
                .frame(maxWidth: isRegularLayout ? 1120 : .infinity, alignment: .leading)
                .padding(.horizontal, isRegularLayout ? 28 : 16)
                .frame(maxWidth: .infinity)
            }
        }
        .ignoresSafeArea(.keyboard)
        .navigationBarBackButtonHidden(true)
        .background(palette.background)
        .task(id: titleId) {
            await loadTitleAndHistory()
        }
        #else
        GeometryReader { detailGeo in
            let useTwoColumnSpread = detailGeo.size.width >= 820

            ScrollView {
                OttlineStickyFooterLayout(
                    minHeight: detailGeo.size.height,
                    topPadding: 24,
                    bottomPadding: 28,
                    minSpacing: 20
                ) {
                    VStack(alignment: .leading, spacing: 20) {
                        topBar

                        if let title = resolvedTitle {
                            if useTwoColumnSpread {
                                HStack(alignment: .top, spacing: 28) {
                                    primaryDetailColumn(title: title)
                                        .frame(width: 400, alignment: .topLeading)

                                    secondaryDetailColumn(title: title)
                                        .frame(maxWidth: .infinity, alignment: .topLeading)
                                }
                            } else {
                                primaryDetailColumn(title: title)
                                secondaryDetailColumn(title: title)
                            }
                        } else {
                            loadingTitleView
                        }
                    }

                    OttlineAppFooter(bottomPadding: 0)
                }
                .frame(maxWidth: 1280, alignment: .leading)
                .padding(.horizontal, 32)
                .frame(maxWidth: .infinity)
            }
        }
        .background(palette.background)
        .task(id: titleId) {
            await loadTitleAndHistory()
        }
        #endif
    }

    private var loadingTitleView: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(OttlineStrings.tr("작품 정보를 불러오는 중이에요...", "Loading title...", locale: locale))
                .font(OttlineFont.regular(14))
                .foregroundStyle(palette.mutedInk)
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }

    @ViewBuilder
    private func primaryDetailColumn(title: Title) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            heroSection(title: title)

            if let log = currentLog {
                tpoDefinitionGrid(title: title, log: log)
                noteSection(log: log)
                actionSection(title: title, log: log)
            } else {
                unloggedCtaSection(title: title)
            }

            if title.provider == .google || (locale == "en" && title.type == .book) {
                GoogleBooksAttributionView()
            }
        }
    }

    @ViewBuilder
    private func secondaryDetailColumn(title: Title) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            historySection(title: title)

            CommentsPanelView(
                title: title,
                repository: repository,
                showSyncLogCheckbox: false,
                onSelectTitle: onOpenTitleDetail,
                onReportComment: onReportUgc
            )
        }
    }

    private var topBar: some View {
        HStack {
            Button(action: onBack) {
                HStack(spacing: 6) {
                    OttlineLucideIcon(kind: .arrowLeft, size: 16, color: palette.mutedInk, strokeWidth: 2)
                    Text(OttlineStrings.tr("뒤로", "Back", locale: locale))
                        .font(OttlineFont.medium(14))
                        .foregroundStyle(palette.mutedInk)
                }
                .frame(minHeight: 36)
            }
            .buttonStyle(.plain)

            Spacer()
        }
    }

    @ViewBuilder
    private func heroSection(title: Title) -> some View {
        let displayPoster = currentLog?.seasonPosterUrl ?? title.posterUrl
        let displayYear = currentLog?.seasonYear ?? title.year

        HStack(alignment: .top, spacing: 16) {
            PosterImage(
                posterUrl: displayPoster,
                titleName: title.name,
                titleType: title.type,
                width: 112,
                height: 168,
                cornerRadius: 4
            )

            VStack(alignment: .leading, spacing: 8) {
                Text(OttlineStrings.titleTypeLabel(title.type, locale: locale))
                    .font(OttlineFont.semiBold(12))
                    .foregroundStyle(palette.mutedInk)

                Text(title.name)
                    .font(OttlineFont.bold(26))
                    .foregroundStyle(palette.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if title.type == .book, let author = title.author, !author.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(author)
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                }

                detailMetaView(title: title, displayYear: displayYear)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func detailMetaView(title: Title, displayYear: Int?) -> some View {
        FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
            if let log = currentLog {
                metaBadge(
                    OttlineStrings.statusLabel(log.status, type: title.type, locale: locale),
                    highlighted: true
                )

                if let feeling = RecordFeelings.resolveFeeling(rating: log.rating, isBook: title.type == .book, locale: locale) {
                    metaBadge(feeling.label, highlighted: false)
                }

                if let season = log.seasonNumber, season > 0 {
                    let seText: String = {
                        if let episode = log.episodeNumber, episode > 0 {
                            return "S\(season) E\(episode)"
                        }
                        return "S\(season)"
                    }()
                    metaBadge(seText, highlighted: false)
                } else if let episode = log.episodeNumber, episode > 0 {
                    metaBadge("E\(episode)", highlighted: false)
                }
            }

            if let displayYear {
                Text(String(displayYear))
                    .font(OttlineFont.medium(12.5))
                    .foregroundStyle(palette.subtleInk)
                    .padding(.vertical, 3)
            }
        }
        .padding(.top, 2)
    }

    private func metaBadge(_ text: String, highlighted: Bool) -> some View {
        Text(text)
            .font(OttlineFont.semiBold(12))
            .foregroundStyle(highlighted ? palette.onBrandOrange : palette.ink)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(highlighted ? palette.brandOrange : palette.mutedBg)
            .clipShape(Capsule())
    }

    @ViewBuilder
    private func tpoDefinitionGrid(title: Title, log: WatchLog) -> some View {
        let notRecorded = OttlineStrings.tr("기록하지 않았어요", "Not recorded", locale: locale)

        let whenRaw = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
        let formattedWhen = RecordDate.formatDisplayDate(whenRaw, locale: locale)
        let whenValue = formattedWhen.isEmpty ? nil : formattedWhen

        let platformValue: String? = {
            guard let ott = log.ott?.trimmingCharacters(in: .whitespacesAndNewlines), !ott.isEmpty else {
                return nil
            }
            return ott
        }()

        let whereValue = log.place.map { OttlineStrings.placeLabel($0, locale: locale) }
        let occasionValue = log.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) }

        VStack(alignment: .leading, spacing: 14) {
            Rectangle()
                .fill(palette.border)
                .frame(height: 1)

            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 16) {
                    tpoItem(
                        label: OttlineStrings.tr("언제", "When", locale: locale),
                        value: whenValue,
                        fallback: notRecorded
                    )
                    tpoItem(
                        label: title.type == .book
                            ? OttlineStrings.tr("읽은 곳·플랫폼", "Where you got or read it", locale: locale)
                            : OttlineStrings.tr("플랫폼", "Platform", locale: locale),
                        value: platformValue,
                        fallback: notRecorded
                    )
                }

                HStack(alignment: .top, spacing: 16) {
                    tpoItem(
                        label: OttlineStrings.tr("어디서", "Where", locale: locale),
                        value: whereValue,
                        fallback: notRecorded
                    )
                    tpoItem(
                        label: OttlineStrings.tr("누구와·어떤 상황", "Who you were with or the occasion", locale: locale),
                        value: occasionValue,
                        fallback: notRecorded
                    )
                }
            }

            Rectangle()
                .fill(palette.border)
                .frame(height: 1)
        }
    }

    private func tpoItem(label: String, value: String?, fallback: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(OttlineFont.medium(12))
                .foregroundStyle(palette.subtleInk)
            Text(value ?? fallback)
                .font(OttlineFont.medium(14))
                .foregroundStyle(value != nil ? palette.ink : palette.subtleInk)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func noteSection(log: WatchLog) -> some View {
        let trimmed = log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmed.isEmpty || log.spoiler {
            VStack(alignment: .leading, spacing: 8) {
                if log.spoiler {
                    Text(OttlineStrings.tr("스포일러 포함", "Spoiler", locale: locale))
                        .font(OttlineFont.semiBold(11))
                        .foregroundStyle(palette.brandOrange)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(palette.paperStrong)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(palette.border, lineWidth: 1))
                }
                if !trimmed.isEmpty {
                    InlineNoteText(text: trimmed, fontSize: 16, preserveNewlines: true)
                        .lineSpacing(5)
                }
            }
        }
    }

    @ViewBuilder
    private func actionSection(title: Title, log: WatchLog) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            FlowLayout(horizontalSpacing: 10, verticalSpacing: 10) {
                Button {
                    onOpenQuickRecord(
                        QuickRecordRequest(
                            preselectedTitle: title,
                            preferredStatus: log.status,
                            existingLog: log,
                            prefilledPlatform: log.ott,
                            autoFocusSearch: false,
                            openNoteStage: true
                        )
                    )
                } label: {
                    HStack(spacing: 6) {
                        OttlineLucideIcon(kind: .pencil, size: 15, color: palette.ink, strokeWidth: 2)
                        Text(OttlineStrings.tr("기록 수정하기", "Edit this record", locale: locale))
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.ink)
                    }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 42)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                Button {
                    onOpenShareCard(log)
                } label: {
                    HStack(spacing: 6) {
                        OttlineLucideIcon(kind: .share2, size: 15, color: palette.onBrandOrange, strokeWidth: 2)
                        Text(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.onBrandOrange)
                    }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 42)
                    .background(palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }

            Text(OttlineStrings.tr(
                "내 기록은 직접 공개하기 전까지 나에게만 보여요.",
                "Your record stays private until you choose to share it.",
                locale: locale
            ))
            .font(OttlineFont.regular(12.5))
            .foregroundStyle(palette.subtleInk)
        }
    }

    @ViewBuilder
    private func unloggedCtaSection(title: Title) -> some View {
        Button {
            onOpenQuickRecord(
                QuickRecordRequest(
                    preselectedTitle: title,
                    autoFocusSearch: false,
                    openNoteStage: false
                )
            )
        } label: {
            HStack(spacing: 6) {
                OttlineLucideIcon(kind: .plus, size: 16, color: palette.onBrandOrange, strokeWidth: 2.2)
                Text(OttlineStrings.tr("이 작품 기록하기", "Log this title", locale: locale))
                    .font(OttlineFont.semiBold(14.5))
                    .foregroundStyle(palette.onBrandOrange)
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 44)
            .background(palette.brandOrange)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func historySection(title: Title) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Rectangle()
                .fill(palette.border)
                .frame(height: 1)
                .padding(.top, 4)

            VStack(alignment: .leading, spacing: 4) {
                Text(OttlineStrings.tr("남겨온 기록", "Records along the way", locale: locale))
                    .font(OttlineFont.bold(18))
                    .foregroundStyle(palette.ink)
                Text(OttlineStrings.tr(
                    "기록을 고칠 때마다 그때의 모습이 차곡차곡 남아요.",
                    "Each edit keeps a record of how it looked at the time.",
                    locale: locale
                ))
                .font(OttlineFont.regular(13.5))
                .foregroundStyle(palette.mutedInk)
            }

            if loadingHistory && historyItems.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 60)
            } else if historyItems.isEmpty {
                Text(OttlineStrings.tr("아직 이전 기록이 없어요.", "No earlier records yet.", locale: locale))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.subtleInk)
                    .padding(.vertical, 6)
            } else {
                VStack(spacing: 10) {
                    ForEach(historyItems, id: \.id) { item in
                        historyRowCard(title: title, item: item)
                    }
                }
            }
        }
    }

    private func historyRowCard(title: Title, item: WatchLogHistoryItem) -> some View {
        let formattedDate = RecordDate.formatDisplayDate(item.recordedAt, locale: locale)
        let feelingLabel = RecordFeelings.resolveFeeling(rating: item.rating, isBook: title.type == .book, locale: locale)?.label
        let trimmedNote = item.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(OttlineStrings.statusLabel(item.status, type: title.type, locale: locale))
                    .font(OttlineFont.semiBold(12))
                    .foregroundStyle(palette.ink)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(palette.mutedBg)
                    .clipShape(Capsule())

                if let feelingLabel {
                    Text(feelingLabel)
                        .font(OttlineFont.medium(12))
                        .foregroundStyle(palette.mutedInk)
                }

                Spacer()

                Text(formattedDate)
                    .font(OttlineFont.regular(11.5))
                    .foregroundStyle(palette.subtleInk)
            }

            let detailChips: [String] = [
                item.ott?.trimmingCharacters(in: .whitespacesAndNewlines),
                item.place.map { OttlineStrings.placeLabel($0, locale: locale) },
                item.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) }
            ].compactMap { val in
                guard let val, !val.isEmpty else { return nil }
                return val
            }

            if !detailChips.isEmpty {
                Text(detailChips.joined(separator: " · "))
                    .font(OttlineFont.regular(12.5))
                    .foregroundStyle(palette.mutedInk)
            }

            if !trimmedNote.isEmpty {
                InlineNoteText(text: trimmedNote, fontSize: 14, preserveNewlines: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func loadTitleAndHistory() async {
        var resolved = currentLog?.title ?? repository.db.getTitleById(titleId)
        loadedTitle = resolved

        if let remoteTitle = try? await repository.api.getTitleById(id: titleId) {
            resolved = remoteTitle
            loadedTitle = remoteTitle
            repository.db.upsertTitle(remoteTitle)
        }

        if let t = resolved,
           t.type != .book,
           (t.genres?.isEmpty ?? true),
           let pid = t.providerId, !pid.isEmpty,
           let meta = try? await repository.api.getTmdbMetadata(type: t.type, providerId: pid) {
            var enriched = t
            enriched.overview = meta.overview
            enriched.directors = meta.directors
            enriched.genres = meta.genres
            enriched.cast = meta.cast
            loadedTitle = enriched
            repository.db.upsertTitle(enriched)
        }

        if let log = currentLog {
            loadingHistory = true
            historyItems = repository.db.getHistoryForLog(log.id)
            if let remoteHistory = try? await repository.api.getLogHistory(logId: log.id) {
                let pendingOutbox = repository.db.getOutboxById("LOG:\(log.id)")
                repository.db.replaceHistoryForLog(
                    logId: log.id,
                    remoteItems: remoteHistory,
                    unpushedSinceIso: pendingOutbox?.updatedAt
                )
                historyItems = repository.db.getHistoryForLog(log.id)
            }
            loadingHistory = false
        }
    }
}
