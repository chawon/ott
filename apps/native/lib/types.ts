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

export type FeedbackCategory = 'QUESTION' | 'BUG' | 'IDEA' | 'OTHER';
export type FeedbackStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type FeedbackAuthorRole = 'USER' | 'ADMIN';

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
  deletedAt?: string | null;
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
  isbn10?: string | null;
  isbn13?: string | null;
  pubdate?: string | null;
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

export interface SyncChange<T> {
  id: string;
  op: 'UPSERT' | 'DELETE';
  updatedAt: string;
  payload: T;
}

export interface SyncTitlePayload {
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
}

export interface SyncLogPayload {
  titleId: string;
  status: Status;
  rating?: number | null;
  note?: string | null;
  spoiler?: boolean;
  ott?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  seasonPosterUrl?: string | null;
  seasonYear?: number | null;
  origin?: 'LOG' | 'COMMENT';
  watchedAt: string;
  place?: Place | null;
  occasion?: Occasion | null;
}

export interface SyncPushBody {
  userId: string;
  deviceId: string;
  clientTime: string;
  changes: {
    titles: SyncChange<SyncTitlePayload>[];
    logs: SyncChange<SyncLogPayload>[];
  };
}

export interface SyncPullResponse {
  serverTime: string;
  changes: {
    titles: Array<Title & { id: string; updatedAt: string }>;
    logs: Array<SyncLogPayload & {
      id: string;
      titleId: string;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null;
    }>;
  };
}

export interface FeedbackMessage {
  id: string;
  authorRole: FeedbackAuthorRole;
  body: string;
  createdAt: string;
}

export interface FeedbackThreadSummary {
  id: string;
  userId: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  subject?: string | null;
  messageCount: number;
  lastMessagePreview?: string | null;
  lastAuthorRole?: FeedbackAuthorRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackThreadDetail {
  id: string;
  userId: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  subject?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: FeedbackMessage[];
}

export interface Credentials {
  userId: string | null;
  deviceId: string | null;
  pairingCode: string | null;
}
