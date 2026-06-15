import type { Status, TitleType } from './types';
import {
  statusLabels,
  titleTypeLabels,
  type NativeLocale,
} from './i18n';

export function formatShortDate(value: string, locale: NativeLocale = 'ko') {
  return new Date(value).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function statusLabel(status: Status, type?: TitleType, locale: NativeLocale = 'ko') {
  return statusLabels[locale][type ?? 'default'][status];
}

export function typeLabel(type: TitleType, locale: NativeLocale = 'ko') {
  return titleTypeLabels[locale][type];
}

export function seasonEpisodeLabel(
  seasonNumber?: number | null,
  episodeNumber?: number | null,
) {
  if (typeof seasonNumber === 'number' && typeof episodeNumber === 'number') {
    return `S${seasonNumber} · E${episodeNumber}`;
  }
  if (typeof seasonNumber === 'number') return `S${seasonNumber}`;
  if (typeof episodeNumber === 'number') return `E${episodeNumber}`;
  return null;
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function inputDateToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}
