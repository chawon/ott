package app.ottline;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.HashMap;
import java.util.Map;

public final class WatchReminderWorker extends Worker {
    private static final long MIN_SESSION_MS = 10L * 60L * 1000L;
    private static final long GLOBAL_COOLDOWN_MS = 3L * 60L * 60L * 1000L;
    private static final long APP_COOLDOWN_MS = 24L * 60L * 60L * 1000L;

    public WatchReminderWorker(
            @NonNull Context context,
            @NonNull WorkerParameters workerParams
    ) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        if (!WatchReminderScheduler.isEnabled(context)) return Result.success();
        if (!WatchReminderAccess.hasUsageAccess(context)) return Result.success();

        SharedPreferences prefs = WatchReminderScheduler.prefs(context);
        long now = System.currentTimeMillis();
        long lastQueryAt = prefs.getLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, 0L);
        if (lastQueryAt <= 0L) {
            prefs.edit()
                    .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now)
                    .apply();
            return Result.success();
        }

        UsageStatsManager usageStatsManager =
                (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) return Result.success();

        Map<String, Long> activeStarts = new HashMap<>();
        String storedActivePackage = prefs.getString(WatchReminderScheduler.KEY_ACTIVE_PACKAGE, null);
        long storedActiveStartAt = prefs.getLong(WatchReminderScheduler.KEY_ACTIVE_START_AT, 0L);
        if (WatchReminderTargets.contains(storedActivePackage) && storedActiveStartAt > 0L) {
            activeStarts.put(storedActivePackage, storedActiveStartAt);
        }
        Candidate latestCandidate = null;

        UsageEvents events = usageStatsManager.queryEvents(lastQueryAt, now);
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (lastQueryAt > 0L && event.getTimeStamp() <= lastQueryAt) continue;

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

        SharedPreferences.Editor editor = prefs.edit()
                .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now);
        Candidate activeCandidate = latestActive(activeStarts);
        if (activeCandidate != null) {
            editor.putString(WatchReminderScheduler.KEY_ACTIVE_PACKAGE, activeCandidate.packageName)
                    .putLong(WatchReminderScheduler.KEY_ACTIVE_START_AT, activeCandidate.endAt);
        } else {
            editor.remove(WatchReminderScheduler.KEY_ACTIVE_PACKAGE)
                    .remove(WatchReminderScheduler.KEY_ACTIVE_START_AT);
        }
        editor.apply();

        if (latestCandidate != null && canNotify(prefs, latestCandidate.packageName, now)) {
            WatchReminderTargets.Target target = WatchReminderTargets.find(latestCandidate.packageName);
            if (target != null && WatchReminderNotifier.show(context, target)) {
                prefs.edit()
                        .putLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT, now)
                        .putLong(WatchReminderScheduler.lastNotificationKey(latestCandidate.packageName), now)
                        .apply();
            }
        }

        return Result.success();
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
        return new Candidate(packageName, endAt);
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
            Candidate active = new Candidate(entry.getKey(), entry.getValue());
            latest = chooseLatest(latest, active);
        }
        return latest;
    }

    private static final class Candidate {
        final String packageName;
        final long endAt;

        Candidate(String packageName, long endAt) {
            this.packageName = packageName;
            this.endAt = endAt;
        }
    }
}
