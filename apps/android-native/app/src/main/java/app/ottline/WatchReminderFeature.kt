package app.ottline

import android.Manifest
import android.app.AppOpsManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequest
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.max

object WatchReminderTargets {
    data class Target(
        val packageName: String,
        val key: String,
        val label: String,
        val koPlatformLabel: String
    )

    private val exactTargets: Map<String, Target> = mapOf(
        "com.netflix.mediaclient" to Target("com.netflix.mediaclient", "netflix", "Netflix", "넷플릭스"),
        "com.netflix.ninja" to Target("com.netflix.ninja", "netflix", "Netflix", "넷플릭스"),
        "net.cj.cjhv.gs.tving" to Target("net.cj.cjhv.gs.tving", "tving", "TVING", "티빙"),
        "kr.co.captv.pooqV2" to Target("kr.co.captv.pooqV2", "wavve", "Wavve", "웨이브"),
        "com.frograms.wplay" to Target("com.frograms.wplay", "watcha", "Watcha", "왓챠"),
        "com.coupang.mobile.play" to Target("com.coupang.mobile.play", "coupang", "Coupang Play", "쿠팡플레이"),
        "com.disney.disneyplus" to Target("com.disney.disneyplus", "disney", "Disney+", "디즈니플러스"),
        "com.amazon.avod.thirdpartyclient" to Target("com.amazon.avod.thirdpartyclient", "prime_video", "Prime Video", "프라임비디오"),
        "com.apple.atve.androidtv.appletv" to Target("com.apple.atve.androidtv.appletv", "apple_tv", "Apple TV", "애플티비")
    )

    fun all(): Map<String, Target> = exactTargets

    fun resolve(packageName: String?): Target? {
        if (packageName.isNullOrBlank()) return null
        exactTargets[packageName]?.let { return it }
        val lower = packageName.lowercase(Locale.ROOT)
        return when {
            lower.contains("netflix") -> Target(packageName, "netflix", "Netflix", "넷플릭스")
            lower.contains("tving") -> Target(packageName, "tving", "TVING", "티빙")
            lower.contains("pooq") || lower.contains("wavve") -> Target(packageName, "wavve", "Wavve", "웨이브")
            lower.contains("watcha") || lower.contains("wplay") -> Target(packageName, "watcha", "Watcha", "왓챠")
            lower.contains("coupang") && lower.contains("play") -> Target(packageName, "coupang", "Coupang Play", "쿠팡플레이")
            lower.contains("disneyplus") -> Target(packageName, "disney", "Disney+", "디즈니플러스")
            lower.contains("amazon") && (lower.contains("avod") || lower.contains("primevideo") || lower.contains("prime.video")) ->
                Target(packageName, "prime_video", "Prime Video", "프라임비디오")
            lower.contains("apple") && (lower.contains("atve") || lower.contains("appletv") || lower.contains("apple.tv")) ->
                Target(packageName, "apple_tv", "Apple TV", "애플티비")
            else -> null
        }
    }
}

object WatchReminderUsageTracker {
    const val MIN_FOREGROUND_MS = 5L * 60L * 1000L
    const val CANDIDATE_WINDOW_MS = 2L * 60L * 60L * 1000L

    data class State(
        val intervalStartAt: Long,
        val totalForegroundMs: Long,
        val unnotifiedForegroundMs: Long,
        val lastTimeUsed: Long
    ) {
        fun isCandidate(now: Long): Boolean =
            unnotifiedForegroundMs >= MIN_FOREGROUND_MS && isRecent(lastTimeUsed, now)

        fun consume(): State = copy(unnotifiedForegroundMs = 0L)
    }

    fun observe(
        previous: State?,
        intervalStartAt: Long,
        totalForegroundMs: Long,
        lastTimeUsed: Long,
        now: Long
    ): State {
        if (previous == null || (previous.intervalStartAt == 0L && lastTimeUsed <= previous.lastTimeUsed)) {
            return State(intervalStartAt, totalForegroundMs, 0L, lastTimeUsed)
        }
        if (intervalStartAt < previous.intervalStartAt) return previous

        val sameInterval = intervalStartAt == previous.intervalStartAt
        val delta = if (sameInterval) {
            max(0L, totalForegroundMs - previous.totalForegroundMs)
        } else {
            max(0L, totalForegroundMs)
        }
        val carried = if (isRecent(previous.lastTimeUsed, now)) previous.unnotifiedForegroundMs else 0L
        val accumulated = if (isRecent(lastTimeUsed, now)) carried + delta else 0L
        val total = if (sameInterval) max(previous.totalForegroundMs, totalForegroundMs) else totalForegroundMs
        return State(intervalStartAt, total, accumulated, lastTimeUsed)
    }

    private fun isRecent(lastTimeUsed: Long, now: Long): Boolean =
        lastTimeUsed in 1..now && (now - lastTimeUsed) <= CANDIDATE_WINDOW_MS
}

/**
 * Event-level OTT session detector (`UsageStatsManager.queryEvents`) that:
 * 1. Accurately measures foreground viewing spans across midnight `INTERVAL_DAILY` boundaries.
 * 2. Detects whether an OTT app is STILL actively in the foreground so we never interrupt mid-movie
 *    or burn the cooldown before the user actually finishes watching.
 */
object WatchReminderEventAnalyzer {
    const val EVENT_RESUMED = UsageEvents.Event.ACTIVITY_RESUMED // 1
    const val EVENT_PAUSED = UsageEvents.Event.ACTIVITY_PAUSED // 2
    const val EVENT_SCREEN_NON_INTERACTIVE = 16
    const val EVENT_STOPPED = 23
    const val EVENT_DEVICE_SHUTDOWN = 26
    private const val MAX_SINGLE_SPAN_MS = 6L * 60L * 60L * 1000L
    private const val MAX_ACTIVE_HOLD_MS = 4L * 60L * 60L * 1000L

    data class RawUsageEvent(
        val packageName: String,
        val eventType: Int,
        val timestamp: Long
    )

    data class CompletedSessionCandidate(
        val packageName: String,
        val totalDurationMs: Long,
        val endedAt: Long
    )

    data class EventAnalysis(
        val activePackages: Set<String>,
        val completedCandidates: Map<String, CompletedSessionCandidate>,
        val hadRecentOttActivity: Boolean
    )

    fun analyze(
        events: List<RawUsageEvent>,
        baselineAfterMs: Long,
        lastNotifiedEndByPkg: Map<String, Long>,
        now: Long
    ): EventAnalysis {
        val activeStartByPkg = mutableMapOf<String, Long>()
        val accumulatedMsByPkg = mutableMapOf<String, Long>()
        val lastEndedAtByPkg = mutableMapOf<String, Long>()
        var recentActivity = false

        fun closeSpan(pkg: String, endAt: Long) {
            val startAt = activeStartByPkg.remove(pkg) ?: return
            if (endAt <= startAt) return
            val cutoff = max(baselineAfterMs, lastNotifiedEndByPkg[pkg] ?: 0L)
            if (endAt <= cutoff) return
            val effectiveStart = max(startAt, cutoff)
            val spanMs = (endAt - effectiveStart).coerceIn(0L, MAX_SINGLE_SPAN_MS)
            if (spanMs <= 0L) return
            if (now - endAt <= WatchReminderUsageTracker.CANDIDATE_WINDOW_MS) {
                accumulatedMsByPkg[pkg] = (accumulatedMsByPkg[pkg] ?: 0L) + spanMs
                lastEndedAtByPkg[pkg] = max(lastEndedAtByPkg[pkg] ?: 0L, endAt)
            }
            if (now - endAt <= 30L * 60L * 1000L) {
                recentActivity = true
            }
        }

        for (ev in events) {
            when (ev.eventType) {
                EVENT_SCREEN_NON_INTERACTIVE, EVENT_DEVICE_SHUTDOWN -> {
                    for (openPkg in activeStartByPkg.keys.toList()) {
                        closeSpan(openPkg, ev.timestamp)
                    }
                }
                EVENT_RESUMED -> {
                    val target = WatchReminderTargets.resolve(ev.packageName)
                    if (target != null) {
                        // Close any other OTT package that might not have emitted PAUSED yet
                        for (otherPkg in activeStartByPkg.keys.filter { it != ev.packageName }) {
                            closeSpan(otherPkg, ev.timestamp)
                        }
                        activeStartByPkg.putIfAbsent(ev.packageName, ev.timestamp)
                        if (now - ev.timestamp <= 30L * 60L * 1000L) {
                            recentActivity = true
                        }
                    } else if (ev.packageName.isNotBlank() && !ev.packageName.startsWith("com.android.systemui")) {
                        // User switched to another non-SystemUI foreground app (e.g. Home launcher / KakaoTalk)
                        for (openPkg in activeStartByPkg.keys.toList()) {
                            closeSpan(openPkg, ev.timestamp)
                        }
                    }
                }
                EVENT_PAUSED, EVENT_STOPPED -> {
                    if (activeStartByPkg.containsKey(ev.packageName)) {
                        closeSpan(ev.packageName, ev.timestamp)
                    }
                }
            }
        }

        val activePackages = activeStartByPkg.entries
            .filter { (_, startedAt) -> startedAt in 1..now && (now - startedAt) <= MAX_ACTIVE_HOLD_MS }
            .map { it.key }
            .toSet()

        if (activePackages.isNotEmpty()) {
            recentActivity = true
        }

        val candidates = mutableMapOf<String, CompletedSessionCandidate>()
        for ((pkg, totalMs) in accumulatedMsByPkg) {
            if (pkg in activePackages) continue
            val endedAt = lastEndedAtByPkg[pkg] ?: continue
            if (totalMs >= WatchReminderUsageTracker.MIN_FOREGROUND_MS &&
                now - endedAt <= WatchReminderUsageTracker.CANDIDATE_WINDOW_MS
            ) {
                candidates[pkg] = CompletedSessionCandidate(
                    packageName = pkg,
                    totalDurationMs = totalMs,
                    endedAt = endedAt
                )
            }
        }

        return EventAnalysis(
            activePackages = activePackages,
            completedCandidates = candidates,
            hadRecentOttActivity = recentActivity
        )
    }
}

object WatchReminderAccess {
    fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun canPostNotifications(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    /**
     * Read-only check (requires NO special manifest permissions — 100% Google Play compliant)
     * to detect whether One UI / Android has exempted this app from Sleeping / Doze restrictions.
     */
    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun appBatteryDetailsIntent(context: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

    fun usageAccessSettingsIntent(context: Context): Intent =
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

    fun fallbackUsageAccessIntent(): Intent =
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

    fun notificationSettingsIntent(context: Context): Intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        } else {
            appBatteryDetailsIntent(context)
        }
}

object WatchReminderScheduler {
    private const val STATE_VERSION = 5
    const val PREFS = "ottline.watch_reminder"
    const val KEY_STATE_VERSION = "state_version"
    const val KEY_ENABLED = "enabled"
    const val KEY_BASELINE_RESET_AT = "baseline_reset_at"
    const val KEY_LAST_QUERY_AT = "last_query_at"
    const val KEY_PENDING_PACKAGE = "pending_package"
    const val KEY_PENDING_END_AT = "pending_end_at"
    const val KEY_LAST_NOTIFICATION_AT = "last_notification_at"
    const val KEY_LAST_SCAN_RESULT = "last_scan_result"
    const val KEY_LAST_USAGE_DEBUG = "last_usage_debug"
    const val KEY_HOME_PROMPT_DISMISSED_UNTIL = "home_prompt_dismissed_until"
    const val WORK_NAME = "ottline-watch-reminder"
    const val FOLLOW_UP_WORK_NAME = "ottline-watch-reminder-followup"
    private const val LEGACY_ONE_SHOT_WORK_TAG = "ottline-watch-reminder-one-shot"
    private const val FOLLOW_UP_DELAY_MS = 5L * 60L * 1000L

    fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isEnabled(context: Context): Boolean {
        ensureStateVersion(context)
        return prefs(context).getBoolean(KEY_ENABLED, false)
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        ensureStateVersion(context)
        val now = System.currentTimeMillis()
        val editor = prefs(context).edit().putBoolean(KEY_ENABLED, enabled)
        resetRuntimeState(context, editor, now)
        editor.apply()
        if (enabled) schedule(context) else cancel(context)
    }

    fun isHomePromptDismissed(context: Context, now: Long = System.currentTimeMillis()): Boolean =
        prefs(context).getLong(KEY_HOME_PROMPT_DISMISSED_UNTIL, 0L) > now

    fun dismissHomePromptFor14Days(context: Context, now: Long = System.currentTimeMillis()) {
        prefs(context).edit()
            .putLong(KEY_HOME_PROMPT_DISMISSED_UNTIL, now + 14L * 24L * 60L * 60L * 1000L)
            .apply()
    }

    fun lastScanResult(context: Context): String =
        prefs(context).getString(KEY_LAST_SCAN_RESULT, "-") ?: "-"

    /**
     * Called on Application startup, boot, or package update: ensures the 15-min periodic worker is
     * registered WITHOUT resetting an already-running timer (`ExistingPeriodicWorkPolicy.KEEP`)
     * and WITHOUT spamming Samsung OLAF / JobScheduler quotas.
     */
    fun syncScheduleIfEnabled(context: Context) {
        val appContext = context.applicationContext
        if (!isEnabled(appContext)) return
        runCatching {
            val request = PeriodicWorkRequestBuilder<WatchReminderWorker>(
                PeriodicWorkRequest.MIN_PERIODIC_INTERVAL_MILLIS,
                TimeUnit.MILLISECONDS
            ).build()
            val wm = WorkManager.getInstance(appContext)
            wm.cancelAllWorkByTag(LEGACY_ONE_SHOT_WORK_TAG)
            wm.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }

    /**
     * Called when the user explicitly toggles the reminder ON.
     */
    fun schedule(context: Context) {
        val appContext = context.applicationContext
        runCatching {
            val request = PeriodicWorkRequestBuilder<WatchReminderWorker>(
                PeriodicWorkRequest.MIN_PERIODIC_INTERVAL_MILLIS,
                TimeUnit.MILLISECONDS
            ).build()
            val wm = WorkManager.getInstance(appContext)
            wm.cancelAllWorkByTag(LEGACY_ONE_SHOT_WORK_TAG)
            wm.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }
    }

    fun cancel(context: Context) {
        runCatching {
            val wm = WorkManager.getInstance(context.applicationContext)
            wm.cancelUniqueWork(WORK_NAME)
            wm.cancelUniqueWork(FOLLOW_UP_WORK_NAME)
            wm.cancelAllWorkByTag(LEGACY_ONE_SHOT_WORK_TAG)
        }
    }

    /**
     * Enqueues a single unique 5-minute follow-up check ONLY when an OTT session is currently
     * active or very recent, avoiding 24/7 non-unique job spam that triggers Samsung One UI OLAF throttling.
     */
    fun scheduleActiveFollowUp(context: Context) {
        val appContext = context.applicationContext
        if (!prefs(appContext).getBoolean(KEY_ENABLED, false)) return
        runCatching {
            val request = OneTimeWorkRequestBuilder<WatchReminderWorker>()
                .setInitialDelay(FOLLOW_UP_DELAY_MS, TimeUnit.MILLISECONDS)
                .build()
            WorkManager.getInstance(appContext)
                .enqueueUniqueWork(FOLLOW_UP_WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }

    private fun ensureStateVersion(context: Context) {
        val p = prefs(context)
        val storedVersion = p.getInt(KEY_STATE_VERSION, 0)
        if (storedVersion >= STATE_VERSION) return
        val now = System.currentTimeMillis()
        if (storedVersion == 0) {
            val enabled = p.getBoolean(KEY_ENABLED, false)
            val editor = p.edit().putBoolean(KEY_ENABLED, enabled)
            resetRuntimeState(context, editor, now)
            editor.apply()
        } else {
            // Non-destructive upgrade from v4 -> v5: preserve existing baselines & enabled state
            p.edit()
                .putInt(KEY_STATE_VERSION, STATE_VERSION)
                .putLong(KEY_BASELINE_RESET_AT, p.getLong(KEY_LAST_QUERY_AT, now))
                .apply()
        }
    }

    private fun resetRuntimeState(context: Context, editor: SharedPreferences.Editor, now: Long) {
        editor.putInt(KEY_STATE_VERSION, STATE_VERSION)
            .putLong(KEY_BASELINE_RESET_AT, now)
            .putLong(KEY_LAST_QUERY_AT, now)
            .remove(KEY_PENDING_PACKAGE)
            .remove(KEY_PENDING_END_AT)
            .remove(KEY_LAST_NOTIFICATION_AT)
            .putString(KEY_LAST_SCAN_RESULT, "대기 중")
            .putString(KEY_LAST_USAGE_DEBUG, "초기화됨")
        for (pkg in WatchReminderTargets.all().keys) {
            editor.remove(lastNotificationKey(pkg))
            editor.remove(lastNotifiedEndKey(pkg))
        }
        WatchReminderWorker.initializeBaselines(context, editor, now)
    }

    fun lastNotificationKey(pkg: String) = "last_notification_$pkg"
    fun lastNotifiedEndKey(pkg: String) = "last_notified_end_$pkg"
    fun foregroundTotalKey(pkg: String) = "foreground_total_$pkg"
    fun foregroundIntervalKey(pkg: String) = "foreground_interval_$pkg"
    fun unnotifiedForegroundKey(pkg: String) = "foreground_unnotified_$pkg"
    fun lastUsageKey(pkg: String) = "foreground_last_used_$pkg"
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            WatchReminderScheduler.syncScheduleIfEnabled(context)
            RevisitReminderScheduler.syncAutoState(context)
            QuickLogWidgetProvider.updateAllWidgets(context)
        }
    }
}

object WatchReminderNotifier {
    private const val CHANNEL_ID = "ottline_watch_reminder"
    private const val NOTIFICATION_ID = 4101

    fun show(context: Context, target: WatchReminderTargets.Target): Boolean {
        if (!WatchReminderAccess.canPostNotifications(context)) return false
        ensureChannel(context)

        val intent = Intent(context, LauncherActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("https://ottline.app/?quick=1&quick_type=video&ott=${Uri.encode(target.koPlatformLabel)}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val appLocale = (context.applicationContext as? OttlineApplication)?.appPreferences?.current?.locale
            ?: app.ottline.data.local.AppPreferences(context).current.locale
        val isEn = appLocale == "en"
        val displayPlatform = if (isEn) target.label else target.koPlatformLabel
        val title = if (isEn) "Finished watching on $displayPlatform?" else "${displayPlatform}에서 감상하셨나요?"
        val body = if (isEn) {
            "Jot down a quick line while the feeling is still warm."
        } else {
            "여운이 남아 있을 때 오늘의 순간을 가볍게 남겨보세요."
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_icon)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

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

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.watch_reminder_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = context.getString(R.string.watch_reminder_channel_desc)
            }
            nm.createNotificationChannel(channel)
        }
    }
}

class WatchReminderWorker(
    context: Context,
    workerParams: WorkerParameters
) : Worker(context, workerParams) {

    override fun doWork(): Result {
        scanNow(applicationContext, ignoreCooldown = false)
        return Result.success()
    }

    companion object {
        private const val GLOBAL_COOLDOWN_MS = 3L * 60L * 60L * 1000L
        private const val APP_COOLDOWN_MS = 3L * 60L * 60L * 1000L
        private const val USAGE_STATS_LOOKBACK_MS = 48L * 60L * 60L * 1000L
        private const val USAGE_EVENTS_LOOKBACK_MS = 6L * 60L * 60L * 1000L

        private data class UsageSnapshot(
            val packageName: String,
            val intervalStartAt: Long,
            val totalForegroundMs: Long,
            val lastTimeUsed: Long
        )

        private data class Candidate(
            val packageName: String,
            val endAt: Long
        )

        fun scanNow(context: Context, ignoreCooldown: Boolean): String {
            return runCatching {
                scanInternal(context.applicationContext, ignoreCooldown)
            }.getOrElse { e ->
                val msg = "감지 오류: ${e.javaClass.simpleName}"
                WatchReminderScheduler.prefs(context).edit()
                    .putString(WatchReminderScheduler.KEY_LAST_SCAN_RESULT, msg)
                    .apply()
                msg
            }
        }

        private fun scanInternal(context: Context, ignoreCooldown: Boolean): String {
            if (!WatchReminderScheduler.isEnabled(context)) {
                return saveResult(context, "기능 꺼짐")
            }
            if (!WatchReminderAccess.hasUsageAccess(context)) {
                return saveResult(context, "사용 정보 접근 권한 없음")
            }
            val prefs = WatchReminderScheduler.prefs(context)
            val now = System.currentTimeMillis()
            val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
                ?: return saveResult(context, "UsageStatsManager 없음")

            val baselineResetAt = prefs.getLong(WatchReminderScheduler.KEY_BASELINE_RESET_AT, 0L)
            val lastNotifiedEndByPkg = WatchReminderTargets.all().keys.associateWith { pkg ->
                prefs.getLong(WatchReminderScheduler.lastNotifiedEndKey(pkg), 0L)
            }

            // 1. Event-level session analysis (exact exit detection + active-playback guard)
            val rawEvents = queryRawEvents(usm, max(0L, now - USAGE_EVENTS_LOOKBACK_MS), now)
            val eventAnalysis = WatchReminderEventAnalyzer.analyze(
                events = rawEvents,
                baselineAfterMs = baselineResetAt,
                lastNotifiedEndByPkg = lastNotifiedEndByPkg,
                now = now
            )

            // 2. Aggregated UsageStats fallback (for devices/ROMs that trim raw events)
            val snapshots = querySnapshots(usm, now)
            val states = mutableMapOf<String, WatchReminderUsageTracker.State>()
            for ((pkg, snap) in snapshots) {
                val prev = readState(prefs, pkg)
                states[pkg] = WatchReminderUsageTracker.observe(
                    previous = prev,
                    intervalStartAt = snap.intervalStartAt,
                    totalForegroundMs = snap.totalForegroundMs,
                    lastTimeUsed = snap.lastTimeUsed,
                    now = now
                )
            }

            // Schedule a single 5-min follow-up ONLY if an OTT app is currently active or just closed
            if (!ignoreCooldown && eventAnalysis.hadRecentOttActivity) {
                WatchReminderScheduler.scheduleActiveFollowUp(context)
            }

            // If user is STILL inside an OTT app right now during automatic scan, hold off until they exit!
            if (!ignoreCooldown && eventAnalysis.activePackages.isNotEmpty()) {
                val activeLabel = eventAnalysis.activePackages.firstNotNullOfOrNull {
                    WatchReminderTargets.resolve(it)?.label
                } ?: "OTT"
                val holdEditor = prefs.edit().putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now)
                for ((pkg, st) in states) {
                    writeState(holdEditor, pkg, st)
                }
                holdEditor.apply()
                return saveResult(context, "시청 중 대기 ($activeLabel)")
            }

            val eventCandidate = eventAnalysis.completedCandidates.values
                .maxByOrNull { it.endedAt }
                ?.let { Candidate(it.packageName, it.endedAt) }

            val usageCandidate = states.entries
                .filter { (pkg, st) ->
                    pkg !in eventAnalysis.activePackages &&
                        st.isCandidate(now) &&
                        st.lastTimeUsed > (lastNotifiedEndByPkg[pkg] ?: 0L)
                }
                .maxByOrNull { it.value.lastTimeUsed }
                ?.let { Candidate(it.key, it.value.lastTimeUsed) }

            val pendingPkg = prefs.getString(WatchReminderScheduler.KEY_PENDING_PACKAGE, null)
            val pendingEnd = prefs.getLong(WatchReminderScheduler.KEY_PENDING_END_AT, 0L)
            val pendingCandidate = if (
                !pendingPkg.isNullOrBlank() &&
                pendingEnd > 0L &&
                now - pendingEnd <= WatchReminderUsageTracker.CANDIDATE_WINDOW_MS
            ) {
                Candidate(pendingPkg, pendingEnd)
            } else null

            val manualCandidate = if (ignoreCooldown) {
                snapshots.values
                    .filter { it.lastTimeUsed > 0L && now - it.lastTimeUsed <= 6L * 60L * 60L * 1000L }
                    .maxByOrNull { it.lastTimeUsed }
                    ?.let { Candidate(it.packageName, it.lastTimeUsed) }
            } else null

            val chosen = listOfNotNull(eventCandidate, pendingCandidate, usageCandidate, manualCandidate)
                .maxByOrNull { it.endAt }

            val editor = prefs.edit().putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now)
            for ((pkg, st) in states) {
                val finalState = if (chosen?.packageName == pkg) st.consume() else st
                writeState(editor, pkg, finalState)
            }
            if (pendingCandidate == null && !pendingPkg.isNullOrBlank()) {
                editor.remove(WatchReminderScheduler.KEY_PENDING_PACKAGE)
                    .remove(WatchReminderScheduler.KEY_PENDING_END_AT)
            }
            editor.apply()

            if (chosen == null) {
                return saveResult(context, if (ignoreCooldown) "최근 6시간 내 시청 기록 없음" else "알림 후보 없음")
            }

            val target = WatchReminderTargets.resolve(chosen.packageName)
                ?: return saveResult(context, "대상 앱 매핑 없음")

            val lastGlobal = prefs.getLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT, 0L)
            val lastApp = prefs.getLong(WatchReminderScheduler.lastNotificationKey(chosen.packageName), 0L)
            val cooldownOk = (now - lastGlobal >= GLOBAL_COOLDOWN_MS) && (now - lastApp >= APP_COOLDOWN_MS)

            if (!ignoreCooldown && !cooldownOk) {
                prefs.edit()
                    .putString(WatchReminderScheduler.KEY_PENDING_PACKAGE, chosen.packageName)
                    .putLong(WatchReminderScheduler.KEY_PENDING_END_AT, chosen.endAt)
                    .apply()
                return saveResult(context, "후보 ${target.label} · 쿨다운 보류")
            }

            if (WatchReminderNotifier.show(context, target)) {
                val msg = "알림 발송: ${target.label}"
                prefs.edit()
                    .putLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT, now)
                    .putLong(WatchReminderScheduler.lastNotificationKey(chosen.packageName), now)
                    .putLong(WatchReminderScheduler.lastNotifiedEndKey(chosen.packageName), max(chosen.endAt, now))
                    .remove(WatchReminderScheduler.KEY_PENDING_PACKAGE)
                    .remove(WatchReminderScheduler.KEY_PENDING_END_AT)
                    .putString(WatchReminderScheduler.KEY_LAST_SCAN_RESULT, msg)
                    .apply()
                return msg
            }

            return saveResult(context, "후보 ${target.label} · 알림 발송 보류")
        }

        fun initializeBaselines(context: Context, editor: SharedPreferences.Editor, now: Long) {
            if (!WatchReminderAccess.hasUsageAccess(context)) return
            val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return
            for ((pkg, snap) in querySnapshots(usm, now)) {
                writeState(
                    editor,
                    pkg,
                    WatchReminderUsageTracker.State(
                        intervalStartAt = snap.intervalStartAt,
                        totalForegroundMs = snap.totalForegroundMs,
                        unnotifiedForegroundMs = 0L,
                        lastTimeUsed = snap.lastTimeUsed
                    )
                )
            }
        }

        private fun queryRawEvents(
            usm: UsageStatsManager,
            beginTime: Long,
            endTime: Long
        ): List<WatchReminderEventAnalyzer.RawUsageEvent> {
            val usageEvents = runCatching { usm.queryEvents(beginTime, endTime) }.getOrNull() ?: return emptyList()
            val list = ArrayList<WatchReminderEventAnalyzer.RawUsageEvent>()
            val event = UsageEvents.Event()
            while (usageEvents.hasNextEvent()) {
                if (usageEvents.getNextEvent(event)) {
                    val type = event.eventType
                    if (type == WatchReminderEventAnalyzer.EVENT_RESUMED ||
                        type == WatchReminderEventAnalyzer.EVENT_PAUSED ||
                        type == WatchReminderEventAnalyzer.EVENT_STOPPED ||
                        type == WatchReminderEventAnalyzer.EVENT_SCREEN_NON_INTERACTIVE ||
                        type == WatchReminderEventAnalyzer.EVENT_DEVICE_SHUTDOWN
                    ) {
                        list.add(
                            WatchReminderEventAnalyzer.RawUsageEvent(
                                packageName = event.packageName.orEmpty(),
                                eventType = type,
                                timestamp = event.timeStamp
                            )
                        )
                    }
                }
            }
            return list
        }

        private fun querySnapshots(usm: UsageStatsManager, now: Long): Map<String, UsageSnapshot> {
            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                now - USAGE_STATS_LOOKBACK_MS,
                now
            ).orEmpty()
            val result = mutableMapOf<String, UsageSnapshot>()
            for (s in stats) {
                val pkg = s.packageName ?: continue
                if (WatchReminderTargets.resolve(pkg) == null) continue
                val existing = result[pkg]
                if (existing == null || s.firstTimeStamp >= existing.intervalStartAt) {
                    result[pkg] = UsageSnapshot(
                        packageName = pkg,
                        intervalStartAt = s.firstTimeStamp,
                        totalForegroundMs = s.totalTimeInForeground,
                        lastTimeUsed = s.lastTimeUsed
                    )
                }
            }
            return result
        }

        private fun readState(prefs: SharedPreferences, pkg: String): WatchReminderUsageTracker.State? {
            if (!prefs.contains(WatchReminderScheduler.foregroundIntervalKey(pkg))) return null
            return WatchReminderUsageTracker.State(
                intervalStartAt = prefs.getLong(WatchReminderScheduler.foregroundIntervalKey(pkg), 0L),
                totalForegroundMs = prefs.getLong(WatchReminderScheduler.foregroundTotalKey(pkg), 0L),
                unnotifiedForegroundMs = prefs.getLong(WatchReminderScheduler.unnotifiedForegroundKey(pkg), 0L),
                lastTimeUsed = prefs.getLong(WatchReminderScheduler.lastUsageKey(pkg), 0L)
            )
        }

        private fun writeState(
            editor: SharedPreferences.Editor,
            pkg: String,
            state: WatchReminderUsageTracker.State
        ) {
            editor.putLong(WatchReminderScheduler.foregroundIntervalKey(pkg), state.intervalStartAt)
                .putLong(WatchReminderScheduler.foregroundTotalKey(pkg), state.totalForegroundMs)
                .putLong(WatchReminderScheduler.unnotifiedForegroundKey(pkg), state.unnotifiedForegroundMs)
                .putLong(WatchReminderScheduler.lastUsageKey(pkg), state.lastTimeUsed)
        }

        private fun saveResult(context: Context, result: String): String {
            WatchReminderScheduler.prefs(context).edit()
                .putString(WatchReminderScheduler.KEY_LAST_SCAN_RESULT, result)
                .apply()
            return result
        }
    }
}
