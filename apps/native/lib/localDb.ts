import * as SQLite from 'expo-sqlite';
import type { LogOutboxPayload } from './syncPayload';
import type { Title, WatchLog } from './types';

type SqlDb = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;

type TitleRow = {
  id: string;
  json: string;
};

type LogRow = {
  id: string;
  title_id: string;
  title_json: string;
  status: WatchLog['status'];
  rating: number | null;
  note: string | null;
  spoiler: number;
  ott: string | null;
  season_number: number | null;
  episode_number: number | null;
  season_poster_url: string | null;
  season_year: number | null;
  origin: WatchLog['origin'] | null;
  watched_at: string;
  place: WatchLog['place'] | null;
  occasion: WatchLog['occasion'] | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  sync_status: WatchLog['syncStatus'] | null;
};

export type StoredOutboxItem = {
  id: string;
  logId: string;
  payload: LogOutboxPayload;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
};

let dbPromise: Promise<SqlDb> | null = null;

function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('ottline-native.db');
  return dbPromise;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function rowToLog(row: LogRow): WatchLog {
  const title = parseJson<Title>(row.title_json);
  return {
    id: row.id,
    title,
    status: row.status,
    rating: row.rating,
    note: row.note,
    spoiler: row.spoiler === 1,
    ott: row.ott,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    seasonPosterUrl: row.season_poster_url,
    seasonYear: row.season_year,
    origin: row.origin ?? 'LOG',
    watchedAt: row.watched_at,
    place: row.place,
    occasion: row.occasion,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status ?? 'synced',
  };
}

export async function initDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS titles (
      id TEXT PRIMARY KEY NOT NULL,
      provider TEXT,
      provider_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY NOT NULL,
      title_id TEXT NOT NULL,
      title_json TEXT NOT NULL,
      status TEXT NOT NULL,
      rating REAL,
      note TEXT,
      spoiler INTEGER NOT NULL DEFAULT 0,
      ott TEXT,
      season_number INTEGER,
      episode_number INTEGER,
      season_poster_url TEXT,
      season_year INTEGER,
      origin TEXT,
      watched_at TEXT NOT NULL,
      place TEXT,
      occasion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      deleted_at TEXT,
      sync_status TEXT
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      log_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_logs_watched_at ON logs(watched_at);
    CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox(created_at);
  `);
}

export async function getSetting(key: string) {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function upsertTitleLocal(title: Title) {
  await initDb();
  const db = await getDb();
  const updatedAt = title.updatedAt ?? new Date().toISOString();
  await db.runAsync(
    `
      INSERT INTO titles(id, provider, provider_id, type, name, updated_at, deleted_at, json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        provider_id = excluded.provider_id,
        type = excluded.type,
        name = excluded.name,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        json = excluded.json
    `,
    title.id,
    title.provider ?? null,
    title.providerId ?? null,
    title.type,
    title.name,
    updatedAt,
    title.deletedAt ?? null,
    JSON.stringify({ ...title, updatedAt }),
  );
}

export async function getTitleLocal(id: string) {
  await initDb();
  const db = await getDb();
  const row = await db.getFirstAsync<TitleRow>('SELECT id, json FROM titles WHERE id = ?', id);
  return row ? parseJson<Title>(row.json) : null;
}

export async function upsertLogLocal(log: WatchLog) {
  await initDb();
  const db = await getDb();
  const updatedAt = log.updatedAt ?? new Date().toISOString();
  await upsertTitleLocal({ ...log.title, updatedAt: log.title.updatedAt ?? updatedAt });
  await db.runAsync(
    `
      INSERT INTO logs(
        id, title_id, title_json, status, rating, note, spoiler, ott,
        season_number, episode_number, season_poster_url, season_year, origin,
        watched_at, place, occasion, created_at, updated_at, deleted_at, sync_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title_id = excluded.title_id,
        title_json = excluded.title_json,
        status = excluded.status,
        rating = excluded.rating,
        note = excluded.note,
        spoiler = excluded.spoiler,
        ott = excluded.ott,
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        season_poster_url = excluded.season_poster_url,
        season_year = excluded.season_year,
        origin = excluded.origin,
        watched_at = excluded.watched_at,
        place = excluded.place,
        occasion = excluded.occasion,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        sync_status = excluded.sync_status
    `,
    log.id,
    log.title.id,
    JSON.stringify(log.title),
    log.status,
    log.rating ?? null,
    log.note ?? null,
    log.spoiler ? 1 : 0,
    log.ott ?? null,
    log.seasonNumber ?? null,
    log.episodeNumber ?? null,
    log.seasonPosterUrl ?? null,
    log.seasonYear ?? null,
    log.origin ?? 'LOG',
    log.watchedAt,
    log.place ?? null,
    log.occasion ?? null,
    log.createdAt,
    updatedAt,
    log.deletedAt ?? null,
    log.syncStatus ?? 'synced',
  );
}

export async function listLogsLocal() {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<LogRow>(
    'SELECT * FROM logs WHERE deleted_at IS NULL ORDER BY watched_at DESC, created_at DESC',
  );
  return rows.map(rowToLog);
}

export async function enqueueLogOutbox(log: WatchLog, payload: LogOutboxPayload) {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO outbox(id, log_id, payload_json, created_at, attempts, last_error) VALUES (?, ?, ?, ?, 0, NULL)',
    `${log.id}:${now}`,
    log.id,
    JSON.stringify(payload),
    now,
  );
}

export async function listOutbox() {
  await initDb();
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    log_id: string;
    payload_json: string;
    created_at: string;
    attempts: number;
    last_error: string | null;
  }>('SELECT * FROM outbox ORDER BY created_at ASC');
  return rows.map((row) => ({
    id: row.id,
    logId: row.log_id,
    payload: parseJson<LogOutboxPayload>(row.payload_json),
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

export async function removeOutboxItem(id: string) {
  await initDb();
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
}

export async function recordOutboxError(id: string, message: string) {
  await initDb();
  const db = await getDb();
  await db.runAsync(
    'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
    message,
    id,
  );
}

export async function setLogSyncStatus(logId: string, status: WatchLog['syncStatus']) {
  await initDb();
  const db = await getDb();
  await db.runAsync('UPDATE logs SET sync_status = ? WHERE id = ?', status ?? null, logId);
}

export async function clearLocalData() {
  await initDb();
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM outbox;
    DELETE FROM logs;
    DELETE FROM titles;
    DELETE FROM settings;
  `);
}
