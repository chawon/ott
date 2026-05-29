package app.ottline;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public final class WatchReminderWorker extends Worker {
    private static final long INITIAL_LOOKBACK_MS = 6L * 60L * 60L * 1000L;
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
        long since = lastQueryAt > 0L ? lastQueryAt : now - INITIAL_LOOKBACK_MS;

        UsageStatsManager usageStatsManager =
                (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) return Result.success();

        String activePackage = prefs.getString(WatchReminderScheduler.KEY_ACTIVE_PACKAGE, null);
        long activeStartAt = prefs.getLong(WatchReminderScheduler.KEY_ACTIVE_START_AT, 0L);
        Candidate latestCandidate = null;

        UsageEvents events = usageStatsManager.queryEvents(since, now);
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (lastQueryAt > 0L && event.getTimeStamp() <= lastQueryAt) continue;

            String packageName = event.getPackageName();
            int eventType = event.getEventType();
            if (isForegroundEvent(eventType)) {
                if (WatchReminderTargets.contains(packageName)) {
                    activePackage = packageName;
                    activeStartAt = event.getTimeStamp();
                } else if (activePackage != null) {
                    latestCandidate = chooseLatest(
                            latestCandidate,
                            buildCandidate(activePackage, activeStartAt, event.getTimeStamp())
                    );
                    activePackage = null;
                    activeStartAt = 0L;
                }
            } else if (isBackgroundEvent(eventType)
                    && activePackage != null
                    && activePackage.equals(packageName)) {
                latestCandidate = chooseLatest(
                        latestCandidate,
                        buildCandidate(activePackage, activeStartAt, event.getTimeStamp())
                );
                activePackage = null;
                activeStartAt = 0L;
            }
        }

        SharedPreferences.Editor editor = prefs.edit()
                .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT, now);
        if (activePackage != null && WatchReminderTargets.contains(activePackage)) {
            editor.putString(WatchReminderScheduler.KEY_ACTIVE_PACKAGE, activePackage)
                    .putLong(WatchReminderScheduler.KEY_ACTIVE_START_AT, activeStartAt);
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
                        .putLong(lastNotificationKey(latestCandidate.packageName), now)
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

    private static Candidate chooseLatest(Candidate current, Candidate next) {
        if (next == null) return current;
        if (current == null || next.endAt > current.endAt) return next;
        return current;
    }

    private static boolean canNotify(SharedPreferences prefs, String packageName, long now) {
        long lastGlobal = prefs.getLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT, 0L);
        long lastApp = prefs.getLong(lastNotificationKey(packageName), 0L);
        return now - lastGlobal >= GLOBAL_COOLDOWN_MS && now - lastApp >= APP_COOLDOWN_MS;
    }

    private static String lastNotificationKey(String packageName) {
        return "last_notification_" + packageName;
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
