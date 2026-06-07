package app.ottline;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import java.security.SecureRandom;

final class AndroidInstallToken {
    private static final String PREFS = "ottline.android_install";
    private static final String KEY_TOKEN = "install_token";
    private static final SecureRandom RANDOM = new SecureRandom();

    private AndroidInstallToken() {}

    static String get(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String existing = prefs.getString(KEY_TOKEN, null);
        if (existing != null && existing.length() >= 32) return existing;

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.encodeToString(
                bytes,
                Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
        prefs.edit().putString(KEY_TOKEN, token).apply();
        return token;
    }
}
