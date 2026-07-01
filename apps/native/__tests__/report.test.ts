import { buildPersonalReport } from '../lib/report';
import type { WatchLog } from '../lib/types';

function log(overrides: Partial<WatchLog>): WatchLog {
  return {
    id: overrides.id ?? 'log-1',
    title: {
      id: overrides.title?.id ?? 'title-1',
      type: overrides.title?.type ?? 'movie',
      name: overrides.title?.name ?? 'Dune',
      genres: overrides.title?.genres ?? ['SF'],
    },
    status: overrides.status ?? 'DONE',
    rating: overrides.rating ?? 4,
    note: overrides.note ?? '좋았다',
    spoiler: false,
    watchedAt: overrides.watchedAt ?? '2026-06-10T12:00:00.000Z',
    place: overrides.place ?? 'HOME',
    occasion: overrides.occasion ?? 'ALONE',
    createdAt: overrides.createdAt ?? '2026-06-10T12:00:00.000Z',
    seasonNumber: overrides.seasonNumber,
    episodeNumber: overrides.episodeNumber,
    ...overrides,
  };
}

describe('buildPersonalReport', () => {
  it('builds an offline report from local logs', () => {
    const report = buildPersonalReport(
      [
        log({
          id: 'series-1',
          title: { id: 'title-series', type: 'series', name: 'Severance', genres: ['Drama'] },
          status: 'IN_PROGRESS',
          watchedAt: '2026-06-10T12:00:00.000Z',
          seasonNumber: 2,
          episodeNumber: 3,
        }),
        log({
          id: 'movie-1',
          title: { id: 'title-movie', type: 'movie', name: 'Dune', genres: ['SF'] },
          watchedAt: '2026-06-12T12:00:00.000Z',
          place: 'THEATER',
          occasion: 'FRIENDS',
        }),
      ],
      new Date('2026-06-13T12:00:00.000Z'),
    );

    expect(report.totalLogs).toBe(2);
    expect(report.thisMonthLogs).toBe(2);
    expect(report.doneRatePct).toBe(50);
    expect(report.ratingFillPct).toBe(100);
    expect(report.noteFillPct).toBe(100);
    expect(report.topType).toBe('series');
    expect(report.topPlace).toBe('HOME');
    expect(report.topOccasion).toBe('ALONE');
    expect(report.lastLoggedAt).toBe('2026-06-12T12:00:00.000Z');
    expect(report.previousWeekLogs).toBe(0);
    expect(report.monthlyTopGenre).toBe('Drama');
    expect(report.daysSinceLastLog).toBe(1);
    expect(report.continueSeriesTitle).toBe('Severance');
    expect(report.continueSeriesSeasonNumber).toBe(2);
    expect(report.continueSeriesEpisodeNumber).toBe(3);
  });

  it('builds the 2026 first-half recap from local logs', () => {
    const report = buildPersonalReport(
      [
        log({
          id: 'series-1',
          title: {
            id: 'title-series',
            type: 'series',
            name: 'Severance',
            posterUrl: 'https://image.example/severance-main.jpg',
          },
          seasonPosterUrl: 'https://image.example/severance-season-2.jpg',
          status: 'IN_PROGRESS',
          rating: 3,
          note: '',
          watchedAt: '2026-06-30T14:59:00.000Z',
        }),
        log({
          id: 'series-2',
          title: {
            id: 'title-series',
            type: 'series',
            name: 'Severance',
            posterUrl: 'https://image.example/severance-main.jpg',
          },
          status: 'DONE',
          rating: 3,
          watchedAt: '2026-05-01T12:00:00.000Z',
        }),
        log({
          id: 'movie-1',
          title: {
            id: 'title-movie',
            type: 'movie',
            name: 'Past Lives',
            posterUrl: 'https://image.example/past-lives.jpg',
          },
          status: 'DONE',
          rating: 5,
          watchedAt: '2026-02-14T12:00:00.000Z',
        }),
        log({
          id: 'book-1',
          title: { id: 'title-book', type: 'book', name: 'Project Hail Mary' },
          status: 'DONE',
          note: null,
          watchedAt: '2026-02-10T12:00:00.000Z',
        }),
        log({
          id: 'july-1',
          title: { id: 'title-movie', type: 'movie', name: 'F1' },
          watchedAt: '2026-06-30T15:00:00.000Z',
        }),
      ],
      new Date('2026-07-01T03:00:00.000Z'),
    );

    expect(report.seasonalRecap).toMatchObject({
      key: '2026-H1',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      totalLogs: 4,
      topType: 'series',
      topPlace: 'HOME',
      topOccasion: 'ALONE',
      doneRatePct: 75,
      noteFillPct: 50,
      posters: [
        {
          titleId: 'title-movie',
          title: 'Past Lives',
          titleType: 'movie',
          posterUrl: 'https://image.example/past-lives.jpg',
          count: 1,
          lastLoggedAt: '2026-02-14T12:00:00.000Z',
        },
        {
          titleId: 'title-series',
          title: 'Severance',
          titleType: 'series',
          posterUrl: 'https://image.example/severance-season-2.jpg',
          count: 2,
          lastLoggedAt: '2026-06-30T14:59:00.000Z',
        },
        {
          titleId: 'title-book',
          title: 'Project Hail Mary',
          titleType: 'book',
          count: 1,
        },
      ],
    });
  });

  it('returns a zero report for empty local logs', () => {
    expect(buildPersonalReport([])).toMatchObject({
      totalLogs: 0,
      thisMonthLogs: 0,
      topType: '-',
      continueSeriesTitle: null,
      seasonalRecap: null,
    });
  });
});
