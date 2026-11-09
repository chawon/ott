package app.ottline.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
enum class LogStatus {
    DONE,
    IN_PROGRESS,
    WISHLIST
}

@Serializable
enum class TitleType {
    @SerialName("movie") MOVIE,
    @SerialName("series") SERIES,
    @SerialName("book") BOOK;

    val wireValue: String
        get() = when (this) {
            MOVIE -> "movie"
            SERIES -> "series"
            BOOK -> "book"
        }

    companion object {
        fun fromWire(raw: String?): TitleType = when (raw?.lowercase()) {
            "series", "tv" -> SERIES
            "book" -> BOOK
            else -> MOVIE
        }
    }
}

@Serializable
enum class Provider {
    TMDB,
    LOCAL,
    NAVER,
    KAKAO,
    GOOGLE_BOOKS;

    companion object {
        fun fromWire(raw: String?): Provider? = entries.firstOrNull {
            it.name.equals(raw, ignoreCase = true)
        }
    }
}

@Serializable
enum class Place {
    HOME,
    THEATER,
    TRANSIT,
    CAFE,
    OFFICE,
    LIBRARY,
    BOOKSTORE,
    SCHOOL,
    PARK,
    OUTDOOR,
    ETC;

    companion object {
        fun fromWire(raw: String?): Place? = entries.firstOrNull {
            it.name.equals(raw, ignoreCase = true)
        }
    }
}

@Serializable
enum class Occasion {
    ALONE,
    DATE,
    FAMILY,
    FRIENDS,
    BREAK,
    ETC;

    companion object {
        fun fromWire(raw: String?): Occasion? = entries.firstOrNull {
            it.name.equals(raw, ignoreCase = true)
        }
    }
}

@Serializable
enum class PersonaKey {
    @SerialName("cinema_keeper") CINEMA_KEEPER,
    @SerialName("book_drifter") BOOK_DRIFTER,
    @SerialName("deep_watcher") DEEP_WATCHER,
    @SerialName("midnight_logger") MIDNIGHT_LOGGER,
    @SerialName("weekend_curator") WEEKEND_CURATOR,
    @SerialName("archive_collector") ARCHIVE_COLLECTOR;

    val wireValue: String
        get() = name.lowercase()

    companion object {
        fun fromWire(raw: String?): PersonaKey? = entries.firstOrNull {
            it.wireValue.equals(raw, ignoreCase = true)
        }
    }
}

@Serializable
enum class DiscussionReactionType {
    DONE,
    CURIOUS,
    SAVE
}

@Serializable
enum class FeedbackCategory {
    QUESTION,
    BUG,
    IDEA,
    OTHER
}

@Serializable
enum class FeedbackStatus {
    OPEN,
    ANSWERED,
    CLOSED
}

@Serializable
enum class FeedbackAuthorRole {
    USER,
    ADMIN
}

@Serializable
data class Title(
    val id: String,
    val type: TitleType = TitleType.MOVIE,
    val name: String,
    val year: Int? = null,
    val genres: List<String>? = null,
    val directors: List<String>? = null,
    val cast: List<String>? = null,
    val overview: String? = null,
    val posterUrl: String? = null,
    val author: String? = null,
    val publisher: String? = null,
    val isbn10: String? = null,
    val isbn13: String? = null,
    val pubdate: String? = null,
    val provider: Provider? = null,
    val providerId: String? = null,
    val updatedAt: String? = null,
    val deletedAt: String? = null
)

@Serializable
data class TitleSearchItem(
    val sourceUrl: String? = null,
    val provider: Provider = Provider.TMDB,
    val providerId: String,
    val titleId: String? = null,
    val type: TitleType = TitleType.MOVIE,
    val name: String,
    val year: Int? = null,
    val posterUrl: String? = null,
    val overview: String? = null,
    val author: String? = null,
    val publisher: String? = null,
    val isbn10: String? = null,
    val isbn13: String? = null,
    val pubdate: String? = null,
    val genres: List<String>? = null,
    val directors: List<String>? = null,
    val cast: List<String>? = null
) {
    fun toTitle(resolvedId: String): Title = Title(
        id = resolvedId,
        type = type,
        name = name,
        year = year,
        genres = genres,
        directors = directors,
        cast = cast,
        overview = overview,
        posterUrl = posterUrl,
        author = author,
        publisher = publisher,
        isbn10 = isbn10,
        isbn13 = isbn13,
        pubdate = pubdate,
        provider = provider,
        providerId = providerId
    )
}

@Serializable
data class WatchLog(
    val id: String,
    val title: Title,
    val status: LogStatus = LogStatus.DONE,
    val rating: Double? = null,
    val note: String? = null,
    val spoiler: Boolean = false,
    val ott: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val origin: String? = "LOG",
    val syncStatus: String? = "synced",
    val updatedAt: String? = null,
    val deletedAt: String? = null,
    val watchedAt: String,
    val place: Place? = null,
    val occasion: Occasion? = null,
    val createdAt: String
)

@Serializable
data class WatchLogHistory(
    val id: String,
    val logId: String,
    val recordedAt: String,
    val status: LogStatus = LogStatus.DONE,
    val rating: Double? = null,
    val note: String? = null,
    val spoiler: Boolean = false,
    val ott: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val origin: String? = "LOG",
    val watchedAt: String,
    val place: Place? = null,
    val occasion: Occasion? = null
)

@Serializable
data class SeasonOption(
    val seasonNumber: Int,
    val name: String = "",
    val episodeCount: Int? = null,
    val posterUrl: String? = null,
    val year: Int? = null
)

@Serializable
data class EpisodeOption(
    val episodeNumber: Int,
    val name: String = ""
)

@Serializable
data class TmdbMetadata(
    val genres: List<String>? = null,
    val directors: List<String>? = null,
    val cast: List<String>? = null,
    val overview: String? = null
)

@Serializable
data class AuthRegisterResponse(
    val userId: String,
    val deviceId: String,
    val pairingCode: String? = null
)

@Serializable
data class AuthPairRequest(
    val code: String,
    val oldUserId: String? = null
)

@Serializable
data class DeviceInfo(
    val id: String,
    val browser: String? = null,
    val os: String? = null,
    val createdAt: String,
    val lastSeenAt: String? = null
)

@Serializable
data class UserProfile(
    val userId: String,
    val nickname: String? = null,
    val personaKey: PersonaKey? = null,
    val profileUpdatedAt: String? = null,
    val pairingCode: String? = null
)

@Serializable
data class UpdateUserProfileRequest(
    val nickname: String,
    val personaKey: PersonaKey
)

@Serializable
data class SyncLogUpsertPayload(
    val titleId: String,
    val status: LogStatus,
    val rating: Double? = null,
    val note: String? = null,
    val ott: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val origin: String = "LOG",
    val spoiler: Boolean = false,
    val watchedAt: String,
    val place: Place? = null,
    val occasion: Occasion? = null
)

@Serializable
data class SyncLogChange(
    val id: String,
    val op: String, // "upsert" | "delete"
    val updatedAt: String,
    val deletedAt: String? = null,
    val payload: SyncLogUpsertPayload? = null
)

@Serializable
data class SyncTitleUpsertPayload(
    val type: TitleType,
    val name: String,
    val year: Int? = null,
    val genres: List<String>? = null,
    val directors: List<String>? = null,
    val cast: List<String>? = null,
    val overview: String? = null,
    val posterUrl: String? = null,
    val author: String? = null,
    val publisher: String? = null,
    val isbn10: String? = null,
    val isbn13: String? = null,
    val pubdate: String? = null,
    val provider: Provider? = null,
    val providerId: String? = null
)

@Serializable
data class SyncTitleChange(
    val id: String,
    val op: String = "upsert",
    val updatedAt: String,
    val payload: SyncTitleUpsertPayload
)

@Serializable
data class SyncChangesPayload(
    val logs: List<SyncLogChange> = emptyList(),
    val titles: List<SyncTitleChange> = emptyList()
)

@Serializable
data class SyncPushRequest(
    val userId: String,
    val deviceId: String,
    val clientTime: String,
    val changes: SyncChangesPayload
)

@Serializable
data class SyncRejectedItem(
    val id: String,
    val reason: String = ""
)

@Serializable
data class SyncPushResponse(
    val accepted: List<String> = emptyList(),
    val rejected: List<SyncRejectedItem> = emptyList()
)

@Serializable
data class SyncPullLogItem(
    val id: String,
    val titleId: String = "",
    val status: LogStatus = LogStatus.DONE,
    val rating: Double? = null,
    val note: String? = null,
    val spoiler: Boolean = false,
    val ott: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val origin: String? = "LOG",
    val watchedAt: String = "",
    val place: Place? = null,
    val occasion: Occasion? = null,
    val createdAt: String = "",
    val updatedAt: String? = null,
    val deletedAt: String? = null
)

@Serializable
data class SyncPullChanges(
    val logs: List<SyncPullLogItem> = emptyList(),
    val titles: List<Title> = emptyList()
)

@Serializable
data class SyncPullResponse(
    val serverTime: String = "",
    val changes: SyncPullChanges = SyncPullChanges()
)

@Serializable
data class TimelinePageResponse(
    val items: List<WatchLog> = emptyList(),
    val nextCursor: String? = null
)

@Serializable
data class BookClassification(
    val isbn13: String,
    val status: String, // "RESOLVED" | "NOT_FOUND"
    val kdcCode: String? = null,
    val kdcMajor: Int? = null,
    val fetchedAt: String = ""
)

@Serializable
data class ResolveBookClassificationsRequest(
    val isbn13s: List<String>
)

@Serializable
data class ResolveBookClassificationsResponse(
    val items: List<BookClassification> = emptyList()
)

@Serializable
data class DiscussionReactionSummary(
    val done: Int = 0,
    val curious: Int = 0,
    val save: Int = 0
)

@Serializable
data class DiscussionReactionState(
    val summary: DiscussionReactionSummary = DiscussionReactionSummary(),
    val selectedTypes: List<DiscussionReactionType> = emptyList(),
    val selected: Boolean = false
)

@Serializable
data class ToggleReactionRequest(
    val type: DiscussionReactionType
)

@Serializable
data class DiscussionListItem(
    val id: String,
    val titleId: String,
    val titleProvider: Provider? = null,
    val titleProviderId: String? = null,
    val titleName: String,
    val titleType: TitleType = TitleType.MOVIE,
    val titleYear: Int? = null,
    val posterUrl: String? = null,
    val commentCount: Int = 0,
    val createdAt: String = "",
    val reactionSummary: DiscussionReactionSummary? = null
)

@Serializable
data class Discussion(
    val id: String,
    val titleId: String,
    val commentSeq: Int = 0,
    val createdAt: String = "",
    val reactionSummary: DiscussionReactionSummary? = null
)

@Serializable
data class CreateDiscussionRequest(
    val titleId: String
)

@Serializable
data class MentionRef(
    val provider: Provider,
    val providerId: String,
    val titleType: TitleType,
    val name: String
)

@Serializable
data class Comment(
    val id: String,
    val discussionId: String,
    val userId: String? = null,
    val authorName: String = "",
    val body: String,
    val createdAt: String = ""
)

@Serializable
data class CreateCommentRequest(
    val body: String,
    val mentions: List<MentionRef> = emptyList(),
    val syncLog: Boolean = false
)

@Serializable
data class CuratedContent(
    val id: String,
    val titleId: String,
    val titleName: String,
    val titleType: TitleType = TitleType.MOVIE,
    val titleYear: Int? = null,
    val posterUrl: String? = null,
    val kind: String = "",
    val body: String,
    val actorKey: String = "",
    val actorType: String = "AI_CURATOR",
    val actorDisplayName: String = "",
    val disclosure: String = "",
    val publishedAt: String = ""
)

@Serializable
data class RecommendationItem(
    val name: String,
    val type: TitleType = TitleType.MOVIE,
    val reason: String = "",
    val genres: List<String> = emptyList(),
    val posterUrl: String? = null
)

@Serializable
data class FeedbackMessage(
    val id: String,
    val authorRole: FeedbackAuthorRole = FeedbackAuthorRole.USER,
    val body: String,
    val createdAt: String = ""
)

@Serializable
data class FeedbackThreadSummary(
    val id: String,
    val userId: String = "",
    val category: FeedbackCategory = FeedbackCategory.OTHER,
    val status: FeedbackStatus = FeedbackStatus.OPEN,
    val subject: String? = null,
    val messageCount: Int = 0,
    val lastMessagePreview: String? = null,
    val lastAuthorRole: FeedbackAuthorRole? = null,
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class FeedbackThreadDetail(
    val id: String,
    val userId: String = "",
    val category: FeedbackCategory = FeedbackCategory.OTHER,
    val status: FeedbackStatus = FeedbackStatus.OPEN,
    val subject: String? = null,
    val createdAt: String = "",
    val updatedAt: String = "",
    val messages: List<FeedbackMessage> = emptyList()
)

@Serializable
data class CreateFeedbackThreadRequest(
    val category: FeedbackCategory,
    val subject: String? = null,
    val body: String
)

@Serializable
data class CreateFeedbackMessageRequest(
    val body: String
)

@Serializable
data class SeasonalRecapPoster(
    val titleId: String,
    val title: String,
    val titleType: String = "movie",
    val posterUrl: String? = null,
    val count: Int = 1,
    val lastLoggedAt: String? = null
)

@Serializable
data class SeasonalRecap(
    val key: String = "2026-H1",
    val startDate: String = "",
    val endDate: String = "",
    val totalLogs: Int = 0,
    val topType: String = "-",
    val topPlace: String = "-",
    val topOccasion: String = "-",
    val doneRatePct: Double = 0.0,
    val noteFillPct: Double = 0.0,
    val posters: List<SeasonalRecapPoster> = emptyList()
)

@Serializable
data class PersonalReport(
    val totalLogs: Int = 0,
    val thisMonthLogs: Int = 0,
    val doneRatePct: Double = 0.0,
    val ratingFillPct: Double = 0.0,
    val noteFillPct: Double = 0.0,
    val topType: String = "-",
    val topPlace: String = "-",
    val topOccasion: String = "-",
    val streakDays: Int = 0,
    val longestStreakDays: Int = 0,
    val lastLoggedAt: String? = null,
    val previousWeekLogs: Int = 0,
    val previousWeekPosters: List<SeasonalRecapPoster>? = null,
    val monthlyTopGenre: String = "-",
    val monthlyTopGenreCount: Int = 0,
    val daysSinceLastLog: Int = 0,
    val continueSeriesTitleId: String? = null,
    val continueSeriesTitle: String? = null,
    val continueSeriesSeasonNumber: Int? = null,
    val continueSeriesEpisodeNumber: Int? = null,
    val seasonalRecap: SeasonalRecap? = null
)

@Serializable
data class TrackAnalyticsEventRequest(
    val eventName: String,
    val sessionId: String,
    val platform: String = "twa",
    val clientVersion: String,
    val locale: String,
    val occurredAt: String,
    val properties: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ShareResolveResponse(
    val title: String? = null,
    val platform: String? = null,
    val contentType: String? = null
)

data class LogDraft(
    val status: LogStatus,
    val rating: Double? = null,
    val note: String? = null,
    val ott: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val watchedAt: String,
    val place: Place? = null,
    val occasion: Occasion? = null,
    val origin: String = "LOG",
    val spoiler: Boolean = false
)
