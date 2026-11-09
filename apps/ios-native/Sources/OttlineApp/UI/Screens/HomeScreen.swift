import SwiftUI

public struct HomeScreen: View {
    public let repository: OttlineRepository
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenTimeline: () -> Void
    public var onOpenTogether: () -> Void
    public var onOpenReport: () -> Void
    public var onOpenBookshelf: () -> Void
    public var onOpenTimelineWithMoment: (Place?, Occasion?) -> Void
    public var onOpenMySpacePairing: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var discussions: [DiscussionListItem] = []
    @State private var trendingTitles: [TitleSearchItem] = []
    @State private var activationPopularTitles: [TitleSearchItem] = []
    @State private var discussionsLoading: Bool = true
    @State private var activationTab: String = "video"
    @State private var activationDismissed: Bool = false
    @State private var shareCardLog: WatchLog?

    private let homeDiscussionLimit = 6

    public var body: some View {
        let logs = repository.logs
        let prefsSnapshot = repository.prefs.snapshot
        let availableMonths = TimelineMoments.availableMonths(logs)
        let selectedMonth = availableMonths.contains(prefsSnapshot.homeSelectedMonth)
            ? prefsSnapshot.homeSelectedMonth
            : (availableMonths.first ?? RecordDate.monthKey(nil))
        let monthLogs = logs.filter {
            RecordDate.monthKey($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt) == selectedMonth
        }
        let featuredMemory = monthLogs.first(where: { $0.status == .done })
        let monthEntryLogs = monthLogs.filter { $0.id != featuredMemory?.id }
        let inProgressLogs = Array(logs.filter { $0.status == .inProgress }.prefix(4))
        let frequentPlaces = TimelineMoments.frequentPlaces(logs, limit: 3)
        let frequentOccasions = TimelineMoments.frequentOccasions(logs, limit: 3)
        let hasBookLogs = logs.contains { $0.title.type == .book }

        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                // 1. Editorial Header (`HomeTimelineView.tsx` parity)
                VStack(alignment: .leading, spacing: 8) {
                    Text(OttlineStrings.tr("나의 타임라인", "MY TIMELINE", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.88)
                        .foregroundStyle(palette.mutedInk)

                    Text(logs.isEmpty
                        ? OttlineStrings.tr("나의 타임라인에 첫 순간을 남겨요.", "Your timeline. Your first moment.", locale: locale)
                        : OttlineStrings.tr("내 시간 위에 쌓인 이야기", "Stories on your timeline", locale: locale)
                    )
                    .font(OttlineFont.semiBold(25))
                    .kerning(-0.7)
                    .foregroundStyle(palette.ink)

                    Rectangle()
                        .fill(palette.border)
                        .frame(height: 1)
                        .padding(.top, 2)

                    HStack(alignment: .center) {
                        Text(RecordDate.formatHomeToday(locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                        Spacer()
                        if !logs.isEmpty {
                            Button {
                                onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus")
                                        .font(.system(size: 13, weight: .bold))
                                    Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                }
                                .foregroundStyle(palette.onBrandOrange)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 40)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 2)
                }

                // 2. Sync Notice Banner (`HomeTimelineView.tsx` `.syncNotice` parity)
                if repository.outboxCount > 0 || repository.syncState.status != .idle {
                    SyncNoticeBanner(
                        syncState: repository.syncState,
                        outboxCount: repository.outboxCount,
                        onRetryTap: { repository.triggerSyncAsync() }
                    )
                }

                // 3. Empty State vs Logged State
                if logs.isEmpty {
                    emptyWelcomeSection
                    if (prefsSnapshot.pairingCode ?? "").isEmpty && !activationDismissed {
                        firstLogActivationPanel
                    }
                } else {
                    // Month Selector (`HomeTimelineView.tsx` `.months`)
                    if !availableMonths.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(availableMonths, id: \.self) { mk in
                                    let selected = mk == selectedMonth
                                    Button {
                                        repository.prefs.setHomeSelectedMonth(mk)
                                    } label: {
                                        HStack(spacing: 6) {
                                            Text(RecordDate.formatMonthYearPart(mk))
                                                .font(OttlineFont.regular(11))
                                                .foregroundStyle(palette.mutedInk)
                                            Text(RecordDate.formatMonthShortPart(mk, locale: locale))
                                                .font(selected ? OttlineFont.semiBold(14) : OttlineFont.medium(14))
                                                .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                        }
                                        .padding(.horizontal, 12)
                                        .frame(minHeight: 38)
                                        .background(selected ? palette.card : Color.clear)
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
                    }

                    // Order 0 (Mobile CSS): Featured Memory Card (`그날의 온기` / `A moment kept`)
                    if let featured = featuredMemory {
                        featuredMemoryCard(featured)
                    } else {
                        emptyCompletedMonthCard
                    }

                    // Order 1 (Mobile CSS): `.homeSide` (`아직 못다 한 이야기` + Side Links)
                    VStack(alignment: .leading, spacing: 14) {
                        if !inProgressLogs.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text(OttlineStrings.tr("아직 못다 한 이야기", "Stories still unfolding", locale: locale))
                                    .font(OttlineFont.semiBold(18))
                                    .foregroundStyle(palette.ink)

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 16) {
                                        ForEach(inProgressLogs) { item in
                                            Button {
                                                onOpenQuickRecord(QuickRecordRequest(existingLog: item, autoFocusSearch: false))
                                            } label: {
                                                HStack(alignment: .top, spacing: 12) {
                                                    PosterImage(
                                                        posterUrl: item.seasonPosterUrl ?? item.title.posterUrl,
                                                        titleName: item.title.name,
                                                        titleType: item.title.type,
                                                        width: 56,
                                                        height: 84
                                                    )
                                                    VStack(alignment: .leading, spacing: 4) {
                                                        Text(OttlineStrings.statusLabel(item.status, type: item.title.type, locale: locale))
                                                            .font(OttlineFont.regular(12))
                                                            .foregroundStyle(palette.mutedInk)
                                                        Text(item.title.name)
                                                            .font(OttlineFont.semiBold(15))
                                                            .foregroundStyle(palette.ink)
                                                            .lineLimit(2)
                                                            .multilineTextAlignment(.leading)
                                                        Text(OttlineStrings.tr("이어 적기 →", "Keep going →", locale: locale))
                                                            .font(OttlineFont.semiBold(12.5))
                                                            .foregroundStyle(palette.primaryAccent)
                                                            .padding(.top, 2)
                                                    }
                                                    .frame(width: 155, alignment: .leading)
                                                }
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                            }
                            .padding(.bottom, 6)
                            .overlay(alignment: .bottom) {
                                Rectangle().fill(palette.border).frame(height: 1)
                            }
                        }

                        // Side link 1: `쌓아온 시간 돌아보기`
                        Button(action: onOpenReport) {
                            HStack(spacing: 10) {
                                Image(systemName: "clock")
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(palette.primaryAccent)
                                Text(OttlineStrings.tr("쌓아온 시간 돌아보기", "Look back on your time", locale: locale))
                                    .font(OttlineFont.semiBold(14.5))
                                    .foregroundStyle(palette.ink)
                                Spacer()
                                Text("→")
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .padding(.horizontal, 14)
                            .frame(minHeight: 46)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)

                        // Side link 2: `내 서가 펼치기` (KO + has book logs)
                        if hasBookLogs && locale == "ko" {
                            Button(action: onOpenBookshelf) {
                                HStack(spacing: 10) {
                                    Image(systemName: "book")
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundStyle(palette.primaryAccent)
                                    Text("내 서가 펼치기")
                                        .font(OttlineFont.semiBold(14.5))
                                        .foregroundStyle(palette.ink)
                                    Spacer()
                                    Text("→")
                                        .font(OttlineFont.semiBold(14))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .padding(.horizontal, 14)
                                .frame(minHeight: 46)
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

                    // Order 2 (Mobile CSS): `.monthEntries` (`이 달에 남긴 시간` / `Moments this month`)
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(RecordDate.formatMonthLabel(selectedMonth, locale: locale))
                                    .font(OttlineFont.medium(11))
                                    .kerning(0.7)
                                    .foregroundStyle(palette.mutedInk)
                                Text(OttlineStrings.tr("이 달에 남긴 시간", "Moments this month", locale: locale))
                                    .font(OttlineFont.semiBold(18))
                                    .foregroundStyle(palette.ink)
                            }
                            Spacer()
                            Button(action: onOpenTimeline) {
                                Text(OttlineStrings.tr("타임라인 →", "Timeline →", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .buttonStyle(.plain)
                        }

                        if monthEntryLogs.isEmpty {
                            Text(OttlineStrings.tr("이 달에 남겨둔 순간이에요.", "A moment you kept this month.", locale: locale))
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.mutedInk)
                        } else {
                            VStack(spacing: 0) {
                                ForEach(Array(monthEntryLogs.enumerated()), id: \.element.id) { idx, item in
                                    if idx > 0 {
                                        Rectangle()
                                            .fill(palette.border)
                                            .frame(height: 1)
                                    }
                                    monthEntryRow(item)
                                }
                            }
                        }
                    }
                    .padding(.top, 16)
                    .overlay(alignment: .top) {
                        Rectangle().fill(palette.border).frame(height: 1)
                    }

                    // Order 3 (Mobile CSS): `.momentRevisit` (`다시 만나는 그날` / `BACK TO A MOMENT`)
                    if !frequentPlaces.isEmpty || !frequentOccasions.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(OttlineStrings.tr("다시 만나는 그날", "BACK TO A MOMENT", locale: locale))
                                    .font(OttlineFont.medium(11))
                                    .kerning(0.7)
                                    .foregroundStyle(palette.mutedInk)
                                Text(OttlineStrings.tr("어떤 순간을 펼쳐볼까요?", "Which moments will you revisit?", locale: locale))
                                    .font(OttlineFont.semiBold(18))
                                    .foregroundStyle(palette.ink)
                                Text(OttlineStrings.tr(
                                    "이 기기에 모아둔 기록에서 그날의 순간을 다시 만나요.",
                                    "Revisit moments from the records kept on this device.",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.mutedInk)
                            }

                            VStack(spacing: 8) {
                                ForEach(frequentPlaces, id: \.0) { place, count in
                                    Button {
                                        onOpenTimelineWithMoment(place, nil)
                                    } label: {
                                        HStack(spacing: 8) {
                                            Image(systemName: "mappin.and.ellipse")
                                                .font(.system(size: 14))
                                                .foregroundStyle(palette.primaryAccent)
                                            Text(OttlineStrings.placeLabel(place, locale: locale))
                                                .font(OttlineFont.semiBold(14.5))
                                                .foregroundStyle(palette.ink)
                                            Spacer()
                                            Text(locale == "en" ? "\(count)" : "\(count)개")
                                                .font(OttlineFont.regular(13))
                                                .foregroundStyle(palette.mutedInk)
                                            Text("→")
                                                .font(OttlineFont.semiBold(13.5))
                                                .foregroundStyle(palette.primaryAccent)
                                        }
                                        .padding(.horizontal, 14)
                                        .frame(minHeight: 46)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(palette.border, lineWidth: 1)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }

                                ForEach(frequentOccasions, id: \.0) { occ, count in
                                    Button {
                                        onOpenTimelineWithMoment(nil, occ)
                                    } label: {
                                        HStack(spacing: 8) {
                                            Image(systemName: "person.2")
                                                .font(.system(size: 14))
                                                .foregroundStyle(palette.primaryAccent)
                                            Text(OttlineStrings.occasionLabel(occ, locale: locale))
                                                .font(OttlineFont.semiBold(14.5))
                                                .foregroundStyle(palette.ink)
                                            Spacer()
                                            Text(locale == "en" ? "\(count)" : "\(count)개")
                                                .font(OttlineFont.regular(13))
                                                .foregroundStyle(palette.mutedInk)
                                            Text("→")
                                                .font(OttlineFont.semiBold(13.5))
                                                .foregroundStyle(palette.primaryAccent)
                                        }
                                        .padding(.horizontal, 14)
                                        .frame(minHeight: 46)
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
                        .padding(.top, 16)
                        .overlay(alignment: .top) {
                            Rectangle().fill(palette.border).frame(height: 1)
                        }
                    }
                }

                // 4. Together Feed + Popular Title Fillers (`app/[locale]/page.tsx` `.publicSection` parity)
                togetherSection
            }
            .padding(.horizontal, 18)
            .padding(.top, 20)
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
        .task(id: repository.logs.count) {
            await loadHomeFeeds()
        }
    }

    // MARK: - Subviews

    private var emptyWelcomeSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(OttlineStrings.tr(
                "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터.",
                "A film, a series, a book. Start with one you want to keep.",
                locale: locale
            ))
            .font(OttlineFont.regular(16))
            .foregroundStyle(palette.mutedInk)

            VStack(alignment: .leading, spacing: 10) {
                Button {
                    onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "plus")
                            .font(.system(size: 14, weight: .bold))
                        Text(OttlineStrings.tr("첫 기록 남기기", "Leave your first record", locale: locale))
                            .font(OttlineFont.semiBold(15))
                    }
                    .foregroundStyle(palette.onBrandOrange)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)

                Button(action: onOpenMySpacePairing) {
                    Text(OttlineStrings.tr("이미 남긴 기록 이어보기 →", "Bring my existing records →", locale: locale))
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.primaryAccent)
                        .frame(minHeight: 38)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - FirstLogActivationPanel (`FirstLogActivationPanel.tsx` 1:1 Parity)

    private var firstLogActivationPanel: some View {
        let videoDiscussions = discussions.filter { $0.titleType == .movie || $0.titleType == .series }
        return VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(OttlineStrings.tr("처음 남길 기록", "FIRST RECORD", locale: locale))
                        .font(OttlineFont.semiBold(11.5))
                        .foregroundStyle(palette.mutedInk)
                    Text(OttlineStrings.tr("하나만 골라볼까요?", "Pick one to start", locale: locale))
                        .font(OttlineFont.semiBold(20))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr(
                        "찾기 전에 먼저 떠오르는 것부터 가볍게 남겨보세요.",
                        "Start with whatever comes to mind before searching from scratch.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)
                }
                Spacer()
                Button {
                    activationDismissed = true
                    repository.trackEvent("activation_panel_dismiss", properties: ["contentType": activationTab])
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(palette.mutedInk)
                        .frame(width: 36, height: 36)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }

            // 2-Column Content Type Switcher (`영상` / `책`)
            HStack(spacing: 8) {
                ForEach([
                    ("video", "film", OttlineStrings.tr("영상", "Video", locale: locale)),
                    ("book", "book", OttlineStrings.tr("책", "Book", locale: locale))
                ], id: \.0) { tab, icon, label in
                    let selected = activationTab == tab
                    Button {
                        activationTab = tab
                        repository.trackEvent("activation_content_type_select", properties: ["contentType": tab])
                    } label: {
                        HStack(spacing: 7) {
                            Image(systemName: icon)
                                .font(.system(size: 15, weight: .medium))
                            Text(label)
                                .font(OttlineFont.semiBold(15))
                        }
                        .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            if activationTab == "video" {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(OttlineStrings.tr(
                            "요즘 많이 남기는 작품 중 본 게 있나요?",
                            "Have you watched any of these lately?",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)

                        Text(OttlineStrings.tr(
                            "포스터를 고르면 바로 기록하기 화면으로 이어져요.",
                            "Pick a poster and it opens the regular logging flow.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                    }

                    if !videoDiscussions.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(OttlineStrings.tr("요즘 함께 남긴 작품", "Titles people are logging", locale: locale))
                                .font(OttlineFont.semiBold(12))
                                .foregroundStyle(palette.mutedInk)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(videoDiscussions.prefix(6)) { disc in
                                        Button {
                                            activationDismissed = true
                                            let candidate = Title(
                                                id: disc.titleId,
                                                provider: disc.provider ?? .tmdb,
                                                providerId: disc.providerId,
                                                type: disc.titleType,
                                                name: disc.titleName,
                                                posterUrl: disc.posterUrl
                                            )
                                            onOpenQuickRecord(
                                                QuickRecordRequest(
                                                    preselectedTitle: candidate,
                                                    selectSource: "activation_recent",
                                                    autoFocusSearch: false
                                                )
                                            )
                                        } label: {
                                            activationPosterTile(
                                                name: disc.titleName,
                                                posterUrl: disc.posterUrl,
                                                type: disc.titleType,
                                                year: nil
                                            )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }

                    if !activationPopularTitles.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(OttlineStrings.tr("요즘 인기 작품", "Popular now", locale: locale))
                                .font(OttlineFont.semiBold(12))
                                .foregroundStyle(palette.mutedInk)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(activationPopularTitles.prefix(6)) { item in
                                        Button {
                                            activationDismissed = true
                                            onOpenQuickRecord(
                                                QuickRecordRequest(
                                                    initialQuery: item.name,
                                                    initialTypeTab: "all",
                                                    preselectedSearchItem: item,
                                                    selectSource: "activation_popular",
                                                    autoFocusSearch: false
                                                )
                                            )
                                        } label: {
                                            activationPosterTile(
                                                name: item.name,
                                                posterUrl: item.posterUrl,
                                                type: item.type,
                                                year: item.year
                                            )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }

                    Button {
                        activationDismissed = true
                        onOpenQuickRecord(QuickRecordRequest(initialTypeTab: "all", autoFocusSearch: true))
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 13.5, weight: .semibold))
                            Text(OttlineStrings.tr("다른 작품 찾기", "Find another title", locale: locale))
                                .font(OttlineFont.semiBold(14))
                        }
                        .foregroundStyle(palette.primaryAccent)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 42)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.primaryAccent.opacity(0.35), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(OttlineStrings.tr(
                            "요즘 읽고 있는 책이 있나요?",
                            "Are you reading something these days?",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)

                        Text(OttlineStrings.tr(
                            "다 읽지 않아도 괜찮아요. 상태를 고르고 제목이나 저자로 찾아보세요.",
                            "It does not need to be finished. Choose the state, then search by title or author.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                    }

                    HStack(spacing: 8) {
                        ForEach([LogStatus.inProgress, LogStatus.done, LogStatus.wishlist], id: \.self) { st in
                            Button {
                                activationDismissed = true
                                repository.trackEvent(
                                    "activation_status_select",
                                    properties: ["contentType": "book", "status": st.rawValue]
                                )
                                onOpenQuickRecord(
                                    QuickRecordRequest(
                                        initialTypeTab: "book",
                                        preferredStatus: st,
                                        autoFocusSearch: true
                                    )
                                )
                            } label: {
                                Text(OttlineStrings.statusLabel(st, type: .book, locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
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
                        }
                    }

                    Button {
                        activationDismissed = true
                        onOpenQuickRecord(
                            QuickRecordRequest(
                                initialTypeTab: "book",
                                preferredStatus: .inProgress,
                                autoFocusSearch: true
                            )
                        )
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 13.5, weight: .semibold))
                            Text(OttlineStrings.tr("책 제목이나 저자 찾기", "Search title or author", locale: locale))
                                .font(OttlineFont.semiBold(14))
                        }
                        .foregroundStyle(palette.onBrandOrange)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 44)
                        .background(palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(18)
        .background(palette.paperStrong)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func activationPosterTile(name: String, posterUrl: String?, type: TitleType, year: Int?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            PosterImage(
                posterUrl: posterUrl,
                titleName: name,
                titleType: type,
                width: 108,
                height: 158
            )
            Text(name)
                .font(OttlineFont.semiBold(13))
                .foregroundStyle(palette.ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(width: 108, alignment: .leading)
            Text([
                OttlineStrings.titleTypeLabel(type, locale: locale),
                year.map(String.init)
            ].compactMap { $0 }.joined(separator: " · "))
            .font(OttlineFont.regular(11.5))
            .foregroundStyle(palette.mutedInk)
            .frame(width: 108, alignment: .leading)
        }
        .padding(8)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    // MARK: - Featured Memory Card (`HomeTimelineView.tsx` `.featuredCard` 1:1 Parity)

    private func featuredMemoryCard(_ log: WatchLog) -> some View {
        let displayYear = log.seasonYear ?? log.title.year
        let creator: String? = log.title.type == .book
            ? log.title.author
            : (log.title.directors?.isEmpty == false ? log.title.directors?.joined(separator: ", ") : nil)
        let edition: String? = {
            if log.title.type == .book {
                let parts = [log.title.publisher, log.title.pubdate?.prefix(4).description].compactMap { $0 }.filter { !$0.isEmpty }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            } else {
                let parts = [
                    log.seasonNumber.map { locale == "en" ? "Season \($0)" : "시즌 \($0)" },
                    log.episodeNumber.map { locale == "en" ? "Ep \($0)" : "\($0)화" }
                ].compactMap { $0 }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            }
        }()

        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Text(OttlineStrings.tr("그날의 온기", "A moment kept", locale: locale))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
                Text(RecordDate.formatFeaturedDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale))
                    .font(OttlineFont.semiBold(13.5))
                    .foregroundStyle(palette.ink)
                Rectangle()
                    .fill(palette.border)
                    .frame(height: 1)
            }

            HStack(alignment: .top, spacing: 16) {
                Button {
                    onOpenTitleDetail(log.title.id)
                } label: {
                    PosterImage(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type,
                        width: 100,
                        height: 150
                    )
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 7) {
                    Text([
                        OttlineStrings.titleTypeLabel(log.title.type, locale: locale),
                        displayYear.map(String.init)
                    ].compactMap { $0 }.joined(separator: " · "))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)

                    Button {
                        onOpenTitleDetail(log.title.id)
                    } label: {
                        Text(log.title.name)
                            .font(OttlineFont.semiBold(20))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    .buttonStyle(.plain)

                    if let creator, !creator.isEmpty {
                        Text(creator)
                            .font(OttlineFont.regular(13))
                            .foregroundStyle(palette.mutedInk)
                    }

                    HStack(spacing: 8) {
                        Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                            .font(OttlineFont.semiBold(13))
                            .foregroundStyle(palette.primaryAccent)
                        RecordFeelingBadge(rating: log.rating, isBook: log.title.type == .book, compact: true)
                    }

                    if let edition {
                        Text(edition)
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                    }

                    let momentParts = [
                        log.ott,
                        log.place.map { OttlineStrings.placeLabel($0, locale: locale) },
                        log.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) }
                    ].compactMap { $0 }.filter { !$0.isEmpty }

                    if !momentParts.isEmpty {
                        Text(momentParts.joined(separator: " · "))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                    }

                    if !log.spoiler, let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                        HStack(spacing: 10) {
                            Rectangle()
                                .fill(palette.border)
                                .frame(width: 2)
                            Text(note)
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.ink)
                                .lineLimit(4)
                                .multilineTextAlignment(.leading)
                        }
                        .padding(.vertical, 2)
                    }

                    HStack(spacing: 12) {
                        Button {
                            onOpenTitleDetail(log.title.id)
                        } label: {
                            Text(OttlineStrings.tr("이 기록 펼치기 →", "Open this memory →", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .buttonStyle(.plain)

                        Spacer()

                        Button {
                            shareCardLog = log
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(palette.mutedInk)
                                .frame(width: 36, height: 36)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                    }
                    .padding(.top, 4)
                }
            }
        }
        .padding(18)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private var emptyCompletedMonthCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(OttlineStrings.tr("그날의 온기", "A moment kept", locale: locale))
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)

            Text(OttlineStrings.tr(
                "다 본·읽은 이야기는 이곳에 모아둘게요.",
                "Stories you finish watching or reading will gather here.",
                locale: locale
            ))
            .font(OttlineFont.semiBold(18))
            .foregroundStyle(palette.ink)

            Text(OttlineStrings.tr(
                "이어가는 이야기와 아껴둔 작품은 타임라인에서 함께 볼 수 있어요.",
                "Your ongoing stories and saved titles are together on your timeline.",
                locale: locale
            ))
            .font(OttlineFont.regular(14))
            .foregroundStyle(palette.mutedInk)

            Button(action: onOpenTimeline) {
                Text(OttlineStrings.tr("내 타임라인 펼치기 →", "Open your timeline →", locale: locale))
                    .font(OttlineFont.semiBold(13.5))
                    .foregroundStyle(palette.primaryAccent)
                    .padding(.top, 4)
            }
            .buttonStyle(.plain)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func monthEntryRow(_ log: WatchLog) -> some View {
        let editionText: String = {
            if log.title.type == .series, let s = log.seasonNumber {
                let ep = log.episodeNumber.map { locale == "en" ? " · Ep \($0)" : " · \($0)화" } ?? ""
                return (locale == "en" ? "Season \(s)" : "시즌 \(s)") + ep
            }
            return OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale)
        }()

        return Button {
            onOpenTitleDetail(log.title.id)
        } label: {
            HStack(spacing: 12) {
                Text(RecordDate.formatShortMonthDay(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale))
                    .font(OttlineFont.regular(12.5))
                    .foregroundStyle(palette.mutedInk)
                    .frame(width: 58, alignment: .leading)

                PosterImage(
                    posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                    titleName: log.title.name,
                    titleType: log.title.type,
                    width: 36,
                    height: 54
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(log.title.name)
                        .font(OttlineFont.semiBold(14.5))
                        .foregroundStyle(palette.ink)
                        .lineLimit(1)
                    Text(editionText)
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                        .lineLimit(1)
                }

                Spacer()

                Text("→")
                    .font(OttlineFont.regular(13))
                    .foregroundStyle(palette.mutedInk)
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bottom Public Section (`app/[locale]/page.tsx` + `DiscussionList.tsx` 1:1 Parity)

    private var togetherSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(OttlineStrings.tr("함께", "TOGETHER", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.7)
                        .foregroundStyle(palette.mutedInk)
                    HStack(spacing: 6) {
                        Image(systemName: "bubble.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(palette.ink)
                        Text(OttlineStrings.tr("함께 만나는 이야기", "Stories to share", locale: locale))
                            .font(OttlineFont.semiBold(18))
                            .foregroundStyle(palette.ink)
                    }
                }
                Spacer()
                Button(action: onOpenTogether) {
                    Text(OttlineStrings.tr("전체 보기 →", "View all →", locale: locale))
                        .font(OttlineFont.semiBold(13.5))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }

            if discussionsLoading {
                ProgressView()
                    .padding(.vertical, 16)
            } else {
                VStack(spacing: 8) {
                    ForEach(discussions.prefix(homeDiscussionLimit)) { disc in
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
                            .padding(14)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    ForEach(trendingTitles) { trend in
                        Button {
                            onOpenQuickRecord(
                                QuickRecordRequest(
                                    initialQuery: trend.name,
                                    initialTypeTab: "all",
                                    preselectedSearchItem: trend,
                                    selectSource: "home_popular_filler",
                                    autoFocusSearch: false
                                )
                            )
                        } label: {
                            HStack(spacing: 12) {
                                PosterImage(
                                    posterUrl: trend.posterUrl,
                                    titleName: trend.name,
                                    titleType: trend.type,
                                    width: 48,
                                    height: 64
                                )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(trend.name)
                                        .font(OttlineFont.semiBold(15))
                                        .foregroundStyle(palette.ink)
                                        .lineLimit(1)
                                    Text([
                                        OttlineStrings.titleTypeLabel(trend.type, locale: locale),
                                        trend.year.map(String.init)
                                    ].compactMap { $0 }.joined(separator: " · "))
                                    .font(OttlineFont.regular(12))
                                    .foregroundStyle(palette.mutedInk)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 4) {
                                    Text(OttlineStrings.tr("인기 작품", "Popular pick", locale: locale))
                                        .font(OttlineFont.semiBold(11))
                                        .foregroundStyle(palette.ink)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(palette.paperStrong)
                                        .clipShape(Capsule())
                                        .overlay(
                                            Capsule().stroke(palette.border, lineWidth: 1)
                                        )
                                    Text(OttlineStrings.tr("기록하기", "Record it", locale: locale))
                                        .font(OttlineFont.semiBold(12))
                                        .foregroundStyle(palette.primaryAccent)
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
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.top, 20)
        .overlay(alignment: .top) {
            Rectangle().fill(palette.border).frame(height: 1)
        }
    }

    // MARK: - Data Loading

    private func loadHomeFeeds() async {
        discussionsLoading = true
        let latest = (try? await repository.api.getDiscussionsLatest(limit: homeDiscussionLimit, days: 14)) ?? []
        discussions = latest
        let missing = max(0, homeDiscussionLimit - latest.count)
        let latestVideos = latest.filter { $0.titleType == .movie || $0.titleType == .series }
        let activationMissing = max(0, homeDiscussionLimit - latestVideos.count)

        if missing > 0 || activationMissing > 0,
           let trends = try? await repository.api.getPopularTitles(limit: homeDiscussionLimit * 2) {
            trendingTitles = TitleFallback.selectPopularTitleFillers(
                discussions: latest,
                popularTitles: trends,
                missingCount: missing
            )
            activationPopularTitles = TitleFallback.selectPopularTitleFillers(
                discussions: latestVideos,
                popularTitles: trends,
                missingCount: max(homeDiscussionLimit, activationMissing)
            )
        } else {
            trendingTitles = []
            activationPopularTitles = []
        }
        discussionsLoading = false
    }
}
