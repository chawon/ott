using System.Text.Json.Serialization;

namespace Ottline.Core.Models;

public enum LogStatus
{
    DONE,
    IN_PROGRESS,
    WISHLIST
}

public static class LogStatusExtensions
{
    public static LogStatus FromWire(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "IN_PROGRESS" => LogStatus.IN_PROGRESS,
        "WISHLIST" => LogStatus.WISHLIST,
        _ => LogStatus.DONE
    };

    public static string ToWire(this LogStatus status) => status.ToString();
}

public enum TitleType
{
    movie,
    series,
    book
}

public static class TitleTypeExtensions
{
    public static TitleType FromWire(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "series" => TitleType.series,
        "book" => TitleType.book,
        _ => TitleType.movie
    };

    public static string ToWire(this TitleType type) => type.ToString();
    public static bool IsVideo(this TitleType type) => type is TitleType.movie or TitleType.series;
    public static bool IsBook(this TitleType type) => type == TitleType.book;
}

public enum RecordFeeling
{
    SATISFIED,
    NEUTRAL,
    DISAPPOINTED
}

public static class RecordFeelingExtensions
{
    public static RecordFeeling? FromWire(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "SATISFIED" or "LIKE" => RecordFeeling.SATISFIED,
        "NEUTRAL" => RecordFeeling.NEUTRAL,
        "DISAPPOINTED" or "DISLIKE" => RecordFeeling.DISAPPOINTED,
        _ => null
    };

    public static string ToWire(this RecordFeeling feeling) => feeling.ToString();
}

public enum ContentFilter
{
    ALL,
    VIDEO,
    BOOK
}

public enum LogOrigin
{
    LOG,
    REACTION
}

public static class LogOriginExtensions
{
    public static LogOrigin FromWire(string? value) =>
        string.Equals(value?.Trim(), "REACTION", StringComparison.OrdinalIgnoreCase)
            ? LogOrigin.REACTION
            : LogOrigin.LOG;

    public static string ToWire(this LogOrigin origin) => origin.ToString();
}

public enum DiscussionReactionType
{
    DONE,
    CURIOUS,
    SAVE
}

public static class DiscussionReactionTypeExtensions
{
    public static DiscussionReactionType? FromWire(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "DONE" => DiscussionReactionType.DONE,
        "CURIOUS" => DiscussionReactionType.CURIOUS,
        "SAVE" => DiscussionReactionType.SAVE,
        _ => null
    };

    public static LogStatus ToLogStatus(this DiscussionReactionType reactionType) => reactionType switch
    {
        DiscussionReactionType.DONE => LogStatus.DONE,
        DiscussionReactionType.CURIOUS => LogStatus.IN_PROGRESS,
        DiscussionReactionType.SAVE => LogStatus.WISHLIST,
        _ => LogStatus.DONE
    };
}

public enum DiscussionSort
{
    LATEST,
    REACTIONS,
    COMMENTS
}

public static class DiscussionSortExtensions
{
    public static string ToWire(this DiscussionSort sort) => sort switch
    {
        DiscussionSort.REACTIONS => "reactions",
        DiscussionSort.COMMENTS => "comments",
        _ => "latest"
    };
}

public enum StorybookAvatarPreset
{
    CINEMA_KEEPER,
    BOOK_DRIFTER,
    DEEP_WATCHER,
    MIDNIGHT_LOGGER,
    WEEKEND_CURATOR,
    ARCHIVE_COLLECTOR
}

public static class StorybookAvatarPresetExtensions
{
    public static string Key(this StorybookAvatarPreset preset) => preset switch
    {
        StorybookAvatarPreset.CINEMA_KEEPER => "cinema_keeper",
        StorybookAvatarPreset.BOOK_DRIFTER => "book_drifter",
        StorybookAvatarPreset.DEEP_WATCHER => "deep_watcher",
        StorybookAvatarPreset.MIDNIGHT_LOGGER => "midnight_logger",
        StorybookAvatarPreset.WEEKEND_CURATOR => "weekend_curator",
        StorybookAvatarPreset.ARCHIVE_COLLECTOR => "archive_collector",
        _ => "cinema_keeper"
    };

    public static string ResourcePath(this StorybookAvatarPreset preset) =>
        $"pack://application:,,,/Ottline.App;component/Resources/Avatars/avatar_{preset.Key()}.png";

    public static string LabelKo(this StorybookAvatarPreset preset) => preset switch
    {
        StorybookAvatarPreset.CINEMA_KEEPER => "영화 감상파",
        StorybookAvatarPreset.BOOK_DRIFTER => "책 유랑가",
        StorybookAvatarPreset.DEEP_WATCHER => "몰입 감상가",
        StorybookAvatarPreset.MIDNIGHT_LOGGER => "심야 기록가",
        StorybookAvatarPreset.WEEKEND_CURATOR => "주말 큐레이터",
        StorybookAvatarPreset.ARCHIVE_COLLECTOR => "기록 수집가",
        _ => "영화 감상파"
    };

    public static string LabelEn(this StorybookAvatarPreset preset) => preset switch
    {
        StorybookAvatarPreset.CINEMA_KEEPER => "Cinema keeper",
        StorybookAvatarPreset.BOOK_DRIFTER => "Book drifter",
        StorybookAvatarPreset.DEEP_WATCHER => "Deep watcher",
        StorybookAvatarPreset.MIDNIGHT_LOGGER => "Midnight logger",
        StorybookAvatarPreset.WEEKEND_CURATOR => "Weekend curator",
        StorybookAvatarPreset.ARCHIVE_COLLECTOR => "Timeline keeper",
        _ => "Cinema keeper"
    };

    public static string SubtitleKo(this StorybookAvatarPreset preset) => preset switch
    {
        StorybookAvatarPreset.CINEMA_KEEPER => "극장과 밤의 잔상을 오래 간직하는 기록자",
        StorybookAvatarPreset.BOOK_DRIFTER => "종이책과 문장 사이를 유영하는 독서가",
        StorybookAvatarPreset.DEEP_WATCHER => "시리즈의 복선과 디테일을 깊이 파고드는 관찰자",
        StorybookAvatarPreset.MIDNIGHT_LOGGER => "새벽의 고요함 속에서 조용히 한 줄을 남기는 이",
        StorybookAvatarPreset.WEEKEND_CURATOR => "주말의 여유와 취향을 정성껏 고르는 수집가",
        StorybookAvatarPreset.ARCHIVE_COLLECTOR => "본 것과 읽은 것을 차곡차곡 쌓아두는 아카이비스트",
        _ => ""
    };

    public static string SubtitleEn(this StorybookAvatarPreset preset) => preset switch
    {
        StorybookAvatarPreset.CINEMA_KEEPER => "Keeps the quiet afterglow of cinema nights",
        StorybookAvatarPreset.BOOK_DRIFTER => "Drifts between pages and lingered sentences",
        StorybookAvatarPreset.DEEP_WATCHER => "Dives deep into series arcs and details",
        StorybookAvatarPreset.MIDNIGHT_LOGGER => "Writes quiet lines in the stillness of midnight",
        StorybookAvatarPreset.WEEKEND_CURATOR => "Curates weekend warmth and favorite picks",
        StorybookAvatarPreset.ARCHIVE_COLLECTOR => "Builds a steady shelf of watched and read memories",
        _ => ""
    };

    public static StorybookAvatarPreset FromKey(string? key) => key?.Trim().ToLowerInvariant() switch
    {
        "book_drifter" => StorybookAvatarPreset.BOOK_DRIFTER,
        "deep_watcher" => StorybookAvatarPreset.DEEP_WATCHER,
        "midnight_logger" => StorybookAvatarPreset.MIDNIGHT_LOGGER,
        "weekend_curator" => StorybookAvatarPreset.WEEKEND_CURATOR,
        "archive_collector" => StorybookAvatarPreset.ARCHIVE_COLLECTOR,
        _ => StorybookAvatarPreset.CINEMA_KEEPER
    };
}

public sealed record PlatformGroup(
    string GroupKey,
    string LabelKo,
    string LabelEn,
    IReadOnlyList<string> Options,
    bool IsBookGroup = false
);

public static class OttlinePresets
{
    public static readonly IReadOnlyList<PlatformGroup> VideoPlatformGroups = new List<PlatformGroup>
    {
        new("OTT", "OTT", "OTT", new[] { "넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠" }),
        new("THEATER", "극장", "Theaters", new[] { "CGV", "롯데시네마", "메가박스", "씨네Q" }),
        new("TV_VOD", "기타", "Other", new[] { "채널", "VOD", "DVD", "블루레이" })
    };

    public static readonly IReadOnlyList<PlatformGroup> VideoPlatformGroupsEn = new List<PlatformGroup>
    {
        new("OTT", "OTT", "OTT", new[] { "Netflix", "Disney+", "TVING", "Wavve", "Coupang Play", "Apple TV+", "Prime Video", "Watcha" }),
        new("THEATER", "극장", "Theaters", new[] { "CGV", "Lotte Cinema", "Megabox", "Cine Q" }),
        new("TV_VOD", "기타", "Other", new[] { "Channel", "VOD", "DVD", "Blu-ray" })
    };

    public static readonly IReadOnlyList<PlatformGroup> BookPlatformGroups = new List<PlatformGroup>
    {
        new("BOOK_STORE", "서점", "Bookstore", new[] { "교보문고", "영풍문고", "예스24", "알라딘" }, true),
        new("BOOK_SERVICE", "전자책 / 오디오북 / 도서관", "E-book / Audiobook / Library", new[] { "리디", "밀리의서재", "윌라", "플레이북", "공공도서관", "대학도서관", "학교도서관" }, true)
    };

    public static readonly IReadOnlyList<PlatformGroup> BookPlatformGroupsEn = new List<PlatformGroup>
    {
        new("BOOK_STORE", "서점", "Bookstore", new[] { "Amazon", "Bookshop.org", "Local bookstore" }, true),
        new("BOOK_SERVICE", "전자책 / 오디오북 / 도서관", "E-book / Audiobook / Library", new[] { "Kindle", "Apple Books", "Google Play Books", "Kobo", "Audible", "Libby", "Public Library", "University Library", "School Library" }, true)
    };

    public static readonly IReadOnlyList<(string Wire, string Ko, string En)> PlaceItems = new List<(string, string, string)>
    {
        ("HOME", "집", "Home"),
        ("THEATER", "극장", "Theater"),
        ("TRANSIT", "이동 중", "Transit"),
        ("CAFE", "카페", "Cafe"),
        ("OFFICE", "직장", "Office"),
        ("LIBRARY", "도서관", "Library"),
        ("BOOKSTORE", "서점", "Bookstore"),
        ("SCHOOL", "학교", "School"),
        ("PARK", "공원", "Park"),
        ("OUTDOOR", "야외", "Outdoor"),
        ("ETC", "기타", "Etc")
    };

    public static readonly IReadOnlyList<(string Wire, string Ko, string En)> OccasionItems = new List<(string, string, string)>
    {
        ("ALONE", "혼자", "Alone"),
        ("DATE", "데이트", "Date"),
        ("FAMILY", "가족", "Family"),
        ("FRIENDS", "친구", "Friends"),
        ("BREAK", "휴식", "Break"),
        ("ETC", "기타", "Etc")
    };

    public static readonly IReadOnlyList<string> VideoPlaceWires = new[]
    {
        "HOME", "THEATER", "TRANSIT", "CAFE", "OFFICE", "ETC"
    };

    public static readonly IReadOnlyList<string> BookPlaceWires = new[]
    {
        "HOME", "CAFE", "LIBRARY", "BOOKSTORE", "SCHOOL", "PARK", "OUTDOOR", "TRANSIT", "ETC"
    };

    public static readonly IReadOnlyList<(string Ko, string En)> PlacePresets = new List<(string, string)>
    {
        ("집", "Home"),
        ("극장", "Theater"),
        ("이동 중", "Transit"),
        ("카페", "Cafe"),
        ("직장", "Office"),
        ("도서관", "Library"),
        ("서점", "Bookstore"),
        ("학교", "School"),
        ("공원", "Park"),
        ("야외", "Outdoor"),
        ("기타", "Etc")
    };

    public static readonly IReadOnlyList<(string Ko, string En)> OccasionPresets = new List<(string, string)>
    {
        ("혼자", "Alone"),
        ("데이트", "Date"),
        ("가족", "Family"),
        ("친구", "Friends"),
        ("휴식", "Break"),
        ("기타", "Etc")
    };

    public static IReadOnlyList<string> GetPlacePresetsForType(bool isBook, string locale = "ko")
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        var wires = isBook ? BookPlaceWires : VideoPlaceWires;
        var list = new List<string>(wires.Count);
        foreach (var wire in wires)
        {
            var match = PlaceItems.FirstOrDefault(p => string.Equals(p.Wire, wire, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrEmpty(match.Wire))
            {
                list.Add(isEn ? match.En : match.Ko);
            }
        }
        return list;
    }

    public static IReadOnlyList<string> GetOccasionPresets(string locale = "ko")
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        return OccasionItems.Select(o => isEn ? o.En : o.Ko).ToList();
    }

    public static string? ToPlaceWire(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var v = raw.Trim();
        foreach (var item in PlaceItems)
        {
            if (string.Equals(v, item.Wire, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(v, item.Ko, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(v, item.En, StringComparison.OrdinalIgnoreCase))
            {
                return item.Wire;
            }
        }

        return v.ToLowerInvariant() switch
        {
            "on the go" or "이동중" => "TRANSIT",
            "work" or "회사" or "사무실" => "OFFICE",
            "outdoors" => "OUTDOOR",
            "other" => "ETC",
            _ => v
        };
    }

    public static string FormatPlace(string? raw, string locale = "ko")
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var wire = ToPlaceWire(raw);
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        foreach (var item in PlaceItems)
        {
            if (string.Equals(wire, item.Wire, StringComparison.OrdinalIgnoreCase))
            {
                return isEn ? item.En : item.Ko;
            }
        }
        return raw.Trim();
    }

    public static string? ToOccasionWire(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var v = raw.Trim();
        foreach (var item in OccasionItems)
        {
            if (string.Equals(v, item.Wire, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(v, item.Ko, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(v, item.En, StringComparison.OrdinalIgnoreCase))
            {
                return item.Wire;
            }
        }

        return v.ToLowerInvariant() switch
        {
            "on a date" or "연인" => "DATE",
            "with family" => "FAMILY",
            "with friends" => "FRIENDS",
            "taking a break" => "BREAK",
            "other" => "ETC",
            _ => v
        };
    }

    public static string FormatOccasion(string? raw, string locale = "ko")
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var wire = ToOccasionWire(raw);
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        foreach (var item in OccasionItems)
        {
            if (string.Equals(wire, item.Wire, StringComparison.OrdinalIgnoreCase))
            {
                return isEn ? item.En : item.Ko;
            }
        }
        return raw.Trim();
    }

    public static readonly IReadOnlyList<string> DebugServerUrls = new[]
    {
        "https://ottline.app",
        "https://unmellow-dimple-untouchably.ngrok-free.dev",
        "http://172.24.75.199:3000",
        "http://127.0.0.1:8080"
    };
}

public sealed record TitleSummary(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("provider")] string Provider = "manual",
    [property: JsonPropertyName("providerId")] string ProviderId = "",
    [property: JsonPropertyName("type")] TitleType Type = TitleType.movie,
    [property: JsonPropertyName("title")] string Title = "",
    [property: JsonPropertyName("originalTitle")] string? OriginalTitle = null,
    [property: JsonPropertyName("year")] int? Year = null,
    [property: JsonPropertyName("posterUrl")] string? PosterUrl = null,
    [property: JsonPropertyName("overview")] string? Overview = null,
    [property: JsonPropertyName("genres")] IReadOnlyList<string>? Genres = null,
    [property: JsonPropertyName("runtimeMinutes")] int? RuntimeMinutes = null,
    [property: JsonPropertyName("authors")] IReadOnlyList<string>? Authors = null,
    [property: JsonPropertyName("publisher")] string? Publisher = null,
    [property: JsonPropertyName("isbn10")] string? Isbn10 = null,
    [property: JsonPropertyName("isbn13")] string? Isbn13 = null,
    [property: JsonPropertyName("pubdate")] string? Pubdate = null,
    [property: JsonPropertyName("pageCount")] int? PageCount = null,
    [property: JsonPropertyName("kdcCode")] string? KdcCode = null,
    [property: JsonPropertyName("seasonCount")] int? SeasonCount = null,
    [property: JsonPropertyName("episodeCount")] int? EpisodeCount = null
)
{
    public IReadOnlyList<string> SafeGenres => Genres ?? Array.Empty<string>();
    public IReadOnlyList<string> SafeAuthors => Authors ?? Array.Empty<string>();
}

public sealed record WatchLog(
    string Id,
    string TitleId,
    TitleSummary Title,
    LogStatus Status = LogStatus.DONE,
    double? Rating = null,
    string? Reaction = null,
    string? Ott = null,
    string? Place = null,
    string? Occasion = null,
    int? SeasonNumber = null,
    int? EpisodeNumber = null,
    string? Note = null,
    bool Spoiler = false,
    string OccurredAt = "",
    string WatchedOn = "",
    string CreatedAt = "",
    string UpdatedAt = "",
    int Revision = 1,
    LogOrigin Origin = LogOrigin.LOG,
    string SyncState = "synced"
);

public sealed record WatchLogHistoryEntry(
    string Id,
    string LogId,
    string TitleId,
    LogStatus Status,
    double? Rating = null,
    string? Reaction = null,
    string? Ott = null,
    string? Place = null,
    string? Occasion = null,
    int? SeasonNumber = null,
    int? EpisodeNumber = null,
    string? Note = null,
    bool Spoiler = false,
    string OccurredAt = "",
    string WatchedOn = "",
    int Revision = 1,
    LogOrigin Origin = LogOrigin.LOG,
    string RecordedAt = ""
);

public sealed record OutboxEvent(
    string Id,
    string Type,
    string EntityId,
    string PayloadJson,
    string CreatedAt,
    int RetryCount = 0,
    string? LastError = null
);

public sealed record PublicAuthorProfile(
    string? UserId = null,
    string DisplayName = "익명 기록자",
    string? Handle = null,
    string? AvatarPreset = "cinema_keeper",
    string? Bio = null,
    bool IsAiOperator = false
);

public sealed record DiscussionReactionSummary(
    int DoneCount = 0,
    int CuriousCount = 0,
    int SaveCount = 0,
    IReadOnlyList<DiscussionReactionType>? ViewerReactions = null
)
{
    public IReadOnlyList<DiscussionReactionType> SafeViewerReactions => ViewerReactions ?? Array.Empty<DiscussionReactionType>();
    public int TotalCount => DoneCount + CuriousCount + SaveCount;
}

public sealed record DiscussionPost(
    string Id,
    string TitleId,
    TitleSummary Title,
    string Body,
    bool Spoiler = false,
    string CreatedAt = "",
    string UpdatedAt = "",
    PublicAuthorProfile Author = default!,
    DiscussionReactionSummary Reactions = default!,
    int CommentCount = 0,
    bool IsMine = false,
    bool IsPromptSeed = false
);

public sealed record CommentMention(
    string TitleId,
    string TitleName,
    TitleType Type
);

public sealed record DiscussionComment(
    string Id,
    string DiscussionId,
    string Body,
    bool Spoiler = false,
    string CreatedAt = "",
    PublicAuthorProfile Author = default!,
    IReadOnlyList<CommentMention>? Mentions = null,
    bool IsMine = false
)
{
    public IReadOnlyList<CommentMention> SafeMentions => Mentions ?? Array.Empty<CommentMention>();
}

public sealed record DiscussionDetail(
    DiscussionPost Post,
    IReadOnlyList<DiscussionComment> Comments
);

public sealed record DailyPromptPayload(
    string Id,
    string DateKey,
    string QuestionKo,
    string QuestionEn,
    string SubtitleKo,
    string SubtitleEn,
    TitleSummary? FeaturedTitle = null,
    string? SeedDiscussionId = null,
    bool IsAiCurated = true
);

public sealed record RecommendationItem(
    TitleSummary Title,
    string ReasonKo,
    string ReasonEn,
    string? MatchedFromTitle = null,
    double Score = 0.0,
    string Locale = "ko"
)
{
    public bool IsEn => string.Equals(Locale, "en", StringComparison.OrdinalIgnoreCase);
    public string ReasonDisplay => IsEn
        ? (!string.IsNullOrWhiteSpace(ReasonEn) ? ReasonEn : ReasonKo)
        : (!string.IsNullOrWhiteSpace(ReasonKo) ? ReasonKo : ReasonEn);
    public string TypeBadge => Title.Type switch
    {
        TitleType.book => IsEn ? "Book" : "책",
        TitleType.series => IsEn ? "Series" : "시리즈",
        _ => IsEn ? "Movie" : "영화"
    };
    public string MetaLine
    {
        get
        {
            var parts = new List<string> { TypeBadge };
            if (Title.Year.HasValue) parts.Add(Title.Year.Value.ToString());
            if (Title.SafeAuthors.Count > 0) parts.Add(string.Join(", ", Title.SafeAuthors));
            return string.Join(" · ", parts);
        }
    }
    public string ActionLabel => Title.Type == TitleType.book
        ? (IsEn ? "Want to read" : "읽고 싶어요")
        : (IsEn ? "Want to watch" : "보고 싶어요");
    public string ExcludeLabel => IsEn ? "Already seen or read" : "이미 본·읽은 작품";
}

public sealed record FeedbackMessage(
    string Id,
    string SenderRole,
    string Body,
    string CreatedAt,
    string RoleDisplay = "",
    bool IsMine = true
);

public sealed record FeedbackThread(
    string Id,
    string Category,
    string Subject,
    string Status,
    string CreatedAt,
    string UpdatedAt,
    IReadOnlyList<FeedbackMessage> Messages,
    string CategoryDisplay = "",
    string StatusDisplay = "",
    string LastMessagePreview = "",
    string UpdatedAtDisplay = ""
);

public sealed record AccountProfile(
    string UserId = "",
    string DisplayName = "나의 기록실",
    string Handle = "",
    string AvatarPreset = "cinema_keeper",
    string Bio = "",
    string? RecoveryCode = null,
    string? RecoveryCodeIssuedAt = null
);

public sealed record LinkedDevice(
    string Id,
    string DeviceName,
    string Platform,
    string LastSeenAt,
    bool IsCurrent = false
);

public sealed record PairPreviewResult(
    string TargetUserId,
    string TargetDisplayName,
    int TargetLogCount,
    int LocalLogCount,
    int EstimatedMergedCount,
    string RecoveryCode
);

public sealed record PairCommitResult(
    string UserId,
    string SessionToken,
    int MergedLogCount,
    string RecoveryCode
);

public sealed record SyncPushResult(
    int AcceptedCount,
    string ServerCursor,
    IReadOnlyDictionary<string, string> RemappedTitleIds,
    IReadOnlyDictionary<string, string> RemappedLogIds
);

public sealed record SyncPullResult(
    IReadOnlyList<WatchLog> UpsertedLogs,
    string ServerCursor,
    bool HasMore
);

public sealed record LogsPageResult(
    IReadOnlyList<WatchLog> Items,
    string? NextCursor,
    bool HasMore
);

public enum ThemeMode
{
    LIGHT,
    DARK,
    SYSTEM
}

public sealed record LocalSettings(
    string BaseUrl = "https://ottline.app",
    string? AuthToken = null,
    string? UserId = null,
    string DeviceId = "",
    string DeviceName = "Windows Desktop",
    string Locale = "ko",
    ThemeMode ThemeMode = ThemeMode.LIGHT,
    string DisplayName = "나의 기록실",
    string Handle = "",
    string AvatarPreset = "cinema_keeper",
    string Bio = "",
    string? RecoveryCode = null,
    string? RecoveryCodeIssuedAt = null,
    string? LastSyncCursor = null,
    string? LastSyncedAt = null,
    bool WatchReminderEnabled = true,
    bool RevisitReminderEnabled = true,
    bool MinimizeToTray = true,
    bool GlobalHotkeyEnabled = true,
    bool HasCompletedBrowserHandoff = false,
    bool HasDismissedMigrationBanner = false,
    bool HasSeenIntroThisSession = false,
    bool HasAutoAttemptedUpgradeHandoff = false
);

public sealed record WatchReminderCandidate(
    string PlatformName,
    long DurationMinutes,
    DateTimeOffset DetectedAt
);
