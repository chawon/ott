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

public struct OttlineRootContainerView: View {
    public let repository: OttlineRepository

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var systemColorScheme
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

    public init(repository: OttlineRepository) {
        self.repository = repository
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
                OttlineTopBar(
                    nickname: snap.nickname,
                    personaKey: snap.personaKey,
                    themeMode: snap.themeMode,
                    onLogoTap: {
                        overlayStack.removeAll()
                        activeTab = .home
                    },
                    onSelectLocale: { nextLocale in
                        repository.prefs.setLocale(nextLocale)
                        RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
                        RecapNotificationManager.shared.refreshEveningReminderIfEnabled(logs: repository.logs, prefs: repository.prefs)
                        SpotlightIndexManager.shared.syncLogs(repository.logs, locale: nextLocale)
                        repository.prefs.updateWidgetSnapshot(from: repository.logs)
                    },
                    onToggleTheme: {
                        let nextTheme: ThemeMode = {
                            switch snap.themeMode {
                            case .system: return .light
                            case .light: return .dark
                            case .dark: return .system
                            }
                        }()
                        repository.prefs.setThemeMode(nextTheme)
                    },
                    onProfileTap: {
                        overlayStack.removeAll()
                        activeTab = .mySpace
                    }
                )

                ZStack(alignment: .bottom) {
                    ZStack {
                        if let currentOverlay = overlayStack.last {
                            overlayView(for: currentOverlay)
                        } else {
                            tabContentView
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

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
        .environment(\.openOttlineOverlay) { target in
            overlayStack.append(target)
        }
        .environment(\.openOttlineTab) { tab in
            overlayStack.removeAll()
            activeTab = tab
        }
        .preferredColorScheme(preferredScheme)
        .fullScreenCover(item: $quickRecordRequest) { req in
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
            .environment(\.appLocale, snap.locale)
            .preferredColorScheme(preferredScheme)
        }
        .sheet(item: $rootShareCardLog) { log in
            ShareCardDialog(log: log, repository: repository)
                .environment(\.ottlinePalette, palette)
                .environment(\.appLocale, snap.locale)
                .preferredColorScheme(preferredScheme)
        }
        .onOpenURL { url in
            handleIncomingUrl(url)
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
                }
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
                onOpenAbout: { overlayStack.append(.about) }
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
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []
        func qVal(_ name: String) -> String? {
            queryItems.first(where: { $0.name == name })?.value
        }

        let rawPath = url.path
        let path = rawPath.lowercased()
        let host = (url.host ?? "").lowercased()

        if host == "quick-record" || qVal("quick") == "1" {
            let typeTab = qVal("type") ?? "all"
            let rawPlatform = qVal("platform")?.trimmingCharacters(in: .whitespacesAndNewlines)
            let prefilledPlatform = (rawPlatform?.isEmpty == false) ? rawPlatform : nil
            if let titleId = qVal("title_id"), let existing = repository.logs.first(where: { $0.title.id == titleId }) {
                quickRecordRequest = QuickRecordRequest(
                    existingLog: existing,
                    prefilledPlatform: prefilledPlatform,
                    autoFocusSearch: false
                )
            } else {
                let sharedQuery = qVal("q") ?? ""
                quickRecordRequest = QuickRecordRequest(
                    initialQuery: sharedQuery,
                    initialTypeTab: typeTab,
                    prefilledPlatform: prefilledPlatform,
                    autoFocusSearch: true
                )
            }
            return
        }

        if host == "timeline" || path.contains("/timeline") {
            overlayStack.removeAll()
            activeTab = .timeline
        } else if host == "together" || path == "/public" || path.hasSuffix("/public") {
            overlayStack.removeAll()
            activeTab = .together
        } else if path.contains("/public/") {
            if let did = rawPath.split(separator: "/").last.map(String.init), !did.isEmpty {
                overlayStack = [.publicDiscussion(did)]
            }
        } else if host == "account" || path.contains("/account") || path.contains("/myspace") {
            overlayStack.removeAll()
            activeTab = .mySpace
        } else if host == "report" || path.contains("/report") {
            overlayStack = [.report]
        } else if host == "bookshelf" || path.contains("/bookshelf") {
            let kdc = qVal("kdc").flatMap(Int.init)
            overlayStack = [.bookshelf(kdc)]
        } else if path.contains("/titles/") || path.contains("/title/") {
            if let tid = rawPath.split(separator: "/").last.map(String.init), !tid.isEmpty {
                overlayStack.append(.titleDetail(tid))
            }
        } else if path.contains("/guide/") {
            let slug = rawPath.split(separator: "/").last.map(String.init)
            overlayStack = [.guides(slug)]
        } else if path.hasSuffix("/guide") {
            overlayStack = [.guides(nil)]
        } else if path.contains("/about") {
            overlayStack = [.about]
        } else if path.contains("/faq") {
            overlayStack = [.faq]
        } else if path.contains("/privacy") {
            overlayStack = [.privacy]
        } else if path.contains("/feedback") {
            overlayStack = [.feedback(nil)]
        }
    }
}
