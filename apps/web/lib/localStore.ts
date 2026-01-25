import { db, LocalWatchLog, OutboxItem } from "./db";
import { Title, WatchLog, WatchLogHistory } from "./types";
import { safeUUID } from "./utils";

function nowIso() {
  return new Date().toISOString();
}

export async function upsertTitleLocal(title: Title) {
  await db.titles.put({
    ...title,
    updatedAt: title.updatedAt ?? nowIso(),
  });
}

export async function upsertLogLocal(log: WatchLog) {
  await upsertTitleLocal(log.title);
  const existing = await db.logs.get(log.id);
  if (existing) {
    if (existing.deletedAt && !log.deletedAt) return;
    if (existing.updatedAt && log.updatedAt && new Date(existing.updatedAt) > new Date(log.updatedAt)) return;
  }
  const local: LocalWatchLog = {
    ...log,
    titleId: log.title.id,
    updatedAt: log.updatedAt ?? nowIso(),
  };
  await db.logs.put(local);
}

export async function upsertLogsLocal(logs: WatchLog[]) {
  if (logs.length === 0) return;
  await db.titles.bulkPut(
    logs.map((l) => ({
      ...l.title,
      updatedAt: l.title.updatedAt ?? nowIso(),
    }))
  );
  const existingLogs = await db.logs.bulkGet(logs.map((l) => l.id));
  const existingMap = new Map(existingLogs.filter((l): l is LocalWatchLog => !!l).map((l) => [l.id, l]));

  const toPut: LocalWatchLog[] = [];
  for (const log of logs) {
    const existing = existingMap.get(log.id);
    if (existing) {
      if (existing.deletedAt && !log.deletedAt) continue;
      const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const incomingTime = log.updatedAt ? new Date(log.updatedAt).getTime() : 0;
      if (localTime > incomingTime) continue;
    }
    toPut.push({
      ...log,
      syncStatus: log.syncStatus ?? "synced",
      titleId: log.title.id,
      updatedAt: log.updatedAt ?? nowIso(),
    });
  }
  if (toPut.length > 0) await db.logs.bulkPut(toPut);
}

export async function upsertHistoryLocal(items: WatchLogHistory[]) {
  if (items.length === 0) return;
  await db.history.bulkPut(items);
}

export async function listLogsLocal(params: {
  limit: number;
  status?: WatchLog["status"];
  origin?: WatchLog["origin"];
  ott?: string;
  place?: WatchLog["place"];
  occasion?: WatchLog["occasion"];
}) {
  const { limit, status, origin, ott, place, occasion } = params;
  const ottList = ott && ott.includes(",")
    ? ott.split(",").map((v) => v.trim()).filter(Boolean)
    : null;
  let coll = db.logs.orderBy("watchedAt").reverse();
  coll = coll.filter((l) => {
    if (l.deletedAt) return false;
    if (status && l.status !== status) return false;
    if (origin && l.origin !== origin) return false;
    if (place && l.place !== place) return false;
    if (occasion && l.occasion !== occasion) return false;
    if (ottList) {
      if (!l.ott) return false;
      const v = l.ott.toLowerCase();
      if (!ottList.some((o) => v.includes(o.toLowerCase()))) return false;
    } else if (ott) {
      if (l.ott && !l.ott.toLowerCase().includes(ott.toLowerCase())) return false;
      if (!l.ott) return false;
    }
    return true;
  });
  return coll.limit(limit).toArray();
}

export async function getTitleLocal(id: string) {
  return db.titles.get(id);
}

export async function removeTitleLocal(id: string) {
  await db.titles.delete(id);
}

export async function listLogsByTitleLocal(titleId: string, limit: number) {
  const items = await db.logs.where("titleId").equals(titleId).reverse().limit(limit).toArray();
  return items.filter((l) => !l.deletedAt);
}

export async function listHistoryLocal(logId: string, limit: number) {
  const items = await db.history.where("logId").equals(logId).toArray();
  return items
    .sort((a, b) => {
      const aTime = new Date(a.recordedAt).getTime();
      const bTime = new Date(b.recordedAt).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
}

export async function updateLogLocal(id: string, updates: Partial<WatchLog>) {
  const existing = await db.logs.get(id);
  if (!existing) return;
  const merged: LocalWatchLog = {
    ...existing,
    ...updates,
    title: updates.title ?? existing.title,
    titleId: updates.title ? updates.title.id : existing.titleId,
    updatedAt: nowIso(),
  };
  await db.logs.put(merged);
}

export async function setLogSyncStatus(id: string, status: WatchLog["syncStatus"]) {
  await db.logs.update(id, { syncStatus: status, updatedAt: nowIso() });
}

export async function removeLogLocal(id: string) {
  await db.logs.delete(id);
}

export async function markLogDeleted(id: string, deletedAt?: string, updatedAt?: string) {
  const item = await db.logs.get(id);
  if (!item) return;
  await db.logs.put({
    ...item,
    deletedAt: deletedAt ?? nowIso(),
    updatedAt: updatedAt ?? nowIso(),
  });
}

export async function enqueueDeleteLog(logId: string, deletedAt?: string, updatedAt?: string) {
  const item: OutboxItem = {
    id: safeUUID(),
    type: "delete_log",
    logId,
    payload: {
      log: {
        id: logId,
        op: "delete",
        deletedAt: deletedAt ?? nowIso(),
        updatedAt: updatedAt ?? nowIso(),
      },
    },
    createdAt: nowIso(),
    attempts: 0,
    lastError: null,
  };
  await db.outbox.put(item);
}

export async function deleteLog(id: string) {
  const now = nowIso();
  await markLogDeleted(id, now, now);
  await enqueueDeleteLog(id, now, now);
}

export async function removeLogsByTitleExcept(titleId: string, keepId: string) {
  const logs = await db.logs.where("titleId").equals(titleId).toArray();
  const ids = logs.filter((l) => l.id !== keepId).map((l) => l.id);
  if (ids.length) await db.logs.bulkDelete(ids);
}

export function getUserId() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("watchlog.userId");
}

export function setUserId(userId: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("watchlog.userId", userId);
}

export function getDeviceId() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("watchlog.deviceId");
}

export function setDeviceId(deviceId: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("watchlog.deviceId", deviceId);
}

export function getPairingCode() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("watchlog.pairingCode");
}

export function setPairingCode(code: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("watchlog.pairingCode", code);
}

export async function resetLocalState() {
  await db.transaction("rw", db.titles, db.logs, db.history, db.outbox, async () => {
    await db.titles.clear();
    await db.logs.clear();
    await db.history.clear();
    await db.outbox.clear();
  });
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("watchlog.userId");
  localStorage.removeItem("watchlog.deviceId");
  localStorage.removeItem("watchlog.pairingCode");
  localStorage.removeItem("watchlog.lastSyncAt");
}

export async function findTitleByProvider(provider: string, providerId: string) {
  return db.titles
    .where("provider")
    .equals(provider)
    .and((t) => t.providerId === providerId)
    .first();
}

export async function remapLogsForTitle(oldTitleId: string, nextTitle: Title) {
  const logs = await db.logs.where("titleId").equals(oldTitleId).toArray();
  if (logs.length === 0) return;
  const updated = logs.map((l) => ({
    ...l,
    titleId: nextTitle.id,
    title: nextTitle,
    updatedAt: nowIso(),
  }));
  await db.logs.bulkPut(updated);
}

export async function enqueueCreateLog(payload: {
  logId: string;
  titleId: string;
  updatedAt: string;
  log: Record<string, unknown>;
  title?: Record<string, unknown>;
}) {
  const item: OutboxItem = {
    id: safeUUID(),
    type: "create_log",
    localLogId: payload.logId,
    payload,
    createdAt: nowIso(),
    attempts: 0,
    lastError: null,
  };
  await db.outbox.put(item);
}

export async function enqueueUpdateLog(logId: string, payload: Record<string, unknown>) {
  const item: OutboxItem = {
    id: safeUUID(),
    type: "update_log",
    logId,
    payload: {
      log: payload,
    },
    createdAt: nowIso(),
    attempts: 0,
    lastError: null,
  };
  await db.outbox.put(item);
}

export async function updatePendingCreatePayload(localLogId: string, payload: Record<string, unknown>) {
  const pending = await db.outbox
    .filter((item) => item.type === "create_log" && item.localLogId === localLogId)
    .first();
  if (!pending || pending.type !== "create_log") return false;
  if (typeof pending.payload !== "object" || pending.payload === null) return false;
  const prev = pending.payload as Record<string, any>;
  const nextLog = { ...(payload as Record<string, any>) };
  const prevTitleId = prev?.log?.payload?.titleId;
  if (prevTitleId && !nextLog?.payload?.titleId) {
    nextLog.payload = {
      ...(nextLog.payload ?? {}),
      titleId: prevTitleId,
    };
  }
  const next = {
    ...prev,
    log: nextLog,
  };
  await db.outbox.update(pending.id, { payload: next });
  return true;
}

export async function listOutbox() {
  return db.outbox.orderBy("createdAt").toArray();
}

export async function removeOutboxItem(id: string) {
  await db.outbox.delete(id);
}

export async function recordOutboxError(id: string, message: string) {
  const item = await db.outbox.get(id);
  if (!item) return;
  await db.outbox.update(id, {
    attempts: (item.attempts ?? 0) + 1,
    lastError: message,
  });
}

export async function countLogsLocal() {
  return db.logs.count();
}
