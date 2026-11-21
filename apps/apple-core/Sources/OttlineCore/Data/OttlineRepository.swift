import Foundation
import Combine
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

public final class OttlineRepository: ObservableObject, @unchecked Sendable {
    public let db: OttlineDatabase
    public let prefs: AppPreferences
    public let api: OttlineApiClient

    @Published public private(set) var logs: [WatchLog] = []
    @Published public private(set) var logSyncStatuses: [String: String] = [:]
    @Published public private(set) var outboxCount: Int = 0
    @Published public private(set) var bookClassifications: [String: BookClassificationItemDto] = [:]
    @Published public private(set) var syncState: SyncState = SyncState()

    private let syncLock = NSLock()
    private var isSyncingFlag = false
    private var pendingSyncRetryFlag = false
    private var appOpenTracked = false
    private var prefsCancellable: AnyCancellable?

    public static let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "2.0.0"
    public static let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "25"

    public init(db: OttlineDatabase, prefs: AppPreferences, api: OttlineApiClient) {
        self.db = db
        self.prefs = prefs
        self.api = api

        self.prefsCancellable = prefs.objectWillChange.sink { [weak self] _ in
            if Thread.isMainThread {
                self?.objectWillChange.send()
            } else {
                DispatchQueue.main.async {
                    self?.objectWillChange.send()
                }
            }
        }

        // Seamless v1 -> v2 migration on first startup
        LegacyIosMigrator.runMigrationIfNeeded(prefs: prefs, db: db)

        self.api.onAuthRevoked = { [weak self] in
            self?.handleServerDeviceUnlinked()
        }

        reloadFromLocalDb()
    }

    public func reloadFromLocalDb() {
        let activeLogs = db.getActiveLogs()
        let statuses = db.getLogSyncStatuses()
        let count = db.outboxCount()
        let cls = db.getAllBookClassifications()
        self.logs = activeLogs
        self.logSyncStatuses = statuses
        self.outboxCount = count
        self.bookClassifications = cls
        prefs.updateWidgetSnapshot(from: activeLogs)
        SpotlightIndexManager.shared.syncLogs(activeLogs, locale: prefs.snapshot.locale)
        RecapNotificationManager.shared.refreshEveningReminderIfEnabled(logs: activeLogs, prefs: prefs)
    }

    public func initializeSessionAndSync() {
        Task {
            _ = await drainSharedExtensionQueue()
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

    @discardableResult
    public func drainSharedExtensionQueue() async -> Int {
        let entries = prefs.consumeSharedExtensionLogs()
        guard !entries.isEmpty else { return 0 }
        for entry in entries {
            let draft = LogDraft(
                status: entry.status,
                rating: entry.rating,
                note: entry.note,
                spoiler: false,
                ott: entry.ott,
                watchedAt: entry.watchedAt
            )
            _ = await saveLogForTitle(
                candidateTitle: entry.title,
                draft: draft,
                existingLogId: entry.id,
                source: "ios_share_extension"
            )
        }
        return entries.count
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

    public struct BrowserHandoffOutcome: Equatable, Sendable {
        public let success: Bool
        public let message: String

        public init(success: Bool, message: String) {
            self.success = success
            self.message = message
        }
    }

    public func pairWithCode(_ code: String) async throws -> PairDeviceResponse {
        if (prefs.snapshot.userId ?? "").isEmpty && (!db.getActiveLogs().isEmpty || db.outboxCount() > 0) {
            _ = try? await ensureAuthenticated()
        }
        let oldUserId = prefs.snapshot.userId
        // Push any pending local outbox changes first so server can merge them safely
        if !(oldUserId ?? "").isEmpty && db.outboxCount() > 0 {
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
        if resp.userId != oldUserId {
            prefs.setLastSyncSince(nil, userId: nil)
            db.clearAllTables()
            reloadFromLocalDb()
        }

        if let profile = try? await api.getProfile() {
            prefs.saveProfile(nickname: profile.nickname, personaKey: profile.personaKey)
        }

        try? await pullChangesInternal(forceFullPull: true)
        reloadFromLocalDb()

        trackEvent("device_pair", properties: ["mergedLogsCount": String(resp.mergedLogsCount ?? 0)])
        return resp
    }

    public func buildBrowserHandoffStartUrl() -> URL? {
        var root = prefs.snapshot.apiBaseUrl
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if root.hasSuffix("/api") {
            root = String(root.dropLast(4))
        }
        let lang = prefs.snapshot.locale == "en" ? "en" : "ko"
        let ts = Int64(Date().timeIntervalSince1970 * 1000)
        return URL(string: "\(root)/\(lang)?native_handoff=1&ts=\(ts)")
    }

    @discardableResult
    public func importBrowserHandoff(_ handoff: ParsedBrowserHandoff) async -> BrowserHandoffOutcome {
        let locale = prefs.snapshot.locale

        if handoff.status?.lowercased() == "empty" {
            return BrowserHandoffOutcome(
                success: false,
                message: OttlineStrings.tr(
                    "열린 브라우저에 이전 기록이 없어요. 다른 브라우저로 시도하거나 8자리 연결 코드를 입력해 보세요.",
                    "No previous records were found in that browser. Try your other browser or enter your 8-character connection code.",
                    locale: locale
                )
            )
        }

        func restoreProfileIfEmpty(remote: UserProfileDto? = nil) {
            let currentNick = prefs.snapshot.nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
            let remoteNick = remote?.nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
            let handoffNick = handoff.nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
            let resolvedNick: String? = {
                if let currentNick, !currentNick.isEmpty { return currentNick }
                if let remoteNick, !remoteNick.isEmpty { return remoteNick }
                if let handoffNick, !handoffNick.isEmpty { return handoffNick }
                return nil
            }()
            let resolvedPersona = prefs.snapshot.personaKey ?? remote?.personaKey ?? handoff.personaKey
            if resolvedNick != prefs.snapshot.nickname || resolvedPersona != prefs.snapshot.personaKey {
                prefs.saveProfile(nickname: resolvedNick, personaKey: resolvedPersona)
            }
        }

        if let curUid = prefs.snapshot.userId, !curUid.isEmpty,
           let handoffUid = handoff.userId,
           curUid.caseInsensitiveCompare(handoffUid) == .orderedSame,
           let curDid = prefs.snapshot.deviceId, !curDid.isEmpty {
            if (prefs.snapshot.pairingCode ?? "").isEmpty,
               let code = handoff.pairingCode, !code.isEmpty {
                prefs.saveAuth(
                    userId: curUid,
                    deviceId: curDid,
                    pairingCode: code,
                    nickname: prefs.snapshot.nickname ?? handoff.nickname,
                    personaKey: prefs.snapshot.personaKey ?? handoff.personaKey
                )
            }
            restoreProfileIfEmpty()
            _ = await syncOutbox()
            try? await pullChangesInternal(forceFullPull: true)
            reloadFromLocalDb()
            return BrowserHandoffOutcome(
                success: true,
                message: OttlineStrings.tr(
                    "웹 브라우저 기록과 이미 연결되어 있어 최신 상태로 동기화했어요.",
                    "Your browser records are already linked and synced.",
                    locale: locale
                )
            )
        }

        var resolvedCode = handoff.pairingCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        var fetchedProfile: UserProfileDto?
        if (resolvedCode == nil || resolvedCode?.isEmpty == true),
           let uid = handoff.userId, let did = handoff.deviceId {
            fetchedProfile = try? await api.getProfile(overrideUserId: uid, overrideDeviceId: did)
            if let codeFromProfile = fetchedProfile?.pairingCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
               !codeFromProfile.isEmpty {
                resolvedCode = codeFromProfile
            }
        }

        if let code = resolvedCode, !code.isEmpty {
            let hadLocalLogs = !db.getActiveLogs().isEmpty
            do {
                _ = try await pairWithCode(code)
                restoreProfileIfEmpty(remote: fetchedProfile)
                trackEvent("login_success", properties: ["source": "native_handoff"])
                return BrowserHandoffOutcome(
                    success: true,
                    message: hadLocalLogs
                        ? OttlineStrings.tr(
                            "기존 기록과 현재 기기 기록을 연결했어요.",
                            "Connected and merged your previous records.",
                            locale: locale
                        )
                        : OttlineStrings.tr(
                            "웹 브라우저에서 쓰던 기록을 이어받았어요.",
                            "Connected your previous browser records.",
                            locale: locale
                        )
                )
            } catch {
                if handoff.userId == nil || handoff.deviceId == nil || !db.getActiveLogs().isEmpty {
                    return BrowserHandoffOutcome(
                        success: false,
                        message: OttlineStrings.tr(
                            "브라우저 기록 연결을 마치지 못했어요. 잠시 후 다시 시도하거나 8자리 연결 코드를 입력해 주세요.",
                            "Could not finish linking your browser records. Please try again or enter your 8-character connection code.",
                            locale: locale
                        )
                    )
                }
            }
        }

        if let uid = handoff.userId, let did = handoff.deviceId {
            if !db.getActiveLogs().isEmpty || db.outboxCount() > 0 {
                return BrowserHandoffOutcome(
                    success: false,
                    message: OttlineStrings.tr(
                        "이 기기에 이미 남겨둔 기록이 있어 바로 덮어쓰지 않았어요. 인터넷 연결을 확인하거나 브라우저의 8자리 연결 코드로 이어받아 주세요.",
                        "This device already has local records, so they were kept safe. Check your connection or enter your 8-character code from the browser to merge.",
                        locale: locale
                    )
                )
            }
            prefs.setLastSyncSince(nil, userId: nil)
            db.clearAllTables()
            prefs.saveAuth(
                userId: uid,
                deviceId: did,
                pairingCode: nil,
                nickname: handoff.nickname,
                personaKey: handoff.personaKey
            )
            restoreProfileIfEmpty(remote: fetchedProfile)
            try? await pullChangesInternal(forceFullPull: true)
            reloadFromLocalDb()
            trackEvent("login_success", properties: ["source": "native_handoff_direct"])
            return BrowserHandoffOutcome(
                success: true,
                message: OttlineStrings.tr(
                    "웹 브라우저에서 쓰던 기록을 이어받았어요.",
                    "Connected your previous browser records.",
                    locale: locale
                )
            )
        }

        return BrowserHandoffOutcome(
            success: false,
            message: OttlineStrings.tr(
                "열린 브라우저에 이전 기록이 없어요. 다른 브라우저로 시도하거나 8자리 연결 코드를 입력해 보세요.",
                "No previous records were found in that browser. Try your other browser or enter your 8-character connection code.",
                locale: locale
            )
        )
    }

    public func unlinkAllDevices() async throws {
        try await api.unlinkAllDevices()
        resetLocalData()
    }

    private func handleServerDeviceUnlinked() {
        db.clearAllTables()
        prefs.clearAccountSession()
        SpotlightIndexManager.shared.clearAll()
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

        let logId = existingLogRow?.log.id ?? existingLogId ?? UUID().uuidString.lowercased()
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
            let defaults = PlatformCatalog.allDefaultLabels(isBook: resolvedTitle.type == .book, locale: prefs.snapshot.locale)
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
                occasion: log.occasion?.rawValue
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

    private func tryAcquireSyncLock() -> Bool {
        syncLock.lock()
        defer { syncLock.unlock() }
        if isSyncingFlag {
            pendingSyncRetryFlag = true
            return false
        }
        isSyncingFlag = true
        pendingSyncRetryFlag = false
        return true
    }

    private func consumePendingRetryOrReleaseLock() -> Bool {
        syncLock.lock()
        defer { syncLock.unlock() }
        if pendingSyncRetryFlag {
            pendingSyncRetryFlag = false
            return true
        }
        isSyncingFlag = false
        return false
    }

    private func releaseSyncLock() {
        syncLock.lock()
        isSyncingFlag = false
        pendingSyncRetryFlag = false
        syncLock.unlock()
    }

    @discardableResult
    public func syncOutbox() async -> Bool {
        guard tryAcquireSyncLock() else {
            return false
        }

        var lastSucceeded = true
        repeat {
            let pending = db.getAllOutbox()
            let hasAuth = !(prefs.snapshot.userId ?? "").isEmpty && !(prefs.snapshot.deviceId ?? "").isEmpty
            if pending.isEmpty && !hasAuth {
                continue
            }

            syncState = SyncState(status: .syncing, lastSyncedAt: syncState.lastSyncedAt)

            do {
                let auth = try await ensureAuthenticated()
                guard let userId = auth.userId, let deviceId = auth.deviceId else {
                    syncState = SyncState(status: .idle)
                    releaseSyncLock()
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
                    let rejectedSet = Set(pushResp.rejected.map(\.id))
                    var syncedLogIds: [String] = []
                    for row in pending where row.entityType == "LOG" && acceptedSet.contains(row.entityId) {
                        let deleted = db.deleteOutboxIfRevisionMatches(id: row.id, revision: row.revision)
                        if deleted > 0 {
                            syncedLogIds.append(row.entityId)
                        }
                    }
                    db.markLogsSyncStatus(ids: syncedLogIds, status: "SYNCED")
                    if !rejectedSet.isEmpty {
                        db.markLogsSyncStatus(ids: Array(rejectedSet), status: "FAILED")
                    }
                }

                let isNewUserSync = prefs.snapshot.lastSyncUserId != userId
                try await pullChangesInternal(forceFullPull: isNewUserSync)

                let nowIso = RecordDate.nowIso()
                reloadFromLocalDb()
                syncState = SyncState(status: .idle, lastSyncedAt: nowIso, errorMessage: nil)
                lastSucceeded = true
            } catch {
                let pendingIds = pending.filter { $0.entityType == "LOG" }.map(\.entityId)
                db.markLogsSyncStatus(ids: pendingIds, status: "FAILED")
                reloadFromLocalDb()
                syncState = SyncState(
                    status: .failed,
                    lastSyncedAt: syncState.lastSyncedAt,
                    errorMessage: error.localizedDescription
                )
                releaseSyncLock()
                return false
            }
        } while consumePendingRetryOrReleaseLock()

        return lastSucceeded
    }

    public func pullChangesInternal(forceFullPull: Bool) async throws {
        let userId = prefs.snapshot.userId
        var cursor: String? = forceFullPull ? nil : prefs.snapshot.lastSyncSince
        var loops = 0
        while loops < 10 {
            loops += 1
            let resp = try await api.syncPull(since: cursor, limit: 250)
            let serverTitles = resp.changes.titles
            let serverLogs = resp.changes.logs

            for titleDto in serverTitles {
                applyServerTitlePull(titleDto)
            }
            for logDto in serverLogs {
                applyServerLogPull(logDto)
            }

            if !resp.serverTime.isEmpty {
                prefs.setLastSyncSince(resp.serverTime, userId: userId)
            }
            if serverTitles.count + serverLogs.count < 250 || resp.serverTime == cursor {
                break
            }
            cursor = resp.serverTime
        }
    }

    private func applyServerTitlePull(_ dto: SyncPullTitleDto) {
        let updatedAt = dto.updatedAt ?? dto.createdAt ?? RecordDate.nowIso()
        if let deletedAt = dto.deletedAt, !deletedAt.isEmpty {
            if let existing = db.getTitleById(dto.id) {
                db.upsertTitle(existing, updatedAt: updatedAt, deletedAt: deletedAt)
            }
            return
        }
        let provider = dto.provider ?? .local
        let title = Title(
            id: dto.id,
            provider: provider,
            providerId: dto.providerId,
            type: dto.type,
            name: dto.name,
            year: dto.year,
            posterUrl: dto.posterUrl,
            overview: dto.overview,
            genres: dto.genres,
            directors: dto.directors,
            cast: dto.cast,
            author: dto.author,
            publisher: dto.publisher,
            isbn10: dto.isbn10,
            isbn13: dto.isbn13,
            pubdate: dto.pubdate
        )
        db.reconcileCanonicalTitle(title)
        db.upsertTitle(title, updatedAt: updatedAt, deletedAt: nil)
    }

    private func applyServerLogPull(_ dto: SyncPullLogDto) {
        let updatedAt = dto.updatedAt ?? dto.watchedAt ?? dto.createdAt ?? RecordDate.nowIso()
        // Never overwrite a log that has an unpushed local outbox entry newer than server
        if let localOutbox = db.getOutboxById("LOG:\(dto.id)") {
            let localMs = RecordDate.parseInstantMillis(localOutbox.updatedAt)
            let serverMs = RecordDate.parseInstantMillis(updatedAt)
            if localMs > serverMs {
                return
            }
        }

        if let existing = db.getWatchLogById(dto.id) {
            let localMs = RecordDate.parseInstantMillis(existing.updatedAt)
            let serverMs = RecordDate.parseInstantMillis(updatedAt)
            if localMs > serverMs {
                return
            }
        }

        if let deletedAt = dto.deletedAt, !deletedAt.isEmpty {
            if let existing = db.getWatchLogById(dto.id) {
                db.upsertWatchLog(existing.log, updatedAt: updatedAt, deletedAt: deletedAt, syncStatus: "SYNCED")
            }
            return
        }

        let title = db.getTitleById(dto.titleId) ?? Title(id: dto.titleId, name: "Unknown")
        let log = WatchLog(
            id: dto.id,
            title: title,
            status: dto.status,
            rating: dto.rating,
            note: dto.note,
            spoiler: dto.spoiler ?? false,
            ott: dto.ott,
            seasonNumber: dto.seasonNumber,
            episodeNumber: dto.episodeNumber,
            seasonPosterUrl: dto.seasonPosterUrl,
            seasonYear: dto.seasonYear,
            origin: dto.origin ?? .log,
            createdAt: dto.createdAt ?? updatedAt,
            watchedAt: dto.watchedAt ?? updatedAt,
            place: dto.place,
            occasion: dto.occasion,
            updatedAt: updatedAt
        )
        db.upsertWatchLog(log, updatedAt: updatedAt, deletedAt: nil, syncStatus: "SYNCED")
        db.deleteLogsByTitleExcept(titleId: dto.titleId, keepLogId: dto.id)
    }

    // MARK: - 4. Timeline Cursor Pagination Upsert (`GET /api/logs/page`)

    public func upsertLogsFromServerPage(_ items: [WatchLog]) {
        guard !items.isEmpty else { return }
        var didMutate = false
        db.inTransaction {
            for item in items {
                if db.getOutboxById("LOG:\(item.id)") != nil {
                    continue
                }
                let serverUpdated = item.updatedAt ?? item.watchedAt
                if let existing = db.getWatchLogById(item.id),
                   existing.deletedAt == nil,
                   existing.syncStatus == "SYNCED",
                   existing.updatedAt == serverUpdated,
                   existing.log.title.id == item.title.id,
                   existing.log.title.name == item.title.name,
                   (item.title.posterUrl == nil || existing.log.title.posterUrl == item.title.posterUrl),
                   existing.log.status == item.status,
                   existing.log.rating == item.rating,
                   existing.log.note == item.note,
                   existing.log.spoiler == item.spoiler,
                   existing.log.ott == item.ott,
                   existing.log.seasonNumber == item.seasonNumber,
                   existing.log.episodeNumber == item.episodeNumber,
                   existing.log.seasonPosterUrl == item.seasonPosterUrl,
                   existing.log.seasonYear == item.seasonYear,
                   existing.log.watchedAt == item.watchedAt,
                   existing.log.place == item.place,
                   existing.log.occasion == item.occasion,
                   db.getActiveLogsByTitleId(item.title.id).count <= 1 {
                    continue
                }
                db.reconcileCanonicalTitle(item.title)
                let hasPendingForTitle = db.getActiveLogsByTitleId(item.title.id).contains {
                    db.getOutboxById("LOG:\($0.id)") != nil
                }
                if hasPendingForTitle {
                    continue
                }
                if let existing = db.getWatchLogById(item.id) {
                    let localMs = RecordDate.parseInstantMillis(existing.updatedAt)
                    let serverMs = RecordDate.parseInstantMillis(serverUpdated)
                    if localMs > serverMs {
                        continue
                    }
                }
                db.upsertWatchLog(item, updatedAt: serverUpdated, deletedAt: nil, syncStatus: "SYNCED")
                db.deleteLogsByTitleExcept(titleId: item.title.id, keepLogId: item.id)
                didMutate = true
            }
        }
        if didMutate {
            reloadFromLocalDb()
        }
    }

    // MARK: - 5. KDC Bookshelf Classification Cache (Korean-only)

    public func ensureBookClassificationsCached(titles: [Title], forceRetryNotFound: Bool = false) async {
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
            if row.status.uppercased() == "RESOLVED" {
                return age > classifiedTtlMs
            }
            if row.status.uppercased() == "NOT_FOUND" && forceRetryNotFound {
                return true
            }
            return age > pendingTtlMs
        }
        guard !toFetch.isEmpty else { return }

        if let resolved = try? await api.resolveBookClassifications(isbns: toFetch) {
            db.upsertBookClassifications(resolved, nowMs: nowMs)
            reloadFromLocalDb()
        }
    }

    // MARK: - 5b. Together Discussions, Reactions & Auto-Log

    public func toggleReactionAndAutoLog(
        discussionId: String,
        title: Title,
        type: DiscussionReactionType
    ) async throws -> DiscussionReactionState {
        _ = try await ensureAuthenticated()
        let state = try await api.toggleDiscussionReaction(discussionId: discussionId, type: type)
        if state.selectedTypes.contains(type) {
            let existingTitle = findMatchingLocalTitle(title)
            let hasLog = existingTitle.map { !db.getActiveLogsByTitleId($0.id).isEmpty } ?? false
            if !hasLog {
                let autoStatus: LogStatus = (type == .done) ? .done : .wishlist
                let draft = LogDraft(
                    status: autoStatus,
                    watchedAt: RecordDate.todayIsoDateTime()
                )
                _ = await saveLogForTitle(
                    candidateTitle: existingTitle ?? title,
                    draft: draft,
                    source: "together_reaction_\(type.rawValue.lowercased())"
                )
            }
        }
        return state
    }

    @discardableResult
    public func shareNoteToTogether(log: WatchLog, noteBody: String) async throws -> DiscussionDto {
        let trimmed = noteBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw ApiError(statusCode: 400, code: "empty_note", message: "Note is empty")
        }
        if db.getOutboxById("LOG:\(log.id)") != nil || db.getOutboxById("TITLE:\(log.title.id)") != nil {
            _ = await syncOutbox()
        }
        let resolvedTitleId = db.getWatchLogById(log.id)?.log.title.id ?? log.title.id
        let discussion = try await api.ensureDiscussion(titleId: resolvedTitleId)
        _ = try await api.createDiscussionComment(
            discussionId: discussion.id,
            payload: CreateCommentRequest(body: trimmed, mentions: [], syncLog: false)
        )
        return discussion
    }

    // MARK: - 6. Local Reset vs Permanent Server Account Deletion

    public func resetLocalData() {
        db.clearAllTables()
        prefs.clearAccountSession()
        SpotlightIndexManager.shared.clearAll()
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
        #if os(macOS)
        let osFamily = "macos"
        let deviceType = "desktop"
        #else
        let osFamily = "ios"
        let deviceType = Self.isTabletDevice() ? "tablet" : "mobile"
        #endif
        var merged: [String: String] = [
            "osFamily": osFamily,
            "deviceType": deviceType,
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
        let payload = AnalyticsSingleEventRequest(
            eventName: eventName,
            platform: "ios_native",
            sessionId: snap.sessionId,
            clientVersion: Self.appVersion,
            occurredAt: RecordDate.nowIso(),
            properties: merged
        )
        let clientId = snap.analyticsClientId
        Task {
            await api.trackAnalyticsEvent(payload, clientId: clientId)
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
        #if os(macOS)
        return "Mac (ottline)"
        #elseif canImport(UIKit)
        return UIDevice.current.userInterfaceIdiom == .pad ? "iPad (ottline)" : "iPhone (ottline)"
        #else
        return "Apple (ottline)"
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
