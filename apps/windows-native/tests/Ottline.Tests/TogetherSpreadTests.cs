using System.Net;
using System.Text;
using System.Text.Json;
using Ottline.Core.Data;
using Ottline.Core.Local;
using Ottline.Core.Models;
using Ottline.Core.Remote;
using Xunit;

namespace Ottline.Tests;

public sealed class TogetherSpreadTests
{
    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _handler;
        public List<string> RequestedPaths { get; } = new();

        public StubHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestedPaths.Add($"{request.Method} {request.RequestUri?.PathAndQuery}");
            return _handler(request, cancellationToken);
        }
    }

    private static HttpResponseMessage JsonResponse(object payload, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

    private static (OttlineRepository Repo, string DbPath) CreateTempRepo(StubHttpMessageHandler handler)
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"ottline-together-test-{Guid.NewGuid():N}.db");
        var db = new OttlineDatabase(dbPath);
        db.SaveSettings(db.LoadSettings() with
        {
            BaseUrl = "https://mock.ottline.test",
            Locale = "ko",
            UserId = "11111111-1111-1111-1111-111111111111",
            DeviceId = "22222222-2222-2222-2222-222222222222"
        });
        var api = new OttlineApiClient(new HttpClient(handler));
        api.Configure("https://mock.ottline.test", "ko", "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", null);
        var repo = new OttlineRepository(db, api);
        return (repo, dbPath);
    }

    private static void CleanupDb(string dbPath)
    {
        try { if (File.Exists(dbPath)) File.Delete(dbPath); } catch { }
        try { if (File.Exists(dbPath + "-wal")) File.Delete(dbPath + "-wal"); } catch { }
        try { if (File.Exists(dbPath + "-shm")) File.Delete(dbPath + "-shm"); } catch { }
    }

    [Fact]
    public async Task FetchDiscussions_NeverCallsCuratedContents_AndHandlesEmptyFeedWithoutFallback()
    {
        var handler = new StubHttpMessageHandler((req, _) =>
        {
            if (req.RequestUri!.AbsolutePath == "/api/discussions/all")
            {
                return Task.FromResult(JsonResponse(Array.Empty<object>()));
            }
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        });

        var (repo, dbPath) = CreateTempRepo(handler);
        try
        {
            var posts = await repo.Api.FetchDiscussionsAsync();

            Assert.Empty(posts);
            Assert.DoesNotContain(handler.RequestedPaths, p => p.Contains("curated-contents", StringComparison.OrdinalIgnoreCase));
            Assert.Contains("GET /api/discussions/all?limit=100", handler.RequestedPaths);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task FetchDiscussions_SupportsSearchSortAndLocalRecordReactionFlow()
    {
        var handler = new StubHttpMessageHandler((req, _) =>
        {
            if (req.RequestUri!.AbsolutePath == "/api/discussions/all")
            {
                return Task.FromResult(JsonResponse(new[]
                {
                    new
                    {
                        id = "d-1",
                        titleId = "t-1",
                        titleProvider = "tmdb",
                        titleProviderId = "101",
                        titleName = "파묘",
                        titleType = "movie",
                        titleYear = 2024,
                        commentCount = 2,
                        createdAt = "2026-11-20T12:00:00Z",
                        reactionSummary = new { done = 5, curious = 3, save = 2 }
                    },
                    new
                    {
                        id = "d-2",
                        titleId = "t-2",
                        titleProvider = "naver_book",
                        titleProviderId = "202",
                        titleName = "소년이 온다",
                        titleType = "book",
                        titleYear = 2014,
                        commentCount = 8,
                        createdAt = "2026-11-21T12:00:00Z",
                        reactionSummary = new { done = 1, curious = 1, save = 0 }
                    }
                }));
            }
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        });

        var (repo, dbPath) = CreateTempRepo(handler);
        try
        {
            var byReactions = await repo.Api.FetchDiscussionsAsync(sort: DiscussionSort.REACTIONS);
            Assert.Equal(2, byReactions.Count);
            Assert.Equal("d-1", byReactions[0].Id);

            var byComments = await repo.Api.FetchDiscussionsAsync(sort: DiscussionSort.COMMENTS);
            Assert.Equal("d-2", byComments[0].Id);

            var searched = await repo.Api.FetchDiscussionsAsync(query: "소년");
            Assert.Single(searched);
            Assert.Equal("d-2", searched[0].Id);

            var savedLog = repo.ApplyDiscussionReactionLocalFirst(searched[0], DiscussionReactionType.SAVE);
            Assert.Equal("t-2", savedLog.TitleId);
            Assert.Equal(LogStatus.WISHLIST, savedLog.Status);
            Assert.Equal(LogOrigin.REACTION, savedLog.Origin);
            Assert.DoesNotContain(handler.RequestedPaths, p => p.Contains("curated-contents", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }
}
