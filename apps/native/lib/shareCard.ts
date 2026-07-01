import { reportCopy, type NativeLocale } from './i18n';
import { typeLabel } from './format';
import type { PersonalReport, TitleType, WatchLog } from './types';

export type ReportShareKind = 'weekly' | 'monthly';

export type ReportShareCardContent = {
  title: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
};

export type RecapShareCardPayload = {
  cardType: 'recap';
  recapKind: 'half-year';
  format: 'story';
  title: string;
  subtitle: string;
  periodLabel: string;
  posterItems: Array<{
    title: string;
    titleType?: string;
    posterUrl?: string | null;
    count?: number;
  }>;
  stats: Array<{ label: string; value: string }>;
  footer: string;
  watermark: string;
  theme: 'default';
};

export function logShareCardFileName(log: WatchLog, suffix = 'story') {
  const safeTitle = log.title.name
    .replace(/[^a-zA-Z0-9가-힣_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `ott-${safeTitle || 'share'}-${suffix}.png`;
}

export function reportShareCardFileName(kind: ReportShareKind) {
  return `ottline-${kind}-recap.png`;
}

export function seasonalRecapShareCardFileName() {
  return 'ottline-2026-h1-recap.png';
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

export function buildReportShareCardContent(
  kind: ReportShareKind,
  report: PersonalReport,
  locale: NativeLocale = 'ko',
): ReportShareCardContent {
  const copy = reportCopy[locale];
  if (kind === 'weekly') {
    return {
      title: copy.weeklyShareTitle,
      subtitle: formatCopy(copy.weeklyShareSubtitle, { count: report.previousWeekLogs }),
      stats: [
        { label: copy.weeklyLogs, value: String(report.previousWeekLogs) },
        { label: copy.totalLogs, value: String(report.totalLogs) },
        { label: copy.streak, value: String(report.streakDays) },
      ],
    };
  }

  const hasMonthlyGenre = report.monthlyTopGenre !== '-';
  return {
    title: copy.monthlyShareTitle,
    subtitle: hasMonthlyGenre
      ? formatCopy(copy.monthlyShareSubtitle, {
          genre: report.monthlyTopGenre,
          count: report.monthlyTopGenreCount,
        })
      : copy.monthlyShareSubtitleEmpty,
    stats: [
      { label: copy.thisMonthLogs, value: String(report.thisMonthLogs) },
      {
        label: copy.monthlyShareStatsGenre,
        value: hasMonthlyGenre ? report.monthlyTopGenre : copy.thisMonthGenreEmpty,
      },
      { label: copy.memoRate, value: `${report.noteFillPct}%` },
    ],
  };
}

export function buildSeasonalRecapShareCardPayload(
  report: PersonalReport,
  locale: NativeLocale = 'ko',
): RecapShareCardPayload | null {
  const recap = report.seasonalRecap;
  if (!recap) return null;
  const copy = reportCopy[locale];
  return {
    cardType: 'recap',
    recapKind: 'half-year',
    format: 'story',
    title: copy.h1ShareTitle,
    subtitle: formatCopy(copy.h1ShareSubtitle, { count: recap.totalLogs }),
    periodLabel: copy.h1Period,
    posterItems: recap.posters.map((item) => ({
      title: item.title,
      titleType: item.titleType,
      posterUrl: item.posterUrl ?? null,
      count: item.count,
    })),
    stats: [
      { label: copy.h1TotalRecords, value: String(recap.totalLogs) },
      {
        label: copy.h1TopType,
        value:
          recap.topType === 'movie' || recap.topType === 'series' || recap.topType === 'book'
            ? typeLabel(recap.topType as TitleType, locale)
            : '-',
      },
      { label: copy.h1NoteRate, value: `${recap.noteFillPct}%` },
    ],
    footer: copy.h1ShareFooter,
    watermark: 'ottline.app',
    theme: 'default',
  };
}
