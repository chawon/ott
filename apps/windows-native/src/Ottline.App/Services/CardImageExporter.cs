using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Ottline.App.Theme;
using Ottline.Core.Domain;
using Ottline.Core.Models;
using Windows.ApplicationModel.DataTransfer;
using Windows.Storage;
using Windows.Storage.Streams;
using WinRT;
using Color = System.Windows.Media.Color;

namespace Ottline.App.Services;

public sealed record ShareCardOptions(
    string Format = "story", // "story" (1080x1920) or "feed" (1080x1350)
    bool ShowRatingLabel = true,
    bool ShowNote = true,
    bool ShowProfileSignature = false
);

public static class CardImageExporter
{
    private static readonly Typeface BoldTypeface = new(new System.Windows.Media.FontFamily("Pretendard, Malgun Gothic, Segoe UI"), FontStyles.Normal, FontWeights.Bold, FontStretches.Normal);
    private static readonly Typeface SemiBoldTypeface = new(new System.Windows.Media.FontFamily("Pretendard, Malgun Gothic, Segoe UI"), FontStyles.Normal, FontWeights.SemiBold, FontStretches.Normal);
    private static readonly Typeface MediumTypeface = new(new System.Windows.Media.FontFamily("Pretendard, Malgun Gothic, Segoe UI"), FontStyles.Normal, FontWeights.Medium, FontStretches.Normal);
    private static readonly Typeface RegularTypeface = new(new System.Windows.Media.FontFamily("Pretendard, Malgun Gothic, Segoe UI"), FontStyles.Normal, FontWeights.Normal, FontStretches.Normal);

    [ComImport]
    [Guid("3A3DCD6C-3EAB-43DC-BCDE-45671CE800C8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDataTransferManagerInterop
    {
        IntPtr GetForWindow([In] IntPtr appWindow, [In] ref Guid riid);
        void ShowShareUIForWindow([In] IntPtr appWindow);
    }

    private static readonly Guid DataTransferManagerIid = new("A5CAEE9B-8708-49D1-8D36-67D25A8DA00C");
    private static WatchLog? _pendingShareLog;
    private static string? _pendingShareFilePath;
    private static IntPtr _hookedHwnd = IntPtr.Zero;

    public static IReadOnlyList<string> GetSharePosterCandidateUrls(string? posterUrl)
    {
        if (string.IsNullOrWhiteSpace(posterUrl)) return Array.Empty<string>();
        var raw = posterUrl.Trim();
        return new[]
            {
                UrlToImageSourceConverter.NormalizePosterUrl(raw, isHero: true),
                UrlToImageSourceConverter.NormalizePosterUrl(raw, isHero: false),
                raw
            }
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    public static async Task EnsurePosterCachedForShareAsync(string? posterUrl)
    {
        var candidates = GetSharePosterCandidateUrls(posterUrl);
        if (candidates.Count == 0) return;

        var primaryFile = AsyncPosterImageNotifier.GetCacheFilePath(candidates[0]);
        if (File.Exists(primaryFile) && TryDecodeSharePosterFile(primaryFile) != null)
        {
            return;
        }

        foreach (var candidateUrl in candidates)
        {
            try
            {
                var cacheFile = AsyncPosterImageNotifier.GetCacheFilePath(candidateUrl);
                if (File.Exists(cacheFile) && TryDecodeSharePosterFile(cacheFile) != null)
                {
                    return;
                }

                var bytes = await AsyncPosterImageNotifier.SharedHttp.GetByteArrayAsync(candidateUrl).ConfigureAwait(false);
                if (bytes.Length == 0) continue;

                Directory.CreateDirectory(Path.GetDirectoryName(cacheFile)!);
                await File.WriteAllBytesAsync(cacheFile, bytes).ConfigureAwait(false);

                if (TryDecodeSharePosterFile(cacheFile) != null)
                {
                    return;
                }

                try { File.Delete(cacheFile); } catch { }
            }
            catch
            {
                // Try next candidate URL
            }
        }
    }

    /// <summary>
    /// 1:1 port of apps/web/app/[locale]/og/share-card/route.tsx (renderShareCard)
    /// </summary>
    public static BitmapSource RenderShareCardBitmap(
        WatchLog log,
        LocalSettings? settings = null,
        ShareCardOptions? options = null,
        string locale = "ko")
    {
        var opts = options ?? new ShareCardOptions();
        var isBook = log.Title.Type.IsBook();
        var isFeed = string.Equals(opts.Format, "feed", StringComparison.OrdinalIgnoreCase);
        var scale = isFeed ? 0.8 : 1.0;
        double S(double value) => Math.Round(value * scale);

        var width = 1080;
        var height = isFeed ? 1350 : 1920;

        var rawTitle = log.Title.Title ?? string.Empty;
        var cleanedTitle = isBook ? StripBookSubtitle(rawTitle) : rawTitle;
        var clampedTitle = ClampText(cleanedTitle, 60);
        var formattedTitle = FormatTitleForCard(clampedTitle);

        var note = (opts.ShowNote && !string.IsNullOrWhiteSpace(log.Note))
            ? ClampText(NormalizeNote(log.Note!, isBook ? 3 : 2), isBook ? 120 : 80)
            : null;

        var posterBmp = TryGetCachedPosterBitmap(log.Title.PosterUrl);

        // Default dark colors from route.tsx lines 140-141
        var bgColor = Color.FromRgb(11, 12, 16);      // #0b0c10
        var contentBgColor = Color.FromRgb(11, 18, 36); // #0b1224

        if (posterBmp != null)
        {
            var (r, g, b) = ComputeAverageColor(posterBmp);
            bgColor = Color.FromRgb((byte)Math.Floor(r * 0.20), (byte)Math.Floor(g * 0.20), (byte)Math.Floor(b * 0.20));
            contentBgColor = Color.FromRgb((byte)Math.Floor(r * 0.25), (byte)Math.Floor(g * 0.25), (byte)Math.Floor(b * 0.25));
        }

        var bgBrush = FrozenBrush(bgColor);
        var contentBgBrush = FrozenBrush(contentBgColor);
        var whiteBrush = BrushFromHex("#FFFFFF");
        var noteBrush = BrushFromHex("#DBE4FF");
        var pillTextBrush = BrushFromHex("#CBD5F5");
        var pillBgBrush = FrozenBrush(Color.FromArgb(20, 255, 255, 255)); // rgba(255,255,255,0.08)

        var posterSectionHeight = Math.Round(height * 0.70);
        var contentSectionHeight = height - posterSectionHeight;

        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            // Full background
            dc.DrawRectangle(bgBrush, null, new Rect(0, 0, width, height));

            // ==================== TOP 70%: FULL-BLEED POSTER + GRADIENT ====================
            var posterAreaRect = new Rect(0, 0, width, posterSectionHeight);
            dc.PushClip(new RectangleGeometry(posterAreaRect));
            dc.DrawRectangle(bgBrush, null, posterAreaRect);

            if (posterBmp != null && posterBmp.PixelWidth > 0 && posterBmp.PixelHeight > 0)
            {
                // objectFit: cover, objectPosition: isBook ? "center top" : "center 12%"
                var imgW = (double)posterBmp.PixelWidth;
                var imgH = (double)posterBmp.PixelHeight;
                var scaleFactor = Math.Max(width / imgW, posterSectionHeight / imgH);
                var drawW = imgW * scaleFactor;
                var drawH = imgH * scaleFactor;
                var drawX = (width - drawW) / 2.0;
                var overflowY = drawH - posterSectionHeight;
                var drawY = isBook ? 0.0 : -overflowY * 0.12;

                dc.DrawImage(posterBmp, new Rect(drawX, drawY, drawW, drawH));
            }

            // Bottom 36% gradient: linear-gradient(180deg, rgba(0,0,0,0) 0%, contentBgColor 100%)
            var gradHeight = Math.Round(posterSectionHeight * 0.36);
            var gradRect = new Rect(0, posterSectionHeight - gradHeight, width, gradHeight + 2);
            var gradBrush = new LinearGradientBrush(
                Color.FromArgb(0, contentBgColor.R, contentBgColor.G, contentBgColor.B),
                contentBgColor,
                new System.Windows.Point(0, 0),
                new System.Windows.Point(0, 1)
            );
            gradBrush.Freeze();
            dc.DrawRectangle(gradBrush, null, gradRect);
            dc.Pop();

            // ==================== BOTTOM 30%: CONTENT AREA ====================
            var contentRect = new Rect(0, posterSectionHeight, width, contentSectionHeight);
            dc.DrawRectangle(contentBgBrush, null, contentRect);

            var padX = S(88);
            var curY = posterSectionHeight + S(64);
            var maxContentWidth = width - (padX * 2);
            var gap = S(18);

            // 1) Formatted Title (fontSize: s(isBook ? 64 : 84), fontWeight: 700, lineHeight: isBook ? 1.12 : 1.05)
            var titleFontSize = S(isBook ? 64 : 84);
            var titleFt = CreateFormattedText(
                formattedTitle,
                BoldTypeface,
                titleFontSize,
                whiteBrush,
                maxContentWidth,
                maxHeight: S(220),
                lineHeight: Math.Round(titleFontSize * (isBook ? 1.12 : 1.05))
            );
            dc.DrawText(titleFt, new System.Windows.Point(padX, curY));
            curY += titleFt.Height + gap;

            // 2) Note (“{note}”, fontSize: s(isBook ? 40 : 38), color: #dbe4ff)
            if (!string.IsNullOrWhiteSpace(note))
            {
                var noteFontSize = S(isBook ? 40 : 38);
                var noteFt = CreateFormattedText(
                    $"“{note}”",
                    MediumTypeface,
                    noteFontSize,
                    noteBrush,
                    maxContentWidth,
                    maxHeight: S(160),
                    lineHeight: Math.Round(noteFontSize * 1.3)
                );
                dc.DrawText(noteFt, new System.Windows.Point(padX, curY));
                curY += noteFt.Height + gap;
            }

            // 3) Pill Badges Row (👀 Status | Rating | 🗓 Date)
            var pillFontSize = S(isBook ? 26 : 28);
            var pillHeight = S(48);
            var pillPadX = S(16);
            var pillGap = S(12);
            var pillRadius = pillHeight / 2.0;
            var pillX = padX;

            var statusText = $"👀  {ResolveShareStatusLabel(log.Status, isBook, locale)}";
            pillX = DrawPill(dc, statusText, pillFontSize, pillTextBrush, pillBgBrush, pillX, curY, pillHeight, pillPadX, pillRadius) + pillGap;

            if (opts.ShowRatingLabel)
            {
                var ratingLabel = ResolveShareRatingLabel(log, isBook, locale);
                if (!string.IsNullOrWhiteSpace(ratingLabel))
                {
                    pillX = DrawPill(dc, ratingLabel!, pillFontSize, pillTextBrush, pillBgBrush, pillX, curY, pillHeight, pillPadX, pillRadius) + pillGap;
                }
            }

            var dateStr = RecordDate.OccurredAtToWatchedOnDate(log.OccurredAt, log.WatchedOn).Replace('-', '.');
            var datePillText = $"🗓  {dateStr}";
            DrawPill(dc, datePillText, pillFontSize, pillTextBrush, pillBgBrush, pillX, curY, pillHeight, pillPadX, pillRadius);

            // ==================== BOTTOM WATERMARK / PROFILE SIGNATURE ====================
            var bottomY = height - S(64) - S(34);
            var watermarkFontSize = S(26);
            var watermarkBrush = FrozenBrush(Color.FromArgb(191, 255, 255, 255)); // rgba(255,255,255,0.75)

            var hasSignature = opts.ShowProfileSignature && settings != null && !string.IsNullOrWhiteSpace(settings.DisplayName);
            if (hasSignature)
            {
                var sigX = padX;
                var avatarBoxSize = S(40);
                var avatarRadius = S(12);
                var avatarRect = new Rect(sigX, bottomY - S(4), avatarBoxSize, avatarBoxSize);

                dc.DrawRoundedRectangle(
                    FrozenBrush(Color.FromArgb(31, 255, 255, 255)),
                    new System.Windows.Media.Pen(FrozenBrush(Color.FromArgb(46, 255, 255, 255)), 1),
                    avatarRect,
                    avatarRadius,
                    avatarRadius
                );

                var avatarImg = TryLoadAvatarImage(settings!.AvatarPreset);
                if (avatarImg != null)
                {
                    dc.PushClip(new RectangleGeometry(avatarRect, avatarRadius, avatarRadius));
                    dc.DrawImage(avatarImg, avatarRect);
                    dc.Pop();
                }

                sigX += avatarBoxSize + S(16);
                var nickBrush = FrozenBrush(Color.FromArgb(224, 255, 255, 255)); // 0.88
                var dotBrush = FrozenBrush(Color.FromArgb(107, 255, 255, 255));  // 0.42

                var nickFt = CreateFormattedText(ClampText(settings.DisplayName.Trim(), 32), MediumTypeface, watermarkFontSize, nickBrush, 500);
                dc.DrawText(nickFt, new System.Windows.Point(sigX, bottomY));
                sigX += nickFt.WidthIncludingTrailingWhitespace + S(14);

                var dotFt = CreateFormattedText("·", MediumTypeface, watermarkFontSize, dotBrush, 60);
                dc.DrawText(dotFt, new System.Windows.Point(sigX, bottomY));
                sigX += dotFt.WidthIncludingTrailingWhitespace + S(14);

                var byFt = CreateFormattedText("by ottline.app", MediumTypeface, watermarkFontSize, watermarkBrush, 400);
                dc.DrawText(byFt, new System.Windows.Point(sigX, bottomY));
            }
            else
            {
                var wmFt = CreateFormattedText("ottline.app", MediumTypeface, watermarkFontSize, watermarkBrush, 400);
                dc.DrawText(wmFt, new System.Windows.Point(padX, bottomY));
            }
        }

        var rtb = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(visual);
        rtb.Freeze();
        return rtb;
    }

    private static double DrawPill(
        DrawingContext dc,
        string text,
        double fontSize,
        System.Windows.Media.Brush textBrush,
        System.Windows.Media.Brush bgBrush,
        double x,
        double y,
        double height,
        double padX,
        double radius)
    {
        var ft = CreateFormattedText(text, SemiBoldTypeface, fontSize, textBrush, 600);
        var pillWidth = ft.WidthIncludingTrailingWhitespace + (padX * 2);
        var rect = new Rect(x, y, pillWidth, height);
        dc.DrawRoundedRectangle(bgBrush, null, rect, radius, radius);
        var textY = y + ((height - ft.Height) / 2.0);
        dc.DrawText(ft, new System.Windows.Point(x + padX, textY));
        return x + pillWidth;
    }

    private static string ResolveShareStatusLabel(LogStatus status, bool isBook, string locale)
    {
        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        if (isEn)
        {
            return isBook
                ? status switch { LogStatus.DONE => "Read", LogStatus.IN_PROGRESS => "Reading", _ => "Want to read" }
                : status switch { LogStatus.DONE => "Watched", LogStatus.IN_PROGRESS => "Watching", _ => "Want to watch" };
        }
        return isBook
            ? status switch { LogStatus.DONE => "읽었어요", LogStatus.IN_PROGRESS => "읽는 중", _ => "읽고 싶어요" }
            : status switch { LogStatus.DONE => "봤어요", LogStatus.IN_PROGRESS => "보는 중", _ => "보고 싶어요" };
    }

    private static string? ResolveShareRatingLabel(WatchLog log, bool isBook, string locale)
    {
        var feeling = RecordFeelings.ResolveRecordFeeling(log.Rating, log.Reaction);
        if (!feeling.HasValue) return null;

        var isEn = string.Equals(locale, "en", StringComparison.OrdinalIgnoreCase);
        if (isEn)
        {
            return isBook
                ? feeling.Value switch { RecordFeeling.SATISFIED => "Life-changing", RecordFeeling.NEUTRAL => "Not bad", _ => "Disappointing" }
                : feeling.Value switch { RecordFeeling.SATISFIED => "Excellent", RecordFeeling.NEUTRAL => "Worth watching", _ => "Disappointing" };
        }
        return isBook
            ? feeling.Value switch { RecordFeeling.SATISFIED => "인생책", RecordFeeling.NEUTRAL => "무난해요", _ => "아쉬워요" }
            : feeling.Value switch { RecordFeeling.SATISFIED => "최고예요", RecordFeeling.NEUTRAL => "볼만해요", _ => "아쉬워요" };
    }

    private static (double R, double G, double B) ComputeAverageColor(BitmapSource bmp)
    {
        try
        {
            var converted = new FormatConvertedBitmap(bmp, PixelFormats.Bgra32, null, 0);
            var w = converted.PixelWidth;
            var h = converted.PixelHeight;
            if (w <= 0 || h <= 0) return (11, 18, 36);

            var stride = w * 4;
            var pixels = new byte[h * stride];
            converted.CopyPixels(pixels, stride, 0);

            long sumR = 0, sumG = 0, sumB = 0, count = 0;
            var step = Math.Max(1, (w * h) / 2000) * 4;
            for (var i = 0; i + 3 < pixels.Length; i += step)
            {
                var a = pixels[i + 3];
                if (a < 32) continue;
                sumB += pixels[i];
                sumG += pixels[i + 1];
                sumR += pixels[i + 2];
                count++;
            }

            if (count == 0) return (11, 18, 36);
            return ((double)sumR / count, (double)sumG / count, (double)sumB / count);
        }
        catch
        {
            return (11, 18, 36);
        }
    }

    private static string StripBookSubtitle(string title)
    {
        var withoutParens = Regex.Replace(title, @"\s*[(\[{][^)\]}]+[)\]}]", " ");
        withoutParens = Regex.Replace(withoutParens, @"\s{2,}", " ").Trim();

        var colonMatch = Regex.Match(withoutParens, @":\s+");
        var dashMatch = Regex.Match(withoutParens, @"\s[-–—]\s+");
        var cutIndex = -1;
        if (colonMatch.Success) cutIndex = colonMatch.Index;
        if (dashMatch.Success) cutIndex = cutIndex == -1 ? dashMatch.Index : Math.Min(cutIndex, dashMatch.Index);

        var trimmed = cutIndex == -1 ? withoutParens : withoutParens[..cutIndex].Trim();
        return trimmed.Length > 0 ? trimmed : title;
    }

    private static string FormatTitleForCard(string title)
    {
        var idx = title.IndexOf(':');
        if (idx == -1) return title;
        var before = title[..(idx + 1)];
        var after = title[(idx + 1)..].Trim();
        return string.IsNullOrEmpty(after) ? title : $"{before}\n{after}";
    }

    private static string NormalizeNote(string text, int maxLines = 2)
    {
        var lines = text.Replace("\r\n", "\n")
            .Split('\n')
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .Take(maxLines);
        return string.Join("\n", lines);
    }

    private static string ClampText(string text, int maxLen)
    {
        if (text.Length <= maxLen) return text;
        return $"{text[..(maxLen - 1)]}…";
    }

    private static BitmapSource? TryLoadAvatarImage(string? avatarPresetKey)
    {
        try
        {
            var preset = StorybookAvatarPresetExtensions.FromKey(avatarPresetKey ?? "fox");
            var uri = new Uri(preset.ResourcePath(), UriKind.Absolute);
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.UriSource = uri;
            bmp.CacheOption = BitmapCacheOption.OnLoad;
            bmp.EndInit();
            bmp.Freeze();
            return bmp;
        }
        catch
        {
            return null;
        }
    }

    public static void ExportShareCardPng(
        WatchLog log,
        string outputPath,
        string locale = "ko",
        LocalSettings? settings = null,
        ShareCardOptions? options = null)
    {
        var bmp = RenderShareCardBitmap(log, settings, options, locale);
        SaveBitmapToPng(bmp, outputPath);
    }

    public static string ExportTempShareCardPng(
        WatchLog log,
        LocalSettings? settings = null,
        ShareCardOptions? options = null,
        string locale = "ko")
    {
        var opts = options ?? new ShareCardOptions();
        var safeTitle = string.Concat(log.Title.Title.Where(c => !Path.GetInvalidFileNameChars().Contains(c) && !char.IsWhiteSpace(c)));
        if (string.IsNullOrWhiteSpace(safeTitle)) safeTitle = "share";
        if (safeTitle.Length > 32) safeTitle = safeTitle[..32];

        var suffix = string.Equals(opts.Format, "feed", StringComparison.OrdinalIgnoreCase) ? "feed" : "story";
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ottline", "share-temp");
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, $"ott-{safeTitle}-{suffix}.png");

        ExportShareCardPng(log, path, locale, settings, opts);
        return path;
    }

    public static async Task<bool> ShowWindowsNativeShareAsync(
        Window ownerWindow,
        WatchLog log,
        LocalSettings? settings = null,
        ShareCardOptions? options = null,
        string locale = "ko")
    {
        var filePath = ExportTempShareCardPng(log, settings, options, locale);

        // Also copy image to Clipboard for convenience
        try
        {
            var bmp = RenderShareCardBitmap(log, settings, options, locale);
            System.Windows.Clipboard.SetImage(bmp);
        }
        catch
        {
            // Ignore clipboard contention
        }

        try
        {
            var hwnd = new WindowInteropHelper(ownerWindow).EnsureHandle();
            if (hwnd == IntPtr.Zero) return false;

            _pendingShareLog = log;
            _pendingShareFilePath = filePath;

            _ = await StorageFile.GetFileFromPathAsync(filePath);

            var interop = DataTransferManager.As<IDataTransferManagerInterop>();
            var iid = DataTransferManagerIid;
            var dtmPtr = interop.GetForWindow(hwnd, ref iid);
            var dtm = MarshalInterface<DataTransferManager>.FromAbi(dtmPtr);

            if (_hookedHwnd != hwnd)
            {
                dtm.DataRequested += OnDataRequested;
                _hookedHwnd = hwnd;
            }

            interop.ShowShareUIForWindow(hwnd);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static async void OnDataRequested(DataTransferManager sender, DataRequestedEventArgs args)
    {
        var log = _pendingShareLog;
        var filePath = _pendingShareFilePath;
        if (log == null || string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            return;
        }

        var deferral = args.Request.GetDeferral();
        try
        {
            var pkg = args.Request.Data;
            pkg.Properties.Title = $"{log.Title.Title} — 그날의 온기 (ottline)";
            var shareText = string.IsNullOrWhiteSpace(log.Note)
                ? $"[{log.Title.Title}] 그날의 온기를 ottline 타임라인에 남겼어요. https://ottline.app"
                : $"[{log.Title.Title}] “{log.Note.Trim()}” — 그날의 온기 https://ottline.app";
            pkg.Properties.Description = shareText;
            pkg.SetText(shareText);

            var storageFile = await StorageFile.GetFileFromPathAsync(filePath);
            pkg.SetStorageItems(new IStorageItem[] { storageFile });
            var streamRef = RandomAccessStreamReference.CreateFromFile(storageFile);
            pkg.Properties.Thumbnail = streamRef;
            pkg.SetBitmap(streamRef);
        }
        catch
        {
            // Ignore share population errors
        }
        finally
        {
            deferral.Complete();
        }
    }

    private static BitmapSource? TryGetCachedPosterBitmap(string? posterUrl)
    {
        var candidates = GetSharePosterCandidateUrls(posterUrl);
        if (candidates.Count == 0) return null;

        try
        {
            foreach (var candidateUrl in candidates)
            {
                var file = AsyncPosterImageNotifier.GetCacheFilePath(candidateUrl);
                if (File.Exists(file))
                {
                    var bmp = TryDecodeSharePosterFile(file);
                    if (bmp != null) return bmp;
                }
            }
        }
        catch
        {
            // Ignore poster cache lookup failures
        }
        return null;
    }

    private static BitmapSource? TryDecodeSharePosterFile(string filePath)
    {
        try
        {
            var bytes = File.ReadAllBytes(filePath);
            if (bytes.Length == 0) return null;

            BitmapImage? bmp = DecodeBitmapBytes(bytes, decodePixelWidth: 1080)
                               ?? DecodeBitmapBytes(bytes, decodePixelWidth: 0);
            if (bmp == null || bmp.PixelWidth <= 0 || bmp.PixelHeight <= 0) return null;

            if (bmp.Format != PixelFormats.Pbgra32 &&
                bmp.Format != PixelFormats.Bgra32 &&
                bmp.Format != PixelFormats.Bgr32)
            {
                var converted = new FormatConvertedBitmap(bmp, PixelFormats.Pbgra32, null, 0);
                converted.Freeze();
                return converted;
            }

            return bmp;
        }
        catch
        {
            return null;
        }
    }

    private static BitmapImage? DecodeBitmapBytes(byte[] bytes, int decodePixelWidth)
    {
        try
        {
            using var ms = new MemoryStream(bytes, writable: false);
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.CacheOption = BitmapCacheOption.OnLoad;
            bmp.CreateOptions = BitmapCreateOptions.IgnoreColorProfile;
            if (decodePixelWidth > 0)
            {
                bmp.DecodePixelWidth = decodePixelWidth;
            }
            bmp.StreamSource = ms;
            bmp.EndInit();
            bmp.Freeze();
            return bmp;
        }
        catch
        {
            return null;
        }
    }

    public static void ExportRecoveryCardPng(LocalSettings settings, string outputPath)
    {
        const int width = 1080;
        const int height = 720;

        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(BrushFromHex("#F8F6F2"), null, new Rect(0, 0, width, height));
            var cardRect = new Rect(56, 56, width - 112, height - 112);
            dc.DrawRoundedRectangle(BrushFromHex("#FFFFFF"), new System.Windows.Media.Pen(BrushFromHex("#1E4D8C"), 3), cardRect, 16, 16);

            DrawText(dc, "ottline · 연결 및 복구 카드 (Recovery Card)", BoldTypeface, 28, BrushFromHex("#1E4D8C"), new System.Windows.Point(104, 108));
            var preset = StorybookAvatarPresetExtensions.FromKey(settings.AvatarPreset);
            DrawText(dc, $"{settings.DisplayName}  ({preset.LabelKo()})", BoldTypeface, 42, BrushFromHex("#191919"), new System.Windows.Point(104, 172));

            var codeRect = new Rect(104, 268, width - 208, 180);
            dc.DrawRoundedRectangle(BrushFromHex("#FEF9EE"), new System.Windows.Media.Pen(BrushFromHex("#FF9933"), 3), codeRect, 12, 12);

            var code = string.IsNullOrWhiteSpace(settings.RecoveryCode) ? "OTTL-LOCAL-SYNC" : settings.RecoveryCode!;
            DrawText(dc, "내 연결 코드 (Recovery Code)", RegularTypeface, 22, BrushFromHex("#636363"), new System.Windows.Point(144, 298));
            DrawText(dc, code, BoldTypeface, 54, BrushFromHex("#1E4D8C"), new System.Windows.Point(144, 342));

            DrawText(dc, $"발급일: {RecordDate.TodayDate()} · 다른 기기나 웹에서 이 코드를 입력하면 기록이 하나로 합쳐집니다.", RegularTypeface, 22, BrushFromHex("#4A4845"), new System.Windows.Point(104, 504), maxWidth: width - 208);
        }

        var rtb = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(visual);
        SaveBitmapToPng(rtb, outputPath);
    }

    public static void ExportRecapCardPng(PersonalReportSummary report, LocalSettings settings, string periodLabel, string outputPath)
    {
        const int width = 1080;
        const int height = 1920;

        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(BrushFromHex("#F8F6F2"), null, new Rect(0, 0, width, height));
            var cardRect = new Rect(64, 64, width - 128, height - 128);
            dc.DrawRoundedRectangle(BrushFromHex("#FFFFFF"), new System.Windows.Media.Pen(BrushFromHex("#E4E1DC"), 3), cardRect, 20, 20);

            dc.DrawRoundedRectangle(BrushFromHex("#FF9933"), null, new Rect(112, 120, 96, 12), 6, 6);
            DrawText(dc, $"ottline · {periodLabel} 리캡", BoldTypeface, 30, BrushFromHex("#1E4D8C"), new System.Windows.Point(112, 156));
            DrawText(dc, $"{settings.DisplayName}님의 기억 아카이브", BoldTypeface, 48, BrushFromHex("#191919"), new System.Windows.Point(112, 212));

            var statBox1 = new Rect(112, 320, 400, 200);
            var statBox2 = new Rect(544, 320, 424, 200);
            dc.DrawRoundedRectangle(BrushFromHex("#FEF9EE"), new System.Windows.Media.Pen(BrushFromHex("#E4E1DC"), 2), statBox1, 12, 12);
            dc.DrawRoundedRectangle(BrushFromHex("#FEF9EE"), new System.Windows.Media.Pen(BrushFromHex("#E4E1DC"), 2), statBox2, 12, 12);

            DrawText(dc, "함께한 전체 기록", RegularTypeface, 24, BrushFromHex("#636363"), new System.Windows.Point(144, 352));
            DrawText(dc, $"{report.TotalLogs}편 (완주 {report.DoneCount})", BoldTypeface, 44, BrushFromHex("#1E4D8C"), new System.Windows.Point(144, 404));

            DrawText(dc, "영상 · 책 비중", RegularTypeface, 24, BrushFromHex("#636363"), new System.Windows.Point(576, 352));
            DrawText(dc, $"영상 {report.VideoCount} · 책 {report.BookCount}", BoldTypeface, 44, BrushFromHex("#FF9933"), new System.Windows.Point(576, 404));

            var topPlatform = report.TopPlatforms.FirstOrDefault().Label ?? "다양한 곳";
            var rawTopPlace = report.TopPlaces.FirstOrDefault().Label;
            var topPlace = string.IsNullOrWhiteSpace(rawTopPlace) ? "나만의 공간" : OttlinePresets.FormatPlace(rawTopPlace, "ko");
            var rawTopOccasion = report.TopOccasions.FirstOrDefault().Label;
            var topOccasion = string.IsNullOrWhiteSpace(rawTopOccasion) ? "고요한 시간" : OttlinePresets.FormatOccasion(rawTopOccasion, "ko");

            DrawText(dc, "자주 머물렀던 순간", BoldTypeface, 32, BrushFromHex("#191919"), new System.Windows.Point(112, 580));
            DrawText(dc, $"플랫폼: {topPlatform}   ·   장소: {topPlace}   ·   순간: {topOccasion}", RegularTypeface, 28, BrushFromHex("#4A4845"), new System.Windows.Point(112, 636), maxWidth: width - 224);

            DrawText(dc, "이 시기를 빛낸 작품들", BoldTypeface, 32, BrushFromHex("#191919"), new System.Windows.Point(112, 740));
            var y = 808.0;
            foreach (var item in report.RecentHighlights.Take(6))
            {
                dc.DrawRoundedRectangle(BrushFromHex("#F8F6F2"), null, new Rect(112, y, width - 224, 132), 10, 10);
                DrawText(dc, item.Title.Title, BoldTypeface, 30, BrushFromHex("#191919"), new System.Windows.Point(144, y + 24), maxWidth: width - 288);
                var sub = TimelineMoments.FormatMomentSummary(item, "ko");
                DrawText(dc, sub, RegularTypeface, 22, BrushFromHex("#636363"), new System.Windows.Point(144, y + 74), maxWidth: width - 288);
                y += 152;
            }

            DrawText(dc, "보고 읽은 순간을 그날의 온기로 남기다 · ottline.app", RegularTypeface, 24, BrushFromHex("#76736E"), new System.Windows.Point(112, 1768));
        }

        var rtb = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(visual);
        SaveBitmapToPng(rtb, outputPath);
    }

    private static FormattedText CreateFormattedText(
        string text,
        Typeface typeface,
        double fontSize,
        System.Windows.Media.Brush brush,
        double maxWidth = 900,
        double maxHeight = 320,
        double lineHeight = 0)
    {
        var ft = new FormattedText(
            text,
            CultureInfo.CurrentCulture,
            System.Windows.FlowDirection.LeftToRight,
            typeface,
            fontSize,
            brush,
            96.0)
        {
            MaxTextWidth = maxWidth,
            MaxTextHeight = maxHeight,
            Trimming = TextTrimming.CharacterEllipsis
        };
        if (lineHeight > 0)
        {
            ft.LineHeight = lineHeight;
        }
        return ft;
    }

    private static void DrawText(
        DrawingContext dc,
        string text,
        Typeface typeface,
        double fontSize,
        System.Windows.Media.Brush brush,
        System.Windows.Point origin,
        double maxWidth = 900,
        double maxHeight = 320)
    {
        var ft = CreateFormattedText(text, typeface, fontSize, brush, maxWidth, maxHeight);
        dc.DrawText(ft, origin);
    }

    private static SolidColorBrush FrozenBrush(System.Windows.Media.Color color)
    {
        var b = new SolidColorBrush(color);
        b.Freeze();
        return b;
    }

    private static SolidColorBrush BrushFromHex(string hex)
    {
        var color = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(hex);
        return FrozenBrush(color);
    }

    private static void SaveBitmapToPng(BitmapSource bmp, string outputPath)
    {
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bmp));
        Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
        using var fs = File.Create(outputPath);
        encoder.Save(fs);
    }
}
