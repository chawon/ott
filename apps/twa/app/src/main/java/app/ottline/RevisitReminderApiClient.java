package app.ottline;

import android.content.Context;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.TimeZone;

final class RevisitReminderApiClient {
    private static final String API_BASE = "https://ottline.app/api/android";

    private RevisitReminderApiClient() {}

    static Reminder fetchNext(Context context) throws Exception {
        JSONObject body = baseBody(context);
        JSONObject response = postJson(API_BASE + "/reminders/next", body);
        if (response == null || response.isNull("reminder")) return null;
        JSONObject reminder = response.getJSONObject("reminder");
        return new Reminder(
                reminder.getString("deliveryId"),
                reminder.getString("reminderType"),
                reminder.getString("title"),
                reminder.getString("body"),
                reminder.getString("deepLink")
        );
    }

    static void updatePreferences(Context context, boolean enabled) throws Exception {
        JSONObject body = baseBody(context);
        body.put("revisitRemindersEnabled", enabled);
        postJson(API_BASE + "/notification-devices/preferences", body);
    }

    static void markDelivered(Context context, String deliveryId) throws Exception {
        JSONObject body = new JSONObject();
        body.put("installToken", AndroidInstallToken.get(context));
        postJson(API_BASE + "/reminders/" + deliveryId + "/delivered", body);
    }

    static void markOpened(Context context, String deliveryId) throws Exception {
        JSONObject body = new JSONObject();
        body.put("installToken", AndroidInstallToken.get(context));
        postJson(API_BASE + "/reminders/" + deliveryId + "/opened", body);
    }

    private static JSONObject baseBody(Context context) throws Exception {
        JSONObject body = new JSONObject();
        body.put("installToken", AndroidInstallToken.get(context));
        body.put("timeZone", TimeZone.getDefault().getID());
        body.put("locale", Locale.getDefault().toLanguageTag());
        body.put("notificationPermissionGranted", WatchReminderAccess.canPostNotifications(context));
        body.put("versionName", BuildConfig.VERSION_NAME);
        body.put("versionCode", BuildConfig.VERSION_CODE);
        return body;
    }

    private static JSONObject postJson(String url, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(10_000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(payload.length);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(payload);
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
        String text = readAll(stream);
        connection.disconnect();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Android reminder API " + status + ": " + text);
        }
        if (text == null || text.trim().isEmpty()) return null;
        return new JSONObject(text);
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    static final class Reminder {
        final String deliveryId;
        final String reminderType;
        final String title;
        final String body;
        final String deepLink;

        Reminder(String deliveryId, String reminderType, String title, String body, String deepLink) {
            this.deliveryId = deliveryId;
            this.reminderType = reminderType;
            this.title = title;
            this.body = body;
            this.deepLink = deepLink;
        }
    }
}
