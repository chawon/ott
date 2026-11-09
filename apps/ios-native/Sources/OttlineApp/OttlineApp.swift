import SwiftUI

public enum ActiveOverlayScreen: Equatable, Sendable {
    case titleDetail(String)
    case report
    case bookshelf
    case feedback(String?)
    case guides
}

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
    @State private var activeTab: TopLevelTab = .home
    @State private var overlayStack: [ActiveOverlayScreen] = []
    @State private var quickRecordRequest: QuickRecordRequest?
    @State private var showSplash: Bool = true
    @State private var autoExpandPairing: Bool = false
    @State private var pendingPlaceFilter: Place?
    @State private var pendingOccasionFilter: Occasion?

    public init(repository: OttlineRepository) {
        self.repository = repository
    }

    public var body: some View {
        let snap = repository.prefs.snapshot
        let palette = snap.themeMode == .dark ? OttlinePalette.dark : OttlinePalette.light

        ZStack {
            VStack(spacing: 0) {
                if overlayStack.isEmpty {
                    OttlineTopBar(
                        nickname: snap.nickname,
                        personaKey: snap.personaKey,
                        onLogoTap: { activeTab = .home },
                        onSelectLocale: { nextLocale in
                            repository.prefs.setLocale(nextLocale)
                            RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
                        },
                        onToggleTheme: {
                            let nextTheme: ThemeMode = snap.themeMode == .dark ? .light : .dark
                            repository.prefs.setThemeMode(nextTheme)
                        },
                        onProfileTap: { activeTab = .mySpace }
                    )
                }

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
            .background(palette.background.ignoresSafeArea())

            if showSplash {
                OttlineIntroSplashOverlay {
                    showSplash = false
                }
            }
        }
        .environment(\.ottlinePalette, palette)
        .environment(\.appLocale, snap.locale)
        .preferredColorScheme(snap.themeMode == .dark ? .dark : .light)
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
                }
            )
            .environment(\.ottlinePalette, palette)
            .environment(\.appLocale, snap.locale)
        }
        .onOpenURL { url in
            handleIncomingUrl(url)
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                repository.initializeSessionAndSync()
                RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
            }
        }
        .onAppear {
            RecapNotificationManager.shared.onOpenRoute = { route in
                if route.contains("report") {
                    overlayStack = [.report]
                }
            }
            repository.initializeSessionAndSync()
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
                onOpenBookshelf: { overlayStack.append(.bookshelf) },
                onOpenTimelineWithMoment: { place, occ in
                    pendingPlaceFilter = place
                    pendingOccasionFilter = occ
                    activeTab = .timeline
                },
                onOpenMySpacePairing: {
                    autoExpandPairing = true
                    activeTab = .mySpace
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
                onOpenBookshelf: { overlayStack.append(.bookshelf) }
            )

        case .together:
            TogetherScreen(
                repository: repository,
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) },
                onOpenQuickRecord: { req in quickRecordRequest = req },
                onReportUgc: { prefill in overlayStack.append(.feedback(prefill)) }
            )

        case .mySpace:
            MySpaceScreen(
                repository: repository,
                autoExpandPairing: autoExpandPairing,
                onConsumeAutoExpandPairing: { autoExpandPairing = false },
                onOpenReport: { overlayStack.append(.report) },
                onOpenBookshelf: { overlayStack.append(.bookshelf) },
                onOpenFeedback: { overlayStack.append(.feedback(nil)) },
                onOpenGuides: { overlayStack.append(.guides) }
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
                onReportUgc: { prefill in overlayStack.append(.feedback(prefill)) }
            )
        case .report:
            ReportScreen(
                repository: repository,
                onBack: { _ = overlayStack.popLast() },
                onOpenTitleDetail: { tid in overlayStack.append(.titleDetail(tid)) }
            )
        case .bookshelf:
            BookshelfScreen(
                repository: repository,
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
        case .guides:
            GuideInfoScreen(
                onBack: { _ = overlayStack.popLast() }
            )
        }
    }

    // MARK: - Deep Link & Widget URL Routing (`ottline://` and `https://ottline.app`)

    private func handleIncomingUrl(_ url: URL) {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []
        func qVal(_ name: String) -> String? {
            queryItems.first(where: { $0.name == name })?.value
        }

        let path = url.path.lowercased()
        let host = (url.host ?? "").lowercased()

        if host == "quick-record" || qVal("quick") == "1" {
            let typeTab = qVal("type") ?? "all"
            if let titleId = qVal("title_id"), let existing = repository.logs.first(where: { $0.title.id == titleId }) {
                quickRecordRequest = QuickRecordRequest(existingLog: existing, autoFocusSearch: false)
            } else {
                let sharedQuery = qVal("q") ?? ""
                quickRecordRequest = QuickRecordRequest(
                    initialQuery: sharedQuery,
                    initialTypeTab: typeTab,
                    autoFocusSearch: true
                )
            }
            return
        }

        if host == "timeline" || path.contains("/timeline") {
            overlayStack.removeAll()
            activeTab = .timeline
        } else if host == "together" || path.contains("/together") {
            overlayStack.removeAll()
            activeTab = .together
        } else if host == "report" || path.contains("/report") {
            overlayStack = [.report]
        } else if host == "bookshelf" || path.contains("/bookshelf") {
            overlayStack = [.bookshelf]
        } else if path.contains("/titles/") {
            if let tid = url.pathComponents.last, !tid.isEmpty {
                overlayStack.append(.titleDetail(tid))
            }
        }
    }
}
