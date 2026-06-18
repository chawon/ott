import { statusLabel, typeLabel } from './format';
import type { Occasion, Place, WatchLog } from './types';

const PLACE_LABELS: Partial<Record<Place, string>> = {
  HOME: '집',
  THEATER: '극장',
  TRANSIT: '이동 중',
  CAFE: '카페',
  OFFICE: '직장',
  LIBRARY: '도서관',
  BOOKSTORE: '서점',
  SCHOOL: '학교',
  PARK: '공원',
  OUTDOOR: '야외',
  ETC: '기타',
};

const OCCASION_LABELS: Partial<Record<Occasion, string>> = {
  ALONE: '혼자',
  DATE: '데이트',
  FAMILY: '가족',
  FRIENDS: '친구',
  BREAK: '휴식',
  ETC: '기타',
};

type TimelineCsvRow = {
  watchedAt: string;
  type: string;
  title: string;
  status: string;
  rating: string;
  place: string;
  occasion: string;
  ott_or_platform: string;
  note: string;
};

const COLUMNS: Array<{ key: keyof TimelineCsvRow; label: string }> = [
  { key: 'watchedAt', label: '날짜' },
  { key: 'type', label: '구분' },
  { key: 'title', label: '제목' },
  { key: 'status', label: '상태' },
  { key: 'rating', label: '평점' },
  { key: 'place', label: '장소' },
  { key: 'occasion', label: '누구와' },
  { key: 'ott_or_platform', label: '플랫폼' },
  { key: 'note', label: '메모' },
];

function formatDateOnly(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeCsv(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function buildRows(logs: WatchLog[]): TimelineCsvRow[] {
  return logs.map((log) => ({
    watchedAt: formatDateOnly(log.watchedAt),
    type: typeLabel(log.title.type),
    title: log.title.name,
    status: statusLabel(log.status, log.title.type),
    rating: log.rating === null || log.rating === undefined ? '' : String(log.rating),
    place: log.place ? (PLACE_LABELS[log.place] ?? log.place) : '',
    occasion: log.occasion ? (OCCASION_LABELS[log.occasion] ?? log.occasion) : '',
    ott_or_platform: log.ott ?? '',
    note: log.note ?? '',
  }));
}

export function buildTimelineCsv(logs: WatchLog[]) {
  const rows = buildRows(logs);
  const header = COLUMNS.map((col) => col.label).join(',');
  const lines = rows.map((row) => COLUMNS.map((col) => escapeCsv(String(row[col.key] ?? ''))).join(','));
  return [header, ...lines].join('\r\n');
}

export function timelineCsvFileName(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `ottline-timeline-${y}${m}${d}-${hh}${mm}.csv`;
}
