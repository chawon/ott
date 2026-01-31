import { api, ensureAuthIds } from "./api";
import {
  getTitleLocal,
  findTitleByProvider,
  listOutbox,
  markLogDeleted,
  recordOutboxError,
  remapLogsForTitle,
  removeLogsByTitleExcept,
  removeOutboxItem,
  removeTitleLocal,
  setLogSyncStatus,
  upsertLogLocal,
  upsertTitleLocal,
} from "./localStore";
import { OutboxItem } from "./db";
import { Title, WatchLog } from "./types";
import { safeUUID } from "./utils";

let syncing = false;

function emitSyncUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sync:updated"));
}

function getDeviceId() {
  if (typeof localStorage === "undefined") return safeUUID();
  const key = "watchlog.deviceId";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = safeUUID();
  localStorage.setItem(key, next);
  return next;
}

function getUserId() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("watchlog.userId");
}

function getLastSyncAt() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("watchlog.lastSyncAt");
}

function setLastSyncAt(value: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("watchlog.lastSyncAt", value);
}

async function pushItem(item: OutboxItem) {
  const payload = item.payload as any;
  const changes = {
    logs: payload?.log ? [payload.log] : [],
    titles: payload?.title ? [payload.title] : [],
  };
  const auth = await ensureAuthIds();

  const res = await api<{ accepted: string[]; rejected: { id: string; reason: string }[] }>(
    "/sync/push",
    {
      method: "POST",
      body: JSON.stringify({
        userId: auth.userId ?? getUserId(),
        deviceId: auth.deviceId ?? getDeviceId(),
        clientTime: new Date().toISOString(),
        changes,
      }),
    }
  );

  const rejectedIds = new Set((res.rejected ?? []).map((r) => r.id));
  const logId = payload?.log?.id;
  if (logId && rejectedIds.has(logId)) {
    throw new Error("Sync rejected");
  }
}

async function pullChanges() {
  const last = getLastSyncAt();
  const query = last ? `?since=${encodeURIComponent(last)}` : "";
  const res = await api<{
    serverTime: string;
    changes: { logs: any[]; titles: any[] };
  }>(`/sync/pull${query}`);

  const titleMap = new Map<string, Title>();
  if (res.changes?.titles?.length) {
    for (const t of res.changes.titles) {
      const title: Title = {
        id: t.id,
        type: t.type,
        name: t.name,
        year: t.year ?? null,
        genres: t.genres ?? null,
        directors: t.directors ?? null,
        cast: t.cast ?? null,
        overview: t.overview ?? null,
        posterUrl: t.posterUrl ?? null,
        author: t.author ?? null,
        publisher: t.publisher ?? null,
        isbn10: t.isbn10 ?? null,
        isbn13: t.isbn13 ?? null,
        pubdate: t.pubdate ?? null,
        provider: t.provider ?? undefined,
        providerId: t.providerId ?? undefined,
        updatedAt: t.updatedAt ?? undefined,
        deletedAt: t.deletedAt ?? null,
      };
      titleMap.set(title.id, title);
      if (title.provider && title.providerId) {
        const local = await findTitleByProvider(title.provider, title.providerId);
        if (local && local.id !== title.id) {
          await remapLogsForTitle(local.id, title);
          await removeTitleLocal(local.id);
        }
      }
      await upsertTitleLocal(title);
    }
  }

  if (res.changes?.logs?.length) {
    for (const l of res.changes.logs) {
      if (l.deletedAt) {
        await markLogDeleted(l.id, l.deletedAt, l.updatedAt);
        continue;
      }
      const title =
        titleMap.get(l.titleId) ??
        (await getTitleLocal(l.titleId)) ??
        ({
          id: l.titleId,
          type: "movie",
          name: "Unknown",
        } as Title);

      const log: WatchLog = {
        id: l.id,
        title,
        status: l.status,
        rating: l.rating ?? null,
        note: l.note ?? null,
        spoiler: l.spoiler ?? false,
        ott: l.ott ?? null,
        seasonNumber: l.seasonNumber ?? null,
        episodeNumber: l.episodeNumber ?? null,
        seasonPosterUrl: l.seasonPosterUrl ?? null,
        seasonYear: l.seasonYear ?? null,
        origin: l.origin ?? "LOG",
        watchedAt: l.watchedAt,
        place: l.place ?? null,
        occasion: l.occasion ?? null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt ?? undefined,
        deletedAt: l.deletedAt ?? null,
        syncStatus: "synced",
      };
      await removeLogsByTitleExcept(l.titleId, l.id);
      await upsertLogLocal(log);
    }
  }

  if (res.serverTime) setLastSyncAt(res.serverTime);
}

export async function syncOutbox() {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  syncing = true;
  try {
    const items = await listOutbox();
    for (const item of items) {
      try {
        await pushItem(item);
        await removeOutboxItem(item.id);
        if (item.type === "create_log") {
          await setLogSyncStatus(item.localLogId, "synced");
        } else {
          await setLogSyncStatus(item.logId, "synced");
        }
        emitSyncUpdate();
      } catch (e: any) {
        await recordOutboxError(item.id, e?.message ?? "Sync failed");
        if (item.type === "create_log") {
          await setLogSyncStatus(item.localLogId, "failed");
        } else {
          await setLogSyncStatus(item.logId, "failed");
        }
        break;
      }
    }
    await pullChanges();
    emitSyncUpdate();
  } finally {
    syncing = false;
  }
}
