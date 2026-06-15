import { buildDeleteLogPayload, buildOutboxPayload, buildUpdateLogPayload } from '../lib/syncPayload';
import type { WatchLog } from '../lib/types';

const baseLog: WatchLog = {
  id: 'log-1',
  title: {
    id: 'title-1',
    type: 'movie',
    name: 'Dune',
    year: 2021,
    provider: 'TMDB',
    providerId: '438631',
  },
  status: 'DONE',
  rating: 4.5,
  note: '극장에서 다시 보고 싶다',
  spoiler: false,
  ott: '극장',
  watchedAt: '2026-05-16T03:00:00.000Z',
  place: 'THEATER',
  occasion: 'FRIENDS',
  createdAt: '2026-05-16T03:00:00.000Z',
};

describe('sync payload', () => {
  it('builds title and log changes for /api/sync/push', () => {
    const payload = buildOutboxPayload(baseLog, '2026-05-16T04:00:00.000Z');

    expect(payload.title).toMatchObject({
      id: 'title-1',
      op: 'UPSERT',
      payload: {
        type: 'movie',
        name: 'Dune',
        provider: 'TMDB',
        providerId: '438631',
      },
    });
    expect(payload.log).toMatchObject({
      id: 'log-1',
      op: 'UPSERT',
      payload: {
        titleId: 'title-1',
        status: 'DONE',
        rating: 4.5,
        note: '극장에서 다시 보고 싶다',
        place: 'THEATER',
        occasion: 'FRIENDS',
      },
    });
  });

  it('builds update payload with the same sync contract', () => {
    const payload = buildUpdateLogPayload(
      { ...baseLog, note: '수정한 메모' },
      '2026-05-16T05:00:00.000Z',
    );

    expect(payload.log).toMatchObject({
      id: 'log-1',
      op: 'UPSERT',
      updatedAt: '2026-05-16T05:00:00.000Z',
      payload: {
        titleId: 'title-1',
        note: '수정한 메모',
      },
    });
  });

  it('builds delete payload as a tombstone change', () => {
    const payload = buildDeleteLogPayload(baseLog, '2026-05-16T06:00:00.000Z');

    expect(payload.log).toEqual({
      id: 'log-1',
      op: 'DELETE',
      updatedAt: '2026-05-16T06:00:00.000Z',
      payload: null,
    });
  });
});
