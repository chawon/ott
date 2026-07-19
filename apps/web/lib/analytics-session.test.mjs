import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeOwnedEntrySource,
  parsePendingAppOpen,
  shouldTrackAppOpenForSession,
} from "./analytics-session.mjs";

test("keeps only allowlisted product entry sources", () => {
  assert.equal(
    normalizeOwnedEntrySource(" Android-Watch-Reminder "),
    "android-watch-reminder",
  );
  assert.equal(
    normalizeOwnedEntrySource("android-revisit-reminder"),
    "android-revisit-reminder",
  );
  assert.equal(normalizeOwnedEntrySource("newsletter-user@example.com"), null);
  assert.equal(normalizeOwnedEntrySource(null), null);
});

test("tracks only the first app open in a session", () => {
  const sessionId = "session-1";

  assert.equal(shouldTrackAppOpenForSession(null, sessionId), true);
  assert.equal(shouldTrackAppOpenForSession(sessionId, sessionId), false);
});

test("tracks again when a new browser session starts", () => {
  assert.equal(shouldTrackAppOpenForSession("session-1", "session-2"), true);
});

test("reuses the same event id and occurrence time for a pending retry", () => {
  const pending = {
    sessionId: "session-1",
    eventId: "event-1",
    occurredAt: "2026-07-14T00:00:00.000Z",
  };

  assert.deepEqual(
    parsePendingAppOpen(JSON.stringify(pending), "session-1"),
    pending,
  );
});

test("rejects malformed or different-session pending state", () => {
  assert.equal(parsePendingAppOpen("not-json", "session-1"), null);
  assert.equal(
    parsePendingAppOpen(
      JSON.stringify({
        sessionId: "session-1",
        eventId: "event-1",
        occurredAt: "2026-07-14T00:00:00.000Z",
      }),
      "session-2",
    ),
    null,
  );
});
