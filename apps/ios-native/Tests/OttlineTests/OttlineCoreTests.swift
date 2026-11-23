import XCTest
import SQLite3
@testable import OttlineCore
@testable import OttlineApp

private let TEST_SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

final class OttlineCoreTests: XCTestCase {

    // MARK: - 1. 3-Level Feeling System (`RecordFeelings`)

    func testRecordFeelingsMapping() {
        XCTAssertNil(RecordFeelings.ratingToFeelingValue(nil))
        XCTAssertEqual(RecordFeelings.ratingToFeelingValue(2.0), 1)
        XCTAssertEqual(RecordFeelings.ratingToFeelingValue(3.5), 2)
        XCTAssertEqual(RecordFeelings.ratingToFeelingValue(5.0), 3)

        let videoGood = RecordFeelings.resolveFeeling(rating: 5.0, isBook: false, locale: "ko")
        XCTAssertEqual(videoGood?.value, 3)
        XCTAssertEqual(videoGood?.label, "최고예요")

        let videoOkay = RecordFeelings.resolveFeeling(rating: 3.5, isBook: false, locale: "ko")
        XCTAssertEqual(videoOkay?.value, 2)
        XCTAssertEqual(videoOkay?.label, "볼만해요")

        let bookOkayKo = RecordFeelings.resolveFeeling(rating: 3.5, isBook: true, locale: "ko")
        XCTAssertEqual(bookOkayKo?.value, 2)
        XCTAssertEqual(bookOkayKo?.label, "무난해요")

        let bookFeelingEn = RecordFeelings.resolveFeeling(rating: 3.5, isBook: true, locale: "en")
        XCTAssertEqual(bookFeelingEn?.value, 2)
        XCTAssertEqual(bookFeelingEn?.label, "Not bad")
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
            "9788936434120": BookClassificationItemDto(isbn13: "9788936434120", status: "RESOLVED", kdcCode: "813.7", kdcMajor: 8),
            "9788937480010": BookClassificationItemDto(isbn13: "9788937480010", status: "RESOLVED", kdcCode: "165", kdcMajor: 1)
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
            rating: 5.0,
            note: "극장 사운드가 \"압도적\"이었어요",
            watchedAt: "2026-08-18T12:00:00Z"
        )
        let csvKo = CsvExporter.buildCsv([log], locale: "ko")
        XCTAssertTrue(csvKo.hasPrefix("\u{FEFF}제목,유형,연도,상태,평점,시청처,장소,상황,메모"))
        XCTAssertTrue(csvKo.contains("\"듄, 파트 2\""))
        XCTAssertTrue(csvKo.contains("\"극장 사운드가 \"\"압도적\"\"이었어요\""))
        XCTAssertTrue(csvKo.contains("최고예요"))

        let csvEn = CsvExporter.buildCsv([log], locale: "en")
        XCTAssertTrue(csvEn.hasPrefix("\u{FEFF}Title,Type,Year,Status,Rating,Platform,Place,Occasion,Note"))
        XCTAssertTrue(csvEn.contains("Excellent"))
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

    // MARK: - 7. API Search (`type=tv` for Series) & Catalog Route Parity

    func testApiClientSeriesSearchAndTmdbCatalogRoutes() async throws {
        final class MockProtocol: URLProtocol {
            nonisolated(unsafe) static var capturedRequests: [URLRequest] = []
            override class func canInit(with request: URLRequest) -> Bool { true }
            override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
            override func startLoading() {
                Self.capturedRequests.append(request)
                let path = request.url?.path ?? ""
                let json: String
                if path.contains("/tmdb/series/") || path.contains("/tmdb/movie/") {
                    json = #"{"genres":["드라마"],"directors":[],"cast":[],"overview":"요약"}"#
                } else {
                    json = "[]"
                }
                let resp = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
                client?.urlProtocol(self, didLoad: Data(json.utf8))
                client?.urlProtocolDidFinishLoading(self)
            }
            override func stopLoading() {}
        }

        MockProtocol.capturedRequests = []
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockProtocol.self]
        let session = URLSession(configuration: config)

        let suiteName = "ottline.test.api.\(UUID().uuidString)"
        let testDefaults = UserDefaults(suiteName: suiteName)!
        defer { testDefaults.removePersistentDomain(forName: suiteName) }
        let prefs = AppPreferences(
            defaults: testDefaults,
            groupDefaults: nil,
            keychainService: "app.ottline.test.api.\(UUID().uuidString)"
        )
        let api = OttlineApiClient(prefs: prefs, session: session)

        _ = try await api.searchTitles(query: "데블스", typeFilter: "series")
        _ = try await api.getTvSeasons(providerId: "214582")
        _ = try await api.getTvEpisodes(providerId: "214582", seasonNumber: 1)
        _ = try await api.getTmdbMetadata(type: .series, providerId: "214582")

        XCTAssertEqual(MockProtocol.capturedRequests.count, 4)
        XCTAssertEqual(
            MockProtocol.capturedRequests[0].url?.absoluteString,
            "https://ottline.app/api/titles/search?q=%EB%8D%B0%EB%B8%94%EC%8A%A4&type=tv"
        )
        XCTAssertEqual(
            MockProtocol.capturedRequests[1].url?.path,
            "/api/tmdb/tv/214582/seasons"
        )
        XCTAssertEqual(
            MockProtocol.capturedRequests[2].url?.path,
            "/api/tmdb/tv/214582/seasons/1"
        )
        XCTAssertEqual(
            MockProtocol.capturedRequests[3].url?.path,
            "/api/tmdb/series/214582"
        )

        // Verify GOOGLE_BOOKS wire decoding and DiscussionListItem DTO fields
        XCTAssertEqual(Provider.fromWire("GOOGLE_BOOKS"), .google)
        let discData = Data(#"""
        {
          "id": "d1",
          "titleId": "t1",
          "titleProvider": "TMDB",
          "titleProviderId": "214582",
          "titleName": "데블스 플랜",
          "titleType": "series",
          "titleYear": 2023,
          "posterUrl": null,
          "commentCount": 5,
          "createdAt": "2026-11-10T12:00:00Z"
        }
        """#.utf8)
        let decodedDisc = try JSONDecoder().decode(DiscussionListItem.self, from: discData)
        XCTAssertEqual(decodedDisc.titleProvider, .tmdb)
        XCTAssertEqual(decodedDisc.titleProviderId, "214582")
        XCTAssertEqual(decodedDisc.titleYear, 2023)
        XCTAssertEqual(decodedDisc.commentCount, 5)
    }

    // MARK: - 8. v2 Wire Contracts & Completed-Only Home Month Grouping

    func testV2WireContractsAndHomeCompletedMonthGrouping() throws {
        let decoder = JSONDecoder()

        let pageJson = Data(#"""
        {
          "items": [],
          "nextCursor": "cur-next-1"
        }
        """#.utf8)
        let page = try decoder.decode(WatchLogPageResponse.self, from: pageJson)
        XCTAssertEqual(page.nextCursor, "cur-next-1")
        XCTAssertTrue(page.items.isEmpty)

        let pullJson = Data(#"""
        {
          "serverTime": "2026-11-13T10:00:00Z",
          "changes": { "logs": [], "titles": [] }
        }
        """#.utf8)
        let pull = try decoder.decode(SyncPullResponse.self, from: pullJson)
        XCTAssertEqual(pull.serverTime, "2026-11-13T10:00:00Z")

        let pushJson = Data(#"""
        {
          "accepted": ["outbox-1", "outbox-2"],
          "rejected": []
        }
        """#.utf8)
        let push = try decoder.decode(SyncPushResponse.self, from: pushJson)
        XCTAssertEqual(push.accepted, ["outbox-1", "outbox-2"])
        XCTAssertTrue(push.rejected.isEmpty)

        let pairReqData = try JSONEncoder().encode(PairWithCodeRequest(code: "ABCD-9999", oldUserId: "old-u1"))
        let pairObj = try JSONSerialization.jsonObject(with: pairReqData) as? [String: Any]
        XCTAssertEqual(pairObj?["code"] as? String, "ABCD-9999")
        XCTAssertEqual(pairObj?["oldUserId"] as? String, "old-u1")

        let persona = try decoder.decode(PersonaKey.self, from: Data(#""cinema_keeper""#.utf8))
        XCTAssertEqual(persona, .cinemaKeeper)

        XCTAssertEqual(try decoder.decode(DiscussionReactionType.self, from: Data(#""DONE""#.utf8)), .done)
        XCTAssertEqual(try decoder.decode(DiscussionReactionType.self, from: Data(#""CURIOUS""#.utf8)), .curious)
        XCTAssertEqual(try decoder.decode(DiscussionReactionType.self, from: Data(#""SAVE""#.utf8)), .save)

        let commentData = try JSONEncoder().encode(CreateCommentRequest(body: "좋았어요", syncLog: true))
        let commentObj = try JSONSerialization.jsonObject(with: commentData) as? [String: Any]
        XCTAssertEqual(commentObj?["body"] as? String, "좋았어요")
        XCTAssertEqual(commentObj?["syncLog"] as? Bool, true)

        let recStateJson = Data(#"""
        {
          "items": [{ "name": "패스트 라이브즈", "type": "movie", "reason": "잔잔한 여운", "genres": ["드라마"], "year": 2023 }],
          "exclusions": [],
          "quota": { "date": "2026-11-13", "timezone": "Asia/Seoul", "limit": 3, "used": 1, "remaining": 2, "resetsAt": "2026-11-14T00:00:00+09:00" },
          "generating": false,
          "hasBatch": true,
          "eligible": true
        }
        """#.utf8)
        let recState = try decoder.decode(RecommendationState.self, from: recStateJson)
        XCTAssertEqual(recState.items.first?.name, "패스트 라이브즈")
        XCTAssertEqual(recState.quota.remaining, 2)

        // Completed-only monthly grouping for Home
        let mDone = WatchLog(id: "d1", title: Title(id: "t1", type: .movie, name: "완료작"), status: .done, watchedAt: "2026-11-05T10:00:00Z")
        let mInProg = WatchLog(id: "p1", title: Title(id: "t2", type: .series, name: "보는중"), status: .inProgress, watchedAt: "2026-11-06T10:00:00Z")
        let mWish = WatchLog(id: "w1", title: Title(id: "t3", type: .book, name: "위시"), status: .wishlist, watchedAt: "2026-11-07T10:00:00Z")
        let groups = TimelineMoments.groupCompletedLogsByWatchedMonth([mDone, mInProg, mWish])
        XCTAssertEqual(groups.count, 1)
        XCTAssertEqual(groups[0].monthKey, "2026-11")
        XCTAssertEqual(groups[0].logs.map(\.id), ["d1"])
    }

    // MARK: - 9. History Replacement, Canonical Log Reconciliation & Self-Healing Deduplication

    func testHistoryReplacementAndCanonicalLogDeduplication() async throws {
        let dbPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("test_dedup_\(UUID().uuidString).db")
            .path
        defer { try? FileManager.default.removeItem(atPath: dbPath) }

        let suiteName = "ottline.test.dedup.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let prefs = AppPreferences(
            defaults: defaults,
            groupDefaults: nil,
            keychainService: "app.ottline.test.dedup.\(UUID().uuidString)"
        )
        let db = OttlineDatabase(path: dbPath)
        let api = OttlineApiClient(prefs: prefs)
        let repo = OttlineRepository(db: db, prefs: prefs, api: api)

        // 1. Replace optimistic client history UUID with canonical server history UUID
        let logId = "log-devils-plan"
        let clientHist = WatchLogHistoryItem(
            id: "client-hist-1",
            logId: logId,
            recordedAt: "2026-11-13T13:10:15.436Z",
            status: .inProgress,
            note: "첫 메모",
            watchedAt: "2026-11-13T03:00:00Z"
        )
        let serverHist = WatchLogHistoryItem(
            id: "server-hist-1",
            logId: logId,
            recordedAt: "2026-11-13T13:10:15.735Z",
            status: .inProgress,
            note: "첫 메모",
            watchedAt: "2026-11-13T03:00:00Z"
        )
        db.insertHistory(clientHist)
        db.replaceHistoryForLog(logId: logId, remoteItems: [serverHist], unpushedSinceIso: nil)
        let replaced = db.getHistoryForLog(logId)
        XCTAssertEqual(replaced.count, 1)
        XCTAssertEqual(replaced[0].id, "server-hist-1")

        // 2. When an unpushed offline edit exists, keep the newer unpushed snapshot while replacing earlier synced duplicates
        let unpushedHist = WatchLogHistoryItem(
            id: "client-hist-unpushed",
            logId: logId,
            recordedAt: "2026-11-13T13:20:00.000Z",
            status: .done,
            note: "오프라인 수정",
            watchedAt: "2026-11-13T03:00:00Z"
        )
        db.insertHistory(clientHist)
        db.insertHistory(unpushedHist)
        db.replaceHistoryForLog(logId: logId, remoteItems: [serverHist], unpushedSinceIso: "2026-11-13T13:20:00.000Z")
        let withUnpushed = db.getHistoryForLog(logId)
        XCTAssertEqual(withUnpushed.map(\.id), ["client-hist-unpushed", "server-hist-1"])

        // 3. Reconcile temporary client Title ID with canonical server Title ID during server page upsert
        let tempTitle = Title(
            id: "temp-title-uuid",
            provider: .tmdb,
            providerId: "214582",
            type: .series,
            name: "데블스 플랜"
        )
        let savedLocal = await repo.saveLogForTitle(
            candidateTitle: tempTitle,
            draft: LogDraft(status: .inProgress, note: "로컬 저장", watchedAt: "2026-11-13T03:00:00Z")
        )
        // Clear pending outbox to simulate push completion before page pull arrives
        for row in db.getAllOutbox() {
            _ = db.deleteOutboxIfRevisionMatches(id: row.id, revision: row.revision)
        }

        let canonicalTitle = Title(
            id: "29155f92-b741-46b7-9931-42a701222648",
            provider: .tmdb,
            providerId: "214582",
            type: .series,
            name: "데블스 플랜"
        )
        let serverLog = WatchLog(
            id: "canonical-log-uuid",
            title: canonicalTitle,
            status: .inProgress,
            note: "서버 정규화 완료",
            origin: .log,
            createdAt: "2026-11-13T13:10:15Z",
            watchedAt: "2026-11-13T03:00:00Z",
            updatedAt: "2026-11-13T13:11:00Z"
        )
        XCTAssertNotEqual(savedLocal.id, serverLog.id)
        repo.upsertLogsFromServerPage([serverLog])

        XCTAssertEqual(repo.logs.count, 1)
        XCTAssertEqual(repo.logs[0].id, "canonical-log-uuid")
        XCTAssertEqual(repo.logs[0].title.id, "29155f92-b741-46b7-9931-42a701222648")
        // History rows from superseded local log should be remapped to canonical log ID
        let remappedHist = db.getHistoryForLog("canonical-log-uuid")
        XCTAssertEqual(remappedHist.count, 1)

        // 4. Verify deduplicateCanonicalLogsOnOpen() cleans up pre-existing 5s-window duplicate history rows on DB reopen
        db.insertHistory(WatchLogHistoryItem(
            id: "dup-client",
            logId: "canonical-log-uuid",
            recordedAt: "2026-11-13T13:10:55.621Z",
            status: .inProgress,
            note: "서버 정규화 완료",
            watchedAt: "2026-11-13T03:00:00Z"
        ))
        db.insertHistory(WatchLogHistoryItem(
            id: "dup-server",
            logId: "canonical-log-uuid",
            recordedAt: "2026-11-13T13:10:55.907316Z",
            status: .inProgress,
            note: "서버 정규화 완료",
            watchedAt: "2026-11-13T03:00:00Z"
        ))
        let reopenedDb = OttlineDatabase(path: dbPath)
        let cleaned = reopenedDb.getHistoryForLog("canonical-log-uuid")
        XCTAssertEqual(cleaned.filter { $0.id == "dup-client" }.count, 0)
        XCTAssertEqual(cleaned.filter { $0.id == "dup-server" }.count, 1)
    }

    // MARK: - 10. iOS Native Features (Spotlight, Evening Reminder, Shortcuts Platform, Widget Snapshot)

    func testIosNativeSpotlightRemindersAndWidgetSnapshot() async throws {
        // 1. Spotlight payload indexing & spoiler note masking
        let normalLog = WatchLog(
            id: "spot-1",
            title: Title(id: "title-spot-1", type: .book, name: "천년을 훔치다", author: "정명섭", publisher: "문학동네"),
            status: .done,
            rating: 5.0,
            note: "역사적 배경과 미스터리가 잘 어우러진 소설",
            spoiler: false,
            ott: "교보문고",
            watchedAt: "2026-11-10T10:00:00Z"
        )
        let payloadKo = SpotlightIndexManager.makePayload(for: normalLog, locale: "ko")
        XCTAssertEqual(payloadKo.uniqueIdentifier, "ottline-title:title-spot-1")
        XCTAssertEqual(SpotlightIndexManager.parseTitleId(from: payloadKo.uniqueIdentifier), "title-spot-1")
        XCTAssertEqual(payloadKo.title, "천년을 훔치다")
        XCTAssertTrue(payloadKo.contentDescription.contains("교보문고"))
        XCTAssertTrue(payloadKo.contentDescription.contains("역사적 배경"))
        XCTAssertTrue(payloadKo.keywords.contains("정명섭"))

        let spoilerLog = WatchLog(
            id: "spot-2",
            title: Title(id: "title-spot-2", type: .movie, name: "반전 영화"),
            status: .done,
            note: "범인은 사실 주인공",
            spoiler: true,
            watchedAt: "2026-11-11T10:00:00Z"
        )
        let spoilerPayload = SpotlightIndexManager.makePayload(for: spoilerLog, locale: "ko")
        XCTAssertFalse(spoilerPayload.contentDescription.contains("범인은"))
        XCTAssertTrue(spoilerPayload.contentDescription.contains("스포일러 포함"))

        // 2. Evening memory reminder content generation (KO & EN, with & without in-progress log)
        let inProgSeries = WatchLog(
            id: "ev-1",
            title: Title(id: "title-ev-1", type: .series, name: "슬로 호시스"),
            status: .inProgress,
            ott: "애플티비",
            watchedAt: "2026-11-12T10:00:00Z"
        )
        let builtInProgKo = RecapNotificationManager.buildEveningReminderContent(logs: [inProgSeries, normalLog], locale: "ko")
        XCTAssertTrue(builtInProgKo.title.contains("슬로 호시스"))
        XCTAssertEqual(builtInProgKo.urlString, "ottline://quick-record?quick=1&title_id=title-ev-1")

        let builtInProgEn = RecapNotificationManager.buildEveningReminderContent(logs: [inProgSeries], locale: "en")
        XCTAssertTrue(builtInProgEn.title.contains("슬로 호시스"))

        let builtEmptyKo = RecapNotificationManager.buildEveningReminderContent(logs: [normalLog], locale: "ko")
        XCTAssertEqual(builtEmptyKo.urlString, "ottline://quick-record?quick=1")

        // 3. App Intents platform mapping
        #if canImport(AppIntents)
        XCTAssertEqual(OttShortcutPlatform.disneyPlus.resolvedPlatformName(locale: "ko"), "디즈니플러스")
        XCTAssertEqual(OttShortcutPlatform.disneyPlus.resolvedPlatformName(locale: "en"), "Disney+")
        XCTAssertEqual(OttShortcutPlatform.millie.resolvedPlatformName(locale: "ko"), "밀리의서재")
        XCTAssertEqual(OttShortcutPlatform.millie.defaultTypeTab, "book")
        XCTAssertEqual(OttShortcutPlatform.netflix.defaultTypeTab, "all")
        XCTAssertNil(OttShortcutPlatform.unspecified.resolvedPlatformName(locale: "ko"))
        #endif

        // 4. AppPreferences evening reminder & enriched SharedWidgetSnapshot persistence
        let suiteName = "ottline.test.nativefeatures.\(UUID().uuidString)"
        let testDefaults = UserDefaults(suiteName: suiteName)!
        let groupSuiteName = "ottline.test.nativegroup.\(UUID().uuidString)"
        let groupDefaults = UserDefaults(suiteName: groupSuiteName)!
        defer {
            testDefaults.removePersistentDomain(forName: suiteName)
            groupDefaults.removePersistentDomain(forName: groupSuiteName)
        }

        let prefs = AppPreferences(
            defaults: testDefaults,
            groupDefaults: groupDefaults,
            keychainService: "app.ottline.test.nf.\(UUID().uuidString)"
        )
        prefs.setLocale("ko")
        prefs.setEveningReminder(enabled: true, hour: 21, minute: 45)
        XCTAssertTrue(prefs.snapshot.eveningReminderEnabled)
        XCTAssertEqual(prefs.snapshot.eveningReminderHour, 21)
        XCTAssertEqual(prefs.snapshot.eveningReminderMinute, 45)

        let thisMonthDone = WatchLog(
            id: "w-done",
            title: Title(id: "t-done", type: .movie, name: "이번 달 완주작"),
            status: .done,
            watchedAt: RecordDate.nowIso()
        )
        prefs.updateWidgetSnapshot(from: [inProgSeries, thisMonthDone])

        let encodedData = try XCTUnwrap(groupDefaults.data(forKey: AppPreferences.widgetSnapshotKey))
        let decodedSnap = try JSONDecoder().decode(SharedWidgetSnapshot.self, from: encodedData)
        XCTAssertEqual(decodedSnap.inProgressCount, 1)
        XCTAssertEqual(decodedSnap.thisMonthDoneCount, 1)
        XCTAssertEqual(decodedSnap.totalLogCount, 2)
        XCTAssertEqual(decodedSnap.continueItem?.titleId, "title-ev-1")
        XCTAssertEqual(decodedSnap.continueItem?.statusBadge, "보는 중")

        prefs.setLocale("en")
        prefs.updateWidgetSnapshot(from: [inProgSeries, thisMonthDone])
        let enData = try XCTUnwrap(groupDefaults.data(forKey: AppPreferences.widgetSnapshotKey))
        let enSnap = try JSONDecoder().decode(SharedWidgetSnapshot.self, from: enData)
        XCTAssertEqual(enSnap.continueItem?.statusBadge, "Watching")

        // 5. ShareIntentParser site suffix cleanup & YouTube/Apple Books detection + Share Extension queue drain
        let ytParsed = ShareIntentParser.parse(sharedText: "올드보이 예고편 - YouTube\nhttps://youtu.be/abc123")
        XCTAssertEqual(ytParsed.query, "올드보이 예고편")
        XCTAssertEqual(ytParsed.suggestedPlatform, "YouTube")

        let kyoboParsed = ShareIntentParser.parse(sharedText: "소년이 온다 | 교보문고 https://product.kyobobook.co.kr/detail/S000000610612")
        XCTAssertEqual(kyoboParsed.query, "소년이 온다")
        XCTAssertEqual(kyoboParsed.suggestedPlatform, "교보문고")
        XCTAssertEqual(kyoboParsed.suggestedTypeTab, "book")

        let appleBooksParsed = ShareIntentParser.parse(sharedText: "Dune - Apple Books https://books.apple.com/us/book/id123")
        XCTAssertEqual(appleBooksParsed.query, "Dune")
        XCTAssertEqual(appleBooksParsed.suggestedPlatform, "Apple Books")
        XCTAssertEqual(appleBooksParsed.suggestedTypeTab, "book")

        let sharedEntry = SharedExtensionLogEntry(
            id: "share-ext-fixed-id-1",
            title: Title(id: "shared-title-1", provider: .tmdb, providerId: "12345", type: .movie, name: "공유 테스트 영화"),
            status: .done,
            rating: 5.0,
            note: "사파리에서 바로 남김",
            ott: "넷플릭스",
            watchedAt: "2026-11-17T10:00:00Z",
            createdAt: "2026-11-17T10:00:00Z"
        )
        prefs.enqueueSharedExtensionLog(sharedEntry)
        let dbPath2 = FileManager.default.temporaryDirectory
            .appendingPathComponent("test_share_drain_\(UUID().uuidString).db")
            .path
        let drainDb = OttlineDatabase(path: dbPath2)
        let drainRepo = OttlineRepository(db: drainDb, prefs: prefs, api: OttlineApiClient(prefs: prefs))
        let drainedCount = await drainRepo.drainSharedExtensionQueue()
        XCTAssertEqual(drainedCount, 1)
        XCTAssertEqual(drainRepo.logs.count, 1)
        XCTAssertEqual(drainRepo.logs[0].id, "share-ext-fixed-id-1")
        XCTAssertEqual(drainRepo.logs[0].ott, "넷플릭스")
        XCTAssertEqual(prefs.consumeSharedExtensionLogs().count, 0)

        let deepQuick = OttlineDeepLinkParser.parse(
            URL(string: "ottline://quick?quick=1&title=Inception&platform=Netflix&type=video")!
        )
        XCTAssertEqual(
            deepQuick,
            .quickRecord(ParsedQuickRecordLink(query: "Inception", typeTab: "video", platform: "Netflix", titleId: nil))
        )
        let deepHandoff = OttlineDeepLinkParser.parse(
            URL(string: "ottline://open?handoff=1&status=ok&user_id=u1&device_id=d1&pairing_code=abcd2345")!
        )
        XCTAssertEqual(
            deepHandoff,
            .browserHandoff(ParsedBrowserHandoff(status: "ok", userId: "u1", deviceId: "d1", pairingCode: "ABCD2345"))
        )
    }

    // MARK: - 11. iPad Adaptive Spread Metrics & High-Res Poster Resolution

    func testPadAdaptiveLayoutMetricsAndBookCoverResolution() {
        let phoneCompact = PadLayoutMetrics.resolve(isRegularHorizontalClass: false, viewportWidth: 390)
        XCTAssertEqual(phoneCompact.mode, .compact)
        XCTAssertFalse(phoneCompact.isSpread)
        XCTAssertFalse(phoneCompact.isWideThreeColumnHome)
        XCTAssertEqual(phoneCompact.togetherColumns, 1)
        XCTAssertEqual(phoneCompact.kdcOverviewColumns, 2)

        let splitViewCompact = PadLayoutMetrics.resolve(isRegularHorizontalClass: true, viewportWidth: 500)
        XCTAssertEqual(splitViewCompact.mode, .compact)
        XCTAssertFalse(splitViewCompact.isSpread)
        XCTAssertFalse(splitViewCompact.isWideThreeColumnHome)
        XCTAssertEqual(splitViewCompact.togetherColumns, 1)

        let splitViewNarrowSpread = PadLayoutMetrics.resolve(isRegularHorizontalClass: true, viewportWidth: 740)
        XCTAssertEqual(splitViewNarrowSpread.mode, .tabletPortrait)
        XCTAssertTrue(splitViewNarrowSpread.isSpread)
        XCTAssertFalse(splitViewNarrowSpread.isWideThreeColumnHome)

        let tabletPortrait = PadLayoutMetrics.resolve(isRegularHorizontalClass: true, viewportWidth: 834)
        XCTAssertEqual(tabletPortrait.mode, .tabletPortrait)
        XCTAssertTrue(tabletPortrait.isSpread)
        XCTAssertTrue(tabletPortrait.isWideThreeColumnHome)
        XCTAssertEqual(tabletPortrait.togetherColumns, 2)
        XCTAssertEqual(tabletPortrait.activationPosterColumns, 4)
        XCTAssertEqual(tabletPortrait.reportMetricColumns, 3)
        XCTAssertEqual(tabletPortrait.kdcOverviewColumns, 3)

        let tabletWide = PadLayoutMetrics.resolve(isRegularHorizontalClass: true, viewportWidth: 1366)
        XCTAssertEqual(tabletWide.mode, .tabletWide)
        XCTAssertTrue(tabletWide.isSpread)
        XCTAssertTrue(tabletWide.isWideThreeColumnHome)
        XCTAssertEqual(tabletWide.togetherColumns, 2)
        XCTAssertEqual(tabletWide.activationPosterColumns, 6)
        XCTAssertEqual(tabletWide.reportMetricColumns, 3)
        XCTAssertEqual(tabletWide.kdcOverviewColumns, 5)
        XCTAssertTrue(tabletWide.detailTwoColumns)
        XCTAssertTrue(tabletWide.mySpaceTwoColumns)

        let featuredMetrics = PadFeaturedBodyLayout.metrics(forTotalWidth: 620, spacing: 26)
        XCTAssertGreaterThanOrEqual(featuredMetrics.posterWidth, 135)
        XCTAssertEqual(featuredMetrics.posterHeight, round(featuredMetrics.posterWidth * 1.5))
        XCTAssertEqual(featuredMetrics.posterWidth + featuredMetrics.spacing + featuredMetrics.storyWidth, 620)

        let shortSticky = OttlineStickyFooterLayout.computeMetrics(
            minHeight: 1200,
            topPadding: 24,
            contentHeight: 320,
            minSpacing: 20,
            footerHeight: 110,
            bottomPadding: 24
        )
        XCTAssertEqual(shortSticky.totalHeight, 1200)
        XCTAssertEqual(shortSticky.footerY, 1066)

        let tallSticky = OttlineStickyFooterLayout.computeMetrics(
            minHeight: 1200,
            topPadding: 24,
            contentHeight: 1800,
            minSpacing: 20,
            footerHeight: 110,
            bottomPadding: 24
        )
        XCTAssertEqual(tallSticky.totalHeight, 1978)
        XCTAssertEqual(tallSticky.footerY, 1844)

        XCTAssertEqual(PadLayoutMetrics.deviceLabel(isPadIdiom: true, locale: "ko"), "아이패드")
        XCTAssertEqual(PadLayoutMetrics.deviceLabel(isPadIdiom: false, locale: "ko"), "아이폰")
        XCTAssertEqual(PadLayoutMetrics.deviceLabel(isPadIdiom: true, locale: "en"), "iPad")
        XCTAssertEqual(PadLayoutMetrics.deviceLabel(isPadIdiom: false, locale: "en"), "iPhone")

        let kakaoThumb = "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F542617"
        XCTAssertEqual(
            PadLayoutMetrics.resolveFeaturedPosterUrl(kakaoThumb, isBook: true),
            "https://t1.daumcdn.net/lbook/image/542617"
        )
        XCTAssertEqual(
            PadLayoutMetrics.resolveFeaturedPosterUrl("https://image.tmdb.org/t/p/w342/abc.jpg", isBook: false),
            "https://image.tmdb.org/t/p/w780/abc.jpg"
        )
    }

    // MARK: - 12. Future Timeline Generation, Timeout/Drop Recovery, 202 Polling, Idempotency & Cross-Locale Isolation

    private final class ScriptedRecommendationTransport: RecommendationTransport, @unchecked Sendable {
        private let lock = NSLock()
        private var stateQueue: [Result<RecommendationState, Error>] = []
        private var fallbackState: RecommendationState
        private var generateHandler: ((String) async throws -> (Int, RecommendationState))?
        private var excludeHandler: ((RecommendationItem) async throws -> RecommendationExclusion)?
        private(set) var sentRequestIds: [String] = []
        private(set) var stateCallCount: Int = 0
        private(set) var restoredKeys: [String] = []

        init(initialState: RecommendationState) {
            self.fallbackState = initialState
        }

        func setFallbackState(_ state: RecommendationState) {
            lock.withLock { fallbackState = state }
        }

        func enqueueState(_ results: [Result<RecommendationState, Error>]) {
            lock.withLock { stateQueue.append(contentsOf: results) }
        }

        func setGenerateHandler(_ handler: @escaping (String) async throws -> (Int, RecommendationState)) {
            lock.withLock { generateHandler = handler }
        }

        func setExcludeHandler(_ handler: @escaping (RecommendationItem) async throws -> RecommendationExclusion) {
            lock.withLock { excludeHandler = handler }
        }

        func getRecommendationState() async throws -> RecommendationState {
            let next: Result<RecommendationState, Error> = lock.withLock {
                stateCallCount += 1
                if !stateQueue.isEmpty {
                    return stateQueue.removeFirst()
                }
                return .success(fallbackState)
            }
            return try next.get()
        }

        func generateRecommendations(requestId: String) async throws -> (statusCode: Int, state: RecommendationState) {
            let handler: ((String) async throws -> (Int, RecommendationState))? = lock.withLock {
                sentRequestIds.append(requestId)
                return generateHandler
            }
            guard let handler else {
                return (200, lock.withLock { fallbackState })
            }
            return try await handler(requestId)
        }

        func excludeRecommendation(_ item: RecommendationItem) async throws -> RecommendationExclusion {
            let handler = lock.withLock { excludeHandler }
            if let handler {
                return try await handler(item)
            }
            return RecommendationExclusion(key: "ex-\(item.name)", name: item.name, type: item.type)
        }

        func restoreRecommendationExclusion(key: String) async throws {
            lock.withLock { restoredKeys.append(key) }
        }
    }

    private func makeTestRecState(
        items: [RecommendationItem],
        used: Int,
        limit: Int = 3,
        generationId: String? = nil,
        generating: Bool = false,
        hasBatch: Bool? = nil,
        eligible: Bool = true
    ) -> RecommendationState {
        RecommendationState(
            items: items,
            exclusions: [],
            quota: RecommendationQuota(
                date: "2026-11-21",
                timezone: "Asia/Seoul",
                limit: limit,
                used: used,
                remaining: max(0, limit - used),
                resetsAt: "2026-11-22T00:00:00+09:00"
            ),
            generatedAt: (hasBatch ?? !items.isEmpty) ? "2026-11-21T15:00:00+09:00" : nil,
            generationId: generationId,
            generating: generating,
            hasBatch: hasBatch ?? !items.isEmpty,
            eligible: eligible
        )
    }

    private func makeTestPrefs(_ tag: String) -> (AppPreferences, () -> Void) {
        let suiteName = "ottline.test.future.\(tag).\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        let prefs = AppPreferences(
            defaults: defaults,
            groupDefaults: nil,
            keychainService: "app.ottline.test.future.\(tag).\(UUID().uuidString)"
        )
        return (prefs, { defaults.removePersistentDomain(forName: suiteName) })
    }

    func testFutureTimelineGenerateTimeoutHeaderAndUserAgent() async throws {
        final class GenerateProbeProtocol: URLProtocol {
            nonisolated(unsafe) static var capturedRequest: URLRequest?
            override class func canInit(with request: URLRequest) -> Bool { true }
            override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
            override func startLoading() {
                Self.capturedRequest = request
                let json = #"""
                {
                  "items": [{"name":"헤어질 결심","type":"movie","reason":"여운이 깊은 멜로","genres":["드라마"],"year":2022}],
                  "exclusions": [],
                  "quota": {"date":"2026-11-21","timezone":"Asia/Seoul","limit":3,"used":1,"remaining":2,"resetsAt":"2026-11-22T00:00:00+09:00"},
                  "generatedAt": "2026-11-21T15:00:00+09:00",
                  "generationId": "11111111-1111-4111-8111-111111111111",
                  "generating": false,
                  "hasBatch": true,
                  "eligible": true
                }
                """#
                let resp = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
                client?.urlProtocol(self, didLoad: Data(json.utf8))
                client?.urlProtocolDidFinishLoading(self)
            }
            override func stopLoading() {}
        }

        XCTAssertGreaterThanOrEqual(OttlineApiClient.recommendationGenerateTimeoutSeconds, 60)
        XCTAssertEqual(OttlineApiClient.recommendationGenerateTimeoutSeconds, 90)
        let ua = OttlineApiClient.defaultUserAgent
        XCTAssertTrue(ua.contains("iPhone; iOS") || ua.contains("iPad; iPadOS"))

        let (prefs, cleanup) = makeTestPrefs("timeout")
        defer { cleanup() }
        prefs.saveAuth(userId: "u-1", deviceId: "d-1", pairingCode: "ABCD1234")

        GenerateProbeProtocol.capturedRequest = nil
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [GenerateProbeProtocol.self]
        let api = OttlineApiClient(prefs: prefs, session: URLSession(configuration: config))

        let (code, state) = try await api.generateRecommendations(requestId: "11111111-1111-4111-8111-111111111111")
        XCTAssertEqual(code, 200)
        XCTAssertEqual(state.generationId, "11111111-1111-4111-8111-111111111111")
        XCTAssertEqual(GenerateProbeProtocol.capturedRequest?.timeoutInterval, 90)
        XCTAssertEqual(GenerateProbeProtocol.capturedRequest?.value(forHTTPHeaderField: "User-Agent"), ua)
    }

    func testFutureTimelineFirstGenerationExplicitRegenAndUndoExclusion() async {
        let (prefs, cleanup) = makeTestPrefs("firstgen")
        defer { cleanup() }

        let emptyState = makeTestRecState(items: [], used: 0, generationId: nil, hasBatch: false)
        let transport = ScriptedRecommendationTransport(initialState: emptyState)
        var generatedIds = ["req-first-1", "req-regen-2"]
        var serverQuotaUsed = 0

        transport.setGenerateHandler { requestId in
            serverQuotaUsed += 1
            let item = RecommendationItem(
                name: serverQuotaUsed == 1 ? "패스트 라이브즈" : "애프터썬",
                type: .movie,
                reason: "조용한 여운"
            )
            let next = self.makeTestRecState(items: [item], used: serverQuotaUsed, generationId: requestId)
            transport.setFallbackState(next)
            return (200, next)
        }

        let coordinator = FutureTimelineCoordinator(
            transport: transport,
            attemptStore: prefs,
            ensureUserId: { "user-a" },
            pollIntervalNanoseconds: 1_000_000,
            maxPollAttempts: 10,
            uuidGenerator: { generatedIds.removeFirst() }
        )

        await coordinator.loadState(locale: "ko")
        XCTAssertEqual(coordinator.state.quota.used, 0)
        XCTAssertFalse(coordinator.state.hasBatch)

        // 1. First generation increments quota by 1
        await coordinator.requestGeneration(locale: "ko")
        XCTAssertEqual(coordinator.state.items.map(\.name), ["패스트 라이브즈"])
        XCTAssertEqual(coordinator.state.quota.used, 1)
        XCTAssertNil(coordinator.errorMessage)
        XCTAssertFalse(coordinator.hasPendingAttempt)

        // 2. Explicit regeneration increments quota by 1 again with a fresh requestId
        await coordinator.requestGeneration(locale: "ko")
        XCTAssertEqual(coordinator.state.items.map(\.name), ["애프터썬"])
        XCTAssertEqual(coordinator.state.quota.used, 2)
        XCTAssertEqual(transport.sentRequestIds, ["req-first-1", "req-regen-2"])
        XCTAssertNil(coordinator.errorMessage)

        // 3. Exclude + Undo restore
        let target = coordinator.state.items[0]
        await coordinator.excludeItem(target, locale: "ko")
        XCTAssertEqual(coordinator.lastExcludedItem?.name, "애프터썬")
        await coordinator.restoreExclusion(key: coordinator.lastExcludedItem!.key, locale: "ko")
        XCTAssertNil(coordinator.lastExcludedItem)
        XCTAssertEqual(transport.restoredKeys, ["ex-애프터썬"])
    }

    func testFutureTimelineDroppedResponsePreservesPreviousBatchAndRecoversAcrossRestartAndDoubleTap() async {
        let (prefs, cleanup) = makeTestPrefs("drop-recover")
        defer { cleanup() }

        let oldItem = RecommendationItem(name: "기존 추천작", type: .movie, reason: "이전 배치")
        let newItem = RecommendationItem(name: "새 추천작", type: .series, reason: "복구된 배치")
        let initialBatch = makeTestRecState(items: [oldItem], used: 1, generationId: "gen-old")

        // Scenario A: POST drops with timeout, server already finished -> immediate `/state` recovery succeeds (+1 total quota)
        let transportA = ScriptedRecommendationTransport(initialState: initialBatch)
        let completedBatchA = makeTestRecState(items: [newItem], used: 2, generationId: "req-drop-a")
        transportA.setGenerateHandler { _ in
            transportA.setFallbackState(completedBatchA)
            throw URLError(.timedOut)
        }

        let coordA = FutureTimelineCoordinator(
            transport: transportA,
            attemptStore: prefs,
            ensureUserId: { "user-drop" },
            pollIntervalNanoseconds: 1_000_000,
            maxPollAttempts: 10,
            uuidGenerator: { "req-drop-a" }
        )
        await coordA.loadState(locale: "ko")
        await coordA.requestGeneration(locale: "ko")
        XCTAssertEqual(coordA.state.items.map(\.name), ["새 추천작"])
        XCTAssertEqual(coordA.state.quota.used, 2)
        XCTAssertNil(coordA.errorMessage)
        XCTAssertFalse(coordA.hasPendingAttempt)

        // Scenario B: Offline drop (both POST and immediate `/state` fail) -> previous items stay visible,
        // app restarts (new coordinator sharing same AppPreferences), `/state` still shows old batch,
        // double-tap retry fires ONLY ONE POST with the EXACT SAME `requestId`, total quota increment = 1!
        let transportB = ScriptedRecommendationTransport(initialState: initialBatch)
        var serverCompletedIds: Set<String> = []
        var serverQuotaB = 1
        var failFirstPost = true

        transportB.enqueueState([
            .success(initialBatch),          // initial loadState
            .failure(URLError(.notConnectedToInternet)), // immediate recovery after dropped POST
            .success(initialBatch),          // after app restart: loadState still sees old batch
            .success(initialBatch)           // retry pre-check `/state` before idempotent POST
        ])
        transportB.setGenerateHandler { requestId in
            if failFirstPost {
                failFirstPost = false
                throw URLError(.networkConnectionLost)
            }
            try? await Task.sleep(nanoseconds: 40_000_000)
            if !serverCompletedIds.contains(requestId) {
                serverCompletedIds.insert(requestId)
                serverQuotaB += 1
            }
            let done = self.makeTestRecState(items: [newItem], used: serverQuotaB, generationId: requestId)
            transportB.setFallbackState(done)
            return (200, done)
        }

        let coordBeforeRestart = FutureTimelineCoordinator(
            transport: transportB,
            attemptStore: prefs,
            ensureUserId: { "user-restart" },
            pollIntervalNanoseconds: 1_000_000,
            maxPollAttempts: 10,
            uuidGenerator: { "req-same-id-1" }
        )
        await coordBeforeRestart.loadState(locale: "ko")
        await coordBeforeRestart.requestGeneration(locale: "ko")

        // Previous batch preserved & pending requestId persisted
        XCTAssertEqual(coordBeforeRestart.state.items.map(\.name), ["기존 추천작"])
        XCTAssertTrue(coordBeforeRestart.hasPendingAttempt)
        XCTAssertNotNil(coordBeforeRestart.errorMessage)
        XCTAssertEqual(prefs.pendingRecommendationRequestId(userId: "user-restart", locale: "ko"), "req-same-id-1")

        // Simulate app restart with a brand-new coordinator instance sharing `prefs`
        let coordAfterRestart = FutureTimelineCoordinator(
            transport: transportB,
            attemptStore: prefs,
            ensureUserId: { "user-restart" },
            pollIntervalNanoseconds: 1_000_000,
            maxPollAttempts: 10,
            uuidGenerator: { "req-must-not-be-used" }
        )
        await coordAfterRestart.loadState(locale: "ko")
        XCTAssertEqual(coordAfterRestart.state.items.map(\.name), ["기존 추천작"])
        XCTAssertTrue(coordAfterRestart.hasPendingAttempt)

        // Double-tap retry concurrently
        async let tap1: Void = coordAfterRestart.requestGeneration(locale: "ko")
        async let tap2: Void = coordAfterRestart.requestGeneration(locale: "ko")
        _ = await (tap1, tap2)

        XCTAssertEqual(transportB.sentRequestIds, ["req-same-id-1", "req-same-id-1"])
        XCTAssertEqual(coordAfterRestart.state.items.map(\.name), ["새 추천작"])
        XCTAssertEqual(coordAfterRestart.state.quota.used, 2) // +1 total increment!
        XCTAssertFalse(coordAfterRestart.hasPendingAttempt)
        XCTAssertNil(coordAfterRestart.errorMessage)
    }

    func testFutureTimeline202PollingSurvivesTransientErrorsAndResumes() async {
        let (prefs, cleanup) = makeTestPrefs("polling")
        defer { cleanup() }

        let oldItem = RecommendationItem(name: "이전 작품", type: .movie, reason: "이전")
        let polledItem = RecommendationItem(name: "폴링 완료 작품", type: .book, reason: "차분한 산문")
        let initial = makeTestRecState(items: [oldItem], used: 1, generationId: "gen-1")
        let running = makeTestRecState(items: [oldItem], used: 1, generationId: "gen-1", generating: true)
        let finished = makeTestRecState(items: [polledItem], used: 2, generationId: "req-poll-2", generating: false)

        let transport = ScriptedRecommendationTransport(initialState: initial)
        transport.setGenerateHandler { _ in (202, running) }
        transport.enqueueState([
            .success(initial),
            .success(running),
            .failure(URLError(.networkConnectionLost)),
            .failure(URLError(.timedOut)),
            .success(running),
            .success(finished)
        ])

        let coordinator = FutureTimelineCoordinator(
            transport: transport,
            attemptStore: prefs,
            ensureUserId: { "user-poll" },
            pollIntervalNanoseconds: 1_000_000,
            maxPollAttempts: 10,
            maxConsecutivePollErrors: 4,
            uuidGenerator: { "req-poll-2" }
        )

        await coordinator.loadState(locale: "ko")
        await coordinator.requestGeneration(locale: "ko")

        XCTAssertEqual(coordinator.state.items.map(\.name), ["폴링 완료 작품"])
        XCTAssertEqual(coordinator.state.quota.used, 2)
        XCTAssertFalse(coordinator.isGenerating)
        XCTAssertFalse(coordinator.hasPendingAttempt)
        XCTAssertNil(coordinator.errorMessage)
    }

    func testFutureTimelineFailureAnd429PreservePreviousBatchWithZeroExtraQuota() async {
        let (prefs, cleanup) = makeTestPrefs("fail429")
        defer { cleanup() }

        let oldItem = RecommendationItem(name: "유지되어야 할 작품", type: .movie, reason: "이전 배치")
        let initial = makeTestRecState(items: [oldItem], used: 1, generationId: "gen-prev")
        let transport = ScriptedRecommendationTransport(initialState: initial)
        transport.setGenerateHandler { _ in
            throw ApiError(statusCode: 503, code: "unavailable", message: "Temporarily unavailable")
        }

        let coordinator = FutureTimelineCoordinator(
            transport: transport,
            attemptStore: prefs,
            ensureUserId: { "user-err" },
            pollIntervalNanoseconds: 1_000_000,
            maxPollAttempts: 5,
            uuidGenerator: { "req-fail-1" }
        )

        await coordinator.loadState(locale: "ko")
        await coordinator.requestGeneration(locale: "ko")

        // 503 failure: 0 extra quota, previous batch still visible, requestId kept for retry
        XCTAssertEqual(coordinator.state.items.map(\.name), ["유지되어야 할 작품"])
        XCTAssertEqual(coordinator.state.quota.used, 1)
        XCTAssertTrue(coordinator.hasPendingAttempt)
        XCTAssertNotNil(coordinator.errorMessage)

        // Now server returns 429 LIMIT_REACHED (with previous items intact and quota 3/3)
        let exhausted = makeTestRecState(items: [oldItem], used: 3, generationId: "gen-prev")
        transport.setFallbackState(exhausted)
        transport.setGenerateHandler { _ in (429, exhausted) }

        await coordinator.requestGeneration(locale: "ko")
        XCTAssertEqual(coordinator.state.items.map(\.name), ["유지되어야 할 작품"])
        XCTAssertEqual(coordinator.state.quota.used, 3)
        XCTAssertEqual(coordinator.state.quota.remaining, 0)
        XCTAssertFalse(coordinator.hasPendingAttempt)
        XCTAssertNotNil(coordinator.errorMessage)
    }

    func testFutureTimelineCrossLocaleQuotaIsolationNeverMarksOtherLanguageSuccess() async {
        let (prefs, cleanup) = makeTestPrefs("cross-locale")
        defer { cleanup() }

        let koOld = RecommendationItem(name: "한국어 기존 배치", type: .movie, reason: "ko")
        let koInitial = makeTestRecState(items: [koOld], used: 1, generationId: "ko-gen-1")
        let koRunning = makeTestRecState(items: [koOld], used: 1, generationId: "ko-gen-1", generating: true)
        // Another language (`en`) finished on the same account: `quota.used` rose from 1 -> 2,
        // `generating` became false, yet `ko`'s `generationId` stayed `ko-gen-1`!
        let koAfterEnFinished = makeTestRecState(items: [koOld], used: 2, generationId: "ko-gen-1", generating: false)

        let transport = ScriptedRecommendationTransport(initialState: koInitial)
        transport.setGenerateHandler { _ in (202, koRunning) }
        transport.enqueueState([
            .success(koInitial),
            .success(koAfterEnFinished)
        ])

        let coordinator = FutureTimelineCoordinator(
            transport: transport,
            attemptStore: prefs,
            ensureUserId: { "user-multi" },
            pollIntervalNanoseconds: 1_000_000,
            maxPollAttempts: 5,
            uuidGenerator: { "ko-req-2" }
        )

        await coordinator.loadState(locale: "ko")
        await coordinator.requestGeneration(locale: "ko")

        // MUST NOT treat `en`'s quota increment as `ko` generation success!
        XCTAssertEqual(coordinator.state.items.map(\.name), ["한국어 기존 배치"])
        XCTAssertEqual(coordinator.state.quota.used, 2)
        XCTAssertNotNil(coordinator.errorMessage)
        XCTAssertTrue(coordinator.hasPendingAttempt)
        XCTAssertEqual(prefs.pendingRecommendationRequestId(userId: "user-multi", locale: "ko"), "ko-req-2")
        XCTAssertNil(prefs.pendingRecommendationRequestId(userId: "user-multi", locale: "en"))

        // Verify per-locale storage isolation & cleanup on clearAccountSession
        prefs.setPendingRecommendationRequestId("en-req-9", userId: "user-multi", locale: "en")
        XCTAssertEqual(prefs.pendingRecommendationRequestId(userId: "user-multi", locale: "ko"), "ko-req-2")
        XCTAssertEqual(prefs.pendingRecommendationRequestId(userId: "user-multi", locale: "en"), "en-req-9")
        prefs.clearAccountSession()
        XCTAssertNil(prefs.pendingRecommendationRequestId(userId: "user-multi", locale: "ko"))
        XCTAssertNil(prefs.pendingRecommendationRequestId(userId: "user-multi", locale: "en"))
    }

    // MARK: - 13. Shared 2-Tier Poster Image Cache (Memory + Disk + In-Flight Deduplication)

    func testPosterImageCacheMemoryDiskAndInFlightDeduplication() async throws {
        final class PosterMockProtocol: URLProtocol {
            nonisolated(unsafe) static var requestCount = 0
            nonisolated(unsafe) static var pngData = Data()
            override class func canInit(with request: URLRequest) -> Bool { true }
            override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
            override func startLoading() {
                Self.requestCount += 1
                let resp = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "image/png"]
                )!
                let data = Self.pngData
                DispatchQueue.global().asyncAfter(deadline: .now() + 0.03) {
                    self.client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
                    self.client?.urlProtocol(self, didLoad: data)
                    self.client?.urlProtocolDidFinishLoading(self)
                }
            }
            override func stopLoading() {}
        }

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 24))
        let samplePng = renderer.pngData { ctx in
            UIColor.systemOrange.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 16, height: 24))
        }
        PosterMockProtocol.requestCount = 0
        PosterMockProtocol.pngData = samplePng

        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [PosterMockProtocol.self]
        let mockSession = URLSession(configuration: config)

        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("poster_cache_test_\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let url = URL(string: "https://image.tmdb.org/t/p/w342/test_poster_1.jpg")!
        let cache1 = OttlinePosterImageCache(cacheDirectory: tempDir, session: mockSession)

        // 1. Concurrent requests deduplicate to 1 network fetch
        async let img1 = cache1.image(for: url)
        async let img2 = cache1.image(for: url)
        async let img3 = cache1.image(for: url)
        let (r1, r2, r3) = await (img1, img2, img3)
        XCTAssertNotNil(r1)
        XCTAssertNotNil(r2)
        XCTAssertNotNil(r3)
        XCTAssertEqual(PosterMockProtocol.requestCount, 1)

        // 2. Synchronous memory hit with 0 network calls
        XCTAssertNotNil(cache1.cachedImage(for: url))
        XCTAssertEqual(PosterMockProtocol.requestCount, 1)

        // 3. Simulated app restart (brand-new cache instance) hits persistent disk cache with 0 extra network calls
        let cache2 = OttlinePosterImageCache(cacheDirectory: tempDir, session: mockSession)
        XCTAssertNil(cache2.cachedImage(for: url))
        let diskHit = await cache2.image(for: url)
        XCTAssertNotNil(diskHit)
        XCTAssertEqual(PosterMockProtocol.requestCount, 1)
        XCTAssertNotNil(cache2.cachedImage(for: url))
    }

    // MARK: - 14. Server Account Deletion Failure Preservation & Success Clearing (`#163`)

    func testServerAccountDeletionPreservesDataOnErrorsAndClearsOn2xx() async throws {
        final class DeleteMockProtocol: URLProtocol {
            nonisolated(unsafe) static var mode: String = "http500"
            nonisolated(unsafe) static var deleteRequestCount: Int = 0
            nonisolated(unsafe) static var lastDeleteMethod: String?
            nonisolated(unsafe) static var lastDeletePath: String?

            override class func canInit(with request: URLRequest) -> Bool { true }
            override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

            override func startLoading() {
                let path = request.url?.path ?? ""
                if path == "/api/auth/account" {
                    Self.deleteRequestCount += 1
                    Self.lastDeleteMethod = request.httpMethod
                    Self.lastDeletePath = path
                }

                if Self.mode == "offline" {
                    client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
                    return
                }
                let status: Int
                let body: String
                if path != "/api/auth/account" {
                    status = 500
                    body = "{}"
                } else {
                    switch Self.mode {
                    case "http401":
                        status = 401
                        body = #"{"code":"unauthorized","message":"invalid device"}"#
                    case "http200":
                        status = 200
                        body = #"{"deleted":true}"#
                    case "http204":
                        status = 204
                        body = ""
                    default:
                        status = 500
                        body = #"{"code":"internal_error","message":"server failure"}"#
                    }
                }
                let resp = HTTPURLResponse(
                    url: request.url!,
                    statusCode: status,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
                if !body.isEmpty {
                    client?.urlProtocol(self, didLoad: Data(body.utf8))
                }
                client?.urlProtocolDidFinishLoading(self)
            }

            override func stopLoading() {}
        }

        let suiteName = "ottline.test.delete.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let tempDbPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("test_delete_\(UUID().uuidString).db")
            .path
        defer { try? FileManager.default.removeItem(atPath: tempDbPath) }

        let prefs = AppPreferences(
            defaults: defaults,
            groupDefaults: nil,
            keychainService: "app.ottline.test.delete.\(UUID().uuidString)"
        )
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [DeleteMockProtocol.self]
        let mockSession = URLSession(configuration: config)
        let repo = OttlineRepository(
            db: OttlineDatabase(path: tempDbPath),
            prefs: prefs,
            api: OttlineApiClient(prefs: prefs, session: mockSession)
        )

        // Seed 1 local log while NOT connected to any server account
        _ = await repo.saveLogForTitle(
            candidateTitle: Title(id: "t-del-1", provider: .tmdb, providerId: "100", type: .movie, name: "보존되어야 할 영화"),
            draft: LogDraft(status: .done, note: "중요한 기록", watchedAt: "2026-11-22T10:00:00Z")
        )
        XCTAssertEqual(repo.logs.count, 1)

        // 1. Unlinked device -> `.notConnected`, 0 DELETE /api/auth/account calls, local log preserved
        DeleteMockProtocol.deleteRequestCount = 0
        let notConnectedKo = await repo.performServerAccountDeletion(locale: "ko")
        XCTAssertFalse(notConnectedKo.isSuccess)
        if case .notConnected(let msg) = notConnectedKo {
            XCTAssertTrue(msg.contains("연결된 서버 계정이 없어요"))
        } else {
            XCTFail("Expected .notConnected, got \(notConnectedKo)")
        }
        XCTAssertEqual(DeleteMockProtocol.deleteRequestCount, 0)
        XCTAssertEqual(repo.logs.count, 1)

        // Link mock server session
        prefs.saveAuth(
            userId: "u-del-1",
            deviceId: "d-del-1",
            pairingCode: "DEL12345",
            nickname: "밤산책",
            personaKey: .bookDrifter
        )

        // 2. HTTP 500 -> `.failed`, preserves local DB + auth + profile
        DeleteMockProtocol.mode = "http500"
        let err500Ko = await repo.performServerAccountDeletion(locale: "ko")
        XCTAssertFalse(err500Ko.isSuccess)
        XCTAssertTrue(err500Ko.message.contains("삭제하지 못했어요"))
        XCTAssertFalse(err500Ko.message.contains("모두 삭제했어요"))
        XCTAssertEqual(DeleteMockProtocol.lastDeleteMethod, "DELETE")
        XCTAssertEqual(DeleteMockProtocol.lastDeletePath, "/api/auth/account")
        XCTAssertEqual(DeleteMockProtocol.deleteRequestCount, 1)
        XCTAssertEqual(repo.logs.count, 1)
        XCTAssertEqual(prefs.snapshot.userId, "u-del-1")
        XCTAssertEqual(prefs.snapshot.deviceId, "d-del-1")
        XCTAssertEqual(prefs.snapshot.pairingCode, "DEL12345")
        XCTAssertEqual(prefs.snapshot.nickname, "밤산책")
        XCTAssertEqual(prefs.snapshot.personaKey, .bookDrifter)

        // 3. HTTP 401 -> `.failed` (EN), preserves local DB + auth
        DeleteMockProtocol.mode = "http401"
        let err401En = await repo.performServerAccountDeletion(locale: "en")
        XCTAssertFalse(err401En.isSuccess)
        XCTAssertTrue(err401En.message.contains("Couldn't delete server data"))
        XCTAssertEqual(repo.logs.count, 1)
        XCTAssertEqual(prefs.snapshot.userId, "u-del-1")

        // 4. Network offline -> `.failed`, preserves local DB + auth + outbox
        DeleteMockProtocol.mode = "offline"
        let errOffline = await repo.performServerAccountDeletion(locale: "ko")
        XCTAssertFalse(errOffline.isSuccess)
        XCTAssertEqual(repo.logs.count, 1)
        XCTAssertGreaterThan(repo.outboxCount, 0)
        XCTAssertEqual(prefs.snapshot.userId, "u-del-1")

        // 5. HTTP 200 -> `.deleted`, clears local DB, outbox, and auth session
        DeleteMockProtocol.mode = "http200"
        let ok200 = await repo.performServerAccountDeletion(locale: "ko")
        XCTAssertTrue(ok200.isSuccess)
        XCTAssertEqual(ok200.message, "서버 데이터를 모두 삭제했어요.")
        XCTAssertEqual(repo.logs.count, 0)
        XCTAssertEqual(repo.outboxCount, 0)
        XCTAssertNil(prefs.snapshot.userId)
        XCTAssertNil(prefs.snapshot.deviceId)
        XCTAssertNil(prefs.snapshot.pairingCode)
        XCTAssertNil(prefs.snapshot.nickname)
    }

    // MARK: - 15. Together Filter/Sort, Selection Continuity & Reaction Race Guard (`#22`, `#27`)

    func testTogetherFilterSortSelectionAndReactionRaceGuard() {
        let items = [
            DiscussionListItem(
                id: "d-movie-old",
                titleId: "t-1",
                titleName: "Interstellar",
                titleType: .movie,
                titleYear: 2014,
                commentCount: 12,
                createdAt: "2026-11-10T10:00:00Z"
            ),
            DiscussionListItem(
                id: "d-book-new",
                titleId: "t-2",
                titleName: "Project Hail Mary",
                titleType: .book,
                titleYear: 2021,
                commentCount: 3,
                createdAt: "2026-11-22T10:00:00Z"
            ),
            DiscussionListItem(
                id: "d-series-mid",
                titleId: "t-3",
                titleName: "The Bear",
                titleType: .series,
                titleYear: 2022,
                commentCount: 8,
                createdAt: "2026-11-18T10:00:00Z"
            )
        ]

        // Latest sort
        let latest = TogetherFilterSort.filterAndSort(items, selectedType: "all", searchQuery: "", sortBy: "latest")
        XCTAssertEqual(latest.map(\.id), ["d-book-new", "d-series-mid", "d-movie-old"])

        // Most comments sort
        let byComments = TogetherFilterSort.filterAndSort(items, selectedType: "all", searchQuery: "", sortBy: "comments")
        XCTAssertEqual(byComments.map(\.id), ["d-movie-old", "d-series-mid", "d-book-new"])

        // Type & search filter
        let bookOnly = TogetherFilterSort.filterAndSort(items, selectedType: "book", searchQuery: "hail", sortBy: "latest")
        XCTAssertEqual(bookOnly.map(\.id), ["d-book-new"])

        // Selection continuity
        XCTAssertEqual(
            TogetherFilterSort.resolveSelectedDiscussionId(currentId: "d-series-mid", initialId: nil, filtered: latest),
            "d-series-mid"
        )
        XCTAssertEqual(
            TogetherFilterSort.resolveSelectedDiscussionId(currentId: "d-series-mid", initialId: nil, filtered: bookOnly),
            "d-book-new"
        )
        XCTAssertEqual(
            TogetherFilterSort.resolveSelectedDiscussionId(currentId: "d-series-mid", initialId: "d-movie-old", filtered: latest),
            "d-movie-old"
        )

        // Reaction race guard: older fetch token invalidated by newer fetch or toggle mutation
        var guardState = TogetherReactionGuard()
        let load1 = guardState.beginLoad(for: "d-movie-old")
        let load2 = guardState.beginLoad(for: "d-movie-old")
        XCTAssertFalse(guardState.shouldApplyLoad(for: "d-movie-old", token: load1))
        XCTAssertTrue(guardState.shouldApplyLoad(for: "d-movie-old", token: load2))

        // Mutation (toggle) invalidates in-flight GET token
        guardState.markMutation(for: "d-movie-old")
        XCTAssertFalse(guardState.shouldApplyLoad(for: "d-movie-old", token: load2))
    }
}
