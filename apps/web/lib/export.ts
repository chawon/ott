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

export function getCsvColumns(t: any): { key: keyof TimelineExportRow; label: string }[] {
  return [
    { key: "watchedAt", label: t("date") },
    { key: "type", label: t("category") },
    { key: "title", label: t("title") },
    { key: "status", label: t("status") },
    { key: "rating", label: t("rating") },
    { key: "place", label: t("place") },
    { key: "occasion", label: t("occasion") },
    { key: "ott_or_platform", label: t("platform") },
    { key: "note", label: t("note") },
  ];
}

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
  return `"${value.replace(/"/g, '""')}"`;
}

function typeLabel(type?: WatchLog["title"]["type"], tQuick?: any) {
  if (type === "movie") return tQuick ? tQuick("typeMovie") : "Movie";
  if (type === "series") return tQuick ? tQuick("typeSeriesModern") : "Series";
  if (type === "book") return tQuick ? tQuick("typeBook") : "Book";
  return "";
}

export function buildExportRows(
  logs: WatchLog[],
  tStatus?: any,
  tCommon?: any,
  tQuick?: any,
): TimelineExportRow[] {
  return logs.map((log) => {
    const title = log.title;
    return {
      watchedAt: formatDateOnly(log.watchedAt),
      title: title?.name ?? "",
      type: typeLabel(title?.type, tQuick),
      status: log.status ? statusLabel(log.status, title?.type, tStatus) : "",
      rating:
        log.rating === null || log.rating === undefined
          ? ""
          : String(log.rating),
      note: log.note ?? "",
      place: log.place
        ? placeLabel(log.place, tCommon ? (k: any) => tCommon("placeLabels." + k) : undefined)
        : "",
      occasion: log.occasion
        ? occasionLabel(log.occasion, tCommon ? (k: any) => tCommon("occasionLabels." + k) : undefined)
        : "",
      ott_or_platform: log.ott ?? "",
    };
  });
}

export function rowsToCsv(rows: TimelineExportRow[], tCsv: any) {
  const columns = getCsvColumns(tCsv);
  const header = columns.map((col) => col.label).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsv(String(row[col.key] ?? ""))).join(","),
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

export function downloadTimelineCsv(
  logs: WatchLog[],
  filename: string,
  tCsv: any,
  tStatus: any,
  tCommon: any,
  tQuick: any,
) {
  const rows = buildExportRows(logs, tStatus, tCommon, tQuick);
  const csv = rowsToCsv(rows, tCsv);
  downloadCsv(csv, filename);
}
