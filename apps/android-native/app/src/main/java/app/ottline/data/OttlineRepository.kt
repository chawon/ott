package app.ottline.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import app.ottline.BuildConfig
import app.ottline.QuickLogWidgetProvider
import app.ottline.RevisitReminderApiClient
import app.ottline.RevisitReminderScheduler
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.BookClassificationEntity
import app.ottline.data.local.OttlineDatabase
import app.ottline.data.local.OutboxEntity
import app.ottline.data.local.RecommendationStore
import app.ottline.data.local.TitleEntity
import app.ottline.data.local.WatchLogEntity
import app.ottline.data.local.WatchLogHistoryEntity
import app.ottline.data.remote.ApiException
import app.ottline.data.remote.OttlineApiClient
import app.ottline.domain.BookshelfBuilder
import app.ottline.domain.RecordDate
import app.ottline.model.BookClassification
import app.ottline.model.LogDraft
import app.ottline.model.PersonaKey
import app.ottline.model.Provider
import app.ottline.model.SyncChangesPayload
import app.ottline.model.SyncLogChange
import app.ottline.model.SyncLogUpsertPayload
import app.ottline.model.SyncPushRequest
import app.ottline.model.SyncTitleChange
import app.ottline.model.SyncTitleUpsertPayload
import app.ottline.model.Title
import app.ottline.model.TitleType
import app.ottline.model.TrackAnalyticsEventRequest
import app.ottline.model.UpdateUserProfileRequest
import app.ottline.model.UserProfile
import app.ottline.model.WatchLog
import app.ottline.model.WatchLogHistory
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

enum class SyncStatus {
    IDLE,
    SYNCING,
    OFFLINE,
    FAILED
}

enum class SyncFailureReason {
    AUTH,
    REQUEST,
    REJECTED
}

data class SyncState(
    val status: SyncStatus = SyncStatus.IDLE,
    val failure: SyncFailureReason? = null
)

class OttlineRepository(
    private val appContext: Context,
    val db: OttlineDatabase,
    val prefs: AppPreferences,
    val api: OttlineApiClient,
    private val scheduleBackgroundSync: (() -> Unit)? = null
) {
    private val repoScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    private val saveMutex = Mutex()
    private val syncMutex = Mutex()
    @Volatile
    private var syncRequestedAgain = false
    private val sessionId: String = UUID.randomUUID().toString()
    private val appOpenedThisSession = AtomicBoolean(false)
    private val initialDedupChecked = AtomicBoolean(false)
    private val inFlightAnalyticsJobs = ConcurrentHashMap.newKeySet<Job>()

    private val _syncState = MutableStateFlow(SyncState())
    val syncState: StateFlow<SyncState> = _syncState.asStateFlow()

    val outboxCountFlow: Flow<Int> = db.outboxDao().observeCount()

    val activeLogsFlow: Flow<List<WatchLog>> = combine(
        db.watchLogDao().observeActiveLogs(),
        db.titleDao().observeAll()
    ) { logEntities, titleEntities ->
        val titleMap = titleEntities.associate { it.id to it.toModel() }
        logEntities.map { entity ->
            val title = titleMap[entity.titleId] ?: Title(
                id = entity.titleId,
                type = TitleType.MOVIE,
                name = "Unknown"
            )
            entity.toModel(title)
        }
    }

    val bookClassificationsFlow: Flow<List<BookClassification>> =
        db.bookClassificationDao().observeAll().combine(MutableStateFlow(Unit)) { list, _ ->
            list.map { it.toModel() }
        }

    val recommendationStore: RecommendationStore = RecommendationStore(appContext)

    val recommendations: RecommendationCoordinator = RecommendationCoordinator(
        store = recommendationStore,
        prefs = prefs,
        api = api,
        isNetworkOnline = { isNetworkOnline() },
        trackEvent = { eventName, props -> trackEvent(eventName, props) }
    )

    init {
        api.onAuthRevoked = {
            repoScope.launch {
                resetLocalDataInternal()
            }
        }
    }

    private fun refreshWidgetsSafe() {
        runCatching { QuickLogWidgetProvider.updateAllWidgets(appContext) }
    }

    fun isNetworkOnline(): Boolean {
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return true
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /**
     * Ensures anonymous auth exists ONLY when explicitly needed (first log save, pairing, feedback, reactions).
     * Never called automatically on first cold launch.
     */
    suspend fun ensureAuthenticated(): Pair<String, String> {
        val snap = prefs.current
        if (!snap.userId.isNullOrBlank() && !snap.deviceId.isNullOrBlank()) {
            return snap.userId to snap.deviceId
        }
        val registered = api.register()
        prefs.saveAuth(registered.userId, registered.deviceId, registered.pairingCode)
        repoScope.launch {
            runCatching {
                RevisitReminderScheduler.bindDeviceIfAuthenticated(
                    context = appContext,
                    force = true,
                    explicitUserId = registered.userId,
                    explicitDeviceId = registered.deviceId
                )
            }
        }
        return registered.userId to registered.deviceId
    }

    private suspend fun findAllMatchingLocalTitlesLocked(
        candidate: Title,
        extraTitleId: String? = null
    ): List<Title> {
        val all = db.titleDao().getAll().map { it.toModel() }
        val targetIsbn = if (candidate.type == TitleType.BOOK) {
            BookshelfBuilder.normalizeBookIsbn13(candidate)
        } else {
            null
        }
        return all.filter { t ->
            t.id == candidate.id ||
                (extraTitleId != null && t.id == extraTitleId) ||
                (candidate.provider != null &&
                    candidate.provider != Provider.LOCAL &&
                    !candidate.providerId.isNullOrBlank() &&
                    t.provider == candidate.provider &&
                    t.providerId == candidate.providerId) ||
                (candidate.type == TitleType.BOOK &&
                    t.type == TitleType.BOOK &&
                    !targetIsbn.isNullOrBlank() &&
                    BookshelfBuilder.normalizeBookIsbn13(t) == targetIsbn)
        }
    }

    /**
     * Resolves an existing local title by ID, `provider+providerId`, or normalized `isbn13` for books,
     * preferring the canonical row that already holds an active synced watch log.
     */
    suspend fun findMatchingLocalTitle(candidate: Title): Title? {
        val matches = findAllMatchingLocalTitlesLocked(candidate)
        if (matches.isEmpty()) return null
        if (matches.size == 1) return matches.first()
        for (m in matches) {
            val active = db.watchLogDao().getActiveByTitleId(m.id)
            if (active.any { it.syncStatus == "synced" }) return m
        }
        for (m in matches) {
            if (db.watchLogDao().getActiveByTitleId(m.id).isNotEmpty()) return m
        }
        return matches.firstOrNull { it.id == candidate.id } ?: matches.firstOrNull()
    }

    private data class LocalSaveOutcome(
        val effectiveTitle: Title,
        val logModel: WatchLog,
        val isNewLog: Boolean,
        val isFirstEverActiveLog: Boolean
    )

    /**
     * Local-first save (create or update) for a title's watch/read log + Outbox enqueue + async sync.
     * Protected by `saveMutex` and monotonic `OutboxEntity.revision` so rapid edits while a sync push
     * is in flight can never drop the newer revision (F01).
     */
    suspend fun saveLogForTitle(
        rawTitle: Title,
        draft: LogDraft,
        awaitSync: Boolean = false,
        existingLogId: String? = null
    ): WatchLog {
        val outcome = saveMutex.withLock {
            val now = RecordDate.nowIso()
            val hadActiveLogsBefore = db.watchLogDao().getActiveLogs().isNotEmpty()
            val explicitLog = existingLogId?.takeIf { it.isNotBlank() }
                ?.let { db.watchLogDao().getById(it) }
                ?.takeIf { it.deletedAt == null }
            val matchingTitles = findAllMatchingLocalTitlesLocked(rawTitle, explicitLog?.titleId)
            val matchedTitle = explicitLog?.let { l ->
                matchingTitles.firstOrNull { it.id == l.titleId }
                    ?: db.titleDao().getById(l.titleId)?.toModel()
            } ?: matchingTitles.firstOrNull { m ->
                db.watchLogDao().getActiveByTitleId(m.id).any { it.syncStatus == "synced" }
            } ?: matchingTitles.firstOrNull { m ->
                db.watchLogDao().getActiveByTitleId(m.id).isNotEmpty()
            } ?: matchingTitles.firstOrNull { it.id == rawTitle.id }
                ?: matchingTitles.firstOrNull()

            val keepMatchedExternalProvider = matchedTitle?.provider != null &&
                matchedTitle.provider != Provider.LOCAL &&
                (rawTitle.provider == null || rawTitle.provider == Provider.LOCAL)
            val effectiveProvider = if (keepMatchedExternalProvider) {
                matchedTitle?.provider
            } else {
                rawTitle.provider ?: matchedTitle?.provider
            }
            val effectiveProviderId = if (keepMatchedExternalProvider) {
                matchedTitle?.providerId
            } else {
                rawTitle.providerId ?: matchedTitle?.providerId
            }

            val effectiveTitle = (matchedTitle ?: rawTitle).copy(
                name = rawTitle.name.ifBlank { matchedTitle?.name.orEmpty() },
                posterUrl = rawTitle.posterUrl ?: matchedTitle?.posterUrl,
                year = rawTitle.year ?: matchedTitle?.year,
                genres = rawTitle.genres ?: matchedTitle?.genres,
                directors = rawTitle.directors ?: matchedTitle?.directors,
                cast = rawTitle.cast ?: matchedTitle?.cast,
                overview = rawTitle.overview ?: matchedTitle?.overview,
                author = rawTitle.author ?: matchedTitle?.author,
                publisher = rawTitle.publisher ?: matchedTitle?.publisher,
                isbn10 = rawTitle.isbn10 ?: matchedTitle?.isbn10,
                isbn13 = rawTitle.isbn13 ?: matchedTitle?.isbn13,
                pubdate = rawTitle.pubdate ?: matchedTitle?.pubdate,
                provider = effectiveProvider,
                providerId = effectiveProviderId,
                updatedAt = now
            )
            db.titleDao().upsert(TitleEntity.fromModel(effectiveTitle))

            for (dupTitle in matchingTitles) {
                if (dupTitle.id != effectiveTitle.id) {
                    db.watchLogDao().remapTitleId(oldTitleId = dupTitle.id, newTitleId = effectiveTitle.id)
                    remapOutboxTitleIdLocked(oldTitleId = dupTitle.id, newTitleId = effectiveTitle.id)
                    db.titleDao().deleteById(dupTitle.id)
                }
            }

            val activeForEffective = db.watchLogDao().getActiveByTitleId(effectiveTitle.id)
            val existingLog = explicitLog?.let { exp ->
                activeForEffective.firstOrNull { it.id == exp.id } ?: exp.copy(titleId = effectiveTitle.id)
            } ?: activeForEffective.firstOrNull { it.syncStatus == "synced" }
                ?: activeForEffective.firstOrNull()
            val logId = existingLog?.id ?: UUID.randomUUID().toString()
            for (dupLog in activeForEffective) {
                if (dupLog.id != logId) {
                    db.watchLogHistoryDao().remapLogId(oldLogId = dupLog.id, newLogId = logId)
                    db.outboxDao().deleteByTargetLogId(dupLog.id)
                    db.watchLogDao().deleteById(dupLog.id)
                }
            }
            val createdAt = existingLog?.createdAt ?: now
            val watchedAt = RecordDate.resolveWatchedAt(
                selectedDate = RecordDate.recordDateInput(draft.watchedAt),
                previousIso = existingLog?.watchedAt ?: draft.watchedAt
            )

            if (!draft.ott.isNullOrBlank()) {
                prefs.addCustomPlatform(effectiveTitle.type == TitleType.BOOK, draft.ott)
            }

            val logModel = WatchLog(
                id = logId,
                title = effectiveTitle,
                status = draft.status,
                rating = draft.rating,
                note = draft.note?.trim()?.takeIf { it.isNotEmpty() },
                spoiler = draft.spoiler,
                ott = draft.ott?.trim()?.takeIf { it.isNotEmpty() },
                seasonNumber = draft.seasonNumber,
                episodeNumber = draft.episodeNumber,
                seasonPosterUrl = draft.seasonPosterUrl,
                seasonYear = draft.seasonYear,
                origin = draft.origin,
                syncStatus = "pending",
                updatedAt = now,
                deletedAt = null,
                watchedAt = watchedAt,
                place = draft.place,
                occasion = draft.occasion,
                createdAt = createdAt
            )

            db.watchLogDao().upsert(WatchLogEntity.fromModel(logModel))
            db.watchLogHistoryDao().upsert(
                WatchLogHistoryEntity.fromModel(
                    WatchLogHistory(
                        id = UUID.randomUUID().toString(),
                        logId = logId,
                        recordedAt = now,
                        status = logModel.status,
                        rating = logModel.rating,
                        note = logModel.note,
                        spoiler = logModel.spoiler,
                        ott = logModel.ott,
                        seasonNumber = logModel.seasonNumber,
                        episodeNumber = logModel.episodeNumber,
                        seasonPosterUrl = logModel.seasonPosterUrl,
                        seasonYear = logModel.seasonYear,
                        origin = logModel.origin,
                        watchedAt = logModel.watchedAt,
                        place = logModel.place,
                        occasion = logModel.occasion
                    )
                )
            )

            val logChange = SyncLogChange(
                id = logId,
                op = "upsert",
                updatedAt = now,
                payload = SyncLogUpsertPayload(
                    titleId = effectiveTitle.id,
                    status = logModel.status,
                    rating = logModel.rating,
                    note = logModel.note,
                    ott = logModel.ott,
                    seasonNumber = logModel.seasonNumber,
                    episodeNumber = logModel.episodeNumber,
                    seasonPosterUrl = logModel.seasonPosterUrl,
                    seasonYear = logModel.seasonYear,
                    origin = logModel.origin ?: "LOG",
                    spoiler = logModel.spoiler,
                    watchedAt = logModel.watchedAt,
                    place = logModel.place,
                    occasion = logModel.occasion
                )
            )
            val titleChange = SyncTitleChange(
                id = effectiveTitle.id,
                op = "upsert",
                updatedAt = now,
                payload = SyncTitleUpsertPayload(
                    type = effectiveTitle.type,
                    name = effectiveTitle.name,
                    year = effectiveTitle.year,
                    genres = effectiveTitle.genres,
                    directors = effectiveTitle.directors,
                    cast = effectiveTitle.cast,
                    overview = effectiveTitle.overview,
                    posterUrl = effectiveTitle.posterUrl,
                    author = effectiveTitle.author,
                    publisher = effectiveTitle.publisher,
                    isbn10 = effectiveTitle.isbn10,
                    isbn13 = effectiveTitle.isbn13,
                    pubdate = effectiveTitle.pubdate,
                    provider = effectiveTitle.provider,
                    providerId = effectiveTitle.providerId
                )
            )

            val pendingForLog = db.outboxDao().getByTargetLogId(logId)
            val outboxId = pendingForLog?.id ?: UUID.randomUUID().toString()
            val outboxType = pendingForLog?.type ?: if (existingLog == null) "create_log" else "update_log"
            val nextRevision = (pendingForLog?.revision ?: 0L) + 1L

            db.outboxDao().upsert(
                OutboxEntity(
                    id = outboxId,
                    type = outboxType,
                    targetLogId = logId,
                    logChangeJson = json.encodeToString(logChange),
                    titleChangeJson = json.encodeToString(titleChange),
                    createdAt = pendingForLog?.createdAt ?: now,
                    lastError = null,
                    revision = nextRevision
                )
            )

            LocalSaveOutcome(
                effectiveTitle = effectiveTitle,
                logModel = logModel,
                isNewLog = existingLog == null,
                isFirstEverActiveLog = existingLog == null && !hadActiveLogsBefore
            )
        }

        refreshWidgetsSafe()
        prefs.incrementNativeLogSavesCount()

        if (outcome.isNewLog) {
            val eventProps = mapOf(
                "contentType" to outcome.effectiveTitle.type.wireValue,
                "status" to outcome.logModel.status.name,
                "hasNote" to (outcome.logModel.note != null),
                "hasPlace" to (outcome.logModel.place != null),
                "hasOccasion" to (outcome.logModel.occasion != null),
                "origin" to (outcome.logModel.origin ?: "LOG")
            )
            if (outcome.isFirstEverActiveLog) {
                trackEvent("first_log_create", eventProps)
            }
            trackEvent("log_create", eventProps)
        }

        if (outcome.effectiveTitle.type == TitleType.BOOK) {
            repoScope.launch {
                ensureBookClassificationsCached(listOf(outcome.effectiveTitle))
            }
        }

        return if (awaitSync) {
            syncOutbox()
            getCanonicalLogAfterSync(outcome.effectiveTitle, outcome.logModel.id) ?: outcome.logModel
        } else {
            triggerSyncAsync()
            outcome.logModel
        }
    }

    private suspend fun getCanonicalLogAfterSync(originalTitle: Title, fallbackLogId: String): WatchLog? {
        val canonicalTitle = findMatchingLocalTitle(originalTitle) ?: originalTitle
        val logEntity = db.watchLogDao().getActiveByTitleId(canonicalTitle.id).firstOrNull()
            ?: db.watchLogDao().getById(fallbackLogId)
            ?: return null
        val title = db.titleDao().getById(logEntity.titleId)?.toModel() ?: canonicalTitle
        return logEntity.toModel(title)
    }

    fun triggerSyncAsync() {
        repoScope.launch {
            syncOutbox()
        }
    }

    /**
     * Mutex-guarded Outbox push + pull + canonical ID remapping (faithful port of `sync.ts` with F01 + F02 protection).
     */
    suspend fun syncOutbox(): SyncState {
        syncRequestedAgain = true
        if (syncMutex.isLocked) {
            return syncMutex.withLock { _syncState.value }
        }
        return syncMutex.withLock {
            var latestState = _syncState.value
            while (syncRequestedAgain) {
                syncRequestedAgain = false
                latestState = runSingleSyncCycle()
                _syncState.value = latestState
            }
            latestState
        }
    }

    private suspend fun runSingleSyncCycle(): SyncState {
        if (initialDedupChecked.compareAndSet(false, true)) {
            deduplicateLocalRecordsIfNeeded()
        }
        val items = saveMutex.withLock { db.outboxDao().getAll() }
        val hasStoredUser = !prefs.current.userId.isNullOrBlank()
        if (items.isEmpty() && !hasStoredUser) {
            return SyncState(SyncStatus.IDLE, null)
        }

        if (!isNetworkOnline()) {
            if (items.isNotEmpty()) {
                scheduleBackgroundSync?.invoke()
            }
            return SyncState(SyncStatus.OFFLINE, null)
        }

        _syncState.value = SyncState(SyncStatus.SYNCING, null)

        val (userId, deviceId) = try {
            ensureAuthenticated()
        } catch (_: Exception) {
            if (items.isNotEmpty()) scheduleBackgroundSync?.invoke()
            return SyncState(SyncStatus.FAILED, SyncFailureReason.AUTH)
        }

        var pushFailure: SyncFailureReason? = null
        for (item in items) {
            val sentRevision = item.revision
            try {
                val logChange = json.decodeFromString<SyncLogChange>(item.logChangeJson)
                val titleChange = item.titleChangeJson?.let { json.decodeFromString<SyncTitleChange>(it) }
                val res = api.pushSync(
                    SyncPushRequest(
                        userId = userId,
                        deviceId = deviceId,
                        clientTime = RecordDate.nowIso(),
                        changes = SyncChangesPayload(
                            logs = listOf(logChange),
                            titles = listOfNotNull(titleChange)
                        )
                    )
                )
                val rejectedIds = res.rejected.map { it.id }.toSet()
                if (logChange.id in rejectedIds) {
                    saveMutex.withLock {
                        val currentItem = db.outboxDao().getAll().firstOrNull { it.id == item.id }
                        if (currentItem != null && currentItem.revision == sentRevision) {
                            db.outboxDao().updateError(item.id, "Sync rejected")
                            db.watchLogDao().updateSyncStatus(currentItem.targetLogId, "failed")
                        } else {
                            syncRequestedAgain = true
                        }
                    }
                    if (!syncRequestedAgain) {
                        pushFailure = SyncFailureReason.REJECTED
                        break
                    }
                    continue
                }

                val revisionMatched = saveMutex.withLock {
                    val currentItem = db.outboxDao().getAll().firstOrNull { it.id == item.id }
                    val targetIdAfterPush = currentItem?.targetLogId ?: item.targetLogId
                    val deleted = db.outboxDao().deleteIfRevisionMatches(item.id, sentRevision)
                    if (deleted > 0) {
                        db.watchLogDao().updateSyncStatus(targetIdAfterPush, "synced")
                        true
                    } else {
                        false
                    }
                }
                if (!revisionMatched) {
                    // User saved a newer revision while pushSync was in flight; re-run loop immediately!
                    syncRequestedAgain = true
                }
            } catch (e: Exception) {
                saveMutex.withLock {
                    val currentItem = db.outboxDao().getAll().firstOrNull { it.id == item.id }
                    if (currentItem != null && currentItem.revision == sentRevision) {
                        db.outboxDao().updateError(item.id, e.message ?: "Sync failed")
                        db.watchLogDao().updateSyncStatus(currentItem.targetLogId, "failed")
                    } else {
                        syncRequestedAgain = true
                    }
                }
                pushFailure = if (e is ApiException && e.statusCode == 401) {
                    SyncFailureReason.AUTH
                } else {
                    SyncFailureReason.REQUEST
                }
                scheduleBackgroundSync?.invoke()
                break
            }
        }

        try {
            pullChangesInternal()
        } catch (_: Exception) {
            if (pushFailure == null && items.isNotEmpty()) {
                pushFailure = SyncFailureReason.REQUEST
            }
        }

        refreshWidgetsSafe()

        return if (pushFailure != null) {
            SyncState(SyncStatus.FAILED, pushFailure)
        } else {
            SyncState(SyncStatus.IDLE, null)
        }
    }

    private suspend fun remapOutboxTitleIdLocked(oldTitleId: String, newTitleId: String) {
        if (oldTitleId == newTitleId) return
        val allOutbox = db.outboxDao().getAll()
        for (entry in allOutbox) {
            val logChange = runCatching { json.decodeFromString<SyncLogChange>(entry.logChangeJson) }.getOrNull() ?: continue
            val titleChange = entry.titleChangeJson?.let {
                runCatching { json.decodeFromString<SyncTitleChange>(it) }.getOrNull()
            }
            val needsLogUpdate = logChange.payload?.titleId == oldTitleId
            val needsTitleUpdate = titleChange?.id == oldTitleId
            if (!needsLogUpdate && !needsTitleUpdate) continue

            val nextLogChange = if (needsLogUpdate) {
                logChange.copy(payload = logChange.payload?.copy(titleId = newTitleId))
            } else {
                logChange
            }
            val nextTitleChange = if (needsTitleUpdate) {
                titleChange.copy(id = newTitleId)
            } else {
                titleChange
            }
            db.outboxDao().remapIds(
                id = entry.id,
                newLogId = entry.targetLogId,
                logJson = json.encodeToString(nextLogChange),
                titleJson = nextTitleChange?.let { json.encodeToString(it) }
            )
        }
    }

    private suspend fun remapOutboxLogAndTitleIdLocked(
        oldLogId: String,
        newLogId: String,
        newTitleId: String
    ) {
        val entry = db.outboxDao().getByTargetLogId(oldLogId) ?: return
        val logChange = runCatching { json.decodeFromString<SyncLogChange>(entry.logChangeJson) }.getOrNull() ?: return
        val titleChange = entry.titleChangeJson?.let {
            runCatching { json.decodeFromString<SyncTitleChange>(it) }.getOrNull()
        }
        val nextLogChange = logChange.copy(
            id = newLogId,
            payload = logChange.payload?.copy(titleId = newTitleId)
        )
        val nextTitleChange = titleChange?.copy(id = newTitleId)
        db.outboxDao().remapIds(
            id = entry.id,
            newLogId = newLogId,
            logJson = json.encodeToString(nextLogChange),
            titleJson = nextTitleChange?.let { json.encodeToString(it) }
        )
    }

    private suspend fun pullChangesInternal() {
        val since = prefs.current.lastSyncAt
        val pull = api.pullSync(since)

        val pulledTitleIds = pull.changes.titles.mapTo(HashSet()) { it.id }
        val missingTitleIds = pull.changes.logs
            .filter { it.deletedAt.isNullOrBlank() && it.titleId.isNotBlank() && it.titleId !in pulledTitleIds }
            .map { it.titleId }
            .distinct()
            .filter { db.titleDao().getById(it) == null }
        val fetchedMissingTitles = mutableMapOf<String, Title>()
        for (tid in missingTitleIds) {
            runCatching { api.getTitle(tid) }.getOrNull()?.let { fetchedMissingTitles[tid] = it }
        }

        saveMutex.withLock {
            val pulledTitles = mutableMapOf<String, Title>()

            for (serverTitle in pull.changes.titles + fetchedMissingTitles.values) {
                if (pulledTitles.containsKey(serverTitle.id)) continue
                pulledTitles[serverTitle.id] = serverTitle
                val localMatches = findAllMatchingLocalTitlesLocked(serverTitle)
                for (existingLocal in localMatches) {
                    if (existingLocal.id != serverTitle.id) {
                        db.watchLogDao().remapTitleId(oldTitleId = existingLocal.id, newTitleId = serverTitle.id)
                        remapOutboxTitleIdLocked(oldTitleId = existingLocal.id, newTitleId = serverTitle.id)
                        db.titleDao().deleteById(existingLocal.id)
                    }
                }
                db.titleDao().upsert(TitleEntity.fromModel(serverTitle))
            }

            for (serverLog in pull.changes.logs) {
                val preRemapById = db.watchLogDao().getById(serverLog.id)
                if (preRemapById != null && preRemapById.titleId != serverLog.titleId) {
                    val oldTitleId = preRemapById.titleId
                    val oldTitleEntity = db.titleDao().getById(oldTitleId)
                    if (pulledTitles[serverLog.titleId] == null &&
                        db.titleDao().getById(serverLog.titleId) == null &&
                        oldTitleEntity != null
                    ) {
                        val copied = oldTitleEntity.copy(id = serverLog.titleId)
                        db.titleDao().upsert(copied)
                        pulledTitles[serverLog.titleId] = copied.toModel()
                    }
                    db.watchLogDao().remapTitleId(oldTitleId = oldTitleId, newTitleId = serverLog.titleId)
                    remapOutboxTitleIdLocked(oldTitleId = oldTitleId, newTitleId = serverLog.titleId)
                    db.titleDao().deleteById(oldTitleId)
                }

                val localById = db.watchLogDao().getById(serverLog.id)
                val previousLocalForTitle = db.watchLogDao().getActiveByTitleId(serverLog.titleId)
                val primaryLocal = localById ?: previousLocalForTitle.firstOrNull()
                val pendingOutbox = primaryLocal?.let { db.outboxDao().getByTargetLogId(it.id) }
                    ?: db.outboxDao().getByTargetLogId(serverLog.id)
                val hasUnsyncedLocal = primaryLocal != null && (
                    primaryLocal.syncStatus == "pending" ||
                        primaryLocal.syncStatus == "failed" ||
                        pendingOutbox != null
                )

                if (!serverLog.deletedAt.isNullOrBlank()) {
                    if (!hasUnsyncedLocal) {
                        db.watchLogDao().markDeleted(
                            id = serverLog.id,
                            deletedAt = serverLog.deletedAt,
                            updatedAt = serverLog.updatedAt ?: serverLog.deletedAt,
                            syncStatus = "synced"
                        )
                    }
                    continue
                }

                val resolvedTitle = pulledTitles[serverLog.titleId]
                    ?: db.titleDao().getById(serverLog.titleId)?.toModel()
                    ?: Title(id = serverLog.titleId, type = TitleType.MOVIE, name = "Unknown")

                for (prev in previousLocalForTitle) {
                    if (prev.id != serverLog.id) {
                        db.watchLogHistoryDao().remapLogId(oldLogId = prev.id, newLogId = serverLog.id)
                        remapOutboxLogAndTitleIdLocked(
                            oldLogId = prev.id,
                            newLogId = serverLog.id,
                            newTitleId = serverLog.titleId
                        )
                    }
                }
                db.watchLogDao().deleteByTitleExcept(titleId = serverLog.titleId, keepLogId = serverLog.id)

                if (hasUnsyncedLocal) {
                    val preservedLocalModel = primaryLocal.toModel(resolvedTitle).copy(
                        id = serverLog.id,
                        title = resolvedTitle,
                        syncStatus = if (primaryLocal.syncStatus == "failed") "failed" else "pending"
                    )
                    db.watchLogDao().upsert(WatchLogEntity.fromModel(preservedLocalModel))
                } else {
                    val merged = WatchLog(
                        id = serverLog.id,
                        title = resolvedTitle,
                        status = serverLog.status,
                        rating = serverLog.rating,
                        note = serverLog.note,
                        spoiler = serverLog.spoiler,
                        ott = serverLog.ott,
                        seasonNumber = serverLog.seasonNumber,
                        episodeNumber = serverLog.episodeNumber,
                        seasonPosterUrl = serverLog.seasonPosterUrl,
                        seasonYear = serverLog.seasonYear,
                        origin = serverLog.origin ?: "LOG",
                        syncStatus = "synced",
                        updatedAt = serverLog.updatedAt ?: serverLog.createdAt,
                        deletedAt = null,
                        watchedAt = serverLog.watchedAt,
                        place = serverLog.place,
                        occasion = serverLog.occasion,
                        createdAt = serverLog.createdAt
                    )
                    db.watchLogDao().upsert(WatchLogEntity.fromModel(merged))
                }
            }
        }

        if (pull.serverTime.isNotBlank()) {
            prefs.setLastSyncAt(pull.serverTime)
        }
    }

    /**
     * Safely caches paginated or remote logs into Room WITHOUT overwriting local pending/failed
     * edits or newer local timestamps (F02), while consolidating duplicate local title/log IDs.
     */
    suspend fun upsertLogsFromServerPage(logs: List<WatchLog>) {
        if (logs.isEmpty()) return
        saveMutex.withLock {
            for (incoming in logs) {
                val existingById = db.watchLogDao().getById(incoming.id)
                val localMatches = findAllMatchingLocalTitlesLocked(incoming.title, existingById?.titleId)
                val candidateLogs = buildList {
                    if (existingById != null) add(existingById)
                    for (m in localMatches) {
                        addAll(db.watchLogDao().getActiveByTitleId(m.id))
                    }
                }.distinctBy { it.id }

                val hasUnsyncedLocal = candidateLogs.any { local ->
                    local.syncStatus == "pending" ||
                        local.syncStatus == "failed" ||
                        db.outboxDao().getByTargetLogId(local.id) != null ||
                        local.deletedAt != null
                }
                if (hasUnsyncedLocal) {
                    continue
                }

                db.titleDao().upsert(TitleEntity.fromModel(incoming.title))
                for (dupTitle in localMatches) {
                    if (dupTitle.id != incoming.title.id) {
                        db.watchLogDao().remapTitleId(oldTitleId = dupTitle.id, newTitleId = incoming.title.id)
                        remapOutboxTitleIdLocked(oldTitleId = dupTitle.id, newTitleId = incoming.title.id)
                        db.titleDao().deleteById(dupTitle.id)
                    }
                }

                val activeForTitle = db.watchLogDao().getActiveByTitleId(incoming.title.id)
                val primaryExisting = db.watchLogDao().getById(incoming.id) ?: activeForTitle.firstOrNull()
                if (primaryExisting != null) {
                    val localUpdatedMs = RecordDate.parseInstantMillis(primaryExisting.updatedAt)
                    val incomingUpdatedMs = RecordDate.parseInstantMillis(incoming.updatedAt ?: incoming.createdAt)
                    val isLocalNewer = localUpdatedMs > 0L && incomingUpdatedMs > 0L && localUpdatedMs > incomingUpdatedMs
                    if (isLocalNewer) {
                        if (activeForTitle.size > 1) {
                            db.watchLogDao().deleteByTitleExcept(incoming.title.id, primaryExisting.id)
                        }
                        continue
                    }
                }

                for (prev in activeForTitle) {
                    if (prev.id != incoming.id) {
                        db.watchLogHistoryDao().remapLogId(oldLogId = prev.id, newLogId = incoming.id)
                        db.outboxDao().deleteByTargetLogId(prev.id)
                    }
                }
                db.watchLogDao().deleteByTitleExcept(titleId = incoming.title.id, keepLogId = incoming.id)

                db.watchLogDao().upsert(
                    WatchLogEntity.fromModel(
                        incoming.copy(syncStatus = "synced")
                    )
                )
            }
        }
        refreshWidgetsSafe()
    }

    /**
     * One-time / startup self-healing pass for devices that accumulated duplicate local Title or WatchLog
     * rows during earlier 2-step QuickRecord flows. Returns true if any duplicates were consolidated.
     */
    suspend fun deduplicateLocalRecordsIfNeeded(): Boolean {
        initialDedupChecked.set(true)
        val cleaned = saveMutex.withLock {
            var modified = false

            // 1. Consolidate duplicate Title rows sharing external identity (provider+providerId or book ISBN-13)
            val allTitles = db.titleDao().getAll()
            if (allTitles.size > 1) {
                val parent = IntArray(allTitles.size) { it }
                fun find(x: Int): Int {
                    var r = x
                    while (parent[r] != r) r = parent[r]
                    var curr = x
                    while (curr != r) {
                        val next = parent[curr]
                        parent[curr] = r
                        curr = next
                    }
                    return r
                }
                fun union(a: Int, b: Int) {
                    val ra = find(a)
                    val rb = find(b)
                    if (ra != rb) parent[rb] = ra
                }

                val byProvider = LinkedHashMap<String, MutableList<Int>>()
                val byBookIsbn = LinkedHashMap<String, MutableList<Int>>()
                for (i in allTitles.indices) {
                    val t = allTitles[i]
                    val prov = t.provider?.trim()
                    val provId = t.providerId?.trim()
                    if (!prov.isNullOrEmpty() && !prov.equals("LOCAL", ignoreCase = true) && !provId.isNullOrEmpty()) {
                        byProvider.getOrPut("${prov.uppercase()}:$provId") { mutableListOf() }.add(i)
                    }
                    if (t.type.equals("book", ignoreCase = true)) {
                        val isbn = BookshelfBuilder.normalizeBookIsbn13(t.toModel())
                        if (!isbn.isNullOrBlank()) {
                            byBookIsbn.getOrPut(isbn) { mutableListOf() }.add(i)
                        }
                    }
                }
                for (indices in byProvider.values) {
                    for (k in 1 until indices.size) union(indices[0], indices[k])
                }
                for (indices in byBookIsbn.values) {
                    for (k in 1 until indices.size) union(indices[0], indices[k])
                }

                val components = LinkedHashMap<Int, MutableList<TitleEntity>>()
                for (i in allTitles.indices) {
                    components.getOrPut(find(i)) { mutableListOf() }.add(allTitles[i])
                }

                val activeLogsByTitle = db.watchLogDao().getActiveLogs().groupBy { it.titleId }
                for (group in components.values) {
                    if (group.size <= 1) continue
                    val winner = group.sortedWith(
                        compareBy<TitleEntity>(
                            { t ->
                                val logs = activeLogsByTitle[t.id].orEmpty()
                                if (logs.any { it.syncStatus == "synced" }) 0 else if (logs.isNotEmpty()) 1 else 2
                            },
                            { t ->
                                activeLogsByTitle[t.id].orEmpty()
                                    .minOfOrNull { RecordDate.parseInstantMillis(it.createdAt) }
                                    ?: Long.MAX_VALUE
                            }
                        )
                    ).first()

                    var mergedWinner = winner
                    for (other in group) {
                        if (other.id == winner.id) continue
                        mergedWinner = mergedWinner.copy(
                            year = mergedWinner.year ?: other.year,
                            genresJson = mergedWinner.genresJson ?: other.genresJson,
                            directorsJson = mergedWinner.directorsJson ?: other.directorsJson,
                            castJson = mergedWinner.castJson ?: other.castJson,
                            overview = mergedWinner.overview?.takeIf { it.isNotBlank() } ?: other.overview,
                            posterUrl = mergedWinner.posterUrl?.takeIf { it.isNotBlank() } ?: other.posterUrl,
                            author = mergedWinner.author?.takeIf { it.isNotBlank() } ?: other.author,
                            publisher = mergedWinner.publisher?.takeIf { it.isNotBlank() } ?: other.publisher,
                            isbn10 = mergedWinner.isbn10?.takeIf { it.isNotBlank() } ?: other.isbn10,
                            isbn13 = mergedWinner.isbn13?.takeIf { it.isNotBlank() } ?: other.isbn13,
                            pubdate = mergedWinner.pubdate?.takeIf { it.isNotBlank() } ?: other.pubdate
                        )
                    }
                    db.titleDao().upsert(mergedWinner)
                    for (loser in group) {
                        if (loser.id != mergedWinner.id) {
                            db.watchLogDao().remapTitleId(oldTitleId = loser.id, newTitleId = mergedWinner.id)
                            remapOutboxTitleIdLocked(oldTitleId = loser.id, newTitleId = mergedWinner.id)
                            db.titleDao().deleteById(loser.id)
                        }
                    }
                    modified = true
                }
            }

            // 2. Consolidate duplicate active WatchLog rows pointing to the same titleId
            val logsByTitle = db.watchLogDao().getActiveLogs().groupBy { it.titleId }
            for ((titleId, logsForTitle) in logsByTitle) {
                if (logsForTitle.size <= 1) continue

                val latestContent = logsForTitle.maxWithOrNull(
                    compareBy<WatchLogEntity> { RecordDate.parseInstantMillis(it.updatedAt) }
                        .thenBy { RecordDate.parseInstantMillis(it.createdAt) }
                ) ?: logsForTitle.first()

                val winnerIdentity = logsForTitle.firstOrNull { db.outboxDao().getByTargetLogId(it.id) != null }
                    ?: logsForTitle.minWithOrNull(
                        compareBy<WatchLogEntity> { RecordDate.parseInstantMillis(it.createdAt) }
                            .thenBy { it.id }
                    )
                    ?: latestContent

                val hasAnyOutbox = logsForTitle.any { db.outboxDao().getByTargetLogId(it.id) != null }
                val mergedSyncStatus = if (hasAnyOutbox || logsForTitle.any { it.syncStatus == "pending" }) {
                    "pending"
                } else {
                    winnerIdentity.syncStatus
                }
                val merged = latestContent.copy(
                    id = winnerIdentity.id,
                    titleId = titleId,
                    createdAt = winnerIdentity.createdAt,
                    syncStatus = mergedSyncStatus
                )
                db.watchLogDao().upsert(merged)

                for (loser in logsForTitle) {
                    if (loser.id == winnerIdentity.id) continue
                    db.watchLogHistoryDao().remapLogId(oldLogId = loser.id, newLogId = winnerIdentity.id)
                    if (db.outboxDao().getByTargetLogId(winnerIdentity.id) == null &&
                        db.outboxDao().getByTargetLogId(loser.id) != null
                    ) {
                        remapOutboxLogAndTitleIdLocked(
                            oldLogId = loser.id,
                            newLogId = winnerIdentity.id,
                            newTitleId = titleId
                        )
                    } else {
                        db.outboxDao().deleteByTargetLogId(loser.id)
                    }
                    db.watchLogDao().deleteById(loser.id)
                }
                modified = true
            }

            modified
        }

        if (cleaned) {
            prefs.setLastSyncAt(null)
            refreshWidgetsSafe()
        }
        return cleaned
    }

    suspend fun pairWithCode(code: String): AuthPairResult {
        val oldUserId = prefs.current.userId
        if (!oldUserId.isNullOrBlank()) {
            runCatching { syncOutbox() }
        }
        val res = api.pair(code = code.trim(), oldUserId = oldUserId)
        prefs.setLastSyncAt(null)
        prefs.saveAuth(res.userId, res.deviceId, res.pairingCode)
        repoScope.launch {
            runCatching {
                RevisitReminderScheduler.bindDeviceIfAuthenticated(
                    context = appContext,
                    force = true,
                    explicitUserId = res.userId,
                    explicitDeviceId = res.deviceId
                )
            }
        }
        trackEvent("login_success", mapOf("method" to "pairing_code"))
        runCatching {
            val profile = api.getProfile()
            prefs.saveProfile(profile.nickname, profile.personaKey, profile.pairingCode)
        }
        syncOutbox()
        return AuthPairResult(res.userId, res.pairingCode)
    }

    data class AuthPairResult(val userId: String, val pairingCode: String?)

    enum class HandoffOutcome {
        CONNECTED,
        EMPTY_SESSION,
        INVALID_CALLBACK,
        MERGE_FAILED
    }

    suspend fun completeTwaHandoff(
        status: String,
        userId: String?,
        deviceId: String?,
        pairingCode: String?,
        nickname: String?,
        personaKey: PersonaKey?,
        markBrowserHandoffDone: Boolean = true
    ): Boolean = completeTwaHandoffWithOutcome(
        status = status,
        userId = userId,
        deviceId = deviceId,
        pairingCode = pairingCode,
        nickname = nickname,
        personaKey = personaKey,
        markBrowserHandoffDone = markBrowserHandoffDone
    ) == HandoffOutcome.CONNECTED

    suspend fun completeTwaHandoffWithOutcome(
        status: String,
        userId: String?,
        deviceId: String?,
        pairingCode: String?,
        nickname: String?,
        personaKey: PersonaKey?,
        markBrowserHandoffDone: Boolean = true
    ): HandoffOutcome {
        val normalizedStatus = status.trim().lowercase()
        val cleanUserId = userId?.trim()?.takeIf { it.isNotEmpty() }
        val cleanDeviceId = deviceId?.trim()?.takeIf { it.isNotEmpty() }
        val cleanCode = pairingCode?.trim()?.takeIf { it.isNotEmpty() }

        if (normalizedStatus == "empty") {
            if (markBrowserHandoffDone) {
                prefs.markAutoHandoffAttempted()
                prefs.markBrowserHandoffEmptySession()
            }
            return HandoffOutcome.EMPTY_SESSION
        }

        if (normalizedStatus != "ok" || cleanUserId == null || cleanDeviceId == null) {
            if (markBrowserHandoffDone) {
                prefs.markAutoHandoffAttempted()
                prefs.markBrowserHandoffFailed()
            }
            return HandoffOutcome.INVALID_CALLBACK
        }

        val currentUserId = prefs.current.userId
        val localActiveLogs = runCatching { db.watchLogDao().getActiveLogs() }.getOrDefault(emptyList())
        val pendingOutboxCount = runCatching { db.outboxDao().getAll().size }.getOrDefault(0)
        val hasLocalData = localActiveLogs.isNotEmpty() || pendingOutboxCount > 0

        if (!currentUserId.isNullOrBlank() && currentUserId != cleanUserId && hasLocalData) {
            val resolvedCode = cleanCode ?: runCatching {
                api.getProfileForCredentials(cleanUserId, cleanDeviceId).pairingCode?.trim()?.takeIf { it.isNotEmpty() }
            }.getOrNull()
            if (resolvedCode.isNullOrBlank()) {
                if (markBrowserHandoffDone) {
                    prefs.markAutoHandoffAttempted()
                    prefs.markBrowserHandoffFailed()
                }
                return HandoffOutcome.MERGE_FAILED
            }
            val paired = runCatching { pairWithCode(resolvedCode) }.getOrNull()
            if (paired != null) {
                prefs.dismissTwaMigrationBanner()
                if (markBrowserHandoffDone) {
                    prefs.markTwaBrowserHandoffCompleted()
                }
                return HandoffOutcome.CONNECTED
            }
            // Do NOT overwrite current auth or drop local logs/outbox when server merge fails.
            if (markBrowserHandoffDone) {
                prefs.markAutoHandoffAttempted()
                prefs.markBrowserHandoffFailed()
            }
            return HandoffOutcome.MERGE_FAILED
        }

        if (!currentUserId.isNullOrBlank() && currentUserId != cleanUserId && !hasLocalData) {
            saveMutex.withLock {
                db.outboxDao().clearAll()
                db.watchLogHistoryDao().clearAll()
                db.watchLogDao().clearAll()
            }
        }

        prefs.setLastSyncAt(null)
        prefs.saveAuth(cleanUserId, cleanDeviceId, cleanCode)
        if (!nickname.isNullOrBlank() || personaKey != null) {
            prefs.saveProfile(
                nickname = nickname ?: prefs.current.nickname,
                personaKey = personaKey ?: prefs.current.personaKey,
                pairingCode = cleanCode
            )
        }
        prefs.dismissTwaMigrationBanner()
        if (markBrowserHandoffDone) {
            prefs.markTwaBrowserHandoffCompleted()
        }

        repoScope.launch {
            runCatching {
                RevisitReminderScheduler.bindDeviceIfAuthenticated(
                    context = appContext,
                    force = true,
                    explicitUserId = cleanUserId,
                    explicitDeviceId = cleanDeviceId
                )
            }
        }

        runCatching {
            val profile = api.getProfile()
            prefs.saveProfile(profile.nickname, profile.personaKey, profile.pairingCode)
        }

        syncOutbox()
        trackEvent("login_success", mapOf("method" to "twa_handoff"))
        return HandoffOutcome.CONNECTED
    }

    suspend fun tryRestoreFromTwaInstallToken(): Boolean {
        val restored = RevisitReminderApiClient.restoreSession(appContext) ?: return false
        if (!restored.found || restored.userId.isNullOrBlank() || restored.deviceId.isNullOrBlank()) {
            return false
        }
        val ok = completeTwaHandoff(
            status = "ok",
            userId = restored.userId,
            deviceId = restored.deviceId,
            pairingCode = restored.pairingCode,
            nickname = restored.nickname,
            personaKey = PersonaKey.fromWire(restored.personaKey),
            markBrowserHandoffDone = false
        )
        if (!ok) return false
        val syncedLogs = runCatching { db.watchLogDao().getActiveLogs() }.getOrDefault(emptyList())
        if (syncedLogs.isNotEmpty()) {
            prefs.markTwaBrowserHandoffCompleted()
            return true
        }
        return false
    }

    suspend fun refreshProfile(): UserProfile? {
        if (prefs.current.userId.isNullOrBlank()) return null
        return runCatching {
            val profile = api.getProfile()
            prefs.saveProfile(profile.nickname, profile.personaKey, profile.pairingCode)
            profile
        }.getOrNull()
    }

    suspend fun saveUserProfile(nickname: String, personaKey: PersonaKey): UserProfile {
        ensureAuthenticated()
        val updated = api.updateProfile(UpdateUserProfileRequest(nickname.trim(), personaKey))
        prefs.saveProfile(updated.nickname, updated.personaKey)
        return updated
    }

    suspend fun ensureBookClassificationsCached(titles: List<Title>) {
        if (prefs.current.locale != "ko") return
        val isbns = titles
            .filter { it.type == TitleType.BOOK }
            .mapNotNull { BookshelfBuilder.normalizeBookIsbn13(it) }
            .distinct()
        if (isbns.isEmpty()) return

        val cached = db.bookClassificationDao().getByIsbns(isbns).map { it.isbn13 }.toSet()
        val missing = isbns.filterNot { it in cached }
        if (missing.isEmpty()) return

        for (chunk in missing.chunked(30)) {
            runCatching {
                val resp = api.resolveBookClassifications(chunk)
                if (resp.items.isNotEmpty()) {
                    db.bookClassificationDao().upsertAll(resp.items.map { BookClassificationEntity.fromModel(it) })
                }
            }
        }
    }

    suspend fun resetLocalData() {
        resetLocalDataInternal()
    }

    private suspend fun resetLocalDataInternal() {
        val previousUserId = prefs.current.userId
        recommendations.onAccountCleared(previousUserId)
        runCatching { RevisitReminderScheduler.onAccountDisconnected(appContext) }
        saveMutex.withLock {
            db.outboxDao().clearAll()
            db.watchLogHistoryDao().clearAll()
            db.watchLogDao().clearAll()
            db.titleDao().clearAll()
            db.bookClassificationDao().clearAll()
        }
        prefs.clearAuthAndSyncState()
        _syncState.value = SyncState(SyncStatus.IDLE, null)
        refreshWidgetsSafe()
    }

    suspend fun deleteServerAccountAndLocalData() {
        if (!prefs.current.userId.isNullOrBlank()) {
            try {
                api.deleteAccount()
            } catch (e: ApiException) {
                // If server already invalidated/deleted this session (401/404), still complete local wipe
                if (e.statusCode != 401 && e.statusCode != 404) {
                    throw e
                }
            }
        }
        resetLocalDataInternal()
    }

    fun trackAppOpenOnce(
        entrySource: String = "launcher",
        extraAttribution: Map<String, Any?> = emptyMap()
    ) {
        if (appOpenedThisSession.compareAndSet(false, true)) {
            val props = buildMap<String, Any?> {
                put("source", entrySource)
                put("entrySource", entrySource)
                put("locale", prefs.current.locale)
                putAll(extraAttribution)
            }
            trackEvent("app_open", props)
        }
    }

    fun trackTitleSearch(queryLength: Int, resultCount: Int, category: String) {
        trackEvent(
            "title_search",
            mapOf(
                "queryLength" to queryLength,
                "resultCount" to resultCount,
                "category" to category
            )
        )
    }

    fun trackTitleSelect(title: Title, source: String) {
        trackEvent(
            "title_select",
            mapOf(
                "titleId" to title.id,
                "contentType" to title.type.wireValue,
                "provider" to (title.provider?.name ?: "LOCAL"),
                "source" to source
            )
        )
    }

    fun trackEvent(eventName: String, extraProps: Map<String, Any?> = emptyMap()) {
        val job = repoScope.launch {
            val isTablet = runCatching {
                appContext.resources.configuration.smallestScreenWidthDp >= 600
            }.getOrDefault(false)
            val props = mutableMapOf<String, JsonElement>(
                "osFamily" to JsonPrimitive("android"),
                "deviceType" to JsonPrimitive(if (isTablet) "tablet" else "mobile"),
                "installState" to JsonPrimitive("twa"),
                "androidRuntime" to JsonPrimitive("native"),
                "androidAppVersion" to JsonPrimitive(BuildConfig.VERSION_NAME),
                "androidAppVersionCode" to JsonPrimitive(BuildConfig.VERSION_CODE)
            )
            for ((k, v) in extraProps) {
                when (v) {
                    is String -> props[k] = JsonPrimitive(v)
                    is Number -> props[k] = JsonPrimitive(v)
                    is Boolean -> props[k] = JsonPrimitive(v)
                }
            }
            // Platform MUST match DB constraint ^(web|pwa|twa|ios_native)$
            api.trackAnalyticsEvent(
                TrackAnalyticsEventRequest(
                    eventName = eventName,
                    sessionId = sessionId,
                    platform = "twa",
                    clientVersion = BuildConfig.VERSION_NAME,
                    locale = prefs.current.locale,
                    occurredAt = RecordDate.nowIso(),
                    properties = props
                )
            )
        }
        inFlightAnalyticsJobs.add(job)
        job.invokeOnCompletion { inFlightAnalyticsJobs.remove(job) }
    }

    suspend fun awaitAnalyticsIdleForTest() {
        val snapshot = inFlightAnalyticsJobs.toList()
        if (snapshot.isNotEmpty()) {
            snapshot.joinAll()
        }
    }
}
