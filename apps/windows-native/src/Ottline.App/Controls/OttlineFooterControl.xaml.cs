using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using Ottline.App.ViewModels;
using Ottline.Core.Domain;

namespace Ottline.App.Controls;

public partial class OttlineFooterControl : System.Windows.Controls.UserControl
{
    public OttlineFooterControl()
    {
        InitializeComponent();
    }

    private MainViewModel? Vm => DataContext as MainViewModel;

    private void OpenGuides_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.GUIDES);
    private void OpenAbout_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.ABOUT);
    private void OpenFaq_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.FAQ);
    private void OpenPrivacy_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.PRIVACY);
    private void OpenFeedback_Click(object sender, RoutedEventArgs e) => Vm?.OpenFeedbackInbox();

    private void OpenMailto_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo("mailto:contact@ottline.app") { UseShellExecute = true });
        }
        catch
        {
            // Ignore if no default mail client is registered
        }
    }
}
