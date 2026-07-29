import { api } from "./api";
import { normalizeBookIsbn13 } from "./bookshelf";
import { db, type LocalBookClassification } from "./db";
import type { BookClassification, Title, WatchLog } from "./types";

const NOT_FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESOLVE_BATCH_SIZE = 50;

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function isFresh(classification: BookClassification, now = Date.now()) {
  if (classification.status === "RESOLVED") return true;
  const fetchedAt = Date.parse(classification.fetchedAt);
  return Number.isFinite(fetchedAt) && now - fetchedAt < NOT_FOUND_TTL_MS;
}

export async function getCachedBookClassifications(isbn13s: string[]) {
  const normalized = unique(isbn13s);
  if (normalized.length === 0) return [];
  const items = await db.bookClassifications.bulkGet(normalized);
  return items.filter((item): item is LocalBookClassification => Boolean(item));
}

export async function getCachedClassificationsForLogs(logs: WatchLog[]) {
  return getCachedBookClassifications(
    logs.map((log) => normalizeBookIsbn13(log.title) ?? ""),
  );
}

export async function resolveBookClassifications(
  isbn13s: string[],
  options?: { forceNotFound?: boolean },
) {
  const normalized = unique(isbn13s);
  if (normalized.length === 0) return [];

  const cached = await getCachedBookClassifications(normalized);
  const cachedByIsbn = new Map(cached.map((item) => [item.isbn13, item]));
  const missing = normalized.filter((isbn13) => {
    const item = cachedByIsbn.get(isbn13);
    if (!item) return true;
    if (options?.forceNotFound && item.status === "NOT_FOUND") return true;
    return !isFresh(item);
  });

  if (
    missing.length === 0 ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  ) {
    return cached;
  }

  const resolved: LocalBookClassification[] = [];
  let lastError: unknown = null;
  for (let index = 0; index < missing.length; index += RESOLVE_BATCH_SIZE) {
    const batch = missing.slice(index, index + RESOLVE_BATCH_SIZE);
    try {
      const response = await api<{ items: BookClassification[] }>(
        "/titles/book-classifications/resolve",
        {
          method: "POST",
          body: JSON.stringify({ isbn13s: batch }),
        },
      );
      const items = (response.items ?? []).map(
        (item): LocalBookClassification => ({
          ...item,
          source: "DATA4LIBRARY",
        }),
      );
      if (items.length > 0) {
        await db.bookClassifications.bulkPut(items);
        resolved.push(...items);
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (resolved.length > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookshelf:updated"));
  }
  if (lastError && resolved.length === 0) {
    throw lastError;
  }
  return getCachedBookClassifications(normalized);
}

export async function resolveTitleClassification(title: Title) {
  const isbn13 = normalizeBookIsbn13(title);
  if (!isbn13) return null;
  const items = await resolveBookClassifications([isbn13]);
  return items.find((item) => item.isbn13 === isbn13) ?? null;
}
