package app.ottline.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.ottline.data.OttlineRepository
import app.ottline.data.local.PreferencesSnapshot
import app.ottline.domain.RecordDate
import app.ottline.domain.TogetherDetailPaneState
import app.ottline.domain.TogetherDetailSession
import app.ottline.domain.TogetherFilterHelper
import app.ottline.model.Comment
import app.ottline.model.CreateCommentRequest
import app.ottline.model.Discussion
import app.ottline.model.DiscussionListItem
import app.ottline.model.DiscussionReactionSummary
import app.ottline.model.DiscussionReactionType
import app.ottline.model.LogDraft
import app.ottline.model.LogStatus
import app.ottline.model.MentionRef
import app.ottline.model.Title
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.ui.TogetherFilterState
import app.ottline.ui.components.PosterImage
import app.ottline.ui.components.noSwipeNav
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.layout.LocalAdaptiveLayoutMetrics
import app.ottline.ui.theme.LocalOttlinePalette
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

/**
 * Together ("함께") screen:
 * - Curator prompts, queries, and events are fully retired.
 * - Adapts by live window width (`LocalAdaptiveLayoutMetrics`):
 *   - `>= 700dp` (tablets & unfolded foldables): macOS/iPad-aligned two-pane layout with independent
 *     scrollable list (left) and race-safe title/reactions/comments reader (right).
 *   - `< 700dp` (phones, folded or narrow split windows): single-column list navigating to `DiscussionDetailScreen`.
 */
@Composable
fun TogetherScreen(
    prefsSnapshot: PreferencesSnapshot,
    repository: OttlineRepository,
    filterState: TogetherFilterState = TogetherFilterState(),
    onUpdateFilter: ((TogetherFilterState) -> TogetherFilterState) -> Unit = {},
    onOpenDiscussion: (String) -> Unit,
    onOpenTitleDetail: (String) -> Unit,
    onReportContent: (String) -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val metrics = LocalAdaptiveLayoutMetrics.current

    var discussions by remember { mutableStateOf<List<DiscussionListItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf(false) }

    LaunchedEffect(locale) {
        loading = true
        loadError = false
        runCatching { repository.api.getDiscussionsAll(100) }
            .onSuccess { discussions = it }
            .onFailure { loadError = true }
        loading = false
    }

    val filteredDiscussions = remember(
        discussions,
        filterState.query,
        filterState.contentType,
        filterState.sortMode
    ) {
        TogetherFilterHelper.filterAndSort(
            discussions = discussions,
            query = filterState.query,
            contentType = filterState.contentType,
            sortMode = filterState.sortMode
        )
    }

    val listState = rememberLazyListState(
        initialFirstVisibleItemIndex = filterState.scrollIndex,
        initialFirstVisibleItemScrollOffset = filterState.scrollOffset
    )
    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset }
            .distinctUntilChanged()
            .collect { (idx, offset) ->
                if (filterState.scrollIndex != idx || filterState.scrollOffset != offset) {
                    onUpdateFilter { it.copy(scrollIndex = idx, scrollOffset = offset) }
                }
            }
    }

    if (metrics.togetherTwoPane) {
        val selectedDiscussion = remember(filteredDiscussions, filterState.selectedDiscussionId) {
            TogetherFilterHelper.resolveSelectedDiscussion(
                filtered = filteredDiscussions,
                selectedDiscussionId = filterState.selectedDiscussionId
            )
        }

        LaunchedEffect(selectedDiscussion?.id) {
            val resolvedId = selectedDiscussion?.id
            if (resolvedId != null && filterState.selectedDiscussionId != resolvedId) {
                onUpdateFilter { it.copy(selectedDiscussionId = resolvedId) }
            }
        }

        val detailSession = remember(repository) {
            TogetherDetailSession(
                api = repository.api,
                ensureAuthenticated = { repository.ensureAuthenticated() }
            )
        }
        DisposableEffect(detailSession) {
            onDispose { detailSession.close() }
        }

        val detailState by detailSession.state.collectAsState()
        val hasUser = !prefsSnapshot.userId.isNullOrBlank()
        LaunchedEffect(selectedDiscussion?.id, hasUser, locale) {
            detailSession.selectDiscussion(selectedDiscussion, hasUser)
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = metrics.horizontalPadding, vertical = 16.dp)
        ) {
            // Left Pane: Header, Search, Type & Sort Filters, Independent Scrollable List
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .width(metrics.togetherLeftPaneWidth)
                    .fillMaxHeight()
            ) {
                TogetherHeadingBlock(compact = true)
                TogetherFilterControls(
                    query = filterState.query,
                    contentType = filterState.contentType,
                    sortMode = filterState.sortMode,
                    onQueryChange = { q -> onUpdateFilter { it.copy(query = q) } },
                    onContentTypeChange = { t -> onUpdateFilter { it.copy(contentType = t) } },
                    onSortModeChange = { s -> onUpdateFilter { it.copy(sortMode = s) } }
                )

                LazyColumn(
                    state = listState,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 24.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    if (loading && discussions.isEmpty()) {
                        item {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 32.dp)
                            ) {
                                CircularProgressIndicator(color = palette.brandNavy)
                            }
                        }
                    } else if (loadError && discussions.isEmpty()) {
                        item {
                            Text(
                                text = tr(
                                    "함께 화면을 불러오지 못했어요. 네트워크 연결을 확인해 주세요.",
                                    "Could not load public discussions."
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = palette.danger
                            )
                        }
                    } else if (filteredDiscussions.isEmpty()) {
                        item {
                            TogetherEmptyFilterCard(
                                hasActiveFilter = filterState.query.isNotBlank() || filterState.contentType != "ALL",
                                onResetFilters = {
                                    onUpdateFilter { it.copy(query = "", contentType = "ALL") }
                                }
                            )
                        }
                    } else {
                        items(filteredDiscussions, key = { it.id }) { item ->
                            val isSelected = selectedDiscussion?.id == item.id
                            TogetherSpreadListRow(
                                item = item,
                                selected = isSelected,
                                onClick = {
                                    onUpdateFilter { it.copy(selectedDiscussionId = item.id) }
                                }
                            )
                        }
                    }
                }
            }

            // Quiet vertical divider between list and reader pane
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .fillMaxHeight()
                    .background(palette.border.copy(alpha = 0.7f))
            )

            // Right Pane: Selected Title, Reactions & Race-Safe Comments Reader
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            ) {
                if (selectedDiscussion == null) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = palette.paperStrong,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = if (loading) {
                                tr("이야기를 불러오고 있어요.", "Loading shared stories.")
                            } else {
                                tr("왼쪽에서 작품을 고르면 이곳에서 이야기를 읽고 남길 수 있어요.", "Choose a story on the left to read and share thoughts here.")
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = palette.mutedInk,
                            modifier = Modifier.padding(24.dp)
                        )
                    }
                } else {
                    TogetherDetailPane(
                        discussion = selectedDiscussion,
                        detailState = detailState,
                        detailSession = detailSession,
                        repository = repository,
                        onOpenTitleDetail = onOpenTitleDetail,
                        onReportContent = onReportContent,
                        onCommentPosted = { postedDiscussionId ->
                            discussions = discussions.map { existing ->
                                if (existing.id == postedDiscussionId) {
                                    existing.copy(commentCount = existing.commentCount + 1)
                                } else {
                                    existing
                                }
                            }
                        }
                    )
                }
            }
        }
    } else {
        // Compact single-column phone/folded layout
        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(horizontal = metrics.horizontalPadding, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item {
                TogetherHeadingBlock(compact = false)
            }

            item {
                TogetherFilterControls(
                    query = filterState.query,
                    contentType = filterState.contentType,
                    sortMode = filterState.sortMode,
                    onQueryChange = { q -> onUpdateFilter { it.copy(query = q) } },
                    onContentTypeChange = { t -> onUpdateFilter { it.copy(contentType = t) } },
                    onSortModeChange = { s -> onUpdateFilter { it.copy(sortMode = s) } }
                )
            }

            if (loading && discussions.isEmpty()) {
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
            } else if (loadError && discussions.isEmpty()) {
                item {
                    Text(
                        text = tr(
                            "함께 화면을 불러오지 못했어요. 네트워크 연결을 확인해 주세요.",
                            "Could not load public discussions."
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.danger
                    )
                }
            } else if (filteredDiscussions.isEmpty()) {
                item {
                    TogetherEmptyFilterCard(
                        hasActiveFilter = filterState.query.isNotBlank() || filterState.contentType != "ALL",
                        onResetFilters = {
                            onUpdateFilter { it.copy(query = "", contentType = "ALL") }
                        }
                    )
                }
            } else {
                items(filteredDiscussions, key = { it.id }) { item ->
                    Surface(
                        onClick = { onOpenDiscussion(item.id) },
                        shape = RoundedCornerShape(8.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.padding(14.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                PosterImage(
                                    posterUrl = item.posterUrl,
                                    titleName = item.titleName,
                                    titleType = item.titleType,
                                    modifier = Modifier.size(width = 52.dp, height = 74.dp),
                                    widthBucket = "w342"
                                )
                                Spacer(Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = item.titleName,
                                        style = MaterialTheme.typography.titleMedium,
                                        color = palette.ink,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    val sub = listOfNotNull(
                                        OttlineStrings.titleTypeLabel(item.titleType, locale),
                                        item.titleYear?.toString(),
                                        tr("댓글 ${item.commentCount}개", "${item.commentCount} comments")
                                    ).joinToString(" · ")
                                    Text(sub, style = MaterialTheme.typography.bodySmall, color = palette.mutedInk)
                                }
                                IconButton(
                                    onClick = {
                                        onReportContent("[함께 대화방 신고] ${item.titleName} (ID: ${item.id})")
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Flag,
                                        contentDescription = tr("신고", "Report"),
                                        tint = palette.subtleInk,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }

                            DiscussionReactionChipsBar(
                                discussionId = item.id,
                                title = Title(
                                    id = item.titleId,
                                    type = item.titleType,
                                    name = item.titleName,
                                    year = item.titleYear,
                                    posterUrl = item.posterUrl,
                                    provider = item.titleProvider,
                                    providerId = item.titleProviderId
                                ),
                                initialSummary = item.reactionSummary,
                                hasUser = !prefsSnapshot.userId.isNullOrBlank(),
                                repository = repository
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TogetherHeadingBlock(compact: Boolean) {
    val palette = LocalOttlinePalette.current
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = tr("함께 나누는 이야기", "STORIES, SHARED"),
            style = MaterialTheme.typography.labelSmall,
            color = palette.mutedInk
        )
        Text(
            text = tr("같은 이야기, 다른 마음", "Same story, different feelings"),
            style = if (compact) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.headlineMedium,
            color = palette.ink
        )
        if (!compact) {
            Text(
                text = tr(
                    "같은 작품에서 만난 장면과 생각을 조용히 나눠요.",
                    "Share the scenes and thoughts that stayed with you."
                ),
                style = MaterialTheme.typography.bodySmall,
                color = palette.mutedInk
            )
        }
    }
}

@Composable
private fun TogetherFilterControls(
    query: String,
    contentType: String,
    sortMode: String,
    onQueryChange: (String) -> Unit,
    onContentTypeChange: (String) -> Unit,
    onSortModeChange: (String) -> Unit
) {
    val palette = LocalOttlinePalette.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            placeholder = { Text(tr("작품 이름으로 이야기 찾기", "Search stories by title")) },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
            trailingIcon = {
                if (query.isNotEmpty()) {
                    IconButton(onClick = { onQueryChange("") }) {
                        Icon(Icons.Outlined.Close, contentDescription = tr("지우기", "Clear"))
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth()
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .noSwipeNav()
                .horizontalScroll(rememberScrollState())
        ) {
            listOf(
                "ALL" to tr("전체", "All"),
                "MOVIE" to tr("영화", "Movie"),
                "SERIES" to tr("시리즈", "Series"),
                "BOOK" to tr("책", "Book")
            ).forEach { (key, label) ->
                val chipSelected = contentType == key
                FilterChip(
                    selected = chipSelected,
                    onClick = { onContentTypeChange(key) },
                    shape = RoundedCornerShape(8.dp),
                    label = {
                        Text(
                            text = label,
                            fontWeight = if (chipSelected) FontWeight.SemiBold else FontWeight.Medium
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = palette.card,
                        labelColor = palette.mutedInk,
                        selectedContainerColor = palette.paperStrong,
                        selectedLabelColor = palette.brandNavy
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = chipSelected,
                        borderColor = palette.border,
                        selectedBorderColor = palette.brandNavy,
                        borderWidth = 1.dp,
                        selectedBorderWidth = 1.dp
                    )
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val latestSelected = sortMode == "latest"
            FilterChip(
                selected = latestSelected,
                onClick = { onSortModeChange("latest") },
                shape = RoundedCornerShape(8.dp),
                label = {
                    Text(
                        text = tr("최신순", "Latest"),
                        fontWeight = if (latestSelected) FontWeight.SemiBold else FontWeight.Medium
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    containerColor = palette.card,
                    labelColor = palette.mutedInk,
                    selectedContainerColor = palette.paperStrong,
                    selectedLabelColor = palette.brandNavy
                ),
                border = FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = latestSelected,
                    borderColor = palette.border,
                    selectedBorderColor = palette.brandNavy,
                    borderWidth = 1.dp,
                    selectedBorderWidth = 1.dp
                )
            )
            val commentsSelected = sortMode == "comments"
            FilterChip(
                selected = commentsSelected,
                onClick = { onSortModeChange("comments") },
                shape = RoundedCornerShape(8.dp),
                label = {
                    Text(
                        text = tr("이야기 많은 순", "Most comments"),
                        fontWeight = if (commentsSelected) FontWeight.SemiBold else FontWeight.Medium
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    containerColor = palette.card,
                    labelColor = palette.mutedInk,
                    selectedContainerColor = palette.paperStrong,
                    selectedLabelColor = palette.brandNavy
                ),
                border = FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = commentsSelected,
                    borderColor = palette.border,
                    selectedBorderColor = palette.brandNavy,
                    borderWidth = 1.dp,
                    selectedBorderWidth = 1.dp
                )
            )
        }
    }
}

@Composable
private fun TogetherEmptyFilterCard(
    hasActiveFilter: Boolean,
    onResetFilters: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = if (hasActiveFilter) {
                    tr("조건에 맞는 이야기가 아직 없어요.", "No stories match your filter yet.")
                } else {
                    tr("아직 열린 이야기가 없어요.", "No shared stories yet.")
                },
                style = MaterialTheme.typography.bodyMedium,
                color = palette.mutedInk
            )
            if (hasActiveFilter) {
                OutlinedButton(
                    onClick = onResetFilters,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.heightIn(min = 48.dp)
                ) {
                    Text(tr("전체 보기", "Show all"))
                }
            }
        }
    }
}

@Composable
private fun TogetherSpreadListRow(
    item: DiscussionListItem,
    selected: Boolean,
    onClick: () -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val selectedBorderColor = if (palette.isDark) palette.ink else palette.brandNavy

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = if (selected) palette.paperStrong else palette.card,
        border = BorderStroke(
            width = if (selected) 1.5.dp else 1.dp,
            color = if (selected) selectedBorderColor else palette.border
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(10.dp)
        ) {
            PosterImage(
                posterUrl = item.posterUrl,
                titleName = item.titleName,
                titleType = item.titleType,
                modifier = Modifier.size(width = 44.dp, height = 64.dp),
                widthBucket = "w342"
            )
            Spacer(Modifier.width(10.dp))
            Column(
                verticalArrangement = Arrangement.spacedBy(3.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = item.titleName,
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold
                    ),
                    color = palette.ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                val sub = listOfNotNull(
                    OttlineStrings.titleTypeLabel(item.titleType, locale),
                    item.titleYear?.toString(),
                    tr("이야기 ${item.commentCount}", "${item.commentCount} comments")
                ).joinToString(" · ")
                Text(
                    text = sub,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (selected) selectedBorderColor else palette.mutedInk,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TogetherDetailPane(
    discussion: DiscussionListItem,
    detailState: TogetherDetailPaneState,
    detailSession: TogetherDetailSession,
    repository: OttlineRepository,
    onOpenTitleDetail: (String) -> Unit,
    onReportContent: (String) -> Unit,
    onCommentPosted: (String) -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val titleModel = remember(discussion) {
        Title(
            id = discussion.titleId,
            type = discussion.titleType,
            name = discussion.titleName,
            year = discussion.titleYear,
            posterUrl = discussion.posterUrl,
            provider = discussion.titleProvider,
            providerId = discussion.titleProviderId
        )
    }

    key(discussion.id) {
        val detailScrollState = rememberLazyListState()
        var bodyText by remember(discussion.id) { mutableStateOf("") }
        var syncToTimeline by remember(discussion.id) { mutableStateOf(false) }
        var showMentionSearch by remember(discussion.id) { mutableStateOf(false) }
        var mentionQuery by remember(discussion.id) { mutableStateOf("") }
        var mentionCandidates by remember(discussion.id) { mutableStateOf<List<TitleSearchItem>>(emptyList()) }
        val selectedMentions = remember(discussion.id) { mutableStateListOf<MentionRef>() }

        LaunchedEffect(discussion.id, mentionQuery, showMentionSearch) {
            if (!showMentionSearch || mentionQuery.trim().isEmpty()) {
                mentionCandidates = emptyList()
                return@LaunchedEffect
            }
            delay(250)
            runCatching { repository.api.searchTitles(mentionQuery.trim(), null) }
                .onSuccess { mentionCandidates = it.take(5) }
        }

        LazyColumn(
            state = detailScrollState,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 28.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            // Selected Title Summary & Reactions Card
            item(key = "detail_header_${discussion.id}") {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.Top) {
                            PosterImage(
                                posterUrl = discussion.posterUrl,
                                titleName = discussion.titleName,
                                titleType = discussion.titleType,
                                modifier = Modifier.size(width = 68.dp, height = 98.dp),
                                widthBucket = "w342"
                            )
                            Spacer(Modifier.width(14.dp))
                            Column(
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = discussion.titleName,
                                    style = MaterialTheme.typography.titleLarge,
                                    color = palette.ink
                                )
                                Text(
                                    text = listOfNotNull(
                                        OttlineStrings.titleTypeLabel(discussion.titleType, locale),
                                        discussion.titleYear?.toString()
                                    ).joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = palette.mutedInk
                                )
                                TextButton(
                                    onClick = { onOpenTitleDetail(discussion.titleId) },
                                    contentPadding = PaddingValues(0.dp)
                                ) {
                                    Text(
                                        text = tr("작품 상세 · 내 기록 보기 →", "View title & my record →"),
                                        color = palette.brandNavy
                                    )
                                }
                            }
                            IconButton(
                                onClick = {
                                    onReportContent("[함께 대화방 신고] ${discussion.titleName} (ID: ${discussion.id})")
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Flag,
                                    contentDescription = tr("신고", "Report"),
                                    tint = palette.subtleInk,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        val isBook = discussion.titleType == TitleType.BOOK
                        val summary = if (detailState.discussionId == discussion.id) {
                            detailState.summary
                        } else {
                            discussion.reactionSummary ?: DiscussionReactionSummary()
                        }
                        val selectedTypes = if (detailState.discussionId == discussion.id) {
                            detailState.selectedReactions
                        } else {
                            emptySet()
                        }
                        val busy = detailState.discussionId == discussion.id && detailState.reactionBusy

                        ReactionChipsRow(
                            isBook = isBook,
                            summary = summary,
                            selectedTypes = selectedTypes,
                            busy = busy,
                            onToggle = { type ->
                                detailSession.toggleReaction(
                                    discussionId = discussion.id,
                                    type = type,
                                    onNewlySelectedLogTrigger = { newlySelectedType ->
                                        if (newlySelectedType == DiscussionReactionType.DONE ||
                                            newlySelectedType == DiscussionReactionType.SAVE
                                        ) {
                                            val existingLocal = repository.db.watchLogDao().getActiveByTitleId(titleModel.id)
                                            if (existingLocal.isEmpty()) {
                                                repository.saveLogForTitle(
                                                    rawTitle = titleModel,
                                                    draft = LogDraft(
                                                        status = if (newlySelectedType == DiscussionReactionType.DONE) {
                                                            LogStatus.DONE
                                                        } else {
                                                            LogStatus.WISHLIST
                                                        },
                                                        watchedAt = RecordDate.nowIso()
                                                    ),
                                                    awaitSync = false
                                                )
                                            }
                                        }
                                    }
                                )
                            }
                        )
                    }
                }
            }

            // Race-Safe Comments Composer & List Card
            item(key = "detail_comments_${discussion.id}") {
                val activeComments = if (detailState.discussionId == discussion.id) {
                    detailState.comments
                } else {
                    emptyList()
                }
                val commentsLoading = detailState.discussionId != discussion.id || detailState.commentsLoading
                val posting = detailState.discussionId == discussion.id && detailState.postingComment
                val postError = if (detailState.discussionId == discussion.id) detailState.postError else null

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = tr(
                                "함께 나누는 생각 (${activeComments.size})",
                                "Shared thoughts (${activeComments.size})"
                            ),
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.ink
                        )

                        OutlinedTextField(
                            value = bodyText,
                            onValueChange = { bodyText = it.take(1000) },
                            placeholder = {
                                Text(tr("이 작품에서 남은 장면을 나눠보세요.", "Share a thought or scene from this title."))
                            },
                            minLines = 2,
                            maxLines = 5,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        if (selectedMentions.isNotEmpty()) {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                selectedMentions.forEach { m ->
                                    AssistChip(
                                        onClick = { selectedMentions.remove(m) },
                                        shape = RoundedCornerShape(8.dp),
                                        label = { Text("@${m.name} ×") }
                                    )
                                }
                            }
                        }

                        if (showMentionSearch) {
                            OutlinedTextField(
                                value = mentionQuery,
                                onValueChange = { mentionQuery = it },
                                placeholder = { Text(tr("함께 언급할 작품 제목 검색", "Search title to @mention")) },
                                singleLine = true,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            )
                            mentionCandidates.forEach { cand ->
                                Text(
                                    text = "+ @${cand.name} (${cand.year ?: ""})",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = palette.brandNavy,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            val ref = MentionRef(
                                                provider = cand.provider,
                                                providerId = cand.providerId,
                                                titleType = cand.type,
                                                name = cand.name
                                            )
                                            if (selectedMentions.none { it.providerId == ref.providerId }) {
                                                selectedMentions.add(ref)
                                            }
                                            if (!bodyText.contains("@${cand.name}")) {
                                                bodyText = (bodyText + " @${cand.name} ").trimStart()
                                            }
                                            showMentionSearch = false
                                            mentionQuery = ""
                                        }
                                        .padding(vertical = 4.dp)
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                TextButton(
                                    onClick = { showMentionSearch = !showMentionSearch },
                                    contentPadding = PaddingValues(horizontal = 6.dp)
                                ) {
                                    Icon(Icons.Outlined.AlternateEmail, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(tr("작품 언급", "Mention"))
                                }
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.clickable { syncToTimeline = !syncToTimeline }
                                ) {
                                    Checkbox(checked = syncToTimeline, onCheckedChange = { syncToTimeline = it })
                                    Text(
                                        text = tr("내 기록에도 반영", "Also log"),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = palette.mutedInk
                                    )
                                }
                            }

                            Button(
                                onClick = {
                                    val trimmed = bodyText.trim()
                                    if (trimmed.isEmpty() || posting) return@Button
                                    val syncFlag = syncToTimeline
                                    detailSession.postComment(
                                        discussionId = discussion.id,
                                        titleId = discussion.titleId,
                                        body = trimmed,
                                        mentions = selectedMentions.toList(),
                                        syncLog = syncFlag,
                                        onPosted = {
                                            bodyText = ""
                                            selectedMentions.clear()
                                            if (syncFlag) repository.triggerSyncAsync()
                                            onCommentPosted(discussion.id)
                                        }
                                    )
                                },
                                enabled = bodyText.trim().isNotEmpty() && !posting,
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = palette.brandOrange,
                                    contentColor = palette.onBrandOrange
                                ),
                                modifier = Modifier.heightIn(min = 48.dp)
                            ) {
                                Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(tr("남기기", "Post"), fontWeight = FontWeight.Bold)
                            }
                        }

                        if (postError != null) {
                            Text(postError, style = MaterialTheme.typography.bodySmall, color = palette.danger)
                        }

                        if (commentsLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = palette.brandNavy)
                        } else if (activeComments.isEmpty()) {
                            Text(
                                text = tr("첫 번째 감상을 조용히 남겨보세요.", "Be the first to leave a thought."),
                                style = MaterialTheme.typography.bodySmall,
                                color = palette.mutedInk
                            )
                        } else {
                            activeComments.forEach { comment ->
                                CommentItemCard(
                                    comment = comment,
                                    onReportComment = onReportContent
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DiscussionDetailScreen(
    discussionId: String,
    prefsSnapshot: PreferencesSnapshot,
    repository: OttlineRepository,
    onBack: () -> Unit,
    onOpenTitleDetail: (String) -> Unit,
    onReportContent: (String) -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val metrics = LocalAdaptiveLayoutMetrics.current
    var detail by remember(discussionId) { mutableStateOf<DiscussionListItem?>(null) }
    var loading by remember(discussionId) { mutableStateOf(true) }
    var errorMsg by remember(discussionId) { mutableStateOf<String?>(null) }
    val latestDiscussionId by rememberUpdatedState(discussionId)

    LaunchedEffect(discussionId) {
        val targetId = discussionId
        loading = true
        errorMsg = null
        runCatching { repository.api.getDiscussionById(targetId) }
            .onSuccess {
                if (latestDiscussionId == targetId) {
                    detail = it
                    loading = false
                }
            }
            .onFailure {
                if (latestDiscussionId == targetId) {
                    errorMsg = it.message
                    loading = false
                }
            }
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = metrics.horizontalPadding, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = tr("뒤로", "Back"), tint = palette.ink)
                }
                Text(
                    text = tr("함께 나누는 이야기", "Discussion"),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.ink
                )
            }
        }

        if (loading) {
            item {
                CircularProgressIndicator(color = palette.brandNavy)
            }
        } else if (errorMsg != null || detail == null) {
            item {
                Text(
                    text = errorMsg ?: tr("대화방을 찾을 수 없어요.", "Discussion not found."),
                    color = palette.danger
                )
            }
        } else {
            val d = detail!!
            item {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            PosterImage(
                                posterUrl = d.posterUrl,
                                titleName = d.titleName,
                                titleType = d.titleType,
                                modifier = Modifier.size(width = 64.dp, height = 92.dp),
                                widthBucket = "w342"
                            )
                            Spacer(Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(d.titleName, style = MaterialTheme.typography.titleLarge, color = palette.ink)
                                Text(
                                    text = listOfNotNull(
                                        OttlineStrings.titleTypeLabel(d.titleType, locale),
                                        d.titleYear?.toString()
                                    ).joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = palette.mutedInk
                                )
                                TextButton(
                                    onClick = { onOpenTitleDetail(d.titleId) },
                                    contentPadding = PaddingValues(0.dp)
                                ) {
                                    Text(tr("작품 상세 · 내 기록 보기 →", "View title & my record →"), color = palette.brandNavy)
                                }
                            }
                        }

                        DiscussionReactionChipsBar(
                            discussionId = d.id,
                            title = Title(
                                id = d.titleId,
                                type = d.titleType,
                                name = d.titleName,
                                year = d.titleYear,
                                posterUrl = d.posterUrl,
                                provider = d.titleProvider,
                                providerId = d.titleProviderId
                            ),
                            initialSummary = d.reactionSummary,
                            hasUser = !prefsSnapshot.userId.isNullOrBlank(),
                            repository = repository
                        )
                    }
                }
            }

            item {
                CommentsSection(
                    titleId = d.titleId,
                    titleType = d.titleType,
                    initialDiscussionId = d.id,
                    repository = repository,
                    onOpenMentionedTitle = onOpenTitleDetail,
                    onReportComment = onReportContent
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReactionChipsRow(
    isBook: Boolean,
    summary: DiscussionReactionSummary,
    selectedTypes: Set<DiscussionReactionType>,
    busy: Boolean,
    onToggle: (DiscussionReactionType) -> Unit
) {
    val chips = listOf(
        Triple(
            DiscussionReactionType.DONE,
            if (isBook) tr("나도 읽었어요", "Read too") else tr("나도 봤어요", "Watched too"),
            summary.done
        ),
        Triple(
            DiscussionReactionType.CURIOUS,
            tr("궁금해요", "Curious"),
            summary.curious
        ),
        Triple(
            DiscussionReactionType.SAVE,
            tr("저장해둘래요", "Save"),
            summary.save
        )
    )

    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        chips.forEach { (type, label, count) ->
            FilterChip(
                selected = type in selectedTypes,
                enabled = !busy,
                shape = RoundedCornerShape(8.dp),
                onClick = { onToggle(type) },
                label = {
                    val countPart = if (count > 0) " $count" else ""
                    Text("$label$countPart")
                }
            )
        }
    }
}

@Composable
fun DiscussionReactionChipsBar(
    discussionId: String,
    title: Title,
    initialSummary: DiscussionReactionSummary?,
    hasUser: Boolean,
    repository: OttlineRepository
) {
    val scope = rememberCoroutineScope()
    val isBook = title.type == TitleType.BOOK
    val latestDiscussionId by rememberUpdatedState(discussionId)

    var summary by remember(discussionId, initialSummary) {
        mutableStateOf(initialSummary ?: DiscussionReactionSummary())
    }
    var selectedTypes by remember(discussionId) { mutableStateOf<Set<DiscussionReactionType>>(emptySet()) }
    var busy by remember(discussionId) { mutableStateOf(false) }

    LaunchedEffect(discussionId, hasUser) {
        val targetId = discussionId
        if (!hasUser) {
            selectedTypes = emptySet()
            return@LaunchedEffect
        }
        runCatching { repository.api.getMyReactions(targetId) }
            .onSuccess { state ->
                if (latestDiscussionId == targetId) {
                    summary = state.summary
                    selectedTypes = state.selectedTypes.toSet()
                }
            }
    }

    ReactionChipsRow(
        isBook = isBook,
        summary = summary,
        selectedTypes = selectedTypes,
        busy = busy,
        onToggle = { type ->
            val targetId = discussionId
            val targetTitle = title
            val prevSelected = selectedTypes
            scope.launch {
                busy = true
                runCatching {
                    repository.ensureAuthenticated()
                    repository.api.toggleReaction(targetId, type)
                }.onSuccess { res ->
                    val nextSet = res.selectedTypes.toSet()
                    val newlySelected = type in nextSet && type !in prevSelected
                    if (latestDiscussionId == targetId) {
                        summary = res.summary
                        selectedTypes = nextSet
                    }
                    if (newlySelected && (type == DiscussionReactionType.DONE || type == DiscussionReactionType.SAVE)) {
                        val existingLocal = repository.db.watchLogDao().getActiveByTitleId(targetTitle.id)
                        if (existingLocal.isEmpty()) {
                            repository.saveLogForTitle(
                                rawTitle = targetTitle,
                                draft = LogDraft(
                                    status = if (type == DiscussionReactionType.DONE) LogStatus.DONE else LogStatus.WISHLIST,
                                    watchedAt = RecordDate.nowIso()
                                ),
                                awaitSync = false
                            )
                        }
                    }
                }
                if (latestDiscussionId == targetId) {
                    busy = false
                }
            }
        }
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CommentsSection(
    titleId: String,
    titleType: TitleType,
    initialDiscussionId: String? = null,
    repository: OttlineRepository,
    onOpenMentionedTitle: ((String) -> Unit)? = null,
    onReportComment: (String) -> Unit
) {
    val palette = LocalOttlinePalette.current
    val scope = rememberCoroutineScope()
    val targetKey = "$titleId:${initialDiscussionId.orEmpty()}"
    val latestTargetKey by rememberUpdatedState(targetKey)

    var discussion by remember(targetKey) {
        mutableStateOf(initialDiscussionId?.let { Discussion(id = it, titleId = titleId) })
    }
    var comments by remember(targetKey) { mutableStateOf<List<Comment>>(emptyList()) }
    var loading by remember(targetKey) { mutableStateOf(true) }
    var bodyText by remember(targetKey) { mutableStateOf("") }
    var syncToTimeline by remember(targetKey) { mutableStateOf(false) }
    var posting by remember(targetKey) { mutableStateOf(false) }
    var postError by remember(targetKey) { mutableStateOf<String?>(null) }

    // `@` Title Mention picker
    var showMentionSearch by remember(targetKey) { mutableStateOf(false) }
    var mentionQuery by remember(targetKey) { mutableStateOf("") }
    var mentionCandidates by remember(targetKey) { mutableStateOf<List<TitleSearchItem>>(emptyList()) }
    val selectedMentions = remember(targetKey) { mutableStateListOf<MentionRef>() }

    LaunchedEffect(targetKey) {
        val capturedKey = targetKey
        loading = true
        val resolvedDisc = if (initialDiscussionId != null) {
            Discussion(id = initialDiscussionId, titleId = titleId)
        } else {
            repository.api.getDiscussionByTitle(titleId)
        }
        if (latestTargetKey != capturedKey) return@LaunchedEffect
        discussion = resolvedDisc
        if (resolvedDisc != null) {
            runCatching { repository.api.getComments(resolvedDisc.id, 200) }
                .onSuccess {
                    if (latestTargetKey == capturedKey) {
                        comments = it
                    }
                }
        } else {
            comments = emptyList()
        }
        if (latestTargetKey == capturedKey) {
            loading = false
        }
    }

    LaunchedEffect(targetKey, mentionQuery, showMentionSearch) {
        if (!showMentionSearch || mentionQuery.trim().isEmpty()) {
            mentionCandidates = emptyList()
            return@LaunchedEffect
        }
        val capturedKey = targetKey
        delay(250)
        runCatching { repository.api.searchTitles(mentionQuery.trim(), null) }
            .onSuccess {
                if (latestTargetKey == capturedKey) {
                    mentionCandidates = it.take(5)
                }
            }
    }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = tr("함께 나누는 생각 (${comments.size})", "Shared thoughts (${comments.size})"),
                style = MaterialTheme.typography.titleMedium,
                color = palette.ink
            )

            // Composer
            OutlinedTextField(
                value = bodyText,
                onValueChange = { bodyText = it.take(1000) },
                placeholder = {
                    Text(tr("이 작품에서 남은 장면을 나눠보세요.", "Share a thought or scene from this title."))
                },
                minLines = 2,
                maxLines = 5,
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            )

            if (selectedMentions.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    selectedMentions.forEach { m ->
                        AssistChip(
                            onClick = { selectedMentions.remove(m) },
                            shape = RoundedCornerShape(8.dp),
                            label = { Text("@${m.name} ×") }
                        )
                    }
                }
            }

            if (showMentionSearch) {
                OutlinedTextField(
                    value = mentionQuery,
                    onValueChange = { mentionQuery = it },
                    placeholder = { Text(tr("함께 언급할 작품 제목 검색", "Search title to @mention")) },
                    singleLine = true,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                mentionCandidates.forEach { cand ->
                    Text(
                        text = "+ @${cand.name} (${cand.year ?: ""})",
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.brandNavy,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                val ref = MentionRef(
                                    provider = cand.provider,
                                    providerId = cand.providerId,
                                    titleType = cand.type,
                                    name = cand.name
                                )
                                if (selectedMentions.none { it.providerId == ref.providerId }) {
                                    selectedMentions.add(ref)
                                }
                                if (!bodyText.contains("@${cand.name}")) {
                                    bodyText = (bodyText + " @${cand.name} ").trimStart()
                                }
                                showMentionSearch = false
                                mentionQuery = ""
                            }
                            .padding(vertical = 4.dp)
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(
                        onClick = { showMentionSearch = !showMentionSearch },
                        contentPadding = PaddingValues(horizontal = 6.dp)
                    ) {
                        Icon(Icons.Outlined.AlternateEmail, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(tr("작품 언급", "Mention"))
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { syncToTimeline = !syncToTimeline }
                    ) {
                        Checkbox(checked = syncToTimeline, onCheckedChange = { syncToTimeline = it })
                        Text(
                            text = tr("내 기록에도 반영", "Also log"),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.mutedInk
                        )
                    }
                }

                Button(
                    onClick = {
                        val trimmed = bodyText.trim()
                        if (trimmed.isEmpty() || posting) return@Button
                        val capturedKey = targetKey
                        val capturedMentions = selectedMentions.toList()
                        val capturedSync = syncToTimeline
                        scope.launch {
                            posting = true
                            postError = null
                            runCatching {
                                repository.ensureAuthenticated()
                                val disc = discussion ?: repository.api.createDiscussion(titleId).also {
                                    if (latestTargetKey == capturedKey) discussion = it
                                }
                                repository.api.createComment(
                                    discussionId = disc.id,
                                    req = CreateCommentRequest(
                                        body = trimmed,
                                        mentions = capturedMentions,
                                        syncLog = capturedSync
                                    )
                                )
                            }.onSuccess { created ->
                                if (latestTargetKey == capturedKey) {
                                    comments = comments + created
                                    bodyText = ""
                                    selectedMentions.clear()
                                    if (capturedSync) repository.triggerSyncAsync()
                                    posting = false
                                }
                            }.onFailure { err ->
                                if (latestTargetKey == capturedKey) {
                                    postError = err.message
                                    posting = false
                                }
                            }
                        }
                    },
                    enabled = bodyText.trim().isNotEmpty() && !posting,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.brandOrange,
                        contentColor = palette.onBrandOrange
                    ),
                    modifier = Modifier.heightIn(min = 48.dp)
                ) {
                    Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(tr("남기기", "Post"), fontWeight = FontWeight.Bold)
                }
            }

            if (postError != null) {
                Text(postError!!, style = MaterialTheme.typography.bodySmall, color = palette.danger)
            }

            if (loading) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = palette.brandNavy)
            } else if (comments.isEmpty()) {
                Text(
                    text = tr("첫 번째 감상을 조용히 남겨보세요.", "Be the first to leave a thought."),
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.mutedInk
                )
            } else {
                comments.forEach { c ->
                    CommentItemCard(
                        comment = c,
                        onReportComment = onReportComment
                    )
                }
            }
        }
    }
}

@Composable
private fun CommentItemCard(
    comment: Comment,
    onReportComment: (String) -> Unit
) {
    val palette = LocalOttlinePalette.current
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = palette.paperStrong,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = comment.authorName.ifBlank { tr("익명의 기록가", "Anonymous reader") },
                    style = MaterialTheme.typography.labelMedium,
                    color = palette.brandNavy
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = RecordDate.formatDisplayDate(comment.createdAt, LocalAppLocale.current),
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.subtleInk
                    )
                    IconButton(
                        onClick = {
                            onReportComment("[댓글 신고] 작성자: ${comment.authorName} / ID: ${comment.id}\n내용: ${comment.body.take(120)}")
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Flag,
                            contentDescription = tr("신고", "Report"),
                            tint = palette.subtleInk,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
            Text(
                text = comment.body,
                style = MaterialTheme.typography.bodyMedium,
                color = palette.ink
            )
        }
    }
}
