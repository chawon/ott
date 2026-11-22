using Ottline.Core.Models;

namespace Ottline.Core.Domain;

public enum InfoPageKind
{
    GUIDES,
    ABOUT,
    FAQ,
    PRIVACY
}

public sealed record GuideStepItem(
    string Badge,
    string Title,
    string Description
);

public sealed record GuideSectionBlock(
    string Title,
    IReadOnlyList<string> Paragraphs,
    IReadOnlyList<GuideStepItem> Items
)
{
    public bool HasItems => Items.Count > 0;
}

public sealed record GuideArticle(
    string Slug,
    ContentFilter ContentFilter,
    string Eyebrow,
    string Title,
    string Summary,
    string UpdatedLabel,
    string CardTitle,
    string CardDescription,
    string CardAction,
    IReadOnlyList<GuideSectionBlock> Sections,
    string CtaTitle,
    string CtaDescription,
    string CtaLabel
);

public sealed record GuideHubContent(
    string Eyebrow,
    string Title,
    string Description,
    string BackToHubLabel,
    string ConnectionTitle,
    string ConnectionDescription,
    string ConnectionAction,
    string ClosingTitle,
    string ClosingDescription,
    IReadOnlyList<GuideArticle> Guides
);

public sealed record AboutPlatformCard(
    string Number,
    string Title,
    string Description,
    string LinkLabel,
    string Url,
    bool IsCurrentPlatform = false
);

public sealed record AboutLinkItem(
    string Label,
    string Target
);

public sealed record AboutPageContent(
    string Title,
    string Description,
    string PairingTitle,
    string PairingDescription,
    string PlatformsTitle,
    string PlatformsDescription,
    IReadOnlyList<AboutPlatformCard> Platforms,
    string CompanionToolsTitle,
    string ExtensionTitle,
    string ExtensionDescription,
    IReadOnlyList<AboutLinkItem> ExtensionLinks,
    string HowToUseTitle,
    IReadOnlyList<GuideStepItem> Steps,
    string MoreTipsTitle,
    IReadOnlyList<GuideStepItem> Tips,
    string GuideSectionTitle,
    string GuideSectionDescription,
    IReadOnlyList<AboutLinkItem> GuideLinks,
    string BrowseAllGuidesLabel,
    string ClosingQuote
);

public sealed record FaqEntry(
    string Question,
    string Answer
);

public sealed record FaqPageContent(
    string Title,
    string Description,
    IReadOnlyList<FaqEntry> Items,
    string GuideTitle,
    string GuideDescription,
    string GuideAction
);

public sealed record PrivacySection(
    string Title,
    IReadOnlyList<string> Bullets
);

public sealed record PrivacyPageContent(
    string Title,
    string LastUpdated,
    string Intro,
    IReadOnlyList<PrivacySection> Sections,
    string Section4Title,
    string Section4Description,
    string RecommendationTitle,
    string RecommendationDescription,
    string RecommendationStorage,
    string Section5Title,
    string Section5Description,
    string OpenMySpaceLabel,
    string Section6Title,
    string Section6Description,
    string OpenFeedbackLabel
);

public static class InfoPagesContent
{
    public static GuideHubContent GetGuideHub(string? locale)
    {
        var isEn = IsEnglish(locale);
        return isEn ? BuildEnglishGuideHub() : BuildKoreanGuideHub();
    }

    public static AboutPageContent GetAbout(string? locale)
    {
        var isEn = IsEnglish(locale);
        return isEn ? BuildEnglishAbout() : BuildKoreanAbout();
    }

    public static FaqPageContent GetFaq(string? locale)
    {
        var isEn = IsEnglish(locale);
        return isEn ? BuildEnglishFaq() : BuildKoreanFaq();
    }

    public static PrivacyPageContent GetPrivacy(string? locale)
    {
        var isEn = IsEnglish(locale);
        return isEn ? BuildEnglishPrivacy() : BuildKoreanPrivacy();
    }

    private static bool IsEnglish(string? locale) =>
        string.Equals(locale?.Trim(), "en", StringComparison.OrdinalIgnoreCase);

    private static GuideHubContent BuildKoreanGuideHub() => new(
        Eyebrow: "ottline 기록 안내",
        Title: "가볍게 남긴 기록이, 나중의 기억이 돼요",
        Description: "방금 본 작품도, 오래 곁에 둔 책도 필요한 만큼만 적어두세요. 검색부터 타임라인까지, ottline의 기록 흐름을 차근차근 안내할게요.",
        BackToHubLabel: "← 모든 기록 가이드",
        ConnectionTitle: "Windows·Mac·iPhone·iPad·Android·웹에서 이어서 기록해요",
        ConnectionDescription: "기록이 있는 기기의 ‘내 공간’에서 기록 연결 코드를 확인해 주세요. 새 기기의 ‘내 공간’에 같은 코드를 입력하면 웹과 앱에서 기록을 이어볼 수 있어요.",
        ConnectionAction: "내 공간에서 코드 확인 →",
        ClosingTitle: "정답 없이, 내 방식대로 남겨요",
        ClosingDescription: "느낌이나 메모는 선택이에요. 제목과 상태만 남겨도 타임라인이 시작돼요.",
        Guides: new[]
        {
            new GuideArticle(
                Slug: "ott-watch-log",
                ContentFilter: ContentFilter.VIDEO,
                Eyebrow: "OTT 시청 기록",
                Title: "보고 난 순간을, 한곳에 가볍게 남겨요",
                Summary: "어느 OTT에서 봤는지 흩어져 있어도 괜찮아요. 작품을 찾고 지금의 상태를 고른 뒤, 본 날짜나 플랫폼처럼 기억하고 싶은 것만 더해보세요. 여러 OTT의 기록이 한 타임라인에 모여요.",
                UpdatedLabel: "2026년 11월 업데이트",
                CardTitle: "OTT 시청 기록을 시작하는 방법",
                CardDescription: "여러 OTT에서 본 영화와 시리즈를 하나의 타임라인에 모으는 흐름을 살펴봐요.",
                CardAction: "OTT 시청 기록 안내 보기 →",
                Sections: new[]
                {
                    new GuideSectionBlock(
                        "어디서 봤든, 작품을 한곳에 모아요",
                        new[]
                        {
                            "OTT마다 시청 이력은 따로 남아요. ottline에서는 여러 서비스에서 본 작품을 모으고, 원하면 어디서 봤는지도 함께 남길 수 있어요.",
                            "플랫폼을 적지 않아도 괜찮아요. 제목과 상태만으로도 같은 타임라인에서 기록을 이어갈 수 있어요."
                        },
                        Array.Empty<GuideStepItem>()
                    ),
                    new GuideSectionBlock(
                        "상태를 고른 뒤 기록을 남겨요",
                        new[] { "홈에서 기록 버튼을 누르거나 Ctrl+K(전역 Ctrl+Shift+O)로 작품 검색창을 열어요. 긴 감상을 준비하지 않아도 괜찮아요." },
                        new[]
                        {
                            new GuideStepItem("1", "작품 찾기", "검색창에서 ‘영상’을 고르고 영화나 시리즈 제목을 검색해 작품을 선택해요."),
                            new GuideStepItem("2", "지금의 상태 남기기", "봤어요, 보는 중, 보고 싶어요 가운데 지금과 가까운 상태를 고른 뒤, 아래의 ‘기록 남기기’를 눌러요."),
                            new GuideStepItem("3", "원할 때 더 적기", "‘그날의 순간’에 날짜·플랫폼·장소·상황을 더하거나, 느낌과 짧은 메모를 남길 수 있어요. 지금 더하지 않아도 기록은 남아 있어요.")
                        }
                    ),
                    new GuideSectionBlock(
                        "개인 기록이 기본이고, 공유는 선택이에요",
                        new[]
                        {
                            "기록은 내 타임라인에 먼저 남아요. 메모를 적는 것만으로 공개되지는 않아요. ‘함께 나누기’를 직접 선택하면 작품과 메모가 ‘함께’ 화면에 공개되고, 날짜·장소·상황은 공개되지 않아요.",
                            "공유 카드도 원할 때 따로 만들 수 있어요. 나만 다시 읽을 기록은 개인 타임라인에 그대로 두어도 괜찮아요."
                        },
                        Array.Empty<GuideStepItem>()
                    )
                },
                CtaTitle: "방금 본 작품부터 남겨볼까요?",
                CtaDescription: "제목을 찾은 뒤, 지금 기억나는 만큼만 적어도 충분해요.",
                CtaLabel: "영상 기록 시작하기"
            ),
            new GuideArticle(
                Slug: "movie-series-log",
                ContentFilter: ContentFilter.VIDEO,
                Eyebrow: "영화·시리즈 기록",
                Title: "영화와 시리즈 시청 기록을 한곳에 남겨요",
                Summary: "같은 작품을 봐도 남는 기억은 저마다 달라요. 어디까지 봤는지, 누구와 있었는지, 어떤 마음이었는지 기억하고 싶은 만큼 적어두면 다시 만날 때 그 순간이 떠올라요.",
                UpdatedLabel: "2026년 11월 업데이트",
                CardTitle: "영화·시리즈를 더 또렷하게 기억하는 방법",
                CardDescription: "상태와 시즌·에피소드부터 그날의 장소와 메모까지, 기억하고 싶은 것만 남겨요.",
                CardAction: "영화·시리즈 기록 안내 보기 →",
                Sections: new[]
                {
                    new GuideSectionBlock(
                        "영화와 시리즈에 맞는 상태를 골라요",
                        new[]
                        {
                            "홈의 기록 버튼으로 작품을 찾은 뒤, 봤어요·보는 중·보고 싶어요 가운데 지금과 가까운 상태를 골라요. 아래의 ‘기록 남기기’를 누르면 타임라인에 남아요.",
                            "시리즈는 시즌과 에피소드도 함께 남길 수 있어요. 어디까지 봤는지 적어두면 다음에 이어볼 곳을 찾기 쉬워져요."
                        },
                        Array.Empty<GuideStepItem>()
                    ),
                    new GuideSectionBlock(
                        "그날의 순간을 더해도 좋아요",
                        new[] { "집에서 혼자 본 날, 가족과 함께한 주말처럼 장소와 상황을 남겨보세요. 느낌이나 메모가 없어도 충분한 기록이에요." },
                        new[]
                        {
                            new GuideStepItem("•", "날짜와 장소", "실제로 본 날짜와 집·극장처럼 기억의 배경이 된 장소를 남길 수 있어요."),
                            new GuideStepItem("•", "함께한 상황", "혼자, 가족과, 친구와처럼 그날의 분위기를 떠올릴 단서를 더해도 좋아요."),
                            new GuideStepItem("•", "느낌과 한 줄 메모", "최고예요, 볼만해요, 아쉬워요 가운데 하나를 고르거나 메모를 남길 수 있어요. 둘 다 선택이에요.")
                        }
                    ),
                    new GuideSectionBlock(
                        "생각이 달라지면 기록을 이어 고쳐요",
                        new[]
                        {
                            "보는 중이던 시리즈를 다 봤거나, 시간이 지나 느낌과 메모가 달라졌다면 기존 기록을 수정할 수 있어요. 바뀐 내용은 히스토리에 남아 처음의 인상과 나중의 마음을 함께 돌아볼 수 있어요."
                        },
                        Array.Empty<GuideStepItem>()
                    )
                },
                CtaTitle: "기억에 남은 장면이 있나요?",
                CtaDescription: "작품을 찾고, 그 장면을 떠올릴 작은 단서 하나만 남겨보세요.",
                CtaLabel: "영화·시리즈 기록하기"
            ),
            new GuideArticle(
                Slug: "book-log",
                ContentFilter: ContentFilter.BOOK,
                Eyebrow: "독서 기록",
                Title: "책과 함께한 시간을 천천히 이어 적어요",
                Summary: "읽기 시작한 날의 기대도, 덮고 난 뒤 남은 한 문장도 좋은 기록이 돼요. 완성된 서평을 쓰지 않아도 책과 함께한 시간이 타임라인과 내 서가에 자연스럽게 이어져요.",
                UpdatedLabel: "2026년 11월 업데이트",
                CardTitle: "부담 없이 독서 기록을 이어가는 방법",
                CardDescription: "읽는 중의 마음부터 다 읽은 뒤의 메모까지, 책과 함께한 시간을 모아봐요.",
                CardAction: "독서 기록 안내 보기 →",
                Sections: new[]
                {
                    new GuideSectionBlock(
                        "읽는 과정도 한 권의 기록이에요",
                        new[]
                        {
                            "책은 다 읽은 뒤에만 기록할 필요는 없어요. 읽기 시작할 때는 ‘읽는 중’, 나중을 위해 담아둘 때는 ‘읽고 싶어요’, 마지막 장을 덮은 뒤에는 ‘읽었어요’를 고르면 돼요.",
                            "상태가 달라지면 기록을 고쳐 이어갈 수 있어요. 처음의 기대와 읽은 뒤의 마음이 한 권의 시간으로 쌓여요."
                        },
                        Array.Empty<GuideStepItem>()
                    ),
                    new GuideSectionBlock(
                        "책 제목이나 저자부터 찾아요",
                        new[] { "기록창에서 ‘책’을 고르고 제목이나 저자로 검색한 뒤 표지와 판본 정보를 확인해 선택해요." },
                        new[]
                        {
                            new GuideStepItem("1", "읽기 상태 고르기", "읽었어요, 읽는 중, 읽고 싶어요 가운데 지금과 가까운 상태를 고른 뒤 ‘기록 남기기’를 눌러요."),
                            new GuideStepItem("2", "그날의 순간 더하기", "원하면 날짜와 집·카페·이동 중처럼 책을 펼친 장소, 함께한 상황을 더할 수 있어요."),
                            new GuideStepItem("3", "느낌이나 한 문장 더하기", "인생책, 무난해요, 아쉬워요 가운데 느낌을 고르거나 마음에 남은 문장을 메모할 수 있어요.")
                        }
                    ),
                    new GuideSectionBlock(
                        "영상과 책을 같은 타임라인과 내 서가에서 돌아봐요",
                        new[]
                        {
                            "영화·시리즈·책이 날짜순으로 함께 놓여 그 시기에 무엇을 보고 읽었는지 돌아볼 수 있어요. ‘내 공간 > 내 서가’에서는 KDC 주제 분류별로 정리된 책장도 살펴볼 수 있어요."
                        },
                        Array.Empty<GuideStepItem>()
                    )
                },
                CtaTitle: "지금 곁에 있는 책부터 적어볼까요?",
                CtaDescription: "읽는 중이어도 괜찮아요. 제목과 지금의 상태만 먼저 남겨보세요.",
                CtaLabel: "책 기록 시작하기"
            )
        }
    );

    private static GuideHubContent BuildEnglishGuideHub() => new(
        Eyebrow: "ottline guides",
        Title: "A quieter way to remember what you watched and read",
        Description: "Save the details that matter now and leave the rest for later. These guides walk through the simple path from finding a title to seeing it on your timeline.",
        BackToHubLabel: "← All recording guides",
        ConnectionTitle: "Keep your timeline with you",
        ConnectionDescription: "Find your record connection code in My space on a device that has your records. Enter it in My space on Windows, Mac, iPhone, iPad, Android, or the web to continue the same timeline.",
        ConnectionAction: "Open My space →",
        ClosingTitle: "Your records can be as simple as you like",
        ClosingDescription: "A title and a status are enough. You can add a feeling or a note whenever you like.",
        Guides: new[]
        {
            new GuideArticle(
                Slug: "ott-watch-log",
                ContentFilter: ContentFilter.VIDEO,
                Eyebrow: "OTT watch records",
                Title: "Keep the moment, wherever you watched it",
                Summary: "Bring titles from different streaming services into one personal timeline. Find a title, choose its current status, and add a date, platform, or any other details you want to remember.",
                UpdatedLabel: "Updated November 2026",
                CardTitle: "Keep viewing records across streaming services",
                CardDescription: "See how movies and series from different services can meet in one personal timeline.",
                CardAction: "Read the OTT watch log guide →",
                Sections: new[]
                {
                    new GuideSectionBlock(
                        "Bring titles from different services together",
                        new[]
                        {
                            "Each streaming service keeps its own viewing history. In ottline, you can keep those titles together and add where you watched them if you like.",
                            "The platform is optional. A title and a status are enough to keep your records together on the same timeline."
                        },
                        Array.Empty<GuideStepItem>()
                    ),
                    new GuideSectionBlock(
                        "Choose a status, then keep your record",
                        new[] { "Use the record button on Home (or Ctrl+K / global Ctrl+Shift+O) to open title search. A title and its current status are enough." },
                        new[]
                        {
                            new GuideStepItem("1", "Find the movie or series", "Choose Video in search, find the title, and select the movie or series you want to keep."),
                            new GuideStepItem("2", "Choose its current status", "Choose Watched, Watching, or Want to watch, then tap ‘Keep this record’ below to add it to your timeline."),
                            new GuideStepItem("3", "Add more whenever you like", "Add a date, platform, place, or occasion in The moment, or leave a feeling and a short note. All of these are optional.")
                        }
                    ),
                    new GuideSectionBlock(
                        "Private first, shared when you choose",
                        new[]
                        {
                            "Records start on your personal timeline. Adding a note does not make it public. If you choose to share in Together, only the title and note become public while dates, places, and occasions stay private."
                        },
                        Array.Empty<GuideStepItem>()
                    )
                },
                CtaTitle: "Have something fresh in mind?",
                CtaDescription: "Find the title and keep only the details you can remember right now.",
                CtaLabel: "Keep a video record"
            ),
            new GuideArticle(
                Slug: "movie-series-log",
                ContentFilter: ContentFilter.VIDEO,
                Eyebrow: "Movie and series records",
                Title: "Keep movie and series watch history in one place",
                Summary: "The part that stays with you may be an episode, a room, or the person beside you. A few small details make it easier to return to a series and to remember how a film met you at the time.",
                UpdatedLabel: "Updated November 2026",
                CardTitle: "Remember the details of a movie or series",
                CardDescription: "Keep your status, season or episode, and the small details that bring a viewing moment back.",
                CardAction: "Read the movie and series guide →",
                Sections: new[]
                {
                    new GuideSectionBlock(
                        "Use a status that fits the way you watch",
                        new[]
                        {
                            "Choose Watched, Watching, or Want to watch, then tap ‘Keep this record’ below.",
                            "For a series, you can also keep season and episode details to help you find where to continue."
                        },
                        Array.Empty<GuideStepItem>()
                    ),
                    new GuideSectionBlock(
                        "Add a few details from the day",
                        new[] { "A day at home, a weekend with family, or a cinema trip can bring the memory back. Your record is complete even without a feeling or a note." },
                        new[]
                        {
                            new GuideStepItem("•", "Date and place", "Keep the day you watched and the place that became part of the memory."),
                            new GuideStepItem("•", "Who you were with", "Note whether it was time alone, with family, or with friends."),
                            new GuideStepItem("•", "A feeling and a short note", "Choose Excellent, Worth watching, or Disappointing, or leave a short note—both optional.")
                        }
                    ),
                    new GuideSectionBlock(
                        "Let the record change as your thoughts do",
                        new[] { "When you finish a series or your feelings change over time, update the existing record. Its history keeps every version so you can revisit how your thoughts evolved." },
                        Array.Empty<GuideStepItem>()
                    )
                },
                CtaTitle: "Is there a scene you still remember?",
                CtaDescription: "Find the title and keep one small detail that can bring the scene back.",
                CtaLabel: "Keep a movie or series record"
            ),
            new GuideArticle(
                Slug: "book-log",
                ContentFilter: ContentFilter.BOOK,
                Eyebrow: "Reading records",
                Title: "Keep the time you spent with a book",
                Summary: "The anticipation at the first page and the thought that remains after the last are both worth keeping. Your reading records can grow along the way, with as much or as little detail as you like.",
                UpdatedLabel: "Updated November 2026",
                CardTitle: "A simple place for your reading records",
                CardDescription: "Save the feeling of starting, the details along the way, and a note after the final page.",
                CardAction: "Read the book log guide →",
                Sections: new[]
                {
                    new GuideSectionBlock(
                        "Keep a record while you read",
                        new[]
                        {
                            "Choose Reading when you begin, Want to read when saving it for later, and Read after the final page.",
                            "Update the status as it changes so the whole stretch of time with the book stays connected."
                        },
                        Array.Empty<GuideStepItem>()
                    ),
                    new GuideSectionBlock(
                        "Begin with a title or author",
                        new[] { "Choose Book in search, find the title or author, and pick the matching edition." },
                        new[]
                        {
                            new GuideStepItem("1", "Choose your reading status", "Pick Read, Reading, or Want to read, then tap ‘Keep this record’ below."),
                            new GuideStepItem("2", "Add details in The moment", "Optionally add the date, where you read, and who you were with."),
                            new GuideStepItem("3", "Add a feeling or a thought", "Pick Life-changing, Not bad, or Disappointing, or jot down a line that stayed with you.")
                        }
                    ),
                    new GuideSectionBlock(
                        "See books and viewing memories on one timeline",
                        new[] { "Books, films, and series sit together in date order, and My space > My bookshelf automatically organizes your books by subject class." },
                        Array.Empty<GuideStepItem>()
                    )
                },
                CtaTitle: "What book is beside you now?",
                CtaDescription: "It is fine to be partway through. Start with the title and your current status.",
                CtaLabel: "Keep a reading record"
            )
        }
    );

    private static AboutPageContent BuildKoreanAbout() => new(
        Title: "가입 없이 남기는 영화·시리즈·책 기록 타임라인",
        Description: "ottline은 넷플릭스, 티빙, 디즈니+ 같은 OTT의 시청 기록과 영화·시리즈·책 감상 기록을 빠르게 남겨 내 타임라인에 모으는 서비스예요. 번거로운 가입 없이 시작하고, 웹·Android·iPhone·iPad·macOS·Windows 앱과 토스 인앱에서도 같은 기록을 이어볼 수 있어요.",
        PairingTitle: "기록은 한 번 시작하면 계속 이어져요.",
        PairingDescription: "기록이 있는 기기의 ‘내 공간’에서 기록 연결 코드를 확인해 주세요. 새 기기나 웹의 ‘내 공간’에 같은 코드를 입력하면 타임라인을 그대로 이어볼 수 있어요.",
        PlatformsTitle: "웹에서 시작해, 더 다양한 곳으로",
        PlatformsDescription: "기기에 맞는 앱을 고르고, 기록 연결 코드로 같은 타임라인을 이어가세요.",
        Platforms: new[]
        {
            new AboutPlatformCard("01", "웹과 설치형 PWA", "브라우저에서 바로 쓰고, 홈 화면이나 데스크톱에 설치해 앱처럼 다시 열 수 있어요.", "웹에서 열기 ↗", "https://ottline.app/ko"),
            new AboutPlatformCard("02", "Android 앱", "Google Play에서 설치해 홈 화면, 위젯, 시청 기록 알림 설정으로 더 빠르게 기록 화면에 들어갈 수 있어요.", "Google Play에서 ottline 설치 ↗", "https://play.google.com/store/apps/details?id=app.ottline"),
            new AboutPlatformCard("03", "iPhone·iPad 앱", "App Store에서 설치해 iPhone과 iPad에서도 같은 기록과 타임라인을 이어가요. iOS·iPadOS 16 이상에서 사용할 수 있어요.", "App Store에서 ottline 설치 ↗", "https://apps.apple.com/app/id6780318110"),
            new AboutPlatformCard("04", "macOS 앱", "Mac에서도 영상과 책을 기록하고 돌아보세요. 기록 연결 코드로 iPhone·iPad·웹의 기록을 이어 쓸 수 있어요. macOS 14 이상에서 사용할 수 있어요.", "Mac App Store에서 받기 ↗", "https://apps.apple.com/app/id6780318110?platform=mac"),
            new AboutPlatformCard("05", "Windows 앱", "기기에 기록을 보관해 오프라인에서도 꺼내 볼 수 있는 Windows 네이티브 앱이에요. Windows 11 위젯과 Ctrl+Shift+O로 빠르게 기록하고, 기록 연결 코드로 기존 기록도 이어가요.", "Microsoft Store ↗", "https://apps.microsoft.com/detail/9NSVNZGDMGF5", IsCurrentPlatform: true),
            new AboutPlatformCard("06", "토스 인앱", "내 OTT 타임라인을 앱 설치 없이 토스에서 바로 열 수 있어요.", "토스에서 열기 ↗", "https://minion.toss.im/XYvjpUB2")
        },
        CompanionToolsTitle: "보조 도구",
        ExtensionTitle: "데스크톱 브라우저 확장",
        ExtensionDescription: "지원하는 OTT 페이지에서 작품 제목을 가져와 기록 창을 열어요. Windows 앱이 있으면 작품을 앱으로 넘겨 바로 기록할 수 있어요.",
        ExtensionLinks: new[]
        {
            new AboutLinkItem("Chrome Web Store ↗", "https://chromewebstore.google.com/detail/ottline-helper/pbbkgfcmkpfmefngkhmlggckjjlljkhf"),
            new AboutLinkItem("Edge Add-ons ↗", "https://microsoftedge.microsoft.com/addons/detail/ottline-helper/eodpkekdfhnmhlnjfjmkpddmlddfnhll"),
            new AboutLinkItem("Whale Store ↗", "https://store.whale.naver.com/detail/cjkdbefdhkcgpmnjhnhghlbgdhfkbgcd")
        },
        HowToUseTitle: "어떻게 사용하나요?",
        Steps: new[]
        {
            new GuideStepItem("1", "작품 검색", "홈에서 기록 버튼을 누르거나 Ctrl+K로 검색창을 열고, 영화·시리즈·책 제목을 찾아보세요."),
            new GuideStepItem("2", "상태를 골라 기록 남기기", "다 봤는지·읽었는지, 이어가는 중인지, 나중에 보고·읽고 싶은지 골라요. 아래의 ‘기록 남기기’를 누르면 타임라인에 남아요."),
            new GuideStepItem("3", "더 기억하고 싶을 때 덧붙이기", "기록은 먼저 이 기기에 보관돼요. 날짜·장소·플랫폼·메모를 더하거나 세 가지 느낌 중 하나를 골라도, 이대로 두어도 괜찮아요.")
        },
        MoreTipsTitle: "더 편하게 쓰는 방법",
        Tips: new[]
        {
            new GuideStepItem("+", "Windows 11 위젯과 전역 단축키", "Win + W 위젯 보드에 ottline을 고정하거나, 어느 화면에서든 Ctrl+Shift+O로 빠른 기록 창을 열 수 있어요."),
            new GuideStepItem("+", "내 기록 CSV로 내보내기", "내 공간이나 타임라인에서 CSV 파일을 내려받아 엑셀 같은 스프레드시트 앱으로 살펴볼 수 있어요."),
            new GuideStepItem("+", "공유 카드로 기록 나누기", "기록을 남긴 뒤 ‘공유 카드 만들기’를 누르면 미리보기가 열려요. 원하는 내용을 골라 PNG로 저장하거나 바로 공유해 보세요.")
        },
        GuideSectionTitle: "어떤 기록부터 남길지 천천히 살펴보세요",
        GuideSectionDescription: "OTT 시청 기록과 영화·시리즈, 책 기록을 남기는 흐름을 차근차근 살펴봐요.",
        GuideLinks: new[]
        {
            new AboutLinkItem("OTT 시청 기록 가이드 →", "ott-watch-log"),
            new AboutLinkItem("영화·시리즈 시청 기록 가이드 →", "movie-series-log"),
            new AboutLinkItem("책·독서 기록 가이드 →", "book-log")
        },
        BrowseAllGuidesLabel: "모든 기록 가이드 보기 →",
        ClosingQuote: "\"기억은 흐릿해져도, 기록은 타임라인에 남아요.\""
    );

    private static AboutPageContent BuildEnglishAbout() => new(
        Title: "Movie, series, and book timelines without sign-up",
        Description: "ottline helps you keep OTT watch history from services like Netflix, TVING, and Disney+, along with films, series, and books, on your own timeline. Start without signing up and continue across the web, Android, iPhone, iPad, macOS, Windows, and Toss in-app.",
        PairingTitle: "Once you start recording, your timeline keeps going.",
        PairingDescription: "Find your record connection code in My space on a device that has your records. Enter it in My space on another device or the web to continue the same timeline.",
        PlatformsTitle: "Started on the web, opened in more places",
        PlatformsDescription: "Choose the app that fits your device and use your record connection code to continue the same timeline.",
        Platforms: new[]
        {
            new AboutPlatformCard("01", "Web and installable PWA", "Use it directly in the browser, then install it on your home screen or desktop to reopen it like an app.", "Open the web app ↗", "https://ottline.app/en"),
            new AboutPlatformCard("02", "Android app", "Install from Google Play to reach the record window from your home screen, widget, or watch reminder settings.", "Install from Google Play ↗", "https://play.google.com/store/apps/details?id=app.ottline"),
            new AboutPlatformCard("03", "iPhone & iPad app", "Install from the App Store and continue the same records and timeline on iPhone and iPad. Requires iOS or iPadOS 16 or later.", "Download on the App Store ↗", "https://apps.apple.com/app/id6780318110"),
            new AboutPlatformCard("04", "macOS app", "Record and revisit movies, shows, and books on your Mac. Use your record connection code to continue the same timeline. Requires macOS 14 or later.", "Download on the Mac App Store ↗", "https://apps.apple.com/app/id6780318110?platform=mac"),
            new AboutPlatformCard("05", "Windows app", "The native Windows app keeps your records on your device for offline viewing. Use Windows 11 widgets or Ctrl+Shift+O to start a record, and connect existing history with your code.", "Microsoft Store ↗", "https://apps.microsoft.com/detail/9NSVNZGDMGF5", IsCurrentPlatform: true),
            new AboutPlatformCard("06", "Toss in-app", "Open your OTT timeline directly inside Toss without installing another app.", "Open in Toss ↗", "https://minion.toss.im/XYvjpUB2")
        },
        CompanionToolsTitle: "Companion tools",
        ExtensionTitle: "Desktop browser extension",
        ExtensionDescription: "Bring a title from a supported streaming page into the record window. If you have the Windows app, you can send the title straight there to record it.",
        ExtensionLinks: new[]
        {
            new AboutLinkItem("Chrome Web Store ↗", "https://chromewebstore.google.com/detail/ottline-helper/pbbkgfcmkpfmefngkhmlggckjjlljkhf"),
            new AboutLinkItem("Edge Add-ons ↗", "https://microsoftedge.microsoft.com/addons/detail/ottline-helper/eodpkekdfhnmhlnjfjmkpddmlddfnhll"),
            new AboutLinkItem("Whale Store ↗", "https://store.whale.naver.com/detail/cjkdbefdhkcgpmnjhnhghlbgdhfkbgcd")
        },
        HowToUseTitle: "How it works",
        Steps: new[]
        {
            new GuideStepItem("1", "Find a title", "Select the record button on Home (or press Ctrl+K) to search for a film, series, or book."),
            new GuideStepItem("2", "Choose a status and keep it", "Choose whether you finished, are still watching or reading, or want to save it for later. Then tap ‘Keep this record’ below."),
            new GuideStepItem("3", "Add a little more if you like", "Your record is kept on this device first. Add a date, place, platform, or note, choose one of three feelings, or leave it as it is.")
        },
        MoreTipsTitle: "Good to know",
        Tips: new[]
        {
            new GuideStepItem("+", "Windows 11 widget & global shortcut", "Pin ottline in the Win + W Widgets Board or press Ctrl+Shift+O anywhere to open quick recording."),
            new GuideStepItem("+", "Export to CSV", "Download a CSV from My space or Timeline to view your records in Excel or another spreadsheet app."),
            new GuideStepItem("+", "Share a record as a card", "After keeping a record, choose “Create a share card” to preview it, save as PNG, copy, or share.")
        },
        GuideSectionTitle: "Find a recording rhythm that feels like yours",
        GuideSectionDescription: "See how to keep OTT watch history, films, series, and books step by step.",
        GuideLinks: new[]
        {
            new AboutLinkItem("Streaming watch history guide →", "ott-watch-log"),
            new AboutLinkItem("Film and series record guide →", "movie-series-log"),
            new AboutLinkItem("Book record guide →", "book-log")
        },
        BrowseAllGuidesLabel: "Browse all recording guides →",
        ClosingQuote: "\"Memories fade, but records remain on the timeline.\""
    );

    private static FaqPageContent BuildKoreanFaq() => new(
        Title: "자주 묻는 질문",
        Description: "ottline의 기록 보관 방식과 가입 없이 사용하는 방법을 살펴보세요.",
        Items: new[]
        {
            new FaqEntry(
                "Q. 가입 없이 기록은 어떻게 보관되나요?",
                "ottline은 로컬 퍼스트(Local-first) 방식으로 기록을 먼저 기기 내부 저장소에 보관해요. 가입하지 않아도 같은 기기에서 기록을 이어볼 수 있어요. 다른 기기로 옮기려면 기록을 동기화한 뒤 ‘기록 연결 코드’를 보관해 주세요."
            ),
            new FaqEntry(
                "Q. 기기를 변경해도 기록을 볼 수 있나요?",
                "네. 기록이 남아 있는 기기의 내 공간에서 ‘기록 연결 코드’를 확인한 뒤, 새 기기에 입력해 주세요. 여러 기기의 기록을 같은 타임라인으로 이어볼 수 있어요."
            ),
            new FaqEntry(
                "Q. 기기를 연결하면 기록은 어떻게 합쳐지나요?",
                "같은 작품의 기록이 양쪽에 있으면 더 최근에 수정된 내용이 남아요. 따라서 이전 내용은 최근 내용으로 바뀔 수 있어요."
            ),
            new FaqEntry(
                "Q. 기록을 삭제하고 싶으면 어떻게 하나요?",
                "개별 기록 삭제는 제공하지 않지만, ‘내 공간 > 서버 데이터 전체 삭제’로 계정에 연결된 서버 기록을 한 번에 삭제할 수 있어요. 현재 기기만 비우고 싶다면 ‘내 공간 > 로컬 데이터 초기화’를 사용해 주세요."
            ),
            new FaqEntry(
                "Q. 내 기록을 파일로 내려받을 수 있나요?",
                "네. ‘내 공간 > 내 기록 내보내기’나 타임라인에서 CSV 파일로 내려받아 엑셀 같은 스프레드시트 앱으로 정리할 수 있어요."
            ),
            new FaqEntry(
                "Q. 서비스 이용료가 있나요?",
                "모든 기능을 무료로 사용할 수 있어요. 편하게 기록을 남겨보세요."
            )
        },
        GuideTitle: "조금 더 자세한 기록 방법이 궁금한가요?",
        GuideDescription: "OTT 시청 기록, 영화·시리즈와 독서 기록을 가볍게 시작하는 흐름을 모아두었어요.",
        GuideAction: "기록 가이드 둘러보기 →"
    );

    private static FaqPageContent BuildEnglishFaq() => new(
        Title: "FAQ",
        Description: "Find answers about data storage and sign-up free usage of ottline.",
        Items: new[]
        {
            new FaqEntry(
                "Q. How are records kept without signing up?",
                "ottline uses Local-first storage. Your records are kept in your device’s local storage first, so you can return to them without signing up. To move to another device, let your records sync and keep your record connection code."
            ),
            new FaqEntry(
                "Q. Can I see my records on a different device?",
                "Yes! Find your record connection code in My space on a device that has your records, then enter it on the new device. Records from your devices can share the same timeline."
            ),
            new FaqEntry(
                "Q. How are records merged when I connect a device?",
                "If both devices have a record for the same title, the most recently edited content is kept. This may replace the earlier content."
            ),
            new FaqEntry(
                "Q. How do I delete records?",
                "Individual record deletion is not supported, but you can remove synced account data at once in My space > Delete all server data. If you only want to clear the current device, use My space > Reset local data."
            ),
            new FaqEntry(
                "Q. Can I download my records?",
                "Yes. You can download a CSV file in My space > Export my records or Timeline and organize it in Excel or another spreadsheet app."
            ),
            new FaqEntry(
                "Q. Is there a usage fee?",
                "All features are free. Keep your records at your own pace."
            )
        },
        GuideTitle: "Looking for a little more detail?",
        GuideDescription: "Explore calm, step-by-step guides for OTT watch logs, movies and series, and books.",
        GuideAction: "Browse the recording guides →"
    );

    private static PrivacyPageContent BuildKoreanPrivacy() => new(
        Title: "개인정보처리방침",
        LastUpdated: "최종 업데이트: 2026-11-08",
        Intro: "ottline(이하 \"서비스\")는 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다. 본 방침은 서비스 이용 중 처리되는 정보의 항목, 목적, 보관 방식, 이용자 권리를 안내합니다.",
        Sections: new[]
        {
            new PrivacySection(
                "1. 수집하는 정보",
                new[]
                {
                    "기록 데이터: 작품명·종류·장르, 감상·독서 상태, 느낌, 메모, 날짜, 플랫폼, 장소·상황, 시즌·회차",
                    "동기화 정보: 기기 연결과 동기화를 위한 계정·클라이언트 내부 식별자",
                    "추천 이용 정보: 추천 결과와 이유, 추천에서 제외한 작품, 날짜별 추천 횟수와 요청 처리 상태",
                    "서비스 이용 정보: 세션 식별자, 기능 이용 이벤트, 최초 진입 경로, referrer 출처 도메인, UTM 파라미터",
                    "이용 환경 정보: 기기·브라우저·OS 유형과 설치 상태"
                }
            ),
            new PrivacySection(
                "2. 정보 이용 목적",
                new[]
                {
                    "기록 저장·조회, 타임라인 구성, 기기 간 동기화 제공",
                    "이용자가 요청한 작품 추천 제공, 제외한 작품 반영과 날짜별 추천 횟수 관리",
                    "오류 분석과 서비스 안정성 개선",
                    "유입 경로와 기능 이용 현황을 집계해 이용 경험 개선"
                }
            ),
            new PrivacySection(
                "3. 보관 및 파기",
                new[]
                {
                    "동기화된 기록과 계정 정보는 이용자가 ‘내 공간 > 서버 데이터 전체 삭제’를 요청할 때까지 보관합니다.",
                    "서비스가 직접 수집한 분석 이벤트는 수집일로부터 180일 후 자동으로 파기합니다.",
                    "계정 삭제 시 계정 식별자가 저장된 분석 이벤트도 함께 삭제합니다. 계정 식별자가 없는 익명 이벤트는 특정 이용자를 확인해 선별 삭제할 수 없으며 180일 후 자동으로 파기합니다.",
                    "웹에서 Google Analytics 4와 Microsoft Clarity에 전송된 데이터는 각 제공자의 보존 설정과 정책에 따라 보관·파기됩니다.",
                    "법령상 보관 의무가 있는 경우 필요한 기간 동안만 보관합니다."
                }
            )
        },
        Section4Title: "4. 제3자 제공 및 처리 위탁",
        Section4Description: "서비스는 방문과 이용 흐름을 집계하기 위해 웹에서 Google의 Google Analytics 4와 Microsoft의 Clarity를 사용합니다. 작품 추천에는 아래와 같이 OpenAI를 이용합니다. 서비스는 이용자 정보를 판매하지 않습니다.",
        RecommendationTitle: "미래의 타임라인 · OpenAI 작품 추천",
        RecommendationDescription: "미래의 타임라인에서 새 추천을 요청하면, 추천에 사용할 기록 최대 50개의 작품명·종류·장르·느낌과 적어둔 메모·장소·상황, 추천에서 제외한 작품명을 OpenAI에 보내 다음에 만날 작품과 추천 이유를 받습니다. 기록 연결 코드나 계정·기기 내부 식별자는 추천 입력 항목에 포함하지 않습니다.",
        RecommendationStorage: "추천 결과·이유, 제외한 작품과 날짜별 이용 횟수·요청 처리 상태는 연결된 기기에서 이어볼 수 있도록 계정에 보관하며, 내 공간의 서버 데이터 전체 삭제 시 함께 삭제합니다. OpenAI에서의 데이터 처리·보관에는 해당 제공자의 정책과 적용 설정이 따릅니다.",
        Section5Title: "5. 이용자 권리",
        Section5Description: "이용자는 자신의 기록 데이터에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 서비스 내 ‘내 공간 > 서버 데이터 전체 삭제’ 기능 또는 운영자 문의를 통해 요청할 수 있습니다.",
        OpenMySpaceLabel: "내 공간 열기 →",
        Section6Title: "6. 문의",
        Section6Description: "개인정보 관련 문의는 서비스 내 문의함 또는 contact@ottline.app으로 접수해 주세요. 접수된 문의는 확인 후 지체 없이 처리합니다.",
        OpenFeedbackLabel: "내 문의함 열기 →"
    );

    private static PrivacyPageContent BuildEnglishPrivacy() => new(
        Title: "Privacy Policy",
        LastUpdated: "Last updated: November 8, 2026",
        Intro: "ottline (\"the Service\") values your privacy and complies with relevant laws. This policy guides you through the items of information processed, purposes, storage methods, and user rights.",
        Sections: new[]
        {
            new PrivacySection(
                "1. Information Collected",
                new[]
                {
                    "Record data: Title, type, genres, watching or reading status, feeling, note, date, platform, place or occasion, season and episode",
                    "Sync data: Internal account and client identifiers used for pairing and synchronization",
                    "Recommendation data: Suggested titles and reasons, excluded titles, daily usage counts and request status",
                    "Service usage data: Session identifier, feature events, initial landing path, referring origin, and UTM parameters",
                    "Environment data: Device, browser, OS, and installation status"
                }
            ),
            new PrivacySection(
                "2. Purpose of Usage",
                new[]
                {
                    "Storing and viewing records, building timelines, and providing sync",
                    "Providing requested title recommendations, applying exclusions, and managing daily recommendation usage",
                    "Analyzing errors and improving service stability",
                    "Aggregating acquisition paths and feature usage to improve the experience"
                }
            ),
            new PrivacySection(
                "3. Retention and Destruction",
                new[]
                {
                    "Synced records and account data are kept until you request My space > Delete all server data.",
                    "First-party analytics events are automatically deleted 180 days after collection.",
                    "Deleting an account also deletes analytics events that store its account identifier. Anonymous events without an account identifier cannot be matched to a specific person for selective deletion and are automatically deleted after 180 days.",
                    "Data sent to Google Analytics 4 and Microsoft Clarity on the web is retained and deleted under each provider's configured settings and policies.",
                    "When the law requires retention, information is kept only for the required period."
                }
            )
        },
        Section4Title: "4. Third-party Disclosure",
        Section4Description: "The Service uses Google Analytics 4 from Google and Clarity from Microsoft on the web to aggregate visits and usage flows. Title recommendations use OpenAI as described below. The Service does not sell user information.",
        RecommendationTitle: "Future timeline · OpenAI title recommendations",
        RecommendationDescription: "When you request new stories in Future timeline, we send OpenAI the titles, types, genres, feelings, and any notes, places or occasions from up to 50 selected records, plus excluded titles. Record connection codes and internal account or device identifiers are not included as recommendation input fields.",
        RecommendationStorage: "Suggested titles and reasons, excluded titles, daily usage counts and request status are kept with your account for connected devices. They are deleted when you choose My space > Delete all server data. OpenAI processes and retains data under its applicable policies and settings.",
        Section5Title: "5. User Rights",
        Section5Description: "Users may request access, correction, or deletion of their data through My space > Delete all server data or by contacting the operator.",
        OpenMySpaceLabel: "Open My space →",
        Section6Title: "6. Inquiry",
        Section6Description: "Please submit privacy-related inquiries through My inbox or contact@ottline.app. We will process them without delay after verification.",
        OpenFeedbackLabel: "Open My inbox →"
    );
}
