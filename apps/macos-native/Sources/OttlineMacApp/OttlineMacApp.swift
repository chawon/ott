import Combine
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
    public var handoffBannerMessage: String?
    public var handoffBannerIsSuccess: Bool = true
    public var isImportingBrowserHandoff: Bool = false

    public init() {}

    public func startBrowserHandoff(repository: OttlineRepository) {
        guard let url = repository.buildBrowserHandoffStartUrl() else { return }
        NSWorkspace.shared.open(url)
    }

    public func handleIncomingUrl(_ url: URL, repository: OttlineRepository) {
        switch OttlineDeepLinkParser.parse(url) {
        case .browserHandoff(let handoff):
            if !OttlineMacApp.isRunningUnitTests {
                NSApplication.shared.activate(ignoringOtherApps: true)
            }
            isImportingBrowserHandoff = true
            handoffBannerMessage = nil
            Task { @MainActor in
                let outcome = await repository.importBrowserHandoff(handoff)
                self.isImportingBrowserHandoff = false
                self.handoffBannerIsSuccess = outcome.success
                self.handoffBannerMessage = outcome.message
            }
        case .quickRecord(let quick):
            if !OttlineMacApp.isRunningUnitTests {
                NSApplication.shared.activate(ignoringOtherApps: true)
            }
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

private final class MacRepositoryHolder: ObservableObject {
    let repository: OttlineRepository?
    private var cancellable: AnyCancellable?

    init() {
        guard !OttlineMacApp.isRunningUnitTests else {
            self.repository = nil
            return
        }
        let prefs = AppPreferences()
        let db = OttlineDatabase()
        let api = OttlineApiClient(prefs: prefs)
        let repo = OttlineRepository(db: db, prefs: prefs, api: api)
        self.repository = repo
        self.cancellable = repo.objectWillChange.sink { [weak self] _ in
            if Thread.isMainThread {
                self?.objectWillChange.send()
            } else {
                DispatchQueue.main.async {
                    self?.objectWillChange.send()
                }
            }
        }
    }
}

@main
public struct OttlineMacApp: App {
    static let isRunningUnitTests =
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil

    @StateObject private var repoHolder = MacRepositoryHolder()
    @State private var appState = OttlineMacAppState()

    private var repository: OttlineRepository? { repoHolder.repository }

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
