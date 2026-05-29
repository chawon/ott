package app.ottline;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

final class WatchReminderNotifier {
    private static final String CHANNEL_ID = "watch_reminder";
    private static final int NOTIFICATION_ID = 240529;

    private WatchReminderNotifier() {}

    static boolean show(Context context, WatchReminderTargets.Target target) {
        if (!WatchReminderAccess.canPostNotifications(context)) return false;

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "ottline watch reminder",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("OTT 앱 사용 후 기록을 남기도록 알려줍니다.");
            manager.createNotificationChannel(channel);
        }

        Intent launchIntent = new Intent(context, LauncherActivity.class);
        launchIntent.setAction(Intent.ACTION_VIEW);
        launchIntent.setData(buildLaunchUri(target));
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

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
                .setSmallIcon(R.drawable.ic_notification_icon)
                .setContentTitle("방금 본 콘텐츠를 기록해볼까요?")
                .setContentText(target.label + "에서 본 작품을 ottline에 남겨보세요.")
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder.setChannelId(CHANNEL_ID);
        }

        manager.notify(NOTIFICATION_ID, builder.build());
        return true;
    }

    private static Uri buildLaunchUri(WatchReminderTargets.Target target) {
        return new Uri.Builder()
                .scheme("https")
                .authority("ottline.app")
                .path("/")
                .appendQueryParameter("quick", "1")
                .appendQueryParameter("quick_type", "video")
                .appendQueryParameter("quick_focus", "1")
                .appendQueryParameter("capture_type", "video")
                .appendQueryParameter("capture_platform_key", target.key)
                .appendQueryParameter("capture_platform", target.label)
                .appendQueryParameter("source", "android-watch-reminder")
                .build();
    }
}
