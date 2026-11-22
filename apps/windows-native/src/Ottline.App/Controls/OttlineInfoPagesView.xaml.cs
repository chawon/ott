using System.Diagnostics;
using System.Windows;
using Ottline.App.ViewModels;
using Ottline.Core.Domain;

namespace Ottline.App.Controls;

public partial class OttlineInfoPagesView : System.Windows.Controls.UserControl
{
    public OttlineInfoPagesView()
    {
        InitializeComponent();
        DataContextChanged += (_, e) =>
        {
            if (e.OldValue is MainViewModel oldVm)
            {
                oldVm.InfoPageScrollToTopRequested -= OnScrollToTopRequested;
            }
            if (e.NewValue is MainViewModel newVm)
            {
                newVm.InfoPageScrollToTopRequested += OnScrollToTopRequested;
            }
        };
    }

    private MainViewModel? Vm => DataContext as MainViewModel;

    private void OnScrollToTopRequested()
    {
        InfoScrollViewer?.ScrollToTop();
    }

    private void Back_Click(object sender, RoutedEventArgs e) => Vm?.CloseInfoPage();
    private void SwitchGuides_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.GUIDES);
    private void SwitchAbout_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.ABOUT);
    private void SwitchFaq_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.FAQ);
    private void SwitchPrivacy_Click(object sender, RoutedEventArgs e) => Vm?.OpenInfoPage(InfoPageKind.PRIVACY);
    private void OpenFeedback_Click(object sender, RoutedEventArgs e) => Vm?.OpenFeedbackInbox();
    private void BackToGuideHub_Click(object sender, RoutedEventArgs e) => Vm?.SelectGuideArticle(null);

    private void OpenMySpace_Click(object sender, RoutedEventArgs e)
    {
        if (Vm == null) return;
        Vm.CurrentTab = MainTab.MY_SPACE;
        Vm.CurrentMySpaceSection = MySpaceSection.PROFILE_SYNC;
    }

    private void OpenGuideArticle_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string slug)
        {
            Vm?.OpenInfoPage(InfoPageKind.GUIDES, guideSlug: slug);
        }
    }

    private void StartGuideQuickRecord_Click(object sender, RoutedEventArgs e)
    {
        var filter = Vm?.SelectedGuideArticle?.ContentFilter ?? Ottline.Core.Models.ContentFilter.ALL;
        Vm?.OpenQuickRecordModal(prefilledFilter: filter);
    }

    private void OpenExternalUrl_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is string url && !string.IsNullOrWhiteSpace(url))
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch
            {
                // Ignore shell launch error
            }
        }
    }
}
