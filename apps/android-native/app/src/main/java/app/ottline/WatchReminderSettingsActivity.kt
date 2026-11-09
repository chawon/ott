package app.ottline

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.screens.WatchReminderScreen
import app.ottline.ui.theme.LocalOttlinePalette
import app.ottline.ui.theme.OttlineTheme

class WatchReminderSettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as OttlineApplication

        setContent {
            val snap by app.appPreferences.state.collectAsState()
            CompositionLocalProvider(LocalAppLocale provides snap.locale) {
                OttlineTheme(themeMode = snap.themeMode) {
                    Surface(
                        color = LocalOttlinePalette.current.background,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .statusBarsPadding()
                                .navigationBarsPadding()
                        ) {
                            WatchReminderScreen(onBack = { finish() })
                        }
                    }
                }
            }
        }
    }
}
