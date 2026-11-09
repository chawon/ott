package app.ottline.data.local

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Base64
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import java.io.File

/**
 * Bridges session & localStorage state from the browser used by the legacy TWA (`versionCode <= 23`)
 * into the pure Android Native app (`versionCode >= 24`), and ensures external Custom Tab launches
 * never loop back into `app.ottline`'s own App Link intent filter.
 */
object TwaBrowserBridge {

    private const val TWA_HELPER_PREFS = "com.google.androidbrowserhelper.trusted.PREFS_FILE"

    private val LEGACY_TWA_PREFS_FILES = listOf(
        "com.google.androidbrowserhelper.trusted.PREFS_FILE.xml",
        "ottline.android_install.xml",
        "ottline.watch_reminder.xml",
        "ottline.revisit_reminder.xml"
    )

    private val PREFERRED_BROWSERS = listOf(
        "com.android.chrome",
        "com.chrome.beta",
        "com.chrome.dev",
        "com.sec.android.app.sbrowser",
        "com.microsoft.emmx",
        "com.brave.browser",
        "com.naver.whale",
        "org.mozilla.firefox",
        "com.opera.browser"
    )

    /**
     * Returns true if this installation was upgraded from an earlier version (such as the TWA build)
     * or has legacy TWA SharedPreferences footprints on disk.
     */
    fun hasTwaOrUpgradeFootprint(context: Context): Boolean {
        val appCtx = context.applicationContext
        if (AndroidInstallToken.hasTwaUpgradeSignal(appCtx)) {
            return true
        }

        val sharedPrefsDir = File(appCtx.applicationInfo.dataDir, "shared_prefs")
        if (File(sharedPrefsDir, "com.google.androidbrowserhelper.trusted.PREFS_FILE.xml").exists()) {
            return true
        }

        val updatedInstall = runCatching {
            val pkgInfo = appCtx.packageManager.getPackageInfo(appCtx.packageName, 0)
            pkgInfo.firstInstallTime > 0L && pkgInfo.lastUpdateTime > pkgInfo.firstInstallTime + 2_000L
        }.getOrDefault(false)

        if (updatedInstall) {
            return true
        }

        return LEGACY_TWA_PREFS_FILES.any { fileName ->
            File(sharedPrefsDir, fileName).exists()
        } && !AndroidInstallToken.peekExistingToken(appCtx).isNullOrBlank()
    }

    /**
     * Resolves the browser package that hosted the TWA (or the user's primary Custom Tabs browser),
     * strictly excluding `app.ottline` itself so `https://ottline.app` URLs open in the browser.
     */
    fun resolveExternalBrowserPackage(context: Context): String? {
        val appCtx = context.applicationContext
        val selfPkg = appCtx.packageName
        val pm = appCtx.packageManager

        // 1. Check if `androidbrowserhelper` stored the verified TWA provider package
        runCatching {
            val twaPrefs = appCtx.getSharedPreferences(TWA_HELPER_PREFS, Context.MODE_PRIVATE)
            for ((_, rawVal) in twaPrefs.all) {
                val str = rawVal as? String ?: continue
                for (candidate in PREFERRED_BROWSERS) {
                    if (str.contains(candidate) && isPackageInstalled(pm, candidate)) {
                        return candidate
                    }
                }
                val decoded = runCatching {
                    String(Base64.decode(str, Base64.DEFAULT), Charsets.UTF_8)
                }.getOrNull()
                if (!decoded.isNullOrBlank()) {
                    for (candidate in PREFERRED_BROWSERS) {
                        if (decoded.contains(candidate) && isPackageInstalled(pm, candidate)) {
                            return candidate
                        }
                    }
                }
            }
        }

        // 2. Ask CustomTabsClient for the best Custom Tabs provider among preferred browsers
        runCatching {
            val picked = CustomTabsClient.getPackageName(appCtx, PREFERRED_BROWSERS, true)
            if (!picked.isNullOrBlank() && picked != selfPkg && isPackageInstalled(pm, picked)) {
                return picked
            }
        }

        // 3. Query all services supporting CustomTabsService
        runCatching {
            val serviceIntent = Intent("android.support.customtabs.action.CustomTabsService")
            val services = pm.queryIntentServices(serviceIntent, 0)
                .mapNotNull { it.serviceInfo?.packageName }
                .filter { it != selfPkg }
            for (preferred in PREFERRED_BROWSERS) {
                if (preferred in services) return preferred
            }
            services.firstOrNull()?.let { return it }
        }

        // 4. Fallback to any installed browser handling generic http:// URLs
        runCatching {
            val browseIntent = Intent(Intent.ACTION_VIEW, Uri.parse("http://www.example.com"))
            val activities = pm.queryIntentActivities(browseIntent, PackageManager.MATCH_ALL)
                .mapNotNull { it.activityInfo?.packageName }
                .filter { it != selfPkg }
            for (preferred in PREFERRED_BROWSERS) {
                if (preferred in activities) return preferred
            }
            activities.firstOrNull()?.let { return it }
        }

        return null
    }

    private fun isPackageInstalled(pm: PackageManager, packageName: String): Boolean {
        return runCatching {
            pm.getPackageInfo(packageName, 0)
            true
        }.getOrDefault(false)
    }

    /**
     * Opens [url] in the external Custom Tabs browser (e.g. Chrome), bypassing `app.ottline`'s
     * own App Link filter for `https://ottline.app`.
     */
    fun launchInExternalCustomTab(context: Context, url: String): Boolean {
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return false
        val browserPkg = resolveExternalBrowserPackage(context)

        return runCatching {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            if (!browserPkg.isNullOrBlank()) {
                customTabsIntent.intent.setPackage(browserPkg)
            }
            customTabsIntent.launchUrl(context, uri)
            true
        }.getOrElse {
            runCatching {
                val fallback = Intent(Intent.ACTION_VIEW, uri).apply {
                    if (!browserPkg.isNullOrBlank()) {
                        setPackage(browserPkg)
                    }
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
                true
            }.getOrDefault(false)
        }
    }

    /**
     * Launches the TWA-to-Native automatic session handoff URL inside the browser that TWA used.
     * The web app reads `watchlog.userId`, `watchlog.deviceId`, `watchlog.pairingCode`, and
     * `watchlog.profile.v1` from `localStorage` (and syncs any pending IndexedDB logs), then
     * redirects back via `ottline://open?handoff=1&...`.
     */
    fun launchTwaHandoff(
        context: Context,
        locale: String,
        apiBaseUrl: String = "https://ottline.app"
    ): Boolean {
        val lang = if (locale.startsWith("en", ignoreCase = true)) "en" else "ko"
        val base = apiBaseUrl.trim().trimEnd('/').ifEmpty { "https://ottline.app" }
        val handoffUrl = "$base/$lang?native_handoff=1&ts=${System.currentTimeMillis()}"
        return launchInExternalCustomTab(context, handoffUrl)
    }
}
