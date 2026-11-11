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

    /**
     * Resolves an existing local title by ID, `provider+providerId`, or normalized `isbn13` for books.
     */
    suspend fun findMatchingLocalTitle(candidate: Title): Title? {
        db.titleDao().getById(candidate.id)?.let { return it.toModel() }
        val all = db.titleDao().getAll().map { it.toModel() }
        if (candidate.provider != null && !candidate.providerId.isNullOrBlank()) {
            all.firstOrNull {
                it.provider == candidate.provider && it.providerId == candidate.providerId
            }?.let { return it }
        }
        if (candidate.type == TitleType.BOOK) {
            val targetIsbn = BookshelfBuilder.normalizeBookIsbn13(candidate)
            if (!targetIsbn.isNullOrBlank()) {
                all.firstOrNull {
                    it.type == TitleType.BOOK && BookshelfBuilder.normalizeBookIsbn13(it) == targetIsbn
                }?.let { return it }
            }
        }
        return null
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
        awaitSync: Boolean = false
    ): WatchLog {
        val outcome = saveMutex.withLock {
            val now = RecordDate.nowIso()
            val hadActiveLogsBefore = db.watchLogDao().getActiveLogs().isNotEmpty()
            val matchedTitle = findMatchingLocalTitle(rawTitle)
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
                provider = rawTitle.provider ?: matchedTitle?.provider,
                providerId = rawTitle.providerId ?: matchedTitle?.providerId,
                updatedAt = now
            )
            db.titleDao().upsert(TitleEntity.fromModel(effectiveTitle))

            val existingLog = db.watchLogDao().getActiveByTitleId(effectiveTitle.id).firstOrNull()
            val logId = existingLog?.id ?: UUID.randomUUID().toString()
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

        saveMutex.withLock {
            val pulledTitles = mutableMapOf<String, Title>()

            for (serverTitle in pull.changes.titles) {
                pulledTitles[serverTitle.id] = serverTitle
                val existingLocal = findMatchingLocalTitle(serverTitle)
                if (existingLocal != null && existingLocal.id != serverTitle.id) {
                    db.watchLogDao().remapTitleId(oldTitleId = existingLocal.id, newTitleId = serverTitle.id)
                    remapOutboxTitleIdLocked(oldTitleId = existingLocal.id, newTitleId = serverTitle.id)
                    db.titleDao().deleteById(existingLocal.id)
                }
                db.titleDao().upsert(TitleEntity.fromModel(serverTitle))
            }

            for (serverLog in pull.changes.logs) {
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
     * edits or newer local timestamps (F02).
     */
    suspend fun upsertLogsFromServerPage(logs: List<WatchLog>) {
        if (logs.isEmpty()) return
        saveMutex.withLock {
            for (incoming in logs) {
                val matchedTitle = findMatchingLocalTitle(incoming.title)
                val effectiveTitle = if (matchedTitle != null && matchedTitle.id != incoming.title.id) {
                    val hasPendingForMatched = db.watchLogDao().getActiveByTitleId(matchedTitle.id).any { local ->
                        local.syncStatus == "pending" ||
                            local.syncStatus == "failed" ||
                            db.outboxDao().getByTargetLogId(local.id) != null
                    }
                    if (hasPendingForMatched) matchedTitle else incoming.title
                } else {
                    incoming.title
                }
                db.titleDao().upsert(TitleEntity.fromModel(effectiveTitle))

                val existingLocal = db.watchLogDao().getById(incoming.id)
                    ?: db.watchLogDao().getActiveByTitleId(effectiveTitle.id).firstOrNull()
                    ?: matchedTitle?.let { db.watchLogDao().getActiveByTitleId(it.id).firstOrNull() }

                if (existingLocal != null) {
                    val pendingOutbox = db.outboxDao().getByTargetLogId(existingLocal.id)
                    val isUnsynced = existingLocal.syncStatus == "pending" ||
                        existingLocal.syncStatus == "failed" ||
                        pendingOutbox != null ||
                        existingLocal.deletedAt != null
                    val localUpdatedMs = RecordDate.parseInstantMillis(existingLocal.updatedAt)
                    val incomingUpdatedMs = RecordDate.parseInstantMillis(incoming.updatedAt ?: incoming.createdAt)
                    val isLocalNewer = localUpdatedMs > 0L && incomingUpdatedMs > 0L && localUpdatedMs > incomingUpdatedMs

                    if (isUnsynced || isLocalNewer) {
                        continue
                    }
                }

                db.watchLogDao().upsert(
                    WatchLogEntity.fromModel(
                        incoming.copy(
                            title = effectiveTitle,
                            syncStatus = "synced"
                        )
                    )
                )
            }
        }
        refreshWidgetsSafe()
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

    suspend fun completeTwaHandoff(
        status: String,
        userId: String?,
        deviceId: String?,
        pairingCode: String?,
        nickname: String?,
        personaKey: PersonaKey?,
        markBrowserHandoffDone: Boolean = true
    ): Boolean {
        if (markBrowserHandoffDone) {
            prefs.markTwaBrowserHandoffCompleted()
        }
        val cleanUserId = userId?.trim()?.takeIf { it.isNotEmpty() }
        val cleanDeviceId = deviceId?.trim()?.takeIf { it.isNotEmpty() }
        val cleanCode = pairingCode?.trim()?.takeIf { it.isNotEmpty() }

        if (status != "ok" || cleanUserId == null || cleanDeviceId == null) {
            return false
        }

        val currentUserId = prefs.current.userId
        val localActiveLogs = runCatching { db.watchLogDao().getActiveLogs() }.getOrDefault(emptyList())

        if (!currentUserId.isNullOrBlank() && currentUserId != cleanUserId && localActiveLogs.isNotEmpty() && !cleanCode.isNullOrBlank()) {
            val paired = runCatching { pairWithCode(cleanCode) }.getOrNull()
            if (paired != null) {
                prefs.dismissTwaMigrationBanner()
                return true
            }
        }

        if (!currentUserId.isNullOrBlank() && currentUserId != cleanUserId && localActiveLogs.isEmpty()) {
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
        return true
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

    fun trackAppOpenOnce(entrySource: String = "launcher") {
        if (appOpenedThisSession.compareAndSet(false, true)) {
            trackEvent("app_open", mapOf("source" to entrySource))
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
