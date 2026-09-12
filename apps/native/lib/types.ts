export type Status = 'DONE' | 'IN_PROGRESS' | 'WISHLIST';
export type TitleType = 'movie' | 'series' | 'book';
export type Provider = 'TMDB' | 'LOCAL' | 'NAVER';
export type PersonaKey =
  | 'cinema_keeper'
  | 'book_drifter'
  | 'deep_watcher'
  | 'midnight_logger'
  | 'weekend_curator'
  | 'archive_collector';

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
export type DiscussionReactionType = 'DONE' | 'CURIOUS' | 'SAVE';

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

export interface TmdbSeason {
  seasonNumber: number;
  name: string;
  episodeCount?: number | null;
  posterUrl?: string | null;
  year?: number | null;
}

export interface TmdbEpisode {
  episodeNumber: number;
  name: string;
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

export interface WatchLogHistory {
  id: string;
  logId: string;
  recordedAt: string;
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
  watchedAt: string;
  place?: Place | null;
  occasion?: Occasion | null;
}

export interface SyncChange<T> {
  id: string;
  op: 'UPSERT' | 'DELETE';
  updatedAt: string;
  payload?: T | null;
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

export interface UserProfile {
  userId: string;
  nickname?: string | null;
  personaKey?: PersonaKey | null;
  profileUpdatedAt?: string | null;
}

export interface UpdateUserProfileRequest {
  nickname: string;
  personaKey: PersonaKey;
}

export interface DeviceSummary {
  id: string;
  createdAt: string;
  lastSeenAt?: string | null;
  os?: string | null;
  browser?: string | null;
}

export interface SeasonalRecapPoster {
  titleId: string;
  title: string;
  titleType: string;
  posterUrl?: string | null;
  count: number;
  lastLoggedAt?: string | null;
}

export interface SeasonalRecap {
  key: '2026-H1';
  startDate: string;
  endDate: string;
  totalLogs: number;
  topType: string;
  topPlace: string;
  topOccasion: string;
  doneRatePct: number;
  noteFillPct: number;
  posters: SeasonalRecapPoster[];
}

export interface PersonalReport {
  totalLogs: number;
  thisMonthLogs: number;
  doneRatePct: number;
  ratingFillPct: number;
  noteFillPct: number;
  topType: string;
  topPlace: string;
  topOccasion: string;
  streakDays: number;
  longestStreakDays: number;
  lastLoggedAt?: string | null;
  previousWeekLogs: number;
  monthlyTopGenre: string;
  monthlyTopGenreCount: number;
  daysSinceLastLog: number;
  continueSeriesTitleId?: string | null;
  continueSeriesTitle?: string | null;
  continueSeriesSeasonNumber?: number | null;
  continueSeriesEpisodeNumber?: number | null;
  seasonalRecap?: SeasonalRecap | null;
}

export interface DiscussionReactionSummary {
  done: number;
  curious: number;
  save: number;
}

export interface DiscussionReactionState {
  summary: DiscussionReactionSummary;
  selectedTypes: DiscussionReactionType[];
  selected: boolean;
}

export interface DiscussionListItem {
  id: string;
  titleId: string;
  titleProvider?: Provider | string | null;
  titleProviderId?: string | null;
  titleName: string;
  titleType: TitleType;
  titleYear?: number | null;
  posterUrl?: string | null;
  commentCount: number;
  createdAt: string;
  reactionSummary?: DiscussionReactionSummary | null;
}

export interface Discussion {
  id: string;
  titleId: string;
  commentSeq: number;
  createdAt: string;
  reactionSummary?: DiscussionReactionSummary | null;
}

export interface Comment {
  id: string;
  discussionId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface MentionRef {
  provider: Provider | string;
  providerId: string;
  titleType: TitleType;
}

export interface CreateCommentRequest {
  body: string;
  mentions?: MentionRef[];
  syncLog?: boolean;
}

export interface Credentials {
  userId: string | null;
  deviceId: string | null;
  pairingCode: string | null;
}
