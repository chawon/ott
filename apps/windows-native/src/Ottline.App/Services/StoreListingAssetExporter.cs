using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Ottline.App.Theme;
using Ottline.App.ViewModels;
using Ottline.Core.Data;
using Ottline.Core.Domain;
using Ottline.Core.Local;
using Ottline.Core.Models;
using Ottline.Core.Remote;
using Color = System.Windows.Media.Color;
using FlowDirection = System.Windows.FlowDirection;
using HorizontalAlignment = System.Windows.HorizontalAlignment;

namespace Ottline.App.Services;

public static class StoreListingAssetExporter
{
    private static readonly Geometry BrandBookGeometry = CreateFrozenGeometry(
        "M 14,34 V 28 C 14,22.477 18.477,18 24,18 C 34,18 41.5,21.8 48,27 C 55.8,21.8 65.5,18 77,18 C 82.523,18 87,22.477 87,28 V 64 C 87,69.523 82.523,74 77,74 C 66.5,74 57.2,76.9 51.5,81");

    private static readonly Geometry BrandPlayGeometry = CreateFrozenGeometry(
        "M 15,49 L 36.5,62.75 L 15,76.5 Z");

    private static readonly SolidColorBrush CreamBgBrush = FrozenBrush("#F8F6F2");
    private static readonly SolidColorBrush CreamCircleBrush = FrozenBrush("#EFECE6");
    private static readonly SolidColorBrush CreamBorderBrush = FrozenBrush("#DFDBD3");
    private static readonly SolidColorBrush NavyBrush = FrozenBrush("#1E4D8C");
    private static readonly SolidColorBrush OrangeBrush = FrozenBrush("#FF9933");
    private static readonly SolidColorBrush NearBlackBrush = FrozenBrush("#0F0F0F");
    private static readonly SolidColorBrush CharcoalBrush = FrozenBrush("#4A4A4A");
    private static readonly SolidColorBrush WhiteBrush = FrozenBrush("#FFFFFF");

    public static int ExportAll(string outputDir)
    {
        Directory.CreateDirectory(outputDir);

        // 1. Export brand artwork (Icon, StoreLogoSquare, KO & EN 2:3 StoreLogo9x16 posters)
        RenderAndSaveBrandIcon(Path.Combine(outputDir, "store-icon-300x300.png"), 300, 300);
        RenderAndSaveSquareLogo(Path.Combine(outputDir, "store-logo-square-1080x1080.png"), 1080, 1080);
        RenderAndSavePosterArtwork(Path.Combine(outputDir, "store-poster-ko-720x1080.png"), isEn: false);
        RenderAndSavePosterArtwork(Path.Combine(outputDir, "store-poster-en-720x1080.png"), isEn: true);

        // 2. Resolve and prefetch posters for authentic v2 native screenshots
        var seededTitlesKo = BuildSeedCatalogAsync("ko").GetAwaiter().GetResult();
        var seededTitlesEn = BuildSeedCatalogAsync("en").GetAwaiter().GetResult();
        var allPosterUrls = seededTitlesKo.Values
            .Concat(seededTitlesEn.Values)
            .Select(t => t.PosterUrl)
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        UrlToImageSourceConverter.PrefetchUrlsAsync(allPosterUrls, isHero: true).GetAwaiter().GetResult();
        UrlToImageSourceConverter.PrefetchUrlsAsync(allPosterUrls, isHero: false).GetAwaiter().GetResult();

        // 3. Capture 4 KO + 4 EN 1920x1080 native desktop screenshots from real MainWindow WPF tree
        CaptureLocaleScreenshots(outputDir, "ko", seededTitlesKo);
        CaptureLocaleScreenshots(outputDir, "en", seededTitlesEn);

        return 0;
    }

    private static void RenderAndSaveBrandIcon(string outputPath, int width, int height)
    {
        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(CreamBgBrush, null, new Rect(0, 0, width, height));

            var scale = width * 0.62 / 100.0;
            dc.PushTransform(new TranslateTransform(width / 2.0, height / 2.0));
            dc.PushTransform(new ScaleTransform(scale, scale));
            dc.PushTransform(new TranslateTransform(-50.0, -49.5));

            var pen = new System.Windows.Media.Pen(NavyBrush, 8.0)
            {
                StartLineCap = PenLineCap.Round,
                EndLineCap = PenLineCap.Round,
                LineJoin = PenLineJoin.Round
            };
            pen.Freeze();
            dc.DrawGeometry(null, pen, BrandBookGeometry);
            dc.DrawGeometry(null, pen, BrandPlayGeometry);

            dc.Pop();
            dc.Pop();
            dc.Pop();
        }
        SaveDrawingVisualPng(visual, width, height, outputPath);
    }

    private static void RenderAndSaveSquareLogo(string outputPath, int width, int height)
    {
        var fontFamily = ResolveFontFamily();
        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(CreamBgBrush, null, new Rect(0, 0, width, height));
            dc.DrawEllipse(CreamCircleBrush, null, new System.Windows.Point(width * 0.92, height * 0.10), 260, 260);
            dc.DrawEllipse(CreamCircleBrush, null, new System.Windows.Point(width * 0.08, height * 0.88), 280, 280);

            // Centered mark above wordmark lockup
            var markScale = 2.65;
            dc.PushTransform(new TranslateTransform(width / 2.0, height * 0.37));
            dc.PushTransform(new ScaleTransform(markScale, markScale));
            dc.PushTransform(new TranslateTransform(-50.0, -49.5));
            var pen = new System.Windows.Media.Pen(NavyBrush, 8.0)
            {
                StartLineCap = PenLineCap.Round,
                EndLineCap = PenLineCap.Round,
                LineJoin = PenLineJoin.Round
            };
            pen.Freeze();
            dc.DrawGeometry(null, pen, BrandBookGeometry);
            dc.DrawGeometry(null, pen, BrandPlayGeometry);
            dc.Pop();
            dc.Pop();
            dc.Pop();

            var wordFt = CreateText("ottline", fontFamily, FontWeights.Bold, 118, NavyBrush);
            dc.DrawText(wordFt, new System.Windows.Point((width - wordFt.Width) / 2.0, height * 0.525));

            var subFt = CreateText("ON THE TIMELINE", fontFamily, FontWeights.SemiBold, 31, OrangeBrush);
            dc.DrawText(subFt, new System.Windows.Point((width - subFt.Width) / 2.0, height * 0.675));
        }
        SaveDrawingVisualPng(visual, width, height, outputPath);
    }

    private static void RenderAndSavePosterArtwork(string outputPath, bool isEn)
    {
        var width = 720;
        var height = 1080;
        var fontFamily = ResolveFontFamily();
        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(CreamBgBrush, null, new Rect(0, 0, width, height));
            dc.DrawEllipse(CreamCircleBrush, null, new System.Windows.Point(650, 120), 230, 230);
            dc.DrawEllipse(CreamCircleBrush, null, new System.Windows.Point(80, 960), 240, 240);

            // Upper two-thirds brand lockup + clear copy
            var markScale = 1.65;
            dc.PushTransform(new TranslateTransform(width / 2.0, 225));
            dc.PushTransform(new ScaleTransform(markScale, markScale));
            dc.PushTransform(new TranslateTransform(-50.0, -49.5));
            var pen = new System.Windows.Media.Pen(NavyBrush, 8.0)
            {
                StartLineCap = PenLineCap.Round,
                EndLineCap = PenLineCap.Round,
                LineJoin = PenLineJoin.Round
            };
            pen.Freeze();
            dc.DrawGeometry(null, pen, BrandBookGeometry);
            dc.DrawGeometry(null, pen, BrandPlayGeometry);
            dc.Pop();
            dc.Pop();
            dc.Pop();

            var wordFt = CreateText("ottline", fontFamily, FontWeights.Bold, 74, NavyBrush);
            dc.DrawText(wordFt, new System.Windows.Point((width - wordFt.Width) / 2.0, 326));

            var subFt = CreateText("ON THE TIMELINE", fontFamily, FontWeights.SemiBold, 20, OrangeBrush);
            dc.DrawText(subFt, new System.Windows.Point((width - subFt.Width) / 2.0, 418));

            var headline = isEn
                ? "Movies, Series, Books.\nKept on your timeline."
                : "영화, 시리즈, 책.\n그날의 순간을 남기는 타임라인";
            var headFt = CreateText(headline, fontFamily, FontWeights.Bold, isEn ? 40 : 38, NearBlackBrush, 600, TextAlignment.Center);
            dc.DrawText(headFt, new System.Windows.Point((width - headFt.Width) / 2.0, 496));

            var body = isEn
                ? "Start right away with no sign-up.\nPin the Windows 11 widget and save offline."
                : "가입 없이 몇 초 만에 가볍게 적고\nWindows 11 위젯과 타임라인으로 다시 만나요.";
            var bodyFt = CreateText(body, fontFamily, FontWeights.Normal, 22, CharcoalBrush, 580, TextAlignment.Center);
            dc.DrawText(bodyFt, new System.Windows.Point((width - bodyFt.Width) / 2.0, 636));

            var pill1 = isEn ? "+ Quick Record" : "+ 빠른 기록";
            var pill2 = isEn ? "Win + W Widget" : "Win + W 위젯";
            var pill3 = isEn ? "Windows Native" : "순수 네이티브";
            DrawFeaturePillsRow(dc, width, 790, fontFamily,
                (pill1, OrangeBrush, NearBlackBrush),
                (pill2, WhiteBrush, NearBlackBrush),
                (pill3, WhiteBrush, NavyBrush));
        }
        SaveDrawingVisualPng(visual, width, height, outputPath);
    }

    private static void DrawFeaturePillsRow(
        DrawingContext dc,
        double canvasWidth,
        double top,
        System.Windows.Media.FontFamily fontFamily,
        params (string Label, System.Windows.Media.Brush Fill, System.Windows.Media.Brush TextBrush)[] pills)
    {
        var items = new List<(string Label, FormattedText Text, double BoxW, System.Windows.Media.Brush Fill)>();
        const double height = 46;
        const double padX = 22;
        const double gap = 12;
        double totalW = 0;

        foreach (var p in pills)
        {
            var ft = CreateText(p.Label, fontFamily, FontWeights.SemiBold, 17, p.TextBrush);
            var w = ft.Width + padX * 2;
            items.Add((p.Label, ft, w, p.Fill));
            totalW += w;
        }
        totalW += gap * Math.Max(0, items.Count - 1);

        var borderPen = new System.Windows.Media.Pen(CreamBorderBrush, 1.2);
        borderPen.Freeze();

        var x = (canvasWidth - totalW) / 2.0;
        foreach (var item in items)
        {
            var rect = new Rect(x, top, item.BoxW, height);
            dc.DrawRoundedRectangle(item.Fill, item.Fill == OrangeBrush ? null : borderPen, rect, 8, 8);
            dc.DrawText(item.Text, new System.Windows.Point(x + padX, top + (height - item.Text.Height) / 2.0));
            x += item.BoxW + gap;
        }
    }

    private static void CaptureLocaleScreenshots(string outputDir, string locale, Dictionary<string, TitleSummary> catalog)
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        var tempDbPath = Path.Combine(Path.GetTempPath(), $"ottline_store_export_{locale}_{Guid.NewGuid():N}.db");

        try
        {
            using var db = new OttlineDatabase(tempDbPath);
            using var repo = new OttlineRepository(db);
            repo.UpdateSettings(s => s with
            {
                Locale = locale,
                ThemeMode = ThemeMode.LIGHT,
                DisplayName = isEn ? "Daniel" : "은하수",
                AvatarPreset = "cinema_keeper",
                RecoveryCode = "5HFN-PZ6K",
                HasCompletedBrowserHandoff = true,
                HasDismissedMigrationBanner = true,
                HasAutoAttemptedUpgradeHandoff = true,
                WatchReminderEnabled = true,
                RevisitReminderEnabled = true,
                GlobalHotkeyEnabled = true,
                MinimizeToTray = true
            });

            var seededLogs = SeedSampleLogs(repo, catalog, isEn);
            var vm = new MainViewModel(repo, skipStartupNetwork: true);
            var win = new MainWindow(new[] { "--headless-capture" }, vm);
            var appRoot = win.Content as FrameworkElement
                          ?? throw new InvalidOperationException("MainWindow root content missing");
            win.Content = null;
            appRoot.DataContext = vm;

            var appHost = new Border
            {
                Width = 1480,
                Height = 840,
                CornerRadius = new CornerRadius(12),
                BorderBrush = CreamBorderBrush,
                BorderThickness = new Thickness(1),
                Background = CreamBgBrush,
                ClipToBounds = true,
                Child = appRoot,
                Effect = new DropShadowEffect
                {
                    Color = Color.FromRgb(15, 15, 15),
                    BlurRadius = 36,
                    ShadowDepth = 10,
                    Opacity = 0.12
                }
            };
            TextElement.SetFontFamily(appHost, ResolveFontFamily());
            TextElement.SetForeground(appHost, NearBlackBrush);

            // Shot 1: Home
            vm.CurrentTab = MainTab.HOME;
            vm.IsQuickRecordOpen = false;
            ClearToast(vm);
            RenderShotFrame(
                appHost,
                appRoot,
                scrollMySpaceWidget: false,
                badgeText: isEn ? "PERSONAL RECORDBOOK" : "데스크톱 감상 수첩",
                headlineText: isEn ? "Movies, series, and books—kept warm on one timeline" : "영화·시리즈·책 기록을 따뜻한 타임라인 한곳에",
                outputPath: Path.Combine(outputDir, $"screenshot-{locale}-1-home.png")
            );

            // Shot 2: Quick Record Modal
            vm.CurrentTab = MainTab.HOME;
            vm.OpenQuickRecordModal(existingLogToEdit: seededLogs[0]);
            ClearToast(vm);
            RenderShotFrame(
                appHost,
                appRoot,
                scrollMySpaceWidget: false,
                badgeText: isEn ? "NO SIGN-UP · QUICK RECORD" : "가입 없이 빠른 기록",
                headlineText: isEn ? "Save a title in seconds with date, place, feeling, and note" : "검색 한 번으로 날짜·장소·느낌·메모까지 가볍게",
                outputPath: Path.Combine(outputDir, $"screenshot-{locale}-2-quicklog.png")
            );

            // Shot 3: Chronological Timeline
            vm.IsQuickRecordOpen = false;
            vm.CurrentTab = MainTab.TIMELINE;
            vm.RefreshTimelineItems();
            ClearToast(vm);
            RenderShotFrame(
                appHost,
                appRoot,
                scrollMySpaceWidget: false,
                badgeText: isEn ? "CHRONOLOGICAL TIMELINE" : "시간순 타임라인 · 내 서가",
                headlineText: isEn ? "Revisit every film, series, and book with moment filters" : "남겨둔 영상과 책의 순간을 언제든 다시 펼쳐보세요",
                outputPath: Path.Combine(outputDir, $"screenshot-{locale}-3-timeline.png")
            );

            // Shot 4: Windows 11 Widget + Watch Reminder Settings
            vm.IsQuickRecordOpen = false;
            vm.CurrentTab = MainTab.MY_SPACE;
            vm.CurrentMySpaceSection = MySpaceSection.WATCH_REMINDER;
            vm.EnsureMySpaceDataLoaded();
            ClearToast(vm);
            RenderShotFrame(
                appHost,
                appRoot,
                scrollMySpaceWidget: true,
                badgeText: isEn ? "WINDOWS 11 WIDGET & REMINDERS" : "WINDOWS 11 공식 위젯 · 시청 알림",
                headlineText: isEn ? "Pin the official Win + W widget and get gentle watch reminders" : "Win + W 위젯과 OTT 시청 종료 알림으로 데스크톱에서 바로",
                outputPath: Path.Combine(outputDir, $"screenshot-{locale}-4-widget.png")
            );

            GC.KeepAlive(win);
            vm.Dispose();
        }
        finally
        {
            try { File.Delete(tempDbPath); } catch { }
            try { File.Delete(tempDbPath + "-wal"); } catch { }
            try { File.Delete(tempDbPath + "-shm"); } catch { }
        }
    }

    private static void ClearToast(MainViewModel vm)
    {
        vm.DismissToast();
    }

    private static void RenderShotFrame(
        Border appHost,
        FrameworkElement appRoot,
        bool scrollMySpaceWidget,
        string badgeText,
        string headlineText,
        string outputPath)
    {
        const double canvasWidth = 1920;
        const double canvasHeight = 1080;

        var fontFamily = ResolveFontFamily();
        var rootGrid = new Grid
        {
            Width = canvasWidth,
            Height = canvasHeight,
            Background = CreamBgBrush
        };

        // Subtle decorative warm cream circles in corners (matches Google Play Store assets)
        var decoCanvas = new Canvas { IsHitTestVisible = false };
        var topCircle = new System.Windows.Shapes.Ellipse { Width = 480, Height = 480, Fill = CreamCircleBrush };
        Canvas.SetLeft(topCircle, 1620);
        Canvas.SetTop(topCircle, -190);
        var botCircle = new System.Windows.Shapes.Ellipse { Width = 540, Height = 540, Fill = CreamCircleBrush };
        Canvas.SetLeft(botCircle, -210);
        Canvas.SetTop(botCircle, 740);
        decoCanvas.Children.Add(topCircle);
        decoCanvas.Children.Add(botCircle);
        rootGrid.Children.Add(decoCanvas);

        var outerStack = new Grid();
        outerStack.RowDefinitions.Add(new RowDefinition { Height = new GridLength(168) });
        outerStack.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

        var headerPanel = new StackPanel
        {
            VerticalAlignment = VerticalAlignment.Center,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(40, 18, 40, 8)
        };

        var badgeBorder = new Border
        {
            Background = OrangeBrush,
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(16, 6, 16, 6),
            HorizontalAlignment = HorizontalAlignment.Center,
            Child = new TextBlock
            {
                Text = badgeText,
                FontFamily = fontFamily,
                FontSize = 15,
                FontWeight = FontWeights.Bold,
                Foreground = NearBlackBrush
            }
        };
        headerPanel.Children.Add(badgeBorder);
        headerPanel.Children.Add(new TextBlock
        {
            Text = headlineText,
            FontFamily = fontFamily,
            FontSize = 36,
            FontWeight = FontWeights.Bold,
            Foreground = NearBlackBrush,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 12, 0, 0)
        });
        Grid.SetRow(headerPanel, 0);
        outerStack.Children.Add(headerPanel);

        var hostSlot = new ContentControl
        {
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Top,
            Margin = new Thickness(0, 8, 0, 0),
            Content = appHost
        };
        Grid.SetRow(hostSlot, 1);
        outerStack.Children.Add(hostSlot);
        rootGrid.Children.Add(outerStack);

        MeasureArrangeAndFlush(rootGrid, canvasWidth, canvasHeight);

        if (scrollMySpaceWidget)
        {
            foreach (var sv in FindVisibleScrollViewers(appRoot))
            {
                sv.ScrollToVerticalOffset(220);
            }
            MeasureArrangeAndFlush(rootGrid, canvasWidth, canvasHeight);
        }
        else
        {
            foreach (var sv in FindVisibleScrollViewers(appRoot))
            {
                sv.ScrollToVerticalOffset(0);
            }
            MeasureArrangeAndFlush(rootGrid, canvasWidth, canvasHeight);
        }

        var rtb = new RenderTargetBitmap((int)canvasWidth, (int)canvasHeight, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(rootGrid);

        // Detach appHost so it can be reused across all 4 shots cleanly
        hostSlot.Content = null;
        rootGrid.Children.Clear();

        SaveBitmapPng(rtb, outputPath);
    }

    private static void MeasureArrangeAndFlush(FrameworkElement element, double width, double height)
    {
        element.Measure(new System.Windows.Size(width, height));
        element.Arrange(new Rect(0, 0, width, height));
        element.UpdateLayout();
        Dispatcher.CurrentDispatcher.Invoke(() => { }, DispatcherPriority.ContextIdle);
        element.UpdateLayout();
    }

    private static IEnumerable<ScrollViewer> FindVisibleScrollViewers(DependencyObject root)
    {
        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child is ScrollViewer sv && sv.Visibility == Visibility.Visible)
            {
                yield return sv;
            }
            foreach (var inner in FindVisibleScrollViewers(child))
            {
                yield return inner;
            }
        }
    }

    private static async Task<Dictionary<string, TitleSummary>> BuildSeedCatalogAsync(string locale)
    {
        using var api = new OttlineApiClient();
        api.Configure("https://ottline.app", null, Guid.NewGuid().ToString("D"), locale, null);

        var fallback = OttlineRepository.GetCuratedFallbackCatalog().ToList();
        var queries = new[]
        {
            ("past_lives", locale == "en" ? "Past Lives" : "패스트 라이브즈", ContentFilter.VIDEO, fallback.First(t => t.Title.Contains("패스트") || (t.OriginalTitle?.Contains("Past Lives") ?? false))),
            ("inception", locale == "en" ? "Inception" : "인셉션", ContentFilter.VIDEO, new TitleSummary("tmdb:movie:27205", "tmdb", "27205", TitleType.movie, locale == "en" ? "Inception" : "인셉션", "Inception", 2010, "https://image.tmdb.org/t/p/w780/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", Genres: new[] { "Sci-Fi", "Thriller" })),
            ("the_bear", locale == "en" ? "The Bear" : "더 베어", ContentFilter.VIDEO, fallback.FirstOrDefault(t => t.Title.Contains("베어")) ?? new TitleSummary("tmdb:tv:136315", "tmdb", "136315", TitleType.series, locale == "en" ? "The Bear" : "더 베어", "The Bear", 2022, "https://image.tmdb.org/t/p/w780/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg")),
            ("severance", locale == "en" ? "Severance" : "세브란스", ContentFilter.VIDEO, fallback.FirstOrDefault(t => t.Title.Contains("세브란스")) ?? new TitleSummary("tmdb:tv:95396", "tmdb", "95396", TitleType.series, locale == "en" ? "Severance" : "세브란스", "Severance", 2022, "https://image.tmdb.org/t/p/w780/lFf6LLrQjYldcZItzOkGmMMigP7.jpg")),
            ("human_acts", locale == "en" ? "Human Acts" : "소년이 온다", ContentFilter.BOOK, fallback.FirstOrDefault(t => t.Type.IsBook() && t.Title.Contains("소년이 온다")) ?? TitleFallback.BuildManualBookMetadata(locale == "en" ? "Human Acts" : "소년이 온다", locale == "en" ? "Han Kang" : "한강", "창비", "9788936434120")),
            ("vegetarian", locale == "en" ? "The Vegetarian" : "채식주의자", ContentFilter.BOOK, fallback.FirstOrDefault(t => t.Type.IsBook() && t.Title.Contains("채식주의자")) ?? TitleFallback.BuildManualBookMetadata(locale == "en" ? "The Vegetarian" : "채식주의자", locale == "en" ? "Han Kang" : "한강", "창비", "9788936433598"))
        };

        var result = new Dictionary<string, TitleSummary>(StringComparer.Ordinal);
        foreach (var (key, q, filter, defTitle) in queries)
        {
            TitleSummary chosen = defTitle;
            try
            {
                var found = await api.SearchTitlesAsync(q, filter).ConfigureAwait(false);
                var withPoster = found.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.PosterUrl));
                if (withPoster != null)
                {
                    chosen = withPoster;
                }
            }
            catch
            {
                // Fall back to curated metadata
            }
            result[key] = chosen;
        }

        return result;
    }

    private static List<WatchLog> SeedSampleLogs(OttlineRepository repo, Dictionary<string, TitleSummary> catalog, bool isEn)
    {
        var today = DateTimeOffset.Now;
        string DaysAgo(int days) => today.AddDays(-days).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var logs = new List<WatchLog>
        {
            repo.SaveLogLocalFirst(
                title: catalog["past_lives"],
                status: LogStatus.DONE,
                feeling: RecordFeeling.SATISFIED,
                watchedOnDate: DaysAgo(1),
                ott: "Netflix",
                place: isEn ? "Home" : "집",
                occasion: isEn ? "Alone" : "혼자",
                note: isEn
                    ? "The quiet walk across Brooklyn stayed with me long after the credits rolled."
                    : "브루클린을 걷던 마지막 장면의 여운이 밤새 오래 남았다."
            ),
            repo.SaveLogLocalFirst(
                title: catalog["severance"],
                status: LogStatus.IN_PROGRESS,
                feeling: RecordFeeling.SATISFIED,
                watchedOnDate: DaysAgo(2),
                ott: "Apple TV",
                place: isEn ? "Home" : "집",
                occasion: isEn ? "Weekend" : "주말",
                seasonNumber: 2,
                episodeNumber: 4,
                note: isEn
                    ? "Episode 4 pacing was unreal—cannot stop watching this season."
                    : "시즌 2 4화 연출이 압도적이라 다음 화를 바로 켜게 된다."
            ),
            repo.SaveLogLocalFirst(
                title: catalog["human_acts"],
                status: LogStatus.DONE,
                feeling: RecordFeeling.SATISFIED,
                watchedOnDate: DaysAgo(4),
                ott: isEn ? "Print" : "종이책",
                place: isEn ? "Cafe" : "카페",
                occasion: isEn ? "Quiet evening" : "혼자",
                note: isEn
                    ? "Re-read in a quiet corner with warm coffee; every sentence lands deeper."
                    : "조용한 카페 구석에서 다시 읽으며 문장마다 오래 멈췄다."
            ),
            repo.SaveLogLocalFirst(
                title: catalog["inception"],
                status: LogStatus.DONE,
                feeling: RecordFeeling.SATISFIED,
                watchedOnDate: DaysAgo(7),
                ott: "Netflix",
                place: isEn ? "Home" : "집",
                occasion: isEn ? "With family" : "가족",
                note: isEn
                    ? "Holding my breath until the spinning top scene—still crisp every rewatch."
                    : "마지막 팽이 장면까지 숨죽이며 다시 본 인생 영화."
            ),
            repo.SaveLogLocalFirst(
                title: catalog["the_bear"],
                status: LogStatus.DONE,
                feeling: RecordFeeling.SATISFIED,
                watchedOnDate: DaysAgo(34),
                ott: "Disney+",
                place: isEn ? "Home" : "집",
                occasion: isEn ? "Late night" : "혼자",
                seasonNumber: 2,
                episodeNumber: 7,
                note: isEn
                    ? "Forks episode always lifts my mood whenever I revisit it."
                    : "포크 에피소드만 다시 꺼내 봐도 마음이 단단해진다."
            ),
            repo.SaveLogLocalFirst(
                title: catalog["vegetarian"],
                status: LogStatus.WISHLIST,
                feeling: null,
                watchedOnDate: DaysAgo(36),
                ott: isEn ? "E-book" : "밀리의서재",
                place: isEn ? "Transit" : "이동 중",
                occasion: isEn ? "Saved for next read" : "혼자",
                note: isEn
                    ? "Kept on my wishlist for this month's reading weekend."
                    : "이번 주말에 이어 읽으려고 서가에 미리 담아둔 책."
            )
        };

        return logs;
    }

    private static System.Windows.Media.FontFamily ResolveFontFamily()
    {
        if (System.Windows.Application.Current?.Resources["PretendardFont"] is System.Windows.Media.FontFamily appFont)
        {
            return appFont;
        }
        return new System.Windows.Media.FontFamily("Pretendard, Malgun Gothic, Segoe UI");
    }

    private static FormattedText CreateText(
        string text,
        System.Windows.Media.FontFamily fontFamily,
        FontWeight weight,
        double fontSize,
        System.Windows.Media.Brush brush,
        double maxWidth = 0,
        TextAlignment alignment = TextAlignment.Left)
    {
        var typeface = new Typeface(fontFamily, FontStyles.Normal, weight, FontStretches.Normal);
        var ft = new FormattedText(
            text,
            CultureInfo.CurrentUICulture,
            FlowDirection.LeftToRight,
            typeface,
            fontSize,
            brush,
            1.0)
        {
            TextAlignment = alignment
        };
        if (maxWidth > 0)
        {
            ft.MaxTextWidth = maxWidth;
        }
        return ft;
    }

    private static void SaveDrawingVisualPng(DrawingVisual visual, int width, int height, string outputPath)
    {
        var rtb = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(visual);
        SaveBitmapPng(rtb, outputPath);
    }

    private static void SaveBitmapPng(BitmapSource bitmap, string outputPath)
    {
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var fs = new FileStream(outputPath, FileMode.Create, FileAccess.Write, FileShare.None);
        encoder.Save(fs);
    }

    private static SolidColorBrush FrozenBrush(string hex)
    {
        var brush = new SolidColorBrush((Color)System.Windows.Media.ColorConverter.ConvertFromString(hex));
        brush.Freeze();
        return brush;
    }

    private static Geometry CreateFrozenGeometry(string pathData)
    {
        var g = Geometry.Parse(pathData);
        g.Freeze();
        return g;
    }
}
