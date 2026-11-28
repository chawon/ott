using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Ottline.Core.Models;

namespace Ottline.Core.Domain;

public static class RecordDate
{
    private static readonly Regex MonthRegex = new(@"^\d{4}-(0[1-9]|1[0-2])$", RegexOptions.Compiled);
    private static readonly Regex DateRegex = new(@"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$", RegexOptions.Compiled);

    public static string TodayDate(DateTimeOffset? now = null) =>
        (now ?? DateTimeOffset.Now).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static string CurrentMonth(DateTimeOffset? now = null) =>
        (now ?? DateTimeOffset.Now).ToString("yyyy-MM", CultureInfo.InvariantCulture);

    public static string RelativeDate(int daysOffset, DateTimeOffset? now = null) =>
        (now ?? DateTimeOffset.Now).AddDays(daysOffset).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static string NormalizeMonthInput(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var digits = new string(raw.Where(char.IsDigit).Take(6).ToArray());
        return digits.Length <= 4 ? digits : $"{digits[..4]}-{digits[4..]}";
    }

    public static string NormalizeDateInput(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var trimmed = raw.Trim();
        if (DateRegex.IsMatch(trimmed) || MonthRegex.IsMatch(trimmed))
        {
            return trimmed;
        }
        var digits = new string(trimmed.Where(char.IsDigit).Take(8).ToArray());
        return digits.Length switch
        {
            <= 4 => digits,
            <= 6 => $"{digits[..4]}-{digits[4..]}",
            _ => $"{digits[..4]}-{digits.Substring(4, 2)}-{digits[6..]}"
        };
    }

    public static bool IsValidMonthInput(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var v = value.Trim();
        if (!MonthRegex.IsMatch(v)) return false;
        var year = int.Parse(v[..4], CultureInfo.InvariantCulture);
        return year is >= 1900 and <= 2100;
    }

    public static bool IsValidDateInput(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var v = value.Trim();
        if (IsValidMonthInput(v)) return true;
        if (!DateRegex.IsMatch(v)) return false;
        if (!DateTime.TryParseExact(v, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            return false;
        return dt.Year is >= 1900 and <= 2100;
    }

    public static bool IsFutureDateInput(string? value, DateTimeOffset? now = null)
    {
        if (string.IsNullOrWhiteSpace(value) || !IsValidDateInput(value)) return false;
        var v = value.Trim();
        var current = now ?? DateTimeOffset.Now;
        if (v.Length == 7)
        {
            return string.CompareOrdinal(v, CurrentMonth(current)) > 0;
        }
        return string.CompareOrdinal(v, TodayDate(current)) > 0;
    }

    public static string OccurredAtToWatchedOnDate(string? occurredAt, string? watchedOn = null)
    {
        if (!string.IsNullOrWhiteSpace(watchedOn) && IsValidDateInput(watchedOn))
        {
            return watchedOn.Trim();
        }
        if (string.IsNullOrWhiteSpace(occurredAt))
        {
            return TodayDate();
        }
        var trimmed = occurredAt.Trim();
        if (trimmed.Length >= 10 && IsValidDateInput(trimmed[..10]))
        {
            return trimmed[..10];
        }
        if (DateTimeOffset.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed.ToLocalTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        return TodayDate();
    }

    public static string ToNoonUtcIso(string? watchedOnDate)
    {
        var normalized = string.IsNullOrWhiteSpace(watchedOnDate) ? TodayDate() : watchedOnDate.Trim();
        if (IsValidMonthInput(normalized))
        {
            return $"{normalized}-01T12:00:00.000Z";
        }
        if (IsValidDateInput(normalized) && normalized.Length == 10)
        {
            return $"{normalized}T12:00:00.000Z";
        }
        return $"{TodayDate()}T12:00:00.000Z";
    }

    public static string ShiftMonth(string monthKey, int deltaMonths)
    {
        var baseKey = IsValidMonthInput(monthKey) ? monthKey : CurrentMonth();
        var dt = DateTime.ParseExact($"{baseKey}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture);
        return dt.AddMonths(deltaMonths).ToString("yyyy-MM", CultureInfo.InvariantCulture);
    }

    public static string FormatMonthLabel(string monthKey, string locale = "ko")
    {
        var baseKey = IsValidMonthInput(monthKey) ? monthKey : CurrentMonth();
        var parts = baseKey.Split('-');
        var year = int.Parse(parts[0], CultureInfo.InvariantCulture);
        var month = int.Parse(parts[1], CultureInfo.InvariantCulture);
        if (string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase))
        {
            var dt = new DateTime(year, month, 1);
            return dt.ToString("MMMM yyyy", CultureInfo.InvariantCulture);
        }
        return $"{year}년 {month}월";
    }

    public static string FormatDisplayDate(string? watchedOn, string? occurredAt = null, string locale = "ko")
    {
        var resolved = OccurredAtToWatchedOnDate(occurredAt, watchedOn);
        if (resolved.Length == 7)
        {
            return FormatMonthLabel(resolved, locale);
        }
        if (DateTime.TryParseExact(resolved, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
        {
            return string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase)
                ? dt.ToString("MMM d, yyyy", CultureInfo.InvariantCulture)
                : $"{dt.Year}.{dt.Month:D2}.{dt.Day:D2}";
        }
        return resolved;
    }

    public static DateTime? ToPickerDate(string? watchedOn)
    {
        if (string.IsNullOrWhiteSpace(watchedOn)) return null;
        var trimmed = watchedOn.Trim();
        if (DateTime.TryParseExact(trimmed, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var exact))
        {
            return exact.Date;
        }
        if (IsValidMonthInput(trimmed) &&
            DateTime.TryParseExact($"{trimmed}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var monthStart))
        {
            return monthStart.Date;
        }
        return null;
    }

    public static string FromPickerDate(DateTime? date, DateTimeOffset? now = null) =>
        date.HasValue
            ? date.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : TodayDate(now);
}

public static class RecordFeelings
{
    public static RecordFeeling? ResolveRecordFeeling(double? rating, string? reaction)
    {
        var direct = RecordFeelingExtensions.FromWire(reaction);
        if (direct.HasValue) return direct.Value;

        if (rating.HasValue)
        {
            if (rating.Value >= 4.0) return RecordFeeling.SATISFIED;
            if (rating.Value >= 2.5) return RecordFeeling.NEUTRAL;
            if (rating.Value > 0.0) return RecordFeeling.DISAPPOINTED;
        }
        return null;
    }

    public static (double? Rating, string? Reaction) ToPayloadValues(RecordFeeling? feeling) => feeling switch
    {
        RecordFeeling.SATISFIED => (4.5, "SATISFIED"),
        RecordFeeling.NEUTRAL => (3.0, "NEUTRAL"),
        RecordFeeling.DISAPPOINTED => (1.5, "DISAPPOINTED"),
        _ => (null, null)
    };

    public static string GetFeelingLabel(RecordFeeling? feeling, string locale = "ko", bool isBook = false)
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        if (isBook)
        {
            return feeling switch
            {
                RecordFeeling.SATISFIED => isEn ? "Life-changing" : "인생책",
                RecordFeeling.NEUTRAL => isEn ? "Not bad" : "무난해요",
                RecordFeeling.DISAPPOINTED => isEn ? "Disappointing" : "아쉬워요",
                _ => string.Empty
            };
        }

        return feeling switch
        {
            RecordFeeling.SATISFIED => isEn ? "Excellent" : "최고예요",
            RecordFeeling.NEUTRAL => isEn ? "Worth watching" : "볼만해요",
            RecordFeeling.DISAPPOINTED => isEn ? "Disappointing" : "아쉬워요",
            _ => string.Empty
        };
    }

    public static string GetFeelingBadgeText(WatchLog log, string locale = "ko")
    {
        var feeling = ResolveRecordFeeling(log.Rating, log.Reaction);
        return feeling.HasValue ? GetFeelingLabel(feeling, locale, log.Title.Type.IsBook()) : string.Empty;
    }
}

public sealed record FrequentLogDimensions(
    IReadOnlyList<(string Value, int Count)> Places,
    IReadOnlyList<(string Value, int Count)> Occasions,
    IReadOnlyList<(string Value, int Count)> Platforms
);

public static class TimelineMoments
{
    public static string FormatMomentSummary(WatchLog log, string locale = "ko")
    {
        var parts = new List<string>();
        var dateLabel = RecordDate.FormatDisplayDate(log.WatchedOn, log.OccurredAt, locale);
        if (!string.IsNullOrWhiteSpace(dateLabel)) parts.Add(dateLabel);
        if (!string.IsNullOrWhiteSpace(log.Ott)) parts.Add(log.Ott.Trim());
        if (!string.IsNullOrWhiteSpace(log.Place)) parts.Add(OttlinePresets.FormatPlace(log.Place, locale));
        if (!string.IsNullOrWhiteSpace(log.Occasion)) parts.Add(OttlinePresets.FormatOccasion(log.Occasion, locale));
        if (log.SeasonNumber.HasValue || log.EpisodeNumber.HasValue)
        {
            var se = new StringBuilder();
            if (log.SeasonNumber.HasValue) se.Append($"S{log.SeasonNumber.Value}");
            if (log.EpisodeNumber.HasValue)
            {
                if (se.Length > 0) se.Append(' ');
                se.Append($"E{log.EpisodeNumber.Value}");
            }
            parts.Add(se.ToString());
        }
        return string.Join(" · ", parts);
    }

    public static bool MatchesPlace(WatchLog log, string? filterPlace) =>
        string.IsNullOrWhiteSpace(filterPlace) ||
        string.Equals(OttlinePresets.ToPlaceWire(log.Place), OttlinePresets.ToPlaceWire(filterPlace), StringComparison.OrdinalIgnoreCase);

    public static bool MatchesOccasion(WatchLog log, string? filterOccasion) =>
        string.IsNullOrWhiteSpace(filterOccasion) ||
        string.Equals(OttlinePresets.ToOccasionWire(log.Occasion), OttlinePresets.ToOccasionWire(filterOccasion), StringComparison.OrdinalIgnoreCase);

    public static FrequentLogDimensions ExtractFrequentDimensions(IEnumerable<WatchLog> logs, int limit = 6, string locale = "ko")
    {
        var list = logs.ToList();
        var places = list
            .Select(l => OttlinePresets.ToPlaceWire(l.Place))
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .GroupBy(s => s!, StringComparer.OrdinalIgnoreCase)
            .Select(g => (Value: OttlinePresets.FormatPlace(g.First()!, locale), Count: g.Count()))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Value)
            .Take(limit)
            .ToList();

        var occasions = list
            .Select(l => OttlinePresets.ToOccasionWire(l.Occasion))
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .GroupBy(s => s!, StringComparer.OrdinalIgnoreCase)
            .Select(g => (Value: OttlinePresets.FormatOccasion(g.First()!, locale), Count: g.Count()))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Value)
            .Take(limit)
            .ToList();

        var platforms = list
            .Select(l => l.Ott?.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .GroupBy(s => s!, StringComparer.OrdinalIgnoreCase)
            .Select(g => (Value: g.First()!, Count: g.Count()))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Value)
            .Take(limit)
            .ToList();

        return new FrequentLogDimensions(places, occasions, platforms);
    }

    public static IReadOnlyList<WatchLog> FilterLogs(
        IEnumerable<WatchLog> logs,
        string? searchQuery = null,
        ContentFilter contentFilter = ContentFilter.ALL,
        LogStatus? statusFilter = null,
        RecordFeeling? feelingFilter = null,
        string? placeFilter = null,
        string? occasionFilter = null,
        string? platformFilter = null,
        string? monthFilter = null)
    {
        var query = searchQuery?.Trim();
        return logs.Where(log =>
        {
            if (contentFilter == ContentFilter.VIDEO && !log.Title.Type.IsVideo()) return false;
            if (contentFilter == ContentFilter.BOOK && !log.Title.Type.IsBook()) return false;
            if (statusFilter.HasValue && log.Status != statusFilter.Value) return false;
            if (feelingFilter.HasValue && RecordFeelings.ResolveRecordFeeling(log.Rating, log.Reaction) != feelingFilter.Value) return false;
            if (!MatchesPlace(log, placeFilter)) return false;
            if (!MatchesOccasion(log, occasionFilter)) return false;
            if (!string.IsNullOrWhiteSpace(platformFilter) &&
                !string.Equals(log.Ott?.Trim(), platformFilter.Trim(), StringComparison.OrdinalIgnoreCase))
                return false;
            if (!string.IsNullOrWhiteSpace(monthFilter))
            {
                var date = RecordDate.OccurredAtToWatchedOnDate(log.OccurredAt, log.WatchedOn);
                if (!date.StartsWith(monthFilter.Trim(), StringComparison.Ordinal)) return false;
            }
            if (!string.IsNullOrWhiteSpace(query))
            {
                var hitTitle = log.Title.Title.Contains(query, StringComparison.OrdinalIgnoreCase);
                var hitOrig = log.Title.OriginalTitle?.Contains(query, StringComparison.OrdinalIgnoreCase) == true;
                var hitNote = log.Note?.Contains(query, StringComparison.OrdinalIgnoreCase) == true;
                var hitPlace = log.Place?.Contains(query, StringComparison.OrdinalIgnoreCase) == true
                               || OttlinePresets.FormatPlace(log.Place, "ko").Contains(query, StringComparison.OrdinalIgnoreCase)
                               || OttlinePresets.FormatPlace(log.Place, "en").Contains(query, StringComparison.OrdinalIgnoreCase);
                var hitOccasion = log.Occasion?.Contains(query, StringComparison.OrdinalIgnoreCase) == true
                                  || OttlinePresets.FormatOccasion(log.Occasion, "ko").Contains(query, StringComparison.OrdinalIgnoreCase)
                                  || OttlinePresets.FormatOccasion(log.Occasion, "en").Contains(query, StringComparison.OrdinalIgnoreCase);
                var hitOtt = log.Ott?.Contains(query, StringComparison.OrdinalIgnoreCase) == true;
                var hitAuthor = log.Title.SafeAuthors.Any(a => a.Contains(query, StringComparison.OrdinalIgnoreCase));
                if (!(hitTitle || hitOrig || hitNote || hitPlace || hitOccasion || hitOtt || hitAuthor))
                    return false;
            }
            return true;
        }).ToList();
    }
}

public static class TitleFallback
{
    public static string? NormalizeIsbn(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var cleaned = new string(raw.Where(c => char.IsDigit(c) || c is 'X' or 'x').ToArray()).ToUpperInvariant();
        return cleaned.Length is 10 or 13 ? cleaned : null;
    }

    public static TitleSummary BuildManualBookMetadata(string title, string? author = null, string? publisher = null, string? isbn = null)
    {
        var cleanTitle = string.IsNullOrWhiteSpace(title) ? "Untitled Book" : title.Trim();
        var slug = Convert.ToHexString(Encoding.UTF8.GetBytes(cleanTitle.ToLowerInvariant()))[..Math.Min(16, cleanTitle.Length * 2)];
        var normalizedIsbn = NormalizeIsbn(isbn);
        var authors = string.IsNullOrWhiteSpace(author)
            ? Array.Empty<string>()
            : author.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return new TitleSummary(
            Id: $"manual-book:{slug}",
            Provider: "manual_book",
            ProviderId: slug,
            Type: TitleType.book,
            Title: cleanTitle,
            Authors: authors,
            Publisher: string.IsNullOrWhiteSpace(publisher) ? null : publisher.Trim(),
            Isbn10: normalizedIsbn?.Length == 10 ? normalizedIsbn : null,
            Isbn13: normalizedIsbn?.Length == 13 ? normalizedIsbn : null
        );
    }

    public static TitleSummary BuildManualVideoMetadata(string title, TitleType type = TitleType.movie, int? year = null)
    {
        var cleanTitle = string.IsNullOrWhiteSpace(title) ? "Untitled Video" : title.Trim();
        var resolvedType = type == TitleType.book ? TitleType.movie : type;
        var slug = Convert.ToHexString(Encoding.UTF8.GetBytes($"{resolvedType}:{cleanTitle.ToLowerInvariant()}"))[..Math.Min(16, cleanTitle.Length * 2)];
        return new TitleSummary(
            Id: $"manual-video:{slug}",
            Provider: "manual_video",
            ProviderId: slug,
            Type: resolvedType,
            Title: cleanTitle,
            Year: year
        );
    }
}

public sealed record KdcCategoryShelf(
    string Code,
    string LabelKo,
    string LabelEn,
    IReadOnlyList<WatchLog> Books
);

public static class BookshelfBuilder
{
    public static readonly IReadOnlyList<(string Code, string LabelKo, string LabelEn)> KdcClasses = new List<(string, string, string)>
    {
        ("000", "총류", "General works"),
        ("100", "철학", "Philosophy"),
        ("200", "종교", "Religion"),
        ("300", "사회과학", "Social sciences"),
        ("400", "자연과학", "Natural sciences"),
        ("500", "기술과학", "Technology"),
        ("600", "예술", "Arts"),
        ("700", "언어", "Language"),
        ("800", "문학", "Literature"),
        ("900", "역사", "History")
    };

    public static string? ExtractIsbn13(TitleSummary title)
    {
        if (!string.IsNullOrWhiteSpace(title.Isbn13))
        {
            var norm = TitleFallback.NormalizeIsbn(title.Isbn13);
            if (norm?.Length == 13) return norm;
        }
        return null;
    }

    public static string? ExtractIsbn10(TitleSummary title)
    {
        if (!string.IsNullOrWhiteSpace(title.Isbn10))
        {
            var norm = TitleFallback.NormalizeIsbn(title.Isbn10);
            if (norm?.Length == 10) return norm;
        }
        return null;
    }

    public static string InferKdcClass(TitleSummary title)
    {
        if (!string.IsNullOrWhiteSpace(title.KdcCode))
        {
            var firstDigit = title.KdcCode.Trim().FirstOrDefault(char.IsDigit);
            if (firstDigit != default)
            {
                return $"{firstDigit}00";
            }
        }

        var text = $"{title.Title} {title.Overview} {string.Join(" ", title.SafeGenres)}".ToLowerInvariant();
        if (ContainsAny(text, "소설", "시집", "문학", "에세이", "수필", "판타지", "미스터리", "스릴러", "로맨스", "novel", "fiction", "poetry", "essay", "literature"))
            return "800";
        if (ContainsAny(text, "역사", "세계사", "한국사", "전기", "평전", "기행", "지리", "여행", "history", "biography", "geography"))
            return "900";
        if (ContainsAny(text, "경제", "경영", "투자", "사회", "정치", "법학", "교육", "마케팅", "재테크", "business", "economics", "society", "politics", "finance"))
            return "300";
        if (ContainsAny(text, "철학", "심리", "명상", "인문", "윤리", "마음", "자존감", "philosophy", "psychology", "mind"))
            return "100";
        if (ContainsAny(text, "컴퓨터", "프로그래밍", "개발", "공학", "의학", "건강", "요리", "테크", "ai", "인공지능", "software", "engineering", "coding", "tech", "health"))
            return "500";
        if (ContainsAny(text, "과학", "물리", "생물", "우주", "수학", "화학", "뇌과학", "science", "physics", "biology", "math"))
            return "400";
        if (ContainsAny(text, "예술", "미술", "음악", "영화", "건축", "사진", "디자인", "만화", "웹툰", "art", "design", "music", "cinema", "comics"))
            return "600";
        if (ContainsAny(text, "언어", "영어", "일본어", "문법", "어학", "글쓰기", "language", "english", "writing"))
            return "700";
        if (ContainsAny(text, "종교", "불교", "기독교", "성경", "신화", "명리", "religion", "mythology"))
            return "200";
        return "000";
    }

    public static IReadOnlyList<KdcCategoryShelf> BuildKdcShelves(IEnumerable<WatchLog> logs)
    {
        var bookLogs = logs
            .Where(l => l.Title.Type == TitleType.book)
            .GroupBy(l => l.TitleId)
            .Select(g => g.OrderByDescending(x => x.UpdatedAt).First())
            .ToList();

        var grouped = bookLogs
            .GroupBy(l => InferKdcClass(l.Title))
            .ToDictionary(g => g.Key, g => (IReadOnlyList<WatchLog>)g.OrderByDescending(x => x.WatchedOn).ToList());

        return KdcClasses.Select(k => new KdcCategoryShelf(
            k.Code,
            k.LabelKo,
            k.LabelEn,
            grouped.TryGetValue(k.Code, out var items) ? items : Array.Empty<WatchLog>()
        )).ToList();
    }

    private static bool ContainsAny(string text, params string[] keywords) =>
        keywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));
}

public sealed record PersonalReportSummary(
    int TotalLogs,
    int DoneCount,
    int InProgressCount,
    int WishlistCount,
    int VideoCount,
    int BookCount,
    int SatisfiedCount,
    int NeutralCount,
    int DisappointedCount,
    IReadOnlyList<(string Label, int Count)> TopPlatforms,
    IReadOnlyList<(string Label, int Count)> TopPlaces,
    IReadOnlyList<(string Label, int Count)> TopOccasions,
    IReadOnlyList<(string Month, int Count)> MonthlyCounts,
    IReadOnlyList<WatchLog> RecentHighlights
)
{
    public int TotalCount => TotalLogs;
    public string RhythmSummaryKo => $"지금까지 {TotalLogs}개의 작품을 기록하고, {SatisfiedCount}번의 따뜻한 온기를 남겼어요.";
    public string RhythmSummaryEn => $"You've logged {TotalLogs} stories so far, leaving {SatisfiedCount} warm memories.";
}

public static class PersonalReportBuilder
{
    public static PersonalReportSummary BuildReport(IEnumerable<WatchLog> logs, string? periodFilter = null, string locale = "ko")
    {
        var all = logs.ToList();
        if (!string.IsNullOrWhiteSpace(periodFilter))
        {
            all = all.Where(l =>
            {
                var date = RecordDate.OccurredAtToWatchedOnDate(l.OccurredAt, l.WatchedOn);
                return date.StartsWith(periodFilter, StringComparison.Ordinal);
            }).ToList();
        }

        var dims = TimelineMoments.ExtractFrequentDimensions(all, 5, locale);
        var satisfied = 0;
        var neutral = 0;
        var disappointed = 0;
        foreach (var l in all)
        {
            switch (RecordFeelings.ResolveRecordFeeling(l.Rating, l.Reaction))
            {
                case RecordFeeling.SATISFIED: satisfied++; break;
                case RecordFeeling.NEUTRAL: neutral++; break;
                case RecordFeeling.DISAPPOINTED: disappointed++; break;
            }
        }

        var monthly = all
            .Select(l => RecordDate.OccurredAtToWatchedOnDate(l.OccurredAt, l.WatchedOn))
            .Where(d => d.Length >= 7)
            .Select(d => d[..7])
            .GroupBy(m => m)
            .Select(g => (Month: g.Key, Count: g.Count()))
            .OrderByDescending(x => x.Month)
            .Take(6)
            .ToList();

        var highlights = all
            .OrderByDescending(l => l.Status == LogStatus.DONE)
            .ThenByDescending(l => RecordFeelings.ResolveRecordFeeling(l.Rating, l.Reaction) == RecordFeeling.SATISFIED)
            .ThenByDescending(l => l.WatchedOn)
            .Take(6)
            .ToList();

        return new PersonalReportSummary(
            TotalLogs: all.Count,
            DoneCount: all.Count(l => l.Status == LogStatus.DONE),
            InProgressCount: all.Count(l => l.Status == LogStatus.IN_PROGRESS),
            WishlistCount: all.Count(l => l.Status == LogStatus.WISHLIST),
            VideoCount: all.Count(l => l.Title.Type.IsVideo()),
            BookCount: all.Count(l => l.Title.Type.IsBook()),
            SatisfiedCount: satisfied,
            NeutralCount: neutral,
            DisappointedCount: disappointed,
            TopPlatforms: dims.Platforms,
            TopPlaces: dims.Places,
            TopOccasions: dims.Occasions,
            MonthlyCounts: monthly,
            RecentHighlights: highlights
        );
    }
}

public sealed record ParsedShareIntent(
    bool IsSessionHandoff = false,
    string? HandoffToken = null,
    string? HandoffRecoveryCode = null,
    string? HandoffBaseUrl = null,
    string? QueryTitle = null,
    string? InferredPlatform = null,
    ContentFilter InferredFilter = ContentFilter.ALL,
    bool OpenQuickRecord = false,
    string? OpenTitleId = null,
    string? OpenRoute = null,
    string? HandoffStatus = null,
    string? HandoffUserId = null,
    string? HandoffDeviceId = null,
    string? HandoffNickname = null,
    string? HandoffPersonaKey = null,
    string? OpenDiscussionId = null
);

public static class ShareIntentParser
{
    public static ParsedShareIntent Parse(string? rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput)) return new ParsedShareIntent();
        var trimmed = rawInput.Trim().Trim('"');

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            if (string.Equals(uri.Scheme, "ottline", StringComparison.OrdinalIgnoreCase))
            {
                var queryParams = ParseQueryString(uri.Query);
                queryParams.TryGetValue("token", out var token);
                if (!queryParams.TryGetValue("pairing_code", out var recoveryCode) || string.IsNullOrWhiteSpace(recoveryCode))
                {
                    queryParams.TryGetValue("code", out recoveryCode);
                }
                queryParams.TryGetValue("baseUrl", out var baseUrl);
                queryParams.TryGetValue("status", out var handoffStatus);
                if (!queryParams.TryGetValue("user_id", out var handoffUserId) || string.IsNullOrWhiteSpace(handoffUserId))
                {
                    queryParams.TryGetValue("userId", out handoffUserId);
                }
                if (!queryParams.TryGetValue("device_id", out var handoffDeviceId) || string.IsNullOrWhiteSpace(handoffDeviceId))
                {
                    queryParams.TryGetValue("deviceId", out handoffDeviceId);
                }
                queryParams.TryGetValue("nickname", out var handoffNickname);
                if (!queryParams.TryGetValue("persona_key", out var handoffPersonaKey) || string.IsNullOrWhiteSpace(handoffPersonaKey))
                {
                    queryParams.TryGetValue("personaKey", out handoffPersonaKey);
                }

                var isHandoff = (queryParams.TryGetValue("handoff", out var h) && (h == "1" || string.Equals(h, "true", StringComparison.OrdinalIgnoreCase)))
                                || string.Equals(uri.Host, "handoff", StringComparison.OrdinalIgnoreCase)
                                || !string.IsNullOrWhiteSpace(token)
                                || !string.IsNullOrWhiteSpace(recoveryCode)
                                || (!string.IsNullOrWhiteSpace(handoffUserId) && !string.IsNullOrWhiteSpace(handoffDeviceId));

                queryParams.TryGetValue("query", out var query);
                queryParams.TryGetValue("title", out var titleParam);
                queryParams.TryGetValue("platform", out var platform);
                queryParams.TryGetValue("type", out var typeParam);
                var isTogetherHost = string.Equals(uri.Host, "together", StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(uri.Host, "discussion", StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(uri.Host, "public", StringComparison.OrdinalIgnoreCase);

                var pathSegments = uri.AbsolutePath
                    .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                string? openDiscussionId = null;
                if (queryParams.TryGetValue("discussion_id", out var discIdParam) && !string.IsNullOrWhiteSpace(discIdParam))
                {
                    openDiscussionId = discIdParam.Trim();
                }
                else if (queryParams.TryGetValue("discussionId", out var discIdCamel) && !string.IsNullOrWhiteSpace(discIdCamel))
                {
                    openDiscussionId = discIdCamel.Trim();
                }
                else if (isTogetherHost)
                {
                    if (queryParams.TryGetValue("id", out var idParam) && !string.IsNullOrWhiteSpace(idParam))
                    {
                        openDiscussionId = idParam.Trim();
                    }
                    else if (pathSegments.Length > 0)
                    {
                        openDiscussionId = pathSegments[^1];
                    }
                }

                string? openTitleId = null;
                if (!isTogetherHost)
                {
                    if (!queryParams.TryGetValue("title_id", out openTitleId))
                    {
                        queryParams.TryGetValue("id", out openTitleId);
                    }
                }
                else if (queryParams.TryGetValue("title_id", out var explicitTitleId))
                {
                    openTitleId = explicitTitleId;
                }

                var openQuick = string.Equals(uri.Host, "quick", StringComparison.OrdinalIgnoreCase)
                                || (queryParams.TryGetValue("quick", out var qFlag)
                                    && (qFlag == "1" || string.Equals(qFlag, "true", StringComparison.OrdinalIgnoreCase)));

                string? openRoute = null;
                if (isTogetherHost || !string.IsNullOrWhiteSpace(openDiscussionId))
                {
                    openRoute = "together";
                }
                else if (string.Equals(uri.Host, "timeline", StringComparison.OrdinalIgnoreCase)
                         || (queryParams.TryGetValue("route", out var routeVal)
                             && string.Equals(routeVal, "timeline", StringComparison.OrdinalIgnoreCase)))
                {
                    openRoute = "timeline";
                }
                else if (queryParams.TryGetValue("route", out var explicitRoute)
                         && (string.Equals(explicitRoute, "together", StringComparison.OrdinalIgnoreCase)
                             || string.Equals(explicitRoute, "public", StringComparison.OrdinalIgnoreCase)))
                {
                    openRoute = "together";
                }

                var filter = string.Equals(typeParam, "book", StringComparison.OrdinalIgnoreCase)
                    ? ContentFilter.BOOK
                    : string.Equals(typeParam, "video", StringComparison.OrdinalIgnoreCase)
                        ? ContentFilter.VIDEO
                        : ContentFilter.ALL;

                return new ParsedShareIntent(
                    IsSessionHandoff: isHandoff,
                    HandoffToken: string.IsNullOrWhiteSpace(token) ? null : token.Trim(),
                    HandoffRecoveryCode: string.IsNullOrWhiteSpace(recoveryCode) ? null : recoveryCode.Trim(),
                    HandoffBaseUrl: string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.Trim(),
                    QueryTitle: !string.IsNullOrWhiteSpace(query) ? query : titleParam,
                    InferredPlatform: platform,
                    InferredFilter: filter,
                    OpenQuickRecord: openQuick,
                    OpenTitleId: string.IsNullOrWhiteSpace(openTitleId) ? null : openTitleId.Trim(),
                    OpenRoute: openRoute,
                    HandoffStatus: string.IsNullOrWhiteSpace(handoffStatus) ? null : handoffStatus.Trim(),
                    HandoffUserId: string.IsNullOrWhiteSpace(handoffUserId) ? null : handoffUserId.Trim(),
                    HandoffDeviceId: string.IsNullOrWhiteSpace(handoffDeviceId) ? null : handoffDeviceId.Trim(),
                    HandoffNickname: string.IsNullOrWhiteSpace(handoffNickname) ? null : handoffNickname.Trim(),
                    HandoffPersonaKey: string.IsNullOrWhiteSpace(handoffPersonaKey) ? null : handoffPersonaKey.Trim(),
                    OpenDiscussionId: openDiscussionId
                );
            }

            var host = uri.Host.ToLowerInvariant();
            if (host.EndsWith("ottline.app", StringComparison.OrdinalIgnoreCase))
            {
                var segments = uri.AbsolutePath
                    .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var startIdx = segments.Length > 0 && (string.Equals(segments[0], "ko", StringComparison.OrdinalIgnoreCase)
                                                       || string.Equals(segments[0], "en", StringComparison.OrdinalIgnoreCase))
                    ? 1
                    : 0;
                if (segments.Length > startIdx && string.Equals(segments[startIdx], "public", StringComparison.OrdinalIgnoreCase))
                {
                    var discId = segments.Length > startIdx + 1 ? segments[startIdx + 1] : null;
                    return new ParsedShareIntent(
                        OpenRoute: "together",
                        OpenDiscussionId: string.IsNullOrWhiteSpace(discId) ? null : discId.Trim()
                    );
                }
            }
            if (host.Contains("netflix.com")) return new ParsedShareIntent(InferredPlatform: "Netflix", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("tving.com")) return new ParsedShareIntent(InferredPlatform: "TVING", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("wavve.com")) return new ParsedShareIntent(InferredPlatform: "Wavve", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("watcha.com")) return new ParsedShareIntent(InferredPlatform: "Watcha", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("coupangplay.com")) return new ParsedShareIntent(InferredPlatform: "Coupang Play", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("disneyplus.com")) return new ParsedShareIntent(InferredPlatform: "Disney+", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("primevideo.com")) return new ParsedShareIntent(InferredPlatform: "Prime Video", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("tv.apple.com")) return new ParsedShareIntent(InferredPlatform: "Apple TV", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("youtube.com") || host.Contains("youtu.be")) return new ParsedShareIntent(InferredPlatform: "YouTube", InferredFilter: ContentFilter.VIDEO);
            if (host.Contains("ridibooks.com")) return new ParsedShareIntent(InferredPlatform: "리디셀렉트", InferredFilter: ContentFilter.BOOK);
            if (host.Contains("millie.co.kr")) return new ParsedShareIntent(InferredPlatform: "밀리의서재", InferredFilter: ContentFilter.BOOK);
            if (host.Contains("kyobobook.co.kr") || host.Contains("yes24.com") || host.Contains("aladin.co.kr"))
                return new ParsedShareIntent(InferredPlatform: "종이책", InferredFilter: ContentFilter.BOOK);
        }

        return new ParsedShareIntent(QueryTitle: trimmed);
    }

    private static Dictionary<string, string> ParseQueryString(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(query)) return result;
        var q = query.TrimStart('?');
        foreach (var pair in q.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var idx = pair.IndexOf('=');
            if (idx > 0)
            {
                var k = Uri.UnescapeDataString(pair[..idx].Replace('+', ' '));
                var v = Uri.UnescapeDataString(pair[(idx + 1)..].Replace('+', ' '));
                result[k] = v;
            }
            else
            {
                result[Uri.UnescapeDataString(pair.Replace('+', ' '))] = "1";
            }
        }
        return result;
    }
}

public static class CsvExporter
{
    private static readonly char[] FormulaPrefixes = { '=', '+', '-', '@', '\t', '\r' };

    public static string ExportLogsToCsv(IEnumerable<WatchLog> logs)
    {
        var sb = new StringBuilder();
        sb.Append('\uFEFF'); // UTF-8 BOM for Excel on Windows
        sb.AppendLine("WatchedOn,Title,Type,Status,Feeling,Platform,Place,Occasion,Season,Episode,Note,Spoiler,Revision");

        foreach (var log in logs)
        {
            var feeling = RecordFeelings.ResolveRecordFeeling(log.Rating, log.Reaction)?.ToWire() ?? "";
            var fields = new[]
            {
                EscapeCsvCell(RecordDate.OccurredAtToWatchedOnDate(log.OccurredAt, log.WatchedOn)),
                EscapeCsvCell(log.Title.Title),
                EscapeCsvCell(log.Title.Type.ToWire()),
                EscapeCsvCell(log.Status.ToWire()),
                EscapeCsvCell(feeling),
                EscapeCsvCell(log.Ott),
                EscapeCsvCell(log.Place),
                EscapeCsvCell(log.Occasion),
                EscapeCsvCell(log.SeasonNumber?.ToString(CultureInfo.InvariantCulture)),
                EscapeCsvCell(log.EpisodeNumber?.ToString(CultureInfo.InvariantCulture)),
                EscapeCsvCell(log.Note),
                EscapeCsvCell(log.Spoiler ? "true" : "false"),
                EscapeCsvCell(log.Revision.ToString(CultureInfo.InvariantCulture))
            };
            sb.AppendLine(string.Join(",", fields));
        }

        return sb.ToString();
    }

    public static string EscapeCsvCell(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "\"\"";
        var sanitized = value;
        if (FormulaPrefixes.Contains(sanitized[0]))
        {
            sanitized = "'" + sanitized;
        }
        var escaped = sanitized.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }
}

public sealed record NetflixHistoryItem(
    string RawTitle,
    string SeriesOrMovieTitle,
    int? SeasonNumber,
    string WatchedOnDate
);

public static class NetflixHistoryImporter
{
    public static IReadOnlyList<NetflixHistoryItem> ParseCsv(string csvContent)
    {
        if (string.IsNullOrWhiteSpace(csvContent)) return Array.Empty<NetflixHistoryItem>();

        var results = new List<NetflixHistoryItem>();
        var lines = csvContent.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim('\uFEFF', ' ', '\t');
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cols = SplitCsvLine(line);
            if (cols.Count < 2) continue;

            var titleCol = cols[0].Trim();
            var dateCol = cols[1].Trim();
            if (string.Equals(titleCol, "Title", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(dateCol, "Date", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(titleCol)) continue;
            var parsedDate = ParseNetflixDate(dateCol);
            var (cleanTitle, season) = ExtractSeriesAndSeason(titleCol);
            results.Add(new NetflixHistoryItem(titleCol, cleanTitle, season, parsedDate));
        }

        return results;
    }

    private static (string CleanTitle, int? Season) ExtractSeriesAndSeason(string rawTitle)
    {
        var parts = rawTitle.Split(':', StringSplitOptions.TrimEntries);
        if (parts.Length >= 2)
        {
            var baseTitle = parts[0];
            foreach (var part in parts.Skip(1))
            {
                var m = Regex.Match(part, @"(?:시즌|Season|Part|파트)\s*(\d+)", RegexOptions.IgnoreCase);
                if (m.Success && int.TryParse(m.Groups[1].Value, out var seasonNum))
                {
                    return (baseTitle, seasonNum);
                }
            }
            return (baseTitle, 1);
        }
        return (rawTitle, null);
    }

    private static string ParseNetflixDate(string rawDate)
    {
        var formats = new[]
        {
            "yyyy-MM-dd", "M/d/yy", "MM/dd/yy", "M/d/yyyy", "MM/dd/yyyy",
            "d/M/yy", "dd/MM/yyyy", "yyyy. M. d.", "yyyy.MM.dd"
        };
        if (DateTime.TryParseExact(rawDate.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
        {
            return dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        if (DateTime.TryParse(rawDate.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var fallback))
        {
            return fallback.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        return RecordDate.TodayDate();
    }

    private static List<string> SplitCsvLine(string line)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (ch == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }
        result.Add(current.ToString());
        return result;
    }
}

public sealed record WidgetContinueItem(
    string TitleId,
    string TitleName,
    bool IsBook,
    bool IsInProgress,
    string StatusLabel,
    string MetaText,
    string NoteSnippet,
    string? PosterUrl
);

public sealed record WidgetRecentItem(
    string TitleId,
    string TitleName,
    bool IsBook,
    string StatusLabel,
    string DateShort
);

public sealed record OttlineWidgetSnapshot(
    bool IsEnglish,
    string MonthBadge,
    int ThisMonthCount,
    WidgetContinueItem? ContinueItem,
    IReadOnlyList<WidgetRecentItem> RecentItems
);

public static class OttlineWidgetSnapshotBuilder
{
    public static string FormatWidgetStatusLabel(LogStatus status, bool isBook, bool isEn) => status switch
    {
        LogStatus.IN_PROGRESS => isEn ? (isBook ? "Reading" : "Watching") : (isBook ? "읽는 중" : "보는 중"),
        LogStatus.WISHLIST => isEn ? "Saved" : (isBook ? "읽고 싶어요" : "보고 싶어요"),
        _ => isEn ? (isBook ? "Read" : "Watched") : (isBook ? "읽었어요" : "봤어요")
    };

    public static OttlineWidgetSnapshot BuildSnapshot(
        IReadOnlyList<WatchLog> logs,
        string locale = "ko",
        DateTimeOffset? now = null)
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        var refNow = now ?? DateTimeOffset.Now;
        var currentMonthKey = RecordDate.CurrentMonth(refNow);

        var thisMonthCount = logs.Count(l =>
            RecordDate.OccurredAtToWatchedOnDate(l.OccurredAt, l.WatchedOn)
                .StartsWith(currentMonthKey, StringComparison.Ordinal));

        var monthBadge = thisMonthCount > 0
            ? (isEn
                ? $"{refNow.ToString("MMM", CultureInfo.InvariantCulture)} · {thisMonthCount}"
                : $"{refNow.Month}월 · {thisMonthCount}편")
            : (isEn ? "Timeline" : "타임라인");

        var heroLog = logs.FirstOrDefault(l => l.Status == LogStatus.IN_PROGRESS)
                      ?? logs.FirstOrDefault();

        WidgetContinueItem? continueItem = null;
        if (heroLog != null && !string.IsNullOrWhiteSpace(heroLog.Title.Title))
        {
            var isBook = heroLog.Title.Type.IsBook();
            var isInProgress = heroLog.Status == LogStatus.IN_PROGRESS;
            var statusLabel = FormatWidgetStatusLabel(heroLog.Status, isBook, isEn);

            var metaParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(heroLog.Ott))
            {
                metaParts.Add(heroLog.Ott.Trim());
            }

            if (isBook)
            {
                var firstAuthor = heroLog.Title.SafeAuthors.FirstOrDefault(a => !string.IsNullOrWhiteSpace(a));
                if (!string.IsNullOrWhiteSpace(firstAuthor))
                {
                    metaParts.Add(firstAuthor.Trim());
                }
            }
            else if (heroLog.SeasonNumber.HasValue)
            {
                metaParts.Add(isEn ? $"S{heroLog.SeasonNumber.Value}" : $"시즌 {heroLog.SeasonNumber.Value}");
            }

            if (metaParts.Count == 0 && heroLog.Title.Year.HasValue)
            {
                metaParts.Add(heroLog.Title.Year.Value.ToString(CultureInfo.InvariantCulture));
            }

            var metaText = string.Join(" · ", metaParts);
            var rawNote = !heroLog.Spoiler ? (heroLog.Note?.Trim() ?? string.Empty) : string.Empty;
            string noteSnippet;
            if (!string.IsNullOrEmpty(rawNote))
            {
                var singleLine = rawNote.Replace("\r\n", " ").Replace('\n', ' ').Replace('\r', ' ').Trim();
                noteSnippet = singleLine.Length > 90 ? singleLine[..89].TrimEnd() + "…" : singleLine;
            }
            else if (isInProgress)
            {
                noteSnippet = isEn
                    ? "Click to update status or leave a quick note"
                    : "클릭해서 감상 상태를 바꾸거나 메모를 이어 남겨보세요";
            }
            else
            {
                noteSnippet = isEn
                    ? "Click to revisit or refine this memory"
                    : "클릭해서 남긴 기록을 돌아보거나 다듬어보세요";
            }

            var posterUrl = string.IsNullOrWhiteSpace(heroLog.Title.PosterUrl) ? null : heroLog.Title.PosterUrl.Trim();
            continueItem = new WidgetContinueItem(
                TitleId: heroLog.TitleId,
                TitleName: heroLog.Title.Title.Trim(),
                IsBook: isBook,
                IsInProgress: isInProgress,
                StatusLabel: statusLabel,
                MetaText: metaText,
                NoteSnippet: noteSnippet,
                PosterUrl: posterUrl
            );
        }

        var recentItems = logs
            .Where(l => l.Id != heroLog?.Id && !string.IsNullOrWhiteSpace(l.Title.Title))
            .Take(3)
            .Select(l =>
            {
                var isBook = l.Title.Type.IsBook();
                return new WidgetRecentItem(
                    TitleId: l.TitleId,
                    TitleName: l.Title.Title.Trim(),
                    IsBook: isBook,
                    StatusLabel: FormatWidgetStatusLabel(l.Status, isBook, isEn),
                    DateShort: RecordDate.FormatDisplayDate(l.WatchedOn, l.OccurredAt, locale)
                );
            })
            .ToList();

        return new OttlineWidgetSnapshot(
            IsEnglish: isEn,
            MonthBadge: monthBadge,
            ThisMonthCount: thisMonthCount,
            ContinueItem: continueItem,
            RecentItems: recentItems
        );
    }

    public static string BuildAdaptiveCardJson(
        OttlineWidgetSnapshot snapshot,
        string size = "medium",
        string? resolvedPosterUri = null)
    {
        var isEn = snapshot.IsEnglish;
        var normSize = size.Trim().ToLowerInvariant() switch
        {
            "small" => "small",
            "large" => "large",
            _ => "medium"
        };

        var body = new JsonArray();

        // Top brand + monthly badge header
        body.Add(new JsonObject
        {
            ["type"] = "ColumnSet",
            ["spacing"] = "None",
            ["columns"] = new JsonArray
            {
                new JsonObject
                {
                    ["type"] = "Column",
                    ["width"] = "stretch",
                    ["verticalContentAlignment"] = "Center",
                    ["items"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["type"] = "TextBlock",
                            ["text"] = "ottline",
                            ["weight"] = "Bolder",
                            ["color"] = "Accent",
                            ["size"] = "Small",
                            ["wrap"] = false
                        }
                    }
                },
                new JsonObject
                {
                    ["type"] = "Column",
                    ["width"] = "auto",
                    ["verticalContentAlignment"] = "Center",
                    ["items"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["type"] = "TextBlock",
                            ["text"] = snapshot.MonthBadge,
                            ["isSubtle"] = true,
                            ["size"] = "Small",
                            ["horizontalAlignment"] = "Right",
                            ["wrap"] = false
                        }
                    }
                }
            }
        });

        var cont = snapshot.ContinueItem;
        if (normSize == "small")
        {
            body.Add(BuildSmallHeroContainer(cont, isEn));
            body.Add(BuildActionSet(new[]
            {
                CreateExecuteAction(isEn ? "+ Quick Record" : "+ 빠른 기록", "quick_record_all", style: "positive")
            }));
        }
        else if (normSize == "medium")
        {
            body.Add(BuildHeroContainer(cont, isEn, resolvedPosterUri, includeNote: false));
            body.Add(BuildActionSet(new[]
            {
                CreateExecuteAction(isEn ? "+ Quick Record" : "+ 빠른 기록", "quick_record_all", style: "positive"),
                CreateExecuteAction(isEn ? "Video" : "영상", "quick_record_video"),
                CreateExecuteAction(isEn ? "Book" : "책", "quick_record_book")
            }));
        }
        else
        {
            body.Add(BuildHeroContainer(cont, isEn, resolvedPosterUri, includeNote: true));

            if (snapshot.RecentItems.Count > 0)
            {
                var recentRows = new JsonArray();
                foreach (var item in snapshot.RecentItems.Take(3))
                {
                    recentRows.Add(new JsonObject
                    {
                        ["type"] = "Container",
                        ["spacing"] = "Small",
                        ["separator"] = recentRows.Count > 0,
                        ["selectAction"] = CreateExecuteAction(item.TitleName, "open_title", titleId: item.TitleId),
                        ["items"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["type"] = "ColumnSet",
                                ["columns"] = new JsonArray
                                {
                                    new JsonObject
                                    {
                                        ["type"] = "Column",
                                        ["width"] = "stretch",
                                        ["verticalContentAlignment"] = "Center",
                                        ["items"] = new JsonArray
                                        {
                                            new JsonObject
                                            {
                                                ["type"] = "TextBlock",
                                                ["text"] = item.TitleName,
                                                ["weight"] = "Bolder",
                                                ["size"] = "Small",
                                                ["maxLines"] = 1,
                                                ["wrap"] = false
                                            }
                                        }
                                    },
                                    new JsonObject
                                    {
                                        ["type"] = "Column",
                                        ["width"] = "auto",
                                        ["verticalContentAlignment"] = "Center",
                                        ["items"] = new JsonArray
                                        {
                                            new JsonObject
                                            {
                                                ["type"] = "TextBlock",
                                                ["text"] = item.StatusLabel,
                                                ["isSubtle"] = true,
                                                ["size"] = "Small",
                                                ["horizontalAlignment"] = "Right",
                                                ["wrap"] = false
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                }

                body.Add(new JsonObject
                {
                    ["type"] = "Container",
                    ["spacing"] = "Small",
                    ["items"] = recentRows
                });
            }

            body.Add(BuildActionSet(new[]
            {
                CreateExecuteAction(isEn ? "+ Quick Record" : "+ 빠른 기록", "quick_record_all", style: "positive"),
                CreateExecuteAction(isEn ? "Video" : "영상", "quick_record_video"),
                CreateExecuteAction(isEn ? "Book" : "책", "quick_record_book"),
                CreateExecuteAction(isEn ? "Timeline" : "타임라인", "open_timeline")
            }));
        }

        var root = new JsonObject
        {
            ["$schema"] = "http://adaptivecards.io/schemas/adaptive-card.json",
            ["type"] = "AdaptiveCard",
            ["version"] = "1.5",
            ["body"] = body
        };

        return root.ToJsonString();
    }

    private static JsonObject BuildSmallHeroContainer(WidgetContinueItem? cont, bool isEn)
    {
        if (cont == null)
        {
            return new JsonObject
            {
                ["type"] = "Container",
                ["style"] = "emphasis",
                ["spacing"] = "Small",
                ["selectAction"] = CreateExecuteAction("Open Quick Record", "quick_record_all"),
                ["items"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["type"] = "TextBlock",
                        ["text"] = isEn ? "Log a film, series, or book today" : "오늘 본 작품이나 읽은 책을 남겨보세요",
                        ["size"] = "Small",
                        ["weight"] = "Bolder",
                        ["wrap"] = true,
                        ["maxLines"] = 2
                    }
                }
            };
        }

        var items = new JsonArray
        {
            new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = cont.StatusLabel,
                ["size"] = "Small",
                ["color"] = "Accent",
                ["weight"] = "Bolder",
                ["wrap"] = false
            },
            new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = cont.TitleName,
                ["size"] = "Medium",
                ["weight"] = "Bolder",
                ["spacing"] = "None",
                ["maxLines"] = 1,
                ["wrap"] = false
            }
        };

        if (!string.IsNullOrWhiteSpace(cont.MetaText))
        {
            items.Add(new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = cont.MetaText,
                ["size"] = "Small",
                ["isSubtle"] = true,
                ["spacing"] = "None",
                ["maxLines"] = 1,
                ["wrap"] = false
            });
        }

        return new JsonObject
        {
            ["type"] = "Container",
            ["style"] = "emphasis",
            ["spacing"] = "Small",
            ["selectAction"] = CreateExecuteAction(cont.TitleName, "open_title", titleId: cont.TitleId),
            ["items"] = items
        };
    }

    private static JsonObject BuildHeroContainer(
        WidgetContinueItem? cont,
        bool isEn,
        string? resolvedPosterUri,
        bool includeNote)
    {
        if (cont == null)
        {
            return new JsonObject
            {
                ["type"] = "Container",
                ["style"] = "emphasis",
                ["spacing"] = "Small",
                ["selectAction"] = CreateExecuteAction("Open Quick Record", "quick_record_all"),
                ["items"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["type"] = "TextBlock",
                        ["text"] = isEn ? "Keep what you watch and read" : "보고 읽은 순간을 그날의 온기로",
                        ["size"] = "Medium",
                        ["weight"] = "Bolder",
                        ["wrap"] = true
                    },
                    new JsonObject
                    {
                        ["type"] = "TextBlock",
                        ["text"] = isEn
                            ? "Log a film, series, or book today with one click."
                            : "오늘 본 영상이나 읽은 책을 한 번의 클릭으로 타임라인에 남겨보세요.",
                        ["size"] = "Small",
                        ["isSubtle"] = true,
                        ["spacing"] = "Small",
                        ["wrap"] = true,
                        ["maxLines"] = 2
                    }
                }
            };
        }

        var eyebrow = cont.IsInProgress
            ? (isEn ? $"Continue · {cont.StatusLabel}" : $"이어보는 작품 · {cont.StatusLabel}")
            : (isEn ? $"Latest memory · {cont.StatusLabel}" : $"최근 남긴 온기 · {cont.StatusLabel}");

        var textItems = new JsonArray
        {
            new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = eyebrow,
                ["size"] = "Small",
                ["color"] = "Accent",
                ["weight"] = "Bolder",
                ["wrap"] = false
            },
            new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = cont.TitleName,
                ["size"] = "Medium",
                ["weight"] = "Bolder",
                ["spacing"] = "None",
                ["maxLines"] = 1,
                ["wrap"] = false
            }
        };

        if (!string.IsNullOrWhiteSpace(cont.MetaText))
        {
            textItems.Add(new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = cont.MetaText,
                ["size"] = "Small",
                ["isSubtle"] = true,
                ["spacing"] = "None",
                ["maxLines"] = 1,
                ["wrap"] = false
            });
        }

        if (includeNote && !string.IsNullOrWhiteSpace(cont.NoteSnippet))
        {
            textItems.Add(new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = cont.NoteSnippet,
                ["size"] = "Small",
                ["isSubtle"] = true,
                ["spacing"] = "Small",
                ["wrap"] = true,
                ["maxLines"] = 2
            });
        }

        var columns = new JsonArray();
        if (!string.IsNullOrWhiteSpace(resolvedPosterUri))
        {
            columns.Add(new JsonObject
            {
                ["type"] = "Column",
                ["width"] = "52px",
                ["verticalContentAlignment"] = "Center",
                ["items"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["type"] = "Image",
                        ["url"] = resolvedPosterUri,
                        ["width"] = "46px",
                        ["height"] = "66px",
                        ["altText"] = cont.TitleName
                    }
                }
            });
        }

        columns.Add(new JsonObject
        {
            ["type"] = "Column",
            ["width"] = "stretch",
            ["verticalContentAlignment"] = "Center",
            ["items"] = textItems
        });

        return new JsonObject
        {
            ["type"] = "Container",
            ["style"] = "emphasis",
            ["spacing"] = "Small",
            ["selectAction"] = CreateExecuteAction(cont.TitleName, "open_title", titleId: cont.TitleId),
            ["items"] = new JsonArray
            {
                new JsonObject
                {
                    ["type"] = "ColumnSet",
                    ["columns"] = columns
                }
            }
        };
    }

    private static JsonObject BuildActionSet(IEnumerable<JsonObject> actions)
    {
        var arr = new JsonArray();
        foreach (var action in actions)
        {
            arr.Add(action);
        }
        return new JsonObject
        {
            ["type"] = "ActionSet",
            ["spacing"] = "Small",
            ["actions"] = arr
        };
    }

    private static JsonObject CreateExecuteAction(
        string title,
        string verb,
        string? titleId = null,
        string? style = null)
    {
        var obj = new JsonObject
        {
            ["type"] = "Action.Execute",
            ["title"] = title,
            ["verb"] = verb
        };
        if (!string.IsNullOrWhiteSpace(style))
        {
            obj["style"] = style;
        }
        if (!string.IsNullOrWhiteSpace(titleId))
        {
            obj["data"] = new JsonObject
            {
                ["titleId"] = titleId
            };
        }
        return obj;
    }
}

public enum AutoSyncTrigger
{
    TabNavigation,
    WindowActivated
}

public sealed class AutoSyncGate
{
    private readonly object _lock = new();
    private DateTimeOffset? _lastCompletedUtc;

    public TimeSpan TabNavigationCooldown { get; }
    public TimeSpan WindowActivatedCooldown { get; }

    public AutoSyncGate(
        TimeSpan? tabNavigationCooldown = null,
        TimeSpan? windowActivatedCooldown = null)
    {
        TabNavigationCooldown = tabNavigationCooldown ?? TimeSpan.FromMilliseconds(1500);
        WindowActivatedCooldown = windowActivatedCooldown ?? TimeSpan.FromSeconds(5);
    }

    public DateTimeOffset? LastCompletedUtc
    {
        get
        {
            lock (_lock)
            {
                return _lastCompletedUtc;
            }
        }
    }

    public bool ShouldRun(
        AutoSyncTrigger trigger,
        bool hasConnectedAccount,
        int pendingOutboxCount,
        DateTimeOffset nowUtc)
    {
        if (!hasConnectedAccount && pendingOutboxCount <= 0)
        {
            return false;
        }

        lock (_lock)
        {
            if (!_lastCompletedUtc.HasValue)
            {
                return true;
            }

            var elapsed = nowUtc - _lastCompletedUtc.Value;
            if (elapsed < TimeSpan.Zero)
            {
                return true;
            }

            var cooldown = trigger switch
            {
                AutoSyncTrigger.TabNavigation => TabNavigationCooldown,
                AutoSyncTrigger.WindowActivated => WindowActivatedCooldown,
                _ => TabNavigationCooldown
            };

            return elapsed >= cooldown;
        }
    }

    public void MarkCompleted(DateTimeOffset completedUtc)
    {
        lock (_lock)
        {
            _lastCompletedUtc = completedUtc;
        }
    }
}

public sealed record QuickPlatformComboState(
    string[] Options,
    int SelectedIndex,
    bool ShowCustomInput
);

public static class QuickRecordPlatformSelector
{
    public static string[] BuildOptions(bool isBook, string locale = "ko")
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        var presets = OttlinePresets.GetQuickPlatformPresets(isBook, locale);
        var result = new string[presets.Count + 2];
        result[0] = isEn ? "None" : "선택 안 함";
        for (var i = 0; i < presets.Count; i++)
        {
            result[i + 1] = presets[i];
        }
        result[^1] = isEn ? "Custom input" : "직접 입력";
        return result;
    }

    public static QuickPlatformComboState Resolve(
        string? currentPlatform,
        bool isCustomExplicitlySelected,
        bool isBook,
        string locale = "ko")
    {
        var options = BuildOptions(isBook, locale);
        var customIndex = options.Length - 1;

        if (isCustomExplicitlySelected)
        {
            return new QuickPlatformComboState(options, customIndex, ShowCustomInput: true);
        }

        if (string.IsNullOrWhiteSpace(currentPlatform))
        {
            return new QuickPlatformComboState(options, SelectedIndex: 0, ShowCustomInput: false);
        }

        var presets = OttlinePresets.GetQuickPlatformPresets(isBook, locale);
        if (OttlinePresets.TryMatchPlatformPresetIndex(presets, currentPlatform, out var presetIdx))
        {
            return new QuickPlatformComboState(options, SelectedIndex: presetIdx + 1, ShowCustomInput: false);
        }

        return new QuickPlatformComboState(options, customIndex, ShowCustomInput: true);
    }

    public static (string PlatformValue, bool IsCustomSelected) ApplySelectionIndex(
        int selectedIndex,
        string? currentPlatform,
        bool isBook,
        string locale = "ko")
    {
        var options = BuildOptions(isBook, locale);
        var customIndex = options.Length - 1;

        if (selectedIndex <= 0 || selectedIndex > customIndex)
        {
            return (string.Empty, false);
        }

        if (selectedIndex == customIndex)
        {
            var presets = OttlinePresets.GetQuickPlatformPresets(isBook, locale);
            var trimmed = currentPlatform?.Trim() ?? string.Empty;
            var preserveCustom = !string.IsNullOrWhiteSpace(trimmed)
                                 && !OttlinePresets.TryMatchPlatformPresetIndex(presets, trimmed, out _);
            return (preserveCustom ? trimmed : string.Empty, true);
        }

        return (options[selectedIndex], false);
    }
}
