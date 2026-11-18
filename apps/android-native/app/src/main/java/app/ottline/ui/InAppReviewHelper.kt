package app.ottline.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import app.ottline.data.local.AppPreferences
import com.google.android.play.core.ktx.launchReview
import com.google.android.play.core.ktx.requestReview
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * Coordinates Google Play In-App Review requests at calm, high-satisfaction milestones
 * without interrupting active logging, while adhering to a 60-day local cooldown
 * in addition to Google Play's own device/account quota.
 */
object InAppReviewHelper {

    const val MIN_ACTIVE_LOGS_FOR_REVIEW = 3
    const val MIN_NATIVE_SAVES_FOR_REVIEW = 2
    const val REVIEW_COOLDOWN_MILLIS = 60L * 24L * 60L * 60L * 1000L // 60 days
    private const val CANONICAL_PLAY_PACKAGE = "app.ottline"

    /**
     * Pure eligibility check for unit testing and milestone gating.
     */
    fun shouldPromptForReview(
        activeLogsCount: Int,
        nativeLogSavesCount: Int,
        lastPromptAtMillis: Long,
        nowMillis: Long
    ): Boolean {
        if (activeLogsCount < MIN_ACTIVE_LOGS_FOR_REVIEW) return false
        if (nativeLogSavesCount < MIN_NATIVE_SAVES_FOR_REVIEW) return false
        if (lastPromptAtMillis > 0L && nowMillis - lastPromptAtMillis < REVIEW_COOLDOWN_MILLIS) {
            return false
        }
        return true
    }

    /**
     * Requests and launches the native Google Play In-App Review bottom sheet if eligible.
     * Failures or quota throttling are swallowed silently per Play Core guidelines.
     */
    suspend fun maybeRequestInAppReview(
        context: Context,
        prefs: AppPreferences,
        activeLogsCount: Int,
        nowMillis: Long = System.currentTimeMillis()
    ): Boolean {
        val snap = prefs.current
        if (!shouldPromptForReview(
                activeLogsCount = activeLogsCount,
                nativeLogSavesCount = snap.nativeLogSavesCount,
                lastPromptAtMillis = snap.lastInAppReviewPromptAtMillis,
                nowMillis = nowMillis
            )
        ) {
            return false
        }

        val activity = context.findActivity() ?: return false
        if (activity.isFinishing || activity.isDestroyed) return false

        // Record prompt timestamp up front so we never spam even if Play throttles the sheet
        prefs.markInAppReviewPrompted(nowMillis)

        return runCatching {
            val manager = ReviewManagerFactory.create(activity.applicationContext)
            val reviewInfo = manager.requestReview()
            if (!activity.isFinishing && !activity.isDestroyed) {
                manager.launchReview(activity, reviewInfo)
                true
            } else {
                false
            }
        }.getOrDefault(false)
    }

    /**
     * Opens the Google Play Store listing directly for explicit user-initiated "Rate us" taps
     * (recommended by Google Play guidelines because button taps must always produce visible navigation).
     */
    fun openPlayStoreListing(context: Context, utmSource: String = "in_app_myspace") {
        val referrer = Uri.encode("utm_source=$utmSource&utm_medium=app")
        val marketUri = Uri.parse("market://details?id=$CANONICAL_PLAY_PACKAGE&referrer=$referrer")
        val webUri = Uri.parse("https://play.google.com/store/apps/details?id=$CANONICAL_PLAY_PACKAGE&referrer=$referrer")

        runCatching {
            val marketIntent = Intent(Intent.ACTION_VIEW, marketUri).apply {
                setPackage("com.android.vending")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(marketIntent)
        }.onFailure {
            runCatching {
                val webIntent = Intent(Intent.ACTION_VIEW, webUri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(webIntent)
            }
        }
    }

    private tailrec fun Context.findActivity(): Activity? = when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
}
