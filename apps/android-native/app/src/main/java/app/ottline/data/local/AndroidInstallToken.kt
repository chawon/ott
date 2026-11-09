package app.ottline.data.local

import android.content.Context
import java.util.UUID

/**
 * Preserves 100% compatibility with TWA's `app.ottline.AndroidInstallToken`
 * ("ottline.android_install" / "install_token") used by RevisitReminder APIs
 * and detects seamless upgrades from TWA (`versionCode <= 23`).
 */
object AndroidInstallToken {
    private const val PREFS_NAME = "ottline.android_install"
    private const val KEY_INSTALL_TOKEN = "install_token"
    private const val KEY_HAD_PRE_EXISTING_TWA_TOKEN = "had_pre_existing_twa_token"

    @Synchronized
    fun peekExistingToken(context: Context): String? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_INSTALL_TOKEN, null)?.takeIf { it.isNotBlank() }
    }

    @Synchronized
    fun recordUpgradeMarkerIfNeeded(context: Context, hasNativeUserId: Boolean) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.contains(KEY_HAD_PRE_EXISTING_TWA_TOKEN)) {
            val hadExistingInstallToken = !prefs.getString(KEY_INSTALL_TOKEN, null).isNullOrBlank()
            prefs.edit()
                .putBoolean(KEY_HAD_PRE_EXISTING_TWA_TOKEN, hadExistingInstallToken && !hasNativeUserId)
                .apply()
        }
    }

    fun isUpgradedFromTwaWithoutNativeAuth(context: Context, hasNativeUserId: Boolean): Boolean {
        if (hasNativeUserId) return false
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_HAD_PRE_EXISTING_TWA_TOKEN, false)
    }

    @Synchronized
    fun getOrCreate(context: Context): String {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_INSTALL_TOKEN, null)
        if (!existing.isNullOrBlank()) return existing
        if (!prefs.contains(KEY_HAD_PRE_EXISTING_TWA_TOKEN)) {
            prefs.edit().putBoolean(KEY_HAD_PRE_EXISTING_TWA_TOKEN, false).apply()
        }
        val created = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_INSTALL_TOKEN, created).apply()
        return created
    }
}
