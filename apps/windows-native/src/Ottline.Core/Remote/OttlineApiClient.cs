using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Ottline.Core.Domain;
using Ottline.Core.Models;

namespace Ottline.Core.Remote;

public sealed class OttlineApiClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly bool _disposeClient;
    private string _baseUrl = "https://ottline.app";
    private string? _authToken;
    private string? _userId;
    private string _deviceId = "windows-native";
    private string _locale = "ko";

    public TimeSpan DefaultRequestTimeout { get; set; } = TimeSpan.FromSeconds(15);
    public TimeSpan RecommendationStateTimeout { get; set; } = TimeSpan.FromSeconds(15);
    public TimeSpan RecommendationGenerateTimeout { get; set; } = TimeSpan.FromSeconds(60);

    public OttlineApiClient(HttpClient? httpClient = null)
    {
        if (httpClient == null)
        {
            _httpClient = new HttpClient
            {
                Timeout = Timeout.InfiniteTimeSpan
            };
            _disposeClient = true;
        }
        else
        {
            _httpClient = httpClient;
            _disposeClient = false;
        }
    }

    private async Task<HttpResponseMessage> SendWithTimeoutAsync(
        HttpRequestMessage req,
        TimeSpan timeout,
        CancellationToken ct)
    {
        if (timeout == Timeout.InfiniteTimeSpan || timeout <= TimeSpan.Zero)
        {
            return await _httpClient.SendAsync(req, ct).ConfigureAwait(false);
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(timeout);
        try
        {
            return await _httpClient.SendAsync(req, timeoutCts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested && timeoutCts.IsCancellationRequested)
        {
            throw new TimeoutException($"Request timed out after {timeout.TotalSeconds:0.#}s.");
        }
    }

    public string BaseUrl => _baseUrl;

    public void Configure(string baseUrl, string? authToken, string deviceId, string locale, string? userId = null)
    {
        _baseUrl = string.IsNullOrWhiteSpace(baseUrl) ? "https://ottline.app" : baseUrl.Trim().TrimEnd('/');
        _authToken = string.IsNullOrWhiteSpace(authToken) ? null : authToken.Trim();
        _userId = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        _deviceId = string.IsNullOrWhiteSpace(deviceId) ? "windows-native" : deviceId.Trim();
        _locale = string.IsNullOrWhiteSpace(locale) ? "ko" : locale.Trim();
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string relativePath, object? jsonBody = null)
    {
        var url = relativePath.StartsWith("http", StringComparison.OrdinalIgnoreCase)
            ? relativePath
            : $"{_baseUrl}{(relativePath.StartsWith('/') ? "" : "/")}{relativePath}";

        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Book-Search-Capability", "google_books_v1");
        req.Headers.TryAddWithoutValidation("X-Client-Platform", "windows_native");
        req.Headers.TryAddWithoutValidation("Accept-Language", _locale);
        if (Guid.TryParse(_deviceId, out _))
        {
            req.Headers.TryAddWithoutValidation("X-Device-Id", _deviceId);
            req.Headers.TryAddWithoutValidation("X-Ottline-Device-Id", _deviceId);
        }
        if (Guid.TryParse(_userId, out _))
        {
            req.Headers.TryAddWithoutValidation("X-User-Id", _userId);
        }
        req.Headers.TryAddWithoutValidation("User-Agent", "OttlineWindowsNative/2.0.0.0");

        if (!string.IsNullOrWhiteSpace(_authToken))
        {
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _authToken);
        }

        if (jsonBody != null)
        {
            var json = jsonBody is string rawJson ? rawJson : JsonSerializer.Serialize(jsonBody);
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return req;
    }

    public async Task<IReadOnlyList<TitleSummary>> FetchPopularTitlesAsync(int limit = 12, CancellationToken ct = default)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Get, $"/api/titles/popular?limit={limit}");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return Array.Empty<TitleSummary>();

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var arr = root.ValueKind == JsonValueKind.Array
                ? root
                : (root.TryGetProperty("items", out var iEl) && iEl.ValueKind == JsonValueKind.Array ? iEl : default);

            if (arr.ValueKind != JsonValueKind.Array) return Array.Empty<TitleSummary>();
            var list = new List<TitleSummary>();
            foreach (var el in arr.EnumerateArray())
            {
                var parsed = ParseTitleElement(el);
                if (parsed != null) list.Add(parsed);
            }
            return list;
        }
        catch
        {
            return Array.Empty<TitleSummary>();
        }
    }

    public async Task<IReadOnlyList<TitleSummary>> FetchTitleSuggestionsAsync(
        ContentFilter filter = ContentFilter.ALL,
        int limit = 6,
        CancellationToken ct = default)
    {
        var merged = new List<TitleSummary>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            using var req = CreateRequest(HttpMethod.Get, $"/api/discussions/latest?limit={limit}&days=14");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                var arr = root.ValueKind == JsonValueKind.Array
                    ? root
                    : (root.TryGetProperty("items", out var iEl) && iEl.ValueKind == JsonValueKind.Array ? iEl : default);

                if (arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in arr.EnumerateArray())
                    {
                        var post = ParseDiscussionPostElement(el, _locale);
                        var t = post?.Title;
                        if (t == null) continue;
                        if (filter == ContentFilter.VIDEO && !t.Type.IsVideo()) continue;
                        if (filter == ContentFilter.BOOK && !t.Type.IsBook()) continue;
                        if (seen.Add(t.Id))
                        {
                            merged.Add(t);
                            if (merged.Count >= limit) break;
                        }
                    }
                }
            }
        }
        catch
        {
            // Continue to popular fallback
        }

        if (filter != ContentFilter.BOOK && merged.Count < limit)
        {
            var popular = await FetchPopularTitlesAsync(Math.Max(12, limit * 2), ct).ConfigureAwait(false);
            foreach (var t in popular)
            {
                if (filter == ContentFilter.VIDEO && !t.Type.IsVideo()) continue;
                if (seen.Add(t.Id))
                {
                    merged.Add(t);
                    if (merged.Count >= limit) break;
                }
            }
        }

        return merged;
    }

    public async Task<IReadOnlyList<TitleSummary>> SearchTitlesAsync(
        string query,
        ContentFilter filter = ContentFilter.ALL,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return Array.Empty<TitleSummary>();
        var cleanQuery = query.Trim();

        if (filter == ContentFilter.ALL)
        {
            var videoTask = SearchTitlesSingleScopeAsync(cleanQuery, ContentFilter.VIDEO, ct);
            var bookTask = SearchTitlesSingleScopeAsync(cleanQuery, ContentFilter.BOOK, ct);
            await Task.WhenAll(videoTask, bookTask).ConfigureAwait(false);

            var merged = new List<TitleSummary>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in videoTask.Result.Concat(bookTask.Result))
            {
                if (seen.Add(item.Id))
                {
                    merged.Add(item);
                }
            }
            return merged;
        }

        return await SearchTitlesSingleScopeAsync(cleanQuery, filter, ct).ConfigureAwait(false);
    }

    private async Task<IReadOnlyList<TitleSummary>> SearchTitlesSingleScopeAsync(
        string cleanQuery,
        ContentFilter filter,
        CancellationToken ct)
    {
        var typeParam = filter switch
        {
            ContentFilter.BOOK => "&type=book",
            _ => ""
        };
        var path = $"/api/titles/search?q={Uri.EscapeDataString(cleanQuery)}{typeParam}";
        using var req = CreateRequest(HttpMethod.Get, path);
        using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) return Array.Empty<TitleSummary>();

        var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var arr = root.ValueKind == JsonValueKind.Array
            ? root
            : (root.TryGetProperty("items", out var itemsProp) && itemsProp.ValueKind == JsonValueKind.Array
                ? itemsProp
                : (root.TryGetProperty("results", out var resProp) && resProp.ValueKind == JsonValueKind.Array
                    ? resProp
                    : default));

        if (arr.ValueKind != JsonValueKind.Array) return Array.Empty<TitleSummary>();
        var list = new List<TitleSummary>();
        foreach (var el in arr.EnumerateArray())
        {
            var parsed = ParseTitleElement(el);
            if (parsed == null) continue;
            if (filter == ContentFilter.VIDEO && !parsed.Type.IsVideo()) continue;
            if (filter == ContentFilter.BOOK && !parsed.Type.IsBook()) continue;
            list.Add(parsed);
        }
        return list;
    }

    public async Task<LogsPageResult> FetchLogsPageAsync(
        string? cursor = null,
        int limit = 25,
        CancellationToken ct = default)
    {
        var cursorParam = string.IsNullOrWhiteSpace(cursor) ? "" : $"&cursor={Uri.EscapeDataString(cursor)}";
        using var req = CreateRequest(HttpMethod.Get, $"/api/logs/page?limit={limit}{cursorParam}");
        using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
        {
            return new LogsPageResult(Array.Empty<WatchLog>(), null, false);
        }

        var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var logs = new List<WatchLog>();
        if (root.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in itemsEl.EnumerateArray())
            {
                var log = ParseWatchLogElement(item);
                if (log != null) logs.Add(log);
            }
        }
        var nextCursor = root.TryGetProperty("nextCursor", out var nc) && nc.ValueKind == JsonValueKind.String
            ? nc.GetString()
            : null;
        var hasMore = root.TryGetProperty("hasMore", out var hm) && hm.ValueKind == JsonValueKind.True
                      || !string.IsNullOrWhiteSpace(nextCursor);
        return new LogsPageResult(logs, nextCursor, hasMore);
    }

    public async Task<SyncPushResult> PushSyncAsync(
        IReadOnlyList<OutboxEvent> events,
        CancellationToken ct = default)
    {
        var payload = new
        {
            deviceId = _deviceId,
            mutations = events.Select(e => new
            {
                id = e.Id,
                type = e.Type,
                entityId = e.EntityId,
                createdAt = e.CreatedAt,
                payload = TryParseJsonElement(e.PayloadJson)
            }).ToList()
        };

        using var req = CreateRequest(HttpMethod.Post, "/api/sync/push", payload);
        using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        var remappedTitles = new Dictionary<string, string>(StringComparer.Ordinal);
        if (root.TryGetProperty("remappedTitleIds", out var rt) && rt.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in rt.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.String)
                    remappedTitles[prop.Name] = prop.Value.GetString()!;
            }
        }

        var remappedLogs = new Dictionary<string, string>(StringComparer.Ordinal);
        if (root.TryGetProperty("remappedLogIds", out var rl) && rl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in rl.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.String)
                    remappedLogs[prop.Name] = prop.Value.GetString()!;
            }
        }

        var cursor = root.TryGetProperty("cursor", out var cEl) && cEl.ValueKind == JsonValueKind.String
            ? cEl.GetString() ?? DateTimeOffset.UtcNow.ToString("O")
            : DateTimeOffset.UtcNow.ToString("O");
        var accepted = root.TryGetProperty("acceptedCount", out var acEl) && acEl.TryGetInt32(out var ac)
            ? ac
            : events.Count;

        return new SyncPushResult(accepted, cursor, remappedTitles, remappedLogs);
    }

    public async Task<SyncPullResult> PullSyncAsync(
        string? sinceCursor = null,
        CancellationToken ct = default)
    {
        var sinceParam = string.IsNullOrWhiteSpace(sinceCursor) ? "" : $"?since={Uri.EscapeDataString(sinceCursor)}";
        using var req = CreateRequest(HttpMethod.Get, $"/api/sync/pull{sinceParam}");
        using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        var titleMap = new Dictionary<string, TitleSummary>(StringComparer.OrdinalIgnoreCase);
        if (root.TryGetProperty("changes", out var changesEl) && changesEl.ValueKind == JsonValueKind.Object)
        {
            if (changesEl.TryGetProperty("titles", out var titlesEl) && titlesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var tItem in titlesEl.EnumerateArray())
                {
                    var t = ParseTitleElement(tItem);
                    if (t != null) titleMap[t.Id] = t;
                }
            }
        }

        var logs = new List<WatchLog>();
        var arrayProp = root.TryGetProperty("changes", out var chEl) &&
                        chEl.ValueKind == JsonValueKind.Object &&
                        chEl.TryGetProperty("logs", out var chLogsEl) &&
                        chLogsEl.ValueKind == JsonValueKind.Array
            ? chLogsEl
            : (root.TryGetProperty("logs", out var lEl) && lEl.ValueKind == JsonValueKind.Array
                ? lEl
                : (root.TryGetProperty("items", out var iEl) && iEl.ValueKind == JsonValueKind.Array ? iEl : default));

        if (arrayProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in arrayProp.EnumerateArray())
            {
                if (GetNullableString(item, "deletedAt") != null) continue;
                var parsed = ParseWatchLogElement(item, titleMap);
                if (parsed != null) logs.Add(parsed);
            }
        }

        var cursor = GetNullableString(root, "serverTime")
                     ?? GetNullableString(root, "cursor")
                     ?? DateTimeOffset.UtcNow.ToString("O");
        var hasMore = root.TryGetProperty("hasMore", out var hm) && hm.ValueKind == JsonValueKind.True;

        return new SyncPullResult(logs, cursor, hasMore);
    }

    public async Task<IReadOnlyList<DiscussionPost>> FetchDiscussionsAsync(
        string? query = null,
        DiscussionSort sort = DiscussionSort.LATEST,
        CancellationToken ct = default)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Get, "/api/discussions/all?limit=100");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return Array.Empty<DiscussionPost>();

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var arr = root.ValueKind == JsonValueKind.Array
                ? root
                : (root.TryGetProperty("items", out var iEl) && iEl.ValueKind == JsonValueKind.Array ? iEl : default);

            if (arr.ValueKind != JsonValueKind.Array) return Array.Empty<DiscussionPost>();
            var list = new List<DiscussionPost>();
            foreach (var el in arr.EnumerateArray())
            {
                var post = ParseDiscussionPostElement(el, _locale);
                if (post != null) list.Add(post);
            }

            return TogetherSpreadCoordinator.FilterAndSort(list, query, sort);
        }
        catch
        {
            return Array.Empty<DiscussionPost>();
        }
    }

    public async Task<DiscussionPost?> FetchDiscussionByIdAsync(string discussionId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(discussionId)) return null;
        try
        {
            using var req = CreateRequest(HttpMethod.Get, $"/api/discussions/{Uri.EscapeDataString(discussionId.Trim())}");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            return ParseDiscussionPostElement(doc.RootElement, _locale);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return null;
        }
    }

    public async Task<DiscussionDetail?> FetchDiscussionDetailAsync(string discussionId, CancellationToken ct = default, DiscussionPost? fallbackPost = null)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Get, $"/api/discussions/{Uri.EscapeDataString(discussionId)}/comments?limit=200");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode)
            {
                return null;
            }

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var comments = new List<DiscussionComment>();

            if (root.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in root.EnumerateArray())
                {
                    var c = ParseDiscussionCommentElement(item, discussionId, _locale);
                    if (c != null) comments.Add(c);
                }
            }
            else if (root.ValueKind == JsonValueKind.Object)
            {
                if (root.TryGetProperty("comments", out var cEl) && cEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in cEl.EnumerateArray())
                    {
                        var c = ParseDiscussionCommentElement(item, discussionId, _locale);
                        if (c != null) comments.Add(c);
                    }
                }
                else
                {
                    var single = ParseDiscussionCommentElement(root, discussionId, _locale);
                    if (single != null) comments.Add(single);
                }
            }

            var post = fallbackPost ?? new DiscussionPost(
                Id: discussionId,
                TitleId: discussionId,
                Title: new TitleSummary(discussionId, Title: "작품 이야기"),
                Body: comments.FirstOrDefault()?.Body ?? "",
                CreatedAt: RecordDate.TodayDate(),
                UpdatedAt: RecordDate.TodayDate(),
                Author: new PublicAuthorProfile(),
                Reactions: new DiscussionReactionSummary(),
                CommentCount: comments.Count
            );

            return new DiscussionDetail(post, comments);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return null;
        }
    }

    public async Task<DiscussionPost?> CreateDiscussionAsync(
        TitleSummary title,
        string bodyText,
        bool spoiler,
        CancellationToken ct = default)
    {
        var payload = new
        {
            titleId = title.Id,
            title = title,
            body = bodyText,
            spoiler
        };
        using var req = CreateRequest(HttpMethod.Post, "/api/discussions", payload);
        using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        return ParseDiscussionPostElement(doc.RootElement, _locale);
    }

    public async Task<DiscussionComment?> CreateCommentAsync(
        string discussionId,
        string bodyText,
        bool spoiler,
        IReadOnlyList<CommentMention> mentions,
        bool syncLog = true,
        CancellationToken ct = default)
    {
        var payload = new
        {
            body = bodyText,
            spoiler,
            syncLog,
            mentions = mentions.Select(m => new { titleId = m.TitleId, titleName = m.TitleName, type = m.Type.ToWire() }).ToList()
        };
        using var req = CreateRequest(HttpMethod.Post, $"/api/discussions/{Uri.EscapeDataString(discussionId)}/comments", payload);
        using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        return ParseDiscussionCommentElement(doc.RootElement, discussionId, _locale);
    }

    public async Task<DiscussionReactionState?> FetchMyDiscussionReactionsAsync(
        string discussionId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(discussionId) || !Guid.TryParse(_userId, out _) || !Guid.TryParse(_deviceId, out _))
        {
            return null;
        }

        try
        {
            using var req = CreateRequest(HttpMethod.Get, $"/api/discussions/{Uri.EscapeDataString(discussionId)}/reactions/me");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            return ParseDiscussionReactionStateElement(doc.RootElement);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return null;
        }
    }

    public async Task<DiscussionReactionState?> ToggleReactionAsync(
        string discussionId,
        DiscussionReactionType reactionType,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(discussionId) || !Guid.TryParse(_userId, out _) || !Guid.TryParse(_deviceId, out _))
        {
            return null;
        }

        try
        {
            var payload = new { type = reactionType.ToString() };
            using var req = CreateRequest(HttpMethod.Put, $"/api/discussions/{Uri.EscapeDataString(discussionId)}/reactions", payload);
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(body)) return null;
            using var doc = JsonDocument.Parse(body);
            return ParseDiscussionReactionStateElement(doc.RootElement);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return null;
        }
    }

    public async Task<RecommendationApiResponse> FetchRecommendationStateAsync(CancellationToken ct = default)
    {
        if (!Guid.TryParse(_userId, out _) || !Guid.TryParse(_deviceId, out _))
        {
            return new RecommendationApiResponse(false, null, null, IsNetworkError: false, ErrorMessage: "Not connected");
        }

        try
        {
            using var req = CreateRequest(HttpMethod.Get, "/api/recommendations/state");
            using var res = await SendWithTimeoutAsync(req, RecommendationStateTimeout, ct).ConfigureAwait(false);
            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var parsed = TryParseRecommendationStateBody(body, _locale);
            return new RecommendationApiResponse(
                IsSuccess: res.IsSuccessStatusCode && parsed != null,
                StatusCode: (int)res.StatusCode,
                State: parsed,
                IsNetworkError: false,
                ErrorMessage: res.IsSuccessStatusCode ? null : res.ReasonPhrase
            );
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return new RecommendationApiResponse(
                IsSuccess: false,
                StatusCode: null,
                State: null,
                IsNetworkError: true,
                ErrorMessage: ex.Message
            );
        }
    }

    public async Task<RecommendationApiResponse> GenerateRecommendationsAsync(string requestId, CancellationToken ct = default)
    {
        if (!Guid.TryParse(_userId, out _) || !Guid.TryParse(_deviceId, out _))
        {
            return new RecommendationApiResponse(false, null, null, IsNetworkError: false, ErrorMessage: "Not connected");
        }

        try
        {
            using var req = CreateRequest(HttpMethod.Post, "/api/recommendations/generate", new { requestId });
            using var res = await SendWithTimeoutAsync(req, RecommendationGenerateTimeout, ct).ConfigureAwait(false);
            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var parsed = TryParseRecommendationStateBody(body, _locale);
            return new RecommendationApiResponse(
                IsSuccess: res.IsSuccessStatusCode,
                StatusCode: (int)res.StatusCode,
                State: parsed,
                IsNetworkError: false,
                ErrorMessage: res.IsSuccessStatusCode ? null : res.ReasonPhrase
            );
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return new RecommendationApiResponse(
                IsSuccess: false,
                StatusCode: null,
                State: null,
                IsNetworkError: true,
                ErrorMessage: ex.Message
            );
        }
    }

    public async Task<IReadOnlyList<RecommendationItem>> EnrichMissingRecommendationPostersAsync(
        IReadOnlyList<RecommendationItem> items,
        CancellationToken ct = default)
    {
        if (items.Count == 0 || items.All(i => !string.IsNullOrWhiteSpace(i.Title.PosterUrl)))
        {
            return items;
        }

        var enrichTasks = items.Select(async item =>
        {
            if (!string.IsNullOrWhiteSpace(item.Title.PosterUrl)) return item;
            try
            {
                var scope = item.Title.Type.IsBook() ? ContentFilter.BOOK : ContentFilter.VIDEO;
                var searchResults = await SearchTitlesSingleScopeAsync(item.Title.Title, scope, ct).ConfigureAwait(false);
                var match = searchResults.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.PosterUrl));
                if (match != null)
                {
                    return item with
                    {
                        Title = item.Title with
                        {
                            Id = string.IsNullOrWhiteSpace(item.Title.ProviderId) || item.Title.Id.Contains(":book:") || item.Title.Id.Length > 28
                                ? match.Id
                                : item.Title.Id,
                            Provider = match.Provider,
                            ProviderId = match.ProviderId,
                            PosterUrl = match.PosterUrl,
                            Year = item.Title.Year ?? match.Year,
                            Authors = item.Title.SafeAuthors.Count > 0 ? item.Title.Authors : match.Authors,
                            Publisher = item.Title.Publisher ?? match.Publisher,
                            Isbn13 = item.Title.Isbn13 ?? match.Isbn13,
                            KdcCode = item.Title.KdcCode ?? match.KdcCode
                        }
                    };
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch
            {
                // Ignore enrichment error; recommendation card still renders cleanly
            }
            return item;
        });

        return (await Task.WhenAll(enrichTasks).ConfigureAwait(false)).ToList();
    }

    public static RecommendationStateSnapshot? TryParseRecommendationStateBody(string? body, string locale = "ko")
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            return ParseRecommendationState(doc.RootElement, locale);
        }
        catch
        {
            return null;
        }
    }

    public static RecommendationStateSnapshot? ParseRecommendationState(JsonElement root, string locale = "ko")
    {
        var normalizedLocale = string.IsNullOrWhiteSpace(locale)
            ? "ko"
            : (locale.Trim().StartsWith("ko", StringComparison.OrdinalIgnoreCase) ? "ko" : "en");

        if (root.ValueKind != JsonValueKind.Object && root.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var arr = root.ValueKind == JsonValueKind.Array
            ? root
            : (root.TryGetProperty("items", out var iEl) && iEl.ValueKind == JsonValueKind.Array ? iEl : default);

        var list = new List<RecommendationItem>();
        if (arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in arr.EnumerateArray())
            {
                TitleSummary? title = null;
                if (el.TryGetProperty("catalogTitle", out var catEl) && catEl.ValueKind == JsonValueKind.Object)
                {
                    title = ParseTitleElement(catEl);
                }
                if (title == null && el.TryGetProperty("title", out var tEl) && tEl.ValueKind == JsonValueKind.Object)
                {
                    title = ParseTitleElement(tEl);
                }
                if (title == null)
                {
                    title = ParseTitleElement(el);
                }
                if (title == null) continue;

                var topAuthor = GetNullableString(el, "author");
                if (title.SafeAuthors.Count == 0 && !string.IsNullOrWhiteSpace(topAuthor))
                {
                    title = title with
                    {
                        Authors = topAuthor.Split(new[] { ',', '^', '|' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
                    };
                }
                var topYear = GetNullableInt(el, "year");
                if (!title.Year.HasValue && topYear.HasValue)
                {
                    title = title with { Year = topYear };
                }
                var topPoster = GetNullableString(el, "posterUrl");
                if (string.IsNullOrWhiteSpace(title.PosterUrl) && !string.IsNullOrWhiteSpace(topPoster))
                {
                    title = title with { PosterUrl = topPoster };
                }

                var reason = GetStringOrDefault(el, "reason", "");
                list.Add(new RecommendationItem(
                    Title: title,
                    ReasonKo: GetStringOrDefault(el, "reasonKo", reason),
                    ReasonEn: GetStringOrDefault(el, "reasonEn", reason),
                    MatchedFromTitle: GetNullableString(el, "matchedFromTitle"),
                    Score: GetNullableDouble(el, "score") ?? 0.9,
                    Locale: normalizedLocale
                ));
            }
        }

        if (root.ValueKind == JsonValueKind.Array)
        {
            return new RecommendationStateSnapshot(
                Items: list,
                Quota: new RecommendationQuota(),
                HasBatch: list.Count > 0,
                Eligible: true,
                Locale: normalizedLocale
            );
        }

        var quota = new RecommendationQuota();
        if (root.TryGetProperty("quota", out var qEl) && qEl.ValueKind == JsonValueKind.Object)
        {
            var limit = GetNullableInt(qEl, "limit") ?? 3;
            var used = GetNullableInt(qEl, "used") ?? 0;
            var remaining = GetNullableInt(qEl, "remaining") ?? Math.Max(0, limit - used);
            quota = new RecommendationQuota(
                Date: GetStringOrDefault(qEl, "date", ""),
                Timezone: GetStringOrDefault(qEl, "timezone", "Asia/Seoul"),
                Limit: limit,
                Used: used,
                Remaining: remaining,
                ResetsAt: GetNullableString(qEl, "resetsAt")
            );
        }

        return new RecommendationStateSnapshot(
            Items: list,
            Quota: quota,
            GeneratedAt: GetNullableString(root, "generatedAt"),
            GenerationId: GetNullableString(root, "generationId"),
            Generating: GetNullableBool(root, "generating") ?? false,
            HasBatch: GetNullableBool(root, "hasBatch") ?? (list.Count > 0),
            Eligible: GetNullableBool(root, "eligible") ?? false,
            Locale: normalizedLocale
        );
    }

    private static string? NormalizeExclusionProvider(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return raw.Trim().ToUpperInvariant() switch
        {
            "TMDB" => "TMDB",
            "KAKAO" or "KAKAO_BOOKS" => "KAKAO",
            "NAVER" => "NAVER",
            "GOOGLE_BOOKS" => "GOOGLE_BOOKS",
            "LOCAL" => "LOCAL",
            _ => null
        };
    }

    public async Task<bool> ExcludeRecommendationAsync(RecommendationItem item, CancellationToken ct = default)
    {
        try
        {
            var normalizedProvider = NormalizeExclusionProvider(item.Title.Provider);
            var payload = new
            {
                name = item.Title.Title,
                type = item.Title.Type.ToWire(),
                year = item.Title.Year,
                provider = normalizedProvider,
                providerId = normalizedProvider != null && !string.IsNullOrWhiteSpace(item.Title.ProviderId)
                    ? item.Title.ProviderId
                    : null,
                posterUrl = item.Title.PosterUrl,
                reason = item.ReasonDisplay
            };
            using var req = CreateRequest(HttpMethod.Put, "/api/recommendations/exclusions", payload);
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            return res.IsSuccessStatusCode;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> ExcludeRecommendationAsync(string titleId, CancellationToken ct = default)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Put, "/api/recommendations/exclusions", new { name = titleId, type = "movie" });
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            return res.IsSuccessStatusCode;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return false;
        }
    }

    public async Task<AccountProfile?> FetchProfileAsync(CancellationToken ct = default)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Get, "/api/auth/profile");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            return ParseProfileElement(doc.RootElement);
        }
        catch
        {
            return null;
        }
    }

    public static AccountProfile ParseProfileElement(JsonElement root)
    {
        var nickname = GetNullableString(root, "nickname") ?? GetNullableString(root, "displayName") ?? string.Empty;
        var personaKey = GetNullableString(root, "personaKey") ?? GetNullableString(root, "avatarPreset") ?? "cinema_keeper";
        var pairingCode = GetNullableString(root, "pairingCode") ?? GetNullableString(root, "recoveryCode");
        return new AccountProfile(
            UserId: GetStringOrDefault(root, "userId", ""),
            DisplayName: string.IsNullOrWhiteSpace(nickname) ? "나의 기록실" : nickname.Trim(),
            Handle: GetStringOrDefault(root, "handle", ""),
            AvatarPreset: string.IsNullOrWhiteSpace(personaKey) ? "cinema_keeper" : personaKey.Trim(),
            Bio: GetStringOrDefault(root, "bio", ""),
            RecoveryCode: pairingCode,
            RecoveryCodeIssuedAt: GetNullableString(root, "profileUpdatedAt")
        );
    }

    public async Task<AccountProfile?> UpdateProfileAsync(AccountProfile profile, CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                nickname = profile.DisplayName == "나의 기록실" ? "" : profile.DisplayName,
                personaKey = profile.AvatarPreset
            };
            using var req = CreateRequest(HttpMethod.Patch, "/api/auth/profile", payload);
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(body))
            {
                using var doc = JsonDocument.Parse(body);
                return ParseProfileElement(doc.RootElement);
            }
            return await FetchProfileAsync(ct).ConfigureAwait(false) ?? profile;
        }
        catch
        {
            return null;
        }
    }

    public async Task<(string UserId, string DeviceId, string Code, string IssuedAt)?> RegisterDeviceAsync(CancellationToken ct = default)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Post, "/api/auth/register", new { });
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var code = GetNullableString(root, "pairingCode")
                       ?? GetNullableString(root, "recoveryCode")
                       ?? GetNullableString(root, "code");
            var userId = GetNullableString(root, "userId");
            var deviceId = GetNullableString(root, "deviceId");
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(code))
            {
                return null;
            }
            _userId = userId.Trim();
            _deviceId = deviceId.Trim();
            var issuedAt = GetStringOrDefault(root, "issuedAt", DateTimeOffset.UtcNow.ToString("O"));
            return (_userId, _deviceId, code.Trim(), issuedAt);
        }
        catch
        {
            return null;
        }
    }

    public async Task<(string Code, string IssuedAt)?> IssueRecoveryCodeAsync(CancellationToken ct = default)
    {
        var registered = await RegisterDeviceAsync(ct).ConfigureAwait(false);
        return registered.HasValue ? (registered.Value.Code, registered.Value.IssuedAt) : null;
    }

    public Task<PairPreviewResult?> PreviewPairAsync(string recoveryCode, int localLogCount, CancellationToken ct = default)
    {
        return Task.FromResult<PairPreviewResult?>(new PairPreviewResult(
            TargetUserId: "remote-user",
            TargetDisplayName: "연결할 기록실",
            TargetLogCount: 0,
            LocalLogCount: localLogCount,
            EstimatedMergedCount: localLogCount,
            RecoveryCode: recoveryCode.Trim()
        ));
    }

    public async Task<PairCommitResult?> CommitPairAsync(string recoveryCode, CancellationToken ct = default)
    {
        try
        {
            var payload = new
            {
                code = recoveryCode.Trim(),
                oldUserId = Guid.TryParse(_userId, out _) ? _userId : null
            };
            using var req = CreateRequest(HttpMethod.Post, "/api/auth/pair", payload);
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var userId = GetStringOrDefault(root, "userId", "");
            var deviceId = GetStringOrDefault(root, "deviceId", _deviceId);
            var pairingCode = GetStringOrDefault(root, "pairingCode", recoveryCode.Trim());
            if (!string.IsNullOrWhiteSpace(userId)) _userId = userId;
            if (!string.IsNullOrWhiteSpace(deviceId)) _deviceId = deviceId;
            return new PairCommitResult(
                UserId: userId,
                SessionToken: deviceId,
                MergedLogCount: 0,
                RecoveryCode: pairingCode
            );
        }
        catch
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<LinkedDevice>> FetchLinkedDevicesAsync(CancellationToken ct = default)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Get, "/api/auth/devices");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return Array.Empty<LinkedDevice>();

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var arr = root.ValueKind == JsonValueKind.Array
                ? root
                : (root.TryGetProperty("devices", out var dEl) && dEl.ValueKind == JsonValueKind.Array ? dEl : default);

            if (arr.ValueKind != JsonValueKind.Array) return Array.Empty<LinkedDevice>();
            var list = new List<LinkedDevice>();
            foreach (var el in arr.EnumerateArray())
            {
                var id = GetStringOrDefault(el, "id", "");
                var browser = GetNullableString(el, "browser");
                var os = GetNullableString(el, "os");
                var label = !string.IsNullOrWhiteSpace(browser) || !string.IsNullOrWhiteSpace(os)
                    ? $"{browser ?? "App"} · {os ?? "Windows"}"
                    : GetStringOrDefault(el, "deviceName", "연결 기기");
                list.Add(new LinkedDevice(
                    Id: id,
                    DeviceName: label,
                    Platform: os ?? GetStringOrDefault(el, "platform", "Windows"),
                    LastSeenAt: GetStringOrDefault(el, "lastSeenAt", RecordDate.TodayDate()),
                    IsCurrent: GetNullableBool(el, "isCurrent") ?? (id == _deviceId)
                ));
            }
            return list;
        }
        catch
        {
            return Array.Empty<LinkedDevice>();
        }
    }

    public async Task<bool> UnlinkDeviceAsync(string targetDeviceId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(targetDeviceId)
            || !Guid.TryParse(_userId, out _)
            || !Guid.TryParse(_deviceId, out _))
        {
            return false;
        }

        try
        {
            using var req = CreateRequest(HttpMethod.Delete, $"/api/auth/devices/{Uri.EscapeDataString(targetDeviceId.Trim())}");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            return res.IsSuccessStatusCode;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return false;
        }
    }

    public async Task<IReadOnlyList<FeedbackThread>> FetchFeedbackThreadsAsync(CancellationToken ct = default)
    {
        try
        {
            using var req = CreateRequest(HttpMethod.Get, "/api/feedback/threads");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return Array.Empty<FeedbackThread>();

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var arr = root.ValueKind == JsonValueKind.Array
                ? root
                : (root.TryGetProperty("threads", out var tEl) && tEl.ValueKind == JsonValueKind.Array ? tEl : default);

            if (arr.ValueKind != JsonValueKind.Array) return Array.Empty<FeedbackThread>();
            var summaries = new List<FeedbackThread>();
            foreach (var el in arr.EnumerateArray())
            {
                summaries.Add(ParseFeedbackThreadElement(el, _locale));
            }

            var detailTasks = summaries.Select(async summary =>
            {
                if (summary.Messages.Count > 0) return summary;
                var detail = await FetchFeedbackThreadDetailAsync(summary.Id, ct).ConfigureAwait(false);
                return detail != null
                    ? detail with { LastMessagePreview = string.IsNullOrWhiteSpace(summary.LastMessagePreview) ? detail.LastMessagePreview : summary.LastMessagePreview }
                    : summary;
            });

            return (await Task.WhenAll(detailTasks).ConfigureAwait(false)).ToList();
        }
        catch
        {
            return Array.Empty<FeedbackThread>();
        }
    }

    public async Task<FeedbackThread?> FetchFeedbackThreadDetailAsync(string threadId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(threadId)) return null;
        try
        {
            using var req = CreateRequest(HttpMethod.Get, $"/api/feedback/threads/{Uri.EscapeDataString(threadId)}");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(body);
            return ParseFeedbackThreadElement(doc.RootElement, _locale);
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> CreateFeedbackThreadAsync(
        string category,
        string? subject,
        string messageBody,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(messageBody)) return false;
        try
        {
            var normalizedCategory = NormalizeFeedbackCategory(category);
            var normalizedSubject = string.IsNullOrWhiteSpace(subject) ? null : subject.Trim();
            var payload = new
            {
                category = normalizedCategory,
                subject = normalizedSubject,
                body = messageBody.Trim()
            };
            using var req = CreateRequest(HttpMethod.Post, "/api/feedback/threads", payload);
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            return res.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public static string NormalizeFeedbackCategory(string? category) =>
        category?.Trim().ToUpperInvariant() switch
        {
            "BUG" => "BUG",
            "IDEA" => "IDEA",
            "OTHER" => "OTHER",
            _ => "QUESTION"
        };

    public static string FormatFeedbackCategory(string? category, string locale = "ko")
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        return NormalizeFeedbackCategory(category) switch
        {
            "BUG" => isEn ? "Bug" : "버그",
            "IDEA" => isEn ? "Idea" : "제안",
            "OTHER" => isEn ? "Other" : "기타",
            _ => isEn ? "Question" : "질문"
        };
    }

    public static string FormatFeedbackStatus(string? status, string locale = "ko")
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        return status?.Trim().ToUpperInvariant() switch
        {
            "ANSWERED" => isEn ? "Answered" : "답변 완료",
            "CLOSED" => isEn ? "Closed" : "종료",
            _ => isEn ? "Open" : "확인 대기"
        };
    }

    private static FeedbackThread ParseFeedbackThreadElement(JsonElement el, string locale)
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        var id = GetStringOrDefault(el, "id", Guid.NewGuid().ToString("N"));
        var category = NormalizeFeedbackCategory(GetNullableString(el, "category"));
        var status = GetStringOrDefault(el, "status", "OPEN");
        var rawSubject = GetNullableString(el, "subject");
        var subject = string.IsNullOrWhiteSpace(rawSubject)
            ? (isEn ? "Untitled" : "제목 없음")
            : rawSubject!.Trim();
        var createdAt = GetStringOrDefault(el, "createdAt", RecordDate.TodayDate());
        var updatedAt = GetStringOrDefault(el, "updatedAt", createdAt);
        var updatedDisplay = RecordDate.FormatDisplayDate(null, updatedAt, locale);

        var msgs = new List<FeedbackMessage>();
        if (el.TryGetProperty("messages", out var mEl) && mEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var m in mEl.EnumerateArray())
            {
                var role = GetNullableString(m, "authorRole")
                           ?? GetNullableString(m, "senderRole")
                           ?? "USER";
                var isMine = string.Equals(role, "USER", StringComparison.OrdinalIgnoreCase);
                var roleLabel = isMine
                    ? (isEn ? "My message" : "내 문의")
                    : (isEn ? "ottline team" : "ottline 답변");
                var msgCreated = GetStringOrDefault(m, "createdAt", createdAt);
                var msgDateDisplay = RecordDate.FormatDisplayDate(null, msgCreated, locale);
                msgs.Add(new FeedbackMessage(
                    Id: GetStringOrDefault(m, "id", Guid.NewGuid().ToString("N")),
                    SenderRole: role,
                    Body: GetStringOrDefault(m, "body", ""),
                    CreatedAt: msgDateDisplay,
                    RoleDisplay: roleLabel,
                    IsMine: isMine
                ));
            }
        }

        var lastPreview = GetNullableString(el, "lastMessagePreview")
                          ?? msgs.LastOrDefault()?.Body
                          ?? (isEn ? "No messages yet." : "메시지가 없어요.");

        return new FeedbackThread(
            Id: id,
            Category: category,
            Subject: subject,
            Status: status,
            CreatedAt: createdAt,
            UpdatedAt: updatedAt,
            Messages: msgs,
            CategoryDisplay: FormatFeedbackCategory(category, locale),
            StatusDisplay: FormatFeedbackStatus(status, locale),
            LastMessagePreview: lastPreview,
            UpdatedAtDisplay: updatedDisplay
        );
    }

    public async Task<ServerAccountDeleteResult> DeleteServerAccountAsync(CancellationToken ct = default)
    {
        if (!Guid.TryParse(_userId, out _) || !Guid.TryParse(_deviceId, out _))
        {
            return new ServerAccountDeleteResult(ServerAccountDeleteOutcome.NotConnected);
        }

        try
        {
            using var req = CreateRequest(HttpMethod.Delete, "/api/auth/account");
            using var res = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
            if (res.IsSuccessStatusCode)
            {
                return new ServerAccountDeleteResult(
                    ServerAccountDeleteOutcome.Deleted,
                    (int)res.StatusCode
                );
            }

            return new ServerAccountDeleteResult(
                ServerAccountDeleteOutcome.HttpError,
                (int)res.StatusCode,
                res.ReasonPhrase
            );
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return new ServerAccountDeleteResult(
                ServerAccountDeleteOutcome.NetworkError,
                null,
                ex.Message
            );
        }
    }

    /// <summary>
    /// Posts to /api/nalytic/events with platform="pwa" (matching backend DB CHECK constraint)
    /// and Windows Native metadata in properties.
    /// </summary>
    public async Task TrackAnalyticsEventAsync(
        string eventName,
        IDictionary<string, object?>? properties = null,
        CancellationToken ct = default)
    {
        try
        {
            var mergedProps = new Dictionary<string, object?>
            {
                ["osFamily"] = "windows",
                ["deviceType"] = "desktop",
                ["installState"] = "ms_store_native",
                ["windowsRuntime"] = "native",
                ["windowsAppVersion"] = "2.0.0.0",
                ["architecture"] = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString().ToLowerInvariant()
            };
            if (properties != null)
            {
                foreach (var kv in properties)
                {
                    mergedProps[kv.Key] = kv.Value;
                }
            }

            var payload = new
            {
                eventName,
                platform = "pwa", // Matches backend DB constraint ^(web|pwa|twa|ios_native)$
                deviceId = _deviceId,
                occurredAt = DateTimeOffset.UtcNow.ToString("O"),
                properties = mergedProps
            };

            using var req = CreateRequest(HttpMethod.Post, "/api/nalytic/events", payload);
            using var _ = await SendWithTimeoutAsync(req, DefaultRequestTimeout, ct).ConfigureAwait(false);
        }
        catch
        {
            // Analytics is fire-and-forget and never blocks UX.
        }
    }

    public static TitleSummary? ParseTitleElement(JsonElement el)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;
        var id = GetNullableString(el, "id") ?? GetNullableString(el, "titleId");
        var title = GetNullableString(el, "title") ?? GetNullableString(el, "name");
        if (string.IsNullOrWhiteSpace(title)) return null;

        var provider = GetStringOrDefault(el, "provider", "tmdb").ToLowerInvariant();
        var type = TitleTypeExtensions.FromWire(GetNullableString(el, "type"));
        var providerId = GetStringOrDefault(el, "providerId", id ?? Guid.NewGuid().ToString("N"));
        var resolvedId = string.IsNullOrWhiteSpace(id) ? $"{provider}:{type.ToWire()}:{providerId}" : id!;

        var authors = GetStringArray(el, "authors");
        if (authors.Count == 0)
        {
            var singleAuthor = GetNullableString(el, "author");
            if (!string.IsNullOrWhiteSpace(singleAuthor))
            {
                authors = singleAuthor
                    .Split(new[] { ',', '^', '|' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();
            }
        }

        var rawPoster = GetNullableString(el, "posterUrl")
                        ?? GetNullableString(el, "poster_url")
                        ?? GetNullableString(el, "seasonPosterUrl")
                        ?? GetNullableString(el, "image");
        if (!string.IsNullOrWhiteSpace(rawPoster))
        {
            rawPoster = rawPoster.Trim();
            if (rawPoster.StartsWith("/t/p/", StringComparison.OrdinalIgnoreCase))
            {
                rawPoster = $"https://image.tmdb.org{rawPoster}";
            }
            else if (rawPoster.StartsWith("//", StringComparison.Ordinal))
            {
                rawPoster = $"https:{rawPoster}";
            }
        }

        return new TitleSummary(
            Id: resolvedId,
            Provider: provider,
            ProviderId: providerId,
            Type: type,
            Title: title!,
            OriginalTitle: GetNullableString(el, "originalTitle"),
            Year: GetNullableInt(el, "year"),
            PosterUrl: rawPoster,
            Overview: GetNullableString(el, "overview"),
            Genres: GetStringArray(el, "genres"),
            RuntimeMinutes: GetNullableInt(el, "runtimeMinutes"),
            Authors: authors,
            Publisher: GetNullableString(el, "publisher"),
            Isbn10: GetNullableString(el, "isbn10"),
            Isbn13: GetNullableString(el, "isbn13"),
            Pubdate: GetNullableString(el, "pubdate"),
            PageCount: GetNullableInt(el, "pageCount"),
            KdcCode: GetNullableString(el, "kdcCode"),
            SeasonCount: GetNullableInt(el, "seasonCount"),
            EpisodeCount: GetNullableInt(el, "episodeCount")
        );
    }

    public static WatchLog? ParseWatchLogElement(JsonElement el, IReadOnlyDictionary<string, TitleSummary>? titleMap = null)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;
        TitleSummary? title = null;
        if (el.TryGetProperty("title", out var tEl) && tEl.ValueKind == JsonValueKind.Object)
        {
            title = ParseTitleElement(tEl);
        }
        var titleId = GetNullableString(el, "titleId") ?? title?.Id;
        if (title == null && !string.IsNullOrWhiteSpace(titleId) && titleMap != null && titleMap.TryGetValue(titleId!, out var mappedTitle))
        {
            title = mappedTitle;
        }
        if (title == null) return null;

        var seasonPoster = GetNullableString(el, "seasonPosterUrl") ?? GetNullableString(el, "posterUrl");
        if (string.IsNullOrWhiteSpace(title.PosterUrl) && !string.IsNullOrWhiteSpace(seasonPoster))
        {
            title = title with { PosterUrl = seasonPoster };
        }

        var id = GetStringOrDefault(el, "id", $"remote-log:{Guid.NewGuid():N}");
        var occurredAt = GetNullableString(el, "watchedAt")
                         ?? GetNullableString(el, "occurredAt")
                         ?? GetStringOrDefault(el, "createdAt", RecordDate.ToNoonUtcIso(RecordDate.TodayDate()));
        var watchedOn = RecordDate.OccurredAtToWatchedOnDate(occurredAt, GetNullableString(el, "watchedOn"));

        return new WatchLog(
            Id: id,
            TitleId: titleId ?? title.Id,
            Title: title,
            Status: LogStatusExtensions.FromWire(GetNullableString(el, "status")),
            Rating: GetNullableDouble(el, "rating"),
            Reaction: GetNullableString(el, "reaction"),
            Ott: GetNullableString(el, "ott"),
            Place: GetNullableString(el, "place"),
            Occasion: GetNullableString(el, "occasion"),
            SeasonNumber: GetNullableInt(el, "seasonNumber"),
            EpisodeNumber: GetNullableInt(el, "episodeNumber"),
            Note: GetNullableString(el, "note"),
            Spoiler: GetNullableBool(el, "spoiler") ?? false,
            OccurredAt: occurredAt,
            WatchedOn: watchedOn,
            CreatedAt: GetStringOrDefault(el, "createdAt", occurredAt),
            UpdatedAt: GetStringOrDefault(el, "updatedAt", occurredAt),
            Revision: GetNullableInt(el, "revision") ?? 1,
            Origin: LogOriginExtensions.FromWire(GetNullableString(el, "origin")),
            SyncState: "synced"
        );
    }

    private static DiscussionPost? ParseDiscussionPostElement(JsonElement el, string locale = "ko")
    {
        if (el.ValueKind != JsonValueKind.Object) return null;
        var id = GetNullableString(el, "id");
        if (string.IsNullOrWhiteSpace(id)) return null;

        TitleSummary? title = null;
        if (el.TryGetProperty("title", out var tEl) && tEl.ValueKind == JsonValueKind.Object)
        {
            title = ParseTitleElement(tEl);
        }
        if (title == null)
        {
            var tId = GetStringOrDefault(el, "titleId", id!);
            var tName = GetStringOrDefault(el, "titleName", "작품 이야기");
            var tType = TitleTypeExtensions.FromWire(GetNullableString(el, "titleType"));
            var tYear = GetNullableInt(el, "titleYear");
            var tPoster = GetNullableString(el, "posterUrl");
            var tProvider = GetStringOrDefault(el, "titleProvider", "tmdb").ToLowerInvariant();
            var tProviderId = GetStringOrDefault(el, "titleProviderId", tId);
            title = new TitleSummary(
                Id: tId,
                Provider: tProvider,
                ProviderId: tProviderId,
                Type: tType,
                Title: tName,
                Year: tYear,
                PosterUrl: tPoster
            );
        }

        var commentCount = GetNullableInt(el, "commentCount") ?? 0;
        var createdAtRaw = GetStringOrDefault(el, "createdAt", RecordDate.TodayDate());
        var createdDateDisplay = RecordDate.FormatDisplayDate(null, createdAtRaw, locale);

        var author = new PublicAuthorProfile(DisplayName: createdDateDisplay, AvatarPreset: "cinema_keeper");
        if (el.TryGetProperty("author", out var aEl) && aEl.ValueKind == JsonValueKind.Object)
        {
            author = new PublicAuthorProfile(
                UserId: GetNullableString(aEl, "userId"),
                DisplayName: GetStringOrDefault(aEl, "displayName", createdDateDisplay),
                Handle: GetNullableString(aEl, "handle"),
                AvatarPreset: GetStringOrDefault(aEl, "avatarPreset", "cinema_keeper"),
                Bio: GetNullableString(aEl, "bio")
            );
        }

        var reactions = new DiscussionReactionSummary();
        if (el.TryGetProperty("reactionSummary", out var rsEl) && rsEl.ValueKind == JsonValueKind.Object)
        {
            reactions = new DiscussionReactionSummary(
                DoneCount: GetNullableInt(rsEl, "done") ?? 0,
                CuriousCount: GetNullableInt(rsEl, "curious") ?? 0,
                SaveCount: GetNullableInt(rsEl, "save") ?? 0
            );
        }
        else if (el.TryGetProperty("reactions", out var rEl) && rEl.ValueKind == JsonValueKind.Object)
        {
            var viewerList = new List<DiscussionReactionType>();
            if (rEl.TryGetProperty("viewerReactions", out var vrEl) && vrEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var v in vrEl.EnumerateArray())
                {
                    if (v.ValueKind == JsonValueKind.String)
                    {
                        var rt = DiscussionReactionTypeExtensions.FromWire(v.GetString());
                        if (rt.HasValue) viewerList.Add(rt.Value);
                    }
                }
            }
            reactions = new DiscussionReactionSummary(
                DoneCount: GetNullableInt(rEl, "doneCount") ?? GetNullableInt(rEl, "done") ?? 0,
                CuriousCount: GetNullableInt(rEl, "curiousCount") ?? GetNullableInt(rEl, "curious") ?? 0,
                SaveCount: GetNullableInt(rEl, "saveCount") ?? GetNullableInt(rEl, "save") ?? 0,
                ViewerReactions: viewerList
            );
        }

        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        var typeLabel = title.Type switch
        {
            TitleType.book => isEn ? "Book" : "책",
            TitleType.series => isEn ? "Series" : "시리즈",
            _ => isEn ? "Movie" : "영화"
        };
        var fallbackBody = $"{typeLabel}{(title.Year.HasValue ? $" · {title.Year.Value}" : "")} · {(isEn ? $"{commentCount} comments" : $"댓글 {commentCount}")}";
        var bodyText = GetNullableString(el, "body");
        if (string.IsNullOrWhiteSpace(bodyText))
        {
            bodyText = fallbackBody;
        }

        return new DiscussionPost(
            Id: id!,
            TitleId: title.Id,
            Title: title,
            Body: bodyText!,
            Spoiler: GetNullableBool(el, "spoiler") ?? false,
            CreatedAt: createdDateDisplay,
            UpdatedAt: GetStringOrDefault(el, "updatedAt", createdDateDisplay),
            Author: author,
            Reactions: reactions,
            CommentCount: commentCount,
            IsMine: GetNullableBool(el, "isMine") ?? false,
            RawCreatedAt: createdAtRaw
        );
    }

    private static DiscussionReactionState? ParseDiscussionReactionStateElement(JsonElement el)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;

        var summary = new DiscussionReactionSummary();
        if (el.TryGetProperty("summary", out var sEl) && sEl.ValueKind == JsonValueKind.Object)
        {
            summary = new DiscussionReactionSummary(
                DoneCount: GetNullableInt(sEl, "done") ?? GetNullableInt(sEl, "doneCount") ?? 0,
                CuriousCount: GetNullableInt(sEl, "curious") ?? GetNullableInt(sEl, "curiousCount") ?? 0,
                SaveCount: GetNullableInt(sEl, "save") ?? GetNullableInt(sEl, "saveCount") ?? 0
            );
        }

        var selectedTypes = new List<DiscussionReactionType>();
        if (el.TryGetProperty("selectedTypes", out var stEl) && stEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in stEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var rt = DiscussionReactionTypeExtensions.FromWire(item.GetString());
                    if (rt.HasValue && !selectedTypes.Contains(rt.Value))
                    {
                        selectedTypes.Add(rt.Value);
                    }
                }
            }
        }

        var selected = GetNullableBool(el, "selected") ?? (selectedTypes.Count > 0);
        return new DiscussionReactionState(
            Summary: summary with { ViewerReactions = selectedTypes },
            SelectedTypes: selectedTypes,
            Selected: selected
        );
    }

    private static DiscussionComment? ParseDiscussionCommentElement(JsonElement el, string discussionId, string locale = "ko")
    {
        if (el.ValueKind != JsonValueKind.Object) return null;
        var id = GetStringOrDefault(el, "id", Guid.NewGuid().ToString("N"));
        var defaultAuthor = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase) ? "Anonymous reader" : "익명 기록자";
        var authorName = GetNullableString(el, "authorName") ?? defaultAuthor;
        var userId = GetNullableString(el, "userId");
        var author = new PublicAuthorProfile(UserId: userId, DisplayName: authorName, AvatarPreset: "book_drifter");
        if (el.TryGetProperty("author", out var aEl) && aEl.ValueKind == JsonValueKind.Object)
        {
            author = new PublicAuthorProfile(
                UserId: GetNullableString(aEl, "userId") ?? userId,
                DisplayName: GetStringOrDefault(aEl, "displayName", authorName),
                Handle: GetNullableString(aEl, "handle"),
                AvatarPreset: GetStringOrDefault(aEl, "avatarPreset", "book_drifter"),
                Bio: GetNullableString(aEl, "bio")
            );
        }

        var mentions = new List<CommentMention>();
        if (el.TryGetProperty("mentions", out var mEl) && mEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var m in mEl.EnumerateArray())
            {
                mentions.Add(new CommentMention(
                    TitleId: GetStringOrDefault(m, "titleId", GetStringOrDefault(m, "providerId", "")),
                    TitleName: GetStringOrDefault(m, "titleName", GetStringOrDefault(m, "name", "")),
                    Type: TitleTypeExtensions.FromWire(GetNullableString(m, "type") ?? GetNullableString(m, "titleType"))
                ));
            }
        }

        var rawCreatedAt = GetStringOrDefault(el, "createdAt", RecordDate.TodayDate());
        var formattedDate = RecordDate.FormatDisplayDate(null, rawCreatedAt, locale);

        return new DiscussionComment(
            Id: id,
            DiscussionId: discussionId,
            Body: GetStringOrDefault(el, "body", ""),
            Spoiler: GetNullableBool(el, "spoiler") ?? false,
            CreatedAt: formattedDate,
            Author: author,
            Mentions: mentions,
            IsMine: GetNullableBool(el, "isMine") ?? false
        );
    }

    private static object TryParseJsonElement(string rawJson)
    {
        try
        {
            return JsonSerializer.Deserialize<JsonElement>(rawJson);
        }
        catch
        {
            return rawJson;
        }
    }

    private static string GetStringOrDefault(JsonElement el, string prop, string fallback) =>
        GetNullableString(el, prop) ?? fallback;

    private static string? GetNullableString(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String)
            return v.GetString();
        return null;
    }

    private static int? GetNullableInt(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i))
            return i;
        return null;
    }

    private static double? GetNullableDouble(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d))
            return d;
        return null;
    }

    private static bool? GetNullableBool(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v))
        {
            if (v.ValueKind == JsonValueKind.True) return true;
            if (v.ValueKind == JsonValueKind.False) return false;
        }
        return null;
    }

    private static IReadOnlyList<string> GetStringArray(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Array)
        {
            return v.EnumerateArray()
                .Where(x => x.ValueKind == JsonValueKind.String)
                .Select(x => x.GetString()!)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToList();
        }
        return Array.Empty<string>();
    }

    public void Dispose()
    {
        if (_disposeClient)
        {
            _httpClient.Dispose();
        }
    }
}
