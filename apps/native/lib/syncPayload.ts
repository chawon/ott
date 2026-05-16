import type {
  SyncChange,
  SyncLogPayload,
  SyncTitlePayload,
  Title,
  WatchLog,
} from './types';

export type LogOutboxPayload = {
  title: SyncChange<SyncTitlePayload>;
  log: SyncChange<SyncLogPayload>;
};

export function buildTitleChange(title: Title, updatedAt: string): SyncChange<SyncTitlePayload> {
  return {
    id: title.id,
    op: 'UPSERT',
    updatedAt,
    payload: {
      type: title.type,
      name: title.name,
      year: title.year ?? null,
      genres: title.genres ?? null,
      directors: title.directors ?? null,
      cast: title.cast ?? null,
      overview: title.overview ?? null,
      posterUrl: title.posterUrl ?? null,
      author: title.author ?? null,
      publisher: title.publisher ?? null,
      isbn10: title.isbn10 ?? null,
      isbn13: title.isbn13 ?? null,
      pubdate: title.pubdate ?? null,
      provider: title.provider,
      providerId: title.providerId,
    },
  };
}

export function buildLogChange(log: WatchLog, updatedAt: string): SyncChange<SyncLogPayload> {
  return {
    id: log.id,
    op: 'UPSERT',
    updatedAt,
    payload: {
      titleId: log.title.id,
      status: log.status,
      rating: log.rating ?? null,
      note: log.note ?? null,
      spoiler: log.spoiler,
      ott: log.ott ?? null,
      seasonNumber: log.seasonNumber ?? null,
      episodeNumber: log.episodeNumber ?? null,
      seasonPosterUrl: log.seasonPosterUrl ?? null,
      seasonYear: log.seasonYear ?? null,
      origin: log.origin ?? 'LOG',
      watchedAt: log.watchedAt,
      place: log.place ?? null,
      occasion: log.occasion ?? null,
    },
  };
}

export function buildOutboxPayload(log: WatchLog, updatedAt: string): LogOutboxPayload {
  return {
    title: buildTitleChange(log.title, updatedAt),
    log: buildLogChange(log, updatedAt),
  };
}
