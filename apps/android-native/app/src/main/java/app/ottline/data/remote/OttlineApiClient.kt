package app.ottline.data.remote

import android.os.Build
import app.ottline.BuildConfig
import app.ottline.data.local.AppPreferences
import app.ottline.model.AuthPairRequest
import app.ottline.model.AuthRegisterResponse
import app.ottline.model.Comment
import app.ottline.model.CreateCommentRequest
import app.ottline.model.CreateDiscussionRequest
import app.ottline.model.CreateFeedbackMessageRequest
import app.ottline.model.CreateFeedbackThreadRequest
import app.ottline.model.CuratedContent
import app.ottline.model.DeviceInfo
import app.ottline.model.Discussion
import app.ottline.model.DiscussionListItem
import app.ottline.model.DiscussionReactionState
import app.ottline.model.DiscussionReactionType
import app.ottline.model.EpisodeOption
import app.ottline.model.FeedbackCategory
import app.ottline.model.FeedbackThreadDetail
import app.ottline.model.FeedbackThreadSummary
import app.ottline.model.PersonalReport
import app.ottline.model.RecommendationItem
import app.ottline.model.ResolveBookClassificationsRequest
import app.ottline.model.ResolveBookClassificationsResponse
import app.ottline.model.SeasonOption
import app.ottline.model.SyncPullResponse
import app.ottline.model.SyncPushRequest
import app.ottline.model.SyncPushResponse
import app.ottline.model.TimelinePageResponse
import app.ottline.model.Title
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.model.TmdbMetadata
import app.ottline.model.ToggleReactionRequest
import app.ottline.model.TrackAnalyticsEventRequest
import app.ottline.model.UpdateUserProfileRequest
import app.ottline.model.UserProfile
import app.ottline.model.WatchLog
import app.ottline.model.WatchLogHistory
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class ApiException(
    val statusCode: Int,
    override val message: String
) : IOException(message)

class OttlineApiClient(
    private val prefs: AppPreferences,
    val httpClient: OkHttpClient = defaultOkHttpClient(),
    var onAuthRevoked: (() -> Unit)? = null
) {
    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
        isLenient = true
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun apiRoot(): String {
        val base = prefs.current.apiBaseUrl.trimEnd('/')
        return if (base.endsWith("/api")) base else "$base/api"
    }

    private fun userAgent(): String {
        val release = Build.VERSION.RELEASE ?: "15"
        val model = Build.MODEL ?: "Android"
        return "Mozilla/5.0 (Linux; Android $release; $model) Chrome/134.0.0.0 Mobile Safari/537.36 ottline-android/${BuildConfig.VERSION_NAME}"
    }

    private fun buildRequest(
        path: String,
        method: String = "GET",
        bodyJson: String? = null,
        includeAuth: Boolean = false,
        extraHeaders: Map<String, String> = emptyMap()
    ): Request {
        val normalizedPath = if (path.startsWith("/")) path else "/$path"
        val fullUrl = "${apiRoot()}$normalizedPath"
        val snap = prefs.current
        val builder = Request.Builder()
            .url(fullUrl)
            .header("Accept", "application/json")
            .header("Accept-Language", snap.locale)
            .header("X-Book-Search-Capability", "google_books_v1")
            .header("User-Agent", userAgent())

        val host = fullUrl.toHttpUrlOrNull()?.host.orEmpty()
        if (host.contains("ngrok", ignoreCase = true)) {
            builder.header("ngrok-skip-browser-warning", "true")
        }

        if (includeAuth) {
            snap.userId?.let { builder.header("X-User-Id", it) }
            snap.deviceId?.let { builder.header("X-Device-Id", it) }
        }

        for ((k, v) in extraHeaders) {
            builder.header(k, v)
        }

        val reqBody = when {
            bodyJson != null -> bodyJson.toRequestBody(jsonMediaType)
            method == "POST" || method == "PUT" || method == "PATCH" -> "{}".toRequestBody(jsonMediaType)
            else -> null
        }

        builder.method(method, reqBody)
        return builder.build()
    }

    private suspend inline fun <reified T> executeJson(
        path: String,
        method: String = "GET",
        bodyJson: String? = null,
        includeAuth: Boolean = false,
        extraHeaders: Map<String, String> = emptyMap()
    ): T = withContext(Dispatchers.IO) {
        val hadAuth = includeAuth && !prefs.current.userId.isNullOrBlank() && !prefs.current.deviceId.isNullOrBlank()
        val request = buildRequest(path, method, bodyJson, includeAuth, extraHeaders)
        httpClient.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                if (hadAuth && response.code == 401) {
                    onAuthRevoked?.invoke()
                }
                val parsedMessage = runCatching {
                    val obj = json.parseToJsonElement(raw).jsonObject
                    obj["message"]?.jsonPrimitive?.content
                        ?: obj["error"]?.jsonPrimitive?.content
                }.getOrNull()
                throw ApiException(
                    statusCode = response.code,
                    message = parsedMessage?.takeIf { it.isNotBlank() } ?: "HTTP ${response.code}"
                )
            }
            if (T::class == Unit::class) {
                return@withContext Unit as T
            }
            json.decodeFromString<T>(raw)
        }
    }

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    // --- Auth & Profile ---

    suspend fun register(): AuthRegisterResponse =
        executeJson("/auth/register", method = "POST", bodyJson = "{}")

    suspend fun pair(code: String, oldUserId: String?): AuthRegisterResponse =
        executeJson(
            "/auth/pair",
            method = "POST",
            bodyJson = json.encodeToString(AuthPairRequest(code = code.trim(), oldUserId = oldUserId))
        )

    suspend fun getDevices(): List<DeviceInfo> =
        executeJson("/auth/devices", includeAuth = true)

    suspend fun unlinkDevice(deviceId: String) {
        executeJson<Unit>("/auth/devices/${enc(deviceId)}", method = "DELETE", includeAuth = true)
    }

    suspend fun unlinkAllDevices() {
        executeJson<Unit>("/auth/devices/all", method = "DELETE", includeAuth = true)
    }

    suspend fun deleteAccount() {
        executeJson<Unit>("/auth/account", method = "DELETE", includeAuth = true)
    }

    suspend fun getProfile(): UserProfile =
        executeJson("/auth/profile", includeAuth = true)

    suspend fun updateProfile(req: UpdateUserProfileRequest): UserProfile =
        executeJson(
            "/auth/profile",
            method = "PATCH",
            bodyJson = json.encodeToString(req),
            includeAuth = true
        )

    // --- Sync ---

    suspend fun pushSync(req: SyncPushRequest): SyncPushResponse =
        executeJson(
            "/sync/push",
            method = "POST",
            bodyJson = json.encodeToString(req),
            includeAuth = true
        )

    suspend fun pullSync(since: String?): SyncPullResponse {
        val q = if (!since.isNullOrBlank()) "?since=${enc(since)}" else ""
        return executeJson("/sync/pull$q", includeAuth = true)
    }

    // --- Catalog & Search ---

    suspend fun searchTitles(query: String, typeFilter: String? = null): List<TitleSearchItem> {
        val wireType = when (typeFilter?.lowercase()) {
            "movie" -> "&type=movie"
            "series", "tv" -> "&type=tv"
            "book" -> "&type=book"
            else -> ""
        }
        return executeJson("/titles/search?q=${enc(query.trim())}$wireType")
    }

    suspend fun getPopularTitles(limit: Int = 12): List<TitleSearchItem> =
        executeJson("/titles/popular?limit=$limit")

    suspend fun getTitle(id: String): Title =
        executeJson("/titles/${enc(id)}")

    suspend fun getTmdbMetadata(type: TitleType, providerId: String): TmdbMetadata {
        val segment = if (type == TitleType.SERIES) "series" else "movie"
        return executeJson("/tmdb/$segment/${enc(providerId)}")
    }

    suspend fun getTvSeasons(providerId: String): List<SeasonOption> =
        executeJson("/tmdb/tv/${enc(providerId)}/seasons")

    suspend fun getTvEpisodes(providerId: String, seasonNumber: Int): List<EpisodeOption> =
        executeJson("/tmdb/tv/${enc(providerId)}/seasons/$seasonNumber")

    suspend fun resolveBookClassifications(isbn13s: List<String>): ResolveBookClassificationsResponse =
        executeJson(
            "/titles/book-classifications/resolve",
            method = "POST",
            bodyJson = json.encodeToString(ResolveBookClassificationsRequest(isbn13s))
        )

    // --- Logs & History ---

    suspend fun getLogsPage(
        limit: Int = 50,
        cursor: String? = null,
        contentType: String? = null,
        status: String? = null,
        origin: String? = null,
        ott: String? = null,
        place: String? = null,
        occasion: String? = null,
        query: String? = null
    ): TimelinePageResponse {
        val params = buildList {
            add("limit=$limit")
            add("sort=history")
            if (!cursor.isNullOrBlank()) add("cursor=${enc(cursor)}")
            if (!contentType.isNullOrBlank() && contentType != "ALL") add("contentType=${enc(contentType.lowercase())}")
            if (!status.isNullOrBlank() && status != "ALL") add("status=${enc(status)}")
            if (!origin.isNullOrBlank() && origin != "ALL") add("origin=${enc(origin)}")
            if (!ott.isNullOrBlank()) add("ott=${enc(ott)}")
            if (!place.isNullOrBlank()) add("place=${enc(place)}")
            if (!occasion.isNullOrBlank()) add("occasion=${enc(occasion)}")
            if (!query.isNullOrBlank()) add("q=${enc(query)}")
        }.joinToString("&")
        return executeJson("/logs/page?$params", includeAuth = true)
    }

    suspend fun getLogsByTitle(titleId: String, limit: Int = 1): List<WatchLog> =
        executeJson("/logs?titleId=${enc(titleId)}&limit=$limit", includeAuth = true)

    suspend fun getLogHistory(logId: String, limit: Int = 50): List<WatchLogHistory> =
        executeJson("/logs/${enc(logId)}/history?limit=$limit", includeAuth = true)

    // --- Share URL metadata resolver (direct HTML OG title extraction for opaque share links) ---

    suspend fun resolveSharedUrlTitle(url: String): String? = withContext(Dispatchers.IO) {
        runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent())
                .header("Accept-Language", prefs.current.locale)
                .build()
            httpClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@use null
                val html = resp.body?.string()?.take(65_536) ?: return@use null
                val ogMatch = Regex(
                    """<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']""",
                    RegexOption.IGNORE_CASE
                ).find(html) ?: Regex(
                    """<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']""",
                    RegexOption.IGNORE_CASE
                ).find(html)
                val titleMatch = ogMatch ?: Regex(
                    """<title[^>]*>([^<]+)</title>""",
                    RegexOption.IGNORE_CASE
                ).find(html)
                titleMatch?.groupValues?.getOrNull(1)
                    ?.replace("&amp;", "&")
                    ?.replace("&quot;", "\"")
                    ?.replace("&#39;", "'")
                    ?.trim()
            }
        }.getOrNull()
    }

    // --- Discussions & Together ---

    suspend fun getDiscussionsAll(limit: Int = 100): List<DiscussionListItem> =
        executeJson("/discussions/all?limit=$limit")

    suspend fun getDiscussionsLatest(limit: Int = 6, days: Int = 14): List<DiscussionListItem> =
        executeJson("/discussions/latest?limit=$limit&days=$days")

    suspend fun getDiscussionById(discussionId: String): DiscussionListItem =
        executeJson("/discussions/${enc(discussionId)}")

    suspend fun getDiscussionByTitle(titleId: String): Discussion? =
        runCatching {
            executeJson<Discussion>("/discussions?titleId=${enc(titleId)}")
        }.getOrNull()

    suspend fun createDiscussion(titleId: String): Discussion =
        executeJson(
            "/discussions",
            method = "POST",
            bodyJson = json.encodeToString(CreateDiscussionRequest(titleId)),
            includeAuth = true
        )

    suspend fun getComments(discussionId: String, limit: Int = 200): List<Comment> =
        executeJson("/discussions/${enc(discussionId)}/comments?limit=$limit")

    suspend fun createComment(discussionId: String, req: CreateCommentRequest): Comment =
        executeJson(
            "/discussions/${enc(discussionId)}/comments",
            method = "POST",
            bodyJson = json.encodeToString(req),
            includeAuth = true
        )

    suspend fun getMyReactions(discussionId: String): DiscussionReactionState =
        executeJson("/discussions/${enc(discussionId)}/reactions/me", includeAuth = true)

    suspend fun toggleReaction(discussionId: String, type: DiscussionReactionType): DiscussionReactionState =
        executeJson(
            "/discussions/${enc(discussionId)}/reactions",
            method = "PUT",
            bodyJson = json.encodeToString(ToggleReactionRequest(type)),
            includeAuth = true
        )

    suspend fun getCuratedContents(limit: Int = 6): List<CuratedContent> =
        runCatching {
            executeJson<List<CuratedContent>>("/curated-contents?limit=$limit")
        }.getOrDefault(emptyList())

    // --- Recommendations, Report, Feedback, Analytics ---

    suspend fun getRecommendations(refresh: Boolean, excluded: Set<String>): List<RecommendationItem> {
        val params = buildList {
            if (refresh) add("refresh=true")
            excluded.forEach { add("excluded=${enc(it)}") }
        }.joinToString("&")
        val suffix = if (params.isNotEmpty()) "?$params" else ""
        return executeJson("/recommendations$suffix", includeAuth = true)
    }

    suspend fun getMyReport(): PersonalReport =
        executeJson("/nalytic/me/report", includeAuth = true)

    suspend fun getFeedbackThreads(): List<FeedbackThreadSummary> =
        executeJson("/feedback/threads", includeAuth = true)

    suspend fun createFeedbackThread(
        category: FeedbackCategory,
        subject: String?,
        body: String
    ): FeedbackThreadDetail =
        executeJson(
            "/feedback/threads",
            method = "POST",
            bodyJson = json.encodeToString(
                CreateFeedbackThreadRequest(
                    category = category,
                    subject = subject?.trim()?.takeIf { it.isNotEmpty() },
                    body = body.trim()
                )
            ),
            includeAuth = true
        )

    suspend fun getFeedbackThreadDetail(threadId: String): FeedbackThreadDetail =
        executeJson("/feedback/threads/${enc(threadId)}", includeAuth = true)

    suspend fun sendFeedbackMessage(threadId: String, body: String): FeedbackThreadDetail =
        executeJson(
            "/feedback/threads/${enc(threadId)}/messages",
            method = "POST",
            bodyJson = json.encodeToString(CreateFeedbackMessageRequest(body.trim())),
            includeAuth = true
        )

    suspend fun trackAnalyticsEvent(req: TrackAnalyticsEventRequest): Boolean {
        return runCatching {
            val extra = mutableMapOf("X-Client-Id" to prefs.analyticsClientId)
            prefs.current.userId?.takeIf { it.isNotBlank() }?.let { extra["X-User-Id"] = it }
            executeJson<Unit>(
                "/nalytic/events",
                method = "POST",
                bodyJson = json.encodeToString(req),
                includeAuth = false,
                extraHeaders = extra
            )
            true
        }.getOrDefault(false)
    }

    suspend fun pingHealth(): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val req = buildRequest("/discussions/all?limit=1")
            httpClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) throw IOException("HTTP ${resp.code}")
                "HTTP ${resp.code} (${prefs.current.apiBaseUrl})"
            }
        }
    }

    companion object {
        fun defaultOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }
}
