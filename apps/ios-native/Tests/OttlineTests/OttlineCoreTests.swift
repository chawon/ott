import XCTest
import SQLite3
@testable import OttlineApp

private let TEST_SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

final class OttlineCoreTests: XCTestCase {

    // MARK: - 1. 3-Level Feeling System (`RecordFeelings`)

    func testRecordFeelingsMapping() {
        XCTAssertNil(RecordFeelings.ratingToFeelingValue(nil))
        XCTAssertEqual(RecordFeelings.ratingToFeelingValue(2.0), 1)
        XCTAssertEqual(RecordFeelings.ratingToFeelingValue(3.5), 2)
        XCTAssertEqual(RecordFeelings.ratingToFeelingValue(4.5), 3)

        let videoFeeling = RecordFeelings.resolveFeeling(rating: 4.5, isBook: false, locale: "ko")
        XCTAssertEqual(videoFeeling?.value, 3)
        XCTAssertEqual(videoFeeling?.label, "여운이 오래 남았어요")

        let bookFeelingEn = RecordFeelings.resolveFeeling(rating: 3.5, isBook: true, locale: "en")
        XCTAssertEqual(bookFeelingEn?.value, 2)
        XCTAssertEqual(bookFeelingEn?.label, "Read with a warm heart")
    }

    // MARK: - 2. KST Date & Month Formatting (`RecordDate`)

    func testRecordDateFormattingAndResolution() {
        let iso = "2026-08-18T14:30:00Z"
        XCTAssertEqual(RecordDate.monthKey(iso), "2026-08")
        XCTAssertEqual(RecordDate.formatMonthLabel("2026-08", locale: "ko"), "2026년 8월")
        XCTAssertEqual(RecordDate.formatMonthShortPart("2026-08", locale: "en"), "Aug")

        // Preserves existing timestamp when date string matches
        let resolvedSame = RecordDate.resolveWatchedAt(RecordDate.recordDateInput(iso), existingIso: iso)
        XCTAssertEqual(resolvedSame, iso)

        // Produces valid ISO when date changes
        let resolvedNew = RecordDate.resolveWatchedAt("2026-09-01", existingIso: iso)
        XCTAssertTrue(resolvedNew.hasPrefix("2026-09-01"))
    }

    // MARK: - 3. KDC Bookshelf Builder (`000`..`900` ordering & ISBN-13 deduplication)

    func testBookshelfBuilderNumericOrderingAndIsbnDeduplication() {
        let book800a = Title(id: "b1", provider: .kakao, providerId: "9788936434120", type: .book, name: "채식주의자", isbn13: "9788936434120")
        let book800b = Title(id: "b2", provider: .google, providerId: "vol2", type: .book, name: "채식주의자 (개정판)", isbn13: "8936434128 9788936434120")
        let book100 = Title(id: "b3", provider: .kakao, providerId: "9788937480010", type: .book, name: "차라투스트라는 이렇게 말했다", isbn13: "9788937480010")
        let bookUnclassified = Title(id: "b4", provider: .local, type: .book, name: "독립출판 에세이")

        let logs = [
            WatchLog(id: "l1", title: book800a, status: .done, watchedAt: "2026-08-10T10:00:00Z"),
            WatchLog(id: "l2", title: book800b, status: .done, watchedAt: "2026-08-12T10:00:00Z"),
            WatchLog(id: "l3", title: book100, status: .inProgress, watchedAt: "2026-08-11T10:00:00Z"),
            WatchLog(id: "l4", title: bookUnclassified, status: .wishlist, watchedAt: "2026-08-09T10:00:00Z")
        ]

        let classifications: [String: BookClassificationItemDto] = [
            "9788936434120": BookClassificationItemDto(isbn13: "9788936434120", status: "CLASSIFIED", kdcCode: "813.7", kdcMajor: 8),
            "9788937480010": BookClassificationItemDto(isbn13: "9788937480010", status: "CLASSIFIED", kdcCode: "165", kdcMajor: 1)
        ]

        let sections = BookshelfBuilder.buildBookshelf(logs: logs, classificationsByIsbn: classifications)
        XCTAssertEqual(sections.map(\.codeLabel), ["100", "800", "..."])
        XCTAssertEqual(sections[1].books.count, 1)
        XCTAssertEqual(sections[1].books[0].logCount, 2)
        XCTAssertEqual(sections[1].books[0].representativeLog.id, "l2")
    }

    // MARK: - 4. ShareIntentParser & CsvExporter

    func testShareIntentParserAndCsvExporter() {
        let parsed = ShareIntentParser.parse(
            sharedText: "넷플릭스에서 「더 베어」 같이 봐요! https://www.netflix.com/title/81605827"
        )
        XCTAssertEqual(parsed.query, "더 베어")
        XCTAssertEqual(parsed.suggestedPlatform, "Netflix")

        let log = WatchLog(
            id: "csv1",
            title: Title(id: "t1", type: .movie, name: "듄, 파트 2"),
            status: .done,
            rating: 4.5,
            note: "극장 사운드가 \"압도적\"이었어요",
            watchedAt: "2026-08-18T12:00:00Z"
        )
        let csv = CsvExporter.buildCsv([log])
        XCTAssertTrue(csv.hasPrefix("\u{FEFF}watched_at,title"))
        XCTAssertTrue(csv.contains("\"듄, 파트 2\""))
        XCTAssertTrue(csv.contains("\"극장 사운드가 \"\"압도적\"\"이었어요\""))
    }

    // MARK: - 5. OttlineDatabase & Monotonic Outbox Revision Check

    func testDatabaseMonotonicOutboxRevisionPreventsRaceLoss() {
        let tempPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("test_db_\(UUID().uuidString).db").path
        defer { try? FileManager.default.removeItem(atPath: tempPath) }

        let db = OttlineDatabase(path: tempPath)
        let rev1 = db.enqueueOutbox(entityType: "LOG", entityId: "log-1", op: "UPSERT", payloadJson: "{\"v\":1}")
        let rev2 = db.enqueueOutbox(entityType: "LOG", entityId: "log-1", op: "UPSERT", payloadJson: "{\"v\":2}")
        XCTAssertGreaterThan(rev2, rev1)

        // Attempting to delete with stale rev1 must not remove the newer rev2 row
        let deletedStale = db.deleteOutboxIfRevisionMatches(id: "LOG:log-1", revision: rev1)
        XCTAssertEqual(deletedStale, 0)
        XCTAssertEqual(db.outboxCount(), 1)

        // Deleting with matching rev2 succeeds
        let deletedCurrent = db.deleteOutboxIfRevisionMatches(id: "LOG:log-1", revision: rev2)
        XCTAssertEqual(deletedCurrent, 1)
        XCTAssertEqual(db.outboxCount(), 0)
    }

    // MARK: - 6. Seamless Legacy v1 (Expo Keychain + SQLite) -> v2 Migration

    func testLegacyIosMigratorPreservesAuthLogsHistoryAndOutbox() throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("legacy_mig_\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let legacyDbPath = tempDir.appendingPathComponent("ottline-native.db").path
        let v2DbPath = tempDir.appendingPathComponent("ottline_v2.db").path

        // Build a real legacy v1 SQLite database matching `apps/native/lib/localDb.ts`
        var legacyConn: OpaquePointer?
        XCTAssertEqual(sqlite3_open(legacyDbPath, &legacyConn), SQLITE_OK)
        let setupSql = """
        CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE titles (
            id TEXT PRIMARY KEY NOT NULL,
            provider TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            json TEXT NOT NULL
        );
        CREATE TABLE logs (
            id TEXT PRIMARY KEY NOT NULL,
            title_id TEXT NOT NULL,
            title_json TEXT NOT NULL,
            status TEXT NOT NULL,
            rating REAL,
            note TEXT,
            spoiler INTEGER NOT NULL,
            ott TEXT,
            season_number INTEGER,
            episode_number INTEGER,
            season_poster_url TEXT,
            season_year INTEGER,
            origin TEXT NOT NULL,
            watched_at TEXT NOT NULL,
            place TEXT,
            occasion TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_status TEXT NOT NULL
        );
        CREATE TABLE outbox (
            id TEXT PRIMARY KEY NOT NULL,
            log_id TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        );
        CREATE TABLE history (
            id TEXT PRIMARY KEY NOT NULL,
            log_id TEXT NOT NULL,
            recorded_at TEXT NOT NULL,
            status TEXT NOT NULL,
            rating REAL,
            note TEXT,
            spoiler INTEGER NOT NULL,
            ott TEXT,
            season_number INTEGER,
            episode_number INTEGER,
            season_poster_url TEXT,
            season_year INTEGER,
            origin TEXT NOT NULL,
            watched_at TEXT NOT NULL,
            place TEXT,
            occasion TEXT
        );
        INSERT INTO settings(key, value) VALUES ('lastSyncAt', '2026-08-01T00:00:00Z');
        INSERT INTO settings(key, value) VALUES ('iosRecapNotifications.enabled', '1');
        INSERT INTO titles(id, provider, provider_id, type, name, updated_at, deleted_at, json)
        VALUES ('title-100', 'TMDB', '1399', 'series', '더 베어', '2026-08-15T10:00:00Z', NULL,
                '{"id":"title-100","provider":"TMDB","providerId":"1399","type":"series","name":"더 베어","year":2022}');
        INSERT INTO logs(id, title_id, title_json, status, rating, note, spoiler, ott, season_number, episode_number, season_poster_url, season_year, origin, watched_at, place, occasion, created_at, updated_at, deleted_at, sync_status)
        VALUES ('log-200', 'title-100', '{"id":"title-100","provider":"TMDB","providerId":"1399","type":"series","name":"더 베어"}',
                'DONE', 4.5, '주방의 열기가 대단했어요', 0, 'Disney+', 2, 10, NULL, 2023, 'LOG',
                '2026-08-15T10:00:00Z', 'HOME', 'ALONE', '2026-08-15T10:00:00Z', '2026-08-15T10:00:00Z', NULL, 'PENDING');
        INSERT INTO history(id, log_id, recorded_at, status, rating, note, spoiler, ott, season_number, episode_number, season_poster_url, season_year, origin, watched_at, place, occasion)
        VALUES ('hist-300', 'log-200', '2026-08-15T10:00:00Z', 'DONE', 4.5, '주방의 열기가 대단했어요', 0, 'Disney+', 2, 10, NULL, 2023, 'LOG', '2026-08-15T10:00:00Z', 'HOME', 'ALONE');
        INSERT INTO outbox(id, log_id, payload_json, created_at, attempts)
        VALUES ('outbox-400', 'log-200',
                '{"title":{"id":"title-100","op":"UPSERT","updatedAt":"2026-08-15T10:00:00Z","payload":{"provider":"TMDB","providerId":"1399","type":"series","name":"더 베어"}},"log":{"id":"log-200","op":"UPSERT","updatedAt":"2026-08-15T10:00:00Z","payload":{"titleId":"title-100","status":"DONE","rating":4.5,"note":"주방의 열기가 대단했어요","spoiler":false,"ott":"Disney+","origin":"LOG","watchedAt":"2026-08-15T10:00:00Z","createdAt":"2026-08-15T10:00:00Z"}}}',
                '2026-08-15T10:00:00Z', 0);
        """
        sqlite3_exec(legacyConn, setupSql, nil, nil, nil)
        sqlite3_close(legacyConn)

        let suiteName = "ottline.test.prefs.\(UUID().uuidString)"
        let testDefaults = UserDefaults(suiteName: suiteName)!
        defer { testDefaults.removePersistentDomain(forName: suiteName) }

        let prefs = AppPreferences(
            defaults: testDefaults,
            groupDefaults: nil,
            keychainService: "app.ottline.test.\(UUID().uuidString)"
        )
        let v2Db = OttlineDatabase(path: v2DbPath)

        let fakeLegacyKeychain: [String: String] = [
            "ottline.native.userId": "legacy-user-999",
            "ottline.native.deviceId": "legacy-device-888",
            "ottline.native.pairingCode": "ABCD-1234",
            "ottline.native.analyticsClientId": "legacy-client-777",
            "ottline.native.localePreference": "ko",
            "ottline.native.themePreference": "dark"
        ]

        let summary = LegacyIosMigrator.runMigrationIfNeeded(
            prefs: prefs,
            db: v2Db,
            legacySqlitePathOverride: legacyDbPath,
            legacyKeychainReaderOverride: { key in fakeLegacyKeychain[key] }
        )

        XCTAssertTrue(summary.migratedAuth)
        XCTAssertEqual(summary.migratedTitlesCount, 1)
        XCTAssertEqual(summary.migratedLogsCount, 1)
        XCTAssertEqual(summary.migratedHistoryCount, 1)
        XCTAssertEqual(summary.migratedOutboxCount, 1)

        XCTAssertEqual(prefs.snapshot.userId, "legacy-user-999")
        XCTAssertEqual(prefs.snapshot.deviceId, "legacy-device-888")
        XCTAssertEqual(prefs.snapshot.pairingCode, "ABCD-1234")
        XCTAssertEqual(prefs.snapshot.themeMode, .dark)
        XCTAssertEqual(prefs.snapshot.lastSyncSince, "2026-08-01T00:00:00Z")
        XCTAssertTrue(prefs.snapshot.recapNotificationsEnabled)

        let migratedLogs = v2Db.getActiveLogs()
        XCTAssertEqual(migratedLogs.count, 1)
        XCTAssertEqual(migratedLogs[0].id, "log-200")
        XCTAssertEqual(migratedLogs[0].title.name, "더 베어")
        XCTAssertEqual(migratedLogs[0].note, "주방의 열기가 대단했어요")
        XCTAssertEqual(v2Db.outboxCount(), 2) // 1 title + 1 log outbox entry
    }
}
