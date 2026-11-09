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

    private val UUID_REGEX =
        Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

    @Synchronized
    fun peekExistingToken(context: Context): String? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_INSTALL_TOKEN, null)?.takeIf { it.isNotBlank() }
    }

    /**
     * TWA (`versionCode <= 23`) generated 32-byte URL-safe Base64 tokens (43 chars, not UUIDs),
     * whereas native fresh installs generate 36-char UUIDs.
     */
    fun isLegacyTwaTokenFormat(token: String?): Boolean {
        val cleaned = token?.trim().orEmpty()
        return cleaned.length >= 32 && !UUID_REGEX.matches(cleaned)
    }

    @Synchronized
    fun recordUpgradeMarkerIfNeeded(context: Context, hasNativeUserId: Boolean) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existingToken = prefs.getString(KEY_INSTALL_TOKEN, null)
        val hadExistingInstallToken = !existingToken.isNullOrBlank()
        if (!prefs.contains(KEY_HAD_PRE_EXISTING_TWA_TOKEN)) {
            prefs.edit()
                .putBoolean(
                    KEY_HAD_PRE_EXISTING_TWA_TOKEN,
                    (hadExistingInstallToken && !hasNativeUserId) || isLegacyTwaTokenFormat(existingToken)
                )
                .apply()
        } else if (isLegacyTwaTokenFormat(existingToken) && !prefs.getBoolean(KEY_HAD_PRE_EXISTING_TWA_TOKEN, false)) {
            prefs.edit().putBoolean(KEY_HAD_PRE_EXISTING_TWA_TOKEN, true).apply()
        }
    }

    fun hasTwaUpgradeSignal(context: Context): Boolean {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_HAD_PRE_EXISTING_TWA_TOKEN, false)) {
            return true
        }
        val existingToken = prefs.getString(KEY_INSTALL_TOKEN, null)
        return isLegacyTwaTokenFormat(existingToken)
    }

    fun isUpgradedFromTwaWithoutNativeAuth(context: Context, hasNativeUserId: Boolean): Boolean {
        if (hasNativeUserId) return false
        return hasTwaUpgradeSignal(context)
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
