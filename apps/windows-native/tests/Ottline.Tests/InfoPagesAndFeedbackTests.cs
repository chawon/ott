using System.Net;
using System.Text;
using System.Text.Json;
using Ottline.Core.Domain;
using Ottline.Core.I18n;
using Ottline.Core.Remote;
using Xunit;

namespace Ottline.Tests;

public sealed class InfoPagesAndFeedbackTests
{
    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _fn;
        public List<(HttpMethod Method, string Path, string? Body)> Requests { get; } = new();

        public StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> fn) => _fn = fn;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false)
                : null;
            Requests.Add((request.Method, request.RequestUri?.PathAndQuery ?? "", body));
            return await _fn(request, cancellationToken).ConfigureAwait(false);
        }
    }

    [Theory]
    [InlineData("ko")]
    [InlineData("en")]
    public void InfoPagesContent_ProvidesCompleteGuidesAboutFaqAndPrivacy(string locale)
    {
        var strings = OttlineStrings.ForLocale(locale);
        Assert.False(string.IsNullOrWhiteSpace(strings.FooterGuidesLink));
        Assert.False(string.IsNullOrWhiteSpace(strings.FooterAboutLink));
        Assert.False(string.IsNullOrWhiteSpace(strings.FooterFaqLink));
        Assert.False(string.IsNullOrWhiteSpace(strings.FooterPrivacyLink));
        Assert.False(string.IsNullOrWhiteSpace(strings.FooterFeedbackLink));

        var hub = InfoPagesContent.GetGuideHub(locale);
        Assert.Equal(3, hub.Guides.Count);
        Assert.Contains(hub.Guides, g => g.Slug == "ott-watch-log");
        Assert.Contains(hub.Guides, g => g.Slug == "movie-series-log");
        Assert.Contains(hub.Guides, g => g.Slug == "book-log");
        Assert.All(hub.Guides, g => Assert.NotEmpty(g.Sections));

        var about = InfoPagesContent.GetAbout(locale);
        Assert.Equal(6, about.Platforms.Count);
        Assert.Single(about.Platforms, p => p.IsCurrentPlatform);
        Assert.DoesNotContain(about.Platforms, p => p.Title.Contains("ChatGPT", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(3, about.ExtensionLinks.Count);
        Assert.Equal(3, about.GuideLinks.Count);

        var faq = InfoPagesContent.GetFaq(locale);
        Assert.Equal(6, faq.Items.Count);
        Assert.All(faq.Items, item =>
        {
            Assert.False(string.IsNullOrWhiteSpace(item.Question));
            Assert.False(string.IsNullOrWhiteSpace(item.Answer));
        });

        var privacy = InfoPagesContent.GetPrivacy(locale);
        Assert.Equal(3, privacy.Sections.Count);
        Assert.Contains("OpenAI", privacy.RecommendationTitle, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task FeedbackApi_ListsFetchesDetailAndCreatesThreadWithServerContract()
    {
        var handler = new StubHandler((req, _) =>
        {
            if (req.Method == HttpMethod.Get && req.RequestUri!.AbsolutePath == "/api/feedback/threads")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(JsonSerializer.Serialize(new[]
                    {
                        new
                        {
                            id = "th-1",
                            category = "QUESTION",
                            status = "ANSWERED",
                            subject = "연결 코드 문의",
                            lastMessagePreview = "내 공간에서 확인할 수 있어요.",
                            createdAt = "2026-11-20T10:00:00Z",
                            updatedAt = "2026-11-21T10:00:00Z"
                        }
                    }), Encoding.UTF8, "application/json")
                });
            }
            if (req.Method == HttpMethod.Get && req.RequestUri!.AbsolutePath == "/api/feedback/threads/th-1")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(JsonSerializer.Serialize(new
                    {
                        id = "th-1",
                        category = "QUESTION",
                        status = "ANSWERED",
                        subject = "연결 코드 문의",
                        createdAt = "2026-11-20T10:00:00Z",
                        updatedAt = "2026-11-21T10:00:00Z",
                        messages = new[]
                        {
                            new { id = "m-1", authorRole = "USER", body = "연결 코드가 어디 있나요?", createdAt = "2026-11-20T10:00:00Z" },
                            new { id = "m-2", authorRole = "ADMIN", body = "내 공간에서 확인할 수 있어요.", createdAt = "2026-11-21T10:00:00Z" }
                        }
                    }), Encoding.UTF8, "application/json")
                });
            }
            if (req.Method == HttpMethod.Post && req.RequestUri!.AbsolutePath == "/api/feedback/threads")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{}", Encoding.UTF8, "application/json")
                });
            }
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        });

        using var api = new OttlineApiClient(new HttpClient(handler));
        api.Configure("https://mock.ottline.test", "ko", "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", null);

        var threads = await api.FetchFeedbackThreadsAsync();
        Assert.Single(threads);
        Assert.Equal("th-1", threads[0].Id);
        Assert.Equal("답변 완료", threads[0].StatusDisplay);
        Assert.Equal(2, threads[0].Messages.Count);
        Assert.True(threads[0].Messages[0].IsMine);
        Assert.False(threads[0].Messages[1].IsMine);

        var created = await api.CreateFeedbackThreadAsync("IDEA", "다크 모드 제안", "풋터도 멋져요");
        Assert.True(created);
        var post = handler.Requests.Single(r => r.Method == HttpMethod.Post && r.Path == "/api/feedback/threads");
        using var payloadDoc = JsonDocument.Parse(post.Body!);
        Assert.Equal("IDEA", payloadDoc.RootElement.GetProperty("category").GetString());
        Assert.Equal("다크 모드 제안", payloadDoc.RootElement.GetProperty("subject").GetString());
        Assert.Equal("풋터도 멋져요", payloadDoc.RootElement.GetProperty("body").GetString());
    }
}
