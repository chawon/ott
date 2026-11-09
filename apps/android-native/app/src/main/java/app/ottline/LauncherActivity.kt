package app.ottline

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import app.ottline.model.Occasion
import app.ottline.model.PersonaKey
import app.ottline.model.Place
import app.ottline.ui.LaunchCommand
import app.ottline.ui.OttlineAppRoot
import kotlinx.coroutines.launch

/**
 * Main entry activity keeping exact `app.ottline.LauncherActivity` component identity
 * for seamless Play Store upgrade from TWA (`versionCode <= 23`).
 */
class LauncherActivity : ComponentActivity() {

    private var pendingCommand by mutableStateOf<LaunchCommand?>(null)
    private var initialIntentHandled: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        splashScreen.setOnExitAnimationListener { splashViewProvider ->
            splashViewProvider.remove()
        }
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        initialIntentHandled = savedInstanceState?.getBoolean(KEY_INITIAL_INTENT_HANDLED, false) ?: false
        if (!initialIntentHandled) {
            handleIncomingIntent(intent)
        }

        val app = application as OttlineApplication
        setContent {
            OttlineAppRoot(
                repository = app.repository,
                pendingCommand = pendingCommand,
                onConsumeCommand = {
                    initialIntentHandled = true
                    pendingCommand = null
                }
            )
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_INITIAL_INTENT_HANDLED, initialIntentHandled)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        initialIntentHandled = false
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) {
            initialIntentHandled = true
            return
        }

        // 1. Mark revisit reminder opened if launched from revisit notification
        val revisitDeliveryId = intent.getStringExtra(RevisitReminderApiClient.EXTRA_REVISIT_DELIVERY_ID)
        if (!revisitDeliveryId.isNullOrBlank()) {
            lifecycleScope.launch {
                RevisitReminderApiClient.markOpened(applicationContext, revisitDeliveryId)
            }
        }

        // 2. Android Share Sheet (`ACTION_SEND` / `ACTION_SEND_MULTIPLE`)
        when (intent.action) {
            Intent.ACTION_SEND -> {
                val text = intent.getStringExtra(Intent.EXTRA_TEXT)
                val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
                if (!text.isNullOrBlank() || !subject.isNullOrBlank()) {
                    pendingCommand = LaunchCommand.OpenSharedContent(text, subject)
                    return
                }
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                val texts = intent.getCharSequenceArrayListExtra(Intent.EXTRA_TEXT)
                    ?.joinToString("\n") { it.toString() }
                val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
                if (!texts.isNullOrBlank() || !subject.isNullOrBlank()) {
                    pendingCommand = LaunchCommand.OpenSharedContent(texts, subject)
                    return
                }
            }
        }

        // 3. Widget quick type extra
        val widgetQuickType = intent.getStringExtra(QuickLogWidgetProvider.EXTRA_QUICK_TYPE)
        if (!widgetQuickType.isNullOrBlank()) {
            pendingCommand = LaunchCommand.OpenQuickRecord(typeTab = widgetQuickType)
            return
        }

        // 4. App Links (`https://ottline.app/...`) & Shortcut / Notification deep links
        val data: Uri? = intent.data
        if (data == null) {
            initialIntentHandled = true
            return
        }
        val parsed = parseDeepLinkUri(data)
        if (parsed != null) {
            pendingCommand = parsed
        } else {
            initialIntentHandled = true
        }
    }

    companion object {
        private const val KEY_INITIAL_INTENT_HANDLED = "ottline.initial_intent_handled"

        fun parseDeepLinkUri(uri: Uri): LaunchCommand? {
            if (uri.getQueryParameter("handoff") == "1") {
                return LaunchCommand.CompleteTwaHandoff(
                    status = uri.getQueryParameter("status") ?: "empty",
                    userId = uri.getQueryParameter("user_id"),
                    deviceId = uri.getQueryParameter("device_id"),
                    pairingCode = uri.getQueryParameter("pairing_code"),
                    nickname = uri.getQueryParameter("nickname"),
                    personaKey = PersonaKey.fromWire(uri.getQueryParameter("persona_key"))
                )
            }
            if (uri.scheme == "ottline") {
                return when (uri.host) {
                    "watch-reminder" -> LaunchCommand.OpenRoute("watch_reminder")
                    "open" -> LaunchCommand.OpenRoute("home")
                    else -> null
                }
            }
            if (uri.scheme !in listOf("http", "https")) {
                return null
            }

            // Quick record query params (`?quick=1&quick_type=video|book&ott=...&q=...&title_id=...`)
            if (uri.getQueryParameter("quick") == "1") {
                val quickType = uri.getQueryParameter("quick_type") ?: "all"
                val ott = uri.getQueryParameter("ott")
                val q = uri.getQueryParameter("q").orEmpty()
                val titleId = uri.getQueryParameter("title_id")?.takeIf { it.isNotBlank() }
                return LaunchCommand.OpenQuickRecord(
                    query = q,
                    typeTab = quickType,
                    platform = ott,
                    titleId = titleId
                )
            }

            // Strip optional `/ko` or `/en` locale prefix
            val segments = uri.pathSegments.let { segs ->
                if (segs.firstOrNull() in listOf("ko", "en")) segs.drop(1) else segs
            }

            if (segments.isEmpty()) {
                return LaunchCommand.OpenRoute("home")
            }

            return when (segments.first()) {
                "timeline" -> {
                    val contentType = uri.getQueryParameter("contentType") ?: uri.getQueryParameter("type")
                    val status = uri.getQueryParameter("status")
                    val place = Place.fromWire(uri.getQueryParameter("place"))
                    val occasion = Occasion.fromWire(uri.getQueryParameter("occasion"))
                    val query = uri.getQueryParameter("q")
                    LaunchCommand.OpenTimeline(
                        contentType = contentType,
                        status = status,
                        place = place,
                        occasion = occasion,
                        query = query
                    )
                }
                "public", "discussions" -> {
                    val discId = segments.getOrNull(1)
                    if (!discId.isNullOrBlank()) {
                        LaunchCommand.OpenRoute("discussion/${Uri.encode(discId)}")
                    } else {
                        LaunchCommand.OpenRoute("together")
                    }
                }
                "title" -> {
                    val titleId = segments.getOrNull(1)
                    if (!titleId.isNullOrBlank()) {
                        LaunchCommand.OpenRoute("title/${Uri.encode(titleId)}")
                    } else {
                        LaunchCommand.OpenRoute("home")
                    }
                }
                "account" -> LaunchCommand.OpenRoute("my_space")
                "bookshelf" -> LaunchCommand.OpenRoute("bookshelf")
                "report" -> LaunchCommand.OpenRoute("report")
                "feedback" -> LaunchCommand.OpenRoute("feedback")
                "guide", "guides", "about", "faq", "privacy" -> LaunchCommand.OpenRoute("guides")
                "me" -> when (segments.getOrNull(1)) {
                    "report" -> LaunchCommand.OpenRoute("report")
                    "bookshelf" -> LaunchCommand.OpenRoute("bookshelf")
                    else -> LaunchCommand.OpenRoute("my_space")
                }
                else -> {
                    if (uri.scheme in listOf("http", "https")) {
                        LaunchCommand.OpenExternalBrowser(uri.toString())
                    } else {
                        null
                    }
                }
            }
        }
    }
}
