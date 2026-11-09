package app.ottline

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.room.Room
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.SQLiteDriver
import androidx.sqlite.SQLiteStatement
import androidx.test.core.app.ApplicationProvider
import app.ottline.data.OttlineRepository
import app.ottline.data.SyncStatus
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.OttlineDatabase
import app.ottline.data.remote.OttlineApiClient
import app.ottline.domain.RecordDate
import app.ottline.model.LogDraft
import app.ottline.model.LogStatus
import app.ottline.model.PersonalReport
import app.ottline.model.Place
import app.ottline.model.Provider
import app.ottline.model.SeasonalRecap
import app.ottline.model.SeasonalRecapPoster
import app.ottline.model.Title
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.util.CardExporter
import app.ottline.ui.util.RecapCardKind
import java.sql.DriverManager
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Types
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.ConscryptMode
import org.robolectric.shadows.ShadowNetworkCapabilities

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class)
@ConscryptMode(ConscryptMode.Mode.OFF)
class OttlineSyncAndApiTest {

    private lateinit var server: MockWebServer
    private lateinit var db: OttlineDatabase
    private lateinit var prefs: AppPreferences
    private lateinit var api: OttlineApiClient
    private lateinit var repository: OttlineRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse =
                MockResponse().setResponseCode(404)
        }
        server.start()

        val context = ApplicationProvider.getApplicationContext<Context>()
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = ShadowNetworkCapabilities.newInstance()
        shadowOf(caps).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        shadowOf(cm).setNetworkCapabilities(cm.activeNetwork, caps)

        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("ottline.revisit_reminder", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("ottline.android_install_token", Context.MODE_PRIVATE).edit().clear().commit()

        val baseUrl = server.url("/").toString().trimEnd('/')
        RevisitReminderApiClient.apiBaseUrlOverride = baseUrl
        RevisitReminderApiClient.httpClientOverride = null

        db = Room.inMemoryDatabaseBuilder(context, OttlineDatabase::class.java)
            .setDriver(JdbcSqliteDriver())
            .allowMainThreadQueries()
            .build()
        prefs = AppPreferences(context)
        prefs.setDebugApiBaseUrl(baseUrl)
        api = OttlineApiClient(prefs)
        repository = OttlineRepository(
            appContext = context,
            db = db,
            prefs = prefs,
            api = api,
            scheduleBackgroundSync = {}
        )
    }

    @After
    fun tearDown() {
        runBlocking { repository.awaitAnalyticsIdleForTest() }
        api.httpClient.connectionPool.evictAll()
        RevisitReminderApiClient.apiBaseUrlOverride = null
        RevisitReminderApiClient.httpClientOverride = null
        db.close()
        server.shutdown()
    }

    @Test
    fun localFirstSave_coalescesOutbox_registersLazy_andRemapsCanonicalIdsOnPull() = runBlocking {
        // 1. First-visit rule: no userId before first log save
        assertNull(prefs.current.userId)
        val idleSync = repository.syncOutbox()
        assertEquals(SyncStatus.IDLE, idleSync.status)
        assertEquals(0, server.requestCount)

        var pushCount = 0
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/register" -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"userId":"u-canon","deviceId":"d-canon","pairingCode":"PAIR-9999"}""")

                    path == "/api/sync/push" -> {
                        pushCount++
                        assertTrue(request.getHeader("User-Agent").orEmpty().contains("Android"))
                        assertEquals("google_books_v1", request.getHeader("X-Book-Search-Capability"))
                        MockResponse()
                            .setResponseCode(200)
                            .setBody("""{"accepted":["ok"],"rejected":[]}""")
                    }

                    path.startsWith("/api/sync/pull") -> MockResponse()
                        .setResponseCode(200)
                        .setBody(
                            """
                            {
                              "serverTime": "2026-11-05T09:00:00Z",
                              "changes": {
                                "titles": [
                                  {
                                    "id": "canonical-title-777",
                                    "type": "movie",
                                    "name": "이터널 선샤인",
                                    "year": 2004,
                                    "provider": "TMDB",
                                    "providerId": "38"
                                  }
                                ],
                                "logs": [
                                  {
                                    "id": "canonical-log-888",
                                    "titleId": "canonical-title-777",
                                    "status": "DONE",
                                    "rating": 5.0,
                                    "note": "겨울 바다 장면",
                                    "place": "HOME",
                                    "watchedAt": "2026-11-05T12:00:00+09:00",
                                    "createdAt": "2026-11-05T12:00:00+09:00",
                                    "updatedAt": "2026-11-05T12:01:00+09:00"
                                  }
                                ]
                              }
                            }
                            """.trimIndent()
                        )

                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        // 2. Save with temporary local UUID, then sync
        val tempTitle = Title(
            id = "temp-local-title-1",
            type = TitleType.MOVIE,
            name = "이터널 선샤인",
            year = 2004,
            provider = Provider.TMDB,
            providerId = "38"
        )
        val syncedLog = repository.saveLogForTitle(
            rawTitle = tempTitle,
            draft = LogDraft(
                status = LogStatus.DONE,
                rating = 5.0,
                note = "겨울 바다 장면",
                place = Place.HOME,
                watchedAt = RecordDate.nowIso()
            ),
            awaitSync = true
        )

        // 3. Verify lazy registration + canonical ID remapping + zero duplicate logs!
        assertEquals("u-canon", prefs.current.userId)
        assertEquals("PAIR-9999", prefs.current.pairingCode)
        assertEquals(1, pushCount)
        assertEquals("canonical-title-777", syncedLog.title.id)
        assertEquals("canonical-log-888", syncedLog.id)

        val activeLogs = repository.activeLogsFlow.first()
        assertEquals(1, activeLogs.size)
        assertEquals("canonical-title-777", activeLogs.first().title.id)
        assertEquals("synced", activeLogs.first().syncStatus)
        assertNull(db.titleDao().getById("temp-local-title-1"))
    }

    @Test
    fun concurrentSaveDuringInFlightPush_preservesNewerRevisionAndRePushes() = runBlocking {
        prefs.saveAuth("u-race", "d-race", "PAIR-RACE")

        val firstPushArrived = CountDownLatch(1)
        val allowFirstPushResponse = CountDownLatch(1)
        val pushBodies = CopyOnWriteArrayList<String>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/sync/push" -> {
                        val body = request.body.readUtf8()
                        val idx = pushBodies.size
                        pushBodies.add(body)
                        if (idx == 0) {
                            firstPushArrived.countDown()
                            allowFirstPushResponse.await(5, TimeUnit.SECONDS)
                        }
                        MockResponse()
                            .setResponseCode(200)
                            .setBody("""{"accepted":["ok"],"rejected":[]}""")
                    }
                    path.startsWith("/api/sync/pull") -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"serverTime":"2026-11-05T10:05:00Z","changes":{"logs":[],"titles":[]}}""")
                    path == "/api/nalytic/events" -> MockResponse().setResponseCode(202)
                    path.startsWith("/api/android/") -> MockResponse().setResponseCode(200).setBody("{}")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val movieTitle = Title(
            id = "title-race-1",
            type = TitleType.MOVIE,
            name = "추락의 해부",
            year = 2023,
            provider = Provider.TMDB,
            providerId = "915935"
        )

        // 1. Initial quick status save (revision 1)
        repository.saveLogForTitle(
            rawTitle = movieTitle,
            draft = LogDraft(
                status = LogStatus.IN_PROGRESS,
                note = "1차 초안 메모",
                watchedAt = "2026-11-05T10:00:00+09:00"
            ),
            awaitSync = false
        )

        // 2. Start sync push #1 in background and pause inside MockWebServer
        val syncDeferred = async(Dispatchers.IO) { repository.syncOutbox() }
        assertTrue(firstPushArrived.await(5, TimeUnit.SECONDS))

        // 3. User edits and saves a richer note while push #1 is in flight (increments outbox revision -> 2)
        repository.saveLogForTitle(
            rawTitle = movieTitle,
            draft = LogDraft(
                status = LogStatus.DONE,
                rating = 5.0,
                note = "다듬은 최종 문장",
                place = Place.THEATER,
                watchedAt = "2026-11-05T10:00:00+09:00"
            ),
            awaitSync = false
        )

        // 4. Let push #1 finish; repository must detect revision mismatch and immediately run push #2
        allowFirstPushResponse.countDown()
        val syncResult = syncDeferred.await()

        assertEquals(SyncStatus.IDLE, syncResult.status)
        assertEquals(2, pushBodies.size)
        assertTrue(pushBodies[0].contains("1차 초안 메모"))
        assertTrue(pushBodies[1].contains("다듬은 최종 문장"))
        assertTrue(db.outboxDao().getAll().isEmpty())

        val finalLogs = repository.activeLogsFlow.first()
        assertEquals(1, finalLogs.size)
        assertEquals(LogStatus.DONE, finalLogs.first().status)
        assertEquals("다듬은 최종 문장", finalLogs.first().note)
        assertEquals("synced", finalLogs.first().syncStatus)
    }

    @Test
    fun offlinePendingEdit_isNeverOverwrittenByServerPageOrPullRemap() = runBlocking {
        prefs.saveAuth("u-f02", "d-f02", "PAIR-F02")

        val localTempTitle = Title(
            id = "local-temp-title-999",
            type = TitleType.MOVIE,
            name = "패스트 라이브즈",
            year = 2023,
            provider = Provider.TMDB,
            providerId = "666277"
        )
        repository.saveLogForTitle(
            rawTitle = localTempTitle,
            draft = LogDraft(
                status = LogStatus.DONE,
                rating = 5.0,
                note = "오프라인에서 다듬은 소중한 문장",
                watchedAt = "2026-11-05T11:00:00+09:00"
            ),
            awaitSync = false
        )

        // 1. Paginated server response arrives with older server note & canonical IDs
        val serverTitle = localTempTitle.copy(id = "canon-title-666277")
        repository.upsertLogsFromServerPage(
            listOf(
                WatchLog(
                    id = "canon-log-666277",
                    title = serverTitle,
                    status = LogStatus.IN_PROGRESS,
                    rating = 3.0,
                    note = "서버에 남아있던 예전 문장",
                    updatedAt = "2099-01-01T00:00:00Z",
                    watchedAt = "2026-11-01T11:00:00+09:00",
                    createdAt = "2026-11-01T11:00:00+09:00"
                )
            )
        )

        val afterPageLogs = repository.activeLogsFlow.first()
        assertEquals(1, afterPageLogs.size)
        assertEquals("오프라인에서 다듬은 소중한 문장", afterPageLogs.first().note)
        assertEquals(LogStatus.DONE, afterPageLogs.first().status)
        assertEquals("pending", afterPageLogs.first().syncStatus)

        // 2. Push fails transiently (503) while pull returns canonical IDs with stale note;
        //    pull must remap IDs (both log & outbox) WITHOUT clobbering the pending local note!
        var failPush = true
        val acceptedPushPayloads = CopyOnWriteArrayList<String>()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/sync/push" -> {
                        if (failPush) {
                            MockResponse().setResponseCode(503).setBody("""{"message":"busy"}""")
                        } else {
                            acceptedPushPayloads.add(request.body.readUtf8())
                            MockResponse().setResponseCode(200).setBody("""{"accepted":["canon-log-666277"],"rejected":[]}""")
                        }
                    }
                    path.startsWith("/api/sync/pull") -> MockResponse()
                        .setResponseCode(200)
                        .setBody(
                            """
                            {
                              "serverTime": "2026-11-05T11:10:00Z",
                              "changes": {
                                "titles": [
                                  {
                                    "id": "canon-title-666277",
                                    "type": "movie",
                                    "name": "패스트 라이브즈",
                                    "year": 2023,
                                    "provider": "TMDB",
                                    "providerId": "666277"
                                  }
                                ],
                                "logs": [
                                  {
                                    "id": "canon-log-666277",
                                    "titleId": "canon-title-666277",
                                    "status": "IN_PROGRESS",
                                    "rating": 3.0,
                                    "note": "서버에 남아있던 예전 문장",
                                    "watchedAt": "2026-11-01T11:00:00+09:00",
                                    "createdAt": "2026-11-01T11:00:00+09:00",
                                    "updatedAt": "2026-11-05T11:09:00+09:00"
                                  }
                                ]
                              }
                            }
                            """.trimIndent()
                        )
                    path == "/api/nalytic/events" -> MockResponse().setResponseCode(202)
                    path.startsWith("/api/android/") -> MockResponse().setResponseCode(200).setBody("{}")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val failedSync = repository.syncOutbox()
        assertEquals(SyncStatus.FAILED, failedSync.status)

        val afterFailedSyncLogs = repository.activeLogsFlow.first()
        assertEquals(1, afterFailedSyncLogs.size)
        assertEquals("canon-log-666277", afterFailedSyncLogs.first().id)
        assertEquals("canon-title-666277", afterFailedSyncLogs.first().title.id)
        assertEquals("오프라인에서 다듬은 소중한 문장", afterFailedSyncLogs.first().note)
        assertEquals(LogStatus.DONE, afterFailedSyncLogs.first().status)

        // 3. Now server recovers; outbox pushes remapped canonical IDs with preserved local note
        failPush = false
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/sync/push" -> {
                        acceptedPushPayloads.add(request.body.readUtf8())
                        MockResponse().setResponseCode(200).setBody("""{"accepted":["canon-log-666277"],"rejected":[]}""")
                    }
                    path.startsWith("/api/sync/pull") -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"serverTime":"2026-11-05T11:15:00Z","changes":{"logs":[],"titles":[]}}""")
                    path == "/api/nalytic/events" -> MockResponse().setResponseCode(202)
                    path.startsWith("/api/android/") -> MockResponse().setResponseCode(200).setBody("{}")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val recoveredSync = repository.syncOutbox()
        assertEquals(SyncStatus.IDLE, recoveredSync.status)
        assertEquals(1, acceptedPushPayloads.size)
        assertTrue(acceptedPushPayloads[0].contains("canon-log-666277"))
        assertTrue(acceptedPushPayloads[0].contains("canon-title-666277"))
        assertTrue(acceptedPushPayloads[0].contains("오프라인에서 다듬은 소중한 문장"))
        assertEquals("synced", repository.activeLogsFlow.first().first().syncStatus)
    }

    @Test
    fun revisitReminderDeviceBindAndPatchPreferences_matchServerContractAndTrackSyncErrors() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val capturedRequests = CopyOnWriteArrayList<Triple<String, String, Map<String, String>>>()
        val patchAttempts = AtomicInteger(0)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val method = request.method.orEmpty()
                val path = request.path.orEmpty()
                val headers = mapOf(
                    "X-User-Id" to request.getHeader("X-User-Id").orEmpty(),
                    "X-Device-Id" to request.getHeader("X-Device-Id").orEmpty()
                )
                capturedRequests.add(Triple(method, path, headers))
                return when {
                    method == "POST" && path == "/api/android/notification-devices/bind" ->
                        MockResponse().setResponseCode(200).setBody("{}")
                    method == "PATCH" && path == "/api/android/notification-devices/preferences" -> {
                        if (patchAttempts.incrementAndGet() == 1) {
                            MockResponse().setResponseCode(500).setBody("""{"message":"temporary failure"}""")
                        } else {
                            MockResponse().setResponseCode(200).setBody("{}")
                        }
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val bound = RevisitReminderScheduler.bindDeviceIfAuthenticated(
            context = context,
            force = true,
            explicitUserId = "u-revisit-1",
            explicitDeviceId = "d-revisit-1"
        )
        assertTrue(bound)
        assertEquals("POST", capturedRequests[0].first)
        assertEquals("/api/android/notification-devices/bind", capturedRequests[0].second)
        assertEquals("u-revisit-1", capturedRequests[0].third["X-User-Id"])
        assertEquals("d-revisit-1", capturedRequests[0].third["X-Device-Id"])

        // First preference update fails with 500 -> pendingSync=true & lastSyncError populated
        val failedPref = RevisitReminderScheduler.setEnabledAwait(context, enabled = false)
        assertTrue(failedPref.isFailure)
        assertTrue(RevisitReminderScheduler.uiState.value.pendingSync)
        assertNotNull(RevisitReminderScheduler.uiState.value.lastSyncError)
        assertTrue(capturedRequests.any { it.first == "PATCH" && it.second == "/api/android/notification-devices/preferences" })

        // Retry flushes via PATCH -> pendingSync=false & lastSyncError cleared
        val flushed = RevisitReminderScheduler.flushPendingPreferenceIfNeeded(context)
        assertTrue(flushed)
        assertFalse(RevisitReminderScheduler.uiState.value.pendingSync)
        assertNull(RevisitReminderScheduler.uiState.value.lastSyncError)
    }

    @Test
    fun recapStoryCardRenderer_produces1080x1920BitmapWithAndWithoutPosters() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val emptyPosterReport = PersonalReport(
            totalLogs = 3,
            thisMonthLogs = 2,
            previousWeekLogs = 1,
            doneRatePct = 66.7,
            streakDays = 2,
            longestStreakDays = 4,
            previousWeekPosters = emptyList()
        )
        val weeklyBmp = CardExporter.renderRecapCardBitmap(
            context = context,
            kind = RecapCardKind.WEEKLY,
            report = emptyPosterReport,
            nickname = "은하",
            locale = "ko"
        )
        assertEquals(1080, weeklyBmp.width)
        assertEquals(1920, weeklyBmp.height)

        val h1Posters = (1..4).map { idx ->
            SeasonalRecapPoster(
                titleId = "t-$idx",
                title = "작품 $idx",
                titleType = if (idx % 2 == 0) "book" else "movie",
                posterUrl = null
            )
        }
        val h1Report = emptyPosterReport.copy(
            seasonalRecap = SeasonalRecap(
                key = "2026-H1",
                totalLogs = 12,
                topType = "book",
                topPlace = "CAFE",
                topOccasion = "ALONE",
                doneRatePct = 83.3,
                posters = h1Posters
            )
        )
        val h1Bmp = CardExporter.renderRecapCardBitmap(
            context = context,
            kind = RecapCardKind.HALF_YEAR,
            report = h1Report,
            monthPosters = h1Posters,
            nickname = "은하",
            locale = "en"
        )
        assertEquals(1080, h1Bmp.width)
        assertEquals(1920, h1Bmp.height)
    }

    @Test
    fun analyticsFunnelEvents_honorPlatformConstraintClientHeaderAndDeduplication() = runBlocking {
        data class CapturedAnalytics(val clientIdHeader: String, val userIdHeader: String?, val bodyJson: String)
        val analyticsEvents = CopyOnWriteArrayList<CapturedAnalytics>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/nalytic/events" -> {
                        analyticsEvents.add(
                            CapturedAnalytics(
                                clientIdHeader = request.getHeader("X-Client-Id").orEmpty(),
                                userIdHeader = request.getHeader("X-User-Id"),
                                bodyJson = request.body.readUtf8()
                            )
                        )
                        MockResponse().setResponseCode(202)
                    }
                    path == "/api/auth/pair" -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"userId":"u-paired","deviceId":"d-paired","pairingCode":"PAIR-7777"}""")
                    path == "/api/users/me/profile" -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"userId":"u-paired","nickname":"여행자"}""")
                    path == "/api/sync/push" -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"accepted":["ok"],"rejected":[]}""")
                    path.startsWith("/api/sync/pull") -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"serverTime":"2026-11-05T12:00:00Z","changes":{"logs":[],"titles":[]}}""")
                    path.startsWith("/api/android/") -> MockResponse().setResponseCode(200).setBody("{}")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        // 1. app_open deduplicated within session
        repository.trackAppOpenOnce("launcher")
        repository.trackAppOpenOnce("launcher")

        // 2. Search & select funnel
        val title1 = Title(id = "t-funnel-1", type = TitleType.MOVIE, name = "비포 선라이즈", provider = Provider.TMDB, providerId = "76")
        val title2 = Title(id = "t-funnel-2", type = TitleType.BOOK, name = "흰", provider = Provider.KAKAO, providerId = "9788954651134")
        repository.trackTitleSearch(queryLength = 6, resultCount = 4, category = "movie")
        repository.trackTitleSelect(title1, source = "quick_record")

        // 3. First log create -> emits both first_log_create and log_create
        repository.saveLogForTitle(
            rawTitle = title1,
            draft = LogDraft(status = LogStatus.DONE, watchedAt = "2026-11-05T12:00:00+09:00"),
            awaitSync = false
        )
        // Updating existing title1 log -> emits 0 create events
        repository.saveLogForTitle(
            rawTitle = title1,
            draft = LogDraft(status = LogStatus.DONE, note = "다시 다듬기", watchedAt = "2026-11-05T12:00:00+09:00"),
            awaitSync = false
        )
        // Second distinct title -> emits only log_create
        repository.saveLogForTitle(
            rawTitle = title2,
            draft = LogDraft(status = LogStatus.IN_PROGRESS, watchedAt = "2026-11-05T12:05:00+09:00"),
            awaitSync = false
        )

        // 4. Pairing -> emits login_success
        repository.pairWithCode("PAIR-7777")
        repository.awaitAnalyticsIdleForTest()

        val parsed = Json.let { parser ->
            analyticsEvents.map { ev ->
                assertTrue("X-Client-Id header must be present", ev.clientIdHeader.isNotBlank())
                val root = parser.parseToJsonElement(ev.bodyJson).jsonObject
                assertEquals("twa", root["platform"]?.jsonPrimitive?.content)
                val props = root["properties"]?.jsonObject
                assertEquals("native", props?.get("androidRuntime")?.jsonPrimitive?.content)
                root["eventName"]?.jsonPrimitive?.content.orEmpty()
            }
        }

        assertEquals(1, parsed.count { it == "app_open" })
        assertEquals(1, parsed.count { it == "title_search" })
        assertEquals(1, parsed.count { it == "title_select" })
        assertEquals(1, parsed.count { it == "first_log_create" })
        assertEquals(2, parsed.count { it == "log_create" })
        assertEquals(1, parsed.count { it == "login_success" })
    }
}

/**
 * Multi-architecture (including Windows ARM64) JDBC-backed SQLiteDriver for Room 2.7 JVM tests.
 */
private class JdbcSqliteDriver : SQLiteDriver {
    override fun open(fileName: String): SQLiteConnection {
        Class.forName("org.sqlite.JDBC")
        val url = if (fileName == ":memory:" || fileName.isBlank()) {
            "jdbc:sqlite::memory:"
        } else {
            "jdbc:sqlite:$fileName"
        }
        val conn = DriverManager.getConnection(url)
        conn.autoCommit = true
        return JdbcSqliteConnection(conn)
    }
}

private class JdbcSqliteConnection(
    private val conn: java.sql.Connection
) : SQLiteConnection {
    override fun prepare(sql: String): SQLiteStatement = JdbcSqliteStatement(conn, sql)
    override fun close() = conn.close()
}

private class JdbcSqliteStatement(
    private val conn: java.sql.Connection,
    private val sql: String
) : SQLiteStatement {
    private val ps: PreparedStatement = conn.prepareStatement(sql)
    private var rs: ResultSet? = null
    private var executed = false

    override fun bindBlob(index: Int, value: ByteArray) = ps.setBytes(index, value)
    override fun bindDouble(index: Int, value: Double) = ps.setDouble(index, value)
    override fun bindLong(index: Int, value: Long) = ps.setLong(index, value)
    override fun bindText(index: Int, value: String) = ps.setString(index, value)
    override fun bindNull(index: Int) = ps.setNull(index, Types.NULL)
    override fun clearBindings() = ps.clearParameters()

    override fun step(): Boolean {
        if (!executed) {
            executed = true
            val trimmed = sql.trimStart().uppercase()
            if (trimmed.startsWith("BEGIN")) {
                conn.autoCommit = false
                return false
            } else if (trimmed.startsWith("COMMIT") || trimmed.startsWith("END")) {
                if (!conn.autoCommit) {
                    conn.commit()
                    conn.autoCommit = true
                }
                return false
            } else if (trimmed.startsWith("ROLLBACK")) {
                if (!conn.autoCommit) {
                    conn.rollback()
                    conn.autoCommit = true
                }
                return false
            }
            val hasResultSet = ps.execute()
            if (hasResultSet) {
                rs = ps.resultSet
            } else {
                return false
            }
        }
        return rs?.next() ?: false
    }

    private fun requireRs(): ResultSet = rs ?: error("No active ResultSet for SQL: $sql")

    override fun getBlob(index: Int): ByteArray = requireRs().getBytes(index + 1) ?: ByteArray(0)
    override fun getDouble(index: Int): Double = requireRs().getDouble(index + 1)
    override fun getLong(index: Int): Long = requireRs().getLong(index + 1)
    override fun getText(index: Int): String = requireRs().getString(index + 1) ?: ""
    override fun isNull(index: Int): Boolean {
        val r = requireRs()
        return r.getObject(index + 1) == null
    }

    override fun getColumnCount(): Int = rs?.metaData?.columnCount ?: ps.metaData?.columnCount ?: 0
    override fun getColumnName(index: Int): String =
        (rs?.metaData ?: ps.metaData)?.getColumnLabel(index + 1) ?: ""

    override fun getColumnType(index: Int): Int {
        val value = rs?.getObject(index + 1) ?: return 5
        return when (value) {
            is ByteArray -> 4
            is Float, is Double -> 2
            is Number, is Boolean -> 1
            else -> 3
        }
    }

    override fun reset() {
        rs?.close()
        rs = null
        executed = false
    }

    override fun close() {
        rs?.close()
        ps.close()
    }
}
