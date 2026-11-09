package app.ottline.ui.screens

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.AutoAwesome
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.ottline.data.OttlineRepository
import app.ottline.data.local.PreferencesSnapshot
import app.ottline.domain.RecordDate
import app.ottline.model.Comment
import app.ottline.model.CreateCommentRequest
import app.ottline.model.CuratedContent
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
import app.ottline.ui.components.PosterImage
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun TogetherScreen(
    prefsSnapshot: PreferencesSnapshot,
    repository: OttlineRepository,
    onOpenDiscussion: (String) -> Unit,
    onOpenTitleDetail: (String) -> Unit,
    onReportContent: (String) -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current

    var discussions by remember { mutableStateOf<List<DiscussionListItem>>(emptyList()) }
    var curatedItems by remember { mutableStateOf<List<CuratedContent>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var sortMode by remember { mutableStateOf("latest") } // "latest" | "comments"

    LaunchedEffect(locale) {
        loading = true
        loadError = false
        val discJob = runCatching { repository.api.getDiscussionsAll(100) }
        val curJob = runCatching { repository.api.getCuratedContents(6) }
        discJob.onSuccess { discussions = it }.onFailure { loadError = true }
        curJob.onSuccess { list ->
            curatedItems = list
            list.forEach { item ->
                repository.trackEvent(
                    "curated_impression",
                    mapOf(
                        "curatedContentId" to item.id,
                        "titleId" to item.titleId,
                        "actorType" to "ai_curator",
                        "placement" to "public"
                    )
                )
            }
        }
        loading = false
    }

    val filteredDiscussions = remember(discussions, searchQuery, sortMode) {
        val q = searchQuery.trim().lowercase()
        val base = if (q.isEmpty()) {
            discussions
        } else {
            discussions.filter { it.titleName.lowercase().contains(q) }
        }
        if (sortMode == "comments") {
            base.sortedByDescending { it.commentCount }
        } else {
            base.sortedByDescending { RecordDate.parseInstantMillis(it.createdAt) }
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = tr("함께 나누는 이야기", "STORIES, SHARED"),
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.mutedInk
                )
                Text(
                    text = tr("같은 이야기, 다른 마음", "Same story, different feelings"),
                    style = MaterialTheme.typography.headlineMedium,
                    color = palette.ink
                )
                Text(
                    text = tr("같은 작품에서 만난 장면과 생각을 조용히 나눠요.", "Share the scenes and thoughts that stayed with you."),
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.mutedInk
                )
            }
        }

        // AI Curator Section (clearly labeled AI 운영 계정)
        if (curatedItems.isNotEmpty()) {
            item {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = palette.paperStrong,
                    border = BorderStroke(1.dp, palette.brandNavy.copy(alpha = 0.25f)),
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
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                Icon(
                                    imageVector = Icons.Outlined.AutoAwesome,
                                    contentDescription = null,
                                    tint = palette.brandNavy,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = tr("큐레이터의 질문", "Curator's prompt"),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = palette.ink
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = palette.card,
                                border = BorderStroke(1.dp, palette.border)
                            ) {
                                Text(
                                    text = tr("AI 운영 계정", "AI Curator"),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = palette.brandNavy,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }

                        curatedItems.take(3).forEach { item ->
                            Surface(
                                onClick = {
                                    repository.trackEvent(
                                        "curated_open",
                                        mapOf(
                                            "curatedContentId" to item.id,
                                            "titleId" to item.titleId,
                                            "actorType" to "ai_curator",
                                            "placement" to "public"
                                        )
                                    )
                                    onOpenTitleDetail(item.titleId)
                                },
                                shape = RoundedCornerShape(14.dp),
                                color = palette.card,
                                border = BorderStroke(1.dp, palette.border),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.padding(12.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        PosterImage(
                                            posterUrl = item.posterUrl,
                                            titleName = item.titleName,
                                            titleType = item.titleType,
                                            modifier = Modifier.size(width = 40.dp, height = 56.dp),
                                            widthBucket = "w342"
                                        )
                                        Spacer(Modifier.width(10.dp))
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = item.titleName,
                                                style = MaterialTheme.typography.titleSmall,
                                                color = palette.ink,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            val meta = listOfNotNull(
                                                item.titleYear?.toString(),
                                                item.actorDisplayName.takeIf { it.isNotBlank() }
                                            ).joinToString(" · ")
                                            if (meta.isNotEmpty()) {
                                                Text(meta, style = MaterialTheme.typography.labelSmall, color = palette.mutedInk)
                                            }
                                        }
                                    }
                                    Text(item.body, style = MaterialTheme.typography.bodyMedium, color = palette.ink)
                                    if (item.disclosure.isNotBlank()) {
                                        Text(item.disclosure, style = MaterialTheme.typography.labelSmall, color = palette.subtleInk)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Search & Sort Controls
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text(tr("작품 이름으로 이야기 찾기", "Search stories by title")) },
                    leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Outlined.Close, contentDescription = tr("지우기", "Clear"))
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = sortMode == "latest",
                        onClick = { sortMode = "latest" },
                        label = { Text(tr("최신순", "Latest")) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = palette.brandNavy,
                            selectedLabelColor = palette.onBrandNavy
                        )
                    )
                    FilterChip(
                        selected = sortMode == "comments",
                        onClick = { sortMode = "comments" },
                        label = { Text(tr("이야기 많은 순", "Most comments")) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = palette.brandNavy,
                            selectedLabelColor = palette.onBrandNavy
                        )
                    )
                }
            }
        }

        if (loading) {
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
                    text = tr("함께 화면을 불러오지 못했어요. 네트워크 연결을 확인해 주세요.", "Could not load public discussions."),
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.danger
                )
            }
        } else if (filteredDiscussions.isEmpty()) {
            item {
                Text(
                    text = tr("아직 열린 이야기가 없어요.", "No stories match your search yet."),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedInk
                )
            }
        } else {
            items(filteredDiscussions, key = { it.id }) { item ->
                Surface(
                    onClick = { onOpenDiscussion(item.id) },
                    shape = RoundedCornerShape(16.dp),
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
    var detail by remember { mutableStateOf<DiscussionListItem?>(null) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(discussionId) {
        loading = true
        errorMsg = null
        runCatching { repository.api.getDiscussionById(discussionId) }
            .onSuccess { detail = it; loading = false }
            .onFailure { errorMsg = it.message; loading = false }
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
                    shape = RoundedCornerShape(18.dp),
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
fun DiscussionReactionChipsBar(
    discussionId: String,
    title: Title,
    initialSummary: DiscussionReactionSummary?,
    hasUser: Boolean,
    repository: OttlineRepository
) {
    val locale = LocalAppLocale.current
    val scope = rememberCoroutineScope()
    val isBook = title.type == TitleType.BOOK

    var summary by remember(initialSummary) {
        mutableStateOf(initialSummary ?: DiscussionReactionSummary())
    }
    var selectedTypes by remember { mutableStateOf<Set<DiscussionReactionType>>(emptySet()) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(discussionId, hasUser) {
        if (!hasUser) return@LaunchedEffect
        runCatching { repository.api.getMyReactions(discussionId) }
            .onSuccess { state ->
                summary = state.summary
                selectedTypes = state.selectedTypes.toSet()
            }
    }

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
            val selected = type in selectedTypes
            FilterChip(
                selected = selected,
                enabled = !busy,
                onClick = {
                    scope.launch {
                        busy = true
                        runCatching {
                            repository.ensureAuthenticated()
                            repository.api.toggleReaction(discussionId, type)
                        }.onSuccess { res ->
                            summary = res.summary
                            val nextSet = res.selectedTypes.toSet()
                            val newlySelected = type in nextSet && type !in selectedTypes
                            selectedTypes = nextSet

                            // Auto-create local log if user tapped DONE or SAVE and doesn't have a log yet
                            if (newlySelected && (type == DiscussionReactionType.DONE || type == DiscussionReactionType.SAVE)) {
                                val existingLocal = repository.db.watchLogDao().getActiveByTitleId(title.id)
                                if (existingLocal.isEmpty()) {
                                    repository.saveLogForTitle(
                                        rawTitle = title,
                                        draft = LogDraft(
                                            status = if (type == DiscussionReactionType.DONE) LogStatus.DONE else LogStatus.WISHLIST,
                                            watchedAt = RecordDate.nowIso()
                                        ),
                                        awaitSync = false
                                    )
                                }
                            }
                        }
                        busy = false
                    }
                },
                label = {
                    val countPart = if (count > 0) " $count" else ""
                    Text("$label$countPart")
                }
            )
        }
    }
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

    var discussion by remember(initialDiscussionId, titleId) {
        mutableStateOf(initialDiscussionId?.let { Discussion(id = it, titleId = titleId) })
    }
    var comments by remember { mutableStateOf<List<Comment>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var bodyText by remember { mutableStateOf("") }
    var syncToTimeline by remember { mutableStateOf(false) }
    var posting by remember { mutableStateOf(false) }
    var postError by remember { mutableStateOf<String?>(null) }

    // `@` Title Mention picker
    var showMentionSearch by remember { mutableStateOf(false) }
    var mentionQuery by remember { mutableStateOf("") }
    var mentionCandidates by remember { mutableStateOf<List<TitleSearchItem>>(emptyList()) }
    val selectedMentions = remember { mutableStateListOf<MentionRef>() }

    LaunchedEffect(titleId, initialDiscussionId) {
        loading = true
        val resolvedDisc = if (initialDiscussionId != null) {
            Discussion(id = initialDiscussionId, titleId = titleId)
        } else {
            repository.api.getDiscussionByTitle(titleId)
        }
        discussion = resolvedDisc
        if (resolvedDisc != null) {
            runCatching { repository.api.getComments(resolvedDisc.id, 200) }
                .onSuccess { comments = it }
        } else {
            comments = emptyList()
        }
        loading = false
    }

    LaunchedEffect(mentionQuery, showMentionSearch) {
        if (!showMentionSearch || mentionQuery.trim().isEmpty()) {
            mentionCandidates = emptyList()
            return@LaunchedEffect
        }
        delay(250)
        runCatching { repository.api.searchTitles(mentionQuery.trim(), null) }
            .onSuccess { mentionCandidates = it.take(5) }
    }

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
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )

            if (selectedMentions.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    selectedMentions.forEach { m ->
                        AssistChip(
                            onClick = { selectedMentions.remove(m) },
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
                        scope.launch {
                            posting = true
                            postError = null
                            runCatching {
                                repository.ensureAuthenticated()
                                val disc = discussion ?: repository.api.createDiscussion(titleId).also {
                                    discussion = it
                                }
                                repository.api.createComment(
                                    discussionId = disc.id,
                                    req = CreateCommentRequest(
                                        body = trimmed,
                                        mentions = selectedMentions.toList(),
                                        syncLog = syncToTimeline
                                    )
                                )
                            }.onSuccess { created ->
                                comments = comments + created
                                bodyText = ""
                                selectedMentions.clear()
                                if (syncToTimeline) repository.triggerSyncAsync()
                                posting = false
                            }.onFailure { err ->
                                postError = err.message
                                posting = false
                            }
                        }
                    },
                    enabled = bodyText.trim().isNotEmpty() && !posting,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = palette.brandNavy,
                        contentColor = palette.onBrandNavy
                    )
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
                    Surface(
                        shape = RoundedCornerShape(12.dp),
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
                                    text = c.authorName.ifBlank { tr("익명의 기록가", "Anonymous reader") },
                                    style = MaterialTheme.typography.labelMedium,
                                    color = palette.brandNavy
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = RecordDate.formatDisplayDate(c.createdAt, LocalAppLocale.current),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = palette.subtleInk
                                    )
                                    IconButton(
                                        onClick = {
                                            onReportComment("[댓글 신고] 작성자: ${c.authorName} / ID: ${c.id}\n내용: ${c.body.take(120)}")
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
                                text = c.body,
                                style = MaterialTheme.typography.bodyMedium,
                                color = palette.ink
                            )
                        }
                    }
                }
            }
        }
    }
}
