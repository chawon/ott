using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Ottline.Core.Data;
using Ottline.Core.Local;
using Ottline.Core.Models;
using Ottline.Core.Remote;
using Xunit;

namespace Ottline.Tests;

public sealed class RecommendationRecoveryTests
{
    private const string TestUserId = "11111111-2222-3333-4444-555555555555";
    private const string TestDeviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    [Fact]
    public async Task Recommendations_TimeoutBudget_Exceeds15sDefaultAndSlowGenerationSucceeds()
    {
        using var defaultApi = new OttlineApiClient();
        Assert.Equal(TimeSpan.FromSeconds(15), defaultApi.DefaultRequestTimeout);
        Assert.Equal(TimeSpan.FromSeconds(15), defaultApi.RecommendationStateTimeout);
        Assert.True(defaultApi.RecommendationGenerateTimeout >= TimeSpan.FromSeconds(60));

        var tempDbPath = TempDbPath("slow");
        try
        {
            var server = new FakeRecommendationServer
            {
                Eligible = true,
                // Simulate generation slower than DefaultRequestTimeout (50ms) but within RecommendationGenerateTimeout (2s)
                GenerateDelay = TimeSpan.FromMilliseconds(160)
            };
            using var repo = CreateRepo(tempDbPath, server, api =>
            {
                api.DefaultRequestTimeout = TimeSpan.FromMilliseconds(50);
                api.RecommendationStateTimeout = TimeSpan.FromMilliseconds(500);
                api.RecommendationGenerateTimeout = TimeSpan.FromSeconds(2);
            });

            var result = await repo.LoadRecommendationsAsync();

            Assert.Equal(RecommendationErrorKind.None, result.ErrorKind);
            Assert.True(result.GeneratedNewBatch);
            Assert.NotNull(result.State);
            Assert.True(result.State!.HasBatch);
            Assert.NotEmpty(result.State.Items);
            Assert.Equal(1, result.State.Quota.Used);
            Assert.Equal(2, result.State.Quota.Remaining);
            Assert.Equal(1, server.QuotaUsed);
            Assert.Single(server.GenerateRequestIds);
            Assert.Null(repo.GetPendingRecommendationAttempt());
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_FirstGenerationAndExplicitRefresh_IncrementQuotaByOneEach()
    {
        var tempDbPath = TempDbPath("first_refresh");
        try
        {
            var server = new FakeRecommendationServer { Eligible = true };
            using var repo = CreateRepo(tempDbPath, server);

            var first = await repo.LoadRecommendationsAsync();
            Assert.Equal(RecommendationErrorKind.None, first.ErrorKind);
            Assert.True(first.GeneratedNewBatch);
            Assert.Equal(1, first.State!.Quota.Used);
            Assert.Equal(2, first.State.Quota.Remaining);
            var firstGenId = first.State.GenerationId;
            Assert.False(string.IsNullOrWhiteSpace(firstGenId));
            Assert.Contains("추천작품 1", first.State.Items[0].Title.Title);

            var second = await repo.GenerateRecommendationsAsync();
            Assert.Equal(RecommendationErrorKind.None, second.ErrorKind);
            Assert.True(second.GeneratedNewBatch);
            Assert.Equal(2, second.State!.Quota.Used);
            Assert.Equal(1, second.State.Quota.Remaining);
            Assert.NotEqual(firstGenId, second.State.GenerationId);
            Assert.Contains("추천작품 2", second.State.Items[0].Title.Title);
            Assert.Equal(2, server.QuotaUsed);
            Assert.Null(repo.GetPendingRecommendationAttempt());
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_DroppedGenerateResponse_PreservesExistingAndRecoversViaStatePolling()
    {
        var tempDbPath = TempDbPath("dropped_poll");
        try
        {
            var server = new FakeRecommendationServer { Eligible = true };
            using var repo = CreateRepo(tempDbPath, server);

            // Seed initial batch (quota.used = 1)
            var initial = await repo.LoadRecommendationsAsync();
            Assert.Equal(1, initial.State!.Quota.Used);
            var initialTitle = initial.State.Items[0].Title.Title;

            // Next /generate accepts on server (enters generating=true for 2 polls, then completes),
            // but drops the client HTTP response mid-flight.
            server.DropNextGenerateAfterStartingLease = true;
            server.PollsBeforeLeaseCompletes = 2;

            var recovered = await repo.GenerateRecommendationsAsync();

            Assert.Equal(RecommendationErrorKind.None, recovered.ErrorKind);
            Assert.True(recovered.GeneratedNewBatch);
            Assert.NotNull(recovered.State);
            Assert.NotEqual(initialTitle, recovered.State!.Items[0].Title.Title);
            Assert.Equal(2, recovered.State.Quota.Used);
            Assert.Equal(2, server.QuotaUsed);
            // Strictly 2 total /generate calls (initial + 1 refresh); recovery used /state polling only!
            Assert.Equal(2, server.GenerateRequestIds.Count);
            Assert.Null(repo.GetPendingRecommendationAttempt());
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_LostResponseAndOfflineState_PreservesExistingAndRecoversAcrossAppRestartWithSingleCharge()
    {
        var tempDbPath = TempDbPath("restart_recover");
        try
        {
            var server = new FakeRecommendationServer { Eligible = true };
            string persistedRequestId;
            string initialTitle;

            // Session 1: initial batch + lost /generate + failed immediate /state
            using (var repo1 = CreateRepo(tempDbPath, server))
            {
                var initial = await repo1.LoadRecommendationsAsync();
                Assert.Equal(1, initial.State!.Quota.Used);
                initialTitle = initial.State.Items[0].Title.Title;

                // Simulate response dropped AFTER server completed generation, AND immediate /state also fails (offline)
                server.CompleteThenDropNextGenerate = true;
                server.FailNextStateCalls = 1;

                var failed = await repo1.GenerateRecommendationsAsync();
                Assert.Equal(RecommendationErrorKind.GenerateFailed, failed.ErrorKind);
                Assert.True(failed.UsedExistingFallback);
                Assert.NotNull(failed.State);
                Assert.Equal(initialTitle, failed.State!.Items[0].Title.Title);
                Assert.False(string.IsNullOrWhiteSpace(failed.PendingRequestId));
                persistedRequestId = failed.PendingRequestId!;
            }

            // Session 2 (simulated app restart with brand-new DB/Repository instance):
            // Re-entering recommendations checks /state and recovers the completed batch without re-charging quota!
            using (var repo2 = CreateRepo(tempDbPath, server))
            {
                var pendingOnRestart = repo2.GetPendingRecommendationAttempt();
                Assert.NotNull(pendingOnRestart);
                Assert.Equal(persistedRequestId, pendingOnRestart!.RequestId);

                var recovered = await repo2.LoadRecommendationsAsync();
                Assert.Equal(RecommendationErrorKind.None, recovered.ErrorKind);
                Assert.True(recovered.GeneratedNewBatch);
                Assert.NotEqual(initialTitle, recovered.State!.Items[0].Title.Title);
                Assert.Equal(persistedRequestId, recovered.State.GenerationId);
                Assert.Equal(2, recovered.State.Quota.Used);
                Assert.Equal(2, server.QuotaUsed);
                Assert.Equal(2, server.GenerateRequestIds.Count);
                Assert.Null(repo2.GetPendingRecommendationAttempt());
            }
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_UnconfirmedAfterRestart_RetriesWithSameRequestIdAndChargesOnce()
    {
        var tempDbPath = TempDbPath("restart_same_id");
        try
        {
            var server = new FakeRecommendationServer { Eligible = true };
            string persistedRequestId;

            // Session 1: initial batch succeeds, second /generate fails BEFORE reaching server (network drop)
            using (var repo1 = CreateRepo(tempDbPath, server))
            {
                var initial = await repo1.LoadRecommendationsAsync();
                Assert.Equal(1, initial.State!.Quota.Used);

                server.FailNextGenerateWithNetworkErrorBeforeServer = true;
                server.FailNextStateCalls = 1;

                var failed = await repo1.GenerateRecommendationsAsync();
                Assert.Equal(RecommendationErrorKind.GenerateFailed, failed.ErrorKind);
                Assert.True(failed.UsedExistingFallback);
                Assert.Equal(1, server.QuotaUsed);
                persistedRequestId = failed.PendingRequestId!;
                Assert.False(string.IsNullOrWhiteSpace(persistedRequestId));
            }

            // Session 2 (app restart): /state still has only batch 1, so retry sends the EXACT SAME requestId!
            using (var repo2 = CreateRepo(tempDbPath, server))
            {
                var loadAfterRestart = await repo2.LoadRecommendationsAsync();
                Assert.Equal(RecommendationErrorKind.GenerateFailed, loadAfterRestart.ErrorKind);
                Assert.True(loadAfterRestart.UsedExistingFallback);
                Assert.Equal(persistedRequestId, loadAfterRestart.PendingRequestId);

                var retry = await repo2.GenerateRecommendationsAsync();
                Assert.Equal(RecommendationErrorKind.None, retry.ErrorKind);
                Assert.True(retry.GeneratedNewBatch);
                Assert.Equal(persistedRequestId, retry.State!.GenerationId);
                Assert.Equal(2, retry.State.Quota.Used);
                Assert.Equal(2, server.QuotaUsed);
                Assert.Equal(persistedRequestId, server.GenerateRequestIds.Last());
                Assert.Null(repo2.GetPendingRecommendationAttempt());
            }
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_FirstStateFailure_ThenRecoveryOnRetry()
    {
        var tempDbPath = TempDbPath("first_state_fail");
        try
        {
            var server = new FakeRecommendationServer
            {
                Eligible = true,
                FailNextStateCalls = 1
            };
            using var repo = CreateRepo(tempDbPath, server);

            var firstLoad = await repo.LoadRecommendationsAsync();
            Assert.Equal(RecommendationErrorKind.LoadFailed, firstLoad.ErrorKind);
            Assert.Null(firstLoad.State);
            Assert.Equal(0, server.QuotaUsed);
            Assert.Empty(server.GenerateRequestIds);

            var retryLoad = await repo.LoadRecommendationsAsync();
            Assert.Equal(RecommendationErrorKind.None, retryLoad.ErrorKind);
            Assert.True(retryLoad.GeneratedNewBatch);
            Assert.NotNull(retryLoad.State);
            Assert.Equal(1, retryLoad.State!.Quota.Used);
            Assert.Equal(1, server.QuotaUsed);
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_202Polling_ResumesAfterTransientNetworkFailuresAndCoalescesDoubleTap()
    {
        var tempDbPath = TempDbPath("poll_202_doubletap");
        try
        {
            var server = new FakeRecommendationServer
            {
                Eligible = true,
                Return202OnNextGenerate = true,
                PollsBeforeLeaseCompletes = 3,
                TransientPollFailuresBeforeSuccess = 2,
                GenerateDelay = TimeSpan.FromMilliseconds(60)
            };
            using var repo = CreateRepo(tempDbPath, server);

            // Simulate double-tap: fire two concurrent GenerateRecommendationsAsync calls simultaneously
            var task1 = repo.GenerateRecommendationsAsync();
            var task2 = repo.GenerateRecommendationsAsync();
            var results = await Task.WhenAll(task1, task2);

            Assert.All(results, r =>
            {
                Assert.Equal(RecommendationErrorKind.None, r.ErrorKind);
                Assert.True(r.GeneratedNewBatch);
                Assert.Equal(1, r.State!.Quota.Used);
            });
            Assert.Single(server.GenerateRequestIds);
            Assert.Equal(1, server.QuotaUsed);
            Assert.True(server.StateCallCount >= 5); // 2 transient failures + 3 successful polls
            Assert.Null(repo.GetPendingRecommendationAttempt());
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_ServerFailureAnd429_PreservePreviousItemsWithZeroExtraCharge()
    {
        var tempDbPath = TempDbPath("fail_and_429");
        try
        {
            var server = new FakeRecommendationServer { Eligible = true };
            using var repo = CreateRepo(tempDbPath, server);

            var initial = await repo.LoadRecommendationsAsync();
            Assert.Equal(1, initial.State!.Quota.Used);
            var preservedTitle = initial.State.Items[0].Title.Title;

            // 503 failure: 0 extra quota charge, existing batch preserved
            server.FailNextGenerateWithStatus = HttpStatusCode.ServiceUnavailable;
            var fail503 = await repo.GenerateRecommendationsAsync();
            Assert.Equal(RecommendationErrorKind.GenerateFailed, fail503.ErrorKind);
            Assert.True(fail503.UsedExistingFallback);
            Assert.Equal(preservedTitle, fail503.State!.Items[0].Title.Title);
            Assert.Equal(1, server.QuotaUsed);

            // Exhaust daily quota (simulate 3/3 used on another device) -> 429 on /generate
            server.QuotaUsed = 3;
            var limit429 = await repo.GenerateRecommendationsAsync();
            Assert.Equal(RecommendationErrorKind.LimitReached, limit429.ErrorKind);
            Assert.True(limit429.UsedExistingFallback);
            Assert.Equal(preservedTitle, limit429.State!.Items[0].Title.Title);
            Assert.Equal(0, limit429.State.Quota.Remaining);
            Assert.Equal(3, server.QuotaUsed);
            Assert.Null(repo.GetPendingRecommendationAttempt());
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_OtherLanguageQuotaIncrement_DoesNotMarkCurrentLanguageSucceeded()
    {
        var tempDbPath = TempDbPath("other_lang");
        try
        {
            var server = new FakeRecommendationServer { Eligible = true };
            using var repo = CreateRepo(tempDbPath, server);

            // Seed Korean batch (generationId = G-KO-1, quota.used = 1)
            var koInitial = await repo.LoadRecommendationsAsync();
            Assert.Equal(1, koInitial.State!.Quota.Used);
            var koInitialGenId = koInitial.State.GenerationId;
            var koInitialTitle = koInitial.State.Items[0].Title.Title;

            // Korean refresh hits 202 because an ENGLISH generation owns the account lease.
            // When English completes, quota.used increments 1 -> 2, but Korean generationId stays G-KO-1!
            server.SimulateOtherLanguageLeaseCompletionOnNextGenerate = true;
            server.PollsBeforeLeaseCompletes = 1;

            var koRefresh = await repo.GenerateRecommendationsAsync();

            Assert.Equal(RecommendationErrorKind.GenerateFailed, koRefresh.ErrorKind);
            Assert.False(koRefresh.GeneratedNewBatch);
            Assert.True(koRefresh.UsedExistingFallback);
            Assert.Equal(koInitialGenId, koRefresh.State!.GenerationId);
            Assert.Equal(koInitialTitle, koRefresh.State.Items[0].Title.Title);
            Assert.Equal(2, koRefresh.State.Quota.Used);
            Assert.Equal(1, koRefresh.State.Quota.Remaining);
            // Pending Korean requestId is preserved for Korean retry and isolated from English locale!
            Assert.NotNull(repo.GetPendingRecommendationAttempt("ko"));
            Assert.Null(repo.GetPendingRecommendationAttempt("en"));

            // Explicit retry in Korean now runs with the same requestId and updates Korean batch cleanly
            var koRetry = await repo.GenerateRecommendationsAsync();
            Assert.Equal(RecommendationErrorKind.None, koRetry.ErrorKind);
            Assert.True(koRetry.GeneratedNewBatch);
            Assert.NotEqual(koInitialGenId, koRetry.State!.GenerationId);
            Assert.Equal(3, koRetry.State.Quota.Used);
            Assert.Null(repo.GetPendingRecommendationAttempt("ko"));
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    [Fact]
    public async Task Recommendations_GenerateTimeoutExpires_RecoversViaStatePollingWithoutDoubleCharge()
    {
        var tempDbPath = TempDbPath("timeout_recover");
        try
        {
            var server = new FakeRecommendationServer { Eligible = true };
            using var repo = CreateRepo(tempDbPath, server, api =>
            {
                api.RecommendationGenerateTimeout = TimeSpan.FromMilliseconds(60);
                api.RecommendationStateTimeout = TimeSpan.FromSeconds(2);
            });

            // Seed initial batch (fast)
            var initial = await repo.LoadRecommendationsAsync();
            Assert.Equal(1, initial.State!.Quota.Used);

            // Second generation takes longer than RecommendationGenerateTimeout (60ms),
            // so the client times out mid-flight while the server starts the lease and completes on poll.
            server.StartLeaseBeforeDelayingGenerate = true;
            server.GenerateDelay = TimeSpan.FromMilliseconds(250);
            server.PollsBeforeLeaseCompletes = 1;

            var recovered = await repo.GenerateRecommendationsAsync();

            Assert.Equal(RecommendationErrorKind.None, recovered.ErrorKind);
            Assert.True(recovered.GeneratedNewBatch);
            Assert.Equal(2, recovered.State!.Quota.Used);
            Assert.Equal(2, server.QuotaUsed);
            Assert.Equal(2, server.GenerateRequestIds.Count);
            Assert.Null(repo.GetPendingRecommendationAttempt());
        }
        finally
        {
            TryDelete(tempDbPath);
        }
    }

    private static OttlineRepository CreateRepo(
        string dbPath,
        FakeRecommendationServer server,
        Action<OttlineApiClient>? configureApi = null)
    {
        var db = new OttlineDatabase(dbPath);
        var httpClient = new HttpClient(server);
        var api = new OttlineApiClient(httpClient);
        configureApi?.Invoke(api);
        var repo = new OttlineRepository(db, api)
        {
            RecommendationPollInterval = TimeSpan.FromMilliseconds(5),
            RecommendationMaxPollAttempts = 20,
            RecommendationMaxConsecutivePollFailures = 5,
            EnableRecommendationPosterEnrichment = false
        };
        repo.UpdateSettings(s => s with
        {
            BaseUrl = "https://ottline.app",
            UserId = TestUserId,
            DeviceId = TestDeviceId,
            Locale = "ko"
        });
        return repo;
    }

    private static string TempDbPath(string tag) =>
        Path.Combine(Path.GetTempPath(), $"ottline_rec_{tag}_{Guid.NewGuid():N}.db");

    private static void TryDelete(string path)
    {
        try { File.Delete(path); } catch { }
    }

    private sealed class FakeRecommendationServer : HttpMessageHandler
    {
        private readonly object _lock = new();
        private readonly Dictionary<string, (string GenerationId, List<string> Titles)> _batches = new(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _completedRequestIds = new(StringComparer.OrdinalIgnoreCase);

        private bool _generating;
        private string? _activeLeaseRequestId;
        private string? _activeLeaseLang;
        private int _remainingPolls;
        private int _transientPollFailuresLeft;
        private int _batchCounter;

        public bool Eligible { get; set; } = true;
        public int QuotaUsed { get; set; }
        public int QuotaLimit { get; set; } = 3;
        public TimeSpan GenerateDelay { get; set; } = TimeSpan.Zero;
        public int FailNextStateCalls { get; set; }
        public bool DropNextGenerateAfterStartingLease { get; set; }
        public bool StartLeaseBeforeDelayingGenerate { get; set; }
        public bool CompleteThenDropNextGenerate { get; set; }
        public bool FailNextGenerateWithNetworkErrorBeforeServer { get; set; }
        public bool Return202OnNextGenerate { get; set; }
        public bool SimulateOtherLanguageLeaseCompletionOnNextGenerate { get; set; }
        public HttpStatusCode? FailNextGenerateWithStatus { get; set; }
        public int PollsBeforeLeaseCompletes { get; set; }
        public int TransientPollFailuresBeforeSuccess { get; set; }

        public ConcurrentQueue<string> GenerateRequestIds { get; } = new();
        public int StateCallCount { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri?.AbsolutePath ?? string.Empty;
            var lang = request.Headers.TryGetValues("Accept-Language", out var langs) &&
                       langs.FirstOrDefault()?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true
                ? "en"
                : "ko";

            if (path == "/api/recommendations/state" && request.Method == HttpMethod.Get)
            {
                StateCallCount++;
                lock (_lock)
                {
                    if (FailNextStateCalls > 0)
                    {
                        FailNextStateCalls--;
                        throw new HttpRequestException("Simulated /state network outage");
                    }

                    if (_transientPollFailuresLeft > 0)
                    {
                        _transientPollFailuresLeft--;
                        if (_transientPollFailuresLeft % 2 == 1)
                        {
                            throw new HttpRequestException("Simulated transient poll network drop");
                        }
                        return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
                    }

                    if (_generating)
                    {
                        if (_remainingPolls > 0)
                        {
                            _remainingPolls--;
                        }
                        else
                        {
                            CompleteActiveLeaseLocked();
                        }
                    }

                    return JsonResponse(HttpStatusCode.OK, BuildStateJsonLocked(lang));
                }
            }

            if (path == "/api/recommendations/generate" && request.Method == HttpMethod.Post)
            {
                var body = request.Content != null
                    ? await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false)
                    : "{}";
                using var doc = JsonDocument.Parse(body);
                var reqId = doc.RootElement.GetProperty("requestId").GetString()!;

                var startedLeaseBeforeDelay = false;
                lock (_lock)
                {
                    if (StartLeaseBeforeDelayingGenerate)
                    {
                        StartLeaseBeforeDelayingGenerate = false;
                        startedLeaseBeforeDelay = true;
                        GenerateRequestIds.Enqueue(reqId);
                        _generating = true;
                        _activeLeaseRequestId = reqId;
                        _activeLeaseLang = lang;
                        _remainingPolls = PollsBeforeLeaseCompletes;
                    }
                }

                if (GenerateDelay > TimeSpan.Zero)
                {
                    await Task.Delay(GenerateDelay, cancellationToken).ConfigureAwait(false);
                }

                if (startedLeaseBeforeDelay)
                {
                    lock (_lock)
                    {
                        return JsonResponse(HttpStatusCode.OK, BuildStateJsonLocked(lang));
                    }
                }

                lock (_lock)
                {
                    if (FailNextGenerateWithNetworkErrorBeforeServer)
                    {
                        FailNextGenerateWithNetworkErrorBeforeServer = false;
                        throw new HttpRequestException("Simulated disconnect before reaching server");
                    }

                    GenerateRequestIds.Enqueue(reqId);

                    if (FailNextGenerateWithStatus.HasValue)
                    {
                        var st = FailNextGenerateWithStatus.Value;
                        FailNextGenerateWithStatus = null;
                        return new HttpResponseMessage(st);
                    }

                    if (_completedRequestIds.Contains(reqId))
                    {
                        return JsonResponse(HttpStatusCode.OK, BuildStateJsonLocked(lang));
                    }

                    if (QuotaUsed >= QuotaLimit)
                    {
                        return JsonResponse((HttpStatusCode)429, BuildStateJsonLocked(lang));
                    }

                    if (SimulateOtherLanguageLeaseCompletionOnNextGenerate)
                    {
                        SimulateOtherLanguageLeaseCompletionOnNextGenerate = false;
                        _generating = true;
                        _activeLeaseRequestId = Guid.NewGuid().ToString("D");
                        _activeLeaseLang = lang == "ko" ? "en" : "ko";
                        _remainingPolls = PollsBeforeLeaseCompletes;
                        return JsonResponse(HttpStatusCode.Accepted, BuildStateJsonLocked(lang));
                    }

                    if (Return202OnNextGenerate)
                    {
                        Return202OnNextGenerate = false;
                        _generating = true;
                        _activeLeaseRequestId = reqId;
                        _activeLeaseLang = lang;
                        _remainingPolls = PollsBeforeLeaseCompletes;
                        _transientPollFailuresLeft = TransientPollFailuresBeforeSuccess;
                        return JsonResponse(HttpStatusCode.Accepted, BuildStateJsonLocked(lang));
                    }

                    if (DropNextGenerateAfterStartingLease)
                    {
                        DropNextGenerateAfterStartingLease = false;
                        _generating = true;
                        _activeLeaseRequestId = reqId;
                        _activeLeaseLang = lang;
                        _remainingPolls = PollsBeforeLeaseCompletes;
                        throw new HttpRequestException("Simulated mid-flight response drop");
                    }

                    if (CompleteThenDropNextGenerate)
                    {
                        CompleteThenDropNextGenerate = false;
                        _activeLeaseRequestId = reqId;
                        _activeLeaseLang = lang;
                        CompleteActiveLeaseLocked();
                        throw new HttpRequestException("Simulated completion response lost");
                    }

                    _activeLeaseRequestId = reqId;
                    _activeLeaseLang = lang;
                    CompleteActiveLeaseLocked();
                    return JsonResponse(HttpStatusCode.OK, BuildStateJsonLocked(lang));
                }
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        private void CompleteActiveLeaseLocked()
        {
            if (string.IsNullOrWhiteSpace(_activeLeaseRequestId) || string.IsNullOrWhiteSpace(_activeLeaseLang))
            {
                _generating = false;
                return;
            }

            _batchCounter++;
            QuotaUsed++;
            var genId = _activeLeaseRequestId!;
            var lang = _activeLeaseLang!;
            var label = lang == "en" ? $"Picked Title {_batchCounter}" : $"추천작품 {_batchCounter}";
            _batches[lang] = (genId, new List<string> { label });
            _completedRequestIds.Add(genId);
            _generating = false;
            _activeLeaseRequestId = null;
            _activeLeaseLang = null;
        }

        private string BuildStateJsonLocked(string lang)
        {
            var hasBatch = _batches.TryGetValue(lang, out var batch);
            var items = hasBatch
                ? batch.Titles.Select((t, idx) => (object)new
                {
                    name = t,
                    type = "movie",
                    reason = lang == "en" ? "Matched your recent taste." : "최근 기록한 취향과 맞닿은 작품이에요.",
                    provider = "TMDB",
                    providerId = $"{_batchCounter * 100 + idx}",
                    year = 2024,
                    posterUrl = "https://image.tmdb.org/t/p/w500/fake.jpg"
                }).ToList()
                : new List<object>();

            var payload = new
            {
                items,
                exclusions = Array.Empty<object>(),
                quota = new
                {
                    date = "2026-11-20",
                    timezone = "Asia/Seoul",
                    limit = QuotaLimit,
                    used = QuotaUsed,
                    remaining = Math.Max(0, QuotaLimit - QuotaUsed),
                    resetsAt = "2026-11-21T00:00:00+09:00"
                },
                generatedAt = hasBatch ? "2026-11-20T10:00:00Z" : null,
                generationId = hasBatch ? batch.GenerationId : null,
                generating = _generating,
                hasBatch,
                eligible = Eligible
            };
            return JsonSerializer.Serialize(payload);
        }

        private static HttpResponseMessage JsonResponse(HttpStatusCode status, string json) =>
            new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }
}
