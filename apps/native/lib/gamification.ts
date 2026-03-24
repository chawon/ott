import { WatchLog, LevelInfo, Badge, GamificationState, DnaTraitMap, TraitKey, AuraResult } from './types';

// 레벨 정의
const LEVELS = [
  { level: 1,  title: '새내기 탐험가',  minXP: 0    },
  { level: 2,  title: '호기심 관람객',  minXP: 50   },
  { level: 3,  title: '콘텐츠 수집가',  minXP: 120  },
  { level: 4,  title: '스크린 헌터',    minXP: 250  },
  { level: 5,  title: '장르 개척자',    minXP: 450  },
  { level: 6,  title: '시네마 탐험가',  minXP: 700  },
  { level: 7,  title: '비평가 지망생',  minXP: 1000 },
  { level: 8,  title: '마스터 뷰어',    minXP: 1400 },
  { level: 9,  title: '오타쿠 레전드',  minXP: 1900 },
  { level: 10, title: '콘텐츠 전설',    minXP: 2500 },
];

export function calcXP(logs: WatchLog[]): number {
  return logs.reduce((acc, log) => {
    if (log.deletedAt) return acc;
    if (log.status === 'DONE') return acc + 10;
    if (log.status === 'IN_PROGRESS') return acc + 3;
    if (log.status === 'WISHLIST') return acc + 1;
    return acc;
  }, 0);
}

export function calcLevelInfo(xp: number): LevelInfo {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
    else break;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1];
  const nextXP = next?.minXP ?? current.minXP + 1000;
  const progress = next
    ? (xp - current.minXP) / (next.minXP - current.minXP)
    : 1;

  return {
    level: current.level,
    title: current.title,
    minXP: current.minXP,
    nextXP,
    currentXP: xp,
    progress: Math.min(1, progress),
  };
}

export function calcStreak(logs: WatchLog[]): { streak: number; longest: number } {
  const done = logs
    .filter((l) => l.status === 'DONE' && !l.deletedAt && l.watchedAt)
    .map((l) => l.watchedAt.slice(0, 10))
    .sort();

  const uniqueDays = [...new Set(done)].sort();
  if (uniqueDays.length === 0) return { streak: 0, longest: 0 };

  let streak = 1;
  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const cur = new Date(uniqueDays[i]);
    const diff = (cur.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  // 오늘/어제 연속 여부 확인
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const last = uniqueDays[uniqueDays.length - 1];
  if (last === today || last === yesterday) {
    streak = current;
  } else {
    streak = 0;
  }

  return { streak, longest };
}

const BADGE_DEFS: Omit<Badge, 'unlocked' | 'unlockedAt'>[] = [
  { slug: 'first_step',    label: '첫 발자국',     description: '첫 번째 기록 완료',              icon: '👣' },
  { slug: 'week_warrior',  label: '7일 전사',       description: '7일 연속 기록',                  icon: '🔥' },
  { slug: 'month_master',  label: '한 달 마스터',   description: '30일 연속 기록',                 icon: '🏆' },
  { slug: 'cinema_10',     label: '영화 마니아',     description: '영화 10편 완료',                 icon: '🎬' },
  { slug: 'bookworm',      label: '책벌레',          description: '책 5권 완료',                    icon: '📚' },
  { slug: 'binge_series',  label: '정주행 러버',     description: '드라마 시리즈 5편 완료',         icon: '📺' },
  { slug: 'night_owl',     label: '밤의 올빼미',     description: '자정~오전 4시 사이 기록 3회',    icon: '🦉' },
  { slug: 'omnivore',      label: '잡식성 감상가',   description: '영화, 드라마, 책 모두 완료',     icon: '🌟' },
  { slug: 'level_5',       label: 'Lv.5 달성',       description: '레벨 5 달성',                    icon: '⭐' },
  { slug: 'level_10',      label: '전설',             description: '레벨 10 달성',                   icon: '💫' },
];

export function calcBadges(logs: WatchLog[], streak: number, level: number): Badge[] {
  const done = logs.filter((l) => l.status === 'DONE' && !l.deletedAt);
  const movies = done.filter((l) => l.title.type === 'movie');
  const books = done.filter((l) => l.title.type === 'book');
  const series = done.filter((l) => l.title.type === 'series');

  const conditions: Record<string, boolean> = {
    first_step:   done.length >= 1,
    week_warrior: streak >= 7,
    month_master: streak >= 30,
    cinema_10:    movies.length >= 10,
    bookworm:     books.length >= 5,
    binge_series: series.length >= 5,
    night_owl:    logs.filter((l) => {
      const h = new Date(l.createdAt).getHours();
      return h >= 0 && h < 4;
    }).length >= 3,
    omnivore:     movies.length >= 1 && books.length >= 1 && series.length >= 1,
    level_5:      level >= 5,
    level_10:     level >= 10,
  };

  return BADGE_DEFS.map((def) => ({
    ...def,
    unlocked: conditions[def.slug] ?? false,
  }));
}

export function calcGamification(logs: WatchLog[]): GamificationState {
  const xp = calcXP(logs);
  const level = calcLevelInfo(xp);
  const { streak, longest } = calcStreak(logs);
  const badges = calcBadges(logs, streak, level.level);

  return {
    xp,
    level,
    streak,
    longestStreak: longest,
    badges,
    newlyUnlocked: [],
  };
}

// ─── 특질 판정 헬퍼 ───────────────────────────────────────────────

function ratio(logs: WatchLog[], predicate: (l: WatchLog) => boolean): number {
  if (logs.length === 0) return 0;
  return logs.filter(predicate).length / logs.length;
}

function avgRating(logs: WatchLog[]): number {
  const rated = logs.filter((l) => l.rating != null);
  if (rated.length === 0) return 0;
  return rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length;
}

// ─── 특질별 점수 계산 ─────────────────────────────────────────────

export function calcDnaTraits(logs: WatchLog[]): DnaTraitMap {
  const active = logs.filter((l) => !l.deletedAt);
  if (active.length === 0) return { traits: {}, topTraits: [] };

  const scores: Partial<Record<TraitKey, number>> = {};

  // 콘텐츠 타입
  const bookR   = ratio(active, (l) => l.title.type === 'book');
  const movieR  = ratio(active, (l) => l.title.type === 'movie');
  const seriesR = ratio(active, (l) => l.title.type === 'series');
  if (bookR >= 0.3)   scores['book_maniac']  = bookR;
  if (movieR >= 0.5)  scores['movie_lover']  = movieR;
  if (seriesR >= 0.5) scores['series_lover'] = seriesR;
  if (bookR >= 0.2 && movieR >= 0.2 && seriesR >= 0.2)
    scores['omnivore'] = Math.min(bookR, movieR, seriesR);

  // 장소
  const homeR    = ratio(active, (l) => l.place === 'HOME');
  const theaterR = ratio(active, (l) => l.place === 'THEATER');
  const cafeR    = ratio(active, (l) => l.place === 'CAFE');
  const transitR = ratio(active, (l) => l.place === 'TRANSIT');
  const outdoorR = ratio(active, (l) => l.place === 'PARK' || l.place === 'OUTDOOR');
  if (homeR >= 0.5)     scores['homebody']       = homeR;
  if (theaterR >= 0.2)  scores['theater_maniac'] = theaterR;
  if (cafeR >= 0.2)     scores['cafe_type']      = cafeR;
  if (transitR >= 0.2)  scores['transit_type']   = transitR;
  if (outdoorR >= 0.15) scores['outdoor_type']   = outdoorR;

  // 상황
  const aloneR  = ratio(active, (l) => l.occasion === 'ALONE');
  const socialR = ratio(active, (l) => ['DATE', 'FRIENDS', 'FAMILY'].includes(l.occasion ?? ''));
  if (aloneR >= 0.5)  scores['solo_viewer']   = aloneR;
  if (socialR >= 0.4) scores['social_viewer'] = socialR;

  // 패턴
  const bingeR      = ratio(active, (l) => l.title.type === 'series' && l.episodeNumber != null);
  const completionR = ratio(active, (l) => l.status === 'DONE');
  const collectorR  = ratio(active, (l) => l.status === 'WISHLIST');
  const noteTakerR  = ratio(active, (l) => !!l.note && l.note.trim().length > 0);
  const avg         = avgRating(active);
  if (bingeR >= 0.3)      scores['binge_watcher']  = bingeR;
  if (completionR >= 0.8) scores['completionist']  = completionR;
  if (collectorR >= 0.4)  scores['collector']      = collectorR;
  if (noteTakerR >= 0.5)  scores['note_taker']     = noteTakerR;
  if (avg >= 4.0)         scores['generous_rater'] = avg / 5;
  if (avg > 0 && avg <= 2.5) scores['picky_rater'] = 1 - avg / 5;

  // 플랫폼
  const nfR      = ratio(active, (l) => l.ott === 'Netflix');
  const tvingR   = ratio(active, (l) => l.ott === '티빙');
  const wavveR   = ratio(active, (l) => l.ott === '웨이브');
  const watchaR  = ratio(active, (l) => l.ott === '왓챠');
  const disneyR  = ratio(active, (l) => l.ott === '디즈니+');
  const appleR   = ratio(active, (l) => l.ott === 'Apple TV+' || l.ott === '애플 TV+');
  const globalR  = nfR + disneyR + appleR;
  const kOttR    = tvingR + wavveR + watchaR;

  if (nfR >= 0.5)     scores['netflix_loyal']     = nfR;
  if (tvingR >= 0.5)  scores['tving_loyal']        = tvingR;
  if (wavveR >= 0.5)  scores['wavve_loyal']         = wavveR;
  if (watchaR >= 0.5) scores['watcha_loyal']        = watchaR;
  if (disneyR >= 0.5) scores['disney_loyal']        = disneyR;
  if (appleR >= 0.5)  scores['appletv_loyal']       = appleR;
  if (globalR >= 0.5) scores['global_ott']          = globalR;
  if (kOttR >= 0.5)   scores['k_ott']               = kOttR;

  const platforms = [nfR, tvingR, wavveR, watchaR, disneyR, appleR];
  const diversePlatforms = platforms.filter((r) => r >= 0.15).length;
  if (diversePlatforms >= 3) scores['platform_explorer'] = diversePlatforms / platforms.length;

  // 상위 3개 추출
  const topTraits = (Object.entries(scores) as [TraitKey, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k);

  return { traits: scores, topTraits };
}

// ─── 개별 로그 나다움 점수 ────────────────────────────────────────

/**
 * topTraits(최대 3개) 중 해당 로그와 매칭되는 수 ÷ 3 → score(0~1)
 * 첫 번째 매칭 특질을 matchedTrait으로 반환 (aura 색상 결정에 사용)
 */
export function calcAuraScore(log: WatchLog, topTraits: TraitKey[]): AuraResult {
  if (topTraits.length === 0) return { score: 0, matchedTrait: null };

  let matches = 0;
  let matchedTrait: TraitKey | null = null;
  for (const trait of topTraits) {
    if (logMatchesTrait(log, trait)) {
      matches++;
      if (!matchedTrait) matchedTrait = trait;
    }
  }
  return { score: matches / 3, matchedTrait };
}

function logMatchesTrait(log: WatchLog, trait: TraitKey): boolean {
  switch (trait) {
    case 'book_maniac':    return log.title.type === 'book';
    case 'movie_lover':    return log.title.type === 'movie';
    case 'series_lover':   return log.title.type === 'series';
    case 'omnivore':       return true;
    case 'homebody':       return log.place === 'HOME';
    case 'theater_maniac': return log.place === 'THEATER';
    case 'cafe_type':      return log.place === 'CAFE';
    case 'transit_type':   return log.place === 'TRANSIT';
    case 'outdoor_type':   return log.place === 'PARK' || log.place === 'OUTDOOR';
    case 'solo_viewer':    return log.occasion === 'ALONE';
    case 'social_viewer':  return ['DATE', 'FRIENDS', 'FAMILY'].includes(log.occasion ?? '');
    case 'binge_watcher':  return log.title.type === 'series' && log.episodeNumber != null;
    case 'completionist':  return log.status === 'DONE';
    case 'collector':      return log.status === 'WISHLIST';
    case 'note_taker':     return !!log.note && log.note.trim().length > 0;
    case 'generous_rater': return (log.rating ?? 0) >= 4;
    case 'picky_rater':    return (log.rating ?? 0) > 0 && (log.rating ?? 0) <= 2.5;
    case 'netflix_loyal':     return log.ott === 'Netflix';
    case 'tving_loyal':       return log.ott === '티빙';
    case 'wavve_loyal':       return log.ott === '웨이브';
    case 'watcha_loyal':      return log.ott === '왓챠';
    case 'disney_loyal':      return log.ott === '디즈니+';
    case 'appletv_loyal':     return log.ott === 'Apple TV+' || log.ott === '애플 TV+';
    case 'global_ott':        return ['Netflix', '디즈니+', 'Apple TV+', '애플 TV+'].includes(log.ott ?? '');
    case 'k_ott':             return ['티빙', '웨이브', '왓챠'].includes(log.ott ?? '');
    case 'platform_explorer': return !!log.ott;
    default: return false;
  }
}
