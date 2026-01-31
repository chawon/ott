import { Occasion, Place, Status, Title, WatchLog } from "./types";
export function cn(...inputs: Array<string | undefined | null | false>) {
  return inputs.filter(Boolean).join(" ");
}

export function findTitle(titleId: string): Title | undefined {
  return undefined;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export const STATUS_LABELS: Record<Status, string> = {
  DONE: "봤어요",
  IN_PROGRESS: "보는 중",
  WISHLIST: "보고 싶어요",
};

export const BOOK_STATUS_LABELS: Record<Status, string> = {
  DONE: "읽었어요",
  IN_PROGRESS: "읽는 중",
  WISHLIST: "읽고 싶어요",
};

export const STATUS_VALUES: Status[] = ["DONE", "IN_PROGRESS", "WISHLIST"];

export const PLACE_LABELS: Record<Place, string> = {
  HOME: "집",
  THEATER: "극장",
  TRANSIT: "이동 중",
  CAFE: "카페",
  OFFICE: "직장",
  LIBRARY: "도서관",
  BOOKSTORE: "서점",
  SCHOOL: "학교",
  PARK: "공원",
  OUTDOOR: "야외",
  ETC: "기타",
};

export const VIDEO_PLACE_VALUES: Place[] = ["HOME", "THEATER", "TRANSIT", "CAFE", "OFFICE", "ETC"];
export const BOOK_PLACE_VALUES: Place[] = [
  "HOME",
  "LIBRARY",
  "CAFE",
  "BOOKSTORE",
  "TRANSIT",
  "SCHOOL",
  "OFFICE",
  "PARK",
  "OUTDOOR",
  "ETC",
];

export const OCCASION_LABELS: Record<Occasion, string> = {
  ALONE: "혼자",
  DATE: "데이트",
  FAMILY: "가족",
  FRIENDS: "친구",
  BREAK: "휴식",
  ETC: "기타",
};

export function statusLabel(status: WatchLog["status"], titleType?: Title["type"]): string {
  return titleType === "book" ? BOOK_STATUS_LABELS[status] : STATUS_LABELS[status];
}

export function placeLabel(place: Place): string {
  return PLACE_LABELS[place];
}

export function occasionLabel(occasion: Occasion): string {
  return OCCASION_LABELS[occasion];
}

export function statusOptionsForType(type?: Title["type"]) {
  const labels = type === "book" ? BOOK_STATUS_LABELS : STATUS_LABELS;
  return STATUS_VALUES.map((value) => ({ value, label: labels[value] }));
}

export function placeOptionsForType(type?: Title["type"]) {
  const values = type === "book" ? BOOK_PLACE_VALUES : VIDEO_PLACE_VALUES;
  return values.map((value) => ({ value, label: PLACE_LABELS[value] }));
}

export function formatNoteInline(note: string): string {
  return note.replace(/\s*\r?\n\s*/g, " ⏎ ");
}

export function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  hex[6] = (hex[6] & 0x0f) | 0x40;
  hex[8] = (hex[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  const b = hex.map(toHex).join("");
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
}

export function tmdbResize(url: string | null | undefined, size: string): string | undefined {
  if (!url) return url ?? undefined;
  const marker = "https://image.tmdb.org/t/p/";
  if (!url.startsWith(marker)) return url;
  const rest = url.slice(marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return url;
  return `${marker}${size}${rest.slice(slash)}`;
}

export const VIDEO_RATING_OPTIONS = [
  { value: 5, label: "😍 최고예요" },
  { value: 3, label: "🙂 볼만해요" },
  { value: 1, label: "😕 아쉬워요" },
];

export const BOOK_RATING_OPTIONS = [
  { value: 5, label: "📚 인생책" },
  { value: 3, label: "🙂 무난해요" },
  { value: 1, label: "😕 아쉬워요" },
];

export function ratingOptionsForType(type?: Title["type"]) {
  return type === "book" ? BOOK_RATING_OPTIONS : VIDEO_RATING_OPTIONS;
}

export function ratingDisplay(rating?: number | null, titleType?: Title["type"]) {
  if (typeof rating !== "number") return null;
  if (titleType === "book") {
    if (rating >= 5) return { emoji: "📚", label: "인생책", value: 5 };
    if (rating >= 3) return { emoji: "🙂", label: "무난해요", value: 3 };
    return { emoji: "😕", label: "아쉬워요", value: 1 };
  }
  if (rating >= 5) return { emoji: "😍", label: "나에게 최고", value: 5 };
  if (rating >= 3) return { emoji: "🙂", label: "그럭저럭", value: 3 };
  return { emoji: "😕", label: "나는 실망", value: 1 };
}
