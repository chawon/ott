using Ottline.Core.Models;

namespace Ottline.Core.WatchDetection;

public sealed class WatchReminderEngine
{
    public static readonly TimeSpan DefaultMinWatchDuration = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan DefaultExitGracePeriod = TimeSpan.FromSeconds(15);
    public static readonly TimeSpan DefaultSessionResumeWindow = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan DefaultPlatformCooldown = TimeSpan.FromHours(6);
    public static readonly TimeSpan DefaultRecentLogSuppression = TimeSpan.FromMinutes(30);

    private static readonly IReadOnlyList<(string CanonicalName, string KoDisplayName, string[] ProcessTokens, string[] TitleTokens)> PlatformRules =
        new List<(string, string, string[], string[])>
        {
            ("Netflix", "넷플릭스", new[] { "netflix" }, new[] { "netflix", "넷플릭스" }),
            ("TVING", "티빙", new[] { "tving" }, new[] { "tving", "티빙" }),
            ("Wavve", "웨이브", new[] { "wavve", "pooq" }, new[] { "wavve", "웨이브" }),
            ("Watcha", "왓챠", new[] { "watcha" }, new[] { "watcha", "왓챠" }),
            ("Coupang Play", "쿠팡플레이", new[] { "coupangplay" }, new[] { "coupang play", "쿠팡플레이", "coupangplay" }),
            ("Disney+", "디즈니+", new[] { "disneyplus", "disney+" }, new[] { "disney+", "디즈니+", "디즈니플러스", "disneyplus" }),
            ("Prime Video", "프라임 비디오", new[] { "primevideo", "amazonprimevideo" }, new[] { "prime video", "프라임 비디오", "프라임비디오" }),
            ("Apple TV", "Apple TV+", new[] { "appletv" }, new[] { "apple tv", "apple tv+", "애플 tv", "애플티비" })
        };

    private static readonly HashSet<string> BrowserProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "msedge", "chrome", "firefox", "whale", "brave", "opera", "vivaldi", "arc", "wwahost", "applicationframehost"
    };

    private readonly TimeSpan _minWatchDuration;
    private readonly TimeSpan _exitGracePeriod;
    private readonly TimeSpan _sessionResumeWindow;
    private readonly TimeSpan _platformCooldown;
    private readonly TimeSpan _recentLogSuppression;

    private string? _activePlatform;
    private TimeSpan _accumulatedDuration = TimeSpan.Zero;
    private DateTimeOffset? _lastSampleTime;
    private DateTimeOffset? _lastSeenActiveTime;
    private DateTimeOffset? _lastLogSavedAt;
    private readonly Dictionary<string, DateTimeOffset> _platformLastNotified = new(StringComparer.OrdinalIgnoreCase);

    public WatchReminderEngine(
        TimeSpan? minWatchDuration = null,
        TimeSpan? exitGracePeriod = null,
        TimeSpan? sessionResumeWindow = null,
        TimeSpan? platformCooldown = null,
        TimeSpan? recentLogSuppression = null)
    {
        _minWatchDuration = minWatchDuration ?? DefaultMinWatchDuration;
        _exitGracePeriod = exitGracePeriod ?? DefaultExitGracePeriod;
        _sessionResumeWindow = sessionResumeWindow ?? DefaultSessionResumeWindow;
        _platformCooldown = platformCooldown ?? DefaultPlatformCooldown;
        _recentLogSuppression = recentLogSuppression ?? DefaultRecentLogSuppression;
    }

    public string? ActivePlatform => _activePlatform;
    public TimeSpan AccumulatedDuration => _accumulatedDuration;

    public static IReadOnlyList<(string CanonicalName, string KoDisplayName)> SupportedPlatforms =>
        PlatformRules.Select(r => (r.CanonicalName, r.KoDisplayName)).ToList();

    /// <summary>
    /// Classifies a foreground window into a canonical OTT platform name without retaining any content title.
    /// </summary>
    public static string? ClassifyWindow(string? processName, string? windowTitle)
    {
        var proc = (processName ?? string.Empty).Trim().ToLowerInvariant();
        if (proc.EndsWith(".exe", StringComparison.Ordinal))
        {
            proc = proc[..^4];
        }

        // Ignore our own process so ottline window titles never trigger self-detection
        if (proc is "ottline.app" or "ottline")
        {
            return null;
        }

        foreach (var rule in PlatformRules)
        {
            if (rule.ProcessTokens.Any(token => proc.Contains(token, StringComparison.OrdinalIgnoreCase)))
            {
                return rule.CanonicalName;
            }
        }

        var title = (windowTitle ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(title))
        {
            return null;
        }

        // Check browser or UWP host window titles
        var isBrowserOrHost = string.IsNullOrEmpty(proc) || BrowserProcesses.Contains(proc);
        if (!isBrowserOrHost)
        {
            // Also allow custom standalone Electron/WebView wrappers whose title matches
            isBrowserOrHost = true;
        }

        if (isBrowserOrHost)
        {
            foreach (var rule in PlatformRules)
            {
                if (rule.TitleTokens.Any(token => title.Contains(token, StringComparison.OrdinalIgnoreCase)))
                {
                    return rule.CanonicalName;
                }
            }
        }

        return null;
    }

    public void NotifyLogSaved(DateTimeOffset savedAt)
    {
        _lastLogSavedAt = savedAt;
        ResetSession();
    }

    public void ResetSession()
    {
        _activePlatform = null;
        _accumulatedDuration = TimeSpan.Zero;
        _lastSampleTime = null;
        _lastSeenActiveTime = null;
    }

    /// <summary>
    /// Feeds a periodic foreground window sample and returns a reminder candidate when an OTT session >= 5 mins ends.
    /// </summary>
    public WatchReminderCandidate? ProcessForegroundSample(
        string? processName,
        string? windowTitle,
        DateTimeOffset now,
        bool isEnabled = true)
    {
        if (!isEnabled)
        {
            ResetSession();
            return null;
        }

        var detectedPlatform = ClassifyWindow(processName, windowTitle);
        var delta = _lastSampleTime.HasValue ? now - _lastSampleTime.Value : TimeSpan.Zero;
        if (delta < TimeSpan.Zero || delta > TimeSpan.FromMinutes(2))
        {
            delta = TimeSpan.FromSeconds(3);
        }
        _lastSampleTime = now;

        if (detectedPlatform != null)
        {
            if (_activePlatform == null)
            {
                _activePlatform = detectedPlatform;
                _accumulatedDuration = delta;
                _lastSeenActiveTime = now;
            }
            else if (string.Equals(_activePlatform, detectedPlatform, StringComparison.OrdinalIgnoreCase))
            {
                _accumulatedDuration += delta;
                _lastSeenActiveTime = now;
            }
            else
            {
                // Switched directly from one OTT to another
                _activePlatform = detectedPlatform;
                _accumulatedDuration = delta;
                _lastSeenActiveTime = now;
            }

            return null;
        }

        // Currently NOT on an OTT window
        if (_activePlatform != null && _lastSeenActiveTime.HasValue)
        {
            var awayDuration = now - _lastSeenActiveTime.Value;
            if (awayDuration >= _exitGracePeriod)
            {
                var completedPlatform = _activePlatform;
                var totalWatched = _accumulatedDuration;

                if (totalWatched >= _minWatchDuration)
                {
                    ResetSession();
                    if (CanNotifyPlatform(completedPlatform, now))
                    {
                        _platformLastNotified[completedPlatform] = now;
                        var mins = Math.Max(5, (long)Math.Round(totalWatched.TotalMinutes));
                        return new WatchReminderCandidate(completedPlatform, mins, now);
                    }
                    return null;
                }

                if (awayDuration >= _sessionResumeWindow)
                {
                    ResetSession();
                }
            }
        }

        return null;
    }

    public bool CanNotifyPlatform(string platformName, DateTimeOffset now)
    {
        if (_lastLogSavedAt.HasValue && (now - _lastLogSavedAt.Value) < _recentLogSuppression)
        {
            return false;
        }

        if (_platformLastNotified.TryGetValue(platformName, out var lastNotified) &&
            (now - lastNotified) < _platformCooldown)
        {
            return false;
        }

        return true;
    }

    public static string GetKoreanPlatformName(string canonicalName)
    {
        var match = PlatformRules.FirstOrDefault(r =>
            string.Equals(r.CanonicalName, canonicalName, StringComparison.OrdinalIgnoreCase));
        return string.IsNullOrWhiteSpace(match.KoDisplayName) ? canonicalName : match.KoDisplayName;
    }

    public static (string Title, string Body) FormatNotificationText(string canonicalPlatformName, string locale = "ko")
    {
        if (string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase))
        {
            return (
                $"Just watched on {canonicalPlatformName}?",
                "Capture your memory on the ottline timeline before the feeling fades."
            );
        }

        var koName = GetKoreanPlatformName(canonicalPlatformName);
        return (
            $"방금 {koName} 보셨나요?",
            "잊기 전에 그날의 온기와 함께 타임라인에 남겨보세요."
        );
    }

    public static bool ShouldTriggerRevisitReminder(
        IEnumerable<WatchLog> logs,
        DateTimeOffset now,
        bool revisitReminderEnabled)
    {
        if (!revisitReminderEnabled) return false;
        var list = logs.ToList();
        if (list.Count == 0) return false;

        var latest = list
            .Select(l => DateTimeOffset.TryParse(l.UpdatedAt, out var dt) ? dt : (DateTimeOffset?)null)
            .Where(dt => dt.HasValue)
            .Select(dt => dt!.Value)
            .OrderByDescending(dt => dt)
            .FirstOrDefault();

        if (latest == default) return false;
        return (now - latest) >= TimeSpan.FromDays(7);
    }
}
