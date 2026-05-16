import type { Status, TitleType } from './types';

export function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

export function statusLabel(status: Status, type?: TitleType) {
  if (type === 'book') {
    if (status === 'DONE') return '다 읽음';
    if (status === 'IN_PROGRESS') return '읽는 중';
    return '읽고 싶음';
  }
  if (status === 'DONE') return '봤어요';
  if (status === 'IN_PROGRESS') return '보는 중';
  return '보고 싶음';
}

export function typeLabel(type: TitleType) {
  if (type === 'book') return '책';
  if (type === 'series') return '시리즈';
  return '영화';
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
