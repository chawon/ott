using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Ottline.Core.Data;
using Ottline.Core.Domain;
using Ottline.Core.I18n;
using Ottline.Core.Local;
using Ottline.Core.Models;
using Ottline.Core.Remote;
using Xunit;

namespace Ottline.Tests;

public sealed class QuickRecordAndAutoSyncTests
{
    private sealed class StubHttpHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _responder;
        public ConcurrentQueue<string> RequestPaths { get; } = new();

        public StubHttpHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestPaths.Enqueue($"{request.Method} {request.RequestUri?.PathAndQuery}");
            return _responder(request, cancellationToken);
        }
    }

    private static HttpResponseMessage JsonResponse(object payload, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

    private static void CleanupDb(string dbPath)
    {
        try { if (File.Exists(dbPath)) File.Delete(dbPath); } catch { }
        try { if (File.Exists(dbPath + "-wal")) File.Delete(dbPath + "-wal"); } catch { }
        try { if (File.Exists(dbPath + "-shm")) File.Delete(dbPath + "-shm"); } catch { }
    }

    [Fact]
    public void AutoSyncGate_SkipsWhenDisconnectedAndNoOutbox_RunsWhenConnectedOrOutboxPending()
    {
        var gate = new AutoSyncGate();
        var t0 = new DateTimeOffset(2026, 11, 28, 12, 0, 0, TimeSpan.Zero);

        Assert.False(gate.ShouldRun(AutoSyncTrigger.TabNavigation, hasConnectedAccount: false, pendingOutboxCount: 0, nowUtc: t0));
        Assert.False(gate.ShouldRun(AutoSyncTrigger.WindowActivated, hasConnectedAccount: false, pendingOutboxCount: 0, nowUtc: t0));
        Assert.True(gate.ShouldRun(AutoSyncTrigger.TabNavigation, hasConnectedAccount: false, pendingOutboxCount: 1, nowUtc: t0));
        Assert.True(gate.ShouldRun(AutoSyncTrigger.TabNavigation, hasConnectedAccount: true, pendingOutboxCount: 0, nowUtc: t0));
        Assert.True(gate.ShouldRun(AutoSyncTrigger.WindowActivated, hasConnectedAccount: true, pendingOutboxCount: 0, nowUtc: t0));
    }

    [Fact]
    public void AutoSyncGate_EnforcesDistinctCooldownsForTabNavigationAndWindowActivated()
    {
        var gate = new AutoSyncGate(
            tabNavigationCooldown: TimeSpan.FromMilliseconds(1500),
            windowActivatedCooldown: TimeSpan.FromSeconds(5)
        );
        var t0 = new DateTimeOffset(2026, 11, 28, 12, 0, 0, TimeSpan.Zero);

        Assert.True(gate.ShouldRun(AutoSyncTrigger.TabNavigation, hasConnectedAccount: true, pendingOutboxCount: 0, nowUtc: t0));
        gate.MarkCompleted(t0);

        // Within 1.5s: both triggers throttled
        Assert.False(gate.ShouldRun(AutoSyncTrigger.TabNavigation, true, 0, t0.AddMilliseconds(500)));
        Assert.False(gate.ShouldRun(AutoSyncTrigger.WindowActivated, true, 0, t0.AddSeconds(2)));

        // At 1.5s: TabNavigation allowed, WindowActivated still within 5s cooldown
        Assert.True(gate.ShouldRun(AutoSyncTrigger.TabNavigation, true, 0, t0.AddMilliseconds(1500)));
        Assert.False(gate.ShouldRun(AutoSyncTrigger.WindowActivated, true, 0, t0.AddMilliseconds(4999)));

        // At 5.0s: WindowActivated allowed again
        Assert.True(gate.ShouldRun(AutoSyncTrigger.WindowActivated, true, 0, t0.AddSeconds(5)));
    }

    [Fact]
    public async Task AutoSync_AndroidRecordDeltaPull_UpdatesLocalTimelineWithoutLosingWindowsLogs()
    {
        var userId = "11111111-2222-3333-4444-555555555555";
        var deviceId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        var winTitleId = "22222222-1111-4111-8111-111111111111";
        var androidTitleId = "33333333-2222-4222-8222-222222222222";
        var androidLogId = "44444444-3333-4333-8333-333333333333";

        var pullCount = 0;
        var androidRecordAvailable = false;
        string? secondPullQuery = null;

        var handler = new StubHttpHandler((req, _) =>
        {
            var path = req.RequestUri?.PathAndQuery ?? string.Empty;
            if (req.Method == HttpMethod.Post && path == "/api/sync/push")
            {
                return Task.FromResult(JsonResponse(new
                {
                    accepted = Array.Empty<string>(),
                    rejected = Array.Empty<object>()
                }));
            }

            if (req.Method == HttpMethod.Get && path.StartsWith("/api/sync/pull", StringComparison.Ordinal))
            {
                pullCount++;
                if (!androidRecordAvailable)
                {
                    return Task.FromResult(JsonResponse(new
                    {
                        serverTime = "2026-11-28T10:00:00.000Z",
                        changes = new
                        {
                            titles = Array.Empty<object>(),
                            logs = Array.Empty<object>()
                        }
                    }));
                }

                secondPullQuery = path;
                return Task.FromResult(JsonResponse(new
                {
                    serverTime = "2026-11-28T10:05:00.000Z",
                    changes = new
                    {
                        titles = new[]
                        {
                            new
                            {
                                id = androidTitleId,
                                type = "movie",
                                name = "Past Lives",
                                year = 2023,
                                provider = "tmdb",
                                providerId = "666277"
                            }
                        },
                        logs = new[]
                        {
                            new
                            {
                                id = androidLogId,
                                titleId = androidTitleId,
                                status = "DONE",
                                rating = 4.5,
                                reaction = "SATISFIED",
                                ott = "넷플릭스",
                                place = "HOME",
                                occasion = "ALONE",
                                note = "안드로이드에서 남긴 기록",
                                spoiler = false,
                                watchedAt = "2026-11-28T12:00:00.000Z",
                                createdAt = "2026-11-28T10:04:00.000Z",
                                updatedAt = "2026-11-28T10:04:00.000Z",
                                revision = 1,
                                origin = "LOG"
                            }
                        }
                    }
                }));
            }

            return Task.FromResult(JsonResponse(new { ok = true }));
        });

        var dbPath = Path.Combine(Path.GetTempPath(), $"ottline_autosync_test_{Guid.NewGuid():N}.db");
        try
        {
            var db = new OttlineDatabase(dbPath);
            db.SaveSettings(db.LoadSettings() with
            {
                BaseUrl = "https://mock.ottline.test",
                UserId = userId,
                DeviceId = deviceId,
                Locale = "ko"
            });

            // Seed existing Windows synced log + mark one-time recovery done
            var winTitle = new TitleSummary(winTitleId, "tmdb", "100", TitleType.movie, "Dune", Year: 2021);
            db.UpsertLog(new WatchLog(
                Id: "55555555-4444-4444-8444-444444444444",
                TitleId: winTitleId,
                Title: winTitle,
                Status: LogStatus.DONE,
                Rating: 4.5,
                Reaction: "SATISFIED",
                Note: "윈도우 기존 기록",
                OccurredAt: "2026-11-27T12:00:00.000Z",
                WatchedOn: "2026-11-27",
                CreatedAt: "2026-11-27T12:00:00.000Z",
                UpdatedAt: "2026-11-27T12:00:00.000Z",
                SyncState: "synced"
            ), recordHistory: true);
            db.SetAppSetting($"sync_push_v2_recovery_done:{userId}", "1");

            using var repo = new OttlineRepository(db, new OttlineApiClient(new HttpClient(handler)));
            var gate = new AutoSyncGate();
            var t0 = new DateTimeOffset(2026, 11, 28, 10, 0, 0, TimeSpan.Zero);

            // Startup sync establishes LastSyncCursor
            var (ok1, _) = await repo.SyncAllAsync();
            Assert.True(ok1);
            gate.MarkCompleted(t0);
            Assert.Equal("2026-11-28T10:00:00.000Z", repo.GetSettings().LastSyncCursor);
            Assert.Single(repo.GetAllLogs());

            // Android saves a new log on server; user navigates to Timeline on Windows after cooldown
            androidRecordAvailable = true;
            var t1 = t0.AddSeconds(5);
            Assert.True(gate.ShouldRun(AutoSyncTrigger.TabNavigation, true, 0, t1));

            var (ok2, _) = await repo.SyncAllAsync();
            Assert.True(ok2);
            gate.MarkCompleted(t1);

            Assert.Equal(2, pullCount);
            Assert.NotNull(secondPullQuery);
            Assert.Contains("since=2026-11-28T10%3A00%3A00.000Z", secondPullQuery);

            var logs = repo.GetAllLogs();
            Assert.Equal(2, logs.Count);
            Assert.Contains(logs, l => l.Id == androidLogId && l.Note == "안드로이드에서 남긴 기록" && l.Title.Title == "Past Lives");
            Assert.Contains(logs, l => l.TitleId == winTitleId && l.Note == "윈도우 기존 기록");
            Assert.NotEmpty(repo.GetHistoryForTitle(winTitleId));
        }
        finally
        {
            CleanupDb(dbPath);
        }
    }

    [Fact]
    public void RecordDate_PickerRoundTrip_HandlesExactDateMonthAndInvalidValues()
    {
        Assert.Equal(new DateTime(2026, 11, 28), RecordDate.ToPickerDate("2026-11-28"));
        Assert.Equal(new DateTime(2026, 11, 1), RecordDate.ToPickerDate("2026-11"));
        Assert.Null(RecordDate.ToPickerDate(""));
        Assert.Null(RecordDate.ToPickerDate("not-a-date"));

        Assert.Equal("2026-11-28", RecordDate.FromPickerDate(new DateTime(2026, 11, 28)));
        var fixedNow = new DateTimeOffset(2026, 11, 28, 9, 0, 0, TimeSpan.Zero);
        Assert.Equal("2026-11-28", RecordDate.FromPickerDate(null, fixedNow));
        Assert.True(RecordDate.IsFutureDateInput("2026-11-29", fixedNow));
        Assert.False(RecordDate.IsFutureDateInput("2026-11-28", fixedNow));
    }

    [Fact]
    public void QuickRecordPlatformSelector_ResolvesNonePresetsAliasesBookDefaultAndCustomInput()
    {
        // Empty -> None (index 0)
        var emptyState = QuickRecordPlatformSelector.Resolve("", isCustomExplicitlySelected: false, isBook: false, locale: "ko");
        Assert.Equal(0, emptyState.SelectedIndex);
        Assert.False(emptyState.ShowCustomInput);
        Assert.Equal("선택 안 함", emptyState.Options[0]);
        Assert.Equal("직접 입력", emptyState.Options[^1]);

        // Video preset exact match & English alias match in Korean locale
        var krNetflix = QuickRecordPlatformSelector.Resolve("넷플릭스", false, isBook: false, locale: "ko");
        var enNetflixAlias = QuickRecordPlatformSelector.Resolve("Netflix", false, isBook: false, locale: "ko");
        Assert.True(krNetflix.SelectedIndex > 0);
        Assert.Equal(krNetflix.SelectedIndex, enNetflixAlias.SelectedIndex);
        Assert.False(enNetflixAlias.ShowCustomInput);
        Assert.Equal("넷플릭스", enNetflixAlias.Options[enNetflixAlias.SelectedIndex]);

        // Book default ("종이책" / "Print book") matches preset cleanly without forcing custom input
        var krBookDefault = QuickRecordPlatformSelector.Resolve("종이책", false, isBook: true, locale: "ko");
        Assert.Equal(1, krBookDefault.SelectedIndex);
        Assert.False(krBookDefault.ShowCustomInput);
        Assert.Equal("종이책", krBookDefault.Options[1]);

        var enBookDefault = QuickRecordPlatformSelector.Resolve("Print book", false, isBook: true, locale: "en");
        Assert.Equal(1, enBookDefault.SelectedIndex);
        Assert.False(enBookDefault.ShowCustomInput);
        Assert.Equal("Print book", enBookDefault.Options[1]);
        Assert.Equal("None", enBookDefault.Options[0]);
        Assert.Equal("Custom input", enBookDefault.Options[^1]);

        // Custom platform string selects Custom input and reveals custom box
        var customState = QuickRecordPlatformSelector.Resolve("사내 상영회", false, isBook: false, locale: "ko");
        Assert.Equal(customState.Options.Length - 1, customState.SelectedIndex);
        Assert.True(customState.ShowCustomInput);

        // Switching from a preset to "직접 입력" clears the preset value; keeping a custom value preserves it
        var customIdx = emptyState.Options.Length - 1;
        var (fromPresetVal, fromPresetCustom) = QuickRecordPlatformSelector.ApplySelectionIndex(customIdx, "넷플릭스", isBook: false, locale: "ko");
        Assert.Equal(string.Empty, fromPresetVal);
        Assert.True(fromPresetCustom);

        var (fromCustomVal, fromCustomFlag) = QuickRecordPlatformSelector.ApplySelectionIndex(customIdx, "사내 상영회", isBook: false, locale: "ko");
        Assert.Equal("사내 상영회", fromCustomVal);
        Assert.True(fromCustomFlag);

        // Selecting index 0 ("선택 안 함") clears custom flag and value
        var (clearedVal, clearedFlag) = QuickRecordPlatformSelector.ApplySelectionIndex(0, "사내 상영회", isBook: false, locale: "ko");
        Assert.Equal(string.Empty, clearedVal);
        Assert.False(clearedFlag);
    }

    [Fact]
    public void OttlineStrings_ProvidesKoAndEnParityForQuickRecordTypeStatusAndCustomPlatform()
    {
        var ko = OttlineStrings.ForLocale("ko");
        var en = OttlineStrings.ForLocale("en");

        Assert.Equal("봤어요", ko.QuickStatusDoneForType(isBook: false));
        Assert.Equal("보는 중", ko.QuickStatusInProgressForType(isBook: false));
        Assert.Equal("보고 싶어요", ko.QuickStatusWishlistForType(isBook: false));
        Assert.Equal("읽었어요", ko.QuickStatusDoneForType(isBook: true));
        Assert.Equal("읽는 중", ko.QuickStatusInProgressForType(isBook: true));
        Assert.Equal("읽고 싶어요", ko.QuickStatusWishlistForType(isBook: true));

        Assert.Equal("Watched", en.QuickStatusDoneForType(isBook: false));
        Assert.Equal("Watching", en.QuickStatusInProgressForType(isBook: false));
        Assert.Equal("Want to watch", en.QuickStatusWishlistForType(isBook: false));
        Assert.Equal("Read", en.QuickStatusDoneForType(isBook: true));
        Assert.Equal("Reading", en.QuickStatusInProgressForType(isBook: true));
        Assert.Equal("Want to read", en.QuickStatusWishlistForType(isBook: true));

        Assert.Equal("선택 안 함", ko.QuickPlatformNoneOption);
        Assert.Equal("직접 입력", ko.QuickPlatformCustomOption);
        Assert.Equal("플랫폼 직접 입력", ko.QuickPlatformCustomPlaceholder);
        Assert.Equal("None", en.QuickPlatformNoneOption);
        Assert.Equal("Custom input", en.QuickPlatformCustomOption);
        Assert.Equal("Enter platform", en.QuickPlatformCustomPlaceholder);
    }
}
