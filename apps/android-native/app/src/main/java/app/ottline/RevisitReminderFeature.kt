package app.ottline

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.ottline.data.local.AndroidInstallToken
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.OttlineDatabase
import app.ottline.data.remote.OttlineApiClient
import app.ottline.model.LogDraft
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

object RevisitReminderApiClient {
    const val EXTRA_REVISIT_DELIVERY_ID = "app.ottline.extra.REVISIT_DELIVERY_ID"

    @Serializable
    data class ReminderDto(
        val deliveryId: String,
        val reminderType: String = "",
        val title: String,
        val body: String,
        val deepLink: String = "https://ottline.app/timeline"
    )

    @Serializable
    private data class NextReminderResponse(
        val reminder: ReminderDto? = null
    )

    @Serializable
    data class BindDevicePayload(
        val installToken: String,
        val versionName: String,
        val versionCode: Int,
        val notificationPermissionGranted: Boolean,
        val revisitRemindersEnabled: Boolean
    )

    @Serializable
    data class PreferencePayload(
        val installToken: String,
        val notificationPermissionGranted: Boolean,
        val revisitRemindersEnabled: Boolean,
        val versionName: String,
        val versionCode: Int
    )

    @Serializable
    private data class NextReminderPayload(
        val installToken: String,
        val timeZone: String,
        val locale: String,
        val notificationPermissionGranted: Boolean,
        val versionName: String,
        val versionCode: Int
    )

    @Serializable
    private data class DeliveryMarkPayload(
        val installToken: String
    )

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    // Test hook for overriding HTTP client / base URL in unit tests
    internal var httpClientOverride: OkHttpClient? = null
    internal var apiBaseUrlOverride: String? = null

    private fun appLocale(context: Context): String {
        val app = context.applicationContext as? OttlineApplication
        return app?.appPreferences?.current?.locale ?: AppPreferences(context).current.locale
    }

    private fun androidApiBase(context: Context): String {
        val overrideBase = apiBaseUrlOverride?.trimEnd('/')
        val app = context.applicationContext as? OttlineApplication
        val root = overrideBase
            ?: app?.appPreferences?.current?.apiBaseUrl?.trimEnd('/')
            ?: AppPreferences(context).current.apiBaseUrl.trimEnd('/')
        return if (root.endsWith("/api")) "$root/android" else "$root/api/android"
    }

    private suspend fun executeRequest(
        context: Context,
        method: String,
        suffix: String,
        bodyJson: String,
        headers: Map<String, String> = emptyMap()
    ): String = withContext(Dispatchers.IO) {
        val appInstance = context.applicationContext as? OttlineApplication
        val client = httpClientOverride ?: appInstance?.apiClient?.httpClient ?: OttlineApiClient.defaultOkHttpClient()
        val url = "${androidApiBase(context)}$suffix"
        val reqBuilder = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("Accept-Language", appLocale(context))
            .method(method, bodyJson.toRequestBody(jsonMediaType))
        if (url.contains("ngrok", ignoreCase = true)) {
            reqBuilder.header("ngrok-skip-browser-warning", "true")
        }
        for ((k, v) in headers) {
            reqBuilder.header(k, v)
        }
        client.newCall(reqBuilder.build()).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                throw IllegalStateException("Android reminder API $method $suffix -> HTTP ${resp.code}")
            }
            text
        }
    }

    suspend fun bindDevice(
        context: Context,
        userId: String,
        deviceId: String,
        enabled: Boolean = RevisitReminderScheduler.isEnabled(context)
    ): Result<Unit> = runCatching {
        val payload = BindDevicePayload(
            installToken = AndroidInstallToken.getOrCreate(context),
            versionName = BuildConfig.VERSION_NAME,
            versionCode = BuildConfig.VERSION_CODE,
            notificationPermissionGranted = WatchReminderAccess.canPostNotifications(context),
            revisitRemindersEnabled = enabled
        )
        executeRequest(
            context = context,
            method = "POST",
            suffix = "/notification-devices/bind",
            bodyJson = json.encodeToString(payload),
            headers = mapOf(
                "X-User-Id" to userId,
                "X-Device-Id" to deviceId
            )
        )
    }

    suspend fun updatePreferences(context: Context, enabled: Boolean): Result<Unit> = runCatching {
        val payload = PreferencePayload(
            installToken = AndroidInstallToken.getOrCreate(context),
            notificationPermissionGranted = WatchReminderAccess.canPostNotifications(context),
            revisitRemindersEnabled = enabled,
            versionName = BuildConfig.VERSION_NAME,
            versionCode = BuildConfig.VERSION_CODE
        )
        executeRequest(
            context = context,
            method = "PATCH",
            suffix = "/notification-devices/preferences",
            bodyJson = json.encodeToString(payload)
        )
    }

    suspend fun fetchNext(context: Context): ReminderDto? {
        val payload = NextReminderPayload(
            installToken = AndroidInstallToken.getOrCreate(context),
            timeZone = TimeZone.getDefault().id,
            locale = appLocale(context),
            notificationPermissionGranted = WatchReminderAccess.canPostNotifications(context),
            versionName = BuildConfig.VERSION_NAME,
            versionCode = BuildConfig.VERSION_CODE
        )
        val raw = executeRequest(context, "POST", "/reminders/next", json.encodeToString(payload))
        if (raw.isBlank()) return null
        return runCatching { json.decodeFromString<NextReminderResponse>(raw).reminder }.getOrNull()
    }

    suspend fun markDelivered(context: Context, deliveryId: String) {
        runCatching {
            val payload = DeliveryMarkPayload(AndroidInstallToken.getOrCreate(context))
            executeRequest(context, "POST", "/reminders/$deliveryId/delivered", json.encodeToString(payload))
        }
    }

    suspend fun markOpened(context: Context, deliveryId: String) {
        runCatching {
            val payload = DeliveryMarkPayload(AndroidInstallToken.getOrCreate(context))
            executeRequest(context, "POST", "/reminders/$deliveryId/opened", json.encodeToString(payload))
        }
    }
}

data class RevisitSyncUiState(
    val enabled: Boolean = true,
    val pendingSync: Boolean = false,
    val lastSyncError: String? = null
)

object RevisitReminderScheduler {
    private const val PREFS = "ottline.revisit_reminder"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_USER_SET = "user_set"
    private const val KEY_LAST_RESULT = "last_result"
    private const val KEY_BOUND_SIGNATURE = "bound_signature"
    private const val KEY_PENDING_PREF_ENABLED = "pending_pref_enabled"
    private const val KEY_HAS_PENDING_PREF = "has_pending_pref"
    private const val KEY_LAST_SYNC_ERROR = "last_sync_error"
    const val WORK_NAME = "ottline-revisit-reminder"

    private val _uiState = MutableStateFlow(RevisitSyncUiState())
    val uiState: StateFlow<RevisitSyncUiState> = _uiState.asStateFlow()

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun refreshUiState(context: Context) {
        val p = prefs(context)
        _uiState.value = RevisitSyncUiState(
            enabled = isEnabled(context),
            pendingSync = p.getBoolean(KEY_HAS_PENDING_PREF, false),
            lastSyncError = p.getString(KEY_LAST_SYNC_ERROR, null)
        )
    }

    fun isEnabled(context: Context): Boolean {
        val p = prefs(context)
        if (!p.contains(KEY_ENABLED)) {
            return WatchReminderAccess.canPostNotifications(context)
        }
        return p.getBoolean(KEY_ENABLED, false)
    }

    suspend fun setEnabledAwait(context: Context, enabled: Boolean): Result<Unit> {
        val appCtx = context.applicationContext
        prefs(appCtx).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putBoolean(KEY_USER_SET, true)
            .putBoolean(KEY_HAS_PENDING_PREF, true)
            .putBoolean(KEY_PENDING_PREF_ENABLED, enabled)
            .remove(KEY_LAST_SYNC_ERROR)
            .apply()

        if (enabled && WatchReminderAccess.canPostNotifications(appCtx)) {
            schedule(appCtx)
        } else {
            cancel(appCtx)
        }
        refreshUiState(appCtx)

        bindDeviceIfAuthenticated(appCtx, force = false)
        val res = RevisitReminderApiClient.updatePreferences(appCtx, enabled)
        if (res.isSuccess) {
            prefs(appCtx).edit()
                .putBoolean(KEY_HAS_PENDING_PREF, false)
                .remove(KEY_LAST_SYNC_ERROR)
                .apply()
        } else {
            prefs(appCtx).edit()
                .putString(KEY_LAST_SYNC_ERROR, res.exceptionOrNull()?.message ?: "sync_failed")
                .apply()
        }
        refreshUiState(appCtx)
        return res
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        val appCtx = context.applicationContext
        prefs(appCtx).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putBoolean(KEY_USER_SET, true)
            .putBoolean(KEY_HAS_PENDING_PREF, true)
            .putBoolean(KEY_PENDING_PREF_ENABLED, enabled)
            .apply()
        if (enabled && WatchReminderAccess.canPostNotifications(appCtx)) {
            schedule(appCtx)
        } else {
            cancel(appCtx)
        }
        refreshUiState(appCtx)
        CoroutineScope(Dispatchers.IO).launch {
            setEnabledAwait(appCtx, enabled)
        }
    }

    suspend fun bindDeviceIfAuthenticated(
        context: Context,
        force: Boolean = false,
        explicitUserId: String? = null,
        explicitDeviceId: String? = null
    ): Boolean {
        val appCtx = context.applicationContext
        val appPrefs = (appCtx as? OttlineApplication)?.appPreferences ?: AppPreferences(appCtx)
        val snap = appPrefs.current
        val userId = (explicitUserId ?: snap.userId)?.takeIf { it.isNotBlank() } ?: return false
        val deviceId = (explicitDeviceId ?: snap.deviceId)?.takeIf { it.isNotBlank() } ?: return false
        val token = AndroidInstallToken.getOrCreate(appCtx)
        val permGranted = WatchReminderAccess.canPostNotifications(appCtx)
        val enabled = isEnabled(appCtx)
        val signature = "$userId:$deviceId:$token:${BuildConfig.VERSION_CODE}:$permGranted:$enabled"

        val p = prefs(appCtx)
        if (!force && p.getString(KEY_BOUND_SIGNATURE, null) == signature) {
            flushPendingPreferenceIfNeeded(appCtx)
            return true
        }

        val res = RevisitReminderApiClient.bindDevice(appCtx, userId, deviceId, enabled)
        if (res.isSuccess) {
            p.edit()
                .putString(KEY_BOUND_SIGNATURE, signature)
                .remove(KEY_LAST_SYNC_ERROR)
                .apply()
            flushPendingPreferenceIfNeeded(appCtx)
            refreshUiState(appCtx)
            return true
        } else {
            p.edit().putString(KEY_LAST_SYNC_ERROR, res.exceptionOrNull()?.message ?: "bind_failed").apply()
            refreshUiState(appCtx)
            return false
        }
    }

    suspend fun flushPendingPreferenceIfNeeded(context: Context): Boolean {
        val appCtx = context.applicationContext
        val p = prefs(appCtx)
        if (!p.getBoolean(KEY_HAS_PENDING_PREF, false)) return true
        val target = p.getBoolean(KEY_PENDING_PREF_ENABLED, isEnabled(appCtx))
        val res = RevisitReminderApiClient.updatePreferences(appCtx, target)
        if (res.isSuccess) {
            p.edit()
                .putBoolean(KEY_HAS_PENDING_PREF, false)
                .remove(KEY_LAST_SYNC_ERROR)
                .apply()
            refreshUiState(appCtx)
            return true
        }
        p.edit().putString(KEY_LAST_SYNC_ERROR, res.exceptionOrNull()?.message ?: "sync_failed").apply()
        refreshUiState(appCtx)
        return false
    }

    suspend fun onAccountDisconnected(context: Context) {
        val appCtx = context.applicationContext
        prefs(appCtx).edit()
            .remove(KEY_BOUND_SIGNATURE)
            .putBoolean(KEY_HAS_PENDING_PREF, false)
            .remove(KEY_LAST_SYNC_ERROR)
            .apply()
        RevisitReminderApiClient.updatePreferences(appCtx, enabled = false)
        refreshUiState(appCtx)
    }

    fun syncAutoState(context: Context) {
        val appCtx = context.applicationContext
        val p = prefs(appCtx)
        if (!p.getBoolean(KEY_USER_SET, false) && WatchReminderAccess.canPostNotifications(appCtx)) {
            p.edit().putBoolean(KEY_ENABLED, true).apply()
        }
        if (isEnabled(appCtx) && WatchReminderAccess.canPostNotifications(appCtx)) {
            schedule(appCtx)
        } else {
            cancel(appCtx)
        }
        refreshUiState(appCtx)
        CoroutineScope(Dispatchers.IO).launch {
            bindDeviceIfAuthenticated(appCtx, force = false)
            flushPendingPreferenceIfNeeded(appCtx)
        }
    }

    fun schedule(context: Context) {
        runCatching {
            val request = PeriodicWorkRequestBuilder<RevisitReminderWorker>(24, TimeUnit.HOURS).build()
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }

    fun cancel(context: Context) {
        runCatching {
            WorkManager.getInstance(context.applicationContext).cancelUniqueWork(WORK_NAME)
        }
    }

    fun saveResult(context: Context, result: String) {
        prefs(context).edit().putString(KEY_LAST_RESULT, result).apply()
    }
}

object RevisitReminderNotifier {
    internal const val CHANNEL_ID = "ottline_revisit_reminder"
    internal const val NOTIFICATION_ID = 4201
    internal const val KEY_REMOTE_QUICK_NOTE = "key_remote_quick_note"
    internal const val EXTRA_TARGET_TITLE_ID = "app.ottline.extra.REVISIT_TARGET_TITLE_ID"

    private fun isEnglish(context: Context): Boolean {
        val app = context.applicationContext as? OttlineApplication
        val loc = app?.appPreferences?.current?.locale ?: AppPreferences(context).current.locale
        return loc == "en"
    }

    internal fun extractSpecificTitleId(deepLink: String): String? {
        val uri = runCatching { Uri.parse(deepLink) }.getOrNull() ?: return null
        val segs = uri.pathSegments.let {
            if (it.firstOrNull() in listOf("ko", "en")) it.drop(1) else it
        }
        return if (segs.firstOrNull() == "title") segs.getOrNull(1)?.takeIf { it.isNotBlank() } else null
    }

    suspend fun show(context: Context, reminder: RevisitReminderApiClient.ReminderDto): Boolean {
        if (!WatchReminderAccess.canPostNotifications(context)) return false
        val isEn = isEnglish(context)
        ensureChannel(context, isEn)

        val intent = Intent(context, LauncherActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(reminder.deepLink.ifBlank { "https://ottline.app/timeline" })
            putExtra(RevisitReminderApiClient.EXTRA_REVISIT_DELIVERY_ID, reminder.deliveryId)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pi = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_icon)
            .setContentTitle(reminder.title)
            .setContentText(reminder.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pi)

        // A02: Attach RemoteInput ONLY when the reminder targets an explicit local title record
        val targetTitleId = extractSpecificTitleId(reminder.deepLink)
        if (!targetTitleId.isNullOrBlank()) {
            val hasLocalLog = runCatching {
                OttlineDatabase.getInstance(context).watchLogDao().getActiveByTitleId(targetTitleId).isNotEmpty()
            }.getOrDefault(false)
            if (hasLocalLog) {
                val remoteInput = RemoteInput.Builder(KEY_REMOTE_QUICK_NOTE)
                    .setLabel(if (isEn) "Add a quick line to your note" else "그날의 메모 한 줄 남기기")
                    .build()
                val replyIntent = Intent(context, ReminderQuickNoteReceiver::class.java).apply {
                    putExtra(EXTRA_TARGET_TITLE_ID, targetTitleId)
                    putExtra(RevisitReminderApiClient.EXTRA_REVISIT_DELIVERY_ID, reminder.deliveryId)
                }
                val replyFlags = PendingIntent.FLAG_UPDATE_CURRENT or
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
                val replyPi = PendingIntent.getBroadcast(
                    context,
                    NOTIFICATION_ID + 10,
                    replyIntent,
                    replyFlags
                )
                val action = NotificationCompat.Action.Builder(
                    R.drawable.ic_notification_icon,
                    if (isEn) "Add a line" else "한 줄 남기기",
                    replyPi
                )
                    .addRemoteInput(remoteInput)
                    .setAllowGeneratedReplies(false)
                    .build()
                builder.addAction(action)
            }
        }

        val notification = builder.build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }

        return try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            true
        } catch (_: SecurityException) {
            false
        }
    }

    internal fun ensureChannel(context: Context, isEn: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                if (isEn) "Revisit reminders" else "기록 돌아보기 알림",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = if (isEn) {
                    "Gentle reminders to revisit records kept on your timeline"
                } else {
                    "남겨둔 기록을 천천히 다시 돌아보는 알림"
                }
            }
            nm.createNotificationChannel(channel)
        }
    }
}

class ReminderQuickNoteReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val results = RemoteInput.getResultsFromIntent(intent) ?: return
        val quickLine = results.getCharSequence(RevisitReminderNotifier.KEY_REMOTE_QUICK_NOTE)
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: return
        val titleId = intent.getStringExtra(RevisitReminderNotifier.EXTRA_TARGET_TITLE_ID)
            ?.takeIf { it.isNotBlank() }
            ?: return
        val deliveryId = intent.getStringExtra(RevisitReminderApiClient.EXTRA_REVISIT_DELIVERY_ID)

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val ottlineApp = context.applicationContext as? OttlineApplication ?: return@launch
                val db = ottlineApp.database
                val existingLog = db.watchLogDao().getActiveByTitleId(titleId).firstOrNull() ?: return@launch
                val titleEntity = db.titleDao().getById(titleId) ?: return@launch
                val title = titleEntity.toModel()
                val existingModel = existingLog.toModel(title)
                val combinedNote = if (existingModel.note.isNullOrBlank()) {
                    quickLine
                } else {
                    "${existingModel.note.trim()}\n$quickLine"
                }

                ottlineApp.repository.saveLogForTitle(
                    rawTitle = title,
                    draft = LogDraft(
                        status = existingModel.status,
                        rating = existingModel.rating,
                        note = combinedNote,
                        spoiler = existingModel.spoiler,
                        ott = existingModel.ott,
                        seasonNumber = existingModel.seasonNumber,
                        episodeNumber = existingModel.episodeNumber,
                        seasonPosterUrl = existingModel.seasonPosterUrl,
                        seasonYear = existingModel.seasonYear,
                        origin = existingModel.origin ?: "LOG",
                        watchedAt = existingModel.watchedAt,
                        place = existingModel.place,
                        occasion = existingModel.occasion
                    ),
                    awaitSync = false
                )

                if (!deliveryId.isNullOrBlank()) {
                    RevisitReminderApiClient.markOpened(ottlineApp, deliveryId)
                }

                val isEn = ottlineApp.appPreferences.current.locale == "en"
                RevisitReminderNotifier.ensureChannel(ottlineApp, isEn)
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                    ContextCompat.checkSelfPermission(ottlineApp, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                ) {
                    val doneNotification = NotificationCompat.Builder(ottlineApp, RevisitReminderNotifier.CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_notification_icon)
                        .setContentTitle(title.name)
                        .setContentText(if (isEn) "Kept your note on the timeline." else "타임라인에 한 줄을 남겨두었어요.")
                        .setAutoCancel(true)
                        .setTimeoutAfter(4000L)
                        .build()
                    try {
                        NotificationManagerCompat.from(ottlineApp).notify(RevisitReminderNotifier.NOTIFICATION_ID, doneNotification)
                    } catch (_: SecurityException) {
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}

class RevisitReminderWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        if (!RevisitReminderScheduler.isEnabled(applicationContext)) return Result.success()
        if (!WatchReminderAccess.canPostNotifications(applicationContext)) return Result.success()
        return runCatching {
            RevisitReminderScheduler.bindDeviceIfAuthenticated(applicationContext, force = false)
            RevisitReminderScheduler.flushPendingPreferenceIfNeeded(applicationContext)
            val next = RevisitReminderApiClient.fetchNext(applicationContext)
            if (next != null && RevisitReminderNotifier.show(applicationContext, next)) {
                RevisitReminderApiClient.markDelivered(applicationContext, next.deliveryId)
                RevisitReminderScheduler.saveResult(applicationContext, "발송됨: ${next.reminderType}")
            }
            Result.success()
        }.getOrElse {
            Result.success()
        }
    }
}
