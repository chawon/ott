package app.ottline;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Map;

public class WatchReminderSettingsActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 529;
    private static final int SCREEN_BACKGROUND = Color.rgb(250, 249, 247);
    private static final int TEXT_PRIMARY = Color.rgb(22, 23, 26);
    private static final int TEXT_SECONDARY = Color.rgb(70, 75, 85);
    private static final int BUTTON_BACKGROUND = Color.rgb(238, 240, 244);

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

    private void render() {
        content.removeAllViews();

        addTitle("ottline 시청 기록 알림");
        addBody("알파 기능입니다. 선택한 OTT 앱 사용이 끝난 뒤 기록 알림을 띄웁니다.");
        addBody("콘텐츠 제목은 읽지 않고, 앱 사용 여부만 기기 안에서 확인합니다.");

        boolean enabled = WatchReminderScheduler.isEnabled(this);
        boolean usageAccess = WatchReminderAccess.hasUsageAccess(this);
        boolean notifications = WatchReminderAccess.canPostNotifications(this);

        addStatus("기능 상태", enabled ? "켜짐" : "꺼짐");
        addStatus("사용 정보 접근", usageAccess ? "허용됨" : "필요함");
        addStatus("알림 권한", notifications ? "허용됨" : "필요함");
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

        Button toggle = addButton(enabled ? "시청 기록 알림 끄기" : "시청 기록 알림 켜기");
        toggle.setOnClickListener(v -> {
            WatchReminderScheduler.setEnabled(this, !WatchReminderScheduler.isEnabled(this));
            renderSafely();
        });

        Button usage = addButton("Android 사용 정보 접근 설정 열기");
        usage.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notifications) {
            Button notification = addButton("알림 권한 요청");
            notification.setOnClickListener(v -> requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST
            ));
        }

        Button test = addButton("테스트 알림 보내기");
        test.setOnClickListener(v -> {
            WatchReminderTargets.Target target = WatchReminderTargets.find("com.netflix.mediaclient");
            if (target != null) WatchReminderNotifier.show(this, target);
        });

        Button scan = addButton("지금 감지 실행(보류/마지막 사용 포함)");
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

        Button reset = addButton("감지 상태 초기화");
        reset.setOnClickListener(v -> {
            WatchReminderScheduler.resetState(this);
            renderSafely();
        });

        addTitle("감지 대상");
        PackageManager packageManager = getPackageManager();
        for (Map.Entry<String, WatchReminderTargets.Target> entry : WatchReminderTargets.all().entrySet()) {
            boolean installed = isInstalled(packageManager, entry.getKey());
            addStatus(entry.getValue().label + " (" + entry.getKey() + ")", installed ? "설치됨" : "미설치");
        }
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
            addTitle("ottline 시청 기록 알림");
            addBody("화면 표시 오류: " + error.getClass().getSimpleName());
            String message = error.getMessage();
            if (message != null && !message.isEmpty()) {
                addBody(message);
            }
        }
    }

    private void addTitle(String value) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(20f);
        view.setTextColor(TEXT_PRIMARY);
        view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        view.setPadding(0, dp(14), 0, dp(8));
        content.addView(view);
    }

    private void addBody(String value) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(14f);
        view.setTextColor(TEXT_SECONDARY);
        view.setLineSpacing(0, 1.15f);
        view.setPadding(0, 0, 0, dp(8));
        content.addView(view);
    }

    private void addStatus(String label, String value) {
        TextView view = new TextView(this);
        view.setText(label + ": " + value);
        view.setTextSize(15f);
        view.setTextColor(TEXT_PRIMARY);
        view.setPadding(0, dp(4), 0, dp(4));
        content.addView(view);
    }

    private Button addButton(String value) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextColor(TEXT_PRIMARY);
        button.setBackgroundColor(BUTTON_BACKGROUND);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(8), 0, 0);
        content.addView(button, params);
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
