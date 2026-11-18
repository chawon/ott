import AppKit
import XCTest
@testable import OttlineCore
@testable import OttlineMacApp

final class OttlineMacTests: XCTestCase {
    func testMacCorePlatformPathsPreferencesAndShareDrain() async throws {
        XCTAssertNotNil(NSImage(named: "menubar_icon"))
        let suiteName = "ottline.mac.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let prefs = AppPreferences(
            defaults: defaults,
            groupDefaults: defaults,
            keychainService: "app.ottline.mac.test.\(UUID().uuidString)"
        )
        XCTAssertTrue(prefs.snapshot.macosMenuBarEnabled)
        prefs.setMacosMenuBarEnabled(false)
        XCTAssertFalse(prefs.snapshot.macosMenuBarEnabled)

        let db = OttlineDatabase()
        XCTAssertTrue(db.databasePath.contains("app.ottline/OttlineDB/ottline_v2.db"))

        let yt = ShareIntentParser.parse(sharedText: "인셉션 4K 리뷰 - YouTube https://youtu.be/xyz")
        XCTAssertEqual(yt.query, "인셉션 4K 리뷰")
        XCTAssertEqual(yt.suggestedPlatform, "YouTube")

        let entry = SharedExtensionLogEntry(
            id: "mac-shared-1",
            title: Title(id: "t-mac-1", provider: .tmdb, providerId: "27205", type: .movie, name: "인셉션"),
            status: .done,
            rating: 5.0,
            note: "맥 테스트 기록",
            ott: "넷플릭스",
            watchedAt: "2026-11-17T11:00:00Z",
            createdAt: "2026-11-17T11:00:00Z"
        )
        prefs.enqueueSharedExtensionLog(entry)

        let tempDbPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("mac_test_\(UUID().uuidString).db")
            .path
        let repo = OttlineRepository(db: OttlineDatabase(path: tempDbPath), prefs: prefs, api: OttlineApiClient(prefs: prefs))
        let count = await repo.drainSharedExtensionQueue()
        XCTAssertEqual(count, 1)
        XCTAssertEqual(repo.logs.first?.id, "mac-shared-1")

        // Verify share card PNG generation & temporary file export for NSSharingServicePicker
        let sampleLog = repo.logs.first!
        let cardImg = await MainActor.run {
            MacImageExportHelper.renderFallbackShareCard(log: sampleLog, ratioKey: "9:16", locale: "ko")
        }
        XCTAssertGreaterThan(cardImg.size.width, 0)
        guard let pngData = MacImageExportHelper.pngData(from: cardImg) else {
            return XCTFail("Expected PNG data from fallback share card")
        }
        XCTAssertGreaterThan(pngData.count, 8)
        XCTAssertEqual(Array(pngData.prefix(4)), [0x89, 0x50, 0x4E, 0x47])
        guard let tempUrl = MacImageExportHelper.writeTempSharePng(data: pngData, titleName: "인셉션: 1부/2부") else {
            return XCTFail("Expected temporary share PNG URL")
        }
        defer { try? FileManager.default.removeItem(at: tempUrl) }
        XCTAssertTrue(FileManager.default.fileExists(atPath: tempUrl.path))
        XCTAssertEqual(tempUrl.pathExtension.lowercased(), "png")
    }

    func testFeaturedPosterLayoutAndBookCoverResolution() {
        let standard = MacFeaturedBodyLayout.metrics(forTotalWidth: 749)
        XCTAssertEqual(standard.posterWidth, 332)
        XCTAssertEqual(standard.posterHeight, 498)
        XCTAssertEqual(standard.storyWidth, 391)

        let wide = MacFeaturedBodyLayout.metrics(forTotalWidth: 809)
        XCTAssertEqual(wide.posterWidth, 359)
        XCTAssertEqual(wide.posterHeight, 539)
        XCTAssertEqual(wide.storyWidth, 424)

        let narrow = MacFeaturedBodyLayout.metrics(forTotalWidth: 280)
        XCTAssertGreaterThanOrEqual(narrow.posterWidth, 135)
        XCTAssertEqual(narrow.posterHeight, round(narrow.posterWidth * 1.5))

        let kakaoThumb = "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F542617"
        XCTAssertEqual(
            MacFeaturedPosterView.originalBookCoverUrl(kakaoThumb),
            "https://t1.daumcdn.net/lbook/image/542617"
        )
        XCTAssertNil(MacFeaturedPosterView.originalBookCoverUrl("https://example.com/thumb/R120x174/?fname=https://t1.daumcdn.net/lbook/image/542617"))
        XCTAssertNil(MacFeaturedPosterView.originalBookCoverUrl("https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https://evil.example/lbook/image/542617"))

        let movieCandidates = MacFeaturedPosterView.candidateUrls(
            posterUrl: "https://image.tmdb.org/t/p/w342/abc.jpg",
            titleType: .movie
        )
        XCTAssertEqual(movieCandidates.first?.absoluteString, "https://image.tmdb.org/t/p/w780/abc.jpg")
    }

    func testMacClientPlatformHeaderAndDeviceDisplayName() {
        XCTAssertEqual(OttlineApiClient.defaultClientPlatform, "macos_native")
        XCTAssertEqual(OttlineApiClient.defaultDeviceName, "Mac (ottline)")
        XCTAssertEqual(
            DeviceItem(id: "d1", os: "macOS", browser: "Unknown Browser").displayName,
            "macOS"
        )
        XCTAssertEqual(
            DeviceItem(id: "d2", os: "macOS", browser: "macOS App").displayName,
            "macOS App · macOS"
        )
    }

    func testUniversalQuickLinkAliasesAndBrowserHandoffMerge() async throws {
        final class HandoffMockProtocol: URLProtocol {
            static var seenClientPlatforms: [String] = []
            static var seenPaths: [String] = []

            override class func canInit(with request: URLRequest) -> Bool { true }
            override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

            override func startLoading() {
                if let plat = request.value(forHTTPHeaderField: "X-Client-Platform") {
                    Self.seenClientPlatforms.append(plat)
                }
                let path = request.url?.path ?? ""
                Self.seenPaths.append(path)

                let body: String
                if path == "/api/auth/register" {
                    body = #"{"userId":"u-temp","deviceId":"d-mac-temp","pairingCode":"TEMP0001"}"#
                } else if path == "/api/sync/push" {
                    body = #"{"results":[]}"#
                } else if path == "/api/auth/pair" {
                    body = #"{"userId":"u-web","deviceId":"d-mac-paired","pairingCode":"ABCD2345","mergedLogsCount":1}"#
                } else if path == "/api/auth/profile" {
                    body = #"{"userId":"u-web","nickname":"밤산책","personaKey":"book_drifter","pairingCode":"ABCD2345"}"#
                } else if path == "/api/sync/pull" {
                    body = #"{"serverTime":"2026-11-18T14:00:00Z","titles":[],"logs":[],"history":[]}"#
                } else {
                    body = "{}"
                }

                let response = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                client?.urlProtocol(self, didLoad: Data(body.utf8))
                client?.urlProtocolDidFinishLoading(self)
            }

            override func stopLoading() {}
        }

        let suiteName = "ottline.mac.handoff.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let prefs = AppPreferences(
            defaults: defaults,
            groupDefaults: nil,
            keychainService: "app.ottline.mac.handoff.\(UUID().uuidString)"
        )
        prefs.setLocale("ko")

        let tempDbPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("mac_handoff_\(UUID().uuidString).db")
            .path
        defer { try? FileManager.default.removeItem(atPath: tempDbPath) }

        HandoffMockProtocol.seenClientPlatforms = []
        HandoffMockProtocol.seenPaths = []
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [HandoffMockProtocol.self]
        let mockSession = URLSession(configuration: config)

        let repo = OttlineRepository(
            db: OttlineDatabase(path: tempDbPath),
            prefs: prefs,
            api: OttlineApiClient(prefs: prefs, session: mockSession)
        )
        let appState = OttlineMacAppState()

        // 1. Standard `ottline://quick?quick=1&title=...&q=...&platform=...&type=video`
        let quickUrl = URL(string: "ottline://quick?quick=1&title=%EB%8D%94%20%EB%B2%A0%EC%96%B4&q=%EB%8D%94%20%EB%B2%A0%EC%96%B4&platform=Netflix&type=video&source_url=https://netflix.com/watch/1")!
        appState.handleIncomingUrl(quickUrl, repository: repo)
        XCTAssertEqual(appState.quickRecordRequest?.initialQuery, "더 베어")
        XCTAssertEqual(appState.quickRecordRequest?.initialTypeTab, "video")
        XCTAssertEqual(appState.quickRecordRequest?.prefilledPlatform, "Netflix")

        // 2. Alias parsing (`capture_title`, `capture_platform`, `capture_type`, `id`)
        let aliasUrl = URL(string: "ottline://quick-record?capture_title=Dune&capture_platform=Apple%20Books&capture_type=book&id=t-99")!
        XCTAssertEqual(
            OttlineDeepLinkParser.parse(aliasUrl),
            .quickRecord(ParsedQuickRecordLink(query: "Dune", typeTab: "book", platform: "Apple Books", titleId: "t-99"))
        )

        // 3. Handoff start URL & empty status guidance
        let startUrl = try XCTUnwrap(repo.buildBrowserHandoffStartUrl())
        XCTAssertTrue(startUrl.absoluteString.hasPrefix("https://ottline.app/ko?native_handoff=1&ts="))

        let emptyOutcome = await repo.importBrowserHandoff(ParsedBrowserHandoff(status: "empty"))
        XCTAssertFalse(emptyOutcome.success)
        XCTAssertTrue(emptyOutcome.message.contains("8자리 연결 코드"))

        // 4. Seed 1 offline local record, then receive `ottline://open?handoff=1&status=ok...` and verify lossless merge
        _ = await repo.saveLogForTitle(
            candidateTitle: Title(id: "local-t-1", provider: .tmdb, providerId: "155", type: .movie, name: "다크 나이트"),
            draft: LogDraft(status: .done, watchedAt: "2026-11-18T10:00:00Z")
        )
        let okUrl = URL(string: "ottline://open?handoff=1&status=ok&user_id=u-web&device_id=d-web&pairing_code=abcd2345&nickname=%EB%B0%A4%EC%82%B0%EC%B1%85&persona_key=book_drifter")!
        guard case .browserHandoff(let parsedOk) = OttlineDeepLinkParser.parse(okUrl) else {
            return XCTFail("Expected browserHandoff parse result")
        }
        let okOutcome = await repo.importBrowserHandoff(parsedOk)
        XCTAssertTrue(okOutcome.success)
        XCTAssertTrue(HandoffMockProtocol.seenPaths.contains("/api/auth/register"))
        XCTAssertTrue(HandoffMockProtocol.seenPaths.contains("/api/sync/push"))
        XCTAssertTrue(HandoffMockProtocol.seenPaths.contains("/api/auth/pair"))
        XCTAssertTrue(HandoffMockProtocol.seenPaths.contains("/api/sync/pull"))
        XCTAssertTrue(HandoffMockProtocol.seenClientPlatforms.allSatisfy { $0 == "macos_native" })
        XCTAssertEqual(prefs.snapshot.userId, "u-web")
        XCTAssertEqual(prefs.snapshot.deviceId, "d-mac-paired")
        XCTAssertNotEqual(prefs.snapshot.deviceId, "d-web")
        XCTAssertEqual(prefs.snapshot.pairingCode, "ABCD2345")
        XCTAssertEqual(prefs.snapshot.nickname, "밤산책")
        XCTAssertEqual(prefs.snapshot.personaKey, .bookDrifter)
    }
}
