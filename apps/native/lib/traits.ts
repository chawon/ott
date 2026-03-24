import { TraitKey } from './types';

export interface TraitMeta {
  label: string;
  icon: string;
  color: string;
}

export const TRAIT_META: Record<TraitKey, TraitMeta> = {
  // 콘텐츠 타입
  book_maniac:       { label: '책 매니아',    icon: '📚', color: '#ffb781' },
  movie_lover:       { label: '영화광',        icon: '🎬', color: '#7bd0ff' },
  series_lover:      { label: '시리즈광',      icon: '📺', color: '#a78bfa' },
  omnivore:          { label: '잡식형',        icon: '🌈', color: '#dae2fd' },
  // 장소
  homebody:          { label: '집순이형',      icon: '🏠', color: '#fb923c' },
  theater_maniac:    { label: '극장 매니아',   icon: '🎭', color: '#e8b84b' },
  cafe_type:         { label: '카페형',        icon: '☕', color: '#d4a574' },
  transit_type:      { label: '이동형',        icon: '🚇', color: '#60a5fa' },
  outdoor_type:      { label: '야외형',        icon: '🌿', color: '#4ade80' },
  // 상황
  solo_viewer:       { label: '혼자형',        icon: '🎧', color: '#94a3b8' },
  social_viewer:     { label: '같이형',        icon: '👥', color: '#f472b6' },
  // 패턴
  binge_watcher:     { label: '몰아보기형',    icon: '🔁', color: '#c084fc' },
  completionist:     { label: '완주러',        icon: '🏆', color: '#ffd700' },
  collector:         { label: '수집가형',      icon: '📋', color: '#818cf8' },
  note_taker:        { label: '기록 장인',     icon: '✍️', color: '#34d399' },
  generous_rater:    { label: '후한 편',       icon: '⭐', color: '#fbbf24' },
  picky_rater:       { label: '깐깐한 편',     icon: '🎯', color: '#f87171' },
  // 플랫폼
  netflix_loyal:     { label: '넷플릭스파',    icon: '🔴', color: '#E50914' },
  tving_loyal:       { label: '티빙파',        icon: '🟡', color: '#FF0558' },
  wavve_loyal:       { label: '웨이브파',      icon: '🔵', color: '#0090F5' },
  watcha_loyal:      { label: '왓챠파',        icon: '🟣', color: '#FF153C' },
  disney_loyal:      { label: '디즈니+파',     icon: '🏰', color: '#113CCF' },
  appletv_loyal:     { label: '애플TV파',      icon: '🍎', color: '#A2AAAD' },
  global_ott:        { label: '글로벌 OTT파',  icon: '🌍', color: '#7bd0ff' },
  k_ott:             { label: 'K-OTT파',       icon: '🇰🇷', color: '#f472b6' },
  platform_explorer: { label: '플랫폼 탐험가', icon: '🗺️', color: '#dae2fd' },
};

/** 특질 색상 반환. null이면 기본 dim 색상 */
export function getAuraColor(trait: TraitKey | null): string {
  if (!trait) return '#434750'; // Colors.outlineVariant
  return TRAIT_META[trait].color;
}
