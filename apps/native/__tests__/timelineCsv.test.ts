import { buildTimelineCsv, timelineCsvFileName } from '../lib/timelineCsv';
import type { WatchLog } from '../lib/types';

const baseLog: WatchLog = {
  id: 'log-1',
  title: {
    id: 'title-1',
    type: 'movie',
    name: 'Dune, Part Two',
  },
  status: 'DONE',
  rating: 4.5,
  note: '친구가 "다시 보자"고 했다',
  spoiler: false,
  ott: '극장',
  watchedAt: '2026-06-10T12:00:00.000Z',
  place: 'THEATER',
  occasion: 'FRIENDS',
  createdAt: '2026-06-10T12:00:00.000Z',
};

describe('timeline CSV', () => {
  it('builds escaped CSV for local timeline logs', () => {
    const csv = buildTimelineCsv([baseLog]);

    expect(csv.split('\r\n')[0]).toBe('날짜,분류,제목,상태,별점,장소,상황,플랫폼,메모');
    expect(csv).toContain('"Dune, Part Two"');
    expect(csv).toContain('"친구가 ""다시 보자""고 했다"');
    expect(csv).toContain('극장');
  });

  it('builds a timestamped export file name', () => {
    expect(timelineCsvFileName(new Date('2026-06-13T09:08:00.000Z'))).toMatch(
      /^ottline-timeline-20260613-\d{4}\.csv$/,
    );
  });
});
