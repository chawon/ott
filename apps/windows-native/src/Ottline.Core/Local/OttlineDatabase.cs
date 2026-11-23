using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Ottline.Core.Domain;
using Ottline.Core.Models;

namespace Ottline.Core.Local;

public sealed class OttlineDatabase : IDisposable
{
    public const string StalePendingPullMarker = "stale_pending_pull";

    private readonly string _connectionString;
    private readonly object _syncRoot = new();

    public string DatabasePath { get; }

    public OttlineDatabase(string? dbFilePath = null)
    {
        if (string.IsNullOrWhiteSpace(dbFilePath))
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var dir = Path.Combine(appData, "ottline");
            Directory.CreateDirectory(dir);
            dbFilePath = Path.Combine(dir, "ottline_v2.db");
        }
        else
        {
            var dir = Path.GetDirectoryName(dbFilePath);
            if (!string.IsNullOrWhiteSpace(dir))
            {
                Directory.CreateDirectory(dir);
            }
        }

        DatabasePath = dbFilePath;
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = DatabasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        };
        _connectionString = builder.ToString();
        InitializeSchema();
    }

    private SqliteConnection OpenConnection()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        return conn;
    }

    private void InitializeSchema()
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;

                CREATE TABLE IF NOT EXISTS titles (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    provider_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    original_title TEXT,
                    year INTEGER,
                    poster_url TEXT,
                    overview TEXT,
                    genres_json TEXT NOT NULL DEFAULT '[]',
                    runtime_minutes INTEGER,
                    authors_json TEXT NOT NULL DEFAULT '[]',
                    publisher TEXT,
                    isbn10 TEXT,
                    isbn13 TEXT,
                    pubdate TEXT,
                    page_count INTEGER,
                    kdc_code TEXT,
                    season_count INTEGER,
                    episode_count INTEGER,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS logs (
                    id TEXT PRIMARY KEY,
                    title_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    rating REAL,
                    reaction TEXT,
                    ott TEXT,
                    place TEXT,
                    occasion TEXT,
                    season_number INTEGER,
                    episode_number INTEGER,
                    note TEXT,
                    spoiler INTEGER NOT NULL DEFAULT 0,
                    occurred_at TEXT NOT NULL,
                    watched_on TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 1,
                    origin TEXT NOT NULL DEFAULT 'LOG',
                    sync_state TEXT NOT NULL DEFAULT 'synced',
                    deleted_at TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_logs_title_id ON logs(title_id);
                CREATE INDEX IF NOT EXISTS idx_logs_watched_on ON logs(watched_on DESC);

                CREATE TABLE IF NOT EXISTS log_history (
                    id TEXT PRIMARY KEY,
                    log_id TEXT NOT NULL,
                    title_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    rating REAL,
                    reaction TEXT,
                    ott TEXT,
                    place TEXT,
                    occasion TEXT,
                    season_number INTEGER,
                    episode_number INTEGER,
                    note TEXT,
                    spoiler INTEGER NOT NULL DEFAULT 0,
                    occurred_at TEXT NOT NULL,
                    watched_on TEXT NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 1,
                    origin TEXT NOT NULL DEFAULT 'LOG',
                    recorded_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_log_history_title_id ON log_history(title_id, revision DESC);

                CREATE TABLE IF NOT EXISTS outbox (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT
                );

                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                DELETE FROM log_history WHERE log_id LIKE 'seed-log-%';
                DELETE FROM logs WHERE id LIKE 'seed-log-%';
                DELETE FROM titles WHERE id NOT IN (SELECT DISTINCT title_id FROM logs);
            ";
            cmd.ExecuteNonQuery();

            EnsureLogsDeletedAtColumnInternal(conn);
        }
    }

    private static void EnsureLogsDeletedAtColumnInternal(SqliteConnection conn)
    {
        using var pragma = conn.CreateCommand();
        pragma.CommandText = "PRAGMA table_info(logs);";
        var hasDeletedAt = false;
        using (var reader = pragma.ExecuteReader())
        {
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "deleted_at", StringComparison.OrdinalIgnoreCase))
                {
                    hasDeletedAt = true;
                    break;
                }
            }
        }

        if (!hasDeletedAt)
        {
            using var alter = conn.CreateCommand();
            alter.CommandText = "ALTER TABLE logs ADD COLUMN deleted_at TEXT;";
            alter.ExecuteNonQuery();
        }
    }

    public void UpsertTitle(TitleSummary title)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            UpsertTitleInternal(conn, null, title);
        }
    }

    private static void UpsertTitleInternal(SqliteConnection conn, SqliteTransaction? tx, TitleSummary title)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = @"
            INSERT INTO titles (
                id, provider, provider_id, type, title, original_title, year, poster_url, overview,
                genres_json, runtime_minutes, authors_json, publisher, isbn10, isbn13, pubdate,
                page_count, kdc_code, season_count, episode_count, updated_at
            ) VALUES (
                $id, $provider, $provider_id, $type, $title, $original_title, $year, $poster_url, $overview,
                $genres_json, $runtime_minutes, $authors_json, $publisher, $isbn10, $isbn13, $pubdate,
                $page_count, $kdc_code, $season_count, $episode_count, $updated_at
            )
            ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider,
                provider_id = excluded.provider_id,
                type = excluded.type,
                title = excluded.title,
                original_title = COALESCE(excluded.original_title, titles.original_title),
                year = COALESCE(excluded.year, titles.year),
                poster_url = COALESCE(excluded.poster_url, titles.poster_url),
                overview = COALESCE(excluded.overview, titles.overview),
                genres_json = excluded.genres_json,
                runtime_minutes = COALESCE(excluded.runtime_minutes, titles.runtime_minutes),
                authors_json = excluded.authors_json,
                publisher = COALESCE(excluded.publisher, titles.publisher),
                isbn10 = COALESCE(excluded.isbn10, titles.isbn10),
                isbn13 = COALESCE(excluded.isbn13, titles.isbn13),
                pubdate = COALESCE(excluded.pubdate, titles.pubdate),
                page_count = COALESCE(excluded.page_count, titles.page_count),
                kdc_code = COALESCE(excluded.kdc_code, titles.kdc_code),
                season_count = COALESCE(excluded.season_count, titles.season_count),
                episode_count = COALESCE(excluded.episode_count, titles.episode_count),
                updated_at = excluded.updated_at;
        ";
        cmd.Parameters.AddWithValue("$id", title.Id);
        cmd.Parameters.AddWithValue("$provider", title.Provider);
        cmd.Parameters.AddWithValue("$provider_id", title.ProviderId);
        cmd.Parameters.AddWithValue("$type", title.Type.ToWire());
        cmd.Parameters.AddWithValue("$title", title.Title);
        cmd.Parameters.AddWithValue("$original_title", (object?)title.OriginalTitle ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$year", (object?)title.Year ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$poster_url", (object?)title.PosterUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$overview", (object?)title.Overview ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$genres_json", JsonSerializer.Serialize(title.SafeGenres));
        cmd.Parameters.AddWithValue("$runtime_minutes", (object?)title.RuntimeMinutes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$authors_json", JsonSerializer.Serialize(title.SafeAuthors));
        cmd.Parameters.AddWithValue("$publisher", (object?)title.Publisher ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$isbn10", (object?)title.Isbn10 ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$isbn13", (object?)title.Isbn13 ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pubdate", (object?)title.Pubdate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$page_count", (object?)title.PageCount ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$kdc_code", (object?)title.KdcCode ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$season_count", (object?)title.SeasonCount ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$episode_count", (object?)title.EpisodeCount ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$updated_at", DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture));
        cmd.ExecuteNonQuery();
    }

    public TitleSummary? GetTitle(string id)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT * FROM titles WHERE id = $id LIMIT 1;";
            cmd.Parameters.AddWithValue("$id", id);
            using var reader = cmd.ExecuteReader();
            return reader.Read() ? ReadTitleFromReader(reader, string.Empty) : null;
        }
    }

    public IReadOnlyList<TitleSummary> GetAllTitles()
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT * FROM titles ORDER BY updated_at DESC;";
            var list = new List<TitleSummary>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(ReadTitleFromReader(reader, string.Empty));
            }
            return list;
        }
    }

    public IReadOnlyList<TitleSummary> FindMatchingTitles(TitleSummary candidate)
    {
        var all = GetAllTitles();
        return all.Where(t => SyncIdNormalizer.AreTitlesEquivalent(t, candidate)).ToList();
    }

    public IReadOnlyList<TitleSummary> SearchLocalTitles(string query, ContentFilter filter = ContentFilter.ALL, int limit = 20)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT * FROM titles
                WHERE ($q = '' OR title LIKE $like OR original_title LIKE $like OR authors_json LIKE $like OR isbn13 LIKE $like OR isbn10 LIKE $like)
                ORDER BY updated_at DESC
                LIMIT $limit;
            ";
            var clean = query?.Trim() ?? string.Empty;
            cmd.Parameters.AddWithValue("$q", clean);
            cmd.Parameters.AddWithValue("$like", $"%{clean}%");
            cmd.Parameters.AddWithValue("$limit", limit);

            var list = new List<TitleSummary>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                var item = ReadTitleFromReader(reader, string.Empty);
                if (filter == ContentFilter.VIDEO && !item.Type.IsVideo()) continue;
                if (filter == ContentFilter.BOOK && !item.Type.IsBook()) continue;
                list.Add(item);
            }
            return list;
        }
    }

    public WatchLog UpsertLog(WatchLog log, bool recordHistory = true)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();
            var saved = UpsertLogInternal(conn, tx, log, recordHistory);
            tx.Commit();
            return saved;
        }
    }

    public WatchLog SaveLogAndOutboxAtomic(
        WatchLog log,
        bool recordHistory,
        string outboxType,
        Func<WatchLog, string> payloadSerializer,
        (string Type, Func<WatchLog, string> PayloadSerializer)? extraOutbox = null)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();

            var saved = UpsertLogInternal(conn, tx, log, recordHistory);
            UpsertLogOutboxInternal(conn, tx, outboxType, saved.Id, payloadSerializer(saved));

            if (extraOutbox.HasValue)
            {
                EnqueueOutboxInternal(conn, tx, extraOutbox.Value.Type, saved.Id, extraOutbox.Value.PayloadSerializer(saved));
            }

            tx.Commit();
            return saved;
        }
    }

    private static WatchLog UpsertLogInternal(SqliteConnection conn, SqliteTransaction tx, WatchLog log, bool recordHistory)
    {
        UpsertTitleInternal(conn, tx, log.Title);

        var existing = GetLogInternal(conn, tx, log.Id, includeDeleted: true)
                       ?? GetLogByTitleIdInternal(conn, tx, log.TitleId);
        var nowIso = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
        var watchedOn = RecordDate.OccurredAtToWatchedOnDate(log.OccurredAt, log.WatchedOn);
        var occurredAt = string.IsNullOrWhiteSpace(log.OccurredAt) ? RecordDate.ToNoonUtcIso(watchedOn) : log.OccurredAt;

        var finalId = existing?.Id ?? (string.IsNullOrWhiteSpace(log.Id) ? Guid.NewGuid().ToString("D") : log.Id);
        var finalCreatedAt = existing?.CreatedAt ?? (string.IsNullOrWhiteSpace(log.CreatedAt) ? nowIso : log.CreatedAt);
        var finalRevision = existing != null
            ? Math.Max(existing.Revision + (recordHistory ? 1 : 0), log.Revision)
            : Math.Max(1, log.Revision);

        var saved = log with
        {
            Id = finalId,
            TitleId = log.Title.Id,
            WatchedOn = watchedOn,
            OccurredAt = occurredAt,
            CreatedAt = finalCreatedAt,
            UpdatedAt = string.IsNullOrWhiteSpace(log.UpdatedAt) ? nowIso : log.UpdatedAt,
            Revision = finalRevision
        };

        using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = @"
                INSERT INTO logs (
                    id, title_id, status, rating, reaction, ott, place, occasion,
                    season_number, episode_number, note, spoiler, occurred_at, watched_on,
                    created_at, updated_at, revision, origin, sync_state, deleted_at
                ) VALUES (
                    $id, $title_id, $status, $rating, $reaction, $ott, $place, $occasion,
                    $season_number, $episode_number, $note, $spoiler, $occurred_at, $watched_on,
                    $created_at, $updated_at, $revision, $origin, $sync_state, $deleted_at
                )
                ON CONFLICT(id) DO UPDATE SET
                    title_id = excluded.title_id,
                    status = excluded.status,
                    rating = excluded.rating,
                    reaction = excluded.reaction,
                    ott = excluded.ott,
                    place = excluded.place,
                    occasion = excluded.occasion,
                    season_number = excluded.season_number,
                    episode_number = excluded.episode_number,
                    note = excluded.note,
                    spoiler = excluded.spoiler,
                    occurred_at = excluded.occurred_at,
                    watched_on = excluded.watched_on,
                    updated_at = excluded.updated_at,
                    revision = excluded.revision,
                    origin = excluded.origin,
                    sync_state = excluded.sync_state,
                    deleted_at = excluded.deleted_at;
            ";
            cmd.Parameters.AddWithValue("$id", saved.Id);
            cmd.Parameters.AddWithValue("$title_id", saved.TitleId);
            cmd.Parameters.AddWithValue("$status", saved.Status.ToWire());
            cmd.Parameters.AddWithValue("$rating", (object?)saved.Rating ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$reaction", (object?)saved.Reaction ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ott", (object?)saved.Ott ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$place", (object?)saved.Place ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$occasion", (object?)saved.Occasion ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$season_number", (object?)saved.SeasonNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$episode_number", (object?)saved.EpisodeNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$note", (object?)saved.Note ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$spoiler", saved.Spoiler ? 1 : 0);
            cmd.Parameters.AddWithValue("$occurred_at", saved.OccurredAt);
            cmd.Parameters.AddWithValue("$watched_on", saved.WatchedOn);
            cmd.Parameters.AddWithValue("$created_at", saved.CreatedAt);
            cmd.Parameters.AddWithValue("$updated_at", saved.UpdatedAt);
            cmd.Parameters.AddWithValue("$revision", saved.Revision);
            cmd.Parameters.AddWithValue("$origin", saved.Origin.ToWire());
            cmd.Parameters.AddWithValue("$sync_state", saved.SyncState);
            cmd.Parameters.AddWithValue("$deleted_at", (object?)saved.DeletedAt ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }

        if (recordHistory)
        {
            using var histCmd = conn.CreateCommand();
            histCmd.Transaction = tx;
            histCmd.CommandText = @"
                INSERT INTO log_history (
                    id, log_id, title_id, status, rating, reaction, ott, place, occasion,
                    season_number, episode_number, note, spoiler, occurred_at, watched_on,
                    revision, origin, recorded_at
                ) VALUES (
                    $id, $log_id, $title_id, $status, $rating, $reaction, $ott, $place, $occasion,
                    $season_number, $episode_number, $note, $spoiler, $occurred_at, $watched_on,
                    $revision, $origin, $recorded_at
                );
            ";
            histCmd.Parameters.AddWithValue("$id", $"hist:{saved.Id}:r{saved.Revision}:{Guid.NewGuid():N}");
            histCmd.Parameters.AddWithValue("$log_id", saved.Id);
            histCmd.Parameters.AddWithValue("$title_id", saved.TitleId);
            histCmd.Parameters.AddWithValue("$status", saved.Status.ToWire());
            histCmd.Parameters.AddWithValue("$rating", (object?)saved.Rating ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$reaction", (object?)saved.Reaction ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$ott", (object?)saved.Ott ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$place", (object?)saved.Place ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$occasion", (object?)saved.Occasion ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$season_number", (object?)saved.SeasonNumber ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$episode_number", (object?)saved.EpisodeNumber ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$note", (object?)saved.Note ?? DBNull.Value);
            histCmd.Parameters.AddWithValue("$spoiler", saved.Spoiler ? 1 : 0);
            histCmd.Parameters.AddWithValue("$occurred_at", saved.OccurredAt);
            histCmd.Parameters.AddWithValue("$watched_on", saved.WatchedOn);
            histCmd.Parameters.AddWithValue("$revision", saved.Revision);
            histCmd.Parameters.AddWithValue("$origin", saved.Origin.ToWire());
            histCmd.Parameters.AddWithValue("$recorded_at", nowIso);
            histCmd.ExecuteNonQuery();
        }

        return saved;
    }

    public WatchLog? GetLog(string id)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            return GetLogInternal(conn, null, id, includeDeleted: false);
        }
    }

    public WatchLog? GetLogIncludingDeleted(string id)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            return GetLogInternal(conn, null, id, includeDeleted: true);
        }
    }

    public IReadOnlyList<WatchLog> FindLogsByIdentityIncludingDeleted(string serverLogId)
    {
        if (string.IsNullOrWhiteSpace(serverLogId)) return Array.Empty<WatchLog>();

        var trimmedServerId = serverLogId.Trim();
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            var matchedIds = new List<string>();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT id FROM logs;";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    var candidateId = reader.GetString(0);
                    if (SyncIdNormalizer.IsSameLogIdentity(candidateId, trimmedServerId))
                    {
                        matchedIds.Add(candidateId);
                    }
                }
            }

            if (matchedIds.Count == 0)
            {
                return Array.Empty<WatchLog>();
            }

            var matches = new List<WatchLog>(matchedIds.Count);
            foreach (var id in matchedIds)
            {
                var log = GetLogInternal(conn, null, id, includeDeleted: true);
                if (log != null)
                {
                    matches.Add(log);
                }
            }

            return matches;
        }
    }

    public WatchLog? GetLogByTitleId(string titleId)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            return GetLogByTitleIdInternal(conn, null, titleId);
        }
    }

    public IReadOnlyList<WatchLog> GetLogsByTitleId(string titleId, bool includeDeleted = false)
    {
        if (string.IsNullOrWhiteSpace(titleId)) return Array.Empty<WatchLog>();
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            var deletedClause = includeDeleted ? "" : " AND l.deleted_at IS NULL";
            cmd.CommandText = BaseLogJoinQuery + $" WHERE l.title_id = $title_id{deletedClause} ORDER BY l.updated_at DESC;";
            cmd.Parameters.AddWithValue("$title_id", titleId);
            var list = new List<WatchLog>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(ReadWatchLogFromJoinReader(reader));
            }
            return list;
        }
    }

    public IReadOnlyList<WatchLog> GetAllLogs(bool includeDeleted = false)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            var whereClause = includeDeleted ? "" : " WHERE l.deleted_at IS NULL";
            cmd.CommandText = BaseLogJoinQuery + $"{whereClause} ORDER BY l.watched_on DESC, l.updated_at DESC;";
            var list = new List<WatchLog>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(ReadWatchLogFromJoinReader(reader));
            }
            return list;
        }
    }

    public IReadOnlyList<WatchLogHistoryEntry> GetHistoryForTitle(string titleId)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT * FROM log_history
                WHERE title_id = $title_id
                ORDER BY revision DESC, recorded_at DESC;
            ";
            cmd.Parameters.AddWithValue("$title_id", titleId);
            var list = new List<WatchLogHistoryEntry>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new WatchLogHistoryEntry(
                    Id: reader.GetString(reader.GetOrdinal("id")),
                    LogId: reader.GetString(reader.GetOrdinal("log_id")),
                    TitleId: reader.GetString(reader.GetOrdinal("title_id")),
                    Status: LogStatusExtensions.FromWire(reader.GetString(reader.GetOrdinal("status"))),
                    Rating: GetNullableDouble(reader, "rating"),
                    Reaction: GetNullableString(reader, "reaction"),
                    Ott: GetNullableString(reader, "ott"),
                    Place: GetNullableString(reader, "place"),
                    Occasion: GetNullableString(reader, "occasion"),
                    SeasonNumber: GetNullableInt(reader, "season_number"),
                    EpisodeNumber: GetNullableInt(reader, "episode_number"),
                    Note: GetNullableString(reader, "note"),
                    Spoiler: reader.GetInt32(reader.GetOrdinal("spoiler")) != 0,
                    OccurredAt: reader.GetString(reader.GetOrdinal("occurred_at")),
                    WatchedOn: reader.GetString(reader.GetOrdinal("watched_on")),
                    Revision: reader.GetInt32(reader.GetOrdinal("revision")),
                    Origin: LogOriginExtensions.FromWire(reader.GetString(reader.GetOrdinal("origin"))),
                    RecordedAt: reader.GetString(reader.GetOrdinal("recorded_at"))
                ));
            }
            return list;
        }
    }

    public void RemapTitleId(string oldTitleId, string newTitleId, TitleSummary? canonicalTitle = null)
    {
        if (string.IsNullOrWhiteSpace(oldTitleId) || string.IsNullOrWhiteSpace(newTitleId) || oldTitleId == newTitleId)
            return;

        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();

            if (canonicalTitle != null)
            {
                UpsertTitleInternal(conn, tx, canonicalTitle with { Id = newTitleId });
            }
            else
            {
                using var copyCmd = conn.CreateCommand();
                copyCmd.Transaction = tx;
                copyCmd.CommandText = "UPDATE OR IGNORE titles SET id = $newId WHERE id = $oldId;";
                copyCmd.Parameters.AddWithValue("$newId", newTitleId);
                copyCmd.Parameters.AddWithValue("$oldId", oldTitleId);
                copyCmd.ExecuteNonQuery();
            }

            using (var updateLogs = conn.CreateCommand())
            {
                updateLogs.Transaction = tx;
                updateLogs.CommandText = "UPDATE logs SET title_id = $newId WHERE title_id = $oldId;";
                updateLogs.Parameters.AddWithValue("$newId", newTitleId);
                updateLogs.Parameters.AddWithValue("$oldId", oldTitleId);
                updateLogs.ExecuteNonQuery();
            }

            using (var updateHist = conn.CreateCommand())
            {
                updateHist.Transaction = tx;
                updateHist.CommandText = "UPDATE log_history SET title_id = $newId WHERE title_id = $oldId;";
                updateHist.Parameters.AddWithValue("$newId", newTitleId);
                updateHist.Parameters.AddWithValue("$oldId", oldTitleId);
                updateHist.ExecuteNonQuery();
            }

            using (var deleteOld = conn.CreateCommand())
            {
                deleteOld.Transaction = tx;
                deleteOld.CommandText = "DELETE FROM titles WHERE id = $oldId AND $oldId != $newId;";
                deleteOld.Parameters.AddWithValue("$oldId", oldTitleId);
                deleteOld.Parameters.AddWithValue("$newId", newTitleId);
                deleteOld.ExecuteNonQuery();
            }

            tx.Commit();
        }
    }

    public void RemapLogId(string oldLogId, string newLogId, bool markSynced = true)
    {
        if (string.IsNullOrWhiteSpace(oldLogId) || string.IsNullOrWhiteSpace(newLogId) || oldLogId == newLogId)
            return;

        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();

            var targetAlreadyExists = GetLogInternal(conn, tx, newLogId, includeDeleted: true) != null;

            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = "UPDATE log_history SET log_id = $newId WHERE log_id = $oldId;";
                cmd.Parameters.AddWithValue("$newId", newLogId);
                cmd.Parameters.AddWithValue("$oldId", oldLogId);
                cmd.ExecuteNonQuery();
            }

            using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = "UPDATE outbox SET entity_id = $newId WHERE entity_id = $oldId;";
                cmd.Parameters.AddWithValue("$newId", newLogId);
                cmd.Parameters.AddWithValue("$oldId", oldLogId);
                cmd.ExecuteNonQuery();
            }

            if (targetAlreadyExists)
            {
                using (var delOld = conn.CreateCommand())
                {
                    delOld.Transaction = tx;
                    delOld.CommandText = "DELETE FROM logs WHERE id = $oldId;";
                    delOld.Parameters.AddWithValue("$oldId", oldLogId);
                    delOld.ExecuteNonQuery();
                }

                if (markSynced)
                {
                    using var markCmd = conn.CreateCommand();
                    markCmd.Transaction = tx;
                    markCmd.CommandText = "UPDATE logs SET sync_state = 'synced' WHERE id = $newId;";
                    markCmd.Parameters.AddWithValue("$newId", newLogId);
                    markCmd.ExecuteNonQuery();
                }
            }
            else
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = markSynced
                    ? "UPDATE logs SET id = $newId, sync_state = 'synced' WHERE id = $oldId;"
                    : "UPDATE logs SET id = $newId WHERE id = $oldId;";
                cmd.Parameters.AddWithValue("$newId", newLogId);
                cmd.Parameters.AddWithValue("$oldId", oldLogId);
                cmd.ExecuteNonQuery();
            }

            tx.Commit();
        }
    }

    public void MarkLogSynced(string logId)
    {
        UpdateLogSyncState(logId, "synced");
    }

    public void UpdateLogSyncState(string logId, string syncState)
    {
        if (string.IsNullOrWhiteSpace(logId)) return;
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE logs SET sync_state = $state WHERE id = $id;";
            cmd.Parameters.AddWithValue("$state", syncState);
            cmd.Parameters.AddWithValue("$id", logId);
            cmd.ExecuteNonQuery();
        }
    }

    public void MarkLogDeleted(string logId, string deletedAt, string? updatedAt = null, string syncState = "synced")
    {
        if (string.IsNullOrWhiteSpace(logId) || string.IsNullOrWhiteSpace(deletedAt)) return;
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                UPDATE logs
                SET deleted_at = $deleted_at,
                    updated_at = COALESCE($updated_at, updated_at),
                    sync_state = $state
                WHERE id = $id;
            ";
            cmd.Parameters.AddWithValue("$deleted_at", deletedAt.Trim());
            cmd.Parameters.AddWithValue("$updated_at", string.IsNullOrWhiteSpace(updatedAt) ? DBNull.Value : updatedAt.Trim());
            cmd.Parameters.AddWithValue("$state", syncState);
            cmd.Parameters.AddWithValue("$id", logId);
            cmd.ExecuteNonQuery();
        }
    }

    /// <summary>
    /// Atomically preserves revision history, remaps a legacy non-UUID log ID to its proven canonical
    /// server UUID, aligns ONLY the deleted row (and its history) to the canonical server title_id
    /// without disturbing separate logs on the title, and marks the row soft-deleted inside a single
    /// SQLite transaction.
    /// </summary>
    public void ApplyServerDeletedLogAtomic(WatchLog existingLocal, SyncDeletedLog deletedLog)
    {
        if (string.IsNullOrWhiteSpace(existingLocal.Id) ||
            string.IsNullOrWhiteSpace(deletedLog.Id) ||
            string.IsNullOrWhiteSpace(deletedLog.DeletedAt))
        {
            return;
        }

        var canonicalLogId = deletedLog.Id.Trim();
        var deletedAt = deletedLog.DeletedAt.Trim();
        var updatedAt = string.IsNullOrWhiteSpace(deletedLog.UpdatedAt) ? deletedAt : deletedLog.UpdatedAt.Trim();

        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();

            var currentLocal = GetLogInternal(conn, tx, existingLocal.Id, includeDeleted: true);
            if (currentLocal == null)
            {
                tx.Commit();
                return;
            }

            // 1. Capture the current local snapshot into log_history before remapping or soft-deleting.
            EnsureHistorySnapshotInternal(conn, tx, currentLocal);

            // 2. Remap legacy non-UUID (or differently cased) log_id + history to canonical server UUID.
            if (!string.Equals(currentLocal.Id, canonicalLogId, StringComparison.Ordinal))
            {
                RemapLogIdInternal(conn, tx, currentLocal.Id, canonicalLogId, markSynced: false);
            }

            // 3. Align ONLY this deleted log and its history rows to the server's canonical title_id
            //    without touching any other active or deleted logs that may reference currentLocal.TitleId.
            var targetTitleId = !string.IsNullOrWhiteSpace(deletedLog.TitleId) &&
                                SyncIdNormalizer.IsValidUuid(deletedLog.TitleId)
                ? deletedLog.TitleId.Trim()
                : currentLocal.TitleId;

            if (!string.Equals(currentLocal.TitleId, targetTitleId, StringComparison.OrdinalIgnoreCase))
            {
                bool targetTitleExists;
                using (var checkTitle = conn.CreateCommand())
                {
                    checkTitle.Transaction = tx;
                    checkTitle.CommandText = "SELECT COUNT(1) FROM titles WHERE id = $id;";
                    checkTitle.Parameters.AddWithValue("$id", targetTitleId);
                    targetTitleExists = Convert.ToInt64(checkTitle.ExecuteScalar() ?? 0) > 0;
                }

                if (!targetTitleExists)
                {
                    UpsertTitleInternal(conn, tx, currentLocal.Title with { Id = targetTitleId });
                }

                using (var updateLogTitle = conn.CreateCommand())
                {
                    updateLogTitle.Transaction = tx;
                    updateLogTitle.CommandText = "UPDATE logs SET title_id = $target_title_id WHERE id = $log_id;";
                    updateLogTitle.Parameters.AddWithValue("$target_title_id", targetTitleId);
                    updateLogTitle.Parameters.AddWithValue("$log_id", canonicalLogId);
                    updateLogTitle.ExecuteNonQuery();
                }

                using (var updateHistTitle = conn.CreateCommand())
                {
                    updateHistTitle.Transaction = tx;
                    updateHistTitle.CommandText = "UPDATE log_history SET title_id = $target_title_id WHERE log_id = $log_id;";
                    updateHistTitle.Parameters.AddWithValue("$target_title_id", targetTitleId);
                    updateHistTitle.Parameters.AddWithValue("$log_id", canonicalLogId);
                    updateHistTitle.ExecuteNonQuery();
                }

                using (var deleteOrphanTitle = conn.CreateCommand())
                {
                    deleteOrphanTitle.Transaction = tx;
                    deleteOrphanTitle.CommandText = @"
                        DELETE FROM titles
                        WHERE id = $old_title_id
                          AND id != $target_title_id
                          AND NOT EXISTS (SELECT 1 FROM logs WHERE title_id = $old_title_id)
                          AND NOT EXISTS (SELECT 1 FROM log_history WHERE title_id = $old_title_id);
                    ";
                    deleteOrphanTitle.Parameters.AddWithValue("$old_title_id", currentLocal.TitleId);
                    deleteOrphanTitle.Parameters.AddWithValue("$target_title_id", targetTitleId);
                    deleteOrphanTitle.ExecuteNonQuery();
                }
            }

            // 4. Mark the canonical log row soft-deleted and synced.
            using (var markCmd = conn.CreateCommand())
            {
                markCmd.Transaction = tx;
                markCmd.CommandText = @"
                    UPDATE logs
                    SET deleted_at = $deleted_at,
                        updated_at = COALESCE($updated_at, updated_at),
                        sync_state = 'synced'
                    WHERE id = $id;
                ";
                markCmd.Parameters.AddWithValue("$deleted_at", deletedAt);
                markCmd.Parameters.AddWithValue("$updated_at", updatedAt);
                markCmd.Parameters.AddWithValue("$id", canonicalLogId);
                markCmd.ExecuteNonQuery();
            }

            tx.Commit();
        }
    }

    public void DeleteLogsByTitleExcept(string titleId, string keepLogId)
    {
        if (string.IsNullOrWhiteSpace(titleId) || string.IsNullOrWhiteSpace(keepLogId)) return;
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();

            using (var remapHist = conn.CreateCommand())
            {
                remapHist.Transaction = tx;
                remapHist.CommandText = @"
                    UPDATE log_history
                    SET log_id = $keepId
                    WHERE title_id = $titleId
                      AND log_id IN (SELECT id FROM logs WHERE title_id = $titleId AND id != $keepId AND deleted_at IS NULL);
                ";
                remapHist.Parameters.AddWithValue("$keepId", keepLogId);
                remapHist.Parameters.AddWithValue("$titleId", titleId);
                remapHist.ExecuteNonQuery();
            }

            using (var delLogs = conn.CreateCommand())
            {
                delLogs.Transaction = tx;
                delLogs.CommandText = "DELETE FROM logs WHERE title_id = $titleId AND id != $keepId AND deleted_at IS NULL;";
                delLogs.Parameters.AddWithValue("$titleId", titleId);
                delLogs.Parameters.AddWithValue("$keepId", keepLogId);
                delLogs.ExecuteNonQuery();
            }

            tx.Commit();
        }
    }

    public OutboxEvent UpsertLogOutbox(string type, string logId, string payloadJson)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();
            var evt = UpsertLogOutboxInternal(conn, tx, type, logId, payloadJson);
            tx.Commit();
            return evt;
        }
    }

    /// <summary>
    /// Atomically performs optional title/log ID remapping, history snapshot preservation,
    /// tie-conflict audit persistence, pending sync_state transition, and outbox enqueue inside
    /// a single SQLite transaction so a crash can never leave a recovery row without an outbox entry.
    /// </summary>
    public (WatchLog SavedLog, OutboxEvent Outbox) CommitRecoveryCandidateAtomic(
        WatchLog local,
        string outboxType,
        Func<WatchLog, string> payloadSerializer,
        string? targetTitleId = null,
        TitleSummary? canonicalTitle = null,
        string? targetLogId = null,
        WatchLog? extraHistorySnapshot = null,
        string? tieAuditKey = null,
        string? tieAuditJson = null)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();

            var currentTitleId = local.TitleId;
            var currentLogId = local.Id;

            if (!string.IsNullOrWhiteSpace(targetTitleId) &&
                !string.Equals(currentTitleId, targetTitleId, StringComparison.OrdinalIgnoreCase))
            {
                RemapTitleIdInternal(conn, tx, currentTitleId, targetTitleId, canonicalTitle);
                currentTitleId = targetTitleId;
            }

            if (!string.IsNullOrWhiteSpace(targetLogId) &&
                !string.Equals(currentLogId, targetLogId, StringComparison.OrdinalIgnoreCase))
            {
                RemapLogIdInternal(conn, tx, currentLogId, targetLogId, markSynced: false);
                currentLogId = targetLogId;
            }

            var resolved = GetLogInternal(conn, tx, currentLogId, includeDeleted: true) ?? local with
            {
                Id = currentLogId,
                TitleId = currentTitleId,
                Title = (canonicalTitle ?? local.Title) with { Id = currentTitleId }
            };

            if (extraHistorySnapshot != null)
            {
                EnsureHistorySnapshotInternal(conn, tx, extraHistorySnapshot with
                {
                    Id = resolved.Id,
                    TitleId = resolved.TitleId
                });
            }

            EnsureHistorySnapshotInternal(conn, tx, resolved);

            if (!string.IsNullOrWhiteSpace(tieAuditKey) && tieAuditJson != null)
            {
                SetAppSettingInternal(conn, tx, tieAuditKey, tieAuditJson);
            }

            using (var updateStateCmd = conn.CreateCommand())
            {
                updateStateCmd.Transaction = tx;
                updateStateCmd.CommandText = "UPDATE logs SET sync_state = 'pending', deleted_at = NULL WHERE id = $id;";
                updateStateCmd.Parameters.AddWithValue("$id", resolved.Id);
                updateStateCmd.ExecuteNonQuery();
            }

            var pendingLog = resolved with { SyncState = "pending", DeletedAt = null };
            var evt = UpsertLogOutboxInternal(conn, tx, outboxType, pendingLog.Id, payloadSerializer(pendingLog));

            tx.Commit();
            return (pendingLog, evt);
        }
    }

    private static void RemapTitleIdInternal(SqliteConnection conn, SqliteTransaction tx, string oldTitleId, string newTitleId, TitleSummary? canonicalTitle)
    {
        if (canonicalTitle != null)
        {
            UpsertTitleInternal(conn, tx, canonicalTitle with { Id = newTitleId });
        }
        else
        {
            using var copyCmd = conn.CreateCommand();
            copyCmd.Transaction = tx;
            copyCmd.CommandText = "UPDATE OR IGNORE titles SET id = $newId WHERE id = $oldId;";
            copyCmd.Parameters.AddWithValue("$newId", newTitleId);
            copyCmd.Parameters.AddWithValue("$oldId", oldTitleId);
            copyCmd.ExecuteNonQuery();
        }

        using (var updateLogs = conn.CreateCommand())
        {
            updateLogs.Transaction = tx;
            updateLogs.CommandText = "UPDATE logs SET title_id = $newId WHERE title_id = $oldId;";
            updateLogs.Parameters.AddWithValue("$newId", newTitleId);
            updateLogs.Parameters.AddWithValue("$oldId", oldTitleId);
            updateLogs.ExecuteNonQuery();
        }

        using (var updateHist = conn.CreateCommand())
        {
            updateHist.Transaction = tx;
            updateHist.CommandText = "UPDATE log_history SET title_id = $newId WHERE title_id = $oldId;";
            updateHist.Parameters.AddWithValue("$newId", newTitleId);
            updateHist.Parameters.AddWithValue("$oldId", oldTitleId);
            updateHist.ExecuteNonQuery();
        }

        using (var deleteOld = conn.CreateCommand())
        {
            deleteOld.Transaction = tx;
            deleteOld.CommandText = "DELETE FROM titles WHERE id = $oldId AND $oldId != $newId;";
            deleteOld.Parameters.AddWithValue("$oldId", oldTitleId);
            deleteOld.Parameters.AddWithValue("$newId", newTitleId);
            deleteOld.ExecuteNonQuery();
        }
    }

    private static void RemapLogIdInternal(SqliteConnection conn, SqliteTransaction tx, string oldLogId, string newLogId, bool markSynced)
    {
        var targetAlreadyExists = GetLogInternal(conn, tx, newLogId, includeDeleted: true) != null;

        using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = "UPDATE log_history SET log_id = $newId WHERE log_id = $oldId;";
            cmd.Parameters.AddWithValue("$newId", newLogId);
            cmd.Parameters.AddWithValue("$oldId", oldLogId);
            cmd.ExecuteNonQuery();
        }

        using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = "UPDATE outbox SET entity_id = $newId WHERE entity_id = $oldId;";
            cmd.Parameters.AddWithValue("$newId", newLogId);
            cmd.Parameters.AddWithValue("$oldId", oldLogId);
            cmd.ExecuteNonQuery();
        }

        if (targetAlreadyExists)
        {
            using (var delOld = conn.CreateCommand())
            {
                delOld.Transaction = tx;
                delOld.CommandText = "DELETE FROM logs WHERE id = $oldId;";
                delOld.Parameters.AddWithValue("$oldId", oldLogId);
                delOld.ExecuteNonQuery();
            }

            if (markSynced)
            {
                using var markCmd = conn.CreateCommand();
                markCmd.Transaction = tx;
                markCmd.CommandText = "UPDATE logs SET sync_state = 'synced' WHERE id = $newId;";
                markCmd.Parameters.AddWithValue("$newId", newLogId);
                markCmd.ExecuteNonQuery();
            }
        }
        else
        {
            using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = markSynced
                ? "UPDATE logs SET id = $newId, sync_state = 'synced' WHERE id = $oldId;"
                : "UPDATE logs SET id = $newId WHERE id = $oldId;";
            cmd.Parameters.AddWithValue("$newId", newLogId);
            cmd.Parameters.AddWithValue("$oldId", oldLogId);
            cmd.ExecuteNonQuery();
        }
    }

    private static OutboxEvent UpsertLogOutboxInternal(SqliteConnection conn, SqliteTransaction tx, string type, string logId, string payloadJson)
    {
        var evt = new OutboxEvent(
            Id: $"outbox:{Guid.NewGuid():N}",
            Type: type,
            EntityId: logId,
            PayloadJson: payloadJson,
            CreatedAt: DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        );

        using (var delCmd = conn.CreateCommand())
        {
            delCmd.Transaction = tx;
            delCmd.CommandText = "DELETE FROM outbox WHERE entity_id = $entity_id AND type IN ('UPSERT_LOG', 'UPDATE_LOG');";
            delCmd.Parameters.AddWithValue("$entity_id", logId);
            delCmd.ExecuteNonQuery();
        }

        using (var insCmd = conn.CreateCommand())
        {
            insCmd.Transaction = tx;
            insCmd.CommandText = @"
                INSERT INTO outbox (id, type, entity_id, payload_json, created_at, retry_count, last_error)
                VALUES ($id, $type, $entity_id, $payload_json, $created_at, 0, NULL);
            ";
            insCmd.Parameters.AddWithValue("$id", evt.Id);
            insCmd.Parameters.AddWithValue("$type", evt.Type);
            insCmd.Parameters.AddWithValue("$entity_id", evt.EntityId);
            insCmd.Parameters.AddWithValue("$payload_json", evt.PayloadJson);
            insCmd.Parameters.AddWithValue("$created_at", evt.CreatedAt);
            insCmd.ExecuteNonQuery();
        }

        return evt;
    }

    private static OutboxEvent EnqueueOutboxInternal(SqliteConnection conn, SqliteTransaction tx, string type, string entityId, string payloadJson)
    {
        var evt = new OutboxEvent(
            Id: $"outbox:{Guid.NewGuid():N}",
            Type: type,
            EntityId: entityId,
            PayloadJson: payloadJson,
            CreatedAt: DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        );

        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = @"
            INSERT INTO outbox (id, type, entity_id, payload_json, created_at, retry_count, last_error)
            VALUES ($id, $type, $entity_id, $payload_json, $created_at, 0, NULL);
        ";
        cmd.Parameters.AddWithValue("$id", evt.Id);
        cmd.Parameters.AddWithValue("$type", evt.Type);
        cmd.Parameters.AddWithValue("$entity_id", evt.EntityId);
        cmd.Parameters.AddWithValue("$payload_json", evt.PayloadJson);
        cmd.Parameters.AddWithValue("$created_at", evt.CreatedAt);
        cmd.ExecuteNonQuery();
        return evt;
    }

    private static void SetAppSettingInternal(SqliteConnection conn, SqliteTransaction? tx, string key, string? value)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        if (value == null)
        {
            cmd.CommandText = "DELETE FROM app_settings WHERE key = $key;";
            cmd.Parameters.AddWithValue("$key", key);
        }
        else
        {
            cmd.CommandText = @"
                INSERT INTO app_settings (key, value) VALUES ($key, $val)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            ";
            cmd.Parameters.AddWithValue("$key", key);
            cmd.Parameters.AddWithValue("$val", value);
        }
        cmd.ExecuteNonQuery();
    }

    public bool HasPendingLogOutbox(string logId)
    {
        if (string.IsNullOrWhiteSpace(logId)) return false;
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(1) FROM outbox WHERE entity_id = $entity_id AND type IN ('UPSERT_LOG', 'UPDATE_LOG');";
            cmd.Parameters.AddWithValue("$entity_id", logId);
            var count = Convert.ToInt64(cmd.ExecuteScalar() ?? 0);
            return count > 0;
        }
    }

    public OutboxEvent EnqueueOutbox(string type, string entityId, string payloadJson)
    {
        var evt = new OutboxEvent(
            Id: $"outbox:{Guid.NewGuid():N}",
            Type: type,
            EntityId: entityId,
            PayloadJson: payloadJson,
            CreatedAt: DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        );

        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO outbox (id, type, entity_id, payload_json, created_at, retry_count, last_error)
                VALUES ($id, $type, $entity_id, $payload_json, $created_at, 0, NULL);
            ";
            cmd.Parameters.AddWithValue("$id", evt.Id);
            cmd.Parameters.AddWithValue("$type", evt.Type);
            cmd.Parameters.AddWithValue("$entity_id", evt.EntityId);
            cmd.Parameters.AddWithValue("$payload_json", evt.PayloadJson);
            cmd.Parameters.AddWithValue("$created_at", evt.CreatedAt);
            cmd.ExecuteNonQuery();
        }

        return evt;
    }

    public IReadOnlyList<OutboxEvent> GetPendingOutbox()
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT * FROM outbox ORDER BY created_at ASC;";
            var list = new List<OutboxEvent>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new OutboxEvent(
                    Id: reader.GetString(reader.GetOrdinal("id")),
                    Type: reader.GetString(reader.GetOrdinal("type")),
                    EntityId: reader.GetString(reader.GetOrdinal("entity_id")),
                    PayloadJson: reader.GetString(reader.GetOrdinal("payload_json")),
                    CreatedAt: reader.GetString(reader.GetOrdinal("created_at")),
                    RetryCount: reader.GetInt32(reader.GetOrdinal("retry_count")),
                    LastError: GetNullableString(reader, "last_error")
                ));
            }
            return list;
        }
    }

    public void DeleteOutbox(string id)
    {
        DeleteOutboxIfExists(id);
    }

    public int DeleteOutboxIfExists(string id)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM outbox WHERE id = $id;";
            cmd.Parameters.AddWithValue("$id", id);
            return cmd.ExecuteNonQuery();
        }
    }

    public void EnsureHistorySnapshot(WatchLog log)
    {
        if (string.IsNullOrWhiteSpace(log.Id) || string.IsNullOrWhiteSpace(log.TitleId)) return;
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            EnsureHistorySnapshotInternal(conn, null, log);
        }
    }

    private static void EnsureHistorySnapshotInternal(SqliteConnection conn, SqliteTransaction? tx, WatchLog log)
    {
        if (string.IsNullOrWhiteSpace(log.Id) || string.IsNullOrWhiteSpace(log.TitleId)) return;
        using var checkCmd = conn.CreateCommand();
        checkCmd.Transaction = tx;
        checkCmd.CommandText = @"
            SELECT status, rating, note, spoiler, ott, place, occasion, season_number, episode_number, watched_on
            FROM log_history
            WHERE log_id = $log_id
            ORDER BY revision DESC, recorded_at DESC
            LIMIT 1;
        ";
        checkCmd.Parameters.AddWithValue("$log_id", log.Id);
        using (var reader = checkCmd.ExecuteReader())
        {
            if (reader.Read())
            {
                var hStatus = reader.GetString(0);
                var hRating = reader.IsDBNull(1) ? (double?)null : reader.GetDouble(1);
                var hNote = reader.IsDBNull(2) ? null : reader.GetString(2);
                var hSpoiler = reader.GetInt32(3) != 0;
                var hOtt = reader.IsDBNull(4) ? null : reader.GetString(4);
                var hPlace = reader.IsDBNull(5) ? null : reader.GetString(5);
                var hOccasion = reader.IsDBNull(6) ? null : reader.GetString(6);
                var hSeason = reader.IsDBNull(7) ? (int?)null : reader.GetInt32(7);
                var hEpisode = reader.IsDBNull(8) ? (int?)null : reader.GetInt32(8);
                var hWatchedOn = reader.GetString(9);

                static string Norm(string? v) => string.IsNullOrWhiteSpace(v) ? string.Empty : v.Trim();
                var sameRating = hRating.HasValue == log.Rating.HasValue &&
                                 (!hRating.HasValue || Math.Abs(hRating.Value - log.Rating!.Value) <= 0.05);
                if (string.Equals(hStatus, log.Status.ToWire(), StringComparison.OrdinalIgnoreCase) &&
                    sameRating &&
                    string.Equals(Norm(hNote), Norm(log.Note), StringComparison.Ordinal) &&
                    hSpoiler == log.Spoiler &&
                    string.Equals(Norm(hOtt), Norm(log.Ott), StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(Norm(hPlace), Norm(log.Place), StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(Norm(hOccasion), Norm(log.Occasion), StringComparison.OrdinalIgnoreCase) &&
                    hSeason == log.SeasonNumber &&
                    hEpisode == log.EpisodeNumber &&
                    string.Equals(Norm(hWatchedOn), Norm(log.WatchedOn), StringComparison.Ordinal))
                {
                    return;
                }
            }
        }

        var recordedAt = string.IsNullOrWhiteSpace(log.UpdatedAt)
            ? DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
            : log.UpdatedAt;
        var watchedOn = RecordDate.OccurredAtToWatchedOnDate(log.OccurredAt, log.WatchedOn);
        var occurredAt = string.IsNullOrWhiteSpace(log.OccurredAt) ? RecordDate.ToNoonUtcIso(watchedOn) : log.OccurredAt;

        using var histCmd = conn.CreateCommand();
        histCmd.Transaction = tx;
        histCmd.CommandText = @"
            INSERT INTO log_history (
                id, log_id, title_id, status, rating, reaction, ott, place, occasion,
                season_number, episode_number, note, spoiler, occurred_at, watched_on,
                revision, origin, recorded_at
            ) VALUES (
                $id, $log_id, $title_id, $status, $rating, $reaction, $ott, $place, $occasion,
                $season_number, $episode_number, $note, $spoiler, $occurred_at, $watched_on,
                $revision, $origin, $recorded_at
            );
        ";
        histCmd.Parameters.AddWithValue("$id", $"hist:{log.Id}:r{Math.Max(1, log.Revision)}:{Guid.NewGuid():N}");
        histCmd.Parameters.AddWithValue("$log_id", log.Id);
        histCmd.Parameters.AddWithValue("$title_id", log.TitleId);
        histCmd.Parameters.AddWithValue("$status", log.Status.ToWire());
        histCmd.Parameters.AddWithValue("$rating", (object?)log.Rating ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$reaction", (object?)log.Reaction ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$ott", (object?)log.Ott ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$place", (object?)log.Place ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$occasion", (object?)log.Occasion ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$season_number", (object?)log.SeasonNumber ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$episode_number", (object?)log.EpisodeNumber ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$note", (object?)log.Note ?? DBNull.Value);
        histCmd.Parameters.AddWithValue("$spoiler", log.Spoiler ? 1 : 0);
        histCmd.Parameters.AddWithValue("$occurred_at", occurredAt);
        histCmd.Parameters.AddWithValue("$watched_on", watchedOn);
        histCmd.Parameters.AddWithValue("$revision", Math.Max(1, log.Revision));
        histCmd.Parameters.AddWithValue("$origin", log.Origin.ToWire());
        histCmd.Parameters.AddWithValue("$recorded_at", recordedAt);
        histCmd.ExecuteNonQuery();
    }

    public void IncrementOutboxRetry(string id, string error)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE outbox SET retry_count = retry_count + 1, last_error = $err WHERE id = $id;";
            cmd.Parameters.AddWithValue("$err", error);
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
    }

    public void MarkOutboxStalePendingPull(string id)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE outbox SET last_error = $err WHERE id = $id;";
            cmd.Parameters.AddWithValue("$err", StalePendingPullMarker);
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
    }

    public LocalSettings LoadSettings()
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT value FROM app_settings WHERE key = 'local_settings' LIMIT 1;";
            var raw = cmd.ExecuteScalar() as string;
            if (!string.IsNullOrWhiteSpace(raw))
            {
                try
                {
                    var loaded = JsonSerializer.Deserialize<LocalSettings>(raw);
                    if (loaded != null)
                    {
                        var needsDeviceNormalization = string.IsNullOrWhiteSpace(loaded.DeviceId)
                                                       || (!Guid.TryParse(loaded.DeviceId, out _) && string.IsNullOrWhiteSpace(loaded.UserId));
                        var needsClientNormalization = string.IsNullOrWhiteSpace(loaded.ClientId)
                                                       || !Guid.TryParse(loaded.ClientId, out _);
                        if (needsDeviceNormalization || needsClientNormalization)
                        {
                            var normalized = loaded with
                            {
                                DeviceId = needsDeviceNormalization ? Guid.NewGuid().ToString("D") : loaded.DeviceId,
                                ClientId = needsClientNormalization ? Guid.NewGuid().ToString("D") : loaded.ClientId
                            };
                            SaveSettingsInternal(conn, normalized);
                            return normalized;
                        }
                        return loaded;
                    }
                }
                catch
                {
                    // Fall through to default settings
                }
            }

            var defaults = new LocalSettings(
                DeviceId: Guid.NewGuid().ToString("D"),
                DeviceName: $"{Environment.MachineName} (Windows Native)",
                ClientId: Guid.NewGuid().ToString("D")
            );
            SaveSettingsInternal(conn, defaults);
            return defaults;
        }
    }

    public void SaveSettings(LocalSettings settings)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            SaveSettingsInternal(conn, settings);
        }
    }

    public string? GetAppSetting(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT value FROM app_settings WHERE key = $key LIMIT 1;";
            cmd.Parameters.AddWithValue("$key", key);
            return cmd.ExecuteScalar() as string;
        }
    }

    public void SetAppSetting(string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            if (value == null)
            {
                cmd.CommandText = "DELETE FROM app_settings WHERE key = $key;";
                cmd.Parameters.AddWithValue("$key", key);
            }
            else
            {
                cmd.CommandText = @"
                    INSERT INTO app_settings (key, value) VALUES ($key, $val)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
                ";
                cmd.Parameters.AddWithValue("$key", key);
                cmd.Parameters.AddWithValue("$val", value);
            }
            cmd.ExecuteNonQuery();
        }
    }

    public static string NormalizeRecommendationLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language)) return "ko";
        return language.Trim().StartsWith("ko", StringComparison.OrdinalIgnoreCase) ? "ko" : "en";
    }

    private static string PendingRecommendationKey(string userId) =>
        $"recommendation_pending_requests:{userId.Trim().ToLowerInvariant()}";

    public PendingRecommendationAttempt? GetPendingRecommendationAttempt(string? userId, string? language)
    {
        if (string.IsNullOrWhiteSpace(userId)) return null;
        var lang = NormalizeRecommendationLanguage(language);
        var key = PendingRecommendationKey(userId);
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            var map = LoadPendingRecommendationMapInternal(conn, key);
            if (!map.TryGetValue(lang, out var attempt)) return null;
            return Guid.TryParse(attempt.RequestId, out _) ? attempt : null;
        }
    }

    public void SetPendingRecommendationAttempt(string? userId, string? language, PendingRecommendationAttempt? attempt)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;
        var lang = NormalizeRecommendationLanguage(language);
        var key = PendingRecommendationKey(userId);
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            var map = LoadPendingRecommendationMapInternal(conn, key);
            if (attempt == null || !Guid.TryParse(attempt.RequestId, out _))
            {
                map.Remove(lang);
            }
            else
            {
                map[lang] = attempt with
                {
                    RequestId = attempt.RequestId.Trim(),
                    BaselineGenerationId = string.IsNullOrWhiteSpace(attempt.BaselineGenerationId)
                        ? null
                        : attempt.BaselineGenerationId.Trim()
                };
            }

            using var cmd = conn.CreateCommand();
            if (map.Count == 0)
            {
                cmd.CommandText = "DELETE FROM app_settings WHERE key = $key;";
                cmd.Parameters.AddWithValue("$key", key);
            }
            else
            {
                cmd.CommandText = @"
                    INSERT INTO app_settings (key, value) VALUES ($key, $val)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
                ";
                cmd.Parameters.AddWithValue("$key", key);
                cmd.Parameters.AddWithValue("$val", JsonSerializer.Serialize(map));
            }
            cmd.ExecuteNonQuery();
        }
    }

    public void ClearPendingRecommendationAttempts(string? userId = null)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            if (string.IsNullOrWhiteSpace(userId))
            {
                cmd.CommandText = "DELETE FROM app_settings WHERE key LIKE 'recommendation_pending_requests:%';";
            }
            else
            {
                cmd.CommandText = "DELETE FROM app_settings WHERE key = $key;";
                cmd.Parameters.AddWithValue("$key", PendingRecommendationKey(userId));
            }
            cmd.ExecuteNonQuery();
        }
    }

    private static Dictionary<string, PendingRecommendationAttempt> LoadPendingRecommendationMapInternal(SqliteConnection conn, string key)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT value FROM app_settings WHERE key = $key LIMIT 1;";
        cmd.Parameters.AddWithValue("$key", key);
        var raw = cmd.ExecuteScalar() as string;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new Dictionary<string, PendingRecommendationAttempt>(StringComparer.OrdinalIgnoreCase);
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, PendingRecommendationAttempt>>(raw);
            if (parsed == null)
            {
                return new Dictionary<string, PendingRecommendationAttempt>(StringComparer.OrdinalIgnoreCase);
            }
            var filtered = new Dictionary<string, PendingRecommendationAttempt>(StringComparer.OrdinalIgnoreCase);
            foreach (var (langKey, attempt) in parsed)
            {
                if ((langKey is "ko" or "en") && attempt != null && Guid.TryParse(attempt.RequestId, out _))
                {
                    filtered[langKey] = attempt;
                }
            }
            return filtered;
        }
        catch
        {
            return new Dictionary<string, PendingRecommendationAttempt>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private static void SaveSettingsInternal(SqliteConnection conn, LocalSettings settings)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO app_settings (key, value) VALUES ('local_settings', $val)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        ";
        cmd.Parameters.AddWithValue("$val", JsonSerializer.Serialize(settings));
        cmd.ExecuteNonQuery();
    }

    public void ResetLocalData(bool preserveSettings = false)
    {
        lock (_syncRoot)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();
            using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = preserveSettings
                ? "DELETE FROM outbox; DELETE FROM log_history; DELETE FROM logs; DELETE FROM titles;"
                : "DELETE FROM outbox; DELETE FROM log_history; DELETE FROM logs; DELETE FROM titles; DELETE FROM app_settings;";
            cmd.ExecuteNonQuery();
            tx.Commit();
        }
    }

    private const string BaseLogJoinQuery = @"
        SELECT
            l.id AS l_id, l.title_id AS l_title_id, l.status AS l_status, l.rating AS l_rating,
            l.reaction AS l_reaction, l.ott AS l_ott, l.place AS l_place, l.occasion AS l_occasion,
            l.season_number AS l_season_number, l.episode_number AS l_episode_number,
            l.note AS l_note, l.spoiler AS l_spoiler, l.occurred_at AS l_occurred_at,
            l.watched_on AS l_watched_on, l.created_at AS l_created_at, l.updated_at AS l_updated_at,
            l.revision AS l_revision, l.origin AS l_origin, l.sync_state AS l_sync_state,
            l.deleted_at AS l_deleted_at,
            t.id AS t_id, t.provider AS t_provider, t.provider_id AS t_provider_id, t.type AS t_type,
            t.title AS t_title, t.original_title AS t_original_title, t.year AS t_year,
            t.poster_url AS t_poster_url, t.overview AS t_overview, t.genres_json AS t_genres_json,
            t.runtime_minutes AS t_runtime_minutes, t.authors_json AS t_authors_json,
            t.publisher AS t_publisher, t.isbn10 AS t_isbn10, t.isbn13 AS t_isbn13,
            t.pubdate AS t_pubdate, t.page_count AS t_page_count, t.kdc_code AS t_kdc_code,
            t.season_count AS t_season_count, t.episode_count AS t_episode_count
        FROM logs l
        INNER JOIN titles t ON t.id = l.title_id
    ";

    private static WatchLog? GetLogInternal(SqliteConnection conn, SqliteTransaction? tx, string id, bool includeDeleted = false)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        var deletedClause = includeDeleted ? "" : " AND l.deleted_at IS NULL";
        cmd.CommandText = BaseLogJoinQuery + $" WHERE l.id = $id{deletedClause} LIMIT 1;";
        cmd.Parameters.AddWithValue("$id", id);
        using var reader = cmd.ExecuteReader();
        return reader.Read() ? ReadWatchLogFromJoinReader(reader) : null;
    }

    private static WatchLog? GetLogByTitleIdInternal(SqliteConnection conn, SqliteTransaction? tx, string titleId)
    {
        if (string.IsNullOrWhiteSpace(titleId)) return null;
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = BaseLogJoinQuery + " WHERE l.title_id = $title_id AND l.deleted_at IS NULL ORDER BY l.updated_at DESC LIMIT 1;";
        cmd.Parameters.AddWithValue("$title_id", titleId);
        using var reader = cmd.ExecuteReader();
        return reader.Read() ? ReadWatchLogFromJoinReader(reader) : null;
    }

    private static WatchLog ReadWatchLogFromJoinReader(SqliteDataReader reader)
    {
        var title = ReadTitleFromReader(reader, "t_");
        return new WatchLog(
            Id: reader.GetString(reader.GetOrdinal("l_id")),
            TitleId: reader.GetString(reader.GetOrdinal("l_title_id")),
            Title: title,
            Status: LogStatusExtensions.FromWire(reader.GetString(reader.GetOrdinal("l_status"))),
            Rating: GetNullableDouble(reader, "l_rating"),
            Reaction: GetNullableString(reader, "l_reaction"),
            Ott: GetNullableString(reader, "l_ott"),
            Place: GetNullableString(reader, "l_place"),
            Occasion: GetNullableString(reader, "l_occasion"),
            SeasonNumber: GetNullableInt(reader, "l_season_number"),
            EpisodeNumber: GetNullableInt(reader, "l_episode_number"),
            Note: GetNullableString(reader, "l_note"),
            Spoiler: reader.GetInt32(reader.GetOrdinal("l_spoiler")) != 0,
            OccurredAt: reader.GetString(reader.GetOrdinal("l_occurred_at")),
            WatchedOn: reader.GetString(reader.GetOrdinal("l_watched_on")),
            CreatedAt: reader.GetString(reader.GetOrdinal("l_created_at")),
            UpdatedAt: reader.GetString(reader.GetOrdinal("l_updated_at")),
            Revision: reader.GetInt32(reader.GetOrdinal("l_revision")),
            Origin: LogOriginExtensions.FromWire(reader.GetString(reader.GetOrdinal("l_origin"))),
            SyncState: reader.GetString(reader.GetOrdinal("l_sync_state")),
            DeletedAt: GetNullableString(reader, "l_deleted_at")
        );
    }

    private static TitleSummary ReadTitleFromReader(SqliteDataReader reader, string prefix)
    {
        var genresJson = GetNullableString(reader, prefix + "genres_json") ?? "[]";
        var authorsJson = GetNullableString(reader, prefix + "authors_json") ?? "[]";
        var genres = DeserializeStringList(genresJson);
        var authors = DeserializeStringList(authorsJson);

        return new TitleSummary(
            Id: reader.GetString(reader.GetOrdinal(prefix + "id")),
            Provider: reader.GetString(reader.GetOrdinal(prefix + "provider")),
            ProviderId: reader.GetString(reader.GetOrdinal(prefix + "provider_id")),
            Type: TitleTypeExtensions.FromWire(reader.GetString(reader.GetOrdinal(prefix + "type"))),
            Title: reader.GetString(reader.GetOrdinal(prefix + "title")),
            OriginalTitle: GetNullableString(reader, prefix + "original_title"),
            Year: GetNullableInt(reader, prefix + "year"),
            PosterUrl: GetNullableString(reader, prefix + "poster_url"),
            Overview: GetNullableString(reader, prefix + "overview"),
            Genres: genres,
            RuntimeMinutes: GetNullableInt(reader, prefix + "runtime_minutes"),
            Authors: authors,
            Publisher: GetNullableString(reader, prefix + "publisher"),
            Isbn10: GetNullableString(reader, prefix + "isbn10"),
            Isbn13: GetNullableString(reader, prefix + "isbn13"),
            Pubdate: GetNullableString(reader, prefix + "pubdate"),
            PageCount: GetNullableInt(reader, prefix + "page_count"),
            KdcCode: GetNullableString(reader, prefix + "kdc_code"),
            SeasonCount: GetNullableInt(reader, prefix + "season_count"),
            EpisodeCount: GetNullableInt(reader, prefix + "episode_count")
        );
    }

    private static IReadOnlyList<string> DeserializeStringList(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? (IReadOnlyList<string>)Array.Empty<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private static string? GetNullableString(SqliteDataReader reader, string column)
    {
        var ord = reader.GetOrdinal(column);
        return reader.IsDBNull(ord) ? null : reader.GetString(ord);
    }

    private static int? GetNullableInt(SqliteDataReader reader, string column)
    {
        var ord = reader.GetOrdinal(column);
        return reader.IsDBNull(ord) ? null : reader.GetInt32(ord);
    }

    private static double? GetNullableDouble(SqliteDataReader reader, string column)
    {
        var ord = reader.GetOrdinal(column);
        return reader.IsDBNull(ord) ? null : reader.GetDouble(ord);
    }

    public void Dispose()
    {
        // Connections are opened per-operation with shared cache.
    }
}
