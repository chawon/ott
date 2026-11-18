using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using Ottline.Core.Models;

namespace Ottline.App;

public partial class TrayPopupWindow : Window
{
    private const int GwlExStyle = -20;
    private const int WsExToolWindow = 0x00000080;

    public event Action? QuickRecordRequested;
    public event Action? OpenAppRequested;
    public event Action? SyncNowRequested;
    public event Action? ExitAppRequested;

    public DateTimeOffset LastDeactivatedUtc { get; private set; } = DateTimeOffset.MinValue;

    public TrayPopupWindow()
    {
        InitializeComponent();

        SourceInitialized += (_, _) =>
        {
            try
            {
                var hwnd = new WindowInteropHelper(this).Handle;
                if (hwnd == IntPtr.Zero) return;
                var exStyle = GetWindowLong(hwnd, GwlExStyle);
                SetWindowLong(hwnd, GwlExStyle, exStyle | WsExToolWindow);
            }
            catch
            {
                // Ignore window style errors
            }
        };

        Deactivated += (_, _) =>
        {
            LastDeactivatedUtc = DateTimeOffset.UtcNow;
            HidePopup();
        };

        PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.Escape)
            {
                LastDeactivatedUtc = DateTimeOffset.UtcNow;
                HidePopup();
                e.Handled = true;
            }
        };
    }

    public void ShowAtCursor(LocalSettings? settings, string? syncStatus, string? activeOttPlatform)
    {
        var isEn = string.Equals(settings?.Locale, "en", StringComparison.OrdinalIgnoreCase);

        QuickRecordLabel.Text = isEn ? "Leave a record" : "기록 남기기";
        ShortcutBadge.Visibility = (settings?.GlobalHotkeyEnabled ?? true) ? Visibility.Visible : Visibility.Collapsed;
        OpenAppLabel.Text = isEn ? "Open ottline" : "ottline 열기";
        SyncNowLabel.Text = isEn ? "Sync now" : "지금 동기화";
        ExitAppLabel.Text = isEn ? "Quit ottline" : "ottline 종료";

        if (!string.IsNullOrWhiteSpace(activeOttPlatform))
        {
            StatusTextBlock.Text = isEn ? $"Watching {activeOttPlatform}" : $"{activeOttPlatform} 시청 중";
            StatusDot.SetResourceReference(System.Windows.Shapes.Shape.FillProperty, "AccentOrangeBrush");
        }
        else
        {
            StatusTextBlock.Text = !string.IsNullOrWhiteSpace(syncStatus)
                ? syncStatus
                : (isEn ? "Synced" : "동기화 완료");
            StatusDot.SetResourceReference(System.Windows.Shapes.Shape.FillProperty, "SemanticSuccessBrush");
        }

        if (!IsVisible)
        {
            Opacity = 0;
            Show();
        }
        UpdateLayout();

        var cursorPx = System.Windows.Forms.Cursor.Position;
        var workPx = System.Windows.Forms.Screen.FromPoint(cursorPx).WorkingArea;
        var dpi = System.Windows.Media.VisualTreeHelper.GetDpi(this);
        var scaleX = dpi.DpiScaleX > 0 ? dpi.DpiScaleX : 1.0;
        var scaleY = dpi.DpiScaleY > 0 ? dpi.DpiScaleY : 1.0;

        var cursorDipX = cursorPx.X / scaleX;
        var cursorDipY = cursorPx.Y / scaleY;
        var workLeft = workPx.Left / scaleX;
        var workTop = workPx.Top / scaleY;
        var workRight = workPx.Right / scaleX;
        var workBottom = workPx.Bottom / scaleY;

        var w = ActualWidth > 0 ? ActualWidth : 292;
        var h = ActualHeight > 0 ? ActualHeight : 260;

        var left = Math.Clamp(cursorDipX - (w / 2.0), workLeft + 6, Math.Max(workLeft + 6, workRight - w - 6));
        var top = cursorDipY < workTop + 96
            ? Math.Max(cursorDipY + 8, workTop + 6)
            : Math.Clamp(Math.Min(cursorDipY - h - 4, workBottom - h - 6), workTop + 6, Math.Max(workTop + 6, workBottom - h - 6));

        Left = left;
        Top = top;
        Opacity = 1;

        var hwnd = new WindowInteropHelper(this).Handle;
        if (hwnd != IntPtr.Zero)
        {
            SetForegroundWindow(hwnd);
        }
        Activate();
        Focus();

        var ease = new CubicEase { EasingMode = EasingMode.EaseOut };
        var duration = TimeSpan.FromMilliseconds(130);
        RootGrid.BeginAnimation(OpacityProperty, new DoubleAnimation(0.0, 1.0, duration) { EasingFunction = ease });
        SlideTransform.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(6.0, 0.0, duration) { EasingFunction = ease });
    }

    public void HidePopup()
    {
        if (IsVisible)
        {
            Hide();
        }
    }

    private void QuickRecord_Click(object sender, RoutedEventArgs e)
    {
        HidePopup();
        QuickRecordRequested?.Invoke();
    }

    private void OpenApp_Click(object sender, RoutedEventArgs e)
    {
        HidePopup();
        OpenAppRequested?.Invoke();
    }

    private void SyncNow_Click(object sender, RoutedEventArgs e)
    {
        HidePopup();
        SyncNowRequested?.Invoke();
    }

    private void ExitApp_Click(object sender, RoutedEventArgs e)
    {
        HidePopup();
        ExitAppRequested?.Invoke();
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);
}
