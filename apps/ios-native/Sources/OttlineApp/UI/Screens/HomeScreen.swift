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
    @State private var showSingleDeviceReminder: Bool = false
    @State private var shareCardLog: WatchLog?

    private let homeDiscussionLimit = 6

    public var body: some View {
        let logs = repository.logs
        let prefsSnapshot = repository.prefs.snapshot
        let doneLogs = logs.filter { $0.status == .done }
        let availableMonths = TimelineMoments.availableMonths(doneLogs)
        let selectedMonth = availableMonths.contains(prefsSnapshot.homeSelectedMonth)
            ? prefsSnapshot.homeSelectedMonth
            : (availableMonths.first ?? RecordDate.monthKey(nil))
        let monthLogs = doneLogs.filter {
            RecordDate.monthKey($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt) == selectedMonth
        }
        let featuredMemory = monthLogs.first
        let remainingMonthLogs = Array(monthLogs.dropFirst().prefix(6))
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
                    .font(OttlineFont.semiBold(26))
                    .kerning(-0.8)
                    .foregroundStyle(palette.ink)

                    Rectangle()
                        .fill(palette.border)
                        .frame(height: 1)
                        .padding(.vertical, 4)

                    HStack {
                        Text(RecordDate.formatHomeToday(locale))
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                        Spacer()
                        if !logs.isEmpty {
                            Button {
                                onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                            } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: "plus")
                                        .font(.system(size: 12, weight: .bold))
                                    Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                                        .font(OttlineFont.semiBold(13))
                                }
                                .foregroundStyle(palette.primaryAccent)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 7)
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

                // 2. Sync Notice Banner
                if repository.outboxCount > 0 || repository.syncState.status != .idle {
                    SyncNoticeBanner(
                        syncState: repository.syncState,
                        outboxCount: repository.outboxCount,
                        onRetryTap: { repository.triggerSyncAsync() }
                    )
                }

                // 3. Single-device Recovery Card Reminder
                if showSingleDeviceReminder && !prefsSnapshot.singleDeviceCodeReminderShown {
                    singleDeviceReminderCard
                }

                // 4. Empty State vs Logged State
                if logs.isEmpty {
                    emptyWelcomeSection
                    if (prefsSnapshot.pairingCode ?? "").isEmpty && !activationDismissed {
                        firstLogActivationPanel
                    }
                } else {
                    // Month Selector
                    if !availableMonths.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(availableMonths, id: \.self) { mk in
                                    let selected = mk == selectedMonth
                                    Button {
                                        repository.prefs.setHomeSelectedMonth(mk)
                                    } label: {
                                        HStack(spacing: 5) {
                                            Text(RecordDate.formatMonthYearPart(mk))
                                                .font(OttlineFont.regular(11))
                                                .foregroundStyle(palette.mutedInk)
                                            Text(RecordDate.formatMonthShortPart(mk, locale: locale))
                                                .font(selected ? OttlineFont.semiBold(13.5) : OttlineFont.medium(13.5))
                                                .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                        }
                                        .padding(.horizontal, 11)
                                        .padding(.vertical, 6)
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

                    // Featured Memory Card ("그날의 온기")
                    if let featured = featuredMemory {
                        featuredMemoryCard(featured)
                    } else {
                        emptyCompletedMonthCard
                    }

                    // Remaining Month Logs
                    if !remainingMonthLogs.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(OttlineStrings.tr("이달에 남긴 다른 이야기", "More from this month", locale: locale))
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)

                            ForEach(remainingMonthLogs) { item in
                                compactLogRow(item)
                            }
                        }
                    }

                    // In-progress ("아직 못다 한 이야기") & Side Links
                    VStack(alignment: .leading, spacing: 16) {
                        if !inProgressLogs.isEmpty {
                            Text(OttlineStrings.tr("아직 못다 한 이야기", "Stories still unfolding", locale: locale))
                                .font(OttlineFont.semiBold(18))
                                .foregroundStyle(palette.ink)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 18) {
                                    ForEach(inProgressLogs) { item in
                                        Button {
                                            onOpenTitleDetail(item.title.id)
                                        } label: {
                                            HStack(alignment: .top, spacing: 12) {
                                                PosterImage(
                                                    posterUrl: item.seasonPosterUrl ?? item.title.posterUrl,
                                                    titleName: item.title.name,
                                                    titleType: item.title.type,
                                                    width: 54,
                                                    height: 81
                                                )
                                                VStack(alignment: .leading, spacing: 5) {
                                                    Text(OttlineStrings.statusLabel(item.status, type: item.title.type, locale: locale))
                                                        .font(OttlineFont.regular(12))
                                                        .foregroundStyle(palette.mutedInk)
                                                    Text(item.title.name)
                                                        .font(OttlineFont.semiBold(15))
                                                        .foregroundStyle(palette.ink)
                                                        .lineLimit(2)
                                                        .multilineTextAlignment(.leading)
                                                    Text(OttlineStrings.tr("이어 적기 →", "Continue →", locale: locale))
                                                        .font(OttlineFont.medium(12.5))
                                                        .foregroundStyle(palette.primaryAccent)
                                                }
                                                .frame(width: 155, alignment: .leading)
                                            }
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }

                        // Quick Side Links: Report & Bookshelf
                        VStack(alignment: .leading, spacing: 10) {
                            Button(action: onOpenReport) {
                                HStack {
                                    Text(OttlineStrings.tr("쌓아온 시간 돌아보기 (이용 리포트)", "Look back on your time (Report)", locale: locale))
                                        .font(OttlineFont.medium(14))
                                        .foregroundStyle(palette.primaryAccent)
                                    Spacer()
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .padding(.vertical, 8)
                            }
                            .buttonStyle(.plain)

                            if hasBookLogs && locale == "ko" {
                                Button(action: onOpenBookshelf) {
                                    HStack {
                                        Text("내 서가 펼치기 (한국십진분류 000~900)")
                                            .font(OttlineFont.medium(14))
                                            .foregroundStyle(palette.primaryAccent)
                                        Spacer()
                                        Image(systemName: "arrow.right")
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundStyle(palette.primaryAccent)
                                    }
                                    .padding(.vertical, 8)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // Frequent Moments ("다시 만나는 그날")
                    if !frequentPlaces.isEmpty || !frequentOccasions.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(OttlineStrings.tr("다시 만나는 그날", "Revisit by moment", locale: locale))
                                .font(OttlineFont.semiBold(17))
                                .foregroundStyle(palette.ink)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(frequentPlaces, id: \.0) { place, count in
                                        Button {
                                            onOpenTimelineWithMoment(place, nil)
                                        } label: {
                                            Text("\(OttlineStrings.placeLabel(place, locale: locale)) · \(count)")
                                                .font(OttlineFont.medium(13))
                                                .foregroundStyle(palette.ink)
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
                                    ForEach(frequentOccasions, id: \.0) { occ, count in
                                        Button {
                                            onOpenTimelineWithMoment(nil, occ)
                                        } label: {
                                            Text("\(OttlineStrings.occasionLabel(occ, locale: locale)) · \(count)")
                                                .font(OttlineFont.medium(13))
                                                .foregroundStyle(palette.ink)
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
                                }
                            }
                        }
                    }
                }

                // 5. Together Feed + Popular Title Fillers (`요즘 함께 하는 기록들`)
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
            await checkSingleDeviceReminder()
        }
    }

    // MARK: - Subviews

    private var emptyWelcomeSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(OttlineStrings.tr(
                "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터.",
                "A film, a series, a book. Start with one you want to keep.",
                locale: locale
            ))
            .font(OttlineFont.regular(16))
            .foregroundStyle(palette.mutedInk)

            VStack(spacing: 10) {
                Button {
                    onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "plus")
                            .font(.system(size: 14, weight: .bold))
                        Text(OttlineStrings.tr("첫 기록 남기기", "Leave your first record", locale: locale))
                            .font(OttlineFont.semiBold(14.5))
                    }
                    .foregroundStyle(palette.onBrandOrange)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)

                Button(action: onOpenMySpacePairing) {
                    HStack(spacing: 6) {
                        Text(OttlineStrings.tr("이미 남긴 기록 이어보기", "Bring my existing records", locale: locale))
                            .font(OttlineFont.medium(14))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(palette.primaryAccent)
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var firstLogActivationPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(OttlineStrings.tr("어떤 작품부터 시작해 볼까요?", "Which story would you like to start with?", locale: locale))
                    .font(OttlineFont.semiBold(16))
                    .foregroundStyle(palette.ink)
                Spacer()
                Button {
                    activationDismissed = true
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13))
                        .foregroundStyle(palette.mutedInk)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 8) {
                ForEach([
                    ("video", OttlineStrings.tr("영화 · 시리즈", "Movies & Series", locale: locale)),
                    ("book", OttlineStrings.tr("책", "Books", locale: locale))
                ], id: \.0) { tab, label in
                    let selected = activationTab == tab
                    Button {
                        activationTab = tab
                        repository.trackEvent("activation_content_type_select", properties: ["contentType": tab])
                    } label: {
                        Text(label)
                            .font(selected ? OttlineFont.semiBold(13) : OttlineFont.medium(13))
                            .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(selected ? palette.brandNavy : palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }

            if activationTab == "video" {
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
                                VStack(alignment: .leading, spacing: 6) {
                                    PosterImage(
                                        posterUrl: item.posterUrl,
                                        titleName: item.name,
                                        titleType: item.type,
                                        width: 92,
                                        height: 134
                                    )
                                    Text(item.name)
                                        .font(OttlineFont.medium(12.5))
                                        .foregroundStyle(palette.ink)
                                        .lineLimit(1)
                                        .frame(width: 92, alignment: .leading)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach([LogStatus.done, LogStatus.inProgress, LogStatus.wishlist], id: \.self) { st in
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
                            HStack {
                                Text(OttlineStrings.statusLabel(st, type: .book, locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.ink)
                                Spacer()
                                Image(systemName: "arrow.right")
                                    .font(.system(size: 13))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .padding(12)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
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

    private func featuredMemoryCard(_ log: WatchLog) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(OttlineStrings.tr("그날의 온기", "WARMTH OF THAT DAY", locale: locale))
                    .font(OttlineFont.semiBold(12))
                    .foregroundStyle(palette.primaryAccent)
                Spacer()
                Text(RecordDate.formatDisplayDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
            }

            Button {
                onOpenTitleDetail(log.title.id)
            } label: {
                HStack(alignment: .top, spacing: 16) {
                    PosterImage(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type,
                        width: 84,
                        height: 124
                    )
                    VStack(alignment: .leading, spacing: 8) {
                        Text(log.title.name)
                            .font(OttlineFont.semiBold(19))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        RecordFeelingBadge(rating: log.rating, isBook: log.title.type == .book, compact: true)

                        let momentMeta = [
                            log.ott,
                            log.place.map { OttlineStrings.placeLabel($0, locale: locale) },
                            log.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) }
                        ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")

                        if !momentMeta.isEmpty {
                            Text(momentMeta)
                                .font(OttlineFont.regular(12.5))
                                .foregroundStyle(palette.mutedInk)
                        }

                        if !log.spoiler, let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                            Text("“\(note)”")
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.ink)
                                .lineLimit(3)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    Spacer()
                }
            }
            .buttonStyle(.plain)

            HStack {
                Button {
                    onOpenTitleDetail(log.title.id)
                } label: {
                    Text(OttlineStrings.tr("기록 자세히 보기", "Open record", locale: locale))
                        .font(OttlineFont.medium(13))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    shareCardLog = log
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 12))
                        Text(OttlineStrings.tr("공유 카드", "Share card", locale: locale))
                            .font(OttlineFont.medium(13))
                    }
                    .foregroundStyle(palette.mutedInk)
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

    private var emptyCompletedMonthCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(OttlineStrings.tr(
                "다 본·읽은 이야기는 이곳에 모아둘게요.",
                "Stories you finish watching or reading will gather here.",
                locale: locale
            ))
            .font(OttlineFont.semiBold(17))
            .foregroundStyle(palette.ink)

            Text(OttlineStrings.tr(
                "이어가는 이야기와 아껴둔 작품은 타임라인에서 함께 볼 수 있어요.",
                "Your ongoing stories and saved titles are together on your timeline.",
                locale: locale
            ))
            .font(OttlineFont.regular(13.5))
            .foregroundStyle(palette.mutedInk)

            Button(action: onOpenTimeline) {
                HStack(spacing: 6) {
                    Text(OttlineStrings.tr("내 타임라인 펼치기", "Open your timeline", locale: locale))
                        .font(OttlineFont.medium(14))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13))
                }
                .foregroundStyle(palette.primaryAccent)
                .padding(.top, 4)
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private func compactLogRow(_ log: WatchLog) -> some View {
        Button {
            onOpenTitleDetail(log.title.id)
        } label: {
            HStack(spacing: 12) {
                PosterImage(
                    posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                    titleName: log.title.name,
                    titleType: log.title.type,
                    width: 48,
                    height: 70
                )
                VStack(alignment: .leading, spacing: 4) {
                    Text(log.title.name)
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)
                        .lineLimit(1)
                    Text(RecordDate.formatDisplayDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale))
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                    if !log.spoiler, let note = log.note, !note.isEmpty {
                        Text(note)
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                            .lineLimit(1)
                    }
                }
                Spacer()
                RecordFeelingBadge(rating: log.rating, isBook: log.title.type == .book, compact: true)
            }
            .padding(12)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var singleDeviceReminderCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "key.fill")
                    .foregroundStyle(palette.brandNavy)
                Text(OttlineStrings.tr("이 기기에만 연결되어 있어요", "Only linked on this device", locale: locale))
                    .font(OttlineFont.semiBold(14.5))
                    .foregroundStyle(palette.ink)
            }
            Text(OttlineStrings.tr(
                "별도 회원가입 없이 쓰기 때문에, 휴대폰을 바꿀 때를 대비해 연결 코드 보관 카드를 한 번 저장해 두면 안심할 수 있어요.",
                "Save a private recovery card once so you never lose your timeline when switching phones.",
                locale: locale
            ))
            .font(OttlineFont.regular(13))
            .foregroundStyle(palette.mutedInk)

            HStack(spacing: 10) {
                Button {
                    repository.prefs.markSingleDeviceReminderShown()
                    showSingleDeviceReminder = false
                    onOpenMySpacePairing()
                } label: {
                    Text(OttlineStrings.tr("보관 카드 저장하러 가기", "Save recovery card", locale: locale))
                        .font(OttlineFont.semiBold(13))
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

                Button {
                    repository.prefs.markSingleDeviceReminderShown()
                    showSingleDeviceReminder = false
                } label: {
                    Text(OttlineStrings.tr("확인했어요", "Got it", locale: locale))
                        .font(OttlineFont.medium(13))
                        .foregroundStyle(palette.mutedInk)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(palette.sageAccent)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private var togetherSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(OttlineStrings.tr("요즘 함께 하는 기록들", "Stories shared together", locale: locale))
                    .font(OttlineFont.semiBold(18))
                    .foregroundStyle(palette.ink)
                Spacer()
                Button(action: onOpenTogether) {
                    Text(OttlineStrings.tr("더 보기 →", "See all →", locale: locale))
                        .font(OttlineFont.medium(13))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }

            if discussionsLoading {
                ProgressView()
                    .padding(.vertical, 16)
            } else {
                ForEach(discussions.prefix(homeDiscussionLimit)) { disc in
                    Button {
                        onOpenTitleDetail(disc.titleId)
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            PosterImage(
                                posterUrl: disc.posterUrl,
                                titleName: disc.titleName,
                                titleType: disc.titleType,
                                width: 46,
                                height: 68
                            )
                            VStack(alignment: .leading, spacing: 4) {
                                Text(disc.titleName)
                                    .font(OttlineFont.semiBold(14.5))
                                    .foregroundStyle(palette.ink)
                                    .lineLimit(1)
                                if let body = disc.latestCommentBody, !body.isEmpty {
                                    Text(body)
                                        .font(OttlineFont.regular(13))
                                        .foregroundStyle(palette.mutedInk)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                }
                            }
                            Spacer()
                        }
                        .padding(12)
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
                                width: 46,
                                height: 68
                            )
                            VStack(alignment: .leading, spacing: 4) {
                                Text(trend.name)
                                    .font(OttlineFont.semiBold(14.5))
                                    .foregroundStyle(palette.ink)
                                    .lineLimit(1)
                                Text(OttlineStrings.tr("요즘 인기 작품 · 첫 기록 남기기", "Popular now · Leave a record", locale: locale))
                                    .font(OttlineFont.regular(12.5))
                                    .foregroundStyle(palette.mutedInk)
                            }
                            Spacer()
                        }
                        .padding(12)
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

    private func checkSingleDeviceReminder() async {
        let snap = repository.prefs.snapshot
        guard !(snap.userId ?? "").isEmpty,
              !repository.logs.isEmpty,
              !snap.singleDeviceCodeReminderShown else { return }
        if let devices = try? await repository.api.getDevices(), devices.count == 1 {
            showSingleDeviceReminder = true
        }
    }
}
