import { ApiError, apiForSync, ensureAuthIds } from "./api";
import { db, type OutboxItem } from "./db";
import {
  findTitleByProvider,
  getDeviceId,
  getTitleLocal,
  getUserId,
  LOG_CACHE_CHECKPOINT_KEY,
  listOutbox,
  outboxLogId as logId,
  recordOutboxError,
  remapLogsForTitle,
  removeLogsByTitleExcept,
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

function getLastSyncAt(userId: string) {
  if (
    typeof localStorage === "undefined" ||
    localStorage.getItem("watchlog.lastSyncUserId") !== userId
  )
    return null;
  // Older clients could discard tombstones after their cursor had passed them.
  // Only a checkpoint produced by this cache format can resume incrementally.
  try {
    const checkpoint = JSON.parse(
      localStorage.getItem(LOG_CACHE_CHECKPOINT_KEY) ?? "null",
    );
    return checkpoint?.userId === userId && typeof checkpoint.since === "string"
      ? checkpoint.since
      : null;
  } catch {
    return null;
  }
}

function setLastSyncAt(userId: string, value: string) {
  if (typeof localStorage === "undefined" || getUserId() !== userId) return;
  localStorage.setItem("watchlog.lastSyncAt", value);
  localStorage.setItem("watchlog.lastSyncUserId", userId);
  localStorage.setItem(
    LOG_CACHE_CHECKPOINT_KEY,
    JSON.stringify({ userId, since: value }),
  );
}

type SyncIdentity = { userId: string; deviceId: string };
type PulledLog = Omit<WatchLog, "title"> & { titleId: string };
type PullResponse = {
  serverTime: string;
  changes: { logs: PulledLog[]; titles: Title[] };
};
type OutboxPayload = {
  log?: { id: string; op?: string; updatedAt?: string };
  title?: unknown;
  updatedAt?: string;
};

class AccountChanged extends Error {}

function requireAccount(auth: SyncIdentity) {
  if (getUserId() !== auth.userId || getDeviceId() !== auth.deviceId)
    throw new AccountChanged();
}

// Account switches during a Dexie await must roll back the entire local commit.
function accountTransaction<T>(auth: SyncIdentity, work: () => Promise<T>) {
  return db.transaction(
    "rw",
    db.titles,
    db.logs,
    db.history,
    db.outbox,
    async () => {
      requireAccount(auth);
      const result = await work();
      requireAccount(auth);
      return result;
    },
  );
}

function payload(item: OutboxItem) {
  return (item.payload ?? {}) as OutboxPayload;
}

function sameOperation(current: OutboxItem, sent: OutboxItem) {
  // Edits may replace a queued create in place, even within the same millisecond.
  return (
    current.id === sent.id &&
    current.type === sent.type &&
    logId(current) === logId(sent) &&
    current.userId === sent.userId &&
    JSON.stringify(current.payload) === JSON.stringify(sent.payload)
  );
}

// OffsetDateTime can include fractions finer than the browser's milliseconds.
const zonedTimestamp =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,9}))?(?:Z|[+-]\d{2}:\d{2})$/i;

function newerVersion(candidate?: string, previous?: string) {
  if (!candidate || !previous) return false;
  const left = zonedTimestamp.exec(candidate);
  const right = zonedTimestamp.exec(previous);
  if (!left || !right) return false;
  const epoch = Date.parse(candidate);
  const base = Date.parse(previous);
  if (epoch !== base) return epoch > base;
  const submillis = (fraction = "") => fraction.padEnd(9, "0").slice(3);
  return Number.isFinite(epoch) && submillis(left[1]) > submillis(right[1]);
}

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function pushItem(item: OutboxItem, auth: SyncIdentity) {
  requireAccount(auth);
  const { log, title } = payload(item);
  if (!log || log.id !== logId(item)) throw new SyncRejectedError();
  const res = await apiForSync<{
    accepted: string[];
    rejected: { id: string; reason: string }[];
  }>("/sync/push", auth, {
    method: "POST",
    body: JSON.stringify({
      userId: auth.userId,
      deviceId: auth.deviceId,
      clientTime: new Date().toISOString(),
      changes: { logs: [log], titles: title ? [title] : [] },
    }),
  });
  requireAccount(auth);
  const rejection = res.rejected?.find((row) => row.id === log.id);
  if (rejection?.reason === "stale") return "stale";
  if (rejection || !res.accepted?.includes(log.id))
    throw new SyncRejectedError();
  return "accepted";
}

function fetchChanges(auth: SyncIdentity, since: string | null) {
  requireAccount(auth);
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiForSync<PullResponse>(`/sync/pull${query}`, auth);
}

async function cacheLog(
  row: PulledLog,
  titles: Map<string, Title>,
  pendingIds: Set<string>,
  verifiedConflict = false,
) {
  if (pendingIds.has(row.id)) return;
  const existing = await db.logs.get(row.id);
  if (!verifiedConflict && existing?.syncStatus === "pending") return;
  if (
    existing?.syncStatus === "synced" &&
    newerVersion(existing.updatedAt, row.updatedAt)
  )
    return;
  // Lists omit deletedAt. Only a strictly newer sync change can restore this ID.
  if (
    existing?.deletedAt &&
    !row.deletedAt &&
    !newerVersion(row.updatedAt, existing.deletedAt)
  )
    return;
  const { titleId, ...fields } = row;
  const title =
    titles.get(titleId) ??
    (await getTitleLocal(titleId)) ??
    ({ id: titleId, type: "movie", name: "Unknown" } as Title);
  const log: WatchLog = {
    ...fields,
    title,
    origin: row.origin ?? "LOG",
    syncStatus: "synced",
  };
  // A targeted conflict read proves this ID only. The account pull can
  // reconcile siblings after it has applied their tombstones.
  if (!row.deletedAt && !verifiedConflict)
    await removeLogsByTitleExcept(titleId, row.id, pendingIds);
  if (verifiedConflict || row.deletedAt || existing?.deletedAt) {
    // Old installations may have bumped updatedAt just for a failed badge.
    // The checked wire operation supplies the version; keep local history intact.
    const updatedAt = row.updatedAt ?? row.deletedAt;
    if (!updatedAt) return;
    await upsertTitleLocal(title);
    await db.logs.put({ ...log, titleId, updatedAt });
  } else {
    await upsertLogLocal(log);
  }
}

async function pullChanges(auth: SyncIdentity) {
  const res = await fetchChanges(auth, getLastSyncAt(auth.userId));
  await accountTransaction(auth, async () => {
    const pending = new Set((await listOutbox()).map(logId));
    const titles = new Map<string, Title>();
    for (const title of res.changes.titles) {
      titles.set(title.id, title);
      if (title.provider && title.providerId) {
        const local = await findTitleByProvider(
          title.provider,
          title.providerId,
          title,
        );
        if (local && local.id !== title.id) {
          if (await remapLogsForTitle(local.id, title, pending))
            await removeTitleLocal(local.id);
        }
      }
      await upsertTitleLocal(title);
    }
    // A deleted server ID keeps its own history. Mark it before an active
    // sibling can be mistaken for a temporary local ID to merge.
    for (const log of res.changes.logs) {
      if (log.deletedAt) await cacheLog(log, titles, pending);
    }
    for (const log of res.changes.logs) {
      if (!log.deletedAt) await cacheLog(log, titles, pending);
    }
  });
  requireAccount(auth);
  if (res.serverTime) setLastSyncAt(auth.userId, res.serverTime);
}

async function finishAccepted(auth: SyncIdentity, sent: OutboxItem) {
  await accountTransaction(auth, async () => {
    const current = await db.outbox.get(sent.id);
    if (!current) return;
    if (!sameOperation(current, sent)) {
      syncRequested = true;
      return;
    }
    await db.outbox.delete(sent.id);
    if (
      !(await db.outbox.filter((row) => logId(row) === logId(sent)).first())
    ) {
      await setLogSyncStatus(logId(sent), "synced");
    }
  });
}

async function reconcileStale(
  auth: SyncIdentity,
  sent: OutboxItem,
  snapshot: Map<string, OutboxItem>,
) {
  const version = payload(sent).log?.updatedAt;
  if (
    !version ||
    !zonedTimestamp.test(version) ||
    !Number.isFinite(Date.parse(version))
  )
    return false;
  // A regular checkpoint may already be beyond this change. Ask from the
  // rejected wire version so the account's strictly newer row is eligible.
  const res = await fetchChanges(auth, version);
  requireAccount(auth);
  if (isOffline()) throw new Error("Offline during conflict recovery");
  const server = res.changes.logs.find((row) => row.id === logId(sent));
  if (
    !server?.updatedAt ||
    !server.titleId ||
    !server.createdAt ||
    !server.watchedAt ||
    !server.status ||
    !newerVersion(server.updatedAt, version)
  )
    return false;
  const serverVersion = server.updatedAt;
  await accountTransaction(auth, async () => {
    const current = await db.outbox.get(sent.id);
    if (
      !current ||
      current.userId !== auth.userId ||
      logId(current) !== logId(sent)
    )
      return;
    if (sameOperation(current, sent) && current.phase !== "followup")
      await db.outbox.delete(sent.id);
    const pending = await listOutbox();
    const sameLog = pending.filter((row) => logId(row) === server.id);
    if (sameLog.length) {
      // Preserve edits saved while waiting, including an in-place create edit.
      // A skewed device clock may need a successor to the observed server version.
      let floor = serverVersion;
      let rebased = false;
      for (const edit of sameLog) {
        const prior = snapshot.get(edit.id);
        const change = payload(edit).log;
        if (
          edit.userId !== auth.userId ||
          !change?.updatedAt ||
          change.id !== server.id
        )
          continue;
        if (prior && sameOperation(prior, edit) && edit.phase !== "followup") {
          if (newerVersion(change.updatedAt, floor)) floor = change.updatedAt;
          continue;
        }
        if (!newerVersion(change.updatedAt, floor)) {
          const updatedAt = new Date(Date.parse(floor) + 1).toISOString();
          const next = { ...payload(edit), log: { ...change, updatedAt } };
          if (edit.type === "create_log") next.updatedAt = updatedAt;
          await db.outbox.update(edit.id, { payload: next, phase: undefined });
          floor = updatedAt;
          rebased = true;
        } else {
          floor = change.updatedAt;
          await db.outbox.update(edit.id, { phase: undefined });
        }
        syncRequested = true;
      }
      if (rebased) await db.logs.update(server.id, { updatedAt: floor });
      return;
    }
    const titles = new Map(
      res.changes.titles.map((title) => [title.id, title]),
    );
    await cacheLog(server, titles, new Set(pending.map(logId)), true);
  });
  return true;
}

async function markAttemptFailed(
  auth: SyncIdentity,
  sent: OutboxItem,
  message: string,
) {
  await accountTransaction(auth, async () => {
    const current = await db.outbox.get(sent.id);
    if (!current || !sameOperation(current, sent)) return;
    if (current.phase === "sending")
      await db.outbox.update(sent.id, { phase: undefined });
    await recordOutboxError(sent.id, message);
    if (
      !(await db.outbox
        .filter((row) => row.id !== sent.id && logId(row) === logId(sent))
        .first())
    )
      await setLogSyncStatus(logId(sent), "failed");
  });
}

async function syncAccount(auth: SyncIdentity): Promise<SyncState> {
  const items = await accountTransaction(auth, async () => {
    const rows = await listOutbox();
    for (const row of rows) {
      if (!row.userId) {
        // Existing v2/v3 rows have no ownership field. Bind before the first request.
        row.userId =
          localStorage.getItem("watchlog.lastSyncUserId") ?? auth.userId;
        await db.outbox.update(row.id, { userId: row.userId });
      }
    }
    return rows.filter((row) => row.userId === auth.userId);
  });
  const snapshot = new Map(items.map((item) => [item.id, item]));
  const unverified = new Set<string>();
  let failure: SyncState["failure"] = null;
  for (const queued of items) {
    if (unverified.has(logId(queued))) continue;
    const item = await accountTransaction(auth, async () => {
      const row = await db.outbox.get(queued.id);
      if (!row || row.userId !== auth.userId) return;
      // Another tab can save an edit before the push or its conflict read returns.
      if (!row.phase) await db.outbox.update(row.id, { phase: "sending" });
      return row;
    });
    if (!item) continue;
    let checkingStale = false;
    try {
      const result = await pushItem(item, auth);
      if (result === "stale") {
        checkingStale = true;
        if (!(await reconcileStale(auth, item, snapshot))) {
          unverified.add(logId(item));
          throw new SyncRejectedError();
        }
      } else {
        await finishAccepted(auth, item);
      }
      emitSyncUpdate();
    } catch (error) {
      if (error instanceof AccountChanged) throw error;
      if (isOffline()) return { status: "offline", failure: null };
      await markAttemptFailed(
        auth,
        item,
        error instanceof Error ? error.message : "Sync failed",
      );
      if (error instanceof SyncRejectedError) {
        failure = "rejected";
        if (unverified.has(logId(item))) continue;
      } else {
        failure = "request";
        if (
          checkingStale ||
          (error instanceof ApiError && error.status === 401)
        )
          return { status: "failed", failure };
      }
      break;
    }
  }
  await pullChanges(auth);
  emitSyncUpdate();
  return failure ? { status: "failed", failure } : IDLE_SYNC_STATE;
}

async function runSyncCycle(): Promise<SyncState> {
  if (isOffline()) return { status: "offline", failure: null };
  if (!getUserId() && !(await db.outbox.count())) return IDLE_SYNC_STATE;

  let auth: Awaited<ReturnType<typeof ensureAuthIds>>;
  try {
    auth = await ensureAuthIds({ register: true });
  } catch {
    return { status: "failed", failure: "auth" };
  }
  if (!auth.userId || !auth.deviceId)
    return { status: "failed", failure: "auth" };
  try {
    return await syncAccount({ userId: auth.userId, deviceId: auth.deviceId });
  } catch (error) {
    if (!(error instanceof AccountChanged)) throw error;
    syncRequested = true;
    return IDLE_SYNC_STATE;
  }
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
        if (outcome.status !== "idle" && outcome.failure !== "rejected") break;
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
