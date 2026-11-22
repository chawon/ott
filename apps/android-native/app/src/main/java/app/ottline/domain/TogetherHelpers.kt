package app.ottline.domain

import app.ottline.data.remote.OttlineApiClient
import app.ottline.model.Comment
import app.ottline.model.CreateCommentRequest
import app.ottline.model.Discussion
import app.ottline.model.DiscussionListItem
import app.ottline.model.DiscussionReactionSummary
import app.ottline.model.DiscussionReactionType
import app.ottline.model.MentionRef
import app.ottline.model.TitleType
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Pure filtering, sorting, and selection resolution helpers for the Together ("함께") feed.
 */
object TogetherFilterHelper {

    fun filterAndSort(
        discussions: List<DiscussionListItem>,
        query: String,
        contentType: String = "ALL",
        sortMode: String = "latest"
    ): List<DiscussionListItem> {
        val q = query.trim().lowercase()
        val normalizedType = contentType.trim().uppercase()
        val filtered = discussions.filter { item ->
            val typeOk = when (normalizedType) {
                "MOVIE" -> item.titleType == TitleType.MOVIE
                "SERIES", "TV" -> item.titleType == TitleType.SERIES
                "BOOK" -> item.titleType == TitleType.BOOK
                else -> true
            }
            val queryOk = q.isEmpty() || item.titleName.lowercase().contains(q)
            typeOk && queryOk
        }
        return if (sortMode == "comments") {
            filtered.sortedWith(
                compareByDescending<DiscussionListItem> { it.commentCount }
                    .thenByDescending { RecordDate.parseInstantMillis(it.createdAt) }
            )
        } else {
            filtered.sortedByDescending { RecordDate.parseInstantMillis(it.createdAt) }
        }
    }

    /**
     * Preserves the currently selected discussion if it remains in the filtered list;
     * otherwise falls back to the first visible discussion (or null if empty).
     */
    fun resolveSelectedDiscussion(
        filtered: List<DiscussionListItem>,
        selectedDiscussionId: String?
    ): DiscussionListItem? {
        if (filtered.isEmpty()) return null
        if (!selectedDiscussionId.isNullOrBlank()) {
            filtered.firstOrNull { it.id == selectedDiscussionId }?.let { return it }
        }
        return filtered.first()
    }
}

data class TogetherDetailPaneState(
    val discussionId: String? = null,
    val titleId: String? = null,
    val summary: DiscussionReactionSummary = DiscussionReactionSummary(),
    val selectedReactions: Set<DiscussionReactionType> = emptySet(),
    val reactionBusy: Boolean = false,
    val comments: List<Comment> = emptyList(),
    val commentsLoading: Boolean = false,
    val commentsError: String? = null,
    val postingComment: Boolean = false,
    val postError: String? = null
)

/**
 * Race-safe coordinator for the right-hand Together detail pane (and standalone discussion detail).
 * Cancels superseded in-flight requests and verifies monotonic `selectionEpoch` + `discussionId`
 * before mutating UI state so a slow response from discussion A can never overwrite discussion B.
 */
class TogetherDetailSession(
    private val api: OttlineApiClient,
    private val ensureAuthenticated: suspend () -> Unit,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    private val parentJob = SupervisorJob()
    private val sessionScope = CoroutineScope(parentJob + dispatcher)
    private val selectionEpoch = AtomicLong(0L)

    @Volatile
    private var activeLoadJob: Job? = null

    private val _state = MutableStateFlow(TogetherDetailPaneState())
    val state: StateFlow<TogetherDetailPaneState> = _state.asStateFlow()

    fun selectDiscussion(
        discussion: DiscussionListItem?,
        hasUser: Boolean
    ): Job? {
        val epoch = selectionEpoch.incrementAndGet()
        activeLoadJob?.cancel()

        if (discussion == null) {
            _state.value = TogetherDetailPaneState()
            return null
        }

        val targetId = discussion.id
        _state.value = TogetherDetailPaneState(
            discussionId = targetId,
            titleId = discussion.titleId,
            summary = discussion.reactionSummary ?: DiscussionReactionSummary(),
            selectedReactions = emptySet(),
            reactionBusy = false,
            comments = emptyList(),
            commentsLoading = true,
            commentsError = null,
            postingComment = false,
            postError = null
        )

        val job = sessionScope.launch {
            try {
                coroutineScope {
                    val commentsDeferred = async {
                        runCatching { api.getComments(targetId, 200) }
                    }
                    val reactionsDeferred = if (hasUser) {
                        async {
                            runCatching { api.getMyReactions(targetId) }
                        }
                    } else {
                        null
                    }

                    val commentsResult = commentsDeferred.await()
                    if (isCurrent(epoch, targetId)) {
                        commentsResult
                            .onSuccess { list ->
                                if (isCurrent(epoch, targetId)) {
                                    _state.value = _state.value.copy(
                                        comments = list,
                                        commentsLoading = false,
                                        commentsError = null
                                    )
                                }
                            }
                            .onFailure { err ->
                                if (err is CancellationException) throw err
                                if (isCurrent(epoch, targetId)) {
                                    _state.value = _state.value.copy(
                                        commentsLoading = false,
                                        commentsError = err.message
                                    )
                                }
                            }
                    }

                    reactionsDeferred?.await()?.onSuccess { reactionState ->
                        if (isCurrent(epoch, targetId)) {
                            _state.value = _state.value.copy(
                                summary = reactionState.summary,
                                selectedReactions = reactionState.selectedTypes.toSet()
                            )
                        }
                    }
                }
            } catch (_: CancellationException) {
                // Superseded by a newer discussion selection or session close.
            }
        }
        activeLoadJob = job
        return job
    }

    fun toggleReaction(
        discussionId: String,
        type: DiscussionReactionType,
        onNewlySelectedLogTrigger: (suspend (DiscussionReactionType) -> Unit)? = null
    ): Job? {
        val epoch = selectionEpoch.get()
        val snap = _state.value
        if (snap.discussionId != discussionId || snap.reactionBusy) return null
        _state.value = snap.copy(reactionBusy = true)

        return sessionScope.launch {
            val previousSelected = snap.selectedReactions
            val result = runCatching {
                ensureAuthenticated()
                api.toggleReaction(discussionId, type)
            }
            result.onSuccess { res ->
                val nextSet = res.selectedTypes.toSet()
                val newlySelected = type in nextSet && type !in previousSelected
                if (isCurrent(epoch, discussionId)) {
                    _state.value = _state.value.copy(
                        summary = res.summary,
                        selectedReactions = nextSet,
                        reactionBusy = false
                    )
                }
                if (newlySelected) {
                    runCatching { onNewlySelectedLogTrigger?.invoke(type) }
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                if (isCurrent(epoch, discussionId)) {
                    _state.value = _state.value.copy(reactionBusy = false)
                }
            }
        }
    }

    fun postComment(
        discussionId: String,
        titleId: String,
        body: String,
        mentions: List<MentionRef>,
        syncLog: Boolean,
        onPosted: ((Comment) -> Unit)? = null
    ): Job? {
        val trimmed = body.trim()
        val epoch = selectionEpoch.get()
        val snap = _state.value
        if (trimmed.isEmpty() || snap.discussionId != discussionId || snap.postingComment) return null
        _state.value = snap.copy(postingComment = true, postError = null)

        return sessionScope.launch {
            val result = runCatching {
                ensureAuthenticated()
                val resolvedDiscussionId = discussionId.ifBlank {
                    api.createDiscussion(titleId).id
                }
                api.createComment(
                    discussionId = resolvedDiscussionId,
                    req = CreateCommentRequest(
                        body = trimmed,
                        mentions = mentions,
                        syncLog = syncLog
                    )
                )
            }
            result.onSuccess { created ->
                if (isCurrent(epoch, discussionId)) {
                    _state.value = _state.value.copy(
                        comments = _state.value.comments + created,
                        postingComment = false,
                        postError = null
                    )
                    onPosted?.invoke(created)
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                if (isCurrent(epoch, discussionId)) {
                    _state.value = _state.value.copy(
                        postingComment = false,
                        postError = err.message
                    )
                }
            }
        }
    }

    fun clear() {
        selectionEpoch.incrementAndGet()
        activeLoadJob?.cancel()
        _state.value = TogetherDetailPaneState()
    }

    fun close() {
        selectionEpoch.incrementAndGet()
        activeLoadJob?.cancel()
        parentJob.cancel()
    }

    private fun isCurrent(epoch: Long, discussionId: String): Boolean =
        selectionEpoch.get() == epoch && _state.value.discussionId == discussionId
}
