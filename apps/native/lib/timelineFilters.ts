import type { Occasion, Place, Status, TitleType, WatchLog } from './types';

export type StatusFilter = 'ALL' | Status;
export type TypeFilter = 'ALL' | TitleType;
export type OriginFilter = 'ALL' | 'LOG' | 'COMMENT';
export type PlaceFilter = 'ALL' | Place;
export type OccasionFilter = 'ALL' | Occasion;
export type TimelineSort = 'history' | 'watchedAt';

export type TimelineFilters = {
  status: StatusFilter;
  type: TypeFilter;
  origin: OriginFilter;
  place: PlaceFilter;
  occasion: OccasionFilter;
  platform: string;
  query: string;
  sort: TimelineSort;
  titleId?: string | null;
};

function logMatchesQuery(log: WatchLog, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    log.title.name,
    log.note,
    log.ott,
    log.title.author,
    log.title.publisher,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function sortTime(log: WatchLog, sort: TimelineSort) {
  const value = sort === 'history' ? (log.updatedAt ?? log.watchedAt ?? log.createdAt) : log.watchedAt;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function filterTimelineLogs(logs: WatchLog[], filters: TimelineFilters) {
  const platform = filters.platform.trim().toLowerCase();
  return logs
    .filter((log) => {
      if (filters.status !== 'ALL' && log.status !== filters.status) return false;
      if (filters.type !== 'ALL' && log.title.type !== filters.type) return false;
      if (filters.origin !== 'ALL' && (log.origin ?? 'LOG') !== filters.origin) return false;
      if (filters.place !== 'ALL' && log.place !== filters.place) return false;
      if (filters.occasion !== 'ALL' && log.occasion !== filters.occasion) return false;
      if (filters.titleId && log.title.id !== filters.titleId) return false;
      if (platform && (log.ott ?? '').trim().toLowerCase() !== platform) return false;
      return logMatchesQuery(log, filters.query);
    })
    .sort((a, b) => sortTime(b, filters.sort) - sortTime(a, filters.sort));
}
