package app.ottline;

/** Tracks new viewing time across scans without mixing different daily counters. */
final class WatchReminderUsageTracker {
    private static final long MIN_FOREGROUND_MS = 5L * 60L * 1000L;
    private static final long CANDIDATE_WINDOW_MS = 2L * 60L * 60L * 1000L;

    private WatchReminderUsageTracker() {}

    static final class State {
        final long intervalStartAt;
        final long totalForegroundMs;
        final long unnotifiedForegroundMs;
        final long lastTimeUsed;

        State(long intervalStartAt, long totalForegroundMs, long unnotifiedForegroundMs, long lastTimeUsed) {
            this.intervalStartAt = intervalStartAt;
            this.totalForegroundMs = totalForegroundMs;
            this.unnotifiedForegroundMs = unnotifiedForegroundMs;
            this.lastTimeUsed = lastTimeUsed;
        }

        boolean isCandidate(long now) {
            return unnotifiedForegroundMs >= MIN_FOREGROUND_MS && isRecent(lastTimeUsed, now);
        }

        State consume() {
            return new State(intervalStartAt, totalForegroundMs, 0L, lastTimeUsed);
        }
    }

    static State observe(
            State previous,
            long intervalStartAt,
            long totalForegroundMs,
            long lastTimeUsed,
            long now
    ) {
        // An upgrade or a newly discovered package establishes a baseline first.
        // If stats were unavailable at enable time, exclude usage predating enable.
        if (previous == null
                || (previous.intervalStartAt == 0L && lastTimeUsed <= previous.lastTimeUsed)) {
            return new State(intervalStartAt, totalForegroundMs, 0L, lastTimeUsed);
        }
        if (intervalStartAt < previous.intervalStartAt) return previous;

        boolean sameInterval = intervalStartAt == previous.intervalStartAt;
        long delta = sameInterval
                ? Math.max(0L, totalForegroundMs - previous.totalForegroundMs)
                : Math.max(0L, totalForegroundMs);
        long carried = isRecent(previous.lastTimeUsed, now) ? previous.unnotifiedForegroundMs : 0L;
        long accumulated = isRecent(lastTimeUsed, now) ? carried + delta : 0L;

        // A temporarily lower counter must not make already observed time count twice.
        long total = sameInterval ? Math.max(previous.totalForegroundMs, totalForegroundMs) : totalForegroundMs;
        return new State(intervalStartAt, total, accumulated, lastTimeUsed);
    }

    private static boolean isRecent(long lastTimeUsed, long now) {
        return lastTimeUsed > 0L && lastTimeUsed <= now && now - lastTimeUsed <= CANDIDATE_WINDOW_MS;
    }
}
