import Foundation
#if canImport(UIKit)
import UIKit
#endif

public struct ApiError: Error, LocalizedError, Sendable {
    public let statusCode: Int
    public let code: String?
    public let message: String

    public var errorDescription: String? { message }
}

public final class OttlineApiClient: @unchecked Sendable {
    private let prefs: AppPreferences
    public let session: URLSession
    public var onAuthRevoked: (() -> Void)?

    public init(prefs: AppPreferences, session: URLSession = .shared) {
        self.prefs = prefs
        self.session = session
    }

    public static var defaultClientPlatform: String {
        #if os(macOS)
        return "macos_native"
        #else
        return "ios_native"
        #endif
    }

    public static var defaultDeviceName: String {
        #if os(macOS)
        return "Mac (ottline)"
        #elseif canImport(UIKit)
        return UIDevice.current.userInterfaceIdiom == .pad ? "iPad (ottline)" : "iPhone (ottline)"
        #else
        return "iOS (ottline)"
        #endif
    }

    public static var defaultUserAgent: String {
        let appVer = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "2.0.0"
        #if os(macOS)
        return "ottline-mac/\(appVer) (Macintosh; Mac OS X)"
        #elseif canImport(UIKit)
        let isPad = UIDevice.current.userInterfaceIdiom == .pad
        return isPad
            ? "ottline-ios/\(appVer) (iPad; iPadOS)"
            : "ottline-ios/\(appVer) (iPhone; iOS)"
        #else
        return "ottline-apple/\(appVer)"
        #endif
    }

    private var baseApiUrl: String {
        let root = prefs.snapshot.apiBaseUrl
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return root.hasSuffix("/api") ? root : "\(root)/api"
    }

    private var webBaseUrl: String {
        let root = baseApiUrl
        if root.hasSuffix("/api") {
            return String(root.dropLast(4))
        }
        return root
    }

    private func makeRequest(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem] = [],
        bodyData: Data? = nil,
        requireAuth: Bool = false,
        extraHeaders: [String: String] = [:],
        useWebRoot: Bool = false,
        timeoutInterval: TimeInterval = 20
    ) throws -> URLRequest {
        let root = useWebRoot ? webBaseUrl : baseApiUrl
        let fullStr = "\(root)\(path.hasPrefix("/") ? path : "/\(path)")"
        guard var components = URLComponents(string: fullStr) else {
            throw ApiError(statusCode: 0, code: "invalid_url", message: "Invalid URL: \(fullStr)")
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw ApiError(statusCode: 0, code: "invalid_url", message: "Invalid URL components")
        }

        var req = URLRequest(url: url, timeoutInterval: timeoutInterval)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue(prefs.snapshot.locale, forHTTPHeaderField: "Accept-Language")
        req.setValue(Self.defaultClientPlatform, forHTTPHeaderField: "X-Client-Platform")
        req.setValue(Self.defaultUserAgent, forHTTPHeaderField: "User-Agent")
        req.setValue("google_books_v1", forHTTPHeaderField: "X-Book-Search-Capability")

        if fullStr.lowercased().contains("ngrok") {
            req.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")
        }

        let snap = prefs.snapshot
        if let uid = snap.userId, !uid.isEmpty,
           let did = snap.deviceId, !did.isEmpty {
            req.setValue(uid, forHTTPHeaderField: "X-User-Id")
            req.setValue(did, forHTTPHeaderField: "X-Device-Id")
        } else if requireAuth {
            throw ApiError(statusCode: 401, code: "unauthenticated", message: "Authentication required")
        }

        for (k, v) in extraHeaders {
            req.setValue(v, forHTTPHeaderField: k)
        }

        if let bodyData {
            req.httpBody = bodyData
            req.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        }
        return req
    }

    private func sendData(_ request: URLRequest, checkAuthRevocation: Bool = true) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ApiError(statusCode: 0, code: "network_error", message: "Non-HTTP response")
        }
        if (http.statusCode == 401 || http.statusCode == 403),
           checkAuthRevocation,
           request.value(forHTTPHeaderField: "X-User-Id") != nil {
            onAuthRevoked?()
        }
        if !(200...299).contains(http.statusCode) {
            var code: String?
            var msg = "HTTP \(http.statusCode)"
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                code = obj["code"] as? String
                if let m = (obj["message"] as? String) ?? (obj["error"] as? String), !m.isEmpty {
                    msg = m
                }
            }
            throw ApiError(statusCode: http.statusCode, code: code, message: msg)
        }
        return data
    }

    private func send<T: Decodable>(_ request: URLRequest, as type: T.Type, checkAuthRevocation: Bool = true) async throws -> T {
        let data = try await sendData(request, checkAuthRevocation: checkAuthRevocation)
        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - 1. Auth & Devices & Profile

    public func createAnonymousSession(deviceName: String = OttlineApiClient.defaultDeviceName) async throws -> AnonymousAuthResponse {
        let body = Data("{}".utf8)
        let req = try makeRequest(path: "/auth/register", method: "POST", bodyData: body, requireAuth: false)
        return try await send(req, as: AnonymousAuthResponse.self, checkAuthRevocation: false)
    }

    public func pairWithCode(code: String, deviceName: String = OttlineApiClient.defaultDeviceName) async throws -> PairDeviceResponse {
        let payload = PairWithCodeRequest(
            code: code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
            oldUserId: (prefs.snapshot.userId?.isEmpty == false) ? prefs.snapshot.userId : nil
        )
        let body = try JSONEncoder().encode(payload)
        let req = try makeRequest(path: "/auth/pair", method: "POST", bodyData: body, requireAuth: false)
        return try await send(req, as: PairDeviceResponse.self, checkAuthRevocation: false)
    }

    public func getDevices() async throws -> [DeviceItem] {
        let req = try makeRequest(path: "/auth/devices", requireAuth: true)
        return try await send(req, as: [DeviceItem].self)
    }

    public func unlinkDevice(targetDeviceId: String) async throws {
        let req = try makeRequest(path: "/auth/devices/\(targetDeviceId)", method: "DELETE", requireAuth: true)
        _ = try await sendData(req)
    }

    public func unlinkAllDevices() async throws {
        let req = try makeRequest(path: "/auth/devices/all", method: "DELETE", requireAuth: true)
        _ = try await sendData(req, checkAuthRevocation: false)
    }

    public func deleteAccount() async throws {
        let req = try makeRequest(path: "/auth/account", method: "DELETE", requireAuth: true)
        _ = try await sendData(req, checkAuthRevocation: false)
    }

    public func getProfile() async throws -> UserProfileDto {
        let req = try makeRequest(path: "/auth/profile", requireAuth: true)
        return try await send(req, as: UserProfileDto.self)
    }

    public func getProfile(overrideUserId: String, overrideDeviceId: String) async throws -> UserProfileDto {
        let req = try makeRequest(
            path: "/auth/profile",
            requireAuth: false,
            extraHeaders: [
                "X-User-Id": overrideUserId,
                "X-Device-Id": overrideDeviceId
            ]
        )
        return try await send(req, as: UserProfileDto.self, checkAuthRevocation: false)
    }

    public func updateProfile(nickname: String, personaKey: PersonaKey) async throws -> UserProfileDto {
        let body = try JSONEncoder().encode(UpdateProfileRequest(nickname: nickname, personaKey: personaKey))
        let req = try makeRequest(path: "/auth/profile", method: "PATCH", bodyData: body, requireAuth: true)
        return try await send(req, as: UserProfileDto.self)
    }

    // MARK: - 2. Sync & Logs

    public func syncPush(_ payload: SyncPushRequest) async throws -> SyncPushResponse {
        let body = try JSONEncoder().encode(payload)
        let req = try makeRequest(path: "/sync/push", method: "POST", bodyData: body, requireAuth: true)
        return try await send(req, as: SyncPushResponse.self)
    }

    public func syncPull(since: String?, limit: Int = 250) async throws -> SyncPullResponse {
        var q: [URLQueryItem] = []
        if let since, !since.isEmpty {
            q.append(URLQueryItem(name: "since", value: since))
        }
        q.append(URLQueryItem(name: "limit", value: String(limit)))
        let req = try makeRequest(path: "/sync/pull", queryItems: q, requireAuth: true)
        return try await send(req, as: SyncPullResponse.self)
    }

    public func getLogs(titleId: String? = nil, limit: Int = 50) async throws -> [WatchLog] {
        var q = [URLQueryItem(name: "limit", value: String(limit.clamped(to: 1...100)))]
        if let titleId, !titleId.isEmpty {
            q.append(URLQueryItem(name: "titleId", value: titleId))
        }
        let req = try makeRequest(path: "/logs", queryItems: q, requireAuth: true)
        return try await send(req, as: [WatchLog].self)
    }

    public func getLogsPage(
        limit: Int = 50,
        cursor: String? = nil,
        sort: String? = "history",
        contentType: String? = nil,
        status: LogStatus? = nil,
        origin: LogOrigin? = nil,
        ott: String? = nil,
        place: Place? = nil,
        occasion: Occasion? = nil,
        query: String? = nil
    ) async throws -> WatchLogPageResponse {
        var q = [URLQueryItem(name: "limit", value: String(limit.clamped(to: 1...100)))]
        if let cursor, !cursor.isEmpty {
            q.append(URLQueryItem(name: "cursor", value: cursor))
        }
        if let sort, !sort.isEmpty {
            q.append(URLQueryItem(name: "sort", value: sort))
        }
        if let contentType, !contentType.isEmpty, contentType.uppercased() != "ALL" {
            q.append(URLQueryItem(name: "contentType", value: contentType))
        }
        if let status {
            q.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        if let origin {
            q.append(URLQueryItem(name: "origin", value: origin.rawValue))
        }
        if let ott, !ott.isEmpty {
            q.append(URLQueryItem(name: "ott", value: ott))
        }
        if let place {
            q.append(URLQueryItem(name: "place", value: place.rawValue))
        }
        if let occasion {
            q.append(URLQueryItem(name: "occasion", value: occasion.rawValue))
        }
        if let query, !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            q.append(URLQueryItem(name: "q", value: query.trimmingCharacters(in: .whitespacesAndNewlines)))
        }
        let req = try makeRequest(path: "/logs/page", queryItems: q, requireAuth: true)
        return try await send(req, as: WatchLogPageResponse.self)
    }

    public func getLogHistory(logId: String) async throws -> [WatchLogHistoryItem] {
        let req = try makeRequest(path: "/logs/\(logId)/history", requireAuth: true)
        return try await send(req, as: [WatchLogHistoryItem].self)
    }

    // MARK: - 3. Titles & Catalog & KDC

    public func searchTitles(query: String, typeFilter: String? = nil) async throws -> [TitleSearchItem] {
        var q = [URLQueryItem(name: "q", value: query)]
        if let rawFilter = typeFilter?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
           !rawFilter.isEmpty,
           rawFilter != "all" {
            let wireType: String? = {
                switch rawFilter {
                case "movie": return "movie"
                case "series", "tv": return "tv"
                case "book": return "book"
                default: return nil
                }
            }()
            if let wireType {
                q.append(URLQueryItem(name: "type", value: wireType))
            }
        }
        let req = try makeRequest(path: "/titles/search", queryItems: q)
        return try await send(req, as: [TitleSearchItem].self)
    }

    public func getPopularTitles(limit: Int = 12) async throws -> [TitleSearchItem] {
        let q = [URLQueryItem(name: "limit", value: String(limit))]
        let req = try makeRequest(path: "/titles/popular", queryItems: q)
        return try await send(req, as: [TitleSearchItem].self)
    }

    public func getTitleById(id: String) async throws -> Title {
        let req = try makeRequest(path: "/titles/\(id)")
        return try await send(req, as: Title.self)
    }

    public func getTvSeasons(providerId: String) async throws -> [SeasonOption] {
        let encoded = providerId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? providerId
        let req = try makeRequest(path: "/tmdb/tv/\(encoded)/seasons")
        return try await send(req, as: [SeasonOption].self)
    }

    public func getTvEpisodes(providerId: String, seasonNumber: Int) async throws -> [EpisodeOption] {
        let encoded = providerId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? providerId
        let req = try makeRequest(path: "/tmdb/tv/\(encoded)/seasons/\(seasonNumber)")
        return try await send(req, as: [EpisodeOption].self)
    }

    public func getTmdbMetadata(type: TitleType, providerId: String) async throws -> TmdbMetadataResponse {
        let segment = (type == .series) ? "series" : "movie"
        let encoded = providerId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? providerId
        let req = try makeRequest(path: "/tmdb/\(segment)/\(encoded)")
        return try await send(req, as: TmdbMetadataResponse.self)
    }

    public func resolveBookClassifications(isbns: [String]) async throws -> [BookClassificationItemDto] {
        let unique = Array(Set(isbns.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }))
        guard !unique.isEmpty else { return [] }
        var resolved: [BookClassificationItemDto] = []
        for start in stride(from: 0, to: unique.count, by: 50) {
            let chunk = Array(unique[start..<min(start + 50, unique.count)])
            let body = try JSONEncoder().encode(ResolveBookClassificationsRequest(isbn13s: chunk))
            let req = try makeRequest(path: "/titles/book-classifications/resolve", method: "POST", bodyData: body)
            let resp = try await send(req, as: BookClassificationResolveResponse.self)
            resolved.append(contentsOf: resp.items)
        }
        return resolved
    }

    // MARK: - 4. Discussions & Together & Comments

    public func getDiscussionsLatest(limit: Int = 6, minComments: Int? = nil, days: Int? = nil) async throws -> [DiscussionListItem] {
        var q = [URLQueryItem(name: "limit", value: String(limit))]
        if let minComments { q.append(URLQueryItem(name: "minComments", value: String(minComments))) }
        if let days { q.append(URLQueryItem(name: "days", value: String(days))) }
        let req = try makeRequest(path: "/discussions/latest", queryItems: q)
        return try await send(req, as: [DiscussionListItem].self)
    }

    public func getAllDiscussions(limit: Int = 100) async throws -> [DiscussionListItem] {
        let q = [URLQueryItem(name: "limit", value: String(limit))]
        let req = try makeRequest(path: "/discussions/all", queryItems: q)
        return try await send(req, as: [DiscussionListItem].self)
    }

    public func getDiscussionById(_ discussionId: String) async throws -> DiscussionListItem {
        let req = try makeRequest(path: "/discussions/\(discussionId)")
        return try await send(req, as: DiscussionListItem.self)
    }

    public func getDiscussionByTitle(titleId: String) async throws -> DiscussionDto? {
        let q = [URLQueryItem(name: "titleId", value: titleId)]
        let req = try makeRequest(path: "/discussions", queryItems: q)
        let data = try await sendData(req)
        if data.isEmpty || String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) == "null" {
            return nil
        }
        return try JSONDecoder().decode(DiscussionDto.self, from: data)
    }

    public func ensureDiscussion(titleId: String) async throws -> DiscussionDto {
        let body = try JSONSerialization.data(withJSONObject: ["titleId": titleId])
        let req = try makeRequest(path: "/discussions", method: "POST", bodyData: body)
        return try await send(req, as: DiscussionDto.self)
    }

    public func getDiscussionConnection(titleId: String) async throws -> DiscussionConnectionResponse? {
        let q = [URLQueryItem(name: "titleId", value: titleId)]
        let req = try makeRequest(path: "/discussions/connection", queryItems: q, requireAuth: true)
        do {
            let data = try await sendData(req)
            if data.isEmpty || String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) == "null" {
                return nil
            }
            return try JSONDecoder().decode(DiscussionConnectionResponse.self, from: data)
        } catch let err as ApiError where err.statusCode == 404 {
            return nil
        }
    }

    public func getMyDiscussionReactions(discussionId: String) async throws -> DiscussionReactionState {
        let req = try makeRequest(path: "/discussions/\(discussionId)/reactions/me", requireAuth: true)
        return try await send(req, as: DiscussionReactionState.self)
    }

    public func toggleDiscussionReaction(
        discussionId: String,
        type: DiscussionReactionType
    ) async throws -> DiscussionReactionState {
        let body = try JSONSerialization.data(withJSONObject: ["type": type.rawValue])
        let req = try makeRequest(
            path: "/discussions/\(discussionId)/reactions",
            method: "PUT",
            bodyData: body,
            requireAuth: true
        )
        return try await send(req, as: DiscussionReactionState.self)
    }

    public func getDiscussionComments(discussionId: String, limit: Int = 200) async throws -> [TitleCommentItem] {
        let q = [URLQueryItem(name: "limit", value: String(limit))]
        let req = try makeRequest(path: "/discussions/\(discussionId)/comments", queryItems: q)
        return try await send(req, as: [TitleCommentItem].self)
    }

    public func createDiscussionComment(discussionId: String, payload: CreateCommentRequest) async throws -> TitleCommentItem {
        let body = try JSONEncoder().encode(payload)
        let req = try makeRequest(path: "/discussions/\(discussionId)/comments", method: "POST", bodyData: body, requireAuth: true)
        return try await send(req, as: TitleCommentItem.self)
    }

    // MARK: - 5. Reports, Recommendations, Feedback, Analytics, ShareCard

    public func getPersonalReport() async throws -> PersonalReport {
        let req = try makeRequest(path: "/nalytic/me/report", requireAuth: true)
        return try await send(req, as: PersonalReport.self)
    }

    public func getRecommendationState() async throws -> RecommendationState {
        let req = try makeRequest(path: "/recommendations/state", requireAuth: true)
        return try await send(req, as: RecommendationState.self)
    }

    public static let recommendationGenerateTimeoutSeconds: TimeInterval = 90

    public func generateRecommendations(requestId: String) async throws -> (statusCode: Int, state: RecommendationState) {
        let body = try JSONEncoder().encode(RecommendationGenerateRequest(requestId: requestId))
        let req = try makeRequest(
            path: "/recommendations/generate",
            method: "POST",
            bodyData: body,
            requireAuth: true,
            timeoutInterval: Self.recommendationGenerateTimeoutSeconds
        )
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw ApiError(statusCode: 0, code: "network_error", message: "Non-HTTP response")
        }
        if (http.statusCode == 401 || http.statusCode == 403),
           req.value(forHTTPHeaderField: "X-User-Id") != nil {
            onAuthRevoked?()
        }
        if http.statusCode == 200 || http.statusCode == 202 || http.statusCode == 429,
           let decoded = try? JSONDecoder().decode(RecommendationState.self, from: data) {
            return (http.statusCode, decoded)
        }
        if !(200...299).contains(http.statusCode) {
            var code: String?
            var msg = "HTTP \(http.statusCode)"
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                code = obj["code"] as? String
                if let m = (obj["message"] as? String) ?? (obj["error"] as? String), !m.isEmpty {
                    msg = m
                }
            }
            throw ApiError(statusCode: http.statusCode, code: code, message: msg)
        }
        return (http.statusCode, try JSONDecoder().decode(RecommendationState.self, from: data))
    }

    public func excludeRecommendation(_ item: RecommendationItem) async throws -> RecommendationExclusion {
        let body = try JSONEncoder().encode(item)
        let req = try makeRequest(path: "/recommendations/exclusions", method: "PUT", bodyData: body, requireAuth: true)
        return try await send(req, as: RecommendationExclusion.self)
    }

    public func restoreRecommendationExclusion(key: String) async throws {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        let encoded = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
        let req = try makeRequest(path: "/recommendations/exclusions/\(encoded)", method: "DELETE", requireAuth: true)
        _ = try await sendData(req)
    }

    public func searchRecommendationCatalog(
        name: String,
        type: TitleType,
        year: Int? = nil,
        author: String? = nil
    ) async throws -> [TitleSearchItem] {
        var q = [
            URLQueryItem(name: "name", value: name),
            URLQueryItem(name: "type", value: type.rawValue)
        ]
        if let year { q.append(URLQueryItem(name: "year", value: String(year))) }
        if let author, !author.isEmpty { q.append(URLQueryItem(name: "author", value: author)) }
        let req = try makeRequest(path: "/recommendations/catalog", queryItems: q, requireAuth: true)
        return try await send(req, as: [TitleSearchItem].self)
    }

    public func getFeedbackThreads() async throws -> [FeedbackThreadSummary] {
        let req = try makeRequest(path: "/feedback/threads", requireAuth: true)
        return try await send(req, as: [FeedbackThreadSummary].self)
    }

    public func getFeedbackThreadDetail(threadId: String) async throws -> FeedbackThreadDetail {
        let req = try makeRequest(path: "/feedback/threads/\(threadId)", requireAuth: true)
        return try await send(req, as: FeedbackThreadDetail.self)
    }

    public func createFeedbackThread(
        category: FeedbackCategory,
        subject: String?,
        body: String
    ) async throws -> FeedbackThreadDetail {
        var obj: [String: String] = [
            "category": category.rawValue,
            "body": body.trimmingCharacters(in: .whitespacesAndNewlines)
        ]
        if let s = subject?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
            obj["subject"] = s
        }
        let data = try JSONSerialization.data(withJSONObject: obj)
        let req = try makeRequest(path: "/feedback/threads", method: "POST", bodyData: data, requireAuth: true)
        return try await send(req, as: FeedbackThreadDetail.self)
    }

    public func trackAnalyticsEvent(_ event: AnalyticsSingleEventRequest, clientId: String) async {
        do {
            let body = try JSONEncoder().encode(event)
            let req = try makeRequest(
                path: "/nalytic/events",
                method: "POST",
                bodyData: body,
                extraHeaders: ["X-Client-Id": clientId]
            )
            _ = try await sendData(req, checkAuthRevocation: false)
        } catch {
            // Analytics failures are non-blocking
        }
    }

    public func renderServerShareCard<T: Encodable>(_ payload: T) async throws -> Data {
        let body = try JSONEncoder().encode(payload)
        var req = try makeRequest(
            path: "/og/share-card",
            method: "POST",
            bodyData: body,
            useWebRoot: true
        )
        req.setValue("image/png", forHTTPHeaderField: "Accept")
        return try await sendData(req, checkAuthRevocation: false)
    }
}

private extension Comparable {
    func clamped(to limits: ClosedRange<Self>) -> Self {
        min(max(self, limits.lowerBound), limits.upperBound)
    }
}
