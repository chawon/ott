const OWNED_ENTRY_SOURCES = new Set([
  "android-watch-reminder",
  "android-revisit-reminder",
]);
const PUBLIC_PAGE_VIEW_PATHS = new Set(["/privacy"]);

function normalizePathname(pathname) {
  if (typeof pathname !== "string") return null;

  const pathOnly = pathname.trim().split(/[?#]/, 1)[0];
  if (!pathOnly?.startsWith("/")) return null;
  if (pathOnly === "/") return pathOnly;
  return pathOnly.replace(/\/+$/, "");
}

/**
 * Public legal documents are measured separately from product app opens. The
 * returned path keeps its locale prefix so each localized document can be
 * inspected independently.
 *
 * @param {unknown} pathname
 * @returns {string | null}
 */
export function normalizePublicPageViewPath(pathname) {
  const normalized = normalizePathname(pathname);
  if (!normalized) return null;

  const productPath = normalized.replace(/^\/(?:ko|en)(?=\/)/, "");
  return PUBLIC_PAGE_VIEW_PATHS.has(productPath) ? normalized : null;
}

/**
 * @param {unknown} pathname
 * @returns {"app_open" | "public_page_view"}
 */
export function pageOpenEventForPath(pathname) {
  return normalizePublicPageViewPath(pathname)
    ? "public_page_view"
    : "app_open";
}

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
