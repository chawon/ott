import type { WatchLog } from "./types";

export type NetflixImportRow = {
  rawTitle: string;
  workTitle: string;
  viewedOn: string;
  occurrence: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  linkedTitleId: string | null;
  sourceKey: string;
};

export type NetflixViewingEvent = NetflixImportRow & {
  id?: string;
  syncStatus?: "pending" | "synced" | "failed";
};

type ParsedRow = Omit<NetflixImportRow, "sourceKey" | "linkedTitleId">;

export function normalizeNetflixTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function csvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell === "") {
        quoted = !quoted;
      } else {
        throw new Error("Invalid CSV quotation");
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quotation");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseDate(value: string, currentYear: number): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid Netflix date: ${value}`);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const yearValue = Number(match[3]);
  const year =
    match[3].length === 4
      ? yearValue
      : yearValue <= (currentYear % 100) + 1
        ? 2000 + yearValue
        : 1900 + yearValue;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1997 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid Netflix date: ${value}`);
  }
  const viewedOn = parsed.toISOString().slice(0, 10);
  // Match the API's KST-tomorrow upper bound before an offline row enters the outbox.
  const latestAllowed = new Date(Date.now() + 33 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (viewedOn > latestAllowed) {
    throw new Error(`Invalid Netflix date: ${value}`);
  }
  return viewedOn;
}

function titleParts(rawTitle: string) {
  const season = /(?:시즌|season)\s*(\d+)/i.exec(rawTitle);
  const episode =
    /(?:에피소드|episode)\s*(\d+)|제\s*(\d+)\s*화|(\d+)\s*화/i.exec(rawTitle);
  const marker = Boolean(season || episode);
  const prefix = rawTitle.split(":", 1)[0]?.trim() || rawTitle;
  return {
    workTitle: marker && rawTitle.includes(":") ? prefix : rawTitle,
    seasonNumber: season ? Number(season[1]) : null,
    episodeNumber: episode
      ? Number(episode[1] ?? episode[2] ?? episode[3])
      : null,
  };
}

export function parseNetflixHistoryCsv(
  text: string,
  currentYear = new Date().getFullYear(),
): ParsedRow[] {
  const matrix = csvCells(text.replace(/^\uFEFF/, ""));
  if (
    matrix.length < 2 ||
    matrix[0].length !== 2 ||
    matrix[0][0].trim().toLowerCase() !== "title" ||
    matrix[0][1].trim().toLowerCase() !== "date"
  ) {
    throw new Error("Expected Netflix Title,Date CSV");
  }
  if (matrix.length > 10_001) throw new Error("Netflix CSV has too many rows");

  const occurrences = new Map<string, number>();
  return matrix.slice(1).map((cells, index) => {
    if (cells.length !== 2) throw new Error(`Invalid CSV row ${index + 2}`);
    const rawTitle = cells[0].trim();
    if (!rawTitle || rawTitle.length > 500)
      throw new Error(`Invalid title on row ${index + 2}`);
    const viewedOn = parseDate(cells[1], currentYear);
    const { workTitle, seasonNumber, episodeNumber } = titleParts(rawTitle);
    if (workTitle.length > 255)
      throw new Error(`Invalid work title on row ${index + 2}`);
    const occurrenceKey = `${rawTitle}\n${viewedOn}`;
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    return {
      rawTitle,
      workTitle,
      viewedOn,
      occurrence,
      seasonNumber,
      episodeNumber,
    };
  });
}

export function matchNetflixTitle(
  row: ParsedRow,
  logs: WatchLog[],
): string | null {
  const videoLogs = logs.filter(
    (log) => !log.deletedAt && log.title.type !== "book",
  );
  const full = normalizeNetflixTitle(row.rawTitle);
  const exact = videoLogs.filter(
    (log) => normalizeNetflixTitle(log.title.name) === full,
  );
  if (exact.length === 1) return exact[0].title.id;
  if (exact.length > 1 || row.workTitle === row.rawTitle) return null;

  const parent = normalizeNetflixTitle(row.workTitle);
  const series = videoLogs.filter(
    (log) =>
      log.title.type === "series" &&
      normalizeNetflixTitle(log.title.name) === parent,
  );
  return series.length === 1 ? series[0].title.id : null;
}

export async function prepareNetflixImportRows(
  parsed: ParsedRow[],
  logs: WatchLog[],
): Promise<NetflixImportRow[]> {
  const encoder = new TextEncoder();
  return Promise.all(
    parsed.map(async (row) => {
      const keyText = `${row.rawTitle}\n${row.viewedOn}\n${row.occurrence}`;
      const digest = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(keyText),
      );
      const sourceKey = Array.from(new Uint8Array(digest), (part) =>
        part.toString(16).padStart(2, "0"),
      ).join("");
      return { ...row, sourceKey, linkedTitleId: matchNetflixTitle(row, logs) };
    }),
  );
}
