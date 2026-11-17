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
    }
}
