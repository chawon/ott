using System.IO;
using System.Windows;
using Ottline.App.Services;

namespace Ottline.App;

public partial class App : System.Windows.Application
{
    public static bool IsHeadlessAssetExport { get; set; }

    private Mutex? _singleInstanceMutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        if (IsHeadlessAssetExport)
        {
            base.OnStartup(e);
            return;
        }

        DispatcherUnhandledException += (_, args) =>
        {
            LogCrash(args.Exception);
            System.Windows.MessageBox.Show(
                $"ottline 실행 중 오류가 발생했습니다:\n{args.Exception.Message}\n\n{args.Exception.InnerException?.Message}",
                "ottline 오류",
                MessageBoxButton.OK,
                MessageBoxImage.Error
            );
            args.Handled = true;
        };

        AppDomain.CurrentDomain.UnhandledException += (_, args) =>
        {
            if (args.ExceptionObject is Exception ex)
            {
                LogCrash(ex);
            }
        };

        base.OnStartup(e);
        System.Windows.Media.RenderOptions.ProcessRenderMode = System.Windows.Interop.RenderMode.SoftwareOnly;

        try
        {
            LogTrace("OnStartup entered");
            var effectiveArgs = ResolveEffectiveStartupArgs(e.Args);
            _singleInstanceMutex = new Mutex(true, "Global\\OttlineWindowsNative_SingleInstance_v2", out var createdNew);
            LogTrace($"Mutex createdNew={createdNew}");
            if (!createdNew)
            {
                if (DesktopIntegrationService.TryForwardToExistingInstance(effectiveArgs))
                {
                    LogTrace("Forwarded to existing instance, shutting down");
                    Shutdown(0);
                    return;
                }
            }

            LogTrace($"Creating MainWindow... (WS={Environment.WorkingSet / 1048576}MB, GC={GC.GetTotalMemory(false) / 1048576}MB)");
            var mainWindow = new MainWindow(effectiveArgs);
            LogTrace($"MainWindow created, calling Show()... (WS={Environment.WorkingSet / 1048576}MB, GC={GC.GetTotalMemory(false) / 1048576}MB)");
            MainWindow = mainWindow;
            mainWindow.Show();
            mainWindow.Activate();
            LogTrace($"MainWindow shown! (WS={Environment.WorkingSet / 1048576}MB, GC={GC.GetTotalMemory(false) / 1048576}MB)");
        }
        catch (Exception ex)
        {
            LogCrash(ex);
            System.Windows.MessageBox.Show(
                $"ottline 시작 오류:\n{ex.Message}\n\n{ex.InnerException?.Message}",
                "ottline 시작 실패",
                MessageBoxButton.OK,
                MessageBoxImage.Error
            );
            Shutdown(1);
        }
    }

    private static string[] ResolveEffectiveStartupArgs(string[] rawArgs)
    {
        var filtered = rawArgs
            .Where(a => !string.IsNullOrWhiteSpace(a) &&
                        !a.StartsWith("-ServerName:", StringComparison.OrdinalIgnoreCase))
            .ToArray();

        var protocolArg = filtered.FirstOrDefault(a => a.StartsWith("ottline:", StringComparison.OrdinalIgnoreCase));
        if (protocolArg != null)
        {
            if (Uri.TryCreate(protocolArg, UriKind.Absolute, out var cliUri))
            {
                LogTrace($"Protocol URI arg received: {cliUri.Scheme}://{cliUri.Host}");
            }
            return filtered;
        }

        if (filtered.Any(a => a.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                              a.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
        {
            return filtered;
        }

        if (Widgets.OttlineWidgetProvider.IsPackagedProcess())
        {
            try
            {
                var activatedArgs = global::Windows.ApplicationModel.AppInstance.GetActivatedEventArgs();
                if (activatedArgs is global::Windows.ApplicationModel.Activation.IProtocolActivatedEventArgs protoArgs &&
                    protoArgs.Uri != null)
                {
                    LogTrace($"Packaged protocol activation: {protoArgs.Uri.Scheme}://{protoArgs.Uri.Host}");
                    return new[] { protoArgs.Uri.AbsoluteUri };
                }
            }
            catch
            {
                // Non-packaged or activation payload unavailable
            }
        }

        return filtered;
    }

    private const long MaxDiagnosticLogBytes = 262_144;

    private static void LogTrace(string msg) =>
        AppendBoundedLog("startup.log", $"[{DateTimeOffset.Now:O}] {msg}\n");

    private static void LogCrash(Exception ex) =>
        AppendBoundedLog("crash.log", $"[{DateTimeOffset.Now:O}] {ex}\n\n");

    internal static void AppendBoundedLog(string fileName, string content)
    {
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OttlineWindows");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, fileName);
            if (File.Exists(path) && new FileInfo(path).Length >= MaxDiagnosticLogBytes)
            {
                File.WriteAllText(path, content);
            }
            else
            {
                File.AppendAllText(path, content);
            }
        }
        catch
        {
            // Ignore logging error
        }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _singleInstanceMutex?.Dispose();
        base.OnExit(e);
    }
}
