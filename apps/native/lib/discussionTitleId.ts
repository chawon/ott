import { getLogLocal } from './localDb';
import { syncNow } from './sync';
import type { WatchLog } from './types';

type ResolveDiscussionTitleIdDependencies = {
  sync: () => Promise<unknown>;
  getLog: (logId: string) => Promise<WatchLog | null>;
};

const defaultDependencies: ResolveDiscussionTitleIdDependencies = {
  sync: () => syncNow({ registerIfNeeded: true }),
  getLog: getLogLocal,
};

export async function resolveSyncedDiscussionTitleId(
  titleId: string,
  logId?: string | null,
  dependencies: ResolveDiscussionTitleIdDependencies = defaultDependencies,
) {
  if (!logId) return titleId;

  await dependencies.sync();
  const syncedLog = await dependencies.getLog(logId);
  return syncedLog?.title.id ?? titleId;
}
