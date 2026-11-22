package app.ottline

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import app.ottline.data.OttlineRepository
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.AutoHandoffDecision
import app.ottline.data.local.BrowserHandoffPolicy
import app.ottline.data.local.BrowserHandoffState
import app.ottline.data.local.OttlineDatabase
import app.ottline.data.local.TwaBrowserBridge
import app.ottline.data.remote.OttlineApiClient
import app.ottline.domain.RecordDate
import app.ottline.model.LogDraft
import app.ottline.model.LogStatus
import app.ottline.model.PersonaKey
import app.ottline.model.Place
import app.ottline.model.Provider
import app.ottline.model.Title
import app.ottline.model.TitleType
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
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

/**
 * Reproduces and verifies Android Web/TWA handoff failure, return-without-callback (e.g. Cloudflare 522
 * or user cancellation), empty browser session, cold restart, cross-account merge preservation, and
 * manual retry recovery (Issue #149).
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class)
@ConscryptMode(ConscryptMode.Mode.OFF)
class HandoffRecoveryTest {

    private lateinit var context: Context
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

        context = ApplicationProvider.getApplicationContext()
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = ShadowNetworkCapabilities.newInstance()
        shadowOf(caps).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        shadowOf(cm).setNetworkCapabilities(cm.activeNetwork, caps)

        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("ottline.revisit_reminder", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("ottline.android_install", Context.MODE_PRIVATE).edit().clear().commit()

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
    fun browserLaunchFailure_marksAttemptedAndLaunchFailed_withoutMarkingCompletedOrLooping() {
        prefs.markInstallReferrerChecked("utm_source=ottline_web&web_handoff=1")

        val launched = TwaBrowserBridge.launchManagedHandoff(
            context = context,
            prefs = prefs,
            isAutomatic = true,
            nowMillis = 1_000L,
            launcher = { _, _, _ -> false }
        )

        assertFalse(launched)
        assertTrue(prefs.current.twaAutoHandoffAttempted)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        assertEquals(BrowserHandoffState.LAUNCH_FAILED, prefs.current.browserHandoffState)

        // Next start must NOT enter an auto-relaunch loop
        assertEquals(
            AutoHandoffDecision.NONE,
            BrowserHandoffPolicy.decideAutoHandoffOnStart(
                prefs = prefs.current,
                hasPendingHandoffCallback = false,
                hasTwaFootprint = false,
                referrerWebHandoff = true
            )
        )

        // Home retry card remains visible so user can manually retry or enter code
        assertTrue(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = prefs.current,
                activeLogCount = 0,
                hasTwaFootprint = false
            )
        )
    }

    @Test
    fun cloudflare522OrUserCancel_resumeWithoutCallback_marksIncompleteReturnAndKeepsHomeRetryCard() {
        // Fresh Play install arriving from mobile web CTA (`web_handoff=1`, NO TWA footprint)
        prefs.markInstallReferrerChecked("utm_source=ottline_web&utm_campaign=quicklog_saved&web_handoff=1")

        assertEquals(
            AutoHandoffDecision.LAUNCH_REFERRER_BROWSER,
            BrowserHandoffPolicy.decideAutoHandoffOnStart(
                prefs = prefs.current,
                hasPendingHandoffCallback = false,
                hasTwaFootprint = false,
                referrerWebHandoff = true
            )
        )

        val launched = TwaBrowserBridge.launchManagedHandoff(
            context = context,
            prefs = prefs,
            isAutomatic = true,
            nowMillis = 2_000L,
            launcher = { _, _, _ -> true }
        )
        assertTrue(launched)
        assertTrue(prefs.current.twaAutoHandoffAttempted)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        assertEquals(BrowserHandoffState.PENDING, prefs.current.browserHandoffState)

        // User sees Cloudflare 522 in Chrome and presses Back -> app resumes without handoff callback
        assertTrue(
            BrowserHandoffPolicy.shouldMarkIncompleteOnResume(
                prefs = prefs.current,
                sawPauseWhilePending = true,
                hasPendingHandoffCallback = false
            )
        )
        prefs.markBrowserHandoffIncompleteReturn()

        assertEquals(BrowserHandoffState.INCOMPLETE_RETURN, prefs.current.browserHandoffState)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        assertEquals(0L, prefs.current.browserHandoffPendingSinceMillis)

        // Next app start must NOT loop Chrome automatically
        assertEquals(
            AutoHandoffDecision.NONE,
            BrowserHandoffPolicy.decideAutoHandoffOnStart(
                prefs = prefs.current,
                hasPendingHandoffCallback = false,
                hasTwaFootprint = false,
                referrerWebHandoff = true
            )
        )

        // Home retry card IS shown even when hasTwaFootprint == false!
        assertTrue(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = prefs.current,
                activeLogCount = 0,
                hasTwaFootprint = false
            )
        )
    }

    @Test
    fun coldRestartWhilePending_transitionsToIncompleteReturnWithoutAutoRelaunch() {
        TwaBrowserBridge.launchManagedHandoff(
            context = context,
            prefs = prefs,
            isAutomatic = true,
            nowMillis = 3_000L,
            launcher = { _, _, _ -> true }
        )
        assertEquals(BrowserHandoffState.PENDING, prefs.current.browserHandoffState)

        // Simulate app killed while Chrome was open and restarted cold without callback
        val freshPrefs = AppPreferences(context)
        assertEquals(
            AutoHandoffDecision.MARK_INCOMPLETE_RETURN,
            BrowserHandoffPolicy.decideAutoHandoffOnStart(
                prefs = freshPrefs.current,
                hasPendingHandoffCallback = false,
                hasTwaFootprint = true,
                referrerWebHandoff = false
            )
        )
        freshPrefs.markBrowserHandoffIncompleteReturn()
        assertEquals(BrowserHandoffState.INCOMPLETE_RETURN, freshPrefs.current.browserHandoffState)
        assertFalse(freshPrefs.current.twaBrowserHandoffCompleted)
        assertTrue(freshPrefs.current.twaAutoHandoffAttempted)
    }

    @Test
    fun okCallbackArrivingBeforeResume_doesNotTriggerFalseIncompleteReturn() {
        TwaBrowserBridge.launchManagedHandoff(
            context = context,
            prefs = prefs,
            isAutomatic = true,
            nowMillis = 4_000L,
            launcher = { _, _, _ -> true }
        )
        // onNewIntent delivers CompleteTwaHandoff before ON_RESUME runs
        assertFalse(
            BrowserHandoffPolicy.shouldMarkIncompleteOnResume(
                prefs = prefs.current,
                sawPauseWhilePending = true,
                hasPendingHandoffCallback = true
            )
        )
    }

    @Test
    fun emptyBrowserSessionCallback_marksEmptySessionWithoutCompletedAndPreservesRetry() = runBlocking {
        TwaBrowserBridge.launchManagedHandoff(
            context = context,
            prefs = prefs,
            isAutomatic = true,
            launcher = { _, _, _ -> true }
        )

        val outcome = repository.completeTwaHandoffWithOutcome(
            status = "empty",
            userId = null,
            deviceId = null,
            pairingCode = null,
            nickname = null,
            personaKey = null
        )

        assertEquals(OttlineRepository.HandoffOutcome.EMPTY_SESSION, outcome)
        assertEquals(BrowserHandoffState.EMPTY_SESSION, prefs.current.browserHandoffState)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        assertTrue(prefs.current.twaAutoHandoffAttempted)
        assertNull(prefs.current.userId)
        assertTrue(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = prefs.current,
                activeLogCount = 0,
                hasTwaFootprint = false
            )
        )
    }

    @Test
    fun invalidOrMalformedCallback_marksFailedWithoutCompletedOrMutatingExistingAuth() = runBlocking {
        prefs.saveAuth("u-existing", "d-existing", "CODE-EXIST")

        val outcome = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web",
            deviceId = "", // malformed missing deviceId
            pairingCode = "CODE-WEB",
            nickname = null,
            personaKey = null
        )

        assertEquals(OttlineRepository.HandoffOutcome.INVALID_CALLBACK, outcome)
        assertEquals(BrowserHandoffState.FAILED, prefs.current.browserHandoffState)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        // Existing credentials stay untouched
        assertEquals("u-existing", prefs.current.userId)
        assertEquals("d-existing", prefs.current.deviceId)
    }

    @Test
    fun legacyUpgradeFrom205_withCompletedPrefTrue_neverTriggersAutoRelaunchLoop() {
        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("watchlog.twaBrowserHandoffCompleted", true)
            .commit()

        val upgradedPrefs = AppPreferences(context)
        assertTrue(upgradedPrefs.current.twaAutoHandoffAttempted)
        assertTrue(upgradedPrefs.current.twaBrowserHandoffCompleted)
        assertEquals(
            AutoHandoffDecision.NONE,
            BrowserHandoffPolicy.decideAutoHandoffOnStart(
                prefs = upgradedPrefs.current,
                hasPendingHandoffCallback = false,
                hasTwaFootprint = true,
                referrerWebHandoff = true
            )
        )
    }

    @Test
    fun offlineLocalRoomAndOutboxLogs_preservedAndMergedIntoWebAccountOnRetryOkCallback() = runBlocking {
        // 1. First auto-launch hits 522 -> INCOMPLETE_RETURN
        TwaBrowserBridge.launchManagedHandoff(
            context = context,
            prefs = prefs,
            isAutomatic = true,
            launcher = { _, _, _ -> true }
        )
        prefs.markBrowserHandoffIncompleteReturn()

        // 2. While unconnected, user records a title offline (saved to Room + Outbox, no userId yet)
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        shadowOf(cm).setNetworkCapabilities(cm.activeNetwork, null)
        val localTitle = Title(
            id = "local-offline-title-1",
            type = TitleType.MOVIE,
            name = "패스트 라이브즈",
            year = 2023,
            provider = Provider.TMDB,
            providerId = "666277"
        )
        repository.saveLogForTitle(
            rawTitle = localTitle,
            draft = LogDraft(
                status = LogStatus.DONE,
                rating = 4.5,
                note = "오프라인 기록",
                place = Place.HOME,
                watchedAt = RecordDate.nowIso()
            ),
            awaitSync = false
        )
        assertNull(prefs.current.userId)
        assertEquals(1, db.watchLogDao().getActiveLogs().size)
        assertEquals(1, db.outboxDao().getAll().size)

        // 3. Network returns; user triggers manual retry -> Chrome redirects ok callback for web account
        val caps = ShadowNetworkCapabilities.newInstance()
        shadowOf(caps).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        shadowOf(cm).setNetworkCapabilities(cm.activeNetwork, caps)

        val pushUserHeaders = CopyOnWriteArrayList<String>()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" -> MockResponse()
                        .setResponseCode(200)
                        .setBody("""{"userId":"u-web","nickname":"웹기록가","personaKey":"cinema_keeper","pairingCode":"WEB-7777"}""")
                    path == "/api/sync/push" -> {
                        pushUserHeaders.add(request.getHeader("X-User-Id").orEmpty())
                        MockResponse().setResponseCode(200).setBody("""{"accepted":["ok"],"rejected":[]}""")
                    }
                    path.startsWith("/api/sync/pull") -> MockResponse()
                        .setResponseCode(200)
                        .setBody(
                            """
                            {
                              "serverTime": "2026-11-22T04:10:00Z",
                              "changes": {
                                "titles": [
                                  {"id":"t-web-1","type":"movie","name":"헤어질 결심","year":2022,"provider":"TMDB","providerId":"705996"},
                                  {"id":"t-canon-local","type":"movie","name":"패스트 라이브즈","year":2023,"provider":"TMDB","providerId":"666277"}
                                ],
                                "logs": [
                                  {"id":"l-web-1","titleId":"t-web-1","status":"DONE","note":"웹에서 남긴 기록","watchedAt":"2026-11-20T10:00:00Z","createdAt":"2026-11-20T10:00:00Z","updatedAt":"2026-11-20T10:00:00Z"},
                                  {"id":"l-canon-local","titleId":"t-canon-local","status":"DONE","note":"오프라인 기록","watchedAt":"2026-11-22T04:05:00Z","createdAt":"2026-11-22T04:05:00Z","updatedAt":"2026-11-22T04:05:00Z"}
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

        assertTrue(
            TwaBrowserBridge.launchManagedHandoff(
                context = context,
                prefs = prefs,
                isAutomatic = false,
                launcher = { _, _, _ -> true }
            )
        )
        assertEquals(BrowserHandoffState.PENDING, prefs.current.browserHandoffState)

        val outcome = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web",
            deviceId = "d-web",
            pairingCode = "WEB-7777",
            nickname = "웹기록가",
            personaKey = PersonaKey.CINEMA_KEEPER
        )

        assertEquals(OttlineRepository.HandoffOutcome.CONNECTED, outcome)
        assertEquals(BrowserHandoffState.COMPLETED, prefs.current.browserHandoffState)
        assertTrue(prefs.current.twaBrowserHandoffCompleted)
        assertTrue(prefs.current.twaMigrationBannerDismissed)
        assertEquals("u-web", prefs.current.userId)
        assertEquals(listOf("u-web"), pushUserHeaders)

        val activeLogs = repository.activeLogsFlow.first()
        assertEquals(2, activeLogs.size)
        assertTrue(activeLogs.any { it.title.name == "헤어질 결심" })
        assertTrue(activeLogs.any { it.title.name == "패스트 라이브즈" })
        assertEquals(0, db.outboxDao().getAll().size)
        assertFalse(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = prefs.current,
                activeLogCount = activeLogs.size,
                hasTwaFootprint = true
            )
        )
    }

    @Test
    fun crossAccountMergeFailure_preservesExistingAccountRoomLogsAndOutboxForRetry() = runBlocking {
        prefs.saveAuth("u-native-temp", "d-native-temp", "NAT-1111")

        // Server fails /api/auth/pair (e.g., 502 / transient outage)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/pair" -> MockResponse().setResponseCode(502).setBody("""{"error":"upstream"}""")
                    path == "/api/sync/push" -> MockResponse().setResponseCode(502)
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val nativeTitle = Title(
            id = "t-native-1",
            type = TitleType.BOOK,
            name = "소년이 온다",
            year = 2014,
            provider = Provider.LOCAL,
            providerId = null
        )
        repository.saveLogForTitle(
            rawTitle = nativeTitle,
            draft = LogDraft(status = LogStatus.DONE, note = "보존되어야 할 기록", watchedAt = RecordDate.nowIso()),
            awaitSync = false
        )

        val failedOutcome = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-target",
            deviceId = "d-web-target",
            pairingCode = "WEB-8888",
            nickname = "웹계정",
            personaKey = null
        )

        // MUST fail safely without overwriting u-native-temp or losing Room/Outbox
        assertEquals(OttlineRepository.HandoffOutcome.MERGE_FAILED, failedOutcome)
        assertEquals(BrowserHandoffState.FAILED, prefs.current.browserHandoffState)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        assertEquals("u-native-temp", prefs.current.userId)
        assertEquals("d-native-temp", prefs.current.deviceId)
        assertEquals(1, db.watchLogDao().getActiveLogs().size)
        assertEquals(1, db.outboxDao().getAll().size)

        // Now server recovers and user retries handoff (even if callback omitted pairingCode!)
        val pairBodies = CopyOnWriteArrayList<String>()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" && request.getHeader("X-User-Id") == "u-web-target" ->
                        MockResponse().setResponseCode(200)
                            .setBody("""{"userId":"u-web-target","nickname":"웹계정","pairingCode":"WEB-8888"}""")
                    path == "/api/auth/pair" -> {
                        pairBodies.add(request.body.readUtf8())
                        MockResponse().setResponseCode(200)
                            .setBody("""{"userId":"u-web-target","deviceId":"d-merged","pairingCode":"WEB-8888"}""")
                    }
                    path == "/api/sync/push" -> MockResponse().setResponseCode(200)
                        .setBody("""{"accepted":["ok"],"rejected":[]}""")
                    path.startsWith("/api/sync/pull") -> MockResponse().setResponseCode(200)
                        .setBody(
                            """
                            {
                              "serverTime": "2026-11-22T04:15:00Z",
                              "changes": {
                                "titles": [
                                  {"id":"t-web-merged","type":"movie","name":"오펜하이머","year":2023,"provider":"TMDB","providerId":"872585"}
                                ],
                                "logs": [
                                  {"id":"l-web-merged","titleId":"t-web-merged","status":"DONE","note":"웹 기록","watchedAt":"2026-11-18T10:00:00Z","createdAt":"2026-11-18T10:00:00Z","updatedAt":"2026-11-18T10:00:00Z"}
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

        val retryOutcome = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-target",
            deviceId = "d-web-target",
            pairingCode = null, // resolved via getProfileForCredentials without mutating prefs
            nickname = "웹계정",
            personaKey = null
        )

        assertEquals(OttlineRepository.HandoffOutcome.CONNECTED, retryOutcome)
        assertEquals(BrowserHandoffState.COMPLETED, prefs.current.browserHandoffState)
        assertTrue(prefs.current.twaBrowserHandoffCompleted)
        assertEquals("u-web-target", prefs.current.userId)
        assertEquals(1, pairBodies.size)
        assertTrue(pairBodies.first().contains("WEB-8888"))
        assertTrue(pairBodies.first().contains("u-native-temp"))
        val logsAfterMerge = repository.activeLogsFlow.first()
        assertNotNull(logsAfterMerge.find { it.title.name == "오펜하이머" })
        assertNotNull(logsAfterMerge.find { it.title.name == "소년이 온다" })
    }
}
