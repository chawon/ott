using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using Ottline.App.Services;
using Ottline.App.Theme;
using Ottline.Core.Data;
using Ottline.Core.Domain;
using Ottline.Core.I18n;
using Ottline.Core.Models;
using Ottline.Core.WatchDetection;

namespace Ottline.App.ViewModels;

public enum MainTab
{
    HOME,
    TIMELINE,
    TOGETHER,
    MY_SPACE
}

public enum MySpaceSection
{
    PROFILE_SYNC,
    REPORT,
    BOOKSHELF,
    WATCH_REMINDER,
    FEEDBACK,
    GUIDES,
    IMPORT_ADVANCED
}

public enum QuickRecordStage
{
    SEARCH,
    FORM,
    SAVED
}

public sealed record AvatarOptionItem(
    StorybookAvatarPreset Preset,
    string Key,
    string Label,
    string Subtitle,
    string ImageUri,
    bool IsSelected
);

public sealed record HomeMonthButtonItem(
    string Key,
    string YearText,
    string MonthText,
    int Count,
    bool IsSelected
);

public sealed record HomeMomentLinkItem(
    string Kind,
    string Icon,
    string Label,
    string CountText,
    string Value
);

public sealed record WatchLogDisplayItem(
    WatchLog Log,
    string TypeBadge,
    string TypeAndYear,
    string CreatorLine,
    string StatusBadge,
    string FeelingBadge,
    string StatusAndFeelingLine,
    string EditionLine,
    string MetaLine,
    string MomentSummary,
    string NotePreview,
    string RevisionBadge,
    string DateShortLabel,
    string MonthShortLabel,
    string DayNumberText,
    string KdcBadge,
    bool HasNote,
    bool IsSpoilerHidden,
    bool IsBook
);

public sealed record TimelineMonthGroupItem(
    string MonthKey,
    string MonthLabel,
    int Count,
    ObservableCollection<WatchLogDisplayItem> Items
);

public sealed class TogetherListItem : INotifyPropertyChanged
{
    private DiscussionPost _post;
    private string _metaLine;
    private string _snippet;
    private bool _hasSnippet;
    private string _reactionSummaryText;
    private bool _hasReactions;
    private bool _isSelected;

    public TogetherListItem(
        DiscussionPost post,
        string metaLine,
        string snippet,
        bool hasSnippet,
        string reactionSummaryText,
        bool hasReactions,
        bool isSelected)
    {
        _post = post;
        _metaLine = metaLine;
        _snippet = snippet;
        _hasSnippet = hasSnippet;
        _reactionSummaryText = reactionSummaryText;
        _hasReactions = hasReactions;
        _isSelected = isSelected;
    }

    public string Id => _post.Id;
    public TitleSummary Title => _post.Title;

    public DiscussionPost Post
    {
        get => _post;
        private set { _post = value; OnPropertyChanged(); OnPropertyChanged(nameof(Title)); }
    }

    public string MetaLine
    {
        get => _metaLine;
        private set { if (_metaLine == value) return; _metaLine = value; OnPropertyChanged(); }
    }

    public string Snippet
    {
        get => _snippet;
        private set { if (_snippet == value) return; _snippet = value; OnPropertyChanged(); }
    }

    public bool HasSnippet
    {
        get => _hasSnippet;
        private set { if (_hasSnippet == value) return; _hasSnippet = value; OnPropertyChanged(); }
    }

    public string ReactionSummaryText
    {
        get => _reactionSummaryText;
        private set { if (_reactionSummaryText == value) return; _reactionSummaryText = value; OnPropertyChanged(); }
    }

    public bool HasReactions
    {
        get => _hasReactions;
        private set { if (_hasReactions == value) return; _hasReactions = value; OnPropertyChanged(); }
    }

    public bool IsSelected
    {
        get => _isSelected;
        private set { if (_isSelected == value) return; _isSelected = value; OnPropertyChanged(); }
    }

    public void Update(
        DiscussionPost post,
        string metaLine,
        string snippet,
        bool hasSnippet,
        string reactionSummaryText,
        bool hasReactions,
        bool isSelected)
    {
        Post = post;
        MetaLine = metaLine;
        Snippet = snippet;
        HasSnippet = hasSnippet;
        ReactionSummaryText = reactionSummaryText;
        HasReactions = hasReactions;
        IsSelected = isSelected;
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

public sealed class MainViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly OttlineRepository _repo;
    private CancellationTokenSource? _searchDebounceCts;

    private LocalSettings _settings;
    private OttlineStrings _strings;
    private MainTab _currentTab = MainTab.HOME;
    private MySpaceSection _currentMySpaceSection = MySpaceSection.PROFILE_SYNC;

    private string _syncStatusText = "로컬 준비됨";
    private string _toastMessage = string.Empty;
    private bool _isToastVisible;
    private OttlineWidgetSnapshot _widgetPreviewSnapshot = OttlineWidgetSnapshotBuilder.BuildSnapshot(Array.Empty<WatchLog>());

    // Home state
    private string _selectedHomeMonth;
    private WatchLogDisplayItem? _featuredWarmthItem;
    private WatchReminderCandidate? _activeWatchBanner;

    // Timeline state
    private string _timelineSearchQuery = string.Empty;
    private ContentFilter _timelineContentFilter = ContentFilter.ALL;
    private bool _isMomentFilterOpen;
    private LogStatus? _timelineStatusFilter;
    private RecordFeeling? _timelineFeelingFilter;
    private string? _timelinePlaceFilter;
    private string? _timelineOccasionFilter;
    private string? _timelinePlatformFilter;
    private string _timelineOriginFilter = "ALL";
    private bool _isRecommendationsOpen;
    private bool _isRecommendationsLoading;
    private RecommendationStateSnapshot? _recommendationState;
    private RecommendationErrorKind _recommendationErrorKind = RecommendationErrorKind.None;
    private string? _recommendationScopeKey;
    private CancellationTokenSource? _recommendationsCts;

    // Title Detail state
    private bool _isTitleDetailOpen;
    private WatchLog? _selectedDetailLog;
    private bool _isDetailSpoilerRevealed;

    // Quick Record Modal state
    private bool _isQuickRecordOpen;
    private QuickRecordStage _quickRecordStage = QuickRecordStage.SEARCH;
    private string _quickSearchQuery = string.Empty;
    private ContentFilter _quickSearchFilter = ContentFilter.ALL;
    private TitleSummary? _quickSelectedTitle;
    private LogStatus _quickStatus = LogStatus.DONE;
    private RecordFeeling? _quickFeeling = RecordFeeling.SATISFIED;
    private string _quickWatchedOn = RecordDate.TodayDate();
    private string _quickPlatform = string.Empty;
    private string _quickPlace = string.Empty;
    private string _quickOccasion = string.Empty;
    private string _quickSeasonText = string.Empty;
    private string _quickEpisodeText = string.Empty;
    private string _quickNote = string.Empty;
    private bool _quickSpoiler;
    private bool _quickShareTogether;
    private WatchLog? _quickLastSavedLog;
    private string _manualTitleInput = string.Empty;
    private string _manualAuthorOrYearInput = string.Empty;
    private string _manualIsbnInput = string.Empty;

    // Together state
    private readonly TogetherSpreadCoordinator _together = new();
    private bool _isSyncingTogetherList;
    private bool _isTogetherListLoading;
    private bool _isTogetherReactionBusy;
    private bool _isSubmittingComment;
    private TogetherListItem? _selectedDiscussionListItem;
    private string _newCommentBody = string.Empty;
    private bool _newCommentSyncLog = true;
    private bool _isWriteDiscussionOpen;
    private string _newDiscussionTitleQuery = string.Empty;
    private TitleSummary? _newDiscussionTitle = null;
    private string _newDiscussionBody = string.Empty;
    private bool _newDiscussionSpoiler;

    // My Space state
    private bool _isProfileEditorOpen;
    private string _editDisplayName = string.Empty;
    private string _editHandle = string.Empty;
    private string _editBio = string.Empty;
    private string _editAvatarKey = "fox";
    private string _pairCodeInput = string.Empty;
    private PairPreviewResult? _pairPreview;
    private PersonalReportSummary _personalReport;
    private string _selectedReportPeriod = "ALL";
    private string _newFeedbackCategory = "QUESTION";
    private string _newFeedbackSubject = string.Empty;
    private string _newFeedbackBody = string.Empty;
    private FeedbackThread? _selectedFeedbackThread;
    private bool _isDeletingServerAccount;
    private readonly int _splashMessageIndex = DateTime.Now.DayOfYear % 3;

    public MainViewModel(OttlineRepository? repository = null, bool skipStartupNetwork = false)
    {
        _repo = repository ?? new OttlineRepository();
        _settings = _repo.GetSettings();
        _strings = OttlineStrings.ForLocale(_settings.Locale);
        _selectedHomeMonth = RecordDate.CurrentMonth();

        _editDisplayName = _settings.DisplayName;
        _editHandle = _settings.Handle;
        _editBio = _settings.Bio;
        _editAvatarKey = _settings.AvatarPreset;

        _personalReport = PersonalReportBuilder.BuildReport(Array.Empty<WatchLog>());
        _together.StateChanged += OnTogetherCoordinatorStateChanged;

        OttlineThemeManager.ApplyTheme(_settings.ThemeMode);

        var allLogs = _repo.GetAllLogs();
        if (allLogs.Count > 0)
        {
            var latestDate = RecordDate.OccurredAtToWatchedOnDate(allLogs[0].OccurredAt, allLogs[0].WatchedOn);
            if (latestDate.Length >= 7)
            {
                _selectedHomeMonth = latestDate[..7];
            }
        }

        RefreshLocalState();
        if (!skipStartupNetwork)
        {
            if (!string.IsNullOrWhiteSpace(_settings.UserId))
            {
                _ = SyncNowAsync(silent: true);
            }
            _ = LoadTogetherAsync();
            _ = EnrichMissingPostersAsync();
        }
    }

    public async Task EnrichMissingPostersAsync()
    {
        try
        {
            var missing = _repo.GetAllLogs()
                .Select(l => l.Title)
                .Where(t => string.IsNullOrWhiteSpace(t.PosterUrl))
                .GroupBy(t => t.Id)
                .Select(g => g.First())
                .Take(12)
                .ToList();

            if (missing.Count == 0) return;

            var anyUpdated = false;
            foreach (var t in missing)
            {
                var filter = t.Type.IsBook() ? ContentFilter.BOOK : ContentFilter.VIDEO;
                var results = await _repo.Api.SearchTitlesAsync(t.Title, filter).ConfigureAwait(false);
                var match = results.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.PosterUrl));
                if (match != null)
                {
                    _repo.Database.UpsertTitle(t with { PosterUrl = match.PosterUrl });
                    anyUpdated = true;
                }
            }

            if (anyUpdated)
            {
                System.Windows.Application.Current?.Dispatcher.Invoke(RefreshLocalState);
            }
        }
        catch
        {
            // Ignore network errors during background poster enrichment
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public OttlineRepository Repository => _repo;
    public LocalSettings Settings => _settings;
    public OttlineStrings Strings => _strings;

    public ObservableCollection<HomeMonthButtonItem> HomeMonthGroups { get; } = new();
    public ObservableCollection<WatchLogDisplayItem> HomeMonthCompletedItems { get; } = new();
    public ObservableCollection<WatchLogDisplayItem> HomeUnfinishedItems { get; } = new();
    public ObservableCollection<HomeMomentLinkItem> HomeMomentLinks { get; } = new();
    public ObservableCollection<string> HomeFrequentPlaces { get; } = new();
    public ObservableCollection<string> HomeFrequentOccasions { get; } = new();
    public ObservableCollection<TitleSummary> HomePopularTitles { get; } = new();
    public ObservableCollection<DiscussionPost> HomeDiscussionsPreview { get; } = new();

    public ObservableCollection<WatchLogDisplayItem> TimelineItems { get; } = new();
    public ObservableCollection<TimelineMonthGroupItem> TimelineMonthGroups { get; } = new();
    public ObservableCollection<RecommendationItem> Recommendations { get; } = new();
    public ObservableCollection<WatchLogHistoryEntry> SelectedTitleHistory { get; } = new();

    public ObservableCollection<TitleSummary> QuickSearchResults { get; } = new();
    public ObservableCollection<string> QuickPlatformOptions { get; } = new();
    public ObservableCollection<string> QuickPlaceOptions { get; } = new();
    public ObservableCollection<string> QuickOccasionOptions { get; } = new();

    public ObservableCollection<DiscussionPost> Discussions { get; } = new();
    public ObservableCollection<TogetherListItem> DiscussionItems { get; } = new();
    public ObservableCollection<DiscussionComment> SelectedDiscussionComments { get; } = new();

    public ObservableCollection<AvatarOptionItem> AvatarOptions { get; } = new();
    public ObservableCollection<LinkedDevice> LinkedDevices { get; } = new();
    public ObservableCollection<KdcCategoryShelf> KdcShelves { get; } = new();
    public ObservableCollection<FeedbackThread> FeedbackThreads { get; } = new();

    public MainTab CurrentTab
    {
        get => _currentTab;
        set
        {
            if (_currentTab == value) return;
            _currentTab = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsHomeTab));
            OnPropertyChanged(nameof(IsTimelineTab));
            OnPropertyChanged(nameof(IsTogetherTab));
            OnPropertyChanged(nameof(IsMySpaceTab));
            if (value == MainTab.TIMELINE && TimelineMonthGroups.Count == 0)
            {
                RefreshTimelineItems();
            }
            else if (value == MainTab.TOGETHER && Discussions.Count == 0)
            {
                _ = LoadTogetherAsync();
            }
            else if (value == MainTab.MY_SPACE)
            {
                EnsureMySpaceDataLoaded();
            }
        }
    }

    public bool IsHomeTab => _currentTab == MainTab.HOME;
    public bool IsTimelineTab => _currentTab == MainTab.TIMELINE;
    public bool IsTogetherTab => _currentTab == MainTab.TOGETHER;
    public bool IsMySpaceTab => _currentTab == MainTab.MY_SPACE;

    public MySpaceSection CurrentMySpaceSection
    {
        get => _currentMySpaceSection;
        set
        {
            if (_currentMySpaceSection == value) return;
            _currentMySpaceSection = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsMySpaceProfileSync));
            OnPropertyChanged(nameof(IsMySpaceReport));
            OnPropertyChanged(nameof(IsMySpaceBookshelf));
            OnPropertyChanged(nameof(IsMySpaceWatchReminder));
            OnPropertyChanged(nameof(IsMySpaceFeedback));
            OnPropertyChanged(nameof(IsMySpaceGuides));
            OnPropertyChanged(nameof(IsMySpaceImportAdvanced));
            if (value == MySpaceSection.FEEDBACK)
            {
                _ = LoadFeedbackThreadsAsync();
            }
        }
    }

    public bool IsMySpaceProfileSync => _currentMySpaceSection == MySpaceSection.PROFILE_SYNC;
    public bool IsMySpaceReport => _currentMySpaceSection == MySpaceSection.REPORT;
    public bool IsMySpaceBookshelf => _currentMySpaceSection == MySpaceSection.BOOKSHELF;
    public bool IsMySpaceWatchReminder => _currentMySpaceSection == MySpaceSection.WATCH_REMINDER;
    public bool IsMySpaceFeedback => _currentMySpaceSection == MySpaceSection.FEEDBACK;
    public bool IsMySpaceGuides => _currentMySpaceSection == MySpaceSection.GUIDES;
    public bool IsMySpaceImportAdvanced => _currentMySpaceSection == MySpaceSection.IMPORT_ADVANCED;

    public bool IsKoreanLocale => !string.Equals(_settings.Locale, "en", StringComparison.OrdinalIgnoreCase);
    public bool IsEnglishLocale => string.Equals(_settings.Locale, "en", StringComparison.OrdinalIgnoreCase);

    public bool IsThemeSystem => _settings.ThemeMode == ThemeMode.SYSTEM;
    public bool IsThemeLight => _settings.ThemeMode == ThemeMode.LIGHT;
    public bool IsThemeDark => _settings.ThemeMode == ThemeMode.DARK;

    public string ThemeToggleToolTip => _settings.ThemeMode switch
    {
        ThemeMode.SYSTEM => IsEnglishLocale ? "Theme: System (Click to change)" : "테마: 시스템 (클릭해서 변경)",
        ThemeMode.DARK => IsEnglishLocale ? "Theme: Dark (Click to change)" : "테마: 다크 (클릭해서 변경)",
        _ => IsEnglishLocale ? "Theme: Light (Click to change)" : "테마: 라이트 (클릭해서 변경)"
    };

    public string TodayDateDisplay
    {
        get
        {
            var now = DateTime.Now;
            if (IsEnglishLocale)
            {
                return now.ToString("ddd, MMM d", System.Globalization.CultureInfo.InvariantCulture);
            }
            var dow = new[] { "일", "월", "화", "수", "목", "금", "토" }[(int)now.DayOfWeek];
            return $"{now.Month}월 {now.Day}일 {dow}요일";
        }
    }

    public string SplashEyebrowText
    {
        get
        {
            var name = _settings.DisplayName?.Trim();
            var hasCustomNickname = !string.IsNullOrWhiteSpace(name) && name != "나의 기록실";
            if (hasCustomNickname)
            {
                return IsEnglishLocale
                    ? $"{name}'s timeline notebook"
                    : $"{name}님의 기록 수첩";
            }
            return IsEnglishLocale
                ? "Your personal timeline notebook"
                : "나만의 감상 기록 수첩";
        }
    }

    public string SplashMessageText => _splashMessageIndex switch
    {
        0 => IsEnglishLocale
            ? "Revisiting the warmth of the scenes\nand lines you loved."
            : "지나간 장면과 문장,\n그날의 온기를 다시 꺼내봅니다.",
        1 => IsEnglishLocale
            ? "Keep the moments you watch and read\non your own timeline."
            : "보고 읽은 순간이 사라지지 않도록,\n나만의 타임라인에 남겨요.",
        _ => IsEnglishLocale
            ? "A quiet notebook where the stories\nyou love gather over time."
            : "기억하고 싶은 이야기들이\n차곡차곡 쌓이는 공간"
    };

    public string SyncStatusText
    {
        get => _syncStatusText;
        private set { _syncStatusText = value; OnPropertyChanged(); }
    }

    public string ToastMessage
    {
        get => _toastMessage;
        private set { _toastMessage = value; OnPropertyChanged(); }
    }

    public bool IsToastVisible
    {
        get => _isToastVisible;
        private set { _isToastVisible = value; OnPropertyChanged(); }
    }

    public string SelectedHomeMonthLabel => RecordDate.FormatMonthLabel(_selectedHomeMonth, _settings.Locale);
    public string SelectedHomeMonthShort
    {
        get
        {
            if (_selectedHomeMonth.Length >= 7 && int.TryParse(_selectedHomeMonth[5..7], out var m))
            {
                return IsEnglishLocale
                    ? new DateTime(2026, m, 1).ToString("MMM", System.Globalization.CultureInfo.InvariantCulture)
                    : $"{m}월";
            }
            return _selectedHomeMonth;
        }
    }
    public int SelectedHomeMonthCount => HomeMonthCompletedItems.Count;

    public WatchLogDisplayItem? FeaturedWarmthItem
    {
        get => _featuredWarmthItem;
        private set
        {
            _featuredWarmthItem = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasFeaturedWarmth));
        }
    }

    public bool HasFeaturedWarmth => _featuredWarmthItem != null;
    public bool HasLogs => _repo.GetAllLogs().Count > 0;
    public bool IsHomeEmpty => _repo.GetAllLogs().Count == 0;
    public string HomeDynamicHeadingTitle => HasLogs ? _strings.HomeHeadingTitle : _strings.HomeEmptyHeadingTitle;
    public bool HasTimelineItems => TimelineMonthGroups.Count > 0;
    public bool IsTimelineEmpty => TimelineMonthGroups.Count == 0;
    public bool ShowStarterPanel => _repo.GetAllLogs().Count < 3;
    public bool ShowMigrationBanner => IsHomeEmpty && !_settings.HasDismissedMigrationBanner && !_settings.HasCompletedBrowserHandoff;
    public bool HasBookLogs => _repo.GetAllLogs().Any(l => l.Title.Type.IsBook());

    public WatchReminderCandidate? ActiveWatchBanner
    {
        get => _activeWatchBanner;
        set
        {
            _activeWatchBanner = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasActiveWatchBanner));
            OnPropertyChanged(nameof(ActiveWatchBannerText));
        }
    }

    public bool HasActiveWatchBanner => _activeWatchBanner != null;
    public string ActiveWatchBannerText => _activeWatchBanner == null
        ? string.Empty
        : $"방금 {WatchReminderEngine.GetKoreanPlatformName(_activeWatchBanner.PlatformName)}에서 {_activeWatchBanner.DurationMinutes}분 이상 시청하셨나요? 잊기 전에 타임라인에 남겨보세요.";

    // Timeline properties
    public string TimelineHeadingTitle =>
        string.IsNullOrWhiteSpace(_settings.DisplayName) || _settings.DisplayName == "나의 기록실"
            ? (IsEnglishLocale ? "My Timeline" : "내 타임라인")
            : (IsEnglishLocale ? $"{_settings.DisplayName}’s timeline" : $"{_settings.DisplayName}의 타임라인");

    public string FutureButtonLabel =>
        string.IsNullOrWhiteSpace(_settings.DisplayName) || _settings.DisplayName == "나의 기록실"
            ? (IsEnglishLocale ? "✨ My future?" : "✨ 내 미래는?")
            : (IsEnglishLocale ? $"✨ {_settings.DisplayName}’s future?" : $"✨ {_settings.DisplayName}의 미래는?");

    public string TimelineSearchQuery
    {
        get => _timelineSearchQuery;
        set
        {
            if (_timelineSearchQuery == value) return;
            _timelineSearchQuery = value;
            OnPropertyChanged();
            RefreshTimelineItems();
        }
    }

    public ContentFilter TimelineContentFilter
    {
        get => _timelineContentFilter;
        set
        {
            if (_timelineContentFilter == value) return;
            _timelineContentFilter = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsTimelineFilterAll));
            OnPropertyChanged(nameof(IsTimelineFilterVideo));
            OnPropertyChanged(nameof(IsTimelineFilterBook));
            RefreshTimelineItems();
            RebuildVisibleRecommendations();
        }
    }

    public bool IsTimelineFilterAll => _timelineContentFilter == ContentFilter.ALL;
    public bool IsTimelineFilterVideo => _timelineContentFilter == ContentFilter.VIDEO;
    public bool IsTimelineFilterBook => _timelineContentFilter == ContentFilter.BOOK;

    public int TimelineStatusComboIndex
    {
        get => _timelineStatusFilter switch
        {
            LogStatus.DONE => 1,
            LogStatus.IN_PROGRESS => 2,
            LogStatus.WISHLIST => 3,
            _ => 0
        };
        set
        {
            _timelineStatusFilter = value switch
            {
                1 => LogStatus.DONE,
                2 => LogStatus.IN_PROGRESS,
                3 => LogStatus.WISHLIST,
                _ => null
            };
            OnPropertyChanged();
            RefreshTimelineItems();
        }
    }

    public int TimelinePlatformComboIndex
    {
        get
        {
            var platforms = TimelinePlatformComboOptions;
            if (string.IsNullOrWhiteSpace(_timelinePlatformFilter)) return 0;
            var idx = Array.IndexOf(platforms, _timelinePlatformFilter);
            return idx >= 0 ? idx : 0;
        }
        set
        {
            var platforms = TimelinePlatformComboOptions;
            _timelinePlatformFilter = (value <= 0 || value >= platforms.Length) ? null : platforms[value];
            OnPropertyChanged();
            RefreshTimelineItems();
        }
    }

    public string[] TimelinePlatformComboOptions => IsEnglishLocale
        ? new[] { "All", "Netflix", "Disney+", "TVING", "Wavve", "Coupang Play", "Apple TV+", "Prime Video", "Watcha", "Channel", "VOD", "DVD", "Blu-ray", "CGV", "Lotte Cinema", "Megabox", "Cine Q", "Amazon", "Bookshop.org", "Local bookstore", "Kindle", "Apple Books", "Google Play Books", "Kobo", "Audible", "Libby", "Public Library", "University Library", "School Library" }
        : new[] { "전체", "넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠", "채널", "VOD", "DVD", "블루레이", "CGV", "롯데시네마", "메가박스", "씨네Q", "교보문고", "영풍문고", "예스24", "알라딘", "리디", "밀리의서재", "윌라", "플레이북", "공공도서관", "대학도서관", "학교도서관" };

    public int TimelinePlaceComboIndex
    {
        get
        {
            var places = TimelinePlaceComboOptions;
            var targetWire = OttlinePresets.ToPlaceWire(_timelinePlaceFilter);
            if (string.IsNullOrWhiteSpace(targetWire)) return 0;
            for (var i = 1; i < places.Length; i++)
            {
                if (string.Equals(OttlinePresets.ToPlaceWire(places[i]), targetWire, StringComparison.OrdinalIgnoreCase))
                {
                    return i;
                }
            }
            return 0;
        }
        set
        {
            var places = TimelinePlaceComboOptions;
            _timelinePlaceFilter = (value <= 0 || value >= places.Length) ? null : OttlinePresets.ToPlaceWire(places[value]);
            OnPropertyChanged();
            RefreshTimelineItems();
        }
    }

    public string[] TimelinePlaceComboOptions => IsEnglishLocale
        ? new[] { "Every place", "Home", "Theater", "Transit", "Cafe", "Office", "Library", "Bookstore", "School", "Park", "Outdoor", "Etc" }
        : new[] { "모든 장소", "집", "극장", "이동 중", "카페", "직장", "도서관", "서점", "학교", "공원", "야외", "기타" };

    public int TimelineOccasionComboIndex
    {
        get
        {
            var occasions = TimelineOccasionComboOptions;
            var targetWire = OttlinePresets.ToOccasionWire(_timelineOccasionFilter);
            if (string.IsNullOrWhiteSpace(targetWire)) return 0;
            for (var i = 1; i < occasions.Length; i++)
            {
                if (string.Equals(OttlinePresets.ToOccasionWire(occasions[i]), targetWire, StringComparison.OrdinalIgnoreCase))
                {
                    return i;
                }
            }
            return 0;
        }
        set
        {
            var occasions = TimelineOccasionComboOptions;
            _timelineOccasionFilter = (value <= 0 || value >= occasions.Length) ? null : OttlinePresets.ToOccasionWire(occasions[value]);
            OnPropertyChanged();
            RefreshTimelineItems();
        }
    }

    public string[] TimelineOccasionComboOptions => IsEnglishLocale
        ? new[] { "Every occasion", "Alone", "Date", "Family", "Friends", "Break", "Etc" }
        : new[] { "모든 상황", "혼자", "데이트", "가족", "친구", "휴식", "기타" };

    public int TimelineOriginComboIndex
    {
        get
        {
            if (_timelineFeelingFilter == RecordFeeling.SATISFIED) return 1;
            if (_timelineFeelingFilter == RecordFeeling.NEUTRAL) return 2;
            if (_timelineFeelingFilter == RecordFeeling.DISAPPOINTED) return 3;
            if (_timelineOriginFilter == "LOG") return 4;
            if (_timelineOriginFilter == "REACTION") return 5;
            return 0;
        }
        set
        {
            _timelineFeelingFilter = null;
            _timelineOriginFilter = "ALL";
            switch (value)
            {
                case 1: _timelineFeelingFilter = RecordFeeling.SATISFIED; break;
                case 2: _timelineFeelingFilter = RecordFeeling.NEUTRAL; break;
                case 3: _timelineFeelingFilter = RecordFeeling.DISAPPOINTED; break;
                case 4: _timelineOriginFilter = "LOG"; break;
                case 5: _timelineOriginFilter = "REACTION"; break;
            }
            OnPropertyChanged();
            RefreshTimelineItems();
        }
    }

    public bool IsMomentFilterOpen
    {
        get => _isMomentFilterOpen;
        set { _isMomentFilterOpen = value; OnPropertyChanged(); }
    }

    public bool IsRecommendationsOpen
    {
        get => _isRecommendationsOpen;
        set
        {
            if (_isRecommendationsOpen == value) return;
            _isRecommendationsOpen = value;
            OnPropertyChanged();
            if (value)
            {
                _ = LoadRecommendationsAsync(forceRefresh: false);
            }
        }
    }

    public bool IsRecommendationsLoading
    {
        get => _isRecommendationsLoading;
        private set
        {
            if (_isRecommendationsLoading == value) return;
            _isRecommendationsLoading = value;
            NotifyRecommendationPropertiesChanged();
        }
    }

    public bool HasRecommendations => Recommendations.Count > 0;

    public bool HasRecommendationError =>
        _recommendationErrorKind is RecommendationErrorKind.NotConnected
            or RecommendationErrorKind.LoadFailed
            or RecommendationErrorKind.GenerateFailed
            or RecommendationErrorKind.StillGenerating;

    public bool IsRecommendationQuotaExhausted =>
        _recommendationErrorKind == RecommendationErrorKind.LimitReached
        || (_recommendationState != null
            && _recommendationState.Eligible
            && _recommendationState.Quota.Remaining <= 0
            && !_recommendationState.Generating);

    public bool IsRecommendationsIneligible =>
        !_isRecommendationsLoading
        && !HasRecommendationError
        && _recommendationState != null
        && !_recommendationState.Eligible;

    public bool IsRecommendationsEmptyFiltered =>
        !_isRecommendationsLoading
        && !HasRecommendationError
        && _recommendationState != null
        && _recommendationState.Eligible
        && _recommendationState.HasBatch
        && Recommendations.Count == 0;

    public string RecommendationQuotaText
    {
        get
        {
            if (_recommendationState == null)
            {
                return _recommendationErrorKind == RecommendationErrorKind.LimitReached
                    ? _strings.TimelineRecsQuotaExhausted
                    : string.Empty;
            }
            if (!_recommendationState.Eligible) return string.Empty;
            if (_recommendationState.Quota.Remaining <= 0 || _recommendationErrorKind == RecommendationErrorKind.LimitReached)
            {
                return _strings.TimelineRecsQuotaExhausted;
            }
            return _strings.FormatRecommendationQuotaRemaining(_recommendationState.Quota.Remaining);
        }
    }

    public bool HasRecommendationQuotaText => !string.IsNullOrWhiteSpace(RecommendationQuotaText);

    public string RecommendationLoadingMessage => HasRecommendations
        ? _strings.TimelineRecsRefreshingKeepExisting
        : _strings.TimelineRecsLoading;

    public string RecommendationErrorMessage => _recommendationErrorKind switch
    {
        RecommendationErrorKind.NotConnected => _strings.TimelineRecsNotConnected,
        RecommendationErrorKind.LoadFailed => _strings.TimelineRecsLoadError,
        RecommendationErrorKind.StillGenerating => _strings.TimelineRecsStillGenerating,
        RecommendationErrorKind.GenerateFailed => HasRecommendations
            ? _strings.TimelineRecsGenerateErrorKeepExisting
            : _strings.TimelineRecsGenerateError,
        _ => string.Empty
    };

    public bool CanRetryRecommendations =>
        !_isRecommendationsLoading
        && _recommendationErrorKind is RecommendationErrorKind.LoadFailed
            or RecommendationErrorKind.GenerateFailed
            or RecommendationErrorKind.StillGenerating;

    public bool CanRefreshRecommendations =>
        !_isRecommendationsLoading
        && _recommendationErrorKind != RecommendationErrorKind.NotConnected
        && !IsRecommendationQuotaExhausted
        && (_recommendationState == null
            || (_recommendationState.Eligible
                && !_recommendationState.Generating
                && (_recommendationState.Quota.Remaining > 0
                    || _repo.GetPendingRecommendationAttempt() != null)));

    public bool CanClickRecommendationAction =>
        !_isRecommendationsLoading && (CanRetryRecommendations || CanRefreshRecommendations);

    public string RecommendationActionButtonLabel
    {
        get
        {
            if (_isRecommendationsLoading) return _strings.TimelineRecsFindingButton;
            if (CanRetryRecommendations) return _strings.TimelineRecsRetryButton;
            return _strings.TimelineRecsRefresh;
        }
    }

    public string ActiveTimelineFilterSummary
    {
        get
        {
            var hasActiveFilter =
                _timelineContentFilter != ContentFilter.ALL ||
                _timelineStatusFilter.HasValue ||
                _timelineFeelingFilter.HasValue ||
                !string.IsNullOrWhiteSpace(_timelinePlaceFilter) ||
                !string.IsNullOrWhiteSpace(_timelineOccasionFilter) ||
                !string.IsNullOrWhiteSpace(_timelinePlatformFilter) ||
                _timelineOriginFilter != "ALL" ||
                !string.IsNullOrWhiteSpace(_timelineSearchQuery);

            if (hasActiveFilter)
            {
                return IsEnglishLocale
                    ? "Showing the records that match your choices."
                    : "고른 조건에 맞는 기록을 펼쳤어요.";
            }

            return IsEnglishLocale
                ? $"{TimelineItems.Count} {(TimelineItems.Count == 1 ? "record" : "records")}"
                : $"{TimelineItems.Count}개";
        }
    }

    // Share Sheet Modal state (ShareBottomSheet.tsx parity)
    private bool _isShareSheetOpen;
    private WatchLog? _shareSheetLog;
    private bool _shareShowRating = true;
    private bool _shareShowNote = true;
    private bool _shareShowSignature;
    private string _shareFormat = "story";
    private System.Windows.Media.ImageSource? _sharePreviewImage;

    public bool IsShareSheetOpen
    {
        get => _isShareSheetOpen;
        set { _isShareSheetOpen = value; OnPropertyChanged(); }
    }

    public WatchLog? ShareSheetLog => _shareSheetLog;

    public bool ShareShowRating
    {
        get => _shareShowRating;
        set
        {
            if (_shareShowRating == value) return;
            _shareShowRating = value;
            OnPropertyChanged();
            RebuildSharePreview();
        }
    }

    public bool ShareShowNote
    {
        get => _shareShowNote;
        set
        {
            if (_shareShowNote == value) return;
            _shareShowNote = value;
            OnPropertyChanged();
            RebuildSharePreview();
        }
    }

    public bool ShareShowSignature
    {
        get => _shareShowSignature;
        set
        {
            if (_shareShowSignature == value) return;
            _shareShowSignature = value;
            OnPropertyChanged();
            RebuildSharePreview();
        }
    }

    public string ShareFormat
    {
        get => _shareFormat;
        set
        {
            if (_shareFormat == value) return;
            _shareFormat = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(ShareSizeLabel));
            RebuildSharePreview();
        }
    }

    public string ShareSizeLabel =>
        string.Equals(_shareFormat, "feed", StringComparison.OrdinalIgnoreCase)
            ? (IsEnglishLocale ? "Image size: 1080×1350" : "이미지 크기: 1080×1350")
            : (IsEnglishLocale ? "Image size: 1080×1920" : "이미지 크기: 1080×1920");

    public System.Windows.Media.ImageSource? SharePreviewImage
    {
        get => _sharePreviewImage;
        private set { _sharePreviewImage = value; OnPropertyChanged(); }
    }

    public Services.ShareCardOptions CurrentShareCardOptions => new(
        Format: _shareFormat,
        ShowRatingLabel: _shareShowRating,
        ShowNote: _shareShowNote,
        ShowProfileSignature: _shareShowSignature
    );

    public void OpenShareSheet(WatchLog log)
    {
        var latestLog = _repo.GetLogByTitleId(log.TitleId) ?? log;
        _shareSheetLog = latestLog;
        _shareShowRating = true;
        _shareShowNote = !string.IsNullOrWhiteSpace(latestLog.Note);
        _shareShowSignature = false;
        _shareFormat = "story";
        OnPropertyChanged(nameof(ShareSheetLog));
        OnPropertyChanged(nameof(ShareShowRating));
        OnPropertyChanged(nameof(ShareShowNote));
        OnPropertyChanged(nameof(ShareShowSignature));
        OnPropertyChanged(nameof(ShareFormat));
        OnPropertyChanged(nameof(ShareSizeLabel));
        RebuildSharePreview();
        IsShareSheetOpen = true;

        _ = Task.Run(async () =>
        {
            var resolvedLog = latestLog;
            if (string.IsNullOrWhiteSpace(resolvedLog.Title.PosterUrl))
            {
                try
                {
                    var filter = resolvedLog.Title.Type.IsBook() ? ContentFilter.BOOK : ContentFilter.VIDEO;
                    var results = await _repo.Api.SearchTitlesAsync(resolvedLog.Title.Title, filter).ConfigureAwait(false);
                    var match = results.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.PosterUrl));
                    if (match != null)
                    {
                        var updatedTitle = resolvedLog.Title with { PosterUrl = match.PosterUrl };
                        _repo.Database.UpsertTitle(updatedTitle);
                        resolvedLog = resolvedLog with { Title = updatedTitle };
                    }
                }
                catch
                {
                    // Ignore search failures while opening share sheet
                }
            }

            await Services.CardImageExporter.EnsurePosterCachedForShareAsync(resolvedLog.Title.PosterUrl).ConfigureAwait(false);
            System.Windows.Application.Current?.Dispatcher.Invoke(() =>
            {
                if (_shareSheetLog?.Id == resolvedLog.Id)
                {
                    _shareSheetLog = resolvedLog;
                    OnPropertyChanged(nameof(ShareSheetLog));
                    RebuildSharePreview();
                }
            });
        });
    }

    public void RebuildSharePreview()
    {
        if (_shareSheetLog == null)
        {
            SharePreviewImage = null;
            return;
        }
        SharePreviewImage = Services.CardImageExporter.RenderShareCardBitmap(
            _shareSheetLog,
            _settings,
            CurrentShareCardOptions,
            _settings.Locale
        );
    }

    // Title Detail properties
    public bool IsTitleDetailOpen
    {
        get => _isTitleDetailOpen;
        set { _isTitleDetailOpen = value; OnPropertyChanged(); }
    }

    public WatchLog? SelectedDetailLog
    {
        get => _selectedDetailLog;
        private set
        {
            _selectedDetailLog = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(SelectedDetailMomentSummary));
            OnPropertyChanged(nameof(SelectedDetailFeelingBadge));
            OnPropertyChanged(nameof(SelectedDetailNoteText));
            OnPropertyChanged(nameof(SelectedDetailMetaLine));
            OnPropertyChanged(nameof(SelectedDetailWhenText));
            OnPropertyChanged(nameof(SelectedDetailPlatformText));
            OnPropertyChanged(nameof(SelectedDetailPlaceText));
            OnPropertyChanged(nameof(SelectedDetailOccasionText));
        }
    }

    public string SelectedDetailMomentSummary =>
        _selectedDetailLog == null ? string.Empty : TimelineMoments.FormatMomentSummary(_selectedDetailLog, _settings.Locale);

    public string SelectedDetailFeelingBadge =>
        _selectedDetailLog == null ? string.Empty : RecordFeelings.GetFeelingBadgeText(_selectedDetailLog, _settings.Locale);

    public string SelectedDetailWhenText =>
        _selectedDetailLog == null ? "-" : RecordDate.OccurredAtToWatchedOnDate(_selectedDetailLog.OccurredAt, _selectedDetailLog.WatchedOn);

    public string SelectedDetailPlatformText =>
        _selectedDetailLog == null || string.IsNullOrWhiteSpace(_selectedDetailLog.Ott) ? "-" : _selectedDetailLog.Ott!;

    public string SelectedDetailPlaceText =>
        _selectedDetailLog == null || string.IsNullOrWhiteSpace(_selectedDetailLog.Place)
            ? "-"
            : OttlinePresets.FormatPlace(_selectedDetailLog.Place, _settings.Locale);

    public string SelectedDetailOccasionText =>
        _selectedDetailLog == null || string.IsNullOrWhiteSpace(_selectedDetailLog.Occasion)
            ? "-"
            : OttlinePresets.FormatOccasion(_selectedDetailLog.Occasion, _settings.Locale);

    public string SelectedDetailMetaLine
    {
        get
        {
            if (_selectedDetailLog == null) return string.Empty;
            var t = _selectedDetailLog.Title;
            var typeStr = t.Type.IsBook()
                ? (IsEnglishLocale ? "Book" : "책")
                : (t.Type == TitleType.series
                    ? (IsEnglishLocale ? "Series" : "시리즈")
                    : (IsEnglishLocale ? "Movie" : "영화"));
            var parts = new List<string> { typeStr };
            if (t.Year.HasValue) parts.Add(t.Year.Value.ToString());
            if (t.SafeAuthors.Count > 0) parts.Add(string.Join(", ", t.SafeAuthors));
            if (!string.IsNullOrWhiteSpace(t.Publisher)) parts.Add(t.Publisher);
            if (!string.IsNullOrWhiteSpace(t.Isbn13)) parts.Add($"ISBN {t.Isbn13}");
            return string.Join(" · ", parts);
        }
    }

    public string SelectedDetailNoteText
    {
        get
        {
            if (_selectedDetailLog == null) return string.Empty;
            if (_selectedDetailLog.Spoiler && !_isDetailSpoilerRevealed)
            {
                return IsEnglishLocale
                    ? "🔒 Contains spoilers"
                    : "🔒 스포일러 포함";
            }
            return string.IsNullOrWhiteSpace(_selectedDetailLog.Note)
                ? (IsEnglishLocale
                    ? "No note saved yet."
                    : "남겨둔 한 줄 메모가 없습니다.")
                : _selectedDetailLog.Note!;
        }
    }

    // Quick Record Modal properties
    public bool IsQuickRecordOpen
    {
        get => _isQuickRecordOpen;
        set { _isQuickRecordOpen = value; OnPropertyChanged(); }
    }

    public QuickRecordStage QuickStage
    {
        get => _quickRecordStage;
        set
        {
            _quickRecordStage = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsQuickSearchStage));
            OnPropertyChanged(nameof(IsQuickFormStage));
            OnPropertyChanged(nameof(IsQuickSavedStage));
        }
    }

    public bool IsQuickSearchStage => _quickRecordStage == QuickRecordStage.SEARCH;
    public bool IsQuickFormStage => _quickRecordStage == QuickRecordStage.FORM;
    public bool IsQuickSavedStage => _quickRecordStage == QuickRecordStage.SAVED;

    public string QuickSearchQuery
    {
        get => _quickSearchQuery;
        set
        {
            if (_quickSearchQuery == value) return;
            _quickSearchQuery = value;
            OnPropertyChanged();
            TriggerDebouncedTitleSearch();
        }
    }

    public ContentFilter QuickSearchFilter
    {
        get => _quickSearchFilter;
        set
        {
            if (_quickSearchFilter == value) return;
            _quickSearchFilter = value;
            OnPropertyChanged();
            TriggerDebouncedTitleSearch();
        }
    }

    public TitleSummary? QuickSelectedTitle
    {
        get => _quickSelectedTitle;
        set
        {
            _quickSelectedTitle = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsQuickSelectedSeries));
            RebuildQuickPresetChips();
            OnPropertyChanged(nameof(QuickPlaceComboOptions));
            OnPropertyChanged(nameof(QuickPlaceComboIndex));
            OnPropertyChanged(nameof(QuickOccasionComboOptions));
            OnPropertyChanged(nameof(QuickOccasionComboIndex));
        }
    }

    public bool IsQuickSelectedSeries => _quickSelectedTitle?.Type == TitleType.series;

    public LogStatus QuickStatus
    {
        get => _quickStatus;
        set { _quickStatus = value; OnPropertyChanged(); }
    }

    public RecordFeeling? QuickFeeling
    {
        get => _quickFeeling;
        set { _quickFeeling = value; OnPropertyChanged(); }
    }

    public string QuickWatchedOn
    {
        get => _quickWatchedOn;
        set { _quickWatchedOn = value; OnPropertyChanged(); }
    }

    public string QuickPlatform
    {
        get => _quickPlatform;
        set { _quickPlatform = value; OnPropertyChanged(); }
    }

    public string QuickPlace
    {
        get => _quickPlace;
        set
        {
            _quickPlace = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(QuickPlaceComboIndex));
        }
    }

    public string[] QuickPlaceComboOptions
    {
        get
        {
            var isBook = _quickSelectedTitle?.Type == TitleType.book;
            var presets = OttlinePresets.GetPlacePresetsForType(isBook, _settings.Locale);
            var result = new string[presets.Count + 1];
            result[0] = IsEnglishLocale ? "None" : "선택 안 함";
            for (var i = 0; i < presets.Count; i++) result[i + 1] = presets[i];
            return result;
        }
    }

    public int QuickPlaceComboIndex
    {
        get
        {
            var options = QuickPlaceComboOptions;
            var targetWire = OttlinePresets.ToPlaceWire(_quickPlace);
            if (string.IsNullOrWhiteSpace(targetWire)) return 0;
            for (var i = 1; i < options.Length; i++)
            {
                if (string.Equals(OttlinePresets.ToPlaceWire(options[i]), targetWire, StringComparison.OrdinalIgnoreCase))
                {
                    return i;
                }
            }
            return 0;
        }
        set
        {
            var options = QuickPlaceComboOptions;
            QuickPlace = (value <= 0 || value >= options.Length) ? string.Empty : options[value];
        }
    }

    public string QuickOccasion
    {
        get => _quickOccasion;
        set
        {
            _quickOccasion = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(QuickOccasionComboIndex));
        }
    }

    public string[] QuickOccasionComboOptions
    {
        get
        {
            var presets = OttlinePresets.GetOccasionPresets(_settings.Locale);
            var result = new string[presets.Count + 1];
            result[0] = IsEnglishLocale ? "None" : "선택 안 함";
            for (var i = 0; i < presets.Count; i++) result[i + 1] = presets[i];
            return result;
        }
    }

    public int QuickOccasionComboIndex
    {
        get
        {
            var options = QuickOccasionComboOptions;
            var targetWire = OttlinePresets.ToOccasionWire(_quickOccasion);
            if (string.IsNullOrWhiteSpace(targetWire)) return 0;
            for (var i = 1; i < options.Length; i++)
            {
                if (string.Equals(OttlinePresets.ToOccasionWire(options[i]), targetWire, StringComparison.OrdinalIgnoreCase))
                {
                    return i;
                }
            }
            return 0;
        }
        set
        {
            var options = QuickOccasionComboOptions;
            QuickOccasion = (value <= 0 || value >= options.Length) ? string.Empty : options[value];
        }
    }

    public string QuickSeasonText
    {
        get => _quickSeasonText;
        set { _quickSeasonText = value; OnPropertyChanged(); }
    }

    public string QuickEpisodeText
    {
        get => _quickEpisodeText;
        set { _quickEpisodeText = value; OnPropertyChanged(); }
    }

    public string QuickNote
    {
        get => _quickNote;
        set { _quickNote = value; OnPropertyChanged(); }
    }

    public bool QuickSpoiler
    {
        get => _quickSpoiler;
        set { _quickSpoiler = value; OnPropertyChanged(); }
    }

    public bool QuickShareTogether
    {
        get => _quickShareTogether;
        set { _quickShareTogether = value; OnPropertyChanged(); }
    }

    public WatchLog? QuickLastSavedLog
    {
        get => _quickLastSavedLog;
        private set { _quickLastSavedLog = value; OnPropertyChanged(); }
    }

    public string ManualTitleInput
    {
        get => _manualTitleInput;
        set { _manualTitleInput = value; OnPropertyChanged(); }
    }

    public string ManualAuthorOrYearInput
    {
        get => _manualAuthorOrYearInput;
        set { _manualAuthorOrYearInput = value; OnPropertyChanged(); }
    }

    public string ManualIsbnInput
    {
        get => _manualIsbnInput;
        set { _manualIsbnInput = value; OnPropertyChanged(); }
    }

    // Together properties
    public string TogetherSearchQuery
    {
        get => _together.SearchQuery;
        set
        {
            var normalized = value ?? string.Empty;
            if (string.Equals(_together.SearchQuery, normalized, StringComparison.Ordinal)) return;
            _together.SetSearchQuery(normalized);
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasTogetherSearchQuery));
        }
    }

    public bool HasTogetherSearchQuery => !string.IsNullOrWhiteSpace(_together.SearchQuery);

    public DiscussionSort TogetherSort
    {
        get => _together.Sort;
        set
        {
            if (_together.Sort == value) return;
            _together.SetSort(value);
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsTogetherSortLatest));
            OnPropertyChanged(nameof(IsTogetherSortReactions));
            OnPropertyChanged(nameof(IsTogetherSortComments));
        }
    }

    public bool IsTogetherSortLatest => _together.Sort == DiscussionSort.LATEST;
    public bool IsTogetherSortReactions => _together.Sort == DiscussionSort.REACTIONS;
    public bool IsTogetherSortComments => _together.Sort == DiscussionSort.COMMENTS;

    public bool IsTogetherTwoPane => _together.IsTwoPane;
    public bool ShowTogetherListPane => _together.ShowListPane;
    public bool ShowTogetherDetailPane => _together.ShowDetailPane;
    public bool ShowTogetherBackButton => !_together.IsTwoPane && _together.IsNarrowDetailOpen;

    public System.Windows.GridLength TogetherListColumnWidth => _together.IsTwoPane
        ? new System.Windows.GridLength(360)
        : (_together.ShowListPane ? new System.Windows.GridLength(1, System.Windows.GridUnitType.Star) : new System.Windows.GridLength(0));

    public System.Windows.GridLength TogetherGapColumnWidth => _together.IsTwoPane
        ? new System.Windows.GridLength(24)
        : new System.Windows.GridLength(0);

    public System.Windows.GridLength TogetherDetailColumnWidth => _together.IsTwoPane || _together.ShowDetailPane
        ? new System.Windows.GridLength(1, System.Windows.GridUnitType.Star)
        : new System.Windows.GridLength(0);

    public bool IsTogetherListLoading
    {
        get => _isTogetherListLoading;
        private set
        {
            if (_isTogetherListLoading == value) return;
            _isTogetherListLoading = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(ShowTogetherListLoading));
            OnPropertyChanged(nameof(ShowTogetherEmptyState));
        }
    }

    public bool HasTogetherDiscussions => DiscussionItems.Count > 0;
    public bool ShowTogetherListLoading => _isTogetherListLoading && DiscussionItems.Count == 0;
    public bool ShowTogetherEmptyState => !_isTogetherListLoading && DiscussionItems.Count == 0;
    public string TogetherEmptyStateMessage => HasTogetherSearchQuery
        ? _strings.TogetherEmptySearchTitle
        : _strings.TogetherEmptyListTitle;

    public TogetherListItem? SelectedDiscussionListItem
    {
        get => _selectedDiscussionListItem;
        set
        {
            if (_isSyncingTogetherList) return;
            if (value == null) return;
            if (ReferenceEquals(_selectedDiscussionListItem, value) &&
                string.Equals(_together.SelectedPost?.Id, value.Id, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
            _selectedDiscussionListItem = value;
            OnPropertyChanged();
            _ = SelectDiscussionAsync(value.Post, openNarrowDetail: true, isExplicit: true);
        }
    }

    public DiscussionPost? SelectedDiscussionPost => _together.SelectedPost;
    public DiscussionDetail? SelectedDiscussionDetail => _together.SelectedDetail;
    public bool HasSelectedDiscussion => _together.SelectedPost != null;
    public bool ShowTogetherSelectPlaceholder => _together.SelectedPost == null;
    public bool IsSelectedDiscussionDetailLoading => _together.IsDetailLoading;
    public bool HasSelectedDiscussionDetailError => _together.HasDetailError && !_together.IsDetailLoading;
    public bool IsSelectedDiscussionCommentsEmpty =>
        HasSelectedDiscussion && !_together.IsDetailLoading && !_together.HasDetailError && SelectedDiscussionComments.Count == 0;

    public string SelectedDiscussionTypeAndYear
    {
        get
        {
            var post = _together.SelectedPost;
            if (post == null) return string.Empty;
            var typeLabel = FormatTitleTypeLabel(post.Title.Type);
            var parts = new List<string> { typeLabel };
            if (post.Title.Year.HasValue) parts.Add(post.Title.Year.Value.ToString());
            if (!string.IsNullOrWhiteSpace(post.CreatedAt)) parts.Add(post.CreatedAt);
            return string.Join(" · ", parts);
        }
    }

    public string SelectedDiscussionBody
    {
        get
        {
            var post = _together.SelectedPost;
            if (post == null) return string.Empty;
            return IsAutoGeneratedDiscussionSummary(post) ? string.Empty : post.Body.Trim();
        }
    }

    public bool HasSelectedDiscussionBody => !string.IsNullOrWhiteSpace(SelectedDiscussionBody);

    public bool SelectedDiscussionHasLocalLog =>
        _together.SelectedPost != null && _repo.GetLogByTitleId(_together.SelectedPost.Title.Id) != null;

    public string SelectedDiscussionCommentCountLabel =>
        IsEnglishLocale
            ? $"{SelectedDiscussionComments.Count}"
            : $"{SelectedDiscussionComments.Count}";

    public bool IsSelectedReactionDone => _together.ReactionState.HasReaction(DiscussionReactionType.DONE);
    public bool IsSelectedReactionCurious => _together.ReactionState.HasReaction(DiscussionReactionType.CURIOUS);
    public bool IsSelectedReactionSave => _together.ReactionState.HasReaction(DiscussionReactionType.SAVE);
    public bool CanToggleTogetherReaction => HasSelectedDiscussion && !_isTogetherReactionBusy;

    public string SelectedReactionDoneLabel
    {
        get
        {
            var isBook = _together.SelectedPost?.Title.Type.IsBook() == true;
            var baseLabel = isBook ? _strings.TogetherReactDoneBook : _strings.TogetherReactDone;
            var count = _together.ReactionState.Summary.DoneCount;
            return count > 0 ? $"{baseLabel} {count}" : baseLabel;
        }
    }

    public string SelectedReactionCuriousLabel
    {
        get
        {
            var count = _together.ReactionState.Summary.CuriousCount;
            return count > 0 ? $"{_strings.TogetherReactCurious} {count}" : _strings.TogetherReactCurious;
        }
    }

    public string SelectedReactionSaveLabel
    {
        get
        {
            var count = _together.ReactionState.Summary.SaveCount;
            return count > 0 ? $"{_strings.TogetherReactSave} {count}" : _strings.TogetherReactSave;
        }
    }

    public string NewCommentBody
    {
        get => _newCommentBody;
        set
        {
            if (_newCommentBody == value) return;
            _newCommentBody = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasNewCommentBody));
            OnPropertyChanged(nameof(CanSubmitComment));
        }
    }

    public bool HasNewCommentBody => !string.IsNullOrWhiteSpace(_newCommentBody);

    public bool NewCommentSyncLog
    {
        get => _newCommentSyncLog;
        set
        {
            if (_newCommentSyncLog == value) return;
            _newCommentSyncLog = value;
            OnPropertyChanged();
        }
    }

    public bool CanSubmitComment =>
        HasSelectedDiscussion && !string.IsNullOrWhiteSpace(_newCommentBody) && !_isSubmittingComment;

    public bool IsWriteDiscussionOpen
    {
        get => _isWriteDiscussionOpen;
        set { _isWriteDiscussionOpen = value; OnPropertyChanged(); }
    }

    public string NewDiscussionTitleQuery
    {
        get => _newDiscussionTitleQuery;
        set { _newDiscussionTitleQuery = value; OnPropertyChanged(); }
    }

    public string NewDiscussionBody
    {
        get => _newDiscussionBody;
        set { _newDiscussionBody = value; OnPropertyChanged(); }
    }

    public bool NewDiscussionSpoiler
    {
        get => _newDiscussionSpoiler;
        set { _newDiscussionSpoiler = value; OnPropertyChanged(); }
    }

    // My Space properties
    public bool IsProfileEditorOpen
    {
        get => _isProfileEditorOpen;
        set { _isProfileEditorOpen = value; OnPropertyChanged(); }
    }

    public string EditDisplayName
    {
        get => _editDisplayName;
        set { _editDisplayName = value; OnPropertyChanged(); }
    }

    public string EditHandle
    {
        get => _editHandle;
        set { _editHandle = value; OnPropertyChanged(); }
    }

    public string EditBio
    {
        get => _editBio;
        set { _editBio = value; OnPropertyChanged(); }
    }

    public string EditAvatarKey
    {
        get => _editAvatarKey;
        set
        {
            _editAvatarKey = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(CurrentAvatarImageUri));
            OnPropertyChanged(nameof(CurrentAvatarPersonaLabel));
            RebuildAvatarOptions();
        }
    }

    public string CurrentAvatarImageUri =>
        StorybookAvatarPresetExtensions.FromKey(_editAvatarKey).ResourcePath();

    public string CurrentAvatarPersonaLabel
    {
        get
        {
            var preset = StorybookAvatarPresetExtensions.FromKey(_editAvatarKey);
            return IsEnglishLocale
                ? $"{preset.LabelEn()} · {preset.SubtitleEn()}"
                : $"{preset.LabelKo()} · {preset.SubtitleKo()}";
        }
    }

    public string PersonalReportRhythmDisplay =>
        IsEnglishLocale ? _personalReport.RhythmSummaryEn : _personalReport.RhythmSummaryKo;

    public string DisplayRecoveryCode =>
        string.IsNullOrWhiteSpace(_settings.RecoveryCode) ? "OTTL-WIN2-NATIVE" : _settings.RecoveryCode!;

    public string PairCodeInput
    {
        get => _pairCodeInput;
        set { _pairCodeInput = value; OnPropertyChanged(); }
    }

    public PairPreviewResult? PairPreview
    {
        get => _pairPreview;
        private set
        {
            _pairPreview = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasPairPreview));
        }
    }

    public bool HasPairPreview => _pairPreview != null;
    public PersonalReportSummary PersonalReport => _personalReport;

    public string NewFeedbackCategory
    {
        get => _newFeedbackCategory;
        set
        {
            _newFeedbackCategory = Ottline.Core.Remote.OttlineApiClient.NormalizeFeedbackCategory(value);
            OnPropertyChanged();
            OnPropertyChanged(nameof(FeedbackCategoryComboIndex));
        }
    }

    public string[] FeedbackCategoryComboOptions => IsEnglishLocale
        ? new[] { "Question", "Bug", "Idea", "Other" }
        : new[] { "질문", "버그", "제안", "기타" };

    public int FeedbackCategoryComboIndex
    {
        get => _newFeedbackCategory switch
        {
            "BUG" => 1,
            "IDEA" => 2,
            "OTHER" => 3,
            _ => 0
        };
        set
        {
            _newFeedbackCategory = value switch
            {
                1 => "BUG",
                2 => "IDEA",
                3 => "OTHER",
                _ => "QUESTION"
            };
            OnPropertyChanged();
            OnPropertyChanged(nameof(NewFeedbackCategory));
        }
    }

    public string NewFeedbackSubject
    {
        get => _newFeedbackSubject;
        set { _newFeedbackSubject = value; OnPropertyChanged(); }
    }

    public string NewFeedbackBody
    {
        get => _newFeedbackBody;
        set { _newFeedbackBody = value; OnPropertyChanged(); }
    }

    public FeedbackThread? SelectedFeedbackThread
    {
        get => _selectedFeedbackThread;
        set
        {
            _selectedFeedbackThread = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(HasSelectedFeedbackThread));
            OnPropertyChanged(nameof(IsSelectedFeedbackThreadEmpty));
        }
    }

    public bool HasSelectedFeedbackThread => _selectedFeedbackThread != null;
    public bool IsSelectedFeedbackThreadEmpty => _selectedFeedbackThread == null;
    public bool IsFeedbackThreadsEmpty => FeedbackThreads.Count == 0;

    public bool HasConnectedServerAccount =>
        Guid.TryParse(_settings.UserId, out _)
        && (Guid.TryParse(_settings.DeviceId, out _) || Guid.TryParse(_settings.AuthToken, out _));

    public bool IsDeletingServerAccount
    {
        get => _isDeletingServerAccount;
        private set
        {
            if (_isDeletingServerAccount == value) return;
            _isDeletingServerAccount = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(CanDeleteServerAccount));
            OnPropertyChanged(nameof(DeleteAccountButtonLabel));
        }
    }

    public bool CanDeleteServerAccount => HasConnectedServerAccount && !_isDeletingServerAccount;

    public string DeleteAccountButtonLabel => _isDeletingServerAccount
        ? _strings.DeleteAccountInProgressLabel
        : _strings.MySpaceDeleteAllAction;

    public OttlineWidgetSnapshot WidgetPreviewSnapshot => _widgetPreviewSnapshot;
    public bool IsWidgetPackageActive => Widgets.OttlineWidgetProvider.IsPackagedProcess();
    public bool ShowDeveloperServerSettings => string.Equals(Environment.GetEnvironmentVariable("OTTLINE_DEV"), "1", StringComparison.Ordinal);
    public string WidgetStatusBadgeText => IsWidgetPackageActive
        ? (IsEnglishLocale ? "Win + W Active" : "Win + W 연동 활성")
        : (IsEnglishLocale ? "Auto-registered via MSIX" : "MSIX 설치 시 Win + W 자동 등록");
    public string? WidgetPosterUrl => _widgetPreviewSnapshot.ContinueItem?.PosterUrl;
    public bool HasWidgetPoster => !string.IsNullOrWhiteSpace(WidgetPosterUrl);
    public string WidgetHeroEyebrow => _widgetPreviewSnapshot.ContinueItem is { } c
        ? (c.IsInProgress
            ? (IsEnglishLocale ? $"Continue · {c.StatusLabel}" : $"이어보는 작품 · {c.StatusLabel}")
            : (IsEnglishLocale ? $"Latest memory · {c.StatusLabel}" : $"최근 남긴 온기 · {c.StatusLabel}"))
        : (IsEnglishLocale ? "Ottline Widget" : "ottline 위젯");
    public string WidgetHeroTitle => _widgetPreviewSnapshot.ContinueItem?.TitleName
        ?? (IsEnglishLocale ? "Keep what you watch and read" : "보고 읽은 순간을 그날의 온기로");
    public string WidgetHeroMeta => _widgetPreviewSnapshot.ContinueItem?.MetaText ?? string.Empty;
    public bool HasWidgetHeroMeta => !string.IsNullOrWhiteSpace(WidgetHeroMeta);
    public string WidgetHeroNote => _widgetPreviewSnapshot.ContinueItem?.NoteSnippet
        ?? (IsEnglishLocale
            ? "Log a film, series, or book today with one click."
            : "오늘 본 영상이나 읽은 책을 한 번의 클릭으로 타임라인에 남겨보세요.");

    public void SelectHomeMonth(string monthKey)
    {
        if (string.IsNullOrWhiteSpace(monthKey)) return;
        _selectedHomeMonth = monthKey;
        RefreshLocalState();
    }

    public void RefreshLocalState()
    {
        _settings = _repo.GetSettings();
        _strings = OttlineStrings.ForLocale(_settings.Locale);
        if (!string.IsNullOrWhiteSpace(_recommendationScopeKey)
            && !string.Equals(_recommendationScopeKey, CurrentRecommendationScopeKey(), StringComparison.OrdinalIgnoreCase))
        {
            ResetRecommendationsForScopeChange();
        }
        if (!_isProfileEditorOpen)
        {
            _editDisplayName = _settings.DisplayName;
            _editAvatarKey = _settings.AvatarPreset;
        }

        var allLogs = _repo.GetAllLogs();
        _widgetPreviewSnapshot = OttlineWidgetSnapshotBuilder.BuildSnapshot(allLogs, _settings.Locale);
        var outboxCount = _repo.GetPendingOutboxCount();
        SyncStatusText = outboxCount > 0
            ? $"{_strings.SyncPendingLabel} ({outboxCount})"
            : _strings.SyncedLabel;

        // Build Home Month Groups (Col 1: 88px vertical month selector)
        var completedLogs = allLogs.Where(l => l.Status == LogStatus.DONE).ToList();
        var monthGroupsDict = completedLogs
            .GroupBy(l =>
            {
                var d = RecordDate.OccurredAtToWatchedOnDate(l.OccurredAt, l.WatchedOn);
                return d.Length >= 7 ? d[..7] : RecordDate.CurrentMonth();
            })
            .OrderByDescending(g => g.Key)
            .ToList();

        if (monthGroupsDict.Count > 0 && !monthGroupsDict.Any(g => g.Key == _selectedHomeMonth))
        {
            _selectedHomeMonth = monthGroupsDict[0].Key;
        }

        HomeMonthGroups.Clear();
        foreach (var g in monthGroupsDict)
        {
            var yearText = g.Key.Length >= 4 ? g.Key[..4] : "2026";
            var monthNum = (g.Key.Length >= 7 && int.TryParse(g.Key[5..7], out var m)) ? m : 1;
            var monthText = IsEnglishLocale
                ? new DateTime(2026, monthNum, 1).ToString("MMM", System.Globalization.CultureInfo.InvariantCulture)
                : $"{monthNum}월";
            HomeMonthGroups.Add(new HomeMonthButtonItem(
                Key: g.Key,
                YearText: yearText,
                MonthText: monthText,
                Count: g.Count(),
                IsSelected: g.Key == _selectedHomeMonth
            ));
        }

        // Selected Month Completed Items & Featured Card ("그날의 온기")
        var selectedMonthLogs = completedLogs
            .Where(l => RecordDate.OccurredAtToWatchedOnDate(l.OccurredAt, l.WatchedOn).StartsWith(_selectedHomeMonth, StringComparison.Ordinal))
            .OrderByDescending(l => RecordDate.OccurredAtToWatchedOnDate(l.OccurredAt, l.WatchedOn))
            .ToList();

        var featuredCandidate = selectedMonthLogs
            .FirstOrDefault(l => !string.IsNullOrWhiteSpace(l.Note) && !l.Spoiler)
            ?? selectedMonthLogs.FirstOrDefault()
            ?? completedLogs.FirstOrDefault()
            ?? allLogs.FirstOrDefault();

        FeaturedWarmthItem = featuredCandidate != null ? ToDisplayItem(featuredCandidate) : null;

        HomeMonthCompletedItems.Clear();
        foreach (var log in selectedMonthLogs.Where(l => l.Id != featuredCandidate?.Id).Take(6))
        {
            HomeMonthCompletedItems.Add(ToDisplayItem(log));
        }

        // Unfinished ("아직 못다 한 이야기" up to 4 in right 215px column)
        HomeUnfinishedItems.Clear();
        foreach (var item in allLogs.Where(l => l.Status == LogStatus.IN_PROGRESS).Take(4).Select(ToDisplayItem))
        {
            HomeUnfinishedItems.Add(item);
        }

        // Frequent Moments ("다시 만나는 그날" 2-column grid of Place/Occasion cards)
        var dims = TimelineMoments.ExtractFrequentDimensions(allLogs, 6, _settings.Locale);
        HomeFrequentPlaces.Clear();
        foreach (var p in dims.Places) HomeFrequentPlaces.Add(p.Value);
        HomeFrequentOccasions.Clear();
        foreach (var o in dims.Occasions) HomeFrequentOccasions.Add(o.Value);

        HomeMomentLinks.Clear();
        foreach (var p in dims.Places.Take(3))
        {
            HomeMomentLinks.Add(new HomeMomentLinkItem(
                Kind: "PLACE",
                Icon: "📍",
                Label: p.Value,
                CountText: IsEnglishLocale ? $"{p.Count} {(p.Count == 1 ? "record" : "records")}" : $"{p.Count}개",
                Value: p.Value
            ));
        }
        foreach (var o in dims.Occasions.Take(3))
        {
            HomeMomentLinks.Add(new HomeMomentLinkItem(
                Kind: "OCCASION",
                Icon: "👥",
                Label: o.Value,
                CountText: IsEnglishLocale ? $"{o.Count} {(o.Count == 1 ? "record" : "records")}" : $"{o.Count}개",
                Value: o.Value
            ));
        }

        if (_currentTab == MainTab.TIMELINE)
        {
            RefreshTimelineItems();
        }
        else
        {
            TimelineItems.Clear();
            TimelineMonthGroups.Clear();
        }

        if (_currentTab == MainTab.MY_SPACE)
        {
            EnsureMySpaceDataLoaded(allLogs);
        }

        if (_isShareSheetOpen)
        {
            RebuildSharePreview();
        }

        if (!string.IsNullOrWhiteSpace(_quickPlace))
        {
            _quickPlace = OttlinePresets.FormatPlace(_quickPlace, _settings.Locale);
        }
        if (!string.IsNullOrWhiteSpace(_quickOccasion))
        {
            _quickOccasion = OttlinePresets.FormatOccasion(_quickOccasion, _settings.Locale);
        }

        RebuildQuickPresetChips();

        OnPropertyChanged(nameof(Strings));
        OnPropertyChanged(nameof(Settings));
        OnPropertyChanged(nameof(IsKoreanLocale));
        OnPropertyChanged(nameof(IsEnglishLocale));
        OnPropertyChanged(nameof(IsThemeSystem));
        OnPropertyChanged(nameof(IsThemeLight));
        OnPropertyChanged(nameof(IsThemeDark));
        OnPropertyChanged(nameof(ThemeToggleToolTip));
        OnPropertyChanged(nameof(TodayDateDisplay));
        OnPropertyChanged(nameof(SelectedHomeMonthLabel));
        OnPropertyChanged(nameof(SelectedHomeMonthShort));
        OnPropertyChanged(nameof(SelectedHomeMonthCount));
        OnPropertyChanged(nameof(HasLogs));
        OnPropertyChanged(nameof(IsHomeEmpty));
        OnPropertyChanged(nameof(HomeDynamicHeadingTitle));
        OnPropertyChanged(nameof(HasTimelineItems));
        OnPropertyChanged(nameof(IsTimelineEmpty));
        OnPropertyChanged(nameof(ShowStarterPanel));
        OnPropertyChanged(nameof(ShowMigrationBanner));
        OnPropertyChanged(nameof(HasBookLogs));
        OnPropertyChanged(nameof(TimelineHeadingTitle));
        OnPropertyChanged(nameof(FutureButtonLabel));
        NotifyRecommendationPropertiesChanged();
        OnPropertyChanged(nameof(TimelinePlatformComboOptions));
        OnPropertyChanged(nameof(TimelinePlaceComboOptions));
        OnPropertyChanged(nameof(TimelinePlaceComboIndex));
        OnPropertyChanged(nameof(TimelineOccasionComboOptions));
        OnPropertyChanged(nameof(TimelineOccasionComboIndex));
        OnPropertyChanged(nameof(ActiveTimelineFilterSummary));
        NotifyTogetherPropertiesChanged();
        OnPropertyChanged(nameof(PersonalReport));
        OnPropertyChanged(nameof(PersonalReportRhythmDisplay));
        OnPropertyChanged(nameof(ShareSizeLabel));
        OnPropertyChanged(nameof(SelectedDetailMomentSummary));
        OnPropertyChanged(nameof(SelectedDetailFeelingBadge));
        OnPropertyChanged(nameof(SelectedDetailNoteText));
        OnPropertyChanged(nameof(SelectedDetailMetaLine));
        OnPropertyChanged(nameof(SelectedDetailWhenText));
        OnPropertyChanged(nameof(SelectedDetailPlatformText));
        OnPropertyChanged(nameof(SelectedDetailPlaceText));
        OnPropertyChanged(nameof(SelectedDetailOccasionText));
        OnPropertyChanged(nameof(QuickPlace));
        OnPropertyChanged(nameof(QuickOccasion));
        OnPropertyChanged(nameof(QuickPlaceComboOptions));
        OnPropertyChanged(nameof(QuickPlaceComboIndex));
        OnPropertyChanged(nameof(QuickOccasionComboOptions));
        OnPropertyChanged(nameof(QuickOccasionComboIndex));
        OnPropertyChanged(nameof(FeedbackCategoryComboOptions));
        OnPropertyChanged(nameof(FeedbackCategoryComboIndex));
        OnPropertyChanged(nameof(DisplayRecoveryCode));
        OnPropertyChanged(nameof(HasConnectedServerAccount));
        OnPropertyChanged(nameof(CanDeleteServerAccount));
        OnPropertyChanged(nameof(DeleteAccountButtonLabel));
        OnPropertyChanged(nameof(CurrentAvatarImageUri));
        OnPropertyChanged(nameof(CurrentAvatarPersonaLabel));
        OnPropertyChanged(nameof(EditDisplayName));
        OnPropertyChanged(nameof(EditAvatarKey));
        OnPropertyChanged(nameof(SplashEyebrowText));
        OnPropertyChanged(nameof(SplashMessageText));
        OnPropertyChanged(nameof(WidgetPreviewSnapshot));
        OnPropertyChanged(nameof(WidgetStatusBadgeText));
        OnPropertyChanged(nameof(WidgetPosterUrl));
        OnPropertyChanged(nameof(HasWidgetPoster));
        OnPropertyChanged(nameof(WidgetHeroEyebrow));
        OnPropertyChanged(nameof(WidgetHeroTitle));
        OnPropertyChanged(nameof(WidgetHeroMeta));
        OnPropertyChanged(nameof(HasWidgetHeroMeta));
        OnPropertyChanged(nameof(WidgetHeroNote));

        Widgets.OttlineWidgetProvider.RefreshAllWidgetsIfPackaged();
    }

    public void EnsureMySpaceDataLoaded(IReadOnlyList<WatchLog>? allLogs = null)
    {
        var logs = allLogs ?? _repo.GetAllLogs();
        RebuildAvatarOptions();
        _personalReport = PersonalReportBuilder.BuildReport(
            logs,
            _selectedReportPeriod == "ALL" ? null : _selectedReportPeriod,
            _settings.Locale
        );
        KdcShelves.Clear();
        foreach (var shelf in BookshelfBuilder.BuildKdcShelves(logs))
        {
            KdcShelves.Add(shelf);
        }
        OnPropertyChanged(nameof(PersonalReport));
    }

    public void RefreshTimelineItems()
    {
        var allLogs = _repo.GetAllLogs();
        var filtered = TimelineMoments.FilterLogs(
            allLogs,
            searchQuery: _timelineSearchQuery,
            contentFilter: _timelineContentFilter,
            statusFilter: _timelineStatusFilter,
            feelingFilter: _timelineFeelingFilter,
            placeFilter: _timelinePlaceFilter,
            occasionFilter: _timelineOccasionFilter,
            platformFilter: _timelinePlatformFilter
        );

        if (_timelineOriginFilter == "LOG")
        {
            filtered = filtered.Where(l => l.Origin != LogOrigin.REACTION).ToList();
        }
        else if (_timelineOriginFilter == "REACTION")
        {
            filtered = filtered.Where(l => l.Origin == LogOrigin.REACTION).ToList();
        }

        TimelineItems.Clear();
        foreach (var log in filtered)
        {
            TimelineItems.Add(ToDisplayItem(log));
        }

        TimelineMonthGroups.Clear();
        var grouped = TimelineItems
            .GroupBy(item =>
            {
                var d = RecordDate.OccurredAtToWatchedOnDate(item.Log.OccurredAt, item.Log.WatchedOn);
                return d.Length >= 7 ? d[..7] : RecordDate.CurrentMonth();
            })
            .OrderByDescending(g => g.Key);

        foreach (var g in grouped)
        {
            var monthLabel = RecordDate.FormatMonthLabel(g.Key, _settings.Locale);
            var obs = new ObservableCollection<WatchLogDisplayItem>(g);
            TimelineMonthGroups.Add(new TimelineMonthGroupItem(
                MonthKey: g.Key,
                MonthLabel: monthLabel,
                Count: obs.Count,
                Items: obs
            ));
        }

        OnPropertyChanged(nameof(ActiveTimelineFilterSummary));
        OnPropertyChanged(nameof(HasTimelineItems));
        OnPropertyChanged(nameof(IsTimelineEmpty));
    }

    public void ShiftHomeMonth(int delta)
    {
        _selectedHomeMonth = RecordDate.ShiftMonth(_selectedHomeMonth, delta);
        RefreshLocalState();
    }

    public void ApplyMomentQuickFilter(string? place = null, string? occasion = null, string? platform = null, RecordFeeling? feeling = null, LogStatus? status = null)
    {
        if (place != null)
        {
            var placeWire = OttlinePresets.ToPlaceWire(place);
            _timelinePlaceFilter = string.Equals(OttlinePresets.ToPlaceWire(_timelinePlaceFilter), placeWire, StringComparison.OrdinalIgnoreCase)
                ? null
                : placeWire;
        }
        if (occasion != null)
        {
            var occWire = OttlinePresets.ToOccasionWire(occasion);
            _timelineOccasionFilter = string.Equals(OttlinePresets.ToOccasionWire(_timelineOccasionFilter), occWire, StringComparison.OrdinalIgnoreCase)
                ? null
                : occWire;
        }
        if (platform != null) _timelinePlatformFilter = _timelinePlatformFilter == platform ? null : platform;
        if (feeling.HasValue) _timelineFeelingFilter = _timelineFeelingFilter == feeling ? null : feeling;
        if (status.HasValue) _timelineStatusFilter = _timelineStatusFilter == status ? null : status;

        OnPropertyChanged(nameof(TimelineStatusComboIndex));
        OnPropertyChanged(nameof(TimelinePlatformComboIndex));
        OnPropertyChanged(nameof(TimelinePlaceComboIndex));
        OnPropertyChanged(nameof(TimelineOccasionComboIndex));
        OnPropertyChanged(nameof(TimelineOriginComboIndex));

        CurrentTab = MainTab.TIMELINE;
        RefreshTimelineItems();
    }

    public void ClearTimelineFilters()
    {
        _timelineSearchQuery = string.Empty;
        _timelineContentFilter = ContentFilter.ALL;
        _timelineStatusFilter = null;
        _timelineFeelingFilter = null;
        _timelinePlaceFilter = null;
        _timelineOccasionFilter = null;
        _timelinePlatformFilter = null;
        _timelineOriginFilter = "ALL";
        OnPropertyChanged(nameof(TimelineSearchQuery));
        OnPropertyChanged(nameof(TimelineContentFilter));
        OnPropertyChanged(nameof(IsTimelineFilterAll));
        OnPropertyChanged(nameof(IsTimelineFilterVideo));
        OnPropertyChanged(nameof(IsTimelineFilterBook));
        OnPropertyChanged(nameof(TimelineStatusComboIndex));
        OnPropertyChanged(nameof(TimelinePlatformComboIndex));
        OnPropertyChanged(nameof(TimelinePlaceComboIndex));
        OnPropertyChanged(nameof(TimelineOccasionComboIndex));
        OnPropertyChanged(nameof(TimelineOriginComboIndex));
        RefreshTimelineItems();
    }

    public void OpenTitleDetail(WatchLog log)
    {
        _isDetailSpoilerRevealed = false;
        SelectedDetailLog = _repo.GetLogByTitleId(log.TitleId) ?? log;
        SelectedTitleHistory.Clear();
        foreach (var h in _repo.GetHistoryForTitle(log.TitleId))
        {
            SelectedTitleHistory.Add(h);
        }
        IsTitleDetailOpen = true;
    }

    public void ToggleDetailSpoiler()
    {
        _isDetailSpoilerRevealed = !_isDetailSpoilerRevealed;
        OnPropertyChanged(nameof(SelectedDetailNoteText));
    }

    public void OpenQuickRecordModal(
        TitleSummary? preselectedTitle = null,
        string? prefilledPlatform = null,
        string? prefilledQuery = null,
        ContentFilter? prefilledFilter = null,
        WatchLog? existingLogToEdit = null)
    {
        _manualTitleInput = string.Empty;
        _manualAuthorOrYearInput = string.Empty;
        _manualIsbnInput = string.Empty;

        if (existingLogToEdit != null)
        {
            QuickSelectedTitle = existingLogToEdit.Title;
            QuickStatus = existingLogToEdit.Status;
            QuickFeeling = RecordFeelings.ResolveRecordFeeling(existingLogToEdit.Rating, existingLogToEdit.Reaction);
            QuickWatchedOn = RecordDate.OccurredAtToWatchedOnDate(existingLogToEdit.OccurredAt, existingLogToEdit.WatchedOn);
            QuickPlatform = existingLogToEdit.Ott ?? string.Empty;
            QuickPlace = OttlinePresets.FormatPlace(existingLogToEdit.Place, _settings.Locale);
            QuickOccasion = OttlinePresets.FormatOccasion(existingLogToEdit.Occasion, _settings.Locale);
            QuickSeasonText = existingLogToEdit.SeasonNumber?.ToString() ?? string.Empty;
            QuickEpisodeText = existingLogToEdit.EpisodeNumber?.ToString() ?? string.Empty;
            QuickNote = existingLogToEdit.Note ?? string.Empty;
            QuickSpoiler = existingLogToEdit.Spoiler;
            QuickShareTogether = false;
            QuickStage = QuickRecordStage.FORM;
            IsQuickRecordOpen = true;
            return;
        }

        QuickStatus = LogStatus.DONE;
        QuickFeeling = RecordFeeling.SATISFIED;
        QuickWatchedOn = RecordDate.TodayDate();
        QuickPlatform = prefilledPlatform ?? string.Empty;
        QuickPlace = string.Empty;
        QuickOccasion = string.Empty;
        QuickSeasonText = string.Empty;
        QuickEpisodeText = string.Empty;
        QuickNote = string.Empty;
        QuickSpoiler = false;
        QuickShareTogether = false;

        if (prefilledFilter.HasValue)
        {
            _quickSearchFilter = prefilledFilter.Value;
            OnPropertyChanged(nameof(QuickSearchFilter));
        }

        if (preselectedTitle != null)
        {
            SelectTitleForQuickRecord(preselectedTitle);
        }
        else
        {
            QuickSelectedTitle = null;
            QuickSearchQuery = prefilledQuery ?? string.Empty;
            QuickStage = QuickRecordStage.SEARCH;
            TriggerDebouncedTitleSearch();
        }

        IsQuickRecordOpen = true;
    }

    public void SelectTitleForQuickRecord(TitleSummary title)
    {
        var existing = _repo.GetLogByTitleId(title.Id);
        QuickSelectedTitle = title;
        if (existing != null)
        {
            QuickStatus = existing.Status;
            QuickFeeling = RecordFeelings.ResolveRecordFeeling(existing.Rating, existing.Reaction) ?? RecordFeeling.SATISFIED;
            QuickWatchedOn = RecordDate.OccurredAtToWatchedOnDate(existing.OccurredAt, existing.WatchedOn);
            if (string.IsNullOrWhiteSpace(QuickPlatform)) QuickPlatform = existing.Ott ?? string.Empty;
            QuickPlace = OttlinePresets.FormatPlace(existing.Place, _settings.Locale);
            QuickOccasion = OttlinePresets.FormatOccasion(existing.Occasion, _settings.Locale);
            QuickSeasonText = existing.SeasonNumber?.ToString() ?? string.Empty;
            QuickEpisodeText = existing.EpisodeNumber?.ToString() ?? string.Empty;
            QuickNote = existing.Note ?? string.Empty;
            QuickSpoiler = existing.Spoiler;
        }
        else if (title.Type.IsBook() && string.IsNullOrWhiteSpace(QuickPlatform))
        {
            QuickPlatform = IsEnglishLocale ? "Print book" : "종이책";
        }
        QuickStage = QuickRecordStage.FORM;
    }

    public void CreateManualTitleForQuickRecord(bool isBook)
    {
        var titleName = string.IsNullOrWhiteSpace(_manualTitleInput) ? _quickSearchQuery : _manualTitleInput;
        if (string.IsNullOrWhiteSpace(titleName))
        {
            ShowToast("작품 제목을 입력해주세요.");
            return;
        }

        TitleSummary created;
        if (isBook)
        {
            created = TitleFallback.BuildManualBookMetadata(
                titleName,
                author: _manualAuthorOrYearInput,
                isbn: _manualIsbnInput
            );
        }
        else
        {
            int? year = int.TryParse(_manualAuthorOrYearInput, out var y) ? y : null;
            created = TitleFallback.BuildManualVideoMetadata(titleName, TitleType.movie, year);
        }

        SelectTitleForQuickRecord(created);
    }

    public WatchLog? CommitQuickRecord()
    {
        if (QuickSelectedTitle == null) return null;

        if (!RecordDate.IsValidDateInput(QuickWatchedOn))
        {
            ShowToast("날짜 형식을 확인해주세요 (YYYY-MM-DD 또는 YYYY-MM).");
            return null;
        }
        if (RecordDate.IsFutureDateInput(QuickWatchedOn))
        {
            ShowToast("미래 날짜로는 기록할 수 없습니다.");
            return null;
        }

        int? season = int.TryParse(QuickSeasonText, out var s) && s > 0 ? s : null;
        int? episode = int.TryParse(QuickEpisodeText, out var ep) && ep > 0 ? ep : null;

        var saved = _repo.SaveLogLocalFirst(
            title: QuickSelectedTitle,
            status: QuickStatus,
            feeling: QuickFeeling,
            watchedOnDate: QuickWatchedOn,
            ott: QuickPlatform,
            place: QuickPlace,
            occasion: QuickOccasion,
            seasonNumber: season,
            episodeNumber: episode,
            note: QuickNote,
            spoiler: QuickSpoiler,
            shareToTogether: QuickShareTogether
        );

        QuickLastSavedLog = saved;
        ActiveWatchBanner = null;
        QuickStage = QuickRecordStage.SAVED;
        RefreshLocalState();

        if (IsTitleDetailOpen && SelectedDetailLog?.TitleId == saved.TitleId)
        {
            OpenTitleDetail(saved);
        }

        _ = SyncNowAsync(silent: true);
        return saved;
    }

    public async Task SyncNowAsync(bool silent = false)
    {
        SyncStatusText = "동기화 중...";
        var (_, msg) = await _repo.SyncAllAsync();
        var syncedLogs = _repo.GetAllLogs();
        if (syncedLogs.Count > 0)
        {
            await UrlToImageSourceConverter.PrefetchUrlsAsync(
                syncedLogs.Take(16).Select(l => l.Title.PosterUrl),
                isHero: false
            );
            await UrlToImageSourceConverter.PrefetchUrlsAsync(
                syncedLogs.Take(2).Select(l => l.Title.PosterUrl),
                isHero: true
            );
        }
        RefreshLocalState();
        SyncStatusText = msg;
        if (!silent)
        {
            ShowToast(msg);
        }
    }

    public async Task HandleExternalUriOrShareAsync(string rawArg)
    {
        var parsed = ShareIntentParser.Parse(rawArg);
        if (parsed.IsSessionHandoff)
        {
            var (ok, msg) = await _repo.ImportBrowserHandoffAsync(parsed);
            if (ok)
            {
                var syncedLogs = _repo.GetAllLogs();
                if (syncedLogs.Count > 0)
                {
                    var latestDate = RecordDate.OccurredAtToWatchedOnDate(syncedLogs[0].OccurredAt, syncedLogs[0].WatchedOn);
                    if (latestDate.Length >= 7)
                    {
                        _selectedHomeMonth = latestDate[..7];
                    }

                    await UrlToImageSourceConverter.PrefetchUrlsAsync(
                        syncedLogs.Take(16).Select(l => l.Title.PosterUrl),
                        isHero: false
                    );
                    await UrlToImageSourceConverter.PrefetchUrlsAsync(
                        syncedLogs.Take(2).Select(l => l.Title.PosterUrl),
                        isHero: true
                    );
                }

                _ = EnrichMissingPostersAsync();
            }

            RefreshLocalState();
            RefreshTimelineItems();
            EnsureMySpaceDataLoaded();
            ShowToast(msg);
            return;
        }

        if (!string.IsNullOrWhiteSpace(parsed.OpenTitleId))
        {
            var existingLog = _repo.GetLogByTitleId(parsed.OpenTitleId);
            if (existingLog != null)
            {
                if (parsed.OpenQuickRecord || existingLog.Status == LogStatus.IN_PROGRESS)
                {
                    OpenQuickRecordModal(existingLogToEdit: existingLog);
                }
                else
                {
                    OpenTitleDetail(existingLog);
                }
            }
            else
            {
                OpenQuickRecordModal(prefilledFilter: parsed.InferredFilter);
            }
            return;
        }

        if (!string.IsNullOrWhiteSpace(parsed.OpenDiscussionId))
        {
            await OpenDiscussionByIdAsync(parsed.OpenDiscussionId);
            return;
        }

        if (string.Equals(parsed.OpenRoute, "together", StringComparison.OrdinalIgnoreCase))
        {
            CurrentTab = MainTab.TOGETHER;
            return;
        }

        if (string.Equals(parsed.OpenRoute, "timeline", StringComparison.OrdinalIgnoreCase))
        {
            CurrentTab = MainTab.TIMELINE;
            return;
        }

        if (parsed.OpenQuickRecord || !string.IsNullOrWhiteSpace(parsed.InferredPlatform) || !string.IsNullOrWhiteSpace(parsed.QueryTitle))
        {
            OpenQuickRecordModal(
                prefilledPlatform: parsed.InferredPlatform,
                prefilledQuery: parsed.QueryTitle,
                prefilledFilter: parsed.InferredFilter
            );
        }
    }

    public void StartBrowserSessionHandoff(bool preferMicrosoftEdge = false)
    {
        try
        {
            var lang = IsEnglishLocale ? "en" : "ko";
            var baseUrl = string.IsNullOrWhiteSpace(_settings.BaseUrl)
                ? "https://ottline.app"
                : _settings.BaseUrl.Trim().TrimEnd('/');
            var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var handoffUrl = $"{baseUrl}/{lang}?native_handoff=1&ts={ts}";

            if (preferMicrosoftEdge)
            {
                try
                {
                    Process.Start(new ProcessStartInfo($"microsoft-edge:{handoffUrl}") { UseShellExecute = true });
                }
                catch
                {
                    Process.Start(new ProcessStartInfo(handoffUrl) { UseShellExecute = true });
                }
            }
            else
            {
                Process.Start(new ProcessStartInfo(handoffUrl) { UseShellExecute = true });
            }

            ShowToast(IsEnglishLocale
                ? "Checking your browser timeline to connect automatically..."
                : "브라우저에 남아 있는 기존 기록을 확인해 자동으로 연결합니다.");
        }
        catch (Exception ex)
        {
            ShowToast(IsEnglishLocale
                ? $"Could not open browser: {ex.Message}"
                : $"브라우저 열기 실패: {ex.Message}");
        }
    }

    public void TryAutoLaunchStoreUpgradeHandoff()
    {
        if (_settings.HasCompletedBrowserHandoff
            || _settings.HasAutoAttemptedUpgradeHandoff
            || HasLogs
            || !string.IsNullOrWhiteSpace(_settings.UserId))
        {
            return;
        }

        if (!DesktopIntegrationService.HasStorePwaUpgradeFootprint(_repo.Database.DatabasePath))
        {
            return;
        }

        _repo.UpdateSettings(s => s with { HasAutoAttemptedUpgradeHandoff = true });
        _settings = _repo.GetSettings();
        StartBrowserSessionHandoff(preferMicrosoftEdge: true);
    }

    public void DismissMigrationBanner()
    {
        _repo.UpdateSettings(s => s with { HasDismissedMigrationBanner = true });
        RefreshLocalState();
    }

    public void ToggleThemeMode()
    {
        var next = _settings.ThemeMode switch
        {
            ThemeMode.SYSTEM => ThemeMode.LIGHT,
            ThemeMode.LIGHT => ThemeMode.DARK,
            _ => ThemeMode.SYSTEM
        };
        _repo.UpdateSettings(s => s with { ThemeMode = next });
        OttlineThemeManager.ApplyTheme(next);
        RefreshLocalState();
        var modeLabel = next switch
        {
            ThemeMode.SYSTEM => IsEnglishLocale ? "System" : "시스템 설정",
            ThemeMode.LIGHT => IsEnglishLocale ? "Light" : "라이트 모드",
            _ => IsEnglishLocale ? "Dark" : "다크 모드"
        };
        ShowToast(IsEnglishLocale ? $"Theme: {modeLabel}" : $"테마: {modeLabel}");
    }

    public void SetLocale(string locale)
    {
        _repo.UpdateSettings(s => s with { Locale = locale });
        RefreshLocalState();
        _ = LoadTogetherAsync();
        ResetRecommendationsForScopeChange();
        if (_isRecommendationsOpen)
        {
            _ = LoadRecommendationsAsync(forceRefresh: false);
        }
        if (_isQuickRecordOpen)
        {
            TriggerDebouncedTitleSearch();
        }
        if (_currentTab == MainTab.MY_SPACE && _currentMySpaceSection == MySpaceSection.FEEDBACK)
        {
            _ = LoadFeedbackThreadsAsync(_selectedFeedbackThread?.Id);
        }
    }

    public void ToggleLocale()
    {
        var next = string.Equals(_settings.Locale, "en", StringComparison.OrdinalIgnoreCase) ? "ko" : "en";
        SetLocale(next);
    }

    private string CurrentRecommendationScopeKey()
    {
        var userId = string.IsNullOrWhiteSpace(_settings.UserId) ? "anon" : _settings.UserId.Trim().ToLowerInvariant();
        var lang = Ottline.Core.Local.OttlineDatabase.NormalizeRecommendationLanguage(_settings.Locale);
        return $"{userId}:{lang}";
    }

    private void NotifyRecommendationPropertiesChanged()
    {
        OnPropertyChanged(nameof(IsRecommendationsLoading));
        OnPropertyChanged(nameof(HasRecommendations));
        OnPropertyChanged(nameof(HasRecommendationError));
        OnPropertyChanged(nameof(IsRecommendationQuotaExhausted));
        OnPropertyChanged(nameof(IsRecommendationsIneligible));
        OnPropertyChanged(nameof(IsRecommendationsEmptyFiltered));
        OnPropertyChanged(nameof(RecommendationQuotaText));
        OnPropertyChanged(nameof(HasRecommendationQuotaText));
        OnPropertyChanged(nameof(RecommendationLoadingMessage));
        OnPropertyChanged(nameof(RecommendationErrorMessage));
        OnPropertyChanged(nameof(CanRetryRecommendations));
        OnPropertyChanged(nameof(CanRefreshRecommendations));
        OnPropertyChanged(nameof(CanClickRecommendationAction));
        OnPropertyChanged(nameof(RecommendationActionButtonLabel));
    }

    private void RebuildVisibleRecommendations()
    {
        Recommendations.Clear();
        if (_recommendationState != null)
        {
            foreach (var item in _recommendationState.Items)
            {
                if (_timelineContentFilter == ContentFilter.VIDEO && !item.Title.Type.IsVideo()) continue;
                if (_timelineContentFilter == ContentFilter.BOOK && !item.Title.Type.IsBook()) continue;
                Recommendations.Add(item);
            }
        }
        NotifyRecommendationPropertiesChanged();
    }

    private void ResetRecommendationsForScopeChange()
    {
        _recommendationsCts?.Cancel();
        _recommendationsCts?.Dispose();
        _recommendationsCts = null;
        _isRecommendationsLoading = false;
        _recommendationState = null;
        _recommendationErrorKind = RecommendationErrorKind.None;
        _recommendationScopeKey = CurrentRecommendationScopeKey();
        Recommendations.Clear();
        NotifyRecommendationPropertiesChanged();
    }

    public Task HandleRecommendationActionAsync()
    {
        if (CanRetryRecommendations)
        {
            return RetryRecommendationsAsync();
        }
        return LoadRecommendationsAsync(forceRefresh: true);
    }

    public Task RetryRecommendationsAsync()
    {
        if (_recommendationErrorKind == RecommendationErrorKind.LoadFailed)
        {
            return LoadRecommendationsAsync(forceRefresh: false);
        }
        return LoadRecommendationsAsync(forceRefresh: true);
    }

    public async Task LoadRecommendationsAsync(bool forceRefresh = false)
    {
        _repo.RefreshApi();
        var expectedScope = CurrentRecommendationScopeKey();
        if (!string.Equals(_recommendationScopeKey, expectedScope, StringComparison.OrdinalIgnoreCase))
        {
            ResetRecommendationsForScopeChange();
        }

        if (_isRecommendationsLoading) return;

        _recommendationsCts?.Cancel();
        _recommendationsCts?.Dispose();
        var cts = new CancellationTokenSource();
        _recommendationsCts = cts;
        _recommendationScopeKey = expectedScope;
        _recommendationErrorKind = RecommendationErrorKind.None;
        IsRecommendationsLoading = true;

        try
        {
            var result = forceRefresh
                ? await _repo.GenerateRecommendationsAsync(cts.Token)
                : await _repo.LoadRecommendationsAsync(allowAutoGenerate: true, cts.Token);

            if (cts.IsCancellationRequested || !string.Equals(CurrentRecommendationScopeKey(), expectedScope, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (result.State != null)
            {
                _recommendationState = result.State;
                if (result.State.Items.Count > 0)
                {
                    await UrlToImageSourceConverter.PrefetchUrlsAsync(
                        result.State.Items.Select(r => r.Title.PosterUrl),
                        isHero: false
                    );
                }

                if (cts.IsCancellationRequested || !string.Equals(CurrentRecommendationScopeKey(), expectedScope, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                RebuildVisibleRecommendations();
            }

            _recommendationErrorKind = result.ErrorKind;
            NotifyRecommendationPropertiesChanged();
        }
        catch (OperationCanceledException)
        {
            // Scope changed or superseded by a newer request.
        }
        catch
        {
            if (!cts.IsCancellationRequested && string.Equals(CurrentRecommendationScopeKey(), expectedScope, StringComparison.OrdinalIgnoreCase))
            {
                _recommendationErrorKind = forceRefresh
                    ? RecommendationErrorKind.GenerateFailed
                    : RecommendationErrorKind.LoadFailed;
                NotifyRecommendationPropertiesChanged();
            }
        }
        finally
        {
            if (ReferenceEquals(_recommendationsCts, cts))
            {
                IsRecommendationsLoading = false;
            }
        }
    }

    public async Task ExcludeRecommendationAsync(RecommendationItem item)
    {
        Recommendations.Remove(item);
        _repo.RemoveRecommendationItemFromCache(item);
        if (_recommendationState != null)
        {
            var filtered = _recommendationState.Items
                .Where(x => !string.Equals(x.Title.Id, item.Title.Id, StringComparison.OrdinalIgnoreCase)
                            && !string.Equals(x.Title.Title, item.Title.Title, StringComparison.OrdinalIgnoreCase))
                .ToList();
            _recommendationState = _recommendationState with { Items = filtered };
        }
        NotifyRecommendationPropertiesChanged();
        _repo.RefreshApi();
        await _repo.Api.ExcludeRecommendationAsync(item);
        ShowToast(IsEnglishLocale
            ? "This title is hidden from your recommendations."
            : "이 작품은 추천에서 빼두었어요.");
    }

    private void OnTogetherCoordinatorStateChanged()
    {
        var dispatcher = System.Windows.Application.Current?.Dispatcher;
        if (dispatcher != null && !dispatcher.CheckAccess())
        {
            _ = dispatcher.BeginInvoke(SyncTogetherUiState);
            return;
        }
        SyncTogetherUiState();
    }

    private string FormatTitleTypeLabel(TitleType type) => type switch
    {
        TitleType.book => IsEnglishLocale ? "Book" : "책",
        TitleType.series => IsEnglishLocale ? "Series" : "시리즈",
        _ => IsEnglishLocale ? "Movie" : "영화"
    };

    private static bool IsAutoGeneratedDiscussionSummary(DiscussionPost post)
    {
        if (string.IsNullOrWhiteSpace(post.Body)) return true;
        var body = post.Body.Trim();
        return (body.Contains("댓글 ", StringComparison.Ordinal) || body.Contains(" comments", StringComparison.OrdinalIgnoreCase))
               && body.Contains(" · ", StringComparison.Ordinal);
    }

    private (string MetaLine, string Snippet, bool HasSnippet, string ReactionText, bool HasReactions) BuildTogetherListDisplay(DiscussionPost post)
    {
        var parts = new List<string> { FormatTitleTypeLabel(post.Title.Type) };
        if (post.Title.Year.HasValue) parts.Add(post.Title.Year.Value.ToString());
        parts.Add(IsEnglishLocale
            ? (post.CommentCount == 1 ? "1 comment" : $"{post.CommentCount} comments")
            : $"이야기 {post.CommentCount}");
        var metaLine = string.Join(" · ", parts);

        var snippet = IsAutoGeneratedDiscussionSummary(post) ? string.Empty : post.Body.Trim();
        var hasSnippet = !string.IsNullOrWhiteSpace(snippet);

        var totalReactions = post.Reactions?.TotalCount ?? 0;
        var reactionText = totalReactions > 0
            ? (IsEnglishLocale
                ? (totalReactions == 1 ? "1 reaction" : $"{totalReactions} reactions")
                : $"공감 {totalReactions}")
            : string.Empty;

        return (metaLine, snippet, hasSnippet, reactionText, totalReactions > 0);
    }

    private void SyncTogetherUiState()
    {
        var visible = _together.VisiblePosts;
        var selectedId = _together.SelectedPost?.Id;

        _isSyncingTogetherList = true;
        try
        {
            var sameOrder = DiscussionItems.Count == visible.Count;
            if (sameOrder)
            {
                for (var i = 0; i < visible.Count; i++)
                {
                    if (!string.Equals(DiscussionItems[i].Id, visible[i].Id, StringComparison.OrdinalIgnoreCase))
                    {
                        sameOrder = false;
                        break;
                    }
                }
            }

            if (sameOrder)
            {
                for (var i = 0; i < visible.Count; i++)
                {
                    var post = visible[i];
                    var disp = BuildTogetherListDisplay(post);
                    var isSel = string.Equals(post.Id, selectedId, StringComparison.OrdinalIgnoreCase);
                    DiscussionItems[i].Update(post, disp.MetaLine, disp.Snippet, disp.HasSnippet, disp.ReactionText, disp.HasReactions, isSel);
                }
            }
            else
            {
                DiscussionItems.Clear();
                foreach (var post in visible)
                {
                    var disp = BuildTogetherListDisplay(post);
                    var isSel = string.Equals(post.Id, selectedId, StringComparison.OrdinalIgnoreCase);
                    DiscussionItems.Add(new TogetherListItem(
                        post,
                        disp.MetaLine,
                        disp.Snippet,
                        disp.HasSnippet,
                        disp.ReactionText,
                        disp.HasReactions,
                        isSel
                    ));
                }
            }

            Discussions.Clear();
            foreach (var post in visible)
            {
                Discussions.Add(post);
            }

            _selectedDiscussionListItem = string.IsNullOrWhiteSpace(selectedId)
                ? null
                : DiscussionItems.FirstOrDefault(x => string.Equals(x.Id, selectedId, StringComparison.OrdinalIgnoreCase));

            SelectedDiscussionComments.Clear();
            if (_together.SelectedDetail != null)
            {
                foreach (var c in _together.SelectedDetail.Comments)
                {
                    SelectedDiscussionComments.Add(c);
                }
            }
        }
        finally
        {
            _isSyncingTogetherList = false;
        }

        NotifyTogetherPropertiesChanged();
    }

    private void NotifyTogetherPropertiesChanged()
    {
        OnPropertyChanged(nameof(TogetherSearchQuery));
        OnPropertyChanged(nameof(HasTogetherSearchQuery));
        OnPropertyChanged(nameof(TogetherSort));
        OnPropertyChanged(nameof(IsTogetherSortLatest));
        OnPropertyChanged(nameof(IsTogetherSortReactions));
        OnPropertyChanged(nameof(IsTogetherSortComments));
        OnPropertyChanged(nameof(IsTogetherTwoPane));
        OnPropertyChanged(nameof(ShowTogetherListPane));
        OnPropertyChanged(nameof(ShowTogetherDetailPane));
        OnPropertyChanged(nameof(ShowTogetherBackButton));
        OnPropertyChanged(nameof(TogetherListColumnWidth));
        OnPropertyChanged(nameof(TogetherGapColumnWidth));
        OnPropertyChanged(nameof(TogetherDetailColumnWidth));
        OnPropertyChanged(nameof(HasTogetherDiscussions));
        OnPropertyChanged(nameof(ShowTogetherListLoading));
        OnPropertyChanged(nameof(ShowTogetherEmptyState));
        OnPropertyChanged(nameof(TogetherEmptyStateMessage));
        OnPropertyChanged(nameof(SelectedDiscussionListItem));
        OnPropertyChanged(nameof(SelectedDiscussionPost));
        OnPropertyChanged(nameof(SelectedDiscussionDetail));
        OnPropertyChanged(nameof(HasSelectedDiscussion));
        OnPropertyChanged(nameof(ShowTogetherSelectPlaceholder));
        OnPropertyChanged(nameof(IsSelectedDiscussionDetailLoading));
        OnPropertyChanged(nameof(HasSelectedDiscussionDetailError));
        OnPropertyChanged(nameof(IsSelectedDiscussionCommentsEmpty));
        OnPropertyChanged(nameof(SelectedDiscussionTypeAndYear));
        OnPropertyChanged(nameof(SelectedDiscussionBody));
        OnPropertyChanged(nameof(HasSelectedDiscussionBody));
        OnPropertyChanged(nameof(SelectedDiscussionHasLocalLog));
        OnPropertyChanged(nameof(SelectedDiscussionCommentCountLabel));
        OnPropertyChanged(nameof(IsSelectedReactionDone));
        OnPropertyChanged(nameof(IsSelectedReactionCurious));
        OnPropertyChanged(nameof(IsSelectedReactionSave));
        OnPropertyChanged(nameof(CanToggleTogetherReaction));
        OnPropertyChanged(nameof(SelectedReactionDoneLabel));
        OnPropertyChanged(nameof(SelectedReactionCuriousLabel));
        OnPropertyChanged(nameof(SelectedReactionSaveLabel));
        OnPropertyChanged(nameof(CanSubmitComment));
    }

    public void UpdateWindowWidth(double width)
    {
        var autoLoad = _together.UpdateViewportWidth(width);
        if (autoLoad != null)
        {
            _ = SelectDiscussionAsync(autoLoad, openNarrowDetail: false, isExplicit: false);
        }
    }

    public void ClearTogetherSearch()
    {
        TogetherSearchQuery = string.Empty;
    }

    public void CloseNarrowTogetherDetail()
    {
        _together.CloseNarrowDetail();
    }

    public void OpenDiscussionFromListItem(TogetherListItem item)
    {
        if (string.Equals(_together.SelectedPost?.Id, item.Id, StringComparison.OrdinalIgnoreCase))
        {
            _together.ReopenNarrowDetailForCurrentSelection();
            return;
        }
        _ = SelectDiscussionAsync(item.Post, openNarrowDetail: true, isExplicit: true);
    }

    public async Task LoadTogetherAsync(string? preferredDiscussionId = null)
    {
        _repo.RefreshApi();
        IsTogetherListLoading = true;
        try
        {
            var remotePosts = await _repo.Api.FetchDiscussionsAsync(query: null, sort: DiscussionSort.LATEST);
            var popularTitles = await _repo.Api.FetchPopularTitlesAsync(8);

            await UrlToImageSourceConverter.PrefetchUrlsAsync(
                popularTitles.Take(8).Select(t => t.PosterUrl)
                    .Concat(remotePosts.Take(16).Select(p => p.Title.PosterUrl)),
                isHero: false
            );

            void UpdateHomeCollections()
            {
                HomePopularTitles.Clear();
                foreach (var t in popularTitles.Take(8))
                {
                    HomePopularTitles.Add(t);
                }

                HomeDiscussionsPreview.Clear();
                foreach (var d in remotePosts.Take(4))
                {
                    HomeDiscussionsPreview.Add(d);
                }
            }

            var dispatcher = System.Windows.Application.Current?.Dispatcher;
            if (dispatcher != null && !dispatcher.CheckAccess())
            {
                _ = dispatcher.BeginInvoke(UpdateHomeCollections);
            }
            else
            {
                UpdateHomeCollections();
            }

            var postToLoad = _together.ApplyFeed(remotePosts, preferredDiscussionId);
            if (postToLoad != null)
            {
                var isPreferred = !string.IsNullOrWhiteSpace(preferredDiscussionId)
                                  && string.Equals(postToLoad.Id, preferredDiscussionId, StringComparison.OrdinalIgnoreCase);
                await SelectDiscussionAsync(
                    postToLoad,
                    openNarrowDetail: isPreferred,
                    isExplicit: isPreferred
                );
            }
        }
        finally
        {
            IsTogetherListLoading = false;
        }
    }

    public Task SelectDiscussionAsync(DiscussionPost post, bool openNarrowDetail = true, bool isExplicit = true)
    {
        _repo.RefreshApi();
        return _together.SelectPostAsync(
            post,
            (id, fallback, ct) => _repo.Api.FetchDiscussionDetailAsync(id, ct, fallback),
            (id, ct) => _repo.Api.FetchMyDiscussionReactionsAsync(id, ct),
            openNarrowDetail: openNarrowDetail,
            isExplicit: isExplicit
        );
    }

    public async Task OpenDiscussionFromExternalAsync(DiscussionPost post)
    {
        CurrentTab = MainTab.TOGETHER;
        if (_together.AllPosts.Count == 0)
        {
            await LoadTogetherAsync(preferredDiscussionId: post.Id);
            if (_together.SelectedPost == null || !string.Equals(_together.SelectedPost.Id, post.Id, StringComparison.OrdinalIgnoreCase))
            {
                _together.PrependPost(post);
                await SelectDiscussionAsync(post, openNarrowDetail: true, isExplicit: true);
            }
            return;
        }

        if (!_together.AllPosts.Any(p => string.Equals(p.Id, post.Id, StringComparison.OrdinalIgnoreCase)))
        {
            _together.PrependPost(post);
        }
        await SelectDiscussionAsync(post, openNarrowDetail: true, isExplicit: true);
    }

    public async Task OpenDiscussionByIdAsync(string discussionId)
    {
        if (string.IsNullOrWhiteSpace(discussionId)) return;
        CurrentTab = MainTab.TOGETHER;
        _repo.RefreshApi();

        if (_together.AllPosts.Count == 0)
        {
            await LoadTogetherAsync(preferredDiscussionId: discussionId);
            if (_together.SelectedPost != null && string.Equals(_together.SelectedPost.Id, discussionId, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        var opened = await _together.OpenDiscussionByIdAsync(
            discussionId,
            (id, ct) => _repo.Api.FetchDiscussionByIdAsync(id, ct),
            (id, fallback, ct) => _repo.Api.FetchDiscussionDetailAsync(id, ct, fallback),
            (id, ct) => _repo.Api.FetchMyDiscussionReactionsAsync(id, ct)
        );
        if (!opened)
        {
            ShowToast(IsEnglishLocale
                ? "Could not find that conversation."
                : "해당 이야기를 찾지 못했어요.");
        }
    }

    public Task RetrySelectedDiscussionDetailAsync()
    {
        var post = _together.SelectedPost;
        if (post == null) return Task.CompletedTask;
        return SelectDiscussionAsync(post, openNarrowDetail: !_together.IsTwoPane, isExplicit: true);
    }

    public void OpenQuickRecordForSelectedDiscussion()
    {
        var post = _together.SelectedPost;
        if (post == null) return;
        var existing = _repo.GetLogByTitleId(post.Title.Id);
        if (existing != null)
        {
            OpenQuickRecordModal(existingLogToEdit: existing);
        }
        else
        {
            OpenQuickRecordModal(preselectedTitle: post.Title);
        }
    }

    public void OpenLocalRecordForSelectedDiscussion()
    {
        var post = _together.SelectedPost;
        if (post == null) return;
        var existing = _repo.GetLogByTitleId(post.Title.Id);
        if (existing != null)
        {
            OpenTitleDetail(existing);
        }
        else
        {
            OpenQuickRecordModal(preselectedTitle: post.Title);
        }
    }

    public async Task ReactToSelectedDiscussionAsync(DiscussionReactionType reactionType)
    {
        var post = _together.SelectedPost;
        if (post == null || _isTogetherReactionBusy) return;

        _isTogetherReactionBusy = true;
        OnPropertyChanged(nameof(CanToggleTogetherReaction));
        try
        {
            var wasSelected = _together.ReactionState.HasReaction(reactionType);
            if (!wasSelected)
            {
                _repo.ApplyDiscussionReactionLocalFirst(post, reactionType);
                RefreshLocalState();
            }

            await _repo.EnsureRegisteredAsync();
            _repo.RefreshApi();
            var updated = await _repo.Api.ToggleReactionAsync(post.Id, reactionType);
            if (updated != null)
            {
                _together.ApplyReactionUpdate(post.Id, updated);
            }
            else
            {
                // Optimistic fallback when offline
                var currentSelected = _together.ReactionState.SafeSelectedTypes.ToList();
                var summary = _together.ReactionState.Summary;
                if (wasSelected)
                {
                    currentSelected.Remove(reactionType);
                    summary = reactionType switch
                    {
                        DiscussionReactionType.DONE => summary with { DoneCount = Math.Max(0, summary.DoneCount - 1) },
                        DiscussionReactionType.CURIOUS => summary with { CuriousCount = Math.Max(0, summary.CuriousCount - 1) },
                        _ => summary with { SaveCount = Math.Max(0, summary.SaveCount - 1) }
                    };
                }
                else
                {
                    currentSelected.Add(reactionType);
                    summary = reactionType switch
                    {
                        DiscussionReactionType.DONE => summary with { DoneCount = summary.DoneCount + 1 },
                        DiscussionReactionType.CURIOUS => summary with { CuriousCount = summary.CuriousCount + 1 },
                        _ => summary with { SaveCount = summary.SaveCount + 1 }
                    };
                }
                _together.ApplyReactionUpdate(post.Id, new DiscussionReactionState(summary, currentSelected, currentSelected.Count > 0));
            }

            if (!wasSelected)
            {
                var statusLabel = reactionType.ToLogStatus() switch
                {
                    LogStatus.DONE => IsEnglishLocale ? (post.Title.Type.IsBook() ? "Read" : "Watched") : (post.Title.Type.IsBook() ? "읽었어요" : "봤어요"),
                    _ => IsEnglishLocale ? (post.Title.Type.IsBook() ? "Want to read" : "Want to watch") : (post.Title.Type.IsBook() ? "읽고 싶어요" : "보고 싶어요")
                };
                ShowToast(IsEnglishLocale
                    ? $"Added '{post.Title.Title}' to your timeline ({statusLabel})."
                    : $"'{post.Title.Title}' 작품이 내 타임라인에 '{statusLabel}' 상태로 남았어요.");
            }
        }
        finally
        {
            _isTogetherReactionBusy = false;
            OnPropertyChanged(nameof(CanToggleTogetherReaction));
        }
    }

    public async Task SubmitDiscussionCommentAsync()
    {
        var post = _together.SelectedPost;
        if (post == null || string.IsNullOrWhiteSpace(NewCommentBody) || _isSubmittingComment) return;

        var bodyToSend = NewCommentBody.Trim();
        var syncLogToSend = NewCommentSyncLog;
        var mentions = new List<CommentMention>();
        foreach (var word in bodyToSend.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (word.StartsWith('@') && word.Length > 1)
            {
                var q = word[1..];
                var match = _repo.Database.SearchLocalTitles(q, ContentFilter.ALL, 1).FirstOrDefault();
                if (match != null)
                {
                    mentions.Add(new CommentMention(match.Id, match.Title, match.Type));
                }
            }
        }

        _isSubmittingComment = true;
        OnPropertyChanged(nameof(CanSubmitComment));
        try
        {
            await _repo.EnsureRegisteredAsync();
            _repo.RefreshApi();
            var created = await _repo.Api.CreateCommentAsync(
                post.Id,
                bodyToSend,
                spoiler: false,
                mentions: mentions,
                syncLog: syncLogToSend
            );

            var commentToShow = created ?? new DiscussionComment(
                Id: $"c-{Guid.NewGuid():N}",
                DiscussionId: post.Id,
                Body: bodyToSend,
                Spoiler: false,
                CreatedAt: RecordDate.FormatDisplayDate(RecordDate.TodayDate(), null, _settings.Locale),
                Author: new PublicAuthorProfile(_settings.UserId, _settings.DisplayName, _settings.Handle, _settings.AvatarPreset),
                Mentions: mentions,
                IsMine: true
            );

            _together.AppendComment(post.Id, commentToShow);
            NewCommentBody = string.Empty;

            if (syncLogToSend)
            {
                _ = SyncNowAsync(silent: true);
            }
        }
        finally
        {
            _isSubmittingComment = false;
            OnPropertyChanged(nameof(CanSubmitComment));
        }
    }

    public async Task SubmitNewDiscussionAsync()
    {
        if (string.IsNullOrWhiteSpace(NewDiscussionBody))
        {
            ShowToast(IsEnglishLocale ? "Please enter your thoughts first." : "이야기 본문을 입력해주세요.");
            return;
        }

        var title = _newDiscussionTitle;
        if (title == null)
        {
            var q = string.IsNullOrWhiteSpace(NewDiscussionTitleQuery) ? "자유 이야기" : NewDiscussionTitleQuery.Trim();
            title = (await _repo.SearchTitlesAsync(q, ContentFilter.ALL)).FirstOrDefault()
                    ?? TitleFallback.BuildManualVideoMetadata(q);
        }

        var draftBody = NewDiscussionBody.Trim();
        var draftSpoiler = NewDiscussionSpoiler;

        IsWriteDiscussionOpen = false;
        NewDiscussionBody = string.Empty;
        NewDiscussionTitleQuery = string.Empty;
        NewDiscussionSpoiler = false;

        await _repo.EnsureRegisteredAsync();
        _repo.RefreshApi();
        var created = await _repo.Api.CreateDiscussionAsync(title, draftBody, draftSpoiler);

        var post = created ?? new DiscussionPost(
            Id: $"disc-{Guid.NewGuid():N}",
            TitleId: title.Id,
            Title: title,
            Body: draftBody,
            Spoiler: draftSpoiler,
            CreatedAt: RecordDate.FormatDisplayDate(RecordDate.TodayDate(), null, _settings.Locale),
            UpdatedAt: RecordDate.TodayDate(),
            Author: new PublicAuthorProfile(_settings.UserId, _settings.DisplayName, _settings.Handle, _settings.AvatarPreset),
            Reactions: new DiscussionReactionSummary(1, 0, 0, new[] { DiscussionReactionType.DONE }),
            CommentCount: 0,
            IsMine: true,
            RawCreatedAt: DateTimeOffset.UtcNow.ToString("O")
        );

        _together.PrependPost(post);
        HomeDiscussionsPreview.Insert(0, post);
        while (HomeDiscussionsPreview.Count > 4)
        {
            HomeDiscussionsPreview.RemoveAt(HomeDiscussionsPreview.Count - 1);
        }

        await SelectDiscussionAsync(post, openNarrowDetail: true, isExplicit: true);
        ShowToast(IsEnglishLocale ? "Shared your thought to Together." : "함께 이야기에 남겼어요.");
    }

    public async Task SaveProfileAsync()
    {
        var updated = _repo.UpdateSettings(s => s with
        {
            DisplayName = string.IsNullOrWhiteSpace(EditDisplayName) ? "나의 기록실" : EditDisplayName.Trim(),
            Handle = EditHandle.Trim().TrimStart('@'),
            Bio = EditBio.Trim(),
            AvatarPreset = EditAvatarKey
        });

        IsProfileEditorOpen = false;
        RefreshLocalState();
        ShowToast("나의 프로필 모습이 저장되었습니다.");

        await _repo.Api.UpdateProfileAsync(new AccountProfile(
            UserId: updated.UserId ?? "",
            DisplayName: updated.DisplayName,
            Handle: updated.Handle,
            AvatarPreset: updated.AvatarPreset,
            Bio: updated.Bio
        ));
    }

    public async Task IssueOrRefreshRecoveryCodeAsync()
    {
        var registered = await _repo.Api.RegisterDeviceAsync();
        if (registered.HasValue)
        {
            _repo.UpdateSettings(s => s with
            {
                UserId = registered.Value.UserId,
                DeviceId = registered.Value.DeviceId,
                AuthToken = null,
                RecoveryCode = registered.Value.Code,
                RecoveryCodeIssuedAt = registered.Value.IssuedAt
            });
        }
        else if (string.IsNullOrWhiteSpace(_settings.RecoveryCode))
        {
            var localCode = $"OTTL-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
            _repo.UpdateSettings(s => s with
            {
                RecoveryCode = localCode,
                RecoveryCodeIssuedAt = DateTimeOffset.UtcNow.ToString("O")
            });
        }
        RefreshLocalState();
        ShowToast(IsEnglishLocale ? "Connection code is ready." : "연결 코드가 준비되었습니다.");
    }

    public async Task PreviewPairCodeAsync()
    {
        if (string.IsNullOrWhiteSpace(PairCodeInput))
        {
            ShowToast("연결 코드를 입력해주세요.");
            return;
        }

        var localCount = _repo.GetAllLogs().Count;
        var preview = await _repo.Api.PreviewPairAsync(PairCodeInput, localCount)
                      ?? new PairPreviewResult(
                          TargetUserId: "paired-account",
                          TargetDisplayName: "기존 웹/PWA 기록실",
                          TargetLogCount: 12,
                          LocalLogCount: localCount,
                          EstimatedMergedCount: localCount + 12,
                          RecoveryCode: PairCodeInput.Trim()
                      );
        PairPreview = preview;
    }

    public async Task ConfirmPairMergeAsync()
    {
        if (PairPreview == null) return;
        var code = PairPreview.RecoveryCode;
        if (_repo.GetAllLogs().Count > 0)
        {
            await _repo.EnsureRegisteredAsync();
            await _repo.SyncAllAsync();
        }
        var commit = await _repo.Api.CommitPairAsync(code);
        if (commit == null)
        {
            ShowToast(IsEnglishLocale ? "Please check your connection code." : "연결 코드를 확인해주세요.");
            return;
        }
        _repo.UpdateSettings(s => s with
        {
            UserId = commit.UserId,
            DeviceId = !string.IsNullOrWhiteSpace(commit.SessionToken) ? commit.SessionToken : s.DeviceId,
            AuthToken = null,
            RecoveryCode = commit.RecoveryCode,
            LastSyncCursor = null,
            HasCompletedBrowserHandoff = true,
            HasDismissedMigrationBanner = true
        });
        PairPreview = null;
        PairCodeInput = string.Empty;
        await SyncNowAsync(silent: true);
        RefreshTimelineItems();
        ShowToast(IsEnglishLocale
            ? "Devices connected and records merged."
            : "기기 연결 및 기록 병합이 완료되었습니다.");
    }

    public async Task LoadFeedbackThreadsAsync(string? selectThreadId = null)
    {
        await _repo.EnsureRegisteredAsync();
        _repo.RefreshApi();
        var remote = await _repo.Api.FetchFeedbackThreadsAsync();
        FeedbackThreads.Clear();
        foreach (var t in remote) FeedbackThreads.Add(t);
        OnPropertyChanged(nameof(IsFeedbackThreadsEmpty));
        SelectedFeedbackThread = (!string.IsNullOrWhiteSpace(selectThreadId)
            ? FeedbackThreads.FirstOrDefault(t => t.Id == selectThreadId)
            : null) ?? FeedbackThreads.FirstOrDefault();
    }

    public async Task SubmitFeedbackThreadAsync()
    {
        if (string.IsNullOrWhiteSpace(NewFeedbackBody))
        {
            ShowToast(IsEnglishLocale ? "Please enter a message." : "문의 내용을 입력해주세요.");
            return;
        }

        var cat = NewFeedbackCategory;
        var subj = NewFeedbackSubject.Trim();
        var body = NewFeedbackBody.Trim();

        await _repo.EnsureRegisteredAsync();
        _repo.RefreshApi();
        var ok = await _repo.Api.CreateFeedbackThreadAsync(cat, subj, body);
        if (!ok)
        {
            ShowToast(IsEnglishLocale
                ? "Could not send your message. Check your connection and try again."
                : "문의를 보내지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.");
            return;
        }

        NewFeedbackCategory = "QUESTION";
        NewFeedbackSubject = string.Empty;
        NewFeedbackBody = string.Empty;
        await LoadFeedbackThreadsAsync();
        ShowToast(IsEnglishLocale
            ? "Message sent. Check this inbox for a reply."
            : "문의가 전해졌어요. 답변은 이 문의함에서 확인해 주세요.");
    }

    public void UpdateDesktopPreference(bool? watchReminder = null, bool? revisitReminder = null, bool? globalHotkey = null, bool? minimizeToTray = null, string? baseUrl = null)
    {
        _repo.UpdateSettings(s => s with
        {
            WatchReminderEnabled = watchReminder ?? s.WatchReminderEnabled,
            RevisitReminderEnabled = revisitReminder ?? s.RevisitReminderEnabled,
            GlobalHotkeyEnabled = globalHotkey ?? s.GlobalHotkeyEnabled,
            MinimizeToTray = minimizeToTray ?? s.MinimizeToTray,
            BaseUrl = !string.IsNullOrWhiteSpace(baseUrl) ? baseUrl.Trim() : s.BaseUrl
        });
        RefreshLocalState();
        ShowToast("설정이 반영되었습니다.");
    }

    public void ResetLocalCacheOnly()
    {
        _repo.Database.ResetLocalData(preserveSettings: true);
        IsTitleDetailOpen = false;
        SelectedDetailLog = null;
        SelectedTitleHistory.Clear();
        RefreshLocalState();
        RefreshTimelineItems();
        ShowToast(_strings.LocalResetSuccessNotice);
    }

    public async Task<ServerAccountDeleteResult> DeleteServerAccountPermanentlyAsync(CancellationToken ct = default)
    {
        if (_isDeletingServerAccount)
        {
            return new ServerAccountDeleteResult(
                ServerAccountDeleteOutcome.NetworkError,
                ErrorMessage: "Deletion already in progress"
            );
        }

        if (!HasConnectedServerAccount)
        {
            ShowToast(_strings.DeleteAccountNotConnectedNotice);
            return new ServerAccountDeleteResult(ServerAccountDeleteOutcome.NotConnected);
        }

        IsDeletingServerAccount = true;
        try
        {
            var result = await _repo.DeleteServerAccountAsync(ct);
            if (!result.IsSuccess)
            {
                ShowToast(result.Outcome switch
                {
                    ServerAccountDeleteOutcome.NotConnected => _strings.DeleteAccountNotConnectedNotice,
                    ServerAccountDeleteOutcome.NetworkError => _strings.DeleteAccountNetworkFailedNotice,
                    _ => _strings.DeleteAccountFailedNotice
                });
                return result;
            }

            IsTitleDetailOpen = false;
            SelectedDetailLog = null;
            SelectedTitleHistory.Clear();
            IsProfileEditorOpen = false;
            PairPreview = null;
            PairCodeInput = string.Empty;
            LinkedDevices.Clear();
            FeedbackThreads.Clear();
            SelectedFeedbackThread = null;
            ResetRecommendationsForScopeChange();
            OnPropertyChanged(nameof(IsFeedbackThreadsEmpty));

            RefreshLocalState();
            RefreshTimelineItems();
            ShowToast(_strings.DeleteAccountSuccessNotice);
            return result;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            ShowToast(_strings.DeleteAccountNetworkFailedNotice);
            return new ServerAccountDeleteResult(
                ServerAccountDeleteOutcome.NetworkError,
                ErrorMessage: ex.Message
            );
        }
        finally
        {
            IsDeletingServerAccount = false;
        }
    }

    public void ShowToast(string message)
    {
        ToastMessage = message;
        IsToastVisible = true;
    }

    public void DismissToast()
    {
        IsToastVisible = false;
    }

    private void TriggerDebouncedTitleSearch()
    {
        _searchDebounceCts?.Cancel();
        var cts = new CancellationTokenSource();
        _searchDebounceCts = cts;
        var query = _quickSearchQuery;
        var filter = _quickSearchFilter;

        Task.Run(async () =>
        {
            try
            {
                await Task.Delay(250, cts.Token);
                var results = await _repo.SearchTitlesAsync(query, filter, cts.Token);
                if (cts.Token.IsCancellationRequested) return;
                await UrlToImageSourceConverter.PrefetchUrlsAsync(
                    results.Take(12).Select(r => r.PosterUrl),
                    isHero: false
                );
                if (cts.Token.IsCancellationRequested) return;
                System.Windows.Application.Current?.Dispatcher.Invoke(() =>
                {
                    QuickSearchResults.Clear();
                    foreach (var item in results)
                    {
                        QuickSearchResults.Add(item);
                    }
                });
            }
            catch (OperationCanceledException)
            {
                // Debounced
            }
        });
    }

    private void RebuildQuickPlatformOptions()
    {
        QuickPlatformOptions.Clear();
        var isBook = QuickSelectedTitle?.Type == TitleType.book;
        var groups = isBook
            ? (IsEnglishLocale ? OttlinePresets.BookPlatformGroupsEn : OttlinePresets.BookPlatformGroups)
            : (IsEnglishLocale ? OttlinePresets.VideoPlatformGroupsEn : OttlinePresets.VideoPlatformGroups);
        foreach (var g in groups)
        {
            foreach (var opt in g.Options)
            {
                QuickPlatformOptions.Add(opt);
            }
        }
    }

    private void RebuildQuickPresetChips()
    {
        var isBook = QuickSelectedTitle?.Type == TitleType.book;
        QuickPlaceOptions.Clear();
        foreach (var p in OttlinePresets.GetPlacePresetsForType(isBook, _settings.Locale))
        {
            QuickPlaceOptions.Add(p);
        }

        QuickOccasionOptions.Clear();
        foreach (var o in OttlinePresets.GetOccasionPresets(_settings.Locale))
        {
            QuickOccasionOptions.Add(o);
        }

        RebuildQuickPlatformOptions();
    }

    private void RebuildAvatarOptions()
    {
        AvatarOptions.Clear();
        foreach (var preset in Enum.GetValues<StorybookAvatarPreset>())
        {
            var key = preset.Key();
            AvatarOptions.Add(new AvatarOptionItem(
                Preset: preset,
                Key: key,
                Label: _settings.Locale == "en" ? preset.LabelEn() : preset.LabelKo(),
                Subtitle: _settings.Locale == "en" ? preset.SubtitleEn() : preset.SubtitleKo(),
                ImageUri: preset.ResourcePath(),
                IsSelected: string.Equals(key, _editAvatarKey, StringComparison.OrdinalIgnoreCase)
            ));
        }
    }

    private WatchLogDisplayItem ToDisplayItem(WatchLog log)
    {
        var isBook = log.Title.Type.IsBook();
        var typeBadge = log.Title.Type switch
        {
            TitleType.book => IsEnglishLocale ? "Book" : "책",
            TitleType.series => IsEnglishLocale ? "Series" : "시리즈",
            _ => IsEnglishLocale ? "Movie" : "영화"
        };
        var typeAndYear = log.Title.Year.HasValue ? $"{typeBadge} · {log.Title.Year.Value}" : typeBadge;
        var creatorLine = log.Title.SafeAuthors.Count > 0
            ? string.Join(", ", log.Title.SafeAuthors)
            : (!string.IsNullOrWhiteSpace(log.Title.Publisher) ? log.Title.Publisher! : string.Empty);

        var statusBadge = log.Status switch
        {
            LogStatus.IN_PROGRESS => IsEnglishLocale ? (isBook ? "Reading" : "Watching") : (isBook ? "읽는 중" : "보는 중"),
            LogStatus.WISHLIST => IsEnglishLocale ? (isBook ? "Want to read" : "Want to watch") : (isBook ? "읽고 싶어요" : "보고 싶어요"),
            _ => IsEnglishLocale ? (isBook ? "Read" : "Watched") : (isBook ? "읽었어요" : "봤어요")
        };
        var feelingBadge = RecordFeelings.GetFeelingBadgeText(log, _settings.Locale);
        var statusAndFeeling = string.IsNullOrWhiteSpace(feelingBadge)
            ? statusBadge
            : $"{statusBadge} · {feelingBadge}";

        var editionParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(log.Ott)) editionParts.Add(log.Ott!);
        if (log.SeasonNumber.HasValue) editionParts.Add($"S{log.SeasonNumber.Value}");
        if (log.EpisodeNumber.HasValue) editionParts.Add($"E{log.EpisodeNumber.Value}");
        var editionLine = editionParts.Count > 0 ? string.Join(" · ", editionParts) : string.Empty;

        var metaParts = new List<string> { typeBadge };
        if (log.Title.Year.HasValue) metaParts.Add(log.Title.Year.Value.ToString());
        if (editionParts.Count > 0) metaParts.Add(string.Join(" · ", editionParts));
        var metaLine = string.Join(" · ", metaParts);

        var momentParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(log.Place)) momentParts.Add(OttlinePresets.FormatPlace(log.Place, _settings.Locale));
        if (!string.IsNullOrWhiteSpace(log.Occasion)) momentParts.Add(OttlinePresets.FormatOccasion(log.Occasion, _settings.Locale));
        var moment = momentParts.Count > 0
            ? string.Join(" · ", momentParts)
            : TimelineMoments.FormatMomentSummary(log, _settings.Locale);

        var hasNote = !string.IsNullOrWhiteSpace(log.Note);
        var notePreview = log.Spoiler
            ? (IsEnglishLocale ? "🔒 Contains spoilers" : "🔒 스포일러 포함")
            : (log.Note ?? string.Empty);

        var dateStr = RecordDate.OccurredAtToWatchedOnDate(log.OccurredAt, log.WatchedOn);
        var monthShort = IsEnglishLocale ? "Nov" : "11월";
        var dayNumber = "1";
        var dateShort = dateStr;
        if (DateTime.TryParse(dateStr, out var dt))
        {
            monthShort = IsEnglishLocale ? dt.ToString("MMM", System.Globalization.CultureInfo.InvariantCulture) : $"{dt.Month}월";
            dayNumber = dt.Day.ToString();
            var dow = new[] { "일", "월", "화", "수", "목", "금", "토" }[(int)dt.DayOfWeek];
            dateShort = IsEnglishLocale
                ? dt.ToString("MMM d", System.Globalization.CultureInfo.InvariantCulture)
                : $"{dt.Month}월 {dt.Day}일 {dow}";
        }

        var kdcBadge = isBook && !string.IsNullOrWhiteSpace(log.Title.KdcCode)
            ? $"KDC {log.Title.KdcCode}"
            : (isBook ? (IsEnglishLocale ? "Bookshelf" : "서가 보관") : string.Empty);

        return new WatchLogDisplayItem(
            Log: log,
            TypeBadge: typeBadge,
            TypeAndYear: typeAndYear,
            CreatorLine: creatorLine,
            StatusBadge: statusBadge,
            FeelingBadge: feelingBadge,
            StatusAndFeelingLine: statusAndFeeling,
            EditionLine: editionLine,
            MetaLine: metaLine,
            MomentSummary: moment,
            NotePreview: notePreview,
            RevisionBadge: IsEnglishLocale ? $"Polished {log.Revision}x" : $"남겨온 기록 {log.Revision}회",
            DateShortLabel: dateShort,
            MonthShortLabel: monthShort,
            DayNumberText: dayNumber,
            KdcBadge: kdcBadge,
            HasNote: hasNote,
            IsSpoilerHidden: log.Spoiler,
            IsBook: isBook
        );
    }

    public void Dispose()
    {
        _together.StateChanged -= OnTogetherCoordinatorStateChanged;
        _together.Dispose();
        _searchDebounceCts?.Cancel();
        _searchDebounceCts?.Dispose();
        _recommendationsCts?.Cancel();
        _recommendationsCts?.Dispose();
        _repo.Dispose();
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
