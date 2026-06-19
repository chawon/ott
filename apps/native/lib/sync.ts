import { syncPull, syncPush } from './api';
import {
  getSetting,
  getTitleLocal,
  listOutbox,
  markLogDeletedLocal,
  recordOutboxError,
  removeOutboxItem,
  setLogSyncStatus,
  setSetting,
  upsertLogLocal,
  upsertTitleLocal,
} from './localDb';
import { notifyLogsChanged } from './syncEvents';
import type { Title, WatchLog } from './types';
import { useAuthStore } from '../store/authStore';

let syncing = false;

function fallbackTitle(titleId: string): Title {
  return {
    id: titleId,
    type: 'movie',
    name: 'Unknown',
  };
}

export async function pullChanges() {
  const { userId, deviceId } = useAuthStore.getState();
  if (!userId || !deviceId) return { pulled: 0 };

  const since = await getSetting('lastSyncAt');
  const res = await syncPull(since);
  const titleMap = new Map<string, Title>();

  for (const remoteTitle of res.changes?.titles ?? []) {
    const title: Title = {
      ...remoteTitle,
      year: remoteTitle.year ?? null,
      genres: remoteTitle.genres ?? null,
      directors: remoteTitle.directors ?? null,
      cast: remoteTitle.cast ?? null,
      overview: remoteTitle.overview ?? null,
      posterUrl: remoteTitle.posterUrl ?? null,
      author: remoteTitle.author ?? null,
      publisher: remoteTitle.publisher ?? null,
      isbn10: remoteTitle.isbn10 ?? null,
      isbn13: remoteTitle.isbn13 ?? null,
      pubdate: remoteTitle.pubdate ?? null,
      provider: remoteTitle.provider,
      providerId: remoteTitle.providerId,
      deletedAt: remoteTitle.deletedAt ?? null,
    };
    titleMap.set(title.id, title);
    await upsertTitleLocal(title);
  }

  let pulled = 0;
  for (const remoteLog of res.changes?.logs ?? []) {
    if (remoteLog.deletedAt) {
      await markLogDeletedLocal(remoteLog.id, remoteLog.deletedAt, remoteLog.updatedAt);
      pulled += 1;
      continue;
    }
    const title =
      titleMap.get(remoteLog.titleId) ??
      (await getTitleLocal(remoteLog.titleId)) ??
      fallbackTitle(remoteLog.titleId);

    const log: WatchLog = {
      id: remoteLog.id,
      title,
      status: remoteLog.status,
      rating: remoteLog.rating ?? null,
      note: remoteLog.note ?? null,
      spoiler: remoteLog.spoiler ?? false,
      ott: remoteLog.ott ?? null,
      seasonNumber: remoteLog.seasonNumber ?? null,
      episodeNumber: remoteLog.episodeNumber ?? null,
      seasonPosterUrl: remoteLog.seasonPosterUrl ?? null,
      seasonYear: remoteLog.seasonYear ?? null,
      origin: remoteLog.origin ?? 'LOG',
      watchedAt: remoteLog.watchedAt,
      place: remoteLog.place ?? null,
      occasion: remoteLog.occasion ?? null,
      createdAt: remoteLog.createdAt,
      updatedAt: remoteLog.updatedAt,
      deletedAt: null,
      syncStatus: 'synced',
    };
    await upsertLogLocal(log);
    pulled += 1;
  }

  if (res.serverTime) await setSetting('lastSyncAt', res.serverTime);
  return { pulled };
}

export async function syncNow(options: { registerIfNeeded?: boolean } = {}) {
  if (syncing) return { pushed: 0, pulled: 0, skipped: true };

  syncing = true;
  try {
    const outbox = await listOutbox();
    const auth = useAuthStore.getState();
    if (!auth.userId || !auth.deviceId) {
      if (options.registerIfNeeded || outbox.length > 0) {
        await auth.ensureRegistered();
      } else {
        return { pushed: 0, pulled: 0, skipped: false };
      }
    }

    const { userId, deviceId } = useAuthStore.getState();
    if (!userId || !deviceId) return { pushed: 0, pulled: 0, skipped: false };

    let pushed = 0;
    let pulledDuringPush = 0;
    for (const item of outbox) {
      try {
        const result = await syncPush({
          userId,
          deviceId,
          clientTime: new Date().toISOString(),
          changes: {
            titles: [item.payload.title],
            logs: [item.payload.log],
          },
        });
        const rejected = result.rejected ?? [];
        const rejectedIds = new Set(rejected.map((entry) => entry.id));
        const staleReject = rejected.find(
          (entry) =>
            entry.reason === 'stale' &&
            (entry.id === item.logId || entry.id === item.payload.title.id),
        );
        if (staleReject) {
          await removeOutboxItem(item.id);
          await setLogSyncStatus(item.logId, 'synced');
          const stalePullResult = await pullChanges();
          pulledDuringPush += stalePullResult.pulled;
          continue;
        }
        if (rejectedIds.has(item.logId) || rejectedIds.has(item.payload.title.id)) {
          throw new Error('Sync rejected');
        }
        await removeOutboxItem(item.id);
        await setLogSyncStatus(item.logId, 'synced');
        pushed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync failed';
        await recordOutboxError(item.id, message);
        await setLogSyncStatus(item.logId, 'failed');
        break;
      }
    }

    const pullResult = await pullChanges();
    const pulled = pulledDuringPush + pullResult.pulled;
    if (pushed > 0 || pulled > 0) notifyLogsChanged();
    return { pushed, pulled, skipped: false };
  } finally {
    syncing = false;
  }
}
