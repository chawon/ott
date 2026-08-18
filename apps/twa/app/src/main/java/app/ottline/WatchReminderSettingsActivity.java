package app.ottline;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
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

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.Map;

public class WatchReminderSettingsActivity extends ComponentActivity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 529;

    private static final int SCREEN_BACKGROUND = Color.rgb(248, 246, 242);
    private static final int SURFACE = Color.WHITE;
    private static final int BORDER = Color.rgb(236, 235, 233);
    private static final int TEXT_PRIMARY = Color.rgb(15, 15, 15);
    private static final int TEXT_SECONDARY = Color.rgb(74, 74, 74);
    private static final int TEXT_MUTED = Color.rgb(112, 106, 99);
    private static final int NAVY = Color.rgb(30, 77, 140);
    private static final int ORANGE = Color.rgb(255, 153, 51);
    private static final int SUCCESS = Color.rgb(37, 112, 70);
    private static final int WARNING = Color.rgb(143, 84, 22);
    private static final int SUCCESS_BACKGROUND = Color.rgb(238, 247, 241);
    private static final int WARNING_BACKGROUND = Color.rgb(255, 247, 237);

    private static final int ACTION_FINAL = 1;
    private static final int ACTION_SECONDARY = 2;
    private static final int ACTION_QUIET = 3;

    private LinearLayout content;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(
                this,
                SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
                SystemBarStyle.light(SCREEN_BACKGROUND, TEXT_PRIMARY)
        );
        super.onCreate(savedInstanceState);

        getWindow().setBackgroundDrawable(new ColorDrawable(SCREEN_BACKGROUND));

        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(SCREEN_BACKGROUND);

        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setBackgroundColor(SCREEN_BACKGROUND);
        int contentPadding = dp(20);
        content.setPadding(contentPadding, contentPadding, contentPadding, contentPadding);
        scrollView.addView(
                content,
                new ScrollView.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );

        ViewCompat.setOnApplyWindowInsetsListener(scrollView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return windowInsets;
        });

        setContentView(scrollView);
        ViewCompat.requestApplyInsets(scrollView);
    }

    @Override
    protected void onResume() {
        super.onResume();
        RevisitReminderScheduler.syncAutoState(this);
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
            RevisitReminderScheduler.syncAutoState(this);
            renderSafely();
        }
    }

    private void render() {
        content.removeAllViews();

        boolean enabled = WatchReminderScheduler.isEnabled(this);
        boolean usageAccess = WatchReminderAccess.hasUsageAccess(this);
        boolean notifications = WatchReminderAccess.canPostNotifications(this);
        boolean ready = usageAccess && notifications;
        boolean revisitEnabled = RevisitReminderScheduler.isEnabled(this);

        addHeader(enabled, usageAccess, notifications);
        addNextAction(enabled, usageAccess, notifications);

        addSectionTitle("설정 순서");
        addStepCard(
                "1",
                "사용 정보 접근",
                "OTT 앱을 일정 시간 사용했는지만 확인합니다.",
                usageAccess ? "완료" : "대기",
                usageAccess
        );
        addStepCard(
                "2",
                "알림 권한",
                "기록을 남기기 좋은 타이밍에 알림을 보냅니다.",
                notifications ? "완료" : "대기",
                notifications
        );
        addStepCard(
                "3",
                "시청 기록 알림",
                "두 권한이 준비된 뒤 직접 켤 수 있습니다.",
                enabled && ready ? "켜짐" : "꺼짐",
                enabled && ready
        );

        addSectionTitle("선택 알림");
        addStepCard(
                "선택",
                "회고 리마인드",
                "주간 회고, 월간 장르, 기록 공백, 시리즈 이어보기를 알려드려요.",
                revisitEnabled && notifications ? "켜짐" : "꺼짐",
                revisitEnabled && notifications
        );
        if (notifications) {
            addActionButton(
                    revisitEnabled ? "회고 리마인드 끄기" : "회고 리마인드 켜기",
                    ACTION_QUIET,
                    v -> {
                        RevisitReminderScheduler.setEnabled(
                                this,
                                !RevisitReminderScheduler.isEnabled(this)
                        );
                        renderSafely();
                    }
            );
        } else {
            addFinePrint("알림 권한이 준비되면 회고 리마인드도 선택할 수 있어요.");
        }

        if (showDebugControls()) {
            addDebugControls();
        }
    }

    private void addHeader(boolean enabled, boolean usageAccess, boolean notifications) {
        addTitle("시청 기록 알림을 준비해 볼까요?");
        addBody("OTT 앱 사용이 끝난 뒤, 기록할 타이밍을 놓치지 않도록 알려드려요.");
        addFinePrint("콘텐츠 제목, 재생 상태, 화면 내용은 읽지 않습니다.");
        addStatusBanner(
                overallStatus(enabled, usageAccess, notifications),
                overallStatusColor(enabled, usageAccess, notifications)
        );
    }

    private void addNextAction(boolean enabled, boolean usageAccess, boolean notifications) {
        if (!usageAccess) {
            addNextActionCard(
                    "지금 필요한 1단계",
                    "사용 정보 접근을 허용해 주세요",
                    "ottline이 OTT 앱을 일정 시간 사용했는지만 확인할 수 있어요.",
                    "Android 설정 열기",
                    ACTION_SECONDARY,
                    v -> openUsageAccessSettings()
            );
            return;
        }

        if (!notifications) {
            addNextActionCard(
                    "이제 2단계",
                    "알림을 허용해 주세요",
                    "시청이 끝난 뒤 기록할 타이밍을 알림으로 받을 수 있어요.",
                    notificationActionLabel(),
                    ACTION_SECONDARY,
                    v -> requestNotificationAccess()
            );
            return;
        }

        if (!enabled) {
            addNextActionCard(
                    "권한 준비 완료",
                    "이제 알림만 켜면 돼요",
                    "다음 시청부터 ottline 기록 화면으로 바로 이어지는 알림을 보내드려요.",
                    "시청 기록 알림 켜기",
                    ACTION_FINAL,
                    v -> {
                        WatchReminderScheduler.setEnabled(this, true);
                        renderSafely();
                    }
            );
            return;
        }

        addNextActionCard(
                "설정 완료",
                "시청 기록 알림이 켜져 있어요",
                "다음 OTT 앱 사용이 끝나면 기록할 타이밍을 알려드릴게요.",
                "시청 기록 알림 끄기",
                ACTION_QUIET,
                v -> {
                    WatchReminderScheduler.setEnabled(this, false);
                    renderSafely();
                }
        );
    }

    private String overallStatus(boolean enabled, boolean usageAccess, boolean notifications) {
        if (!usageAccess) return "0/3 준비됨 · 사용 정보 접근이 필요해요.";
        if (!notifications) return "1/3 준비됨 · 알림 권한이 필요해요.";
        if (!enabled) return "2/3 준비됨 · 이제 알림만 켜면 돼요.";
        return "3/3 준비됨 · 시청 기록 알림이 켜져 있어요.";
    }

    private int overallStatusColor(boolean enabled, boolean usageAccess, boolean notifications) {
        if (!usageAccess || !notifications) return WARNING;
        if (enabled) return SUCCESS;
        return NAVY;
    }

    private void openUsageAccessSettings() {
        try {
            startActivity(new Intent(
                    Settings.ACTION_USAGE_ACCESS_SETTINGS,
                    Uri.parse("package:" + getPackageName())
            ));
        } catch (Throwable ignored) {
            try {
                startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
            } catch (Throwable fallbackIgnored) {
                startActivity(new Intent(Settings.ACTION_SETTINGS));
            }
        }
    }

    private String notificationActionLabel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return "알림 권한 허용하기";
        }
        return "알림 설정 열기";
    }

    private void requestNotificationAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST
            );
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(intent);
        } catch (Throwable ignored) {
            startActivity(new Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName())
            ));
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
        addStatus(
                "마지막 회고 리마인드",
                RevisitReminderScheduler.prefs(this).getString(
                        RevisitReminderScheduler.KEY_LAST_RESULT,
                        "아직 없음"
                )
        );

        addActionButton("테스트 알림 보내기", ACTION_QUIET, v -> {
            WatchReminderTargets.Target target = WatchReminderTargets.find("com.netflix.mediaclient");
            if (target != null) WatchReminderNotifier.show(this, target);
        });

        Button scan = addActionButton(
                "지금 감지 실행(보류/마지막 사용 포함)",
                ACTION_QUIET,
                null
        );
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

        addActionButton("감지 상태 초기화", ACTION_QUIET, v -> {
            WatchReminderScheduler.resetState(this);
            renderSafely();
        });

        addSectionTitle("감지 대상");
        PackageManager packageManager = getPackageManager();
        for (Map.Entry<String, WatchReminderTargets.Target> entry : WatchReminderTargets.all().entrySet()) {
            boolean installed = isInstalled(packageManager, entry.getKey());
            addStatus(
                    entry.getValue().label + " (" + entry.getKey() + ")",
                    installed ? "설치됨" : "미설치"
            );
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
        if (isFinishing() || isDestroyed()) return;

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
        view.setPadding(0, dp(20), 0, dp(4));
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
        view.setLineSpacing(0, 1.1f);
        view.setPadding(0, dp(2), 0, dp(12));
        content.addView(view);
    }

    private void addStatusBanner(String value, int color) {
        TextView view = text(value, 14f, color, Typeface.BOLD);
        view.setBackground(rounded(SURFACE, BORDER, 8));
        view.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams params = matchWidthWrapContent();
        params.setMargins(0, dp(4), 0, dp(14));
        content.addView(view, params);
    }

    private void addNextActionCard(
            String eyebrow,
            String title,
            String body,
            String actionLabel,
            int actionStyle,
            View.OnClickListener listener
    ) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(SURFACE, BORDER, 8));
        card.setPadding(dp(16), dp(16), dp(16), dp(16));

        TextView eyebrowView = text(eyebrow, 13f, NAVY, Typeface.BOLD);
        eyebrowView.setPadding(0, 0, 0, dp(5));
        card.addView(eyebrowView);

        TextView titleView = text(title, 17f, TEXT_PRIMARY, Typeface.BOLD);
        titleView.setPadding(0, 0, 0, dp(5));
        card.addView(titleView);

        TextView bodyView = text(body, 14f, TEXT_SECONDARY, Typeface.NORMAL);
        bodyView.setLineSpacing(0, 1.15f);
        bodyView.setPadding(0, 0, 0, dp(12));
        card.addView(bodyView);

        card.addView(createActionButton(actionLabel, actionStyle, listener), matchWidthWrapContent());

        LinearLayout.LayoutParams params = matchWidthWrapContent();
        params.setMargins(0, 0, 0, dp(4));
        content.addView(card, params);
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
        marker.setBackground(rounded(complete ? SUCCESS : NAVY, 0, 8));
        int markerWidth = step.length() > 1 ? dp(44) : dp(28);
        row.addView(marker, new LinearLayout.LayoutParams(markerWidth, dp(28)));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.setPadding(dp(10), 0, dp(10), 0);
        textColumn.addView(text(title, 15f, TEXT_PRIMARY, Typeface.BOLD));
        TextView bodyView = text(body, 13f, TEXT_SECONDARY, Typeface.NORMAL);
        bodyView.setLineSpacing(0, 1.1f);
        bodyView.setPadding(0, dp(3), 0, 0);
        textColumn.addView(bodyView);
        row.addView(
                textColumn,
                new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        );

        TextView badge = text(status, 12f, complete ? SUCCESS : WARNING, Typeface.BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(10), dp(5), dp(10), dp(5));
        badge.setBackground(rounded(
                complete ? SUCCESS_BACKGROUND : WARNING_BACKGROUND,
                0,
                8
        ));
        row.addView(badge);

        card.addView(row);

        LinearLayout.LayoutParams params = matchWidthWrapContent();
        params.setMargins(0, dp(8), 0, 0);
        content.addView(card, params);
    }

    private void addStatus(String label, String value) {
        TextView view = text(label + ": " + value, 14f, TEXT_PRIMARY, Typeface.NORMAL);
        view.setPadding(0, dp(4), 0, dp(4));
        content.addView(view);
    }

    private Button addActionButton(
            String value,
            int style,
            View.OnClickListener listener
    ) {
        Button button = createActionButton(value, style, listener);
        LinearLayout.LayoutParams params = matchWidthWrapContent();
        params.setMargins(0, dp(10), 0, 0);
        content.addView(button, params);
        return button;
    }

    private Button createActionButton(
            String value,
            int style,
            View.OnClickListener listener
    ) {
        Button button = new Button(this);
        button.setText(value);
        button.setAllCaps(false);
        button.setTextSize(16f);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setMinHeight(dp(48));
        button.setPadding(dp(16), dp(8), dp(16), dp(8));

        if (style == ACTION_FINAL) {
            button.setTextColor(TEXT_PRIMARY);
            button.setBackground(rounded(ORANGE, 0, 8));
        } else if (style == ACTION_SECONDARY) {
            button.setTextColor(NAVY);
            button.setBackground(rounded(SURFACE, NAVY, 8));
        } else {
            button.setTextColor(NAVY);
            button.setBackground(rounded(SURFACE, BORDER, 8));
        }

        if (listener != null) {
            button.setOnClickListener(listener);
        }
        return button;
    }

    private LinearLayout.LayoutParams matchWidthWrapContent() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
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
