package app.ottline.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.unit.sp
import app.ottline.data.OttlineRepository
import app.ottline.data.local.PreferencesSnapshot
import app.ottline.domain.BookshelfBuilder
import app.ottline.domain.CsvExporter
import app.ottline.domain.RecordDate
import app.ottline.model.BookClassification
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.Place
import app.ottline.model.RecommendationItem
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.TimelineFilterState
import app.ottline.ui.components.PosterImage
import app.ottline.ui.components.RecordFeelingBadge
import app.ottline.ui.components.noSwipeNav
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import app.ottline.ui.util.CardExporter
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TimelineScreen(
    allLogs: List<WatchLog>,
    classifications: List<BookClassification>,
    prefsSnapshot: PreferencesSnapshot,
    repository: OttlineRepository,
    filterState: TimelineFilterState = TimelineFilterState(),
    onUpdateFilter: ((TimelineFilterState) -> TimelineFilterState) -> Unit = {},
    onOpenQuickRecord: (QuickRecordRequest) -> Unit,
    onOpenTitleDetail: (String) -> Unit,
    onOpenReport: () -> Unit,
    onOpenBookshelf: () -> Unit
) {
    val context = LocalContext.current
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val scope = rememberCoroutineScope()

    val contentTypeTab = filterState.typeFilter
    val searchQuery = filterState.query
    val statusFilter = remember(filterState.statusFilter) {
        runCatching { LogStatus.valueOf(filterState.statusFilter) }.getOrNull()
    }
    val placeFilter = filterState.placeFilter
    val occasionFilter = filterState.occasionFilter

    var filterExpanded by rememberSaveable { mutableStateOf(false) }
    var platformFilter by rememberSaveable { mutableStateOf("") }
    var originFilter by rememberSaveable { mutableStateOf("ALL") }

    // Server cursor pagination state
    var nextCursor by remember { mutableStateOf<String?>(null) }
    var loadingMore by remember { mutableStateOf(false) }
    var loadMoreError by remember { mutableStateOf(false) }

    // Future Timeline ("내 미래는?") state
    var futureMode by rememberSaveable { mutableStateOf(false) }
    var futureItems by remember { mutableStateOf<List<RecommendationItem>>(emptyList()) }
    var futureLoading by remember { mutableStateOf(false) }
    var futureError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(
        prefsSnapshot.userId,
        contentTypeTab,
        statusFilter,
        placeFilter,
        occasionFilter,
        platformFilter,
        originFilter,
        searchQuery
    ) {
        if (prefsSnapshot.userId.isNullOrBlank()) {
            nextCursor = null
            return@LaunchedEffect
        }
        runCatching {
            repository.api.getLogsPage(
                limit = 50,
                contentType = contentTypeTab,
                status = statusFilter?.name,
                origin = originFilter,
                ott = platformFilter.trim().takeIf { it.isNotEmpty() },
                place = placeFilter?.name,
                occasion = occasionFilter?.name,
                query = searchQuery.trim().takeIf { it.isNotEmpty() }
            )
        }.onSuccess { page ->
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            loadMoreError = false
        }
    }

    val activeFilterCount = listOfNotNull(
        statusFilter,
        placeFilter,
        occasionFilter,
        platformFilter.takeIf { it.isNotBlank() },
        originFilter.takeIf { it != "ALL" }
    ).size

    val filteredLogs = remember(
        allLogs,
        contentTypeTab,
        searchQuery,
        statusFilter,
        placeFilter,
        occasionFilter,
        platformFilter,
        originFilter
    ) {
        val q = searchQuery.trim().lowercase()
        allLogs.filter { log ->
            val matchesContent = when (contentTypeTab) {
                "VIDEO" -> log.title.type != TitleType.BOOK
                "MOVIE" -> log.title.type == TitleType.MOVIE
                "SERIES" -> log.title.type == TitleType.SERIES
                "BOOK" -> log.title.type == TitleType.BOOK
                else -> true
            }
            val matchesStatus = statusFilter == null || log.status == statusFilter
            val matchesPlace = placeFilter == null || log.place == placeFilter
            val matchesOccasion = occasionFilter == null || log.occasion == occasionFilter
            val matchesPlatform = platformFilter.isBlank() ||
                (log.ott?.contains(platformFilter.trim(), ignoreCase = true) == true)
            val matchesOrigin = originFilter == "ALL" || (log.origin ?: "LOG") == originFilter
            val matchesQuery = q.isEmpty() ||
                log.title.name.lowercase().contains(q) ||
                (log.note?.lowercase()?.contains(q) == true) ||
                (log.title.author?.lowercase()?.contains(q) == true)
            matchesContent && matchesStatus && matchesPlace && matchesOccasion &&
                matchesPlatform && matchesOrigin && matchesQuery
        }.sortedByDescending { RecordDate.parseInstantMillis(it.watchedAt) }
    }

    val monthGroups = remember(filteredLogs) {
        filteredLogs.groupBy { RecordDate.monthKey(it.watchedAt) }.toList()
    }

    val classificationMap = remember(classifications) {
        classifications.associateBy { it.isbn13 }
    }

    fun loadFutureRecommendations(refresh: Boolean) {
        if (prefsSnapshot.userId.isNullOrBlank()) return
        scope.launch {
            futureLoading = true
            futureError = null
            runCatching {
                repository.api.getRecommendations(
                    refresh = refresh,
                    excluded = prefsSnapshot.dismissedRecommendations
                )
            }.onSuccess {
                futureItems = it
                futureLoading = false
            }.onFailure { err ->
                futureError = err.message
                futureLoading = false
            }
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        // Heading & Tools
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = tr("남겨둔 이야기", "THE STORIES YOU KEPT"),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.mutedInk
                )
                Text(
                    text = if (futureMode) {
                        tr("다가올 타임라인", "Your Future Timeline")
                    } else if (!prefsSnapshot.nickname.isNullOrBlank()) {
                        tr("${prefsSnapshot.nickname}님의 타임라인", "${prefsSnapshot.nickname}'s Timeline")
                    } else {
                        tr("나의 타임라인", "My Timeline")
                    },
                    style = MaterialTheme.typography.headlineMedium,
                    color = palette.ink
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .noSwipeNav()
                        .horizontalScroll(rememberScrollState())
                ) {
                    AssistChip(
                        onClick = onOpenReport,
                        shape = RoundedCornerShape(8.dp),
                        leadingIcon = { Icon(Icons.Outlined.BarChart, contentDescription = null, modifier = Modifier.size(16.dp)) },
                        label = { Text(tr("내 이용 리포트", "My report")) }
                    )
                    AssistChip(
                        onClick = onOpenBookshelf,
                        shape = RoundedCornerShape(8.dp),
                        leadingIcon = { Icon(Icons.Outlined.AutoStories, contentDescription = null, modifier = Modifier.size(16.dp)) },
                        label = { Text(tr("내 서가", "Bookshelf")) }
                    )
                    if (!prefsSnapshot.userId.isNullOrBlank()) {
                        AssistChip(
                            onClick = {
                                futureMode = !futureMode
                                if (futureMode && futureItems.isEmpty()) {
                                    repository.trackEvent("recommendation_open")
                                    loadFutureRecommendations(false)
                                }
                            },
                            shape = RoundedCornerShape(8.dp),
                            leadingIcon = { Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp)) },
                            label = {
                                Text(if (futureMode) tr("타임라인으로 돌아가기", "Back to timeline") else tr("내 미래는?", "What's next?"))
                            }
                        )
                    }
                    if (filteredLogs.isNotEmpty() && !futureMode) {
                        val csvChooser = tr("CSV 내보내기", "Export CSV")
                        AssistChip(
                            onClick = {
                                scope.launch {
                                    val csv = CsvExporter.buildCsv(filteredLogs, locale)
                                    CardExporter.shareCsvText(
                                        context = context,
                                        csvContent = csv,
                                        fileName = "ottline-timeline-${RecordDate.todayInputDate()}.csv",
                                        chooserTitle = csvChooser
                                    )
                                }
                            },
                            shape = RoundedCornerShape(8.dp),
                            leadingIcon = { Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(16.dp)) },
                            label = { Text("CSV") }
                        )
                    }
                }
            }
        }

        if (futureMode) {
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = tr("남겨둔 취향을 바탕으로 고른 다음 이야기예요.", "Picked from the stories you loved."),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = { loadFutureRecommendations(true) }, enabled = !futureLoading) {
                        Icon(Icons.Outlined.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(tr("새로고침", "Refresh"))
                    }
                }
            }

            if (futureLoading) {
                item {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp)
                    ) {
                        CircularProgressIndicator(color = palette.brandNavy)
                    }
                }
            } else if (futureError != null) {
                item {
                    Text(futureError!!, color = palette.danger, style = MaterialTheme.typography.bodySmall)
                }
            } else {
                items(futureItems, key = { it.name }) { rec ->
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(modifier = Modifier.padding(14.dp)) {
                            PosterImage(
                                posterUrl = rec.posterUrl,
                                titleName = rec.name,
                                titleType = rec.type,
                                modifier = Modifier.size(width = 60.dp, height = 86.dp),
                                widthBucket = "w342"
                            )
                            Spacer(Modifier.width(12.dp))
                            Column(
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(rec.name, style = MaterialTheme.typography.titleSmall, color = palette.ink)
                                if (rec.genres.isNotEmpty()) {
                                    Text(
                                        rec.genres.joinToString(" · "),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = palette.brandNavy
                                    )
                                }
                                Text(rec.reason, style = MaterialTheme.typography.bodySmall, color = palette.mutedInk)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(
                                        onClick = {
                                            onOpenQuickRecord(
                                                QuickRecordRequest(
                                                    initialQuery = rec.name,
                                                    initialTypeTab = rec.type.wireValue
                                                )
                                            )
                                        },
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                                    ) {
                                        Text(tr("기록하기", "Log this"))
                                    }
                                    TextButton(
                                        onClick = {
                                            repository.prefs.addDismissedRecommendation(rec.name)
                                            futureItems = futureItems.filterNot { it.name == rec.name }
                                        }
                                    ) {
                                        Text(tr("관심 없음", "Dismiss"), color = palette.subtleInk)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // Search + Content Tabs + Foldable "그날의 순간으로 찾기"
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { q -> onUpdateFilter { it.copy(query = q) } },
                        placeholder = { Text(tr("제목, 저자, 남겨둔 문장으로 검색", "Search title, author, or note")) },
                        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { onUpdateFilter { it.copy(query = "") } }) {
                                    Icon(Icons.Outlined.Close, contentDescription = tr("지우기", "Clear"))
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        listOf(
                            "ALL" to tr("전체", "All"),
                            "VIDEO" to tr("영상", "Video"),
                            "BOOK" to tr("책", "Book")
                        ).forEach { (key, label) ->
                            FilterChip(
                                selected = contentTypeTab == key || (key == "VIDEO" && contentTypeTab in listOf("MOVIE", "SERIES")),
                                onClick = { onUpdateFilter { it.copy(typeFilter = key) } },
                                shape = RoundedCornerShape(8.dp),
                                label = { Text(label) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = palette.brandNavy,
                                    selectedLabelColor = palette.onBrandNavy
                                )
                            )
                        }

                        FilterChip(
                            selected = filterExpanded || activeFilterCount > 0,
                            onClick = { filterExpanded = !filterExpanded },
                            shape = RoundedCornerShape(8.dp),
                            leadingIcon = {
                                Icon(Icons.Outlined.FilterList, contentDescription = null, modifier = Modifier.size(16.dp))
                            },
                            label = {
                                val badge = if (activeFilterCount > 0) " ($activeFilterCount)" else ""
                                Text(tr("그날의 순간으로 찾기$badge", "Moments$badge"))
                            }
                        )
                    }

                    // Active moment chips banner when collapsed so deep-linked filters are immediately visible
                    if (!filterExpanded && activeFilterCount > 0) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            placeFilter?.let { p ->
                                AssistChip(
                                    onClick = { onUpdateFilter { it.copy(placeFilter = null) } },
                                    shape = RoundedCornerShape(8.dp),
                                    label = { Text("${OttlineStrings.placeLabel(p, locale)} ✕") }
                                )
                            }
                            occasionFilter?.let { o ->
                                AssistChip(
                                    onClick = { onUpdateFilter { it.copy(occasionFilter = null) } },
                                    shape = RoundedCornerShape(8.dp),
                                    label = { Text("${OttlineStrings.occasionLabel(o, locale)} ✕") }
                                )
                            }
                            statusFilter?.let { st ->
                                AssistChip(
                                    onClick = { onUpdateFilter { it.copy(statusFilter = "ALL") } },
                                    shape = RoundedCornerShape(8.dp),
                                    label = { Text("${OttlineStrings.statusLabel(st, TitleType.MOVIE, locale)} ✕") }
                                )
                            }
                        }
                    }

                    if (filterExpanded) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = palette.card,
                            border = BorderStroke(1.dp, palette.border),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.padding(14.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = tr("그날의 순간으로 찾기", "Find by the moment"),
                                        style = MaterialTheme.typography.titleSmall,
                                        color = palette.brandNavy
                                    )
                                    if (activeFilterCount > 0) {
                                        TextButton(
                                            onClick = {
                                                onUpdateFilter {
                                                    it.copy(
                                                        statusFilter = "ALL",
                                                        placeFilter = null,
                                                        occasionFilter = null
                                                    )
                                                }
                                                platformFilter = ""
                                                originFilter = "ALL"
                                            },
                                            contentPadding = PaddingValues(0.dp)
                                        ) {
                                            Text(tr("조건 지우기", "Clear all"), color = palette.danger)
                                        }
                                    }
                                }

                                Text(tr("상태", "Status"), style = MaterialTheme.typography.labelMedium, color = palette.mutedInk)
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    val filterTitleType = if (contentTypeTab == "BOOK") TitleType.BOOK else TitleType.MOVIE
                                    LogStatus.entries.forEach { st ->
                                        FilterChip(
                                            selected = statusFilter == st,
                                            onClick = {
                                                onUpdateFilter {
                                                    it.copy(statusFilter = if (statusFilter == st) "ALL" else st.name)
                                                }
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            label = { Text(OttlineStrings.statusLabel(st, filterTitleType, locale)) }
                                        )
                                    }
                                }

                                Text(tr("머문 장소", "Place"), style = MaterialTheme.typography.labelMedium, color = palette.mutedInk)
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Place.entries.forEach { p ->
                                        FilterChip(
                                            selected = placeFilter == p,
                                            onClick = {
                                                onUpdateFilter {
                                                    it.copy(placeFilter = if (placeFilter == p) null else p)
                                                }
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            label = { Text(OttlineStrings.placeLabel(p, locale)) }
                                        )
                                    }
                                }

                                Text(tr("함께한 순간", "Occasion"), style = MaterialTheme.typography.labelMedium, color = palette.mutedInk)
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Occasion.entries.forEach { occ ->
                                        FilterChip(
                                            selected = occasionFilter == occ,
                                            onClick = {
                                                onUpdateFilter {
                                                    it.copy(occasionFilter = if (occasionFilter == occ) null else occ)
                                                }
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            label = { Text(OttlineStrings.occasionLabel(occ, locale)) }
                                        )
                                    }
                                }

                                OutlinedTextField(
                                    value = platformFilter,
                                    onValueChange = { platformFilter = it },
                                    placeholder = { Text(tr("플랫폼·서점 이름 필터 (예: 넷플릭스, 교보)", "Platform or bookstore filter")) },
                                    singleLine = true,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
            }

            if (filteredLogs.isEmpty()) {
                item {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
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
                                text = if (activeFilterCount > 0 || searchQuery.isNotBlank()) {
                                    tr("고른 순간과 일치하는 기록이 아직 없어요.", "No records match these filters.")
                                } else {
                                    tr("아직 남겨둔 타임라인이 없어요.", "Your timeline is waiting for its first story.")
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                color = palette.mutedInk
                            )
                            Button(
                                onClick = { onOpenQuickRecord(QuickRecordRequest()) },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = palette.brandOrange,
                                    contentColor = Color(0xFF0F0F0F)
                                ),
                                modifier = Modifier.heightIn(min = 48.dp)
                            ) {
                                Text(tr("기록 남기기", "Leave a record"), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            } else {
                monthGroups.forEach { (mk, itemsInMonth) ->
                    item(key = "hdr_$mk") {
                        Text(
                            text = "${RecordDate.formatMonthLabel(mk, locale)} · ${itemsInMonth.size}",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = palette.brandNavy,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                    items(itemsInMonth, key = { it.id }) { log ->
                        val kdcLabel = if (locale == "ko" && log.title.type == TitleType.BOOK) {
                            BookshelfBuilder.normalizeBookIsbn13(log.title)
                                ?.let { classificationMap[it] }
                                ?.takeIf { it.status == "RESOLVED" && it.kdcMajor != null }
                                ?.let { OttlineStrings.kdcCategoryTitle(it.kdcMajor!!, locale) }
                        } else null

                        TimelineReadingLogRow(
                            log = log,
                            kdcBadge = kdcLabel,
                            onClick = { onOpenTitleDetail(log.title.id) }
                        )
                    }
                }

                if (nextCursor != null) {
                    item {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp)
                        ) {
                            if (loadMoreError) {
                                Text(
                                    text = tr("이전 기록을 불러오지 못했어요.", "Could not load older records."),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = palette.danger
                                )
                            }
                            OutlinedButton(
                                onClick = {
                                    val cursor = nextCursor ?: return@OutlinedButton
                                    scope.launch {
                                        loadingMore = true
                                        loadMoreError = false
                                        runCatching {
                                            repository.api.getLogsPage(
                                                limit = 50,
                                                cursor = cursor,
                                                contentType = contentTypeTab,
                                                status = statusFilter?.name,
                                                origin = originFilter,
                                                ott = platformFilter.trim().takeIf { it.isNotEmpty() },
                                                place = placeFilter?.name,
                                                occasion = occasionFilter?.name,
                                                query = searchQuery.trim().takeIf { it.isNotEmpty() }
                                            )
                                        }.onSuccess { resp ->
                                            repository.upsertLogsFromServerPage(resp.items)
                                            nextCursor = resp.nextCursor
                                            loadingMore = false
                                        }.onFailure {
                                            loadMoreError = true
                                            loadingMore = false
                                        }
                                    }
                                },
                                shape = RoundedCornerShape(10.dp),
                                enabled = !loadingMore,
                                modifier = Modifier.heightIn(min = 48.dp)
                            ) {
                                Text(if (loadingMore) tr("불러오는 중…", "Loading…") else tr("이전 기록 더 불러오기", "Load older records"))
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Full chronological reading-archive row aligned with `timeline.module.css` (`≤767.98px`):
 * - Independent left date column (weekday + bold day-of-month)
 * - 58×84 poster
 * - Multi-line wrapped Status/Feeling + `FlowRow` Moment items + readable Note paragraph (safe at 320dp & 200% font scale).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TimelineReadingLogRow(
    log: WatchLog,
    onClick: () -> Unit,
    kdcBadge: String? = null
) {
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    var spoilerRevealed by rememberSaveable(log.id) { mutableStateOf(false) }

    val parsedDate = remember(log.watchedAt) {
        runCatching { LocalDate.parse(RecordDate.recordDateInput(log.watchedAt)) }.getOrNull()
    }
    val dayNumber = parsedDate?.dayOfMonth?.toString()?.padStart(2, '0') ?: "--"
    val dowLabel = remember(parsedDate, locale) {
        val javaLoc = if (locale == "en") Locale.ENGLISH else Locale.KOREAN
        parsedDate?.dayOfWeek?.getDisplayName(TextStyle.SHORT, javaLoc).orEmpty()
    }

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            modifier = Modifier.padding(14.dp)
        ) {
            // Editorial Left Date Column
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .widthIn(min = 40.dp)
                    .padding(top = 2.dp)
            ) {
                Text(
                    text = dayNumber,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontSize = 21.sp,
                        lineHeight = 24.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    color = palette.ink,
                    maxLines = 1
                )
                if (dowLabel.isNotBlank()) {
                    Text(
                        text = dowLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.subtleInk,
                        maxLines = 1
                    )
                }
            }

            Spacer(Modifier.width(10.dp))

            PosterImage(
                posterUrl = log.seasonPosterUrl ?: log.title.posterUrl,
                titleName = log.title.name,
                titleType = log.title.type,
                modifier = Modifier.size(width = 58.dp, height = 84.dp),
                widthBucket = "w342"
            )

            Spacer(Modifier.width(12.dp))

            Column(
                verticalArrangement = Arrangement.spacedBy(5.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = log.title.name,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = palette.ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                val statusAccent = if (palette.isDark) palette.ink else palette.brandNavy
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = OttlineStrings.statusLabel(log.status, log.title.type, locale),
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = statusAccent,
                        modifier = Modifier.align(Alignment.CenterVertically)
                    )
                    RecordFeelingBadge(
                        rating = log.rating,
                        titleType = log.title.type,
                        iconSize = 15.dp,
                        textStyle = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                        color = palette.ink,
                        modifier = Modifier.align(Alignment.CenterVertically)
                    )
                    if (log.seasonNumber != null) {
                        val ep = log.episodeNumber?.let { if (locale == "en") " · E$it" else " · ${it}화" }.orEmpty()
                        Text(
                            text = (if (locale == "en") "S${log.seasonNumber}" else "시즌 ${log.seasonNumber}") + ep,
                            style = MaterialTheme.typography.labelMedium,
                            color = palette.mutedInk,
                            modifier = Modifier.align(Alignment.CenterVertically)
                        )
                    }
                }

                val momentChips = buildList {
                    log.place?.let { add(OttlineStrings.placeLabel(it, locale)) }
                    log.occasion?.let { add(OttlineStrings.occasionLabel(it, locale)) }
                    log.ott?.takeIf { it.isNotBlank() }?.let { add(it) }
                    if (!kdcBadge.isNullOrBlank()) add(kdcBadge)
                }
                if (momentChips.isNotEmpty()) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        momentChips.forEach { chip ->
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = palette.paperStrong,
                                border = BorderStroke(1.dp, palette.border)
                            ) {
                                Text(
                                    text = chip,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = palette.brandNavy,
                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                }

                if (!log.note.isNullOrBlank()) {
                    if (log.spoiler && !spoilerRevealed) {
                        Text(
                            text = tr("스포일러 포함 문장 · 눌러서 보기", "Spoiler note · Tap to reveal"),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.subtleInk,
                            modifier = Modifier
                                .clickable { spoilerRevealed = true }
                                .padding(vertical = 2.dp)
                        )
                    } else {
                        Text(
                            text = log.note.trim(),
                            style = MaterialTheme.typography.bodyMedium,
                            color = palette.ink,
                            maxLines = 5,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
