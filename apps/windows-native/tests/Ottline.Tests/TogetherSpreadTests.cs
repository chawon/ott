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

public sealed class TogetherSpreadTests
{
    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _handler;
        public List<string> RequestedPaths { get; } = new();
        public List<(HttpMethod Method, string Path, string? Body)> CapturedRequests { get; } = new();

        public StubHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false)
                : null;
            var pathAndQuery = request.RequestUri?.PathAndQuery ?? string.Empty;
            RequestedPaths.Add($"{request.Method} {pathAndQuery}");
            CapturedRequests.Add((request.Method, pathAndQuery, body));
            return await _handler(request, cancellationToken).ConfigureAwait(false);
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

    private static DiscussionPost MakePost(string id, string title, int comments = 1, int done = 1, string rawCreatedAt = "2026-11-20T12:00:00Z") =>
        new(
            Id: id,
            TitleId: $"title-{id}",
            Title: new TitleSummary($"title-{id}", "tmdb", id, TitleType.movie, title, Year: 2024),
            Body: $"{title} 이야기",
            CreatedAt: "2026.11.20",
            UpdatedAt: "2026.11.20",
            Author: new PublicAuthorProfile(DisplayName: "기록자"),
            Reactions: new DiscussionReactionSummary(DoneCount: done),
            CommentCount: comments,
            RawCreatedAt: rawCreatedAt
        );

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

    [Fact]
    public async Task RapidSelectionSwitch_CancelsAndDiscardsDelayedResponseFromPreviousDiscussion()
    {
        var aDetailGate = new TaskCompletionSource<DiscussionDetail?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var aReactionsGate = new TaskCompletionSource<DiscussionReactionState?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var aCancelled = false;

        var postA = MakePost("disc-a", "작품 A", comments: 1, done: 1);
        var postB = MakePost("disc-b", "작품 B", comments: 2, done: 4);

        using var coordinator = new TogetherSpreadCoordinator();
        coordinator.ApplyFeed(new[] { postA, postB });

        var selectATask = coordinator.SelectPostAsync(
            postA,
            async (id, fallback, ct) =>
            {
                ct.Register(() => aCancelled = true);
                return await aDetailGate.Task.ConfigureAwait(false);
            },
            async (id, ct) => await aReactionsGate.Task.ConfigureAwait(false)
        );

        var selectBResult = await coordinator.SelectPostAsync(
            postB,
            (id, fallback, _) => Task.FromResult<DiscussionDetail?>(new DiscussionDetail(
                fallback,
                new[]
                {
                    new DiscussionComment("c-b1", "disc-b", "B의 댓글입니다", false, "2026.11.21", new PublicAuthorProfile(DisplayName: "사용자B"))
                }
            )),
            (id, _) => Task.FromResult<DiscussionReactionState?>(new DiscussionReactionState(
                new DiscussionReactionSummary(DoneCount: 4, CuriousCount: 2, SaveCount: 1),
                new[] { DiscussionReactionType.CURIOUS },
                true
            ))
        );

        // Now resolve A's stale delayed response AFTER B already rendered
        aDetailGate.TrySetResult(new DiscussionDetail(
            postA,
            new[]
            {
                new DiscussionComment("c-a1", "disc-a", "뒤늦게 도착한 A의 댓글", false, "2026.11.20", new PublicAuthorProfile(DisplayName: "사용자A"))
            }
        ));
        aReactionsGate.TrySetResult(new DiscussionReactionState(
            new DiscussionReactionSummary(DoneCount: 99, CuriousCount: 0, SaveCount: 0),
            new[] { DiscussionReactionType.DONE },
            true
        ));

        var selectAResult = await selectATask;

        Assert.True(aCancelled);
        Assert.False(selectAResult);
        Assert.True(selectBResult);
        Assert.Equal("disc-b", coordinator.SelectedPost?.Id);
        Assert.Equal("disc-b", coordinator.SelectedDetail?.Post.Id);
        Assert.Single(coordinator.SelectedDetail!.Comments);
        Assert.Equal("B의 댓글입니다", coordinator.SelectedDetail.Comments[0].Body);
        Assert.Equal(4, coordinator.ReactionState.Summary.DoneCount);
        Assert.True(coordinator.ReactionState.HasReaction(DiscussionReactionType.CURIOUS));
        Assert.False(coordinator.ReactionState.HasReaction(DiscussionReactionType.DONE));
    }

    [Fact]
    public async Task ResponsiveBreakpointTransitions_PreserveSelectionSearchAndSort()
    {
        var postA = MakePost("disc-a", "듄 파트2", comments: 2, done: 3, rawCreatedAt: "2026-11-19T12:00:00Z");
        var postB = MakePost("disc-b", "파묘", comments: 7, done: 1, rawCreatedAt: "2026-11-21T12:00:00Z");

        using var coordinator = new TogetherSpreadCoordinator();
        coordinator.UpdateViewportWidth(1360);
        Assert.True(coordinator.IsTwoPane);

        var autoPick = coordinator.ApplyFeed(new[] { postA, postB });
        Assert.Equal("disc-b", autoPick?.Id); // LATEST sort puts newer post first

        await coordinator.SelectPostAsync(
            postB,
            (id, fallback, _) => Task.FromResult<DiscussionDetail?>(new DiscussionDetail(fallback, Array.Empty<DiscussionComment>())),
            (id, _) => Task.FromResult<DiscussionReactionState?>(DiscussionReactionState.Empty),
            openNarrowDetail: false,
            isExplicit: false
        );

        // Wide -> Narrow when only auto-selected (not explicitly clicked): lands on list, keeps selection
        coordinator.UpdateViewportWidth(860);
        Assert.False(coordinator.IsTwoPane);
        Assert.True(coordinator.ShowListPane);
        Assert.False(coordinator.ShowDetailPane);
        Assert.Equal("disc-b", coordinator.SelectedPost?.Id);

        // User applies search & sort and explicitly picks postA in narrow mode
        coordinator.SetSort(DiscussionSort.REACTIONS);
        coordinator.SetSearchQuery("듄");
        Assert.Single(coordinator.VisiblePosts);
        Assert.Equal("disc-a", coordinator.VisiblePosts[0].Id);

        await coordinator.SelectPostAsync(
            postA,
            (id, fallback, _) => Task.FromResult<DiscussionDetail?>(new DiscussionDetail(fallback, Array.Empty<DiscussionComment>())),
            (id, _) => Task.FromResult<DiscussionReactionState?>(DiscussionReactionState.Empty),
            openNarrowDetail: true,
            isExplicit: true
        );
        Assert.False(coordinator.ShowListPane);
        Assert.True(coordinator.ShowDetailPane);

        // Back to list keeps search, sort, and selection
        coordinator.CloseNarrowDetail();
        Assert.True(coordinator.ShowListPane);
        Assert.False(coordinator.ShowDetailPane);
        Assert.Equal("듄", coordinator.SearchQuery);
        Assert.Equal(DiscussionSort.REACTIONS, coordinator.Sort);
        Assert.Equal("disc-a", coordinator.SelectedPost?.Id);

        // Narrow -> Wide restores 2-pane with exact same selected post, search, and sort
        coordinator.UpdateViewportWidth(1200);
        Assert.True(coordinator.IsTwoPane);
        Assert.True(coordinator.ShowListPane);
        Assert.True(coordinator.ShowDetailPane);
        Assert.Equal("disc-a", coordinator.SelectedPost?.Id);
        Assert.Equal("듄", coordinator.SearchQuery);
        Assert.Equal(DiscussionSort.REACTIONS, coordinator.Sort);

        // Wide -> Narrow after explicit selection preserves reading view
        coordinator.UpdateViewportWidth(840);
        Assert.False(coordinator.IsTwoPane);
        Assert.False(coordinator.ShowListPane);
        Assert.True(coordinator.ShowDetailPane);
        Assert.Equal("disc-a", coordinator.SelectedPost?.Id);
    }

    [Fact]
    public async Task ToggleReactionAndDirectDiscussionById_MatchServerApiContract()
    {
        var handler = new StubHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Get && req.RequestUri!.AbsolutePath == "/api/discussions/disc-99")
            {
                return Task.FromResult(JsonResponse(new
                {
                    id = "disc-99",
                    titleId = "t-99",
                    titleProvider = "tmdb",
                    titleProviderId = "99",
                    titleName = "인터스텔라",
                    titleType = "movie",
                    titleYear = 2014,
                    commentCount = 3,
                    createdAt = "2026-11-22T01:00:00Z",
                    reactionSummary = new { done = 7, curious = 2, save = 4 }
                }));
            }
            if (req.Method == HttpMethod.Get && req.RequestUri!.AbsolutePath == "/api/discussions/disc-99/reactions/me")
            {
                return Task.FromResult(JsonResponse(new
                {
                    summary = new { done = 7, curious = 2, save = 4 },
                    selectedTypes = new[] { "DONE" },
                    selected = true
                }));
            }
            if (req.Method == HttpMethod.Put && req.RequestUri!.AbsolutePath == "/api/discussions/disc-99/reactions")
            {
                return Task.FromResult(JsonResponse(new
                {
                    summary = new { done = 7, curious = 3, save = 4 },
                    selectedTypes = new[] { "DONE", "CURIOUS" },
                    selected = true
                }));
            }
            if (req.Method == HttpMethod.Get && req.RequestUri!.AbsolutePath == "/api/discussions/disc-99/comments")
            {
                return Task.FromResult(JsonResponse(new[]
                {
                    new
                    {
                        id = "c-1",
                        discussionId = "disc-99",
                        userId = "u-1",
                        authorName = "별빛",
                        body = "도킹 장면이 아직도 생생해요.",
                        createdAt = "2026-11-22T02:00:00Z"
                    }
                }));
            }
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        });

        var (repo, dbPath) = CreateTempRepo(handler);
        try
        {
            using var coordinator = new TogetherSpreadCoordinator();
            var opened = await coordinator.OpenDiscussionByIdAsync(
                "disc-99",
                (id, ct) => repo.Api.FetchDiscussionByIdAsync(id, ct),
                (id, fallback, ct) => repo.Api.FetchDiscussionDetailAsync(id, ct, fallback),
                (id, ct) => repo.Api.FetchMyDiscussionReactionsAsync(id, ct)
            );

            Assert.True(opened);
            Assert.Equal("인터스텔라", coordinator.SelectedPost?.Title.Title);
            Assert.Single(coordinator.SelectedDetail!.Comments);
            Assert.True(coordinator.ReactionState.HasReaction(DiscussionReactionType.DONE));

            var toggled = await repo.Api.ToggleReactionAsync("disc-99", DiscussionReactionType.CURIOUS);
            Assert.NotNull(toggled);
            Assert.Equal(3, toggled!.Summary.CuriousCount);
            Assert.True(toggled.HasReaction(DiscussionReactionType.CURIOUS));

            var putReq = handler.CapturedRequests.Single(r => r.Method == HttpMethod.Put && r.Path == "/api/discussions/disc-99/reactions");
            Assert.Contains("\"type\":\"CURIOUS\"", putReq.Body);

            coordinator.ApplyReactionUpdate("disc-99", toggled);
            Assert.Equal(3, coordinator.ReactionState.Summary.CuriousCount);
            Assert.Equal(3, coordinator.SelectedPost!.Reactions.CuriousCount);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public async Task CreateComment_SendsSyncLogAndAppendCommentOnlyAffectsMatchingDiscussion()
    {
        var handler = new StubHttpMessageHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Post && req.RequestUri!.AbsolutePath == "/api/discussions/disc-a/comments")
            {
                return Task.FromResult(JsonResponse(new
                {
                    id = "c-new",
                    discussionId = "disc-a",
                    userId = "11111111-1111-1111-1111-111111111111",
                    authorName = "나",
                    body = "정말 여운이 길었어요",
                    createdAt = "2026-11-22T03:00:00Z"
                }));
            }
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        });

        var (repo, dbPath) = CreateTempRepo(handler);
        try
        {
            var created = await repo.Api.CreateCommentAsync(
                "disc-a",
                "정말 여운이 길었어요",
                spoiler: false,
                mentions: Array.Empty<CommentMention>(),
                syncLog: true
            );

            Assert.NotNull(created);
            Assert.Equal("c-new", created!.Id);
            var postReq = handler.CapturedRequests.Single(r => r.Method == HttpMethod.Post && r.Path == "/api/discussions/disc-a/comments");
            Assert.Contains("\"syncLog\":true", postReq.Body);

            using var coordinator = new TogetherSpreadCoordinator();
            var postA = MakePost("disc-a", "작품 A", comments: 1);
            var postB = MakePost("disc-b", "작품 B", comments: 0);
            coordinator.ApplyFeed(new[] { postA, postB });
            await coordinator.SelectPostAsync(
                postB,
                (_, fallback, _) => Task.FromResult<DiscussionDetail?>(new DiscussionDetail(fallback, Array.Empty<DiscussionComment>())),
                (_, _) => Task.FromResult<DiscussionReactionState?>(DiscussionReactionState.Empty)
            );

            // Late comment completion for disc-a must NOT leak into currently selected disc-b's comments list
            coordinator.AppendComment("disc-a", created);
            Assert.Empty(coordinator.SelectedDetail!.Comments);
            Assert.Equal(2, coordinator.AllPosts.Single(p => p.Id == "disc-a").CommentCount);
            Assert.Equal(0, coordinator.SelectedPost!.CommentCount);
        }
        finally
        {
            repo.Dispose();
            CleanupDb(dbPath);
        }
    }

    [Theory]
    [InlineData("ottline://together?id=disc-123", "together", "disc-123")]
    [InlineData("ottline://discussion/disc-456", "together", "disc-456")]
    [InlineData("https://ottline.app/ko/public/disc-789", "together", "disc-789")]
    [InlineData("https://ottline.app/en/public/disc-999", "together", "disc-999")]
    [InlineData("ottline://together", "together", null)]
    public void ShareIntentParser_ParsesTogetherDeepLinks(string rawUri, string expectedRoute, string? expectedDiscussionId)
    {
        var parsed = ShareIntentParser.Parse(rawUri);
        Assert.Equal(expectedRoute, parsed.OpenRoute);
        Assert.Equal(expectedDiscussionId, parsed.OpenDiscussionId);
    }
}
