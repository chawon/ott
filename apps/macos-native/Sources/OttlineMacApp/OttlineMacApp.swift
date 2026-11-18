import SwiftUI
import AppKit
import CoreText
import OttlineCore
#if canImport(CoreSpotlight)
import CoreSpotlight
#endif

@Observable
public final class OttlineMacAppState {
    public var activeTab: TopLevelTab = .home
    public var overlayStack: [ActiveOverlayScreen] = []
    public var quickRecordRequest: QuickRecordRequest?
    public var shareCardLog: WatchLog?
    public var pendingPlaceFilter: Place?
    public var pendingOccasionFilter: Occasion?
    public var autoExpandPairing: Bool = false

    public init() {}

    public func handleIncomingUrl(_ url: URL, repository: OttlineRepository) {
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
            let rawPlat = qVal("platform")?.trimmingCharacters(in: .whitespacesAndNewlines)
            let plat = (rawPlat?.isEmpty == false) ? rawPlat : nil
            if let titleId = qVal("title_id"),
               let existing = repository.logs.first(where: { $0.title.id == titleId }) {
                quickRecordRequest = QuickRecordRequest(
                    existingLog: existing,
                    prefilledPlatform: plat,
                    autoFocusSearch: false
                )
            } else {
                quickRecordRequest = QuickRecordRequest(
                    initialQuery: qVal("q") ?? "",
                    initialTypeTab: typeTab,
                    prefilledPlatform: plat,
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
            overlayStack = [.guides(rawPath.split(separator: "/").last.map(String.init))]
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

@main
public struct OttlineMacApp: App {
    private static let isRunningUnitTests =
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil

    @State private var repository: OttlineRepository? = {
        guard !OttlineMacApp.isRunningUnitTests else { return nil }
        let prefs = AppPreferences()
        let db = OttlineDatabase()
        let api = OttlineApiClient(prefs: prefs)
        return OttlineRepository(db: db, prefs: prefs, api: api)
    }()
    @State private var appState = OttlineMacAppState()

    public init() {
        Self.registerBundledFonts()
        if !Self.isRunningUnitTests {
            RecapNotificationManager.shared.configureDelegate()
        }
    }

    public var body: some Scene {
        let locale = repository?.prefs.snapshot.locale ?? "ko"

        WindowGroup("ottline", id: "main") {
            if let repository {
                MacRootSpreadView(repository: repository, appState: appState)
                    .frame(minWidth: 920, minHeight: 640)
                    .onOpenURL { url in
                        appState.handleIncomingUrl(url, repository: repository)
                    }
                    #if canImport(CoreSpotlight)
                    .onContinueUserActivity(CSSearchableItemActionType) { activity in
                        let identifier = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String
                        if let titleId = SpotlightIndexManager.parseTitleId(from: identifier) {
                            appState.overlayStack = [.titleDetail(titleId)]
                        }
                    }
                    #endif
            } else {
                EmptyView()
            }
        }
        .defaultSize(width: 1220, height: 820)
        .commands {
            CommandGroup(after: .newItem) {
                Button(OttlineStrings.tr("새 기록 남기기", "New Record", locale: locale)) {
                    appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                }
                .keyboardShortcut("n", modifiers: .command)
            }
            CommandMenu(OttlineStrings.tr("이동", "Navigate", locale: locale)) {
                Button(OttlineStrings.tr("홈", "Home", locale: locale)) {
                    appState.overlayStack.removeAll()
                    appState.activeTab = .home
                }
                .keyboardShortcut("1", modifiers: .command)

                Button(OttlineStrings.tr("타임라인", "Timeline", locale: locale)) {
                    appState.overlayStack.removeAll()
                    appState.activeTab = .timeline
                }
                .keyboardShortcut("2", modifiers: .command)

                Button(OttlineStrings.tr("함께", "Together", locale: locale)) {
                    appState.overlayStack.removeAll()
                    appState.activeTab = .together
                }
                .keyboardShortcut("3", modifiers: .command)

                Button(OttlineStrings.tr("내 공간", "My Space", locale: locale)) {
                    appState.overlayStack.removeAll()
                    appState.activeTab = .mySpace
                }
                .keyboardShortcut("4", modifiers: .command)

                Divider()

                Button(OttlineStrings.tr("지금 동기화", "Sync Now", locale: locale)) {
                    repository?.triggerSyncAsync()
                }
                .keyboardShortcut("r", modifiers: .command)
            }
        }

        MenuBarExtra(
            isInserted: Binding(
                get: { repository?.prefs.snapshot.macosMenuBarEnabled ?? false },
                set: { repository?.prefs.setMacosMenuBarEnabled($0) }
            )
        ) {
            if let repository {
                MacMenuBarQuickLogView(repository: repository, appState: appState)
            } else {
                EmptyView()
            }
        } label: {
            Image("menubar_icon")
                .renderingMode(.template)
                .accessibilityLabel("ottline")
        }
        .menuBarExtraStyle(.window)
    }

    private static func registerBundledFonts() {
        let fontNames = [
            "Pretendard-Regular",
            "Pretendard-Medium",
            "Pretendard-SemiBold",
            "Pretendard-Bold",
            "Pretendard-ExtraBold"
        ]
        for name in fontNames {
            if let url = Bundle.main.url(forResource: name, withExtension: "otf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}
