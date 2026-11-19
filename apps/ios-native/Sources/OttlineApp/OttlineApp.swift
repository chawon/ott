import SwiftUI
import OttlineCore
#if canImport(CoreSpotlight)
import CoreSpotlight
#endif

@main
public struct OttlineApp: App {
    @State private var repository: OttlineRepository = {
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

private struct OttlineRootWidthPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 390
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        let next = nextValue()
        if next > 0 { value = next }
    }
}

public struct OttlineRootContainerView: View {
    public let repository: OttlineRepository

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var systemColorScheme
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.openURL) private var openURL
    @State private var viewportWidth: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 1024 : 390
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

    public init(repository: OttlineRepository) {
        self.repository = repository
    }

    private var metrics: PadLayoutMetrics {
        PadLayoutMetrics.resolve(horizontalSizeClass: horizontalSizeClass, viewportWidth: viewportWidth)
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

    @ViewBuilder
    private func quickRecordModalContent(_ req: QuickRecordRequest, palette: OttlinePalette, locale: String, preferredScheme: ColorScheme?) -> some View {
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
                overlayStack.append(.publicDiscussion(discussionId))
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

        ZStack {
            VStack(spacing: 0) {
                if metrics.isSpread {
                    OttlinePadHeader(
                        repository: repository,
                        activeTab: activeTab,
                        themeMode: snap.themeMode,
                        viewportWidth: viewportWidth,
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

                ZStack(alignment: .bottom) {
                    ZStack {
                        if let currentOverlay = overlayStack.last {
                            overlayView(for: currentOverlay)
                        } else {
                            tabContentView
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

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
        .background {
            GeometryReader { proxy in
                Color.clear
                    .preference(key: OttlineRootWidthPreferenceKey.self, value: proxy.size.width)
            }
            .ignoresSafeArea()
        }
        .onPreferenceChange(OttlineRootWidthPreferenceKey.self) { nextWidth in
            if abs(nextWidth - viewportWidth) > 0.5 {
                viewportWidth = nextWidth
            }
        }
        .environment(\.ottlinePalette, palette)
        .environment(\.appLocale, snap.locale)
        .environment(\.ottlineViewportWidth, viewportWidth)
        .environment(\.openOttlineOverlay) { target in
            overlayStack.append(target)
        }
        .environment(\.openOttlineTab) { tab in
            overlayStack.removeAll()
            activeTab = tab
        }
        .preferredColorScheme(preferredScheme)
        .fullScreenCover(item: compactQuickRecordBinding) { req in
            quickRecordModalContent(req, palette: palette, locale: snap.locale, preferredScheme: preferredScheme)
        }
        .sheet(item: regularQuickRecordBinding) { req in
            quickRecordModalContent(req, palette: palette, locale: snap.locale, preferredScheme: preferredScheme)
                .presentationDetents([.large])
        }
        .sheet(item: $rootShareCardLog) { log in
            ShareCardDialog(log: log, repository: repository)
                .environment(\.ottlinePalette, palette)
                .environment(\.appLocale, snap.locale)
                .environment(\.ottlineViewportWidth, viewportWidth)
                .preferredColorScheme(preferredScheme)
        }
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
        .onChange(of: scenePhase) { _, newPhase in
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
                    overlayStack.append(.publicDiscussion(did))
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
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) },
                onOpenPublicDiscussion: { did in overlayStack.append(.publicDiscussion(did)) },
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
            if case .titleDetail = screen {
                overlayStack.append(screen)
            } else {
                overlayStack = [screen]
            }
        case .unknown:
            break
        }
    }
}
