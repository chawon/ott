import { reportCopy, type NativeLocale } from './i18n';
import type { PersonalReport, WatchLog } from './types';

export type ReportShareKind = 'weekly' | 'monthly';

export type ReportShareCardContent = {
  title: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
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
