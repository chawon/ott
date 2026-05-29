package app.ottline;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

final class WatchReminderScheduler {
    static final String PREFS = "ottline.watch_reminder";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_LAST_QUERY_AT = "last_query_at";
    static final String KEY_ACTIVE_PACKAGE = "active_package";
    static final String KEY_ACTIVE_START_AT = "active_start_at";
    static final String KEY_LAST_NOTIFICATION_AT = "last_notification_at";
    static final String WORK_NAME = "ottline-watch-reminder";

    private WatchReminderScheduler() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
        if (enabled) {
            schedule(context);
        } else {
            cancel(context);
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
}
