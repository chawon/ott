import Foundation
import Observation
import Security
#if canImport(WidgetKit)
import WidgetKit
#endif

public enum ThemeMode: String, Codable, CaseIterable, Sendable {
    case system = "SYSTEM"
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
    public var lastSyncUserId: String?
    public var customVideoPlatforms: [String]
    public var customBookPlatforms: [String]
    public var singleDeviceCodeReminderShown: Bool
    public var recapNotificationsEnabled: Bool
    public var eveningReminderEnabled: Bool
    public var eveningReminderHour: Int
    public var eveningReminderMinute: Int
    public var macosMenuBarEnabled: Bool
    public var homeSelectedMonth: String
    public var legacyMigrationCompleted: Bool

    public var isProfileComplete: Bool {
        let trimmed = nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return !trimmed.isEmpty && personaKey != nil
    }

    public init(
        userId: String? = nil,
        deviceId: String? = nil,
        pairingCode: String? = nil,
        nickname: String? = nil,
        personaKey: PersonaKey? = nil,
        locale: String = "ko",
        themeMode: ThemeMode = .system,
        apiBaseUrl: String = "https://ottline.app",
        analyticsClientId: String = UUID().uuidString.lowercased(),
        sessionId: String = UUID().uuidString.lowercased(),
        lastSyncSince: String? = nil,
        lastSyncUserId: String? = nil,
        customVideoPlatforms: [String] = [],
        customBookPlatforms: [String] = [],
        singleDeviceCodeReminderShown: Bool = false,
        recapNotificationsEnabled: Bool = false,
        eveningReminderEnabled: Bool = false,
        eveningReminderHour: Int = 22,
        eveningReminderMinute: Int = 0,
        macosMenuBarEnabled: Bool = true,
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
        self.lastSyncUserId = lastSyncUserId
        self.customVideoPlatforms = customVideoPlatforms
        self.customBookPlatforms = customBookPlatforms
        self.singleDeviceCodeReminderShown = singleDeviceCodeReminderShown
        self.recapNotificationsEnabled = recapNotificationsEnabled
        self.eveningReminderEnabled = eveningReminderEnabled
        self.eveningReminderHour = eveningReminderHour
        self.eveningReminderMinute = eveningReminderMinute
        self.macosMenuBarEnabled = macosMenuBarEnabled
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
        public var statusBadge: String
        public var metaText: String
        public var noteSnippet: String

        public init(
            titleId: String,
            titleName: String,
            isBook: Bool,
            isInProgress: Bool,
            statusBadge: String = "",
            metaText: String,
            noteSnippet: String
        ) {
            self.titleId = titleId
            self.titleName = titleName
            self.isBook = isBook
            self.isInProgress = isInProgress
            self.statusBadge = statusBadge
            self.metaText = metaText
            self.noteSnippet = noteSnippet
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.titleId = try c.decode(String.self, forKey: .titleId)
            self.titleName = try c.decode(String.self, forKey: .titleName)
            self.isBook = try c.decode(Bool.self, forKey: .isBook)
            self.isInProgress = try c.decode(Bool.self, forKey: .isInProgress)
            self.statusBadge = try c.decodeIfPresent(String.self, forKey: .statusBadge) ?? ""
            self.metaText = try c.decode(String.self, forKey: .metaText)
            self.noteSnippet = try c.decode(String.self, forKey: .noteSnippet)
        }
    }

    public struct RecentItem: Codable, Equatable, Sendable {
        public var titleId: String
        public var titleName: String
        public var statusLabel: String

        public init(titleId: String, titleName: String, statusLabel: String) {
            self.titleId = titleId
            self.titleName = titleName
            self.statusLabel = statusLabel
        }
    }

    public var isEnglish: Bool
    public var monthBadge: String
    public var inProgressCount: Int
    public var thisMonthDoneCount: Int
    public var totalLogCount: Int
    public var continueItem: ContinueItem?
    public var recentItems: [RecentItem]

    public init(
        isEnglish: Bool = false,
        monthBadge: String = "타임라인",
        inProgressCount: Int = 0,
        thisMonthDoneCount: Int = 0,
        totalLogCount: Int = 0,
        continueItem: ContinueItem? = nil,
        recentItems: [RecentItem] = []
    ) {
        self.isEnglish = isEnglish
        self.monthBadge = monthBadge
        self.inProgressCount = inProgressCount
        self.thisMonthDoneCount = thisMonthDoneCount
        self.totalLogCount = totalLogCount
        self.continueItem = continueItem
        self.recentItems = recentItems
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.isEnglish = try c.decodeIfPresent(Bool.self, forKey: .isEnglish) ?? false
        self.monthBadge = try c.decodeIfPresent(String.self, forKey: .monthBadge) ?? "타임라인"
        self.inProgressCount = try c.decodeIfPresent(Int.self, forKey: .inProgressCount) ?? 0
        self.thisMonthDoneCount = try c.decodeIfPresent(Int.self, forKey: .thisMonthDoneCount) ?? 0
        self.totalLogCount = try c.decodeIfPresent(Int.self, forKey: .totalLogCount) ?? 0
        self.continueItem = try c.decodeIfPresent(ContinueItem.self, forKey: .continueItem)
        self.recentItems = try c.decodeIfPresent([RecentItem].self, forKey: .recentItems) ?? []
    }
}

@Observable
public final class AppPreferences {
    public static let productionApiBaseUrl = "https://ottline.app"
    public static let appGroupId = "group.app.ottline"
    public static let widgetSnapshotKey = "ottline.widget.snapshot.v2"
    public static let sharedExtensionQueueKey = "ottline.v2.pending_shared_logs"
    public static let sharedExtensionPendingUrlKey = "ottline.v2.pending_shared_url"

    private let defaults: UserDefaults
    private let groupDefaults: UserDefaults?
    private let keychainService: String
    public let sessionId: String = UUID().uuidString.lowercased()

    public private(set) var snapshot: PreferencesSnapshot
    public private(set) var activationDismissedInSession: Bool = false

    public static var defaultGroupDefaults: UserDefaults? {
        #if os(macOS)
        return nil
        #else
        return UserDefaults(suiteName: AppPreferences.appGroupId)
        #endif
    }

    public init(
        defaults: UserDefaults = .standard,
        groupDefaults: UserDefaults? = AppPreferences.defaultGroupDefaults,
        keychainService: String = "app.ottline.v2.auth"
    ) {
        self.defaults = defaults
        self.groupDefaults = groupDefaults
        self.keychainService = keychainService
        self.snapshot = Self.loadSnapshot(
            defaults: defaults,
            groupDefaults: groupDefaults,
            keychainService: keychainService,
            sessionId: sessionId
        )
        groupDefaults?.set(self.snapshot.locale, forKey: "ottline.v2.locale")
        if let uid = self.snapshot.userId, !uid.isEmpty {
            groupDefaults?.set(uid, forKey: "ottline.v2.user_id")
        }
        if let did = self.snapshot.deviceId, !did.isEmpty {
            groupDefaults?.set(did, forKey: "ottline.v2.device_id")
        }
    }

    private static func loadSnapshot(
        defaults: UserDefaults,
        groupDefaults: UserDefaults?,
        keychainService: String,
        sessionId: String
    ) -> PreferencesSnapshot {
        let userId = readKeychain(service: keychainService, key: "user_id")
            ?? defaults.string(forKey: "ottline.v2.user_id")
            ?? groupDefaults?.string(forKey: "ottline.v2.user_id")
        let deviceId = readKeychain(service: keychainService, key: "device_id")
            ?? defaults.string(forKey: "ottline.v2.device_id")
            ?? groupDefaults?.string(forKey: "ottline.v2.device_id")
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
        let locale = defaults.string(forKey: "ottline.v2.locale")
            ?? groupDefaults?.string(forKey: "ottline.v2.locale")
            ?? defaultLocale
        let themeRaw = defaults.string(forKey: "ottline.v2.theme_mode") ?? ThemeMode.system.rawValue
        let themeMode = ThemeMode(rawValue: themeRaw) ?? .system

        #if DEBUG
        let apiBase = defaults.string(forKey: "ottline.v2.api_base_url")
            .flatMap { $0.isEmpty ? nil : $0 } ?? productionApiBaseUrl
        #else
        let apiBase = productionApiBaseUrl
        #endif

        let videoPlatforms = defaults.stringArray(forKey: "ottline.v2.custom_video_platforms") ?? []
        let bookPlatforms = defaults.stringArray(forKey: "ottline.v2.custom_book_platforms") ?? []

        let eveningHour = defaults.object(forKey: "ottline.v2.evening_reminder_hour") as? Int ?? 22
        let eveningMinute = defaults.object(forKey: "ottline.v2.evening_reminder_minute") as? Int ?? 0
        let macosMenuBar = defaults.object(forKey: "ottline.v2.macos_menubar_enabled") as? Bool ?? true

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
            lastSyncUserId: defaults.string(forKey: "ottline.v2.last_sync_user_id"),
            customVideoPlatforms: videoPlatforms,
            customBookPlatforms: bookPlatforms,
            singleDeviceCodeReminderShown: defaults.bool(forKey: "ottline.v2.single_device_reminder_shown"),
            recapNotificationsEnabled: defaults.bool(forKey: "ottline.v2.recap_notifications_enabled"),
            eveningReminderEnabled: defaults.bool(forKey: "ottline.v2.evening_reminder_enabled"),
            eveningReminderHour: min(max(eveningHour, 0), 23),
            eveningReminderMinute: min(max(eveningMinute, 0), 59),
            macosMenuBarEnabled: macosMenuBar,
            homeSelectedMonth: defaults.string(forKey: "ottline.v2.home_selected_month") ?? RecordDate.monthKey(nil),
            legacyMigrationCompleted: defaults.bool(forKey: "ottline.v2.legacy_migration_completed")
        )
    }

    private func reload() {
        snapshot = Self.loadSnapshot(
            defaults: defaults,
            groupDefaults: groupDefaults,
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
        groupDefaults?.set(userId, forKey: "ottline.v2.user_id")
        groupDefaults?.set(deviceId, forKey: "ottline.v2.device_id")
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
        groupDefaults?.removeObject(forKey: "ottline.v2.user_id")
        groupDefaults?.removeObject(forKey: "ottline.v2.device_id")
        defaults.removeObject(forKey: "ottline.v2.nickname")
        defaults.removeObject(forKey: "ottline.v2.persona_key")
        defaults.removeObject(forKey: "ottline.v2.last_sync_since")
        defaults.removeObject(forKey: "ottline.v2.last_sync_user_id")
        defaults.set(false, forKey: "ottline.v2.single_device_reminder_shown")
        activationDismissedInSession = false
        Self.deleteKeychain(service: keychainService, key: "user_id")
        Self.deleteKeychain(service: keychainService, key: "device_id")
        Self.deleteKeychain(service: keychainService, key: "pairing_code")
        reload()
    }

    public func dismissActivationForSession() {
        activationDismissedInSession = true
    }

    public func setLocale(_ locale: String) {
        let normalized = locale == "en" ? "en" : "ko"
        defaults.set(normalized, forKey: "ottline.v2.locale")
        groupDefaults?.set(normalized, forKey: "ottline.v2.locale")
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

    public func setLastSyncSince(_ since: String?, userId: String? = nil) {
        if let since, !since.isEmpty {
            defaults.set(since, forKey: "ottline.v2.last_sync_since")
        } else {
            defaults.removeObject(forKey: "ottline.v2.last_sync_since")
        }
        if let userId, !userId.isEmpty {
            defaults.set(userId, forKey: "ottline.v2.last_sync_user_id")
        } else if since == nil {
            defaults.removeObject(forKey: "ottline.v2.last_sync_user_id")
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

    public func setEveningReminder(enabled: Bool, hour: Int? = nil, minute: Int? = nil) {
        defaults.set(enabled, forKey: "ottline.v2.evening_reminder_enabled")
        if let hour {
            defaults.set(min(max(hour, 0), 23), forKey: "ottline.v2.evening_reminder_hour")
        }
        if let minute {
            defaults.set(min(max(minute, 0), 59), forKey: "ottline.v2.evening_reminder_minute")
        }
        reload()
    }

    public func setMacosMenuBarEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: "ottline.v2.macos_menubar_enabled")
        reload()
    }

    // MARK: - Share Extension App Group Queue & URL Handoff

    public func enqueueSharedExtensionLog(_ entry: SharedExtensionLogEntry) {
        let store = groupDefaults ?? defaults
        var items: [SharedExtensionLogEntry] = []
        if let existingData = store.data(forKey: Self.sharedExtensionQueueKey),
           let decoded = try? JSONDecoder().decode([SharedExtensionLogEntry].self, from: existingData) {
            items = decoded
        }
        items.removeAll { $0.id == entry.id }
        items.append(entry)
        if let encoded = try? JSONEncoder().encode(items) {
            store.set(encoded, forKey: Self.sharedExtensionQueueKey)
        }
    }

    public func consumeSharedExtensionLogs() -> [SharedExtensionLogEntry] {
        let store = groupDefaults ?? defaults
        guard let existingData = store.data(forKey: Self.sharedExtensionQueueKey),
              let decoded = try? JSONDecoder().decode([SharedExtensionLogEntry].self, from: existingData) else {
            return []
        }
        store.removeObject(forKey: Self.sharedExtensionQueueKey)
        return decoded
    }

    public func setSharedExtensionPendingUrl(_ urlString: String?) {
        let store = groupDefaults ?? defaults
        if let urlString, !urlString.isEmpty {
            store.set(urlString, forKey: Self.sharedExtensionPendingUrlKey)
        } else {
            store.removeObject(forKey: Self.sharedExtensionPendingUrlKey)
        }
    }

    public func consumeSharedExtensionPendingUrl() -> URL? {
        let store = groupDefaults ?? defaults
        guard let raw = store.string(forKey: Self.sharedExtensionPendingUrlKey),
              !raw.isEmpty else {
            return nil
        }
        store.removeObject(forKey: Self.sharedExtensionPendingUrlKey)
        return URL(string: raw)
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
            $0.status == .done &&
            RecordDate.monthKey($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt) == currentMonthKey
        }.count

        let monthPart = RecordDate.formatMonthShortPart(currentMonthKey, locale: snapshot.locale)
        let monthBadge: String = {
            if thisMonthCount > 0 {
                return isEn ? "\(monthPart) · \(thisMonthCount)" : "\(monthPart) · \(thisMonthCount)편"
            }
            return isEn ? "Timeline" : "타임라인"
        }()

        let inProgressCount = logs.filter { $0.status == .inProgress }.count
        let heroLog = logs.first(where: { $0.status == .inProgress }) ?? logs.first
        let continueItem: SharedWidgetSnapshot.ContinueItem? = heroLog.map { log in
            let isBook = log.title.type == .book
            let isInProgress = log.status == .inProgress
            let statusBadge: String = {
                switch log.status {
                case .inProgress: return isEn ? (isBook ? "Reading" : "Watching") : (isBook ? "읽는 중" : "보는 중")
                case .wishlist: return isEn ? "Saved" : (isBook ? "읽고 싶어요" : "보고 싶어요")
                case .done: return isEn ? (isBook ? "Read" : "Watched") : (isBook ? "읽었어요" : "봤어요")
                }
            }()
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
                statusBadge: statusBadge,
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
            inProgressCount: inProgressCount,
            thisMonthDoneCount: thisMonthCount,
            totalLogCount: logs.count,
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
        #if os(macOS)
        return nil
        #else
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
        #endif
    }

    private static func writeKeychain(service: String, key: String, value: String) {
        #if os(macOS)
        return
        #else
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
        #endif
    }

    private static func deleteKeychain(service: String, key: String) {
        #if os(macOS)
        return
        #else
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        #endif
    }
}
