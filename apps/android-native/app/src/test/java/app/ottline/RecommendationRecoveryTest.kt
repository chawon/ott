package app.ottline

import android.app.Application
import android.content.Context
import app.ottline.data.RecommendationCoordinator
import app.ottline.data.RecommendationCoordinatorConfig
import app.ottline.data.RecommendationErrorKind
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.RecommendationStore
import app.ottline.data.remote.OttlineApiClient
import app.ottline.data.remote.RecommendationTimeouts
import app.ottline.domain.RecommendationMatcher
import app.ottline.model.LogStatus
import app.ottline.model.Provider
import app.ottline.model.RecommendationExclusion
import app.ottline.model.RecommendationItem
import app.ottline.model.RecommendationQuota
import app.ottline.model.RecommendationState
import app.ottline.model.Title
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.screens.formatRecommendationResetTime
import androidx.test.core.app.ApplicationProvider
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.ConscryptMode

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class)
@ConscryptMode(ConscryptMode.Mode.OFF)
class RecommendationRecoveryTest {

    private lateinit var context: Context
    private lateinit var server: MockWebServer
    private lateinit var prefs: AppPreferences
    private lateinit var store: RecommendationStore
    private val online = AtomicBoolean(true)
    private val trackedEvents = CopyOnWriteArrayList<String>()
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    private val userId = "11111111-1111-4111-8111-111111111111"
    private val deviceId = "22222222-2222-4222-8222-222222222222"

    private val movieA = RecommendationItem(
        name = "파묘",
        type = TitleType.MOVIE,
        reason = "긴장감 있는 오컬트 미스터리",
        genres = listOf("미스터리"),
        provider = Provider.TMDB,
        providerId = "99001",
        year = 2024
    )
    private val movieB = RecommendationItem(
        name = "서울의 봄",
        type = TitleType.MOVIE,
        reason = "묵직한 현대사 드라마",
        genres = listOf("드라마"),
        provider = Provider.TMDB,
        providerId = "99002",
        year = 2023
    )
    private val seriesC = RecommendationItem(
        name = "폭싹 속았수다",
        type = TitleType.SERIES,
        reason = "긴 여운이 남는 가족 서사",
        genres = listOf("드라마"),
        provider = Provider.TMDB,
        providerId = "99003",
        year = 2025
    )

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences(RecommendationStore.PREFS_NAME, Context.MODE_PRIVATE).edit().clear().commit()
        online.set(true)
        trackedEvents.clear()

        server = MockWebServer()
        server.start()

        prefs = AppPreferences(context)
        prefs.setDebugApiBaseUrl(server.url("/").toString().trimEnd('/'))
        prefs.saveAuth(userId, deviceId, "PAIR-REC")
        prefs.setLocale("ko")
        store = RecommendationStore(context)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun makeApi(
        baseClient: OkHttpClient = OttlineApiClient.defaultOkHttpClient(),
        timeouts: RecommendationTimeouts = RecommendationTimeouts(
            stateReadTimeoutMs = 3_000L,
            stateCallTimeoutMs = 4_000L,
            generateReadTimeoutMs = 10_000L,
            generateCallTimeoutMs = 10_000L
        )
    ): OttlineApiClient = OttlineApiClient(
        prefs = prefs,
        httpClient = baseClient,
        recommendationTimeouts = timeouts
    )

    private fun makeCoordinator(
        api: OttlineApiClient = makeApi(),
        pollIntervalMs: Long = 20L,
        pollDeadlineMs: Long = 5_000L,
        maxTransientPollErrors: Int = 2,
        uuidProvider: () -> String = { UUID.randomUUID().toString() }
    ): RecommendationCoordinator = RecommendationCoordinator(
        store = store,
        prefs = prefs,
        api = api,
        isNetworkOnline = { online.get() },
        trackEvent = { name, _ -> trackedEvents.add(name) },
        config = RecommendationCoordinatorConfig(
            pollIntervalMs = pollIntervalMs,
            pollDeadlineMs = pollDeadlineMs,
            maxTransientPollErrors = maxTransientPollErrors,
            dispatcher = Dispatchers.IO,
            uuidProvider = uuidProvider
        )
    )

    private fun stateJson(
        items: List<RecommendationItem>,
        used: Int,
        generationId: String? = null,
        generating: Boolean = false,
        hasBatch: Boolean = items.isNotEmpty() || generationId != null,
        eligible: Boolean = true,
        exclusions: List<RecommendationExclusion> = emptyList()
    ): String = json.encodeToString(
        RecommendationState(
            items = items,
            exclusions = exclusions,
            quota = RecommendationQuota(
                date = "2026-11-20",
                timezone = "Asia/Seoul",
                limit = 3,
                used = used,
                remaining = (3 - used).coerceAtLeast(0),
                resetsAt = "2026-11-21T00:00:00+09:00"
            ),
            generatedAt = if (hasBatch) "2026-11-20T12:00:00+09:00" else null,
            generationId = generationId,
            generating = generating,
            hasBatch = hasBatch,
            eligible = eligible
        )
    )

    private fun extractRequestId(request: RecordedRequest): String =
        json.parseToJsonElement(request.body.readUtf8())
            .jsonObject["requestId"]!!.jsonPrimitive.content

    @Test
    fun firstGenerationAndExplicitRegeneration_incrementQuotaByOneEach() = runBlocking {
        val used = AtomicInteger(0)
        val currentGenId = AtomicReference<String?>(null)
        val currentItems = AtomicReference<List<RecommendationItem>>(emptyList())
        val postIds = CopyOnWriteArrayList<String>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when {
                    request.path == "/api/recommendations/state" && request.method == "GET" -> {
                        MockResponse().setResponseCode(200).setBody(
                            stateJson(
                                items = currentItems.get(),
                                used = used.get(),
                                generationId = currentGenId.get(),
                                hasBatch = currentGenId.get() != null
                            )
                        )
                    }
                    request.path == "/api/recommendations/generate" && request.method == "POST" -> {
                        val reqId = extractRequestId(request)
                        postIds.add(reqId)
                        val nextUsed = used.incrementAndGet()
                        currentGenId.set(reqId)
                        currentItems.set(if (nextUsed == 1) listOf(movieA) else listOf(movieB))
                        MockResponse().setResponseCode(200).setBody(
                            stateJson(
                                items = currentItems.get(),
                                used = nextUsed,
                                generationId = reqId,
                                hasBatch = true
                            )
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator()
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            val afterFirst = coordinator.uiState.value
            assertNull(afterFirst.error)
            assertFalse(afterFirst.loading)
            assertEquals(listOf(movieA.name), afterFirst.visibleItems(emptyList()).map { it.name })
            assertEquals(1, afterFirst.quota?.used)
            assertEquals(2, afterFirst.quota?.remaining)
            assertNull(afterFirst.pendingRequestId)

            coordinator.generate()?.join()
            val afterSecond = coordinator.uiState.value
            assertNull(afterSecond.error)
            assertEquals(listOf(movieB.name), afterSecond.visibleItems(emptyList()).map { it.name })
            assertEquals(2, afterSecond.quota?.used)
            assertEquals(1, afterSecond.quota?.remaining)
            assertNull(afterSecond.pendingRequestId)
            assertEquals(2, postIds.size)
            assertNotEquals(postIds[0], postIds[1])
            assertTrue("recommendation_refresh" in trackedEvents)
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun slowGenerationSurvivesShorterDefaultAndStateTimeout() = runBlocking {
        val baseShortClient = OkHttpClient.Builder()
            .connectTimeout(2, TimeUnit.SECONDS)
            .readTimeout(200, TimeUnit.MILLISECONDS)
            .build()
        val api = makeApi(
            baseClient = baseShortClient,
            timeouts = RecommendationTimeouts(
                stateReadTimeoutMs = 200L,
                stateCallTimeoutMs = 500L,
                generateReadTimeoutMs = 3_000L,
                generateCallTimeoutMs = 3_000L
            )
        )

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> MockResponse()
                        .setResponseCode(200)
                        .setBody(stateJson(items = emptyList(), used = 0, hasBatch = false))
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        // Exceeds 200ms default/state timeout, succeeds inside 3000ms generate budget
                        MockResponse()
                            .setResponseCode(200)
                            .setHeadersDelay(500, TimeUnit.MILLISECONDS)
                            .setBody(stateJson(items = listOf(movieA), used = 1, generationId = reqId))
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator(api = api)
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            val ui = coordinator.uiState.value
            assertNull(ui.error)
            assertEquals(listOf(movieA.name), ui.visibleItems(emptyList()).map { it.name })
            assertEquals(1, ui.quota?.used)
            assertNull(ui.pendingRequestId)
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun lostGenerateResponse_preservesPreviousItems_andAppRestartRecoversViaStateWithoutExtraPost() = runBlocking {
        val used = AtomicInteger(1)
        val currentGenId = AtomicReference("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        val currentItems = AtomicReference(listOf(movieA))
        val postCount = AtomicInteger(0)
        val capturedReqId = AtomicReference<String?>(null)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> MockResponse()
                        .setResponseCode(200)
                        .setBody(
                            stateJson(
                                items = currentItems.get(),
                                used = used.get(),
                                generationId = currentGenId.get()
                            )
                        )
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        capturedReqId.set(reqId)
                        postCount.incrementAndGet()
                        // Server commits the generation & charges 1 quota, but response is dropped before client reads it
                        used.incrementAndGet()
                        currentGenId.set(reqId)
                        currentItems.set(listOf(movieB))
                        MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST)
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val firstSession = makeCoordinator()
        try {
            firstSession.syncScope(userId, deviceId, "ko", active = true)?.join()
            assertEquals(listOf(movieA.name), firstSession.uiState.value.visibleItems(emptyList()).map { it.name })
            assertEquals(1, firstSession.uiState.value.quota?.used)

            firstSession.generate()?.join()
            val afterDisconnect = firstSession.uiState.value
            assertEquals(RecommendationErrorKind.GENERATE, afterDisconnect.error)
            // Previous results MUST remain visible after response loss
            assertEquals(listOf(movieA.name), afterDisconnect.visibleItems(emptyList()).map { it.name })
            assertEquals(capturedReqId.get(), afterDisconnect.pendingRequestId)
            assertEquals(1, postCount.get())
        } finally {
            firstSession.close()
        }

        // Simulate cold app restart with a brand new RecommendationCoordinator reading the durable RecommendationStore
        val restartedSession = makeCoordinator()
        try {
            restartedSession.syncScope(userId, deviceId, "ko", active = true)?.join()
            val recovered = restartedSession.uiState.value
            assertNull(recovered.error)
            assertNull(recovered.pendingRequestId)
            assertEquals(listOf(movieB.name), recovered.visibleItems(emptyList()).map { it.name })
            assertEquals(2, recovered.quota?.used)
            // Zero extra POST /generate calls — recovered strictly via GET /state with total charge = 1
            assertEquals(1, postCount.get())
        } finally {
            restartedSession.close()
        }
    }

    @Test
    fun lostGenerateResponseWhenServerDidNotCommit_retriesWithSameRequestId() = runBlocking {
        val used = AtomicInteger(1)
        val currentGenId = AtomicReference("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        val currentItems = AtomicReference(listOf(movieA))
        val postIds = CopyOnWriteArrayList<String>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> MockResponse()
                        .setResponseCode(200)
                        .setBody(
                            stateJson(
                                items = currentItems.get(),
                                used = used.get(),
                                generationId = currentGenId.get()
                            )
                        )
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        postIds.add(reqId)
                        if (postIds.size == 1) {
                            // First attempt failed/dropped before commit
                            MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST)
                        } else {
                            // Explicit retry succeeds with the SAME idempotency requestId
                            val nextUsed = used.incrementAndGet()
                            currentGenId.set(reqId)
                            currentItems.set(listOf(movieB))
                            MockResponse().setResponseCode(200).setBody(
                                stateJson(items = listOf(movieB), used = nextUsed, generationId = reqId)
                            )
                        }
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator()
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            coordinator.generate()?.join()
            val pendingId = coordinator.uiState.value.pendingRequestId
            assertNotNull(pendingId)
            assertEquals(RecommendationErrorKind.GENERATE, coordinator.uiState.value.error)
            assertEquals(listOf(movieA.name), coordinator.uiState.value.visibleItems(emptyList()).map { it.name })

            // Plain resume/reconcile only checks /state and does NOT auto-POST
            coordinator.reconcileOnResumeOrReconnect()?.join()
            assertEquals(1, postIds.size)
            assertEquals(pendingId, coordinator.uiState.value.pendingRequestId)
            assertEquals(RecommendationErrorKind.GENERATE, coordinator.uiState.value.error)

            // Explicit retry checks /state first, sees unresolved, then re-POSTs the exact same requestId
            coordinator.retry()?.join()
            assertEquals(2, postIds.size)
            assertEquals(postIds[0], postIds[1])
            assertNull(coordinator.uiState.value.error)
            assertNull(coordinator.uiState.value.pendingRequestId)
            assertEquals(listOf(movieB.name), coordinator.uiState.value.visibleItems(emptyList()).map { it.name })
            assertEquals(2, coordinator.uiState.value.quota?.used)
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun accepted202_survivesTransientPollingNetworkOutage_andRecoversWithSingleCharge() = runBlocking {
        val stateCallsAfterPost = AtomicInteger(0)
        val postCount = AtomicInteger(0)
        val activeReqId = AtomicReference<String?>(null)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> {
                        val reqId = activeReqId.get()
                        if (reqId == null) {
                            MockResponse().setResponseCode(200).setBody(
                                stateJson(items = listOf(movieA), used = 1, generationId = "gen-old")
                            )
                        } else {
                            when (stateCallsAfterPost.incrementAndGet()) {
                                1 -> MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST)
                                2 -> MockResponse().setResponseCode(503).setBody("""{"message":"temporary outage"}""")
                                3 -> MockResponse().setResponseCode(200).setBody(
                                    stateJson(items = listOf(movieA), used = 1, generationId = "gen-old", generating = true)
                                )
                                else -> MockResponse().setResponseCode(200).setBody(
                                    stateJson(items = listOf(movieB), used = 2, generationId = reqId, generating = false)
                                )
                            }
                        }
                    }
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        activeReqId.set(reqId)
                        postCount.incrementAndGet()
                        MockResponse().setResponseCode(202).setBody(
                            stateJson(items = listOf(movieA), used = 1, generationId = "gen-old", generating = true)
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator(pollIntervalMs = 15L, maxTransientPollErrors = 2)
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            coordinator.generate()?.join()
            val finalUi = coordinator.uiState.value
            assertNull(finalUi.error)
            assertNull(finalUi.pendingRequestId)
            assertEquals(listOf(movieB.name), finalUi.visibleItems(emptyList()).map { it.name })
            assertEquals(2, finalUi.quota?.used)
            assertEquals(1, postCount.get())
            assertTrue(stateCallsAfterPost.get() >= 4)
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun accepted202_afterSustainedPollOutage_resumesPollingOnReconnectWithoutExtraPost() = runBlocking {
        val failPolls = AtomicBoolean(true)
        val completed = AtomicBoolean(false)
        val postCount = AtomicInteger(0)
        val activeReqId = AtomicReference<String?>(null)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> {
                        val reqId = activeReqId.get()
                        if (reqId == null) {
                            MockResponse().setResponseCode(200).setBody(
                                stateJson(items = listOf(movieA), used = 1, generationId = "gen-old")
                            )
                        } else if (failPolls.get()) {
                            MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST)
                        } else if (!completed.getAndSet(true)) {
                            MockResponse().setResponseCode(200).setBody(
                                stateJson(items = listOf(movieA), used = 1, generationId = "gen-old", generating = true)
                            )
                        } else {
                            MockResponse().setResponseCode(200).setBody(
                                stateJson(items = listOf(movieB), used = 2, generationId = reqId, generating = false)
                            )
                        }
                    }
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        activeReqId.set(reqId)
                        postCount.incrementAndGet()
                        MockResponse().setResponseCode(202).setBody(
                            stateJson(items = listOf(movieA), used = 1, generationId = "gen-old", generating = true)
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator(pollIntervalMs = 15L, maxTransientPollErrors = 1)
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            coordinator.generate()?.join()
            val interrupted = coordinator.uiState.value
            assertEquals(RecommendationErrorKind.GENERATE, interrupted.error)
            assertEquals(activeReqId.get(), interrupted.pendingRequestId)
            assertEquals(listOf(movieA.name), interrupted.visibleItems(emptyList()).map { it.name })
            assertFalse(interrupted.canRefresh)

            // Network returns -> reconnect resumes /state polling and recovers without any extra POST
            failPolls.set(false)
            coordinator.reconcileOnResumeOrReconnect()?.join()
            val recovered = coordinator.uiState.value
            assertNull(recovered.error)
            assertNull(recovered.pendingRequestId)
            assertEquals(listOf(movieB.name), recovered.visibleItems(emptyList()).map { it.name })
            assertEquals(2, recovered.quota?.used)
            assertEquals(1, postCount.get())
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun doubleTapGenerate_sendsOnlySingleRequestAndChargesOnce() = runBlocking {
        val postEntered = CountDownLatch(1)
        val allowPostFinish = CountDownLatch(1)
        val postCount = AtomicInteger(0)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> MockResponse().setResponseCode(200).setBody(
                        stateJson(items = listOf(movieA), used = 1, generationId = "gen-old")
                    )
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        postCount.incrementAndGet()
                        postEntered.countDown()
                        allowPostFinish.await(5, TimeUnit.SECONDS)
                        MockResponse().setResponseCode(200).setBody(
                            stateJson(items = listOf(movieB), used = 2, generationId = reqId)
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator()
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            val firstJob = coordinator.generate()
            assertTrue(postEntered.await(5, TimeUnit.SECONDS))
            val secondJob = coordinator.generate()
            assertNull(secondJob)
            allowPostFinish.countDown()
            firstJob?.join()

            assertEquals(1, postCount.get())
            assertEquals(2, coordinator.uiState.value.quota?.used)
            assertEquals(listOf(movieB.name), coordinator.uiState.value.visibleItems(emptyList()).map { it.name })
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun server503And429_chargeZeroExtraAndKeepPreviousItemsVisible() = runBlocking {
        val mode = AtomicReference("503")
        val used = AtomicInteger(2)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> MockResponse().setResponseCode(200).setBody(
                        stateJson(items = listOf(movieA), used = used.get(), generationId = "gen-prev")
                    )
                    "/api/recommendations/generate" -> {
                        if (mode.get() == "503") {
                            MockResponse().setResponseCode(503).setBody("""{"message":"upstream unavailable"}""")
                        } else {
                            // Another device exhausted quota to 3/3 before this call
                            used.set(3)
                            MockResponse().setResponseCode(429).setBody(
                                stateJson(items = listOf(movieA), used = 3, generationId = "gen-prev")
                            )
                        }
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator()
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()

            // 503 failure: 0 extra quota charged, previous items kept, pendingRequestId preserved
            coordinator.generate()?.join()
            val after503 = coordinator.uiState.value
            assertEquals(RecommendationErrorKind.GENERATE, after503.error)
            assertEquals(listOf(movieA.name), after503.visibleItems(emptyList()).map { it.name })
            assertEquals(2, after503.quota?.used)
            assertNotNull(after503.pendingRequestId)

            // 429 daily limit: 0 extra quota charged, previous items kept, pendingRequestId cleared, error cleared
            mode.set("429")
            coordinator.retry()?.join()
            val after429 = coordinator.uiState.value
            assertNull(after429.error)
            assertNull(after429.pendingRequestId)
            assertEquals(3, after429.quota?.used)
            assertEquals(0, after429.quota?.remaining)
            assertFalse(after429.canRefresh)
            assertEquals(listOf(movieA.name), after429.visibleItems(emptyList()).map { it.name })
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun otherLocaleQuotaIncrement_isNotMistakenForCurrentLocaleCompletion() = runBlocking {
        val koGenId = AtomicReference("11111111-0000-4000-8000-000000000001")
        val koItems = AtomicReference(listOf(movieA))
        val sharedUsed = AtomicInteger(1)
        val postIds = CopyOnWriteArrayList<String>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> MockResponse().setResponseCode(200).setBody(
                        stateJson(
                            items = koItems.get(),
                            used = sharedUsed.get(),
                            generationId = koGenId.get(),
                            generating = false
                        )
                    )
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        postIds.add(reqId)
                        if (postIds.size == 1) {
                            // English generation on another device was in flight and finishes -> quota increments 1->2,
                            // but Korean generationId stays at the old batch!
                            sharedUsed.set(2)
                            MockResponse().setResponseCode(202).setBody(
                                stateJson(
                                    items = koItems.get(),
                                    used = 1,
                                    generationId = koGenId.get(),
                                    generating = true
                                )
                            )
                        } else {
                            // Explicit retry for Korean now executes and commits Korean batch with the SAME reqId
                            sharedUsed.set(3)
                            koGenId.set(reqId)
                            koItems.set(listOf(movieB))
                            MockResponse().setResponseCode(200).setBody(
                                stateJson(
                                    items = koItems.get(),
                                    used = 3,
                                    generationId = reqId,
                                    generating = false
                                )
                            )
                        }
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator(pollIntervalMs = 15L)
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            coordinator.generate()?.join()

            val afterOtherLocaleDone = coordinator.uiState.value
            // Shared quota changed 1->2, yet Korean batch did NOT update -> MUST NOT mark success!
            assertEquals(RecommendationErrorKind.GENERATE, afterOtherLocaleDone.error)
            assertEquals(2, afterOtherLocaleDone.quota?.used)
            assertEquals(postIds[0], afterOtherLocaleDone.pendingRequestId)
            assertEquals(listOf(movieA.name), afterOtherLocaleDone.visibleItems(emptyList()).map { it.name })

            // Reconcile / resume must still keep pendingRequestId and NOT trigger unsolicited POST
            coordinator.reconcileOnResumeOrReconnect()?.join()
            assertEquals(1, postIds.size)
            assertEquals(postIds[0], coordinator.uiState.value.pendingRequestId)
            assertEquals(RecommendationErrorKind.GENERATE, coordinator.uiState.value.error)

            // Explicit retry reuses the same Korean requestId and completes Korean batch
            coordinator.retry()?.join()
            assertEquals(2, postIds.size)
            assertEquals(postIds[0], postIds[1])
            assertNull(coordinator.uiState.value.error)
            assertNull(coordinator.uiState.value.pendingRequestId)
            assertEquals(3, coordinator.uiState.value.quota?.used)
            assertEquals(listOf(movieB.name), coordinator.uiState.value.visibleItems(emptyList()).map { it.name })
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun pendingExclusionSyncFailure_preservesGenerateRequestId_andUndoAndLocalFilteringWork() = runBlocking {
        val failExclusion = AtomicBoolean(true)
        val exclusionPutCount = AtomicInteger(0)
        val exclusionDeleteCount = AtomicInteger(0)
        val postIds = CopyOnWriteArrayList<String>()
        val serverExclusions = CopyOnWriteArrayList<RecommendationExclusion>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when {
                    request.path == "/api/recommendations/state" -> MockResponse().setResponseCode(200).setBody(
                        stateJson(
                            items = if (postIds.isEmpty()) listOf(movieA, seriesC) else listOf(seriesC),
                            used = if (postIds.isEmpty()) 1 else 2,
                            generationId = postIds.lastOrNull() ?: "gen-1",
                            exclusions = serverExclusions.toList()
                        )
                    )
                    request.path == "/api/recommendations/exclusions" && request.method == "PUT" -> {
                        exclusionPutCount.incrementAndGet()
                        if (failExclusion.get()) {
                            MockResponse().setResponseCode(503)
                        } else {
                            val saved = RecommendationExclusion(
                                key = "a".repeat(64),
                                name = movieA.name,
                                type = movieA.type,
                                provider = movieA.provider,
                                providerId = movieA.providerId,
                                year = movieA.year
                            )
                            serverExclusions.add(saved)
                            MockResponse().setResponseCode(200).setBody(json.encodeToString(saved))
                        }
                    }
                    request.path?.startsWith("/api/recommendations/exclusions/") == true && request.method == "DELETE" -> {
                        exclusionDeleteCount.incrementAndGet()
                        serverExclusions.clear()
                        MockResponse().setResponseCode(200)
                    }
                    request.path == "/api/recommendations/generate" && request.method == "POST" -> {
                        val reqId = extractRequestId(request)
                        postIds.add(reqId)
                        MockResponse().setResponseCode(200).setBody(
                            stateJson(
                                items = listOf(seriesC),
                                used = 2,
                                generationId = reqId,
                                exclusions = serverExclusions.toList()
                            )
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator()
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            coordinator.dismiss(movieA)?.join()
            assertTrue(coordinator.uiState.value.syncError)
            assertEquals(1, coordinator.uiState.value.pendingCount)
            assertEquals(listOf(seriesC.name), coordinator.uiState.value.visibleItems(emptyList()).map { it.name })

            // Generate clicked while exclusion sync is failing -> preserves pendingRequestId before failing
            coordinator.generate()?.join()
            val savedReqId = coordinator.uiState.value.pendingRequestId
            assertNotNull(savedReqId)
            assertEquals(0, postIds.size)
            assertEquals(RecommendationErrorKind.GENERATE, coordinator.uiState.value.error)

            // Network recovers -> retry flushes exclusion AND executes generate with preserved requestId
            failExclusion.set(false)
            coordinator.retry()?.join()
            assertEquals(1, postIds.size)
            assertEquals(savedReqId, postIds[0])
            assertNull(coordinator.uiState.value.error)
            assertNull(coordinator.uiState.value.pendingRequestId)
            assertFalse(coordinator.uiState.value.syncError)
            assertEquals(0, coordinator.uiState.value.pendingCount)

            // Undo last dismissed item triggers DELETE /exclusions/{key} and restores item immediately
            coordinator.undoDismiss()?.join()
            assertEquals(1, exclusionDeleteCount.get())
            assertNull(coordinator.uiState.value.lastDismissed)

            // Local recorded WatchLog (even before sync) immediately hides matching recommendation
            val localLog = WatchLog(
                id = "log-1",
                title = Title(
                    id = "t-series",
                    type = TitleType.SERIES,
                    name = seriesC.name,
                    provider = Provider.TMDB,
                    providerId = seriesC.providerId,
                    year = seriesC.year
                ),
                status = LogStatus.WISHLIST,
                watchedAt = "2026-11-20T10:00:00Z",
                createdAt = "2026-11-20T10:00:00Z"
            )
            assertTrue(
                coordinator.uiState.value.visibleItems(listOf(localLog)).none { it.name == seriesC.name }
            )
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun legacyAndroid204ArrayCompatibility_andAccountLocaleIsolation_andMatcher() = runBlocking {
        // 1. Android 2.0.4 legacy array endpoint response still deserializes cleanly with extended RecommendationItem
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when {
                    request.path?.startsWith("/api/recommendations?") == true || request.path == "/api/recommendations" -> {
                        MockResponse().setResponseCode(200).setBody(
                            """
                            [
                              {"name":"헤어질 결심","type":"movie","reason":"여운이 남는 멜로 스릴러","genres":["드라마","미스터리"],"posterUrl":"https://img.example/1.jpg"},
                              {"name":"종의 기원","type":"book","reason":"심리 서스펜스","genres":["소설"],"posterUrl":null}
                            ]
                            """.trimIndent()
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val api = makeApi()
        val legacyItems = api.getRecommendations(refresh = false, excluded = setOf("이미 본 영화"))
        assertEquals(2, legacyItems.size)
        assertEquals("헤어질 결심", legacyItems[0].name)
        assertEquals(TitleType.MOVIE, legacyItems[0].type)
        assertEquals(TitleType.BOOK, legacyItems[1].type)

        // 2. Account + locale-scoped durable requestId isolation
        val userA = "aaaaaaaa-1111-4111-8111-111111111111"
        val userB = "bbbbbbbb-2222-4222-8222-222222222222"
        val koId = "10000000-0000-4000-8000-000000000001"
        val enId = "20000000-0000-4000-8000-000000000002"
        val bKoId = "30000000-0000-4000-8000-000000000003"

        store.saveQueue(userA, store.readQueue(userA).withRequestId("ko", koId).withRequestId("en", enId))
        store.saveQueue(userB, store.readQueue(userB).withRequestId("ko", bKoId))

        assertEquals(koId, store.readQueue(userA).pendingRequestId("ko"))
        assertEquals(enId, store.readQueue(userA).pendingRequestId("en"))
        assertEquals(bKoId, store.readQueue(userB).pendingRequestId("ko"))
        assertNull(store.readQueue(userB).pendingRequestId("en"))

        // 3. Book ISBN-10 <-> ISBN-13 normalization & movie/book same-name separation
        val duneMovie = RecommendationItem(name = "Dune", type = TitleType.MOVIE, year = 2021)
        val duneBook = Title(
            id = "book-1",
            type = TitleType.BOOK,
            name = "Dune",
            author = "Frank Herbert",
            isbn10 = "0441172717"
        )
        assertFalse(
            RecommendationMatcher.isDismissed(duneMovie, listOf(RecommendationMatcher.fromTitle(duneBook)))
        )
        val duneBookRec = RecommendationItem(
            name = "듄",
            type = TitleType.BOOK,
            author = "Frank Herbert",
            isbn13 = "9780441172719"
        )
        assertTrue(
            RecommendationMatcher.isDismissed(duneBookRec, listOf(RecommendationMatcher.fromTitle(duneBook)))
        )

        // 4. Reset timestamp formatting in Korea time
        val formattedKo = formatRecommendationResetTime(
            RecommendationQuota(timezone = "Asia/Seoul", resetsAt = "2026-11-21T00:00:00+09:00"),
            "ko"
        )
        assertTrue(formattedKo.contains("11월 21일 00:00"))
    }

    @Test
    fun generateTimeout_keepsPreviousBatch_andRetryRecoversCommittedServerResultViaState() = runBlocking {
        val used = AtomicInteger(1)
        val currentGenId = AtomicReference("gen-before-timeout")
        val currentItems = AtomicReference(listOf(movieA))
        val postCount = AtomicInteger(0)
        val serverCommitted = CountDownLatch(1)

        val api = makeApi(
            timeouts = RecommendationTimeouts(
                stateReadTimeoutMs = 2_000L,
                stateCallTimeoutMs = 2_500L,
                generateReadTimeoutMs = 200L,
                generateCallTimeoutMs = 250L
            )
        )

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/recommendations/state" -> MockResponse().setResponseCode(200).setBody(
                        stateJson(
                            items = currentItems.get(),
                            used = used.get(),
                            generationId = currentGenId.get()
                        )
                    )
                    "/api/recommendations/generate" -> {
                        val reqId = extractRequestId(request)
                        postCount.incrementAndGet()
                        // Simulate slow server that finishes committing after the client's read timeout
                        Thread.sleep(450L)
                        used.incrementAndGet()
                        currentGenId.set(reqId)
                        currentItems.set(listOf(movieB))
                        serverCommitted.countDown()
                        MockResponse().setResponseCode(200).setBody(
                            stateJson(items = listOf(movieB), used = used.get(), generationId = reqId)
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator(api = api)
        try {
            coordinator.syncScope(userId, deviceId, "ko", active = true)?.join()
            assertEquals(listOf(movieA.name), coordinator.uiState.value.visibleItems(emptyList()).map { it.name })

            // POST /generate times out at 250ms while server finishes at 450ms
            coordinator.generate()?.join()
            val afterTimeout = coordinator.uiState.value
            assertEquals(RecommendationErrorKind.GENERATE, afterTimeout.error)
            assertNotNull(afterTimeout.pendingRequestId)
            assertEquals(listOf(movieA.name), afterTimeout.visibleItems(emptyList()).map { it.name })

            // Wait until server commits, then user taps retry -> /state recovers without a second POST
            assertTrue(serverCommitted.await(3, TimeUnit.SECONDS))
            coordinator.retry()?.join()
            val recovered = coordinator.uiState.value
            assertNull(recovered.error)
            assertNull(recovered.pendingRequestId)
            assertEquals(listOf(movieB.name), recovered.visibleItems(emptyList()).map { it.name })
            assertEquals(2, recovered.quota?.used)
            assertEquals(1, postCount.get())
        } finally {
            coordinator.close()
        }
    }

    @Test
    fun legacyDismissedImport_accountSwitchIsolation_andCatalogDeduplication() = runBlocking {
        prefs.addDismissedRecommendation("이미 본 작품")
        val userB = "33333333-3333-4333-8333-333333333333"
        val deviceB = "44444444-4444-4444-8444-444444444444"
        val excludedBodies = CopyOnWriteArrayList<String>()
        val userAStateEntered = CountDownLatch(1)
        val allowUserAStateFinish = CountDownLatch(1)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val reqUser = request.getHeader("X-User-Id")
                return when {
                    request.path == "/api/recommendations/exclusions" && request.method == "PUT" -> {
                        val body = request.body.readUtf8()
                        excludedBodies.add(body)
                        MockResponse().setResponseCode(200).setBody(
                            json.encodeToString(
                                RecommendationExclusion(
                                    key = "b".repeat(64),
                                    name = "이미 본 작품",
                                    type = null
                                )
                            )
                        )
                    }
                    request.path == "/api/recommendations/state" && reqUser == userId -> {
                        userAStateEntered.countDown()
                        allowUserAStateFinish.await(3, TimeUnit.SECONDS)
                        MockResponse().setResponseCode(200).setBody(
                            stateJson(items = listOf(movieA), used = 1, generationId = "gen-user-a")
                        )
                    }
                    request.path == "/api/recommendations/state" && reqUser == userB -> {
                        MockResponse().setResponseCode(200).setBody(
                            stateJson(items = listOf(seriesC), used = 0, generationId = "gen-user-b")
                        )
                    }
                    request.path?.startsWith("/api/recommendations/catalog?") == true -> {
                        val dup = TitleSearchItem(
                            provider = Provider.KAKAO,
                            providerId = "isbn-1",
                            type = TitleType.BOOK,
                            name = "테스트 책",
                            author = "저자A",
                            isbn13 = "9788901234567"
                        )
                        val other = TitleSearchItem(
                            provider = Provider.KAKAO,
                            providerId = "isbn-2",
                            type = TitleType.BOOK,
                            name = "테스트 책 (개정판)",
                            author = "저자A",
                            isbn13 = "9788901234568"
                        )
                        MockResponse().setResponseCode(200).setBody(json.encodeToString(listOf(dup, other)))
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val coordinator = makeCoordinator()
        try {
            // Start user A load (imports legacy 2.0.4 dismissed title once and then waits in /state)
            val jobA = coordinator.syncScope(userId, deviceId, "ko", active = true)
            assertTrue(userAStateEntered.await(5, TimeUnit.SECONDS))
            assertEquals(1, excludedBodies.size)
            assertTrue(excludedBodies[0].contains("이미 본 작품"))

            // Switch to user B before user A /state returns -> user A response must NOT contaminate user B
            prefs.saveAuth(userB, deviceB, "PAIR-B")
            val jobB = coordinator.syncScope(userB, deviceB, "ko", active = true)
            allowUserAStateFinish.countDown()
            jobA?.join()
            jobB?.join()

            val uiB = coordinator.uiState.value
            assertEquals(userB, uiB.userId)
            assertEquals(listOf(seriesC.name), uiB.visibleItems(emptyList()).map { it.name })
            // Legacy dismissed list belonged to user A only -> user B must not re-import it
            assertEquals(1, excludedBodies.size)

            // Catalog lookup deduplicates pre-populated catalogTitle against remote candidates
            val prefilled = TitleSearchItem(
                provider = Provider.KAKAO,
                providerId = "isbn-1",
                type = TitleType.BOOK,
                name = "테스트 책",
                author = "저자A",
                isbn13 = "9788901234567"
            )
            val bookRec = RecommendationItem(
                name = "테스트 책",
                type = TitleType.BOOK,
                author = "저자A",
                catalogTitle = prefilled
            )
            val candidates = coordinator.searchCatalog(bookRec)
            assertEquals(2, candidates.size)
            assertEquals(listOf("isbn-1", "isbn-2"), candidates.map { it.providerId })
        } finally {
            coordinator.close()
        }
    }
}
