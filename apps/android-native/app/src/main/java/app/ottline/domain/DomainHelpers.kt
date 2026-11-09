package app.ottline.domain

import app.ottline.model.BookClassification
import app.ottline.model.DiscussionListItem
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.PersonalReport
import app.ottline.model.Place
import app.ottline.model.Provider
import app.ottline.model.SeasonalRecap
import app.ottline.model.SeasonalRecapPoster
import app.ottline.model.Title
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import java.net.URI
import java.net.URLDecoder
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.roundToInt

/**
 * Calendar-only date handling (faithful port of `apps/web/lib/recordDate.ts`).
 * - Never exposes time-of-day in UI.
 * - Preserves original ISO timestamp & timezone offset when calendar date is unchanged.
 */
object RecordDate {
    private val DATE_FMT: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    fun nowIso(zone: ZoneId = ZoneId.systemDefault()): String =
        OffsetDateTime.now(zone).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

    fun todayInputDate(zone: ZoneId = ZoneId.systemDefault()): String =
        LocalDate.now(zone).format(DATE_FMT)

    fun recordDateInput(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String {
        if (iso.isNullOrBlank()) return todayInputDate(zone)
        return parseToLocalDate(iso, zone)?.format(DATE_FMT) ?: todayInputDate(zone)
    }

    fun formatDisplayDate(iso: String?, locale: String, zone: ZoneId = ZoneId.systemDefault()): String {
        val ld = iso?.let { parseToLocalDate(it, zone) } ?: return ""
        return if (locale == "en") {
            ld.format(DateTimeFormatter.ofPattern("MMM d, yyyy", java.util.Locale.ENGLISH))
        } else {
            "${ld.year}년 ${ld.monthValue}월 ${ld.dayOfMonth}일"
        }
    }

    /**
     * Matches `HomeTimelineView.tsx` `today`:
     * - ko: `"11월 7일 토요일"` (`month: "long", day: "numeric", weekday: "long"`)
     * - en: `"Sat, Nov 7"` (`month: "short", day: "numeric", weekday: "short"`)
     */
    fun formatHomeToday(
        locale: String,
        zone: ZoneId = ZoneId.systemDefault(),
        today: LocalDate = LocalDate.now(zone)
    ): String {
        return if (locale == "en") {
            today.format(DateTimeFormatter.ofPattern("EEE, MMM d", java.util.Locale.ENGLISH))
        } else {
            today.format(DateTimeFormatter.ofPattern("M월 d일 EEEE", java.util.Locale.KOREAN))
        }
    }

    /**
     * Matches `HomeTimelineView.tsx` `featuredDate`:
     * - ko: `"11월 7일 (토)"`
     * - en: `"Sat, November 7"`
     */
    fun formatFeaturedDate(iso: String?, locale: String, zone: ZoneId = ZoneId.systemDefault()): String {
        val ld = iso?.let { parseToLocalDate(it, zone) } ?: return ""
        return if (locale == "en") {
            ld.format(DateTimeFormatter.ofPattern("EEE, MMMM d", java.util.Locale.ENGLISH))
        } else {
            ld.format(DateTimeFormatter.ofPattern("M월 d일 (E)", java.util.Locale.KOREAN))
        }
    }

    /**
     * Matches `HomeTimelineView.tsx` month entries & `DiscussionList.tsx` `formatShortDate`:
     * - ko: `"11월 7일"`
     * - en: `"Nov 7"`
     */
    fun formatShortMonthDay(iso: String?, locale: String, zone: ZoneId = ZoneId.systemDefault()): String {
        val ld = iso?.let { parseToLocalDate(it, zone) } ?: return ""
        return if (locale == "en") {
            ld.format(DateTimeFormatter.ofPattern("MMM d", java.util.Locale.ENGLISH))
        } else {
            "${ld.monthValue}월 ${ld.dayOfMonth}일"
        }
    }

    fun monthKey(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String {
        val ld = iso?.let { parseToLocalDate(it, zone) } ?: LocalDate.now(zone)
        return "%04d-%02d".format(ld.year, ld.monthValue)
    }

    fun formatMonthLabel(monthKey: String, locale: String): String {
        val parts = monthKey.split("-")
        if (parts.size != 2) return monthKey
        val year = parts[0].toIntOrNull() ?: return monthKey
        val month = parts[1].toIntOrNull() ?: return monthKey
        return if (locale == "en") {
            LocalDate.of(year, month, 1).format(DateTimeFormatter.ofPattern("MMM yyyy", java.util.Locale.ENGLISH))
        } else {
            "${year}년 ${month}월"
        }
    }

    fun formatMonthYearPart(monthKey: String): String {
        if (monthKey == "undated" || monthKey.length < 4) return ""
        return monthKey.take(4)
    }

    fun formatMonthShortPart(monthKey: String, locale: String): String {
        val parts = monthKey.split("-")
        if (parts.size != 2) return monthKey
        val year = parts[0].toIntOrNull() ?: return monthKey
        val month = parts[1].toIntOrNull() ?: return monthKey
        return if (locale == "en") {
            LocalDate.of(year, month, 1).format(DateTimeFormatter.ofPattern("MMM", java.util.Locale.ENGLISH))
        } else {
            "${month}월"
        }
    }

    fun resolveWatchedAt(
        selectedDate: String?,
        previousIso: String? = null,
        zone: ZoneId = ZoneId.systemDefault()
    ): String {
        val trimmed = selectedDate?.trim().orEmpty()
        if (trimmed.isEmpty()) {
            return previousIso?.takeIf { it.isNotBlank() } ?: nowIso(zone)
        }
        val targetDate = runCatching { LocalDate.parse(trimmed, DATE_FMT) }.getOrNull()
            ?: return previousIso?.takeIf { it.isNotBlank() } ?: nowIso(zone)

        if (!previousIso.isNullOrBlank()) {
            val prevDate = parseToLocalDate(previousIso, zone)
            if (prevDate == targetDate) {
                return previousIso
            }
        }

        val zdt = ZonedDateTime.of(targetDate.atTime(12, 0), zone)
        return zdt.toOffsetDateTime().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
    }

    fun parseInstantMillis(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        runCatching { return Instant.parse(iso).toEpochMilli() }
        runCatching { return OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
        runCatching {
            val ld = LocalDate.parse(iso.take(10), DATE_FMT)
            return ld.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        }
        return 0L
    }

    fun parseToLocalDate(iso: String, zone: ZoneId = ZoneId.systemDefault()): LocalDate? {
        runCatching { return OffsetDateTime.parse(iso).atZoneSameInstant(zone).toLocalDate() }
        runCatching { return Instant.parse(iso).atZone(zone).toLocalDate() }
        runCatching { return LocalDate.parse(iso.take(10), DATE_FMT) }
        return null
    }
}

/**
 * Qualitative feeling mapping (`ratingDisplay` in `apps/web/lib/utils.ts` + `RecordParts.tsx` parity).
 * - Valid ratings are finite numbers in `(0.0, 5.0]`.
 * - Buckets: `>= 5` -> `5`, `>= 3` -> `3`, `< 3` -> `1` (legacy 2 / 4 / 4.5 select a display bucket while keeping their saved numeric score until edited).
 */
object RecordFeelings {
    data class FeelingDisplay(
        val value: Int,
        val label: String
    )

    val PRESET_SCORES = listOf(5.0, 3.0, 1.0)

    fun isPresetScore(rating: Double?): Boolean =
        rating != null && PRESET_SCORES.any { kotlin.math.abs(it - rating) < 0.01 }

    fun resolveFeeling(rating: Double?, isBook: Boolean, locale: String): FeelingDisplay? {
        if (rating == null || !rating.isFinite() || rating <= 0.0 || rating > 5.0) return null
        val bucket = when {
            rating >= 4.99 -> 5
            rating >= 2.99 -> 3
            else -> 1
        }
        val label = when (bucket) {
            5 -> if (isBook) {
                if (locale == "en") "Life-changing" else "인생책"
            } else {
                if (locale == "en") "Excellent" else "최고예요"
            }
            3 -> if (isBook) {
                if (locale == "en") "Not bad" else "무난해요"
            } else {
                if (locale == "en") "Worth watching" else "볼만해요"
            }
            else -> if (locale == "en") "Disappointing" else "아쉬워요"
        }
        return FeelingDisplay(value = bucket, label = label)
    }

    fun feelingLabel(rating: Double?, isBook: Boolean, locale: String): String? =
        resolveFeeling(rating, isBook, locale)?.label
}

/**
 * Home & Timeline moment summaries (faithful port of `timelineMoments.ts`).
 */
object TimelineMoments {
    data class MomentChip<T>(val value: T, val count: Int)

    fun selectFeaturedMemory(logs: List<WatchLog>): WatchLog? {
        if (logs.isEmpty()) return null
        return logs.maxWithOrNull(
            compareBy<WatchLog> { scoreMemoryRichness(it) }
                .thenBy { RecordDate.parseInstantMillis(it.watchedAt) }
        )
    }

    private fun scoreMemoryRichness(log: WatchLog): Int {
        var score = 0
        if (!log.note.isNullOrBlank()) score += 4
        if (log.place != null) score += 2
        if (log.occasion != null) score += 2
        if (log.rating != null) score += 1
        if (!log.title.posterUrl.isNullOrBlank() || !log.seasonPosterUrl.isNullOrBlank()) score += 1
        return score
    }

    fun frequentPlaces(logs: List<WatchLog>, limit: Int = 3): List<MomentChip<Place>> {
        return logs.asSequence()
            .filter { it.status != LogStatus.WISHLIST }
            .mapNotNull { it.place }
            .groupingBy { it }
            .eachCount()
            .entries
            .sortedWith(compareByDescending<Map.Entry<Place, Int>> { it.value }.thenBy { it.key.name })
            .take(limit)
            .map { MomentChip(it.key, it.value) }
    }

    fun frequentOccasions(logs: List<WatchLog>, limit: Int = 3): List<MomentChip<Occasion>> {
        return logs.asSequence()
            .filter { it.status != LogStatus.WISHLIST }
            .mapNotNull { it.occasion }
            .groupingBy { it }
            .eachCount()
            .entries
            .sortedWith(compareByDescending<Map.Entry<Occasion, Int>> { it.value }.thenBy { it.key.name })
            .take(limit)
            .map { MomentChip(it.key, it.value) }
    }

    fun availableMonths(logs: List<WatchLog>, zone: ZoneId = ZoneId.systemDefault()): List<String> {
        val keys = logs.map { RecordDate.monthKey(it.watchedAt, zone) }.toSortedSet(compareByDescending { it })
        if (keys.isEmpty()) {
            return listOf(RecordDate.monthKey(null, zone))
        }
        return keys.toList()
    }
}

/**
 * Bookshelf & ISBN-13 normalization + KDC 000..900 grouping (faithful port of `bookshelf.ts`).
 */
object BookshelfBuilder {
    data class BookshelfBook(
        val key: String,
        val title: Title,
        val status: LogStatus,
        val loggedAt: String,
        val isbn13: String?,
        val classification: BookClassification?
    )

    data class BookshelfGroup(
        val major: Int,
        val code: String,
        val books: List<BookshelfBook>
    )

    data class Bookshelf(
        val books: List<BookshelfBook>,
        val groups: List<BookshelfGroup>,
        val recentBooks: List<BookshelfBook>,
        val unclassifiedBooks: List<BookshelfBook>,
        val categoryCount: Int
    )

    private fun isbn13CheckDigit(firstTwelveDigits: String): Char {
        var sum = 0
        for (i in 0 until 12) {
            val digit = firstTwelveDigits[i].digitToInt()
            sum += digit * if (i % 2 == 0) 1 else 3
        }
        return ('0'.code + ((10 - (sum % 10)) % 10)).toChar()
    }

    fun isValidIsbn13(value: String): Boolean {
        if (value.length != 13 || !value.all { it.isDigit() }) return false
        return isbn13CheckDigit(value.substring(0, 12)) == value[12]
    }

    fun isValidIsbn10(value: String): Boolean {
        if (!Regex("""^\d{9}[\dX]$""").matches(value)) return false
        var sum = 0
        for (i in 0 until 10) {
            val digit = if (value[i] == 'X') 10 else value[i].digitToInt()
            sum += digit * (10 - i)
        }
        return sum % 11 == 0
    }

    fun normalizeBookIsbn13(title: Title): String? {
        val providerIsbn = if (title.provider == Provider.NAVER || title.provider == Provider.KAKAO) {
            title.providerId.orEmpty()
        } else {
            ""
        }
        val raw13 = listOf(title.isbn13.orEmpty(), providerIsbn)
            .map { it.replace(Regex("""\D"""), "") }
            .firstOrNull { isValidIsbn13(it) }
        if (raw13 != null) return raw13

        val raw10 = listOf(title.isbn10.orEmpty(), providerIsbn)
            .map { it.uppercase().replace(Regex("""[^0-9X]"""), "") }
            .firstOrNull { isValidIsbn10(it) }
            ?: return null

        val firstTwelve = "978${raw10.substring(0, 9)}"
        return "$firstTwelve${isbn13CheckDigit(firstTwelve)}"
    }

    private fun bookIdentity(title: Title, isbn13: String?): String = when {
        !isbn13.isNullOrBlank() -> "isbn:$isbn13"
        title.provider != null && !title.providerId.isNullOrBlank() -> "provider:${title.provider}:${title.providerId}"
        else -> "title:${title.id}"
    }

    fun build(logs: List<WatchLog>, classifications: Collection<BookClassification> = emptyList()): Bookshelf {
        val byIsbn = classifications.associateBy { it.isbn13 }
        val unique = linkedMapOf<String, BookshelfBook>()

        for (log in logs) {
            if (log.deletedAt != null || log.title.type != TitleType.BOOK) continue
            val isbn13 = normalizeBookIsbn13(log.title)
            val key = bookIdentity(log.title, isbn13)
            val loggedAt = log.updatedAt ?: log.watchedAt
            val candidate = BookshelfBook(
                key = key,
                title = log.title,
                status = log.status,
                loggedAt = loggedAt,
                isbn13 = isbn13,
                classification = isbn13?.let { byIsbn[it] }
            )
            val existing = unique[key]
            if (existing == null || RecordDate.parseInstantMillis(candidate.loggedAt) > RecordDate.parseInstantMillis(existing.loggedAt)) {
                unique[key] = candidate
            }
        }

        val books = unique.values.sortedByDescending { RecordDate.parseInstantMillis(it.loggedAt) }
        val groups = (0..9).map { major ->
            BookshelfGroup(
                major = major,
                code = "${major}00",
                books = books.filter {
                    it.classification?.status == "RESOLVED" && it.classification.kdcMajor == major
                }
            )
        }
        val unclassified = books.filter {
            it.classification?.status != "RESOLVED" || it.classification.kdcMajor == null
        }

        return Bookshelf(
            books = books,
            groups = groups,
            recentBooks = books.take(8),
            unclassifiedBooks = unclassified,
            categoryCount = groups.count { it.books.isNotEmpty() }
        )
    }
}

/**
 * Local fallback & instant Personal Report builder (faithful port of `report.ts`).
 */
object PersonalReportBuilder {
    fun isH1RecapVisible(now: Instant): Boolean {
        val start = OffsetDateTime.parse("2026-07-01T00:00:00+09:00").toInstant()
        val end = OffsetDateTime.parse("2026-08-01T00:00:00+09:00").toInstant()
        return !now.isBefore(start) && now.isBefore(end)
    }

    private fun pct(num: Int, den: Int): Double {
        if (den <= 0) return 0.0
        return ((num.toDouble() / den.toDouble()) * 1000.0).roundToInt() / 10.0
    }

    private fun maxEntry(counts: Map<String, Int>): String =
        counts.maxByOrNull { it.value }?.key ?: "-"

    fun build(
        logs: List<WatchLog>,
        today: LocalDate = LocalDate.now(),
        zone: ZoneId = ZoneId.systemDefault()
    ): PersonalReport {
        val active = logs.filter { it.deletedAt == null }
        if (active.isEmpty()) return PersonalReport()

        val total = active.size
        val thisMonthCount = active.count {
            val d = RecordDate.parseToLocalDate(it.watchedAt, zone)
            d != null && d.year == today.year && d.monthValue == today.monthValue
        }
        val doneCount = active.count { it.status == LogStatus.DONE }
        val ratedCount = active.count { it.rating != null }
        val notedCount = active.count { !it.note.isNullOrBlank() }

        val topType = maxEntry(active.groupingBy { it.title.type.wireValue }.eachCount())
        val topPlace = maxEntry(active.mapNotNull { it.place?.name }.groupingBy { it }.eachCount())
        val topOccasion = maxEntry(active.mapNotNull { it.occasion?.name }.groupingBy { it }.eachCount())

        val genreCounts = mutableMapOf<String, Int>()
        active.filter {
            val d = RecordDate.parseToLocalDate(it.watchedAt, zone)
            d != null && d.year == today.year && d.monthValue == today.monthValue
        }.forEach { log ->
            log.title.genres?.forEach { g ->
                if (g.isNotBlank()) genreCounts[g] = (genreCounts[g] ?: 0) + 1
            }
        }
        val monthlyTopGenreEntry = genreCounts.maxByOrNull { it.value }

        val uniqueDates = active.mapNotNull { RecordDate.parseToLocalDate(it.watchedAt, zone) }
            .toSortedSet()
            .toList()

        var longestStreak = 0
        var runStreak = 0
        var prevDate: LocalDate? = null
        for (d in uniqueDates) {
            runStreak = if (prevDate != null && ChronoUnit.DAYS.between(prevDate, d) == 1L) {
                runStreak + 1
            } else {
                1
            }
            if (runStreak > longestStreak) longestStreak = runStreak
            prevDate = d
        }

        var currentStreak = 0
        var cursorDate = today
        val dateSet = uniqueDates.toSet()
        if (!dateSet.contains(cursorDate) && dateSet.contains(cursorDate.minusDays(1))) {
            cursorDate = cursorDate.minusDays(1)
        }
        while (dateSet.contains(cursorDate)) {
            currentStreak++
            cursorDate = cursorDate.minusDays(1)
        }

        val latestLog = active.maxByOrNull { RecordDate.parseInstantMillis(it.watchedAt) }
        val lastDate = latestLog?.let { RecordDate.parseToLocalDate(it.watchedAt, zone) }
        val daysSinceLast = if (lastDate != null) {
            ChronoUnit.DAYS.between(lastDate, today).coerceAtLeast(0).toInt()
        } else 0

        // Previous week Monday..Sunday
        val currentMonday = today.minusDays((today.dayOfWeek.value - 1).toLong())
        val prevMonday = currentMonday.minusDays(7)
        val prevSunday = currentMonday.minusDays(1)
        val prevWeekItems = active.filter {
            val d = RecordDate.parseToLocalDate(it.watchedAt, zone)
            d != null && !d.isBefore(prevMonday) && !d.isAfter(prevSunday)
        }

        val continueSeries = active
            .filter { it.title.type == TitleType.SERIES && it.status == LogStatus.IN_PROGRESS }
            .maxByOrNull { RecordDate.parseInstantMillis(it.updatedAt ?: it.watchedAt) }

        val h1Start = LocalDate.of(today.year, 1, 1)
        val h1End = LocalDate.of(today.year, 6, 30)
        val h1Logs = active.filter {
            val d = RecordDate.parseToLocalDate(it.watchedAt, zone)
            d != null && !d.isBefore(h1Start) && !d.isAfter(h1End)
        }
        val h1Recap = if (isH1RecapVisible(today) && h1Logs.isNotEmpty()) {
            SeasonalRecap(
                key = "${today.year}-H1",
                startDate = h1Start.toString(),
                endDate = h1End.toString(),
                totalLogs = h1Logs.size,
                topType = maxEntry(h1Logs.groupingBy { it.title.type.wireValue }.eachCount()),
                topPlace = maxEntry(h1Logs.mapNotNull { it.place?.name }.groupingBy { it }.eachCount()),
                topOccasion = maxEntry(h1Logs.mapNotNull { it.occasion?.name }.groupingBy { it }.eachCount()),
                doneRatePct = pct(h1Logs.count { it.status == LogStatus.DONE }, h1Logs.size),
                noteFillPct = pct(h1Logs.count { !it.note.isNullOrBlank() }, h1Logs.size),
                posters = toPosterList(h1Logs).take(6)
            )
        } else null

        return PersonalReport(
            totalLogs = total,
            thisMonthLogs = thisMonthCount,
            doneRatePct = pct(doneCount, total),
            ratingFillPct = pct(ratedCount, total),
            noteFillPct = pct(notedCount, total),
            topType = topType,
            topPlace = topPlace,
            topOccasion = topOccasion,
            streakDays = currentStreak,
            longestStreakDays = longestStreak,
            lastLoggedAt = latestLog?.watchedAt,
            previousWeekLogs = prevWeekItems.size,
            previousWeekPosters = toPosterList(prevWeekItems).take(6),
            monthlyTopGenre = monthlyTopGenreEntry?.key ?: "-",
            monthlyTopGenreCount = monthlyTopGenreEntry?.value ?: 0,
            daysSinceLastLog = daysSinceLast,
            continueSeriesTitleId = continueSeries?.title?.id,
            continueSeriesTitle = continueSeries?.title?.name,
            continueSeriesSeasonNumber = continueSeries?.seasonNumber,
            continueSeriesEpisodeNumber = continueSeries?.episodeNumber,
            seasonalRecap = h1Recap
        )
    }

    fun isH1RecapVisible(today: LocalDate = LocalDate.now(ZoneId.of("Asia/Seoul"))): Boolean {
        val visibleFrom = LocalDate.of(2026, 7, 1)
        val visibleUntil = LocalDate.of(2026, 8, 1)
        return !today.isBefore(visibleFrom) && today.isBefore(visibleUntil)
    }

    private fun toPosterList(logs: List<WatchLog>): List<SeasonalRecapPoster> {
        data class Candidate(
            val item: SeasonalRecapPoster,
            val bestRating: Double
        )
        return logs.groupBy { it.title.id }
            .map { (titleId, group) ->
                val ordered = group.sortedByDescending { RecordDate.parseInstantMillis(it.watchedAt) }
                val latest = ordered.first()
                val seasonPoster = ordered.firstNotNullOfOrNull { it.seasonPosterUrl?.takeIf { u -> u.isNotBlank() } }
                val basePoster = ordered.firstNotNullOfOrNull { it.title.posterUrl?.takeIf { u -> u.isNotBlank() } }
                val bestRating = ordered.mapNotNull { it.rating }.maxOrNull() ?: 0.0
                Candidate(
                    item = SeasonalRecapPoster(
                        titleId = titleId,
                        title = latest.title.name,
                        titleType = latest.title.type.wireValue,
                        posterUrl = seasonPoster ?: basePoster,
                        count = group.size,
                        lastLoggedAt = latest.watchedAt
                    ),
                    bestRating = bestRating
                )
            }
            .sortedWith(
                compareByDescending<Candidate> { !it.item.posterUrl.isNullOrBlank() }
                    .thenByDescending { it.bestRating }
                    .thenByDescending { it.item.count }
                    .thenByDescending { RecordDate.parseInstantMillis(it.item.lastLoggedAt) }
            )
            .map { it.item }
    }
}

/**
 * Android Share Intent parser (faithful port of `apps/web/lib/shareIntent.ts`).
 */
object ShareIntentParser {
    data class ParseResult(
        val query: String,
        val contentType: String, // "video" | "book"
        val platform: String?
    )

    private val QUOTE_PATTERNS = listOf(
        Regex(""""([^"\n]{1,80})""""),
        Regex("""“([^”\n]{1,80})”"""),
        Regex("""'([^'\n]{1,80})'"""),
        Regex("""‘([^’\n]{1,80})’"""),
        Regex("""《([^》\n]{1,80})》"""),
        Regex("""〈([^〉\n]{1,80})〉"""),
        Regex("""「([^」\n]{1,80})」"""),
        Regex("""『([^』\n]{1,80})』""")
    )

    private fun normalizeText(raw: String): String = raw
        .replace(Regex("""[\u200B-\u200D\uFEFF]"""), "")
        .replace('\u00A0', ' ')
        .replace("\r\n", "\n")
        .replace('\r', '\n')
        .replace(Regex("""[ \t]+"""), " ")
        .replace(Regex("""\n{3,}"""), "\n\n")
        .trim()

    fun extractUrls(sharedText: String?, sharedSubject: String? = null): List<String> {
        val merged = normalizeText(listOfNotNull(sharedSubject, sharedText).joinToString("\n"))
        if (merged.isEmpty()) return emptyList()
        return Regex("""https?://\S+""", RegexOption.IGNORE_CASE)
            .findAll(merged)
            .map { it.value }
            .toList()
    }

    fun inferPlatform(sharedText: String?, sharedSubject: String? = null): String? {
        val merged = normalizeText(listOfNotNull(sharedSubject, sharedText).joinToString("\n"))
        if (merged.isEmpty()) return null
        val lower = merged.lowercase()
        when {
            Regex("""(넷플릭스|netflix)""", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> return "넷플릭스"
            Regex("""(디즈니\+|디즈니플러스|disney\+)""", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> return "디즈니플러스"
            Regex("""(apple\s*tv|애플\s*tv|애플티비)""", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> return "애플티비"
            Regex("""(prime video|프라임\s*비디오|프라임비디오)""", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> return "프라임비디오"
            Regex("""(tving|티빙)""", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> return "티빙"
            Regex("""(coupang play|coupangplay|쿠팡플레이)""", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> return "쿠팡플레이"
            Regex("""(watcha|왓챠)""", RegexOption.IGNORE_CASE).containsMatchIn(lower) -> return "왓챠"
        }
        for (url in extractUrls(merged)) {
            val host = runCatching { URI(url).host?.lowercase().orEmpty() }.getOrDefault("")
            when {
                host.contains("netflix.com") -> return "넷플릭스"
                host.contains("disneyplus.com") -> return "디즈니플러스"
                host.contains("apple.com") -> return "애플티비"
                host.contains("primevideo.com") -> return "프라임비디오"
                host.contains("tving.com") -> return "티빙"
                host.contains("coupangplay") || host.contains("app.link") -> return "쿠팡플레이"
                host.contains("watcha") -> return "왓챠"
            }
        }
        return null
    }

    fun sanitizeResolvedTitle(rawTitle: String?): String? {
        val source = rawTitle?.trim().orEmpty()
        if (source.isEmpty()) return null
        val cleaned = source
            .replace(Regex("""\s*[|｜-]\s*(TVING|티빙|쿠팡플레이|COUPANG PLAY|NETFLIX|넷플릭스|DISNEY\+?|디즈니플러스|APPLE TV\+?|PRIME VIDEO|왓챠|WATCHA).*$""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""\s*(\d{1,3}\s*(화|회)|EP?\s*\d{1,3}|E\d{1,3})\s*$""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""\s*(시즌|season)\s*\d{1,2}\s*$""", RegexOption.IGNORE_CASE), "")
            .replace(Regex(""" {2,}"""), " ")
            .trim()
        return cleaned.takeIf { it.isNotEmpty() }
    }

    fun parse(sharedText: String?, sharedSubject: String? = null): ParseResult? {
        val merged = normalizeText(listOfNotNull(sharedSubject, sharedText).joinToString("\n"))
        if (merged.isEmpty()) return null

        val looksBook = Regex("""(isbn|책|도서|book|author|저자|출판|교보|알라딘|yes24|리디)""", RegexOption.IGNORE_CASE)
            .containsMatchIn(merged)
        val contentType = if (looksBook) "book" else "video"
        val platform = inferPlatform(sharedText, sharedSubject)

        for (p in QUOTE_PATTERNS) {
            val m = p.find(merged)
            if (m != null && m.groupValues[1].isNotBlank()) {
                return ParseResult(m.groupValues[1].trim(), contentType, platform)
            }
        }

        val seasonMatch = Regex("""(.+?)\s*[-:]\s*(시즌|season)\s*\d{1,2}""", RegexOption.IGNORE_CASE).find(merged)
        if (seasonMatch != null) {
            val t = seasonMatch.groupValues[1].trim().trimEnd('.', '!', '?')
            if (t.isNotEmpty()) return ParseResult(t.take(160), contentType, platform)
        }

        val taggedMatch = Regex(
            """(.+?)\s*[-–—]\s*.+?\((apple\s*tv|disney\+?|prime video|netflix|tving|watcha|coupang play)\)""",
            RegexOption.IGNORE_CASE
        ).find(merged)
        if (taggedMatch != null) {
            val base = taggedMatch.groupValues[1].trim().trim('\'', '"', '“', '”', '‘', '’', '《', '》', '〈', '〉', '「', '」', '『', '』')
            if (base.isNotEmpty()) return ParseResult(base.take(160), contentType, platform)
        }

        val withoutUrls = merged.replace(Regex("""https?://\S+""", RegexOption.IGNORE_CASE), " ").trim()
        val cleaned = withoutUrls
            .replace(Regex("""혹시 .*에서 """, RegexOption.IGNORE_CASE), "")
            .replace(Regex("""보셨나요\??""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""읽어보셨나요\??""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""저는 지금\s+(.+?)\s+보고 있습니다[.!?]?""", RegexOption.IGNORE_CASE), "$1")
            .replace(Regex("""여러분도\s+지금\s+바로\s+.+$""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""[-–—]\s*(프라임 비디오|prime video|넷플릭스|netflix|디즈니\+?|disney\+?|티빙|tving|왓챠|watcha).*""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""감상하세요[.!?]?""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""\(\s*[을를]\s*\)"""), "")
            .replace(Regex(""" {2,}"""), " ")
            .trim()

        val fallbackLine = withoutUrls.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() }.orEmpty()
        val candidate = (cleaned.ifEmpty { fallbackLine }).take(160)

        val lowSignal = candidate.isBlank() ||
            Regex("""^(쿠팡플레이|넷플릭스|디즈니\+?|프라임 비디오|티빙|왓챠|youtube|유튜브)$""", RegexOption.IGNORE_CASE).matches(candidate.trim()) ||
            Regex("""(쿠팡\s*회원이라면|쿠팡플레이에서 보세요|지금 바로|감상해보세요|프라임 비디오에서 감상하세요|watch on|available on)""", RegexOption.IGNORE_CASE).containsMatchIn(candidate)

        if (lowSignal) {
            val fromUrl = extractUrls(merged).firstNotNullOfOrNull { pickQueryFromUrl(it) }
                ?: return null
            return ParseResult(fromUrl, contentType, platform)
        }

        val firstSentence = candidate.split(Regex("""[.!?]\s""")).firstOrNull()?.trim().orEmpty().ifEmpty { candidate }
        return ParseResult(firstSentence.take(160), contentType, platform)
    }

    private fun pickQueryFromUrl(urlRaw: String): String? {
        return runCatching {
            val uri = URI(urlRaw)
            val segments = (uri.path ?: "").split('/').filter { it.isNotBlank() }
            val last = URLDecoder.decode(segments.lastOrNull() ?: return null, "UTF-8").trim()
            if (last.isEmpty()) return null
            if (last.any { it.isLetter() } && (last.contains('-') || last.contains('_'))) {
                return last.replace(Regex("""[-_]+"""), " ").trim().take(160)
            }
            if (Regex("""^[A-Za-z0-9]{8,}$""").matches(last)) return null
            last.take(160)
        }.getOrNull()
    }
}

/**
 * CSV Exporter with UTF-8 BOM and spreadsheet formula-injection protection (port of `export.ts`).
 */
object CsvExporter {
    private val DANGEROUS_PREFIXES = setOf('=', '+', '-', '@', '\t', '\r')

    fun sanitizeCell(raw: String?): String {
        val value = raw.orEmpty()
        if (value.isEmpty()) return ""
        val neutralized = if (value.first() in DANGEROUS_PREFIXES) "'$value" else value
        val needsQuotes = neutralized.contains(',') || neutralized.contains('"') || neutralized.contains('\n') || neutralized.contains('\r')
        return if (needsQuotes) {
            "\"${neutralized.replace("\"", "\"\"")}\""
        } else {
            neutralized
        }
    }

    fun buildCsv(logs: List<WatchLog>, locale: String): String {
        val sb = StringBuilder()
        sb.append('\uFEFF')
        val headers = if (locale == "en") {
            listOf("Date", "Type", "Title", "Year", "Author/Creator", "Status", "Feeling", "Platform", "Place", "Occasion", "Season", "Episode", "Note")
        } else {
            listOf("기록일", "유형", "제목", "연도", "저자/제작", "상태", "느낌", "플랫폼", "장소", "상황", "시즌", "회차", "메모")
        }
        sb.appendLine(headers.joinToString(",") { sanitizeCell(it) })
        for (log in logs) {
            val isBook = log.title.type == TitleType.BOOK
            val row = listOf(
                RecordDate.recordDateInput(log.watchedAt),
                log.title.type.wireValue,
                log.title.name,
                log.title.year?.toString().orEmpty(),
                log.title.author ?: log.title.directors?.joinToString(" / ").orEmpty(),
                log.status.name,
                RecordFeelings.feelingLabel(log.rating, isBook, locale).orEmpty(),
                log.ott.orEmpty(),
                log.place?.name.orEmpty(),
                log.occasion?.name.orEmpty(),
                log.seasonNumber?.toString().orEmpty(),
                log.episodeNumber?.toString().orEmpty(),
                log.note.orEmpty()
            )
            sb.appendLine(row.joinToString(",") { sanitizeCell(it) })
        }
        return sb.toString()
    }
}

/**
 * Deduplicated popular-title filler selector (faithful port of `apps/web/lib/titleFallback.ts`).
 */
object TitleFallback {
    private fun fallbackKey(type: TitleType, name: String, year: Int?): String =
        "${type.wireValue}:${name.trim().lowercase()}:${year?.toString().orEmpty()}"

    fun selectPopularTitleFillers(
        discussions: List<DiscussionListItem>,
        trends: List<TitleSearchItem>,
        limit: Int
    ): List<TitleSearchItem> {
        if (limit <= 0 || trends.isEmpty()) return emptyList()
        val providerKeys = discussions.mapNotNull { item ->
            val p = item.titleProvider
            val pid = item.titleProviderId
            if (p != null && !pid.isNullOrBlank()) "$p:$pid" else null
        }.toMutableSet()

        val fallbackKeys = discussions.map { item ->
            fallbackKey(item.titleType, item.titleName, item.titleYear)
        }.toMutableSet()

        val selected = ArrayList<TitleSearchItem>(limit.coerceAtMost(trends.size))
        for (item in trends) {
            if (selected.size >= limit) break
            val pKey = "${item.provider}:${item.providerId}"
            val fKey = fallbackKey(item.type, item.name, item.year)
            if (pKey in providerKeys || fKey in fallbackKeys) continue
            providerKeys.add(pKey)
            fallbackKeys.add(fKey)
            selected.add(item)
        }
        return selected
    }
}
