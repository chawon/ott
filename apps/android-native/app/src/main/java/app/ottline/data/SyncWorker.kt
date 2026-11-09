package app.ottline.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.ottline.OttlineApplication

class SyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? OttlineApplication ?: return Result.success()
        val state = app.repository.syncOutbox()
        return when (state.status) {
            SyncStatus.IDLE -> Result.success()
            SyncStatus.OFFLINE -> Result.retry()
            SyncStatus.FAILED -> if (state.failure == SyncFailureReason.REQUEST) Result.retry() else Result.failure()
            SyncStatus.SYNCING -> Result.success()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "ottline-outbox-sync"

        fun enqueueWhenConnected(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(UNIQUE_WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
