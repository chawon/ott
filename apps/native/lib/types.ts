// 기존 apps/web/lib/types.ts에서 필요한 타입 이식

export type Status = 'DONE' | 'IN_PROGRESS' | 'WISHLIST';
export type TitleType = 'movie' | 'series' | 'book';
export type Provider = 'TMDB' | 'LOCAL' | 'NAVER';

export type Place =
  | 'HOME'
  | 'THEATER'
  | 'TRANSIT'
  | 'CAFE'
  | 'OFFICE'
  | 'LIBRARY'
  | 'BOOKSTORE'
  | 'SCHOOL'
  | 'PARK'
  | 'OUTDOOR'
  | 'ETC';

export type Occasion = 'ALONE' | 'DATE' | 'FAMILY' | 'FRIENDS' | 'BREAK' | 'ETC';

export interface Title {
  id: string;
  type: TitleType;
  name: string;
  year?: number | null;
  genres?: string[] | null;
  directors?: string[] | null;
  cast?: string[] | null;
  overview?: string | null;
  posterUrl?: string | null;
  author?: string | null;
  publisher?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  pubdate?: string | null;
  provider?: Provider;
  providerId?: string;
  updatedAt?: string;
}

export interface WatchLog {
  id: string;
  title: Title;
  status: Status;
  rating?: number | null;
  note?: string | null;
  spoiler: boolean;
  ott?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  seasonPosterUrl?: string | null;
  seasonYear?: number | null;
  origin?: 'LOG' | 'COMMENT';
  syncStatus?: 'pending' | 'synced' | 'failed';
  updatedAt?: string;
  deletedAt?: string | null;
  watchedAt: string;
  place?: Place | null;
  occasion?: Occasion | null;
  createdAt: string;
}

export interface CreateWatchLogRequest {
  titleId?: string;
  provider?: Provider;
  providerId?: string;
  titleType?: TitleType;
  titleName?: string;
  year?: number;
  genres?: string[];
  overview?: string;
  posterUrl?: string;
  author?: string;
  publisher?: string;
  isbn10?: string;
  isbn13?: string;
  pubdate?: string;
  status: Status;
  rating?: number;
  note?: string;
  spoiler?: boolean;
  ott?: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  watchedAt?: string;
  place?: Place;
  occasion?: Occasion;
}

export interface TitleSearchItem {
  provider: Provider;
  providerId: string;
  titleId?: string;
  type: TitleType;
  name: string;
  year?: number | null;
  posterUrl?: string | null;
  overview?: string | null;
  author?: string | null;
  publisher?: string | null;
}

// 게임화 타입
export interface LevelInfo {
  level: number;
  title: string;
  minXP: number;
  nextXP: number;
  currentXP: number;
  progress: number; // 0~1
}

export interface Badge {
  slug: string;
  label: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface GamificationState {
  xp: number;
  level: LevelInfo;
  streak: number;
  longestStreak: number;
  badges: Badge[];
  newlyUnlocked: Badge[];
}
