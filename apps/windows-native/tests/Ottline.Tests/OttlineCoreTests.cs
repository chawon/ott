using Ottline.Core.Data;
using Ottline.Core.Domain;
using Ottline.Core.Local;
using Ottline.Core.Models;
using Ottline.Core.WatchDetection;
using Xunit;

namespace Ottline.Tests;

public sealed class OttlineCoreTests
{
    [Fact]
    public void RecordDate_ValidatesAndFormatsCorrectly()
    {
        var refNow = new DateTimeOffset(2026, 5, 15, 14, 0, 0, TimeSpan.FromHours(9));
        Assert.Equal("2026-05-15", RecordDate.TodayDate(refNow));
        Assert.Equal("2026-05", RecordDate.CurrentMonth(refNow));
        Assert.Equal("2026-05-14", RecordDate.RelativeDate(-1, refNow));

        Assert.Equal("2026-05", RecordDate.NormalizeMonthInput("202605"));
        Assert.Equal("2026-05-09", RecordDate.NormalizeDateInput("20260509"));

        Assert.True(RecordDate.IsValidMonthInput("2026-05"));
        Assert.False(RecordDate.IsValidMonthInput("2026-13"));
        Assert.True(RecordDate.IsValidDateInput("2026-05-15"));
        Assert.False(RecordDate.IsValidDateInput("2026-02-30"));

        Assert.False(RecordDate.IsFutureDateInput("2026-05-15", refNow));
        Assert.True(RecordDate.IsFutureDateInput("2026-05-16", refNow));

        Assert.Equal("2026-05-15T12:00:00.000Z", RecordDate.ToNoonUtcIso("2026-05-15"));
        Assert.Equal("2026-04", RecordDate.ShiftMonth("2026-05", -1));
    }

    [Fact]
    public void RecordFeelings_ResolvesDirectAndLegacyValues()
    {
        Assert.Equal(RecordFeeling.SATISFIED, RecordFeelings.ResolveRecordFeeling(null, "SATISFIED"));
        Assert.Equal(RecordFeeling.SATISFIED, RecordFeelings.ResolveRecordFeeling(null, "LIKE"));
        Assert.Equal(RecordFeeling.DISAPPOINTED, RecordFeelings.ResolveRecordFeeling(null, "DISLIKE"));
        Assert.Equal(RecordFeeling.SATISFIED, RecordFeelings.ResolveRecordFeeling(4.5, null));
        Assert.Equal(RecordFeeling.NEUTRAL, RecordFeelings.ResolveRecordFeeling(3.0, null));
        Assert.Equal(RecordFeeling.DISAPPOINTED, RecordFeelings.ResolveRecordFeeling(1.5, null));
        Assert.Null(RecordFeelings.ResolveRecordFeeling(null, null));
    }

    [Fact]
    public void TimelineMoments_FormatsAndExtractsFrequentDimensions()
    {
        var title = new TitleSummary("tmdb:1", "tmdb", "1", TitleType.series, "더 베어");
        var log1 = new WatchLog("l1", title.Id, title, LogStatus.DONE, 4.5, "SATISFIED", "Disney+", "HOME", "ALONE", 2, 7, "포크 에피소드 최고", WatchedOn: "2026-05-10");
        var log2 = new WatchLog("l2", title.Id, title, LogStatus.DONE, 4.5, "SATISFIED", "Netflix", "집", "FAMILY", WatchedOn: "2026-05-11");

        Assert.Equal("집", OttlinePresets.FormatPlace("HOME", "ko"));
        Assert.Equal("Home", OttlinePresets.FormatPlace("HOME", "en"));
        Assert.Equal("이동 중", OttlinePresets.FormatPlace("TRANSIT", "ko"));
        Assert.Equal("도서관", OttlinePresets.FormatPlace("LIBRARY", "ko"));
        Assert.Equal("혼자", OttlinePresets.FormatOccasion("ALONE", "ko"));
        Assert.Equal("Alone", OttlinePresets.FormatOccasion("ALONE", "en"));
        Assert.Equal("HOME", OttlinePresets.ToPlaceWire("집"));
        Assert.Equal("ALONE", OttlinePresets.ToOccasionWire("혼자"));

        var summary = TimelineMoments.FormatMomentSummary(log1, "ko");
        Assert.Contains("2026.05.10", summary);
        Assert.Contains("Disney+", summary);
        Assert.Contains("집", summary);
        Assert.Contains("혼자", summary);
        Assert.Contains("S2 E7", summary);

        var dims = TimelineMoments.ExtractFrequentDimensions(new[] { log1, log2 }, 6, "ko");
        Assert.Single(dims.Places);
        Assert.Equal("집", dims.Places[0].Value);
        Assert.Equal(2, dims.Places[0].Count);
        Assert.Equal(2, dims.Occasions.Count);
        Assert.Contains(dims.Occasions, o => o.Value == "혼자" && o.Count == 1);
        Assert.Contains(dims.Occasions, o => o.Value == "가족" && o.Count == 1);
    }

    [Fact]
    public void BookshelfBuilder_InfersKdcClassesAndGroupsBooks()
    {
        var litBook = new TitleSummary("b1", "google_books", "1", TitleType.book, "소년이 온다",Genres: new[] { "한국소설" }, Isbn13: "9788936434120");
        var techBook = new TitleSummary("b2", "google_books", "2", TitleType.book, "인공지능 프로그래밍 입문", Genres: new[] { "컴퓨터" });
        var histBook = new TitleSummary("b3", "google_books", "3", TitleType.book, "나의 문화유산답사기", KdcCode: "911");

        Assert.Equal("800", BookshelfBuilder.InferKdcClass(litBook));
        Assert.Equal("500", BookshelfBuilder.InferKdcClass(techBook));
        Assert.Equal("900", BookshelfBuilder.InferKdcClass(histBook));

        var logs = new[]
        {
            new WatchLog("l1", litBook.Id, litBook, LogStatus.DONE, WatchedOn: "2026-05-01"),
            new WatchLog("l2", techBook.Id, techBook, LogStatus.IN_PROGRESS, WatchedOn: "2026-05-02"),
            new WatchLog("l3", histBook.Id, histBook, LogStatus.DONE, WatchedOn: "2026-05-03")
        };

        var shelves = BookshelfBuilder.BuildKdcShelves(logs);
        Assert.Equal(10, shelves.Count);
        Assert.Single(shelves.First(s => s.Code == "800").Books);
        Assert.Single(shelves.First(s => s.Code == "500").Books);
        Assert.Single(shelves.First(s => s.Code == "900").Books);
    }

    [Fact]
    public void ShareIntentParser_ParsesStoreHandoffAndOttLinks()
    {
        var handoff = ShareIntentParser.Parse("ottline://open?handoff=1&token=jwt_abc&code=OTTL-1234-5678&baseUrl=https%3A%2F%2Fottline.app");
        Assert.True(handoff.IsSessionHandoff);
        Assert.Equal("jwt_abc", handoff.HandoffToken);
        Assert.Equal("OTTL-1234-5678", handoff.HandoffRecoveryCode);
        Assert.Equal("https://ottline.app", handoff.HandoffBaseUrl);

        var netflix = ShareIntentParser.Parse("https://www.netflix.com/watch/81234567");
        Assert.Equal("Netflix", netflix.InferredPlatform);
        Assert.Equal(ContentFilter.VIDEO, netflix.InferredFilter);

        var ridi = ShareIntentParser.Parse("https://ridibooks.com/books/12345");
        Assert.Equal("리디셀렉트", ridi.InferredPlatform);
        Assert.Equal(ContentFilter.BOOK, ridi.InferredFilter);

        var nativeHandoff = ShareIntentParser.Parse(
            "ottline://open?handoff=1&status=ok&user_id=11111111-2222-3333-4444-555555555555&device_id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&pairing_code=OTTL-9999&nickname=%EC%9D%80%ED%95%98%EC%88%98+%EC%82%B0%EC%B1%85&persona_key=cinema_keeper");
        Assert.True(nativeHandoff.IsSessionHandoff);
        Assert.Equal("ok", nativeHandoff.HandoffStatus);
        Assert.Equal("11111111-2222-3333-4444-555555555555", nativeHandoff.HandoffUserId);
        Assert.Equal("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", nativeHandoff.HandoffDeviceId);
        Assert.Equal("OTTL-9999", nativeHandoff.HandoffRecoveryCode);
        Assert.Equal("은하수 산책", nativeHandoff.HandoffNickname);
        Assert.Equal("cinema_keeper", nativeHandoff.HandoffPersonaKey);
    }

    [Fact]
    public void CsvExporter_DefendsAgainstFormulaInjection()
    {
        var title = new TitleSummary("t1", "manual", "1", TitleType.movie, "=CMD|' /C calc'!A0");
        var log = new WatchLog("l1", title.Id, title, LogStatus.DONE, Note: "@SUM(1+1)", WatchedOn: "2026-05-10");

        var csv = CsvExporter.ExportLogsToCsv(new[] { log });
        Assert.Contains("\"'=CMD|' /C calc'!A0\"", csv);
        Assert.Contains("\"'@SUM(1+1)\"", csv);
    }

    [Fact]
    public void NetflixHistoryImporter_ParsesTitlesSeasonsAndDates()
    {
        var csv = "Title,Date\n\"더 글로리: 파트 2: 1화\",\"2023-03-10\"\n\"패스트 라이브즈\",\"05/12/24\"";
        var items = NetflixHistoryImporter.ParseCsv(csv);
        Assert.Equal(2, items.Count);
        Assert.Equal("더 글로리", items[0].SeriesOrMovieTitle);
        Assert.Equal(2, items[0].SeasonNumber);
        Assert.Equal("2023-03-10", items[0].WatchedOnDate);
        Assert.Equal("패스트 라이브즈", items[1].SeriesOrMovieTitle);
        Assert.Null(items[1].SeasonNumber);
        Assert.Equal("2024-05-12", items[1].WatchedOnDate);
    }

    [Fact]
    public void WatchReminderEngine_DetectsOttSessionAndRespectsThresholdAndCooldown()
    {
        // Privacy check: ClassifyWindow returns only canonical OTT platform name, never window title
        Assert.Equal("Netflix", WatchReminderEngine.ClassifyWindow("msedge", "폭싹 속았수다 4화 - 넷플릭스 - Microsoft Edge"));
        Assert.Equal("TVING", WatchReminderEngine.ClassifyWindow("chrome", "선재 업고 튀어 | 티빙 - Chrome"));
        Assert.Equal("Coupang Play", WatchReminderEngine.ClassifyWindow("msedge", "Coupang Play - Google Chrome"));
        Assert.Null(WatchReminderEngine.ClassifyWindow("Ottline.App", "넷플릭스 기록 - ottline"));

        var engine = new WatchReminderEngine(
            minWatchDuration: TimeSpan.FromMinutes(5),
            exitGracePeriod: TimeSpan.FromSeconds(15),
            platformCooldown: TimeSpan.FromHours(6),
            recentLogSuppression: TimeSpan.FromMinutes(30)
        );

        var t0 = new DateTimeOffset(2026, 5, 15, 21, 0, 0, TimeSpan.FromHours(9));

        // Watch Netflix for 6 minutes (sampled every 1 minute)
        for (var i = 0; i <= 6; i++)
        {
            var candidate = engine.ProcessForegroundSample("msedge", "Movie - Netflix", t0.AddMinutes(i));
            Assert.Null(candidate);
        }

        // User switches to Explorer; after 10s (< 15s grace period), still null
        Assert.Null(engine.ProcessForegroundSample("explorer", "바탕 화면", t0.AddMinutes(6).AddSeconds(10)));

        // After 20s (>= 15s grace period), watch reminder candidate fires!
        var fired = engine.ProcessForegroundSample("explorer", "바탕 화면", t0.AddMinutes(6).AddSeconds(20));
        Assert.NotNull(fired);
        Assert.Equal("Netflix", fired!.PlatformName);
        Assert.True(fired.DurationMinutes >= 5);

        // Cooldown check: another 6-minute Netflix session 1 hour later is suppressed by 6h cooldown
        var t1 = t0.AddHours(1);
        for (var i = 0; i <= 6; i++)
        {
            engine.ProcessForegroundSample("msedge", "Another - Netflix", t1.AddMinutes(i));
        }
        var suppressedByCooldown = engine.ProcessForegroundSample("explorer", "바탕 화면", t1.AddMinutes(6).AddSeconds(20));
        Assert.Null(suppressedByCooldown);
    }

    [Fact]
    public void DatabaseAndRepository_LocalFirstHistoryAndRemappingWork()
    {
        var tempDbPath = Path.Combine(Path.GetTempPath(), $"ottline_test_{Guid.NewGuid():N}.db");
        try
        {
            using var db = new OttlineDatabase(tempDbPath);
            using var repo = new OttlineRepository(db);

            var manualBook = TitleFallback.BuildManualBookMetadata("채식주의자", "한강", "창비", "9788936433598");
            var saved1 = repo.SaveLogLocalFirst(
                title: manualBook,
                status: LogStatus.IN_PROGRESS,
                feeling: RecordFeeling.NEUTRAL,
                watchedOnDate: "2026-05-01",
                ott: "종이책",
                place: "카페",
                occasion: "혼자",
                note: "1부 읽는 중"
            );

            Assert.Equal(1, saved1.Revision);
            Assert.Equal("pending", saved1.SyncState);

            // Polish the log ("다듬기") -> Revision increments to 2 and history keeps both revisions
            var saved2 = repo.SaveLogLocalFirst(
                title: manualBook,
                status: LogStatus.DONE,
                feeling: RecordFeeling.SATISFIED,
                watchedOnDate: "2026-05-03",
                ott: "종이책",
                place: "집",
                occasion: "심야",
                note: "마지막 장을 덮고 오래 생각했다"
            );

            Assert.Equal(saved1.Id, saved2.Id);
            Assert.Equal(2, saved2.Revision);

            var history = repo.GetHistoryForTitle(manualBook.Id);
            Assert.Equal(2, history.Count);
            Assert.Equal(2, history[0].Revision);
            Assert.Equal(1, history[1].Revision);

            // Verify canonical ID remapping from server sync
            db.RemapTitleId(manualBook.Id, "gbooks:canonical-123");
            db.RemapLogId(saved2.Id, "srv-log:999");

            var remappedLog = db.GetLog("srv-log:999");
            Assert.NotNull(remappedLog);
            Assert.Equal("gbooks:canonical-123", remappedLog!.TitleId);
            Assert.Equal("synced", remappedLog.SyncState);

            var remappedHistory = db.GetHistoryForTitle("gbooks:canonical-123");
            Assert.Equal(2, remappedHistory.Count);
        }
        finally
        {
            try { File.Delete(tempDbPath); } catch { }
        }
    }

    [Fact]
    public void FeedbackAndRecommendation_WireAndLocaleMappingsWork()
    {
        Assert.Equal("QUESTION", Ottline.Core.Remote.OttlineApiClient.NormalizeFeedbackCategory("GENERAL"));
        Assert.Equal("BUG", Ottline.Core.Remote.OttlineApiClient.NormalizeFeedbackCategory("bug"));
        Assert.Equal("IDEA", Ottline.Core.Remote.OttlineApiClient.NormalizeFeedbackCategory("IDEA"));
        Assert.Equal("OTHER", Ottline.Core.Remote.OttlineApiClient.NormalizeFeedbackCategory("other"));

        Assert.Equal("버그", Ottline.Core.Remote.OttlineApiClient.FormatFeedbackCategory("BUG", "ko"));
        Assert.Equal("Bug", Ottline.Core.Remote.OttlineApiClient.FormatFeedbackCategory("BUG", "en"));
        Assert.Equal("답변 완료", Ottline.Core.Remote.OttlineApiClient.FormatFeedbackStatus("ANSWERED", "ko"));
        Assert.Equal("Answered", Ottline.Core.Remote.OttlineApiClient.FormatFeedbackStatus("ANSWERED", "en"));

        var bookRecKo = new RecommendationItem(
            Title: new TitleSummary("gbooks:1", "google_books", "1", TitleType.book, "밝은 밤", Year: 2021, Authors: new[] { "최은영" }),
            ReasonKo: "한국어 추천 이유",
            ReasonEn: "English reason",
            Locale: "ko"
        );
        Assert.Equal("읽고 싶어요", bookRecKo.ActionLabel);
        Assert.Equal("이미 본·읽은 작품", bookRecKo.ExcludeLabel);
        Assert.Equal("책 · 2021 · 최은영", bookRecKo.MetaLine);

        var bookRecEn = bookRecKo with { Locale = "en" };
        Assert.Equal("Want to read", bookRecEn.ActionLabel);
        Assert.Equal("Already seen or read", bookRecEn.ExcludeLabel);
        Assert.Equal("Book · 2021 · 최은영", bookRecEn.MetaLine);
    }

    [Fact]
    public void AuthProfile_ParseProfileElementHandlesNicknameAndDefaults()
    {
        using var doc = System.Text.Json.JsonDocument.Parse("""
        {
          "userId": "u-123",
          "nickname": "차원이",
          "personaKey": "midnight_logger",
          "pairingCode": "5HFNPZ6K",
          "profileUpdatedAt": "2026-11-16T00:00:00Z"
        }
        """);
        var parsed = Ottline.Core.Remote.OttlineApiClient.ParseProfileElement(doc.RootElement);
        Assert.Equal("u-123", parsed.UserId);
        Assert.Equal("차원이", parsed.DisplayName);
        Assert.Equal("midnight_logger", parsed.AvatarPreset);
        Assert.Equal("5HFNPZ6K", parsed.RecoveryCode);
        Assert.Equal("2026-11-16T00:00:00Z", parsed.RecoveryCodeIssuedAt);

        using var blankDoc = System.Text.Json.JsonDocument.Parse("""
        {
          "userId": "u-456",
          "nickname": null,
          "personaKey": null
        }
        """);
        var fallback = Ottline.Core.Remote.OttlineApiClient.ParseProfileElement(blankDoc.RootElement);
        Assert.Equal("u-456", fallback.UserId);
        Assert.Equal("나의 기록실", fallback.DisplayName);
        Assert.Equal("cinema_keeper", fallback.AvatarPreset);
    }

    [Fact]
    public void ShareIntentParser_ParsesWidgetDeepLinks()
    {
        var all = ShareIntentParser.Parse("ottline://quick?type=all");
        Assert.True(all.OpenQuickRecord);
        Assert.Equal(ContentFilter.ALL, all.InferredFilter);

        var video = ShareIntentParser.Parse("ottline://quick?type=video");
        Assert.True(video.OpenQuickRecord);
        Assert.Equal(ContentFilter.VIDEO, video.InferredFilter);

        var book = ShareIntentParser.Parse("ottline://quick?type=book");
        Assert.True(book.OpenQuickRecord);
        Assert.Equal(ContentFilter.BOOK, book.InferredFilter);

        var title = ShareIntentParser.Parse("ottline://quick?title_id=tmdb:42");
        Assert.True(title.OpenQuickRecord);
        Assert.Equal("tmdb:42", title.OpenTitleId);

        var timeline = ShareIntentParser.Parse("ottline://timeline");
        Assert.Equal("timeline", timeline.OpenRoute);
    }

    [Fact]
    public void OttlineWidgetSnapshotBuilder_BuildsLocalizedSnapshotAndValidAdaptiveCards()
    {
        var refNow = new DateTimeOffset(2026, 11, 16, 20, 0, 0, TimeSpan.FromHours(9));
        var movieTitle = new TitleSummary("tmdb:10", "tmdb", "10", TitleType.movie, "헤어질 결심", Year: 2022, PosterUrl: "/t/p/w500/poster.jpg");
        var seriesTitle = new TitleSummary("tmdb:20", "tmdb", "20", TitleType.series, "세브란스", Year: 2022);
        var bookTitle = new TitleSummary("kakao:30", "kakao_books", "30", TitleType.book, "대도시의 사랑법", Authors: new[] { "박상영" });

        var logs = new[]
        {
            new WatchLog("l1", movieTitle.Id, movieTitle, LogStatus.DONE, 4.5, "SATISFIED", "Netflix", "HOME", "ALONE", Note: "안개 속 장면", Spoiler: true, WatchedOn: "2026-11-05"),
            new WatchLog("l2", seriesTitle.Id, seriesTitle, LogStatus.IN_PROGRESS, null, null, "Apple TV", "HOME", "ALONE", SeasonNumber: 2, Note: "2화까지 정주행\n너무 몰입된다", Spoiler: false, WatchedOn: "2026-11-15"),
            new WatchLog("l3", bookTitle.Id, bookTitle, LogStatus.DONE, 4.5, "SATISFIED", "밀리의서재", WatchedOn: "2026-10-20")
        };

        // KO snapshot prefers IN_PROGRESS as ContinueItem
        var snapKo = OttlineWidgetSnapshotBuilder.BuildSnapshot(logs, "ko", refNow);
        Assert.False(snapKo.IsEnglish);
        Assert.Equal("11월 · 2편", snapKo.MonthBadge);
        Assert.Equal(2, snapKo.ThisMonthCount);
        Assert.NotNull(snapKo.ContinueItem);
        Assert.Equal("tmdb:20", snapKo.ContinueItem!.TitleId);
        Assert.Equal("세브란스", snapKo.ContinueItem.TitleName);
        Assert.True(snapKo.ContinueItem.IsInProgress);
        Assert.Equal("보는 중", snapKo.ContinueItem.StatusLabel);
        Assert.Equal("Apple TV · 시즌 2", snapKo.ContinueItem.MetaText);
        Assert.Equal("2화까지 정주행 너무 몰입된다", snapKo.ContinueItem.NoteSnippet);
        Assert.Equal(2, snapKo.RecentItems.Count);

        // EN snapshot formatting
        var snapEn = OttlineWidgetSnapshotBuilder.BuildSnapshot(logs, "en", refNow);
        Assert.True(snapEn.IsEnglish);
        Assert.Equal("Nov · 2", snapEn.MonthBadge);
        Assert.Equal("Watching", snapEn.ContinueItem!.StatusLabel);
        Assert.Equal("Apple TV · S2", snapEn.ContinueItem.MetaText);

        // Spoiler suppression when hero has spoiler=true
        var spoilerHeroSnap = OttlineWidgetSnapshotBuilder.BuildSnapshot(new[] { logs[0] }, "ko", refNow);
        Assert.DoesNotContain("안개 속", spoilerHeroSnap.ContinueItem!.NoteSnippet);

        // Adaptive Card validation for all 3 Windows sizes
        foreach (var size in new[] { "small", "medium", "large" })
        {
            var json = OttlineWidgetSnapshotBuilder.BuildAdaptiveCardJson(snapKo, size, "data:image/jpeg;base64,AAA=");
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            Assert.Equal("AdaptiveCard", doc.RootElement.GetProperty("type").GetString());
            Assert.Equal("1.5", doc.RootElement.GetProperty("version").GetString());
            Assert.Contains("quick_record_all", json);
            if (size is "medium" or "large")
            {
                Assert.Contains("quick_record_video", json);
                Assert.Contains("quick_record_book", json);
            }
            if (size == "large")
            {
                Assert.Contains("open_timeline", json);
                Assert.Contains("open_title", json);
            }
        }
    }

    [Fact]
    public async Task MigrationHandoff_ParsesNativeHandoffAndRestoresOrHandlesEmptySession()
    {
        var tempDbPath = Path.Combine(Path.GetTempPath(), $"ottline_handoff_test_{Guid.NewGuid():N}.db");
        try
        {
            using var db = new OttlineDatabase(tempDbPath);
            using var httpClient = new HttpClient(new StubOfflineHttpMessageHandler());
            using var api = new Ottline.Core.Remote.OttlineApiClient(httpClient);
            using var repo = new OttlineRepository(db, api);

            var initial = db.LoadSettings();
            Assert.True(Guid.TryParse(initial.DeviceId, out _));

            var emptyIntent = ShareIntentParser.Parse("ottline://open?handoff=1&status=empty");
            Assert.True(emptyIntent.IsSessionHandoff);
            Assert.Equal("empty", emptyIntent.HandoffStatus);

            var emptyRes = await repo.ImportBrowserHandoffAsync(emptyIntent);
            Assert.False(emptyRes.Success);
            var afterEmpty = db.LoadSettings();
            Assert.False(afterEmpty.HasCompletedBrowserHandoff);
            Assert.False(afterEmpty.HasDismissedMigrationBanner);

            var okIntent = ShareIntentParser.Parse(
                "ottline://open?handoff=1&status=ok&user_id=11111111-2222-3333-4444-555555555555&device_id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&pairing_code=OTTL-9999&nickname=%EC%9D%80%ED%95%98%EC%88%98+%EC%82%B0%EC%B1%85&persona_key=midnight_logger");
            var okRes = await repo.ImportBrowserHandoffAsync(okIntent);
            Assert.True(okRes.Success);

            var restored = db.LoadSettings();
            Assert.Equal("11111111-2222-3333-4444-555555555555", restored.UserId);
            Assert.Equal("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", restored.DeviceId);
            Assert.True(Guid.TryParse(restored.DeviceId, out _));
            Assert.Equal("OTTL-9999", restored.RecoveryCode);
            Assert.Equal("은하수 산책", restored.DisplayName);
            Assert.Equal("midnight_logger", restored.AvatarPreset);
            Assert.True(restored.HasCompletedBrowserHandoff);
            Assert.True(restored.HasDismissedMigrationBanner);
        }
        finally
        {
            try { File.Delete(tempDbPath); } catch { }
        }
    }

    [Fact]
    public async Task DeleteServerAccount_CallsAuthAccountEndpointAndResetsLocalDataOnlyAfterSuccess()
    {
        var tempDbPath = Path.Combine(Path.GetTempPath(), $"ottline_delete_ok_{Guid.NewGuid():N}.db");
        try
        {
            var userId = "11111111-2222-3333-4444-555555555555";
            var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
            var handler = new RecordingHttpMessageHandler(_ =>
                new HttpResponseMessage(System.Net.HttpStatusCode.NoContent));

            using var db = new OttlineDatabase(tempDbPath);
            using var httpClient = new HttpClient(handler);
            using var api = new Ottline.Core.Remote.OttlineApiClient(httpClient);
            using var repo = new OttlineRepository(db, api);

            repo.UpdateSettings(s => s with
            {
                BaseUrl = "https://ottline.app",
                UserId = userId,
                DeviceId = deviceId,
                RecoveryCode = "ABCD1234",
                DisplayName = "테스터",
                AvatarPreset = "midnight_logger",
                Locale = "en",
                ThemeMode = ThemeMode.DARK,
                LastSyncCursor = "2026-11-20T00:00:00Z",
                HasCompletedBrowserHandoff = true,
                HasDismissedMigrationBanner = true
            });

            var book = TitleFallback.BuildManualBookMetadata("소년이 온다", "한강", "창비", "9788936434120");
            repo.SaveLogLocalFirst(book, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-19", note: "기록 보존 테스트");
            Assert.Single(repo.GetAllLogs());
            Assert.Single(repo.GetHistoryForTitle(book.Id));
            Assert.True(repo.GetPendingOutboxCount() > 0);

            var result = await repo.DeleteServerAccountAsync();

            Assert.True(result.IsSuccess);
            Assert.Equal(ServerAccountDeleteOutcome.Deleted, result.Outcome);
            Assert.Equal(204, result.StatusCode);

            var deleteReq = Assert.Single(handler.Requests, r => r.Method == HttpMethod.Delete);
            Assert.Equal("https://ottline.app/api/auth/account", deleteReq.Uri);
            Assert.Equal(userId, deleteReq.UserIdHeader);
            Assert.Equal(deviceId, deleteReq.DeviceIdHeader);
            Assert.Equal("windows_native", deleteReq.ClientPlatformHeader);

            Assert.Empty(repo.GetAllLogs());
            Assert.Empty(repo.GetHistoryForTitle(book.Id));
            Assert.Equal(0, repo.GetPendingOutboxCount());

            var afterSettings = repo.GetSettings();
            Assert.Null(afterSettings.UserId);
            Assert.Null(afterSettings.AuthToken);
            Assert.Null(afterSettings.RecoveryCode);
            Assert.Null(afterSettings.LastSyncCursor);
            Assert.Equal("나의 기록실", afterSettings.DisplayName);
            Assert.Equal("cinema_keeper", afterSettings.AvatarPreset);
            Assert.True(Guid.TryParse(afterSettings.DeviceId, out _));
            Assert.NotEqual(deviceId, afterSettings.DeviceId);
            // Non-account device preferences remain intact
            Assert.Equal("en", afterSettings.Locale);
            Assert.Equal(ThemeMode.DARK, afterSettings.ThemeMode);
            Assert.Equal("https://ottline.app", afterSettings.BaseUrl);

            // Second attempt without connected account does not call server
            var secondAttempt = await repo.DeleteServerAccountAsync();
            Assert.False(secondAttempt.IsSuccess);
            Assert.Equal(ServerAccountDeleteOutcome.NotConnected, secondAttempt.Outcome);
            Assert.Single(handler.Requests, r => r.Method == HttpMethod.Delete);
        }
        finally
        {
            try { File.Delete(tempDbPath); } catch { }
        }
    }

    [Fact]
    public async Task DeleteServerAccount_PreservesLocalLogsOutboxAndConnectionOnHttpErrorsAndSupportsRetry()
    {
        var tempDbPath = Path.Combine(Path.GetTempPath(), $"ottline_delete_http_err_{Guid.NewGuid():N}.db");
        try
        {
            var userId = "11111111-2222-3333-4444-555555555555";
            var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
            var nextStatus = System.Net.HttpStatusCode.InternalServerError;
            var handler = new RecordingHttpMessageHandler(_ => new HttpResponseMessage(nextStatus));

            using var db = new OttlineDatabase(tempDbPath);
            using var httpClient = new HttpClient(handler);
            using var api = new Ottline.Core.Remote.OttlineApiClient(httpClient);
            using var repo = new OttlineRepository(db, api);

            repo.UpdateSettings(s => s with
            {
                UserId = userId,
                DeviceId = deviceId,
                RecoveryCode = "KEEP5678",
                DisplayName = "보존 계정",
                LastSyncCursor = "2026-11-20T01:00:00Z"
            });

            var movie = TitleFallback.BuildManualVideoMetadata("헤어질 결심", TitleType.movie, 2022);
            repo.SaveLogLocalFirst(movie, LogStatus.IN_PROGRESS, null, "2026-11-18", note: "1차 기록");
            repo.SaveLogLocalFirst(movie, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-19", note: "수정된 기록");
            var expectedOutboxCount = repo.GetPendingOutboxCount();
            Assert.True(expectedOutboxCount > 0);

            foreach (var failureStatus in new[]
                     {
                         System.Net.HttpStatusCode.Unauthorized,
                         System.Net.HttpStatusCode.NotFound,
                         System.Net.HttpStatusCode.InternalServerError
                     })
            {
                nextStatus = failureStatus;
                var failed = await repo.DeleteServerAccountAsync();

                Assert.False(failed.IsSuccess);
                Assert.Equal(ServerAccountDeleteOutcome.HttpError, failed.Outcome);
                Assert.Equal((int)failureStatus, failed.StatusCode);

                var preservedLogs = repo.GetAllLogs();
                Assert.Single(preservedLogs);
                Assert.Equal("수정된 기록", preservedLogs[0].Note);
                Assert.Equal(2, repo.GetHistoryForTitle(movie.Id).Count);
                Assert.Equal(expectedOutboxCount, repo.GetPendingOutboxCount());

                var preservedSettings = repo.GetSettings();
                Assert.Equal(userId, preservedSettings.UserId);
                Assert.Equal(deviceId, preservedSettings.DeviceId);
                Assert.Equal("KEEP5678", preservedSettings.RecoveryCode);
                Assert.Equal("보존 계정", preservedSettings.DisplayName);
                Assert.Equal("2026-11-20T01:00:00Z", preservedSettings.LastSyncCursor);
            }

            // Retry after server recovers succeeds and wipes local records & connection
            nextStatus = System.Net.HttpStatusCode.OK;
            var retry = await repo.DeleteServerAccountAsync();
            Assert.True(retry.IsSuccess);
            Assert.Equal(ServerAccountDeleteOutcome.Deleted, retry.Outcome);
            Assert.Empty(repo.GetAllLogs());
            Assert.Equal(0, repo.GetPendingOutboxCount());
            Assert.Null(repo.GetSettings().UserId);
            Assert.Null(repo.GetSettings().RecoveryCode);
        }
        finally
        {
            try { File.Delete(tempDbPath); } catch { }
        }
    }

    [Fact]
    public async Task DeleteServerAccount_PreservesLocalStateOnNetworkFailureAndAllowsRetry()
    {
        var tempDbPath = Path.Combine(Path.GetTempPath(), $"ottline_delete_net_err_{Guid.NewGuid():N}.db");
        try
        {
            var userId = "22222222-3333-4444-5555-666666666666";
            var deviceId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
            var mode = "http_exception";
            var handler = new RecordingHttpMessageHandler(_ =>
            {
                if (mode == "http_exception") throw new HttpRequestException("Simulated offline network");
                if (mode == "timeout") throw new TaskCanceledException("Simulated timeout");
                return new HttpResponseMessage(System.Net.HttpStatusCode.NoContent);
            });

            using var db = new OttlineDatabase(tempDbPath);
            using var httpClient = new HttpClient(handler);
            using var api = new Ottline.Core.Remote.OttlineApiClient(httpClient);
            using var repo = new OttlineRepository(db, api);

            repo.UpdateSettings(s => s with
            {
                UserId = userId,
                DeviceId = deviceId,
                RecoveryCode = "NET99999"
            });

            var title = TitleFallback.BuildManualVideoMetadata("패스트 라이브즈", TitleType.movie, 2023);
            repo.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-20", note: "오프라인 미동기화 기록");
            var outboxBefore = repo.GetPendingOutboxCount();
            Assert.True(outboxBefore > 0);

            foreach (var failureMode in new[] { "http_exception", "timeout" })
            {
                mode = failureMode;
                var failed = await repo.DeleteServerAccountAsync();

                Assert.False(failed.IsSuccess);
                Assert.Equal(ServerAccountDeleteOutcome.NetworkError, failed.Outcome);
                Assert.Null(failed.StatusCode);

                Assert.Single(repo.GetAllLogs());
                Assert.Equal(outboxBefore, repo.GetPendingOutboxCount());
                Assert.Equal(userId, repo.GetSettings().UserId);
                Assert.Equal(deviceId, repo.GetSettings().DeviceId);
                Assert.Equal("NET99999", repo.GetSettings().RecoveryCode);
            }

            // Network returns -> retry deletes cleanly
            mode = "ok";
            var retried = await repo.DeleteServerAccountAsync();
            Assert.True(retried.IsSuccess);
            Assert.Empty(repo.GetAllLogs());
            Assert.Equal(0, repo.GetPendingOutboxCount());
            Assert.Null(repo.GetSettings().UserId);
        }
        finally
        {
            try { File.Delete(tempDbPath); } catch { }
        }
    }

    [Fact]
    public async Task DeleteServerAccount_WhenNotConnected_DoesNotCallServerOrResetLocalData()
    {
        var tempDbPath = Path.Combine(Path.GetTempPath(), $"ottline_delete_unlinked_{Guid.NewGuid():N}.db");
        try
        {
            var handler = new RecordingHttpMessageHandler(_ =>
                new HttpResponseMessage(System.Net.HttpStatusCode.OK));

            using var db = new OttlineDatabase(tempDbPath);
            using var httpClient = new HttpClient(handler);
            using var api = new Ottline.Core.Remote.OttlineApiClient(httpClient);
            using var repo = new OttlineRepository(db, api);

            var title = TitleFallback.BuildManualVideoMetadata("로컬 전용 기록", TitleType.movie, 2026);
            repo.SaveLogLocalFirst(title, LogStatus.DONE, RecordFeeling.SATISFIED, "2026-11-20");

            var result = await repo.DeleteServerAccountAsync();

            Assert.False(result.IsSuccess);
            Assert.Equal(ServerAccountDeleteOutcome.NotConnected, result.Outcome);
            Assert.DoesNotContain(handler.Requests, r => r.Method == HttpMethod.Delete);
            Assert.Single(repo.GetAllLogs());
            Assert.True(repo.GetPendingOutboxCount() > 0);
        }
        finally
        {
            try { File.Delete(tempDbPath); } catch { }
        }
    }

    [Fact]
    public async Task UnlinkDevice_CallsAuthDevicesPathAndHandlesErrors()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        var targetId = "99999999-8888-7777-6666-555555555555";
        var handler = new RecordingHttpMessageHandler(_ =>
            new HttpResponseMessage(System.Net.HttpStatusCode.NoContent));

        using var httpClient = new HttpClient(handler);
        using var api = new Ottline.Core.Remote.OttlineApiClient(httpClient);
        api.Configure("https://ottline.app", null, deviceId, "ko", userId);

        var ok = await api.UnlinkDeviceAsync(targetId);
        Assert.True(ok);
        var req = Assert.Single(handler.Requests, r => r.Method == HttpMethod.Delete);
        Assert.Equal($"https://ottline.app/api/auth/devices/{targetId}", req.Uri);
        Assert.Equal(userId, req.UserIdHeader);
        Assert.Equal(deviceId, req.DeviceIdHeader);
    }

    private sealed record RecordedHttpRequest(
        HttpMethod Method,
        string Uri,
        string? UserIdHeader,
        string? DeviceIdHeader,
        string? ClientPlatformHeader
    );

    private sealed class RecordingHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
        private readonly System.Collections.Concurrent.ConcurrentQueue<RecordedHttpRequest> _requests = new();
        public IReadOnlyCollection<RecordedHttpRequest> Requests => _requests;

        public RecordingHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            request.Headers.TryGetValues("X-User-Id", out var userIds);
            request.Headers.TryGetValues("X-Device-Id", out var deviceIds);
            request.Headers.TryGetValues("X-Client-Platform", out var platforms);
            _requests.Enqueue(new RecordedHttpRequest(
                request.Method,
                request.RequestUri?.ToString() ?? string.Empty,
                userIds?.FirstOrDefault(),
                deviceIds?.FirstOrDefault(),
                platforms?.FirstOrDefault()
            ));
            if (request.Method != HttpMethod.Delete)
            {
                return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK));
            }
            return Task.FromResult(_responder(request));
        }
    }

    private sealed class StubOfflineHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.ServiceUnavailable));
    }
}
