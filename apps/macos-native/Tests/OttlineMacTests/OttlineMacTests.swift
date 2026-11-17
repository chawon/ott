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
            "macOS · macOS App"
        )
    }
}
