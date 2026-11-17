using System.Collections.Concurrent;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Windows;
using System.Windows.Data;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using Ottline.Core.Models;

namespace Ottline.App.Theme;

public sealed class AsyncPosterImageNotifier : INotifyPropertyChanged
{
    public static readonly HttpClient SharedHttp = CreateHttpClient();
    private static readonly string DiskCacheDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ottline",
        "poster-cache"
    );

    private ImageSource? _source;
    public ImageSource? Source
    {
        get => _source;
        private set
        {
            _source = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Source)));
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public AsyncPosterImageNotifier(string url, int decodeWidth)
    {
        Directory.CreateDirectory(DiskCacheDir);
        var cacheFile = GetCacheFilePath(url);
        if (File.Exists(cacheFile))
        {
            _source = TryLoadFrozenBitmap(cacheFile, decodeWidth);
            if (_source != null) return;
        }

        _ = DownloadAndDecodeAsync(url, cacheFile, decodeWidth);
    }

    private static async Task DownloadAndDecodeAsync(string url, string cacheFile, int decodeWidth)
    {
        try
        {
            var bytes = await SharedHttp.GetByteArrayAsync(url).ConfigureAwait(false);
            if (bytes.Length == 0) return;

            try
            {
                await File.WriteAllBytesAsync(cacheFile, bytes).ConfigureAwait(false);
            }
            catch
            {
                // Ignore concurrent file write
            }

            var bmp = DecodeBytesToFrozenBitmap(bytes, decodeWidth);
            if (bmp != null)
            {
                UrlToImageSourceConverter.StoreInMemoryCache($"{decodeWidth}:{url}", bmp);
            }
        }
        catch
        {
            // Ignore download errors
        }
    }

    public static BitmapImage? TryLoadFrozenBitmap(string filePath, int decodeWidth)
    {
        try
        {
            var bytes = File.ReadAllBytes(filePath);
            return DecodeBytesToFrozenBitmap(bytes, decodeWidth);
        }
        catch
        {
            return null;
        }
    }

    private static BitmapImage? DecodeBytesToFrozenBitmap(byte[] bytes, int decodeWidth)
    {
        try
        {
            using var ms = new MemoryStream(bytes, writable: false);
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.CacheOption = BitmapCacheOption.OnLoad;
            bmp.CreateOptions = BitmapCreateOptions.IgnoreColorProfile;
            bmp.DecodePixelWidth = decodeWidth;
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

    public static string GetCacheFilePath(string url)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(url)))[..24].ToLowerInvariant();
        return Path.Combine(DiskCacheDir, $"{hash}.img");
    }

    private static HttpClient CreateHttpClient()
    {
        var client = new HttpClient(new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(2),
            MaxConnectionsPerServer = 4
        })
        {
            Timeout = TimeSpan.FromSeconds(10)
        };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("OttlineWindowsNative/2.0");
        return client;
    }
}

public sealed class UrlToImageSourceConverter : IValueConverter
{
    private static readonly ConcurrentDictionary<string, ImageSource> Cache = new(StringComparer.Ordinal);
    private static readonly string DiskCacheDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ottline",
        "poster-cache"
    );
    private static readonly BitmapSource PlaceholderBitmap = CreatePlaceholderBitmap();

    private static BitmapSource CreatePlaceholderBitmap()
    {
        var bmp = BitmapSource.Create(
            2,
            3,
            96,
            96,
            PixelFormats.Bgra32,
            null,
            new byte[2 * 3 * 4],
            2 * 4
        );
        bmp.Freeze();
        return bmp;
    }

    internal static void StoreInMemoryCache(string key, ImageSource img)
    {
        if (Cache.Count > 128) Cache.Clear();
        Cache[key] = img;
    }

    public static string NormalizePosterUrl(string raw, bool isHero = false)
    {
        var url = raw.Trim();
        if (url.StartsWith("/t/p/", StringComparison.OrdinalIgnoreCase))
        {
            url = $"https://image.tmdb.org{url}";
        }
        else if (url.StartsWith("//", StringComparison.Ordinal))
        {
            url = $"https:{url}";
        }
        else if (url.StartsWith("http://books.google.", StringComparison.OrdinalIgnoreCase) ||
                 url.StartsWith("http://books.googleusercontent.", StringComparison.OrdinalIgnoreCase) ||
                 url.StartsWith("http://t1.daumcdn.net/", StringComparison.OrdinalIgnoreCase))
        {
            url = "https://" + url[7..];
        }

        if (url.Contains("kakaocdn.net/thumb/", StringComparison.OrdinalIgnoreCase))
        {
            var fnameIdx = url.IndexOf("fname=", StringComparison.OrdinalIgnoreCase);
            if (fnameIdx >= 0)
            {
                var inner = Uri.UnescapeDataString(url[(fnameIdx + 6)..]);
                if (inner.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                {
                    inner = "https://" + inner[7..];
                }
                if (inner.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    return inner;
                }
            }
        }

        return isHero
            ? url
                .Replace("/t/p/w185/", "/t/p/w780/")
                .Replace("/t/p/w342/", "/t/p/w780/")
                .Replace("/t/p/w500/", "/t/p/w780/")
            : url
                .Replace("/t/p/w185/", "/t/p/w500/")
                .Replace("/t/p/w342/", "/t/p/w500/")
                .Replace("/t/p/w780/", "/t/p/w500/");
    }

    public static async Task PrefetchUrlsAsync(IEnumerable<string?> urls, bool isHero = false)
    {
        try
        {
            Directory.CreateDirectory(DiskCacheDir);
            var distinct = urls
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Select(u => NormalizePosterUrl(u!, isHero))
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (distinct.Count == 0) return;

            using var sem = new SemaphoreSlim(6);
            var tasks = distinct.Select(async normalized =>
            {
                var cacheFile = AsyncPosterImageNotifier.GetCacheFilePath(normalized);
                if (File.Exists(cacheFile)) return;

                await sem.WaitAsync().ConfigureAwait(false);
                try
                {
                    if (File.Exists(cacheFile)) return;
                    var bytes = await AsyncPosterImageNotifier.SharedHttp.GetByteArrayAsync(normalized).ConfigureAwait(false);
                    if (bytes.Length > 0)
                    {
                        await File.WriteAllBytesAsync(cacheFile, bytes).ConfigureAwait(false);
                    }
                }
                catch
                {
                    // Ignore individual poster prefetch failures
                }
                finally
                {
                    sem.Release();
                }
            });

            await Task.WhenAll(tasks).ConfigureAwait(false);
        }
        catch
        {
            // Ignore prefetch errors
        }
    }

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not string raw || string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            var isHero = string.Equals(parameter as string, "hero", StringComparison.OrdinalIgnoreCase);
            var normalized = NormalizePosterUrl(raw, isHero);
            var decodeWidth = isHero ? 680 : 400;
            var cacheKey = $"{decodeWidth}:{normalized}";

            if (Cache.TryGetValue(cacheKey, out var cachedImg))
            {
                return cachedImg;
            }

            Directory.CreateDirectory(DiskCacheDir);
            var cacheFile = AsyncPosterImageNotifier.GetCacheFilePath(normalized);
            if (File.Exists(cacheFile))
            {
                var diskBmp = AsyncPosterImageNotifier.TryLoadFrozenBitmap(cacheFile, decodeWidth);
                if (diskBmp != null)
                {
                    StoreInMemoryCache(cacheKey, diskBmp);
                    return diskBmp;
                }
            }

            var drawing = new ImageDrawing(
                PlaceholderBitmap,
                new Rect(0, 0, decodeWidth, decodeWidth * 1.5)
            );
            RenderOptions.SetBitmapScalingMode(drawing, BitmapScalingMode.HighQuality);
            var drawingImage = new DrawingImage(drawing);
            RenderOptions.SetBitmapScalingMode(drawingImage, BitmapScalingMode.HighQuality);
            StoreInMemoryCache(cacheKey, drawingImage);

            _ = DownloadAndPopulateAsync(normalized, cacheFile, cacheKey, decodeWidth, drawing);
            return drawingImage;
        }
        catch
        {
            return null;
        }
    }

    private static async Task DownloadAndPopulateAsync(string url, string cacheFile, string cacheKey, int decodeWidth, ImageDrawing targetDrawing)
    {
        try
        {
            if (!File.Exists(cacheFile))
            {
                var bytes = await AsyncPosterImageNotifier.SharedHttp.GetByteArrayAsync(url).ConfigureAwait(false);
                if (bytes.Length == 0) return;
                try
                {
                    await File.WriteAllBytesAsync(cacheFile, bytes).ConfigureAwait(false);
                }
                catch
                {
                    // Ignore concurrent write
                }
            }

            var bmp = AsyncPosterImageNotifier.TryLoadFrozenBitmap(cacheFile, decodeWidth);
            if (bmp == null) return;

            var app = System.Windows.Application.Current;
            if (app != null)
            {
                await app.Dispatcher.InvokeAsync(() =>
                {
                    targetDrawing.ImageSource = bmp;
                    StoreInMemoryCache(cacheKey, bmp);
                });
            }
        }
        catch
        {
            // Ignore background download error
        }
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public static class OttlineThemeManager
{
    private static bool _systemEventsHooked;
    public static ThemeMode CurrentMode { get; private set; } = ThemeMode.SYSTEM;
    public static bool IsDarkActive { get; private set; }

    public static void ApplyTheme(ThemeMode mode)
    {
        CurrentMode = mode;
        if (!_systemEventsHooked)
        {
            _systemEventsHooked = true;
            SystemEvents.UserPreferenceChanged += (_, _) =>
            {
                if (CurrentMode == ThemeMode.SYSTEM)
                {
                    System.Windows.Application.Current?.Dispatcher.BeginInvoke(() => ApplyTheme(ThemeMode.SYSTEM));
                }
            };
        }

        var useDark = mode switch
        {
            ThemeMode.DARK => true,
            ThemeMode.LIGHT => false,
            ThemeMode.SYSTEM => IsWindowsInDarkMode(),
            _ => false
        };

        IsDarkActive = useDark;
        var res = System.Windows.Application.Current?.Resources;
        if (res == null) return;

        var fontsDir = Path.Combine(AppContext.BaseDirectory, "Resources", "Fonts");
        if (Directory.Exists(fontsDir))
        {
            var baseUri = new Uri(fontsDir.EndsWith(Path.DirectorySeparatorChar) ? fontsDir : fontsDir + Path.DirectorySeparatorChar);
            var diskFont = new System.Windows.Media.FontFamily(baseUri, "./#Pretendard, Malgun Gothic, Segoe UI");
            res["PretendardFont"] = diskFont;
            res["OttlineFontFamily"] = diskFont;
        }

        if (!useDark)
        {
            // Light Theme (globals.css + AppShell.module.css + timeline.module.css exact tokens)
            SetBrush(res, "BgPrimaryBrush", "#F8F6F2");
            SetBrush(res, "BackgroundBrush", "#F8F6F2");
            SetBrush(res, "BgCardBrush", "#FFFFFF");
            SetBrush(res, "CardBrush", "#FFFFFF");
            SetBrush(res, "BgElevatedBrush", "#FEF9EE");
            SetBrush(res, "CardElevatedBrush", "#FEF9EE");
            SetBrush(res, "BgSecondaryBrush", "#ECEBE9");
            SetBrush(res, "BgHoverBrush", "#F2EFE9");

            SetBrush(res, "TextPrimaryBrush", "#0F0F0F");
            SetBrush(res, "ForegroundBrush", "#0F0F0F");
            SetBrush(res, "TextSecondaryBrush", "#4A4A4A");
            SetBrush(res, "ForegroundSecondaryBrush", "#4A4A4A");
            SetBrush(res, "TextMutedBrush", "#4A4A4A");
            SetBrush(res, "ForegroundMutedBrush", "#4A4A4A");
            SetBrush(res, "TextCaptionBrush", "#636363");

            SetBrush(res, "BrandMarkBrush", "#1E4D8C");
            SetBrush(res, "BrandNavyBrush", "#1E4D8C");
            SetBrush(res, "PrimaryBrush", "#1E4D8C");
            SetBrush(res, "BrandNavySoftBrush", "#EBF1F8");
            SetBrush(res, "AccentOrangeBrush", "#FF9933");
            SetBrush(res, "AccentBrush", "#FF9933");
            SetBrush(res, "AccentOrangeTextBrush", "#0F0F0F");
            SetBrush(res, "AccentOrangeSoftBrush", "#FFF3E0");

            SetBrush(res, "BorderHairlineBrush", "#ECEBE9");
            SetBrush(res, "BorderBrush", "#ECEBE9");
            SetBrush(res, "BorderStrongBrush", "#CFCBC4");

            SetBrush(res, "SemanticSuccessBrush", "#2E7D32");
            SetBrush(res, "SemanticSuccessBgBrush", "#EBF5EC");
            SetBrush(res, "SemanticWarningBrush", "#E65100");
            SetBrush(res, "SemanticWarningBgBrush", "#FFF3E0");
            SetBrush(res, "SemanticDangerBrush", "#C62828");
            SetBrush(res, "ErrorBrush", "#C62828");
            SetBrush(res, "SemanticDangerBgBrush", "#FDECEA");
            SetBrush(res, "OverlayScrimBrush", "#9914110E");
        }
        else
        {
            // Dark Theme (globals.css .dark + AppShell.module.css + timeline.module.css exact tokens)
            // In web .dark:
            // - mark-inverse.svg stroke is #F8F6F2
            // - .brandName, .topNav[data-active], .quietLink, .sideLink, .featuredStatus, .recordState, .button are var(--foreground) (#FFF8EF)
            // - --color-brand-navy stays #1E4D8C (never light sky blue)
            SetBrush(res, "BgPrimaryBrush", "#15120F");
            SetBrush(res, "BackgroundBrush", "#15120F");
            SetBrush(res, "BgCardBrush", "#211C18");
            SetBrush(res, "CardBrush", "#211C18");
            SetBrush(res, "BgElevatedBrush", "#2B241F");
            SetBrush(res, "CardElevatedBrush", "#2B241F");
            SetBrush(res, "BgSecondaryBrush", "#2B241F");
            SetBrush(res, "BgHoverBrush", "#2B241F");

            SetBrush(res, "TextPrimaryBrush", "#FFF8EF");
            SetBrush(res, "ForegroundBrush", "#FFF8EF");
            SetBrush(res, "TextSecondaryBrush", "#D8CFC4");
            SetBrush(res, "ForegroundSecondaryBrush", "#D8CFC4");
            SetBrush(res, "TextMutedBrush", "#D8CFC4");
            SetBrush(res, "ForegroundMutedBrush", "#D8CFC4");
            SetBrush(res, "TextCaptionBrush", "#D8CFC4");

            SetBrush(res, "BrandMarkBrush", "#F8F6F2");
            SetBrush(res, "BrandNavyBrush", "#1E4D8C");
            SetBrush(res, "PrimaryBrush", "#FFF8EF");
            SetBrush(res, "BrandNavySoftBrush", "#2B241F");
            SetBrush(res, "AccentOrangeBrush", "#FF9933");
            SetBrush(res, "AccentBrush", "#FF9933");
            SetBrush(res, "AccentOrangeTextBrush", "#0F0F0F");
            SetBrush(res, "AccentOrangeSoftBrush", "#3A3027");

            SetBrush(res, "BorderHairlineBrush", "#1FFFF8EF");
            SetBrush(res, "BorderBrush", "#1FFFF8EF");
            SetBrush(res, "BorderStrongBrush", "#2EFFF8EF");

            SetBrush(res, "SemanticSuccessBrush", "#81C784");
            SetBrush(res, "SemanticSuccessBgBrush", "#1B301E");
            SetBrush(res, "SemanticWarningBrush", "#FFB74D");
            SetBrush(res, "SemanticWarningBgBrush", "#382714");
            SetBrush(res, "SemanticDangerBrush", "#FCA5A5");
            SetBrush(res, "ErrorBrush", "#FCA5A5");
            SetBrush(res, "SemanticDangerBgBrush", "#3B1A1A");
            SetBrush(res, "OverlayScrimBrush", "#BB090705");
        }

        ApplyWindowTitleBarTheme(System.Windows.Application.Current?.MainWindow, useDark);
    }

    private const int DwmwaUseImmersiveDarkMode = 20;
    private const int DwmwaWindowCornerPreference = 33;
    private const int DwmwaBorderColor = 34;
    private const int DwmwaCaptionColor = 35;
    private const int DwmwaTextColor = 36;
    private const int DwmwcpRound = 2;

    private const int GwlExStyle = -20;
    private const int WsExDlgModalFrame = 0x00000001;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoZOrder = 0x0004;
    private const uint SwpFrameChanged = 0x0020;
    private const int WmSetIcon = 0x0080;
    private const int IconSmall = 0;

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    public static void ApplyWindowTitleBarTheme(Window? window, bool isDark)
    {
        if (window == null) return;
        try
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero) return;

            // Remove small top-left caption icon while preserving taskbar/Alt+Tab icon
            var exStyle = GetWindowLong(hwnd, GwlExStyle);
            if ((exStyle & WsExDlgModalFrame) == 0)
            {
                SetWindowLong(hwnd, GwlExStyle, exStyle | WsExDlgModalFrame);
                SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0, SwpNoMove | SwpNoSize | SwpNoZOrder | SwpFrameChanged);
            }
            SendMessage(hwnd, WmSetIcon, (IntPtr)IconSmall, IntPtr.Zero);

            var darkVal = isDark ? 1 : 0;
            _ = DwmSetWindowAttribute(hwnd, DwmwaUseImmersiveDarkMode, ref darkVal, sizeof(int));

            var cornerPref = DwmwcpRound;
            _ = DwmSetWindowAttribute(hwnd, DwmwaWindowCornerPreference, ref cornerPref, sizeof(int));

            // COLORREF is 0x00BBGGRR:
            // Light: Bg=#F8F6F2 (0x00F2F6F8), Text=#4A4845 (0x0045484A), Border=#E4E1DC (0x00DCE1E4)
            // Dark:  Bg=#15120F (0x000F1215), Text=#C7C0B6 (0x00B6C0C7), Border=#38302A (0x002A3038)
            var captionColor = isDark ? 0x000F1215 : 0x00F2F6F8;
            var textColor = isDark ? 0x00B6C0C7 : 0x0045484A;
            var borderColor = isDark ? 0x002A3038 : 0x00DCE1E4;

            _ = DwmSetWindowAttribute(hwnd, DwmwaCaptionColor, ref captionColor, sizeof(int));
            _ = DwmSetWindowAttribute(hwnd, DwmwaTextColor, ref textColor, sizeof(int));
            _ = DwmSetWindowAttribute(hwnd, DwmwaBorderColor, ref borderColor, sizeof(int));
        }
        catch
        {
            // Ignore on older Windows versions that do not support DWM caption color attributes
        }
    }

    private static void SetBrush(ResourceDictionary dict, string key, string hex)
    {
        var color = (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(hex);
        var brush = new SolidColorBrush(color);
        brush.Freeze();
        dict[key] = brush;
    }

    private static bool IsWindowsInDarkMode()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            var val = key?.GetValue("AppsUseLightTheme");
            if (val is int i) return i == 0;
        }
        catch
        {
            // Ignore registry errors
        }
        return false;
    }
}
