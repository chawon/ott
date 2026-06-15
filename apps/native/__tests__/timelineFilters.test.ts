import { filterTimelineLogs, type TimelineFilters } from '../lib/timelineFilters';
import type { WatchLog } from '../lib/types';

function log(overrides: Partial<WatchLog>): WatchLog {
  return {
    id: overrides.id ?? 'log-1',
    title: {
      id: overrides.title?.id ?? 'title-1',
      type: overrides.title?.type ?? 'movie',
      name: overrides.title?.name ?? 'Dune',
      author: overrides.title?.author,
      publisher: overrides.title?.publisher,
    },
    status: overrides.status ?? 'DONE',
    spoiler: false,
    watchedAt: overrides.watchedAt ?? '2026-06-10T12:00:00.000Z',
    createdAt: overrides.createdAt ?? '2026-06-10T12:00:00.000Z',
    updatedAt: overrides.updatedAt,
    origin: overrides.origin ?? 'LOG',
    ott: overrides.ott,
    place: overrides.place,
    occasion: overrides.occasion,
    note: overrides.note,
    ...overrides,
  };
}

const baseFilters: TimelineFilters = {
  status: 'ALL',
  type: 'ALL',
  origin: 'ALL',
  place: 'ALL',
  occasion: 'ALL',
  platform: '',
  query: '',
  sort: 'history',
  titleId: null,
};

describe('filterTimelineLogs', () => {
  it('filters by origin platform place occasion and search query', () => {
    const result = filterTimelineLogs(
      [
        log({
          id: 'target',
          title: { id: 'book-1', type: 'book', name: '기록의 쓸모', author: 'A' },
          ott: '밀리의서재',
          place: 'LIBRARY',
          occasion: 'ALONE',
          origin: 'COMMENT',
          note: '다시 읽고 싶다',
        }),
        log({
          id: 'wrong-platform',
          title: { id: 'book-2', type: 'book', name: '다른 책' },
          ott: '리디',
          place: 'LIBRARY',
          occasion: 'ALONE',
          origin: 'COMMENT',
        }),
      ],
      {
        ...baseFilters,
        type: 'book',
        origin: 'COMMENT',
        platform: '밀리의서재',
        place: 'LIBRARY',
        occasion: 'ALONE',
        query: '쓸모',
      },
    );

    expect(result.map((item) => item.id)).toEqual(['target']);
  });

  it('sorts by history timestamp before watched date', () => {
    const result = filterTimelineLogs(
      [
        log({
          id: 'older-watch-newer-update',
          watchedAt: '2026-06-01T12:00:00.000Z',
          updatedAt: '2026-06-13T12:00:00.000Z',
        }),
        log({
          id: 'newer-watch',
          watchedAt: '2026-06-12T12:00:00.000Z',
          updatedAt: '2026-06-12T12:00:00.000Z',
        }),
      ],
      baseFilters,
    );

    expect(result.map((item) => item.id)).toEqual(['older-watch-newer-update', 'newer-watch']);
  });

  it('filters by titleId when provided', () => {
    const result = filterTimelineLogs(
      [
        log({ id: 'keep', title: { id: 'title-1', type: 'movie', name: 'Dune' } }),
        log({ id: 'drop', title: { id: 'title-2', type: 'movie', name: 'Arrival' } }),
      ],
      { ...baseFilters, titleId: 'title-1' },
    );

    expect(result.map((item) => item.id)).toEqual(['keep']);
  });
});
