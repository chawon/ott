package app.ottline;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WatchReminderUsageTrackerTest {
    private static final long MINUTE = 60_000L;
    private static final long DAY = 24L * 60L * MINUTE;
    private static final long NOW = 10L * DAY;
    private static final long INTERVAL = NOW - 12L * 60L * MINUTE;

    private WatchReminderUsageTracker.State baseline(long total) {
        return new WatchReminderUsageTracker.State(INTERVAL, total, 0L, NOW - MINUTE);
    }

    private WatchReminderUsageTracker.State observe(
            WatchReminderUsageTracker.State previous, long total
    ) {
        return WatchReminderUsageTracker.observe(previous, INTERVAL, total, NOW - MINUTE, NOW);
    }

    @Test
    public void firstObservationDoesNotNotifyForExistingUsage() {
        WatchReminderUsageTracker.State state = observe(null, 90L * MINUTE);

        assertEquals(0L, state.unnotifiedForegroundMs);
        assertFalse(state.isCandidate(NOW));
    }

    @Test
    public void sixMinuteViewingAcrossThreeScansNotifies() {
        WatchReminderUsageTracker.State state = baseline(0L);
        state = observe(state, 2L * MINUTE);
        assertFalse(state.isCandidate(NOW));
        state = observe(state, 4L * MINUTE);
        assertFalse(state.isCandidate(NOW));
        state = observe(state, 6L * MINUTE);

        assertEquals(6L * MINUTE, state.unnotifiedForegroundMs);
        assertTrue(state.isCandidate(NOW));
    }

    @Test
    public void fiveMinutesExactlyIsEnough() {
        assertTrue(observe(baseline(0L), 5L * MINUTE).isCandidate(NOW));
    }

    @Test
    public void shortVisitAndRepeatedIdenticalScansStaySilent() {
        WatchReminderUsageTracker.State state = observe(baseline(0L), 2L * MINUTE);
        for (int i = 0; i < 10; i++) state = observe(state, 2L * MINUTE);

        assertEquals(2L * MINUTE, state.unnotifiedForegroundMs);
        assertFalse(state.isCandidate(NOW));
    }

    @Test
    public void nextDayCounterSmallerThanYesterdayStillNotifies() {
        WatchReminderUsageTracker.State yesterday = new WatchReminderUsageTracker.State(
                INTERVAL - DAY, 120L * MINUTE, 0L, NOW - DAY
        );

        WatchReminderUsageTracker.State state = observe(yesterday, 10L * MINUTE);

        assertEquals(10L * MINUTE, state.unnotifiedForegroundMs);
        assertTrue(state.isCandidate(NOW));
    }

    @Test
    public void viewingAcrossMidnightRetainsUnnotifiedMinutes() {
        WatchReminderUsageTracker.State beforeMidnight = new WatchReminderUsageTracker.State(
                INTERVAL - DAY, 122L * MINUTE, 2L * MINUTE, NOW - 4L * MINUTE
        );

        assertTrue(observe(beforeMidnight, 3L * MINUTE).isCandidate(NOW));
    }

    @Test
    public void oldShortVisitDoesNotCombineWithNewShortVisit() {
        WatchReminderUsageTracker.State previous = new WatchReminderUsageTracker.State(
                INTERVAL, 3L * MINUTE, 3L * MINUTE, NOW - 3L * 60L * MINUTE
        );

        WatchReminderUsageTracker.State state = observe(previous, 6L * MINUTE);

        assertEquals(3L * MINUTE, state.unnotifiedForegroundMs);
        assertFalse(state.isCandidate(NOW));
    }

    @Test
    public void expiredUsageCannotNotify() {
        WatchReminderUsageTracker.State state = WatchReminderUsageTracker.observe(
                baseline(0L), INTERVAL, 10L * MINUTE, NOW - 3L * 60L * MINUTE, NOW
        );

        assertFalse(state.isCandidate(NOW));
        assertEquals(0L, state.unnotifiedForegroundMs);
    }

    @Test
    public void consumedUsageDoesNotNotifyAgainWithoutNewViewing() {
        WatchReminderUsageTracker.State state = observe(baseline(0L), 6L * MINUTE);
        assertTrue(state.isCandidate(NOW));

        state = observe(state.consume(), 6L * MINUTE);
        assertFalse(state.isCandidate(NOW));
        assertTrue(observe(state, 11L * MINUTE).isCandidate(NOW));
    }

    @Test
    public void regressingCounterDoesNotDoubleCountUsage() {
        WatchReminderUsageTracker.State state = observe(baseline(10L * MINUTE), 12L * MINUTE);
        state = observe(state, 8L * MINUTE);
        state = observe(state, 13L * MINUTE);

        assertEquals(3L * MINUTE, state.unnotifiedForegroundMs);
        assertFalse(state.isCandidate(NOW));
    }

    @Test
    public void olderDailyIntervalDoesNotReplaceCurrentBaseline() {
        WatchReminderUsageTracker.State state = WatchReminderUsageTracker.observe(
                baseline(10L * MINUTE), INTERVAL - DAY, 120L * MINUTE, NOW - DAY, NOW
        );

        assertEquals(INTERVAL, state.intervalStartAt);
        assertEquals(10L * MINUTE, state.totalForegroundMs);
        assertFalse(state.isCandidate(NOW));
    }

    @Test
    public void noPreviousUsageCanStartCountingAfterEnable() {
        WatchReminderUsageTracker.State empty = new WatchReminderUsageTracker.State(
                0L, 0L, 0L, NOW - 10L * MINUTE
        );

        assertTrue(observe(empty, 6L * MINUTE).isCandidate(NOW));
    }

    @Test
    public void previouslyUnavailableStatsDoNotNotifyForUsageBeforeEnable() {
        WatchReminderUsageTracker.State empty = new WatchReminderUsageTracker.State(
                0L, 0L, 0L, NOW - 30_000L
        );

        assertFalse(observe(empty, 6L * MINUTE).isCandidate(NOW));
    }

    @Test
    public void futureUsageTimestampCannotNotify() {
        WatchReminderUsageTracker.State state = WatchReminderUsageTracker.observe(
                baseline(0L), INTERVAL, 6L * MINUTE, NOW + DAY, NOW
        );

        assertFalse(state.isCandidate(NOW));
    }
}
