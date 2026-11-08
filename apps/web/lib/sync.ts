import { apiWithAuth, ensureAuthIds } from "./api";
import type { OutboxItem } from "./db";
import {
  findTitleByProvider,
  getTitleLocal,
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
import type { Title, WatchLog } from "./types";

let syncPromise: Promise<void> | null = null;
let syncRequested = false;

export type SyncState = Readonly<{
  status: "idle" | "syncing" | "offline" | "failed";
  failure: null | "auth" | "request" | "rejected";
}>;

export const IDLE_SYNC_STATE: SyncState = Object.freeze({
  status: "idle",
  failure: null,
});

let syncState: SyncState = IDLE_SYNC_STATE;
const syncListeners = new Set<() => void>();

export function getSyncState(): SyncState {
  return syncState;
}

export function subscribeSyncState(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

function setSyncState(next: SyncState) {
  if (syncState.status === next.status && syncState.failure === next.failure)
    return;
  syncState = next.status === "idle" ? IDLE_SYNC_STATE : Object.freeze(next);
  for (const listener of syncListeners) {
    try {
      listener();
    } catch (error) {
      // Observers must not interrupt storage or network work.
      console.error("[Sync] State listener failed:", error);
    }
  }
}

class SyncRejectedError extends Error {
  constructor() {
    super("Sync rejected");
  }
}

function emitSyncUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sync:updated"));
}

function getUserId() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("watchlog.userId");
}

function getLastSyncAt(userId: string) {
  if (
    typeof localStorage === "undefined" ||
    localStorage.getItem("watchlog.lastSyncUserId") !== userId
  )
    return null;
  // An unowned legacy checkpoint also needs one full pull after upgrading.
  return localStorage.getItem("watchlog.lastSyncAt");
}

function setLastSyncAt(userId: string, value: string) {
  if (typeof localStorage === "undefined" || getUserId() !== userId) return;
  localStorage.setItem("watchlog.lastSyncAt", value);
  localStorage.setItem("watchlog.lastSyncUserId", userId);
}

type SyncAuthIds = {
  userId: string | null;
  deviceId: string | null;
};

async function pushItem(item: OutboxItem, auth: SyncAuthIds) {
  const payload = item.payload as any;
  const changes = {
    logs: payload?.log ? [payload.log] : [],
    titles: payload?.title ? [payload.title] : [],
  };

  const res = await apiWithAuth<{
    accepted: string[];
    rejected: { id: string; reason: string }[];
  }>("/sync/push", {
    method: "POST",
    body: JSON.stringify({
      userId: auth.userId,
      deviceId: auth.deviceId,
      clientTime: new Date().toISOString(),
      changes,
    }),
  });

  const rejectedIds = new Set((res.rejected ?? []).map((r) => r.id));
  const logId = payload?.log?.id;
  if (logId && rejectedIds.has(logId)) {
    throw new SyncRejectedError();
  }
}

async function pullChanges() {
  const userId = getUserId();
  if (!userId) return;
  const last = getLastSyncAt(userId);
  const query = last ? `?since=${encodeURIComponent(last)}` : "";
  const res = await apiWithAuth<{
    serverTime: string;
    changes: { logs: any[]; titles: any[] };
  }>(`/sync/pull${query}`);

  // Pairing may finish while an older account's request is still in flight.
  if (getUserId() !== userId) {
    syncRequested = true;
    return;
  }

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
        const local = await findTitleByProvider(
          title.provider,
          title.providerId,
          title,
        );
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

  if (getUserId() !== userId) {
    syncRequested = true;
    return;
  }
  if (res.serverTime) setLastSyncAt(userId, res.serverTime);
}

async function runSyncCycle(): Promise<SyncState> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { status: "offline", failure: null };

  const items = await listOutbox();
  const hasStoredUser = !!getUserId();
  if (items.length === 0 && !hasStoredUser) return IDLE_SYNC_STATE;

  let auth: SyncAuthIds;
  try {
    auth = await ensureAuthIds({
      register: items.length > 0 || hasStoredUser,
    });
  } catch (e) {
    console.error("[Sync] Authentication failed during sync:", e);
    return { status: "failed", failure: "auth" };
  }

  if (!auth.userId || !auth.deviceId)
    return { status: "failed", failure: "auth" };

  let pushFailure: SyncState["failure"] = null;
  for (const item of items) {
    try {
      await pushItem(item, auth);
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
      pushFailure = e instanceof SyncRejectedError ? "rejected" : "request";
      break;
    }
  }
  await pullChanges();
  emitSyncUpdate();
  return pushFailure
    ? { status: "failed", failure: pushFailure }
    : IDLE_SYNC_STATE;
}

export function syncOutbox(): Promise<void> {
  syncRequested = true;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    let outcome = IDLE_SYNC_STATE;
    try {
      do {
        syncRequested = false;
        // A concurrent caller may have queued work after this cycle's snapshot.
        // Keep every caller waiting through that work and its canonical pull.
        outcome = await runSyncCycle();
        if (outcome.status !== "idle") break;
      } while (syncRequested);
    } catch (error) {
      outcome = { status: "failed", failure: "request" };
      throw error;
    } finally {
      // Failed/offline work remains queued for the next explicit sync request.
      syncPromise = null;
      syncRequested = false;
      setSyncState(outcome);
    }
  })();
  // Assign the shared promise before notifying subscribers that work has begun.
  setSyncState({ status: "syncing", failure: null });
  return syncPromise;
}
