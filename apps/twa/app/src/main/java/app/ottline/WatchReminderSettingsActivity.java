package app.ottline;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Map;

public class WatchReminderSettingsActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 529;
    private static final int SCREEN_BACKGROUND = Color.rgb(247, 248, 250);
    private static final int SURFACE = Color.WHITE;
    private static final int BORDER = Color.rgb(225, 231, 239);
    private static final int TEXT_PRIMARY = Color.rgb(22, 23, 26);
    private static final int TEXT_SECONDARY = Color.rgb(82, 88, 100);
    private static final int TEXT_MUTED = Color.rgb(105, 113, 128);
    private static final int PRIMARY = Color.rgb(30, 77, 140);
    private static final int SUCCESS = Color.rgb(22, 101, 52);
    private static final int WARNING = Color.rgb(180, 83, 9);
    private static final int DISABLED_BACKGROUND = Color.rgb(229, 231, 235);

    private LinearLayout content;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(SCREEN_BACKGROUND));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(SCREEN_BACKGROUND);
            getWindow().setNavigationBarColor(SCREEN_BACKGROUND);
        }

        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(SCREEN_BACKGROUND);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setBackgroundColor(SCREEN_BACKGROUND);
        int padding = dp(20);
        content.setPadding(padding, padding, padding, padding);
        scrollView.addView(content);
        setContentView(scrollView);
    }

    @Override
    protected void onResume() {
        super.onResume();
        renderSafely();
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            renderSafely();
        }
    }

    private void render() {
        content.removeAllViews();

        boolean enabled = WatchReminderScheduler.isEnabled(this);
        boolean usageAccess = WatchReminderAccess.hasUsageAccess(this);
        boolean notifications = WatchReminderAccess.canPostNotifications(this);
        boolean ready = usageAccess && notifications;
        boolean showDebugControls = showDebugControls();

        addHeader(enabled, usageAccess, notifications);
        addStepCard(
                "1",
                "사용 정보 접근",
                "OTT 앱을 일정 시간 사용했는지만 확인합니다.",
                usageAccess ? "허용됨" : "필요함",
                usageAccess
        );
        if (!usageAccess) {
            addActionButton("Android 설정에서 허용하기", true, v -> openUsageAccessSettings());
        }

        addStepCard(
                "2",
                "알림 권한",
                "기록을 남길 타이밍을 알림으로 받습니다.",
                notifications ? "허용됨" : "필요함",
                notifications
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notifications) {
            addActionButton("알림 권한 허용하기", true, v -> requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST
            ));
        }

        addStepCard(
                "3",
                "시청 기록 알림",
                "권한이 준비되면 알림을 켜거나 끌 수 있습니다.",
                enabled ? "켜짐" : "꺼짐",
                enabled && ready
        );
        if (ready) {
            addActionButton(
                    enabled ? "시청 기록 알림 끄기" : "시청 기록 알림 켜기",
                    !enabled,
                    v -> {
                        WatchReminderScheduler.setEnabled(
                                this,
                                !WatchReminderScheduler.isEnabled(this)
                        );
                        renderSafely();
                    }
            );
        } else {
            addDisabledButton("권한을 먼저 허용해 주세요");
        }

        if (showDebugControls) {
            addDebugControls();
        }
    }

    private void addHeader(boolean enabled, boolean usageAccess, boolean notifications) {
        addTitle("시청 기록 알림");
        addBody("OTT 앱을 일정 시간 사용한 뒤 ottline 기록을 잊지 않도록 알려드립니다.");
        addFinePrint("콘텐츠 제목이나 화면 내용은 읽지 않습니다.");
        addStatusBanner(overallStatus(enabled, usageAccess, notifications), overallStatusColor(
                enabled,
                usageAccess,
                notifications
        ));
    }

    private String overallStatus(boolean enabled, boolean usageAccess, boolean notifications) {
        if (!usageAccess) return "사용 정보 접근 권한이 필요합니다.";
        if (!notifications) return "알림 권한이 필요합니다.";
        if (enabled) return "시청 기록 알림이 켜져 있습니다.";
        return "권한 준비 완료. 알림을 켤 수 있습니다.";
    }

    private int overallStatusColor(boolean enabled, boolean usageAccess, boolean notifications) {
        if (!usageAccess || !notifications) return WARNING;
        if (enabled) return SUCCESS;
        return PRIMARY;
    }

    private void openUsageAccessSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
        } catch (Throwable ignored) {
            startActivity(new Intent(Settings.ACTION_SETTINGS));
        }
    }

    private void addDebugControls() {
        addSectionTitle("디버그");
        addStatus(
                "마지막 감지 결과",
                WatchReminderScheduler.prefs(this).getString(
                        WatchReminderScheduler.KEY_LAST_SCAN_RESULT,
                        "아직 없음"
                )
        );
        addTitle("최근 감지 디버그");
        addBody(WatchReminderScheduler.prefs(this).getString(
                WatchReminderScheduler.KEY_LAST_USAGE_DEBUG,
                "아직 없음"
        ));

        addActionButton("테스트 알림 보내기", false, v -> {
            WatchReminderTargets.Target target = WatchReminderTargets.find("com.netflix.mediaclient");
            if (target != null) WatchReminderNotifier.show(this, target);
        });

        Button scan = addActionButton("지금 감지 실행(보류/마지막 사용 포함)", false, null);
        scan.setOnClickListener(v -> {
            scan.setEnabled(false);
            scan.setText("감지 중...");
            Context appContext = getApplicationContext();
            new Thread(() -> {
                try {
                    WatchReminderWorker.scanNow(appContext, true);
                    runOnUiThread(this::renderSafely);
                } catch (Throwable error) {
                    WatchReminderWorker.saveFailure(appContext, "수동 감지 오류", error);
                    try {
                        runOnUiThread(this::renderSafely);
                    } catch (Throwable ignored) {
                    }
                }
            }).start();
        });

        addActionButton("감지 상태 초기화", false, v -> {
            WatchReminderScheduler.resetState(this);
            renderSafely();
        });

        addSectionTitle("감지 대상");
        PackageManager packageManager = getPackageManager();
        for (Map.Entry<String, WatchReminderTargets.Target> entry : WatchReminderTargets.all().entrySet()) {
            boolean installed = isInstalled(packageManager, entry.getKey());
            addStatus(entry.getValue().label + " (" + entry.getKey() + ")", installed ? "설치됨" : "미설치");
        }
    }

    private boolean showDebugControls() {
        return getResources().getBoolean(R.bool.watch_reminder_show_debug_controls);
    }

    private boolean isInstalled(PackageManager packageManager, String packageName) {
        try {
            packageManager.getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private void renderSafely() {
        if (isFinishing()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && isDestroyed()) return;

        try {
            render();
        } catch (Throwable error) {
            WatchReminderWorker.saveFailure(getApplicationContext(), "화면 표시 오류", error);
            content.removeAllViews();
            addTitle("시청 기록 알림");
            addBody("화면 표시 오류: " + error.getClass().getSimpleName());
            String message = error.getMessage();
            if (message != null && !message.isEmpty()) {
                addBody(message);
            }
        }
    }

    private void addTitle(String value) {
        TextView view = text(value, 22f, TEXT_PRIMARY, Typeface.BOLD);
        view.setPadding(0, dp(10), 0, dp(8));
        content.addView(view);
    }

    private void addSectionTitle(String value) {
        TextView view = text(value, 17f, TEXT_PRIMARY, Typeface.BOLD);
        view.setPadding(0, dp(20), 0, dp(8));
        content.addView(view);
    }

    private void addBody(String value) {
        TextView view = text(value, 15f, TEXT_SECONDARY, Typeface.NORMAL);
        view.setLineSpacing(0, 1.15f);
        view.setPadding(0, 0, 0, dp(8));
        content.addView(view);
    }

    private void addFinePrint(String value) {
        TextView view = text(value, 13f, TEXT_MUTED, Typeface.NORMAL);
        view.setPadding(0, 0, 0, dp(12));
        content.addView(view);
    }

    private void addStatusBanner(String value, int color) {
        TextView view = text(value, 14f, color, Typeface.BOLD);
        view.setBackground(rounded(Color.WHITE, BORDER, 8));
        view.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(4), 0, dp(14));
        content.addView(view, params);
    }

    private void addStepCard(
            String step,
            String title,
            String body,
            String status,
            boolean complete
    ) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(SURFACE, BORDER, 8));
        card.setPadding(dp(14), dp(14), dp(14), dp(14));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        TextView marker = text(step, 13f, Color.WHITE, Typeface.BOLD);
        marker.setGravity(Gravity.CENTER);
        marker.setBackground(rounded(complete ? SUCCESS : PRIMARY, 0, 14));
        row.addView(marker, new LinearLayout.LayoutParams(dp(28), dp(28)));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.setPadding(dp(10), 0, dp(10), 0);
        textColumn.addView(text(title, 15f, TEXT_PRIMARY, Typeface.BOLD));
        TextView bodyView = text(body, 13f, TEXT_SECONDARY, Typeface.NORMAL);
        bodyView.setPadding(0, dp(3), 0, 0);
        textColumn.addView(bodyView);
        row.addView(textColumn, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView badge = text(status, 12f, complete ? SUCCESS : WARNING, Typeface.BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(10), dp(5), dp(10), dp(5));
        badge.setBackground(rounded(complete ? Color.rgb(236, 253, 245) : Color.rgb(255, 247, 237), 0, 8));
        row.addView(badge);

        card.addView(row);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(8), 0, 0);
        content.addView(card, params);
    }

    private void addStatus(String label, String value) {
        TextView view = text(label + ": " + value, 14f, TEXT_PRIMARY, Typeface.NORMAL);
        view.setPadding(0, dp(4), 0, dp(4));
        content.addView(view);
    }

    private Button addActionButton(String value, boolean primary, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(value);
        button.setAllCaps(false);
        button.setTextSize(15f);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextColor(primary ? Color.WHITE : PRIMARY);
        button.setBackground(primary
                ? rounded(PRIMARY, 0, 8)
                : rounded(SURFACE, BORDER, 8));
        button.setMinHeight(dp(48));
        button.setPadding(dp(12), dp(10), dp(12), dp(10));
        if (listener != null) {
            button.setOnClickListener(listener);
        }
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(10), 0, 0);
        content.addView(button, params);
        return button;
    }

    private void addDisabledButton(String value) {
        Button button = new Button(this);
        button.setText(value);
        button.setAllCaps(false);
        button.setTextSize(15f);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setEnabled(false);
        button.setTextColor(TEXT_MUTED);
        button.setBackground(rounded(DISABLED_BACKGROUND, 0, 8));
        button.setMinHeight(dp(48));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(10), 0, 0);
        content.addView(button, params);
    }

    private TextView text(String value, float size, int color, int style) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setIncludeFontPadding(true);
        return view;
    }

    private GradientDrawable rounded(int fillColor, int strokeColor, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fillColor);
        drawable.setCornerRadius(dp(radiusDp));
        if (strokeColor != 0) {
            drawable.setStroke(dp(1), strokeColor);
        }
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
