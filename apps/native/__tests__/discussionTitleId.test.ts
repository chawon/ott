jest.mock('../lib/localDb', () => ({ getLogLocal: jest.fn() }));
jest.mock('../lib/sync', () => ({ syncNow: jest.fn() }));

import { resolveSyncedDiscussionTitleId } from '../lib/discussionTitleId';
import type { WatchLog } from '../lib/types';

const canonicalLog: WatchLog = {
  id: 'log-1',
  title: {
    id: 'server-title-id',
    type: 'movie',
    name: 'Dune',
  },
  status: 'DONE',
  spoiler: false,
  watchedAt: '2026-08-16T00:00:00.000Z',
  createdAt: '2026-08-16T00:00:00.000Z',
};

describe('discussion title id resolution', () => {
  it('uses the canonical title id pulled after syncing a local-first log', async () => {
    const calls: string[] = [];

    const titleId = await resolveSyncedDiscussionTitleId('local-title-id', 'log-1', {
      sync: async () => {
        calls.push('sync');
      },
      getLog: async (logId) => {
        calls.push(`get:${logId}`);
        return canonicalLog;
      },
    });

    expect(titleId).toBe('server-title-id');
    expect(calls).toEqual(['sync', 'get:log-1']);
  });

  it('falls back to the supplied title id when no canonical log is available', async () => {
    const titleId = await resolveSyncedDiscussionTitleId('local-title-id', 'log-1', {
      sync: async () => undefined,
      getLog: async () => null,
    });

    expect(titleId).toBe('local-title-id');
  });
});
