package app.ottline;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

public class RevisitReminderOpenReceiver extends BroadcastReceiver {
    static final String EXTRA_DELIVERY_ID = "delivery_id";
    static final String EXTRA_DEEP_LINK = "deep_link";

    @Override
    public void onReceive(Context context, Intent intent) {
        String deliveryId = intent == null ? null : intent.getStringExtra(EXTRA_DELIVERY_ID);
        String deepLink = intent == null ? null : intent.getStringExtra(EXTRA_DEEP_LINK);
        Context appContext = context.getApplicationContext();

        if (deliveryId != null && !deliveryId.isBlank()) {
            new Thread(() -> {
                try {
                    RevisitReminderApiClient.markOpened(appContext, deliveryId);
                } catch (Throwable ignored) {
                }
            }).start();
        }

        Intent launchIntent = new Intent(appContext, LauncherActivity.class);
        launchIntent.setAction(Intent.ACTION_VIEW);
        launchIntent.setData(Uri.parse(
                deepLink == null || deepLink.isBlank()
                        ? "https://ottline.app/me/report?source=android-revisit-reminder"
                        : deepLink
        ));
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        appContext.startActivity(launchIntent);
    }
}
