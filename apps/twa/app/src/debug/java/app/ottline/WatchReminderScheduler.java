package app.ottline;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

final class WatchReminderScheduler {
    private static final int STATE_VERSION = 4;
    static final String PREFS = "ottline.watch_reminder";
    static final String KEY_STATE_VERSION = "state_version";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_LAST_QUERY_AT = "last_query_at";
    static final String KEY_ACTIVE_PACKAGE = "active_package";
    static final String KEY_ACTIVE_START_AT = "active_start_at";
    static final String KEY_PENDING_PACKAGE = "pending_package";
    static final String KEY_PENDING_END_AT = "pending_end_at";
    static final String KEY_LAST_NOTIFICATION_AT = "last_notification_at";
    static final String KEY_LAST_SCAN_RESULT = "last_scan_result";
    static final String KEY_LAST_USAGE_DEBUG = "last_usage_debug";
    static final String WORK_NAME = "ottline-watch-reminder";

    private WatchReminderScheduler() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context context) {
        ensureStateVersion(context);
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        ensureStateVersion(context);
        SharedPreferences.Editor editor = prefs(context).edit()
                .putBoolean(KEY_ENABLED, enabled);
        resetRuntimeState(context, editor, System.currentTimeMillis());
        editor.apply();
        if (enabled) {
            schedule(context);
        } else {
            cancel(context);
        }
    }

    static void resetState(Context context) {
        boolean enabled = isEnabled(context);
        SharedPreferences.Editor editor = prefs(context).edit()
                .putBoolean(KEY_ENABLED, enabled);
        resetRuntimeState(context, editor, System.currentTimeMillis());
        editor.apply();
        if (enabled) {
            schedule(context);
        }
    }

    static void schedule(Context context) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                WatchReminderWorker.class,
                PeriodicWorkRequest.MIN_PERIODIC_INTERVAL_MILLIS,
                TimeUnit.MILLISECONDS
        ).build();

        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(
                        WORK_NAME,
                        ExistingPeriodicWorkPolicy.UPDATE,
                        request
                );
    }

    static void cancel(Context context) {
        WorkManager.getInstance(context.getApplicationContext())
                .cancelUniqueWork(WORK_NAME);
    }

    private static void ensureStateVersion(Context context) {
        SharedPreferences sharedPreferences = prefs(context);
        if (sharedPreferences.getInt(KEY_STATE_VERSION, 0) >= STATE_VERSION) {
            return;
        }

        boolean enabled = sharedPreferences.getBoolean(KEY_ENABLED, false);
        SharedPreferences.Editor editor = sharedPreferences.edit()
                .putBoolean(KEY_ENABLED, enabled);
        resetRuntimeState(context, editor, System.currentTimeMillis());
        editor.apply();
    }

    private static void resetRuntimeState(Context context, SharedPreferences.Editor editor, long now) {
        editor.putInt(KEY_STATE_VERSION, STATE_VERSION)
                .putLong(KEY_LAST_QUERY_AT, now)
                .remove(KEY_ACTIVE_PACKAGE)
                .remove(KEY_ACTIVE_START_AT)
                .remove(KEY_PENDING_PACKAGE)
                .remove(KEY_PENDING_END_AT)
                .remove(KEY_LAST_NOTIFICATION_AT)
                .putString(KEY_LAST_SCAN_RESULT, "초기화됨")
                .putString(KEY_LAST_USAGE_DEBUG, "초기화됨");

        boolean usageAccess = WatchReminderAccess.hasUsageAccess(context);
        java.util.Map<String, Long> totals = WatchReminderWorker.currentForegroundTotals(context, now);
        for (String packageName : WatchReminderTargets.all().keySet()) {
            editor.remove(lastNotificationKey(packageName));
            Long total = totals.get(packageName);
            if (total == null) {
                if (usageAccess) {
                    editor.putLong(foregroundTotalKey(packageName), 0L);
                } else {
                    editor.remove(foregroundTotalKey(packageName));
                }
            } else {
                editor.putLong(foregroundTotalKey(packageName), total);
            }
        }
    }

    static String lastNotificationKey(String packageName) {
        return "last_notification_" + packageName;
    }

    static String foregroundTotalKey(String packageName) {
        return "foreground_total_" + packageName;
    }
}
