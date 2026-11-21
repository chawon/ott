package app.ottline

import android.app.Application
import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.test.core.app.ApplicationProvider
import app.ottline.data.local.AppPreferences
import app.ottline.data.remote.OttlineApiClient
import app.ottline.domain.TogetherDetailSession
import app.ottline.domain.TogetherFilterHelper
import app.ottline.model.Comment
import app.ottline.model.DiscussionListItem
import app.ottline.model.DiscussionReactionState
import app.ottline.model.DiscussionReactionSummary
import app.ottline.model.DiscussionReactionType
import app.ottline.model.TitleType
import app.ottline.ui.OttlineMainViewModel
import app.ottline.ui.layout.AdaptiveLayoutMetrics
import app.ottline.ui.layout.AdaptiveWindowMode
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
class TogetherAndAdaptiveLayoutTest {

    private lateinit var context: Context
    private lateinit var server: MockWebServer
    private lateinit var prefs: AppPreferences
    private lateinit var api: OttlineApiClient

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    private val discA = DiscussionListItem(
        id = "disc-a",
        titleId = "title-a",
        titleName = "파묘",
        titleType = TitleType.MOVIE,
        titleYear = 2024,
        commentCount = 3,
        createdAt = "2026-11-20T10:00:00Z",
        reactionSummary = DiscussionReactionSummary(done = 4, curious = 1, save = 2)
    )

    private val discB = DiscussionListItem(
        id = "disc-b",
        titleId = "title-b",
        titleName = "Dune Messiah",
        titleType = TitleType.BOOK,
        titleYear = 1969,
        commentCount = 8,
        createdAt = "2026-11-19T08:00:00Z",
        reactionSummary = DiscussionReactionSummary(done = 1, curious = 5, save = 3)
    )

    private val discC = DiscussionListItem(
        id = "disc-c",
        titleId = "title-c",
        titleName = "폭싹 속았수다",
        titleType = TitleType.SERIES,
        titleYear = 2025,
        commentCount = 5,
        createdAt = "2026-11-21T09:00:00Z",
        reactionSummary = DiscussionReactionSummary(done = 2, curious = 0, save = 1)
    )

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("ottline.native_prefs", Context.MODE_PRIVATE).edit().clear().commit()
        server = MockWebServer()
        server.start()

        prefs = AppPreferences(context)
        prefs.setDebugApiBaseUrl(server.url("/").toString().trimEnd('/'))
        prefs.saveAuth(
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            "PAIR-TOG"
        )
        api = OttlineApiClient(prefs)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun adaptiveLayoutMetrics_resolvesPhoneFoldableAndTabletBreakpointsAccurately() {
        val phone = AdaptiveLayoutMetrics.resolve(390)
        assertEquals(AdaptiveWindowMode.COMPACT, phone.mode)
        assertFalse(phone.isSpread)
        assertFalse(phone.togetherTwoPane)
        assertFalse(phone.titleDetailTwoColumn)
        assertEquals(2, phone.reportMetricColumns)

        val narrowSplit = AdaptiveLayoutMetrics.resolve(699)
        assertEquals(AdaptiveWindowMode.COMPACT, narrowSplit.mode)
        assertFalse(narrowSplit.isSpread)
        assertFalse(narrowSplit.togetherTwoPane)

        val foldableUnfolded = AdaptiveLayoutMetrics.resolve(700)
        assertEquals(AdaptiveWindowMode.TABLET_PORTRAIT, foldableUnfolded.mode)
        assertTrue(foldableUnfolded.isSpread)
        assertTrue(foldableUnfolded.togetherTwoPane)
        assertTrue(foldableUnfolded.compactHeaderRecordCta)
        assertFalse(foldableUnfolded.showHeaderTabIcons)
        assertFalse(foldableUnfolded.titleDetailTwoColumn)
        assertEquals(4, foldableUnfolded.reportMetricColumns)
        assertEquals(304, foldableUnfolded.togetherLeftPaneWidth.value.toInt())
        assertEquals(1180, foldableUnfolded.maxContentWidth.value.toInt())

        val tabletPortrait = AdaptiveLayoutMetrics.resolve(880)
        assertEquals(AdaptiveWindowMode.TABLET_PORTRAIT, tabletPortrait.mode)
        assertTrue(tabletPortrait.isSpread)
        assertTrue(tabletPortrait.togetherTwoPane)
        assertTrue(tabletPortrait.titleDetailTwoColumn)
        assertTrue(tabletPortrait.mySpaceTwoColumn)
        assertTrue(tabletPortrait.showHeaderTabIcons)
        assertFalse(tabletPortrait.compactHeaderRecordCta)

        val tabletLandscape = AdaptiveLayoutMetrics.resolve(1180)
        assertEquals(AdaptiveWindowMode.TABLET_WIDE, tabletLandscape.mode)
        assertTrue(tabletLandscape.isSpread)
        assertTrue(tabletLandscape.isWide)
        assertTrue(tabletLandscape.togetherTwoPane)
        assertTrue(tabletLandscape.bookshelfTwoColumn)
        assertEquals(356, tabletLandscape.togetherLeftPaneWidth.value.toInt())
    }

    @Test
    fun togetherFilterHelper_filtersByQueryAndType_sortsAndPreservesSelection() {
        val all = listOf(discA, discB, discC)

        val latest = TogetherFilterHelper.filterAndSort(all, query = "", contentType = "ALL", sortMode = "latest")
        assertEquals(listOf("disc-c", "disc-a", "disc-b"), latest.map { it.id })

        val mostComments = TogetherFilterHelper.filterAndSort(all, query = "", contentType = "ALL", sortMode = "comments")
        assertEquals(listOf("disc-b", "disc-c", "disc-a"), mostComments.map { it.id })

        val booksOnly = TogetherFilterHelper.filterAndSort(all, query = "", contentType = "BOOK", sortMode = "latest")
        assertEquals(listOf("disc-b"), booksOnly.map { it.id })

        val queryMatch = TogetherFilterHelper.filterAndSort(all, query = "dune", contentType = "ALL", sortMode = "latest")
        assertEquals(listOf("disc-b"), queryMatch.map { it.id })

        // Keeps existing selection if still visible
        assertEquals("disc-a", TogetherFilterHelper.resolveSelectedDiscussion(latest, "disc-a")?.id)
        // Falls back to first visible when previous selection is filtered out
        assertEquals("disc-b", TogetherFilterHelper.resolveSelectedDiscussion(booksOnly, "disc-a")?.id)
        // Empty list returns null
        assertNull(TogetherFilterHelper.resolveSelectedDiscussion(emptyList(), "disc-a"))
    }

    @Test
    fun togetherDetailSession_rapidSwitchDropsStaleCommentsAndReactions_andNeverCallsCuratorEndpoint() = runBlocking {
        val discACommentsStarted = CountDownLatch(1)
        val allowDiscAFinish = CountDownLatch(1)
        val requestedPaths = CopyOnWriteArrayList<String>()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                requestedPaths.add(path)
                return when {
                    request.method == "GET" && path.startsWith("/api/discussions/disc-a/comments") -> {
                        discACommentsStarted.countDown()
                        allowDiscAFinish.await(3, TimeUnit.SECONDS)
                        MockResponse().setResponseCode(200).setBody(
                            json.encodeToString(
                                listOf(
                                    Comment(
                                        id = "c-a1",
                                        discussionId = "disc-a",
                                        authorName = "Reader A",
                                        body = "A의 느린 댓글",
                                        createdAt = "2026-11-20T11:00:00Z"
                                    )
                                )
                            )
                        )
                    }
                    request.method == "GET" && path == "/api/discussions/disc-a/reactions/me" -> {
                        allowDiscAFinish.await(3, TimeUnit.SECONDS)
                        MockResponse().setResponseCode(200).setBody(
                            json.encodeToString(
                                DiscussionReactionState(
                                    summary = DiscussionReactionSummary(done = 99, curious = 0, save = 0),
                                    selectedTypes = listOf(DiscussionReactionType.DONE),
                                    selected = true
                                )
                            )
                        )
                    }
                    request.method == "POST" && path == "/api/discussions/disc-b/comments" -> {
                        MockResponse().setResponseCode(200).setBody(
                            json.encodeToString(
                                Comment(
                                    id = "c-b2",
                                    discussionId = "disc-b",
                                    authorName = "Me",
                                    body = "새 댓글",
                                    createdAt = "2026-11-21T11:00:00Z"
                                )
                            )
                        )
                    }
                    request.method == "GET" && path.startsWith("/api/discussions/disc-b/comments") -> {
                        MockResponse().setResponseCode(200).setBody(
                            json.encodeToString(
                                listOf(
                                    Comment(
                                        id = "c-b1",
                                        discussionId = "disc-b",
                                        authorName = "Reader B",
                                        body = "B의 실제 댓글",
                                        createdAt = "2026-11-21T10:00:00Z"
                                    )
                                )
                            )
                        )
                    }
                    request.method == "GET" && path == "/api/discussions/disc-b/reactions/me" -> {
                        MockResponse().setResponseCode(200).setBody(
                            json.encodeToString(
                                DiscussionReactionState(
                                    summary = DiscussionReactionSummary(done = 1, curious = 5, save = 3),
                                    selectedTypes = listOf(DiscussionReactionType.CURIOUS),
                                    selected = true
                                )
                            )
                        )
                    }
                    request.method == "PUT" && path == "/api/discussions/disc-b/reactions" -> {
                        MockResponse().setResponseCode(200).setBody(
                            json.encodeToString(
                                DiscussionReactionState(
                                    summary = DiscussionReactionSummary(done = 2, curious = 5, save = 3),
                                    selectedTypes = listOf(DiscussionReactionType.DONE),
                                    selected = true
                                )
                            )
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val session = TogetherDetailSession(
            api = api,
            ensureAuthenticated = { },
            dispatcher = Dispatchers.IO
        )
        try {
            // Select A (slow), then rapidly switch to B before A returns
            val jobA = session.selectDiscussion(discA, hasUser = true)
            assertTrue(discACommentsStarted.await(5, TimeUnit.SECONDS))

            val jobB = session.selectDiscussion(discB, hasUser = true)
            allowDiscAFinish.countDown()
            jobA?.join()
            jobB?.join()

            // State MUST reflect ONLY B's comments & reactions — stale A responses dropped
            val stateB = session.state.value
            assertEquals("disc-b", stateB.discussionId)
            assertFalse(stateB.commentsLoading)
            assertEquals(listOf("B의 실제 댓글"), stateB.comments.map { it.body })
            assertEquals(setOf(DiscussionReactionType.CURIOUS), stateB.selectedReactions)
            assertEquals(5, stateB.summary.curious)
            assertEquals(1, stateB.summary.done)

            // Posting a comment & toggling a reaction on B updates B cleanly
            var postedCallbackCount = 0
            session.postComment(
                discussionId = "disc-b",
                titleId = discB.titleId,
                body = "새 댓글",
                mentions = emptyList(),
                syncLog = false,
                onPosted = { postedCallbackCount++ }
            )?.join()
            assertEquals(1, postedCallbackCount)
            assertEquals(listOf("B의 실제 댓글", "새 댓글"), session.state.value.comments.map { it.body })

            var logTriggered: DiscussionReactionType? = null
            session.toggleReaction(
                discussionId = "disc-b",
                type = DiscussionReactionType.DONE,
                onNewlySelectedLogTrigger = { logTriggered = it }
            )?.join()
            assertEquals(DiscussionReactionType.DONE, logTriggered)
            assertEquals(setOf(DiscussionReactionType.DONE), session.state.value.selectedReactions)
            assertEquals(2, session.state.value.summary.done)

            // Verify zero curator endpoint calls occurred
            assertTrue(requestedPaths.none { it.contains("curated") })
        } finally {
            session.close()
        }
    }

    @Test
    fun mainViewModel_persistsTogetherSelectionSearchSortAndScrollAcrossRecreation() {
        val handle = SavedStateHandle()
        val vm1 = OttlineMainViewModel(handle)
        vm1.updateTogetherFilter {
            it.copy(
                query = "Dune",
                contentType = "BOOK",
                sortMode = "comments",
                selectedDiscussionId = "disc-b",
                scrollIndex = 4,
                scrollOffset = 120
            )
        }

        // Recreate ViewModel with the same SavedStateHandle (rotation / foldable hinge / process death)
        val vm2 = OttlineMainViewModel(handle)
        val restored = vm2.togetherFilter.value
        assertEquals("Dune", restored.query)
        assertEquals("BOOK", restored.contentType)
        assertEquals("comments", restored.sortMode)
        assertEquals("disc-b", restored.selectedDiscussionId)
        assertEquals(4, restored.scrollIndex)
        assertEquals(120, restored.scrollOffset)
    }
}
