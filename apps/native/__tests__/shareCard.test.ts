import {
  buildReportShareCardContent,
  logShareCardFileName,
  reportShareCardFileName,
} from '../lib/shareCard';
import type { PersonalReport, WatchLog } from '../lib/types';

const log: WatchLog = {
  id: 'log-1',
  title: {
    id: 'title-1',
    type: 'movie',
    name: 'Dune: Part Two / IMAX',
  },
  status: 'DONE',
  spoiler: false,
  watchedAt: '2026-06-13T12:00:00.000Z',
  createdAt: '2026-06-13T12:00:00.000Z',
};

describe('logShareCardFileName', () => {
  it('sanitizes the title for a PNG filename', () => {
    expect(logShareCardFileName(log)).toBe('ott-Dune_Part_Two_IMAX-story.png');
  });
});

const report: PersonalReport = {
  totalLogs: 12,
  thisMonthLogs: 4,
  doneRatePct: 75,
  ratingFillPct: 50,
  noteFillPct: 25,
  topType: 'movie',
  topPlace: 'HOME',
  topOccasion: 'ALONE',
  streakDays: 3,
  longestStreakDays: 5,
  lastLoggedAt: '2026-06-13T12:00:00.000Z',
  previousWeekLogs: 2,
  monthlyTopGenre: 'Drama',
  monthlyTopGenreCount: 3,
  daysSinceLastLog: 0,
  continueSeriesTitleId: null,
  continueSeriesTitle: null,
  continueSeriesSeasonNumber: null,
  continueSeriesEpisodeNumber: null,
};

describe('report share card content', () => {
  it('builds weekly recap content and filename', () => {
    expect(reportShareCardFileName('weekly')).toBe('ottline-weekly-recap.png');
    expect(buildReportShareCardContent('weekly', report)).toMatchObject({
      title: '지난주 기록 회고',
      stats: [
        { label: '지난주 기록', value: '2' },
        { label: '총 기록', value: '12' },
        { label: '연속 기록', value: '3' },
      ],
    });
  });

  it('builds monthly recap content', () => {
    expect(reportShareCardFileName('monthly')).toBe('ottline-monthly-recap.png');
    expect(buildReportShareCardContent('monthly', report)).toMatchObject({
      title: '이번 달 장르 회고',
      subtitle: '이번 달 가장 많이 남긴 장르는 Drama입니다. 총 3회 기록했어요.',
      stats: [
        { label: '이번 달 기록', value: '4' },
        { label: '이번 달 최다 장르', value: 'Drama' },
        { label: '메모 입력률', value: '25%' },
      ],
    });
  });

  it('builds English report card content when requested', () => {
    expect(buildReportShareCardContent('weekly', report, 'en')).toMatchObject({
      title: 'Weekly Record Recap',
      subtitle: 'A card with 2 logs from last week.',
      stats: [
        { label: "Last week's records", value: '2' },
        { label: 'Total Records', value: '12' },
        { label: 'Logging Streak', value: '3' },
      ],
    });
    expect(buildReportShareCardContent('monthly', report, 'en')).toMatchObject({
      title: 'Monthly Genre Recap',
      subtitle: 'Your most logged genre this month was Drama, with 3 logs.',
    });
  });
});
