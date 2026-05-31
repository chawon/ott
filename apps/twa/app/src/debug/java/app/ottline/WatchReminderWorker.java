package app.ottline;

import android.app.usage.UsageStats;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class WatchReminderWorker extends Worker {
    private static final long MIN_SESSION_MS = 10L * 60L * 1000L;
    private static final long GLOBAL_COOLDOWN_MS = 3L * 60L * 60L * 1000L;
    private static final long APP_COOLDOWN_MS = 24L * 60L * 60L * 1000L;
    private static final long USAGE_STATS_LOOKBACK_MS = 48L * 60L * 60L * 1000L;
    private static final long USAGE_STATS_CANDIDATE_WINDOW_MS = 6L * 60L * 60L * 1000L;
    private static final long DEBUG_EVENTS_LOOKBACK_MS = 90L * 60L * 1000L;
    private static final int DEBUG_EVENT_LIMIT = 16;

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

        Map<String, Long> activeStarts = new HashMap<>();
        String storedActivePackage = prefs.getString(
                WatchReminderScheduler.KEY_ACTIVE_PACKAGE,
                null
        );
        long storedActiveStartAt = prefs.getLong(
                WatchReminderScheduler.KEY_ACTIVE_START_AT,
                0L
        );
        if (WatchReminderTargets.contains(storedActivePackage) && storedActiveStartAt > 0L) {
            activeStarts.put(storedActivePackage, storedActiveStartAt);
        }
        Candidate latestCandidate = null;

        UsageEvents events = usageStatsManager.queryEvents(lastQueryAt, now);
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getTimeStamp() <= lastQueryAt) continue;

            String packageName = event.getPackageName();
            int eventType = event.getEventType();
            if (isForegroundEvent(eventType)) {
                if (WatchReminderTargets.contains(packageName)) {
                    activeStarts.put(packageName, event.getTimeStamp());
                } else if (!activeStarts.isEmpty()) {
                    latestCandidate = closeActiveSessions(
                            latestCandidate,
                            activeStarts,
                            event.getTimeStamp()
                    );
                }
            } else if (isBackgroundEvent(eventType)
                    && WatchReminderTargets.contains(packageName)) {
                Long activeStartAt = activeStarts.remove(packageName);
                latestCandidate = chooseLatest(
                        latestCandidate,
                        buildCandidate(packageName, activeStartAt, event.getTimeStamp())
                );
            }
        }

        Candidate eventCandidate = latestCandidate;
        Map<String, UsageSnapshot> usageSnapshots = queryUsageSnapshots(usageStatsManager, now, true);
        Candidate usageStatsCandidate = findUsageStatsCandidate(prefs, usageSnapshots, now);
        if (latestCandidate == null) {
            latestCandidate = usageStatsCandidate;
        }
        Candidate recentUsageCandidate = findRecentUsageCandidate(usageSnapshots, now);
        String usageDebug = buildUsageDebug(
                prefs,
                usageSnapshots,
                lastQueryAt,
                now,
                eventCandidate,
                usageStatsCandidate,
                recentUsageCandidate,
                readRecentTargetEvents(usageStatsManager, now)
        );

        SharedPreferences.Editor editor = prefs.edit()
                .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now)
                .putString(WatchReminderScheduler.KEY_LAST_USAGE_DEBUG, usageDebug);
        Candidate activeCandidate = latestActive(activeStarts);
        if (activeCandidate != null) {
            editor.putString(WatchReminderScheduler.KEY_ACTIVE_PACKAGE, activeCandidate.packageName)
                    .putLong(WatchReminderScheduler.KEY_ACTIVE_START_AT, activeCandidate.endAt);
        } else {
            editor.remove(WatchReminderScheduler.KEY_ACTIVE_PACKAGE)
                    .remove(WatchReminderScheduler.KEY_ACTIVE_START_AT);
        }
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
        Candidate lastSeenCandidate = findLastSeenCandidate(usageSnapshots, now);
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

    private static boolean isForegroundEvent(int type) {
        return type == UsageEvents.Event.MOVE_TO_FOREGROUND
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && type == UsageEvents.Event.ACTIVITY_RESUMED);
    }

    private static boolean isBackgroundEvent(int type) {
        return type == UsageEvents.Event.MOVE_TO_BACKGROUND
                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && (type == UsageEvents.Event.ACTIVITY_PAUSED
                || type == UsageEvents.Event.ACTIVITY_STOPPED));
    }

    private static Candidate buildCandidate(String packageName, long startAt, long endAt) {
        if (packageName == null || startAt <= 0L || endAt <= startAt) return null;
        if (endAt - startAt < MIN_SESSION_MS) return null;
        return new Candidate(packageName, endAt, "event");
    }

    private static Candidate buildCandidate(String packageName, Long startAt, long endAt) {
        return startAt == null ? null : buildCandidate(packageName, startAt, endAt);
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

    private static Candidate closeActiveSessions(
            Candidate latestCandidate,
            Map<String, Long> activeStarts,
            long endAt
    ) {
        Candidate latest = latestCandidate;
        for (Map.Entry<String, Long> entry : activeStarts.entrySet()) {
            latest = chooseLatest(
                    latest,
                    buildCandidate(entry.getKey(), entry.getValue(), endAt)
            );
        }
        activeStarts.clear();
        return latest;
    }

    private static Candidate latestActive(Map<String, Long> activeStarts) {
        Candidate latest = null;
        for (Map.Entry<String, Long> entry : activeStarts.entrySet()) {
            Candidate active = new Candidate(entry.getKey(), entry.getValue(), "active");
            latest = chooseLatest(latest, active);
        }
        return latest;
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
            if (snapshot == null || delta < MIN_SESSION_MS) continue;
            if (snapshot.lastTimeUsed <= 0L) continue;
            if (now - snapshot.lastTimeUsed > USAGE_STATS_CANDIDATE_WINDOW_MS) continue;

            latest = chooseLatest(latest, new Candidate(
                    packageName,
                    snapshot.lastTimeUsed,
                    "usage"
            ));
        }
        return latest;
    }

    private static Candidate findRecentUsageCandidate(
            Map<String, UsageSnapshot> snapshots,
            long now
    ) {
        Candidate latest = null;
        for (Map.Entry<String, UsageSnapshot> entry : snapshots.entrySet()) {
            String packageName = entry.getKey();
            if (!WatchReminderTargets.contains(packageName)) continue;

            UsageSnapshot snapshot = entry.getValue();
            if (snapshot.totalForegroundMs < MIN_SESSION_MS) continue;
            if (snapshot.lastTimeUsed <= 0L) continue;
            if (now - snapshot.lastTimeUsed > USAGE_STATS_CANDIDATE_WINDOW_MS) continue;

            latest = chooseLatest(latest, new Candidate(
                    packageName,
                    snapshot.lastTimeUsed,
                    "recent"
            ));
        }
        return latest;
    }

    private static Candidate findLastSeenCandidate(
            Map<String, UsageSnapshot> snapshots,
            long now
    ) {
        Candidate latest = null;
        for (Map.Entry<String, UsageSnapshot> entry : snapshots.entrySet()) {
            String packageName = entry.getKey();
            if (!WatchReminderTargets.contains(packageName)) continue;

            UsageSnapshot snapshot = entry.getValue();
            if (snapshot.lastTimeUsed <= 0L || snapshot.totalForegroundMs <= 0L) continue;
            if (now - snapshot.lastTimeUsed > USAGE_STATS_CANDIDATE_WINDOW_MS) continue;

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
        builder.append("최근 사용 후보: ")
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

        builder.append('\n').append("최근 이벤트: ").append(recentEvents);
        return builder.toString();
    }

    private static String readRecentTargetEvents(UsageStatsManager usageStatsManager, long now) {
        UsageEvents events = usageStatsManager.queryEvents(
                Math.max(0L, now - DEBUG_EVENTS_LOOKBACK_MS),
                now
        );
        UsageEvents.Event event = new UsageEvents.Event();
        List<String> lines = new ArrayList<>();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (!WatchReminderTargets.contains(event.getPackageName())) continue;
            if (lines.size() >= DEBUG_EVENT_LIMIT) {
                lines.remove(0);
            }
            WatchReminderTargets.Target target = WatchReminderTargets.find(event.getPackageName());
            String label = target == null ? event.getPackageName() : target.label;
            lines.add(label + " " + eventName(event.getEventType()) + " " + formatAge(now - event.getTimeStamp()));
        }
        if (lines.isEmpty()) return "대상 앱 이벤트 없음";
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < lines.size(); index++) {
            if (index > 0) builder.append(" / ");
            builder.append(lines.get(index));
        }
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
        if ("recent".equals(source)) return " (최근 사용)";
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

    private static String eventName(int type) {
        if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) return "foreground";
        if (type == UsageEvents.Event.MOVE_TO_BACKGROUND) return "background";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) return "resumed";
            if (type == UsageEvents.Event.ACTIVITY_PAUSED) return "paused";
            if (type == UsageEvents.Event.ACTIVITY_STOPPED) return "stopped";
        }
        return "event-" + type;
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
