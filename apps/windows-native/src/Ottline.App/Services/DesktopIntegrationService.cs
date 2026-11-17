using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;
using Microsoft.Win32;
using Ottline.Core.Models;
using Ottline.Core.WatchDetection;

namespace Ottline.App.Services;

public sealed record SavedWindowPlacement(
    double Left,
    double Top,
    double Width,
    double Height,
    bool IsMaximized
);

public sealed class DesktopIntegrationService : IDisposable
{
    public const string PipeName = "OttlineWindows_IPC_Pipe_v2";
    private const int HotkeyIdQuickRecord = 9001;
    private const uint ModControl = 0x0002;
    private const uint ModShift = 0x0004;
    private const uint VkO = 0x4F;
    private const int WmHotkey = 0x0312;

    private readonly WatchReminderEngine _watchEngine = new();
    private readonly DispatcherTimer _foregroundPollTimer;
    private readonly CancellationTokenSource _ipcCts = new();
    private System.Windows.Forms.NotifyIcon? _notifyIcon;
    private TrayPopupWindow? _trayPopup;
    private HwndSource? _hwndSource;
    private IntPtr _windowHandle;
    private bool _hotkeyRegistered;
    private string? _lastBalloonPlatform;

    public event Action<string>? ExternalCommandReceived;
    public event Action? QuickRecordShortcutTriggered;
    public event Action<WatchReminderCandidate>? WatchReminderTriggered;
    public event Action? SyncRequestedFromTray;
    public event Action? ExitRequestedFromTray;
    public event Action? RestoreRequestedFromTray;

    public WatchReminderEngine WatchEngine => _watchEngine;
    public string? CurrentDetectedOttPlatform => _watchEngine.ActivePlatform;
    public TimeSpan CurrentDetectedOttDuration => _watchEngine.AccumulatedDuration;

    public Func<LocalSettings>? SettingsProvider { get; set; }
    public Func<string>? SyncStatusProvider { get; set; }

    public DesktopIntegrationService()
    {
        _foregroundPollTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(3)
        };
        _foregroundPollTimer.Tick += OnForegroundPollTick;
    }

    public static bool TryForwardToExistingInstance(string[] args)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
            client.Connect(400);
            var payload = args.Length > 0 ? string.Join(" ", args) : "ACTIVATE";
            var bytes = Encoding.UTF8.GetBytes(payload);
            client.Write(bytes, 0, bytes.Length);
            client.Flush();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public void Initialize(Window mainWindow)
    {
        EnsureCustomUriProtocolRegistered();
        StartIpcServer();
        InitializeTrayIcon();

        var helper = new WindowInteropHelper(mainWindow);
        _windowHandle = helper.EnsureHandle();
        _hwndSource = HwndSource.FromHwnd(_windowHandle);
        _hwndSource?.AddHook(WndProc);

        var settings = SettingsProvider?.Invoke();
        UpdateGlobalHotkey(settings?.GlobalHotkeyEnabled ?? true);

        _foregroundPollTimer.Start();
    }

    public void UpdateGlobalHotkey(bool enabled)
    {
        if (_windowHandle == IntPtr.Zero) return;
        if (_hotkeyRegistered)
        {
            UnregisterHotKey(_windowHandle, HotkeyIdQuickRecord);
            _hotkeyRegistered = false;
        }

        if (enabled)
        {
            _hotkeyRegistered = RegisterHotKey(_windowHandle, HotkeyIdQuickRecord, ModControl | ModShift, VkO);
        }
    }

    public void ShowWatchReminderNotification(string platformName, string locale = "ko", long durationMinutes = 5)
    {
        _lastBalloonPlatform = platformName;
        var (title, body) = WatchReminderEngine.FormatNotificationText(platformName, locale);
        if (_notifyIcon != null)
        {
            _notifyIcon.BalloonTipTitle = title;
            _notifyIcon.BalloonTipText = body;
            _notifyIcon.BalloonTipIcon = System.Windows.Forms.ToolTipIcon.Info;
            _notifyIcon.ShowBalloonTip(7000);
        }

        WatchReminderTriggered?.Invoke(new WatchReminderCandidate(platformName, durationMinutes, DateTimeOffset.Now));
    }

    public void NotifyLogSaved()
    {
        _watchEngine.NotifyLogSaved(DateTimeOffset.Now);
    }

    private void OnForegroundPollTick(object? sender, EventArgs e)
    {
        try
        {
            var settings = SettingsProvider?.Invoke();
            var enabled = settings?.WatchReminderEnabled ?? true;
            if (!enabled)
            {
                _watchEngine.ResetSession();
                return;
            }

            var (procName, winTitle) = GetActiveWindowProcessAndTitle();
            var candidate = _watchEngine.ProcessForegroundSample(procName, winTitle, DateTimeOffset.Now, enabled);
            if (candidate != null)
            {
                ShowWatchReminderNotification(candidate.PlatformName, settings?.Locale ?? "ko", candidate.DurationMinutes);
            }
        }
        catch
        {
            // Never fail UI thread on foreground window inspection
        }
    }

    public static (string? ProcessName, string? WindowTitle) GetActiveWindowProcessAndTitle()
    {
        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return (null, null);

        var sb = new StringBuilder(512);
        var len = GetWindowTextW(hwnd, sb, sb.Capacity);
        var title = len > 0 ? sb.ToString() : string.Empty;

        GetWindowThreadProcessId(hwnd, out var pid);
        string? procName = null;
        if (pid != 0)
        {
            var hProcess = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid);
            if (hProcess != IntPtr.Zero)
            {
                try
                {
                    var pathSb = new StringBuilder(512);
                    var size = (uint)pathSb.Capacity;
                    if (QueryFullProcessImageNameW(hProcess, 0, pathSb, ref size) && size > 0)
                    {
                        procName = Path.GetFileNameWithoutExtension(pathSb.ToString());
                    }
                }
                finally
                {
                    CloseHandle(hProcess);
                }
            }
        }

        return (procName, title);
    }

    public static void TrimProcessMemory(bool emptyWorkingSet = false)
    {
        try
        {
            System.Runtime.GCSettings.LargeObjectHeapCompactionMode = System.Runtime.GCLargeObjectHeapCompactionMode.CompactOnce;
            GC.Collect(2, GCCollectionMode.Optimized, blocking: true, compacting: true);
            GC.WaitForPendingFinalizers();
            if (emptyWorkingSet)
            {
                using var current = Process.GetCurrentProcess();
                EmptyWorkingSet(current.Handle);
            }
        }
        catch
        {
            // Ignore working set trim errors
        }
    }

    private void InitializeTrayIcon()
    {
        try
        {
            System.Drawing.Icon? icon = null;
            var exePath = Environment.ProcessPath;
            if (!string.IsNullOrWhiteSpace(exePath) && File.Exists(exePath))
            {
                icon = System.Drawing.Icon.ExtractAssociatedIcon(exePath);
            }

            _notifyIcon = new System.Windows.Forms.NotifyIcon
            {
                Icon = icon ?? System.Drawing.SystemIcons.Application,
                Visible = true
            };
            UpdateTrayTooltip();

            _notifyIcon.MouseUp += OnNotifyIconMouseUp;
            _notifyIcon.MouseDoubleClick += (_, _) =>
                System.Windows.Application.Current?.Dispatcher.Invoke(() =>
                {
                    _trayPopup?.HidePopup();
                    RestoreRequestedFromTray?.Invoke();
                });
            _notifyIcon.BalloonTipClicked += (_, _) =>
            {
                System.Windows.Application.Current?.Dispatcher.Invoke(() =>
                {
                    _trayPopup?.HidePopup();
                    RestoreRequestedFromTray?.Invoke();
                    if (!string.IsNullOrWhiteSpace(_lastBalloonPlatform))
                    {
                        WatchReminderTriggered?.Invoke(new WatchReminderCandidate(_lastBalloonPlatform!, 5, DateTimeOffset.Now));
                    }
                });
            };
        }
        catch
        {
            // Ignore tray failures on headless test environments
        }
    }

    private void UpdateTrayTooltip()
    {
        if (_notifyIcon == null) return;
        var isEn = string.Equals(SettingsProvider?.Invoke().Locale, "en", StringComparison.OrdinalIgnoreCase);
        _notifyIcon.Text = isEn
            ? "ottline — Keep what you watch and read"
            : "ottline — 보고 읽은 순간을 나의 타임라인에";
    }

    private void OnNotifyIconMouseUp(object? sender, System.Windows.Forms.MouseEventArgs e)
    {
        if (e.Button is not (System.Windows.Forms.MouseButtons.Left or System.Windows.Forms.MouseButtons.Right))
        {
            return;
        }

        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
        {
            if (_trayPopup == null)
            {
                _trayPopup = new TrayPopupWindow();
                _trayPopup.QuickRecordRequested += () => QuickRecordShortcutTriggered?.Invoke();
                _trayPopup.OpenAppRequested += () => RestoreRequestedFromTray?.Invoke();
                _trayPopup.SyncNowRequested += () => SyncRequestedFromTray?.Invoke();
                _trayPopup.ExitAppRequested += () => ExitRequestedFromTray?.Invoke();
            }

            if (_trayPopup.IsVisible)
            {
                _trayPopup.HidePopup();
                return;
            }

            if ((DateTimeOffset.UtcNow - _trayPopup.LastDeactivatedUtc).TotalMilliseconds < 250)
            {
                return;
            }

            UpdateTrayTooltip();
            _trayPopup.ShowAtCursor(
                SettingsProvider?.Invoke(),
                SyncStatusProvider?.Invoke(),
                _watchEngine.ActivePlatform
            );
        });
    }

    private void StartIpcServer()
    {
        var token = _ipcCts.Token;
        Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    using var server = new NamedPipeServerStream(PipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
                    await server.WaitForConnectionAsync(token).ConfigureAwait(false);
                    using var reader = new StreamReader(server, Encoding.UTF8);
                    var message = await reader.ReadToEndAsync(token).ConfigureAwait(false);
                    if (!string.IsNullOrWhiteSpace(message))
                    {
                        System.Windows.Application.Current?.Dispatcher.Invoke(() =>
                        {
                            RestoreRequestedFromTray?.Invoke();
                            if (!string.Equals(message.Trim(), "ACTIVATE", StringComparison.OrdinalIgnoreCase))
                            {
                                ExternalCommandReceived?.Invoke(message.Trim());
                            }
                        });
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch
                {
                    await Task.Delay(500, token).ConfigureAwait(false);
                }
            }
        }, token);
    }

    private static void EnsureCustomUriProtocolRegistered()
    {
        try
        {
            if (Widgets.OttlineWidgetProvider.IsPackagedProcess())
            {
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\ottline", throwOnMissingSubKey: false);
                return;
            }

            var exePath = Environment.ProcessPath;
            if (string.IsNullOrWhiteSpace(exePath)) return;

            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\ottline");
            if (key == null) return;
            key.SetValue("", "URL:ottline Protocol");
            key.SetValue("URL Protocol", "");

            using var iconKey = key.CreateSubKey("DefaultIcon");
            iconKey?.SetValue("", $"\"{exePath}\",0");

            using var cmdKey = key.CreateSubKey(@"shell\open\command");
            cmdKey?.SetValue("", $"\"{exePath}\" \"%1\"");
        }
        catch
        {
            // Packaged MSIX uses AppxManifest windows.protocol extension instead
        }
    }

    public static SavedWindowPlacement? LoadWindowPlacement()
    {
        try
        {
            var path = GetWindowStateFilePath();
            if (!File.Exists(path)) return null;
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<SavedWindowPlacement>(json);
        }
        catch
        {
            return null;
        }
    }

    public static void SaveWindowPlacement(Window window)
    {
        try
        {
            var bounds = window.WindowState == WindowState.Normal ? new Rect(window.Left, window.Top, window.Width, window.Height) : window.RestoreBounds;
            if (bounds.Width < 400 || bounds.Height < 400) return;

            var placement = new SavedWindowPlacement(
                Left: bounds.Left,
                Top: bounds.Top,
                Width: bounds.Width,
                Height: bounds.Height,
                IsMaximized: window.WindowState == WindowState.Maximized
            );
            var path = GetWindowStateFilePath();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, JsonSerializer.Serialize(placement));
        }
        catch
        {
            // Ignore disk errors
        }
    }

    public static bool HasStorePwaUpgradeFootprint(string dbFilePath)
    {
        if (!Widgets.OttlineWidgetProvider.IsPackagedProcess())
        {
            return false;
        }

        try
        {
            var localFolder = Windows.Storage.ApplicationData.Current.LocalFolder.Path;
            if (!Directory.Exists(localFolder) || !File.Exists(dbFilePath))
            {
                return false;
            }

            if (Directory.EnumerateFileSystemEntries(localFolder).Any())
            {
                return true;
            }

            return (File.GetCreationTimeUtc(dbFilePath) - Directory.GetCreationTimeUtc(localFolder)) > TimeSpan.FromMinutes(2);
        }
        catch
        {
            return false;
        }
    }

    private static string GetWindowStateFilePath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return Path.Combine(appData, "ottline", "window_state.json");
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WmHotkey && wParam.ToInt32() == HotkeyIdQuickRecord)
        {
            handled = true;
            QuickRecordShortcutTriggered?.Invoke();
        }
        return IntPtr.Zero;
    }

    public void Dispose()
    {
        _foregroundPollTimer.Stop();
        _ipcCts.Cancel();
        if (_hotkeyRegistered && _windowHandle != IntPtr.Zero)
        {
            UnregisterHotKey(_windowHandle, HotkeyIdQuickRecord);
            _hotkeyRegistered = false;
        }
        if (_trayPopup != null)
        {
            try { _trayPopup.Close(); } catch { }
            _trayPopup = null;
        }
        if (_notifyIcon != null)
        {
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            _notifyIcon = null;
        }
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool QueryFullProcessImageNameW(IntPtr hProcess, uint dwFlags, StringBuilder lpExeName, ref uint lpdwSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("psapi.dll", SetLastError = true)]
    private static extern bool EmptyWorkingSet(IntPtr hProcess);
}
