package app.ottline

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.test.core.app.ApplicationProvider
import app.ottline.data.local.AppPreferences
import app.ottline.domain.BookshelfBuilder
import app.ottline.domain.CsvExporter
import app.ottline.domain.PersonalReportBuilder
import app.ottline.domain.RecordDate
import app.ottline.domain.RecordFeelings
import app.ottline.domain.ShareIntentParser
import app.ottline.domain.TimelineMoments
import app.ottline.domain.TitleFallback
import app.ottline.model.BookClassification
import app.ottline.model.DiscussionListItem
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.PersonaKey
import app.ottline.model.Place
import app.ottline.model.Provider
import app.ottline.model.Title
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.LaunchCommand
import app.ottline.ui.OttlineMainViewModel
import app.ottline.ui.QuickRecordStage
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.screens.QuickRecordRequest
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.ConscryptMode

@RunWith(RobolectricTestRunner::class)
@ConscryptMode(ConscryptMode.Mode.OFF)
class OttlineCoreTest {

    private val seoulZone = ZoneId.of("Asia/Seoul")

    @Test
    fun recordDate_preservesOriginalTimestampWhenCalendarDayUnchanged() {
        val original = "2026-11-04T23:41:19+09:00"
        val resolved = RecordDate.resolveWatchedAt(
            selectedDate = "2026-11-04",
            previousIso = original,
            zone = seoulZone
        )
        assertEquals(original, resolved)

        val changed = RecordDate.resolveWatchedAt(
            selectedDate = "2026-11-01",
            previousIso = original,
            zone = seoulZone
        )
        assertTrue(changed.startsWith("2026-11-01T12:00:00"))
    }

    @Test
    fun shareIntentParser_extractsQuotedAndTaggedOttSharesAndBooks() {
        val netflixShare = ShareIntentParser.parse(
            sharedText = "넷플릭스에서 \"흑백요리사: 요리 계급 전쟁\" 감상해보세요 https://www.netflix.com/kr/title/81728365"
        )
        assertNotNull(netflixShare)
        assertEquals("흑백요리사: 요리 계급 전쟁", netflixShare!!.query)
        assertEquals("video", netflixShare.contentType)
        assertEquals("넷플릭스", netflixShare.platform)

        val seasonShare = ShareIntentParser.parse(
            sharedText = "파친코 - 시즌 2 지금 Apple TV에서 보기 https://tv.apple.com/kr/show/pachinko"
        )
        assertNotNull(seasonShare)
        assertEquals("파친코", seasonShare!!.query)
        assertEquals("애플티비", seasonShare.platform)

        val bookShare = ShareIntentParser.parse(
            sharedText = "교보문고에서 『소년이 온다』 저자 한강 도서 보기 https://product.kyobobook.co.kr/detail/S000000610612"
        )
        assertNotNull(bookShare)
        assertEquals("소년이 온다", bookShare!!.query)
        assertEquals("book", bookShare.contentType)

        assertEquals(
            "선재 업고 튀어",
            ShareIntentParser.sanitizeResolvedTitle("선재 업고 튀어 16화 | 티빙")
        )
    }

    @Test
    fun bookshelfBuilder_normalizesIsbn10ToIsbn13AndGroupsKdc() {
        val bookWithIsbn10 = Title(
            id = "b1",
            type = TitleType.BOOK,
            name = "채식주의자",
            isbn10 = "8936433598",
            provider = Provider.KAKAO,
            providerId = "8936433598"
        )
        val normalized = BookshelfBuilder.normalizeBookIsbn13(bookWithIsbn10)
        assertEquals("9788936433598", normalized)

        val logs = listOf(
            WatchLog(
                id = "l1",
                title = bookWithIsbn10,
                status = LogStatus.DONE,
                watchedAt = "2026-11-03T12:00:00+09:00",
                createdAt = "2026-11-03T12:00:00+09:00"
            ),
            WatchLog(
                id = "l2",
                title = Title(id = "b2", type = TitleType.BOOK, name = "미분류 에세이"),
                status = LogStatus.IN_PROGRESS,
                watchedAt = "2026-11-04T12:00:00+09:00",
                createdAt = "2026-11-04T12:00:00+09:00"
            )
        )
        val shelf = BookshelfBuilder.build(
            logs = logs,
            classifications = listOf(
                BookClassification(
                    isbn13 = "9788936433598",
                    status = "RESOLVED",
                    kdcCode = "813.7",
                    kdcMajor = 8,
                    fetchedAt = "2026-11-05T00:00:00Z"
                )
            )
        )
        assertEquals(2, shelf.books.size)
        assertEquals(1, shelf.categoryCount)
        assertEquals(1, shelf.groups[8].books.size)
        assertEquals(1, shelf.unclassifiedBooks.size)
    }

    @Test
    fun personalReportAndMomentsAndCsvSanitization_workAccurately() {
        val logs = listOf(
            WatchLog(
                id = "1",
                title = Title(id = "t1", type = TitleType.MOVIE, name = "패스트 라이브즈", genres = listOf("드라마")),
                status = LogStatus.DONE,
                rating = 5.0,
                note = "=SUM(1,2) 위험한 수식 메모",
                place = Place.THEATER,
                occasion = Occasion.ALONE,
                watchedAt = "2026-11-04T12:00:00+09:00",
                createdAt = "2026-11-04T12:00:00+09:00"
            ),
            WatchLog(
                id = "2",
                title = Title(id = "t2", type = TitleType.BOOK, name = "작별하지 않는다"),
                status = LogStatus.IN_PROGRESS,
                rating = 4.0, // legacy numeric rating preserved
                place = Place.CAFE,
                occasion = Occasion.ALONE,
                watchedAt = "2026-11-05T12:00:00+09:00",
                createdAt = "2026-11-05T12:00:00+09:00"
            )
        )

        val report = PersonalReportBuilder.build(
            logs = logs,
            today = LocalDate.of(2026, 11, 5),
            zone = seoulZone
        )
        assertEquals(2, report.totalLogs)
        assertEquals(2, report.streakDays)
        assertEquals("ALONE", report.topOccasion)

        val featured = TimelineMoments.selectFeaturedMemory(logs)
        assertEquals("1", featured?.id)

        assertFalse(RecordFeelings.isPresetScore(4.0))
        assertEquals("무난해요", RecordFeelings.feelingLabel(4.0, isBook = true, locale = "ko"))
        assertEquals(
            RecordFeelings.FeelingDisplay(value = 5, label = "최고예요"),
            RecordFeelings.resolveFeeling(5.0, isBook = false, locale = "ko")
        )
        assertEquals(
            RecordFeelings.FeelingDisplay(value = 5, label = "Excellent"),
            RecordFeelings.resolveFeeling(5.0, isBook = false, locale = "en")
        )
        assertEquals(
            RecordFeelings.FeelingDisplay(value = 5, label = "인생책"),
            RecordFeelings.resolveFeeling(5.0, isBook = true, locale = "ko")
        )
        assertEquals(
            RecordFeelings.FeelingDisplay(value = 3, label = "Not bad"),
            RecordFeelings.resolveFeeling(4.5, isBook = true, locale = "en")
        )
        assertEquals(
            RecordFeelings.FeelingDisplay(value = 1, label = "아쉬워요"),
            RecordFeelings.resolveFeeling(2.0, isBook = false, locale = "ko")
        )
        assertEquals(null, RecordFeelings.resolveFeeling(0.0, isBook = false, locale = "ko"))
        assertEquals(null, RecordFeelings.resolveFeeling(6.0, isBook = false, locale = "ko"))
        assertEquals(null, RecordFeelings.resolveFeeling(null, isBook = false, locale = "ko"))

        val csv = CsvExporter.buildCsv(logs, "ko")
        assertTrue(csv.startsWith("\uFEFF"))
        assertTrue(csv.contains("'=SUM(1,2) 위험한 수식 메모"))

        assertEquals(
            "채식주의자",
            app.ottline.ui.util.CardExporter.stripBookSubtitle("채식주의자 - 한강 장편소설")
        )
        assertEquals(
            "Dune:\nPart Two",
            app.ottline.ui.util.CardExporter.formatTitleForCard("Dune: Part Two")
        )
        assertEquals(
            "첫 줄\n둘째 줄",
            app.ottline.ui.util.CardExporter.normalizeNote("첫 줄  \n\n  둘째 줄\n셋째 줄", maxLines = 2)
        )
        assertEquals(
            "2026.11.05",
            app.ottline.ui.util.CardExporter.formatShareCardDotDate("2026-11-05T14:20:00Z")
        )
    }

    @Test
    fun watchReminderUsageTracker_requiresFiveMinDeltaAndExcludesBaseline() {
        val now = 1_000_000_000L
        val baseline = WatchReminderUsageTracker.observe(
            previous = null,
            intervalStartAt = now - 3_600_000L,
            totalForegroundMs = 20 * 60_000L,
            lastTimeUsed = now - 60_000L,
            now = now
        )
        // Baseline alone must never fire a notification
        assertFalse(baseline.isCandidate(now))

        val afterThreeMin = WatchReminderUsageTracker.observe(
            previous = baseline,
            intervalStartAt = baseline.intervalStartAt,
            totalForegroundMs = baseline.totalForegroundMs + 3 * 60_000L,
            lastTimeUsed = now + 180_000L,
            now = now + 180_000L
        )
        assertFalse(afterThreeMin.isCandidate(now + 180_000L))

        val afterSixMin = WatchReminderUsageTracker.observe(
            previous = afterThreeMin,
            intervalStartAt = baseline.intervalStartAt,
            totalForegroundMs = baseline.totalForegroundMs + 6 * 60_000L,
            lastTimeUsed = now + 360_000L,
            now = now + 360_000L
        )
        assertTrue(afterSixMin.isCandidate(now + 360_000L))
        assertFalse(afterSixMin.consume().isCandidate(now + 360_000L))
    }

    @Test
    fun watchReminderEventAnalyzer_holdsWhileWatchingAndFiresAfterExitWithoutDuplicate() {
        val base = 2_000_000_000L
        val netflixPkg = "com.netflix.mediaclient"
        val launcherPkg = "com.sec.android.app.launcher"

        // 1. User is 10 minutes into watching Netflix right now -> must HOLD (activePackages contains Netflix)
        val whileWatching = WatchReminderEventAnalyzer.analyze(
            events = listOf(
                WatchReminderEventAnalyzer.RawUsageEvent(
                    packageName = netflixPkg,
                    eventType = WatchReminderEventAnalyzer.EVENT_RESUMED,
                    timestamp = base + 60_000L
                )
            ),
            baselineAfterMs = base,
            lastNotifiedEndByPkg = emptyMap(),
            now = base + 11 * 60_000L
        )
        assertTrue(netflixPkg in whileWatching.activePackages)
        assertTrue(whileWatching.completedCandidates.isEmpty())
        assertTrue(whileWatching.hadRecentOttActivity)

        // 2. User exits Netflix to Home screen after 12 minutes -> candidate becomes ready!
        val exitTime = base + 13 * 60_000L
        val afterExitEvents = listOf(
            WatchReminderEventAnalyzer.RawUsageEvent(
                packageName = netflixPkg,
                eventType = WatchReminderEventAnalyzer.EVENT_RESUMED,
                timestamp = base + 60_000L
            ),
            WatchReminderEventAnalyzer.RawUsageEvent(
                packageName = netflixPkg,
                eventType = WatchReminderEventAnalyzer.EVENT_PAUSED,
                timestamp = exitTime
            ),
            WatchReminderEventAnalyzer.RawUsageEvent(
                packageName = launcherPkg,
                eventType = WatchReminderEventAnalyzer.EVENT_RESUMED,
                timestamp = exitTime + 500L
            )
        )
        val afterExit = WatchReminderEventAnalyzer.analyze(
            events = afterExitEvents,
            baselineAfterMs = base,
            lastNotifiedEndByPkg = emptyMap(),
            now = exitTime + 60_000L
        )
        assertTrue(afterExit.activePackages.isEmpty())
        assertEquals(12 * 60_000L, afterExit.completedCandidates[netflixPkg]?.totalDurationMs)

        // 3. Once notified for exitTime, the same session is never notified again
        val afterNotified = WatchReminderEventAnalyzer.analyze(
            events = afterExitEvents,
            baselineAfterMs = base,
            lastNotifiedEndByPkg = mapOf(netflixPkg to exitTime),
            now = exitTime + 5 * 60_000L
        )
        assertTrue(afterNotified.completedCandidates.isEmpty())
    }

    @Test
    fun launcherDeepLinks_routeAllWebAndShortcutUrls() {
        val quickBook = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/?quick=1&quick_type=book&quick_focus=1")
        ) as? LaunchCommand.OpenQuickRecord
        assertNotNull(quickBook)
        assertEquals("book", quickBook!!.typeTab)

        val quickContinue = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/?quick=1&title_id=series-99")
        ) as? LaunchCommand.OpenQuickRecord
        assertNotNull(quickContinue)
        assertEquals("series-99", quickContinue!!.titleId)

        val koTitle = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/ko/title/abc-123")
        ) as? LaunchCommand.OpenRoute
        assertEquals("title/abc-123", koTitle?.route)

        val reportLink = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/en/me/report")
        ) as? LaunchCommand.OpenRoute
        assertEquals("report", reportLink?.route)

        val bookshelfLink = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/ko/me/bookshelf")
        ) as? LaunchCommand.OpenRoute
        assertEquals("bookshelf", bookshelfLink?.route)

        val timelineFiltered = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/timeline?place=CAFE&occasion=ALONE&type=book&status=DONE&q=%EC%97%AC%EB%A6%84")
        ) as? LaunchCommand.OpenTimeline
        assertNotNull(timelineFiltered)
        assertEquals("book", timelineFiltered!!.contentType)
        assertEquals("DONE", timelineFiltered.status)
        assertEquals(Place.CAFE, timelineFiltered.place)
        assertEquals(Occasion.ALONE, timelineFiltered.occasion)
        assertEquals("여름", timelineFiltered.query)

        val publicDiscussion = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/public/disc-42")
        ) as? LaunchCommand.OpenRoute
        assertEquals("discussion/disc-42", publicDiscussion?.route)

        val legacyDiscussion = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/discussions/disc-77")
        ) as? LaunchCommand.OpenRoute
        assertEquals("discussion/disc-77", legacyDiscussion?.route)

        val guideSlug = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/guide/offline-sync")
        ) as? LaunchCommand.OpenRoute
        assertEquals("guides", guideSlug?.route)

        val rootHome = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/")
        ) as? LaunchCommand.OpenRoute
        assertEquals("home", rootHome?.route)

        val unsupportedWebPath = LauncherActivity.parseDeepLinkUri(
            Uri.parse("https://ottline.app/admin/metrics")
        ) as? LaunchCommand.OpenExternalBrowser
        assertEquals("https://ottline.app/admin/metrics", unsupportedWebPath?.url)

        val watchReminderLink = LauncherActivity.parseDeepLinkUri(
            Uri.parse("ottline://watch-reminder")
        ) as? LaunchCommand.OpenRoute
        assertEquals("watch_reminder", watchReminderLink?.route)

        val handoffLink = LauncherActivity.parseDeepLinkUri(
            Uri.parse("ottline://open?handoff=1&status=ok&user_id=u-123&device_id=d-456&pairing_code=OTTL-9999&nickname=%EC%9D%80%ED%95%98%EC%88%98&persona_key=cinema_keeper")
        ) as? LaunchCommand.CompleteTwaHandoff
        assertNotNull(handoffLink)
        assertEquals("ok", handoffLink!!.status)
        assertEquals("u-123", handoffLink.userId)
        assertEquals("d-456", handoffLink.deviceId)
        assertEquals("OTTL-9999", handoffLink.pairingCode)
        assertEquals("은하수", handoffLink.nickname)
        assertEquals(PersonaKey.CINEMA_KEEPER, handoffLink.personaKey)

        assertTrue(
            app.ottline.data.local.AndroidInstallToken.isLegacyTwaTokenFormat(
                "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v"
            )
        )
        assertFalse(
            app.ottline.data.local.AndroidInstallToken.isLegacyTwaTokenFormat(
                "30000000-0000-4000-8000-000000000031"
            )
        )

        assertNull(LauncherActivity.parseDeepLinkUri(Uri.parse("ottline://unknown-target")))
    }

    @Test
    fun mainViewModel_persistsQuickRecordDraftAndTimelineFiltersAcrossProcessRecreation() {
        val originalHandle = SavedStateHandle()
        val vm1 = OttlineMainViewModel(originalHandle)

        val sampleTitle = Title(
            id = "t-saved-1",
            type = TitleType.BOOK,
            name = "소년이 온다",
            author = "한강",
            provider = Provider.KAKAO,
            providerId = "9788936434120"
        )
        val createdLog = WatchLog(
            id = "log-created-1",
            title = sampleTitle,
            status = LogStatus.DONE,
            watchedAt = "2026-11-05T12:00:00+09:00",
            createdAt = "2026-11-05T12:00:00+09:00"
        )

        vm1.openQuickRecord(QuickRecordRequest(initialTypeTab = "book"))
        vm1.updateQuickRecordDraft { draft ->
            draft.copy(
                stage = QuickRecordStage.EDIT,
                selectedTitle = sampleTitle,
                savedLog = createdLog,
                chosenStatus = LogStatus.DONE,
                selectedPlace = Place.CAFE,
                selectedOccasion = Occasion.ALONE,
                feelingScore = 5.0,
                noteText = "회전과 프로세스 재생성 후에도 남아있는 문장",
                spoiler = true
            )
        }
        vm1.applyDeepLinkTimelineFilter(
            contentType = "book",
            status = "DONE",
            place = Place.CAFE,
            occasion = Occasion.ALONE,
            query = "소년"
        )
        vm1.setHomeSelectedMonth("2026-07")

        // Simulate full Android process death + SavedStateHandle bundle restoration
        val serializedState = mapOf<String, Any?>(
            OttlineMainViewModel.KEY_QUICK_RECORD_JSON to originalHandle.get<String>(OttlineMainViewModel.KEY_QUICK_RECORD_JSON),
            OttlineMainViewModel.KEY_TIMELINE_FILTER_JSON to originalHandle.get<String>(OttlineMainViewModel.KEY_TIMELINE_FILTER_JSON),
            OttlineMainViewModel.KEY_HOME_MONTH to originalHandle.get<String>(OttlineMainViewModel.KEY_HOME_MONTH)
        )
        val restoredVm = OttlineMainViewModel(SavedStateHandle(serializedState))

        val restoredDraft = restoredVm.quickRecordDraft.value
        assertNotNull(restoredDraft)
        assertEquals(QuickRecordStage.EDIT, restoredDraft!!.stage)
        assertEquals("t-saved-1", restoredDraft.selectedTitle?.id)
        assertEquals("log-created-1", restoredDraft.savedLog?.id)
        assertEquals(Place.CAFE, restoredDraft.selectedPlace)
        assertEquals(Occasion.ALONE, restoredDraft.selectedOccasion)
        assertEquals("회전과 프로세스 재생성 후에도 남아있는 문장", restoredDraft.noteText)
        assertTrue(restoredDraft.spoiler)

        val restoredFilter = restoredVm.timelineFilter.value
        assertEquals("BOOK", restoredFilter.typeFilter)
        assertEquals("DONE", restoredFilter.statusFilter)
        assertEquals(Place.CAFE, restoredFilter.placeFilter)
        assertEquals(Occasion.ALONE, restoredFilter.occasionFilter)
        assertEquals("소년", restoredFilter.query)
        assertEquals("2026-07", restoredVm.homeSelectedMonth.value)
    }

    @Test
    fun personalReportBuilder_gatesH1RecapToJulyAndPrioritizesSeasonPoster() {
        assertFalse(PersonalReportBuilder.isH1RecapVisible(LocalDate.of(2026, 6, 30)))
        assertTrue(PersonalReportBuilder.isH1RecapVisible(LocalDate.of(2026, 7, 1)))
        assertTrue(PersonalReportBuilder.isH1RecapVisible(LocalDate.of(2026, 7, 31)))
        assertFalse(PersonalReportBuilder.isH1RecapVisible(LocalDate.of(2026, 8, 1)))

        val logs = listOf(
            WatchLog(
                id = "h1-book-posterless",
                title = Title(id = "t-no-poster", type = TitleType.BOOK, name = "표지 없는 책", posterUrl = null),
                status = LogStatus.DONE,
                rating = 5.0,
                watchedAt = "2026-07-08T12:00:00+09:00",
                createdAt = "2026-07-08T12:00:00+09:00"
            ),
            WatchLog(
                id = "h1-series-season-poster",
                title = Title(
                    id = "t-series",
                    type = TitleType.SERIES,
                    name = "파친코",
                    posterUrl = "https://img.example/default-series.jpg"
                ),
                status = LogStatus.DONE,
                rating = 4.5,
                seasonNumber = 2,
                seasonPosterUrl = "https://img.example/pachinko-s2.jpg",
                watchedAt = "2026-06-20T12:00:00+09:00",
                createdAt = "2026-06-20T12:00:00+09:00"
            ),
            WatchLog(
                id = "prev-week-series",
                title = Title(
                    id = "t-prev-series",
                    type = TitleType.SERIES,
                    name = "더 베어",
                    posterUrl = "https://img.example/bear-default.jpg"
                ),
                status = LogStatus.IN_PROGRESS,
                rating = 4.0,
                seasonNumber = 3,
                seasonPosterUrl = "https://img.example/bear-s3.jpg",
                watchedAt = "2026-07-09T12:00:00+09:00",
                createdAt = "2026-07-09T12:00:00+09:00"
            )
        )

        // 2026-07-15 (Wednesday): previous week is 2026-07-06..2026-07-12, inside July H1 window
        val julyReport = PersonalReportBuilder.build(
            logs = logs,
            today = LocalDate.of(2026, 7, 15),
            zone = seoulZone
        )
        assertNotNull(julyReport.seasonalRecap)
        assertEquals(1, julyReport.seasonalRecap?.totalLogs)
        assertEquals("https://img.example/pachinko-s2.jpg", julyReport.seasonalRecap?.posters?.firstOrNull()?.posterUrl)

        val prevWeekPosters = julyReport.previousWeekPosters.orEmpty()
        assertEquals(2, prevWeekPosters.size)
        // Poster-bearing title must rank ahead of posterless title, and use seasonPosterUrl
        assertEquals("t-prev-series", prevWeekPosters[0].titleId)
        assertEquals("https://img.example/bear-s3.jpg", prevWeekPosters[0].posterUrl)
        assertEquals("t-no-poster", prevWeekPosters[1].titleId)

        // Outside July window (November): H1 seasonalRecap must be hidden
        val novReport = PersonalReportBuilder.build(
            logs = logs,
            today = LocalDate.of(2026, 11, 5),
            zone = seoulZone
        )
        assertNull(novReport.seasonalRecap)
    }

    @Test
    fun quickLogWidget_selectsResponsiveLayoutForGridSizes() {
        assertEquals(
            QuickLogWidgetProvider.LayoutVariant.RIBBON,
            QuickLogWidgetProvider.selectVariantForSize(widthDp = 154, heightDp = 88)
        )
        assertEquals(
            QuickLogWidgetProvider.LayoutVariant.RIBBON,
            QuickLogWidgetProvider.selectVariantForSize(widthDp = 315, heightDp = 88)
        )
        assertEquals(
            QuickLogWidgetProvider.LayoutVariant.COMPACT,
            QuickLogWidgetProvider.selectVariantForSize(widthDp = 154, heightDp = 176)
        )
        assertEquals(
            QuickLogWidgetProvider.LayoutVariant.MEDIUM,
            QuickLogWidgetProvider.selectVariantForSize(widthDp = 315, heightDp = 176)
        )
        assertEquals(
            QuickLogWidgetProvider.LayoutVariant.EXPANDED,
            QuickLogWidgetProvider.selectVariantForSize(widthDp = 315, heightDp = 355)
        )
    }

    @Test
    fun homeV2DateFormattersAndPopularFillersAndActivationFlow_matchWebParity() {
        val sampleDay = LocalDate.of(2026, 11, 7) // Saturday
        assertEquals(
            "11월 7일 토요일",
            RecordDate.formatHomeToday(locale = "ko", zone = seoulZone, today = sampleDay)
        )
        assertEquals(
            "Sat, Nov 7",
            RecordDate.formatHomeToday(locale = "en", zone = seoulZone, today = sampleDay)
        )

        val iso = "2026-11-07T20:15:00+09:00"
        assertEquals("11월 7일 (토)", RecordDate.formatFeaturedDate(iso, "ko", seoulZone))
        assertEquals("Sat, November 7", RecordDate.formatFeaturedDate(iso, "en", seoulZone))
        assertEquals("11월 7일", RecordDate.formatShortMonthDay(iso, "ko", seoulZone))
        assertEquals("Nov 7", RecordDate.formatShortMonthDay(iso, "en", seoulZone))
        assertEquals("2026", RecordDate.formatMonthYearPart("2026-11"))
        assertEquals("11월", RecordDate.formatMonthShortPart("2026-11", "ko"))
        assertEquals("Nov", RecordDate.formatMonthShortPart("2026-11", "en"))

        // `/titles/popular` omits `id` and returns `TitleSearchItem[]`
        val rawPopularJson = """
            [
              {"provider":"TMDB","providerId":"1184918","titleId":null,"type":"movie","name":"와일드 로봇","year":2024,"posterUrl":"https://image.tmdb.org/t/p/w500/wild.jpg"},
              {"provider":"TMDB","providerId":"245927","titleId":null,"type":"series","name":"정년이","year":2024,"posterUrl":"https://image.tmdb.org/t/p/w500/jung.jpg"},
              {"provider":"TMDB","providerId":"999999","titleId":null,"type":"movie","name":"패스트 라이브즈","year":2023,"posterUrl":null}
            ]
        """.trimIndent()
        val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
        val popularItems = json.decodeFromString<List<TitleSearchItem>>(rawPopularJson)
        assertEquals(3, popularItems.size)
        assertEquals("와일드 로봇", popularItems[0].name)

        // Deduplicates both by providerId and by normalized (type, name, year)
        val existingDiscussions = listOf(
            DiscussionListItem(
                id = "d1",
                titleId = "t1",
                titleProvider = Provider.TMDB,
                titleProviderId = "1184918",
                titleName = "와일드 로봇",
                titleType = TitleType.MOVIE,
                titleYear = 2024
            ),
            DiscussionListItem(
                id = "d2",
                titleId = "t2",
                titleProvider = Provider.LOCAL,
                titleProviderId = "loc-1",
                titleName = "패스트 라이브즈",
                titleType = TitleType.MOVIE,
                titleYear = 2023
            )
        )
        val fillers = TitleFallback.selectPopularTitleFillers(existingDiscussions, popularItems, limit = 6)
        assertEquals(1, fillers.size)
        assertEquals("정년이", fillers.single().name)

        // Default storybook avatar when personaKey is null
        assertEquals(R.drawable.avatar_cinema_keeper, OttlineStrings.personaAvatarRes(null))

        // QuickRecord activation flows: poster select -> STATUS stage; book status select -> SEARCH stage with preferredStatus
        val vm = OttlineMainViewModel(SavedStateHandle())
        vm.openQuickRecord(
            QuickRecordRequest(
                preselectedSearchItem = fillers.single(),
                selectSource = "activation_popular_title",
                autoFocusSearch = false
            )
        )
        assertEquals(QuickRecordStage.STATUS, vm.quickRecordDraft.value?.stage)
        assertEquals("정년이", vm.quickRecordDraft.value?.selectedTitle?.name)
        assertFalse(vm.quickRecordDraft.value?.lockedPreselectedTitle ?: true)

        vm.openQuickRecord(
            QuickRecordRequest(
                initialTypeTab = "book",
                preferredStatus = LogStatus.IN_PROGRESS,
                autoFocusSearch = true
            )
        )
        assertEquals(QuickRecordStage.SEARCH, vm.quickRecordDraft.value?.stage)
        assertEquals("book", vm.quickRecordDraft.value?.searchTab)
        assertEquals(LogStatus.IN_PROGRESS, vm.quickRecordDraft.value?.preferredStatus)

        // Account deletion / local reset clears personaKey and nickname back to null
        val prefs = AppPreferences(ApplicationProvider.getApplicationContext())
        prefs.saveAuth("user-1", "dev-1", "PAIR-1234")
        prefs.saveProfile("밤의기록가", PersonaKey.BOOK_DRIFTER)
        assertEquals(PersonaKey.BOOK_DRIFTER, prefs.current.personaKey)
        prefs.clearAuthAndSyncState()
        assertNull(prefs.current.userId)
        assertNull(prefs.current.nickname)
        assertNull(prefs.current.personaKey)
    }
}
