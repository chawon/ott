package app.ottline;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

final class RevisitReminderNotifier {
    private static final String CHANNEL_ID = "revisit_reminder";
    private static final int NOTIFICATION_ID = 240607;

    private RevisitReminderNotifier() {}

    static boolean show(Context context, RevisitReminderApiClient.Reminder reminder) {
        if (!WatchReminderAccess.canPostNotifications(context)) return false;

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "ottline record reminders",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("기록 회고와 이어보기를 알려줍니다.");
            manager.createNotificationChannel(channel);
        }

        Intent launchIntent = new Intent(context, LauncherActivity.class);
        launchIntent.setAction(Intent.ACTION_VIEW);
        launchIntent.setData(buildLaunchUri(reminder.deepLink));
        launchIntent.putExtra(LauncherActivity.EXTRA_REVISIT_DELIVERY_ID, reminder.deliveryId);
        launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                NOTIFICATION_ID,
                launchIntent,
                flags
        );

        Notification.Builder builder = new Notification.Builder(context)
                .setSmallIcon(R.drawable.ic_watch_reminder_notification)
                .setContentTitle(reminder.title)
                .setContentText(reminder.body)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder.setChannelId(CHANNEL_ID);
        }

        manager.notify(NOTIFICATION_ID, builder.build());
        return true;
    }

    private static Uri buildLaunchUri(String deepLink) {
        Uri fallback = Uri.parse("https://ottline.app/me/report?source=android-revisit-reminder");
        if (deepLink == null || deepLink.trim().isEmpty()) return fallback;

        Uri uri = Uri.parse(deepLink);
        if ("https".equals(uri.getScheme()) && "ottline.app".equals(uri.getHost())) {
            return uri;
        }
        return fallback;
    }
}
