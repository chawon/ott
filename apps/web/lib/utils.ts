import { Occasion, Place, Status, Title, WatchLog } from "./types";
export function cn(...inputs: Array<string | undefined | null | false>) {
  return inputs.filter(Boolean).join(" ");
}

export function findTitle(titleId: string): Title | undefined {
  return undefined;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const STATUS_LABELS: Record<Status, string> = {
  DONE: "Watched",
  IN_PROGRESS: "Watching",
  WISHLIST: "Want to watch",
};

export const BOOK_STATUS_LABELS: Record<Status, string> = {
  DONE: "Read",
  IN_PROGRESS: "Reading",
  WISHLIST: "Want to read",
};

export const STATUS_VALUES: Status[] = ["DONE", "IN_PROGRESS", "WISHLIST"];

export const PLACE_LABELS: Record<Place, string> = {
  HOME: "Home",
  THEATER: "Theater",
  TRANSIT: "Transit",
  CAFE: "Cafe",
  OFFICE: "Office",
  LIBRARY: "Library",
  BOOKSTORE: "Bookstore",
  SCHOOL: "School",
  PARK: "Park",
  OUTDOOR: "Outdoor",
  ETC: "Etc",
};

export const VIDEO_PLACE_VALUES: Place[] = [
  "HOME",
  "THEATER",
  "TRANSIT",
  "CAFE",
  "OFFICE",
  "ETC",
];

export const BOOK_PLACE_VALUES: Place[] = [
  "HOME",
  "CAFE",
  "LIBRARY",
  "BOOKSTORE",
  "SCHOOL",
  "PARK",
  "OUTDOOR",
  "TRANSIT",
  "ETC",
];

export const OCCASION_LABELS: Record<Occasion, string> = {
  ALONE: "Alone",
  DATE: "Date",
  FAMILY: "Family",
  FRIENDS: "Friends",
  BREAK: "Break",
  ETC: "Etc",
};

export function statusLabel(
  status: WatchLog["status"],
  titleType?: Title["type"],
  t?: any,
): string {
  if (t) return titleType === "book" ? t("BOOK_" + status) : t(status);
  return titleType === "book"
    ? BOOK_STATUS_LABELS[status]
    : STATUS_LABELS[status];
}

export function placeLabel(place: Place, t?: any): string {
  return t ? t(place) : PLACE_LABELS[place];
}

export function occasionLabel(occasion: Occasion, t?: any): string {
  return t ? t(occasion) : OCCASION_LABELS[occasion];
}

export function statusOptionsForType(type?: Title["type"], t?: any) {
  const labels = type === "book" ? BOOK_STATUS_LABELS : STATUS_LABELS;
  return STATUS_VALUES.map((value) => ({
    value,
    label: t ? (type === "book" ? t("BOOK_" + value) : t(value)) : labels[value],
  }));
}

export function placeOptionsForType(type?: Title["type"], t?: any) {
  const values = type === "book" ? BOOK_PLACE_VALUES : VIDEO_PLACE_VALUES;
  return values.map((value) => ({
    value,
    label: t ? t("placeLabels." + value) : PLACE_LABELS[value],
  }));
}

export function formatNoteInline(note: string): string {
  return note.replace(/\s*\r?\n\s*/g, " ⏎ ");
}

export function safeUUID() {
  return crypto.randomUUID();
}

export function tmdbResize(url: string, size = "w185") {
  if (!url) return url;
  if (url.includes("image.tmdb.org")) {
    return url.replace(/\/w\d+/, `/${size}`);
  }
  return url;
}

const VIDEO_RATING_OPTIONS = [
  { value: 5, label: "😍 Amazing!" },
  { value: 3, label: "🙂 Good" },
  { value: 1, label: "😕 Disappointing" },
];

const BOOK_RATING_OPTIONS = [
  { value: 5, label: "📚 Life-changing" },
  { value: 3, label: "🙂 Worth reading" },
  { value: 1, label: "😕 Disappointing" },
];

export function ratingOptionsForType(type?: Title["type"], t?: any) {
  if (t) {
    return type === "book"
      ? [
          { value: 5, label: "📚 " + t("ratingBestBookModern") },
          { value: 3, label: "🙂 " + t("ratingSosoBookModern") },
          { value: 1, label: "😕 " + t("ratingBadBook") },
        ]
      : [
          { value: 5, label: "😍 " + t("ratingBestModern") },
          { value: 3, label: "🙂 " + t("ratingSosoModern") },
          { value: 1, label: "😕 " + t("ratingBadModern") },
        ];
  }
  return type === "book" ? BOOK_RATING_OPTIONS : VIDEO_RATING_OPTIONS;
}

export function ratingDisplay(
  rating?: number | null,
  titleType?: Title["type"],
  t?: any,
) {
  if (typeof rating !== "number") return null;
  if (t) {
    if (titleType === "book") {
      if (rating >= 5)
        return { emoji: "📚", label: t("ratingBestBookModern"), value: 5 };
      if (rating >= 3)
        return { emoji: "🙂", label: t("ratingSosoBookModern"), value: 3 };
      return { emoji: "😕", label: t("ratingBadBook"), value: 1 };
    }
    if (rating >= 5)
      return { emoji: "😍", label: t("ratingBestModern"), value: 5 };
    if (rating >= 3)
      return { emoji: "🙂", label: t("ratingSosoModern"), value: 3 };
    return { emoji: "😕", label: t("ratingBadModern"), value: 1 };
  }
  if (titleType === "book") {
    if (rating >= 5) return { emoji: "📚", label: "Life-changing", value: 5 };
    if (rating >= 3) return { emoji: "🙂", label: "Worth reading", value: 3 };
    return { emoji: "😕", label: "Disappointing", value: 1 };
  }
  if (rating >= 5) return { emoji: "😍", label: "Amazing!", value: 5 };
  if (rating >= 3) return { emoji: "🙂", label: "Good", value: 3 };
  return { emoji: "😕", label: "Disappointing", value: 1 };
}
