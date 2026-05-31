package app.ottline;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class WatchReminderWorker extends Worker {
    private static final long AUTO_MIN_FOREGROUND_MS = 5L * 60L * 1000L;
    private static final long GLOBAL_COOLDOWN_MS = 3L * 60L * 60L * 1000L;
    private static final long APP_COOLDOWN_MS = 24L * 60L * 60L * 1000L;
    private static final long USAGE_STATS_LOOKBACK_MS = 48L * 60L * 60L * 1000L;
    private static final long AUTO_CANDIDATE_WINDOW_MS = 15L * 60L * 1000L;
    private static final long MANUAL_CANDIDATE_WINDOW_MS = 6L * 60L * 60L * 1000L;

    public WatchReminderWorker(
            @NonNull Context context,
            @NonNull WorkerParameters workerParams
    ) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        scanNow(getApplicationContext(), false);
        WatchReminderScheduler.scheduleNextOneShot(getApplicationContext());
        return Result.success();
    }

    static String scanNow(Context context, boolean ignoreCooldown) {
        try {
            return scanNowInternal(context.getApplicationContext(), ignoreCooldown);
        } catch (Throwable error) {
            return saveFailure(context, "감지 오류", error);
        }
    }

    static String saveFailure(Context context, String prefix, Throwable error) {
        String result = prefix + ": " + error.getClass().getSimpleName();
        String message = error.getMessage();
        if (message != null && !message.isEmpty()) {
            result += " · " + trimForDebug(message, 180);
        }
        WatchReminderScheduler.prefs(context).edit()
                .putString(WatchReminderScheduler.KEY_LAST_SCAN_RESULT, result)
                .putString(WatchReminderScheduler.KEY_LAST_USAGE_DEBUG, result)
                .apply();
        return result;
    }

    private static String scanNowInternal(Context context, boolean ignoreCooldown) {
        if (!WatchReminderScheduler.isEnabled(context)) {
            return saveResult(context, "기능 꺼짐");
        }
        if (!WatchReminderAccess.hasUsageAccess(context)) {
            return saveResult(context, "사용 정보 접근 권한 없음");
        }

        SharedPreferences prefs = WatchReminderScheduler.prefs(context);
        long now = System.currentTimeMillis();
        long lastQueryAt = prefs.getLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, 0L);
        if (lastQueryAt <= 0L) {
            prefs.edit()
                    .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now)
                    .apply();
            return saveResult(context, "감지 기준 시각 초기화됨");
        }

        UsageStatsManager usageStatsManager =
                (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) {
            return saveResult(context, "UsageStatsManager 없음");
        }

        if (ignoreCooldown) {
            return scanManualNow(context, prefs, usageStatsManager, now, lastQueryAt);
        }

        Map<String, UsageSnapshot> usageSnapshots = queryUsageSnapshots(usageStatsManager, now, true);
        Candidate usageStatsCandidate = findUsageStatsCandidate(prefs, usageSnapshots, now);
        Candidate lastSeenCandidate = findLastSeenCandidate(usageSnapshots, now, lastQueryAt);
        Candidate latestCandidate = usageStatsCandidate;
        String usageDebug = buildUsageDebug(
                prefs,
                usageSnapshots,
                lastQueryAt,
                now,
                null,
                usageStatsCandidate,
                lastSeenCandidate,
                "자동 감지는 5분 이상 foreground 증가분만 후보"
        );

        SharedPreferences.Editor editor = prefs.edit()
                .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now)
                .putString(WatchReminderScheduler.KEY_LAST_USAGE_DEBUG, usageDebug)
                .remove(WatchReminderScheduler.KEY_ACTIVE_PACKAGE)
                .remove(WatchReminderScheduler.KEY_ACTIVE_START_AT);
        writeUsageBaselines(editor, usageSnapshots);
        editor.apply();

        if (latestCandidate == null) {
            return saveResult(context, "알림 후보 없음");
        }

        WatchReminderTargets.Target target = WatchReminderTargets.find(latestCandidate.packageName);
        if (target == null) {
            return saveResult(context, "대상 앱 매핑 없음: " + latestCandidate.packageName);
        }

        if (!ignoreCooldown && !canNotify(prefs, latestCandidate.packageName, now)) {
            savePendingCandidate(prefs, latestCandidate);
            return saveResult(context, "후보 " + target.label + " · cooldown으로 보류");
        }

        if (!WatchReminderAccess.canPostNotifications(context)) {
            savePendingCandidate(prefs, latestCandidate);
            return saveResult(context, "후보 " + target.label + " · 알림 권한 없음");
        }

        if (WatchReminderNotifier.show(context, target)) {
            String result = "알림 발송: " + target.label + sourceSuffix(latestCandidate.source);
            prefs.edit()
                    .putLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT, now)
                    .putLong(
                            WatchReminderScheduler.lastNotificationKey(latestCandidate.packageName),
                            now
                    )
                    .remove(WatchReminderScheduler.KEY_PENDING_PACKAGE)
                    .remove(WatchReminderScheduler.KEY_PENDING_END_AT)
                    .putString(WatchReminderScheduler.KEY_LAST_SCAN_RESULT, result)
                    .apply();
            return result;
        }

        savePendingCandidate(prefs, latestCandidate);
        return saveResult(context, "후보 " + target.label + " · 알림 발송 실패");
    }

    private static String scanManualNow(
            Context context,
            SharedPreferences prefs,
            UsageStatsManager usageStatsManager,
            long now,
            long lastQueryAt
    ) {
        Map<String, UsageSnapshot> usageSnapshots = queryUsageSnapshots(usageStatsManager, now, true);
        Candidate pendingCandidate = readPendingCandidate(prefs);
        Candidate usageStatsCandidate = findUsageStatsCandidate(prefs, usageSnapshots, now);
        Candidate lastSeenCandidate = findLastSeenCandidate(usageSnapshots, now, 0L);
        Candidate latestCandidate = chooseLatest(
                chooseLatest(pendingCandidate, usageStatsCandidate),
                lastSeenCandidate
        );

        String usageDebug = buildUsageDebug(
                prefs,
                usageSnapshots,
                lastQueryAt,
                now,
                null,
                usageStatsCandidate,
                lastSeenCandidate,
                "수동 감지는 이벤트 조회 생략"
        );

        SharedPreferences.Editor editor = prefs.edit()
                .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now)
                .putString(WatchReminderScheduler.KEY_LAST_USAGE_DEBUG, usageDebug);
        writeUsageBaselines(editor, usageSnapshots);
        editor.apply();

        if (latestCandidate == null) {
            return saveResult(context, "알림 후보 없음 (수동)");
        }

        WatchReminderTargets.Target target = WatchReminderTargets.find(latestCandidate.packageName);
        if (target == null) {
            return saveResult(context, "대상 앱 매핑 없음: " + latestCandidate.packageName);
        }

        if (!WatchReminderAccess.canPostNotifications(context)) {
            savePendingCandidate(prefs, latestCandidate);
            return saveResult(context, "후보 " + target.label + " · 알림 권한 없음");
        }

        if (WatchReminderNotifier.show(context, target)) {
            String result = "알림 발송: " + target.label + sourceSuffix(latestCandidate.source);
            prefs.edit()
                    .putLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT, now)
                    .putLong(
                            WatchReminderScheduler.lastNotificationKey(latestCandidate.packageName),
                            now
                    )
                    .remove(WatchReminderScheduler.KEY_PENDING_PACKAGE)
                    .remove(WatchReminderScheduler.KEY_PENDING_END_AT)
                    .putString(WatchReminderScheduler.KEY_LAST_SCAN_RESULT, result)
                    .apply();
            return result;
        }

        savePendingCandidate(prefs, latestCandidate);
        return saveResult(context, "후보 " + target.label + " · 알림 발송 실패");
    }

    private static String saveResult(Context context, String result) {
        WatchReminderScheduler.prefs(context).edit()
                .putString(WatchReminderScheduler.KEY_LAST_SCAN_RESULT, result)
                .apply();
        return result;
    }

    private static Candidate chooseLatest(Candidate current, Candidate next) {
        if (next == null) return current;
        if (current == null || next.endAt > current.endAt) return next;
        return current;
    }

    private static boolean canNotify(SharedPreferences prefs, String packageName, long now) {
        long lastGlobal = prefs.getLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT, 0L);
        long lastApp = prefs.getLong(WatchReminderScheduler.lastNotificationKey(packageName), 0L);
        return now - lastGlobal >= GLOBAL_COOLDOWN_MS && now - lastApp >= APP_COOLDOWN_MS;
    }

    private static Candidate readPendingCandidate(SharedPreferences prefs) {
        String packageName = prefs.getString(WatchReminderScheduler.KEY_PENDING_PACKAGE, null);
        long endAt = prefs.getLong(WatchReminderScheduler.KEY_PENDING_END_AT, 0L);
        if (!WatchReminderTargets.contains(packageName) || endAt <= 0L) return null;
        return new Candidate(packageName, endAt, "pending");
    }

    private static void savePendingCandidate(SharedPreferences prefs, Candidate candidate) {
        prefs.edit()
                .putString(WatchReminderScheduler.KEY_PENDING_PACKAGE, candidate.packageName)
                .putLong(WatchReminderScheduler.KEY_PENDING_END_AT, candidate.endAt)
                .apply();
    }

    static Map<String, Long> currentForegroundTotals(Context context, long now) {
        UsageStatsManager usageStatsManager =
                (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) return new HashMap<>();

        Map<String, UsageSnapshot> snapshots = queryUsageSnapshots(usageStatsManager, now, true);
        Map<String, Long> totals = new HashMap<>();
        for (Map.Entry<String, UsageSnapshot> entry : snapshots.entrySet()) {
            totals.put(entry.getKey(), entry.getValue().totalForegroundMs);
        }
        return totals;
    }

    private static Map<String, UsageSnapshot> queryUsageSnapshots(
            UsageStatsManager usageStatsManager,
            long now,
            boolean targetOnly
    ) {
        Map<String, UsageSnapshot> snapshots = new HashMap<>();
        List<UsageStats> stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                Math.max(0L, now - USAGE_STATS_LOOKBACK_MS),
                now
        );
        if (stats == null) return snapshots;

        for (UsageStats usageStats : stats) {
            String packageName = usageStats.getPackageName();
            if (targetOnly && !WatchReminderTargets.contains(packageName)) continue;

            UsageSnapshot snapshot = snapshots.get(packageName);
            if (snapshot == null) {
                snapshot = new UsageSnapshot();
                snapshots.put(packageName, snapshot);
            }
            snapshot.totalForegroundMs += usageStats.getTotalTimeInForeground();
            snapshot.lastTimeUsed = Math.max(snapshot.lastTimeUsed, usageStats.getLastTimeUsed());
        }
        return snapshots;
    }

    private static Candidate findUsageStatsCandidate(
            SharedPreferences prefs,
            Map<String, UsageSnapshot> snapshots,
            long now
    ) {
        Candidate latest = null;
        for (String packageName : WatchReminderTargets.all().keySet()) {
            String key = WatchReminderScheduler.foregroundTotalKey(packageName);
            UsageSnapshot snapshot = snapshots.get(packageName);
            long currentTotal = snapshot == null ? 0L : snapshot.totalForegroundMs;
            if (!prefs.contains(key)) continue;

            long previousTotal = prefs.getLong(key, currentTotal);
            long delta = currentTotal - previousTotal;
            if (snapshot == null || delta < AUTO_MIN_FOREGROUND_MS) continue;
            if (snapshot.lastTimeUsed <= 0L) continue;
            if (now - snapshot.lastTimeUsed > AUTO_CANDIDATE_WINDOW_MS) continue;

            latest = chooseLatest(latest, new Candidate(
                    packageName,
                    snapshot.lastTimeUsed,
                    "usage"
            ));
        }
        return latest;
    }

    private static Candidate findLastSeenCandidate(
            Map<String, UsageSnapshot> snapshots,
            long now,
            long minLastUsedAt
    ) {
        Candidate latest = null;
        for (Map.Entry<String, UsageSnapshot> entry : snapshots.entrySet()) {
            String packageName = entry.getKey();
            if (!WatchReminderTargets.contains(packageName)) continue;

            UsageSnapshot snapshot = entry.getValue();
            if (snapshot.lastTimeUsed <= 0L || snapshot.totalForegroundMs <= 0L) continue;
            if (snapshot.lastTimeUsed <= minLastUsedAt) continue;
            if (now - snapshot.lastTimeUsed > MANUAL_CANDIDATE_WINDOW_MS) continue;

            latest = chooseLatest(latest, new Candidate(
                    packageName,
                    snapshot.lastTimeUsed,
                    "last_seen"
            ));
        }
        return latest;
    }

    private static void writeUsageBaselines(
            SharedPreferences.Editor editor,
            Map<String, UsageSnapshot> snapshots
    ) {
        for (String packageName : WatchReminderTargets.all().keySet()) {
            UsageSnapshot snapshot = snapshots.get(packageName);
            String key = WatchReminderScheduler.foregroundTotalKey(packageName);
            if (snapshot == null) {
                editor.putLong(key, 0L);
            } else {
                editor.putLong(key, snapshot.totalForegroundMs);
            }
        }
    }

    private static String buildUsageDebug(
            SharedPreferences prefs,
            Map<String, UsageSnapshot> snapshots,
            long lastQueryAt,
            long now,
            Candidate eventCandidate,
            Candidate usageStatsCandidate,
            Candidate recentUsageCandidate,
            String recentEvents
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append("스캔 기간: ")
                .append(formatDuration(now - lastQueryAt))
                .append('\n');
        builder.append("이벤트 후보: ")
                .append(formatCandidate(eventCandidate))
                .append('\n');
        builder.append("누적시간 후보: ")
                .append(formatCandidate(usageStatsCandidate))
                .append('\n');
        builder.append("마지막 사용 후보: ")
                .append(formatCandidate(recentUsageCandidate));

        for (Map.Entry<String, WatchReminderTargets.Target> entry : WatchReminderTargets.all().entrySet()) {
            String packageName = entry.getKey();
            UsageSnapshot snapshot = snapshots.get(packageName);
            String key = WatchReminderScheduler.foregroundTotalKey(packageName);
            long currentTotal = snapshot == null ? 0L : snapshot.totalForegroundMs;
            long previousTotal = prefs.contains(key) ? prefs.getLong(key, currentTotal) : currentTotal;
            long delta = Math.max(0L, currentTotal - previousTotal);

            builder.append('\n')
                    .append(entry.getValue().label)
                    .append(": +")
                    .append(formatDuration(delta))
                    .append(", 마지막 사용 ")
                    .append(snapshot == null || snapshot.lastTimeUsed <= 0L
                            ? "없음"
                            : formatAge(now - snapshot.lastTimeUsed));
        }

        builder.append('\n').append("감지 메모: ").append(recentEvents);
        return builder.toString();
    }

    private static String formatCandidate(Candidate candidate) {
        if (candidate == null) return "없음";
        WatchReminderTargets.Target target = WatchReminderTargets.find(candidate.packageName);
        String label = target == null ? candidate.packageName : target.label;
        return label + sourceSuffix(candidate.source);
    }

    private static String sourceSuffix(String source) {
        if ("usage".equals(source)) return " (누적시간)";
        if ("pending".equals(source)) return " (보류 후보)";
        if ("last_seen".equals(source)) return " (마지막 사용)";
        return "";
    }

    private static String formatDuration(long durationMs) {
        long safe = Math.max(0L, durationMs);
        long minutes = safe / 60000L;
        long seconds = (safe % 60000L) / 1000L;
        if (minutes > 0L) return minutes + "분 " + seconds + "초";
        return seconds + "초";
    }

    private static String formatAge(long ageMs) {
        return formatDuration(ageMs) + " 전";
    }

    private static String trimForDebug(String value, int maxLength) {
        if (value.length() <= maxLength) return value;
        return value.substring(0, maxLength) + "...";
    }

    private static final class UsageSnapshot {
        long totalForegroundMs;
        long lastTimeUsed;
    }

    private static final class Candidate {
        final String packageName;
        final long endAt;
        final String source;

        Candidate(String packageName, long endAt, String source) {
            this.packageName = packageName;
            this.endAt = endAt;
            this.source = source;
        }
    }
}
