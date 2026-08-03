/**
 * Prefer the corrected Cloudflare field while an older API response may still
 * expose only the legacy name.
 *
 * @param {{ visits?: number, uniqueVisitors?: number }} cloudflare
 */
export function resolveCloudflareVisits(cloudflare) {
  return cloudflare.visits ?? cloudflare.uniqueVisitors ?? 0;
}

/**
 * @param {string | undefined} generatedAt
 * @returns {string | null}
 */
export function formatKstSnapshotTime(generatedAt) {
  if (!generatedAt) return null;

  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")} KST`;
}
