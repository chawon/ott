import {
  buildReportShareCardContent,
  buildSeasonalRecapShareCardPayload,
  defaultLogShareCardOptions,
  getLogShareCardCaptureSize,
  logShareCardFileName,
  reportShareCardFileName,
  seasonalRecapShareCardFileName,
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
    expect(logShareCardFileName(log, 'feed')).toBe('ott-Dune_Part_Two_IMAX-feed.png');
  });
});

describe('log share card options', () => {
  it('defaults note visibility from the log and supports feed dimensions', () => {
    expect(defaultLogShareCardOptions(log)).toMatchObject({
      format: 'story',
      showRatingLabel: true,
      showNote: false,
      showProfileSignature: false,
    });
    expect(getLogShareCardCaptureSize('story')).toEqual({ width: 1080, height: 1920 });
    expect(getLogShareCardCaptureSize('feed')).toEqual({ width: 1080, height: 1350 });
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
  seasonalRecap: {
    key: '2026-H1',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    totalLogs: 9,
    topType: 'series',
    topPlace: 'HOME',
    topOccasion: 'ALONE',
    doneRatePct: 66.7,
    noteFillPct: 44.4,
    posters: [
      {
        titleId: 'title-series',
        title: 'Severance',
        titleType: 'series',
        posterUrl: 'https://image.example/severance.jpg',
        count: 3,
        lastLoggedAt: '2026-06-20T12:00:00.000Z',
      },
      {
        titleId: 'title-book',
        title: 'Project Hail Mary',
        titleType: 'book',
        posterUrl: null,
        count: 1,
        lastLoggedAt: '2026-05-20T12:00:00.000Z',
      },
    ],
  },
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

  it('builds the 2026 first-half recap share payload', () => {
    expect(seasonalRecapShareCardFileName()).toBe('ottline-2026-h1-recap.png');
    expect(buildSeasonalRecapShareCardPayload(report)).toMatchObject({
      cardType: 'recap',
      recapKind: 'half-year',
      format: 'story',
      title: '2026년 상반기 돌아보기',
      periodLabel: '2026.01.01 - 2026.06.30',
      subtitle: '상반기에 남긴 9개의 기록을 포스터 카드로 모았어요.',
      posterItems: [
        {
          title: 'Severance',
          titleType: 'series',
          posterUrl: 'https://image.example/severance.jpg',
          count: 3,
        },
        {
          title: 'Project Hail Mary',
          titleType: 'book',
          posterUrl: null,
          count: 1,
        },
      ],
      stats: [
        { label: '상반기 기록', value: '9' },
        { label: '가장 많이 남긴 종류', value: '시리즈' },
        { label: '메모 입력률', value: '44.4%' },
      ],
      watermark: 'ottline.app',
    });
  });

  it('builds English first-half recap share payload when requested', () => {
    expect(buildSeasonalRecapShareCardPayload(report, 'en')).toMatchObject({
      title: '2026 First-Half Recap',
      periodLabel: 'Jan 1 - Jun 30, 2026',
      subtitle: 'A poster recap of your 9 records from the first half of 2026.',
      stats: [
        { label: 'First-half records', value: '9' },
        { label: 'Most logged type', value: 'Series' },
        { label: 'Memo Entry Rate', value: '44.4%' },
      ],
    });
  });
});
