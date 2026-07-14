/**
 * @param {string | null} trackedSessionId
 * @param {string} currentSessionId
 */
export function shouldTrackAppOpenForSession(
  trackedSessionId,
  currentSessionId,
) {
  return trackedSessionId !== currentSessionId;
}

/**
 * @param {string | null} storedPending
 * @param {string} currentSessionId
 * @returns {{ sessionId: string, eventId: string, occurredAt: string } | null}
 */
export function parsePendingAppOpen(storedPending, currentSessionId) {
  if (!storedPending) return null;

  try {
    const parsed = JSON.parse(storedPending);
    if (
      parsed?.sessionId === currentSessionId &&
      typeof parsed.eventId === "string" &&
      typeof parsed.occurredAt === "string"
    ) {
      return parsed;
    }
  } catch {
    // Malformed state is replaced with a new idempotency key by the caller.
  }
  return null;
}
