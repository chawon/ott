import type { Title, WatchLog } from "./types";

/** Keep a saved season's poster and release year on the same edition. */
export function recordDisplayYear(
  title: Pick<Title, "type" | "year">,
  record?: Pick<WatchLog, "seasonNumber" | "seasonYear"> | null,
): number | null {
  if (title.type === "series" && typeof record?.seasonNumber === "number") {
    return record.seasonYear ?? title.year ?? null;
  }
  return title.year ?? null;
}
