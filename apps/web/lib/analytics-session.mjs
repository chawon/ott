const OWNED_ENTRY_SOURCES = new Set([
  "android-watch-reminder",
  "android-revisit-reminder",
]);

/**
 * Only explicit, product-owned entry markers are retained. Arbitrary `source`
 * query values are ignored so user-controlled data cannot become analytics
 * dimensions.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeOwnedEntrySource(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().slice(0, 128);
  return OWNED_ENTRY_SOURCES.has(normalized) ? normalized : null;
}

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
