using System;
using Ottline.App.Widgets;

namespace Ottline.App;

public static class Program
{
    [STAThread]
    public static int Main(string[] args)
    {
        var exportDir = GetOptionValue(args, "--export-store-assets");
        if (!string.IsNullOrWhiteSpace(exportDir))
        {
            App.IsHeadlessAssetExport = true;
            System.Windows.Media.RenderOptions.ProcessRenderMode = System.Windows.Interop.RenderMode.SoftwareOnly;
            var exportApp = new App
            {
                ShutdownMode = System.Windows.ShutdownMode.OnExplicitShutdown
            };
            exportApp.InitializeComponent();
            Ottline.App.Theme.OttlineThemeManager.ApplyTheme(Ottline.Core.Models.ThemeMode.LIGHT);
            var exitCode = Services.StoreListingAssetExporter.ExportAll(exportDir!);
            GC.KeepAlive(exportApp);
            return exitCode;
        }

        if (HasFlag(args, "--verify-widget"))
        {
            return OttlineWidgetProvider.RunPackagedWidgetVerification();
        }

        if (IsWidgetComServerInvocation(args))
        {
            return OttlineWidgetComServer.Run(args);
        }

        var app = new App();
        app.InitializeComponent();
        return app.Run();
    }

    private static string? GetOptionValue(string[] args, string flag)
    {
        for (var i = 0; i < args.Length; i++)
        {
            if (string.Equals(args[i], flag, StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
            {
                return args[i + 1];
            }
            if (args[i].StartsWith(flag + "=", StringComparison.OrdinalIgnoreCase))
            {
                return args[i][(flag.Length + 1)..];
            }
        }
        return null;
    }

    private static bool HasFlag(string[] args, string flag)
    {
        foreach (var arg in args)
        {
            if (string.Equals(arg, flag, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private static bool IsWidgetComServerInvocation(string[] args) =>
        HasFlag(args, "-RegisterProcessAsComServer") ||
        HasFlag(args, "--RegisterProcessAsComServer");
}
