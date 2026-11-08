import type { Occasion, Place, WatchLog } from "./types";

// Keep accepted query values within the existing record contract.
const places: Record<Place, true> = {
  HOME: true,
  THEATER: true,
  TRANSIT: true,
  CAFE: true,
  OFFICE: true,
  LIBRARY: true,
  BOOKSTORE: true,
  SCHOOL: true,
  PARK: true,
  OUTDOOR: true,
  ETC: true,
};
const occasions: Record<Occasion, true> = {
  ALONE: true,
  DATE: true,
  FAMILY: true,
  FRIENDS: true,
  BREAK: true,
  ETC: true,
};

export function readMomentFilters(params: Pick<URLSearchParams, "get">): {
  place: Place | "";
  occasion: Occasion | "";
} {
  const place = params.get("place") ?? "";
  const occasion = params.get("occasion") ?? "";
  return {
    place: Object.hasOwn(places, place) ? (place as Place) : "",
    occasion: Object.hasOwn(occasions, occasion) ? (occasion as Occasion) : "",
  };
}

export type TimelineMoment =
  | { field: "place"; value: Place; count: number }
  | { field: "occasion"; value: Occasion; count: number };

export function collectTimelineMoments(logs: WatchLog[]): TimelineMoment[] {
  const seen = new Set<string>();
  const placeCounts = new Map<Place, number>();
  const occasionCounts = new Map<Occasion, number>();
  for (const log of logs) {
    if (
      seen.has(log.id) ||
      log.deletedAt ||
      !log.title?.id ||
      log.status === "WISHLIST"
    )
      continue;
    seen.add(log.id);
    if (log.place && Object.hasOwn(places, log.place))
      placeCounts.set(log.place, (placeCounts.get(log.place) ?? 0) + 1);
    if (log.occasion && Object.hasOwn(occasions, log.occasion))
      occasionCounts.set(
        log.occasion,
        (occasionCounts.get(log.occasion) ?? 0) + 1,
      );
  }
  const mostKept = <T extends string>(counts: Map<T, number>) =>
    [...counts]
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .slice(0, 3);
  return [
    ...mostKept(placeCounts).map(([value, count]) => ({
      field: "place" as const,
      value,
      count,
    })),
    ...mostKept(occasionCounts).map(([value, count]) => ({
      field: "occasion" as const,
      value,
      count,
    })),
  ];
}
