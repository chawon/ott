using Ottline.Core.Models;

namespace Ottline.Core.Domain;

public sealed class TogetherSpreadCoordinator : IDisposable
{
    public const double TwoPaneMinWidth = 980.0;

    private readonly List<DiscussionPost> _allPosts = new();
    private List<DiscussionPost> _visiblePosts = new();
    private double _viewportWidth = 1360.0;
    private string _searchQuery = string.Empty;
    private DiscussionSort _sort = DiscussionSort.LATEST;

    private DiscussionPost? _selectedPost;
    private DiscussionDetail? _selectedDetail;
    private DiscussionReactionState _reactionState = DiscussionReactionState.Empty;
    private bool _isDetailLoading;
    private bool _hasDetailError;
    private bool _isNarrowDetailOpen;
    private bool _hasExplicitSelection;
    private long _selectionSequence;
    private CancellationTokenSource? _selectionCts;

    public event Action? StateChanged;

    public double ViewportWidth => _viewportWidth;
    public bool IsTwoPane => _viewportWidth >= TwoPaneMinWidth;
    public bool IsNarrowDetailOpen => _isNarrowDetailOpen;
    public bool ShowListPane => IsTwoPane || !_isNarrowDetailOpen;
    public bool ShowDetailPane => IsTwoPane || _isNarrowDetailOpen;
    public bool HasExplicitSelection => _hasExplicitSelection;

    public string SearchQuery => _searchQuery;
    public DiscussionSort Sort => _sort;

    public IReadOnlyList<DiscussionPost> AllPosts => _allPosts;
    public IReadOnlyList<DiscussionPost> VisiblePosts => _visiblePosts;
    public DiscussionPost? SelectedPost => _selectedPost;
    public DiscussionDetail? SelectedDetail => _selectedDetail;
    public DiscussionReactionState ReactionState => _reactionState;
    public bool IsDetailLoading => _isDetailLoading;
    public bool HasDetailError => _hasDetailError;

    public static IReadOnlyList<DiscussionPost> FilterAndSort(
        IEnumerable<DiscussionPost> posts,
        string? searchQuery,
        DiscussionSort sort)
    {
        IEnumerable<DiscussionPost> queryable = posts;
        if (!string.IsNullOrWhiteSpace(searchQuery))
        {
            var q = searchQuery.Trim();
            queryable = queryable.Where(p =>
                p.Title.Title.Contains(q, StringComparison.OrdinalIgnoreCase)
                || (p.Title.OriginalTitle?.Contains(q, StringComparison.OrdinalIgnoreCase) == true)
                || p.Body.Contains(q, StringComparison.OrdinalIgnoreCase)
                || (p.Author?.DisplayName?.Contains(q, StringComparison.OrdinalIgnoreCase) == true));
        }

        return sort switch
        {
            DiscussionSort.COMMENTS => queryable
                .OrderByDescending(p => p.CommentCount)
                .ThenByDescending(GetSortTimestamp, StringComparer.Ordinal)
                .ToList(),
            DiscussionSort.REACTIONS => queryable
                .OrderByDescending(p => p.Reactions?.TotalCount ?? 0)
                .ThenByDescending(GetSortTimestamp, StringComparer.Ordinal)
                .ToList(),
            _ => queryable
                .OrderByDescending(GetSortTimestamp, StringComparer.Ordinal)
                .ToList()
        };
    }

    private static string GetSortTimestamp(DiscussionPost post) =>
        !string.IsNullOrWhiteSpace(post.RawCreatedAt) ? post.RawCreatedAt : post.CreatedAt;

    /// <summary>
    /// Updates window/content width and returns a post that should be auto-loaded
    /// if transitioning to two-pane mode with no prior selection.
    /// </summary>
    public DiscussionPost? UpdateViewportWidth(double width)
    {
        if (width <= 0) return null;
        var wasTwoPane = IsTwoPane;
        _viewportWidth = width;
        var nowTwoPane = IsTwoPane;
        if (wasTwoPane == nowTwoPane) return null;

        DiscussionPost? postToAutoLoad = null;
        if (!nowTwoPane)
        {
            // Wide -> Narrow: keep reading the selected item if the user explicitly picked it;
            // otherwise land cleanly on the list without trapping them in an auto-selected item.
            _isNarrowDetailOpen = _selectedPost != null && _hasExplicitSelection;
        }
        else
        {
            // Narrow -> Wide: preserve current selection; if none, auto-select first visible post.
            _isNarrowDetailOpen = false;
            if (_selectedPost == null && _visiblePosts.Count > 0)
            {
                postToAutoLoad = _visiblePosts[0];
            }
        }

        StateChanged?.Invoke();
        return postToAutoLoad;
    }

    /// <summary>
    /// Replaces cached feed posts, applies current search & sort locally, and returns a post
    /// that needs detail loading (if preferred or auto-selected on desktop 2-pane).
    /// </summary>
    public DiscussionPost? ApplyFeed(
        IReadOnlyList<DiscussionPost> posts,
        string? preferredDiscussionId = null)
    {
        _allPosts.Clear();
        _allPosts.AddRange(posts);
        RebuildVisibleList();

        DiscussionPost? target = null;
        if (!string.IsNullOrWhiteSpace(preferredDiscussionId))
        {
            target = _allPosts.FirstOrDefault(p =>
                string.Equals(p.Id, preferredDiscussionId, StringComparison.OrdinalIgnoreCase));
        }

        if (target != null)
        {
            StateChanged?.Invoke();
            return target;
        }

        if (_selectedPost != null)
        {
            var refreshed = _allPosts.FirstOrDefault(p =>
                string.Equals(p.Id, _selectedPost.Id, StringComparison.OrdinalIgnoreCase));
            if (refreshed != null)
            {
                // Preserve existing viewer reaction selections while refreshing counts/metadata.
                var mergedReactions = refreshed.Reactions with
                {
                    ViewerReactions = _reactionState.SafeSelectedTypes
                };
                _selectedPost = refreshed with { Reactions = mergedReactions };
                if (_selectedDetail != null && string.Equals(_selectedDetail.Post.Id, _selectedPost.Id, StringComparison.OrdinalIgnoreCase))
                {
                    _selectedDetail = _selectedDetail with { Post = _selectedPost };
                }
                _reactionState = _reactionState with { Summary = mergedReactions };
                StateChanged?.Invoke();
                return null;
            }
        }

        if (_selectedPost == null && IsTwoPane && _visiblePosts.Count > 0)
        {
            StateChanged?.Invoke();
            return _visiblePosts[0];
        }

        StateChanged?.Invoke();
        return null;
    }

    public void SetSearchQuery(string? query)
    {
        var normalized = query ?? string.Empty;
        if (string.Equals(_searchQuery, normalized, StringComparison.Ordinal)) return;
        _searchQuery = normalized;
        RebuildVisibleList();
        StateChanged?.Invoke();
    }

    public void SetSort(DiscussionSort sort)
    {
        if (_sort == sort) return;
        _sort = sort;
        RebuildVisibleList();
        StateChanged?.Invoke();
    }

    public void CloseNarrowDetail()
    {
        if (!_isNarrowDetailOpen) return;
        _isNarrowDetailOpen = false;
        StateChanged?.Invoke();
    }

    public void ReopenNarrowDetailForCurrentSelection()
    {
        if (_selectedPost == null) return;
        _hasExplicitSelection = true;
        if (!IsTwoPane)
        {
            _isNarrowDetailOpen = true;
            StateChanged?.Invoke();
        }
    }

    public void PrependPost(DiscussionPost post)
    {
        _allPosts.RemoveAll(p => string.Equals(p.Id, post.Id, StringComparison.OrdinalIgnoreCase));
        _allPosts.Insert(0, post);
        RebuildVisibleList();
        StateChanged?.Invoke();
    }

    public async Task<bool> SelectPostAsync(
        DiscussionPost post,
        Func<string, DiscussionPost, CancellationToken, Task<DiscussionDetail?>> loadDetail,
        Func<string, CancellationToken, Task<DiscussionReactionState?>> loadReactions,
        bool openNarrowDetail = true,
        bool isExplicit = true)
    {
        CancelActiveSelectionLoad();
        var seq = Interlocked.Increment(ref _selectionSequence);
        var cts = new CancellationTokenSource();
        _selectionCts = cts;

        _selectedPost = post;
        _selectedDetail = new DiscussionDetail(post, Array.Empty<DiscussionComment>());
        _reactionState = new DiscussionReactionState(
            post.Reactions ?? new DiscussionReactionSummary(),
            post.Reactions?.SafeViewerReactions ?? Array.Empty<DiscussionReactionType>(),
            (post.Reactions?.SafeViewerReactions.Count ?? 0) > 0
        );
        _isDetailLoading = true;
        _hasDetailError = false;
        if (isExplicit)
        {
            _hasExplicitSelection = true;
        }
        if (openNarrowDetail && !IsTwoPane)
        {
            _isNarrowDetailOpen = true;
        }
        StateChanged?.Invoke();

        var detailTask = SafeLoadDetailAsync(post, loadDetail, cts.Token);
        var reactionsTask = SafeLoadReactionsAsync(post.Id, loadReactions, cts.Token);

        await Task.WhenAll(detailTask, reactionsTask).ConfigureAwait(false);

        if (cts.IsCancellationRequested || seq != Volatile.Read(ref _selectionSequence))
        {
            return false;
        }

        var detail = detailTask.Result;
        var reactions = reactionsTask.Result;

        var updatedPost = _selectedPost;
        if (detail != null)
        {
            updatedPost = updatedPost with
            {
                CommentCount = Math.Max(detail.Comments.Count, updatedPost.CommentCount)
            };
        }

        if (reactions != null)
        {
            var mergedSummary = reactions.Summary with
            {
                ViewerReactions = reactions.SafeSelectedTypes
            };
            updatedPost = updatedPost with { Reactions = mergedSummary };
            _reactionState = reactions with { Summary = mergedSummary };
        }

        _selectedPost = updatedPost;
        _selectedDetail = detail != null
            ? detail with { Post = updatedPost }
            : new DiscussionDetail(updatedPost, Array.Empty<DiscussionComment>());
        _isDetailLoading = false;
        _hasDetailError = detail == null;

        ReplaceInAllPosts(updatedPost);
        RebuildVisibleList();
        StateChanged?.Invoke();
        return true;
    }

    public async Task<bool> OpenDiscussionByIdAsync(
        string discussionId,
        Func<string, CancellationToken, Task<DiscussionPost?>> fetchPostById,
        Func<string, DiscussionPost, CancellationToken, Task<DiscussionDetail?>> loadDetail,
        Func<string, CancellationToken, Task<DiscussionReactionState?>> loadReactions)
    {
        if (string.IsNullOrWhiteSpace(discussionId)) return false;
        var cleanId = discussionId.Trim();
        var existing = _allPosts.FirstOrDefault(p =>
            string.Equals(p.Id, cleanId, StringComparison.OrdinalIgnoreCase));

        if (existing == null)
        {
            existing = await fetchPostById(cleanId, CancellationToken.None).ConfigureAwait(false);
            if (existing == null) return false;
            _allPosts.Insert(0, existing);
            RebuildVisibleList();
        }

        return await SelectPostAsync(
            existing,
            loadDetail,
            loadReactions,
            openNarrowDetail: true,
            isExplicit: true
        ).ConfigureAwait(false);
    }

    public void ApplyReactionUpdate(string discussionId, DiscussionReactionState updated)
    {
        var mergedSummary = updated.Summary with { ViewerReactions = updated.SafeSelectedTypes };
        var idx = _allPosts.FindIndex(p => string.Equals(p.Id, discussionId, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0)
        {
            _allPosts[idx] = _allPosts[idx] with { Reactions = mergedSummary };
        }

        if (_selectedPost != null && string.Equals(_selectedPost.Id, discussionId, StringComparison.OrdinalIgnoreCase))
        {
            _selectedPost = _selectedPost with { Reactions = mergedSummary };
            _reactionState = updated with { Summary = mergedSummary };
            if (_selectedDetail != null)
            {
                _selectedDetail = _selectedDetail with { Post = _selectedPost };
            }
        }

        RebuildVisibleList();
        StateChanged?.Invoke();
    }

    public void AppendComment(string discussionId, DiscussionComment comment)
    {
        var idx = _allPosts.FindIndex(p => string.Equals(p.Id, discussionId, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0)
        {
            _allPosts[idx] = _allPosts[idx] with { CommentCount = _allPosts[idx].CommentCount + 1 };
        }

        if (_selectedPost != null && string.Equals(_selectedPost.Id, discussionId, StringComparison.OrdinalIgnoreCase))
        {
            _selectedPost = _selectedPost with { CommentCount = _selectedPost.CommentCount + 1 };
            var existingComments = _selectedDetail?.Comments.ToList() ?? new List<DiscussionComment>();
            existingComments.Add(comment);
            _selectedDetail = new DiscussionDetail(_selectedPost, existingComments);
        }

        RebuildVisibleList();
        StateChanged?.Invoke();
    }

    public void CancelPendingSelection()
    {
        CancelActiveSelectionLoad();
        Interlocked.Increment(ref _selectionSequence);
    }

    private void ReplaceInAllPosts(DiscussionPost updated)
    {
        var idx = _allPosts.FindIndex(p => string.Equals(p.Id, updated.Id, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0)
        {
            _allPosts[idx] = updated;
        }
    }

    private void RebuildVisibleList()
    {
        _visiblePosts = FilterAndSort(_allPosts, _searchQuery, _sort).ToList();
    }

    private void CancelActiveSelectionLoad()
    {
        var prev = Interlocked.Exchange(ref _selectionCts, null);
        if (prev != null)
        {
            try { prev.Cancel(); } catch { }
            prev.Dispose();
        }
    }

    private static async Task<DiscussionDetail?> SafeLoadDetailAsync(
        DiscussionPost post,
        Func<string, DiscussionPost, CancellationToken, Task<DiscussionDetail?>> loadDetail,
        CancellationToken ct)
    {
        try
        {
            return await loadDetail(post.Id, post, ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch
        {
            return null;
        }
    }

    private static async Task<DiscussionReactionState?> SafeLoadReactionsAsync(
        string discussionId,
        Func<string, CancellationToken, Task<DiscussionReactionState?>> loadReactions,
        CancellationToken ct)
    {
        try
        {
            return await loadReactions(discussionId, ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch
        {
            return null;
        }
    }

    public void Dispose()
    {
        CancelActiveSelectionLoad();
    }
}
