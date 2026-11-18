package app.ottline.data.local

import android.content.Context
import app.ottline.data.OttlineRepository
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import java.net.URLDecoder
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

data class ParsedInstallReferrer(
    val raw: String,
    val utmSource: String?,
    val utmMedium: String?,
    val utmCampaign: String?,
    val utmContent: String?,
    val utmTerm: String?,
    val webHandoff: Boolean
) {
    fun toAppOpenAttributionProps(): Map<String, Any?> {
        val props = mutableMapOf<String, Any?>(
            "referrer" to "https://play.google.com"
        )
        utmSource?.let { props["utmSource"] = it }
        utmMedium?.let { props["utmMedium"] = it }
        utmCampaign?.let { props["utmCampaign"] = it }
        utmContent?.let { props["utmContent"] = it }
        utmTerm?.let { props["utmTerm"] = it }
        if (webHandoff) {
            props["webHandoff"] = true
        }
        return props
    }
}

/**
 * Queries Google Play Install Referrer once on first install to:
 * 1. Attribute Play Store organic & web-funnel UTM installs in `app_open` and `android_install_referrer`.
 * 2. Detect `web_handoff=1` (from mobile web CTAs when the user already has web records) so the app
 *    can automatically bridge their Chrome session on first launch without requiring a pairing code.
 */
object PlayInstallReferrerManager {

    private const val MAX_UTM_LENGTH = 128
    private const val MAX_RAW_REFERRER_LENGTH = 256
    private const val QUERY_TIMEOUT_MS = 2_500L

    fun parseInstallReferrer(raw: String?): ParsedInstallReferrer? {
        val trimmed = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val normalizedQuery = if (!trimmed.contains('=') && trimmed.contains("%3D", ignoreCase = true)) {
            runCatching { URLDecoder.decode(trimmed, Charsets.UTF_8.name()) }.getOrDefault(trimmed)
        } else {
            trimmed
        }.trimStart('?')

        if (normalizedQuery.isBlank()) return null

        val params = LinkedHashMap<String, String>()
        for (segment in normalizedQuery.split('&')) {
            if (segment.isBlank()) continue
            val eqIdx = segment.indexOf('=')
            val rawKey = if (eqIdx >= 0) segment.substring(0, eqIdx) else segment
            val rawVal = if (eqIdx >= 0) segment.substring(eqIdx + 1) else ""
            val key = decodeComponent(rawKey).trim().lowercase()
            val value = decodeComponent(rawVal).trim()
            if (key.isNotEmpty() && value.isNotEmpty() && !params.containsKey(key)) {
                params[key] = value
            }
        }

        val handoffFlag = params["web_handoff"]?.lowercase()
        val webHandoff = handoffFlag == "1" || handoffFlag == "true"

        return ParsedInstallReferrer(
            raw = trimmed.take(MAX_RAW_REFERRER_LENGTH),
            utmSource = params["utm_source"]?.take(MAX_UTM_LENGTH),
            utmMedium = params["utm_medium"]?.take(MAX_UTM_LENGTH),
            utmCampaign = params["utm_campaign"]?.take(MAX_UTM_LENGTH),
            utmContent = params["utm_content"]?.take(MAX_UTM_LENGTH),
            utmTerm = params["utm_term"]?.take(MAX_UTM_LENGTH),
            webHandoff = webHandoff
        )
    }

    private fun decodeComponent(value: String): String {
        return runCatching { URLDecoder.decode(value, Charsets.UTF_8.name()) }.getOrDefault(value)
    }

    suspend fun checkAndProcessOnce(
        context: Context,
        repository: OttlineRepository
    ): ParsedInstallReferrer? {
        if (repository.prefs.current.installReferrerChecked) {
            return parseInstallReferrer(repository.prefs.current.installReferrerRaw)
        }

        val rawReferrer = withTimeoutOrNull(QUERY_TIMEOUT_MS) {
            queryPlayInstallReferrer(context.applicationContext)
        }
        repository.prefs.markInstallReferrerChecked(rawReferrer)

        val parsed = parseInstallReferrer(rawReferrer) ?: return null
        repository.trackEvent(
            "android_install_referrer",
            buildMap {
                put("rawReferrer", parsed.raw)
                put("webHandoff", parsed.webHandoff)
                parsed.utmSource?.let { put("utmSource", it) }
                parsed.utmMedium?.let { put("utmMedium", it) }
                parsed.utmCampaign?.let { put("utmCampaign", it) }
                parsed.utmContent?.let { put("utmContent", it) }
                parsed.utmTerm?.let { put("utmTerm", it) }
            }
        )
        return parsed
    }

    private suspend fun queryPlayInstallReferrer(appContext: Context): String? =
        suspendCancellableCoroutine { cont ->
            val client = runCatching {
                InstallReferrerClient.newBuilder(appContext).build()
            }.getOrNull()

            if (client == null) {
                if (cont.isActive) cont.resume(null)
                return@suspendCancellableCoroutine
            }

            cont.invokeOnCancellation {
                runCatching { client.endConnection() }
            }

            runCatching {
                client.startConnection(object : InstallReferrerStateListener {
                    override fun onInstallReferrerSetupFinished(responseCode: Int) {
                        val referrer = if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            runCatching { client.installReferrer?.installReferrer }.getOrNull()
                        } else {
                            null
                        }
                        runCatching { client.endConnection() }
                        if (cont.isActive) {
                            cont.resume(referrer)
                        }
                    }

                    override fun onInstallReferrerServiceDisconnected() {
                        runCatching { client.endConnection() }
                        if (cont.isActive) {
                            cont.resume(null)
                        }
                    }
                })
            }.onFailure {
                runCatching { client.endConnection() }
                if (cont.isActive) {
                    cont.resume(null)
                }
            }
        }
}
