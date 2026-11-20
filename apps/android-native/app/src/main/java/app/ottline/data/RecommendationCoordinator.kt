package app.ottline.data

import app.ottline.data.local.AppPreferences
import app.ottline.data.local.RecommendationOperationKind
import app.ottline.data.local.RecommendationPendingOperation
import app.ottline.data.local.RecommendationQueue
import app.ottline.data.local.RecommendationStore
import app.ottline.data.remote.ApiException
import app.ottline.data.remote.OttlineApiClient
import app.ottline.data.remote.RecommendationApiException
import app.ottline.domain.RecommendationMatcher
import app.ottline.model.RecommendationItem
import app.ottline.model.RecommendationQuota
import app.ottline.model.RecommendationState
import app.ottline.model.TitleSearchItem
import app.ottline.model.WatchLog
import java.io.IOException
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class RecommendationErrorKind {
    LOAD,
    GENERATE
}

data class RecommendationCoordinatorConfig(
    val pollIntervalMs: Long = 1_500L,
    val pollDeadlineMs: Long = 125_000L,
    val maxTransientPollErrors: Int = 2,
    val dispatcher: CoroutineDispatcher = Dispatchers.IO,
    val uuidProvider: () -> String = { UUID.randomUUID().toString() },
    val clockMs: () -> Long = { System.currentTimeMillis() }
)

data class FutureTimelineUiState(
    val userId: String? = null,
    val locale: String = "ko",
    val server: RecommendationState? = null,
    val pendingOperations: List<RecommendationPendingOperation> = emptyList(),
    val pendingRequestId: String? = null,
    val loading: Boolean = false,
    val error: RecommendationErrorKind? = null,
    val syncError: Boolean = false,
    val lastDismissed: RecommendationItem? = null,
    val restoredItems: List<RecommendationItem> = emptyList()
) {
    val quota: RecommendationQuota?
        get() = server?.quota

    val generating: Boolean
        get() = server?.generating == true

    val eligible: Boolean
        get() = server?.eligible == true

    val pendingCount: Int
        get() = pendingOperations.size

    val canRefresh: Boolean
        get() = !loading &&
            server != null &&
            server.eligible &&
            !server.generating &&
            (server.quota.remaining > 0 || pendingRequestId != null)

    fun visibleItems(recordedLogs: List<WatchLog>): List<RecommendationItem> {
        val effectiveExclusions = RecommendationMatcher.effectiveExclusions(
            server = server?.exclusions.orEmpty(),
            operations = pendingOperations
        ).map(RecommendationMatcher::fromExclusion)

        val recordedIdentities = recordedLogs
            .filter { (it.origin ?: "LOG") == "LOG" }
            .map { RecommendationMatcher.fromTitle(it.title) }

        val restoredPending = pendingOperations.mapNotNull { op ->
            if (op.kind == RecommendationOperationKind.RESTORE) {
                op.item.toRecommendationItemOrNull()
            } else {
                null
            }
        }

        val combined = buildList {
            addAll(restoredItems)
            addAll(restoredPending)
            addAll(server?.items.orEmpty())
        }

        val deduped = mutableListOf<RecommendationItem>()
        for (candidate in combined) {
            val prevIdentities = deduped.map(RecommendationMatcher::fromRecommendation)
            if (!RecommendationMatcher.isDismissed(candidate, prevIdentities)) {
                deduped.add(candidate)
            }
        }

        return deduped.filter { item ->
            !RecommendationMatcher.isDismissed(item, effectiveExclusions) &&
                !RecommendationMatcher.isDismissed(item, recordedIdentities)
        }
    }
}

/**
 * Coordinates Future Timeline (`/api/recommendations/state`, `/generate`, `/exclusions`, `/catalog`)
 * with account+locale-scoped durable `requestId` preservation, timeout/disconnect recovery,
 * `202` polling with transient network resilience, and double-tap protection.
 */
class RecommendationCoordinator(
    private val store: RecommendationStore,
    private val prefs: AppPreferences,
    private val api: OttlineApiClient,
    private val isNetworkOnline: () -> Boolean,
    private val trackEvent: (String, Map<String, Any?>) -> Unit,
    private val config: RecommendationCoordinatorConfig = RecommendationCoordinatorConfig()
) {
    private data class UndoEntry(
        val item: RecommendationItem,
        val sourceId: String,
        var key: String? = null
    )

    private class ActiveScope(
        val userId: String,
        val deviceId: String,
        val locale: String,
        val job: Job,
        var queue: RecommendationQueue,
        var server: RecommendationState? = null,
        val autoAttemptedDates: MutableSet<String> = mutableSetOf(),
        val mutex: Mutex = Mutex(),
        @Volatile var operationInFlight: Boolean = false,
        @Volatile var reconcilePendingAfterCurrent: Boolean = false,
        var undo: UndoEntry? = null
    )

    private val parentJob = SupervisorJob()
    private val coordinatorScope = CoroutineScope(parentJob + config.dispatcher)
    private val scopeLock = Any()

    @Volatile
    private var activeScope: ActiveScope? = null

    @Volatile
    private var isActiveView: Boolean = false

    private val _uiState = MutableStateFlow(FutureTimelineUiState())
    val uiState: StateFlow<FutureTimelineUiState> = _uiState.asStateFlow()

    private fun isCurrent(scope: ActiveScope): Boolean =
        activeScope === scope &&
            scope.job.isActive &&
            prefs.current.userId == scope.userId &&
            prefs.current.deviceId == scope.deviceId

    private fun launchInScope(scope: ActiveScope, block: suspend () -> Unit): Job {
        val childScope = CoroutineScope(scope.job + config.dispatcher)
        return childScope.launch {
            block()
        }
    }

    private fun updateQueue(scope: ActiveScope, next: RecommendationQueue) {
        if (!isCurrent(scope)) return
        scope.queue = next
        store.saveQueue(scope.userId, next)
        _uiState.value = _uiState.value.copy(
            pendingOperations = next.operations,
            pendingRequestId = next.pendingRequestId(scope.locale)
        )
    }

    private fun acceptServer(scope: ActiveScope, next: RecommendationState) {
        if (!isCurrent(scope)) return
        scope.server = next
        _uiState.value = _uiState.value.copy(server = next)
    }

    /**
     * Synchronizes account + locale scope. Switching account or locale cancels in-flight work
     * for the previous scope and prevents stale responses from contaminating the new view.
     */
    fun syncScope(
        userId: String?,
        deviceId: String?,
        locale: String,
        active: Boolean
    ): Job? {
        val normLocale = RecommendationQueue.normalizeLocale(locale)
        var scopeToReload: ActiveScope? = null
        synchronized(scopeLock) {
            isActiveView = active
            val existing = activeScope
            if (userId.isNullOrBlank() || deviceId.isNullOrBlank()) {
                existing?.job?.cancel()
                activeScope = null
                _uiState.value = FutureTimelineUiState(locale = normLocale)
                return null
            }

            if (existing != null &&
                existing.userId == userId &&
                existing.deviceId == deviceId &&
                existing.locale == normLocale &&
                existing.job.isActive
            ) {
                if (active) {
                    if (existing.operationInFlight) {
                        existing.reconcilePendingAfterCurrent = true
                    } else {
                        scopeToReload = existing
                    }
                }
            } else {
                existing?.job?.cancel()
                val queue = store.importLegacyDismissedOnce(
                    userId = userId,
                    legacyDismissedNames = prefs.current.dismissedRecommendations,
                    newId = config.uuidProvider
                )
                val created = ActiveScope(
                    userId = userId,
                    deviceId = deviceId,
                    locale = normLocale,
                    job = SupervisorJob(parentJob),
                    queue = queue
                )
                activeScope = created
                _uiState.value = FutureTimelineUiState(
                    userId = userId,
                    locale = normLocale,
                    server = null,
                    pendingOperations = queue.operations,
                    pendingRequestId = queue.pendingRequestId(normLocale),
                    loading = false,
                    error = null,
                    syncError = false,
                    lastDismissed = null,
                    restoredItems = emptyList()
                )
                if (active) {
                    scopeToReload = created
                }
            }
        }
        return scopeToReload?.let { reloadInternal(it, retryPending = false) }
    }

    fun onAccountCleared(previousUserId: String?) {
        synchronized(scopeLock) {
            activeScope?.job?.cancel()
            activeScope = null
            if (!previousUserId.isNullOrBlank()) {
                store.clearUser(previousUserId)
            }
            _uiState.value = FutureTimelineUiState(locale = RecommendationQueue.normalizeLocale(prefs.current.locale))
        }
    }

    fun reload(retryPending: Boolean = false): Job? {
        val scope = activeScope ?: return null
        if (!isCurrent(scope)) return null
        return reloadInternal(scope, retryPending = retryPending)
    }

    /**
     * Triggered on app resume (`ON_RESUME`) or network availability callback.
     * If a request is already in flight, queues one follow-up reconciliation so an online event
     * arriving right before an earlier socket fails is never lost.
     */
    fun reconcileOnResumeOrReconnect(): Job? {
        if (!isActiveView) return null
        val scope = activeScope ?: return null
        if (!isCurrent(scope)) return null
        synchronized(scopeLock) {
            if (scope.operationInFlight) {
                scope.reconcilePendingAfterCurrent = true
                return null
            }
        }
        return reloadInternal(scope, retryPending = false)
    }

    /**
     * Explicit user "Explore other stories" action.
     * Distinguishes recovering an unresolved request (`pendingRequestId != null`) from starting
     * a brand new generation so accidental double-taps or post-timeout taps never charge twice.
     */
    fun generate(): Job? {
        val scope = activeScope ?: return null
        if (!isCurrent(scope)) return null

        val hasPendingId: Boolean
        synchronized(scopeLock) {
            if (scope.operationInFlight) return null
            hasPendingId = scope.queue.pendingRequestId(scope.locale) != null
            if (!hasPendingId) {
                val srv = scope.server ?: return null
                if (!srv.eligible || srv.generating || srv.quota.remaining <= 0) {
                    return null
                }
            }
            scope.operationInFlight = true
        }

        if (hasPendingId) {
            return launchInScope(scope) {
                runReloadBody(scope, retryPending = true)
            }
        }

        _uiState.value = _uiState.value.copy(loading = true, error = null)
        trackEvent("recommendation_refresh", emptyMap())
        return launchInScope(scope) {
            try {
                scope.mutex.withLock {
                    if (isCurrent(scope)) {
                        generateInsideLocked(scope)
                    }
                }
            } finally {
                finishOperationAndDrainReconcile(scope)
            }
        }
    }

    fun retry(): Job? {
        val scope = activeScope ?: return null
        if (!isCurrent(scope)) return null
        val shouldRetryPending = _uiState.value.error == RecommendationErrorKind.GENERATE ||
            scope.queue.pendingRequestId(scope.locale) != null
        return reloadInternal(scope, retryPending = shouldRetryPending)
    }

    fun dismiss(item: RecommendationItem): Job? {
        val scope = activeScope ?: return null
        if (!isCurrent(scope)) return null
        val opId = config.uuidProvider()
        val exclusionItem = item.toExclusionItem()
        val op = RecommendationPendingOperation(
            id = opId,
            kind = RecommendationOperationKind.EXCLUDE,
            item = exclusionItem
        )
        updateQueue(scope, scope.queue.copy(operations = scope.queue.operations + op))
        scope.undo = UndoEntry(item = item, sourceId = opId)
        val filteredRestored = _uiState.value.restoredItems.filterNot { prev ->
            RecommendationMatcher.isDismissed(item, listOf(RecommendationMatcher.fromRecommendation(prev)))
        }
        _uiState.value = _uiState.value.copy(
            lastDismissed = item,
            restoredItems = filteredRestored
        )
        trackEvent("recommendation_dismiss", mapOf("title" to item.name))
        return flushChangesAsync(scope)
    }

    fun undoDismiss(): Job? {
        val scope = activeScope ?: return null
        val undo = scope.undo ?: return null
        if (!isCurrent(scope)) return null
        val restoreOp = RecommendationPendingOperation(
            id = config.uuidProvider(),
            kind = RecommendationOperationKind.RESTORE,
            item = undo.item.toExclusionItem(),
            key = undo.key,
            sourceId = undo.sourceId
        )
        updateQueue(scope, scope.queue.copy(operations = scope.queue.operations + restoreOp))
        val existingRestored = _uiState.value.restoredItems
        val nextRestored = if (
            RecommendationMatcher.isDismissed(
                undo.item,
                existingRestored.map(RecommendationMatcher::fromRecommendation)
            )
        ) {
            existingRestored
        } else {
            listOf(undo.item) + existingRestored
        }
        scope.undo = null
        _uiState.value = _uiState.value.copy(
            lastDismissed = null,
            restoredItems = nextRestored
        )
        return flushChangesAsync(scope)
    }

    suspend fun searchCatalog(item: RecommendationItem): List<TitleSearchItem> {
        val scope = activeScope ?: throw IllegalStateException("No active recommendation account")
        if (!isCurrent(scope)) throw CancellationException("Recommendation scope changed")
        val remote = api.searchRecommendationCatalog(
            name = item.name,
            type = item.type,
            year = item.year,
            author = item.author,
            userId = scope.userId,
            deviceId = scope.deviceId,
            locale = scope.locale
        )
        if (!isCurrent(scope)) throw CancellationException("Recommendation scope changed")
        val combined = buildList {
            item.catalogTitle?.takeIf { it.type == item.type }?.let { add(it) }
            addAll(remote.filter { it.type == item.type })
        }
        val deduped = mutableListOf<TitleSearchItem>()
        for (candidate in combined) {
            val exists = deduped.any { prev ->
                prev.provider == candidate.provider && prev.providerId == candidate.providerId
            }
            if (!exists) deduped.add(candidate)
        }
        return deduped
    }

    fun close() {
        synchronized(scopeLock) {
            activeScope?.job?.cancel()
            activeScope = null
            parentJob.cancel()
        }
    }

    private fun reloadInternal(scope: ActiveScope, retryPending: Boolean): Job? {
        synchronized(scopeLock) {
            if (scope.operationInFlight) return null
            scope.operationInFlight = true
        }
        return launchInScope(scope) {
            runReloadBody(scope, retryPending = retryPending)
        }
    }

    private suspend fun runReloadBody(scope: ActiveScope, retryPending: Boolean) {
        try {
            scope.mutex.withLock {
                if (!isCurrent(scope)) return
                if (scope.server == null || retryPending) {
                    _uiState.value = _uiState.value.copy(loading = true)
                }
                try {
                    flushLocked(scope)
                    if (!isCurrent(scope)) return
                    val initial = readStateLocked(scope)
                    if (!isCurrent(scope)) return
                    _uiState.value = _uiState.value.copy(error = null)

                    var latest = initial
                    if (initial.generating) {
                        scope.autoAttemptedDates.add(initial.quota.date)
                        _uiState.value = _uiState.value.copy(loading = true)
                        latest = pollUntilSettledLocked(scope, initial)
                        if (!isCurrent(scope)) return
                    }

                    val pendingId = scope.queue.pendingRequestId(scope.locale)
                    if (pendingId != null) {
                        if (latest.quota.remaining == 0 || latest.generationId == pendingId) {
                            updateQueue(scope, scope.queue.withRequestId(scope.locale, null))
                            _uiState.value = _uiState.value.copy(error = null)
                        } else if (!latest.eligible) {
                            updateQueue(scope, scope.queue.withRequestId(scope.locale, null))
                            _uiState.value = _uiState.value.copy(error = null)
                        } else if (retryPending && !initial.generating) {
                            generateInsideLocked(scope)
                        } else {
                            // Do NOT mark this locale complete merely because shared quota changed
                            // (e.g., another language generated). Keep pendingId and prompt retry.
                            _uiState.value = _uiState.value.copy(error = RecommendationErrorKind.GENERATE)
                        }
                    } else if (initial.generating) {
                        if (!latest.hasBatch && latest.quota.remaining > 0) {
                            _uiState.value = _uiState.value.copy(error = RecommendationErrorKind.GENERATE)
                        }
                    } else if (
                        latest.eligible &&
                        !latest.hasBatch &&
                        latest.quota.remaining > 0 &&
                        (retryPending || latest.quota.date !in scope.autoAttemptedDates)
                    ) {
                        scope.autoAttemptedDates.add(latest.quota.date)
                        generateInsideLocked(scope)
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    if (isCurrent(scope)) {
                        val errKind = if (scope.queue.pendingRequestId(scope.locale) != null) {
                            RecommendationErrorKind.GENERATE
                        } else {
                            RecommendationErrorKind.LOAD
                        }
                        _uiState.value = _uiState.value.copy(error = errKind)
                    }
                } finally {
                    if (isCurrent(scope)) {
                        _uiState.value = _uiState.value.copy(loading = false)
                    }
                }
            }
        } finally {
            finishOperationAndDrainReconcile(scope)
        }
    }

    private fun finishOperationAndDrainReconcile(scope: ActiveScope) {
        var shouldReconcile = false
        synchronized(scopeLock) {
            scope.operationInFlight = false
            if (scope.reconcilePendingAfterCurrent && isActiveView && isCurrent(scope)) {
                scope.reconcilePendingAfterCurrent = false
                shouldReconcile = true
            } else {
                scope.reconcilePendingAfterCurrent = false
            }
        }
        if (shouldReconcile) {
            reloadInternal(scope, retryPending = false)
        }
    }

    private fun flushChangesAsync(scope: ActiveScope): Job {
        return launchInScope(scope) {
            scope.mutex.withLock {
                if (!isCurrent(scope)) return@withLock
                if (flushLocked(scope)) {
                    try {
                        readStateLocked(scope)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        if (isCurrent(scope)) {
                            _uiState.value = _uiState.value.copy(syncError = true)
                        }
                    }
                }
            }
        }
    }

    private suspend fun readStateLocked(scope: ActiveScope): RecommendationState {
        val state = api.getRecommendationState(
            userId = scope.userId,
            deviceId = scope.deviceId,
            locale = scope.locale
        )
        if (isCurrent(scope)) {
            acceptServer(scope, state)
        }
        return state
    }

    private suspend fun flushLocked(scope: ActiveScope): Boolean {
        if (!isCurrent(scope)) return false
        if (!isNetworkOnline()) return scope.queue.operations.isEmpty()
        try {
            while (isCurrent(scope) && scope.queue.operations.isNotEmpty()) {
                val operation = scope.queue.operations.first()
                var resolvedKey = operation.key
                if (operation.kind == RecommendationOperationKind.EXCLUDE || resolvedKey.isNullOrBlank()) {
                    val saved = api.putRecommendationExclusion(
                        item = operation.item,
                        userId = scope.userId,
                        deviceId = scope.deviceId,
                        locale = scope.locale
                    )
                    if (!isCurrent(scope)) return false
                    resolvedKey = saved.key
                    if (operation.kind == RecommendationOperationKind.EXCLUDE) {
                        scope.server?.let { srv ->
                            acceptServer(
                                scope,
                                srv.copy(
                                    exclusions = srv.exclusions.filterNot { it.key == resolvedKey } + saved
                                )
                            )
                        }
                        if (scope.undo?.sourceId == operation.id) {
                            scope.undo?.key = resolvedKey
                        }
                    }
                }
                if (operation.kind == RecommendationOperationKind.RESTORE) {
                    api.deleteRecommendationExclusion(
                        key = resolvedKey.orEmpty(),
                        userId = scope.userId,
                        deviceId = scope.deviceId,
                        locale = scope.locale
                    )
                    if (!isCurrent(scope)) return false
                    scope.server?.let { srv ->
                        acceptServer(
                            scope,
                            srv.copy(
                                exclusions = srv.exclusions.filterNot { it.key == resolvedKey }
                            )
                        )
                    }
                }
                val remainingOps = scope.queue.operations
                    .filterNot { it.id == operation.id }
                    .map { pending ->
                        if (pending.sourceId == operation.id) pending.copy(key = resolvedKey) else pending
                    }
                updateQueue(scope, scope.queue.copy(operations = remainingOps))
            }
            if (isCurrent(scope)) {
                _uiState.value = _uiState.value.copy(syncError = false)
            }
            return isCurrent(scope)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            if (isCurrent(scope)) {
                _uiState.value = _uiState.value.copy(syncError = true)
            }
            return false
        }
    }

    private suspend fun pollUntilSettledLocked(
        scope: ActiveScope,
        initial: RecommendationState
    ): RecommendationState {
        val deadlineAt = config.clockMs() + config.pollDeadlineMs
        var next = initial
        var consecutiveTransientErrors = 0

        while (next.generating && isCurrent(scope)) {
            val remainingMs = deadlineAt - config.clockMs()
            if (remainingMs <= 0L) {
                throw IOException("Recommendation generation is still in progress")
            }
            delay(minOf(config.pollIntervalMs, remainingMs))
            if (!isCurrent(scope)) return next

            try {
                next = readStateLocked(scope)
                consecutiveTransientErrors = 0
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                if (e.statusCode in 400..499) {
                    throw e
                }
                consecutiveTransientErrors++
                if (consecutiveTransientErrors > config.maxTransientPollErrors) {
                    throw e
                }
            } catch (e: IOException) {
                consecutiveTransientErrors++
                if (consecutiveTransientErrors > config.maxTransientPollErrors) {
                    throw e
                }
            }
        }
        return next
    }

    private suspend fun generateInsideLocked(scope: ActiveScope) {
        if (!isCurrent(scope)) return
        val existingPendingId = scope.queue.pendingRequestId(scope.locale)
        if (existingPendingId == null) {
            val srv = scope.server
            if (srv == null || !srv.eligible || srv.quota.remaining <= 0) {
                _uiState.value = _uiState.value.copy(loading = false)
                return
            }
        }

        _uiState.value = _uiState.value.copy(
            loading = true,
            error = null,
            restoredItems = emptyList()
        )

        try {
            // Persist the deliberate generation requestId BEFORE flushing exclusions so that
            // even if exclusion sync fails, retry preserves intent and idempotency key.
            val requestId = existingPendingId ?: config.uuidProvider()
            updateQueue(scope, scope.queue.withRequestId(scope.locale, requestId))

            if (!flushLocked(scope)) {
                throw IOException("Pending recommendation changes are not synced yet")
            }
            if (!isCurrent(scope)) return

            val previousGenerationId = scope.server?.generationId
            val response = api.generateRecommendations(
                requestId = requestId,
                userId = scope.userId,
                deviceId = scope.deviceId,
                locale = scope.locale
            )
            if (!isCurrent(scope)) return
            acceptServer(scope, response.state)

            val finalState = if (response.state.generating) {
                pollUntilSettledLocked(scope, response.state)
            } else {
                response.state
            }
            if (!isCurrent(scope)) return

            if (!finalState.eligible) {
                updateQueue(scope, scope.queue.withRequestId(scope.locale, null))
                _uiState.value = _uiState.value.copy(error = null)
                return
            }

            if (finalState.quota.remaining > 0 && finalState.generationId != requestId) {
                if (!finalState.hasBatch) {
                    throw IOException("There is no completed batch in this language yet")
                }
                // Shared quota can change due to another locale without updating this locale's batch.
                val beforeWait = if (response.state.generating) {
                    response.state.generationId
                } else {
                    previousGenerationId
                }
                if (response.statusCode == 202 && finalState.generationId == beforeWait) {
                    throw IOException("Concurrent generation did not complete in this language")
                }
            }

            updateQueue(scope, scope.queue.withRequestId(scope.locale, null))
            _uiState.value = _uiState.value.copy(error = null)
        } catch (e: CancellationException) {
            throw e
        } catch (e: RecommendationApiException) {
            if (!isCurrent(scope)) return
            e.state?.let { acceptServer(scope, it) }
            if (e.statusCode == 429 && e.state?.quota?.remaining == 0) {
                updateQueue(scope, scope.queue.withRequestId(scope.locale, null))
                _uiState.value = _uiState.value.copy(error = null)
            } else {
                _uiState.value = _uiState.value.copy(error = RecommendationErrorKind.GENERATE)
            }
        } catch (_: Exception) {
            if (!isCurrent(scope)) return
            // Preserve previous items & pendingRequestId so reconnect/resume/retry recovers safely.
            _uiState.value = _uiState.value.copy(error = RecommendationErrorKind.GENERATE)
        } finally {
            if (isCurrent(scope)) {
                _uiState.value = _uiState.value.copy(loading = false)
            }
        }
    }
}
