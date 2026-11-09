import Foundation
import SQLite3

private let SQLITE_TRANSIENT_DESTRUCTOR = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

public struct OutboxRow: Equatable, Sendable {
    public let id: String
    public let entityType: String // "TITLE" | "LOG"
    public let entityId: String
    public let op: String // "UPSERT" | "DELETE"
    public let payloadJson: String
    public let updatedAt: String
    public let revision: Int64
}

public struct BookClassificationCacheRow: Equatable, Sendable {
    public let isbn13: String
    public let status: String
    public let kdcCode: String?
    public let kdcMajor: Int?
    public let source: String?
    public let resolvedAt: String?
    public let cachedAtEpochMs: Int64

    public func toDto() -> BookClassificationItemDto {
        BookClassificationItemDto(
            isbn13: isbn13,
            status: status,
            kdcCode: kdcCode,
            kdcMajor: kdcMajor,
            source: source,
            resolvedAt: resolvedAt
        )
    }
}

public final class OttlineDatabase: @unchecked Sendable {
    private let lock = NSRecursiveLock()
    private var db: OpaquePointer?
    public let databasePath: String

    public init(path: String? = nil) {
        let resolvedPath: String = {
            if let path { return path }
            let baseDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
                ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let dir = baseDir.appendingPathComponent("OttlineDB", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            return dir.appendingPathComponent("ottline_v2.db").path
        }()
        self.databasePath = resolvedPath
        openAndMigrate()
    }

    deinit {
        if let db {
            sqlite3_close(db)
        }
    }

    private func openAndMigrate() {
        lock.lock()
        defer { lock.unlock() }
        if sqlite3_open_v2(
            databasePath,
            &db,
            SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
            nil
        ) != SQLITE_OK {
            return
        }
        exec("PRAGMA journal_mode = WAL;")
        exec("PRAGMA synchronous = NORMAL;")
        exec("""
        CREATE TABLE IF NOT EXISTS titles (
            id TEXT PRIMARY KEY NOT NULL,
            provider TEXT NOT NULL,
            provider_id TEXT,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            year INTEGER,
            poster_url TEXT,
            overview TEXT,
            genres_json TEXT,
            directors_json TEXT,
            cast_json TEXT,
            author TEXT,
            publisher TEXT,
            isbn10 TEXT,
            isbn13 TEXT,
            pubdate TEXT,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_titles_provider ON titles(provider, provider_id, type);
        CREATE INDEX IF NOT EXISTS idx_titles_isbn13 ON titles(isbn13);

        CREATE TABLE IF NOT EXISTS watch_logs (
            id TEXT PRIMARY KEY NOT NULL,
            title_id TEXT NOT NULL,
            status TEXT NOT NULL,
            rating REAL,
            note TEXT,
            spoiler INTEGER NOT NULL DEFAULT 0,
            ott TEXT,
            season_number INTEGER,
            episode_number INTEGER,
            season_poster_url TEXT,
            season_year INTEGER,
            origin TEXT NOT NULL DEFAULT 'LOG',
            created_at TEXT NOT NULL,
            watched_at TEXT NOT NULL,
            place TEXT,
            occasion TEXT,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_status TEXT NOT NULL DEFAULT 'SYNCED'
        );
        CREATE INDEX IF NOT EXISTS idx_watch_logs_title_id ON watch_logs(title_id);
        CREATE INDEX IF NOT EXISTS idx_watch_logs_watched_at ON watch_logs(watched_at);

        CREATE TABLE IF NOT EXISTS watch_log_history (
            id TEXT PRIMARY KEY NOT NULL,
            log_id TEXT NOT NULL,
            recorded_at TEXT NOT NULL,
            status TEXT NOT NULL,
            rating REAL,
            note TEXT,
            spoiler INTEGER NOT NULL DEFAULT 0,
            ott TEXT,
            season_number INTEGER,
            episode_number INTEGER,
            season_poster_url TEXT,
            season_year INTEGER,
            origin TEXT NOT NULL DEFAULT 'LOG',
            watched_at TEXT NOT NULL,
            place TEXT,
            occasion TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_history_log_id ON watch_log_history(log_id, recorded_at DESC);

        CREATE TABLE IF NOT EXISTS outbox (
            id TEXT PRIMARY KEY NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            op TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS book_classifications (
            isbn13 TEXT PRIMARY KEY NOT NULL,
            status TEXT NOT NULL,
            kdc_code TEXT,
            kdc_major INTEGER,
            source TEXT,
            resolved_at TEXT,
            cached_at_epoch_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meta_counters (
            key TEXT PRIMARY KEY NOT NULL,
            val INTEGER NOT NULL DEFAULT 0
        );
        """)
    }

    private func exec(_ sql: String) {
        guard let db else { return }
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    private func nextRevisionLocked() -> Int64 {
        guard let db else { return Int64(Date().timeIntervalSince1970 * 1000) }
        exec("INSERT INTO meta_counters(key, val) VALUES('outbox_rev', 0) ON CONFLICT(key) DO UPDATE SET val = val + 1;")
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        if sqlite3_prepare_v2(db, "SELECT val FROM meta_counters WHERE key = 'outbox_rev' LIMIT 1;", -1, &stmt, nil) == SQLITE_OK,
           sqlite3_step(stmt) == SQLITE_ROW {
            return sqlite3_column_int64(stmt, 0)
        }
        return Int64(Date().timeIntervalSince1970 * 1000)
    }

    // MARK: - Titles

    public func upsertTitle(_ title: Title, updatedAt: String = RecordDate.nowIso(), deletedAt: String? = nil) {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return }
        let sql = """
        INSERT INTO titles (
            id, provider, provider_id, type, name, year, poster_url, overview,
            genres_json, directors_json, cast_json, author, publisher, isbn10, isbn13, pubdate,
            updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            provider = excluded.provider,
            provider_id = COALESCE(excluded.provider_id, titles.provider_id),
            type = excluded.type,
            name = excluded.name,
            year = COALESCE(excluded.year, titles.year),
            poster_url = COALESCE(excluded.poster_url, titles.poster_url),
            overview = COALESCE(excluded.overview, titles.overview),
            genres_json = COALESCE(excluded.genres_json, titles.genres_json),
            directors_json = COALESCE(excluded.directors_json, titles.directors_json),
            cast_json = COALESCE(excluded.cast_json, titles.cast_json),
            author = COALESCE(excluded.author, titles.author),
            publisher = COALESCE(excluded.publisher, titles.publisher),
            isbn10 = COALESCE(excluded.isbn10, titles.isbn10),
            isbn13 = COALESCE(excluded.isbn13, titles.isbn13),
            pubdate = COALESCE(excluded.pubdate, titles.pubdate),
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }

        bindText(stmt, 1, title.id)
        bindText(stmt, 2, title.provider.rawValue)
        bindOptionalText(stmt, 3, title.providerId)
        bindText(stmt, 4, title.type.rawValue)
        bindText(stmt, 5, title.name)
        bindOptionalInt(stmt, 6, title.year)
        bindOptionalText(stmt, 7, title.posterUrl)
        bindOptionalText(stmt, 8, title.overview)
        bindOptionalText(stmt, 9, encodeStringArray(title.genres))
        bindOptionalText(stmt, 10, encodeStringArray(title.directors))
        bindOptionalText(stmt, 11, encodeStringArray(title.cast))
        bindOptionalText(stmt, 12, title.author)
        bindOptionalText(stmt, 13, title.publisher)
        bindOptionalText(stmt, 14, title.isbn10)
        bindOptionalText(stmt, 15, title.isbn13)
        bindOptionalText(stmt, 16, title.pubdate)
        bindText(stmt, 17, updatedAt)
        bindOptionalText(stmt, 18, deletedAt)
        sqlite3_step(stmt)
    }

    public func getTitleById(_ id: String) -> Title? {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return nil }
        let sql = """
        SELECT id, provider, provider_id, type, name, year, poster_url, overview,
               genres_json, directors_json, cast_json, author, publisher, isbn10, isbn13, pubdate
        FROM titles WHERE id = ? LIMIT 1;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        bindText(stmt, 1, id)
        guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
        return readTitleRow(stmt)
    }

    public func findTitleByProvider(provider: String, providerId: String, type: String) -> Title? {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return nil }
        let sql = """
        SELECT id, provider, provider_id, type, name, year, poster_url, overview,
               genres_json, directors_json, cast_json, author, publisher, isbn10, isbn13, pubdate
        FROM titles
        WHERE UPPER(provider) = UPPER(?) AND provider_id = ? AND LOWER(type) = LOWER(?) AND deleted_at IS NULL
        LIMIT 1;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        bindText(stmt, 1, provider)
        bindText(stmt, 2, providerId)
        bindText(stmt, 3, type)
        guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
        return readTitleRow(stmt)
    }

    public func findBookByIsbn13(_ isbn13: String) -> Title? {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return nil }
        let sql = """
        SELECT id, provider, provider_id, type, name, year, poster_url, overview,
               genres_json, directors_json, cast_json, author, publisher, isbn10, isbn13, pubdate
        FROM titles
        WHERE LOWER(type) = 'book' AND deleted_at IS NULL AND (isbn13 LIKE ? OR provider_id LIKE ?)
        LIMIT 1;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        let pattern = "%\(isbn13)%"
        bindText(stmt, 1, pattern)
        bindText(stmt, 2, pattern)
        guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
        return readTitleRow(stmt)
    }

    private func readTitleRow(_ stmt: OpaquePointer?) -> Title {
        Title(
            id: colString(stmt, 0) ?? "",
            provider: Provider.fromWire(colString(stmt, 1)),
            providerId: colString(stmt, 2),
            type: TitleType.fromWire(colString(stmt, 3)),
            name: colString(stmt, 4) ?? "",
            year: colInt(stmt, 5),
            posterUrl: colString(stmt, 6),
            overview: colString(stmt, 7),
            genres: decodeStringArray(colString(stmt, 8)),
            directors: decodeStringArray(colString(stmt, 9)),
            cast: decodeStringArray(colString(stmt, 10)),
            author: colString(stmt, 11),
            publisher: colString(stmt, 12),
            isbn10: colString(stmt, 13),
            isbn13: colString(stmt, 14),
            pubdate: colString(stmt, 15)
        )
    }

    // MARK: - Watch Logs

    public func upsertWatchLog(
        _ log: WatchLog,
        updatedAt: String? = nil,
        deletedAt: String? = nil,
        syncStatus: String = "SYNCED"
    ) {
        lock.lock()
        defer { lock.unlock() }
        let resolvedUpdated = updatedAt ?? log.updatedAt ?? RecordDate.nowIso()
        upsertTitle(log.title, updatedAt: resolvedUpdated)
        guard let db else { return }

        let sql = """
        INSERT INTO watch_logs (
            id, title_id, status, rating, note, spoiler, ott,
            season_number, episode_number, season_poster_url, season_year,
            origin, created_at, watched_at, place, occasion,
            updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title_id = excluded.title_id,
            status = excluded.status,
            rating = excluded.rating,
            note = excluded.note,
            spoiler = excluded.spoiler,
            ott = excluded.ott,
            season_number = excluded.season_number,
            episode_number = excluded.episode_number,
            season_poster_url = excluded.season_poster_url,
            season_year = excluded.season_year,
            origin = excluded.origin,
            created_at = excluded.created_at,
            watched_at = excluded.watched_at,
            place = excluded.place,
            occasion = excluded.occasion,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_status = excluded.sync_status;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }

        bindText(stmt, 1, log.id)
        bindText(stmt, 2, log.title.id)
        bindText(stmt, 3, log.status.rawValue)
        bindOptionalDouble(stmt, 4, log.rating)
        bindOptionalText(stmt, 5, log.note)
        sqlite3_bind_int(stmt, 6, log.spoiler ? 1 : 0)
        bindOptionalText(stmt, 7, log.ott)
        bindOptionalInt(stmt, 8, log.seasonNumber)
        bindOptionalInt(stmt, 9, log.episodeNumber)
        bindOptionalText(stmt, 10, log.seasonPosterUrl)
        bindOptionalInt(stmt, 11, log.seasonYear)
        bindText(stmt, 12, log.origin.rawValue)
        bindText(stmt, 13, log.createdAt.isEmpty ? resolvedUpdated : log.createdAt)
        bindText(stmt, 14, log.watchedAt.isEmpty ? resolvedUpdated : log.watchedAt)
        bindOptionalText(stmt, 15, log.place?.rawValue)
        bindOptionalText(stmt, 16, log.occasion?.rawValue)
        bindText(stmt, 17, resolvedUpdated)
        bindOptionalText(stmt, 18, deletedAt)
        bindText(stmt, 19, syncStatus)
        sqlite3_step(stmt)
    }

    public func getActiveLogs() -> [WatchLog] {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return [] }
        let sql = """
        SELECT l.id, l.title_id, l.status, l.rating, l.note, l.spoiler, l.ott,
               l.season_number, l.episode_number, l.season_poster_url, l.season_year,
               l.origin, l.created_at, l.watched_at, l.place, l.occasion, l.updated_at
        FROM watch_logs l
        WHERE l.deleted_at IS NULL
        ORDER BY l.watched_at DESC, l.created_at DESC;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }

        var results: [WatchLog] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let log = readWatchLogRow(stmt) {
                results.append(log)
            }
        }
        return results
    }

    public func getWatchLogById(_ id: String) -> (log: WatchLog, updatedAt: String, deletedAt: String?, syncStatus: String)? {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return nil }
        let sql = """
        SELECT l.id, l.title_id, l.status, l.rating, l.note, l.spoiler, l.ott,
               l.season_number, l.episode_number, l.season_poster_url, l.season_year,
               l.origin, l.created_at, l.watched_at, l.place, l.occasion, l.updated_at,
               l.deleted_at, l.sync_status
        FROM watch_logs l WHERE l.id = ? LIMIT 1;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        bindText(stmt, 1, id)
        guard sqlite3_step(stmt) == SQLITE_ROW, let log = readWatchLogRow(stmt) else { return nil }
        let updatedAt = colString(stmt, 16) ?? log.updatedAt ?? ""
        let deletedAt = colString(stmt, 17)
        let syncStatus = colString(stmt, 18) ?? "SYNCED"
        return (log, updatedAt, deletedAt, syncStatus)
    }

    public func getActiveLogsByTitleId(_ titleId: String) -> [WatchLog] {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return [] }
        let sql = """
        SELECT l.id, l.title_id, l.status, l.rating, l.note, l.spoiler, l.ott,
               l.season_number, l.episode_number, l.season_poster_url, l.season_year,
               l.origin, l.created_at, l.watched_at, l.place, l.occasion, l.updated_at
        FROM watch_logs l
        WHERE l.title_id = ? AND l.deleted_at IS NULL
        ORDER BY l.watched_at DESC, l.created_at DESC;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        bindText(stmt, 1, titleId)
        var results: [WatchLog] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let log = readWatchLogRow(stmt) {
                results.append(log)
            }
        }
        return results
    }

    public func markLogsSyncStatus(ids: [String], status: String) {
        guard !ids.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return }
        for id in ids {
            var stmt: OpaquePointer?
            if sqlite3_prepare_v2(db, "UPDATE watch_logs SET sync_status = ? WHERE id = ?;", -1, &stmt, nil) == SQLITE_OK {
                bindText(stmt, 1, status)
                bindText(stmt, 2, id)
                sqlite3_step(stmt)
            }
            sqlite3_finalize(stmt)
        }
    }

    private func readWatchLogRow(_ stmt: OpaquePointer?) -> WatchLog? {
        guard let id = colString(stmt, 0),
              let titleId = colString(stmt, 1) else { return nil }
        let title = getTitleById(titleId) ?? Title(id: titleId, name: "Unknown")
        return WatchLog(
            id: id,
            title: title,
            status: LogStatus.fromWire(colString(stmt, 2)),
            rating: colDouble(stmt, 3),
            note: colString(stmt, 4),
            spoiler: sqlite3_column_int(stmt, 5) != 0,
            ott: colString(stmt, 6),
            seasonNumber: colInt(stmt, 7),
            episodeNumber: colInt(stmt, 8),
            seasonPosterUrl: colString(stmt, 9),
            seasonYear: colInt(stmt, 10),
            origin: LogOrigin.fromWire(colString(stmt, 11)),
            createdAt: colString(stmt, 12) ?? "",
            watchedAt: colString(stmt, 13) ?? "",
            place: Place.fromWire(colString(stmt, 14)),
            occasion: Occasion.fromWire(colString(stmt, 15)),
            updatedAt: colString(stmt, 16)
        )
    }

    // MARK: - Watch Log History

    public func insertHistory(_ item: WatchLogHistoryItem) {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return }
        let sql = """
        INSERT OR REPLACE INTO watch_log_history (
            id, log_id, recorded_at, status, rating, note, spoiler, ott,
            season_number, episode_number, season_poster_url, season_year,
            origin, watched_at, place, occasion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        bindText(stmt, 1, item.id)
        bindText(stmt, 2, item.logId)
        bindText(stmt, 3, item.recordedAt)
        bindText(stmt, 4, item.status.rawValue)
        bindOptionalDouble(stmt, 5, item.rating)
        bindOptionalText(stmt, 6, item.note)
        sqlite3_bind_int(stmt, 7, item.spoiler ? 1 : 0)
        bindOptionalText(stmt, 8, item.ott)
        bindOptionalInt(stmt, 9, item.seasonNumber)
        bindOptionalInt(stmt, 10, item.episodeNumber)
        bindOptionalText(stmt, 11, item.seasonPosterUrl)
        bindOptionalInt(stmt, 12, item.seasonYear)
        bindText(stmt, 13, item.origin.rawValue)
        bindText(stmt, 14, item.watchedAt)
        bindOptionalText(stmt, 15, item.place?.rawValue)
        bindOptionalText(stmt, 16, item.occasion?.rawValue)
        sqlite3_step(stmt)
    }

    public func getHistoryForLog(_ logId: String) -> [WatchLogHistoryItem] {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return [] }
        let sql = """
        SELECT id, log_id, recorded_at, status, rating, note, spoiler, ott,
               season_number, episode_number, season_poster_url, season_year,
               origin, watched_at, place, occasion
        FROM watch_log_history
        WHERE log_id = ?
        ORDER BY recorded_at DESC;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        bindText(stmt, 1, logId)
        var items: [WatchLogHistoryItem] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            items.append(
                WatchLogHistoryItem(
                    id: colString(stmt, 0) ?? "",
                    logId: colString(stmt, 1) ?? logId,
                    recordedAt: colString(stmt, 2) ?? "",
                    status: LogStatus.fromWire(colString(stmt, 3)),
                    rating: colDouble(stmt, 4),
                    note: colString(stmt, 5),
                    spoiler: sqlite3_column_int(stmt, 6) != 0,
                    ott: colString(stmt, 7),
                    seasonNumber: colInt(stmt, 8),
                    episodeNumber: colInt(stmt, 9),
                    seasonPosterUrl: colString(stmt, 10),
                    seasonYear: colInt(stmt, 11),
                    origin: LogOrigin.fromWire(colString(stmt, 12)),
                    watchedAt: colString(stmt, 13) ?? "",
                    place: Place.fromWire(colString(stmt, 14)),
                    occasion: Occasion.fromWire(colString(stmt, 15))
                )
            )
        }
        return items
    }

    // MARK: - Outbox (with monotonic revision check)

    @discardableResult
    public func enqueueOutbox(
        entityType: String,
        entityId: String,
        op: String,
        payloadJson: String,
        updatedAt: String = RecordDate.nowIso()
    ) -> Int64 {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return 0 }
        let rev = nextRevisionLocked()
        let id = "\(entityType):\(entityId)"
        let sql = """
        INSERT INTO outbox (id, entity_type, entity_id, op, payload_json, updated_at, revision)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            op = excluded.op,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at,
            revision = excluded.revision;
        """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            bindText(stmt, 1, id)
            bindText(stmt, 2, entityType)
            bindText(stmt, 3, entityId)
            bindText(stmt, 4, op)
            bindText(stmt, 5, payloadJson)
            bindText(stmt, 6, updatedAt)
            sqlite3_bind_int64(stmt, 7, rev)
            sqlite3_step(stmt)
        }
        return rev
    }

    public func getAllOutbox() -> [OutboxRow] {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return [] }
        let sql = "SELECT id, entity_type, entity_id, op, payload_json, updated_at, revision FROM outbox ORDER BY revision ASC;"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        var rows: [OutboxRow] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            rows.append(
                OutboxRow(
                    id: colString(stmt, 0) ?? "",
                    entityType: colString(stmt, 1) ?? "",
                    entityId: colString(stmt, 2) ?? "",
                    op: colString(stmt, 3) ?? "UPSERT",
                    payloadJson: colString(stmt, 4) ?? "",
                    updatedAt: colString(stmt, 5) ?? "",
                    revision: sqlite3_column_int64(stmt, 6)
                )
            )
        }
        return rows
    }

    public func getOutboxById(_ id: String) -> OutboxRow? {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return nil }
        let sql = "SELECT id, entity_type, entity_id, op, payload_json, updated_at, revision FROM outbox WHERE id = ? LIMIT 1;"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        bindText(stmt, 1, id)
        guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
        return OutboxRow(
            id: colString(stmt, 0) ?? "",
            entityType: colString(stmt, 1) ?? "",
            entityId: colString(stmt, 2) ?? "",
            op: colString(stmt, 3) ?? "UPSERT",
            payloadJson: colString(stmt, 4) ?? "",
            updatedAt: colString(stmt, 5) ?? "",
            revision: sqlite3_column_int64(stmt, 6)
        )
    }

    public func deleteOutboxIfRevisionMatches(id: String, revision: Int64) -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return 0 }
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, "DELETE FROM outbox WHERE id = ? AND revision = ?;", -1, &stmt, nil) == SQLITE_OK else {
            return 0
        }
        bindText(stmt, 1, id)
        sqlite3_bind_int64(stmt, 2, revision)
        sqlite3_step(stmt)
        return Int(sqlite3_changes(db))
    }

    public func outboxCount() -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return 0 }
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM outbox;", -1, &stmt, nil) == SQLITE_OK,
              sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
        return Int(sqlite3_column_int(stmt, 0))
    }

    // MARK: - Book Classifications (KDC Cache)

    public func upsertBookClassifications(_ items: [BookClassificationItemDto], nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) {
        guard !items.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return }
        let sql = """
        INSERT OR REPLACE INTO book_classifications (
            isbn13, status, kdc_code, kdc_major, source, resolved_at, cached_at_epoch_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """
        for item in items {
            var stmt: OpaquePointer?
            if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
                bindText(stmt, 1, item.isbn13)
                bindText(stmt, 2, item.status)
                bindOptionalText(stmt, 3, item.kdcCode)
                bindOptionalInt(stmt, 4, item.kdcMajor)
                bindOptionalText(stmt, 5, item.source)
                bindOptionalText(stmt, 6, item.resolvedAt)
                sqlite3_bind_int64(stmt, 7, nowMs)
                sqlite3_step(stmt)
            }
            sqlite3_finalize(stmt)
        }
    }

    public func getBookClassifications(isbns: [String]) -> [BookClassificationCacheRow] {
        guard !isbns.isEmpty else { return [] }
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return [] }
        var rows: [BookClassificationCacheRow] = []
        let sql = "SELECT isbn13, status, kdc_code, kdc_major, source, resolved_at, cached_at_epoch_ms FROM book_classifications WHERE isbn13 = ? LIMIT 1;"
        for isbn in isbns {
            var stmt: OpaquePointer?
            if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
                bindText(stmt, 1, isbn)
                if sqlite3_step(stmt) == SQLITE_ROW {
                    rows.append(
                        BookClassificationCacheRow(
                            isbn13: colString(stmt, 0) ?? isbn,
                            status: colString(stmt, 1) ?? "PENDING",
                            kdcCode: colString(stmt, 2),
                            kdcMajor: colInt(stmt, 3),
                            source: colString(stmt, 4),
                            resolvedAt: colString(stmt, 5),
                            cachedAtEpochMs: sqlite3_column_int64(stmt, 6)
                        )
                    )
                }
            }
            sqlite3_finalize(stmt)
        }
        return rows
    }

    public func getAllBookClassifications() -> [String: BookClassificationItemDto] {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return [:] }
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(
            db,
            "SELECT isbn13, status, kdc_code, kdc_major, source, resolved_at FROM book_classifications;",
            -1,
            &stmt,
            nil
        ) == SQLITE_OK else { return [:] }
        var map: [String: BookClassificationItemDto] = [:]
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let isbn = colString(stmt, 0) {
                map[isbn] = BookClassificationItemDto(
                    isbn13: isbn,
                    status: colString(stmt, 1) ?? "PENDING",
                    kdcCode: colString(stmt, 2),
                    kdcMajor: colInt(stmt, 3),
                    source: colString(stmt, 4),
                    resolvedAt: colString(stmt, 5)
                )
            }
        }
        return map
    }

    public func clearAllTables() {
        lock.lock()
        defer { lock.unlock() }
        exec("DELETE FROM outbox;")
        exec("DELETE FROM watch_log_history;")
        exec("DELETE FROM watch_logs;")
        exec("DELETE FROM titles;")
    }

    // MARK: - SQLite Column & Bind Helpers

    private func bindText(_ stmt: OpaquePointer?, _ idx: Int32, _ val: String) {
        sqlite3_bind_text(stmt, idx, (val as NSString).utf8String, -1, SQLITE_TRANSIENT_DESTRUCTOR)
    }

    private func bindOptionalText(_ stmt: OpaquePointer?, _ idx: Int32, _ val: String?) {
        if let val {
            bindText(stmt, idx, val)
        } else {
            sqlite3_bind_null(stmt, idx)
        }
    }

    private func bindOptionalInt(_ stmt: OpaquePointer?, _ idx: Int32, _ val: Int?) {
        if let val {
            sqlite3_bind_int(stmt, idx, Int32(val))
        } else {
            sqlite3_bind_null(stmt, idx)
        }
    }

    private func bindOptionalDouble(_ stmt: OpaquePointer?, _ idx: Int32, _ val: Double?) {
        if let val {
            sqlite3_bind_double(stmt, idx, val)
        } else {
            sqlite3_bind_null(stmt, idx)
        }
    }

    private func colString(_ stmt: OpaquePointer?, _ idx: Int32) -> String? {
        guard sqlite3_column_type(stmt, idx) != SQLITE_NULL,
              let cStr = sqlite3_column_text(stmt, idx) else { return nil }
        return String(cString: cStr)
    }

    private func colInt(_ stmt: OpaquePointer?, _ idx: Int32) -> Int? {
        guard sqlite3_column_type(stmt, idx) != SQLITE_NULL else { return nil }
        return Int(sqlite3_column_int(stmt, idx))
    }

    private func colDouble(_ stmt: OpaquePointer?, _ idx: Int32) -> Double? {
        guard sqlite3_column_type(stmt, idx) != SQLITE_NULL else { return nil }
        return sqlite3_column_double(stmt, idx)
    }

    private func encodeStringArray(_ arr: [String]?) -> String? {
        guard let arr, !arr.isEmpty,
              let data = try? JSONEncoder().encode(arr) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func decodeStringArray(_ raw: String?) -> [String]? {
        guard let raw, !raw.isEmpty,
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode([String].self, from: data)
    }
}
