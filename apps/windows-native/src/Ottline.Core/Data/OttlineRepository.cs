using System.Globalization;
using System.Text.Json;
using Ottline.Core.Domain;
using Ottline.Core.Local;
using Ottline.Core.Models;
using Ottline.Core.Remote;

namespace Ottline.Core.Data;

public sealed class OttlineRepository : IDisposable
{
    private readonly OttlineDatabase _db;
    private readonly OttlineApiClient _api;
    private readonly object _recFlightLock = new();
    private readonly Dictionary<string, Task<RecommendationLoadResult>> _inFlightRecommendationTasks = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, RecommendationStateSnapshot> _recommendationStateCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _recommendationAutoAttemptedDates = new(StringComparer.OrdinalIgnoreCase);

    public TimeSpan RecommendationPollInterval { get; set; } = TimeSpan.FromMilliseconds(1500);
    public int RecommendationMaxPollAttempts { get; set; } = 80;
    public int RecommendationMaxConsecutivePollFailures { get; set; } = 5;
    public bool EnableRecommendationPosterEnrichment { get; set; } = true;

    public OttlineRepository(OttlineDatabase? db = null, OttlineApiClient? api = null)
    {
        _db = db ?? new OttlineDatabase();
        _api = api ?? new OttlineApiClient();
        RefreshApiConfiguration();
    }

    public OttlineDatabase Database => _db;
    public OttlineApiClient Api => _api;

    public LocalSettings GetSettings() => _db.LoadSettings();

    public LocalSettings UpdateSettings(Func<LocalSettings, LocalSettings> mutator)
    {
        var current = _db.LoadSettings();
        var updated = mutator(current);
        _db.SaveSettings(updated);
        RefreshApiConfiguration(updated);
        return updated;
    }

    private void RefreshApiConfiguration(LocalSettings? settings = null)
    {
        var s = settings ?? _db.LoadSettings();
        var effectiveDeviceId = Guid.TryParse(s.DeviceId, out _)
            ? s.DeviceId
            : (Guid.TryParse(s.AuthToken, out _) ? s.AuthToken! : s.DeviceId);
        _api.Configure(s.BaseUrl, s.AuthToken, effectiveDeviceId, s.Locale, s.UserId);
    }

    public void RefreshApi() => RefreshApiConfiguration();

    public async Task<ServerAccountDeleteResult> DeleteServerAccountAsync(CancellationToken ct = default)
    {
        var currentSettings = _db.LoadSettings();
        RefreshApiConfiguration(currentSettings);

        var effectiveDeviceId = Guid.TryParse(currentSettings.DeviceId, out _)
            ? currentSettings.DeviceId
            : (Guid.TryParse(currentSettings.AuthToken, out _) ? currentSettings.AuthToken : null);

        if (!Guid.TryParse(currentSettings.UserId, out _) || !Guid.TryParse(effectiveDeviceId, out _))
        {
            return new ServerAccountDeleteResult(ServerAccountDeleteOutcome.NotConnected);
        }

        var result = await _api.DeleteServerAccountAsync(ct).ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result;
        }

        _db.ResetLocalData(preserveSettings: false);
        var resetSettings = new LocalSettings(
            BaseUrl: currentSettings.BaseUrl,
            AuthToken: null,
            UserId: null,
            DeviceId: Guid.NewGuid().ToString("D"),
            DeviceName: currentSettings.DeviceName,
            Locale: currentSettings.Locale,
            ThemeMode: currentSettings.ThemeMode,
            DisplayName: "나의 기록실",
            Handle: "",
            AvatarPreset: "cinema_keeper",
            Bio: "",
            RecoveryCode: null,
            RecoveryCodeIssuedAt: null,
            LastSyncCursor: null,
            LastSyncedAt: null,
            WatchReminderEnabled: currentSettings.WatchReminderEnabled,
            RevisitReminderEnabled: currentSettings.RevisitReminderEnabled,
            MinimizeToTray: currentSettings.MinimizeToTray,
            GlobalHotkeyEnabled: currentSettings.GlobalHotkeyEnabled,
            HasCompletedBrowserHandoff: false,
            HasDismissedMigrationBanner: false,
            HasSeenIntroThisSession: currentSettings.HasSeenIntroThisSession,
            HasAutoAttemptedUpgradeHandoff: currentSettings.HasAutoAttemptedUpgradeHandoff
        );
        _db.SaveSettings(resetSettings);
        RefreshApiConfiguration(resetSettings);
        ClearCachedRecommendations();
        return result;
    }

    private static string RecommendationScopeKey(string userId, string language) =>
        $"{userId.Trim().ToLowerInvariant()}:{OttlineDatabase.NormalizeRecommendationLanguage(language)}";

    private static (string? UserId, string? DeviceId, string Language) ResolveRecommendationScope(LocalSettings settings)
    {
        var effectiveDeviceId = Guid.TryParse(settings.DeviceId, out _)
            ? settings.DeviceId.Trim()
            : (Guid.TryParse(settings.AuthToken, out _) ? settings.AuthToken!.Trim() : null);
        var userId = Guid.TryParse(settings.UserId, out _) ? settings.UserId!.Trim() : null;
        var language = OttlineDatabase.NormalizeRecommendationLanguage(settings.Locale);
        return (userId, effectiveDeviceId, language);
    }

    public RecommendationStateSnapshot? GetCachedRecommendationState(string? localeOverride = null)
    {
        var settings = _db.LoadSettings();
        var (userId, _, lang) = ResolveRecommendationScope(settings);
        if (string.IsNullOrWhiteSpace(userId)) return null;
        var effectiveLang = string.IsNullOrWhiteSpace(localeOverride)
            ? lang
            : OttlineDatabase.NormalizeRecommendationLanguage(localeOverride);
        var scopeKey = RecommendationScopeKey(userId, effectiveLang);
        lock (_recFlightLock)
        {
            return _recommendationStateCache.TryGetValue(scopeKey, out var cached) ? cached : null;
        }
    }

    public PendingRecommendationAttempt? GetPendingRecommendationAttempt(string? localeOverride = null)
    {
        var settings = _db.LoadSettings();
        var (userId, _, lang) = ResolveRecommendationScope(settings);
        if (string.IsNullOrWhiteSpace(userId)) return null;
        var effectiveLang = string.IsNullOrWhiteSpace(localeOverride)
            ? lang
            : OttlineDatabase.NormalizeRecommendationLanguage(localeOverride);
        return _db.GetPendingRecommendationAttempt(userId, effectiveLang);
    }

    public void ClearCachedRecommendations()
    {
        lock (_recFlightLock)
        {
            _recommendationStateCache.Clear();
            _recommendationAutoAttemptedDates.Clear();
        }
    }

    public void RemoveRecommendationItemFromCache(RecommendationItem item)
    {
        var settings = _db.LoadSettings();
        var (userId, _, lang) = ResolveRecommendationScope(settings);
        if (string.IsNullOrWhiteSpace(userId)) return;
        var scopeKey = RecommendationScopeKey(userId, lang);
        lock (_recFlightLock)
        {
            if (_recommendationStateCache.TryGetValue(scopeKey, out var cached))
            {
                var remaining = cached.Items
                    .Where(x => !string.Equals(x.Title.Id, item.Title.Id, StringComparison.OrdinalIgnoreCase)
                                && !string.Equals(x.Title.Title, item.Title.Title, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                _recommendationStateCache[scopeKey] = cached with { Items = remaining };
            }
        }
    }

    public Task<RecommendationLoadResult> LoadRecommendationsAsync(
        bool allowAutoGenerate = true,
        CancellationToken ct = default)
    {
        return RunCoalescedRecommendationTaskAsync(
            (userId, lang, scopeKey, innerCt) => LoadRecommendationsCoreAsync(userId, lang, scopeKey, allowAutoGenerate, innerCt),
            ct
        );
    }

    public Task<RecommendationLoadResult> GenerateRecommendationsAsync(CancellationToken ct = default)
    {
        return RunCoalescedRecommendationTaskAsync(
            (userId, lang, scopeKey, innerCt) => GenerateRecommendationsCoreAsync(userId, lang, scopeKey, innerCt),
            ct
        );
    }

    private Task<RecommendationLoadResult> RunCoalescedRecommendationTaskAsync(
        Func<string, string, string, CancellationToken, Task<RecommendationLoadResult>> operation,
        CancellationToken ct)
    {
        var settings = _db.LoadSettings();
        RefreshApiConfiguration(settings);
        var (userId, deviceId, lang) = ResolveRecommendationScope(settings);
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(deviceId))
        {
            return Task.FromResult(new RecommendationLoadResult(
                State: null,
                ErrorKind: RecommendationErrorKind.NotConnected
            ));
        }

        var scopeKey = RecommendationScopeKey(userId, lang);
        Task<RecommendationLoadResult> task;
        lock (_recFlightLock)
        {
            if (_inFlightRecommendationTasks.TryGetValue(scopeKey, out var existing) && !existing.IsCompleted)
            {
                task = existing;
            }
            else
            {
                task = ExecuteAndCleanAsync(scopeKey, () => operation(userId, lang, scopeKey, ct));
                _inFlightRecommendationTasks[scopeKey] = task;
            }
        }

        return ct.CanBeCanceled ? task.WaitAsync(ct) : task;
    }

    private async Task<RecommendationLoadResult> ExecuteAndCleanAsync(
        string scopeKey,
        Func<Task<RecommendationLoadResult>> runner)
    {
        try
        {
            return await runner().ConfigureAwait(false);
        }
        finally
        {
            lock (_recFlightLock)
            {
                if (_inFlightRecommendationTasks.TryGetValue(scopeKey, out var current) && current.IsCompleted)
                {
                    _inFlightRecommendationTasks.Remove(scopeKey);
                }
            }
        }
    }

    private RecommendationStateSnapshot? ReadCachedState(string scopeKey)
    {
        lock (_recFlightLock)
        {
            return _recommendationStateCache.TryGetValue(scopeKey, out var cached) ? cached : null;
        }
    }

    private void SaveCachedState(string scopeKey, RecommendationStateSnapshot state)
    {
        lock (_recFlightLock)
        {
            _recommendationStateCache[scopeKey] = state;
        }
    }

    private static bool IsConfirmedCompleted(
        RecommendationStateSnapshot state,
        PendingRecommendationAttempt pending)
    {
        if (!state.HasBatch) return false;
        if (string.IsNullOrWhiteSpace(state.GenerationId)) return false;
        if (string.Equals(state.GenerationId, pending.RequestId, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Concurrent same-language 202 completion: generationId changed in THIS language from our baseline.
        // Crucially, another language completing only increments quota.used while leaving this language's
        // generationId equal to BaselineGenerationId (or null), so it will NEVER satisfy this check.
        return !string.Equals(state.GenerationId, pending.BaselineGenerationId, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<RecommendationStateSnapshot> EnrichStatePostersIfNeededAsync(
        RecommendationStateSnapshot state,
        CancellationToken ct)
    {
        if (!EnableRecommendationPosterEnrichment || state.Items.Count == 0)
        {
            return state;
        }

        var enriched = await _api.EnrichMissingRecommendationPostersAsync(state.Items, ct).ConfigureAwait(false);
        return state with { Items = enriched };
    }

    private async Task<(bool Settled, RecommendationStateSnapshot State, bool NetworkFailed)> PollRecommendationStateUntilSettledAsync(
        string scopeKey,
        RecommendationStateSnapshot initial,
        CancellationToken ct)
    {
        var current = initial;
        var consecutiveFailures = 0;

        for (var attempt = 0; current.Generating && attempt < RecommendationMaxPollAttempts; attempt++)
        {
            if (RecommendationPollInterval > TimeSpan.Zero)
            {
                await Task.Delay(RecommendationPollInterval, ct).ConfigureAwait(false);
            }

            var pollRes = await _api.FetchRecommendationStateAsync(ct).ConfigureAwait(false);
            if (pollRes.IsSuccess && pollRes.State != null)
            {
                consecutiveFailures = 0;
                current = pollRes.State;
                SaveCachedState(scopeKey, current);
            }
            else
            {
                consecutiveFailures++;
                if (consecutiveFailures >= RecommendationMaxConsecutivePollFailures)
                {
                    return (false, current, true);
                }
            }
        }

        return (!current.Generating, current, false);
    }

    private async Task<RecommendationLoadResult> LoadRecommendationsCoreAsync(
        string userId,
        string language,
        string scopeKey,
        bool allowAutoGenerate,
        CancellationToken ct)
    {
        var fallback = ReadCachedState(scopeKey);
        var stateRes = await _api.FetchRecommendationStateAsync(ct).ConfigureAwait(false);
        if (!stateRes.IsSuccess || stateRes.State == null)
        {
            var pendingOnErr = _db.GetPendingRecommendationAttempt(userId, language);
            return new RecommendationLoadResult(
                State: fallback,
                ErrorKind: RecommendationErrorKind.LoadFailed,
                UsedExistingFallback: fallback != null,
                PendingRequestId: pendingOnErr?.RequestId,
                ErrorMessage: stateRes.ErrorMessage
            );
        }

        var current = await EnrichStatePostersIfNeededAsync(stateRes.State, ct).ConfigureAwait(false);
        SaveCachedState(scopeKey, current);
        var pending = _db.GetPendingRecommendationAttempt(userId, language);

        if (current.Generating)
        {
            MarkAutoAttempted(scopeKey, current.Quota.Date);
            var (settled, polledState, networkFailed) = await PollRecommendationStateUntilSettledAsync(scopeKey, current, ct).ConfigureAwait(false);
            polledState = await EnrichStatePostersIfNeededAsync(polledState, ct).ConfigureAwait(false);
            SaveCachedState(scopeKey, polledState);

            if (!settled)
            {
                return new RecommendationLoadResult(
                    State: polledState,
                    ErrorKind: networkFailed ? RecommendationErrorKind.GenerateFailed : RecommendationErrorKind.StillGenerating,
                    UsedExistingFallback: polledState.Items.Count > 0,
                    PendingRequestId: pending?.RequestId
                );
            }

            if (pending != null)
            {
                if (IsConfirmedCompleted(polledState, pending))
                {
                    _db.SetPendingRecommendationAttempt(userId, language, null);
                    return new RecommendationLoadResult(polledState, RecommendationErrorKind.None, GeneratedNewBatch: true);
                }

                if (polledState.Quota.Remaining <= 0)
                {
                    _db.SetPendingRecommendationAttempt(userId, language, null);
                    return new RecommendationLoadResult(
                        polledState,
                        RecommendationErrorKind.LimitReached,
                        UsedExistingFallback: polledState.Items.Count > 0
                    );
                }

                return new RecommendationLoadResult(
                    polledState,
                    RecommendationErrorKind.GenerateFailed,
                    UsedExistingFallback: polledState.Items.Count > 0,
                    PendingRequestId: pending.RequestId
                );
            }

            if (polledState.HasBatch)
            {
                return new RecommendationLoadResult(polledState, RecommendationErrorKind.None);
            }

            if (polledState.Quota.Remaining <= 0)
            {
                return new RecommendationLoadResult(
                    polledState,
                    RecommendationErrorKind.LimitReached,
                    UsedExistingFallback: polledState.Items.Count > 0
                );
            }

            return new RecommendationLoadResult(
                polledState,
                RecommendationErrorKind.GenerateFailed,
                UsedExistingFallback: polledState.Items.Count > 0
            );
        }

        if (pending != null)
        {
            if (IsConfirmedCompleted(current, pending))
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(current, RecommendationErrorKind.None, GeneratedNewBatch: true);
            }

            if (!current.Eligible)
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(current, RecommendationErrorKind.None);
            }

            if (current.Quota.Remaining <= 0)
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(
                    current,
                    RecommendationErrorKind.LimitReached,
                    UsedExistingFallback: current.Items.Count > 0
                );
            }

            return new RecommendationLoadResult(
                current,
                RecommendationErrorKind.GenerateFailed,
                UsedExistingFallback: current.Items.Count > 0,
                PendingRequestId: pending.RequestId
            );
        }

        if (allowAutoGenerate
            && current.Eligible
            && !current.HasBatch
            && current.Quota.Remaining > 0
            && !HasAutoAttempted(scopeKey, current.Quota.Date))
        {
            MarkAutoAttempted(scopeKey, current.Quota.Date);
            return await ExecuteGenerateAttemptAsync(userId, language, scopeKey, current, existingPending: null, ct).ConfigureAwait(false);
        }

        return new RecommendationLoadResult(
            current,
            current.Eligible && !current.HasBatch && current.Quota.Remaining <= 0
                ? RecommendationErrorKind.LimitReached
                : RecommendationErrorKind.None
        );
    }

    private async Task<RecommendationLoadResult> GenerateRecommendationsCoreAsync(
        string userId,
        string language,
        string scopeKey,
        CancellationToken ct)
    {
        var current = ReadCachedState(scopeKey);
        var pending = _db.GetPendingRecommendationAttempt(userId, language);

        // Always consult /state first when recovering a pending attempt or when we have no cached snapshot yet.
        if (pending != null || current == null)
        {
            var stateRes = await _api.FetchRecommendationStateAsync(ct).ConfigureAwait(false);
            if (stateRes.IsSuccess && stateRes.State != null)
            {
                current = await EnrichStatePostersIfNeededAsync(stateRes.State, ct).ConfigureAwait(false);
                SaveCachedState(scopeKey, current);

                if (current.Generating)
                {
                    var (settled, polledState, networkFailed) = await PollRecommendationStateUntilSettledAsync(scopeKey, current, ct).ConfigureAwait(false);
                    polledState = await EnrichStatePostersIfNeededAsync(polledState, ct).ConfigureAwait(false);
                    SaveCachedState(scopeKey, polledState);
                    current = polledState;

                    if (!settled)
                    {
                        return new RecommendationLoadResult(
                            polledState,
                            networkFailed ? RecommendationErrorKind.GenerateFailed : RecommendationErrorKind.StillGenerating,
                            UsedExistingFallback: polledState.Items.Count > 0,
                            PendingRequestId: pending?.RequestId
                        );
                    }

                    if (pending != null && IsConfirmedCompleted(polledState, pending))
                    {
                        _db.SetPendingRecommendationAttempt(userId, language, null);
                        return new RecommendationLoadResult(polledState, RecommendationErrorKind.None, GeneratedNewBatch: true);
                    }

                    if (pending == null && polledState.HasBatch)
                    {
                        return new RecommendationLoadResult(polledState, RecommendationErrorKind.None);
                    }
                }
                else if (pending != null && IsConfirmedCompleted(current, pending))
                {
                    _db.SetPendingRecommendationAttempt(userId, language, null);
                    return new RecommendationLoadResult(current, RecommendationErrorKind.None, GeneratedNewBatch: true);
                }

                if (!current.Eligible)
                {
                    if (pending != null) _db.SetPendingRecommendationAttempt(userId, language, null);
                    return new RecommendationLoadResult(current, RecommendationErrorKind.None);
                }

                if (current.Quota.Remaining <= 0)
                {
                    if (pending != null) _db.SetPendingRecommendationAttempt(userId, language, null);
                    return new RecommendationLoadResult(
                        current,
                        RecommendationErrorKind.LimitReached,
                        UsedExistingFallback: current.Items.Count > 0
                    );
                }
            }
            else if (pending == null)
            {
                return new RecommendationLoadResult(
                    State: current,
                    ErrorKind: RecommendationErrorKind.LoadFailed,
                    UsedExistingFallback: current != null && current.Items.Count > 0,
                    ErrorMessage: stateRes.ErrorMessage
                );
            }
        }

        if (current != null && !current.Eligible)
        {
            if (pending != null) _db.SetPendingRecommendationAttempt(userId, language, null);
            return new RecommendationLoadResult(current, RecommendationErrorKind.None);
        }

        if (current != null && current.Quota.Remaining <= 0 && pending == null)
        {
            return new RecommendationLoadResult(
                current,
                RecommendationErrorKind.LimitReached,
                UsedExistingFallback: current.Items.Count > 0
            );
        }

        return await ExecuteGenerateAttemptAsync(userId, language, scopeKey, current, pending, ct).ConfigureAwait(false);
    }

    private async Task<RecommendationLoadResult> ExecuteGenerateAttemptAsync(
        string userId,
        string language,
        string scopeKey,
        RecommendationStateSnapshot? fallbackState,
        PendingRecommendationAttempt? existingPending,
        CancellationToken ct)
    {
        var pending = existingPending ?? new PendingRecommendationAttempt(
            RequestId: Guid.NewGuid().ToString("D"),
            BaselineGenerationId: fallbackState?.GenerationId,
            CreatedAt: DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        );

        _db.SetPendingRecommendationAttempt(userId, language, pending);

        var genRes = await _api.GenerateRecommendationsAsync(pending.RequestId, ct).ConfigureAwait(false);

        if (genRes.StatusCode == 429)
        {
            var limitState = genRes.State != null
                ? await EnrichStatePostersIfNeededAsync(genRes.State, ct).ConfigureAwait(false)
                : fallbackState;
            if (limitState != null) SaveCachedState(scopeKey, limitState);
            _db.SetPendingRecommendationAttempt(userId, language, null);
            return new RecommendationLoadResult(
                State: limitState,
                ErrorKind: RecommendationErrorKind.LimitReached,
                UsedExistingFallback: limitState != null && limitState.Items.Count > 0,
                ErrorMessage: genRes.ErrorMessage
            );
        }

        if (genRes.IsSuccess && genRes.State != null)
        {
            var state = await EnrichStatePostersIfNeededAsync(genRes.State, ct).ConfigureAwait(false);
            SaveCachedState(scopeKey, state);

            if (genRes.StatusCode == 202 || state.Generating)
            {
                var (settled, polledState, networkFailed) = await PollRecommendationStateUntilSettledAsync(scopeKey, state, ct).ConfigureAwait(false);
                polledState = await EnrichStatePostersIfNeededAsync(polledState, ct).ConfigureAwait(false);
                SaveCachedState(scopeKey, polledState);

                if (!settled)
                {
                    return new RecommendationLoadResult(
                        State: polledState,
                        ErrorKind: networkFailed ? RecommendationErrorKind.GenerateFailed : RecommendationErrorKind.StillGenerating,
                        UsedExistingFallback: polledState.Items.Count > 0,
                        PendingRequestId: pending.RequestId
                    );
                }

                state = polledState;
            }

            if (!state.Eligible)
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(state, RecommendationErrorKind.None);
            }

            if (IsConfirmedCompleted(state, pending))
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(state, RecommendationErrorKind.None, GeneratedNewBatch: true);
            }

            if (state.Quota.Remaining <= 0)
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(
                    state,
                    RecommendationErrorKind.LimitReached,
                    UsedExistingFallback: state.Items.Count > 0
                );
            }

            // Concurrent generation belonged to another language or did not produce a new batch for THIS language.
            return new RecommendationLoadResult(
                State: state,
                ErrorKind: RecommendationErrorKind.GenerateFailed,
                UsedExistingFallback: state.Items.Count > 0,
                PendingRequestId: pending.RequestId
            );
        }

        // Timeout, dropped connection, or 5xx on /generate: immediately attempt /state recovery + polling.
        var recoveryRes = await _api.FetchRecommendationStateAsync(ct).ConfigureAwait(false);
        if (recoveryRes.IsSuccess && recoveryRes.State != null)
        {
            var recovered = await EnrichStatePostersIfNeededAsync(recoveryRes.State, ct).ConfigureAwait(false);
            SaveCachedState(scopeKey, recovered);

            if (recovered.Generating)
            {
                var (settled, polledState, networkFailed) = await PollRecommendationStateUntilSettledAsync(scopeKey, recovered, ct).ConfigureAwait(false);
                polledState = await EnrichStatePostersIfNeededAsync(polledState, ct).ConfigureAwait(false);
                SaveCachedState(scopeKey, polledState);

                if (!settled)
                {
                    return new RecommendationLoadResult(
                        State: polledState,
                        ErrorKind: networkFailed ? RecommendationErrorKind.GenerateFailed : RecommendationErrorKind.StillGenerating,
                        UsedExistingFallback: polledState.Items.Count > 0,
                        PendingRequestId: pending.RequestId
                    );
                }

                recovered = polledState;
            }

            if (IsConfirmedCompleted(recovered, pending))
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(recovered, RecommendationErrorKind.None, GeneratedNewBatch: true);
            }

            if (recovered.Quota.Remaining <= 0)
            {
                _db.SetPendingRecommendationAttempt(userId, language, null);
                return new RecommendationLoadResult(
                    recovered,
                    RecommendationErrorKind.LimitReached,
                    UsedExistingFallback: recovered.Items.Count > 0
                );
            }

            return new RecommendationLoadResult(
                State: recovered,
                ErrorKind: RecommendationErrorKind.GenerateFailed,
                UsedExistingFallback: recovered.Items.Count > 0,
                PendingRequestId: pending.RequestId,
                ErrorMessage: genRes.ErrorMessage
            );
        }

        // Neither /generate nor /state succeeded: preserve existing fallback items AND persisted pending requestId for retry.
        return new RecommendationLoadResult(
            State: fallbackState,
            ErrorKind: RecommendationErrorKind.GenerateFailed,
            UsedExistingFallback: fallbackState != null && fallbackState.Items.Count > 0,
            PendingRequestId: pending.RequestId,
            ErrorMessage: genRes.ErrorMessage ?? recoveryRes.ErrorMessage
        );
    }

    private bool HasAutoAttempted(string scopeKey, string quotaDate)
    {
        if (string.IsNullOrWhiteSpace(quotaDate)) return false;
        lock (_recFlightLock)
        {
            return _recommendationAutoAttemptedDates.Contains($"{scopeKey}:{quotaDate}");
        }
    }

    private void MarkAutoAttempted(string scopeKey, string quotaDate)
    {
        if (string.IsNullOrWhiteSpace(quotaDate)) return;
        lock (_recFlightLock)
        {
            _recommendationAutoAttemptedDates.Add($"{scopeKey}:{quotaDate}");
        }
    }

    public async Task EnsureRegisteredAsync(CancellationToken ct = default)
    {
        var s = _db.LoadSettings();
        RefreshApiConfiguration(s);
        if (!string.IsNullOrWhiteSpace(s.UserId) && Guid.TryParse(s.DeviceId, out _)) return;

        var registered = await _api.RegisterDeviceAsync(ct).ConfigureAwait(false);
        if (registered.HasValue)
        {
            UpdateSettings(cur => cur with
            {
                UserId = registered.Value.UserId,
                DeviceId = registered.Value.DeviceId,
                AuthToken = null,
                RecoveryCode = registered.Value.Code,
                RecoveryCodeIssuedAt = registered.Value.IssuedAt
            });

            var profile = await _api.FetchProfileAsync(ct).ConfigureAwait(false);
            if (profile != null)
            {
                UpdateSettings(cur => cur with
                {
                    DisplayName = !string.IsNullOrWhiteSpace(profile.DisplayName) ? profile.DisplayName : cur.DisplayName,
                    AvatarPreset = !string.IsNullOrWhiteSpace(profile.AvatarPreset) ? profile.AvatarPreset : cur.AvatarPreset,
                    RecoveryCode = !string.IsNullOrWhiteSpace(profile.RecoveryCode) ? profile.RecoveryCode : cur.RecoveryCode
                });
            }
        }
    }

    public IReadOnlyList<WatchLog> GetAllLogs() => _db.GetAllLogs();

    public WatchLog? GetLogByTitleId(string titleId) => _db.GetLogByTitleId(titleId);

    public IReadOnlyList<WatchLogHistoryEntry> GetHistoryForTitle(string titleId) =>
        _db.GetHistoryForTitle(titleId);

    public int GetPendingOutboxCount() => _db.GetPendingOutbox().Count;

    public async Task<IReadOnlyList<TitleSummary>> SearchTitlesAsync(
        string query,
        ContentFilter filter = ContentFilter.ALL,
        CancellationToken ct = default)
    {
        RefreshApiConfiguration();
        var clean = query?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(clean))
        {
            return await _api.FetchTitleSuggestionsAsync(filter, 6, ct).ConfigureAwait(false);
        }

        var merged = new List<TitleSummary>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var remote = await _api.SearchTitlesAsync(clean, filter, ct).ConfigureAwait(false);
            foreach (var item in remote)
            {
                _db.UpsertTitle(item);
                if (seen.Add(item.Id))
                {
                    merged.Add(item);
                }
            }
        }
        catch
        {
            // Offline or timeout: fall back to local DB logged titles
        }

        foreach (var local in _db.SearchLocalTitles(clean, filter, 20))
        {
            if (seen.Add(local.Id))
            {
                merged.Add(local);
            }
        }

        return merged;
    }

    public WatchLog SaveLogLocalFirst(
        TitleSummary title,
        LogStatus status,
        RecordFeeling? feeling,
        string watchedOnDate,
        string? ott = null,
        string? place = null,
        string? occasion = null,
        int? seasonNumber = null,
        int? episodeNumber = null,
        string? note = null,
        bool spoiler = false,
        bool shareToTogether = false,
        LogOrigin origin = LogOrigin.LOG)
    {
        var existing = _db.GetLogByTitleId(title.Id);
        var (rating, reaction) = RecordFeelings.ToPayloadValues(feeling);
        var normalizedDate = RecordDate.IsValidDateInput(watchedOnDate) ? watchedOnDate.Trim() : RecordDate.TodayDate();
        var occurredAt = RecordDate.ToNoonUtcIso(normalizedDate);
        var nowIso = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);

        var draft = new WatchLog(
            Id: existing?.Id ?? $"local-log:{Guid.NewGuid():N}",
            TitleId: title.Id,
            Title: title,
            Status: status,
            Rating: rating,
            Reaction: reaction,
            Ott: string.IsNullOrWhiteSpace(ott) ? null : ott.Trim(),
            Place: OttlinePresets.ToPlaceWire(place),
            Occasion: OttlinePresets.ToOccasionWire(occasion),
            SeasonNumber: seasonNumber,
            EpisodeNumber: episodeNumber,
            Note: string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            Spoiler: spoiler,
            OccurredAt: occurredAt,
            WatchedOn: normalizedDate,
            CreatedAt: existing?.CreatedAt ?? nowIso,
            UpdatedAt: nowIso,
            Revision: existing != null ? existing.Revision + 1 : 1,
            Origin: origin,
            SyncState: "pending"
        );

        var saved = _db.UpsertLog(draft, recordHistory: true);

        var outboxType = existing == null ? "UPSERT_LOG" : "UPDATE_LOG";
        var payloadJson = JsonSerializer.Serialize(new
        {
            logId = saved.Id,
            titleId = saved.TitleId,
            title = saved.Title,
            status = saved.Status.ToWire(),
            rating = saved.Rating,
            reaction = saved.Reaction,
            ott = saved.Ott,
            place = saved.Place,
            occasion = saved.Occasion,
            seasonNumber = saved.SeasonNumber,
            episodeNumber = saved.EpisodeNumber,
            note = saved.Note,
            spoiler = saved.Spoiler,
            occurredAt = saved.OccurredAt,
            watchedOn = saved.WatchedOn,
            revision = saved.Revision,
            origin = saved.Origin.ToWire()
        });
        _db.EnqueueOutbox(outboxType, saved.Id, payloadJson);

        if (shareToTogether && !string.IsNullOrWhiteSpace(saved.Note))
        {
            var discPayload = JsonSerializer.Serialize(new
            {
                titleId = saved.TitleId,
                title = saved.Title,
                body = saved.Note,
                spoiler = saved.Spoiler
            });
            _db.EnqueueOutbox("CREATE_DISCUSSION", saved.Id, discPayload);
        }

        _ = _api.TrackAnalyticsEventAsync(existing == null ? "log_created" : "log_polished", new Dictionary<string, object?>
        {
            ["titleType"] = saved.Title.Type.ToWire(),
            ["status"] = saved.Status.ToWire(),
            ["hasNote"] = !string.IsNullOrWhiteSpace(saved.Note),
            ["hasPlace"] = !string.IsNullOrWhiteSpace(saved.Place),
            ["hasOccasion"] = !string.IsNullOrWhiteSpace(saved.Occasion)
        });

        return saved;
    }

    public WatchLog ApplyDiscussionReactionLocalFirst(
        DiscussionPost post,
        DiscussionReactionType reactionType)
    {
        var existing = _db.GetLogByTitleId(post.Title.Id);
        var mappedStatus = reactionType.ToLogStatus();
        // Preserve DONE status if user already finished the title
        if (existing?.Status == LogStatus.DONE && mappedStatus != LogStatus.DONE)
        {
            mappedStatus = LogStatus.DONE;
        }

        var existingFeeling = existing != null
            ? RecordFeelings.ResolveRecordFeeling(existing.Rating, existing.Reaction)
            : null;

        var saved = SaveLogLocalFirst(
            title: post.Title,
            status: mappedStatus,
            feeling: existingFeeling,
            watchedOnDate: existing?.WatchedOn ?? RecordDate.TodayDate(),
            ott: existing?.Ott,
            place: existing?.Place,
            occasion: existing?.Occasion,
            seasonNumber: existing?.SeasonNumber,
            episodeNumber: existing?.EpisodeNumber,
            note: existing?.Note,
            spoiler: existing?.Spoiler ?? false,
            shareToTogether: false,
            origin: LogOrigin.REACTION
        );

        var reactionPayload = JsonSerializer.Serialize(new
        {
            discussionId = post.Id,
            reactionType = reactionType.ToString()
        });
        _db.EnqueueOutbox("TOGGLE_REACTION", post.Id, reactionPayload);

        return saved;
    }

    public async Task<(bool Success, string Message)> SyncAllAsync(CancellationToken ct = default)
    {
        RefreshApiConfiguration();
        var pending = _db.GetPendingOutbox();
        var pushedCount = 0;

        if (pending.Count > 0)
        {
            var currentForPush = GetSettings();
            if (string.IsNullOrWhiteSpace(currentForPush.UserId) || !Guid.TryParse(currentForPush.DeviceId, out _))
            {
                await EnsureRegisteredAsync(ct).ConfigureAwait(false);
                RefreshApiConfiguration();
            }

            try
            {
                var pushRes = await _api.PushSyncAsync(pending, ct).ConfigureAwait(false);
                foreach (var (oldTitleId, newTitleId) in pushRes.RemappedTitleIds)
                {
                    _db.RemapTitleId(oldTitleId, newTitleId);
                }
                foreach (var (oldLogId, newLogId) in pushRes.RemappedLogIds)
                {
                    _db.RemapLogId(oldLogId, newLogId);
                }
                foreach (var evt in pending)
                {
                    _db.DeleteOutbox(evt.Id);
                    if (evt.Type is "UPSERT_LOG" or "UPDATE_LOG")
                    {
                        var targetId = pushRes.RemappedLogIds.TryGetValue(evt.EntityId, out var mapped)
                            ? mapped
                            : evt.EntityId;
                        _db.MarkLogSynced(targetId);
                    }
                }
                pushedCount = pushRes.AcceptedCount;
            }
            catch (Exception ex)
            {
                foreach (var evt in pending)
                {
                    _db.IncrementOutboxRetry(evt.Id, ex.Message);
                }
                return (false, $"오프라인 보관 중 (대기 {pending.Count}건)");
            }
        }

        try
        {
            var settings = GetSettings();
            var sinceCursor = _db.GetAllLogs().Count == 0 ? null : settings.LastSyncCursor;
            var pullRes = await _api.PullSyncAsync(sinceCursor, ct).ConfigureAwait(false);
            foreach (var remoteLog in pullRes.UpsertedLogs)
            {
                _db.UpsertLog(remoteLog with { SyncState = "synced" }, recordHistory: false);
            }

            AccountProfile? remoteProfile = null;
            try
            {
                remoteProfile = await _api.FetchProfileAsync(ct).ConfigureAwait(false);
            }
            catch
            {
                // Profile sync is non-fatal during background log sync
            }

            var nowIso = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
            UpdateSettings(s => s with
            {
                LastSyncCursor = pullRes.ServerCursor,
                LastSyncedAt = nowIso,
                DisplayName = remoteProfile != null && !string.IsNullOrWhiteSpace(remoteProfile.DisplayName)
                    ? remoteProfile.DisplayName
                    : s.DisplayName,
                AvatarPreset = remoteProfile != null && !string.IsNullOrWhiteSpace(remoteProfile.AvatarPreset)
                    ? remoteProfile.AvatarPreset
                    : s.AvatarPreset,
                RecoveryCode = remoteProfile != null && !string.IsNullOrWhiteSpace(remoteProfile.RecoveryCode)
                    ? remoteProfile.RecoveryCode
                    : s.RecoveryCode
            });

            return (true, $"동기화 완료 (반영 {pushedCount + pullRes.UpsertedLogs.Count}건)");
        }
        catch
        {
            if (pushedCount > 0)
            {
                return (true, $"업로드 완료 ({pushedCount}건)");
            }
            return (false, "로컬 우선 모드 (네트워크 오프라인)");
        }
    }

    public async Task<(bool Success, string Message)> ImportBrowserHandoffAsync(
        ParsedShareIntent handoff,
        CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(handoff.HandoffBaseUrl))
        {
            UpdateSettings(s => s with { BaseUrl = handoff.HandoffBaseUrl!.Trim() });
        }

        var currentSettings = GetSettings();
        var isEn = string.Equals(currentSettings.Locale, "en", StringComparison.OrdinalIgnoreCase);

        if (string.Equals(handoff.HandoffStatus, "empty", StringComparison.OrdinalIgnoreCase))
        {
            return (false, isEn
                ? "No previous records were found in that browser. Try your other browser or enter your 8-character connection code."
                : "열린 브라우저에 이전 기록이 없어요. 다른 브라우저로 시도하거나 8자리 연결 코드를 입력해 보세요.");
        }

        if (!string.IsNullOrWhiteSpace(handoff.HandoffUserId) && !string.IsNullOrWhiteSpace(handoff.HandoffDeviceId))
        {
            var cleanUserId = handoff.HandoffUserId!.Trim();
            var cleanDeviceId = handoff.HandoffDeviceId!.Trim();
            var cleanCode = string.IsNullOrWhiteSpace(handoff.HandoffRecoveryCode) ? null : handoff.HandoffRecoveryCode.Trim();
            var cleanNick = string.IsNullOrWhiteSpace(handoff.HandoffNickname) ? null : handoff.HandoffNickname.Trim();
            var cleanPersona = string.IsNullOrWhiteSpace(handoff.HandoffPersonaKey) ? null : handoff.HandoffPersonaKey.Trim();
            var localLogs = _db.GetAllLogs();

            if (!string.IsNullOrWhiteSpace(currentSettings.UserId)
                && !string.Equals(currentSettings.UserId, cleanUserId, StringComparison.OrdinalIgnoreCase)
                && localLogs.Count > 0
                && !string.IsNullOrWhiteSpace(cleanCode))
            {
                try
                {
                    await EnsureRegisteredAsync(ct).ConfigureAwait(false);
                    await SyncAllAsync(ct).ConfigureAwait(false);
                    var merged = await _api.CommitPairAsync(cleanCode!, ct).ConfigureAwait(false);
                    if (merged != null)
                    {
                        UpdateSettings(s => s with
                        {
                            UserId = string.IsNullOrWhiteSpace(merged.UserId) ? s.UserId : merged.UserId,
                            DeviceId = string.IsNullOrWhiteSpace(merged.SessionToken) ? s.DeviceId : merged.SessionToken,
                            AuthToken = null,
                            RecoveryCode = !string.IsNullOrWhiteSpace(merged.RecoveryCode) ? merged.RecoveryCode : cleanCode,
                            DisplayName = cleanNick ?? s.DisplayName,
                            AvatarPreset = cleanPersona ?? s.AvatarPreset,
                            LastSyncCursor = null,
                            HasCompletedBrowserHandoff = true,
                            HasDismissedMigrationBanner = true
                        });

                        var (mergedSyncOk, mergedSyncMsg) = await SyncAllAsync(ct).ConfigureAwait(false);
                        await _api.TrackAnalyticsEventAsync("windows_store_pwa_handoff_completed", new Dictionary<string, object?>
                        {
                            ["method"] = "native_handoff_merge",
                            ["hasCode"] = true,
                            ["syncSuccess"] = mergedSyncOk
                        }, ct).ConfigureAwait(false);

                        return (true, mergedSyncOk
                            ? (isEn ? "Connected and merged your previous records." : "기존 기록과 현재 기기 기록을 연결했어요.")
                            : (isEn ? $"Account connected ({mergedSyncMsg})" : $"연동 정보가 저장되었습니다 ({mergedSyncMsg})"));
                    }
                }
                catch
                {
                    // Fall through to direct session replacement if merge fails
                }
            }

            if (!string.IsNullOrWhiteSpace(currentSettings.UserId)
                && !string.Equals(currentSettings.UserId, cleanUserId, StringComparison.OrdinalIgnoreCase)
                && localLogs.Count == 0)
            {
                _db.ResetLocalData(preserveSettings: true);
            }

            UpdateSettings(s => s with
            {
                UserId = cleanUserId,
                DeviceId = cleanDeviceId,
                AuthToken = null,
                RecoveryCode = cleanCode ?? s.RecoveryCode,
                DisplayName = cleanNick ?? s.DisplayName,
                AvatarPreset = cleanPersona ?? s.AvatarPreset,
                LastSyncCursor = null,
                HasCompletedBrowserHandoff = true,
                HasDismissedMigrationBanner = true
            });

            var (directSyncOk, directSyncMsg) = await SyncAllAsync(ct).ConfigureAwait(false);
            await _api.TrackAnalyticsEventAsync("windows_store_pwa_handoff_completed", new Dictionary<string, object?>
            {
                ["method"] = "native_handoff",
                ["hasCode"] = !string.IsNullOrWhiteSpace(cleanCode),
                ["syncSuccess"] = directSyncOk
            }, ct).ConfigureAwait(false);

            return (true, directSyncOk
                ? (isEn ? "Connected your previous records to Windows." : "기존 기록이 Windows 앱으로 자동 연결되었어요.")
                : (isEn ? $"Account connected ({directSyncMsg})" : $"기존 계정이 연결되었습니다 ({directSyncMsg})"));
        }

        if (!string.IsNullOrWhiteSpace(handoff.HandoffToken))
        {
            UpdateSettings(s => s with
            {
                AuthToken = handoff.HandoffToken!.Trim(),
                HasCompletedBrowserHandoff = true,
                HasDismissedMigrationBanner = true
            });
        }

        if (!string.IsNullOrWhiteSpace(handoff.HandoffRecoveryCode))
        {
            try
            {
                if (_db.GetAllLogs().Count > 0)
                {
                    await EnsureRegisteredAsync(ct).ConfigureAwait(false);
                    await SyncAllAsync(ct).ConfigureAwait(false);
                }
                var commit = await _api.CommitPairAsync(handoff.HandoffRecoveryCode!, ct).ConfigureAwait(false);
                if (commit != null)
                {
                    UpdateSettings(s => s with
                    {
                        UserId = string.IsNullOrWhiteSpace(commit.UserId) ? s.UserId : commit.UserId,
                        DeviceId = string.IsNullOrWhiteSpace(commit.SessionToken) ? s.DeviceId : commit.SessionToken,
                        AuthToken = null,
                        RecoveryCode = commit.RecoveryCode,
                        LastSyncCursor = null,
                        HasCompletedBrowserHandoff = true,
                        HasDismissedMigrationBanner = true
                    });
                }
            }
            catch
            {
                // Keep code saved so user can retry when online
                UpdateSettings(s => s with { RecoveryCode = handoff.HandoffRecoveryCode });
            }
        }

        var (syncOk, syncMsg) = await SyncAllAsync(ct).ConfigureAwait(false);
        await _api.TrackAnalyticsEventAsync("windows_store_pwa_handoff_completed", new Dictionary<string, object?>
        {
            ["method"] = "legacy_token_or_code",
            ["hasToken"] = !string.IsNullOrWhiteSpace(handoff.HandoffToken),
            ["hasCode"] = !string.IsNullOrWhiteSpace(handoff.HandoffRecoveryCode),
            ["syncSuccess"] = syncOk
        }, ct).ConfigureAwait(false);

        return (true, syncOk
            ? (isEn ? "Connected your existing web/PWA account to Windows." : "기존 웹/PWA 계정이 Windows 네이티브 앱에 연동되었습니다.")
            : (isEn ? $"Connection saved ({syncMsg})" : $"연동 정보가 저장되었습니다 ({syncMsg})"));
    }

    public int ImportNetflixCsv(string csvContent)
    {
        var items = NetflixHistoryImporter.ParseCsv(csvContent);
        var importedCount = 0;
        foreach (var item in items)
        {
            var type = item.SeasonNumber.HasValue ? TitleType.series : TitleType.movie;
            var title = TitleFallback.BuildManualVideoMetadata(item.SeriesOrMovieTitle, type);
            SaveLogLocalFirst(
                title: title,
                status: LogStatus.DONE,
                feeling: null,
                watchedOnDate: item.WatchedOnDate,
                ott: "Netflix",
                place: "집",
                occasion: null,
                seasonNumber: item.SeasonNumber,
                episodeNumber: null,
                note: item.RawTitle != item.SeriesOrMovieTitle ? $"Netflix 시청: {item.RawTitle}" : null
            );
            importedCount++;
        }
        return importedCount;
    }

    public static IReadOnlyList<TitleSummary> GetCuratedFallbackCatalog() => new List<TitleSummary>
    {
        new("tmdb:movie:666277", "tmdb", "666277", TitleType.movie, "패스트 라이브즈", "Past Lives", 2023,
            "https://image.tmdb.org/t/p/w780/5igEts2tRTgUd2gz0uuldAx0tcD.jpg",
            "어린 시절 헤어진 두 사람이 24년 만에 뉴욕에서 다시 마주하는 인연의 이야기", new[] { "드라마", "로맨스" }, 106),
        new("tmdb:series:136315", "tmdb", "136315", TitleType.series, "더 베어", "The Bear", 2022,
            "https://image.tmdb.org/t/p/w780/t23nESlKRH1qQYWIoUQCOWkS2dl.jpg",
            "시카고 샌드위치 가게를 물려받은 셰프 카미의 치열하고 뜨거운 주방 분투기", new[] { "드라마" }, 30, SeasonCount: 3, EpisodeCount: 28),
        new("tmdb:series:246141", "tmdb", "246141", TitleType.series, "폭싹 속았수다", "When Life Gives You Tangerines", 2025,
            "https://image.tmdb.org/t/p/w780/koMkV9qm0PEZHDmX5dRpBpMH1FY.jpg",
            "제주에서 피어난 애순과 관식의 사계절 일생을 담은 이야기", new[] { "드라마", "시대극" }, 60, SeasonCount: 1, EpisodeCount: 16),
        new("tmdb:movie:496243", "tmdb", "496243", TitleType.movie, "기생충", "Parasite", 2019,
            "https://image.tmdb.org/t/p/w780/jjHccoFjbqlfr4VGLVLT7yek0Xn.jpg",
            "전원백수로 살 길 막막하지만 사이는 좋은 기택 가족의 예측불허 가족희비극", new[] { "드라마", "스릴러" }, 132),
        new("gbooks:소년이온다", "google_books", "boyeoni-onda", TitleType.book, "소년이 온다", "Human Acts", 2014,
            "https://search1.kakaocdn.net/thumb/R480x700.q95/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F532683%3Ftimestamp%3D20261107110839",
            "1980년 5월 광주, 잊을 수 없는 오월의 소년 동호와 남겨진 사람들의 이야기", new[] { "한국소설", "문학" },
            Authors: new[] { "한강" }, Publisher: "창비", Isbn13: "9788936434120", PageCount: 216, KdcCode: "813"),
        new("gbooks:모순", "google_books", "mosun-yang", TitleType.book, "모순", "Contradictions", 1998,
            "https://search1.kakaocdn.net/thumb/R480x700.q95/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F1500252%3Ftimestamp%3D20260624111141",
            "인생은 탐구하면서 살아가는 것이 아니라, 살아가면서 탐구하는 것이다.", new[] { "한국소설", "문학" },
            Authors: new[] { "양귀자" }, Publisher: "쓰다", Isbn13: "9788998441012", PageCount: 308, KdcCode: "813"),
        new("gbooks:물고기는존재하지않는다", "google_books", "why-fish-dont-exist", TitleType.book, "물고기는 존재하지 않는다", "Why Fish Don't Exist", 2021,
            "https://search1.kakaocdn.net/thumb/R480x700.q95/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F5912160%3Ftimestamp%3D20261110120139",
            "상실과 집착, 그리고 질서 너머의 세계를 탐사하는 과학 에세이", new[] { "과학", "에세이" },
            Authors: new[] { "룰루 밀러" }, Publisher: "곰출판", Isbn13: "9791189327156", PageCount: 300, KdcCode: "404")
    };

    public void Dispose()
    {
        _db.Dispose();
        _api.Dispose();
    }
}
