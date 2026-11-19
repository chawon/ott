/**
 * @param {{ title: string; platform?: string; type: string | null }} capture
 */
export function buildDesktopQuickRecordUrl({ title, platform, type }) {
  const query = new URLSearchParams({
    quick: "1",
    title,
    q: title,
  });
  if (platform) query.set("platform", platform);
  query.set("type", type === "video" || type === "book" ? type : "all");
  return `ottline://quick?${query}`;
}
