package app.ottline.data.local

/**
 * Tracks the lifecycle of browser-based TWA/Web session handoff separately from
 * `twaAutoHandoffAttempted` (which only suppresses repeated automatic browser launches).
 */
enum class BrowserHandoffState {
    IDLE,
    PENDING,
    COMPLETED,
    EMPTY_SESSION,
    INCOMPLETE_RETURN,
    LAUNCH_FAILED,
    FAILED
}

enum class AutoHandoffDecision {
    NONE,
    MARK_INCOMPLETE_RETURN,
    TRY_TOKEN_THEN_BROWSER,
    LAUNCH_REFERRER_BROWSER
}

/**
 * Pure decision policy for Android browser handoff auto-start, lifecycle return handling,
 * and Home retry banner visibility.
 */
object BrowserHandoffPolicy {

    fun decideAutoHandoffOnStart(
        prefs: PreferencesSnapshot,
        hasPendingHandoffCallback: Boolean,
        hasTwaFootprint: Boolean,
        referrerWebHandoff: Boolean
    ): AutoHandoffDecision {
        // Cold start while a previous handoff was still PENDING and no callback arrived
        // (e.g., process killed while Chrome showed Cloudflare 522 or user closed Chrome).
        if (prefs.browserHandoffState == BrowserHandoffState.PENDING && !hasPendingHandoffCallback) {
            return AutoHandoffDecision.MARK_INCOMPLETE_RETURN
        }

        // Never auto-relaunch if a callback is already in flight, an auto-attempt already ran,
        // or handoff already completed.
        if (hasPendingHandoffCallback || prefs.twaAutoHandoffAttempted || prefs.twaBrowserHandoffCompleted) {
            return AutoHandoffDecision.NONE
        }

        if (hasTwaFootprint) {
            return AutoHandoffDecision.TRY_TOKEN_THEN_BROWSER
        }

        if (referrerWebHandoff && prefs.userId.isNullOrBlank()) {
            return AutoHandoffDecision.LAUNCH_REFERRER_BROWSER
        }

        return AutoHandoffDecision.NONE
    }

    /**
     * Returns true when the app paused to open the external Custom Tab and resumed
     * without receiving an `ottline://open?handoff=1...` callback.
     */
    fun shouldMarkIncompleteOnResume(
        prefs: PreferencesSnapshot,
        sawPauseWhilePending: Boolean,
        hasPendingHandoffCallback: Boolean
    ): Boolean {
        return sawPauseWhilePending &&
            !hasPendingHandoffCallback &&
            prefs.browserHandoffState == BrowserHandoffState.PENDING
    }

    /**
     * Determines whether the Home continuity/retry card should be visible.
     * Covers TWA upgrades, fresh Play installs arriving via `web_handoff=1` referrer,
     * legacy <=2.0.5 installs whose pre-launch flag has no verified completion proof,
     * and any recoverable failed/incomplete/empty browser handoff state.
     */
    fun shouldShowHomeHandoffCard(
        prefs: PreferencesSnapshot,
        activeLogCount: Int,
        hasTwaFootprint: Boolean
    ): Boolean {
        if (prefs.twaMigrationBannerDismissed || prefs.twaBrowserHandoffCompleted || activeLogCount > 0) {
            return false
        }
        val hasWebHandoffReferrer = PlayInstallReferrerManager
            .parseInstallReferrer(prefs.installReferrerRaw)
            ?.webHandoff == true
        val hasRecoverableState = prefs.browserHandoffState in setOf(
            BrowserHandoffState.INCOMPLETE_RETURN,
            BrowserHandoffState.LAUNCH_FAILED,
            BrowserHandoffState.FAILED,
            BrowserHandoffState.EMPTY_SESSION
        )
        return hasTwaFootprint ||
            hasWebHandoffReferrer ||
            hasRecoverableState ||
            prefs.legacyBrowserHandoffUnverified
    }
}
