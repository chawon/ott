import { WatchLog, LevelInfo, Badge, GamificationState } from './types';

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
