package app.ottline.data.local

import android.app.LocaleManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.LocaleList
import app.ottline.BuildConfig
import app.ottline.QuickLogWidgetProvider
import app.ottline.model.PersonaKey
import app.ottline.model.UserProfile
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

enum class ThemeMode {
    SYSTEM,
    LIGHT,
    DARK
}

data class PreferencesSnapshot(
    val userId: String?,
    val deviceId: String?,
    val pairingCode: String?,
    val lastSyncAt: String?,
    val nickname: String?,
    val personaKey: PersonaKey?,
    val themeMode: ThemeMode,
    val locale: String,
    val customVideoPlatforms: List<String>,
    val customBookPlatforms: List<String>,
    val singleDeviceCodeReminderShown: Boolean,
    val twaMigrationBannerDismissed: Boolean,
    val dismissedRecommendations: Set<String>,
    val apiBaseUrl: String
) {
    val userProfile: UserProfile?
        get() = userId?.let {
            UserProfile(
                userId = it,
                nickname = nickname,
                personaKey = personaKey
            )
        }
}

class AppPreferences(context: Context) {
    private val appContext: Context = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    private val _state = MutableStateFlow(readSnapshot())
    val state: StateFlow<PreferencesSnapshot> = _state.asStateFlow()

    val current: PreferencesSnapshot
        get() = _state.value

    val analyticsClientId: String
        get() {
            val existing = prefs.getString(KEY_ANALYTICS_CLIENT_ID, null)
            if (!existing.isNullOrBlank()) return existing
            val created = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_ANALYTICS_CLIENT_ID, created).apply()
            return created
        }

    private fun readSnapshot(): PreferencesSnapshot {
        val defaultLang = if (Locale.getDefault().language.startsWith("en", ignoreCase = true)) "en" else "ko"
        val storedTheme = prefs.getString(KEY_THEME_MODE, ThemeMode.LIGHT.name)
        val themeMode = runCatching { ThemeMode.valueOf(storedTheme ?: ThemeMode.LIGHT.name) }
            .getOrDefault(ThemeMode.LIGHT)

        val videoCustom = prefs.getString(KEY_CUSTOM_VIDEO_PLATFORMS, null)
            ?.let { runCatching { json.decodeFromString<List<String>>(it) }.getOrNull() }
            ?: emptyList()
        val bookCustom = prefs.getString(KEY_CUSTOM_BOOK_PLATFORMS, null)
            ?.let { runCatching { json.decodeFromString<List<String>>(it) }.getOrNull() }
            ?: emptyList()
        val dismissedRecs = prefs.getStringSet(KEY_DISMISSED_RECOMMENDATIONS, emptySet())?.toSet() ?: emptySet()

        val baseUrl = if (BuildConfig.ALLOW_SERVER_SWITCHER) {
            prefs.getString(KEY_DEBUG_API_BASE_URL, null)
                ?.trim()
                ?.trimEnd('/')
                ?.takeIf { it.isNotEmpty() }
                ?: BuildConfig.DEFAULT_API_BASE_URL.trimEnd('/')
        } else {
            BuildConfig.DEFAULT_API_BASE_URL.trimEnd('/')
        }

        return PreferencesSnapshot(
            userId = prefs.getString(KEY_USER_ID, null)?.takeIf { it.isNotBlank() },
            deviceId = prefs.getString(KEY_DEVICE_ID, null)?.takeIf { it.isNotBlank() },
            pairingCode = prefs.getString(KEY_PAIRING_CODE, null)?.takeIf { it.isNotBlank() },
            lastSyncAt = prefs.getString(KEY_LAST_SYNC_AT, null)?.takeIf { it.isNotBlank() },
            nickname = prefs.getString(KEY_NICKNAME, null),
            personaKey = PersonaKey.fromWire(prefs.getString(KEY_PERSONA_KEY, null)),
            themeMode = themeMode,
            locale = prefs.getString(KEY_LOCALE, defaultLang) ?: defaultLang,
            customVideoPlatforms = videoCustom,
            customBookPlatforms = bookCustom,
            singleDeviceCodeReminderShown = prefs.getBoolean(KEY_SINGLE_DEVICE_REMINDER_SHOWN, false),
            twaMigrationBannerDismissed = prefs.getBoolean(KEY_TWA_MIGRATION_DISMISSED, false),
            dismissedRecommendations = dismissedRecs,
            apiBaseUrl = baseUrl
        )
    }

    private fun refresh() {
        _state.value = readSnapshot()
    }

    fun saveAuth(userId: String, deviceId: String, pairingCode: String?) {
        prefs.edit().apply {
            putString(KEY_USER_ID, userId)
            putString(KEY_DEVICE_ID, deviceId)
            if (!pairingCode.isNullOrBlank()) {
                putString(KEY_PAIRING_CODE, pairingCode)
            }
        }.apply()
        refresh()
    }

    fun clearAuthAndSyncState() {
        prefs.edit()
            .remove(KEY_USER_ID)
            .remove(KEY_DEVICE_ID)
            .remove(KEY_PAIRING_CODE)
            .remove(KEY_LAST_SYNC_AT)
            .remove(KEY_NICKNAME)
            .remove(KEY_PERSONA_KEY)
            .remove(KEY_SINGLE_DEVICE_REMINDER_SHOWN)
            .remove(KEY_DISMISSED_RECOMMENDATIONS)
            .apply()
        refresh()
    }

    fun setLastSyncAt(iso: String?) {
        prefs.edit().apply {
            if (iso == null) remove(KEY_LAST_SYNC_AT) else putString(KEY_LAST_SYNC_AT, iso)
        }.apply()
        refresh()
    }

    fun saveProfile(nickname: String?, personaKey: PersonaKey?) {
        prefs.edit()
            .putString(KEY_NICKNAME, nickname?.trim())
            .putString(KEY_PERSONA_KEY, personaKey?.wireValue)
            .apply()
        refresh()
    }

    fun setThemeMode(mode: ThemeMode) {
        prefs.edit().putString(KEY_THEME_MODE, mode.name).apply()
        refresh()
    }

    fun setLocale(locale: String) {
        val normalized = if (locale == "en") "en" else "ko"
        prefs.edit().putString(KEY_LOCALE, normalized).apply()
        refresh()
        applySystemAppLocale(appContext, normalized)
        runCatching { QuickLogWidgetProvider.updateAllWidgets(appContext) }
    }

    fun addCustomPlatform(isBook: Boolean, platform: String) {
        val trimmed = platform.trim()
        if (trimmed.isEmpty()) return
        val currentList = if (isBook) current.customBookPlatforms else current.customVideoPlatforms
        if (currentList.any { it.equals(trimmed, ignoreCase = true) }) return
        val updated = (currentList + trimmed).takeLast(20)
        val key = if (isBook) KEY_CUSTOM_BOOK_PLATFORMS else KEY_CUSTOM_VIDEO_PLATFORMS
        prefs.edit().putString(key, json.encodeToString(updated)).apply()
        refresh()
    }

    fun markSingleDeviceReminderShown() {
        prefs.edit().putBoolean(KEY_SINGLE_DEVICE_REMINDER_SHOWN, true).apply()
        refresh()
    }

    fun dismissTwaMigrationBanner() {
        prefs.edit().putBoolean(KEY_TWA_MIGRATION_DISMISSED, true).apply()
        refresh()
    }

    fun addDismissedRecommendation(titleName: String) {
        val next = current.dismissedRecommendations + titleName
        prefs.edit().putStringSet(KEY_DISMISSED_RECOMMENDATIONS, next).apply()
        refresh()
    }

    fun setDebugApiBaseUrl(url: String) {
        if (!BuildConfig.ALLOW_SERVER_SWITCHER) return
        val sanitized = url.trim().trimEnd('/')
        if (sanitized.isEmpty()) return
        prefs.edit().putString(KEY_DEBUG_API_BASE_URL, sanitized).apply()
        refresh()
    }

    companion object {
        private const val PREFS_NAME = "ottline.native_prefs"
        private const val KEY_USER_ID = "watchlog.userId"
        private const val KEY_DEVICE_ID = "watchlog.deviceId"
        private const val KEY_PAIRING_CODE = "watchlog.pairingCode"
        private const val KEY_LAST_SYNC_AT = "watchlog.lastSyncAt"
        private const val KEY_ANALYTICS_CLIENT_ID = "watchlog.analyticsClientId"
        private const val KEY_NICKNAME = "watchlog.nickname"
        private const val KEY_PERSONA_KEY = "watchlog.personaKey"
        private const val KEY_THEME_MODE = "watchlog.themeMode"
        private const val KEY_LOCALE = "watchlog.locale"
        private const val KEY_CUSTOM_VIDEO_PLATFORMS = "watchlog.customVideoPlatforms"
        private const val KEY_CUSTOM_BOOK_PLATFORMS = "watchlog.customBookPlatforms"
        private const val KEY_SINGLE_DEVICE_REMINDER_SHOWN = "watchlog.singleDeviceCodeReminderShown"
        private const val KEY_TWA_MIGRATION_DISMISSED = "watchlog.twaMigrationDismissed"
        private const val KEY_DISMISSED_RECOMMENDATIONS = "watchlog.dismissedRecommendations"
        private const val KEY_DEBUG_API_BASE_URL = "watchlog.debugApiBaseUrl"

        val DEBUG_SERVER_PRESETS = listOf(
            "WSL Local Proxy (172.24.75.199:3000)" to "http://172.24.75.199:3000",
            "WSL Preview Tunnel (ngrok)" to "https://unmellow-dimple-untouchably.ngrok-free.dev",
            "Android Emulator Host (10.0.2.2:8080)" to "http://10.0.2.2:8080",
            "ADB Reverse Localhost (127.0.0.1:8080)" to "http://127.0.0.1:8080",
            "Production (ottline.app)" to "https://ottline.app"
        )

        fun applySystemAppLocale(context: Context, locale: String) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                runCatching {
                    val lm = context.getSystemService(LocaleManager::class.java)
                    val target = LocaleList.forLanguageTags(locale)
                    if (lm != null && lm.applicationLocales != target) {
                        lm.applicationLocales = target
                    }
                }
            }
        }
    }
}
