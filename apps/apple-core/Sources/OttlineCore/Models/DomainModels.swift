import Foundation

// MARK: - Core Enums

public enum TitleType: String, Codable, CaseIterable, Sendable {
    case movie = "movie"
    case series = "series"
    case book = "book"

    public var wire: String { rawValue }

    public static func fromWire(_ raw: String?) -> TitleType {
        switch raw?.lowercased() {
        case "series", "tv": return .series
        case "book": return .book
        default: return .movie
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = TitleType.fromWire(raw)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

public enum Provider: String, Codable, CaseIterable, Sendable {
    case tmdb = "TMDB"
    case naver = "NAVER"
    case kakao = "KAKAO"
    case google = "GOOGLE_BOOKS"
    case openlibrary = "OPENLIBRARY"
    case local = "LOCAL"

    public static func fromWire(_ raw: String?) -> Provider {
        switch raw?.uppercased() {
        case "TMDB": return .tmdb
        case "NAVER": return .naver
        case "KAKAO": return .kakao
        case "GOOGLE_BOOKS", "GOOGLE": return .google
        case "OPENLIBRARY": return .openlibrary
        default: return .local
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = Provider.fromWire(raw)
    }
}

public enum LogStatus: String, Codable, CaseIterable, Sendable {
    case done = "DONE"
    case inProgress = "IN_PROGRESS"
    case wishlist = "WISHLIST"

    public static func fromWire(_ raw: String?) -> LogStatus {
        switch raw?.uppercased() {
        case "IN_PROGRESS": return .inProgress
        case "WISHLIST": return .wishlist
        default: return .done
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = LogStatus.fromWire(raw)
    }
}

public enum LogOrigin: String, Codable, Sendable {
    case log = "LOG"
    case comment = "COMMENT"

    public static func fromWire(_ raw: String?) -> LogOrigin {
        raw?.uppercased() == "COMMENT" ? .comment : .log
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = LogOrigin.fromWire(raw)
    }
}

public enum Place: String, Codable, CaseIterable, Sendable {
    case home = "HOME"
    case theater = "THEATER"
    case transit = "TRANSIT"
    case cafe = "CAFE"
    case office = "OFFICE"
    case library = "LIBRARY"
    case bookstore = "BOOKSTORE"
    case school = "SCHOOL"
    case park = "PARK"
    case outdoor = "OUTDOOR"
    case etc = "ETC"

    public static var move: Place { .transit }
    public static var other: Place { .etc }

    public static let videoCases: [Place] = [.home, .theater, .transit, .cafe, .office, .etc]
    public static let bookCases: [Place] = [.home, .cafe, .library, .bookstore, .school, .park, .outdoor, .transit, .etc]

    public static func cases(for type: TitleType) -> [Place] {
        type == .book ? bookCases : videoCases
    }

    public static func fromWire(_ raw: String?) -> Place? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        switch raw.uppercased() {
        case "MOVE", "TRANSIT": return .transit
        case "OTHER", "ETC": return .etc
        default:
            return Place.allCases.first { $0.rawValue.caseInsensitiveCompare(raw) == .orderedSame }
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = Place.fromWire(raw) ?? .etc
    }
}

public enum Occasion: String, Codable, CaseIterable, Sendable {
    case alone = "ALONE"
    case date = "DATE"
    case family = "FAMILY"
    case friends = "FRIENDS"
    case breakTime = "BREAK"
    case etc = "ETC"

    public static var friend: Occasion { .friends }
    public static var other: Occasion { .etc }

    public static func fromWire(_ raw: String?) -> Occasion? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        switch raw.uppercased() {
        case "FRIEND", "FRIENDS": return .friends
        case "OTHER", "ETC": return .etc
        default:
            return Occasion.allCases.first { $0.rawValue.caseInsensitiveCompare(raw) == .orderedSame }
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = Occasion.fromWire(raw) ?? .etc
    }
}

public enum PersonaKey: String, Codable, CaseIterable, Sendable {
    case cinemaKeeper = "cinema_keeper"
    case bookDrifter = "book_drifter"
    case deepWatcher = "deep_watcher"
    case midnightLogger = "midnight_logger"
    case weekendCurator = "weekend_curator"
    case archiveCollector = "archive_collector"

    public static func fromWire(_ raw: String?) -> PersonaKey? {
        guard let raw, !raw.isEmpty else { return nil }
        return PersonaKey.allCases.first { $0.rawValue.caseInsensitiveCompare(raw) == .orderedSame }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        guard let parsed = PersonaKey.fromWire(raw) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid PersonaKey: \(raw)")
        }
        self = parsed
    }
}

public enum FeedbackCategory: String, Codable, CaseIterable, Sendable {
    case question = "QUESTION"
    case bug = "BUG"
    case idea = "IDEA"
    case other = "OTHER"

    public static func fromWire(_ raw: String?) -> FeedbackCategory {
        switch raw?.uppercased() {
        case "QUESTION", "DATA": return .question
        case "BUG": return .bug
        case "IDEA": return .idea
        default: return .other
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = FeedbackCategory.fromWire(raw)
    }
}

public enum FeedbackStatus: String, Codable, Sendable {
    case open = "OPEN"
    case answered = "ANSWERED"
    case closed = "CLOSED"
}

public enum FeedbackAuthorRole: String, Codable, Sendable {
    case user = "USER"
    case admin = "ADMIN"
}

public enum DiscussionReactionType: String, Codable, CaseIterable, Sendable {
    case done = "DONE"
    case curious = "CURIOUS"
    case save = "SAVE"

    public static func fromWire(_ raw: String?) -> DiscussionReactionType {
        switch raw?.uppercased() {
        case "DONE", "ME_TOO": return .done
        case "CURIOUS": return .curious
        case "SAVE", "BOOKMARK": return .save
        default: return .done
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try? container.decode(String.self)
        self = DiscussionReactionType.fromWire(raw)
    }
}

// MARK: - Domain Models

public struct Title: Codable, Equatable, Identifiable, Hashable, Sendable {
    public var id: String
    public var provider: Provider
    public var providerId: String?
    public var type: TitleType
    public var name: String
    public var year: Int?
    public var posterUrl: String?
    public var overview: String?
    public var genres: [String]?
    public var directors: [String]?
    public var cast: [String]?
    public var author: String?
    public var publisher: String?
    public var isbn10: String?
    public var isbn13: String?
    public var pubdate: String?

    public init(
        id: String,
        provider: Provider = .local,
        providerId: String? = nil,
        type: TitleType = .movie,
        name: String,
        year: Int? = nil,
        posterUrl: String? = nil,
        overview: String? = nil,
        genres: [String]? = nil,
        directors: [String]? = nil,
        cast: [String]? = nil,
        author: String? = nil,
        publisher: String? = nil,
        isbn10: String? = nil,
        isbn13: String? = nil,
        pubdate: String? = nil
    ) {
        self.id = id
        self.provider = provider
        self.providerId = providerId
        self.type = type
        self.name = name
        self.year = year
        self.posterUrl = posterUrl
        self.overview = overview
        self.genres = genres
        self.directors = directors
        self.cast = cast
        self.author = author
        self.publisher = publisher
        self.isbn10 = isbn10
        self.isbn13 = isbn13
        self.pubdate = pubdate
    }
}

public struct TitleSearchItem: Codable, Equatable, Identifiable, Hashable, Sendable {
    public var provider: Provider
    public var providerId: String
    public var titleId: String?
    public var type: TitleType
    public var name: String
    public var year: Int?
    public var posterUrl: String?
    public var overview: String?
    public var author: String?
    public var publisher: String?
    public var isbn10: String?
    public var isbn13: String?
    public var pubdate: String?
    public var sourceUrl: String?
    public var infoUrl: String?

    public var id: String { "\(provider.rawValue):\(type.rawValue):\(providerId)" }

    public var resolvedGoogleBooksUrl: String? {
        for candidate in [sourceUrl, infoUrl] {
            if let raw = candidate,
               let comps = URLComponents(string: raw),
               comps.scheme == "https",
               comps.host == "books.google.com",
               comps.user == nil,
               comps.password == nil,
               let url = comps.url {
                return url.absoluteString
            }
        }
        if provider == .google && !providerId.isEmpty {
            let encoded = providerId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? providerId
            return "https://books.google.com/books?id=\(encoded)"
        }
        return nil
    }

    public init(
        provider: Provider = .tmdb,
        providerId: String,
        titleId: String? = nil,
        type: TitleType = .movie,
        name: String,
        year: Int? = nil,
        posterUrl: String? = nil,
        overview: String? = nil,
        author: String? = nil,
        publisher: String? = nil,
        isbn10: String? = nil,
        isbn13: String? = nil,
        pubdate: String? = nil,
        sourceUrl: String? = nil,
        infoUrl: String? = nil
    ) {
        self.provider = provider
        self.providerId = providerId
        self.titleId = titleId
        self.type = type
        self.name = name
        self.year = year
        self.posterUrl = posterUrl
        self.overview = overview
        self.author = author
        self.publisher = publisher
        self.isbn10 = isbn10
        self.isbn13 = isbn13
        self.pubdate = pubdate
        self.sourceUrl = sourceUrl
        self.infoUrl = infoUrl ?? sourceUrl
    }

    public func toNewTitle(generatedId: String = UUID().uuidString.lowercased()) -> Title {
        let resolvedId = (titleId?.isEmpty == false) ? titleId! : generatedId
        return Title(
            id: resolvedId,
            provider: provider,
            providerId: providerId,
            type: type,
            name: name,
            year: year,
            posterUrl: posterUrl,
            overview: overview,
            author: author,
            publisher: publisher,
            isbn10: isbn10,
            isbn13: isbn13,
            pubdate: pubdate
        )
    }
}

public struct WatchLog: Codable, Equatable, Identifiable, Hashable, Sendable {
    public var id: String
    public var title: Title
    public var status: LogStatus
    public var rating: Double?
    public var note: String?
    public var spoiler: Bool
    public var ott: String?
    public var seasonNumber: Int?
    public var episodeNumber: Int?
    public var seasonPosterUrl: String?
    public var seasonYear: Int?
    public var origin: LogOrigin
    public var createdAt: String
    public var watchedAt: String
    public var place: Place?
    public var occasion: Occasion?
    public var updatedAt: String?

    public init(
        id: String,
        title: Title,
        status: LogStatus = .done,
        rating: Double? = nil,
        note: String? = nil,
        spoiler: Bool = false,
        ott: String? = nil,
        seasonNumber: Int? = nil,
        episodeNumber: Int? = nil,
        seasonPosterUrl: String? = nil,
        seasonYear: Int? = nil,
        origin: LogOrigin = .log,
        createdAt: String = "",
        watchedAt: String = "",
        place: Place? = nil,
        occasion: Occasion? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.rating = rating
        self.note = note
        self.spoiler = spoiler
        self.ott = ott
        self.seasonNumber = seasonNumber
        self.episodeNumber = episodeNumber
        self.seasonPosterUrl = seasonPosterUrl
        self.seasonYear = seasonYear
        self.origin = origin
        self.createdAt = createdAt
        self.watchedAt = watchedAt
        self.place = place
        self.occasion = occasion
        self.updatedAt = updatedAt
    }
}

public struct WatchLogPageResponse: Codable, Sendable {
    public var items: [WatchLog]
    public var nextCursor: String?

    public var hasMore: Bool {
        guard let nextCursor else { return false }
        return !nextCursor.isEmpty
    }

    public init(items: [WatchLog] = [], nextCursor: String? = nil) {
        self.items = items
        self.nextCursor = nextCursor
    }
}

public struct LogDraft: Codable, Equatable, Sendable {
    public var status: LogStatus
    public var rating: Double?
    public var note: String?
    public var spoiler: Bool
    public var ott: String?
    public var seasonNumber: Int?
    public var episodeNumber: Int?
    public var seasonPosterUrl: String?
    public var seasonYear: Int?
    public var watchedAt: String
    public var place: Place?
    public var occasion: Occasion?

    public init(
        status: LogStatus,
        rating: Double? = nil,
        note: String? = nil,
        spoiler: Bool = false,
        ott: String? = nil,
        seasonNumber: Int? = nil,
        episodeNumber: Int? = nil,
        seasonPosterUrl: String? = nil,
        seasonYear: Int? = nil,
        watchedAt: String,
        place: Place? = nil,
        occasion: Occasion? = nil
    ) {
        self.status = status
        self.rating = rating
        self.note = note
        self.spoiler = spoiler
        self.ott = ott
        self.seasonNumber = seasonNumber
        self.episodeNumber = episodeNumber
        self.seasonPosterUrl = seasonPosterUrl
        self.seasonYear = seasonYear
        self.watchedAt = watchedAt
        self.place = place
        self.occasion = occasion
    }
}

public struct WatchLogHistoryItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var logId: String
    public var recordedAt: String
    public var status: LogStatus
    public var rating: Double?
    public var note: String?
    public var spoiler: Bool
    public var ott: String?
    public var seasonNumber: Int?
    public var episodeNumber: Int?
    public var seasonPosterUrl: String?
    public var seasonYear: Int?
    public var origin: LogOrigin
    public var watchedAt: String
    public var place: Place?
    public var occasion: Occasion?

    public init(
        id: String,
        logId: String,
        recordedAt: String,
        status: LogStatus = .done,
        rating: Double? = nil,
        note: String? = nil,
        spoiler: Bool = false,
        ott: String? = nil,
        seasonNumber: Int? = nil,
        episodeNumber: Int? = nil,
        seasonPosterUrl: String? = nil,
        seasonYear: Int? = nil,
        origin: LogOrigin = .log,
        watchedAt: String = "",
        place: Place? = nil,
        occasion: Occasion? = nil
    ) {
        self.id = id
        self.logId = logId
        self.recordedAt = recordedAt
        self.status = status
        self.rating = rating
        self.note = note
        self.spoiler = spoiler
        self.ott = ott
        self.seasonNumber = seasonNumber
        self.episodeNumber = episodeNumber
        self.seasonPosterUrl = seasonPosterUrl
        self.seasonYear = seasonYear
        self.origin = origin
        self.watchedAt = watchedAt
        self.place = place
        self.occasion = occasion
    }
}

public struct SeasonOption: Codable, Equatable, Identifiable, Sendable {
    public var seasonNumber: Int
    public var name: String
    public var episodeCount: Int?
    public var posterUrl: String?
    public var year: Int?

    public var id: Int { seasonNumber }
}

public struct EpisodeOption: Codable, Equatable, Identifiable, Sendable {
    public var episodeNumber: Int
    public var name: String

    public var id: Int { episodeNumber }
}

public struct TmdbMetadataResponse: Codable, Sendable {
    public var genres: [String]?
    public var directors: [String]?
    public var cast: [String]?
    public var overview: String?
}

// MARK: - Discussions & Together

public struct DiscussionReactionSummary: Codable, Equatable, Sendable {
    public var done: Int
    public var curious: Int
    public var save: Int

    public static let empty = DiscussionReactionSummary(done: 0, curious: 0, save: 0)

    public init(done: Int = 0, curious: Int = 0, save: Int = 0) {
        self.done = done
        self.curious = curious
        self.save = save
    }

    public func count(for type: DiscussionReactionType) -> Int {
        switch type {
        case .done: return done
        case .curious: return curious
        case .save: return save
        }
    }
}

public struct DiscussionReactionState: Codable, Equatable, Sendable {
    public var summary: DiscussionReactionSummary
    public var selectedTypes: [DiscussionReactionType]
    public var selected: Bool

    public init(
        summary: DiscussionReactionSummary = .empty,
        selectedTypes: [DiscussionReactionType] = [],
        selected: Bool = false
    ) {
        self.summary = summary
        self.selectedTypes = selectedTypes
        self.selected = selected
    }
}

public struct DiscussionDto: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var titleId: String
    public var commentSeq: Int
    public var createdAt: String
    public var reactionSummary: DiscussionReactionSummary?

    public init(
        id: String,
        titleId: String,
        commentSeq: Int = 0,
        createdAt: String = "",
        reactionSummary: DiscussionReactionSummary? = nil
    ) {
        self.id = id
        self.titleId = titleId
        self.commentSeq = commentSeq
        self.createdAt = createdAt
        self.reactionSummary = reactionSummary
    }
}

public struct DiscussionConnectionResponse: Codable, Equatable, Sendable {
    public var discussionId: String
    public var titleId: String

    public init(discussionId: String, titleId: String) {
        self.discussionId = discussionId
        self.titleId = titleId
    }
}

public struct DiscussionListItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var titleId: String
    public var titleProvider: Provider?
    public var titleProviderId: String?
    public var titleName: String
    public var titleType: TitleType
    public var titleYear: Int?
    public var posterUrl: String?
    public var commentCount: Int
    public var createdAt: String
    public var reactionSummary: DiscussionReactionSummary?

    public init(
        id: String? = nil,
        titleId: String,
        titleProvider: Provider? = nil,
        titleProviderId: String? = nil,
        titleName: String,
        titleType: TitleType = .movie,
        titleYear: Int? = nil,
        posterUrl: String? = nil,
        commentCount: Int = 0,
        createdAt: String = "",
        reactionSummary: DiscussionReactionSummary? = nil
    ) {
        self.id = id ?? titleId
        self.titleId = titleId
        self.titleProvider = titleProvider
        self.titleProviderId = titleProviderId
        self.titleName = titleName
        self.titleType = titleType
        self.titleYear = titleYear
        self.posterUrl = posterUrl
        self.commentCount = commentCount
        self.createdAt = createdAt
        self.reactionSummary = reactionSummary
    }

    enum CodingKeys: String, CodingKey {
        case id, titleId, titleProvider, titleProviderId, provider, providerId
        case titleName, titleType, titleYear, posterUrl, commentCount, createdAt, reactionSummary
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let decodedTitleId = try c.decode(String.self, forKey: .titleId)
        titleId = decodedTitleId
        id = (try? c.decode(String.self, forKey: .id)) ?? decodedTitleId
        titleProvider = (try? c.decode(Provider.self, forKey: .titleProvider))
            ?? (try? c.decode(Provider.self, forKey: .provider))
        titleProviderId = (try? c.decode(String.self, forKey: .titleProviderId))
            ?? (try? c.decode(String.self, forKey: .providerId))
        titleName = (try? c.decode(String.self, forKey: .titleName)) ?? ""
        titleType = (try? c.decode(TitleType.self, forKey: .titleType)) ?? .movie
        titleYear = try? c.decode(Int.self, forKey: .titleYear)
        posterUrl = try? c.decode(String.self, forKey: .posterUrl)
        commentCount = (try? c.decode(Int.self, forKey: .commentCount)) ?? 0
        createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ""
        reactionSummary = try? c.decode(DiscussionReactionSummary.self, forKey: .reactionSummary)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(titleId, forKey: .titleId)
        try c.encodeIfPresent(titleProvider, forKey: .titleProvider)
        try c.encodeIfPresent(titleProviderId, forKey: .titleProviderId)
        try c.encode(titleName, forKey: .titleName)
        try c.encode(titleType, forKey: .titleType)
        try c.encodeIfPresent(titleYear, forKey: .titleYear)
        try c.encodeIfPresent(posterUrl, forKey: .posterUrl)
        try c.encode(commentCount, forKey: .commentCount)
        try c.encode(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(reactionSummary, forKey: .reactionSummary)
    }
}

public struct MentionedTitleItem: Codable, Equatable, Sendable {
    public var titleId: String
    public var name: String
    public var type: TitleType
    public var provider: Provider
    public var providerId: String
    public var year: Int?
    public var posterUrl: String?
}

public struct MentionRef: Codable, Equatable, Sendable {
    public var provider: Provider
    public var providerId: String
    public var titleType: TitleType

    public init(provider: Provider, providerId: String, titleType: TitleType) {
        self.provider = provider
        self.providerId = providerId
        self.titleType = titleType
    }
}

public struct MentionCandidateDto: Codable, Equatable, Sendable {
    public var provider: Provider
    public var providerId: String
    public var type: TitleType
    public var name: String
    public var year: Int?
    public var posterUrl: String?
    public var overview: String?

    public init(
        provider: Provider,
        providerId: String,
        type: TitleType,
        name: String,
        year: Int? = nil,
        posterUrl: String? = nil,
        overview: String? = nil
    ) {
        self.provider = provider
        self.providerId = providerId
        self.type = type
        self.name = name
        self.year = year
        self.posterUrl = posterUrl
        self.overview = overview
    }

    public var mentionRef: MentionRef {
        MentionRef(provider: provider, providerId: providerId, titleType: type)
    }
}

public struct CreateCommentRequest: Codable, Sendable {
    public var body: String
    public var mentions: [MentionRef]
    public var syncLog: Bool

    public init(
        body: String,
        mentions: [MentionRef] = [],
        syncLog: Bool = true
    ) {
        self.body = body
        self.mentions = mentions
        self.syncLog = syncLog
    }
}

public struct TitleCommentItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var discussionId: String?
    public var userId: String?
    public var authorName: String
    public var body: String
    public var createdAt: String

    public init(
        id: String,
        discussionId: String? = nil,
        userId: String? = nil,
        authorName: String,
        body: String,
        createdAt: String
    ) {
        self.id = id
        self.discussionId = discussionId
        self.userId = userId
        self.authorName = authorName
        self.body = body
        self.createdAt = createdAt
    }
}

// MARK: - Auth, Devices, Profile

public struct PairWithCodeRequest: Codable, Sendable {
    public var code: String
    public var oldUserId: String?

    public init(code: String, oldUserId: String? = nil) {
        self.code = code
        self.oldUserId = oldUserId
    }
}

public struct AnonymousAuthResponse: Codable, Sendable {
    public var userId: String
    public var deviceId: String
    public var pairingCode: String
    public var nickname: String?
    public var personaKey: PersonaKey?
}

public struct PairDeviceResponse: Codable, Sendable {
    public var userId: String
    public var deviceId: String
    public var pairingCode: String
    public var nickname: String?
    public var personaKey: PersonaKey?
    public var mergedLogsCount: Int?
}

public struct DeviceItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var createdAt: String
    public var lastSeenAt: String?
    public var os: String?
    public var browser: String?

    public init(
        id: String,
        createdAt: String = "",
        lastSeenAt: String? = nil,
        os: String? = nil,
        browser: String? = nil
    ) {
        self.id = id
        self.createdAt = createdAt
        self.lastSeenAt = lastSeenAt
        self.os = os
        self.browser = browser
    }

    public var displayName: String {
        let parts = [browser, os]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter {
                !$0.isEmpty
                    && $0.caseInsensitiveCompare("Unknown Browser") != .orderedSame
                    && $0.caseInsensitiveCompare("Unknown OS") != .orderedSame
            }
        return parts.joined(separator: " · ")
    }
}

public struct UserProfileDto: Codable, Equatable, Sendable {
    public var userId: String?
    public var pairingCode: String?
    public var nickname: String?
    public var personaKey: PersonaKey?
    public var profileUpdatedAt: String?
}

public struct UpdateProfileRequest: Codable, Sendable {
    public var nickname: String
    public var personaKey: PersonaKey

    public init(nickname: String, personaKey: PersonaKey) {
        self.nickname = nickname
        self.personaKey = personaKey
    }
}

// MARK: - Sync

public struct SyncTitlePayload: Codable, Sendable {
    public var provider: String
    public var providerId: String?
    public var type: String
    public var name: String
    public var year: Int?
    public var posterUrl: String?
    public var overview: String?
    public var genres: [String]?
    public var directors: [String]?
    public var cast: [String]?
    public var author: String?
    public var publisher: String?
    public var isbn10: String?
    public var isbn13: String?
    public var pubdate: String?

    public init(
        provider: String,
        providerId: String? = nil,
        type: String,
        name: String,
        year: Int? = nil,
        posterUrl: String? = nil,
        overview: String? = nil,
        genres: [String]? = nil,
        directors: [String]? = nil,
        cast: [String]? = nil,
        author: String? = nil,
        publisher: String? = nil,
        isbn10: String? = nil,
        isbn13: String? = nil,
        pubdate: String? = nil
    ) {
        self.provider = provider
        self.providerId = providerId
        self.type = type
        self.name = name
        self.year = year
        self.posterUrl = posterUrl
        self.overview = overview
        self.genres = genres
        self.directors = directors
        self.cast = cast
        self.author = author
        self.publisher = publisher
        self.isbn10 = isbn10
        self.isbn13 = isbn13
        self.pubdate = pubdate
    }
}

public struct SyncTitleChange: Codable, Sendable {
    public var id: String
    public var op: String
    public var updatedAt: String
    public var payload: SyncTitlePayload?

    public init(id: String, op: String, updatedAt: String, payload: SyncTitlePayload? = nil) {
        self.id = id
        self.op = op
        self.updatedAt = updatedAt
        self.payload = payload
    }
}

public struct SyncLogPayload: Codable, Sendable {
    public var titleId: String
    public var status: String
    public var rating: Double?
    public var note: String?
    public var spoiler: Bool
    public var ott: String?
    public var seasonNumber: Int?
    public var episodeNumber: Int?
    public var seasonPosterUrl: String?
    public var seasonYear: Int?
    public var origin: String
    public var watchedAt: String
    public var place: String?
    public var occasion: String?

    public init(
        titleId: String,
        status: String,
        rating: Double? = nil,
        note: String? = nil,
        spoiler: Bool = false,
        ott: String? = nil,
        seasonNumber: Int? = nil,
        episodeNumber: Int? = nil,
        seasonPosterUrl: String? = nil,
        seasonYear: Int? = nil,
        origin: String = "LOG",
        watchedAt: String,
        place: String? = nil,
        occasion: String? = nil
    ) {
        self.titleId = titleId
        self.status = status
        self.rating = rating
        self.note = note
        self.spoiler = spoiler
        self.ott = ott
        self.seasonNumber = seasonNumber
        self.episodeNumber = episodeNumber
        self.seasonPosterUrl = seasonPosterUrl
        self.seasonYear = seasonYear
        self.origin = origin
        self.watchedAt = watchedAt
        self.place = place
        self.occasion = occasion
    }
}

public struct SyncLogChange: Codable, Sendable {
    public var id: String
    public var op: String
    public var updatedAt: String
    public var payload: SyncLogPayload?

    public init(id: String, op: String, updatedAt: String, payload: SyncLogPayload? = nil) {
        self.id = id
        self.op = op
        self.updatedAt = updatedAt
        self.payload = payload
    }
}

public struct SyncPushRequest: Codable, Sendable {
    public var userId: String
    public var deviceId: String
    public var changes: SyncChanges
    public var clientTime: String

    public struct SyncChanges: Codable, Sendable {
        public var titles: [SyncTitleChange]
        public var logs: [SyncLogChange]

        public init(titles: [SyncTitleChange] = [], logs: [SyncLogChange] = []) {
            self.titles = titles
            self.logs = logs
        }
    }

    public init(userId: String, deviceId: String, changes: SyncChanges, clientTime: String) {
        self.userId = userId
        self.deviceId = deviceId
        self.changes = changes
        self.clientTime = clientTime
    }
}

public struct SyncRejectItem: Codable, Equatable, Sendable {
    public var id: String
    public var reason: String?
}

public struct SyncPushResponse: Codable, Sendable {
    public var accepted: [String]
    public var rejected: [SyncRejectItem]

    public init(accepted: [String] = [], rejected: [SyncRejectItem] = []) {
        self.accepted = accepted
        self.rejected = rejected
    }

    enum CodingKeys: String, CodingKey {
        case accepted, rejected
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accepted = (try? c.decode([String].self, forKey: .accepted)) ?? []
        rejected = (try? c.decode([SyncRejectItem].self, forKey: .rejected)) ?? []
    }
}

public struct SyncPullTitleDto: Codable, Sendable {
    public var id: String
    public var type: TitleType
    public var name: String
    public var year: Int?
    public var genres: [String]?
    public var directors: [String]?
    public var cast: [String]?
    public var overview: String?
    public var posterUrl: String?
    public var author: String?
    public var publisher: String?
    public var isbn10: String?
    public var isbn13: String?
    public var pubdate: String?
    public var provider: Provider?
    public var providerId: String?
    public var createdAt: String?
    public var updatedAt: String?
    public var deletedAt: String?
}

public struct SyncPullLogDto: Codable, Sendable {
    public var id: String
    public var titleId: String
    public var status: LogStatus
    public var rating: Double?
    public var note: String?
    public var spoiler: Bool?
    public var ott: String?
    public var seasonNumber: Int?
    public var episodeNumber: Int?
    public var seasonPosterUrl: String?
    public var seasonYear: Int?
    public var origin: LogOrigin?
    public var watchedAt: String?
    public var place: Place?
    public var occasion: Occasion?
    public var createdAt: String?
    public var updatedAt: String?
    public var deletedAt: String?
}

public struct SyncPullChanges: Codable, Sendable {
    public var logs: [SyncPullLogDto]
    public var titles: [SyncPullTitleDto]

    public init(logs: [SyncPullLogDto] = [], titles: [SyncPullTitleDto] = []) {
        self.logs = logs
        self.titles = titles
    }
}

public struct SyncPullResponse: Codable, Sendable {
    public var serverTime: String
    public var changes: SyncPullChanges
}

// MARK: - Personal Report & Recap

public struct SeasonalRecapPoster: Codable, Equatable, Hashable, Sendable {
    public var titleId: String
    public var title: String
    public var titleType: String?
    public var posterUrl: String?
    public var count: Int
    public var lastLoggedAt: String?

    public init(
        titleId: String,
        title: String,
        titleType: String? = "movie",
        posterUrl: String? = nil,
        count: Int = 1,
        lastLoggedAt: String? = nil
    ) {
        self.titleId = titleId
        self.title = title
        self.titleType = titleType
        self.posterUrl = posterUrl
        self.count = count
        self.lastLoggedAt = lastLoggedAt
    }

    enum CodingKeys: String, CodingKey {
        case titleId, title, titleType, type, posterUrl, count, lastLoggedAt, watchedAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        titleId = (try? c.decode(String.self, forKey: .titleId)) ?? ""
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        titleType = (try? c.decode(String.self, forKey: .titleType))
            ?? (try? c.decode(String.self, forKey: .type))
        posterUrl = try? c.decode(String.self, forKey: .posterUrl)
        count = (try? c.decode(Int.self, forKey: .count)) ?? 1
        lastLoggedAt = (try? c.decode(String.self, forKey: .lastLoggedAt))
            ?? (try? c.decode(String.self, forKey: .watchedAt))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(titleId, forKey: .titleId)
        try c.encode(title, forKey: .title)
        try c.encodeIfPresent(titleType, forKey: .titleType)
        try c.encodeIfPresent(posterUrl, forKey: .posterUrl)
        try c.encode(count, forKey: .count)
        try c.encodeIfPresent(lastLoggedAt, forKey: .lastLoggedAt)
    }
}

public struct SeasonalRecap: Codable, Equatable, Sendable {
    public var key: String
    public var startDate: String
    public var endDate: String
    public var totalLogs: Int
    public var topType: String?
    public var topPlace: String?
    public var topOccasion: String?
    public var doneRatePct: Double
    public var noteFillPct: Double
    public var posters: [SeasonalRecapPoster]

    public init(
        key: String,
        startDate: String,
        endDate: String,
        totalLogs: Int = 0,
        topType: String? = nil,
        topPlace: String? = nil,
        topOccasion: String? = nil,
        doneRatePct: Double = 0,
        noteFillPct: Double = 0,
        posters: [SeasonalRecapPoster] = []
    ) {
        self.key = key
        self.startDate = startDate
        self.endDate = endDate
        self.totalLogs = totalLogs
        self.topType = topType
        self.topPlace = topPlace
        self.topOccasion = topOccasion
        self.doneRatePct = doneRatePct
        self.noteFillPct = noteFillPct
        self.posters = posters
    }
}

public struct MonthlyTrendPoint: Codable, Equatable, Sendable {
    public var month: String
    public var count: Int
}

public struct NameCountMetric: Codable, Equatable, Sendable {
    public var name: String
    public var count: Int
}

public struct StatusCountMetric: Codable, Equatable, Sendable {
    public var status: String
    public var count: Int
}

public struct TypeCountMetric: Codable, Equatable, Sendable {
    public var type: String
    public var count: Int
}

public struct PersonalReport: Codable, Equatable, Sendable {
    public var totalLogs: Int
    public var thisMonthLogs: Int
    public var doneRatePct: Double
    public var ratingFillPct: Double
    public var noteFillPct: Double
    public var topType: String?
    public var topPlace: String?
    public var topOccasion: String?
    public var streakDays: Int
    public var longestStreakDays: Int
    public var lastLoggedAt: String?
    public var previousWeekLogs: Int
    public var previousWeekPosters: [SeasonalRecapPoster]?
    public var monthlyTopGenre: String?
    public var monthlyTopGenreCount: Int
    public var daysSinceLastLog: Int?
    public var continueSeriesTitleId: String?
    public var continueSeriesTitle: String?
    public var continueSeriesSeasonNumber: Int?
    public var continueSeriesEpisodeNumber: Int?
    public var seasonalRecap: SeasonalRecap?

    // Client-computed enrichments (not emitted by /api/nalytic/me/report)
    public var avgRating: Double?
    public var ratedLogs: Int
    public var topOtt: String
    public var byStatus: [StatusCountMetric]
    public var byType: [TypeCountMetric]
    public var topOtts: [NameCountMetric]
    public var monthlyTrend: [MonthlyTrendPoint]
    public var topGenres: [NameCountMetric]
    public var topDirectors: [NameCountMetric]
    public var topCast: [NameCountMetric]

    public init(
        totalLogs: Int = 0,
        thisMonthLogs: Int = 0,
        doneRatePct: Double = 0,
        ratingFillPct: Double = 0,
        noteFillPct: Double = 0,
        topType: String? = nil,
        topPlace: String? = nil,
        topOccasion: String? = nil,
        streakDays: Int = 0,
        longestStreakDays: Int = 0,
        lastLoggedAt: String? = nil,
        previousWeekLogs: Int = 0,
        previousWeekPosters: [SeasonalRecapPoster]? = nil,
        monthlyTopGenre: String? = nil,
        monthlyTopGenreCount: Int = 0,
        daysSinceLastLog: Int? = nil,
        continueSeriesTitleId: String? = nil,
        continueSeriesTitle: String? = nil,
        continueSeriesSeasonNumber: Int? = nil,
        continueSeriesEpisodeNumber: Int? = nil,
        seasonalRecap: SeasonalRecap? = nil,
        avgRating: Double? = nil,
        ratedLogs: Int = 0,
        topOtt: String = "-",
        byStatus: [StatusCountMetric] = [],
        byType: [TypeCountMetric] = [],
        topOtts: [NameCountMetric] = [],
        monthlyTrend: [MonthlyTrendPoint] = [],
        topGenres: [NameCountMetric] = [],
        topDirectors: [NameCountMetric] = [],
        topCast: [NameCountMetric] = []
    ) {
        self.totalLogs = totalLogs
        self.thisMonthLogs = thisMonthLogs
        self.doneRatePct = doneRatePct
        self.ratingFillPct = ratingFillPct
        self.noteFillPct = noteFillPct
        self.topType = topType
        self.topPlace = topPlace
        self.topOccasion = topOccasion
        self.streakDays = streakDays
        self.longestStreakDays = longestStreakDays
        self.lastLoggedAt = lastLoggedAt
        self.previousWeekLogs = previousWeekLogs
        self.previousWeekPosters = previousWeekPosters
        self.monthlyTopGenre = monthlyTopGenre
        self.monthlyTopGenreCount = monthlyTopGenreCount
        self.daysSinceLastLog = daysSinceLastLog
        self.continueSeriesTitleId = continueSeriesTitleId
        self.continueSeriesTitle = continueSeriesTitle
        self.continueSeriesSeasonNumber = continueSeriesSeasonNumber
        self.continueSeriesEpisodeNumber = continueSeriesEpisodeNumber
        self.seasonalRecap = seasonalRecap
        self.avgRating = avgRating
        self.ratedLogs = ratedLogs
        self.topOtt = topOtt
        self.byStatus = byStatus
        self.byType = byType
        self.topOtts = topOtts
        self.monthlyTrend = monthlyTrend
        self.topGenres = topGenres
        self.topDirectors = topDirectors
        self.topCast = topCast
    }

    enum CodingKeys: String, CodingKey {
        case totalLogs, thisMonthLogs, doneRatePct, ratingFillPct, noteFillPct
        case topType, topPlace, topOccasion, streakDays, longestStreakDays, lastLoggedAt
        case previousWeekLogs, previousWeekPosters, monthlyTopGenre, monthlyTopGenreCount
        case daysSinceLastLog, continueSeriesTitleId, continueSeriesTitle
        case continueSeriesSeasonNumber, continueSeriesEpisodeNumber, seasonalRecap
        case avgRating, ratedLogs, topOtt, byStatus, byType, topOtts, monthlyTrend, topGenres, topDirectors, topCast
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalLogs = (try? c.decode(Int.self, forKey: .totalLogs)) ?? 0
        thisMonthLogs = (try? c.decode(Int.self, forKey: .thisMonthLogs)) ?? 0
        doneRatePct = (try? c.decode(Double.self, forKey: .doneRatePct)) ?? 0
        ratingFillPct = (try? c.decode(Double.self, forKey: .ratingFillPct)) ?? 0
        noteFillPct = (try? c.decode(Double.self, forKey: .noteFillPct)) ?? 0
        topType = try? c.decode(String.self, forKey: .topType)
        topPlace = try? c.decode(String.self, forKey: .topPlace)
        topOccasion = try? c.decode(String.self, forKey: .topOccasion)
        streakDays = (try? c.decode(Int.self, forKey: .streakDays)) ?? 0
        longestStreakDays = (try? c.decode(Int.self, forKey: .longestStreakDays)) ?? 0
        lastLoggedAt = try? c.decode(String.self, forKey: .lastLoggedAt)
        previousWeekLogs = (try? c.decode(Int.self, forKey: .previousWeekLogs)) ?? 0
        previousWeekPosters = try? c.decode([SeasonalRecapPoster].self, forKey: .previousWeekPosters)
        monthlyTopGenre = try? c.decode(String.self, forKey: .monthlyTopGenre)
        monthlyTopGenreCount = (try? c.decode(Int.self, forKey: .monthlyTopGenreCount)) ?? 0
        daysSinceLastLog = try? c.decode(Int.self, forKey: .daysSinceLastLog)
        continueSeriesTitleId = try? c.decode(String.self, forKey: .continueSeriesTitleId)
        continueSeriesTitle = try? c.decode(String.self, forKey: .continueSeriesTitle)
        continueSeriesSeasonNumber = try? c.decode(Int.self, forKey: .continueSeriesSeasonNumber)
        continueSeriesEpisodeNumber = try? c.decode(Int.self, forKey: .continueSeriesEpisodeNumber)
        seasonalRecap = try? c.decode(SeasonalRecap.self, forKey: .seasonalRecap)
        avgRating = try? c.decode(Double.self, forKey: .avgRating)
        ratedLogs = (try? c.decode(Int.self, forKey: .ratedLogs)) ?? 0
        topOtt = (try? c.decode(String.self, forKey: .topOtt)) ?? "-"
        byStatus = (try? c.decode([StatusCountMetric].self, forKey: .byStatus)) ?? []
        byType = (try? c.decode([TypeCountMetric].self, forKey: .byType)) ?? []
        topOtts = (try? c.decode([NameCountMetric].self, forKey: .topOtts)) ?? []
        monthlyTrend = (try? c.decode([MonthlyTrendPoint].self, forKey: .monthlyTrend)) ?? []
        topGenres = (try? c.decode([NameCountMetric].self, forKey: .topGenres)) ?? []
        topDirectors = (try? c.decode([NameCountMetric].self, forKey: .topDirectors)) ?? []
        topCast = (try? c.decode([NameCountMetric].self, forKey: .topCast)) ?? []
    }
}

// MARK: - KDC Bookshelf

public struct ResolveBookClassificationsRequest: Codable, Sendable {
    public var isbn13s: [String]

    public init(isbn13s: [String]) {
        self.isbn13s = isbn13s
    }
}

public struct BookClassificationItemDto: Codable, Equatable, Sendable {
    public var isbn13: String
    public var status: String
    public var kdcCode: String?
    public var kdcMajor: Int?
    public var source: String?
    public var fetchedAt: String?

    public var isResolved: Bool {
        status.uppercased() == "RESOLVED"
    }

    public init(
        isbn13: String,
        status: String,
        kdcCode: String? = nil,
        kdcMajor: Int? = nil,
        source: String? = nil,
        fetchedAt: String? = nil
    ) {
        self.isbn13 = isbn13
        self.status = status
        self.kdcCode = kdcCode
        self.kdcMajor = kdcMajor
        self.source = source
        self.fetchedAt = fetchedAt
    }

    enum CodingKeys: String, CodingKey {
        case isbn13, status, kdcCode, kdcMajor, source, fetchedAt, resolvedAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        isbn13 = try c.decode(String.self, forKey: .isbn13)
        status = try c.decode(String.self, forKey: .status)
        kdcCode = try? c.decode(String.self, forKey: .kdcCode)
        kdcMajor = try? c.decode(Int.self, forKey: .kdcMajor)
        source = try? c.decode(String.self, forKey: .source)
        fetchedAt = (try? c.decode(String.self, forKey: .fetchedAt))
            ?? (try? c.decode(String.self, forKey: .resolvedAt))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(isbn13, forKey: .isbn13)
        try c.encode(status, forKey: .status)
        try c.encodeIfPresent(kdcCode, forKey: .kdcCode)
        try c.encodeIfPresent(kdcMajor, forKey: .kdcMajor)
        try c.encodeIfPresent(source, forKey: .source)
        try c.encodeIfPresent(fetchedAt, forKey: .fetchedAt)
    }
}

public struct BookClassificationResolveResponse: Codable, Sendable {
    public var items: [BookClassificationItemDto]
}

// MARK: - Feedback / Inquiry

public struct FeedbackThreadSummary: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var userId: String?
    public var category: FeedbackCategory
    public var subject: String?
    public var status: FeedbackStatus
    public var createdAt: String
    public var updatedAt: String
    public var lastMessagePreview: String?
    public var lastAuthorRole: FeedbackAuthorRole?
    public var messageCount: Int

    public init(
        id: String,
        userId: String? = nil,
        category: FeedbackCategory,
        subject: String? = nil,
        status: FeedbackStatus,
        createdAt: String,
        updatedAt: String,
        lastMessagePreview: String? = nil,
        lastAuthorRole: FeedbackAuthorRole? = nil,
        messageCount: Int
    ) {
        self.id = id
        self.userId = userId
        self.category = category
        self.subject = subject
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.lastMessagePreview = lastMessagePreview
        self.lastAuthorRole = lastAuthorRole
        self.messageCount = messageCount
    }
}

public struct FeedbackMessageItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var authorRole: FeedbackAuthorRole
    public var body: String
    public var createdAt: String
}

public struct FeedbackThreadDetail: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var userId: String?
    public var category: FeedbackCategory
    public var subject: String?
    public var status: FeedbackStatus
    public var createdAt: String
    public var updatedAt: String
    public var messages: [FeedbackMessageItem]
}

// MARK: - Future Timeline Recommendations (OpenAI v2)

public struct RecommendationItem: Codable, Equatable, Identifiable, Hashable, Sendable {
    public var name: String
    public var type: TitleType
    public var reason: String
    public var genres: [String]
    public var posterUrl: String?
    public var provider: String?
    public var providerId: String?
    public var year: Int?
    public var alternateNames: [String]?
    public var originalName: String?
    public var author: String?
    public var isbn10: String?
    public var isbn13: String?
    public var catalogTitle: TitleSearchItem?

    public var id: String {
        "\(type.rawValue):\(name.lowercased()):\(year ?? 0):\(providerId ?? "")"
    }

    public init(
        name: String,
        type: TitleType = .movie,
        reason: String = "",
        genres: [String] = [],
        posterUrl: String? = nil,
        provider: String? = nil,
        providerId: String? = nil,
        year: Int? = nil,
        alternateNames: [String]? = nil,
        originalName: String? = nil,
        author: String? = nil,
        isbn10: String? = nil,
        isbn13: String? = nil,
        catalogTitle: TitleSearchItem? = nil
    ) {
        self.name = name
        self.type = type
        self.reason = reason
        self.genres = genres
        self.posterUrl = posterUrl
        self.provider = provider
        self.providerId = providerId
        self.year = year
        self.alternateNames = alternateNames
        self.originalName = originalName
        self.author = author
        self.isbn10 = isbn10
        self.isbn13 = isbn13
        self.catalogTitle = catalogTitle
    }
}

public struct RecommendationExclusion: Codable, Equatable, Identifiable, Sendable {
    public var key: String
    public var name: String
    public var type: TitleType?
    public var reason: String?
    public var genres: [String]?
    public var posterUrl: String?
    public var provider: String?
    public var providerId: String?
    public var year: Int?
    public var alternateNames: [String]?
    public var originalName: String?
    public var author: String?
    public var isbn10: String?
    public var isbn13: String?
    public var catalogTitle: TitleSearchItem?

    public var id: String { key }

    public init(
        key: String,
        name: String,
        type: TitleType? = nil,
        reason: String? = nil,
        genres: [String]? = nil,
        posterUrl: String? = nil,
        provider: String? = nil,
        providerId: String? = nil,
        year: Int? = nil,
        alternateNames: [String]? = nil,
        originalName: String? = nil,
        author: String? = nil,
        isbn10: String? = nil,
        isbn13: String? = nil,
        catalogTitle: TitleSearchItem? = nil
    ) {
        self.key = key
        self.name = name
        self.type = type
        self.reason = reason
        self.genres = genres
        self.posterUrl = posterUrl
        self.provider = provider
        self.providerId = providerId
        self.year = year
        self.alternateNames = alternateNames
        self.originalName = originalName
        self.author = author
        self.isbn10 = isbn10
        self.isbn13 = isbn13
        self.catalogTitle = catalogTitle
    }
}

public struct RecommendationQuota: Codable, Equatable, Sendable {
    public var date: String
    public var timezone: String
    public var limit: Int
    public var used: Int
    public var remaining: Int
    public var resetsAt: String

    public init(
        date: String = "",
        timezone: String = "Asia/Seoul",
        limit: Int = 3,
        used: Int = 0,
        remaining: Int = 3,
        resetsAt: String = ""
    ) {
        self.date = date
        self.timezone = timezone
        self.limit = limit
        self.used = used
        self.remaining = remaining
        self.resetsAt = resetsAt
    }
}

public struct RecommendationState: Codable, Equatable, Sendable {
    public var items: [RecommendationItem]
    public var exclusions: [RecommendationExclusion]
    public var quota: RecommendationQuota
    public var generatedAt: String?
    public var generationId: String?
    public var generating: Bool
    public var hasBatch: Bool
    public var eligible: Bool

    public init(
        items: [RecommendationItem] = [],
        exclusions: [RecommendationExclusion] = [],
        quota: RecommendationQuota = RecommendationQuota(),
        generatedAt: String? = nil,
        generationId: String? = nil,
        generating: Bool = false,
        hasBatch: Bool = false,
        eligible: Bool = true
    ) {
        self.items = items
        self.exclusions = exclusions
        self.quota = quota
        self.generatedAt = generatedAt
        self.generationId = generationId
        self.generating = generating
        self.hasBatch = hasBatch
        self.eligible = eligible
    }
}

public struct RecommendationGenerateRequest: Codable, Sendable {
    public var requestId: String

    public init(requestId: String) {
        self.requestId = requestId
    }
}

// MARK: - Analytics

public struct AnalyticsSingleEventRequest: Codable, Sendable {
    public var eventId: String
    public var eventName: String
    public var platform: String
    public var sessionId: String
    public var clientVersion: String
    public var occurredAt: String
    public var properties: [String: String]

    public init(
        eventId: String = UUID().uuidString.lowercased(),
        eventName: String,
        platform: String = "ios_native",
        sessionId: String,
        clientVersion: String,
        occurredAt: String,
        properties: [String: String] = [:]
    ) {
        self.eventId = eventId
        self.eventName = eventName
        self.platform = platform
        self.sessionId = sessionId
        self.clientVersion = clientVersion
        self.occurredAt = occurredAt
        self.properties = properties
    }
}

// MARK: - Server Share Card OG Payloads (`apps/web/lib/share.ts` parity)

public struct LogShareCardRequestPayload: Codable, Sendable {
    public var cardType: String = "log"
    public var title: String
    public var titleType: String?
    public var format: String
    public var note: String?
    public var statusLabel: String
    public var ratingLabel: String?
    public var ratingValue: Int?
    public var date: String
    public var posterUrl: String?
    public var showProfileSignature: Bool
    public var profileNickname: String?
    public var profileAvatarUrl: String?
    public var profilePersonaKey: String?
    public var watermark: String = "ottline.app"
    public var theme: String = "default"

    public init(
        cardType: String = "log",
        title: String,
        titleType: String? = nil,
        format: String,
        note: String? = nil,
        statusLabel: String,
        ratingLabel: String? = nil,
        ratingValue: Int? = nil,
        date: String,
        posterUrl: String? = nil,
        showProfileSignature: Bool,
        profileNickname: String? = nil,
        profileAvatarUrl: String? = nil,
        profilePersonaKey: String? = nil,
        watermark: String = "ottline.app",
        theme: String = "default"
    ) {
        self.cardType = cardType
        self.title = title
        self.titleType = titleType
        self.format = format
        self.note = note
        self.statusLabel = statusLabel
        self.ratingLabel = ratingLabel
        self.ratingValue = ratingValue
        self.date = date
        self.posterUrl = posterUrl
        self.showProfileSignature = showProfileSignature
        self.profileNickname = profileNickname
        self.profileAvatarUrl = profileAvatarUrl
        self.profilePersonaKey = profilePersonaKey
        self.watermark = watermark
        self.theme = theme
    }
}

public struct RecapShareCardPosterPayload: Codable, Sendable {
    public var title: String
    public var titleType: String?
    public var posterUrl: String?
    public var count: Int?

    public init(title: String, titleType: String? = nil, posterUrl: String? = nil, count: Int? = nil) {
        self.title = title
        self.titleType = titleType
        self.posterUrl = posterUrl
        self.count = count
    }
}

public struct RecapShareCardStatPayload: Codable, Sendable {
    public var label: String
    public var value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }
}

public struct RecapShareCardRequestPayload: Codable, Sendable {
    public var cardType: String = "recap"
    public var recapKind: String
    public var format: String = "story"
    public var title: String
    public var subtitle: String
    public var periodLabel: String?
    public var posterItems: [RecapShareCardPosterPayload]
    public var stats: [RecapShareCardStatPayload]
    public var footer: String = "ottline.app"
    public var watermark: String = "ottline.app"
    public var theme: String = "default"

    public init(
        cardType: String = "recap",
        recapKind: String,
        format: String = "story",
        title: String,
        subtitle: String,
        periodLabel: String? = nil,
        posterItems: [RecapShareCardPosterPayload],
        stats: [RecapShareCardStatPayload],
        footer: String = "ottline.app",
        watermark: String = "ottline.app",
        theme: String = "default"
    ) {
        self.cardType = cardType
        self.recapKind = recapKind
        self.format = format
        self.title = title
        self.subtitle = subtitle
        self.periodLabel = periodLabel
        self.posterItems = posterItems
        self.stats = stats
        self.footer = footer
        self.watermark = watermark
        self.theme = theme
    }
}

// MARK: - Share Extension Pending Queue Entry

public struct SharedExtensionLogEntry: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var title: Title
    public var status: LogStatus
    public var rating: Double?
    public var note: String?
    public var ott: String?
    public var watchedAt: String
    public var createdAt: String

    public init(
        id: String = UUID().uuidString.lowercased(),
        title: Title,
        status: LogStatus,
        rating: Double? = nil,
        note: String? = nil,
        ott: String? = nil,
        watchedAt: String,
        createdAt: String
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.rating = rating
        self.note = note
        self.ott = ott
        self.watchedAt = watchedAt
        self.createdAt = createdAt
    }
}
