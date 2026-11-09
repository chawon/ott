package app.ottline.ui.screens

import android.Manifest
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.ottline.WatchReminderAccess
import app.ottline.WatchReminderScheduler
import app.ottline.WatchReminderTargets
import app.ottline.WatchReminderWorker
import app.ottline.data.OttlineRepository
import app.ottline.data.local.PreferencesSnapshot
import app.ottline.data.local.TwaBrowserBridge
import app.ottline.domain.BookshelfBuilder
import app.ottline.domain.PersonalReportBuilder
import app.ottline.domain.RecordDate
import app.ottline.model.BookClassification
import app.ottline.model.FeedbackCategory
import app.ottline.model.FeedbackAuthorRole
import app.ottline.model.FeedbackThreadDetail
import app.ottline.model.FeedbackThreadSummary
import app.ottline.model.Occasion
import app.ottline.model.PersonalReport
import app.ottline.model.Place
import app.ottline.model.SeasonalRecapPoster
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.components.PosterImage
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import app.ottline.ui.util.CardExporter
import app.ottline.ui.util.RecapCardKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// ============================================================================
// 1. PERSONAL REPORT SCREEN (`/me/report` parity + Recap Share Card)
// ============================================================================
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReportScreen(
    allLogs: List<WatchLog>,
    prefsSnapshot: PreferencesSnapshot,
    repository: OttlineRepository,
    onBack: () -> Unit,
    onOpenTitleDetail: (String) -> Unit
) {
    val context = LocalContext.current
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val scope = rememberCoroutineScope()

    val localReport = remember(allLogs) { PersonalReportBuilder.build(allLogs) }
    var report by remember(localReport) { mutableStateOf(localReport) }
    var selectedRecapKind by rememberSaveable { mutableStateOf(RecapCardKind.WEEKLY) }
    var exportingRecap by remember { mutableStateOf(false) }

    val thisMonthKey = remember { RecordDate.monthKey(null) }
    val thisMonthPosters = remember(allLogs, thisMonthKey) {
        allLogs
            .filter { RecordDate.monthKey(it.watchedAt) == thisMonthKey }
            .groupBy { it.title.id }
            .values
            .map { group ->
                val latest = group.maxBy { RecordDate.parseInstantMillis(it.watchedAt) }
                val bestRating = group.mapNotNull { it.rating }.maxOrNull() ?: 0.0
                val poster = group.firstNotNullOfOrNull { it.seasonPosterUrl?.takeIf(String::isNotBlank) }
                    ?: latest.title.posterUrl?.takeIf(String::isNotBlank)
                Triple(
                    SeasonalRecapPoster(
                        titleId = latest.title.id,
                        title = latest.title.name,
                        titleType = latest.title.type.wireValue,
                        posterUrl = poster,
                        count = group.size,
                        lastLoggedAt = latest.watchedAt
                    ),
                    bestRating,
                    RecordDate.parseInstantMillis(latest.watchedAt)
                )
            }
            .sortedWith(
                compareByDescending<Triple<SeasonalRecapPoster, Double, Long>> { !it.first.posterUrl.isNullOrBlank() }
                    .thenByDescending { it.second }
                    .thenByDescending { it.third }
            )
            .take(6)
            .map { it.first }
    }

    val isH1Visible = remember { PersonalReportBuilder.isH1RecapVisible() }
    val showH1Recap = isH1Visible && (report.seasonalRecap?.totalLogs ?: 0) > 0

    LaunchedEffect(prefsSnapshot.userId, allLogs.size) {
        repository.trackEvent("report_open")
        if (!prefsSnapshot.userId.isNullOrBlank()) {
            runCatching { repository.api.getMyReport() }
                .onSuccess { remote ->
                    if (remote.totalLogs > 0 || allLogs.isEmpty()) {
                        report = if (isH1Visible) remote else remote.copy(seasonalRecap = null)
                    }
                }
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = tr("뒤로", "Back"), tint = palette.ink)
                }
                Text(
                    text = tr("내 이용 리포트", "My Timeline Report"),
                    style = MaterialTheme.typography.titleLarge,
                    color = palette.ink
                )
            }
        }

        // Core Metrics Grid
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    StatBox(
                        label = tr("전체 기록", "Total moments"),
                        value = "${report.totalLogs}",
                        modifier = Modifier.weight(1f)
                    )
                    StatBox(
                        label = tr("이번 달", "This month"),
                        value = "${report.thisMonthLogs}",
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    StatBox(
                        label = tr("완주 비율", "Completion"),
                        value = "${report.doneRatePct}%",
                        modifier = Modifier.weight(1f)
                    )
                    StatBox(
                        label = tr("연속 기록", "Streak"),
                        value = tr("${report.streakDays}일 (최장 ${report.longestStreakDays}일)", "${report.streakDays}d (best ${report.longestStreakDays}d)"),
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Recap Story Card Studio (9:16 Weekly / Monthly / H1 Recap PNG — F07)
        if (report.totalLogs > 0) {
            item {
                val activeRecapKind = if (selectedRecapKind == RecapCardKind.HALF_YEAR && !showH1Recap) {
                    RecapCardKind.WEEKLY
                } else {
                    selectedRecapKind
                }
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = tr("리캡 스토리 카드 (9:16)", "Recap Story Cards (9:16)"),
                                style = MaterialTheme.typography.titleMedium,
                                color = palette.ink
                            )
                            Text(
                                text = tr(
                                    "포스터 모자이크와 감상 결을 1080×1920 스토리 카드로 공유하거나 저장해요.",
                                    "Share or save your 1080×1920 poster mosaic story card."
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = palette.mutedInk
                            )
                        }

                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            FilterChip(
                                selected = activeRecapKind == RecapCardKind.WEEKLY,
                                onClick = { selectedRecapKind = RecapCardKind.WEEKLY },
                                shape = RoundedCornerShape(8.dp),
                                label = { Text(tr("주간 리캡", "Weekly")) }
                            )
                            FilterChip(
                                selected = activeRecapKind == RecapCardKind.MONTHLY,
                                onClick = { selectedRecapKind = RecapCardKind.MONTHLY },
                                shape = RoundedCornerShape(8.dp),
                                label = { Text(tr("월간 리캡", "Monthly")) }
                            )
                            if (showH1Recap) {
                                FilterChip(
                                    selected = activeRecapKind == RecapCardKind.HALF_YEAR,
                                    onClick = { selectedRecapKind = RecapCardKind.HALF_YEAR },
                                    shape = RoundedCornerShape(8.dp),
                                    label = { Text(tr("상반기 결산", "H1 Recap")) }
                                )
                            }
                        }

                        val shareChooser = tr("리캡 카드 공유", "Share recap card")
                        val savedToast = tr("리캡 카드를 갤러리에 저장했어요.", "Saved recap card to gallery.")
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Button(
                                onClick = {
                                    if (exportingRecap) return@Button
                                    scope.launch {
                                        exportingRecap = true
                                        val bmp = CardExporter.renderRecapCardBitmap(
                                            context = context,
                                            kind = activeRecapKind,
                                            report = report,
                                            monthPosters = thisMonthPosters,
                                            nickname = prefsSnapshot.nickname,
                                            locale = locale
                                        )
                                        CardExporter.shareBitmap(
                                            context = context,
                                            bitmap = bmp,
                                            fileNamePrefix = "ottline_recap_${activeRecapKind.name.lowercase()}",
                                            chooserTitle = shareChooser
                                        )
                                        repository.trackEvent(
                                            "share_card_export",
                                            mapOf("mode" to "share", "cardKind" to activeRecapKind.name.lowercase())
                                        )
                                        exportingRecap = false
                                    }
                                },
                                enabled = !exportingRecap,
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = palette.brandNavy,
                                    contentColor = palette.onBrandNavy
                                ),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Outlined.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(tr("스토리 공유", "Share"), fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = {
                                    if (exportingRecap) return@OutlinedButton
                                    scope.launch {
                                        exportingRecap = true
                                        val bmp = CardExporter.renderRecapCardBitmap(
                                            context = context,
                                            kind = activeRecapKind,
                                            report = report,
                                            monthPosters = thisMonthPosters,
                                            nickname = prefsSnapshot.nickname,
                                            locale = locale
                                        )
                                        CardExporter.saveBitmapToGallery(
                                            context = context,
                                            bitmap = bmp,
                                            fileNamePrefix = "ottline_recap_${activeRecapKind.name.lowercase()}"
                                        ).onSuccess {
                                            Toast.makeText(context, savedToast, Toast.LENGTH_SHORT).show()
                                        }
                                        repository.trackEvent(
                                            "share_card_export",
                                            mapOf("mode" to "save", "cardKind" to activeRecapKind.name.lowercase())
                                        )
                                        exportingRecap = false
                                    }
                                },
                                enabled = !exportingRecap,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(tr("갤러리 저장", "Save PNG"))
                            }
                        }
                    }
                }
            }
        }

        // Moment Habits Card
        item {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = palette.paperStrong,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = tr("나의 감상 결", "Your Story Habits"),
                        style = MaterialTheme.typography.titleMedium,
                        color = palette.brandNavy
                    )
                    val topPlace = Place.fromWire(report.topPlace)?.let { OttlineStrings.placeLabel(it, locale) } ?: report.topPlace
                    val topOcc = Occasion.fromWire(report.topOccasion)?.let { OttlineStrings.occasionLabel(it, locale) } ?: report.topOccasion
                    val topType = TitleType.fromWire(report.topType).let {
                        if (report.topType == "-") "-" else OttlineStrings.titleTypeLabel(it, locale)
                    }
                    Text(
                        text = tr(
                            "가장 자주 남긴 유형: $topType · 장소: $topPlace · 순간: $topOcc",
                            "Favorite medium: $topType · Place: $topPlace · Occasion: $topOcc"
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.ink
                    )
                    Text(
                        text = tr(
                            "문장 기록 비율 ${report.noteFillPct}% · 느낌 기록 비율 ${report.ratingFillPct}%",
                            "Notes written on ${report.noteFillPct}% · Feelings recorded on ${report.ratingFillPct}%"
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk
                    )
                    if (report.monthlyTopGenre != "-") {
                        Text(
                            text = tr(
                                "이번 달 가장 자주 만난 장르: ${report.monthlyTopGenre} (${report.monthlyTopGenreCount}편)",
                                "Top genre this month: ${report.monthlyTopGenre} (${report.monthlyTopGenreCount})"
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.brandNavy
                        )
                    }
                }
            }
        }

        // H1 Seasonal Recap section (strictly visible only during July window — F07)
        val h1 = report.seasonalRecap
        if (showH1Recap && h1 != null) {
            item {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.brandNavy.copy(alpha = 0.35f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = tr("2026 상반기 결산 (${h1.totalLogs}편)", "2026 H1 Recap (${h1.totalLogs})"),
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.ink
                        )
                        val h1TopType = if (h1.topType == "-") {
                            "-"
                        } else {
                            OttlineStrings.titleTypeLabel(TitleType.fromWire(h1.topType), locale)
                        }
                        Text(
                            text = tr(
                                "완주 비율 ${h1.doneRatePct}% · 자주 만난 유형 $h1TopType · 문장 기록 ${h1.noteFillPct}%",
                                "Completion ${h1.doneRatePct}% · Top medium $h1TopType · Notes ${h1.noteFillPct}%"
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.mutedInk
                        )
                        val h1Posters = h1.posters.orEmpty()
                        if (h1Posters.isNotEmpty()) {
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                items(h1Posters, key = { "h1_${it.titleId}" }) { p ->
                                    PosterImage(
                                        posterUrl = p.posterUrl,
                                        titleName = p.title,
                                        titleType = TitleType.fromWire(p.titleType),
                                        modifier = Modifier
                                            .size(width = 80.dp, height = 116.dp)
                                            .clickable { onOpenTitleDetail(p.titleId) },
                                        widthBucket = "w342"
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Continue Series Card
        val contTitleId = report.continueSeriesTitleId
        val contTitleName = report.continueSeriesTitle
        if (!contTitleId.isNullOrBlank() && !contTitleName.isNullOrBlank()) {
            item {
                Surface(
                    onClick = { onOpenTitleDetail(contTitleId) },
                    shape = RoundedCornerShape(10.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(tr("이어보던 시리즈", "Continue watching"), style = MaterialTheme.typography.labelMedium, color = palette.brandNavy)
                        Spacer(Modifier.height(4.dp))
                        Text(contTitleName, style = MaterialTheme.typography.titleMedium, color = palette.ink)
                    }
                }
            }
        }

        // Previous Week Posters
        val prevPosters = report.previousWeekPosters.orEmpty()
        if (prevPosters.isNotEmpty()) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = tr("지난주에 머문 작품 (${report.previousWeekLogs})", "Last week's stories (${report.previousWeekLogs})"),
                        style = MaterialTheme.typography.titleSmall,
                        color = palette.ink
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(prevPosters, key = { it.titleId }) { p ->
                            PosterImage(
                                posterUrl = p.posterUrl,
                                titleName = p.title,
                                titleType = TitleType.fromWire(p.titleType),
                                modifier = Modifier
                                    .size(width = 86.dp, height = 124.dp)
                                    .clickable { onOpenTitleDetail(p.titleId) },
                                widthBucket = "w342"
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatBox(label: String, value: String, modifier: Modifier = Modifier) {
    val palette = LocalOttlinePalette.current
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = palette.mutedInk)
            Spacer(Modifier.height(6.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, color = palette.brandNavy)
        }
    }
}

// ============================================================================
// 2. BOOKSHELF SCREEN (KDC 000~900 + Unclassified)
// ============================================================================
@Composable
fun BookshelfScreen(
    allLogs: List<WatchLog>,
    classifications: List<BookClassification>,
    repository: OttlineRepository,
    onBack: () -> Unit,
    onOpenTitleDetail: (String) -> Unit,
    onOpenQuickBookRecord: () -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current

    LaunchedEffect(allLogs) {
        val bookTitles = allLogs.map { it.title }.filter { it.type == TitleType.BOOK }
        if (bookTitles.isNotEmpty()) {
            repository.ensureBookClassificationsCached(bookTitles)
        }
    }

    val shelf = remember(allLogs, classifications) {
        BookshelfBuilder.build(allLogs, classifications)
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = tr("뒤로", "Back"), tint = palette.ink)
                }
                Column {
                    Text(
                        text = tr("내 서가", "My Bookshelf"),
                        style = MaterialTheme.typography.titleLarge,
                        color = palette.ink
                    )
                    Text(
                        text = tr(
                            "총 ${shelf.books.size}권 · ${shelf.categoryCount}개 주제 서가",
                            "${shelf.books.size} books · ${shelf.categoryCount} subject shelves"
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk
                    )
                }
            }
        }

        if (shelf.books.isEmpty()) {
            item {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Text(
                            text = tr("아직 서가에 꽂힌 책이 없어요.", "Your bookshelf is ready for its first book."),
                            style = MaterialTheme.typography.bodyMedium,
                            color = palette.mutedInk
                        )
                        Button(
                            onClick = onOpenQuickBookRecord,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.brandOrange,
                                contentColor = Color(0xFF0F0F0F)
                            )
                        ) {
                            Text(tr("책 기록 남기기", "Log a book"), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        } else {
            shelf.groups.filter { it.books.isNotEmpty() }.forEach { group ->
                item(key = "kdc_${group.major}") {
                    BookshelfRowSection(
                        title = "${OttlineStrings.kdcCategoryTitle(group.major, locale)} (${group.books.size})",
                        books = group.books,
                        onOpenTitleDetail = onOpenTitleDetail
                    )
                }
            }

            if (shelf.unclassifiedBooks.isNotEmpty()) {
                item(key = "kdc_unclassified") {
                    BookshelfRowSection(
                        title = "${OttlineStrings.kdcCategoryTitle(-1, locale)} (${shelf.unclassifiedBooks.size})",
                        books = shelf.unclassifiedBooks,
                        onOpenTitleDetail = onOpenTitleDetail
                    )
                }
            }
        }
    }
}

@Composable
private fun BookshelfRowSection(
    title: String,
    books: List<BookshelfBuilder.BookshelfBook>,
    onOpenTitleDetail: (String) -> Unit
) {
    val palette = LocalOttlinePalette.current
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = palette.brandNavy)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(books, key = { it.key }) { b ->
                    Column(
                        modifier = Modifier
                            .width(96.dp)
                            .clickable { onOpenTitleDetail(b.title.id) }
                    ) {
                        PosterImage(
                            posterUrl = b.title.posterUrl,
                            titleName = b.title.name,
                            titleType = TitleType.BOOK,
                            modifier = Modifier.size(width = 96.dp, height = 136.dp),
                            widthBucket = "w342"
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = b.title.name,
                            style = MaterialTheme.typography.labelMedium,
                            color = palette.ink,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

// ============================================================================
// 3. FEEDBACK INBOX & UGC REPORT SCREEN (`/feedback/threads`)
// ============================================================================
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FeedbackScreen(
    repository: OttlineRepository,
    prefilledReportBody: String? = null,
    onConsumePrefill: () -> Unit = {},
    onBack: () -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val scope = rememberCoroutineScope()

    var threads by remember { mutableStateOf<List<FeedbackThreadSummary>>(emptyList()) }
    var activeDetail by remember { mutableStateOf<FeedbackThreadDetail?>(null) }
    var loading by remember { mutableStateOf(true) }

    var category by remember {
        mutableStateOf(if (!prefilledReportBody.isNullOrBlank()) FeedbackCategory.BUG else FeedbackCategory.IDEA)
    }
    var subject by remember {
        mutableStateOf(if (!prefilledReportBody.isNullOrBlank()) "콘텐츠 신고" else "")
    }
    var body by remember { mutableStateOf(prefilledReportBody.orEmpty()) }
    var replyBody by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }

    LaunchedEffect(prefilledReportBody) {
        if (!prefilledReportBody.isNullOrBlank()) {
            category = FeedbackCategory.BUG
            subject = if (locale == "en") "Content Report" else "콘텐츠 신고"
            body = prefilledReportBody
            onConsumePrefill()
        }
    }

    suspend fun reloadThreads() {
        loading = true
        runCatching {
            repository.ensureAuthenticated()
            repository.api.getFeedbackThreads()
        }.onSuccess { threads = it }
        loading = false
    }

    LaunchedEffect(Unit) {
        reloadThreads()
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = {
                        if (activeDetail != null) activeDetail = null else onBack()
                    }
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = tr("뒤로", "Back"), tint = palette.ink)
                }
                Text(
                    text = if (activeDetail != null) {
                        activeDetail?.subject ?: tr("문의 상세", "Thread detail")
                    } else {
                        tr("내 문의함", "Feedback & Support")
                    },
                    style = MaterialTheme.typography.titleLarge,
                    color = palette.ink
                )
            }
        }

        val detail = activeDetail
        if (detail != null) {
            items(detail.messages, key = { it.id }) { msg ->
                val isAdmin = msg.authorRole == FeedbackAuthorRole.ADMIN
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = if (isAdmin) palette.sageAccent else palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = if (isAdmin) tr("ottline 운영팀", "ottline Team") else tr("내가 남긴 글", "You"),
                            style = MaterialTheme.typography.labelMedium,
                            color = palette.brandNavy
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(msg.body, style = MaterialTheme.typography.bodyMedium, color = palette.ink)
                    }
                }
            }

            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = replyBody,
                        onValueChange = { replyBody = it.take(1000) },
                        placeholder = { Text(tr("추가 메시지 남기기", "Write a reply")) },
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = {
                            if (replyBody.trim().isEmpty() || submitting) return@Button
                            scope.launch {
                                submitting = true
                                runCatching {
                                    repository.api.sendFeedbackMessage(detail.id, replyBody.trim())
                                }.onSuccess { updated ->
                                    activeDetail = updated
                                    replyBody = ""
                                }
                                submitting = false
                            }
                        },
                        enabled = replyBody.trim().isNotEmpty() && !submitting,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = palette.brandNavy,
                            contentColor = palette.onBrandNavy
                        )
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = null)
                    }
                }
            }
        } else {
            // New Inquiry Composer
            item {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = tr("새 의견 또는 문의 남기기", "Send a message"),
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.ink
                        )
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FeedbackCategory.entries.forEach { cat ->
                                FilterChip(
                                    selected = category == cat,
                                    onClick = { category = cat },
                                    label = { Text(OttlineStrings.feedbackCategoryLabel(cat, locale)) }
                                )
                            }
                        }
                        OutlinedTextField(
                            value = subject,
                            onValueChange = { subject = it.take(80) },
                            label = { Text(tr("제목 (선택)", "Subject (optional)")) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = body,
                            onValueChange = { body = it.take(1500) },
                            label = { Text(tr("내용", "Message")) },
                            minLines = 3,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Button(
                            onClick = {
                                if (body.trim().isEmpty() || submitting) return@Button
                                scope.launch {
                                    submitting = true
                                    runCatching {
                                        repository.ensureAuthenticated()
                                        repository.api.createFeedbackThread(category, subject, body)
                                    }.onSuccess { created ->
                                        subject = ""
                                        body = ""
                                        activeDetail = created
                                        reloadThreads()
                                    }
                                    submitting = false
                                }
                            },
                            enabled = body.trim().isNotEmpty() && !submitting,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.brandNavy,
                                contentColor = palette.onBrandNavy
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(tr("보내기", "Submit"), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (loading) {
                item { CircularProgressIndicator(color = palette.brandNavy) }
            } else {
                items(threads, key = { it.id }) { t ->
                    Surface(
                        onClick = {
                            scope.launch {
                                runCatching { repository.api.getFeedbackThreadDetail(t.id) }
                                    .onSuccess { activeDetail = it }
                            }
                        },
                        shape = RoundedCornerShape(14.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = t.subject?.takeIf { it.isNotBlank() }
                                        ?: OttlineStrings.feedbackCategoryLabel(t.category, locale),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = palette.ink
                                )
                                Text(
                                    text = OttlineStrings.feedbackStatusLabel(t.status, locale),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = palette.brandNavy
                                )
                            }
                            if (!t.lastMessagePreview.isNullOrBlank()) {
                                Text(
                                    text = t.lastMessagePreview,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = palette.mutedInk,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// 4. ANDROID WATCH REMINDER SETTINGS SCREEN (TWA parity + Diagnostics)
// ============================================================================
@Composable
fun WatchReminderScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val palette = LocalOttlinePalette.current
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasUsageAccess by remember { mutableStateOf(WatchReminderAccess.hasUsageAccess(context)) }
    var canNotify by remember { mutableStateOf(WatchReminderAccess.canPostNotifications(context)) }
    var isUnrestrictedBattery by remember { mutableStateOf(WatchReminderAccess.isIgnoringBatteryOptimizations(context)) }
    var enabled by remember { mutableStateOf(WatchReminderScheduler.isEnabled(context)) }
    var lastScanResult by remember { mutableStateOf(WatchReminderScheduler.lastScanResult(context)) }

    fun refreshPermissions() {
        hasUsageAccess = WatchReminderAccess.hasUsageAccess(context)
        canNotify = WatchReminderAccess.canPostNotifications(context)
        isUnrestrictedBattery = WatchReminderAccess.isIgnoringBatteryOptimizations(context)
        enabled = WatchReminderScheduler.isEnabled(context)
        lastScanResult = WatchReminderScheduler.lastScanResult(context)
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) refreshPermissions()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val notifPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) {
        refreshPermissions()
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = tr("뒤로", "Back"), tint = palette.ink)
                }
                Text(
                    text = tr("감상 후 기록 알림", "Post-watch Reminder"),
                    style = MaterialTheme.typography.titleLarge,
                    color = palette.ink
                )
            }
        }

        item {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = palette.paperStrong,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = tr("어떻게 작동하나요?", "How it works"),
                        style = MaterialTheme.typography.titleSmall,
                        color = palette.brandNavy
                    )
                    Text(
                        text = tr(
                            "넷플릭스, 티빙, 웨이브, 쿠팡플레이, 디즈니+, 왓챠, 프라임 비디오, 애플 TV 앱을 5분 이상 감상한 뒤 마치면 부드럽게 기록 알림을 보내드려요. 앱 사용 기록은 오직 기기 안에서만 확인하며 절대 서버로 전송되지 않아요.",
                            "Detects 5+ minutes of viewing on Netflix, TVING, Wavve, Coupang Play, Disney+, Watcha, Prime Video, or Apple TV purely on-device (never sent to any server)."
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk
                    )
                }
            }
        }

        // Step 1: Usage Access
        item {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(tr("1단계 · 사용 정보 접근 권한", "Step 1 · Usage access"), style = MaterialTheme.typography.titleSmall, color = palette.ink)
                        Text(
                            text = if (hasUsageAccess) tr("허용됨", "Granted") else tr("OTT 앱 감상 여부를 확인하려면 필요해요.", "Needed to detect finished OTT sessions."),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (hasUsageAccess) palette.success else palette.mutedInk
                        )
                    }
                    if (hasUsageAccess) {
                        Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = palette.success)
                    } else {
                        OutlinedButton(
                            onClick = {
                                runCatching { context.startActivity(WatchReminderAccess.usageAccessSettingsIntent(context)) }
                                    .onFailure { context.startActivity(WatchReminderAccess.fallbackUsageAccessIntent()) }
                            }
                        ) {
                            Text(tr("설정 열기", "Grant"))
                        }
                    }
                }
            }
        }

        // Step 2: Notification Permission
        item {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(tr("2단계 · 알림 권한", "Step 2 · Notifications"), style = MaterialTheme.typography.titleSmall, color = palette.ink)
                        Text(
                            text = if (canNotify) tr("허용됨", "Granted") else tr("알림을 받으려면 권한이 필요해요.", "Required to show reminders."),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (canNotify) palette.success else palette.mutedInk
                        )
                    }
                    if (canNotify) {
                        Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = palette.success)
                    } else {
                        OutlinedButton(
                            onClick = {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                } else {
                                    context.startActivity(WatchReminderAccess.notificationSettingsIntent(context))
                                }
                            }
                        ) {
                            Text(tr("권한 허용", "Allow"))
                        }
                    }
                }
            }
        }

        // Step 2.5: Battery Unrestricted Recommendation (prevents Samsung One UI OLAF / Deep Sleep)
        item {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = tr("권장 · 백그라운드 배터리 제한 해제", "Recommended · Unrestricted battery"),
                            style = MaterialTheme.typography.titleSmall,
                            color = palette.ink
                        )
                        Text(
                            text = if (isUnrestrictedBattery) {
                                tr("제한 없음으로 설정되어 끊기지 않아요.", "Unrestricted—reminders stay active.")
                            } else {
                                tr(
                                    "며칠 뒤 알림이 멈추지 않도록 [앱 정보 → 배터리 → 제한 없음]을 권장해요.",
                                    "Set [App info → Battery → Unrestricted] so Android never puts reminders to sleep."
                                )
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = if (isUnrestrictedBattery) palette.success else palette.mutedInk
                        )
                    }
                    if (isUnrestrictedBattery) {
                        Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = palette.success)
                    } else {
                        Spacer(Modifier.width(8.dp))
                        OutlinedButton(
                            onClick = {
                                runCatching { context.startActivity(WatchReminderAccess.appBatteryDetailsIntent(context)) }
                            },
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(tr("배터리 설정", "Battery"))
                        }
                    }
                }
            }
        }

        // Step 3: Master Switch & Manual Scan
        item {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(tr("3단계 · 감상 후 알림 켜기", "Step 3 · Enable reminder"), style = MaterialTheme.typography.titleSmall, color = palette.ink)
                            Text(
                                text = if (enabled) {
                                    tr("켜짐 · OTT 감상을 마치면 조용히 알려드려요.", "Enabled · Sends a gentle reminder after watching.")
                                } else {
                                    tr("1·2단계 권한을 허용하면 알림을 켤 수 있어요.", "Grant steps 1 & 2 above to turn on reminders.")
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = if (enabled) palette.success else palette.mutedInk
                            )
                            if (app.ottline.BuildConfig.DEBUG) {
                                Text(
                                    text = tr("최근 상태(디버그): $lastScanResult", "Debug status: $lastScanResult"),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = palette.subtleInk
                                )
                            }
                        }
                        Switch(
                            checked = enabled,
                            enabled = hasUsageAccess && canNotify,
                            onCheckedChange = { next ->
                                WatchReminderScheduler.setEnabled(context, next)
                                refreshPermissions()
                            }
                        )
                    }

                    val targetNames = WatchReminderTargets.all().values.map { it.label }.distinct().joinToString(" · ")
                    Text(
                        text = tr("지원 앱: $targetNames", "Supported: $targetNames"),
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.subtleInk
                    )

                    if (app.ottline.BuildConfig.DEBUG) {
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    val res = withContext(Dispatchers.IO) {
                                        WatchReminderWorker.scanNow(context, ignoreCooldown = true)
                                    }
                                    lastScanResult = res
                                    Toast.makeText(context, res, Toast.LENGTH_SHORT).show()
                                }
                            },
                            enabled = enabled && hasUsageAccess,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(tr("지금 바로 감지 테스트", "Test scan now"))
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// 5. GUIDES, FAQ & PRIVACY SCREEN
// ============================================================================
@Composable
fun GuideInfoScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val palette = LocalOttlinePalette.current
    val sections = listOf(
        tr("한 손 수첩처럼 가볍게", "Like a pocket notebook") to tr(
            "작품 제목을 고르고 ‘봤어요·보는 중·보고 싶어요’ 중 하나만 누르면 즉시 이 기기에 저장돼요. 날짜나 장소, 함께한 순간, 문장은 기억하고 싶을 때만 골라 적으면 충분해요.",
            "Tap Watched, Watching, or Want to watch and your record is saved immediately on-device. Details of the moment are always optional."
        ),
        tr("오프라인에서도 끊기지 않는 보관", "Offline-first & calm sync") to tr(
            "지하철이나 비행기 안에서도 기록을 남길 수 있어요. 기기 내부 데이터베이스(Room)와 동기화 보관함(Outbox)에 먼저 담은 뒤 연결이 돌아오면 자동으로 맞춰둬요.",
            "Log stories on subways or flights. Everything is stored locally first and synced automatically once you're back online."
        ),
        tr("비공개가 기본인 기록", "Private by default") to tr(
            "남겨둔 날짜, 장소, 메모는 오직 내 타임라인에만 남아요. ‘함께 화면에도 나누기’를 직접 체크했을 때만 공개 대화방에 생각이 공유돼요.",
            "Your timeline notes and moments are private unless you explicitly check 'Also share in Together'."
        ),
        tr("개인정보 및 권한 안내", "Privacy & Permissions") to tr(
            "이메일·전화번호를 수집하지 않으며 연결 코드로만 기기를 이어줘요. ‘감상 후 기록 알림’을 켰을 때 조회하는 앱 사용 시간 역시 오직 기기 내부에서만 계산되고 외부로 전송되지 않아요.",
            "No email or phone number is collected. Optional Android Usage Stats for post-watch reminders never leave your device."
        )
    )

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = tr("뒤로", "Back"), tint = palette.ink)
                }
                Text(
                    text = tr("기록 가이드 · 개인정보 안내", "Guides & Privacy"),
                    style = MaterialTheme.typography.titleLarge,
                    color = palette.ink
                )
            }
        }

        items(sections) { (title, desc) ->
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(title, style = MaterialTheme.typography.titleSmall, color = palette.brandNavy)
                    Text(desc, style = MaterialTheme.typography.bodySmall, color = palette.mutedInk)
                }
            }
        }

        item {
            OutlinedButton(
                onClick = {
                    TwaBrowserBridge.launchInExternalCustomTab(context, "https://ottline.app/privacy")
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(tr("웹에서 개인정보처리방침 전문 보기", "Read full privacy policy"))
                Spacer(Modifier.width(6.dp))
                Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
            }
        }
    }
}
