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
import java.sql.SQLException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
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
    private lateinit var driver: FaultInjectingSqliteDriver
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

        driver = FaultInjectingSqliteDriver(JdbcSqliteDriver())
        db = Room.inMemoryDatabaseBuilder(context, OttlineDatabase::class.java)
            .setDriver(driver)
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
    fun legacyUpgradeFrom205_withCompletedPrefTrue_suppressesAutoLoopButPreservesManualRetryWhenUnverified() {
        // 1. Legacy 2.0.5 user whose browser handoff was interrupted (e.g. Cloudflare 522):
        //    old code wrote watchlog.twaBrowserHandoffCompleted = true BEFORE opening Chrome.
        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("watchlog.twaBrowserHandoffCompleted", true)
            .commit()

        val interruptedUpgrade = AppPreferences(context)
        assertTrue(interruptedUpgrade.current.twaAutoHandoffAttempted)
        assertFalse(interruptedUpgrade.current.twaBrowserHandoffCompleted)
        assertTrue(interruptedUpgrade.current.legacyBrowserHandoffUnverified)
        assertEquals(BrowserHandoffState.IDLE, interruptedUpgrade.current.browserHandoffState)
        assertEquals(
            AutoHandoffDecision.NONE,
            BrowserHandoffPolicy.decideAutoHandoffOnStart(
                prefs = interruptedUpgrade.current,
                hasPendingHandoffCallback = false,
                hasTwaFootprint = true,
                referrerWebHandoff = true
            )
        )
        // Manual retry MUST still appear on Home even without TWA footprint
        assertTrue(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = interruptedUpgrade.current,
                activeLogCount = 0,
                hasTwaFootprint = false
            )
        )

        // 2. Even if the legacy 2.0.5 install already has a local userId, do NOT treat it as COMPLETED
        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("watchlog.userId", "u-local-only")
            .putString("watchlog.deviceId", "d-local-only")
            .commit()

        val legacyWithLocalAccount = AppPreferences(context)
        assertTrue(legacyWithLocalAccount.current.twaAutoHandoffAttempted)
        assertFalse(legacyWithLocalAccount.current.twaBrowserHandoffCompleted)
        assertTrue(legacyWithLocalAccount.current.legacyBrowserHandoffUnverified)
        assertEquals(BrowserHandoffState.IDLE, legacyWithLocalAccount.current.browserHandoffState)
        assertTrue(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = legacyWithLocalAccount.current,
                activeLogCount = 0,
                hasTwaFootprint = false
            )
        )

        // 3. A legacy 2.0.5 install that actually completed handoff dismissed the banner and has logs
        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("watchlog.twaMigrationDismissed", true)
            .commit()
        val legacySucceeded = AppPreferences(context)
        assertFalse(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = legacySucceeded.current,
                activeLogCount = 3,
                hasTwaFootprint = true
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

        // Server succeeds profile verification, then fails /api/auth/pair (e.g., 502 / transient outage)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" && request.getHeader("X-User-Id") == "u-web-target" ->
                        MockResponse().setResponseCode(200)
                            .setBody("""{"userId":"u-web-target","nickname":"웹계정","pairingCode":"WEB-8888"}""")
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

    @Test
    fun roomReadFailureDuringCrossAccountSwitch_preservesAccountLogsHistoryAndOutbox() = runBlocking {
        prefs.saveAuth("u-old-safe", "d-old-safe", "OLD-1111")
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" && request.getHeader("X-User-Id") == "u-web-new" ->
                        MockResponse().setResponseCode(200)
                            .setBody("""{"userId":"u-web-new","nickname":"웹계정","pairingCode":"WEB-2222"}""")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        // Case 1: Local DB has log + history + outbox, and outbox read throws SQLException
        val title = Title(
            id = "t-keep-1",
            type = TitleType.MOVIE,
            name = "기생충",
            year = 2019,
            provider = Provider.LOCAL,
            providerId = null
        )
        repository.saveLogForTitle(
            rawTitle = title,
            draft = LogDraft(status = LogStatus.DONE, note = "읽기 실패 시 보존", watchedAt = RecordDate.nowIso()),
            awaitSync = false
        )
        assertEquals(1, db.watchLogDao().getActiveLogs().size)
        assertEquals(1, db.watchLogHistoryDao().countAll())
        assertEquals(1, db.outboxDao().getAll().size)

        driver.failSelectContaining = "FROM outbox"
        val outcomeWithData = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-new",
            deviceId = "d-web-new",
            pairingCode = "WEB-2222",
            nickname = "웹계정",
            personaKey = null
        )
        driver.failSelectContaining = null

        assertEquals(OttlineRepository.HandoffOutcome.MERGE_FAILED, outcomeWithData)
        assertEquals("u-old-safe", prefs.current.userId)
        assertEquals("d-old-safe", prefs.current.deviceId)
        assertEquals(BrowserHandoffState.FAILED, prefs.current.browserHandoffState)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        // All 3 tables MUST stay completely intact
        assertEquals(1, db.watchLogDao().getActiveLogs().size)
        assertEquals(1, db.watchLogHistoryDao().countAll())
        assertEquals(1, db.outboxDao().getAll().size)

        // Case 2: Even when local DB is empty, a Room read failure MUST NOT be treated as empty
        db.outboxDao().clearAll()
        db.watchLogHistoryDao().clearAll()
        db.watchLogDao().clearAll()

        driver.failSelectContaining = "FROM watch_logs"
        val outcomeWhenEmptyButUnreadable = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-new",
            deviceId = "d-web-new",
            pairingCode = "WEB-2222",
            nickname = "웹계정",
            personaKey = null
        )
        driver.failSelectContaining = null

        assertEquals(OttlineRepository.HandoffOutcome.MERGE_FAILED, outcomeWhenEmptyButUnreadable)
        assertEquals("u-old-safe", prefs.current.userId)
        assertEquals(BrowserHandoffState.FAILED, prefs.current.browserHandoffState)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)

        // Case 3: watch_log_history read failure on empty DB also aborts safely
        driver.failSelectContaining = "FROM watch_log_history"
        val outcomeHistoryUnreadable = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-new",
            deviceId = "d-web-new",
            pairingCode = "WEB-2222",
            nickname = "웹계정",
            personaKey = null
        )
        driver.failSelectContaining = null

        assertEquals(OttlineRepository.HandoffOutcome.MERGE_FAILED, outcomeHistoryUnreadable)
        assertEquals("u-old-safe", prefs.current.userId)
        assertEquals(BrowserHandoffState.FAILED, prefs.current.browserHandoffState)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
    }

    @Test
    fun concurrentSaveDuringCrossAccountSwitch_isNotClearedAndRoutesToMerge() = runBlocking {
        prefs.saveAuth("u-old-race", "d-old-race", "OLD-RACE")
        assertEquals(0, db.watchLogDao().getActiveLogs().size)
        assertEquals(0, db.watchLogHistoryDao().countAll())
        assertEquals(0, db.outboxDao().getAll().size)

        val profileArrived = CountDownLatch(1)
        val allowProfileResponse = CountDownLatch(1)
        val pairBodies = CopyOnWriteArrayList<String>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" && request.getHeader("X-User-Id") == "u-web-race" -> {
                        profileArrived.countDown()
                        allowProfileResponse.await(5, TimeUnit.SECONDS)
                        MockResponse().setResponseCode(200)
                            .setBody("""{"userId":"u-web-race","nickname":"레이스웹","pairingCode":"WEB-RACE"}""")
                    }
                    path == "/api/auth/pair" -> {
                        pairBodies.add(request.body.readUtf8())
                        MockResponse().setResponseCode(200)
                            .setBody("""{"userId":"u-web-race","deviceId":"d-web-race","pairingCode":"WEB-RACE"}""")
                    }
                    path == "/api/sync/push" -> MockResponse().setResponseCode(200)
                        .setBody("""{"accepted":["ok"],"rejected":[]}""")
                    path.startsWith("/api/sync/pull") -> MockResponse().setResponseCode(200)
                        .setBody(
                            """
                            {
                              "serverTime": "2026-11-25T07:00:00Z",
                              "changes": {
                                "titles": [
                                  {"id":"t-web-race-1","type":"movie","name":"듄","year":2021,"provider":"TMDB","providerId":"438631"}
                                ],
                                "logs": [
                                  {"id":"l-web-race-1","titleId":"t-web-race-1","status":"DONE","note":"웹 기록","watchedAt":"2026-11-20T00:00:00Z","createdAt":"2026-11-20T00:00:00Z","updatedAt":"2026-11-20T00:00:00Z"}
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

        // Start cross-account handoff while DB is empty
        val handoffDeferred = async(Dispatchers.IO) {
            repository.completeTwaHandoffWithOutcome(
                status = "ok",
                userId = "u-web-race",
                deviceId = "d-web-race",
                pairingCode = "WEB-RACE",
                nickname = "레이스웹",
                personaKey = null
            )
        }

        assertTrue(profileArrived.await(5, TimeUnit.SECONDS))

        // While server profile verification is in-flight, another coroutine saves a local record!
        repository.saveLogForTitle(
            rawTitle = Title(
                id = "t-concurrent-1",
                type = TitleType.BOOK,
                name = "동시 저장 책",
                year = 2025,
                provider = Provider.LOCAL,
                providerId = null
            ),
            draft = LogDraft(status = LogStatus.DONE, note = "절대 지워지면 안 됨", watchedAt = RecordDate.nowIso()),
            awaitSync = false
        )
        assertEquals(1, db.watchLogDao().getActiveLogs().size)

        // Release server profile verification -> locked transaction MUST see the concurrent save
        allowProfileResponse.countDown()
        val outcome = handoffDeferred.await()

        assertEquals(OttlineRepository.HandoffOutcome.CONNECTED, outcome)
        assertTrue(prefs.current.twaBrowserHandoffCompleted)
        assertEquals(BrowserHandoffState.COMPLETED, prefs.current.browserHandoffState)
        assertEquals("u-web-race", prefs.current.userId)
        // Must have routed through /api/auth/pair with u-old-race instead of clearing Room!
        assertEquals(1, pairBodies.size)
        assertTrue(pairBodies.first().contains("u-old-race"))
        val finalLogs = repository.activeLogsFlow.first()
        assertNotNull(finalLogs.find { it.title.name == "동시 저장 책" })
        assertNotNull(finalLogs.find { it.title.name == "듄" })
    }

    @Test
    fun serverProfileFailureDuringOkCallback_doesNotMarkCompletedOrMutateAuth_andRetrySucceeds() = runBlocking {
        // Transient 502 on /api/auth/profile
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse =
                MockResponse().setResponseCode(502).setBody("""{"error":"bad gateway"}""")
        }

        val failedOutcome = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-srv",
            deviceId = "d-web-srv",
            pairingCode = "WEB-SRV",
            nickname = "서버재시도",
            personaKey = PersonaKey.CINEMA_KEEPER
        )

        assertEquals(OttlineRepository.HandoffOutcome.SERVER_ERROR, failedOutcome)
        assertNull(prefs.current.userId)
        assertNull(prefs.current.deviceId)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        assertFalse(prefs.current.twaMigrationBannerDismissed)
        assertEquals(BrowserHandoffState.FAILED, prefs.current.browserHandoffState)
        assertTrue(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = prefs.current,
                activeLogCount = 0,
                hasTwaFootprint = false
            )
        )

        // Server recovers -> retry completes and verifies sync
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" -> MockResponse().setResponseCode(200)
                        .setBody("""{"userId":"u-web-srv","nickname":"서버재시도","personaKey":"cinema_keeper","pairingCode":"WEB-SRV"}""")
                    path.startsWith("/api/sync/pull") -> MockResponse().setResponseCode(200)
                        .setBody(
                            """
                            {
                              "serverTime": "2026-11-25T07:05:00Z",
                              "changes": {
                                "titles": [{"id":"t-srv-1","type":"movie","name":"인셉션","year":2010,"provider":"TMDB","providerId":"27205"}],
                                "logs": [{"id":"l-srv-1","titleId":"t-srv-1","status":"DONE","note":"복구 완료","watchedAt":"2026-11-21T00:00:00Z","createdAt":"2026-11-21T00:00:00Z","updatedAt":"2026-11-21T00:00:00Z"}]
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
            userId = "u-web-srv",
            deviceId = "d-web-srv",
            pairingCode = "WEB-SRV",
            nickname = "서버재시도",
            personaKey = PersonaKey.CINEMA_KEEPER
        )

        assertEquals(OttlineRepository.HandoffOutcome.CONNECTED, retryOutcome)
        assertEquals("u-web-srv", prefs.current.userId)
        assertTrue(prefs.current.twaBrowserHandoffCompleted)
        assertTrue(prefs.current.twaMigrationBannerDismissed)
        assertEquals(BrowserHandoffState.COMPLETED, prefs.current.browserHandoffState)
        assertEquals(1, repository.activeLogsFlow.first().size)
    }

    @Test
    fun syncPullFailureAfterProfileVerified_doesNotMarkCompleted_andRetryCompletes() = runBlocking {
        // Profile succeeds (200), but /api/sync/pull fails transiently (502)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" -> MockResponse().setResponseCode(200)
                        .setBody("""{"userId":"u-web-pull","nickname":"풀재시도","pairingCode":"WEB-PULL"}""")
                    path.startsWith("/api/sync/pull") -> MockResponse().setResponseCode(502)
                    path == "/api/nalytic/events" -> MockResponse().setResponseCode(202)
                    path.startsWith("/api/android/") -> MockResponse().setResponseCode(200).setBody("{}")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val failedOutcome = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-pull",
            deviceId = "d-web-pull",
            pairingCode = "WEB-PULL",
            nickname = "풀재시도",
            personaKey = null
        )

        assertEquals(OttlineRepository.HandoffOutcome.SERVER_ERROR, failedOutcome)
        assertFalse(prefs.current.twaBrowserHandoffCompleted)
        assertFalse(prefs.current.twaMigrationBannerDismissed)
        assertEquals(BrowserHandoffState.FAILED, prefs.current.browserHandoffState)
        assertTrue(
            BrowserHandoffPolicy.shouldShowHomeHandoffCard(
                prefs = prefs.current,
                activeLogCount = 0,
                hasTwaFootprint = false
            )
        )

        // Pull recovers -> retry succeeds and marks COMPLETED
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/auth/profile" -> MockResponse().setResponseCode(200)
                        .setBody("""{"userId":"u-web-pull","nickname":"풀재시도","pairingCode":"WEB-PULL"}""")
                    path.startsWith("/api/sync/pull") -> MockResponse().setResponseCode(200)
                        .setBody("""{"serverTime":"2026-11-25T07:10:00Z","changes":{"titles":[],"logs":[]}}""")
                    path == "/api/nalytic/events" -> MockResponse().setResponseCode(202)
                    path.startsWith("/api/android/") -> MockResponse().setResponseCode(200).setBody("{}")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val retryOutcome = repository.completeTwaHandoffWithOutcome(
            status = "ok",
            userId = "u-web-pull",
            deviceId = "d-web-pull",
            pairingCode = "WEB-PULL",
            nickname = "풀재시도",
            personaKey = null
        )

        assertEquals(OttlineRepository.HandoffOutcome.CONNECTED, retryOutcome)
        assertTrue(prefs.current.twaBrowserHandoffCompleted)
        assertTrue(prefs.current.twaMigrationBannerDismissed)
        assertEquals(BrowserHandoffState.COMPLETED, prefs.current.browserHandoffState)
    }
}

private class FaultInjectingSqliteDriver(
    private val delegate: SQLiteDriver
) : SQLiteDriver {
    @Volatile
    var failSelectContaining: String? = null

    override fun open(fileName: String): SQLiteConnection {
        val inner = delegate.open(fileName)
        return object : SQLiteConnection {
            override fun prepare(sql: String): SQLiteStatement {
                val pattern = failSelectContaining
                if (pattern != null && sql.contains("SELECT", ignoreCase = true) && sql.contains(pattern, ignoreCase = true)) {
                    throw SQLException("Injected Room read failure for: $sql")
                }
                return inner.prepare(sql)
            }

            override fun close() = inner.close()
        }
    }
}
