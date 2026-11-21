import Foundation
import OttlineCore
#if canImport(AppIntents)
import AppIntents
#endif

// MARK: - App Intents & Apple Shortcuts (`Shortcuts`, `Siri`, `Action Button`)

#if canImport(AppIntents)
public enum OttShortcutPlatform: String, AppEnum, CaseIterable, Sendable {
    case unspecified
    case netflix
    case disneyPlus
    case tving
    case wavve
    case coupangPlay
    case watcha
    case appleTv
    case primeVideo
    case kyobo
    case ridi
    case millie
    case aladin
    case kindle
    case audible

    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "플랫폼"

    public static var caseDisplayRepresentations: [OttShortcutPlatform: DisplayRepresentation] = [
        .unspecified: "선택 안 함",
        .netflix: "넷플릭스 (Netflix)",
        .disneyPlus: "디즈니플러스 (Disney+)",
        .tving: "티빙 (TVING)",
        .wavve: "웨이브 (Wavve)",
        .coupangPlay: "쿠팡플레이",
        .watcha: "왓챠 (WATCHA)",
        .appleTv: "애플티비 (Apple TV+)",
        .primeVideo: "프라임비디오 (Prime Video)",
        .kyobo: "교보문고",
        .ridi: "리디 (RIDI)",
        .millie: "밀리의서재",
        .aladin: "알라딘",
        .kindle: "Kindle",
        .audible: "Audible"
    ]

    public func resolvedPlatformName(locale: String) -> String? {
        let isEn = locale == "en"
        switch self {
        case .unspecified: return nil
        case .netflix: return isEn ? "Netflix" : "넷플릭스"
        case .disneyPlus: return isEn ? "Disney+" : "디즈니플러스"
        case .tving: return "티빙"
        case .wavve: return "웨이브"
        case .coupangPlay: return "쿠팡플레이"
        case .watcha: return "왓챠"
        case .appleTv: return isEn ? "Apple TV+" : "애플티비"
        case .primeVideo: return isEn ? "Prime Video" : "프라임비디오"
        case .kyobo: return "교보문고"
        case .ridi: return "리디"
        case .millie: return "밀리의서재"
        case .aladin: return "알라딘"
        case .kindle: return "Kindle"
        case .audible: return "Audible"
        }
    }

    public var defaultTypeTab: String {
        switch self {
        case .kyobo, .ridi, .millie, .aladin, .kindle, .audible:
            return "book"
        default:
            return "all"
        }
    }
}

public enum OttShortcutCategory: String, AppEnum, CaseIterable, Sendable {
    case all
    case movie
    case series
    case book

    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "분류"

    public static var caseDisplayRepresentations: [OttShortcutCategory: DisplayRepresentation] = [
        .all: "전체",
        .movie: "영화",
        .series: "시리즈",
        .book: "책"
    ]
}

public struct SendWatchReminderNotificationIntent: AppIntent {
    public static var title: LocalizedStringResource = "시청·독서 후 기록 알림 보내기"
    public static var description = IntentDescription("넷플릭스·티빙·밀리의서재 등 앱을 닫을 때 자동화로 연결해 두면, 방금 본 작품을 기록할지 알림으로 물어봐요.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "플랫폼", default: OttShortcutPlatform.unspecified)
    public var platform: OttShortcutPlatform

    @Parameter(title: "최근 2시간 내 중복 알림 생략", default: true)
    public var respectCooldown: Bool

    public init() {}

    public func perform() async throws -> some IntentResult {
        let locale = UserDefaults(suiteName: AppPreferences.appGroupId)?.string(forKey: "ottline.v2.locale")
            ?? UserDefaults.standard.string(forKey: "ottline.v2.locale")
            ?? "ko"
        _ = await RecapNotificationManager.shared.scheduleWatchPromptNotification(
            platformLabel: platform.resolvedPlatformName(locale: locale),
            typeTab: platform.defaultTypeTab,
            locale: locale,
            respectCooldown: respectCooldown,
            delaySeconds: 1.0
        )
        return .result()
    }
}

public struct OpenQuickRecordIntent: AppIntent {
    public static var title: LocalizedStringResource = "빠른 기록 열기"
    public static var description = IntentDescription("ottline을 열고 영화·시리즈·책 빠른 기록 화면으로 바로 이동해요.")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "분류", default: OttShortcutCategory.all)
    public var category: OttShortcutCategory

    @Parameter(title: "플랫폼", default: OttShortcutPlatform.unspecified)
    public var platform: OttShortcutPlatform

    @Parameter(title: "검색어")
    public var query: String?

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        let locale = UserDefaults(suiteName: AppPreferences.appGroupId)?.string(forKey: "ottline.v2.locale")
            ?? UserDefaults.standard.string(forKey: "ottline.v2.locale")
            ?? "ko"
        var urlStr = "ottline://quick-record?quick=1&type=\(category.rawValue)"
        if let p = platform.resolvedPlatformName(locale: locale),
           let enc = p.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            urlStr += "&platform=\(enc)"
        }
        if let q = query?.trimmingCharacters(in: .whitespacesAndNewlines),
           !q.isEmpty,
           let enc = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            urlStr += "&q=\(enc)"
        }
        if let url = URL(string: urlStr) {
            PendingIntentRouteStore.shared.enqueue(url)
        }
        return .result()
    }
}

public struct OpenContinueWatchingIntent: AppIntent {
    public static var title: LocalizedStringResource = "이어보는 작품 기록 열기"
    public static var description = IntentDescription("지금 보는 중이거나 읽는 중인 작품의 기록 화면을 바로 열어요.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        let data = UserDefaults(suiteName: AppPreferences.appGroupId)?.data(forKey: AppPreferences.widgetSnapshotKey)
            ?? UserDefaults.standard.data(forKey: AppPreferences.widgetSnapshotKey)
        if let data,
           let snap = try? JSONDecoder().decode(SharedWidgetSnapshot.self, from: data),
           let cont = snap.continueItem,
           let encodedId = cont.titleId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: "ottline://quick-record?quick=1&title_id=\(encodedId)") {
            PendingIntentRouteStore.shared.enqueue(url)
        } else if let fallback = URL(string: "ottline://quick-record?quick=1") {
            PendingIntentRouteStore.shared.enqueue(fallback)
        }
        return .result()
    }
}

public struct OttlineShortcutsProvider: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenQuickRecordIntent(),
            phrases: [
                "\(.applicationName) 빠른 기록 열기",
                "Keep a story in \(.applicationName)"
            ]
        )
        AppShortcut(
            intent: OpenContinueWatchingIntent(),
            phrases: [
                "\(.applicationName) 이어보는 작품 열기",
                "Continue watching in \(.applicationName)"
            ]
        )
        AppShortcut(
            intent: SendWatchReminderNotificationIntent(),
            phrases: [
                "\(.applicationName) 시청 기록 알림 보내기",
                "Remind me to log in \(.applicationName)"
            ]
        )
    }
}
#endif
