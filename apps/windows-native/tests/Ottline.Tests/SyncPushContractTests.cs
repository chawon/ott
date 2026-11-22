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
}
