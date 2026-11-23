import SwiftUI
import OttlineCore
#if canImport(CoreSpotlight)
import CoreSpotlight
#endif

@main
public struct OttlineApp: App {
    @StateObject private var repository: OttlineRepository = {
        let prefs = AppPreferences()
        let db = OttlineDatabase()
        let api = OttlineApiClient(prefs: prefs)
        return OttlineRepository(db: db, prefs: prefs, api: api)
    }()

    public init() {
        RecapNotificationManager.shared.configureDelegate()
    }

    public var body: some Scene {
        WindowGroup {
            OttlineRootContainerView(repository: repository)
        }
    }
}

public struct OttlineRootContainerView: View {
    @ObservedObject public var repository: OttlineRepository

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var systemColorScheme
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.openURL) private var openURL
    @State private var activeTab: TopLevelTab = .home
    @State private var overlayStack: [ActiveOverlayScreen] = []
    @State private var quickRecordRequest: QuickRecordRequest?
    @State private var rootShareCardLog: WatchLog?
    @State private var showSplash: Bool = {
        #if DEBUG
        return ProcessInfo.processInfo.environment["OTTLINE_SKIP_SPLASH"] != "1"
        #else
        return true
        #endif
    }()
    @State private var autoExpandPairing: Bool = false
    @State private var pendingPlaceFilter: Place?
    @State private var pendingOccasionFilter: Occasion?
    @State private var handoffNoticeMessage: String?
    @State private var selectedTogetherDiscussionId: String?
    @State private var pendingDirectDiscussionId: String?
    @State private var hasExplicitTogetherSelection: Bool = false
    @State private var currentViewportIsSpread: Bool = UIDevice.current.userInterfaceIdiom == .pad

    public init(repository: OttlineRepository) {
        self._repository = ObservedObject(wrappedValue: repository)
    }

    private var compactQuickRecordBinding: Binding<QuickRecordRequest?> {
        Binding(
            get: { horizontalSizeClass == .regular ? nil : quickRecordRequest },
            set: { quickRecordRequest = $0 }
        )
    }

    private var regularQuickRecordBinding: Binding<QuickRecordRequest?> {
        Binding(
            get: { horizontalSizeClass == .regular ? quickRecordRequest : nil },
            set: { quickRecordRequest = $0 }
        )
    }

    private func toggleTheme() {
        let current = repository.prefs.snapshot.themeMode
        let nextTheme: ThemeMode = {
            switch current {
            case .system: return .light
            case .light: return .dark
            case .dark: return .system
            }
        }()
        repository.prefs.setThemeMode(nextTheme)
    }

    private func selectLocale(_ nextLocale: String) {
        repository.prefs.setLocale(nextLocale)
        RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
        RecapNotificationManager.shared.refreshEveningReminderIfEnabled(logs: repository.logs, prefs: repository.prefs)
        SpotlightIndexManager.shared.syncLogs(repository.logs, locale: nextLocale)
        repository.prefs.updateWidgetSnapshot(from: repository.logs)
    }

    private func startBrowserHandoff() {
        if let url = repository.buildBrowserHandoffStartUrl() {
            openURL(url)
        }
    }

    private func openPublicDiscussion(_ discussionId: String, fromDeepLink: Bool = false) {
        selectedTogetherDiscussionId = discussionId
        hasExplicitTogetherSelection = true
        if currentViewportIsSpread {
            pendingDirectDiscussionId = discussionId
            overlayStack.removeAll()
            activeTab = .together
        } else if fromDeepLink {
            activeTab = .together
            overlayStack = [.publicDiscussion(discussionId)]
        } else {
            overlayStack.append(.publicDiscussion(discussionId))
        }
    }

    private func handleSpreadTransition(to isSpread: Bool) {
        let wasSpread = currentViewportIsSpread
        currentViewportIsSpread = isSpread
        guard wasSpread != isSpread else { return }
        if isSpread {
            // Compact -> Spread: promote open PublicDiscussion detail seamlessly into 2-column Together spread
            if case .publicDiscussion(let did) = overlayStack.last {
                _ = overlayStack.popLast()
                selectedTogetherDiscussionId = did
                pendingDirectDiscussionId = did
                hasExplicitTogetherSelection = true
                activeTab = .together
            }
        } else {
            // Spread -> Compact: preserve active discussion in single-screen flow if user selected one
            if activeTab == .together,
               overlayStack.isEmpty,
               hasExplicitTogetherSelection,
               let did = selectedTogetherDiscussionId {
                overlayStack = [.publicDiscussion(did)]
            }
        }
    }

    @ViewBuilder
    private func quickRecordModalContent(
        _ req: QuickRecordRequest,
        palette: OttlinePalette,
        locale: String,
        preferredScheme: ColorScheme?,
        viewportWidth: CGFloat
    ) -> some View {
        QuickRecordSheet(
            request: req,
            repository: repository,
            onDismiss: { quickRecordRequest = nil },
            onOpenTimeline: {
                overlayStack.removeAll()
                activeTab = .timeline
            },
            onOpenTitleDetail: { tid in
                overlayStack.append(.titleDetail(tid))
            },
            onOpenPublicDiscussion: { discussionId in
                openPublicDiscussion(discussionId)
            },
            onOpenShareCard: { log in
                rootShareCardLog = log
            }
        )
        .environment(\.ottlinePalette, palette)
        .environment(\.appLocale, locale)
        .environment(\.ottlineViewportWidth, viewportWidth)
        .preferredColorScheme(preferredScheme)
    }

    public var body: some View {
        let snap = repository.prefs.snapshot
        let isDark: Bool = {
            switch snap.themeMode {
            case .system:
                return systemColorScheme == .dark
            case .dark:
                return true
            case .light:
                return false
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

        GeometryReader { rootGeo in
            let fallbackWidth: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 1024 : 390
            let liveViewportWidth: CGFloat = rootGeo.size.width > 0 ? rootGeo.size.width : fallbackWidth
            let metrics = PadLayoutMetrics.resolve(
                horizontalSizeClass: horizontalSizeClass,
                viewportWidth: liveViewportWidth
            )

            ZStack {
                VStack(spacing: 0) {
                    if metrics.isSpread {
                        OttlinePadHeader(
                            repository: repository,
                            activeTab: activeTab,
                            themeMode: snap.themeMode,
                            viewportWidth: liveViewportWidth,
                            onSelectTab: { nextTab in
                                overlayStack.removeAll()
                                activeTab = nextTab
                            },
                            onQuickRecord: {
                                quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                            },
                            onToggleTheme: toggleTheme,
                            onSelectLocale: selectLocale
                        )
                    } else {
                        OttlineTopBar(
                            nickname: snap.nickname,
                            personaKey: snap.personaKey,
                            themeMode: snap.themeMode,
                            onLogoTap: {
                                overlayStack.removeAll()
                                activeTab = .home
                            },
                            onSelectLocale: selectLocale,
                            onToggleTheme: toggleTheme,
                            onProfileTap: {
                                overlayStack.removeAll()
                                activeTab = .mySpace
                            }
                        )
                    }

                    VStack(spacing: 0) {
                        ZStack {
                            tabContentView
                                .opacity(overlayStack.isEmpty ? 1 : 0)
                                .allowsHitTesting(overlayStack.isEmpty)
                                .accessibilityHidden(!overlayStack.isEmpty)

                            if let currentOverlay = overlayStack.last {
                                overlayView(for: currentOverlay)
                                    .id(currentOverlay)
                                    .background(palette.background.ignoresSafeArea())
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()

                        if !metrics.isSpread {
                            OttlineBottomBar(
                                activeTab: activeTab,
                                onSelectTab: { nextTab in
                                    overlayStack.removeAll()
                                    activeTab = nextTab
                                },
                                onQuickRecordTap: {
                                    quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                                }
                            )
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .background(palette.background.ignoresSafeArea())

                if showSplash {
                    OttlineIntroSplashOverlay(nickname: snap.nickname) {
                        showSplash = false
                    }
                }
            }
            .environment(\.ottlinePalette, palette)
            .environment(\.appLocale, snap.locale)
            .environment(\.ottlineViewportWidth, liveViewportWidth)
            .environment(\.openOttlineOverlay) { target in
                overlayStack.append(target)
            }
            .environment(\.openOttlineTab) { tab in
                overlayStack.removeAll()
                activeTab = tab
            }
            .fullScreenCover(item: compactQuickRecordBinding) { req in
                quickRecordModalContent(
                    req,
                    palette: palette,
                    locale: snap.locale,
                    preferredScheme: preferredScheme,
                    viewportWidth: liveViewportWidth
                )
            }
            .sheet(item: regularQuickRecordBinding) { req in
                quickRecordModalContent(
                    req,
                    palette: palette,
                    locale: snap.locale,
                    preferredScheme: preferredScheme,
                    viewportWidth: liveViewportWidth
                )
                .presentationDetents([.large])
            }
            .sheet(item: $rootShareCardLog) { log in
                ShareCardDialog(log: log, repository: repository)
                    .environment(\.ottlinePalette, palette)
                    .environment(\.appLocale, snap.locale)
                    .environment(\.ottlineViewportWidth, liveViewportWidth)
                    .preferredColorScheme(preferredScheme)
            }
            .onAppear {
                currentViewportIsSpread = metrics.isSpread
            }
            .onChange(of: metrics.isSpread) { nextSpread in
                handleSpreadTransition(to: nextSpread)
            }
        }
        .ignoresSafeArea(.keyboard)
        .preferredColorScheme(preferredScheme)
        .onOpenURL { url in
            handleIncomingUrl(url)
        }
        .alert(
            OttlineStrings.tr("브라우저 기록 연결", "Browser record connection", locale: snap.locale),
            isPresented: Binding(
                get: { handoffNoticeMessage != nil },
                set: { if !$0 { handoffNoticeMessage = nil } }
            )
        ) {
            Button(OttlineStrings.tr("확인", "OK", locale: snap.locale), role: .cancel) {
                handoffNoticeMessage = nil
            }
        } message: {
            Text(handoffNoticeMessage ?? "")
        }
        #if canImport(CoreSpotlight)
        .onContinueUserActivity(CSSearchableItemActionType) { activity in
            let identifier = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String
            if let titleId = SpotlightIndexManager.parseTitleId(from: identifier) {
                showSplash = false
                overlayStack = [.titleDetail(titleId)]
            }
        }
        #endif
        .onReceive(NotificationCenter.default.publisher(for: PendingIntentRouteStore.didEnqueueNotification)) { _ in
            if let pendingUrl = PendingIntentRouteStore.shared.consumePendingUrl() {
                handleIncomingUrl(pendingUrl)
            }
        }
        .onChange(of: scenePhase) { newPhase in
            if newPhase == .active {
                if let pendingUrl = PendingIntentRouteStore.shared.consumePendingUrl() {
                    handleIncomingUrl(pendingUrl)
                }
                if let sharedExtUrl = repository.prefs.consumeSharedExtensionPendingUrl() {
                    handleIncomingUrl(sharedExtUrl)
                }
                repository.initializeSessionAndSync()
                RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
                RecapNotificationManager.shared.refreshEveningReminderIfEnabled(logs: repository.logs, prefs: repository.prefs)
            }
        }
        .onAppear {
            RecapNotificationManager.shared.onOpenRoute = { route in
                if route.contains("report") {
                    overlayStack = [.report]
                }
            }
            RecapNotificationManager.shared.onOpenUrl = { url in
                handleIncomingUrl(url)
            }
            if let pendingUrl = PendingIntentRouteStore.shared.consumePendingUrl() {
                handleIncomingUrl(pendingUrl)
            }
            if let sharedExtUrl = repository.prefs.consumeSharedExtensionPendingUrl() {
                handleIncomingUrl(sharedExtUrl)
            }
            repository.initializeSessionAndSync()
            #if DEBUG
            if let debugUrlStr = ProcessInfo.processInfo.environment["OTTLINE_INITIAL_URL"],
               let debugUrl = URL(string: debugUrlStr) {
                handleIncomingUrl(debugUrl)
            }
            #endif
        }
    }

    @ViewBuilder
    private var tabContentView: some View {
        switch activeTab {
        case .home:
            HomeScreen(
                repository: repository,
                onOpenQuickRecord: { req in quickRecordRequest = req },
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) },
                onOpenTimeline: { activeTab = .timeline },
                onOpenTogether: { activeTab = .together },
                onOpenReport: { overlayStack.append(.report) },
                onOpenBookshelf: { overlayStack.append(.bookshelf(nil)) },
                onOpenTimelineWithMoment: { place, occ in
                    pendingPlaceFilter = place
                    pendingOccasionFilter = occ
                    activeTab = .timeline
                },
                onOpenMySpacePairing: {
                    autoExpandPairing = true
                    activeTab = .mySpace
                },
                onOpenPublicDiscussion: { did in
                    openPublicDiscussion(did)
                },
                onStartBrowserHandoff: startBrowserHandoff
            )

        case .timeline:
            TimelineScreen(
                repository: repository,
                initialPlaceFilter: pendingPlaceFilter,
                initialOccasionFilter: pendingOccasionFilter,
                onClearInitialMomentFilter: {
                    pendingPlaceFilter = nil
                    pendingOccasionFilter = nil
                },
                onOpenQuickRecord: { req in quickRecordRequest = req },
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) },
                onOpenReport: { overlayStack.append(.report) },
                onOpenBookshelf: { kdc in overlayStack.append(.bookshelf(kdc)) },
                onOpenShareCard: { log in rootShareCardLog = log }
            )

        case .together:
            TogetherScreen(
                repository: repository,
                selectedDiscussionId: $selectedTogetherDiscussionId,
                directDiscussionId: pendingDirectDiscussionId,
                onConsumeDirectDiscussion: { pendingDirectDiscussionId = nil },
                onExplicitSelectDiscussion: { _ in hasExplicitTogetherSelection = true },
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) },
                onOpenPublicDiscussion: { did in
                    selectedTogetherDiscussionId = did
                    hasExplicitTogetherSelection = true
                    overlayStack.append(.publicDiscussion(did))
                },
                onOpenQuickRecord: { req in quickRecordRequest = req },
                onReportUgc: { prefill in overlayStack.append(.feedback(prefill)) }
            )

        case .mySpace:
            MySpaceScreen(
                repository: repository,
                autoExpandPairing: autoExpandPairing,
                onConsumeAutoExpandPairing: { autoExpandPairing = false },
                onOpenReport: { overlayStack.append(.report) },
                onOpenBookshelf: { overlayStack.append(.bookshelf(nil)) },
                onOpenFeedback: { overlayStack.append(.feedback(nil)) },
                onOpenGuides: { overlayStack.append(.guides(nil)) },
                onOpenAbout: { overlayStack.append(.about) },
                onStartBrowserHandoff: startBrowserHandoff
            )
        }
    }

    @ViewBuilder
    private func overlayView(for screen: ActiveOverlayScreen) -> some View {
        switch screen {
        case .titleDetail(let tid):
            TitleDetailScreen(
                titleId: tid,
                repository: repository,
                onBack: { _ = overlayStack.popLast() },
                onOpenQuickRecord: { req in quickRecordRequest = req },
                onOpenTitleDetail: { nextTid in overlayStack.append(.titleDetail(nextTid)) },
                onOpenShareCard: { log in rootShareCardLog = log },
                onReportUgc: { prefill in overlayStack.append(.feedback(prefill)) }
            )
        case .publicDiscussion(let did):
            PublicDiscussionDetailScreen(
                discussionId: did,
                repository: repository,
                onBack: { _ = overlayStack.popLast() },
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) },
                onOpenQuickRecord: { req in quickRecordRequest = req }
            )
        case .report:
            ReportScreen(
                repository: repository,
                onBack: { _ = overlayStack.popLast() },
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) }
            )
        case .bookshelf(let kdcMajor):
            BookshelfScreen(
                repository: repository,
                initialKdcMajor: kdcMajor,
                onBack: { _ = overlayStack.popLast() },
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) },
                onOpenQuickRecordBook: {
                    quickRecordRequest = QuickRecordRequest(initialTypeTab: "book", autoFocusSearch: true)
                }
            )
        case .feedback(let prefill):
            FeedbackScreen(
                repository: repository,
                prefilledBody: prefill,
                onConsumePrefill: {},
                onBack: { _ = overlayStack.popLast() }
            )
        case .guides(let slug):
            GuideInfoScreen(
                initialSlug: slug,
                mode: .guides,
                onBack: { _ = overlayStack.popLast() }
            )
        case .about:
            GuideInfoScreen(
                mode: .about,
                onBack: { _ = overlayStack.popLast() }
            )
        case .faq:
            GuideInfoScreen(
                mode: .faq,
                onBack: { _ = overlayStack.popLast() }
            )
        case .privacy:
            GuideInfoScreen(
                mode: .privacy,
                onBack: { _ = overlayStack.popLast() }
            )
        }
    }

    // MARK: - Deep Link & Widget URL Routing (`ottline://` and `https://ottline.app`)

    private func handleIncomingUrl(_ url: URL) {
        showSplash = false
        switch OttlineDeepLinkParser.parse(url) {
        case .browserHandoff(let handoff):
            Task { @MainActor in
                let outcome = await repository.importBrowserHandoff(handoff)
                self.handoffNoticeMessage = outcome.message
            }
        case .quickRecord(let quick):
            if let titleId = quick.titleId,
               let existing = repository.logs.first(where: { $0.title.id == titleId }) {
                quickRecordRequest = QuickRecordRequest(
                    existingLog: existing,
                    prefilledPlatform: quick.platform,
                    autoFocusSearch: false
                )
            } else {
                quickRecordRequest = QuickRecordRequest(
                    initialQuery: quick.query,
                    initialTypeTab: quick.typeTab,
                    prefilledPlatform: quick.platform,
                    autoFocusSearch: true
                )
            }
        case .tab(let tab):
            overlayStack.removeAll()
            activeTab = tab
        case .overlay(let screen):
            if case .publicDiscussion(let did) = screen {
                openPublicDiscussion(did, fromDeepLink: true)
            } else if case .titleDetail = screen {
                overlayStack.append(screen)
            } else {
                overlayStack = [screen]
            }
        case .unknown:
            break
        }
    }
}
