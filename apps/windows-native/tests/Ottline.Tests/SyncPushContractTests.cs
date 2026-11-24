using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Ottline.Core.Data;
using Ottline.Core.Domain;
using Ottline.Core.Local;
using Ottline.Core.Models;
using Ottline.Core.Remote;
using Xunit;

namespace Ottline.Tests;

public sealed class SyncPushContractTests
{
    private sealed record CapturedRequest(
        HttpMethod Method,
        string PathAndQuery,
        string? Body,
        string? UserAgent,
        string? UserId,
        string? DeviceId,
        string? ClientId,
        string? ClientPlatform,
        string? AcceptLanguage
    );

    private sealed class CapturingHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<CapturedRequest, CancellationToken, Task<HttpResponseMessage>> _responder;
        public ConcurrentQueue<CapturedRequest> Requests { get; } = new();

        public CapturingHttpMessageHandler(Func<CapturedRequest, CancellationToken, Task<HttpResponseMessage>> responder)
        {
            _responder = responder;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false)
                : null;
            static string? FirstHeader(HttpRequestMessage req, string name) =>
                req.Headers.TryGetValues(name, out var vals) ? vals.FirstOrDefault() : null;

            var captured = new CapturedRequest(
                Method: request.Method,
                PathAndQuery: request.RequestUri?.PathAndQuery ?? string.Empty,
                Body: body,
                UserAgent: request.Headers.UserAgent.ToString(),
                UserId: FirstHeader(request, "X-User-Id"),
                DeviceId: FirstHeader(request, "X-Device-Id"),
                ClientId: FirstHeader(request, "X-Client-Id"),
                ClientPlatform: FirstHeader(request, "X-Client-Platform"),
                AcceptLanguage: FirstHeader(request, "Accept-Language")
            );
            Requests.Enqueue(captured);
            return await _responder(captured, cancellationToken).ConfigureAwait(false);
        }
    }

    private static HttpResponseMessage JsonResponse(object payload, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

    private static (OttlineRepository Repo, OttlineDatabase Db, OttlineApiClient Api, string DbPath) CreateTempRepo(
        CapturingHttpMessageHandler handler,
        string userId = "11111111-2222-3333-4444-555555555555",
        string deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        string locale = "ko")
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"ottline_sync_test_{Guid.NewGuid():N}.db");
        var db = new OttlineDatabase(dbPath);
        db.SaveSettings(db.LoadSettings() with
        {
            BaseUrl = "https://mock.ottline.test",
            UserId = userId,
            DeviceId = deviceId,
            Locale = locale
        });
        var api = new OttlineApiClient(new HttpClient(handler));
        var repo = new OttlineRepository(db, api);
        return (repo, db, api, dbPath);
    }

    private static void CleanupDb(string dbPath)
    {
        try { if (File.Exists(dbPath)) File.Delete(dbPath); } catch { }
        try { if (File.Exists(dbPath + "-wal")) File.Delete(dbPath + "-wal"); } catch { }
        try { if (File.Exists(dbPath + "-shm")) File.Delete(dbPath + "-shm"); } catch { }
    }

    [Fact]
    public async Task PushSync_SendsExactServerChangesContract_WithValidUuidsAndNormalizedEnums()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        string? capturedPushBody = null;

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                capturedPushBody = req.Body;
                using var doc = JsonDocument.Parse(req.Body!);
                var logs = doc.RootElement.GetProperty("changes").GetProperty("logs");
                var titles = doc.RootElement.GetProperty("changes").GetProperty("titles");
                var accepted = logs.EnumerateArray().Select(l => l.GetProperty("id").GetString()!).ToList();
                // Simulate shared global title returning stale while user's logs are accepted
                var rejected = new[]
                {
                    new { id = titles[0].GetProperty("id").GetString()!, reason = "stale" }
                };
                return Task.FromResult(JsonResponse(new { accepted, rejected }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T09:00:00Z",
                    changes = new { logs = Array.Empty<object>(), titles = Array.Empty<object>() }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId, deviceId);
        try
        {
            var tmdbMovie = new TitleSummary(
                Id: "tmdb:movie:496243",
                Provider: "tmdb",
                ProviderId: "496243",
                Type: TitleType.movie,
                Title: "기생충",
                Year: 2019,
                PosterUrl: "https://image.tmdb.org/t/p/w342/poster.jpg",
                Genres: new[] { "드라마", "스릴러" }
            );
            var manualBook = TitleFallback.BuildManualBookMetadata("채식주의자", "한강", "창비", "9788936433598");

            repo.SaveLogLocalFirst(tmdbMovie, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-20",
                ott: "Netflix", place: "집", occasion: "심야", note: "최고의 연출");
            repo.SaveLogLocalFirst(manualBook, LogStatus.IN_PROGRESS, RecordFeeling.NEUTRAL, "2026-11-21",
                ott: "종이책", place: "카페", occasion: "혼자", note: "1부 읽는 중");

            var (ok, _) = await repo.SyncAllAsync();

            Assert.True(ok);
            Assert.NotNull(capturedPushBody);
            Assert.Equal(0, repo.GetPendingOutboxCount());
            Assert.All(repo.GetAllLogs(), l => Assert.Equal("synced", l.SyncState));

            using var pushDoc = JsonDocument.Parse(capturedPushBody!);
            var root = pushDoc.RootElement;
            Assert.False(root.TryGetProperty("mutations", out _));
            Assert.Equal(userId, root.GetProperty("userId").GetString());
            Assert.Equal(deviceId, root.GetProperty("deviceId").GetString());
            Assert.True(DateTimeOffset.TryParse(root.GetProperty("clientTime").GetString(), out _));

            var changes = root.GetProperty("changes");
            var titlesEl = changes.GetProperty("titles");
            var logsEl = changes.GetProperty("logs");
            Assert.Equal(2, titlesEl.GetArrayLength());
            Assert.Equal(2, logsEl.GetArrayLength());

            var movieTitleChange = titlesEl.EnumerateArray().Single(t => t.GetProperty("payload").GetProperty("name").GetString() == "기생충");
            Assert.True(Guid.TryParse(movieTitleChange.GetProperty("id").GetString(), out var movieTitleUuid));
            Assert.Equal("upsert", movieTitleChange.GetProperty("op").GetString());
            Assert.Equal("TMDB", movieTitleChange.GetProperty("payload").GetProperty("provider").GetString());
            Assert.Equal("496243", movieTitleChange.GetProperty("payload").GetProperty("providerId").GetString());
            Assert.Equal("movie", movieTitleChange.GetProperty("payload").GetProperty("type").GetString());

            var bookTitleChange = titlesEl.EnumerateArray().Single(t => t.GetProperty("payload").GetProperty("name").GetString() == "채식주의자");
            Assert.True(Guid.TryParse(bookTitleChange.GetProperty("id").GetString(), out _));
            Assert.Equal("LOCAL", bookTitleChange.GetProperty("payload").GetProperty("provider").GetString());
            Assert.Equal(JsonValueKind.Null, bookTitleChange.GetProperty("payload").GetProperty("providerId").ValueKind);
            Assert.Equal("한강", bookTitleChange.GetProperty("payload").GetProperty("author").GetString());
            Assert.Equal("9788936433598", bookTitleChange.GetProperty("payload").GetProperty("isbn13").GetString());

            var movieLogChange = logsEl.EnumerateArray().Single(l => l.GetProperty("payload").GetProperty("titleId").GetString() == movieTitleUuid.ToString("D"));
            Assert.True(Guid.TryParse(movieLogChange.GetProperty("id").GetString(), out _));
            Assert.Equal("upsert", movieLogChange.GetProperty("op").GetString());
            Assert.Equal("DONE", movieLogChange.GetProperty("payload").GetProperty("status").GetString());
            Assert.Equal("HOME", movieLogChange.GetProperty("payload").GetProperty("place").GetString());
            Assert.Equal("ETC", movieLogChange.GetProperty("payload").GetProperty("occasion").GetString());
            Assert.Equal("LOG", movieLogChange.GetProperty("payload").GetProperty("origin").GetString());
            Assert.Equal("최고의 연출", movieLogChange.GetProperty("payload").GetProperty("note").GetString());
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task PushSync_SilentEmptyAcceptedResponse_NeverDeletesOutboxOrMarksSynced()
    {
        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                return Task.FromResult(JsonResponse(new { accepted = Array.Empty<string>(), rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T09:05:00Z",
                    changes = new { logs = Array.Empty<object>(), titles = Array.Empty<object>() }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler);
        try
        {
            var title = TitleFallback.BuildManualVideoMetadata("미승인 기록 테스트", TitleType.movie, 2026);
            var saved = repo.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-22");

            var (ok, _) = await repo.SyncAllAsync();

            Assert.False(ok);
            var pending = db.GetPendingOutbox();
            Assert.Single(pending);
            Assert.Equal(1, pending[0].RetryCount);
            Assert.Contains("acknowledge", pending[0].LastError ?? string.Empty, StringComparison.OrdinalIgnoreCase);

            var persisted = db.GetLog(saved.Id);
            Assert.NotNull(persisted);
            Assert.NotEqual("synced", persisted!.SyncState);
            Assert.Equal("failed", persisted.SyncState);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task PushSync_RejectedStale_ClearsStaleOutboxAndPullsServerWinner()
    {
        var titleUuid = "aaaaaaaa-1111-2222-3333-444444444444";
        var logUuid = "bbbbbbbb-1111-2222-3333-444444444444";
        var pullQueries = new List<string>();

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                return Task.FromResult(JsonResponse(new
                {
                    accepted = Array.Empty<string>(),
                    rejected = new[] { new { id = logUuid, reason = "stale" } }
                }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                pullQueries.Add(req.PathAndQuery);
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T10:00:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new
                            {
                                id = titleUuid,
                                type = "movie",
                                name = "파묘",
                                year = 2024,
                                provider = "TMDB",
                                providerId = "838209"
                            }
                        },
                        logs = new[]
                        {
                            new
                            {
                                id = logUuid,
                                titleId = titleUuid,
                                status = "DONE",
                                rating = 4.5,
                                note = "모바일에서 최신 수정한 감상",
                                spoiler = false,
                                ott = "Netflix",
                                origin = "LOG",
                                watchedAt = "2026-11-21T12:00:00Z",
                                place = "HOME",
                                occasion = "ALONE",
                                createdAt = "2026-11-20T12:00:00Z",
                                updatedAt = "2026-11-22T09:59:00Z"
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler);
        try
        {
            // Simulate already-migrated client with a LastSyncCursor so stale must force full pull (no since param)
            db.SetAppSetting("sync_push_v2_recovery_done:11111111-2222-3333-4444-555555555555", "2026-11-20T00:00:00Z");
            repo.UpdateSettings(s => s with { LastSyncCursor = "2026-11-22T08:00:00Z" });

            var title = new TitleSummary(titleUuid, "tmdb", "838209", TitleType.movie, "파묘", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: logUuid,
                TitleId: titleUuid,
                Title: title,
                Status: LogStatus.IN_PROGRESS,
                Note: "오래된 Windows 오프라인 수정",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-21T08:00:00Z",
                SyncState: "pending"
            ), recordHistory: false);
            db.UpsertLogOutbox("UPDATE_LOG", logUuid, "{}");

            var (ok, _) = await repo.SyncAllAsync();

            Assert.True(ok);
            Assert.Equal(0, repo.GetPendingOutboxCount());
            Assert.Contains("/api/sync/pull", pullQueries); // full pull without ?since=...
            var updated = db.GetLog(logUuid);
            Assert.NotNull(updated);
            Assert.Equal("synced", updated!.SyncState);
            Assert.Equal("모바일에서 최신 수정한 감상", updated.Note);
            Assert.Equal(LogStatus.DONE, updated.Status);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task PushSync_RetryableRejectionAndServerError_RetainsOutboxUntilAccepted()
    {
        var attempt = 0;
        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                attempt++;
                using var doc = JsonDocument.Parse(req.Body!);
                var logId = doc.RootElement.GetProperty("changes").GetProperty("logs")[0].GetProperty("id").GetString()!;
                if (attempt == 1)
                {
                    return Task.FromResult(JsonResponse(new
                    {
                        accepted = Array.Empty<string>(),
                        rejected = new[] { new { id = logId, reason = "title_missing" } }
                    }));
                }
                if (attempt == 2)
                {
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError));
                }
                return Task.FromResult(JsonResponse(new
                {
                    accepted = new[] { logId },
                    rejected = Array.Empty<object>()
                }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T10:15:00Z",
                    changes = new { logs = Array.Empty<object>(), titles = Array.Empty<object>() }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler);
        try
        {
            var title = TitleFallback.BuildManualVideoMetadata("재시도 테스트", TitleType.movie, 2025);
            var saved = repo.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-22");

            var r1 = await repo.SyncAllAsync();
            Assert.False(r1.Success);
            Assert.Equal(1, db.GetPendingOutbox().Single().RetryCount);
            Assert.Equal("failed", db.GetLog(saved.Id)!.SyncState);

            var r2 = await repo.SyncAllAsync();
            Assert.False(r2.Success);
            Assert.Equal(2, db.GetPendingOutbox().Single().RetryCount);
            Assert.Equal("failed", db.GetLog(saved.Id)!.SyncState);

            var r3 = await repo.SyncAllAsync();
            Assert.True(r3.Success);
            Assert.Empty(db.GetPendingOutbox());
            Assert.Equal("synced", db.GetLog(saved.Id)!.SyncState);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyRecovery_ReuploadsMismarkedSyncedLogsOnce_WithoutDuplicatesOrOverwritingNewerServerEdits()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var serverTitleB = "22222222-2222-2222-2222-222222222222";
        var serverLogB = "33333333-3333-3333-3333-333333333333";
        var serverTitleC = "44444444-4444-4444-4444-444444444444";
        var serverLogC = "55555555-5555-5555-5555-555555555555";

        var pushedLogIds = new List<string>();
        var pushedLogNotes = new Dictionary<string, string?>();
        var pushedLogUpdatedAts = new Dictionary<string, string>();
        var pushedLogWatchedAts = new Dictionary<string, string>();
        var pushCallCount = 0;

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                pushCallCount++;
                using var doc = JsonDocument.Parse(req.Body!);
                var logs = doc.RootElement.GetProperty("changes").GetProperty("logs");
                var accepted = new List<string>();
                foreach (var l in logs.EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    accepted.Add(id);
                    pushedLogIds.Add(id);
                    pushedLogUpdatedAts[id] = l.GetProperty("updatedAt").GetString()!;
                    pushedLogNotes[id] = l.GetProperty("payload").GetProperty("note").GetString();
                    pushedLogWatchedAts[id] = l.GetProperty("payload").GetProperty("watchedAt").GetString()!;
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T11:00:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = serverTitleB, type = "movie", name = "더 베어", year = 2022, provider = "TMDB", providerId = "136315" },
                            new { id = serverTitleC, type = "book", name = "소년이 온다", year = 2014, provider = "KAKAO", providerId = "9788936434120", isbn13 = "9788936434120" }
                        },
                        logs = new object[]
                        {
                            new
                            {
                                id = serverLogB,
                                titleId = serverTitleB,
                                status = "IN_PROGRESS",
                                note = "Older server note B",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-18T12:00:00Z",
                                createdAt = "2026-11-18T12:00:00Z",
                                updatedAt = "2026-11-20T10:00:00Z"
                            },
                            new
                            {
                                id = serverLogC,
                                titleId = serverTitleC,
                                status = "DONE",
                                rating = 4.5,
                                note = "Newer mobile edit C",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-19T12:00:00Z",
                                createdAt = "2026-11-19T12:00:00Z",
                                updatedAt = "2026-11-22T05:00:00Z"
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            // Seed legacy 2.0.0.0/2.0.1.0 DB state: all 3 marked "synced", 0 outbox entries
            var titleA = new TitleSummary("tmdb:movie:666277", "tmdb", "666277", TitleType.movie, "패스트 라이브즈", Year: 2023);
            db.UpsertLog(new WatchLog(
                Id: "local-log:11112222333344445555666677778888",
                TitleId: titleA.Id,
                Title: titleA,
                Status: LogStatus.DONE,
                Rating: 4.5,
                Note: "Lost Windows log A",
                OccurredAt: "2026-11-17T12:00:00Z",
                WatchedOn: "2026-11-17",
                CreatedAt: "2026-11-17T12:00:00Z",
                UpdatedAt: "2026-11-17T13:30:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            var titleB = new TitleSummary("tmdb:movie:136315", "tmdb", "136315", TitleType.movie, "더 베어", Year: 2022);
            db.UpsertLog(new WatchLog(
                Id: "local-log:bbbb2222333344445555666677778888",
                TitleId: titleB.Id,
                Title: titleB,
                Status: LogStatus.DONE,
                Rating: 4.5,
                Note: "Newer Windows edit B",
                OccurredAt: "2026-11-18T12:00:00Z",
                WatchedOn: "2026-11-18",
                CreatedAt: "2026-11-18T12:00:00Z",
                UpdatedAt: "2026-11-21T10:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            var titleC = new TitleSummary(serverTitleC, "kakao", "9788936434120", TitleType.book, "소년이 온다", Year: 2014, Isbn13: "9788936434120");
            db.UpsertLog(new WatchLog(
                Id: serverLogC,
                TitleId: serverTitleC,
                Title: titleC,
                Status: LogStatus.IN_PROGRESS,
                Note: "Older Windows copy C",
                OccurredAt: "2026-11-19T12:00:00Z",
                WatchedOn: "2026-11-19",
                CreatedAt: "2026-11-19T12:00:00Z",
                UpdatedAt: "2026-11-19T10:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            Assert.Empty(db.GetPendingOutbox());

            // 1st sync: recovers A (missing) and B (newer local edit remapped to canonical serverLogB), does NOT push C
            var (ok1, _) = await repo.SyncAllAsync();
            Assert.True(ok1);
            Assert.Equal(1, pushCallCount);
            Assert.Equal(2, pushedLogIds.Count);

            var expectedUuidA = SyncIdNormalizer.EnsureUuid("local-log:11112222333344445555666677778888");
            Assert.Contains(expectedUuidA, pushedLogIds);
            Assert.Contains(serverLogB, pushedLogIds);
            Assert.DoesNotContain(serverLogC, pushedLogIds);

            Assert.Equal("Lost Windows log A", pushedLogNotes[expectedUuidA]);
            Assert.Equal("Newer Windows edit B", pushedLogNotes[serverLogB]);
            // Original historical watchedAt AND original local UpdatedAt (T2) are strictly preserved (never fabricated as UtcNow)
            Assert.StartsWith("2026-11-17T12:00:00", pushedLogWatchedAts[expectedUuidA]);
            Assert.StartsWith("2026-11-18T12:00:00", pushedLogWatchedAts[serverLogB]);
            Assert.StartsWith("2026-11-17T13:30:00", pushedLogUpdatedAts[expectedUuidA]);
            Assert.StartsWith("2026-11-21T10:00:00", pushedLogUpdatedAts[serverLogB]);

            // Server's newer copy of C wins cleanly locally
            var localC = db.GetLog(serverLogC);
            Assert.NotNull(localC);
            Assert.Equal("Newer mobile edit C", localC!.Note);
            Assert.Equal(LogStatus.DONE, localC.Status);

            // Recovery flag persisted -> 2nd sync does NOT re-push anything (0 duplicates)
            Assert.False(string.IsNullOrWhiteSpace(db.GetAppSetting($"sync_push_v2_recovery_done:{userId}")));
            var (ok2, _) = await repo.SyncAllAsync();
            Assert.True(ok2);
            Assert.Equal(1, pushCallCount);
            Assert.Equal(3, repo.GetAllLogs().Count);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task PullSync_HydratesMissingTitleSnapshotAndRemapsCanonicalServerIdsWithoutDuplicates()
    {
        var canonicalTitleId = "99999999-1111-2222-3333-444444444444";
        var canonicalLogId = "88888888-1111-2222-3333-444444444444";

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                // Incremental pull returns log without title snapshot in changes.titles
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T12:00:00Z",
                    changes = new
                    {
                        titles = Array.Empty<object>(),
                        logs = new[]
                        {
                            new
                            {
                                id = canonicalLogId,
                                titleId = canonicalTitleId,
                                status = "DONE",
                                rating = 4.5,
                                note = "Synced from phone",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-22T12:00:00Z",
                                createdAt = "2026-11-22T12:00:00Z",
                                updatedAt = "2026-11-22T12:00:00Z"
                            }
                        }
                    }
                }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery == $"/api/titles/{canonicalTitleId}")
            {
                return Task.FromResult(JsonResponse(new
                {
                    id = canonicalTitleId,
                    type = "movie",
                    name = "기생충",
                    year = 2019,
                    provider = "TMDB",
                    providerId = "496243"
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler);
        try
        {
            db.SetAppSetting("sync_push_v2_recovery_done:11111111-2222-3333-4444-555555555555", "2026-11-22T00:00:00Z");

            // Pre-existing local row under client title ID for the exact same TMDB movie
            var clientTitle = new TitleSummary("tmdb:movie:496243", "tmdb", "496243", TitleType.movie, "기생충", Year: 2019);
            db.UpsertLog(new WatchLog(
                Id: "77777777-1111-2222-3333-444444444444",
                TitleId: clientTitle.Id,
                Title: clientTitle,
                Status: LogStatus.IN_PROGRESS,
                Note: "Local initial",
                OccurredAt: "2026-11-21T12:00:00Z",
                WatchedOn: "2026-11-21",
                CreatedAt: "2026-11-21T12:00:00Z",
                UpdatedAt: "2026-11-21T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            var (ok, _) = await repo.SyncAllAsync();

            Assert.True(ok);
            var allLogs = repo.GetAllLogs();
            Assert.Single(allLogs); // Remapped cleanly, zero duplicates!
            Assert.Equal(canonicalLogId, allLogs[0].Id);
            Assert.Equal(canonicalTitleId, allLogs[0].TitleId);
            Assert.Equal("Synced from phone", allLogs[0].Note);
            Assert.Single(repo.GetHistoryForTitle(canonicalTitleId));
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task AnalyticsAndHeaders_SendFirstLogCreate_LogCreate_DynamicVersion_ClientId_SessionId_Locale()
    {
        var analyticsCalls = new ConcurrentQueue<CapturedRequest>();
        var firstTwoDone = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thirdDone = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/nalytic/events")
            {
                analyticsCalls.Enqueue(req);
                if (analyticsCalls.Count >= 2) firstTwoDone.TrySetResult(true);
                if (analyticsCalls.Count >= 3) thirdDone.TrySetResult(true);
            }
            return Task.FromResult(JsonResponse(new { eventId = Guid.NewGuid().ToString("D"), inserted = true }));
        });

        var (repo, db, api, dbPath) = CreateTempRepo(handler, locale: "en");
        try
        {
            api.AppVersion = "2.0.2.0";
            var settings = db.LoadSettings();
            Assert.True(Guid.TryParse(settings.ClientId, out _));

            // 1st log create -> first_log_create + log_create
            var title1 = TitleFallback.BuildManualVideoMetadata("Past Lives", TitleType.movie, 2023);
            repo.SaveLogLocalFirst(title1, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-20", note: "First log");
            await firstTwoDone.Task.WaitAsync(TimeSpan.FromSeconds(5));

            // Edit 1st log -> must NOT send log_polished or log_created
            repo.SaveLogLocalFirst(title1, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-20", note: "Polished log");

            // 2nd distinct log create -> log_create only (no second first_log_create)
            var title2 = TitleFallback.BuildManualBookMetadata("Human Acts", "Han Kang");
            repo.SaveLogLocalFirst(title2, LogStatus.WISHLIST, null, "2026-11-21");
            await thirdDone.Task.WaitAsync(TimeSpan.FromSeconds(5));
            await Task.Delay(150);

            var captured = analyticsCalls.ToArray();
            var eventNames = captured
                .Select(c => JsonDocument.Parse(c.Body!).RootElement.GetProperty("eventName").GetString()!)
                .ToList();

            Assert.Contains("first_log_create", eventNames);
            Assert.Equal(1, eventNames.Count(n => n == "first_log_create"));
            Assert.Equal(2, eventNames.Count(n => n == "log_create"));
            Assert.DoesNotContain("log_created", eventNames);
            Assert.DoesNotContain("log_polished", eventNames);

            foreach (var call in captured)
            {
                Assert.Equal("OttlineWindowsNative/2.0.2.0", call.UserAgent);
                Assert.Equal(settings.ClientId, call.ClientId);
                Assert.True(Guid.TryParse(call.ClientId, out _));

                using var doc = JsonDocument.Parse(call.Body!);
                var root = doc.RootElement;
                Assert.True(Guid.TryParse(root.GetProperty("eventId").GetString(), out _));
                Assert.Equal("pwa", root.GetProperty("platform").GetString());
                Assert.Equal(api.SessionId, root.GetProperty("sessionId").GetString());
                Assert.Equal("2.0.2.0", root.GetProperty("clientVersion").GetString());

                var props = root.GetProperty("properties");
                Assert.Equal("2.0.2.0", props.GetProperty("windowsAppVersion").GetString());
                Assert.Equal("en", props.GetProperty("locale").GetString());
                Assert.Equal("native", props.GetProperty("windowsRuntime").GetString());
            }
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task CreateDiscussionAndOfflineReactionOutbox_ReplayAgainstServerContract()
    {
        var serverTitleId = "cccccccc-1111-2222-3333-444444444444";
        var discussionId = "dddddddd-1111-2222-3333-444444444444";
        string? createDiscussionBody = null;
        string? createCommentBody = null;
        string? reactionPutBody = null;

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var accepted = doc.RootElement.GetProperty("changes").GetProperty("logs")
                    .EnumerateArray().Select(l => l.GetProperty("id").GetString()!).ToList();
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T12:30:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new { id = serverTitleId, type = "movie", name = "기생충", year = 2019, provider = "TMDB", providerId = "496243" }
                        },
                        logs = Array.Empty<object>()
                    }
                }));
            }
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/discussions")
            {
                createDiscussionBody = req.Body;
                return Task.FromResult(JsonResponse(new
                {
                    id = discussionId,
                    titleId = serverTitleId,
                    titleName = "기생충",
                    titleType = "movie",
                    commentCount = 0,
                    createdAt = "2026-11-22T12:30:00Z"
                }));
            }
            if (req.Method == HttpMethod.Post && req.PathAndQuery == $"/api/discussions/{discussionId}/comments")
            {
                createCommentBody = req.Body;
                return Task.FromResult(JsonResponse(new
                {
                    id = "eeeeeeee-1111-2222-3333-444444444444",
                    discussionId,
                    body = "함께 공유할 한 줄",
                    spoiler = true,
                    createdAt = "2026-11-22T12:30:01Z"
                }));
            }
            if (req.Method == HttpMethod.Put && req.PathAndQuery == $"/api/discussions/{discussionId}/reactions")
            {
                reactionPutBody = req.Body;
                return Task.FromResult(JsonResponse(new
                {
                    summary = new { done = 1, curious = 0, save = 0 },
                    selectedTypes = new[] { "DONE" },
                    selected = true
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler);
        try
        {
            var title = new TitleSummary("tmdb:movie:496243", "tmdb", "496243", TitleType.movie, "기생충", Year: 2019);
            repo.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-22",
                note: "함께 공유할 한 줄", spoiler: true, shareToTogether: true);
            repo.EnqueueOfflineDiscussionReaction(discussionId, DiscussionReactionType.DONE);

            var (ok, _) = await repo.SyncAllAsync();

            Assert.True(ok);
            Assert.Empty(db.GetPendingOutbox());

            Assert.NotNull(createDiscussionBody);
            using var discDoc = JsonDocument.Parse(createDiscussionBody!);
            Assert.Equal(serverTitleId, discDoc.RootElement.GetProperty("titleId").GetString());

            Assert.NotNull(createCommentBody);
            using var commentDoc = JsonDocument.Parse(createCommentBody!);
            Assert.Equal("함께 공유할 한 줄", commentDoc.RootElement.GetProperty("body").GetString());
            Assert.True(commentDoc.RootElement.GetProperty("spoiler").GetBoolean());
            Assert.False(commentDoc.RootElement.GetProperty("syncLog").GetBoolean());

            Assert.NotNull(reactionPutBody);
            using var reactDoc = JsonDocument.Parse(reactionPutBody!);
            Assert.Equal("DONE", reactDoc.RootElement.GetProperty("type").GetString());
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task StaleConflict_FullPull503_PersistsAcrossRestartAndIgnoresEmptyIncrementalUntilFullPullConfirmsWinner()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        var titleUuid = "aaaaaaaa-1111-2222-3333-444444444444";
        var logUuid = "bbbbbbbb-1111-2222-3333-444444444444";
        var initialCursor = "2026-11-22T08:00:00Z";

        var failFullPull = true;
        var pullPaths = new List<string>();
        var pushCount = 0;

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                pushCount++;
                return Task.FromResult(JsonResponse(new
                {
                    accepted = Array.Empty<string>(),
                    rejected = new[] { new { id = logUuid, reason = "stale" } }
                }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                pullPaths.Add(req.PathAndQuery);
                // If client ever mistakenly sends ?since=... (incremental pull), server returns empty!
                if (req.PathAndQuery.Contains("since=", StringComparison.Ordinal))
                {
                    return Task.FromResult(JsonResponse(new
                    {
                        serverTime = "2026-11-22T10:05:00Z",
                        changes = new { titles = Array.Empty<object>(), logs = Array.Empty<object>() }
                    }));
                }
                if (failFullPull)
                {
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
                }
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T10:10:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new { id = titleUuid, type = "movie", name = "파묘", year = 2024, provider = "TMDB", providerId = "838209" }
                        },
                        logs = new[]
                        {
                            new
                            {
                                id = logUuid,
                                titleId = titleUuid,
                                status = "DONE",
                                rating = 4.5,
                                note = "서버 정식 승자 감상",
                                spoiler = false,
                                ott = "Netflix",
                                origin = "LOG",
                                watchedAt = "2026-11-21T12:00:00Z",
                                place = "HOME",
                                occasion = "ALONE",
                                createdAt = "2026-11-20T12:00:00Z",
                                updatedAt = "2026-11-22T09:59:00Z"
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var dbPath = Path.Combine(Path.GetTempPath(), $"ottline_stale_503_{Guid.NewGuid():N}.db");
        try
        {
            // Session 1: push gets stale, then full pull returns 503
            using (var db1 = new OttlineDatabase(dbPath))
            using (var api1 = new OttlineApiClient(new HttpClient(handler)))
            using (var repo1 = new OttlineRepository(db1, api1))
            {
                db1.SaveSettings(db1.LoadSettings() with
                {
                    BaseUrl = "https://mock.ottline.test",
                    UserId = userId,
                    DeviceId = deviceId,
                    LastSyncCursor = initialCursor
                });
                db1.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-20T00:00:00Z");

                var title = new TitleSummary(titleUuid, "tmdb", "838209", TitleType.movie, "파묘", Year: 2024);
                db1.UpsertLog(new WatchLog(
                    Id: logUuid,
                    TitleId: titleUuid,
                    Title: title,
                    Status: LogStatus.IN_PROGRESS,
                    Note: "로컬 stale 수정",
                    OccurredAt: "2026-11-20T12:00:00Z",
                    WatchedOn: "2026-11-20",
                    CreatedAt: "2026-11-20T12:00:00Z",
                    UpdatedAt: "2026-11-21T08:00:00Z",
                    SyncState: "pending"
                ), recordHistory: true);
                db1.UpsertLogOutbox("UPDATE_LOG", logUuid, "{}");

                var (ok1, _) = await repo1.SyncAllAsync();
                Assert.False(ok1);
                Assert.Single(db1.GetPendingOutbox());
                Assert.Equal(OttlineDatabase.StalePendingPullMarker, db1.GetPendingOutbox()[0].LastError);
                Assert.Equal("1", db1.GetAppSetting($"sync_force_full_pull:{userId}"));
                Assert.Equal(initialCursor, repo1.GetSettings().LastSyncCursor);
                Assert.Equal("로컬 stale 수정", db1.GetLog(logUuid)!.Note);
            }

            // Simulate app restart with fresh DB/Repository instances; full pull now succeeds
            failFullPull = false;
            using (var db2 = new OttlineDatabase(dbPath))
            using (var api2 = new OttlineApiClient(new HttpClient(handler)))
            using (var repo2 = new OttlineRepository(db2, api2))
            {
                var (ok2, _) = await repo2.SyncAllAsync();
                Assert.True(ok2);
                Assert.Equal(1, pushCount); // Did NOT wastefully re-push stale entry; went straight to forced full pull!
                Assert.All(pullPaths, p => Assert.Equal("/api/sync/pull", p)); // Never fell back to empty incremental ?since=
                Assert.Empty(db2.GetPendingOutbox());
                Assert.Null(db2.GetAppSetting($"sync_force_full_pull:{userId}"));

                var converged = db2.GetLog(logUuid);
                Assert.NotNull(converged);
                Assert.Equal("synced", converged!.SyncState);
                Assert.Equal("서버 정식 승자 감상", converged.Note);
                Assert.Equal(LogStatus.DONE, converged.Status);
                // Local stale edit snapshot remains preserved in revision history
                Assert.Contains(repo2.GetHistoryForTitle(titleUuid), h => h.Note == "로컬 stale 수정");
            }
        }
        finally
        {
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task StaleConflict_FullPull503_ThenUserAdditionalEdit_PreservesNewerEditWithoutLoss()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        var titleUuid = "aaaaaaaa-1111-2222-3333-444444444444";
        var logUuid = "bbbbbbbb-1111-2222-3333-444444444444";

        var phase = 1;
        string? secondPushNote = null;

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var logEl = doc.RootElement.GetProperty("changes").GetProperty("logs")[0];
                if (phase == 1)
                {
                    return Task.FromResult(JsonResponse(new
                    {
                        accepted = Array.Empty<string>(),
                        rejected = new[] { new { id = logUuid, reason = "stale" } }
                    }));
                }
                secondPushNote = logEl.GetProperty("payload").GetProperty("note").GetString();
                return Task.FromResult(JsonResponse(new
                {
                    accepted = new[] { logUuid },
                    rejected = Array.Empty<object>()
                }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                if (phase == 1)
                {
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
                }
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T11:00:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new { id = titleUuid, type = "movie", name = "파묘", year = 2024, provider = "TMDB", providerId = "838209" }
                        },
                        logs = new[]
                        {
                            new
                            {
                                id = logUuid,
                                titleId = titleUuid,
                                status = "DONE",
                                rating = 4.5,
                                note = secondPushNote ?? "서버 정식 승자 감상",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-22T12:00:00Z",
                                createdAt = "2026-11-20T12:00:00Z",
                                updatedAt = "2026-11-22T10:59:00Z"
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var dbPath = Path.Combine(Path.GetTempPath(), $"ottline_stale_edit_{Guid.NewGuid():N}.db");
        try
        {
            var title = new TitleSummary(titleUuid, "tmdb", "838209", TitleType.movie, "파묘", Year: 2024);

            // Session 1: stale -> 503 full pull failure
            using (var db1 = new OttlineDatabase(dbPath))
            using (var api1 = new OttlineApiClient(new HttpClient(handler)))
            using (var repo1 = new OttlineRepository(db1, api1))
            {
                db1.SaveSettings(db1.LoadSettings() with
                {
                    BaseUrl = "https://mock.ottline.test",
                    UserId = userId,
                    DeviceId = deviceId,
                    LastSyncCursor = "2026-11-22T08:00:00Z"
                });
                db1.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-20T00:00:00Z");

                db1.UpsertLog(new WatchLog(
                    Id: logUuid,
                    TitleId: titleUuid,
                    Title: title,
                    Status: LogStatus.IN_PROGRESS,
                    Note: "1차 stale 수정",
                    OccurredAt: "2026-11-20T12:00:00Z",
                    WatchedOn: "2026-11-20",
                    CreatedAt: "2026-11-20T12:00:00Z",
                    UpdatedAt: "2026-11-21T08:00:00Z",
                    SyncState: "pending"
                ), recordHistory: true);
                db1.UpsertLogOutbox("UPDATE_LOG", logUuid, "{}");

                var (ok1, _) = await repo1.SyncAllAsync();
                Assert.False(ok1);
                Assert.Single(db1.GetPendingOutbox());
            }

            // Session 2 (after restart): user edits the same record BEFORE retry sync -> newer edit must NOT be lost!
            phase = 2;
            using (var db2 = new OttlineDatabase(dbPath))
            using (var api2 = new OttlineApiClient(new HttpClient(handler)))
            using (var repo2 = new OttlineRepository(db2, api2))
            {
                repo2.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-22", note: "재시작 후 추가 수정본");
                Assert.Single(db2.GetPendingOutbox());
                Assert.Null(db2.GetPendingOutbox()[0].LastError); // Replaced stale marker with fresh active mutation

                var (ok2, _) = await repo2.SyncAllAsync();
                Assert.True(ok2);
                Assert.Equal("재시작 후 추가 수정본", secondPushNote);
                Assert.Empty(db2.GetPendingOutbox());
                Assert.Equal("재시작 후 추가 수정본", db2.GetLog(logUuid)!.Note);
                Assert.Equal("synced", db2.GetLog(logUuid)!.SyncState);
            }
        }
        finally
        {
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task StaleConflict_UnconfirmedEmptyFullPull_RetainsStaleOutboxAndDoesNotAdvanceCursor()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var titleUuid = "aaaaaaaa-1111-2222-3333-444444444444";
        var logUuid = "bbbbbbbb-1111-2222-3333-444444444444";
        var initialCursor = "2026-11-22T08:00:00Z";

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                return Task.FromResult(JsonResponse(new
                {
                    accepted = Array.Empty<string>(),
                    rejected = new[] { new { id = logUuid, reason = "stale" } }
                }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                // Anomalous 200 empty full pull missing the conflicted log
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T12:00:00Z",
                    changes = new { titles = Array.Empty<object>(), logs = Array.Empty<object>() }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            db.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-20T00:00:00Z");
            repo.UpdateSettings(s => s with { LastSyncCursor = initialCursor });

            var title = new TitleSummary(titleUuid, "tmdb", "838209", TitleType.movie, "파묘", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: logUuid,
                TitleId: titleUuid,
                Title: title,
                Status: LogStatus.IN_PROGRESS,
                Note: "미확인 충돌 로컬 수정",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-21T08:00:00Z",
                SyncState: "pending"
            ), recordHistory: true);
            db.UpsertLogOutbox("UPDATE_LOG", logUuid, "{}");

            var (ok, _) = await repo.SyncAllAsync();

            Assert.False(ok);
            Assert.Single(db.GetPendingOutbox());
            Assert.Equal(OttlineDatabase.StalePendingPullMarker, db.GetPendingOutbox()[0].LastError);
            Assert.Equal("1", db.GetAppSetting($"sync_force_full_pull:{userId}"));
            Assert.Equal(initialCursor, repo.GetSettings().LastSyncCursor);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyRecovery_SubSecondNewerLocalEdits_AndExactTimestampTie_ArePreservedWithoutSilentOverwrite()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var titleHalfSec = "10000000-0000-0000-0000-000000000001";
        var logHalfSec = "20000000-0000-0000-0000-000000000001";
        var titleOneSec = "10000000-0000-0000-0000-000000000002";
        var logOneSec = "20000000-0000-0000-0000-000000000002";
        var titleTie = "10000000-0000-0000-0000-000000000003";
        var logTie = "20000000-0000-0000-0000-000000000003";

        var serverNotes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [logHalfSec] = "Server old (0.5s behind)",
            [logOneSec] = "Server old (1.0s behind)",
            [logTie] = "Server tie note"
        };
        var pushedById = new Dictionary<string, (string Note, string UpdatedAt)>(StringComparer.OrdinalIgnoreCase);

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var accepted = new List<string>();
                foreach (var l in doc.RootElement.GetProperty("changes").GetProperty("logs").EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    var note = l.GetProperty("payload").GetProperty("note").GetString()!;
                    var updatedAt = l.GetProperty("updatedAt").GetString()!;
                    pushedById[id] = (note, updatedAt);
                    serverNotes[id] = note;
                    accepted.Add(id);
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T12:00:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = titleHalfSec, type = "movie", name = "작품 0.5초", year = 2024, provider = "LOCAL" },
                            new { id = titleOneSec, type = "movie", name = "작품 1.0초", year = 2024, provider = "LOCAL" },
                            new { id = titleTie, type = "movie", name = "작품 동시각", year = 2024, provider = "LOCAL" }
                        },
                        logs = new object[]
                        {
                            new { id = logHalfSec, titleId = titleHalfSec, status = "DONE", note = serverNotes[logHalfSec], spoiler = false, origin = "LOG", watchedAt = "2026-11-20T12:00:00Z", createdAt = "2026-11-20T12:00:00Z", updatedAt = "2026-11-21T10:00:00.000Z" },
                            new { id = logOneSec, titleId = titleOneSec, status = "DONE", note = serverNotes[logOneSec], spoiler = false, origin = "LOG", watchedAt = "2026-11-20T12:00:00Z", createdAt = "2026-11-20T12:00:00Z", updatedAt = "2026-11-21T10:00:00.000Z" },
                            new { id = logTie, titleId = titleTie, status = "DONE", note = serverNotes[logTie], spoiler = false, origin = "LOG", watchedAt = "2026-11-20T12:00:00Z", createdAt = "2026-11-20T12:00:00Z", updatedAt = "2026-11-21T10:00:00.000Z" }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            // Seed 3 mis-marked "synced" local records with +0.5s, +1.0s, and exact 0.0s tie timestamps
            db.UpsertLog(new WatchLog(
                Id: logHalfSec, TitleId: titleHalfSec,
                Title: new TitleSummary(titleHalfSec, "local", "", TitleType.movie, "작품 0.5초", Year: 2024),
                Status: LogStatus.DONE, Note: "Local newer +0.5s",
                OccurredAt: "2026-11-20T12:00:00Z", WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z", UpdatedAt: "2026-11-21T10:00:00.500Z", SyncState: "synced"
            ), recordHistory: false);

            db.UpsertLog(new WatchLog(
                Id: logOneSec, TitleId: titleOneSec,
                Title: new TitleSummary(titleOneSec, "local", "", TitleType.movie, "작품 1.0초", Year: 2024),
                Status: LogStatus.DONE, Note: "Local newer +1.0s",
                OccurredAt: "2026-11-20T12:00:00Z", WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z", UpdatedAt: "2026-11-21T10:00:01.000Z", SyncState: "synced"
            ), recordHistory: false);

            db.UpsertLog(new WatchLog(
                Id: logTie, TitleId: titleTie,
                Title: new TitleSummary(titleTie, "local", "", TitleType.movie, "작품 동시각", Year: 2024),
                Status: LogStatus.DONE, Note: "Local tie note",
                OccurredAt: "2026-11-20T12:00:00Z", WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z", UpdatedAt: "2026-11-21T10:00:00.000Z", SyncState: "synced"
            ), recordHistory: false);

            var (ok, _) = await repo.SyncAllAsync();
            Assert.True(ok);

            // All three (+0.5s, +1.0s, and exact tie) must be recovered with their EXACT original timestamps!
            Assert.Equal(3, pushedById.Count);
            Assert.Equal("Local newer +0.5s", pushedById[logHalfSec].Note);
            Assert.StartsWith("2026-11-21T10:00:00.500", pushedById[logHalfSec].UpdatedAt);
            Assert.Equal("Local newer +1.0s", pushedById[logOneSec].Note);
            Assert.StartsWith("2026-11-21T10:00:01.000", pushedById[logOneSec].UpdatedAt);
            Assert.Equal("Local tie note", pushedById[logTie].Note);
            Assert.StartsWith("2026-11-21T10:00:00.000", pushedById[logTie].UpdatedAt);

            // Exact timestamp tie preserves BOTH server and local snapshots in history + durable conflict audit record
            var tieHistory = repo.GetHistoryForTitle(titleTie);
            Assert.Contains(tieHistory, h => h.Note == "Server tie note");
            Assert.Contains(tieHistory, h => h.Note == "Local tie note");
            var tieAudit = db.GetAppSetting($"sync_recovery_tie_conflicts:{userId}");
            Assert.False(string.IsNullOrWhiteSpace(tieAudit));
            Assert.Contains(logTie, tieAudit!);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyRecovery_ConcurrentOtherDeviceWriteAfterFullPull_DoesNotOverwriteNewerT3InBothExistingAndMissingCases()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var existingTitleId = "30000000-0000-0000-0000-000000000001";
        var existingLogId = "40000000-0000-0000-0000-000000000001";
        var missingTitleServerId = "30000000-0000-0000-0000-000000000002";
        var missingLogServerId = "40000000-0000-0000-0000-000000000002";

        // T0 < T2 (Windows local) < T3 (other device concurrent write arriving AFTER T1 full pull!)
        var t0 = DateTimeOffset.Parse("2026-11-20T10:00:00Z");
        var t2 = DateTimeOffset.Parse("2026-11-21T10:00:00Z");
        var t3 = DateTimeOffset.Parse("2026-11-22T09:00:00Z");

        var pullNumber = 0;
        var serverStore = new Dictionary<string, (string TitleId, string Note, DateTimeOffset UpdatedAt)>(StringComparer.OrdinalIgnoreCase)
        {
            [existingLogId] = (existingTitleId, "Server T0", t0)
        };
        var rejectedIdsObserved = new List<string>();

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                pullNumber++;
                if (pullNumber == 1)
                {
                    // T1 full pull: returns existingLogId at T0, and missingTitleServerId does NOT exist yet!
                    // Immediately after T1 returns, simulate another device writing T3 (> T2) for BOTH titles!
                    var response = JsonResponse(new
                    {
                        serverTime = "2026-11-22T08:59:00Z",
                        changes = new
                        {
                            titles = new[]
                            {
                                new { id = existingTitleId, type = "movie", name = "기존 작품", year = 2024, provider = "TMDB", providerId = "1001" }
                            },
                            logs = new[]
                            {
                                new { id = existingLogId, titleId = existingTitleId, status = "IN_PROGRESS", note = "Server T0", spoiler = false, origin = "LOG", watchedAt = "2026-11-20T12:00:00Z", createdAt = "2026-11-20T12:00:00Z", updatedAt = t0.ToString("O") }
                            }
                        }
                    });
                    serverStore[existingLogId] = (existingTitleId, "Other device T3 existing", t3);
                    serverStore[missingLogServerId] = (missingTitleServerId, "Other device T3 missing-at-T1", t3);
                    return Task.FromResult(response);
                }

                // Subsequent pull returns current server state (T3 winners!)
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-22T09:01:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = existingTitleId, type = "movie", name = "기존 작품", year = 2024, provider = "TMDB", providerId = "1001" },
                            new { id = missingTitleServerId, type = "movie", name = "동시 생성 작품", year = 2024, provider = "TMDB", providerId = "2002" }
                        },
                        logs = new object[]
                        {
                            new { id = existingLogId, titleId = existingTitleId, status = "DONE", note = serverStore[existingLogId].Note, spoiler = false, origin = "LOG", watchedAt = "2026-11-22T12:00:00Z", createdAt = "2026-11-20T12:00:00Z", updatedAt = serverStore[existingLogId].UpdatedAt.ToString("O") },
                            new { id = missingLogServerId, titleId = missingTitleServerId, status = "DONE", note = serverStore[missingLogServerId].Note, spoiler = false, origin = "LOG", watchedAt = "2026-11-22T12:00:00Z", createdAt = "2026-11-22T09:00:00Z", updatedAt = serverStore[missingLogServerId].UpdatedAt.ToString("O") }
                        }
                    }
                }));
            }

            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                // Faithful simulation of SyncService.isStale(server.updatedAt, null, incoming.updatedAt)
                using var doc = JsonDocument.Parse(req.Body!);
                var titles = doc.RootElement.GetProperty("changes").GetProperty("titles")
                    .EnumerateArray()
                    .ToDictionary(
                        t => t.GetProperty("id").GetString()!,
                        t => t.GetProperty("payload").GetProperty("providerId").GetString(),
                        StringComparer.OrdinalIgnoreCase);

                var accepted = new List<string>();
                var rejected = new List<object>();

                foreach (var l in doc.RootElement.GetProperty("changes").GetProperty("logs").EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    var titleId = l.GetProperty("payload").GetProperty("titleId").GetString()!;
                    var incomingUpdatedAt = DateTimeOffset.Parse(l.GetProperty("updatedAt").GetString()!);
                    var providerId = titles.TryGetValue(titleId, out var pid) ? pid : null;

                    var targetServerLogId = string.Equals(id, existingLogId, StringComparison.OrdinalIgnoreCase) || providerId == "1001"
                        ? existingLogId
                        : (providerId == "2002" ? missingLogServerId : id);

                    if (serverStore.TryGetValue(targetServerLogId, out var current) && current.UpdatedAt > incomingUpdatedAt)
                    {
                        rejected.Add(new { id, reason = "stale" });
                        rejectedIdsObserved.Add(id);
                    }
                    else
                    {
                        serverStore[targetServerLogId] = (current.TitleId ?? titleId, l.GetProperty("payload").GetProperty("note").GetString()!, incomingUpdatedAt);
                        accepted.Add(id);
                    }
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected }));
            }

            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            // Seed both legacy "synced" logs at T2 (< T3)
            db.UpsertLog(new WatchLog(
                Id: existingLogId, TitleId: existingTitleId,
                Title: new TitleSummary(existingTitleId, "tmdb", "1001", TitleType.movie, "기존 작품", Year: 2024),
                Status: LogStatus.DONE, Note: "Windows recovery T2 existing",
                OccurredAt: "2026-11-21T12:00:00Z", WatchedOn: "2026-11-21",
                CreatedAt: "2026-11-20T12:00:00Z", UpdatedAt: t2.ToString("O"), SyncState: "synced"
            ), recordHistory: false);

            var missingLocalTitle = new TitleSummary("tmdb:movie:2002", "tmdb", "2002", TitleType.movie, "동시 생성 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: "local-log:99998888777766665555444433332222", TitleId: missingLocalTitle.Id,
                Title: missingLocalTitle,
                Status: LogStatus.DONE, Note: "Windows recovery T2 missing-at-T1",
                OccurredAt: "2026-11-21T12:00:00Z", WatchedOn: "2026-11-21",
                CreatedAt: "2026-11-21T12:00:00Z", UpdatedAt: t2.ToString("O"), SyncState: "synced"
            ), recordHistory: false);

            var (ok, _) = await repo.SyncAllAsync();

            Assert.True(ok);
            Assert.Equal(2, rejectedIdsObserved.Count); // Both T2 recovery pushes were rejected stale by T3!
            Assert.Empty(db.GetPendingOutbox());

            // T3 MUST be 100% preserved on the server for BOTH existing and missing-at-T1 cases!
            Assert.Equal("Other device T3 existing", serverStore[existingLogId].Note);
            Assert.Equal("Other device T3 missing-at-T1", serverStore[missingLogServerId].Note);

            // And Windows local DB converges cleanly to T3 (with zero duplicates and T2 preserved in local history!)
            var allLogs = repo.GetAllLogs();
            Assert.Equal(2, allLogs.Count);
            Assert.Equal("Other device T3 existing", db.GetLog(existingLogId)!.Note);
            Assert.Equal("Other device T3 missing-at-T1", db.GetLog(missingLogServerId)!.Note);
            Assert.Contains(repo.GetHistoryForTitle(existingTitleId), h => h.Note == "Windows recovery T2 existing");
            Assert.Contains(repo.GetHistoryForTitle(missingTitleServerId), h => h.Note == "Windows recovery T2 missing-at-T1");
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyRecovery_InterruptedMidRecovery_OrphanedPendingRowsWithoutOutbox_AreRecoveredOnRestart()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        var existingTitleId = "50000000-0000-0000-0000-000000000001";
        var existingLogId = "60000000-0000-0000-0000-000000000001";
        var orphanPostRecoveryTitleId = "50000000-0000-0000-0000-000000000003";
        var orphanPostRecoveryLogId = "60000000-0000-0000-0000-000000000003";

        var pushedNotesById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var accepted = new List<string>();
                foreach (var l in doc.RootElement.GetProperty("changes").GetProperty("logs").EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    var note = l.GetProperty("payload").GetProperty("note").GetString()!;
                    pushedNotesById[id] = note;
                    accepted.Add(id);
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-23T05:00:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new { id = existingTitleId, type = "movie", name = "중단 복구 기존 작품", year = 2024, provider = "TMDB", providerId = "5551" }
                        },
                        logs = new[]
                        {
                            new
                            {
                                id = existingLogId,
                                titleId = existingTitleId,
                                status = "IN_PROGRESS",
                                note = "서버 구버전",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-20T12:00:00Z",
                                createdAt = "2026-11-20T12:00:00Z",
                                updatedAt = "2026-11-20T10:00:00Z"
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var dbPath = Path.Combine(Path.GetTempPath(), $"ottline_recovery_crash_{Guid.NewGuid():N}.db");
        try
        {
            var missingLegacyLogId = "local-log:aaaa1111bbbb2222cccc3333dddd4444";
            var expectedMissingUuid = SyncIdNormalizer.EnsureUuid(missingLegacyLogId);

            // Simulate a crash state where recovery switched BOTH rows (missing-on-server + newer local edit)
            // to sync_state='pending' BEFORE outbox rows were committed (0 outbox entries, recovery_done unset).
            using (var db1 = new OttlineDatabase(dbPath))
            {
                db1.SaveSettings(db1.LoadSettings() with
                {
                    BaseUrl = "https://mock.ottline.test",
                    UserId = userId,
                    DeviceId = deviceId
                });

                var missingTitle = new TitleSummary("tmdb:movie:5552", "tmdb", "5552", TitleType.movie, "중단 복구 누락 작품", Year: 2025);
                db1.UpsertLog(new WatchLog(
                    Id: missingLegacyLogId,
                    TitleId: missingTitle.Id,
                    Title: missingTitle,
                    Status: LogStatus.DONE,
                    Note: "종료 직전 누락 기록",
                    OccurredAt: "2026-11-21T12:00:00Z",
                    WatchedOn: "2026-11-21",
                    CreatedAt: "2026-11-21T12:00:00Z",
                    UpdatedAt: "2026-11-21T13:00:00Z",
                    SyncState: "pending"
                ), recordHistory: false);

                var existingTitle = new TitleSummary(existingTitleId, "tmdb", "5551", TitleType.movie, "중단 복구 기존 작품", Year: 2024);
                db1.UpsertLog(new WatchLog(
                    Id: existingLogId,
                    TitleId: existingTitleId,
                    Title: existingTitle,
                    Status: LogStatus.DONE,
                    Note: "종료 직전 최신 로컬 수정",
                    OccurredAt: "2026-11-20T12:00:00Z",
                    WatchedOn: "2026-11-20",
                    CreatedAt: "2026-11-20T12:00:00Z",
                    UpdatedAt: "2026-11-21T14:00:00Z",
                    SyncState: "pending"
                ), recordHistory: false);

                Assert.Empty(db1.GetPendingOutbox());
            }

            // App restarts -> recovery MUST pick up BOTH orphaned pending rows, commit atomically, and push both!
            using (var db2 = new OttlineDatabase(dbPath))
            using (var api2 = new OttlineApiClient(new HttpClient(handler)))
            using (var repo2 = new OttlineRepository(db2, api2))
            {
                var (ok, _) = await repo2.SyncAllAsync();

                Assert.True(ok);
                Assert.Equal("종료 직전 누락 기록", pushedNotesById[expectedMissingUuid]);
                Assert.Equal("종료 직전 최신 로컬 수정", pushedNotesById[existingLogId]);
                Assert.Empty(db2.GetPendingOutbox());
                Assert.All(repo2.GetAllLogs(), l => Assert.Equal("synced", l.SyncState));

                // Also verify post-recovery self-healing if an active row ever becomes orphaned pending without outbox
                var postOrphanTitle = new TitleSummary(orphanPostRecoveryTitleId, "local", "", TitleType.book, "복구 후 고아 행", Year: 2026);
                db2.UpsertLog(new WatchLog(
                    Id: orphanPostRecoveryLogId,
                    TitleId: orphanPostRecoveryTitleId,
                    Title: postOrphanTitle,
                    Status: LogStatus.DONE,
                    Note: "복구 완료 후 고아 재큐잉",
                    OccurredAt: "2026-11-22T12:00:00Z",
                    WatchedOn: "2026-11-22",
                    CreatedAt: "2026-11-22T12:00:00Z",
                    UpdatedAt: "2026-11-22T12:00:00Z",
                    SyncState: "pending"
                ), recordHistory: false);
                Assert.Empty(db2.GetPendingOutbox());

                var (ok2, _) = await repo2.SyncAllAsync();
                Assert.True(ok2);
                Assert.Equal("복구 완료 후 고아 재큐잉", pushedNotesById[orphanPostRecoveryLogId]);
                Assert.Equal("synced", db2.GetLog(orphanPostRecoveryLogId)!.SyncState);
            }
        }
        finally
        {
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task ServerDeletedLog_StaleConflictAndNormalPull_SoftDeletesLocallyPreservesHistoryAndAllowsSeparateSubsequentLog()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var titleUuid = "70000000-0000-0000-0000-000000000001";
        var deletedLogUuid = "80000000-0000-0000-0000-000000000001";
        var serverDeletedAt = "2026-11-22T10:00:00Z";

        var serverActiveLogs = new List<object>();
        var pushedLogIds = new List<string>();
        var pushAttempt = 0;

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                pushAttempt++;
                using var doc = JsonDocument.Parse(req.Body!);
                var logs = doc.RootElement.GetProperty("changes").GetProperty("logs");
                var accepted = new List<string>();
                var rejected = new List<object>();

                foreach (var l in logs.EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    pushedLogIds.Add(id);
                    if (pushAttempt == 1 && string.Equals(id, deletedLogUuid, StringComparison.OrdinalIgnoreCase))
                    {
                        rejected.Add(new { id, reason = "stale" });
                    }
                    else
                    {
                        accepted.Add(id);
                        serverActiveLogs.Add(new
                        {
                            id,
                            titleId = titleUuid,
                            status = l.GetProperty("payload").GetProperty("status").GetString(),
                            note = l.GetProperty("payload").GetProperty("note").GetString(),
                            spoiler = false,
                            origin = "LOG",
                            watchedAt = l.GetProperty("payload").GetProperty("watchedAt").GetString(),
                            createdAt = "2026-11-23T05:10:00Z",
                            updatedAt = l.GetProperty("updatedAt").GetString()
                        });
                    }
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected }));
            }

            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                var pullLogs = new List<object>
                {
                    new
                    {
                        id = deletedLogUuid,
                        titleId = titleUuid,
                        status = "DONE",
                        note = "삭제 전 서버 기록",
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-20T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = serverDeletedAt,
                        deletedAt = serverDeletedAt
                    }
                };
                pullLogs.AddRange(serverActiveLogs);

                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-23T05:15:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new { id = titleUuid, type = "movie", name = "삭제 동기화 작품", year = 2024, provider = "TMDB", providerId = "7771" }
                        },
                        logs = pullLogs
                    }
                }));
            }

            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            db.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-20T00:00:00Z");

            var title = new TitleSummary(titleUuid, "tmdb", "7771", TitleType.movie, "삭제 동기화 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: deletedLogUuid,
                TitleId: titleUuid,
                Title: title,
                Status: LogStatus.IN_PROGRESS,
                Note: "초기 로컬 기록",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            // Local offline edit before server soft-deletion -> stale rejected -> full pull confirms deletedAt
            db.UpsertLog(new WatchLog(
                Id: deletedLogUuid,
                TitleId: titleUuid,
                Title: title,
                Status: LogStatus.DONE,
                Note: "삭제 충돌 로컬 수정",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-21T12:00:00Z",
                Revision: 2,
                SyncState: "pending"
            ), recordHistory: true);
            db.UpsertLogOutbox("UPDATE_LOG", deletedLogUuid, "{}");

            var (ok1, _) = await repo.SyncAllAsync();
            Assert.True(ok1);
            Assert.Empty(db.GetPendingOutbox());

            // Deleted row MUST NOT remain in active timeline, while soft-deleted state + history remain preserved!
            Assert.Empty(repo.GetAllLogs());
            Assert.Null(db.GetLog(deletedLogUuid));
            var deletedRecord = db.GetLogIncludingDeleted(deletedLogUuid);
            Assert.NotNull(deletedRecord);
            Assert.Equal(serverDeletedAt, deletedRecord!.DeletedAt);
            Assert.Equal("synced", deletedRecord.SyncState);

            var historyAfterDelete = repo.GetHistoryForTitle(titleUuid);
            Assert.Contains(historyAfterDelete, h => h.Note == "초기 로컬 기록");
            Assert.Contains(historyAfterDelete, h => h.Note == "삭제 충돌 로컬 수정");

            // Subsequent local record for the SAME title must create a SEPARATE active log + separate outbox!
            var freshLog = repo.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-23", note: "삭제 후 새로 남긴 감상");
            Assert.NotEqual(deletedLogUuid, freshLog.Id);
            Assert.Null(freshLog.DeletedAt);
            var outboxAfterFresh = db.GetPendingOutbox();
            Assert.Single(outboxAfterFresh);
            Assert.Equal(freshLog.Id, outboxAfterFresh[0].EntityId);
            Assert.Equal("UPSERT_LOG", outboxAfterFresh[0].Type);

            var (ok2, _) = await repo.SyncAllAsync();
            Assert.True(ok2);
            Assert.Empty(db.GetPendingOutbox());
            Assert.Single(repo.GetAllLogs());
            Assert.Equal(freshLog.Id, repo.GetAllLogs()[0].Id);
            Assert.Equal("삭제 후 새로 남긴 감상", repo.GetAllLogs()[0].Note);

            // Old soft-deleted row stays soft-deleted AND combined history preserves all 3 snapshots!
            Assert.Equal(serverDeletedAt, db.GetLogIncludingDeleted(deletedLogUuid)!.DeletedAt);
            var finalHistory = repo.GetHistoryForTitle(titleUuid);
            Assert.Contains(finalHistory, h => h.Note == "초기 로컬 기록");
            Assert.Contains(finalHistory, h => h.Note == "삭제 충돌 로컬 수정");
            Assert.Contains(finalHistory, h => h.Note == "삭제 후 새로 남긴 감상");
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task ServerDeletedLog_WithConcurrentPendingLocalEdit_PreservesPendingOutboxAndActiveRow()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var titleUuid = "90000000-0000-0000-0000-000000000001";
        var logUuid = "91000000-0000-0000-0000-000000000001";

        OttlineRepository? repoRef = null;
        var title = new TitleSummary(titleUuid, "tmdb", "9991", TitleType.movie, "동시 수정 보호 작품", Year: 2024);
        var injectedConcurrentEdit = false;

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                return Task.FromResult(JsonResponse(new
                {
                    accepted = Array.Empty<string>(),
                    rejected = new[] { new { id = logUuid, reason = "stale" } }
                }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                // While full pull is in flight, user saves a brand new concurrent local edit on the same log!
                if (!injectedConcurrentEdit && repoRef != null)
                {
                    injectedConcurrentEdit = true;
                    repoRef.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-23", note: "pull 도중 동시 수정");
                }
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-23T05:20:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new { id = titleUuid, type = "movie", name = "동시 수정 보호 작품", year = 2024, provider = "TMDB", providerId = "9991" }
                        },
                        logs = new[]
                        {
                            new
                            {
                                id = logUuid,
                                titleId = titleUuid,
                                status = "DONE",
                                note = "서버 삭제 직전",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-20T12:00:00Z",
                                createdAt = "2026-11-20T12:00:00Z",
                                updatedAt = "2026-11-22T10:00:00Z",
                                deletedAt = "2026-11-22T10:00:00Z"
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        repoRef = repo;
        try
        {
            db.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-20T00:00:00Z");

            db.UpsertLog(new WatchLog(
                Id: logUuid,
                TitleId: titleUuid,
                Title: title,
                Status: LogStatus.IN_PROGRESS,
                Note: "오래된 stale 로컬 수정",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-21T10:00:00Z",
                SyncState: "pending"
            ), recordHistory: true);
            db.UpsertLogOutbox("UPDATE_LOG", logUuid, "{}");

            var (ok, _) = await repo.SyncAllAsync();

            Assert.True(ok);
            // Concurrent edit replaced staleEvt.Id with a new active outbox row -> MUST NOT be soft-deleted or dropped!
            var pending = db.GetPendingOutbox();
            Assert.Single(pending);
            Assert.Equal(logUuid, pending[0].EntityId);
            Assert.Null(pending[0].LastError);

            var active = db.GetLog(logUuid);
            Assert.NotNull(active);
            Assert.Null(active!.DeletedAt);
            Assert.Equal("pull 도중 동시 수정", active.Note);
            Assert.Equal("pending", active.SyncState);

            var history = repo.GetHistoryForTitle(titleUuid);
            Assert.Contains(history, h => h.Note == "오래된 stale 로컬 수정");
            Assert.Contains(history, h => h.Note == "pull 도중 동시 수정");
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyDeletedLog_FirstRecovery_SoftDeletesLocalLegacyIdPreservesHistoryAndStaysDeletedOnIncrementalSync()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var legacyTitleId = "tmdb:movie:7772";
        var serverTitleUuid = "71000000-0000-0000-0000-000000000001";
        var legacyLogId = "local-log:11112222333344445555666677778888";
        var canonicalLogUuid = SyncIdNormalizer.EnsureUuid(legacyLogId);
        var serverDeletedAt = "2026-11-22T10:00:00Z";

        var pushCount = 0;
        var pullPaths = new List<string>();

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                pushCount++;
                return Task.FromResult(JsonResponse(new { accepted = Array.Empty<string>(), rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                pullPaths.Add(req.PathAndQuery);
                // Incremental pull returns empty after cursor advances past serverDeletedAt
                if (req.PathAndQuery.Contains("since=", StringComparison.Ordinal))
                {
                    return Task.FromResult(JsonResponse(new
                    {
                        serverTime = "2026-11-23T06:05:00Z",
                        changes = new { titles = Array.Empty<object>(), logs = Array.Empty<object>() }
                    }));
                }

                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-23T06:00:00Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new { id = serverTitleUuid, type = "movie", name = "레거시 삭제 작품", year = 2024, provider = "TMDB", providerId = "7772" }
                        },
                        logs = new[]
                        {
                            new
                            {
                                id = canonicalLogUuid,
                                titleId = serverTitleUuid,
                                status = "DONE",
                                note = "서버에서 삭제된 구기록",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-20T12:00:00Z",
                                createdAt = "2026-11-20T12:00:00Z",
                                updatedAt = serverDeletedAt,
                                deletedAt = serverDeletedAt
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            // Fresh upgrade from 2.0.0.0/2.0.1.0: recovery_done unset, active legacy non-UUID log & title
            var legacyTitle = new TitleSummary(legacyTitleId, "tmdb", "7772", TitleType.movie, "레거시 삭제 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: legacyLogId,
                TitleId: legacyTitleId,
                Title: legacyTitle,
                Status: LogStatus.DONE,
                Note: "로컬 레거시 기록 (11/20)",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: false);

            var (ok1, _) = await repo.SyncAllAsync();
            Assert.True(ok1);
            Assert.Equal(0, pushCount);
            Assert.Empty(db.GetPendingOutbox());

            // Local legacy row MUST be remapped to canonical server UUID and soft-deleted (0 active rows)
            Assert.Empty(repo.GetAllLogs());
            Assert.Null(db.GetLogIncludingDeleted(legacyLogId));
            var deletedCanonical = db.GetLogIncludingDeleted(canonicalLogUuid);
            Assert.NotNull(deletedCanonical);
            Assert.Equal(serverTitleUuid, deletedCanonical!.TitleId);
            Assert.Equal(serverDeletedAt, deletedCanonical.DeletedAt);
            Assert.Equal("synced", deletedCanonical.SyncState);

            // Revision history MUST be preserved under the canonical log & title IDs
            var history = repo.GetHistoryForTitle(serverTitleUuid);
            Assert.Contains(history, h => h.LogId == canonicalLogUuid && h.Note == "로컬 레거시 기록 (11/20)");
            Assert.False(string.IsNullOrWhiteSpace(db.GetAppSetting($"sync_push_v2_recovery_done:{userId}")));

            // Subsequent sync after cursor advances MUST stay at 0 active logs with history intact
            // (even when the server returns no new changes)
            var (ok2, _) = await repo.SyncAllAsync();
            Assert.True(ok2);
            Assert.Equal(2, pullPaths.Count);
            Assert.Equal("/api/sync/pull", pullPaths[0]);
            Assert.Empty(repo.GetAllLogs());
            Assert.Contains(repo.GetHistoryForTitle(serverTitleUuid), h => h.LogId == canonicalLogUuid && h.Note == "로컬 레거시 기록 (11/20)");
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyDeletedLog_AlreadyMarkedRecoveryDoneAndCursorAdvanced_StillReconcilesLegacyDeletionOnUpgrade()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var serverTitleUuid = "72000000-0000-0000-0000-000000000001";
        var legacyLogId = "local-log:aaaa9999bbbb8888cccc7777dddd6666";
        var canonicalLogUuid = SyncIdNormalizer.EnsureUuid(legacyLogId);
        var healthyTitleUuid = "72000000-0000-0000-0000-000000000002";
        var healthyLogUuid = "72100000-0000-0000-0000-000000000002";
        var serverDeletedAt = "2026-11-22T10:00:00Z";

        var pushCount = 0;
        var pullPaths = new List<string>();

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                pushCount++;
                return Task.FromResult(JsonResponse(new { accepted = Array.Empty<string>(), rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                pullPaths.Add(req.PathAndQuery);
                // Incremental pull after cursor 2026-11-23T05:00:00Z does NOT return the 11/22 deletion
                if (req.PathAndQuery.Contains("since=", StringComparison.Ordinal))
                {
                    return Task.FromResult(JsonResponse(new
                    {
                        serverTime = "2026-11-23T06:20:00Z",
                        changes = new { titles = Array.Empty<object>(), logs = Array.Empty<object>() }
                    }));
                }

                // Full pull returns both the healthy active canonical log AND the 11/22 soft deletion
                // (even when server updatedAt wasn't bumped past deletedAt)
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-23T06:15:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = serverTitleUuid, type = "movie", name = "2.0.2.0 업그레이드 잔존 삭제 작품", year = 2024, provider = "TMDB", providerId = "7773" },
                            new { id = healthyTitleUuid, type = "movie", name = "정상 유지 작품", year = 2025, provider = "TMDB", providerId = "7779" }
                        },
                        logs = new object[]
                        {
                            new
                            {
                                id = canonicalLogUuid,
                                titleId = serverTitleUuid,
                                status = "DONE",
                                note = "이미 삭제된 서버 기록",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-20T12:00:00Z",
                                createdAt = "2026-11-20T12:00:00Z",
                                updatedAt = "2026-11-20T12:00:00Z",
                                deletedAt = serverDeletedAt
                            },
                            new
                            {
                                id = healthyLogUuid,
                                titleId = healthyTitleUuid,
                                status = "DONE",
                                note = "정상 유지되는 다른 작품 기록",
                                spoiler = false,
                                origin = "LOG",
                                watchedAt = "2026-11-21T12:00:00Z",
                                createdAt = "2026-11-21T12:00:00Z",
                                updatedAt = "2026-11-21T12:00:00Z"
                            }
                        }
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            // Exact state left by 2.0.2.0 (fa09d2e): recovery_done ALREADY set + LastSyncCursor advanced
            // past serverDeletedAt, alongside another active canonical UUID log so GetAllLogs().Count > 0,
            // while the legacy non-UUID log remained active with sync_state='synced'
            db.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-23T05:00:00Z");
            repo.UpdateSettings(s => s with { LastSyncCursor = "2026-11-23T05:00:00Z" });

            var title = new TitleSummary(serverTitleUuid, "tmdb", "7773", TitleType.movie, "2.0.2.0 업그레이드 잔존 삭제 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: legacyLogId,
                TitleId: serverTitleUuid,
                Title: title,
                Status: LogStatus.DONE,
                Note: "2.0.2.0에 잔존한 레거시 기록",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: false);

            var healthyTitle = new TitleSummary(healthyTitleUuid, "tmdb", "7779", TitleType.movie, "정상 유지 작품", Year: 2025);
            db.UpsertLog(new WatchLog(
                Id: healthyLogUuid,
                TitleId: healthyTitleUuid,
                Title: healthyTitle,
                Status: LogStatus.DONE,
                Note: "정상 유지되는 다른 작품 기록",
                OccurredAt: "2026-11-21T12:00:00Z",
                WatchedOn: "2026-11-21",
                CreatedAt: "2026-11-21T12:00:00Z",
                UpdatedAt: "2026-11-21T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: false);

            // Sync #1 after upgrade: MUST trigger a full pull for the stranded legacy non-UUID row and soft-delete it
            // even though recovery_done is already set, LastSyncCursor is advanced, and active count > 0!
            var (ok1, _) = await repo.SyncAllAsync();
            Assert.True(ok1);
            Assert.Equal(0, pushCount);
            Assert.Single(pullPaths);
            Assert.Equal("/api/sync/pull", pullPaths[0]);
            Assert.Empty(db.GetPendingOutbox());

            var activeAfterSync1 = repo.GetAllLogs();
            Assert.Single(activeAfterSync1);
            Assert.Equal(healthyLogUuid, activeAfterSync1[0].Id);
            Assert.Null(db.GetLogIncludingDeleted(legacyLogId));

            var deletedRow = db.GetLogIncludingDeleted(canonicalLogUuid);
            Assert.NotNull(deletedRow);
            Assert.Equal(serverDeletedAt, deletedRow!.DeletedAt);
            Assert.Equal("synced", deletedRow.SyncState);
            Assert.Contains(repo.GetHistoryForTitle(serverTitleUuid), h => h.LogId == canonicalLogUuid && h.Note == "2.0.2.0에 잔존한 레거시 기록");

            // Sync #2: zero legacy non-UUID active rows remain -> MUST immediately return to fast incremental pull!
            var (ok2, _) = await repo.SyncAllAsync();
            Assert.True(ok2);
            Assert.Equal(2, pullPaths.Count);
            Assert.StartsWith("/api/sync/pull?since=", pullPaths[1], StringComparison.Ordinal);
            var activeAfterSync2 = repo.GetAllLogs();
            Assert.Single(activeAfterSync2);
            Assert.Equal(healthyLogUuid, activeAfterSync2[0].Id);
            Assert.Equal(serverDeletedAt, db.GetLogIncludingDeleted(canonicalLogUuid)!.DeletedAt);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyDeletedLog_PreservesSeparateRecordOnSameTitle_AndAllowsSubsequentLocalRecord()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var sharedTitleUuid = "73000000-0000-0000-0000-000000000001";
        var legacyDeletedId = "local-log:deadbeef000011112222333344445555";
        var canonicalDeletedUuid = SyncIdNormalizer.EnsureUuid(legacyDeletedId);
        var separateActiveLogUuid = "73100000-0000-0000-0000-000000000002";

        var secondTitleUuid = "73000000-0000-0000-0000-000000000009";
        var secondLegacyDeletedId = "local-log:feedface000011112222333344445555";
        var secondCanonicalDeletedUuid = SyncIdNormalizer.EnsureUuid(secondLegacyDeletedId);

        var serverDeletedAt = "2026-11-22T10:00:00Z";
        var serverActiveLogs = new List<object>();

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var accepted = new List<string>();
                foreach (var l in doc.RootElement.GetProperty("changes").GetProperty("logs").EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    var tId = l.GetProperty("payload").GetProperty("titleId").GetString()!;
                    var note = l.GetProperty("payload").GetProperty("note").GetString()!;
                    accepted.Add(id);
                    serverActiveLogs.Add(new
                    {
                        id,
                        titleId = tId,
                        status = l.GetProperty("payload").GetProperty("status").GetString(),
                        note,
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = l.GetProperty("payload").GetProperty("watchedAt").GetString(),
                        createdAt = "2026-11-23T06:30:00Z",
                        updatedAt = l.GetProperty("updatedAt").GetString()
                    });
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                var logs = new List<object>
                {
                    new
                    {
                        id = canonicalDeletedUuid,
                        titleId = sharedTitleUuid,
                        status = "DONE",
                        note = "같은 작품의 삭제된 구기록",
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-20T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = serverDeletedAt,
                        deletedAt = serverDeletedAt
                    },
                    new
                    {
                        id = secondCanonicalDeletedUuid,
                        titleId = secondTitleUuid,
                        status = "DONE",
                        note = "재기록 대상 작품의 삭제된 구기록",
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-20T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = serverDeletedAt,
                        deletedAt = serverDeletedAt
                    }
                };
                logs.AddRange(serverActiveLogs);

                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-23T06:30:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = sharedTitleUuid, type = "movie", name = "같은 작품 별도 기록 보호", year = 2024, provider = "TMDB", providerId = "7774" },
                            new { id = secondTitleUuid, type = "movie", name = "삭제 후 후속 기록 작품", year = 2024, provider = "TMDB", providerId = "7775" }
                        },
                        logs
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            // Title 1: has BOTH the legacy record whose server UUID was deleted AND a SEPARATE active record on the SAME title!
            var sharedTitle = new TitleSummary(sharedTitleUuid, "tmdb", "7774", TitleType.movie, "같은 작품 별도 기록 보호", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: separateActiveLogUuid,
                TitleId: sharedTitleUuid,
                Title: sharedTitle,
                Status: LogStatus.DONE,
                Note: "같은 작품의 별도 활성 기록 (절대 삭제 금지)",
                OccurredAt: "2026-11-21T12:00:00Z",
                WatchedOn: "2026-11-21",
                CreatedAt: "2026-11-21T12:00:00Z",
                UpdatedAt: "2026-11-21T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            // Seed the distinct legacy record directly in SQLite so both rows coexist on sharedTitleUuid pre-sync
            using (var conn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={dbPath}"))
            {
                conn.Open();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    INSERT INTO logs (
                        id, title_id, status, spoiler, occurred_at, watched_on,
                        created_at, updated_at, revision, origin, sync_state, note
                    ) VALUES (
                        $id, $title_id, 'DONE', 0, '2026-11-20T12:00:00Z', '2026-11-20',
                        '2026-11-20T12:00:00Z', '2026-11-20T12:00:00Z', 1, 'LOG', 'synced',
                        '삭제될 레거시 구기록'
                    );
                ";
                cmd.Parameters.AddWithValue("$id", legacyDeletedId);
                cmd.Parameters.AddWithValue("$title_id", sharedTitleUuid);
                cmd.ExecuteNonQuery();
            }

            Assert.NotNull(db.GetLog(legacyDeletedId));
            Assert.NotNull(db.GetLog(separateActiveLogUuid));

            // Title 2: only has a legacy record whose server UUID was deleted
            var secondTitle = new TitleSummary(secondTitleUuid, "tmdb", "7775", TitleType.movie, "삭제 후 후속 기록 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: secondLegacyDeletedId,
                TitleId: secondTitleUuid,
                Title: secondTitle,
                Status: LogStatus.DONE,
                Note: "후속 기록 전 레거시 기록",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            var (ok1, _) = await repo.SyncAllAsync();
            Assert.True(ok1);
            Assert.Empty(db.GetPendingOutbox());

            // 1. On sharedTitle: legacyDeletedId is soft-deleted under canonicalDeletedUuid,
            //    while separateActiveLogUuid MUST stay active and synced (NEVER matched by titleId)!
            Assert.Null(db.GetLog(canonicalDeletedUuid));
            Assert.Equal(serverDeletedAt, db.GetLogIncludingDeleted(canonicalDeletedUuid)!.DeletedAt);
            var preservedSeparate = db.GetLog(separateActiveLogUuid);
            Assert.NotNull(preservedSeparate);
            Assert.Null(preservedSeparate!.DeletedAt);
            Assert.Equal("같은 작품의 별도 활성 기록 (절대 삭제 금지)", preservedSeparate.Note);
            Assert.Equal("synced", preservedSeparate.SyncState);

            var sharedHistory = repo.GetHistoryForTitle(sharedTitleUuid);
            Assert.Contains(sharedHistory, h => h.LogId == canonicalDeletedUuid && h.Note == "삭제될 레거시 구기록");
            Assert.Contains(sharedHistory, h => h.LogId == separateActiveLogUuid && h.Note == "같은 작품의 별도 활성 기록 (절대 삭제 금지)");

            // 2. On secondTitle: legacy record is soft-deleted -> user saves a subsequent new record cleanly!
            Assert.Null(db.GetLog(secondCanonicalDeletedUuid));
            Assert.Equal(serverDeletedAt, db.GetLogIncludingDeleted(secondCanonicalDeletedUuid)!.DeletedAt);

            var subsequentLog = repo.SaveLogLocalFirst(secondTitle, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-23", note: "삭제 후 새로 남긴 감상");
            Assert.NotEqual(secondCanonicalDeletedUuid, subsequentLog.Id);
            Assert.True(SyncIdNormalizer.IsValidUuid(subsequentLog.Id));

            var (ok2, _) = await repo.SyncAllAsync();
            Assert.True(ok2);
            Assert.Empty(db.GetPendingOutbox());

            Assert.Equal("삭제 후 새로 남긴 감상", db.GetLog(subsequentLog.Id)!.Note);
            Assert.Equal(serverDeletedAt, db.GetLogIncludingDeleted(secondCanonicalDeletedUuid)!.DeletedAt);
            var secondHistory = repo.GetHistoryForTitle(secondTitleUuid);
            Assert.Contains(secondHistory, h => h.LogId == secondCanonicalDeletedUuid && h.Note == "후속 기록 전 레거시 기록");
            Assert.Contains(secondHistory, h => h.LogId == subsequentLog.Id && h.Note == "삭제 후 새로 남긴 감상");
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task LegacyDeletedLog_NewerLocalEditAndConcurrentEditDuringPull_AreProtectedFromTombstone()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var newerTitleUuid = "74000000-0000-0000-0000-000000000001";
        var newerLegacyLogId = "local-log:12340000567800001234000056780001";
        var newerCanonicalUuid = SyncIdNormalizer.EnsureUuid(newerLegacyLogId);

        var concurrentTitleUuid = "74000000-0000-0000-0000-000000000002";
        var concurrentLegacyLogId = "local-log:12340000567800001234000056780002";
        var concurrentCanonicalUuid = SyncIdNormalizer.EnsureUuid(concurrentLegacyLogId);

        var serverDeletedAt = "2026-11-22T10:00:00Z";
        var localNewerUpdatedAt = "2026-11-23T01:00:00Z";

        OttlineRepository? repoRef = null;
        var concurrentTitle = new TitleSummary(concurrentTitleUuid, "tmdb", "7777", TitleType.movie, "풀 도중 동시 수정 레거시 작품", Year: 2024);
        var injectedConcurrentEdit = false;

        var pushedLogs = new Dictionary<string, (string Note, string UpdatedAt)>(StringComparer.OrdinalIgnoreCase);

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var accepted = new List<string>();
                foreach (var l in doc.RootElement.GetProperty("changes").GetProperty("logs").EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    var note = l.GetProperty("payload").GetProperty("note").GetString()!;
                    var updatedAt = l.GetProperty("updatedAt").GetString()!;
                    pushedLogs[id] = (note, updatedAt);
                    accepted.Add(id);
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                if (!injectedConcurrentEdit && repoRef != null)
                {
                    injectedConcurrentEdit = true;
                    // User edits the older legacy record concurrently WHILE the recovery full pull is in flight!
                    repoRef.SaveLogLocalFirst(concurrentTitle, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-23", note: "pull 중 레거시 동시 수정");
                }

                var logs = new List<object>();
                if (pushedLogs.TryGetValue(newerCanonicalUuid, out var revivedNewer))
                {
                    logs.Add(new
                    {
                        id = newerCanonicalUuid,
                        titleId = newerTitleUuid,
                        status = "DONE",
                        note = revivedNewer.Note,
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-23T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = revivedNewer.UpdatedAt
                    });
                }
                else
                {
                    logs.Add(new
                    {
                        id = newerCanonicalUuid,
                        titleId = newerTitleUuid,
                        status = "DONE",
                        note = "과거 삭제본",
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-20T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = serverDeletedAt,
                        deletedAt = serverDeletedAt
                    });
                }

                if (pushedLogs.TryGetValue(concurrentCanonicalUuid, out var revivedConcurrent))
                {
                    logs.Add(new
                    {
                        id = concurrentCanonicalUuid,
                        titleId = concurrentTitleUuid,
                        status = "DONE",
                        note = revivedConcurrent.Note,
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-23T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = revivedConcurrent.UpdatedAt
                    });
                }
                else
                {
                    logs.Add(new
                    {
                        id = concurrentCanonicalUuid,
                        titleId = concurrentTitleUuid,
                        status = "DONE",
                        note = "동시 수정 전 삭제본",
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-20T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = serverDeletedAt,
                        deletedAt = serverDeletedAt
                    });
                }

                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-23T07:00:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = newerTitleUuid, type = "movie", name = "삭제보다 최신 로컬 수정 작품", year = 2024, provider = "TMDB", providerId = "7776" },
                            new { id = concurrentTitleUuid, type = "movie", name = "풀 도중 동시 수정 레거시 작품", year = 2024, provider = "TMDB", providerId = "7777" }
                        },
                        logs
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        repoRef = repo;
        try
        {
            var newerTitle = new TitleSummary(newerTitleUuid, "tmdb", "7776", TitleType.movie, "삭제보다 최신 로컬 수정 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: newerLegacyLogId,
                TitleId: newerTitleUuid,
                Title: newerTitle,
                Status: LogStatus.DONE,
                Note: "서버 삭제 이후의 최신 로컬 수정",
                OccurredAt: "2026-11-23T12:00:00Z",
                WatchedOn: "2026-11-23",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: localNewerUpdatedAt,
                SyncState: "synced"
            ), recordHistory: true);

            db.UpsertLog(new WatchLog(
                Id: concurrentLegacyLogId,
                TitleId: concurrentTitleUuid,
                Title: concurrentTitle,
                Status: LogStatus.DONE,
                Note: "동시 수정 이전 구버전",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            var (ok, _) = await repo.SyncAllAsync();
            Assert.True(ok);
            Assert.Empty(db.GetPendingOutbox());

            // 1. Newer local edit (> serverDeletedAt) MUST be normalized to canonical UUID and pushed with EXACT original T2!
            Assert.True(pushedLogs.ContainsKey(newerCanonicalUuid));
            Assert.Equal("서버 삭제 이후의 최신 로컬 수정", pushedLogs[newerCanonicalUuid].Note);
            Assert.StartsWith("2026-11-23T01:00:00", pushedLogs[newerCanonicalUuid].UpdatedAt);
            var activeNewer = db.GetLog(newerCanonicalUuid);
            Assert.NotNull(activeNewer);
            Assert.Null(activeNewer!.DeletedAt);
            Assert.Equal("synced", activeNewer.SyncState);

            // 2. Concurrent local edit made during full pull MUST NOT be tombstoned; normalized and pushed cleanly!
            Assert.True(pushedLogs.ContainsKey(concurrentCanonicalUuid));
            Assert.Equal("pull 중 레거시 동시 수정", pushedLogs[concurrentCanonicalUuid].Note);
            var activeConcurrent = db.GetLog(concurrentCanonicalUuid);
            Assert.NotNull(activeConcurrent);
            Assert.Null(activeConcurrent!.DeletedAt);
            Assert.Equal("synced", activeConcurrent.SyncState);
            var concurrentHistory = repo.GetHistoryForTitle(concurrentTitleUuid);
            Assert.Contains(concurrentHistory, h => h.Note == "동시 수정 이전 구버전");
            Assert.Contains(concurrentHistory, h => h.Note == "pull 중 레거시 동시 수정");
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task ServerDeletedLog_EditSavedBetweenPreCheckAndDeleteTransaction_PreservesActiveRecordOutboxAndUploadsOnce()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var legacyTitleUuid = "75000000-0000-0000-0000-000000000001";
        var legacyLogId = "local-log:face0000111122223333444455556666";
        var canonicalLegacyUuid = SyncIdNormalizer.EnsureUuid(legacyLogId);

        var canonicalTitleUuid = "75000000-0000-0000-0000-000000000002";
        var canonicalLogUuid = "75100000-0000-0000-0000-000000000002";
        var serverDeletedAt = "2026-11-22T10:00:00Z";

        var uploadedLogs = new List<(string Id, string Note)>();
        var serverActiveById = new Dictionary<string, (string TitleId, string Note, string UpdatedAt)>(StringComparer.OrdinalIgnoreCase);

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var accepted = new List<string>();
                foreach (var l in doc.RootElement.GetProperty("changes").GetProperty("logs").EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    var tId = l.GetProperty("payload").GetProperty("titleId").GetString()!;
                    var note = l.GetProperty("payload").GetProperty("note").GetString()!;
                    var updatedAt = l.GetProperty("updatedAt").GetString()!;
                    uploadedLogs.Add((id, note));
                    serverActiveById[id] = (tId, note, updatedAt);
                    accepted.Add(id);
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                var logs = new List<object>();
                foreach (var (id, titleId) in new[] { (canonicalLegacyUuid, legacyTitleUuid), (canonicalLogUuid, canonicalTitleUuid) })
                {
                    if (serverActiveById.TryGetValue(id, out var revived))
                    {
                        logs.Add(new
                        {
                            id,
                            titleId = revived.TitleId,
                            status = "DONE",
                            note = revived.Note,
                            spoiler = false,
                            origin = "LOG",
                            watchedAt = "2026-11-24T12:00:00Z",
                            createdAt = "2026-11-20T12:00:00Z",
                            updatedAt = revived.UpdatedAt
                        });
                    }
                    else
                    {
                        logs.Add(new
                        {
                            id,
                            titleId,
                            status = "DONE",
                            note = "서버 삭제본",
                            spoiler = false,
                            origin = "LOG",
                            watchedAt = "2026-11-20T12:00:00Z",
                            createdAt = "2026-11-20T12:00:00Z",
                            updatedAt = serverDeletedAt,
                            deletedAt = serverDeletedAt
                        });
                    }
                }

                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-24T01:30:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = legacyTitleUuid, type = "movie", name = "삭제 트랜잭션 경합 레거시 작품", year = 2024, provider = "TMDB", providerId = "7801" },
                            new { id = canonicalTitleUuid, type = "movie", name = "삭제 트랜잭션 경합 정식 UUID 작품", year = 2024, provider = "TMDB", providerId = "7802" }
                        },
                        logs
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            db.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-23T05:00:00Z");

            var legacyTitle = new TitleSummary(legacyTitleUuid, "tmdb", "7801", TitleType.movie, "삭제 트랜잭션 경합 레거시 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: legacyLogId,
                TitleId: legacyTitleUuid,
                Title: legacyTitle,
                Status: LogStatus.DONE,
                Note: "기존 레거시 감상 (11/20)",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            var canonicalTitle = new TitleSummary(canonicalTitleUuid, "tmdb", "7802", TitleType.movie, "삭제 트랜잭션 경합 정식 UUID 작품", Year: 2024);
            db.UpsertLog(new WatchLog(
                Id: canonicalLogUuid,
                TitleId: canonicalTitleUuid,
                Title: canonicalTitle,
                Status: LogStatus.DONE,
                Note: "기존 정식 UUID 감상 (11/20)",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            // Exact TOCTOU interleaving from HQ PR #172 review:
            // 1) Pre-check reads rows and confirms empty outbox
            var staleLegacySnapshot = Assert.Single(db.FindLogsByIdentityIncludingDeleted(canonicalLegacyUuid));
            var staleCanonicalSnapshot = Assert.Single(db.FindLogsByIdentityIncludingDeleted(canonicalLogUuid));
            Assert.Empty(db.GetPendingOutbox());

            // 2) Immediately BEFORE ApplyServerDeletedLogAtomic acquires the transaction,
            //    user saves newer edits via SaveLogLocalFirst on BOTH records!
            repo.SaveLogLocalFirst(legacyTitle, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-24", note: "삭제 직전 저장한 레거시 새 감상");
            repo.SaveLogLocalFirst(canonicalTitle, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-24", note: "삭제 직전 저장한 정식 새 감상");
            Assert.Equal(2, db.GetPendingOutbox().Count);

            // 3) ApplyServerDeletedLogAtomic runs with the pre-check snapshots -> MUST abort INSIDE tx!
            var legacyDeletedApplied = db.ApplyServerDeletedLogAtomic(
                staleLegacySnapshot,
                new SyncDeletedLog(canonicalLegacyUuid, legacyTitleUuid, serverDeletedAt, serverDeletedAt));
            var canonicalDeletedApplied = db.ApplyServerDeletedLogAtomic(
                staleCanonicalSnapshot,
                new SyncDeletedLog(canonicalLogUuid, canonicalTitleUuid, serverDeletedAt, serverDeletedAt));

            Assert.False(legacyDeletedApplied);
            Assert.False(canonicalDeletedApplied);
            Assert.Equal(2, repo.GetAllLogs().Count);
            Assert.Equal(2, db.GetPendingOutbox().Count);

            // 4) Next normal SyncAllAsync MUST upload EACH new edit ONCE and keep BOTH active & synced!
            var (ok, _) = await repo.SyncAllAsync();
            Assert.True(ok);
            Assert.Empty(db.GetPendingOutbox());
            Assert.Equal(2, uploadedLogs.Count);
            Assert.Contains(uploadedLogs, u => u.Id == canonicalLegacyUuid && u.Note == "삭제 직전 저장한 레거시 새 감상");
            Assert.Contains(uploadedLogs, u => u.Id == canonicalLogUuid && u.Note == "삭제 직전 저장한 정식 새 감상");

            var syncedLegacy = db.GetLog(canonicalLegacyUuid);
            Assert.NotNull(syncedLegacy);
            Assert.Null(syncedLegacy!.DeletedAt);
            Assert.Equal("synced", syncedLegacy.SyncState);
            Assert.Equal("삭제 직전 저장한 레거시 새 감상", syncedLegacy.Note);

            var syncedCanonical = db.GetLog(canonicalLogUuid);
            Assert.NotNull(syncedCanonical);
            Assert.Null(syncedCanonical!.DeletedAt);
            Assert.Equal("synced", syncedCanonical.SyncState);
            Assert.Equal("삭제 직전 저장한 정식 새 감상", syncedCanonical.Note);

            // Follow-up sync must not re-upload already synced edits
            var (ok2, _) = await repo.SyncAllAsync();
            Assert.True(ok2);
            Assert.Equal(2, uploadedLogs.Count);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task ServerDeletedLog_DeleteAppliedFirst_ThenSubsequentOrStaleDraftSave_CreatesSeparateRecordPreservesHistoryAndUploadsOnce()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var title1Uuid = "76000000-0000-0000-0000-000000000001";
        var legacy1Id = "local-log:cafe0000111122223333444455556661";
        var canonical1Uuid = SyncIdNormalizer.EnsureUuid(legacy1Id);

        var title2Uuid = "76000000-0000-0000-0000-000000000002";
        var legacy2Id = "local-log:cafe0000111122223333444455556662";
        var canonical2Uuid = SyncIdNormalizer.EnsureUuid(legacy2Id);

        var serverDeletedAt = "2026-11-22T10:00:00Z";
        var uploadedLogs = new List<(string Id, string Note)>();
        var serverActiveLogs = new List<object>();

        var handler = new CapturingHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.PathAndQuery == "/api/sync/push")
            {
                using var doc = JsonDocument.Parse(req.Body!);
                var accepted = new List<string>();
                foreach (var l in doc.RootElement.GetProperty("changes").GetProperty("logs").EnumerateArray())
                {
                    var id = l.GetProperty("id").GetString()!;
                    var tId = l.GetProperty("payload").GetProperty("titleId").GetString()!;
                    var note = l.GetProperty("payload").GetProperty("note").GetString()!;
                    uploadedLogs.Add((id, note));
                    serverActiveLogs.Add(new
                    {
                        id,
                        titleId = tId,
                        status = "DONE",
                        note,
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-24T12:00:00Z",
                        createdAt = "2026-11-24T01:40:00Z",
                        updatedAt = l.GetProperty("updatedAt").GetString()
                    });
                    accepted.Add(id);
                }
                return Task.FromResult(JsonResponse(new { accepted, rejected = Array.Empty<object>() }));
            }
            if (req.Method == HttpMethod.Get && req.PathAndQuery.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                var logs = new List<object>
                {
                    new
                    {
                        id = canonical1Uuid,
                        titleId = title1Uuid,
                        status = "DONE",
                        note = "삭제된 구기록 1",
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-20T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = serverDeletedAt,
                        deletedAt = serverDeletedAt
                    },
                    new
                    {
                        id = canonical2Uuid,
                        titleId = title2Uuid,
                        status = "DONE",
                        note = "삭제된 구기록 2",
                        spoiler = false,
                        origin = "LOG",
                        watchedAt = "2026-11-20T12:00:00Z",
                        createdAt = "2026-11-20T12:00:00Z",
                        updatedAt = serverDeletedAt,
                        deletedAt = serverDeletedAt
                    }
                };
                logs.AddRange(serverActiveLogs);

                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-24T01:45:00Z",
                    changes = new
                    {
                        titles = new object[]
                        {
                            new { id = title1Uuid, type = "movie", name = "삭제 선행 후 재기록 작품", year = 2024, provider = "TMDB", providerId = "7811" },
                            new { id = title2Uuid, type = "movie", name = "삭제 직후 stale 초안 저장 작품", year = 2024, provider = "TMDB", providerId = "7812" }
                        },
                        logs
                    }
                }));
            }
            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var (repo, db, _, dbPath) = CreateTempRepo(handler, userId);
        try
        {
            db.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "2026-11-23T05:00:00Z");

            var title1 = new TitleSummary(title1Uuid, "tmdb", "7811", TitleType.movie, "삭제 선행 후 재기록 작품", Year: 2024);
            var existing1 = db.UpsertLog(new WatchLog(
                Id: legacy1Id,
                TitleId: title1Uuid,
                Title: title1,
                Status: LogStatus.DONE,
                Note: "삭제 전 구기록 1",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            var title2 = new TitleSummary(title2Uuid, "tmdb", "7812", TitleType.movie, "삭제 직후 stale 초안 저장 작품", Year: 2024);
            var existing2 = db.UpsertLog(new WatchLog(
                Id: legacy2Id,
                TitleId: title2Uuid,
                Title: title2,
                Status: LogStatus.DONE,
                Note: "삭제 전 구기록 2",
                OccurredAt: "2026-11-20T12:00:00Z",
                WatchedOn: "2026-11-20",
                CreatedAt: "2026-11-20T12:00:00Z",
                UpdatedAt: "2026-11-20T12:00:00Z",
                SyncState: "synced"
            ), recordHistory: true);

            // Delete commits FIRST on both rows
            Assert.True(db.ApplyServerDeletedLogAtomic(existing1, new SyncDeletedLog(canonical1Uuid, title1Uuid, serverDeletedAt, serverDeletedAt)));
            Assert.True(db.ApplyServerDeletedLogAtomic(existing2, new SyncDeletedLog(canonical2Uuid, title2Uuid, serverDeletedAt, serverDeletedAt)));

            // Case A: Normal SaveLogLocalFirst after deletion commits -> creates separate new UUID log
            var fresh1 = repo.SaveLogLocalFirst(title1, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-24", note: "삭제 후 별도 신규 감상 1");
            Assert.NotEqual(canonical1Uuid, fresh1.Id);
            Assert.True(SyncIdNormalizer.IsValidUuid(fresh1.Id));

            // Case B: Reverse TOCTOU where caller held stale legacy2Id before deletion committed ->
            // SaveLogAndOutboxAtomic MUST detect soft-deleted canonical2Uuid and allocate a separate new UUID!
            var staleDraft2 = existing2 with
            {
                Note = "삭제 직후 stale 초안으로 저장된 신규 감상 2",
                UpdatedAt = "2026-11-24T01:40:00Z",
                SyncState = "pending",
                DeletedAt = null
            };
            var fresh2 = db.SaveLogAndOutboxAtomic(
                staleDraft2,
                recordHistory: true,
                outboxType: "UPDATE_LOG",
                payloadSerializer: l => JsonSerializer.Serialize(new { logId = l.Id, note = l.Note }));
            Assert.NotEqual(legacy2Id, fresh2.Id);
            Assert.NotEqual(canonical2Uuid, fresh2.Id);
            Assert.True(SyncIdNormalizer.IsValidUuid(fresh2.Id));
            Assert.Null(db.GetLogIncludingDeleted(legacy2Id));

            // Sync uploads BOTH new separate records ONCE while keeping both soft-deleted records + full history intact!
            var (ok, _) = await repo.SyncAllAsync();
            Assert.True(ok);
            Assert.Empty(db.GetPendingOutbox());
            Assert.Equal(2, uploadedLogs.Count);
            Assert.Contains(uploadedLogs, u => u.Id == fresh1.Id && u.Note == "삭제 후 별도 신규 감상 1");
            Assert.Contains(uploadedLogs, u => u.Id == fresh2.Id && u.Note == "삭제 직후 stale 초안으로 저장된 신규 감상 2");

            Assert.Equal(serverDeletedAt, db.GetLogIncludingDeleted(canonical1Uuid)!.DeletedAt);
            Assert.Equal(serverDeletedAt, db.GetLogIncludingDeleted(canonical2Uuid)!.DeletedAt);

            var hist1 = repo.GetHistoryForTitle(title1Uuid);
            Assert.Contains(hist1, h => h.LogId == canonical1Uuid && h.Note == "삭제 전 구기록 1");
            Assert.Contains(hist1, h => h.LogId == fresh1.Id && h.Note == "삭제 후 별도 신규 감상 1");

            var hist2 = repo.GetHistoryForTitle(title2Uuid);
            Assert.Contains(hist2, h => h.LogId == canonical2Uuid && h.Note == "삭제 전 구기록 2");
            Assert.Contains(hist2, h => h.LogId == fresh2.Id && h.Note == "삭제 직후 stale 초안으로 저장된 신규 감상 2");
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }
}
