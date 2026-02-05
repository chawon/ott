import { WatchLog } from "./types";
import { occasionLabel, placeLabel, statusLabel } from "./utils";

export type TimelineExportRow = {
  watchedAt: string;
  title: string;
  type: string;
  status: string;
  rating: string;
  note: string;
  place: string;
  occasion: string;
  ott_or_platform: string;
};

const CSV_COLUMNS: { key: keyof TimelineExportRow; label: string }[] = [
  { key: "watchedAt", label: "날짜" },
  { key: "type", label: "구분" },
  { key: "title", label: "제목" },
  { key: "status", label: "상태" },
  { key: "rating", label: "평점" },
  { key: "place", label: "장소" },
  { key: "occasion", label: "누구와" },
  { key: "ott_or_platform", label: "플랫폼" },
  { key: "note", label: "메모" },
];

function formatDateOnly(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeCsv(value: string) {
  const needsQuote = /[",\n\r]/.test(value);
  if (!needsQuote) return value;
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function typeLabel(type?: WatchLog["title"]["type"]) {
  if (type === "movie") return "영화";
  if (type === "series") return "시리즈";
  if (type === "book") return "책";
  return "";
}

export function buildExportRows(logs: WatchLog[]): TimelineExportRow[] {
  return logs.map((log) => {
    const title = log.title;
    return {
      watchedAt: formatDateOnly(log.watchedAt),
      title: title?.name ?? "",
      type: typeLabel(title?.type),
      status: log.status ? statusLabel(log.status, title?.type) : "",
      rating: log.rating === null || log.rating === undefined ? "" : String(log.rating),
      note: log.note ?? "",
      place: log.place ? placeLabel(log.place) : "",
      occasion: log.occasion ? occasionLabel(log.occasion) : "",
      ott_or_platform: log.ott ?? "",
    };
  });
}

export function rowsToCsv(rows: TimelineExportRow[]) {
  const header = CSV_COLUMNS.map((col) => col.label).join(",");
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((col) => escapeCsv(String(row[col.key] ?? ""))).join(",")
  );
  return [header, ...lines].join("\r\n");
}

export function downloadCsv(content: string, filename: string) {
  if (typeof document === "undefined") return;
  const bom = "\ufeff";
  const blob = new Blob([bom, content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTimelineCsv(logs: WatchLog[], filename: string) {
  const rows = buildExportRows(logs);
  const csv = rowsToCsv(rows);
  downloadCsv(csv, filename);
}
