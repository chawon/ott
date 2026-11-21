import SwiftUI
import AppKit
import OttlineCore

public struct MacRootSpreadView: View {
    @ObservedObject public var repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState

    @Environment(\.colorScheme) private var systemColorScheme
    @Environment(\.scenePhase) private var scenePhase

    public init(repository: OttlineRepository, appState: OttlineMacAppState) {
        self._repository = ObservedObject(wrappedValue: repository)
        self.appState = appState
    }

    public var body: some View {
        let snap = repository.prefs.snapshot
        let isDark: Bool = {
            switch snap.themeMode {
            case .system: return systemColorScheme == .dark
            case .dark: return true
            case .light: return false
            }
        }()
        let palette = isDark ? OttlinePalette.dark : OttlinePalette.light
        let preferredScheme: ColorScheme? = {
            switch snap.themeMode {
            case .system: return nil
            case .dark: return .dark
            case .light: return .light
            }
        }()

        VStack(spacing: 0) {
            MacAppHeader(
                repository: repository,
                activeTab: appState.activeTab,
                themeMode: snap.themeMode,
                onSelectTab: { next in
                    appState.overlayStack.removeAll()
                    appState.activeTab = next
                },
                onQuickRecord: {
                    appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                },
                onToggleTheme: {
                    let next: ThemeMode = {
                        switch snap.themeMode {
                        case .system: return .light
                        case .light: return .dark
                        case .dark: return .system
                        }
                    }()
                    repository.prefs.setThemeMode(next)
                },
                onSelectLocale: { nextLocale in
                    repository.prefs.setLocale(nextLocale)
                    RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
                    RecapNotificationManager.shared.refreshEveningReminderIfEnabled(logs: repository.logs, prefs: repository.prefs)
                    SpotlightIndexManager.shared.syncLogs(repository.logs, locale: nextLocale)
                    repository.prefs.updateWidgetSnapshot(from: repository.logs)
                }
            )

            if appState.isImportingBrowserHandoff || appState.handoffBannerMessage != nil {
                HStack(spacing: 12) {
                    OttlineLucideIcon(
                        kind: .externalLink,
                        size: 16,
                        color: appState.handoffBannerIsSuccess ? palette.primaryAccent : palette.mutedInk
                    )
                    Text(
                        appState.isImportingBrowserHandoff
                            ? OttlineStrings.tr(
                                "웹 브라우저에서 기록을 확인하고 있어요…",
                                "Checking records from your browser…",
                                locale: snap.locale
                            )
                            : (appState.handoffBannerMessage ?? "")
                    )
                    .font(OttlineFont.medium(13.5))
                    .foregroundStyle(palette.ink)
                    Spacer()
                    if !appState.isImportingBrowserHandoff {
                        Button {
                            appState.handoffBannerMessage = nil
                        } label: {
                            OttlineLucideIcon(kind: .x, size: 15, color: palette.mutedInk)
                                .frame(width: 28, height: 28)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(OttlineStrings.tr("안내 닫기", "Dismiss notice", locale: snap.locale))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .frame(maxWidth: 1280)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                .padding(.horizontal, 32)
                .padding(.top, 12)
            }

            ZStack {
                tabContent(palette: palette, locale: snap.locale)
                    .opacity(appState.overlayStack.isEmpty ? 1 : 0)
                    .allowsHitTesting(appState.overlayStack.isEmpty)
                    .accessibilityHidden(!appState.overlayStack.isEmpty)

                if let overlay = appState.overlayStack.last {
                    desktopOverlayView(for: overlay, palette: palette, locale: snap.locale)
                        .id(overlay)
                        .background(palette.background.ignoresSafeArea())
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(palette.background.ignoresSafeArea())
        .environment(\.ottlinePalette, palette)
        .environment(\.appLocale, snap.locale)
        .environment(\.openOttlineOverlay) { target in
            appState.overlayStack.append(target)
        }
        .environment(\.openOttlineTab) { tab in
            appState.overlayStack.removeAll()
            appState.activeTab = tab
        }
        .preferredColorScheme(preferredScheme)
        .sheet(item: $appState.quickRecordRequest) { req in
            QuickRecordSheet(
                request: req,
                repository: repository,
                onDismiss: { appState.quickRecordRequest = nil },
                onOpenTimeline: {
                    appState.overlayStack.removeAll()
                    appState.activeTab = .timeline
                },
                onOpenTitleDetail: { tid in
                    appState.overlayStack.append(.titleDetail(tid))
                },
                onOpenPublicDiscussion: { did in
                    appState.overlayStack.append(.publicDiscussion(did))
                },
                onOpenShareCard: { log in
                    appState.shareCardLog = log
                }
            )
            .frame(minWidth: 680, idealWidth: 740, minHeight: 680, idealHeight: 780)
            .environment(\.ottlinePalette, palette)
            .environment(\.appLocale, snap.locale)
            .preferredColorScheme(preferredScheme)
        }
        .sheet(item: $appState.shareCardLog) { log in
            MacShareCardDialog(log: log, repository: repository)
                .environment(\.ottlinePalette, palette)
                .environment(\.appLocale, snap.locale)
                .preferredColorScheme(preferredScheme)
        }
        .onChange(of: scenePhase) { _, nextPhase in
            if nextPhase == .active {
                repository.initializeSessionAndSync()
                RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
                RecapNotificationManager.shared.refreshEveningReminderIfEnabled(logs: repository.logs, prefs: repository.prefs)
            }
        }
        .onAppear {
            RecapNotificationManager.shared.onOpenRoute = { route in
                if route.contains("report") {
                    appState.overlayStack = [.report]
                }
            }
            RecapNotificationManager.shared.onOpenUrl = { url in
                appState.handleIncomingUrl(url, repository: repository)
            }
            repository.initializeSessionAndSync()
        }
    }

    @ViewBuilder
    private func tabContent(palette: OttlinePalette, locale: String) -> some View {
        switch appState.activeTab {
        case .home:
            MacHomeSpreadView(repository: repository, appState: appState)
        case .timeline:
            MacTimelineSpreadView(repository: repository, appState: appState)
        case .together:
            MacTogetherSpreadView(repository: repository, appState: appState)
        case .mySpace:
            MacMySpaceSpreadView(repository: repository, appState: appState)
        }
    }

    @ViewBuilder
    private func desktopOverlayView(for screen: ActiveOverlayScreen, palette: OttlinePalette, locale: String) -> some View {
        switch screen {
        case .titleDetail(let tid):
            ScrollView {
                TitleDetailScreen(
                    titleId: tid,
                    repository: repository,
                    onBack: { _ = appState.overlayStack.popLast() },
                    onOpenQuickRecord: { req in appState.quickRecordRequest = req },
                    onOpenTitleDetail: { nextTid in appState.overlayStack.append(.titleDetail(nextTid)) },
                    onOpenShareCard: { log in appState.shareCardLog = log },
                    onReportUgc: { prefill in appState.overlayStack.append(.feedback(prefill)) }
                )
                .frame(maxWidth: 960)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            }
        case .publicDiscussion(let did):
            MacTogetherSpreadView(repository: repository, appState: appState, initialDiscussionId: did)
        case .report:
            MacReportView(
                repository: repository,
                onBack: { _ = appState.overlayStack.popLast() },
                onOpenTitleDetail: { tid in appState.overlayStack.append(.titleDetail(tid)) },
                onOpenQuickRecord: {
                    appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                }
            )
        case .bookshelf(let kdc):
            MacBookshelfView(
                repository: repository,
                initialKdcMajor: kdc,
                onBack: { _ = appState.overlayStack.popLast() },
                onOpenTitleDetail: { tid in appState.overlayStack.append(.titleDetail(tid)) },
                onOpenQuickRecordBook: {
                    appState.quickRecordRequest = QuickRecordRequest(initialTypeTab: "book", autoFocusSearch: true)
                }
            )
        case .feedback(let prefill):
            MacFeedbackView(
                repository: repository,
                prefilledBody: prefill,
                onBack: { _ = appState.overlayStack.popLast() }
            )
        case .guides(let slug):
            MacGuideInfoView(initialSlug: slug, mode: .guides, onBack: { _ = appState.overlayStack.popLast() })
        case .about:
            MacGuideInfoView(mode: .about, onBack: { _ = appState.overlayStack.popLast() })
        case .faq:
            MacGuideInfoView(mode: .faq, onBack: { _ = appState.overlayStack.popLast() })
        case .privacy:
            MacGuideInfoView(mode: .privacy, onBack: { _ = appState.overlayStack.popLast() })
        }
    }
}

// MARK: - PC Web Parity Top Header (`AppHeader.tsx` 1:1 Desktop Nav)

public struct MacAppHeader: View {
    @ObservedObject public var repository: OttlineRepository
    public let activeTab: TopLevelTab
    public let themeMode: ThemeMode
    public let onSelectTab: (TopLevelTab) -> Void
    public let onQuickRecord: () -> Void
    public let onToggleTheme: () -> Void
    public let onSelectLocale: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        let snap = repository.prefs.snapshot
        let themeIcon: OttlineLucideIconKind = {
            switch themeMode {
            case .system: return .monitor
            case .dark: return .moon
            case .light: return .sun
            }
        }()

        VStack(spacing: 0) {
            HStack(spacing: 24) {
                Button {
                    onSelectTab(.home)
                } label: {
                    HStack(spacing: 9) {
                        OttlineBrandMark(size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("ottline")
                                .font(OttlineFont.bold(28))
                                .foregroundStyle(palette.primaryAccent)
                            Text("ON THE TIMELINE")
                                .font(OttlineFont.semiBold(9))
                                .kerning(0.9)
                                .foregroundStyle(palette.brandOrange)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                HStack(spacing: 22) {
                    navLink(.home, icon: .home, label: OttlineStrings.tr("홈", "Home", locale: locale))
                    navLink(.timeline, icon: .clock, label: OttlineStrings.tr("타임라인", "Timeline", locale: locale))
                    navLink(.together, icon: .messageCircle, label: OttlineStrings.tr("함께", "Together", locale: locale))
                    navLink(.mySpace, icon: .userRound, label: OttlineStrings.tr("내 공간", "My space", locale: locale))
                }

                HStack(spacing: 8) {
                    if repository.outboxCount > 0 || repository.syncState.status == .syncing || repository.syncState.status == .failed {
                        Button {
                            repository.triggerSyncAsync()
                        } label: {
                            HStack(spacing: 4) {
                                OttlineLucideIcon(
                                    kind: .rotateCcw,
                                    size: 13,
                                    color: repository.syncState.status == .failed ? palette.danger : palette.primaryAccent
                                )
                                Text(repository.syncState.status == .syncing
                                    ? OttlineStrings.tr("동기화 중", "Syncing", locale: locale)
                                    : OttlineStrings.tr("대기 \(repository.outboxCount)", "Pending \(repository.outboxCount)", locale: locale)
                                )
                                .font(OttlineFont.medium(11.5))
                                .foregroundStyle(repository.syncState.status == .failed ? palette.danger : palette.mutedInk)
                            }
                            .padding(.horizontal, 10)
                            .frame(height: 32)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(palette.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }

                    HStack(spacing: 4) {
                        localeButton("KO", value: "ko")
                        localeButton("EN", value: "en")
                    }
                    .padding(.horizontal, 4)

                    Button(action: onToggleTheme) {
                        OttlineLucideIcon(kind: themeIcon, size: 17, color: palette.ink, strokeWidth: 1.9)
                            .frame(width: 34, height: 34)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .help(OttlineStrings.tr("화면 테마 전환 (시스템/라이트/다크)", "Switch theme (System/Light/Dark)", locale: locale))

                    Button(action: onQuickRecord) {
                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                            Text(OttlineStrings.tr("기록 남기기", "Leave a record", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.onBrandOrange)
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 42)
                        .background(palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)

                    Button {
                        onSelectTab(.mySpace)
                    } label: {
                        PersonaAvatar(personaKey: snap.personaKey, size: 36, circular: true)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: 1280)
            .padding(.horizontal, 32)
            .frame(height: 74)
            .frame(maxWidth: .infinity)
            .background(palette.background.opacity(0.95))

            Rectangle()
                .fill(palette.border)
                .frame(height: 1)
                .frame(maxWidth: 1280)
        }
    }

    private func navLink(_ tab: TopLevelTab, icon: OttlineLucideIconKind, label: String) -> some View {
        let active = activeTab == tab
        return Button {
            onSelectTab(tab)
        } label: {
            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    OttlineLucideIcon(
                        kind: icon,
                        size: 16,
                        color: active ? palette.primaryAccent : palette.mutedInk,
                        strokeWidth: active ? 2.2 : 1.8
                    )
                    Text(label)
                        .font(active ? OttlineFont.bold(14) : OttlineFont.medium(14))
                        .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                }
                .padding(.top, 6)

                Rectangle()
                    .fill(active ? palette.brandOrange : Color.clear)
                    .frame(width: 18, height: 2)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func localeButton(_ label: String, value: String) -> some View {
        let active = locale == value
        return Button {
            onSelectLocale(value)
        } label: {
            Text(label)
                .font(active ? OttlineFont.bold(11.5) : OttlineFont.medium(11.5))
                .foregroundStyle(active ? palette.ink : palette.mutedInk)
                .underline(active, color: palette.brandOrange)
                .frame(width: 28, height: 32)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Mac Home Spread View ("펼쳐보는 기록장")

public struct MacHomeSpreadView: View {
    @ObservedObject public var repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var discussions: [DiscussionListItem] = []
    @State private var popularFillers: [TitleSearchItem] = []
    @State private var activationPopularTitles: [TitleSearchItem] = []
    @State private var discussionsLoading: Bool = true
    @State private var discussionsError: Bool = false
    @State private var activationContentType: String = "video"
    @State private var activationDismissed: Bool = false

    public var body: some View {
        let logs = repository.logs
        let snap = repository.prefs.snapshot
        let hasBookLogs = logs.contains(where: { $0.title.type == .book })
        let monthGroups = TimelineMoments.groupCompletedLogsByWatchedMonth(logs)
        let activeMonthKey = snap.homeSelectedMonth
        let selectedGroup = monthGroups.first(where: { $0.monthKey == activeMonthKey }) ?? monthGroups.first
        let featured = selectedGroup?.logs.first
        let sideRecords = Array((selectedGroup?.logs ?? []).dropFirst())
        let continuing = logs.filter { $0.status == .inProgress }.prefix(4)
        let collectedMoments = MacCollectedMoment.build(from: logs)
        let showActivationPanel = logs.isEmpty
            && (snap.pairingCode ?? "").isEmpty
            && !activationDismissed
            && !repository.prefs.activationDismissedInSession

        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                // 1. Desktop Heading (`나의 타임라인` — `HomeTimelineView.tsx` 1:1 parity)
                HStack(alignment: .center, spacing: 24) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(OttlineStrings.tr("나의 타임라인", "MY TIMELINE", locale: locale))
                            .font(OttlineFont.medium(11))
                            .kerning(0.9)
                            .foregroundStyle(palette.mutedInk)

                        Text(logs.isEmpty
                            ? OttlineStrings.tr("나의 타임라인에 첫 순간을 남겨요.", "Your timeline. Your first moment.", locale: locale)
                            : OttlineStrings.tr("내 시간 위에 쌓인 이야기", "Stories on your timeline", locale: locale)
                        )
                        .font(OttlineFont.semiBold(30))
                        .foregroundStyle(palette.ink)
                    }

                    Spacer()

                    if !logs.isEmpty {
                        Button {
                            appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                        } label: {
                            HStack(spacing: 8) {
                                OttlineLucideIcon(kind: .plus, size: 17, color: palette.primaryAccent, strokeWidth: 2.1)
                                Text(OttlineStrings.tr("오늘의 기록 남기기", "Keep today’s story", locale: locale))
                                    .font(OttlineFont.semiBold(15))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .padding(.horizontal, 18)
                            .frame(height: 48)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, 8)

                if repository.outboxCount > 0 || repository.syncState.status == .failed || repository.syncState.status == .syncing {
                    SyncNoticeBanner(
                        syncState: repository.syncState,
                        outboxCount: repository.outboxCount,
                        onRetryTap: { repository.triggerSyncAsync() }
                    )
                }

                // 2. Empty Welcome + First-Log Activation or 3-Column `쌓아온 시간` Spread (`HomeTimelineView.tsx` 1:1 parity)
                if logs.isEmpty {
                    emptyWelcomeSpread

                    if showActivationPanel {
                        firstLogActivationPanel
                    }
                } else {
                    HStack(alignment: .top, spacing: 28) {
                        if !monthGroups.isEmpty {
                            monthsVerticalRail(monthGroups, selectedMonthKey: selectedGroup?.monthKey)
                                .frame(width: 88)
                        }

                        VStack(alignment: .leading, spacing: 36) {
                            if let featured {
                                featuredDesktopCard(featured)
                            } else {
                                emptyCompletedMonthCard
                            }

                            if let selectedGroup, featured != nil {
                                monthEntriesSection(selectedGroup: selectedGroup, sideRecords: sideRecords)
                            }

                            if !collectedMoments.isEmpty {
                                momentRevisitSection(collectedMoments)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        homeSideColumn(continuing: Array(continuing), hasBookLogs: hasBookLogs)
                            .frame(width: 215)
                    }
                }

                // 4. Public Together Section (`함께 만나는 이야기` — always visible like Web)
                publicTogetherSection

                OttlineAppFooter()
            }
            .frame(maxWidth: 1280)
            .padding(.horizontal, 32)
            .padding(.top, 24)
            .frame(maxWidth: .infinity)
        }
        .task {
            await loadTogetherPreview()
        }
    }

    private var emptyWelcomeSpread: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text(OttlineStrings.tr(
                "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터.",
                "A film, a series, a book. Start with one you want to keep.",
                locale: locale
            ))
            .font(OttlineFont.regular(18))
            .foregroundStyle(palette.mutedInk)
            .lineSpacing(7)

            HStack(spacing: 14) {
                Button {
                    appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                } label: {
                    HStack(spacing: 8) {
                        OttlineLucideIcon(kind: .plus, size: 18, color: palette.onBrandOrange, strokeWidth: 2.2)
                        Text(OttlineStrings.tr("첫 기록 남기기", "Leave your first record", locale: locale))
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.onBrandOrange)
                    }
                    .padding(.horizontal, 18)
                    .frame(height: 48)
                    .background(palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)

                Button {
                    appState.startBrowserHandoff(repository: repository)
                } label: {
                    HStack(spacing: 8) {
                        OttlineLucideIcon(kind: .externalLink, size: 16, color: palette.primaryAccent)
                        Text(OttlineStrings.tr("웹(Safari·Chrome) 기록 가져오기", "Bring records from browser", locale: locale))
                            .font(OttlineFont.medium(14.5))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 48)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.primaryAccent.opacity(0.45), lineWidth: 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button {
                    appState.autoExpandPairing = true
                    appState.activeTab = .mySpace
                } label: {
                    Text(OttlineStrings.tr("연결 코드 직접 입력 →", "Enter connection code →", locale: locale))
                        .font(OttlineFont.medium(14.5))
                        .foregroundStyle(palette.primaryAccent)
                        .frame(height: 48)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: 620, alignment: .leading)
        .padding(.bottom, 16)
    }

    private var firstLogActivationPanel: some View {
        let videoDiscussions = discussions.filter { $0.titleType == .movie || $0.titleType == .series }
        let recentItems = Array(videoDiscussions.prefix(8))
        let popularItems = Array(activationPopularTitles.prefix(8))

        return VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(OttlineStrings.tr("처음 남길 기록", "First record", locale: locale))
                        .font(OttlineFont.semiBold(12))
                        .foregroundStyle(palette.mutedInk)
                    Text(OttlineStrings.tr("하나만 골라볼까요?", "Pick one to start", locale: locale))
                        .font(OttlineFont.semiBold(20))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr(
                        "찾기 전에 먼저 떠오르는 것부터 가볍게 남겨보세요.",
                        "Start with whatever comes to mind before searching from scratch.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                }

                Spacer()

                Button {
                    activationDismissed = true
                    repository.prefs.dismissActivationForSession()
                    repository.trackEvent("activation_dismiss", properties: ["contentType": activationContentType])
                } label: {
                    OttlineLucideIcon(kind: .x, size: 16, color: palette.mutedInk, strokeWidth: 2.0)
                        .frame(width: 40, height: 40)
                        .background(palette.background)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .help(OttlineStrings.tr("시작 패널 닫기", "Close start panel", locale: locale))
            }

            HStack(spacing: 10) {
                ForEach([
                    ("video", OttlineLucideIconKind.tv, OttlineStrings.tr("영상", "Video", locale: locale)),
                    ("book", OttlineLucideIconKind.bookOpen, OttlineStrings.tr("책", "Book", locale: locale))
                ], id: \.0) { tab, iconKind, label in
                    let selected = activationContentType == tab
                    Button {
                        activationContentType = tab
                        repository.trackEvent("activation_content_type_select", properties: ["contentType": tab])
                    } label: {
                        HStack(spacing: 8) {
                            OttlineLucideIcon(
                                kind: iconKind,
                                size: 16,
                                color: selected ? palette.primaryAccent : palette.mutedInk
                            )
                            Text(label)
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(selected ? palette.primaryAccent : palette.mutedInk)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(selected ? palette.paperStrong : palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(selected ? palette.primaryAccent.opacity(0.45) : palette.border, lineWidth: selected ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            if activationContentType == "video" {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(OttlineStrings.tr(
                            "요즘 많이 남기는 작품 중 본 게 있나요?",
                            "Have you watched any of these lately?",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(16))
                        .foregroundStyle(palette.ink)

                        Text(OttlineStrings.tr(
                            "포스터를 고르면 바로 기록하기 화면으로 이어져요.",
                            "Pick a poster and it opens the regular logging flow.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                    }

                    if discussionsLoading {
                        LazyVGrid(
                            columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                            spacing: 12
                        ) {
                            ForEach(0..<4, id: \.self) { _ in
                                VStack(alignment: .leading, spacing: 8) {
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(palette.mutedBg)
                                        .aspectRatio(2.0 / 3.0, contentMode: .fit)
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(palette.mutedBg)
                                        .frame(height: 12)
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(palette.mutedBg)
                                        .frame(width: 90, height: 10)
                                }
                                .padding(8)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                        }
                    } else if !recentItems.isEmpty || !popularItems.isEmpty {
                        if !recentItems.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("요즘 함께 남긴 작품", "Titles people are logging", locale: locale))
                                    .font(OttlineFont.semiBold(12))
                                    .foregroundStyle(palette.mutedInk)

                                LazyVGrid(
                                    columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                                    spacing: 12
                                ) {
                                    ForEach(recentItems) { disc in
                                        Button {
                                            activationDismissed = true
                                            repository.prefs.dismissActivationForSession()
                                            let candidate = Title(
                                                id: disc.titleId,
                                                provider: disc.titleProvider ?? .tmdb,
                                                providerId: disc.titleProviderId,
                                                type: disc.titleType,
                                                name: disc.titleName,
                                                year: disc.titleYear,
                                                posterUrl: disc.posterUrl
                                            )
                                            appState.quickRecordRequest = QuickRecordRequest(
                                                preselectedTitle: candidate,
                                                selectSource: "activation_recent_discussion",
                                                autoFocusSearch: false
                                            )
                                        } label: {
                                            activationPosterTile(
                                                name: disc.titleName,
                                                posterUrl: disc.posterUrl,
                                                type: disc.titleType,
                                                year: disc.titleYear
                                            )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }

                        if !popularItems.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("요즘 인기 작품", "Popular now", locale: locale))
                                    .font(OttlineFont.semiBold(12))
                                    .foregroundStyle(palette.mutedInk)

                                LazyVGrid(
                                    columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                                    spacing: 12
                                ) {
                                    ForEach(popularItems) { item in
                                        Button {
                                            activationDismissed = true
                                            repository.prefs.dismissActivationForSession()
                                            appState.quickRecordRequest = QuickRecordRequest(
                                                initialQuery: item.name,
                                                initialTypeTab: "all",
                                                preselectedSearchItem: item,
                                                selectSource: "activation_popular_title",
                                                autoFocusSearch: false
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
                    } else {
                        Text(OttlineStrings.tr(
                            "지금 보여줄 작품을 불러오지 못했어요. 직접 찾아서 남길 수 있어요.",
                            "We could not load titles right now. You can still search directly.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.background)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
                    }

                    Button {
                        activationDismissed = true
                        repository.prefs.dismissActivationForSession()
                        appState.quickRecordRequest = QuickRecordRequest(initialTypeTab: "all", autoFocusSearch: true)
                    } label: {
                        HStack(spacing: 8) {
                            OttlineLucideIcon(kind: .search, size: 15, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text(OttlineStrings.tr("다른 작품 찾기", "Find another title", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .padding(.horizontal, 16)
                        .frame(height: 44)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(OttlineStrings.tr(
                            "요즘 읽고 있는 책이 있나요?",
                            "Are you reading something these days?",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(16))
                        .foregroundStyle(palette.ink)

                        Text(OttlineStrings.tr(
                            "다 읽지 않아도 괜찮아요. 상태를 고르고 제목이나 저자로 찾아보세요.",
                            "It does not need to be finished. Choose the state, then search by title or author.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                    }

                    HStack(spacing: 10) {
                        ForEach([LogStatus.inProgress, LogStatus.done, LogStatus.wishlist], id: \.self) { st in
                            Button {
                                activationDismissed = true
                                repository.prefs.dismissActivationForSession()
                                repository.trackEvent("activation_status_select", properties: ["contentType": "book", "status": st.rawValue])
                                appState.quickRecordRequest = QuickRecordRequest(
                                    initialTypeTab: "book",
                                    preferredStatus: st,
                                    autoFocusSearch: true
                                )
                            } label: {
                                Text(OttlineStrings.statusLabel(st, type: .book, locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.ink)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 48)
                                    .background(palette.background)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Button {
                        activationDismissed = true
                        repository.prefs.dismissActivationForSession()
                        appState.quickRecordRequest = QuickRecordRequest(initialTypeTab: "book", autoFocusSearch: true)
                    } label: {
                        HStack(spacing: 8) {
                            OttlineLucideIcon(kind: .search, size: 15, color: palette.primaryAccent, strokeWidth: 2.0)
                            Text(OttlineStrings.tr("책 제목이나 저자 찾기", "Search title or author", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .padding(.horizontal, 16)
                        .frame(height: 44)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func activationPosterTile(name: String, posterUrl: String?, type: TitleType, year: Int?) -> some View {
        return VStack(alignment: .leading, spacing: 8) {
            GeometryReader { geo in
                PosterImage(
                    posterUrl: posterUrl,
                    titleName: name,
                    titleType: type,
                    width: max(1, geo.size.width),
                    height: max(1, geo.size.height),
                    cornerRadius: 6,
                    widthBucket: "w500"
                )
            }
            .aspectRatio(2.0 / 3.0, contentMode: .fit)

            VStack(alignment: .leading, spacing: 3) {
                Text(name)
                    .font(OttlineFont.semiBold(13))
                    .foregroundStyle(palette.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(minHeight: 34, alignment: .topLeading)

                Text([
                    OttlineStrings.titleTypeLabel(type, locale: locale),
                    year.map(String.init)
                ].compactMap { $0 }.joined(separator: " · "))
                .font(OttlineFont.regular(11.5))
                .foregroundStyle(palette.mutedInk)
                .lineLimit(1)
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 4)
        }
        .padding(6)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func activationPosterFallback(type: TitleType) -> some View {
        ZStack {
            palette.mutedBg
            Image(systemName: type == .series ? "tv" : "film")
                .font(.system(size: 24))
                .foregroundStyle(palette.subtleInk)
        }
    }

    private var publicTogetherSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            Rectangle().fill(palette.border).frame(height: 1)

            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(OttlineStrings.tr("함께", "TOGETHER", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.9)
                        .foregroundStyle(palette.mutedInk)
                    HStack(spacing: 8) {
                        OttlineLucideIcon(kind: .messageCircle, size: 19, color: palette.ink, strokeWidth: 2.0)
                        Text(OttlineStrings.tr("함께 만나는 이야기", "Stories to share", locale: locale))
                            .font(OttlineFont.semiBold(18))
                            .foregroundStyle(palette.ink)
                    }
                }
                Spacer()
                Button {
                    appState.activeTab = .together
                } label: {
                    Text(OttlineStrings.tr("전체 보기 →", "View All →", locale: locale))
                        .font(OttlineFont.medium(14))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }

            if discussionsLoading && discussions.isEmpty && popularFillers.isEmpty {
                VStack(spacing: 12) {
                    ForEach(0..<4, id: \.self) { _ in
                        HStack(spacing: 14) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(palette.mutedBg)
                                .frame(width: 48, height: 64)
                            VStack(alignment: .leading, spacing: 8) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(palette.mutedBg)
                                    .frame(width: 240, height: 14)
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(palette.mutedBg)
                                    .frame(width: 140, height: 11)
                            }
                            Spacer()
                        }
                        .padding(8)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(palette.border, lineWidth: 1))
            } else if discussionsError && discussions.isEmpty && popularFillers.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text(OttlineStrings.tr(
                        "함께 남긴 이야기를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.",
                        "Couldn’t load the shared stories. Please try again in a moment.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)

                    Button {
                        Task { await loadTogetherPreview() }
                    } label: {
                        Text(OttlineStrings.tr("다시 불러오기", "Try again", locale: locale))
                            .font(OttlineFont.medium(13.5))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .buttonStyle(.plain)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(palette.border, lineWidth: 1))
            } else if discussions.isEmpty && popularFillers.isEmpty {
                Text(OttlineStrings.tr("아직 함께 기록이 없어요.", "No shared records yet.", locale: locale))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(palette.border, lineWidth: 1))
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                    spacing: 12
                ) {
                    ForEach(discussions.prefix(6)) { disc in
                        Button {
                            appState.overlayStack.append(.titleDetail(disc.titleId))
                        } label: {
                            HStack(spacing: 14) {
                                PosterImage(
                                    posterUrl: disc.posterUrl,
                                    titleName: disc.titleName,
                                    titleType: disc.titleType,
                                    width: 48,
                                    height: 64,
                                    cornerRadius: 6
                                )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(disc.titleName)
                                        .font(OttlineFont.semiBold(14.5))
                                        .foregroundStyle(palette.ink)
                                        .lineLimit(1)
                                    Text([
                                        OttlineStrings.titleTypeLabel(disc.titleType, locale: locale),
                                        disc.titleYear.map(String.init)
                                    ].compactMap { $0 }.joined(separator: " · "))
                                    .font(OttlineFont.regular(12))
                                    .foregroundStyle(palette.mutedInk)
                                }
                                Spacer(minLength: 8)
                                VStack(alignment: .trailing, spacing: 4) {
                                    Text(RecordDate.formatShortMonthDay(disc.createdAt, locale: locale))
                                        .font(OttlineFont.regular(12))
                                        .foregroundStyle(palette.mutedInk)
                                    Text(locale == "en" ? "\(disc.commentCount) comments" : "\(disc.commentCount)개의 이야기들")
                                        .font(OttlineFont.regular(12))
                                        .foregroundStyle(palette.mutedInk)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }

                    ForEach(popularFillers) { item in
                        Button {
                            appState.quickRecordRequest = QuickRecordRequest(
                                initialQuery: item.name,
                                initialTypeTab: item.type.rawValue,
                                preselectedSearchItem: item,
                                selectSource: "popular_title",
                                autoFocusSearch: false
                            )
                        } label: {
                            HStack(spacing: 14) {
                                PosterImage(
                                    posterUrl: item.posterUrl,
                                    titleName: item.name,
                                    titleType: item.type,
                                    width: 48,
                                    height: 64,
                                    cornerRadius: 6
                                )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.name)
                                        .font(OttlineFont.semiBold(14.5))
                                        .foregroundStyle(palette.ink)
                                        .lineLimit(1)
                                    Text([
                                        OttlineStrings.titleTypeLabel(item.type, locale: locale),
                                        item.year.map(String.init)
                                    ].compactMap { $0 }.joined(separator: " · "))
                                    .font(OttlineFont.regular(12))
                                    .foregroundStyle(palette.mutedInk)
                                }
                                Spacer(minLength: 8)
                                VStack(alignment: .trailing, spacing: 4) {
                                    Text(OttlineStrings.tr("인기 작품", "Popular pick", locale: locale))
                                        .font(OttlineFont.semiBold(10.5))
                                        .foregroundStyle(palette.ink)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(palette.sageAccent)
                                        .clipShape(Capsule())
                                    Text(OttlineStrings.tr("기록하기", "Record it", locale: locale))
                                        .font(OttlineFont.medium(12))
                                        .foregroundStyle(palette.mutedInk)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(palette.border, lineWidth: 1))
            }
        }
        .padding(.top, 20)
    }

    private func monthsVerticalRail(_ monthGroups: [MonthLogGroup], selectedMonthKey: String?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(OttlineStrings.tr("쌓아온 시간", "YOUR MONTHS", locale: locale))
                .font(OttlineFont.medium(11))
                .kerning(0.88)
                .foregroundStyle(palette.mutedInk)
                .padding(.bottom, 6)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(monthGroups, id: \.monthKey) { (group: MonthLogGroup) in
                        monthRailButton(group, selectedMonthKey: selectedMonthKey)
                    }
                }
            }
            .frame(maxHeight: 640)
        }
    }

    private func monthRailButton(_ group: MonthLogGroup, selectedMonthKey: String?) -> some View {
        let isSelected = (selectedMonthKey == group.monthKey)
        let yearText = group.monthKey == "undated" ? "" : String(group.monthKey.prefix(4))
        let monthText = shortMonthLabel(group.monthKey, locale: locale)
        let barWidth: CGFloat = isSelected ? 2 : 1

        return Button {
            repository.prefs.setHomeSelectedMonth(group.monthKey)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                if !yearText.isEmpty {
                    Text(yearText)
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                }
                Text(monthText)
                    .font(OttlineFont.medium(23))
                    .foregroundStyle(isSelected ? palette.primaryAccent : palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .padding(12)
            .frame(minWidth: 88, maxWidth: 88, minHeight: 84, alignment: .leading)
            .background(isSelected ? palette.card : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(isSelected ? palette.primaryAccent : palette.border)
                    .frame(width: barWidth)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var emptyCompletedMonthCard: some View {
        VStack(alignment: .leading, spacing: 10) {
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
            .lineSpacing(5)

            Button {
                appState.activeTab = .timeline
            } label: {
                Text(OttlineStrings.tr("내 타임라인 펼치기 →", "Open your timeline →", locale: locale))
                    .font(OttlineFont.medium(14))
                    .foregroundStyle(palette.primaryAccent)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func featuredDesktopCard(_ log: WatchLog) -> some View {
        let featuredIso = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
        let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let creator: String? = {
            if let author = log.title.author?.trimmingCharacters(in: .whitespacesAndNewlines), !author.isEmpty {
                return author
            }
            if let dirs = log.title.directors, !dirs.isEmpty {
                return dirs.joined(separator: ", ")
            }
            return nil
        }()
        let edition = editionLabel(for: log)
        let hasMoment = !(log.ott?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
            || log.place != nil
            || log.occasion != nil

        return VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 10) {
                Text(OttlineStrings.tr("그날의 온기", "A moment kept", locale: locale))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)

                Text(RecordDate.formatFeaturedDate(featuredIso, locale: locale))
                    .font(OttlineFont.semiBold(16))
                    .foregroundStyle(palette.ink)

                Rectangle()
                    .fill(palette.border)
                    .frame(height: 1)
                    .frame(maxWidth: .infinity)
            }

            MacFeaturedBodyLayout {
                Button {
                    appState.overlayStack.append(.titleDetail(log.title.id))
                } label: {
                    MacFeaturedPosterView(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 10) {
                    Text([
                        OttlineStrings.titleTypeLabel(log.title.type, locale: locale),
                        (log.seasonYear ?? log.title.year).map(String.init)
                    ].compactMap { $0 }.joined(separator: " · "))
                    .font(OttlineFont.regular(11))
                    .kerning(0.88)
                    .foregroundStyle(palette.mutedInk)

                    Button {
                        appState.overlayStack.append(.titleDetail(log.title.id))
                    } label: {
                        Text(log.title.name)
                            .font(OttlineFont.semiBold(25))
                            .foregroundStyle(palette.ink)
                            .multilineTextAlignment(.leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if let creator {
                        Text(creator)
                            .font(OttlineFont.regular(14))
                            .foregroundStyle(palette.mutedInk)
                    }

                    HStack(spacing: 12) {
                        Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                            .font(OttlineFont.medium(14))
                            .foregroundStyle(palette.primaryAccent)

                        RecordFeelingBadge(rating: log.rating, isBook: log.title.type == .book)
                    }
                    .padding(.top, 4)

                    if let edition {
                        Text(edition)
                            .font(OttlineFont.regular(13))
                            .foregroundStyle(palette.mutedInk)
                    }

                    if hasMoment {
                        Rectangle()
                            .fill(palette.border)
                            .frame(height: 1)
                            .padding(.top, 6)
                        RecordMomentList(ott: log.ott, place: log.place, occasion: log.occasion, compact: false)
                            .padding(.top, 4)
                    }

                    if !log.spoiler && !note.isEmpty {
                        InlineNoteText(text: note, fontSize: 16, lineLimit: 10, preserveNewlines: true)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.leading, 16)
                            .overlay(alignment: .leading) {
                                Rectangle()
                                    .fill(palette.border)
                                    .frame(width: 2)
                            }
                            .padding(.top, 8)
                    }

                    Spacer(minLength: 12)

                    HStack {
                        Button {
                            appState.overlayStack.append(.titleDetail(log.title.id))
                        } label: {
                            Text(OttlineStrings.tr("이 기록 펼치기 →", "Open this memory →", locale: locale))
                                .font(OttlineFont.medium(14))
                                .foregroundStyle(palette.primaryAccent)
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        Spacer()

                        Button {
                            appState.shareCardLog = log
                        } label: {
                            OttlineLucideIcon(kind: .share2, size: 18, color: palette.mutedInk)
                                .frame(width: 44, height: 44)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func monthEntriesSection(selectedGroup: MonthLogGroup, sideRecords: [WatchLog]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(RecordDate.formatMonthLabel(selectedGroup.monthKey, locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.88)
                        .foregroundStyle(palette.mutedInk)
                    Text(OttlineStrings.tr("이 달에 남긴 시간", "Moments this month", locale: locale))
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)
                }
                Spacer()
                Button {
                    appState.activeTab = .timeline
                } label: {
                    Text(OttlineStrings.tr("타임라인 →", "Timeline →", locale: locale))
                        .font(OttlineFont.medium(14))
                        .foregroundStyle(palette.primaryAccent)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 16)
            .overlay(alignment: .bottom) {
                Rectangle().fill(palette.border).frame(height: 1)
            }

            if sideRecords.isEmpty {
                Text(OttlineStrings.tr("이 달에 남겨둔 순간이에요.", "A moment you kept this month.", locale: locale))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                    .padding(.top, 16)
            } else {
                ForEach(sideRecords.prefix(6)) { log in
                    let entryIso = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
                    let statusText = OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale)
                    let edition = editionLabel(for: log)

                    Button {
                        appState.overlayStack.append(.titleDetail(log.title.id))
                    } label: {
                        HStack(alignment: .center, spacing: 16) {
                            Text(RecordDate.formatShortMonthDay(entryIso, locale: locale))
                                .font(OttlineFont.regular(13))
                                .foregroundStyle(palette.mutedInk)
                                .frame(width: 66, alignment: .leading)

                            PosterImage(
                                posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                                titleName: log.title.name,
                                titleType: log.title.type,
                                width: 42,
                                height: 63,
                                cornerRadius: 4
                            )

                            VStack(alignment: .leading, spacing: 4) {
                                Text(log.title.name)
                                    .font(OttlineFont.semiBold(16))
                                    .foregroundStyle(palette.ink)
                                    .lineLimit(1)

                                Text(edition.map { "\(statusText) · \($0)" } ?? statusText)
                                    .font(OttlineFont.regular(13))
                                    .foregroundStyle(palette.mutedInk)

                                RecordMomentList(ott: log.ott, place: log.place, occasion: log.occasion, compact: true)
                            }

                            Spacer(minLength: 8)

                            Text("→")
                                .font(OttlineFont.regular(15))
                                .foregroundStyle(palette.mutedInk)
                        }
                        .padding(.vertical, 18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(palette.border).frame(height: 1)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func momentRevisitSection(_ collectedMoments: [MacCollectedMoment]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(OttlineStrings.tr("다시 만나는 그날", "BACK TO A MOMENT", locale: locale))
                    .font(OttlineFont.medium(11))
                    .kerning(0.88)
                    .foregroundStyle(palette.mutedInk)
                Text(OttlineStrings.tr("어떤 순간을 펼쳐볼까요?", "Which moments will you revisit?", locale: locale))
                    .font(OttlineFont.semiBold(18))
                    .foregroundStyle(palette.ink)
            }

            Text(OttlineStrings.tr(
                "이 기기에 모아둔 기록에서 그날의 순간을 다시 만나요.",
                "Revisit moments from the records kept on this device.",
                locale: locale
            ))
            .font(OttlineFont.regular(14))
            .foregroundStyle(palette.mutedInk)

            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
                spacing: 12
            ) {
                ForEach(collectedMoments) { m in
                    Button {
                        appState.pendingPlaceFilter = m.place
                        appState.pendingOccasionFilter = m.occasion
                        appState.activeTab = .timeline
                    } label: {
                        HStack(spacing: 12) {
                            OttlineLucideIcon(
                                kind: m.place != nil ? .mapPin : .users,
                                size: 17,
                                color: palette.mutedInk
                            )
                            Text(m.label(locale: locale))
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.ink)
                                .lineLimit(1)
                            Spacer(minLength: 6)
                            Text(locale == "en"
                                ? "\(m.count) \(m.count == 1 ? "record" : "records")"
                                : "\(m.count)개"
                            )
                            .font(OttlineFont.regular(13))
                            .foregroundStyle(palette.mutedInk)
                            Text("→")
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.mutedInk)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func homeSideColumn(continuing: [WatchLog], hasBookLogs: Bool) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            if !continuing.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Text(OttlineStrings.tr("아직 못다 한 이야기", "Stories still unfolding", locale: locale))
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)

                    VStack(alignment: .leading, spacing: 22) {
                        ForEach(continuing) { log in
                            HStack(alignment: .top, spacing: 14) {
                                PosterImage(
                                    posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                                    titleName: log.title.name,
                                    titleType: log.title.type,
                                    width: 54,
                                    height: 81,
                                    cornerRadius: 6
                                )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                                        .font(OttlineFont.regular(12))
                                        .foregroundStyle(palette.mutedInk)
                                    Text(log.title.name)
                                        .font(OttlineFont.semiBold(16))
                                        .foregroundStyle(palette.ink)
                                        .lineLimit(2)
                                    if let edition = editionLabel(for: log) {
                                        Text(edition)
                                            .font(OttlineFont.regular(13))
                                            .foregroundStyle(palette.mutedInk)
                                    }
                                    Button {
                                        appState.overlayStack.append(.titleDetail(log.title.id))
                                    } label: {
                                        Text(OttlineStrings.tr("이어 적기 →", "Keep going →", locale: locale))
                                            .font(OttlineFont.medium(13))
                                            .foregroundStyle(palette.primaryAccent)
                                            .frame(minHeight: 36, alignment: .leading)
                                            .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
            }

            VStack(spacing: 0) {
                Button {
                    appState.overlayStack.append(.report)
                } label: {
                    HStack(spacing: 10) {
                        OttlineLucideIcon(kind: .clock3, size: 17, color: palette.primaryAccent)
                        Text(OttlineStrings.tr("쌓아온 시간 돌아보기", "Look back on your time", locale: locale))
                            .font(OttlineFont.medium(14))
                            .foregroundStyle(palette.primaryAccent)
                        Spacer()
                        Text("→")
                            .font(OttlineFont.medium(14))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .frame(minHeight: 58)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .overlay(alignment: .top) {
                    Rectangle().fill(palette.border).frame(height: 1)
                }

                if hasBookLogs && locale == "ko" {
                    Button {
                        appState.overlayStack.append(.bookshelf(nil))
                    } label: {
                        HStack(spacing: 10) {
                            OttlineLucideIcon(kind: .bookOpen, size: 17, color: palette.primaryAccent)
                            Text("내 서가 펼치기")
                                .font(OttlineFont.medium(14))
                                .foregroundStyle(palette.primaryAccent)
                            Spacer()
                            Text("→")
                                .font(OttlineFont.medium(14))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .frame(minHeight: 58)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .overlay(alignment: .top) {
                        Rectangle().fill(palette.border).frame(height: 1)
                    }
                }
            }

            Text(OttlineStrings.tr(
                "서두르지 않아도 괜찮아요. 남기고 싶은 순간에 다시 만나요.",
                "No need to keep up. Come back when there’s something to keep.",
                locale: locale
            ))
            .font(OttlineFont.regular(13.5))
            .foregroundStyle(palette.mutedInk)
            .lineSpacing(5)
        }
    }

    private func shortMonthLabel(_ monthKey: String, locale: String) -> String {
        if monthKey == "undated" {
            return OttlineStrings.tr("날짜 미기록", "Undated", locale: locale)
        }
        let parts = monthKey.split(separator: "-")
        if parts.count == 2, let m = Int(parts[1]) {
            if locale == "en" {
                let df = DateFormatter()
                df.locale = Locale(identifier: "en_US_POSIX")
                df.calendar = Calendar(identifier: .gregorian)
                if let monthIndex = (1...12).contains(m) ? m - 1 : nil,
                   df.shortMonthSymbols.indices.contains(monthIndex) {
                    return df.shortMonthSymbols[monthIndex]
                }
            }
            return "\(m)월"
        }
        return RecordDate.formatMonthLabel(monthKey, locale: locale)
    }

    private func editionLabel(for log: WatchLog) -> String? {
        let parts = [
            log.seasonNumber.map { "S\($0)" },
            log.episodeNumber.map { "E\($0)" }
        ].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func loadTogetherPreview() async {
        discussionsLoading = true
        discussionsError = false
        defer { discussionsLoading = false }

        do {
            let latest = try await repository.api.getDiscussionsLatest(limit: 6, days: 14)
            discussions = latest
            let missingCount = max(0, 6 - latest.count)
            let latestVideo = latest.filter { $0.titleType == .movie || $0.titleType == .series }
            let activationMissingCount = max(0, 6 - latestVideo.count)

            if missingCount == 0 && activationMissingCount == 0 {
                popularFillers = []
                activationPopularTitles = []
                return
            }

            do {
                let pop = try await repository.api.getPopularTitles(limit: 12)
                popularFillers = TitleFallback.selectPopularTitleFillers(
                    discussions: latest,
                    popularTitles: pop,
                    missingCount: missingCount
                )
                activationPopularTitles = TitleFallback.selectPopularTitleFillers(
                    discussions: latestVideo,
                    popularTitles: pop,
                    missingCount: activationMissingCount
                )
            } catch {
                discussionsError = true
                popularFillers = []
                activationPopularTitles = []
            }
        } catch {
            discussionsError = true
            discussions = []
            popularFillers = []
            activationPopularTitles = []
        }
    }
}

private struct MacCollectedMoment: Identifiable {
    let id: String
    let place: Place?
    let occasion: Occasion?
    let count: Int

    func label(locale: String) -> String {
        if let place {
            return OttlineStrings.placeLabel(place, locale: locale)
        }
        if let occasion {
            return OttlineStrings.occasionLabel(occasion, locale: locale)
        }
        return ""
    }

    static func build(from logs: [WatchLog]) -> [MacCollectedMoment] {
        let places = TimelineMoments.frequentPlaces(logs, limit: 4).map { place, count in
            MacCollectedMoment(id: "place:\(place.rawValue)", place: place, occasion: nil, count: count)
        }
        let occasions = TimelineMoments.frequentOccasions(logs, limit: 4).map { occasion, count in
            MacCollectedMoment(id: "occ:\(occasion.rawValue)", place: nil, occasion: occasion, count: count)
        }
        return (places + occasions).sorted { $0.count > $1.count }
    }
}

struct MacFeaturedBodyLayout: Layout {
    struct Metrics: Equatable {
        let posterWidth: CGFloat
        let posterHeight: CGFloat
        let storyWidth: CGFloat
        let spacing: CGFloat
    }

    var spacing: CGFloat = 26

    static func metrics(forTotalWidth totalWidth: CGFloat, spacing: CGFloat = 26) -> Metrics {
        let safeTotal = max(0, totalWidth)
        let available = max(0, safeTotal - spacing)
        let posterWidth = min(max(135, floor(available * (0.85 / 1.85))), max(135, available))
        let posterHeight = round(posterWidth * 1.5)
        let storyWidth = max(0, safeTotal - posterWidth - spacing)
        return Metrics(
            posterWidth: posterWidth,
            posterHeight: posterHeight,
            storyWidth: storyWidth,
            spacing: spacing
        )
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let proposed = proposal.width
        let totalWidth = (proposed != nil && proposed!.isFinite) ? proposed! : 744
        let m = Self.metrics(forTotalWidth: totalWidth, spacing: spacing)
        let storyHeight = subviews.count > 1
            ? subviews[1].sizeThatFits(ProposedViewSize(width: m.storyWidth, height: nil)).height
            : 0
        return CGSize(width: totalWidth, height: max(m.posterHeight, storyHeight))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let m = Self.metrics(forTotalWidth: bounds.width, spacing: spacing)
        if !subviews.isEmpty {
            subviews[0].place(
                at: CGPoint(x: bounds.minX, y: bounds.minY),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: m.posterWidth, height: m.posterHeight)
            )
        }
        if subviews.count > 1 {
            subviews[1].place(
                at: CGPoint(x: bounds.minX + m.posterWidth + m.spacing, y: bounds.minY),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: m.storyWidth, height: bounds.height)
            )
        }
    }
}

struct MacFeaturedPosterView: View {
    let posterUrl: String?
    let titleName: String
    let titleType: TitleType

    @Environment(\.ottlinePalette) private var palette
    @State private var loadedImage: NSImage?
    @State private var loadFinished: Bool = false

    static func originalBookCoverUrl(_ source: String) -> String? {
        guard let thumbnail = URLComponents(string: source),
              let scheme = thumbnail.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              thumbnail.user == nil,
              thumbnail.password == nil,
              thumbnail.port == nil,
              let host = thumbnail.host?.lowercased(),
              host.range(of: #"^search\d+\.kakaocdn\.net$"#, options: .regularExpression) != nil,
              thumbnail.path.range(of: #"^/thumb/R\d+x\d+(?:\.q\d+)?/?$"#, options: .regularExpression) != nil,
              let filename = thumbnail.queryItems?.first(where: { $0.name == "fname" })?.value,
              !filename.isEmpty,
              var original = URLComponents(string: filename),
              let origScheme = original.scheme?.lowercased(),
              origScheme == "http" || origScheme == "https",
              original.user == nil,
              original.password == nil,
              original.port == nil,
              original.host?.lowercased() == "t1.daumcdn.net",
              original.path.range(of: #"^/lbook/image/\d+$"#, options: .regularExpression) != nil
        else {
            return nil
        }
        original.scheme = "https"
        original.fragment = nil
        return original.url?.absoluteString
    }

    static func candidateUrls(posterUrl: String?, titleType: TitleType) -> [URL] {
        guard let raw = posterUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return []
        }
        let httpsRaw = raw.hasPrefix("http://")
            ? "https://" + raw.dropFirst("http://".count)
            : raw
        let candidates: [String]
        if titleType == .book {
            candidates = [originalBookCoverUrl(raw), httpsRaw].compactMap { $0 }
        } else {
            candidates = [
                tmdbResizeUrl(raw, bucket: "w780"),
                tmdbResizeUrl(raw, bucket: "original") ?? httpsRaw
            ].compactMap { $0 }
        }
        var seen = Set<String>()
        return candidates.compactMap { candidate in
            guard seen.insert(candidate).inserted else { return nil }
            return URL(string: candidate)
        }
    }

    private var hasPosterSource: Bool {
        !(posterUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    }

    var body: some View {
        let candidateUrls = Self.candidateUrls(posterUrl: posterUrl, titleType: titleType)
        let displayImage = OttlinePosterImageCache.shared.cachedFirstAvailable(urls: candidateUrls) ?? loadedImage

        return GeometryReader { proxy in
            let boxW = max(1, proxy.size.width)
            let boxH = max(1, proxy.size.height)

            Group {
                if let nsImage = displayImage {
                    if titleType == .book {
                        let rep = nsImage.representations.first
                        let repW = rep?.pixelsWide ?? 0
                        let repH = rep?.pixelsHigh ?? 0
                        let pixelW = repW > 0 ? CGFloat(repW) : max(1, nsImage.size.width)
                        let pixelH = repH > 0 ? CGFloat(repH) : max(1, nsImage.size.height)
                        let scale = min(1.0, min(boxW / max(1, pixelW), boxH / max(1, pixelH)))
                        ZStack {
                            palette.mutedBg
                            Image(nsImage: nsImage)
                                .resizable()
                                .interpolation(.high)
                                .frame(width: round(pixelW * scale), height: round(pixelH * scale))
                        }
                        .frame(width: boxW, height: boxH)
                    } else {
                        Image(nsImage: nsImage)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFill()
                            .frame(width: boxW, height: boxH)
                            .clipped()
                    }
                } else {
                    ZStack {
                        palette.mutedBg
                        if loadFinished || !hasPosterSource {
                            fallbackContent
                        }
                    }
                    .frame(width: boxW, height: boxH)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .task(id: "\(titleType.rawValue)|\(posterUrl ?? "")") {
            let urls = Self.candidateUrls(posterUrl: posterUrl, titleType: titleType)
            if let cached = OttlinePosterImageCache.shared.cachedFirstAvailable(urls: urls) {
                loadedImage = cached
                loadFinished = true
                return
            }
            loadedImage = nil
            loadFinished = false
            let fetched = await OttlinePosterImageCache.shared.loadFirstAvailable(urls: urls)
            if !Task.isCancelled {
                loadedImage = fetched
                loadFinished = true
            }
        }
    }

    private var fallbackContent: some View {
        VStack(spacing: 12) {
            Group {
                switch titleType {
                case .book:
                    OttlineLucideIcon(kind: .bookOpen, size: 24, color: palette.mutedInk)
                case .series:
                    OttlineLucideIcon(kind: .tv, size: 24, color: palette.mutedInk)
                case .movie:
                    Image(systemName: "film")
                        .font(.system(size: 22))
                        .foregroundStyle(palette.mutedInk)
                }
            }
            Text(titleName)
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)
                .multilineTextAlignment(.center)
                .lineLimit(3)
        }
        .padding(12)
    }
}
