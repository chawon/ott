import Foundation

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

    private var baseApiUrl: String {
        let root = prefs.snapshot.apiBaseUrl
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return root.hasSuffix("/api") ? root : "\(root)/api"
    }

    private func makeRequest(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem] = [],
        bodyData: Data? = nil,
        requireAuth: Bool = false,
        extraHeaders: [String: String] = [:]
    ) throws -> URLRequest {
        let fullStr = "\(baseApiUrl)\(path.hasPrefix("/") ? path : "/\(path)")"
        guard var components = URLComponents(string: fullStr) else {
            throw ApiError(statusCode: 0, code: "invalid_url", message: "Invalid URL: \(fullStr)")
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw ApiError(statusCode: 0, code: "invalid_url", message: "Invalid URL components")
        }

        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue(prefs.snapshot.locale, forHTTPHeaderField: "Accept-Language")

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
        if http.statusCode == 401 && checkAuthRevocation && request.value(forHTTPHeaderField: "X-User-Id") != nil {
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

    public func createAnonymousSession(deviceName: String = "iOS (ottline)") async throws -> AnonymousAuthResponse {
        let body = try JSONSerialization.data(withJSONObject: ["deviceName": deviceName])
        let req = try makeRequest(path: "/auth/anonymous", method: "POST", bodyData: body, requireAuth: false)
        return try await send(req, as: AnonymousAuthResponse.self, checkAuthRevocation: false)
    }

    public func pairWithCode(code: String, deviceName: String = "iOS (ottline)") async throws -> PairDeviceResponse {
        var payload: [String: String] = [
            "pairingCode": code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
            "deviceName": deviceName
        ]
        if let uid = prefs.snapshot.userId, !uid.isEmpty {
            payload["currentUserId"] = uid
        }
        if let did = prefs.snapshot.deviceId, !did.isEmpty {
            payload["currentDeviceId"] = did
        }
        let body = try JSONSerialization.data(withJSONObject: payload)
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

    public func deleteAccount() async throws {
        let req = try makeRequest(path: "/auth/account", method: "DELETE", requireAuth: true)
        _ = try await sendData(req, checkAuthRevocation: false)
    }

    public func getProfile() async throws -> UserProfileDto {
        let req = try makeRequest(path: "/auth/profile", requireAuth: true)
        return try await send(req, as: UserProfileDto.self)
    }

    public func updateProfile(nickname: String?, personaKey: PersonaKey?) async throws -> UserProfileDto {
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

    public func getLogsPage(limit: Int = 50, cursor: String? = nil) async throws -> WatchLogPageResponse {
        var q = [URLQueryItem(name: "limit", value: String(limit.clamped(to: 1...100)))]
        if let cursor, !cursor.isEmpty {
            q.append(URLQueryItem(name: "cursor", value: cursor))
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
        if let typeFilter, !typeFilter.isEmpty, typeFilter != "all" {
            q.append(URLQueryItem(name: "type", value: typeFilter))
        }
        var headers: [String: String] = [:]
        if typeFilter == "book" {
            headers["X-Book-Search-Capability"] = "google_books_v1"
        }
        let req = try makeRequest(path: "/titles/search", queryItems: q, extraHeaders: headers)
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
        let req = try makeRequest(path: "/titles/tmdb/tv/\(providerId)/seasons")
        return try await send(req, as: [SeasonOption].self)
    }

    public func getTvEpisodes(providerId: String, seasonNumber: Int) async throws -> [EpisodeOption] {
        let req = try makeRequest(path: "/titles/tmdb/tv/\(providerId)/seasons/\(seasonNumber)")
        return try await send(req, as: [EpisodeOption].self)
    }

    public func getTmdbMetadata(type: TitleType, providerId: String) async throws -> TmdbMetadataResponse {
        let q = [
            URLQueryItem(name: "type", value: type.rawValue),
            URLQueryItem(name: "providerId", value: providerId)
        ]
        let req = try makeRequest(path: "/titles/tmdb/metadata", queryItems: q)
        return try await send(req, as: TmdbMetadataResponse.self)
    }

    public func resolveBookClassifications(isbns: [String]) async throws -> [BookClassificationItemDto] {
        let unique = Array(Set(isbns.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }).prefix(100))
        guard !unique.isEmpty else { return [] }
        let body = try JSONSerialization.data(withJSONObject: ["isbns": unique])
        let req = try makeRequest(path: "/titles/book-classifications/resolve", method: "POST", bodyData: body)
        let resp = try await send(req, as: BookClassificationResolveResponse.self)
        return resp.items
    }

    // MARK: - 4. Discussions & Together & Comments

    public func getDiscussionsLatest(
        limit: Int = 20,
        days: Int? = nil,
        query: String? = nil,
        typeFilter: String? = nil,
        sort: String? = nil
    ) async throws -> [DiscussionListItem] {
        var q = [URLQueryItem(name: "limit", value: String(limit))]
        if let days { q.append(URLQueryItem(name: "days", value: String(days))) }
        if let query, !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            q.append(URLQueryItem(name: "q", value: query.trimmingCharacters(in: .whitespacesAndNewlines)))
        }
        if let typeFilter, !typeFilter.isEmpty, typeFilter != "all" {
            q.append(URLQueryItem(name: "type", value: typeFilter))
        }
        if let sort, !sort.isEmpty {
            q.append(URLQueryItem(name: "sort", value: sort))
        }
        let req = try makeRequest(path: "/discussions/latest", queryItems: q)
        return try await send(req, as: [DiscussionListItem].self)
    }

    public func getCuratedDiscussions(limit: Int = 5) async throws -> [DiscussionListItem] {
        let q = [URLQueryItem(name: "limit", value: String(limit))]
        let req = try makeRequest(path: "/discussions/curated", queryItems: q)
        return try await send(req, as: [DiscussionListItem].self)
    }

    public func toggleDiscussionReaction(
        titleId: String,
        type: DiscussionReactionType
    ) async throws -> DiscussionReactionSummaryResponse {
        let body = try JSONSerialization.data(withJSONObject: ["type": type.rawValue])
        let req = try makeRequest(
            path: "/titles/\(titleId)/reactions",
            method: "POST",
            bodyData: body,
            requireAuth: true
        )
        return try await send(req, as: DiscussionReactionSummaryResponse.self)
    }

    public func getComments(titleId: String, limit: Int = 30) async throws -> TitleCommentsResponse {
        let q = [URLQueryItem(name: "limit", value: String(limit))]
        let req = try makeRequest(path: "/titles/\(titleId)/comments", queryItems: q)
        return try await send(req, as: TitleCommentsResponse.self)
    }

    public func createComment(titleId: String, payload: CreateCommentRequest) async throws -> TitleCommentItem {
        let body = try JSONEncoder().encode(payload)
        let req = try makeRequest(path: "/titles/\(titleId)/comments", method: "POST", bodyData: body)
        return try await send(req, as: TitleCommentItem.self)
    }

    // MARK: - 5. Reports, Recommendations, Feedback, Analytics

    public func getPersonalReport() async throws -> PersonalReport {
        let req = try makeRequest(path: "/reports/me", requireAuth: true)
        return try await send(req, as: PersonalReport.self)
    }

    public func getNextWatchRecommendations(forceRefresh: Bool = false) async throws -> NextWatchRecommendResponse {
        var q: [URLQueryItem] = []
        if forceRefresh {
            q.append(URLQueryItem(name: "refresh", value: "true"))
        }
        let req = try makeRequest(path: "/recommendations/next-watch", queryItems: q, requireAuth: true)
        return try await send(req, as: NextWatchRecommendResponse.self)
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

    public func sendFeedbackMessage(threadId: String, body: String) async throws -> FeedbackThreadDetail {
        let data = try JSONSerialization.data(withJSONObject: ["body": body.trimmingCharacters(in: .whitespacesAndNewlines)])
        let req = try makeRequest(
            path: "/feedback/threads/\(threadId)/messages",
            method: "POST",
            bodyData: data,
            requireAuth: true
        )
        return try await send(req, as: FeedbackThreadDetail.self)
    }

    public func trackAnalyticsEvents(_ events: [AnalyticsEventPayload]) async {
        guard !events.isEmpty else { return }
        do {
            let body = try JSONEncoder().encode(AnalyticsEventsBatchRequest(events: events))
            let req = try makeRequest(path: "/analytics/events", method: "POST", bodyData: body)
            _ = try await sendData(req, checkAuthRevocation: false)
        } catch {
            // Analytics failures are non-blocking
        }
    }
}

private extension Comparable {
    func clamped(to limits: ClosedRange<Self>) -> Self {
        min(max(self, limits.lowerBound), limits.upperBound)
    }
}
