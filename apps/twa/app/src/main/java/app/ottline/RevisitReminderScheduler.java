package app.ottline;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

final class RevisitReminderScheduler {
    private static final String PREFS = "ottline.revisit_reminder";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_USER_SET = "user_set";
    static final String KEY_LAST_RESULT = "last_result";
    static final String WORK_NAME = "ottline-revisit-reminder";

    private RevisitReminderScheduler() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context context) {
        SharedPreferences prefs = prefs(context);
        if (!prefs.contains(KEY_ENABLED)) {
            return WatchReminderAccess.canPostNotifications(context);
        }
        return prefs.getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit()
                .putBoolean(KEY_ENABLED, enabled)
                .putBoolean(KEY_USER_SET, true)
                .apply();
        if (enabled && WatchReminderAccess.canPostNotifications(context)) {
            schedule(context);
        } else {
            cancel(context);
        }
        syncPreferences(context, enabled);
    }

    static void syncAutoState(Context context) {
        SharedPreferences prefs = prefs(context);
        if (!prefs.getBoolean(KEY_USER_SET, false) && WatchReminderAccess.canPostNotifications(context)) {
            prefs.edit().putBoolean(KEY_ENABLED, true).apply();
        }
        if (isEnabled(context) && WatchReminderAccess.canPostNotifications(context)) {
            schedule(context);
        } else {
            cancel(context);
        }
    }

    static void schedule(Context context) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                RevisitReminderWorker.class,
                24,
                TimeUnit.HOURS
        ).build();
        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(
                        WORK_NAME,
                        ExistingPeriodicWorkPolicy.KEEP,
                        request
                );
    }

    static void cancel(Context context) {
        WorkManager.getInstance(context.getApplicationContext()).cancelUniqueWork(WORK_NAME);
    }

    static void saveResult(Context context, String result) {
        prefs(context).edit().putString(KEY_LAST_RESULT, result).apply();
    }

    private static void syncPreferences(Context context, boolean enabled) {
        Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                RevisitReminderApiClient.updatePreferences(appContext, enabled);
            } catch (Throwable ignored) {
            }
        }).start();
    }
}
