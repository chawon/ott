using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Windows.Widgets;
using Microsoft.Windows.Widgets.Providers;
using Ottline.App.Services;
using Ottline.App.Theme;
using Ottline.Core.Domain;
using Ottline.Core.Local;
using WinRT;

namespace Ottline.App.Widgets;

[Guid(ProviderClsidString)]
public sealed class OttlineWidgetProvider : IWidgetProvider
{
    public const string ProviderClsidString = "7E642A91-3C4D-4F18-9B52-84E2C6D1039A";
    public static readonly Guid ProviderClsid = new(ProviderClsidString);

    private const int AppModelErrorNoPackage = 15700;
    private static readonly ConcurrentDictionary<string, WidgetSize> ActiveWidgets = new(StringComparer.Ordinal);
    private static readonly object RefreshLock = new();

    public static int ActiveWidgetCount => ActiveWidgets.Count;

    public void CreateWidget(WidgetContext widgetContext)
    {
        ActiveWidgets[widgetContext.Id] = widgetContext.Size;
        UpdateSingleWidget(widgetContext.Id, widgetContext.Size);
    }

    public void Activate(WidgetContext widgetContext)
    {
        ActiveWidgets[widgetContext.Id] = widgetContext.Size;
        UpdateSingleWidget(widgetContext.Id, widgetContext.Size);
    }

    public void Deactivate(string widgetId)
    {
        ActiveWidgets.TryRemove(widgetId, out _);
    }

    public void DeleteWidget(string widgetId, string customState)
    {
        ActiveWidgets.TryRemove(widgetId, out _);
        OttlineWidgetComServer.SignalIfEmpty();
    }

    public void OnWidgetContextChanged(WidgetContextChangedArgs contextChangedArgs)
    {
        var ctx = contextChangedArgs.WidgetContext;
        ActiveWidgets[ctx.Id] = ctx.Size;
        UpdateSingleWidget(ctx.Id, ctx.Size);
    }

    public void OnActionInvoked(WidgetActionInvokedArgs actionInvokedArgs)
    {
        try
        {
            var deepLink = MapActionToDeepLink(actionInvokedArgs.Verb, actionInvokedArgs.Data);
            if (!DesktopIntegrationService.TryForwardToExistingInstance(new[] { deepLink }))
            {
                var launchedViaProtocol = false;
                if (IsPackagedProcess())
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo(deepLink) { UseShellExecute = true });
                        launchedViaProtocol = true;
                    }
                    catch
                    {
                        launchedViaProtocol = false;
                    }
                }

                if (!launchedViaProtocol)
                {
                    var exePath = Environment.ProcessPath;
                    if (!string.IsNullOrWhiteSpace(exePath) && File.Exists(exePath))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = exePath,
                            Arguments = $"\"{deepLink}\"",
                            UseShellExecute = false
                        });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            LogWidget($"OnActionInvoked error: {ex.Message}");
        }
    }

    public static string MapActionToDeepLink(string? verb, string? dataJson)
    {
        var cleanVerb = verb?.Trim() ?? string.Empty;
        if (string.Equals(cleanVerb, "open_title", StringComparison.OrdinalIgnoreCase))
        {
            var titleId = ExtractJsonStringProperty(dataJson, "titleId");
            if (!string.IsNullOrWhiteSpace(titleId))
            {
                return $"ottline://quick?title_id={Uri.EscapeDataString(titleId)}";
            }
            return "ottline://quick?type=all";
        }

        return cleanVerb switch
        {
            "quick_record_video" => "ottline://quick?type=video",
            "quick_record_book" => "ottline://quick?type=book",
            "open_timeline" => "ottline://timeline",
            _ => "ottline://quick?type=all"
        };
    }

    public static bool IsPackagedProcess()
    {
        try
        {
            uint len = 0;
            var res = GetCurrentPackageFullName(ref len, null);
            return res != AppModelErrorNoPackage;
        }
        catch
        {
            return false;
        }
    }

    public static void RefreshAllWidgetsIfPackaged()
    {
        if (!IsPackagedProcess()) return;

        _ = Task.Run(() =>
        {
            lock (RefreshLock)
            {
                try
                {
                    var manager = WidgetManager.GetDefault();
                    var infos = manager.GetWidgetInfos();
                    if (infos == null || infos.Length == 0) return;

                    var (snapshot, posterUri) = LoadSnapshotAndPoster();
                    foreach (var info in infos)
                    {
                        var ctx = info.WidgetContext;
                        if (ctx == null || string.IsNullOrWhiteSpace(ctx.Id)) continue;
                        var sizeKey = ToSizeKey(ctx.Size);
                        var cardJson = OttlineWidgetSnapshotBuilder.BuildAdaptiveCardJson(snapshot, sizeKey, posterUri);
                        var opts = new WidgetUpdateRequestOptions(ctx.Id)
                        {
                            Template = cardJson,
                            Data = "{}"
                        };
                        manager.UpdateWidget(opts);
                    }
                }
                catch (Exception ex)
                {
                    LogWidget($"RefreshAllWidgetsIfPackaged error: {ex.Message}");
                }
            }
        });
    }

    public static int RunPackagedWidgetVerification()
    {
        try
        {
            ComWrappersSupport.InitializeComWrappers();
            var isPackaged = IsPackagedProcess();
            if (!isPackaged)
            {
                LogWidget("[WARN] Packaged widget verification ran without package identity (isPackaged=False).");
                return 2;
            }

            var ids = WidgetManager.GetDefault().GetWidgetIds();
            var catalogSummary = QueryWidgetCatalogSafe();
            LogWidget($"[OK] Packaged widget verification: isPackaged=True, activeIds={ids?.Length ?? 0}, catalogInfo={catalogSummary}");
            return 0;
        }
        catch (Exception ex)
        {
            LogWidget($"[ERR] Packaged widget verification failed: {ex}");
            return 1;
        }
    }

    private static string QueryWidgetCatalogSafe()
    {
        try
        {
            var clsid = new Guid("3E11DF0F-42EB-4747-9A35-802D98B5BCF0");
            var iid = new Guid("3E11DF0F-42EB-4747-9A35-802D98B5BCF0");
            var hr = CoCreateInstance(ref clsid, IntPtr.Zero, 4 /* CLSCTX_LOCAL_SERVER */, ref iid, out var ptr);
            if (hr != 0 || ptr == IntPtr.Zero)
            {
                var iidAlt = new Guid("A05AE4C6-1A73-5A81-8C4E-00F5F379E91A");
                hr = CoCreateInstance(ref clsid, IntPtr.Zero, 4, ref iidAlt, out ptr);
                if (hr != 0 || ptr == IntPtr.Zero)
                {
                    return $"CoCreateInstance=0x{hr:X8}";
                }
            }

            try
            {
                var vtbl = Marshal.ReadIntPtr(ptr);
                var fnPtr = Marshal.ReadIntPtr(vtbl, 6 * IntPtr.Size);
                var getDefs = Marshal.GetDelegateForFunctionPointer<GetDefinitionsDelegate>(fnPtr);
                var hr2 = getDefs(ptr, out var count, out var arrPtr);
                if (hr2 != 0)
                {
                    return $"vtbl6=0x{hr2:X8}";
                }

                var foundOttline = false;
                var defIds = new List<string>();
                if (arrPtr != IntPtr.Zero && count > 0)
                {
                    for (uint i = 0; i < count && i < 64; i++)
                    {
                        var itemPtr = Marshal.ReadIntPtr(arrPtr, (int)(i * IntPtr.Size));
                        if (itemPtr == IntPtr.Zero) continue;
                        try
                        {
                            var ivtbl = Marshal.ReadIntPtr(itemPtr);
                            var getIdPtr = Marshal.ReadIntPtr(ivtbl, 6 * IntPtr.Size);
                            var getId = Marshal.GetDelegateForFunctionPointer<GetHStringPropDelegate>(getIdPtr);
                            if (getId(itemPtr, out var hId) == 0 && hId != IntPtr.Zero)
                            {
                                try
                                {
                                    var strPtr = WindowsGetStringRawBuffer(hId, out var strLen);
                                    var idVal = strPtr != IntPtr.Zero ? Marshal.PtrToStringUni(strPtr, (int)strLen) : "";
                                    if (!string.IsNullOrWhiteSpace(idVal))
                                    {
                                        defIds.Add(idVal);
                                        if (idVal.Contains("Ottline", StringComparison.OrdinalIgnoreCase))
                                        {
                                            foundOttline = true;
                                        }
                                    }
                                }
                                finally
                                {
                                    WindowsDeleteString(hId);
                                }
                            }
                        }
                        finally
                        {
                            Marshal.Release(itemPtr);
                        }
                    }
                    Marshal.FreeCoTaskMem(arrPtr);
                }
                return $"defs={count}, foundOttline={foundOttline}, sample=[{string.Join(",", defIds.Take(10))}]";
            }
            finally
            {
                Marshal.Release(ptr);
            }
        }
        catch (Exception ex)
        {
            return $"ex={ex.Message}";
        }
    }

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int GetDefinitionsDelegate(IntPtr self, out uint count, out IntPtr items);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int GetHStringPropDelegate(IntPtr self, out IntPtr hstring);

    [DllImport("ole32.dll", PreserveSig = true)]
    private static extern int CoCreateInstance(ref Guid rclsid, IntPtr pUnkOuter, uint dwClsContext, ref Guid riid, out IntPtr ppv);

    [DllImport("combase.dll", PreserveSig = true)]
    private static extern IntPtr WindowsGetStringRawBuffer(IntPtr hstring, out uint length);

    [DllImport("combase.dll", PreserveSig = true)]
    private static extern int WindowsDeleteString(IntPtr hstring);

    internal static (OttlineWidgetSnapshot Snapshot, string? PosterUri) LoadSnapshotAndPoster()
    {
        using var db = new OttlineDatabase();
        var settings = db.LoadSettings();
        var logs = db.GetAllLogs();
        var snapshot = OttlineWidgetSnapshotBuilder.BuildSnapshot(logs, settings.Locale);
        var posterUri = ResolvePosterDataUri(snapshot.ContinueItem?.PosterUrl);
        return (snapshot, posterUri);
    }

    private static void UpdateSingleWidget(string widgetId, WidgetSize size)
    {
        try
        {
            var (snapshot, posterUri) = LoadSnapshotAndPoster();
            var sizeKey = ToSizeKey(size);
            var cardJson = OttlineWidgetSnapshotBuilder.BuildAdaptiveCardJson(snapshot, sizeKey, posterUri);

            var options = new WidgetUpdateRequestOptions(widgetId)
            {
                Template = cardJson,
                Data = "{}"
            };
            WidgetManager.GetDefault().UpdateWidget(options);
        }
        catch (Exception ex)
        {
            LogWidget($"UpdateSingleWidget({widgetId}) error: {ex.Message}");
        }
    }

    private static string ToSizeKey(WidgetSize size) => size switch
    {
        WidgetSize.Small => "small",
        WidgetSize.Large => "large",
        _ => "medium"
    };

    public static string? ResolvePosterDataUri(string? rawPosterUrl)
    {
        if (string.IsNullOrWhiteSpace(rawPosterUrl)) return null;

        var normalized = UrlToImageSourceConverter.NormalizePosterUrl(rawPosterUrl, isHero: false);
        try
        {
            var cacheFile = AsyncPosterImageNotifier.GetCacheFilePath(normalized);
            byte[]? rawBytes = null;
            if (File.Exists(cacheFile))
            {
                rawBytes = File.ReadAllBytes(cacheFile);
            }
            else if (normalized.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
                     normalized.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                rawBytes = AsyncPosterImageNotifier.SharedHttp.GetByteArrayAsync(normalized, cts.Token).GetAwaiter().GetResult();
                if (rawBytes.Length > 0)
                {
                    try
                    {
                        var cacheDir = Path.GetDirectoryName(cacheFile);
                        if (!string.IsNullOrWhiteSpace(cacheDir)) Directory.CreateDirectory(cacheDir);
                        File.WriteAllBytes(cacheFile, rawBytes);
                    }
                    catch
                    {
                        // Ignore cache write contention
                    }
                }
            }

            if (rawBytes is { Length: > 0 })
            {
                var dataUri = EncodeThumbnailJpegDataUri(rawBytes, 96, 138, 80L);
                if (!string.IsNullOrWhiteSpace(dataUri))
                {
                    return dataUri;
                }
            }
        }
        catch
        {
            // Fall back to normalized HTTPS URL below
        }

        return normalized.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ? normalized : null;
    }

    private static string? EncodeThumbnailJpegDataUri(byte[] imageBytes, int targetW, int targetH, long quality)
    {
        try
        {
            using var msIn = new MemoryStream(imageBytes, writable: false);
            using var srcImg = Image.FromStream(msIn, useEmbeddedColorManagement: false, validateImageData: false);
            if (srcImg.Width <= 0 || srcImg.Height <= 0) return null;

            using var destBmp = new Bitmap(targetW, targetH, PixelFormat.Format24bppRgb);
            destBmp.SetResolution(96, 96);
            using (var g = Graphics.FromImage(destBmp))
            {
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.Clear(Color.FromArgb(248, 246, 242));

                var scale = Math.Max((float)targetW / srcImg.Width, (float)targetH / srcImg.Height);
                var drawW = srcImg.Width * scale;
                var drawH = srcImg.Height * scale;
                var dx = (targetW - drawW) * 0.5f;
                var dy = (targetH - drawH) * 0.5f;
                g.DrawImage(srcImg, new RectangleF(dx, dy, drawW, drawH));
            }

            using var msOut = new MemoryStream();
            var jpegEncoder = ImageCodecInfo.GetImageEncoders().FirstOrDefault(c => c.FormatID == ImageFormat.Jpeg.Guid);
            if (jpegEncoder != null)
            {
                using var encParams = new EncoderParameters(1);
                encParams.Param[0] = new EncoderParameter(Encoder.Quality, quality);
                destBmp.Save(msOut, jpegEncoder, encParams);
            }
            else
            {
                destBmp.Save(msOut, ImageFormat.Jpeg);
            }

            return $"data:image/jpeg;base64,{Convert.ToBase64String(msOut.ToArray())}";
        }
        catch
        {
            return null;
        }
    }

    private static string? ExtractJsonStringProperty(string? json, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                doc.RootElement.TryGetProperty(propertyName, out var prop) &&
                prop.ValueKind == JsonValueKind.String)
            {
                return prop.GetString();
            }
        }
        catch
        {
            // Ignore malformed JSON
        }
        return null;
    }

    internal static void LogWidget(string message) =>
        App.AppendBoundedLog("widget.log", $"[{DateTimeOffset.Now:O}] {message}{Environment.NewLine}");

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    private static extern int GetCurrentPackageFullName(ref uint packageFullNameLength, char[]? packageFullName);
}

public static class OttlineWidgetComServer
{
    private const uint ClsctxLocalServer = 0x4;
    private const uint RegclsMultipleUse = 0x1;
    private const int ClassENoAggregation = unchecked((int)0x80040110);
    private const int ENoInterface = unchecked((int)0x80004002);

    private static readonly Guid IidIUnknown = new("00000000-0000-0000-C000-000000000046");
    private static readonly Guid IidIInspectable = new("AF86E2E0-B12D-4c6a-9C5A-D7AA65101E90");
    private static readonly ManualResetEventSlim ExitEvent = new(false);

    public static void SignalIfEmpty()
    {
        if (OttlineWidgetProvider.ActiveWidgetCount == 0)
        {
            // Keep brief grace period in case host recreates widget immediately
            _ = Task.Run(async () =>
            {
                await Task.Delay(5000).ConfigureAwait(false);
                if (OttlineWidgetProvider.ActiveWidgetCount == 0)
                {
                    ExitEvent.Set();
                }
            });
        }
    }

    public static int Run(string[] args)
    {
        var isSmokeTest = args.Any(a => string.Equals(a, "--smoke-test", StringComparison.OrdinalIgnoreCase));

        try
        {
            ComWrappersSupport.InitializeComWrappers();

            if (isSmokeTest)
            {
                return RunSmokeTest();
            }

            var clsid = OttlineWidgetProvider.ProviderClsid;
            var factory = new WidgetProviderClassFactory();
            var hr = CoRegisterClassObject(
                ref clsid,
                factory,
                ClsctxLocalServer,
                RegclsMultipleUse,
                out var cookie
            );

            if (hr < 0)
            {
                OttlineWidgetProvider.LogWidget($"CoRegisterClassObject failed: 0x{hr:X8}");
                return hr;
            }

            OttlineWidgetProvider.LogWidget($"COM class registered (cookie={cookie}), waiting for Widgets Board...");
            ExitEvent.Wait();
            _ = CoRevokeClassObject(cookie);
            OttlineWidgetProvider.LogWidget("COM class revoked, exiting cleanly.");
            return 0;
        }
        catch (Exception ex)
        {
            OttlineWidgetProvider.LogWidget($"COM server fatal error: {ex}");
            return 1;
        }
    }

    private static int RunSmokeTest()
    {
        var factory = (IClassFactory)new WidgetProviderClassFactory();
        var riid = typeof(IWidgetProvider).GUID;
        var hr = factory.CreateInstance(IntPtr.Zero, ref riid, out var ppv);
        if (hr != 0 || ppv == IntPtr.Zero)
        {
            OttlineWidgetProvider.LogWidget($"Smoke test CreateInstance failed: hr=0x{hr:X8}, ppv=0x{ppv:X}");
            return 2;
        }
        Marshal.Release(ppv);

        var (snapshot, posterUri) = OttlineWidgetProvider.LoadSnapshotAndPoster();
        var cardJson = OttlineWidgetSnapshotBuilder.BuildAdaptiveCardJson(snapshot, "medium", posterUri);
        using var parsed = JsonDocument.Parse(cardJson);
        if (!parsed.RootElement.TryGetProperty("type", out var typeEl) || typeEl.GetString() != "AdaptiveCard")
        {
            OttlineWidgetProvider.LogWidget("Smoke test failed: invalid AdaptiveCard payload");
            return 3;
        }

        OttlineWidgetProvider.LogWidget(
            $"[OK] Widget COM smoke test passed (riid={riid}, monthBadge={snapshot.MonthBadge}, hasContinue={snapshot.ContinueItem != null}, cardLen={cardJson.Length})"
        );
        return 0;
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("00000001-0000-0000-C000-000000000046")]
    private interface IClassFactory
    {
        [PreserveSig]
        int CreateInstance(IntPtr pUnkOuter, ref Guid riid, out IntPtr ppvObject);

        [PreserveSig]
        int LockServer([MarshalAs(UnmanagedType.Bool)] bool fLock);
    }

    [ComVisible(true)]
    private sealed class WidgetProviderClassFactory : IClassFactory
    {
        public int CreateInstance(IntPtr pUnkOuter, ref Guid riid, out IntPtr ppvObject)
        {
            ppvObject = IntPtr.Zero;
            if (pUnkOuter != IntPtr.Zero)
            {
                return ClassENoAggregation;
            }

            if (riid == typeof(IWidgetProvider).GUID)
            {
                ppvObject = MarshalInterface<IWidgetProvider>.FromManaged(new OttlineWidgetProvider());
                return ppvObject != IntPtr.Zero ? 0 : ENoInterface;
            }

            var inspectable = MarshalInspectable<IWidgetProvider>.FromManaged(new OttlineWidgetProvider());
            if (inspectable == IntPtr.Zero)
            {
                return ENoInterface;
            }

            if (riid == IidIUnknown || riid == IidIInspectable)
            {
                ppvObject = inspectable;
                return 0;
            }

            var hr = Marshal.QueryInterface(inspectable, ref riid, out ppvObject);
            Marshal.Release(inspectable);
            return hr;
        }

        public int LockServer(bool fLock) => 0;
    }

    [DllImport("ole32.dll", PreserveSig = true)]
    private static extern int CoRegisterClassObject(
        ref Guid rclsid,
        [MarshalAs(UnmanagedType.Interface)] IClassFactory pUnk,
        uint dwClsContext,
        uint flags,
        out uint lpdwRegister
    );

    [DllImport("ole32.dll", PreserveSig = true)]
    private static extern int CoRevokeClassObject(uint dwRegister);
}
