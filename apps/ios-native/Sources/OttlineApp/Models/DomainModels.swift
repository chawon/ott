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
    case google = "GOOGLE"
    case openlibrary = "OPENLIBRARY"
    case local = "LOCAL"

    public static func fromWire(_ raw: String?) -> Provider {
        switch raw?.uppercased() {
        case "TMDB": return .tmdb
        case "NAVER": return .naver
        case "KAKAO": return .kakao
        case "GOOGLE": return .google
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
    case cinemaKeeper = "CINEMA_KEEPER"
    case bookDrifter = "BOOK_DRIFTER"
    case deepWatcher = "DEEP_WATCHER"
    case midnightLogger = "MIDNIGHT_LOGGER"
    case weekendCurator = "WEEKEND_CURATOR"
    case archiveCollector = "ARCHIVE_COLLECTOR"

    public static func fromWire(_ raw: String?) -> PersonaKey? {
        guard let raw, !raw.isEmpty else { return nil }
        return PersonaKey.allCases.first { $0.rawValue.caseInsensitiveCompare(raw) == .orderedSame }
    }
}

public enum FeedbackCategory: String, Codable, CaseIterable, Sendable {
    case bug = "BUG"
    case idea = "IDEA"
    case data = "DATA"
    case other = "OTHER"
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
    case meToo = "ME_TOO"
    case curious = "CURIOUS"
    case bookmark = "BOOKMARK"
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
    public var infoUrl: String?

    public var id: String { "\(provider.rawValue):\(type.rawValue):\(providerId)" }

    public init(
        provider: Provider = .tmdb,
        providerId: String,
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
        infoUrl: String? = nil
    ) {
        self.provider = provider
        self.providerId = providerId
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
        self.infoUrl = infoUrl
    }

    public func toNewTitle(generatedId: String = UUID().uuidString.lowercased()) -> Title {
        Title(
            id: generatedId,
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
    public var hasMore: Bool

    public init(items: [WatchLog] = [], nextCursor: String? = nil, hasMore: Bool = false) {
        self.items = items
        self.nextCursor = nextCursor
        self.hasMore = hasMore
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

public struct DiscussionReactionItem: Codable, Equatable, Sendable {
    public var type: DiscussionReactionType
    public var count: Int
    public var viewerReacted: Bool

    public init(type: DiscussionReactionType, count: Int = 0, viewerReacted: Bool = false) {
        self.type = type
        self.count = count
        self.viewerReacted = viewerReacted
    }
}

public struct DiscussionReactionSummaryResponse: Codable, Equatable, Sendable {
    public var titleId: String
    public var items: [DiscussionReactionItem]

    public init(titleId: String, items: [DiscussionReactionItem] = []) {
        self.titleId = titleId
        self.items = items
    }
}

public struct DiscussionListItem: Codable, Equatable, Identifiable, Sendable {
    public var titleId: String
    public var titleName: String
    public var titleType: TitleType
    public var provider: Provider?
    public var providerId: String?
    public var posterUrl: String?
    public var latestCommentAt: String
    public var commentCount: Int
    public var latestCommentBody: String?
    public var latestAuthorName: String?
    public var isCurated: Bool
    public var reactions: [DiscussionReactionItem]?

    public var id: String { titleId }

    public init(
        titleId: String,
        titleName: String,
        titleType: TitleType = .movie,
        provider: Provider? = nil,
        providerId: String? = nil,
        posterUrl: String? = nil,
        latestCommentAt: String = "",
        commentCount: Int = 0,
        latestCommentBody: String? = nil,
        latestAuthorName: String? = nil,
        isCurated: Bool = false,
        reactions: [DiscussionReactionItem]? = nil
    ) {
        self.titleId = titleId
        self.titleName = titleName
        self.titleType = titleType
        self.provider = provider
        self.providerId = providerId
        self.posterUrl = posterUrl
        self.latestCommentAt = latestCommentAt
        self.commentCount = commentCount
        self.latestCommentBody = latestCommentBody
        self.latestAuthorName = latestAuthorName
        self.isCurated = isCurated
        self.reactions = reactions
    }

    enum CodingKeys: String, CodingKey {
        case titleId, titleName, titleType, provider, providerId, posterUrl
        case latestCommentAt, commentCount, latestCommentBody, latestAuthorName
        case isCurated, reactions
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        titleId = try c.decode(String.self, forKey: .titleId)
        titleName = (try? c.decode(String.self, forKey: .titleName)) ?? ""
        titleType = (try? c.decode(TitleType.self, forKey: .titleType)) ?? .movie
        provider = try? c.decode(Provider.self, forKey: .provider)
        providerId = try? c.decode(String.self, forKey: .providerId)
        posterUrl = try? c.decode(String.self, forKey: .posterUrl)
        latestCommentAt = (try? c.decode(String.self, forKey: .latestCommentAt)) ?? ""
        commentCount = (try? c.decode(Int.self, forKey: .commentCount)) ?? 0
        latestCommentBody = try? c.decode(String.self, forKey: .latestCommentBody)
        latestAuthorName = try? c.decode(String.self, forKey: .latestAuthorName)
        isCurated = (try? c.decode(Bool.self, forKey: .isCurated)) ?? false
        reactions = try? c.decode([DiscussionReactionItem].self, forKey: .reactions)
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
}

public struct CreateCommentRequest: Codable, Sendable {
    public var body: String
    public var authorName: String?
    public var userId: String?
    public var syncToLog: Bool
    public var mentions: [MentionCandidateDto]

    public init(
        body: String,
        authorName: String? = nil,
        userId: String? = nil,
        syncToLog: Bool = true,
        mentions: [MentionCandidateDto] = []
    ) {
        self.body = body
        self.authorName = authorName
        self.userId = userId
        self.syncToLog = syncToLog
        self.mentions = mentions
    }
}

public struct TitleCommentItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var titleId: String
    public var authorName: String
    public var body: String
    public var createdAt: String
    public var mentionedTitles: [MentionedTitleItem]?

    public init(
        id: String,
        titleId: String,
        authorName: String,
        body: String,
        createdAt: String,
        mentionedTitles: [MentionedTitleItem]? = nil
    ) {
        self.id = id
        self.titleId = titleId
        self.authorName = authorName
        self.body = body
        self.createdAt = createdAt
        self.mentionedTitles = mentionedTitles
    }
}

public struct TitleCommentsResponse: Codable, Sendable {
    public var comments: [TitleCommentItem]
    public var totalCount: Int
    public var limit: Int

    public init(comments: [TitleCommentItem] = [], totalCount: Int = 0, limit: Int = 5) {
        self.comments = comments
        self.totalCount = totalCount
        self.limit = limit
    }
}

// MARK: - Auth, Devices, Profile

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
    public var name: String
    public var createdAt: String
    public var lastSeenAt: String
    public var isActive: Bool
}

public struct UserProfileDto: Codable, Equatable, Sendable {
    public var userId: String?
    public var pairingCode: String?
    public var nickname: String?
    public var personaKey: PersonaKey?
}

public struct UpdateProfileRequest: Codable, Sendable {
    public var nickname: String?
    public var personaKey: PersonaKey?

    public init(nickname: String?, personaKey: PersonaKey?) {
        self.nickname = nickname
        self.personaKey = personaKey
    }
}

// MARK: - Sync

public struct SyncTitlePayload: Codable, Sendable {
    public var provider: String
    public var providerId: String
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
}

public struct SyncTitleChange: Codable, Sendable {
    public var id: String
    public var op: String
    public var updatedAt: String
    public var payload: SyncTitlePayload?
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
    public var createdAt: String
}

public struct SyncLogChange: Codable, Sendable {
    public var id: String
    public var op: String
    public var updatedAt: String
    public var payload: SyncLogPayload?
}

public struct SyncPushRequest: Codable, Sendable {
    public var userId: String
    public var deviceId: String
    public var changes: SyncChanges
    public var clientTime: String

    public struct SyncChanges: Codable, Sendable {
        public var titles: [SyncTitleChange]
        public var logs: [SyncLogChange]
    }
}

public struct SyncPushResponse: Codable, Sendable {
    public var accepted: [String]
    public var conflicts: [SyncLogChange]
    public var serverTime: String

    public init(accepted: [String] = [], conflicts: [SyncLogChange] = [], serverTime: String = "") {
        self.accepted = accepted
        self.conflicts = conflicts
        self.serverTime = serverTime
    }
}

public struct SyncPullResponse: Codable, Sendable {
    public var serverChanges: SyncPushRequest.SyncChanges
    public var nextSince: String
}

// MARK: - Personal Report & Recap

public struct SeasonalRecapPoster: Codable, Equatable, Hashable, Sendable {
    public var titleId: String
    public var title: String
    public var posterUrl: String?
    public var type: String
    public var watchedAt: String

    public init(titleId: String, title: String, posterUrl: String? = nil, type: String = "movie", watchedAt: String = "") {
        self.titleId = titleId
        self.title = title
        self.posterUrl = posterUrl
        self.type = type
        self.watchedAt = watchedAt
    }
}

public struct SeasonalRecap: Codable, Equatable, Sendable {
    public var key: String
    public var periodStart: String
    public var periodEnd: String
    public var totalLogs: Int
    public var doneCount: Int
    public var inProgressCount: Int
    public var wishlistCount: Int
    public var activeMonths: Int
    public var topMonth: String
    public var topMonthCount: Int
    public var topType: String
    public var topOtt: String
    public var topPlace: String
    public var topOccasion: String
    public var topGenre: String
    public var topGenreCount: Int
    public var noteFillPct: Int
    public var ratedLogs: Int
    public var avgRating: Double?
    public var posters: [SeasonalRecapPoster]
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
    public var previousWeekLogs: Int
    public var previousWeekPosters: [SeasonalRecapPoster]?
    public var avgRating: Double?
    public var ratedLogs: Int
    public var noteFillPct: Int
    public var topType: String
    public var topOtt: String
    public var topPlace: String
    public var topOccasion: String
    public var monthlyTopGenre: String
    public var monthlyTopGenreCount: Int
    public var streakDays: Int
    public var longestStreakDays: Int
    public var byStatus: [StatusCountMetric]
    public var byType: [TypeCountMetric]
    public var topOtts: [NameCountMetric]
    public var monthlyTrend: [MonthlyTrendPoint]
    public var topGenres: [NameCountMetric]
    public var topDirectors: [NameCountMetric]
    public var topCast: [NameCountMetric]
    public var seasonalRecap: SeasonalRecap?

    public init(
        totalLogs: Int = 0,
        thisMonthLogs: Int = 0,
        previousWeekLogs: Int = 0,
        previousWeekPosters: [SeasonalRecapPoster]? = nil,
        avgRating: Double? = nil,
        ratedLogs: Int = 0,
        noteFillPct: Int = 0,
        topType: String = "-",
        topOtt: String = "-",
        topPlace: String = "-",
        topOccasion: String = "-",
        monthlyTopGenre: String = "-",
        monthlyTopGenreCount: Int = 0,
        streakDays: Int = 0,
        longestStreakDays: Int = 0,
        byStatus: [StatusCountMetric] = [],
        byType: [TypeCountMetric] = [],
        topOtts: [NameCountMetric] = [],
        monthlyTrend: [MonthlyTrendPoint] = [],
        topGenres: [NameCountMetric] = [],
        topDirectors: [NameCountMetric] = [],
        topCast: [NameCountMetric] = [],
        seasonalRecap: SeasonalRecap? = nil
    ) {
        self.totalLogs = totalLogs
        self.thisMonthLogs = thisMonthLogs
        self.previousWeekLogs = previousWeekLogs
        self.previousWeekPosters = previousWeekPosters
        self.avgRating = avgRating
        self.ratedLogs = ratedLogs
        self.noteFillPct = noteFillPct
        self.topType = topType
        self.topOtt = topOtt
        self.topPlace = topPlace
        self.topOccasion = topOccasion
        self.monthlyTopGenre = monthlyTopGenre
        self.monthlyTopGenreCount = monthlyTopGenreCount
        self.streakDays = streakDays
        self.longestStreakDays = longestStreakDays
        self.byStatus = byStatus
        self.byType = byType
        self.topOtts = topOtts
        self.monthlyTrend = monthlyTrend
        self.topGenres = topGenres
        self.topDirectors = topDirectors
        self.topCast = topCast
        self.seasonalRecap = seasonalRecap
    }
}

// MARK: - KDC Bookshelf

public struct BookClassificationItemDto: Codable, Equatable, Sendable {
    public var isbn13: String
    public var status: String
    public var kdcCode: String?
    public var kdcMajor: Int?
    public var source: String?
    public var resolvedAt: String?

    public init(
        isbn13: String,
        status: String,
        kdcCode: String? = nil,
        kdcMajor: Int? = nil,
        source: String? = nil,
        resolvedAt: String? = nil
    ) {
        self.isbn13 = isbn13
        self.status = status
        self.kdcCode = kdcCode
        self.kdcMajor = kdcMajor
        self.source = source
        self.resolvedAt = resolvedAt
    }
}

public struct BookClassificationResolveResponse: Codable, Sendable {
    public var items: [BookClassificationItemDto]
}

// MARK: - Feedback / Inquiry

public struct FeedbackThreadSummary: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var category: FeedbackCategory
    public var subject: String?
    public var status: FeedbackStatus
    public var createdAt: String
    public var updatedAt: String
    public var lastMessagePreview: String?
    public var lastMessageAuthorRole: FeedbackAuthorRole?
    public var messageCount: Int
}

public struct FeedbackMessageItem: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var authorRole: FeedbackAuthorRole
    public var body: String
    public var createdAt: String
}

public struct FeedbackThreadDetail: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var category: FeedbackCategory
    public var subject: String?
    public var status: FeedbackStatus
    public var createdAt: String
    public var updatedAt: String
    public var messages: [FeedbackMessageItem]
}

// MARK: - Next Watch Recommendations ("내 미래는?")

public struct NextWatchRecommendationDto: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var titleId: String?
    public var provider: Provider
    public var providerId: String
    public var type: TitleType
    public var name: String
    public var year: Int?
    public var posterUrl: String?
    public var overview: String?
    public var reason: String
    public var recommendedOtt: String?
}

public struct NextWatchRecommendResponse: Codable, Equatable, Sendable {
    public var enabled: Bool
    public var eligible: Bool
    public var reasonCode: String?
    public var logCount: Int
    public var minRequiredLogs: Int
    public var generatedAt: String?
    public var expiresAt: String?
    public var cached: Bool
    public var items: [NextWatchRecommendationDto]
}

// MARK: - Analytics

public struct AnalyticsEventPayload: Codable, Sendable {
    public var eventName: String
    public var platform: String
    public var clientId: String
    public var userId: String?
    public var sessionId: String
    public var occurredAt: String
    public var properties: [String: String]
}

public struct AnalyticsEventsBatchRequest: Codable, Sendable {
    public var events: [AnalyticsEventPayload]
}
