using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using Ottline.App.Services;
using Ottline.App.Theme;
using Ottline.App.ViewModels;
using Ottline.Core.Domain;
using Ottline.Core.Models;

namespace Ottline.App;

public partial class MainWindow : Window
{
    private sealed record PolylineData(System.Windows.Point[] Points, double[] CumLengths, double TotalLength);

    private static readonly Geometry BookFullGeometry = CreateFrozenGeometry(
        "M 14,34 L 14,28 C 14,22.477 18.477,18 24,18 C 34,18 41.5,21.8 48,27 C 55.8,21.8 65.5,18 77,18 C 82.523,18 87,22.477 87,28 L 87,64 C 87,69.523 82.523,74 77,74 C 66.5,74 57.2,76.9 51.5,81");

    private static readonly Geometry PlayClosedGeometry = CreateFrozenGeometry(
        "M 15,49 L 36.5,62.75 L 15,76.5 Z");

    private static readonly Geometry PlayOpenMeasureGeometry = CreateFrozenGeometry(
        "M 15,49 L 36.5,62.75 L 15,76.5 L 15,49");

    private static readonly PolylineData BookPolyline = FlattenGeometry(BookFullGeometry);
    private static readonly PolylineData PlayPolyline = FlattenGeometry(PlayOpenMeasureGeometry);

    private readonly MainViewModel _vm;
    private readonly DesktopIntegrationService _desktop;
    private readonly bool _shouldShowIntroSplash;
    private readonly bool _isHeadlessCapture;
    private Stopwatch? _introStopwatch;
    private bool _isIntroDismissing;
    private bool _allowExplicitExit;

    public MainWindow(string[] startupArgs, MainViewModel? viewModel = null)
    {
        InitializeComponent();

        var isHeadlessCapture = startupArgs.Any(a => string.Equals(a, "--headless-capture", StringComparison.OrdinalIgnoreCase));
        _isHeadlessCapture = isHeadlessCapture;
        _vm = viewModel ?? new MainViewModel();
        DataContext = _vm;

        _shouldShowIntroSplash = !isHeadlessCapture && startupArgs.Length == 0;
        BuildSplashTagline();
        IntroOverlay.Visibility = _shouldShowIntroSplash ? Visibility.Visible : Visibility.Collapsed;

        _desktop = new DesktopIntegrationService
        {
            SettingsProvider = () => _vm.Settings,
            SyncStatusProvider = () => _vm.SyncStatusText
        };

        if (isHeadlessCapture)
        {
            return;
        }

        _desktop.ExternalCommandReceived += rawArg => _ = _vm.HandleExternalUriOrShareAsync(rawArg);
        _desktop.QuickRecordShortcutTriggered += () =>
        {
            RestoreAndActivateWindow();
            _vm.OpenQuickRecordModal();
        };
        _desktop.WatchReminderTriggered += candidate =>
        {
            _vm.ActiveWatchBanner = candidate;
            RestoreAndActivateWindow();
            _vm.OpenQuickRecordModal(
                prefilledPlatform: candidate.PlatformName,
                prefilledFilter: ContentFilter.VIDEO
            );
        };
        _desktop.SyncRequestedFromTray += () => _ = _vm.SyncNowAsync();
        _desktop.RestoreRequestedFromTray += RestoreAndActivateWindow;
        _desktop.ExitRequestedFromTray += () =>
        {
            _allowExplicitExit = true;
            Close();
        };

        ApplySavedWindowBounds();

        SourceInitialized += (_, _) =>
        {
            OttlineThemeManager.ApplyWindowTitleBarTheme(this, OttlineThemeManager.IsDarkActive);
        };

        StateChanged += (_, _) =>
        {
            Title = WindowState == WindowState.Minimized ? "ottline" : string.Empty;
            if (WindowState == WindowState.Minimized)
            {
                DesktopIntegrationService.TrimProcessMemory(emptyWorkingSet: true);
            }
        };

        Loaded += async (_, _) =>
        {
            OttlineThemeManager.ApplyWindowTitleBarTheme(this, OttlineThemeManager.IsDarkActive);
            _desktop.Initialize(this);
            if (_shouldShowIntroSplash)
            {
                StartIntroSplashAnimation();
            }
            else
            {
                _ = Task.Run(async () =>
                {
                    await Task.Delay(1500);
                    DesktopIntegrationService.TrimProcessMemory(emptyWorkingSet: true);
                });
            }

            if (startupArgs.Length > 0)
            {
                await _vm.HandleExternalUriOrShareAsync(string.Join(" ", startupArgs));
            }
            else
            {
                _vm.TryAutoLaunchStoreUpgradeHandoff();
            }

            _ = _vm.SyncNowAsync(silent: true);
        };
    }

    private void HeaderBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.Handled) return;

        if (e.OriginalSource is DependencyObject source)
        {
            DependencyObject? curr = source;
            while (curr != null && curr != sender)
            {
                if (curr is System.Windows.Controls.Primitives.ButtonBase)
                {
                    return;
                }
                curr = curr is ContentElement ce
                    ? LogicalTreeHelper.GetParent(ce)
                    : VisualTreeHelper.GetParent(curr);
            }
        }

        if (e.ClickCount == 2)
        {
            WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
            return;
        }

        try
        {
            DragMove();
        }
        catch
        {
            // Ignore if mouse button was released before DragMove started
        }
    }

    private void ApplySavedWindowBounds()
    {
        var saved = DesktopIntegrationService.LoadWindowPlacement();
        if (saved == null) return;
        if (saved.Width >= 960 && saved.Height >= 640)
        {
            Width = saved.Width;
            Height = saved.Height;
            Left = saved.Left;
            Top = saved.Top;
        }
        if (saved.IsMaximized)
        {
            WindowState = WindowState.Maximized;
        }
    }

    private void BuildSplashTagline()
    {
        SplashTaglineRow.Children.Clear();
        const string tagline = "ON THE TIMELINE";
        for (var i = 0; i < tagline.Length; i++)
        {
            var ch = tagline[i];
            if (ch == ' ')
            {
                SplashTaglineRow.Children.Add(new System.Windows.Controls.Border { Width = 4.5 });
                continue;
            }
            var tb = new System.Windows.Controls.TextBlock
            {
                Text = ch.ToString(),
                FontSize = 9.5,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 0, i < tagline.Length - 1 ? 1.8 : 0, 0)
            };
            tb.SetResourceReference(System.Windows.Controls.TextBlock.ForegroundProperty, "AccentOrangeBrush");
            SplashTaglineRow.Children.Add(tb);
        }
    }

    private void StartIntroSplashAnimation()
    {
        if (IntroOverlay.Visibility != Visibility.Visible || _isIntroDismissing) return;

        SplashGlowMidStop.Color = OttlineThemeManager.IsDarkActive
            ? System.Windows.Media.Color.FromArgb(0x0D, 0x8B, 0xB4, 0xEE)
            : System.Windows.Media.Color.FromArgb(0x0D, 0x1E, 0x4D, 0x8C);

        _introStopwatch = Stopwatch.StartNew();
        CompositionTarget.Rendering -= OnIntroRendering;
        CompositionTarget.Rendering += OnIntroRendering;
    }

    private void OnIntroRendering(object? sender, EventArgs e)
    {
        if (_isIntroDismissing || _introStopwatch == null)
        {
            CompositionTarget.Rendering -= OnIntroRendering;
            return;
        }

        var ms = _introStopwatch.Elapsed.TotalMilliseconds;
        var strokeProg = FastOutSlowIn(Math.Clamp((ms - 150.0) / 780.0, 0.0, 1.0));
        var copyProg = LinearOutSlowIn(Math.Clamp((ms - 370.0) / 620.0, 0.0, 1.0));
        var lineProg = FastOutSlowIn(Math.Clamp((ms - 450.0) / 1350.0, 0.0, 1.0));

        SplashRadialGlow.Opacity = strokeProg;

        var markScale = 0.86 + 0.14 * strokeProg;
        SplashMarkScale.ScaleX = markScale;
        SplashMarkScale.ScaleY = markScale;
        SplashMarkContainer.Opacity = Math.Clamp(strokeProg * 1.4, 0.0, 1.0);

        SplashBookStrokePath.Data = BuildPartialGeometry(BookPolyline, strokeProg, BookFullGeometry);
        var playProg = Math.Clamp((strokeProg - 0.25) / 0.75, 0.0, 1.0);
        SplashPlayStrokePath.Data = BuildPartialGeometry(PlayPolyline, playProg, PlayClosedGeometry);
        SplashPlayFillPath.Opacity = playProg >= 0.85
            ? Math.Clamp((playProg - 0.85) / 0.15, 0.0, 1.0) * 0.18
            : 0.0;

        SplashCopyPanel.Opacity = copyProg;
        SplashCopyTranslate.Y = (1.0 - copyProg) * 14.0;

        SplashTimelineActiveLine.X2 = 6.0 + 100.0 * lineProg;
        SplashDot2.Visibility = lineProg >= 0.50 ? Visibility.Visible : Visibility.Collapsed;
        SplashDot3.Visibility = lineProg >= 0.95 ? Visibility.Visible : Visibility.Collapsed;

        if (ms >= 2150.0)
        {
            DismissIntroOverlay();
        }
    }

    private void DismissIntroOverlay()
    {
        if (_isIntroDismissing || IntroOverlay.Visibility != Visibility.Visible) return;
        _isIntroDismissing = true;
        CompositionTarget.Rendering -= OnIntroRendering;
        _introStopwatch?.Stop();

        var ease = new CubicEase { EasingMode = EasingMode.EaseInOut };
        var duration = TimeSpan.FromMilliseconds(360);
        var fade = new DoubleAnimation(IntroOverlay.Opacity, 0.0, duration) { EasingFunction = ease };
        var scaleX = new DoubleAnimation(1.0, 1.03, duration) { EasingFunction = ease };
        var scaleY = new DoubleAnimation(1.0, 1.03, duration) { EasingFunction = ease };
        fade.Completed += (_, _) =>
        {
            IntroOverlay.Visibility = Visibility.Collapsed;
            Task.Run(() => DesktopIntegrationService.TrimProcessMemory(emptyWorkingSet: true));
        };
        IntroOverlay.BeginAnimation(OpacityProperty, fade);
        IntroOverlayScale.BeginAnimation(ScaleTransform.ScaleXProperty, scaleX);
        IntroOverlayScale.BeginAnimation(ScaleTransform.ScaleYProperty, scaleY);
    }

    private static Geometry CreateFrozenGeometry(string pathData)
    {
        var g = Geometry.Parse(pathData);
        g.Freeze();
        return g;
    }

    private static PolylineData FlattenGeometry(Geometry geometry)
    {
        var flat = geometry.GetFlattenedPathGeometry(0.05, ToleranceType.Absolute);
        var pts = new List<System.Windows.Point>();
        foreach (var fig in flat.Figures)
        {
            pts.Add(fig.StartPoint);
            foreach (var seg in fig.Segments)
            {
                if (seg is PolyLineSegment pls)
                {
                    pts.AddRange(pls.Points);
                }
                else if (seg is LineSegment ls)
                {
                    pts.Add(ls.Point);
                }
            }
            if (fig.IsClosed && pts.Count > 0 && pts[^1] != fig.StartPoint)
            {
                pts.Add(fig.StartPoint);
            }
        }

        if (pts.Count == 0)
        {
            return new PolylineData(Array.Empty<System.Windows.Point>(), Array.Empty<double>(), 0.0);
        }

        var cum = new double[pts.Count];
        cum[0] = 0.0;
        for (var i = 1; i < pts.Count; i++)
        {
            var dx = pts[i].X - pts[i - 1].X;
            var dy = pts[i].Y - pts[i - 1].Y;
            cum[i] = cum[i - 1] + Math.Sqrt(dx * dx + dy * dy);
        }
        return new PolylineData(pts.ToArray(), cum, cum[^1]);
    }

    private static Geometry BuildPartialGeometry(PolylineData poly, double progress, Geometry completedGeometry)
    {
        if (progress <= 0.001 || poly.Points.Length < 2 || poly.TotalLength <= 0.0)
        {
            return Geometry.Empty;
        }
        if (progress >= 0.999)
        {
            return completedGeometry;
        }

        var target = poly.TotalLength * progress;
        var sg = new StreamGeometry();
        using (var ctx = sg.Open())
        {
            var pts = poly.Points;
            var cum = poly.CumLengths;
            ctx.BeginFigure(pts[0], isFilled: false, isClosed: false);
            for (var i = 1; i < pts.Length; i++)
            {
                if (cum[i] <= target)
                {
                    ctx.LineTo(pts[i], isStroked: true, isSmoothJoin: false);
                }
                else
                {
                    var segLen = cum[i] - cum[i - 1];
                    if (segLen > 0.0001)
                    {
                        var frac = Math.Clamp((target - cum[i - 1]) / segLen, 0.0, 1.0);
                        var endPt = new System.Windows.Point(
                            pts[i - 1].X + (pts[i].X - pts[i - 1].X) * frac,
                            pts[i - 1].Y + (pts[i].Y - pts[i - 1].Y) * frac);
                        ctx.LineTo(endPt, isStroked: true, isSmoothJoin: false);
                    }
                    break;
                }
            }
        }
        sg.Freeze();
        return sg;
    }

    private static double FastOutSlowIn(double x) => EvaluateCubicBezier(0.4, 0.0, 0.2, 1.0, x);
    private static double LinearOutSlowIn(double x) => EvaluateCubicBezier(0.0, 0.0, 0.2, 1.0, x);

    private static double EvaluateCubicBezier(double p1x, double p1y, double p2x, double p2y, double x)
    {
        x = Math.Clamp(x, 0.0, 1.0);
        if (x <= 0.0) return 0.0;
        if (x >= 1.0) return 1.0;

        double lo = 0.0, hi = 1.0, t = 0.5;
        for (var i = 0; i < 16; i++)
        {
            t = 0.5 * (lo + hi);
            var bx = CubicCoord(p1x, p2x, t);
            if (bx < x) lo = t;
            else hi = t;
        }
        return CubicCoord(p1y, p2y, 0.5 * (lo + hi));
    }

    private static double CubicCoord(double p1, double p2, double t)
    {
        var mt = 1.0 - t;
        return 3.0 * mt * mt * t * p1 + 3.0 * mt * t * t * p2 + t * t * t;
    }

    private void RestoreAndActivateWindow()
    {
        Show();
        if (WindowState == WindowState.Minimized)
        {
            WindowState = WindowState.Normal;
        }
        Activate();
        Topmost = true;
        Topmost = false;
        Focus();
    }

    private void Window_PreviewKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (IntroOverlay.Visibility == Visibility.Visible &&
            !_isIntroDismissing &&
            (e.Key == Key.Escape || e.Key == Key.Enter || e.Key == Key.Space))
        {
            DismissIntroOverlay();
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Escape)
        {
            if (_vm.IsShareSheetOpen) { _vm.IsShareSheetOpen = false; e.Handled = true; return; }
            if (_vm.IsQuickRecordOpen) { _vm.IsQuickRecordOpen = false; e.Handled = true; return; }
            if (_vm.IsTitleDetailOpen) { _vm.IsTitleDetailOpen = false; e.Handled = true; return; }
            if (_vm.IsDiscussionDetailOpen) { _vm.IsDiscussionDetailOpen = false; e.Handled = true; return; }
            if (_vm.IsWriteDiscussionOpen) { _vm.IsWriteDiscussionOpen = false; e.Handled = true; return; }
        }

        if ((Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control &&
            (e.Key == Key.K || e.Key == Key.N))
        {
            _vm.OpenQuickRecordModal();
            QuickSearchTextBox.Focus();
            e.Handled = true;
        }
    }

    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        if (_isHeadlessCapture) return;

        DesktopIntegrationService.SaveWindowPlacement(this);

        if (!_allowExplicitExit && _vm.Settings.MinimizeToTray)
        {
            e.Cancel = true;
            Hide();
            DesktopIntegrationService.TrimProcessMemory(emptyWorkingSet: true);
            _vm.ShowToast(_vm.IsEnglishLocale
                ? "ottline is still running in the system tray."
                : "ottline이 시스템 트레이에서 계속 실행됩니다.");
            return;
        }

        CompositionTarget.Rendering -= OnIntroRendering;
        _desktop.Dispose();
        _vm.Dispose();
    }

    // ==================== HEADER & NAVIGATION ====================
    private void BrandHeader_Click(object sender, MouseButtonEventArgs e) => _vm.CurrentTab = MainTab.HOME;
    private void NavHome_Click(object sender, RoutedEventArgs e) => _vm.CurrentTab = MainTab.HOME;
    private void NavTimeline_Click(object sender, RoutedEventArgs e) => _vm.CurrentTab = MainTab.TIMELINE;
    private void NavTogether_Click(object sender, RoutedEventArgs e) => _vm.CurrentTab = MainTab.TOGETHER;
    private void NavMySpace_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentTab = MainTab.MY_SPACE;
        _vm.CurrentMySpaceSection = MySpaceSection.PROFILE_SYNC;
    }

    private void SyncNow_Click(object sender, RoutedEventArgs e) => _ = _vm.SyncNowAsync();
    private void ToggleTheme_Click(object sender, RoutedEventArgs e) => _vm.ToggleThemeMode();
    private void ToggleLocale_Click(object sender, RoutedEventArgs e) => _vm.ToggleLocale();
    private void SetLocaleKo_Click(object sender, RoutedEventArgs e) => _vm.SetLocale("ko");
    private void SetLocaleEn_Click(object sender, RoutedEventArgs e) => _vm.SetLocale("en");

    private void OpenQuickRecord_Click(object sender, RoutedEventArgs e)
    {
        _vm.OpenQuickRecordModal();
        QuickSearchTextBox.Focus();
    }

    // ==================== HOME EVENTS ====================
    private void WatchBannerRecord_Click(object sender, RoutedEventArgs e)
    {
        var platform = _vm.ActiveWatchBanner?.PlatformName;
        _vm.OpenQuickRecordModal(prefilledPlatform: platform, prefilledFilter: ContentFilter.VIDEO);
    }

    private void WatchBannerDismiss_Click(object sender, RoutedEventArgs e) => _vm.ActiveWatchBanner = null;
    private void StartEdgeHandoff_Click(object sender, RoutedEventArgs e) => _vm.StartBrowserSessionHandoff(preferMicrosoftEdge: true);
    private void StartBrowserHandoff_Click(object sender, RoutedEventArgs e) => _vm.StartBrowserSessionHandoff(preferMicrosoftEdge: false);

    private void OpenPairCodeSection_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentTab = MainTab.MY_SPACE;
        _vm.CurrentMySpaceSection = MySpaceSection.PROFILE_SYNC;
    }

    private void OpenMySpaceConnect_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentTab = MainTab.MY_SPACE;
        _vm.CurrentMySpaceSection = MySpaceSection.PROFILE_SYNC;
    }

    private void ActivationPosterCard_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is TitleSummary title)
        {
            _vm.OpenQuickRecordModal(preselectedTitle: title);
        }
    }

    private void DismissMigrationBanner_Click(object sender, RoutedEventArgs e) => _vm.DismissMigrationBanner();
    private void PrevHomeMonth_Click(object sender, RoutedEventArgs e) => _vm.ShiftHomeMonth(-1);
    private void NextHomeMonth_Click(object sender, RoutedEventArgs e) => _vm.ShiftHomeMonth(1);

    private void SelectHomeMonth_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string monthKey)
        {
            _vm.SelectHomeMonth(monthKey);
        }
    }

    private void FeaturedWarmthCard_Click(object sender, MouseButtonEventArgs e)
    {
        if (_vm.FeaturedWarmthItem != null) _vm.OpenTitleDetail(_vm.FeaturedWarmthItem.Log);
    }

    private void FeaturedWarmthDetail_Click(object sender, RoutedEventArgs e)
    {
        if (_vm.FeaturedWarmthItem != null) _vm.OpenTitleDetail(_vm.FeaturedWarmthItem.Log);
    }

    private void FeaturedWarmthExportPng_Click(object sender, RoutedEventArgs e)
    {
        if (_vm.FeaturedWarmthItem != null) PromptAndExportShareCardPng(_vm.FeaturedWarmthItem.Log);
    }

    private void WatchLogCard_Click(object sender, MouseButtonEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.DataContext is WatchLogDisplayItem item)
        {
            _vm.OpenTitleDetail(item.Log);
        }
    }

    private void OpenLogDetailButton_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is FrameworkElement fe && fe.Tag is WatchLog log)
        {
            _vm.OpenTitleDetail(log);
        }
    }

    private void PolishLogButton_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is FrameworkElement fe && fe.Tag is WatchLog log)
        {
            _vm.OpenQuickRecordModal(existingLogToEdit: log);
        }
    }

    private void TimelineShareCard_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is FrameworkElement fe && fe.Tag is WatchLog log)
        {
            PromptAndExportShareCardPng(log);
        }
    }

    private void TimelineShareTogether_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is FrameworkElement fe && fe.Tag is WatchLog log)
        {
            _vm.CurrentTab = MainTab.TOGETHER;
            _vm.NewDiscussionTitleQuery = log.Title.Title;
            _vm.NewDiscussionBody = log.Note ?? string.Empty;
            _vm.IsWriteDiscussionOpen = true;
        }
    }

    private void HomeMomentCard_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is HomeMomentLinkItem item)
        {
            if (item.Kind == "PLACE")
            {
                _vm.ApplyMomentQuickFilter(place: item.Value);
            }
            else
            {
                _vm.ApplyMomentQuickFilter(occasion: item.Value);
            }
        }
    }

    private void HomePlaceChip_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string place)
        {
            _vm.ApplyMomentQuickFilter(place: place);
        }
    }

    private void HomeOccasionChip_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string occasion)
        {
            _vm.ApplyMomentQuickFilter(occasion: occasion);
        }
    }

    private void OpenReportShortcut_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentTab = MainTab.MY_SPACE;
        _vm.CurrentMySpaceSection = MySpaceSection.REPORT;
    }

    private void OpenBookshelfShortcut_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentTab = MainTab.MY_SPACE;
        _vm.CurrentMySpaceSection = MySpaceSection.BOOKSHELF;
    }

    private void OpenGuidesShortcut_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentTab = MainTab.MY_SPACE;
        _vm.CurrentMySpaceSection = MySpaceSection.GUIDES;
    }

    private void OpenFeedbackShortcut_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentTab = MainTab.MY_SPACE;
        _vm.CurrentMySpaceSection = MySpaceSection.FEEDBACK;
        _ = _vm.LoadFeedbackThreadsAsync();
    }

    // ==================== TIMELINE EVENTS ====================
    private void FilterTimelineAll_Click(object sender, RoutedEventArgs e) => _vm.TimelineContentFilter = ContentFilter.ALL;
    private void FilterTimelineVideo_Click(object sender, RoutedEventArgs e) => _vm.TimelineContentFilter = ContentFilter.VIDEO;
    private void FilterTimelineBook_Click(object sender, RoutedEventArgs e) => _vm.TimelineContentFilter = ContentFilter.BOOK;
    private void ToggleMomentFilter_Click(object sender, RoutedEventArgs e) => _vm.IsMomentFilterOpen = !_vm.IsMomentFilterOpen;
    private void ToggleRecommendations_Click(object sender, RoutedEventArgs e) => _vm.IsRecommendationsOpen = !_vm.IsRecommendationsOpen;
    private void ClearTimelineFilters_Click(object sender, RoutedEventArgs e) => _vm.ClearTimelineFilters();
    private void FilterFeelingSatisfied_Click(object sender, RoutedEventArgs e) => _vm.ApplyMomentQuickFilter(feeling: RecordFeeling.SATISFIED);
    private void FilterFeelingNeutral_Click(object sender, RoutedEventArgs e) => _vm.ApplyMomentQuickFilter(feeling: RecordFeeling.NEUTRAL);
    private void FilterFeelingDisappointed_Click(object sender, RoutedEventArgs e) => _vm.ApplyMomentQuickFilter(feeling: RecordFeeling.DISAPPOINTED);
    private void FilterStatusDone_Click(object sender, RoutedEventArgs e) => _vm.ApplyMomentQuickFilter(status: LogStatus.DONE);
    private void FilterStatusInProgress_Click(object sender, RoutedEventArgs e) => _vm.ApplyMomentQuickFilter(status: LogStatus.IN_PROGRESS);
    private void FilterStatusWishlist_Click(object sender, RoutedEventArgs e) => _vm.ApplyMomentQuickFilter(status: LogStatus.WISHLIST);
    private void RefreshRecommendations_Click(object sender, RoutedEventArgs e) => _ = _vm.LoadRecommendationsAsync(forceRefresh: true);

    private void RecommendationLog_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is TitleSummary title)
        {
            _vm.OpenQuickRecordModal(preselectedTitle: title);
        }
    }

    private void RecommendationExclude_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is RecommendationItem item)
        {
            _ = _vm.ExcludeRecommendationAsync(item);
        }
    }

    private void ExportTimelineCsv_Click(object sender, RoutedEventArgs e)
    {
        var sfd = new Microsoft.Win32.SaveFileDialog
        {
            Title = "타임라인 기록 CSV 내보내기",
            Filter = "CSV 파일 (*.csv)|*.csv",
            FileName = $"ottline-timeline-{RecordDate.TodayDate()}.csv"
        };
        if (sfd.ShowDialog(this) == true)
        {
            var csv = CsvExporter.ExportLogsToCsv(_vm.Repository.GetAllLogs());
            File.WriteAllText(sfd.FileName, csv);
            _vm.ShowToast($"CSV 파일이 저장되었습니다: {Path.GetFileName(sfd.FileName)}");
        }
    }

    // ==================== TITLE DETAIL OVERLAY EVENTS ====================
    private void CloseTitleDetail_Click(object sender, RoutedEventArgs e) => _vm.IsTitleDetailOpen = false;
    private void ToggleDetailSpoiler_Click(object sender, RoutedEventArgs e) => _vm.ToggleDetailSpoiler();

    private void PolishFromDetail_Click(object sender, RoutedEventArgs e)
    {
        if (_vm.SelectedDetailLog != null)
        {
            _vm.OpenQuickRecordModal(existingLogToEdit: _vm.SelectedDetailLog);
        }
    }

    private void ExportDetailShareCard_Click(object sender, RoutedEventArgs e)
    {
        if (_vm.SelectedDetailLog != null)
        {
            PromptAndExportShareCardPng(_vm.SelectedDetailLog);
        }
    }

    // ==================== TOGETHER EVENTS ====================
    private void SortTogetherLatest_Click(object sender, RoutedEventArgs e) => _vm.TogetherSort = DiscussionSort.LATEST;
    private void SortTogetherReactions_Click(object sender, RoutedEventArgs e) => _vm.TogetherSort = DiscussionSort.REACTIONS;
    private void SortTogetherComments_Click(object sender, RoutedEventArgs e) => _vm.TogetherSort = DiscussionSort.COMMENTS;
    private void OpenWriteDiscussion_Click(object sender, RoutedEventArgs e) => _vm.IsWriteDiscussionOpen = true;
    private void CloseWriteDiscussion_Click(object sender, RoutedEventArgs e) => _vm.IsWriteDiscussionOpen = false;
    private void SubmitNewDiscussion_Click(object sender, RoutedEventArgs e) => _ = _vm.SubmitNewDiscussionAsync();
    private void CloseDiscussionDetail_Click(object sender, RoutedEventArgs e) => _vm.IsDiscussionDetailOpen = false;
    private void SubmitComment_Click(object sender, RoutedEventArgs e) => _ = _vm.SubmitDiscussionCommentAsync();

    private void OpenDiscussionDetail_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is DiscussionPost post)
        {
            _ = _vm.OpenDiscussionDetailAsync(post);
        }
    }

    private void ReactDone_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is DiscussionPost post)
            _vm.ReactToDiscussion(post, DiscussionReactionType.DONE);
    }

    private void ReactCurious_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is DiscussionPost post)
            _vm.ReactToDiscussion(post, DiscussionReactionType.CURIOUS);
    }

    private void ReactSave_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is DiscussionPost post)
            _vm.ReactToDiscussion(post, DiscussionReactionType.SAVE);
    }

    // ==================== MY SPACE EVENTS ====================
    private void MySpaceProfile_Click(object sender, RoutedEventArgs e) => _vm.CurrentMySpaceSection = MySpaceSection.PROFILE_SYNC;
    private void MySpaceReport_Click(object sender, RoutedEventArgs e) => _vm.CurrentMySpaceSection = MySpaceSection.REPORT;
    private void MySpaceBookshelf_Click(object sender, RoutedEventArgs e) => _vm.CurrentMySpaceSection = MySpaceSection.BOOKSHELF;
    private void MySpaceWatchReminder_Click(object sender, RoutedEventArgs e) => _vm.CurrentMySpaceSection = MySpaceSection.WATCH_REMINDER;
    private void MySpaceFeedback_Click(object sender, RoutedEventArgs e)
    {
        _vm.CurrentMySpaceSection = MySpaceSection.FEEDBACK;
        _ = _vm.LoadFeedbackThreadsAsync();
    }
    private void MySpaceGuides_Click(object sender, RoutedEventArgs e) => _vm.CurrentMySpaceSection = MySpaceSection.GUIDES;
    private void MySpaceImportAdvanced_Click(object sender, RoutedEventArgs e) => _vm.CurrentMySpaceSection = MySpaceSection.IMPORT_ADVANCED;

    private void ToggleProfileEditor_Click(object sender, RoutedEventArgs e) =>
        _vm.IsProfileEditorOpen = !_vm.IsProfileEditorOpen;

    private void AvatarOption_Click(object sender, MouseButtonEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string key)
        {
            _vm.EditAvatarKey = key;
        }
    }

    private void SaveProfile_Click(object sender, RoutedEventArgs e) => _ = _vm.SaveProfileAsync();

    private async void CopyRecoveryCode_Click(object sender, RoutedEventArgs e)
    {
        await _vm.IssueOrRefreshRecoveryCodeAsync();
        try
        {
            System.Windows.Clipboard.SetText(_vm.DisplayRecoveryCode);
            _vm.ShowToast($"연결 코드가 클립보드에 복사되었습니다: {_vm.DisplayRecoveryCode}");
        }
        catch
        {
            _vm.ShowToast($"연결 코드: {_vm.DisplayRecoveryCode}");
        }
    }

    private async void ExportRecoveryCard_Click(object sender, RoutedEventArgs e)
    {
        await _vm.IssueOrRefreshRecoveryCodeAsync();
        var sfd = new Microsoft.Win32.SaveFileDialog
        {
            Title = "ottline 복구 카드 PNG 저장",
            Filter = "PNG 이미지 (*.png)|*.png",
            FileName = $"ottline-recovery-card-{RecordDate.TodayDate()}.png"
        };
        if (sfd.ShowDialog(this) == true)
        {
            CardImageExporter.ExportRecoveryCardPng(_vm.Settings, sfd.FileName);
            _vm.ShowToast($"복구 카드 PNG가 저장되었습니다: {Path.GetFileName(sfd.FileName)}");
        }
    }

    private void PreviewPair_Click(object sender, RoutedEventArgs e) => _ = _vm.PreviewPairCodeAsync();
    private void ConfirmPairMerge_Click(object sender, RoutedEventArgs e) => _ = _vm.ConfirmPairMergeAsync();

    private void ExportRecapCard_Click(object sender, RoutedEventArgs e)
    {
        var sfd = new Microsoft.Win32.SaveFileDialog
        {
            Title = "ottline 9:16 리캡 카드 PNG 저장",
            Filter = "PNG 이미지 (*.png)|*.png",
            FileName = $"ottline-recap-9x16-{RecordDate.TodayDate()}.png"
        };
        if (sfd.ShowDialog(this) == true)
        {
            CardImageExporter.ExportRecapCardPng(_vm.PersonalReport, _vm.Settings, "올해의 온기", sfd.FileName);
            _vm.ShowToast($"9:16 리캡 카드 PNG가 저장되었습니다: {Path.GetFileName(sfd.FileName)}");
        }
    }

    private void DesktopPrefChanged_Click(object sender, RoutedEventArgs e)
    {
        var globalHotkey = GlobalHotkeyToggleBox.IsChecked ?? true;
        _vm.UpdateDesktopPreference(
            watchReminder: WatchReminderToggleBox.IsChecked ?? true,
            revisitReminder: RevisitReminderToggleBox.IsChecked ?? true,
            globalHotkey: globalHotkey,
            minimizeToTray: MinimizeToTrayToggleBox.IsChecked ?? true
        );
        _desktop.UpdateGlobalHotkey(globalHotkey);
    }

    private void TestWatchReminder_Click(object sender, RoutedEventArgs e)
    {
        _desktop.ShowWatchReminderNotification("Netflix", _vm.Settings.Locale, 25);
        _vm.ShowToast("Windows 데스크톱 OTT 시청 종료 알림 테스트를 발송했습니다.");
    }

    private void WidgetPreviewHero_Click(object sender, MouseButtonEventArgs e)
    {
        var titleId = _vm.WidgetPreviewSnapshot.ContinueItem?.TitleId;
        var uri = !string.IsNullOrWhiteSpace(titleId)
            ? $"ottline://quick?title_id={Uri.EscapeDataString(titleId)}"
            : "ottline://quick?type=all";
        _ = _vm.HandleExternalUriOrShareAsync(uri);
    }

    private void WidgetPreviewQuickRecord_Click(object sender, RoutedEventArgs e) =>
        _ = _vm.HandleExternalUriOrShareAsync("ottline://quick?type=all");

    private void WidgetPreviewVideo_Click(object sender, RoutedEventArgs e) =>
        _ = _vm.HandleExternalUriOrShareAsync("ottline://quick?type=video");

    private void WidgetPreviewBook_Click(object sender, RoutedEventArgs e) =>
        _ = _vm.HandleExternalUriOrShareAsync("ottline://quick?type=book");

    private void WidgetPreviewTimeline_Click(object sender, RoutedEventArgs e) =>
        _ = _vm.HandleExternalUriOrShareAsync("ottline://timeline");

    private void SubmitFeedback_Click(object sender, RoutedEventArgs e) => _ = _vm.SubmitFeedbackThreadAsync();

    private void SelectFeedbackThread_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is FeedbackThread thread)
        {
            _vm.SelectedFeedbackThread = thread;
        }
    }

    private void ImportNetflixCsv_Click(object sender, RoutedEventArgs e)
    {
        var ofd = new Microsoft.Win32.OpenFileDialog
        {
            Title = "Netflix ViewingActivity.csv 선택",
            Filter = "CSV 파일 (*.csv)|*.csv|모든 파일 (*.*)|*.*"
        };
        if (ofd.ShowDialog(this) == true)
        {
            var content = File.ReadAllText(ofd.FileName);
            var count = _vm.Repository.ImportNetflixCsv(content);
            _vm.RefreshLocalState();
            _vm.ShowToast($"넷플릭스 시청 기록 {count}건을 타임라인으로 가져왔습니다.");
        }
    }

    private void SwitchServerPreset_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string url)
        {
            ServerUrlTextBox.Text = url;
            _vm.UpdateDesktopPreference(baseUrl: url);
        }
    }

    private void ApplyCustomServerUrl_Click(object sender, RoutedEventArgs e)
    {
        _vm.UpdateDesktopPreference(baseUrl: ServerUrlTextBox.Text);
    }

    private void LocalReset_Click(object sender, RoutedEventArgs e)
    {
        var res = System.Windows.MessageBox.Show(
            this,
            _vm.Strings.LocalResetConfirmBody,
            _vm.Strings.LocalResetConfirmTitle,
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning
        );
        if (res == MessageBoxResult.Yes)
        {
            _vm.ResetLocalCacheOnly();
        }
    }

    private async void ServerDeleteAccount_Click(object sender, RoutedEventArgs e)
    {
        if (!_vm.CanDeleteServerAccount)
        {
            if (!_vm.HasConnectedServerAccount)
            {
                _vm.ShowToast(_vm.Strings.DeleteAccountNotConnectedNotice);
            }
            return;
        }

        var res = System.Windows.MessageBox.Show(
            this,
            _vm.Strings.DeleteAccountConfirmBody,
            _vm.Strings.DeleteAccountConfirmTitle,
            MessageBoxButton.YesNo,
            MessageBoxImage.Stop
        );
        if (res == MessageBoxResult.Yes)
        {
            try
            {
                await _vm.DeleteServerAccountPermanentlyAsync();
            }
            catch
            {
                _vm.ShowToast(_vm.Strings.DeleteAccountFailedNotice);
            }
        }
    }

    // ==================== QUICK RECORD MODAL EVENTS ====================
    private void CloseQuickRecord_Click(object sender, RoutedEventArgs e) => _vm.IsQuickRecordOpen = false;
    private void QuickFilterAll_Click(object sender, RoutedEventArgs e) => _vm.QuickSearchFilter = ContentFilter.ALL;
    private void QuickFilterVideo_Click(object sender, RoutedEventArgs e) => _vm.QuickSearchFilter = ContentFilter.VIDEO;
    private void QuickFilterBook_Click(object sender, RoutedEventArgs e) => _vm.QuickSearchFilter = ContentFilter.BOOK;

    private void SelectQuickSearchResult_Click(object sender, MouseButtonEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is TitleSummary title)
        {
            _vm.SelectTitleForQuickRecord(title);
        }
    }

    private void CreateManualVideo_Click(object sender, RoutedEventArgs e) => _vm.CreateManualTitleForQuickRecord(isBook: false);
    private void CreateManualBook_Click(object sender, RoutedEventArgs e) => _vm.CreateManualTitleForQuickRecord(isBook: true);
    private void BackToQuickSearch_Click(object sender, RoutedEventArgs e) => _vm.QuickStage = QuickRecordStage.SEARCH;

    private void SetQuickStatusDone_Click(object sender, RoutedEventArgs e) => _vm.QuickStatus = LogStatus.DONE;
    private void SetQuickStatusInProgress_Click(object sender, RoutedEventArgs e) => _vm.QuickStatus = LogStatus.IN_PROGRESS;
    private void SetQuickStatusWishlist_Click(object sender, RoutedEventArgs e) => _vm.QuickStatus = LogStatus.WISHLIST;

    private void SetQuickFeelingSatisfied_Click(object sender, RoutedEventArgs e) => _vm.QuickFeeling = RecordFeeling.SATISFIED;
    private void SetQuickFeelingNeutral_Click(object sender, RoutedEventArgs e) => _vm.QuickFeeling = RecordFeeling.NEUTRAL;
    private void SetQuickFeelingDisappointed_Click(object sender, RoutedEventArgs e) => _vm.QuickFeeling = RecordFeeling.DISAPPOINTED;

    private void SetQuickDateToday_Click(object sender, RoutedEventArgs e) => _vm.QuickWatchedOn = RecordDate.TodayDate();
    private void SetQuickDateYesterday_Click(object sender, RoutedEventArgs e) => _vm.QuickWatchedOn = RecordDate.RelativeDate(-1);
    private void SetQuickDateThisMonth_Click(object sender, RoutedEventArgs e) => _vm.QuickWatchedOn = RecordDate.CurrentMonth();

    private void SelectQuickPlatformChip_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string val) _vm.QuickPlatform = val;
    }

    private void SelectQuickPlaceChip_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string val) _vm.QuickPlace = val;
    }

    private void SelectQuickOccasionChip_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string val) _vm.QuickOccasion = val;
    }

    private void CommitQuickRecord_Click(object sender, RoutedEventArgs e)
    {
        var saved = _vm.CommitQuickRecord();
        if (saved != null)
        {
            _desktop.NotifyLogSaved();
        }
    }

    private void ExportSavedQuickShareCard_Click(object sender, RoutedEventArgs e)
    {
        if (_vm.QuickLastSavedLog != null)
        {
            PromptAndExportShareCardPng(_vm.QuickLastSavedLog);
        }
    }

    private void EditSavedQuickRecord_Click(object sender, RoutedEventArgs e) => _vm.QuickStage = QuickRecordStage.FORM;

    private void Toast_Click(object sender, MouseButtonEventArgs e) =>
        _vm.GetType().GetProperty("IsToastVisible")?.SetValue(_vm, false);

    private void IntroOverlay_Click(object sender, MouseButtonEventArgs e) => DismissIntroOverlay();

    private void PromptAndExportShareCardPng(WatchLog log)
    {
        _vm.OpenShareSheet(log);
    }

    private void CloseShareSheet_Click(object sender, RoutedEventArgs e) => _vm.IsShareSheetOpen = false;
    private void ShareSheetFormatStory_Click(object sender, RoutedEventArgs e) => _vm.ShareFormat = "story";
    private void ShareSheetFormatFeed_Click(object sender, RoutedEventArgs e) => _vm.ShareFormat = "feed";

    private async void ShareSheetNativeShare_Click(object sender, RoutedEventArgs e)
    {
        var log = _vm.ShareSheetLog;
        if (log == null) return;

        var opened = await CardImageExporter.ShowWindowsNativeShareAsync(
            this,
            log,
            _vm.Settings,
            _vm.CurrentShareCardOptions,
            _vm.Settings.Locale
        );
        if (!opened)
        {
            _vm.ShowToast("클립보드에 공유 카드가 복사되었습니다. 원하는 곳에 붙여넣기(Ctrl+V) 해보세요.");
        }
    }

    private void ShareSheetCopyClipboard_Click(object sender, RoutedEventArgs e)
    {
        var log = _vm.ShareSheetLog;
        if (log == null) return;

        try
        {
            var bmp = CardImageExporter.RenderShareCardBitmap(log, _vm.Settings, _vm.CurrentShareCardOptions, _vm.Settings.Locale);
            System.Windows.Clipboard.SetImage(bmp);
            _vm.ShowToast("클립보드에 공유 카드 이미지가 복사되었습니다 (Ctrl+V).");
        }
        catch
        {
            _vm.ShowToast("클립보드 복사에 실패했습니다.");
        }
    }

    private void ShareSheetSavePng_Click(object sender, RoutedEventArgs e)
    {
        var log = _vm.ShareSheetLog;
        if (log == null) return;

        var safeTitle = string.Concat(log.Title.Title.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
        var suffix = string.Equals(_vm.ShareFormat, "feed", StringComparison.OrdinalIgnoreCase) ? "feed" : "story";
        var sfd = new Microsoft.Win32.SaveFileDialog
        {
            Title = "그날의 온기 공유 카드 PNG 저장",
            Filter = "PNG 이미지 (*.png)|*.png",
            FileName = $"ott-{safeTitle}-{suffix}.png"
        };
        if (sfd.ShowDialog(this) == true)
        {
            CardImageExporter.ExportShareCardPng(log, sfd.FileName, _vm.Settings.Locale, _vm.Settings, _vm.CurrentShareCardOptions);
            _vm.ShowToast($"공유 카드 PNG가 저장되었습니다: {Path.GetFileName(sfd.FileName)}");
        }
    }
}
