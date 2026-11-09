package app.ottline

import android.app.Application
import androidx.work.Configuration
import app.ottline.data.OttlineRepository
import app.ottline.data.SyncWorker
import app.ottline.data.local.AndroidInstallToken
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.OttlineDatabase
import app.ottline.data.remote.OttlineApiClient
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade

class OttlineApplication : Application(), SingletonImageLoader.Factory, Configuration.Provider {

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().build()

    lateinit var appPreferences: AppPreferences
        private set

    lateinit var database: OttlineDatabase
        private set

    lateinit var apiClient: OttlineApiClient
        private set

    lateinit var repository: OttlineRepository
        private set

    override fun onCreate() {
        super.onCreate()
        appPreferences = AppPreferences(this)
        AndroidInstallToken.recordUpgradeMarkerIfNeeded(
            context = this,
            hasNativeUserId = !appPreferences.current.userId.isNullOrBlank()
        )
        database = OttlineDatabase.getInstance(this)
        apiClient = OttlineApiClient(appPreferences)
        repository = OttlineRepository(
            appContext = this,
            db = database,
            prefs = appPreferences,
            api = apiClient,
            scheduleBackgroundSync = { SyncWorker.enqueueWhenConnected(this) }
        )

        // Maintain existing reminder schedules seamlessly without resetting active timers
        WatchReminderScheduler.syncScheduleIfEnabled(this)
        RevisitReminderScheduler.syncAutoState(this)
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader {
        return ImageLoader.Builder(context)
            .components {
                add(OkHttpNetworkFetcherFactory(callFactory = { apiClient.httpClient }))
            }
            .crossfade(true)
            .build()
    }
}
