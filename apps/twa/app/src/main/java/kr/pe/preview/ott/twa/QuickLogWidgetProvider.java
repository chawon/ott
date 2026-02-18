package kr.pe.preview.ott.twa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class QuickLogWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_log);

        views.setOnClickPendingIntent(
                R.id.widget_btn_video,
                buildPendingIntent(context, appWidgetId, LauncherActivity.QUICK_TYPE_VIDEO, 101));
        views.setOnClickPendingIntent(
                R.id.widget_btn_book,
                buildPendingIntent(context, appWidgetId, LauncherActivity.QUICK_TYPE_BOOK, 202));
        views.setOnClickPendingIntent(
                R.id.widget_btn_timeline,
                buildPendingIntent(context, appWidgetId, LauncherActivity.QUICK_TYPE_TIMELINE, 303));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private PendingIntent buildPendingIntent(Context context, int appWidgetId, String quickType, int salt) {
        Intent intent = new Intent(context, LauncherActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.putExtra(LauncherActivity.EXTRA_QUICK_TYPE, quickType);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int requestCode = (appWidgetId * 1000) + salt;
        return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
