import Foundation
import Security
import SQLite3

/// Seamlessly migrates v1 Expo React Native (`apps/native`) credentials and local SQLite data
/// into v2 Swift Native (`apps/ios-native`) on first launch after an App Store update.
public enum LegacyIosMigrator {
    public struct MigrationSummary: Equatable, Sendable {
        public var migratedAuth: Bool = false
        public var migratedTitlesCount: Int = 0
        public var migratedLogsCount: Int = 0
        public var migratedHistoryCount: Int = 0
        public var migratedOutboxCount: Int = 0
    }

    // Legacy ExpoSecureStore Keychain keys from `apps/native/lib/secureStore.ts`
    private static let legacyUserIdKey = "ottline.native.userId"
    private static let legacyDeviceIdKey = "ottline.native.deviceId"
    private static let legacyPairingCodeKey = "ottline.native.pairingCode"
    private static let legacyAnalyticsClientIdKey = "ottline.native.analyticsClientId"
    private static let legacyLocaleKey = "ottline.native.localePreference"
    private static let legacyThemeKey = "ottline.native.themePreference"

    private static let expoServices = ["app:no-auth", "app:auth", "app"]

    @discardableResult
    public static func runMigrationIfNeeded(
        prefs: AppPreferences,
        db: OttlineDatabase,
        legacySqlitePathOverride: String? = nil,
        legacyKeychainReaderOverride: ((String) -> String?)? = nil
    ) -> MigrationSummary {
        var summary = MigrationSummary()
        if prefs.snapshot.legacyMigrationCompleted {
            return summary
        }

        let readKey = legacyKeychainReaderOverride ?? readExpoSecureStoreKey

        // 1. Migrate Auth & Preferences from ExpoSecureStore Keychain
        if (prefs.snapshot.userId ?? "").isEmpty,
           let oldUserId = readKey(legacyUserIdKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !oldUserId.isEmpty,
           let oldDeviceId = readKey(legacyDeviceIdKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !oldDeviceId.isEmpty {
            let oldPairingCode = readKey(legacyPairingCodeKey)?.trimmingCharacters(in: .whitespacesAndNewlines)
            prefs.saveAuth(userId: oldUserId, deviceId: oldDeviceId, pairingCode: oldPairingCode)
            summary.migratedAuth = true
        }

        if let oldClientId = readKey(legacyAnalyticsClientIdKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !oldClientId.isEmpty {
            prefs.setAnalyticsClientId(oldClientId)
        }

        if let oldLocale = readKey(legacyLocaleKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
           oldLocale == "ko" || oldLocale == "en" {
            prefs.setLocale(oldLocale)
        }

        if let oldTheme = readKey(legacyThemeKey)?.trimmingCharacters(in: .whitespacesAndNewlines) {
            if oldTheme.lowercased() == "dark" {
                prefs.setThemeMode(.dark)
            } else if oldTheme.lowercased() == "light" {
                prefs.setThemeMode(.light)
            }
        }

        // 2. Migrate Legacy `expo-sqlite` Database (`<Documents>/SQLite/ottline-native.db`)
        let sqlitePath: String = {
            if let override = legacySqlitePathOverride { return override }
            let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            return docs.appendingPathComponent("SQLite/ottline-native.db").path
        }()

        if FileManager.default.fileExists(atPath: sqlitePath) {
            migrateLegacySqliteFile(at: sqlitePath, into: db, prefs: prefs, summary: &summary)
        }

        prefs.markLegacyMigrationCompleted()
        return summary
    }

    /// Reads an item written by `expo-secure-store` (`SecureStoreModule.swift`).
    /// Expo encodes `key` as `Data(key.utf8)` in both `kSecAttrGeneric` and `kSecAttrAccount`
    /// under `kSecAttrService = "app:no-auth"` (or `"app:auth"` / `"app"`).
    public static func readExpoSecureStoreKey(_ key: String) -> String? {
        guard let encodedKey = key.data(using: .utf8) else { return nil }
        for service in expoServices {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrGeneric as String: encodedKey,
                kSecAttrAccount as String: encodedKey,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne
            ]
            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)
            if status == errSecSuccess,
               let data = item as? Data,
               let str = String(data: data, encoding: .utf8) {
                return str
            }
        }
        return nil
    }

    private struct LegacyOutboxEnvelope: Codable {
        var title: SyncTitleChange?
        var log: SyncLogChange?
    }

    private static func migrateLegacySqliteFile(
        at path: String,
        into db: OttlineDatabase,
        prefs: AppPreferences,
        summary: inout MigrationSummary
    ) {
        var legacyDb: OpaquePointer?
        guard sqlite3_open_v2(path, &legacyDb, SQLITE_OPEN_READONLY, nil) == SQLITE_OK,
              let legacyDb else { return }
        defer { sqlite3_close(legacyDb) }

        let decoder = JSONDecoder()
        let encoder = JSONEncoder()

        // 1) Migrate settings (`lastSyncAt`, `iosRecapNotifications.enabled`)
        var settingsStmt: OpaquePointer?
        if sqlite3_prepare_v2(legacyDb, "SELECT key, value FROM settings;", -1, &settingsStmt, nil) == SQLITE_OK {
            while sqlite3_step(settingsStmt) == SQLITE_ROW {
                let k = colText(settingsStmt, 0) ?? ""
                let v = colText(settingsStmt, 1) ?? ""
                if k == "lastSyncAt", !v.isEmpty, (prefs.snapshot.lastSyncSince ?? "").isEmpty {
                    prefs.setLastSyncSince(v)
                } else if k == "iosRecapNotifications.enabled" && v == "1" {
                    prefs.setRecapNotificationsEnabled(true)
                }
            }
        }
        sqlite3_finalize(settingsStmt)

        // 2) Migrate `titles`
        var titleStmt: OpaquePointer?
        if sqlite3_prepare_v2(
            legacyDb,
            "SELECT id, provider, provider_id, type, name, updated_at, deleted_at, json FROM titles;",
            -1,
            &titleStmt,
            nil
        ) == SQLITE_OK {
            while sqlite3_step(titleStmt) == SQLITE_ROW {
                guard let id = colText(titleStmt, 0) else { continue }
                let updatedAt = colText(titleStmt, 5) ?? RecordDate.nowIso()
                let deletedAt = colText(titleStmt, 6)
                let jsonStr = colText(titleStmt, 7) ?? ""
                let parsedTitle: Title = {
                    if let data = jsonStr.data(using: .utf8),
                       let t = try? decoder.decode(Title.self, from: data) {
                        return t
                    }
                    return Title(
                        id: id,
                        provider: Provider.fromWire(colText(titleStmt, 1)),
                        providerId: colText(titleStmt, 2),
                        type: TitleType.fromWire(colText(titleStmt, 3)),
                        name: colText(titleStmt, 4) ?? ""
                    )
                }()
                db.upsertTitle(parsedTitle, updatedAt: updatedAt, deletedAt: deletedAt)
                summary.migratedTitlesCount += 1
            }
        }
        sqlite3_finalize(titleStmt)

        // 3) Migrate `logs`
        var logStmt: OpaquePointer?
        let logSql = """
        SELECT id, title_id, title_json, status, rating, note, spoiler, ott,
               season_number, episode_number, season_poster_url, season_year,
               origin, watched_at, place, occasion, created_at, updated_at, deleted_at, sync_status
        FROM logs;
        """
        if sqlite3_prepare_v2(legacyDb, logSql, -1, &logStmt, nil) == SQLITE_OK {
            while sqlite3_step(logStmt) == SQLITE_ROW {
                guard let id = colText(logStmt, 0),
                      let titleId = colText(logStmt, 1) else { continue }
                let titleJson = colText(logStmt, 2) ?? ""
                let title: Title = {
                    if let existing = db.getTitleById(titleId) { return existing }
                    if let data = titleJson.data(using: .utf8),
                       let decoded = try? decoder.decode(Title.self, from: data) {
                        return decoded
                    }
                    return Title(id: titleId, name: "Unknown")
                }()

                let createdAt = colText(logStmt, 16) ?? RecordDate.nowIso()
                let watchedAt = colText(logStmt, 13) ?? createdAt
                let updatedAt = colText(logStmt, 17) ?? createdAt
                let deletedAt = colText(logStmt, 18)
                let syncStatus = colText(logStmt, 19) ?? "SYNCED"

                let watchLog = WatchLog(
                    id: id,
                    title: title,
                    status: LogStatus.fromWire(colText(logStmt, 3)),
                    rating: colDouble(logStmt, 4),
                    note: colText(logStmt, 5),
                    spoiler: sqlite3_column_int(logStmt, 6) != 0,
                    ott: colText(logStmt, 7),
                    seasonNumber: colInt(logStmt, 8),
                    episodeNumber: colInt(logStmt, 9),
                    seasonPosterUrl: colText(logStmt, 10),
                    seasonYear: colInt(logStmt, 11),
                    origin: LogOrigin.fromWire(colText(logStmt, 12)),
                    createdAt: createdAt,
                    watchedAt: watchedAt,
                    place: Place.fromWire(colText(logStmt, 14)),
                    occasion: Occasion.fromWire(colText(logStmt, 15)),
                    updatedAt: updatedAt
                )
                db.upsertWatchLog(watchLog, updatedAt: updatedAt, deletedAt: deletedAt, syncStatus: syncStatus)
                summary.migratedLogsCount += 1
            }
        }
        sqlite3_finalize(logStmt)

        // 4) Migrate `history`
        var histStmt: OpaquePointer?
        let histSql = """
        SELECT id, log_id, recorded_at, status, rating, note, spoiler, ott,
               season_number, episode_number, season_poster_url, season_year,
               origin, watched_at, place, occasion
        FROM history;
        """
        if sqlite3_prepare_v2(legacyDb, histSql, -1, &histStmt, nil) == SQLITE_OK {
            while sqlite3_step(histStmt) == SQLITE_ROW {
                guard let id = colText(histStmt, 0),
                      let logId = colText(histStmt, 1) else { continue }
                let item = WatchLogHistoryItem(
                    id: id,
                    logId: logId,
                    recordedAt: colText(histStmt, 2) ?? RecordDate.nowIso(),
                    status: LogStatus.fromWire(colText(histStmt, 3)),
                    rating: colDouble(histStmt, 4),
                    note: colText(histStmt, 5),
                    spoiler: sqlite3_column_int(histStmt, 6) != 0,
                    ott: colText(histStmt, 7),
                    seasonNumber: colInt(histStmt, 8),
                    episodeNumber: colInt(histStmt, 9),
                    seasonPosterUrl: colText(histStmt, 10),
                    seasonYear: colInt(histStmt, 11),
                    origin: LogOrigin.fromWire(colText(histStmt, 12)),
                    watchedAt: colText(histStmt, 13) ?? "",
                    place: Place.fromWire(colText(histStmt, 14)),
                    occasion: Occasion.fromWire(colText(histStmt, 15))
                )
                db.insertHistory(item)
                summary.migratedHistoryCount += 1
            }
        }
        sqlite3_finalize(histStmt)

        // 5) Migrate `outbox` (`payload_json` contains `{ "title": SyncTitleChange, "log": SyncLogChange }`)
        var outboxStmt: OpaquePointer?
        if sqlite3_prepare_v2(
            legacyDb,
            "SELECT id, log_id, payload_json, created_at FROM outbox ORDER BY created_at ASC;",
            -1,
            &outboxStmt,
            nil
        ) == SQLITE_OK {
            while sqlite3_step(outboxStmt) == SQLITE_ROW {
                guard let payloadStr = colText(outboxStmt, 2),
                      let data = payloadStr.data(using: .utf8),
                      let env = try? decoder.decode(LegacyOutboxEnvelope.self, from: data) else { continue }
                if let titleChange = env.title,
                   let titleJsonData = try? encoder.encode(titleChange),
                   let titleJson = String(data: titleJsonData, encoding: .utf8) {
                    db.enqueueOutbox(
                        entityType: "TITLE",
                        entityId: titleChange.id,
                        op: titleChange.op,
                        payloadJson: titleJson,
                        updatedAt: titleChange.updatedAt
                    )
                }
                if let logChange = env.log,
                   let logJsonData = try? encoder.encode(logChange),
                   let logJson = String(data: logJsonData, encoding: .utf8) {
                    db.enqueueOutbox(
                        entityType: "LOG",
                        entityId: logChange.id,
                        op: logChange.op,
                        payloadJson: logJson,
                        updatedAt: logChange.updatedAt
                    )
                    summary.migratedOutboxCount += 1
                }
            }
        }
        sqlite3_finalize(outboxStmt)
    }

    private static func colText(_ stmt: OpaquePointer?, _ idx: Int32) -> String? {
        guard sqlite3_column_type(stmt, idx) != SQLITE_NULL,
              let ptr = sqlite3_column_text(stmt, idx) else { return nil }
        return String(cString: ptr)
    }

    private static func colInt(_ stmt: OpaquePointer?, _ idx: Int32) -> Int? {
        guard sqlite3_column_type(stmt, idx) != SQLITE_NULL else { return nil }
        return Int(sqlite3_column_int(stmt, idx))
    }

    private static func colDouble(_ stmt: OpaquePointer?, _ idx: Int32) -> Double? {
        guard sqlite3_column_type(stmt, idx) != SQLITE_NULL else { return nil }
        return sqlite3_column_double(stmt, idx)
    }
}
