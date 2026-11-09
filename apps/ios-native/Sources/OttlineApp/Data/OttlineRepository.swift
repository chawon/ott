import Foundation
import Observation
#if canImport(UIKit)
import UIKit
#endif

public enum SyncStatus: String, Sendable {
    case idle = "IDLE"
    case syncing = "SYNCING"
    case failed = "FAILED"
}

public struct SyncState: Equatable, Sendable {
    public var status: SyncStatus
    public var lastSyncedAt: String?
    public var errorMessage: String?

    public init(status: SyncStatus = .idle, lastSyncedAt: String? = nil, errorMessage: String? = nil) {
        self.status = status
        self.lastSyncedAt = lastSyncedAt
        self.errorMessage = errorMessage
    }
}

@Observable
public final class OttlineRepository: @unchecked Sendable {
    public let db: OttlineDatabase
    public let prefs: AppPreferences
    public let api: OttlineApiClient

    public private(set) var logs: [WatchLog] = []
    public private(set) var outboxCount: Int = 0
    public private(set) var bookClassifications: [String: BookClassificationItemDto] = [:]
    public private(set) var syncState: SyncState = SyncState()

    private let syncLock = NSLock()
    private var isSyncingFlag = false
    private var appOpenTracked = false

    public static let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "2.0.0"
    public static let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "25"

    public init(db: OttlineDatabase, prefs: AppPreferences, api: OttlineApiClient) {
        self.db = db
        self.prefs = prefs
        self.api = api

        // Seamless v1 -> v2 migration on first startup
        LegacyIosMigrator.runMigrationIfNeeded(prefs: prefs, db: db)

        self.api.onAuthRevoked = { [weak self] in
            self?.handleServerDeviceUnlinked()
        }

        reloadFromLocalDb()
    }

    public func reloadFromLocalDb() {
        let activeLogs = db.getActiveLogs()
        let count = db.outboxCount()
        let cls = db.getAllBookClassifications()
        self.logs = activeLogs
        self.outboxCount = count
        self.bookClassifications = cls
        prefs.updateWidgetSnapshot(from: activeLogs)
    }

    public func initializeSessionAndSync() {
        Task {
            if !appOpenTracked {
                appOpenTracked = true
                trackEvent("app_open")
            }
            if !(prefs.snapshot.userId ?? "").isEmpty && !(prefs.snapshot.deviceId ?? "").isEmpty {
                _ = await syncOutbox()
            } else if db.outboxCount() > 0 {
                _ = try? await ensureAuthenticated()
                _ = await syncOutbox()
            }
        }
    }

    public func triggerSyncAsync() {
        Task {
            _ = await syncOutbox()
        }
    }

    // MARK: - 1. Auth & Pairing

    @discardableResult
    public func ensureAuthenticated() async throws -> PreferencesSnapshot {
        let cur = prefs.snapshot
        if let uid = cur.userId, !uid.isEmpty, let did = cur.deviceId, !did.isEmpty {
            return cur
        }
        let resp = try await api.createAnonymousSession(deviceName: Self.deviceDisplayName())
        prefs.saveAuth(
            userId: resp.userId,
            deviceId: resp.deviceId,
            pairingCode: resp.pairingCode,
            nickname: resp.nickname,
            personaKey: resp.personaKey
        )
        return prefs.snapshot
    }

    public func pairWithCode(_ code: String) async throws -> PairDeviceResponse {
        // Push any pending local outbox changes first so server can merge them safely
        if !(prefs.snapshot.userId ?? "").isEmpty && db.outboxCount() > 0 {
            _ = await syncOutbox()
        }
        let resp = try await api.pairWithCode(code: code, deviceName: Self.deviceDisplayName())
        prefs.saveAuth(
            userId: resp.userId,
            deviceId: resp.deviceId,
            pairingCode: resp.pairingCode,
            nickname: resp.nickname,
            personaKey: resp.personaKey
        )
        prefs.setLastSyncSince(nil)
        db.clearAllTables()
        reloadFromLocalDb()

        try? await pullChangesInternal(forceFullPull: true)
        reloadFromLocalDb()

        trackEvent("device_pair", properties: ["mergedLogsCount": String(resp.mergedLogsCount ?? 0)])
        return resp
    }

    private func handleServerDeviceUnlinked() {
        db.clearAllTables()
        prefs.clearAccountSession()
        reloadFromLocalDb()
        syncState = SyncState(status: .idle)
    }

    // MARK: - 2. Local-First Recording & Revision History ("낙장불입")

    public func findMatchingLocalTitle(_ candidate: Title) -> Title? {
        if let byId = db.getTitleById(candidate.id) { return byId }
        if let pid = candidate.providerId, !pid.isEmpty,
           let byProv = db.findTitleByProvider(
               provider: candidate.provider.rawValue,
               providerId: pid,
               type: candidate.type.rawValue
           ) {
            return byProv
        }
        if candidate.type == .book,
           let isbn13 = BookshelfBuilder.normalizeBookIsbn13(candidate),
           let byIsbn = db.findBookByIsbn13(isbn13) {
            return byIsbn
        }
        return nil
    }

    @discardableResult
    public func saveLogForTitle(
        candidateTitle: Title,
        draft: LogDraft,
        existingLogId: String? = nil,
        source: String = "quick_record"
    ) async -> WatchLog {
        let now = RecordDate.nowIso()
        let wasEmptyBefore = db.getActiveLogs().isEmpty

        let matchedLocalTitle = findMatchingLocalTitle(candidateTitle)
        let resolvedTitle: Title = {
            if let existing = matchedLocalTitle {
                return Title(
                    id: existing.id,
                    provider: existing.provider,
                    providerId: existing.providerId ?? candidateTitle.providerId,
                    type: existing.type,
                    name: candidateTitle.name.isEmpty ? existing.name : candidateTitle.name,
                    year: candidateTitle.year ?? existing.year,
                    posterUrl: candidateTitle.posterUrl ?? existing.posterUrl,
                    overview: candidateTitle.overview ?? existing.overview,
                    genres: candidateTitle.genres ?? existing.genres,
                    directors: candidateTitle.directors ?? existing.directors,
                    cast: candidateTitle.cast ?? existing.cast,
                    author: candidateTitle.author ?? existing.author,
                    publisher: candidateTitle.publisher ?? existing.publisher,
                    isbn10: candidateTitle.isbn10 ?? existing.isbn10,
                    isbn13: candidateTitle.isbn13 ?? existing.isbn13,
                    pubdate: candidateTitle.pubdate ?? existing.pubdate
                )
            }
            return candidateTitle
        }()

        db.upsertTitle(resolvedTitle, updatedAt: now)
        enqueueTitleUpsert(resolvedTitle, updatedAt: now)

        let existingLogRow: (log: WatchLog, updatedAt: String, deletedAt: String?, syncStatus: String)? = {
            if let existingLogId, let found = db.getWatchLogById(existingLogId) {
                return found
            }
            if let active = db.getActiveLogsByTitleId(resolvedTitle.id).first {
                return db.getWatchLogById(active.id)
            }
            return nil
        }()

        let logId = existingLogRow?.log.id ?? UUID().uuidString.lowercased()
        let createdAt = existingLogRow?.log.createdAt ?? now
        let watchedAt = draft.watchedAt.isEmpty ? (existingLogRow?.log.watchedAt ?? now) : draft.watchedAt

        let updatedLog = WatchLog(
            id: logId,
            title: resolvedTitle,
            status: draft.status,
            rating: draft.rating,
            note: draft.note,
            spoiler: draft.spoiler,
            ott: draft.ott,
            seasonNumber: draft.seasonNumber,
            episodeNumber: draft.episodeNumber,
            seasonPosterUrl: draft.seasonPosterUrl,
            seasonYear: draft.seasonYear,
            origin: existingLogRow?.log.origin ?? .log,
            createdAt: createdAt,
            watchedAt: watchedAt,
            place: draft.place,
            occasion: draft.occasion,
            updatedAt: now
        )

        db.upsertWatchLog(updatedLog, updatedAt: now, deletedAt: nil, syncStatus: "PENDING")

        let historyItem = WatchLogHistoryItem(
            id: UUID().uuidString.lowercased(),
            logId: logId,
            recordedAt: now,
            status: updatedLog.status,
            rating: updatedLog.rating,
            note: updatedLog.note,
            spoiler: updatedLog.spoiler,
            ott: updatedLog.ott,
            seasonNumber: updatedLog.seasonNumber,
            episodeNumber: updatedLog.episodeNumber,
            seasonPosterUrl: updatedLog.seasonPosterUrl,
            seasonYear: updatedLog.seasonYear,
            origin: updatedLog.origin,
            watchedAt: updatedLog.watchedAt,
            place: updatedLog.place,
            occasion: updatedLog.occasion
        )
        db.insertHistory(historyItem)
        enqueueLogUpsert(updatedLog, updatedAt: now)

        if let platform = draft.ott?.trimmingCharacters(in: .whitespacesAndNewlines), !platform.isEmpty {
            let defaults = resolvedTitle.type == .book
                ? ["종이책", "전자책", "오디오북", "리디", "밀리의서재", "예스24", "교보문고", "알라딘", "도서관", "Paperback", "eBook", "Audiobook"]
                : ["Netflix", "TVING", "Coupang Play", "Disney+", "Wavve", "Watcha", "Prime Video", "Apple TV+", "Laftel", "극장", "Theater"]
            if !defaults.contains(where: { $0.caseInsensitiveCompare(platform) == .orderedSame }) {
                prefs.addCustomPlatform(platform, isBook: resolvedTitle.type == .book)
            }
        }

        reloadFromLocalDb()

        if resolvedTitle.type == .book {
            Task {
                await ensureBookClassificationsCached(titles: [resolvedTitle])
            }
        }

        if wasEmptyBefore && existingLogRow == nil {
            trackEvent(
                "first_log_create",
                properties: [
                    "titleType": resolvedTitle.type.rawValue,
                    "status": draft.status.rawValue,
                    "source": source
                ]
            )
        } else {
            trackEvent(
                existingLogRow == nil ? "log_create" : "log_update",
                properties: [
                    "titleType": resolvedTitle.type.rawValue,
                    "status": draft.status.rawValue,
                    "source": source
                ]
            )
        }

        triggerSyncAsync()
        return updatedLog
    }

    private func enqueueTitleUpsert(_ title: Title, updatedAt: String) {
        let change = SyncTitleChange(
            id: title.id,
            op: "UPSERT",
            updatedAt: updatedAt,
            payload: SyncTitlePayload(
                provider: title.provider.rawValue,
                providerId: title.providerId ?? title.id,
                type: title.type.rawValue,
                name: title.name,
                year: title.year,
                posterUrl: title.posterUrl,
                overview: title.overview,
                genres: title.genres,
                directors: title.directors,
                cast: title.cast,
                author: title.author,
                publisher: title.publisher,
                isbn10: title.isbn10,
                isbn13: title.isbn13,
                pubdate: title.pubdate
            )
        )
        if let data = try? JSONEncoder().encode(change),
           let jsonStr = String(data: data, encoding: .utf8) {
            db.enqueueOutbox(
                entityType: "TITLE",
                entityId: title.id,
                op: "UPSERT",
                payloadJson: jsonStr,
                updatedAt: updatedAt
            )
        }
    }

    private func enqueueLogUpsert(_ log: WatchLog, updatedAt: String) {
        let change = SyncLogChange(
            id: log.id,
            op: "UPSERT",
            updatedAt: updatedAt,
            payload: SyncLogPayload(
                titleId: log.title.id,
                status: log.status.rawValue,
                rating: log.rating,
                note: log.note,
                spoiler: log.spoiler,
                ott: log.ott,
                seasonNumber: log.seasonNumber,
                episodeNumber: log.episodeNumber,
                seasonPosterUrl: log.seasonPosterUrl,
                seasonYear: log.seasonYear,
                origin: log.origin.rawValue,
                watchedAt: log.watchedAt,
                place: log.place?.rawValue,
                occasion: log.occasion?.rawValue,
                createdAt: log.createdAt
            )
        )
        if let data = try? JSONEncoder().encode(change),
           let jsonStr = String(data: data, encoding: .utf8) {
            db.enqueueOutbox(
                entityType: "LOG",
                entityId: log.id,
                op: "UPSERT",
                payloadJson: jsonStr,
                updatedAt: updatedAt
            )
        }
    }

    // MARK: - 3. Outbox Sync (Push + Pull with Monotonic Revision Check & LWW)

    @discardableResult
    public func syncOutbox() async -> Bool {
        syncLock.lock()
        if isSyncingFlag {
            syncLock.unlock()
            return false
        }
        isSyncingFlag = true
        syncLock.unlock()
        defer {
            syncLock.lock()
            isSyncingFlag = false
            syncLock.unlock()
        }

        let pending = db.getAllOutbox()
        let hasAuth = !(prefs.snapshot.userId ?? "").isEmpty && !(prefs.snapshot.deviceId ?? "").isEmpty
        if pending.isEmpty && !hasAuth {
            return true
        }

        syncState = SyncState(status: .syncing, lastSyncedAt: syncState.lastSyncedAt)

        do {
            let auth = try await ensureAuthenticated()
            guard let userId = auth.userId, let deviceId = auth.deviceId else {
                syncState = SyncState(status: .idle)
                return false
            }

            if !pending.isEmpty {
                let decoder = JSONDecoder()
                let titleChanges = pending
                    .filter { $0.entityType == "TITLE" }
                    .compactMap { try? decoder.decode(SyncTitleChange.self, from: Data($0.payloadJson.utf8)) }
                let logChanges = pending
                    .filter { $0.entityType == "LOG" }
                    .compactMap { try? decoder.decode(SyncLogChange.self, from: Data($0.payloadJson.utf8)) }

                let pushReq = SyncPushRequest(
                    userId: userId,
                    deviceId: deviceId,
                    changes: SyncPushRequest.SyncChanges(titles: titleChanges, logs: logChanges),
                    clientTime: RecordDate.nowIso()
                )
                let pushResp = try await api.syncPush(pushReq)

                // Delete title outbox rows only if their revision matches the snapshot we pushed
                for row in pending where row.entityType == "TITLE" {
                    _ = db.deleteOutboxIfRevisionMatches(id: row.id, revision: row.revision)
                }

                let acceptedSet = Set(pushResp.accepted)
                var syncedLogIds: [String] = []
                for row in pending where row.entityType == "LOG" && acceptedSet.contains(row.entityId) {
                    let deleted = db.deleteOutboxIfRevisionMatches(id: row.id, revision: row.revision)
                    if deleted > 0 {
                        syncedLogIds.append(row.entityId)
                    }
                }
                db.markLogsSyncStatus(ids: syncedLogIds, status: "SYNCED")

                // Apply server conflicts only if the local row wasn't edited again mid-flight
                for conflict in pushResp.conflicts {
                    let outboxKey = "LOG:\(conflict.id)"
                    let pushedSnapshot = pending.first { $0.id == outboxKey }
                    let currentOutbox = db.getOutboxById(outboxKey)
                    let wasEditedDuringFlight = currentOutbox != nil &&
                        pushedSnapshot != nil &&
                        currentOutbox?.revision != pushedSnapshot?.revision

                    if !wasEditedDuringFlight {
                        applyServerLogChange(conflict)
                        if let snap = pushedSnapshot {
                            _ = db.deleteOutboxIfRevisionMatches(id: outboxKey, revision: snap.revision)
                        }
                    }
                }
            }

            try await pullChangesInternal(forceFullPull: false)

            let nowIso = RecordDate.nowIso()
            reloadFromLocalDb()
            syncState = SyncState(status: .idle, lastSyncedAt: nowIso, errorMessage: nil)
            return true
        } catch {
            let pendingIds = pending.filter { $0.entityType == "LOG" }.map(\.entityId)
            db.markLogsSyncStatus(ids: pendingIds, status: "FAILED")
            reloadFromLocalDb()
            syncState = SyncState(
                status: .failed,
                lastSyncedAt: syncState.lastSyncedAt,
                errorMessage: error.localizedDescription
            )
            return false
        }
    }

    public func pullChangesInternal(forceFullPull: Bool) async throws {
        var cursor: String? = forceFullPull ? nil : prefs.snapshot.lastSyncSince
        var loops = 0
        while loops < 10 {
            loops += 1
            let resp = try await api.syncPull(since: cursor, limit: 250)
            let serverTitles = resp.serverChanges.titles
            let serverLogs = resp.serverChanges.logs

            for tChange in serverTitles {
                applyServerTitleChange(tChange)
            }
            for lChange in serverLogs {
                applyServerLogChange(lChange)
            }

            if !resp.nextSince.isEmpty && resp.nextSince != cursor {
                prefs.setLastSyncSince(resp.nextSince)
                cursor = resp.nextSince
                if serverTitles.isEmpty && serverLogs.isEmpty {
                    break
                }
            } else {
                break
            }
        }
    }

    private func applyServerTitleChange(_ change: SyncTitleChange) {
        if change.op.uppercased() == "DELETE" {
            if let existing = db.getTitleById(change.id) {
                db.upsertTitle(existing, updatedAt: change.updatedAt, deletedAt: change.updatedAt)
            }
            return
        }
        guard let p = change.payload else { return }
        let title = Title(
            id: change.id,
            provider: Provider.fromWire(p.provider),
            providerId: p.providerId,
            type: TitleType.fromWire(p.type),
            name: p.name,
            year: p.year,
            posterUrl: p.posterUrl,
            overview: p.overview,
            genres: p.genres,
            directors: p.directors,
            cast: p.cast,
            author: p.author,
            publisher: p.publisher,
            isbn10: p.isbn10,
            isbn13: p.isbn13,
            pubdate: p.pubdate
        )
        db.upsertTitle(title, updatedAt: change.updatedAt, deletedAt: nil)
    }

    private func applyServerLogChange(_ change: SyncLogChange) {
        // Never overwrite a log that has an unpushed local outbox entry newer than server
        if let localOutbox = db.getOutboxById("LOG:\(change.id)") {
            let localMs = RecordDate.parseInstantMillis(localOutbox.updatedAt)
            let serverMs = RecordDate.parseInstantMillis(change.updatedAt)
            if localMs > serverMs {
                return
            }
        }

        if let existing = db.getWatchLogById(change.id) {
            let localMs = RecordDate.parseInstantMillis(existing.updatedAt)
            let serverMs = RecordDate.parseInstantMillis(change.updatedAt)
            if localMs > serverMs {
                return
            }
        }

        if change.op.uppercased() == "DELETE" {
            if let existing = db.getWatchLogById(change.id) {
                db.upsertWatchLog(existing.log, updatedAt: change.updatedAt, deletedAt: change.updatedAt, syncStatus: "SYNCED")
            }
            return
        }

        guard let p = change.payload else { return }
        let title = db.getTitleById(p.titleId) ?? Title(id: p.titleId, name: "Unknown")
        let log = WatchLog(
            id: change.id,
            title: title,
            status: LogStatus.fromWire(p.status),
            rating: p.rating,
            note: p.note,
            spoiler: p.spoiler,
            ott: p.ott,
            seasonNumber: p.seasonNumber,
            episodeNumber: p.episodeNumber,
            seasonPosterUrl: p.seasonPosterUrl,
            seasonYear: p.seasonYear,
            origin: LogOrigin.fromWire(p.origin),
            createdAt: p.createdAt,
            watchedAt: p.watchedAt,
            place: Place.fromWire(p.place),
            occasion: Occasion.fromWire(p.occasion),
            updatedAt: change.updatedAt
        )
        db.upsertWatchLog(log, updatedAt: change.updatedAt, deletedAt: nil, syncStatus: "SYNCED")
    }

    // MARK: - 4. Timeline Cursor Pagination Upsert (`GET /api/logs/page`)

    public func upsertLogsFromServerPage(_ items: [WatchLog]) {
        guard !items.isEmpty else { return }
        for item in items {
            if db.getOutboxById("LOG:\(item.id)") != nil {
                continue
            }
            let serverUpdated = item.updatedAt ?? item.watchedAt
            if let existing = db.getWatchLogById(item.id) {
                let localMs = RecordDate.parseInstantMillis(existing.updatedAt)
                let serverMs = RecordDate.parseInstantMillis(serverUpdated)
                if localMs > serverMs {
                    continue
                }
            }
            db.upsertWatchLog(item, updatedAt: serverUpdated, deletedAt: nil, syncStatus: "SYNCED")
        }
        reloadFromLocalDb()
    }

    // MARK: - 5. KDC Bookshelf Classification Cache (Korean-only)

    public func ensureBookClassificationsCached(titles: [Title]) async {
        // KDC is a Korean-centric taxonomy; skip network resolution in English locale
        guard prefs.snapshot.locale == "ko" else { return }
        let isbns = Array(Set(titles.filter { $0.type == .book }.compactMap { BookshelfBuilder.normalizeBookIsbn13($0) }))
        guard !isbns.isEmpty else { return }

        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let classifiedTtlMs: Int64 = 180 * 24 * 3600 * 1000
        let pendingTtlMs: Int64 = 24 * 3600 * 1000

        let cachedRows = db.getBookClassifications(isbns: isbns)
        let cachedMap = Dictionary(uniqueKeysWithValues: cachedRows.map { ($0.isbn13, $0) })

        let toFetch = isbns.filter { isbn in
            guard let row = cachedMap[isbn] else { return true }
            let age = nowMs - row.cachedAtEpochMs
            if row.status == "CLASSIFIED" {
                return age > classifiedTtlMs
            }
            return age > pendingTtlMs
        }
        guard !toFetch.isEmpty else { return }

        if let resolved = try? await api.resolveBookClassifications(isbns: toFetch) {
            db.upsertBookClassifications(resolved, nowMs: nowMs)
            reloadFromLocalDb()
        }
    }

    // MARK: - 6. Local Reset vs Permanent Server Account Deletion

    public func resetLocalData() {
        db.clearAllTables()
        prefs.clearAccountSession()
        reloadFromLocalDb()
        syncState = SyncState(status: .idle)
    }

    public func deleteServerAccountAndLocalData() async throws {
        if !(prefs.snapshot.userId ?? "").isEmpty && !(prefs.snapshot.deviceId ?? "").isEmpty {
            try await api.deleteAccount()
        }
        resetLocalData()
    }

    // MARK: - 7. Analytics (`platform = "ios_native"`)

    public func trackEvent(_ eventName: String, properties: [String: String] = [:]) {
        let snap = prefs.snapshot
        var merged: [String: String] = [
            "osFamily": "ios",
            "deviceType": Self.isTabletDevice() ? "tablet" : "mobile",
            "installState": "app_store_testflight",
            "appVersion": Self.appVersion,
            "buildNumber": Self.buildNumber,
            "sessionId": snap.sessionId,
            "installId": snap.analyticsClientId,
            "locale": snap.locale,
            "theme": snap.themeMode.rawValue.lowercased()
        ]
        for (k, v) in properties {
            merged[k] = v
        }
        let payload = AnalyticsEventPayload(
            eventName: eventName,
            platform: "ios_native",
            clientId: snap.analyticsClientId,
            userId: snap.userId,
            sessionId: snap.sessionId,
            occurredAt: RecordDate.nowIso(),
            properties: merged
        )
        Task {
            await api.trackAnalyticsEvents([payload])
        }
    }

    public func trackTitleSearch(queryLength: Int, resultCount: Int, category: String) {
        trackEvent(
            "title_search",
            properties: [
                "queryLength": String(queryLength),
                "resultCount": String(resultCount),
                "category": category
            ]
        )
    }

    public func trackTitleSelect(_ title: Title, source: String) {
        trackEvent(
            "title_select",
            properties: [
                "titleId": title.id,
                "titleType": title.type.rawValue,
                "provider": title.provider.rawValue,
                "source": source
            ]
        )
    }

    private static func deviceDisplayName() -> String {
        #if canImport(UIKit)
        return UIDevice.current.userInterfaceIdiom == .pad ? "iPad (ottline)" : "iPhone (ottline)"
        #else
        return "iOS (ottline)"
        #endif
    }

    private static func isTabletDevice() -> Bool {
        #if canImport(UIKit)
        return UIDevice.current.userInterfaceIdiom == .pad
        #else
        return false
        #endif
    }
}
