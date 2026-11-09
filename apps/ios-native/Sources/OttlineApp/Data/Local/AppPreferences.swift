import Foundation
import Observation
import Security
#if canImport(WidgetKit)
import WidgetKit
#endif

public enum ThemeMode: String, Codable, CaseIterable, Sendable {
    case light = "LIGHT"
    case dark = "DARK"
}

public struct PreferencesSnapshot: Equatable, Sendable {
    public var userId: String?
    public var deviceId: String?
    public var pairingCode: String?
    public var nickname: String?
    public var personaKey: PersonaKey?
    public var locale: String
    public var themeMode: ThemeMode
    public var apiBaseUrl: String
    public var analyticsClientId: String
    public var sessionId: String
    public var lastSyncSince: String?
    public var customVideoPlatforms: [String]
    public var customBookPlatforms: [String]
    public var singleDeviceCodeReminderShown: Bool
    public var recapNotificationsEnabled: Bool
    public var homeSelectedMonth: String
    public var legacyMigrationCompleted: Bool

    public init(
        userId: String? = nil,
        deviceId: String? = nil,
        pairingCode: String? = nil,
        nickname: String? = nil,
        personaKey: PersonaKey? = nil,
        locale: String = "ko",
        themeMode: ThemeMode = .light,
        apiBaseUrl: String = "https://ottline.app",
        analyticsClientId: String = UUID().uuidString.lowercased(),
        sessionId: String = UUID().uuidString.lowercased(),
        lastSyncSince: String? = nil,
        customVideoPlatforms: [String] = [],
        customBookPlatforms: [String] = [],
        singleDeviceCodeReminderShown: Bool = false,
        recapNotificationsEnabled: Bool = false,
        homeSelectedMonth: String = RecordDate.monthKey(nil),
        legacyMigrationCompleted: Bool = false
    ) {
        self.userId = userId
        self.deviceId = deviceId
        self.pairingCode = pairingCode
        self.nickname = nickname
        self.personaKey = personaKey
        self.locale = locale
        self.themeMode = themeMode
        self.apiBaseUrl = apiBaseUrl
        self.analyticsClientId = analyticsClientId
        self.sessionId = sessionId
        self.lastSyncSince = lastSyncSince
        self.customVideoPlatforms = customVideoPlatforms
        self.customBookPlatforms = customBookPlatforms
        self.singleDeviceCodeReminderShown = singleDeviceCodeReminderShown
        self.recapNotificationsEnabled = recapNotificationsEnabled
        self.homeSelectedMonth = homeSelectedMonth
        self.legacyMigrationCompleted = legacyMigrationCompleted
    }
}

// Shared Widget Snapshot stored in App Group UserDefaults (`group.app.ottline`)
public struct SharedWidgetSnapshot: Codable, Equatable, Sendable {
    public struct ContinueItem: Codable, Equatable, Sendable {
        public var titleId: String
        public var titleName: String
        public var isBook: Bool
        public var isInProgress: Bool
        public var metaText: String
        public var noteSnippet: String
    }

    public struct RecentItem: Codable, Equatable, Sendable {
        public var titleId: String
        public var titleName: String
        public var statusLabel: String
    }

    public var isEnglish: Bool
    public var monthBadge: String
    public var continueItem: ContinueItem?
    public var recentItems: [RecentItem]

    public init(
        isEnglish: Bool = false,
        monthBadge: String = "타임라인",
        continueItem: ContinueItem? = nil,
        recentItems: [RecentItem] = []
    ) {
        self.isEnglish = isEnglish
        self.monthBadge = monthBadge
        self.continueItem = continueItem
        self.recentItems = recentItems
    }
}

@Observable
public final class AppPreferences {
    public static let productionApiBaseUrl = "https://ottline.app"
    public static let appGroupId = "group.app.ottline"
    public static let widgetSnapshotKey = "ottline.widget.snapshot.v2"

    private let defaults: UserDefaults
    private let groupDefaults: UserDefaults?
    private let keychainService: String
    public let sessionId: String = UUID().uuidString.lowercased()

    public private(set) var snapshot: PreferencesSnapshot

    public init(
        defaults: UserDefaults = .standard,
        groupDefaults: UserDefaults? = UserDefaults(suiteName: AppPreferences.appGroupId),
        keychainService: String = "app.ottline.v2.auth"
    ) {
        self.defaults = defaults
        self.groupDefaults = groupDefaults
        self.keychainService = keychainService
        self.snapshot = Self.loadSnapshot(
            defaults: defaults,
            keychainService: keychainService,
            sessionId: sessionId
        )
    }

    private static func loadSnapshot(
        defaults: UserDefaults,
        keychainService: String,
        sessionId: String
    ) -> PreferencesSnapshot {
        let userId = readKeychain(service: keychainService, key: "user_id")
            ?? defaults.string(forKey: "ottline.v2.user_id")
        let deviceId = readKeychain(service: keychainService, key: "device_id")
            ?? defaults.string(forKey: "ottline.v2.device_id")
        let pairingCode = readKeychain(service: keychainService, key: "pairing_code")
            ?? defaults.string(forKey: "ottline.v2.pairing_code")

        var clientId = readKeychain(service: keychainService, key: "analytics_client_id")
            ?? defaults.string(forKey: "ottline.v2.analytics_client_id")
            ?? ""
        if clientId.isEmpty {
            clientId = UUID().uuidString.lowercased()
            defaults.set(clientId, forKey: "ottline.v2.analytics_client_id")
            writeKeychain(service: keychainService, key: "analytics_client_id", value: clientId)
        }

        let sysLang = Locale.preferredLanguages.first?.lowercased() ?? "ko"
        let defaultLocale = sysLang.hasPrefix("ko") ? "ko" : "en"
        let locale = defaults.string(forKey: "ottline.v2.locale") ?? defaultLocale
        let themeRaw = defaults.string(forKey: "ottline.v2.theme_mode") ?? ThemeMode.light.rawValue
        let themeMode = ThemeMode(rawValue: themeRaw) ?? .light

        #if DEBUG
        let apiBase = defaults.string(forKey: "ottline.v2.api_base_url")
            .flatMap { $0.isEmpty ? nil : $0 } ?? productionApiBaseUrl
        #else
        let apiBase = productionApiBaseUrl
        #endif

        let videoPlatforms = defaults.stringArray(forKey: "ottline.v2.custom_video_platforms") ?? []
        let bookPlatforms = defaults.stringArray(forKey: "ottline.v2.custom_book_platforms") ?? []

        return PreferencesSnapshot(
            userId: userId,
            deviceId: deviceId,
            pairingCode: pairingCode,
            nickname: defaults.string(forKey: "ottline.v2.nickname"),
            personaKey: PersonaKey.fromWire(defaults.string(forKey: "ottline.v2.persona_key")),
            locale: locale,
            themeMode: themeMode,
            apiBaseUrl: apiBase,
            analyticsClientId: clientId,
            sessionId: sessionId,
            lastSyncSince: defaults.string(forKey: "ottline.v2.last_sync_since"),
            customVideoPlatforms: videoPlatforms,
            customBookPlatforms: bookPlatforms,
            singleDeviceCodeReminderShown: defaults.bool(forKey: "ottline.v2.single_device_reminder_shown"),
            recapNotificationsEnabled: defaults.bool(forKey: "ottline.v2.recap_notifications_enabled"),
            homeSelectedMonth: defaults.string(forKey: "ottline.v2.home_selected_month") ?? RecordDate.monthKey(nil),
            legacyMigrationCompleted: defaults.bool(forKey: "ottline.v2.legacy_migration_completed")
        )
    }

    private func reload() {
        snapshot = Self.loadSnapshot(
            defaults: defaults,
            keychainService: keychainService,
            sessionId: sessionId
        )
    }

    public func saveAuth(
        userId: String,
        deviceId: String,
        pairingCode: String?,
        nickname: String? = nil,
        personaKey: PersonaKey? = nil
    ) {
        defaults.set(userId, forKey: "ottline.v2.user_id")
        defaults.set(deviceId, forKey: "ottline.v2.device_id")
        Self.writeKeychain(service: keychainService, key: "user_id", value: userId)
        Self.writeKeychain(service: keychainService, key: "device_id", value: deviceId)

        if let code = pairingCode, !code.isEmpty {
            defaults.set(code, forKey: "ottline.v2.pairing_code")
            Self.writeKeychain(service: keychainService, key: "pairing_code", value: code)
        }
        if let nick = nickname {
            defaults.set(nick, forKey: "ottline.v2.nickname")
        }
        if let pk = personaKey {
            defaults.set(pk.rawValue, forKey: "ottline.v2.persona_key")
        }
        reload()
    }

    public func saveProfile(nickname: String?, personaKey: PersonaKey?) {
        let trimmed = nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmed, !trimmed.isEmpty {
            defaults.set(trimmed, forKey: "ottline.v2.nickname")
        } else {
            defaults.removeObject(forKey: "ottline.v2.nickname")
        }
        if let personaKey {
            defaults.set(personaKey.rawValue, forKey: "ottline.v2.persona_key")
        } else {
            defaults.removeObject(forKey: "ottline.v2.persona_key")
        }
        reload()
    }

    public func clearAccountSession() {
        defaults.removeObject(forKey: "ottline.v2.user_id")
        defaults.removeObject(forKey: "ottline.v2.device_id")
        defaults.removeObject(forKey: "ottline.v2.pairing_code")
        defaults.removeObject(forKey: "ottline.v2.nickname")
        defaults.removeObject(forKey: "ottline.v2.persona_key")
        defaults.removeObject(forKey: "ottline.v2.last_sync_since")
        defaults.set(false, forKey: "ottline.v2.single_device_reminder_shown")
        Self.deleteKeychain(service: keychainService, key: "user_id")
        Self.deleteKeychain(service: keychainService, key: "device_id")
        Self.deleteKeychain(service: keychainService, key: "pairing_code")
        reload()
    }

    public func setLocale(_ locale: String) {
        let normalized = locale == "en" ? "en" : "ko"
        defaults.set(normalized, forKey: "ottline.v2.locale")
        reload()
    }

    public func setThemeMode(_ mode: ThemeMode) {
        defaults.set(mode.rawValue, forKey: "ottline.v2.theme_mode")
        reload()
    }

    public func setApiBaseUrl(_ url: String) {
        let cleaned = url.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        defaults.set(cleaned.isEmpty ? Self.productionApiBaseUrl : cleaned, forKey: "ottline.v2.api_base_url")
        reload()
    }

    public func setLastSyncSince(_ since: String?) {
        if let since, !since.isEmpty {
            defaults.set(since, forKey: "ottline.v2.last_sync_since")
        } else {
            defaults.removeObject(forKey: "ottline.v2.last_sync_since")
        }
        reload()
    }

    public func setAnalyticsClientId(_ id: String) {
        guard !id.isEmpty else { return }
        defaults.set(id, forKey: "ottline.v2.analytics_client_id")
        Self.writeKeychain(service: keychainService, key: "analytics_client_id", value: id)
        reload()
    }

    public func addCustomPlatform(_ platform: String, isBook: Bool) {
        let trimmed = platform.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let key = isBook ? "ottline.v2.custom_book_platforms" : "ottline.v2.custom_video_platforms"
        var current = defaults.stringArray(forKey: key) ?? []
        if !current.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            current.insert(trimmed, at: 0)
            defaults.set(Array(current.prefix(12)), forKey: key)
            reload()
        }
    }

    public func markSingleDeviceReminderShown() {
        defaults.set(true, forKey: "ottline.v2.single_device_reminder_shown")
        reload()
    }

    public func setRecapNotificationsEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: "ottline.v2.recap_notifications_enabled")
        reload()
    }

    public func setHomeSelectedMonth(_ monthKey: String) {
        defaults.set(monthKey, forKey: "ottline.v2.home_selected_month")
        reload()
    }

    public func markLegacyMigrationCompleted() {
        defaults.set(true, forKey: "ottline.v2.legacy_migration_completed")
        reload()
    }

    public func dismissedNextWatchSignatures() -> Set<String> {
        Set(defaults.stringArray(forKey: "ottline.v2.dismissed_next_watch") ?? [])
    }

    public func dismissNextWatchRecommendation(signature: String) {
        var set = dismissedNextWatchSignatures()
        set.insert(signature)
        defaults.set(Array(set), forKey: "ottline.v2.dismissed_next_watch")
    }

    // MARK: - Widget Snapshot Sync

    public func updateWidgetSnapshot(from logs: [WatchLog]) {
        let isEn = snapshot.locale == "en"
        let currentMonthKey = RecordDate.monthKey(nil)
        let thisMonthCount = logs.filter {
            RecordDate.monthKey($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt) == currentMonthKey
        }.count

        let monthPart = RecordDate.formatMonthShortPart(currentMonthKey, locale: snapshot.locale)
        let monthBadge: String = {
            if thisMonthCount > 0 {
                return isEn ? "\(monthPart) · \(thisMonthCount)" : "\(monthPart) · \(thisMonthCount)편"
            }
            return isEn ? "Timeline" : "타임라인"
        }()

        let heroLog = logs.first(where: { $0.status == .inProgress }) ?? logs.first
        let continueItem: SharedWidgetSnapshot.ContinueItem? = heroLog.map { log in
            let isBook = log.title.type == .book
            let isInProgress = log.status == .inProgress
            var metaParts: [String] = []
            if let ott = log.ott?.trimmingCharacters(in: .whitespacesAndNewlines), !ott.isEmpty {
                metaParts.append(ott)
            }
            if isBook, let author = log.title.author?.trimmingCharacters(in: .whitespacesAndNewlines), !author.isEmpty {
                metaParts.append(author)
            } else if let s = log.seasonNumber {
                metaParts.append(isEn ? "S\(s)" : "시즌 \(s)")
            }
            if metaParts.isEmpty, let y = log.title.year {
                metaParts.append(String(y))
            }
            let rawNote = log.spoiler ? "" : (log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "")
            let noteSnippet: String = {
                if !rawNote.isEmpty { return rawNote.replacingOccurrences(of: "\n", with: " ") }
                if isInProgress {
                    return isEn ? "Tap to update status or leave a quick note" : "탭해서 감상 상태를 바꾸거나 메모를 이어 남겨보세요"
                }
                return isEn ? "Tap to revisit or refine this memory" : "탭해서 남긴 기록을 돌아보거나 다듬어보세요"
            }()

            return SharedWidgetSnapshot.ContinueItem(
                titleId: log.title.id,
                titleName: log.title.name,
                isBook: isBook,
                isInProgress: isInProgress,
                metaText: metaParts.joined(separator: " · "),
                noteSnippet: noteSnippet
            )
        }

        let recentItems: [SharedWidgetSnapshot.RecentItem] = logs
            .filter { $0.id != heroLog?.id }
            .prefix(2)
            .map { log in
                let isBook = log.title.type == .book
                let statusLabel: String = {
                    switch log.status {
                    case .inProgress: return isEn ? (isBook ? "Reading" : "Watching") : (isBook ? "읽는 중" : "보는 중")
                    case .wishlist: return isEn ? "Saved" : (isBook ? "읽고 싶어요" : "보고 싶어요")
                    case .done: return isEn ? (isBook ? "Read" : "Watched") : (isBook ? "읽었어요" : "봤어요")
                    }
                }()
                return SharedWidgetSnapshot.RecentItem(
                    titleId: log.title.id,
                    titleName: log.title.name,
                    statusLabel: statusLabel
                )
            }

        let widgetSnap = SharedWidgetSnapshot(
            isEnglish: isEn,
            monthBadge: monthBadge,
            continueItem: continueItem,
            recentItems: recentItems
        )
        if let encoded = try? JSONEncoder().encode(widgetSnap) {
            groupDefaults?.set(encoded, forKey: Self.widgetSnapshotKey)
            defaults.set(encoded, forKey: Self.widgetSnapshotKey)
        }
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }

    // MARK: - Keychain Helpers

    private static func readKeychain(service: String, key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func writeKeychain(service: String, key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    private static func deleteKeychain(service: String, key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
