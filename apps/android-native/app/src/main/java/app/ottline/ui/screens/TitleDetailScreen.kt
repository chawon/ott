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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.ottline.data.OttlineRepository
import app.ottline.data.local.PreferencesSnapshot
import app.ottline.data.local.TitleEntity
import app.ottline.data.local.WatchLogHistoryEntity
import app.ottline.domain.RecordDate
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.model.WatchLogHistory
import app.ottline.ui.components.PosterImage
import app.ottline.ui.components.RecordFeelingBadge
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette

/**
 * Story & Personal Moment screen.
 * Enforces the `낙장불입` policy (`AGENTS.md` / F05): individual record deletion is intentionally absent;
 * corrections and evolving thoughts are preserved via `다듬기` (Edit) + `남겨온 기록` (Revision History).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TitleDetailScreen(
    titleId: String,
    allLogs: List<WatchLog>,
    prefsSnapshot: PreferencesSnapshot,
    repository: OttlineRepository,
    onBack: () -> Unit,
    onOpenQuickRecord: (QuickRecordRequest) -> Unit,
    onNavigateToTitle: (String) -> Unit,
    onReportContent: (String) -> Unit
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current

    val reactiveLog = remember(allLogs, titleId) {
        allLogs.firstOrNull { it.title.id == titleId }
    }
    var title by remember(titleId, reactiveLog) { mutableStateOf(reactiveLog?.title) }
    var history by remember { mutableStateOf<List<WatchLogHistory>>(emptyList()) }
    var loading by remember { mutableStateOf(title == null) }
    var shareCardLog by remember { mutableStateOf<WatchLog?>(null) }
    var spoilerRevealed by rememberSaveable(titleId) { mutableStateOf(false) }

    LaunchedEffect(titleId, reactiveLog?.id, reactiveLog?.updatedAt) {
        // 1. Load local Room cache first
        val localTitle = repository.db.titleDao().getById(titleId)?.toModel()
        if (localTitle != null) {
            title = localTitle
            loading = false
        }
        val activeLogId = reactiveLog?.id
            ?: repository.db.watchLogDao().getActiveByTitleId(titleId).firstOrNull()?.id
        val localHist = if (activeLogId != null) {
            repository.db.watchLogHistoryDao().getByLogId(activeLogId, 50).map { it.toModel() }
        } else {
            emptyList()
        }
        if (localHist.isNotEmpty()) {
            history = localHist
        }

        // 2. Refresh from server safely without overwriting local pending/failed changes (F02)
        runCatching { repository.api.getTitle(titleId) }
            .onSuccess { remoteTitle ->
                title = remoteTitle
                repository.db.titleDao().upsert(TitleEntity.fromModel(remoteTitle))
                loading = false
            }
            .onFailure { loading = false }

        if (!prefsSnapshot.userId.isNullOrBlank()) {
            runCatching { repository.api.getLogsByTitle(titleId, 1) }
                .onSuccess { logs ->
                    repository.upsertLogsFromServerPage(logs)
                    val first = logs.firstOrNull()
                    if (first != null) {
                        runCatching { repository.api.getLogHistory(first.id, 50) }
                            .onSuccess { remoteHist ->
                                repository.db.watchLogHistoryDao().upsertAll(
                                    remoteHist.map { WatchLogHistoryEntity.fromModel(it) }
                                )
                                val mergedHist = (localHist + remoteHist)
                                    .distinctBy { it.id }
                                    .sortedByDescending { RecordDate.parseInstantMillis(it.recordedAt) }
                                history = mergedHist
                            }
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = tr("뒤로", "Back"), tint = palette.ink)
                }
                Text(
                    text = tr("작품과 기록", "Story & Moment"),
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.ink
                )
            }
        }

        val currentTitle = title
        if (loading && currentTitle == null) {
            item {
                CircularProgressIndicator(color = palette.brandNavy)
            }
        } else if (currentTitle == null) {
            item {
                Text(tr("작품 정보를 불러오지 못했어요.", "Could not load this title."), color = palette.danger)
            }
        } else {
            // Title Overview Card
            item {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(18.dp)
                    ) {
                        Row(verticalAlignment = Alignment.Top) {
                            PosterImage(
                                posterUrl = reactiveLog?.seasonPosterUrl ?: currentTitle.posterUrl,
                                titleName = currentTitle.name,
                                titleType = currentTitle.type,
                                modifier = Modifier.size(width = 96.dp, height = 138.dp),
                                widthBucket = "w500"
                            )
                            Spacer(Modifier.width(16.dp))
                            Column(
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = OttlineStrings.titleTypeLabel(currentTitle.type, locale),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = palette.mutedInk
                                )
                                Text(
                                    text = currentTitle.name,
                                    style = MaterialTheme.typography.headlineSmall,
                                    color = palette.ink
                                )
                                val meta = listOfNotNull(
                                    currentTitle.year?.toString(),
                                    currentTitle.author,
                                    currentTitle.publisher,
                                    currentTitle.directors?.takeIf { it.isNotEmpty() }?.joinToString(", ")
                                ).joinToString(" · ")
                                if (meta.isNotEmpty()) {
                                    Text(meta, style = MaterialTheme.typography.bodySmall, color = palette.mutedInk)
                                }
                                if (!currentTitle.genres.isNullOrEmpty()) {
                                    Text(
                                        text = currentTitle.genres.joinToString(" · "),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = palette.brandNavy
                                    )
                                }
                            }
                        }

                        if (!currentTitle.overview.isNullOrBlank()) {
                            Text(
                                text = currentTitle.overview,
                                style = MaterialTheme.typography.bodySmall,
                                color = palette.mutedInk
                            )
                        }
                    }
                }
            }

            // Personal Record ("그날의 온기") Card
            item {
                val log = reactiveLog
                if (log == null) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = palette.paperStrong,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.padding(18.dp)
                        ) {
                            Text(
                                text = tr("아직 내 타임라인에 남기지 않은 작품이에요.", "Not in your timeline yet."),
                                style = MaterialTheme.typography.titleSmall,
                                color = palette.ink
                            )
                            Button(
                                onClick = {
                                    onOpenQuickRecord(
                                        QuickRecordRequest(
                                            preselectedTitle = currentTitle,
                                            autoFocusSearch = false
                                        )
                                    )
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = palette.brandOrange,
                                    contentColor = Color(0xFF0F0F0F)
                                ),
                                modifier = Modifier.heightIn(min = 48.dp)
                            ) {
                                Text(tr("이 작품 기록 남기기", "Leave a record"), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                } else {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = palette.paperStrong,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.padding(18.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = tr("그날의 온기", "A moment kept"),
                                    style = MaterialTheme.typography.titleMedium,
                                    color = palette.brandNavy
                                )
                                Text(
                                    text = RecordDate.formatDisplayDate(log.watchedAt, locale),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = palette.subtleInk
                                )
                            }

                            val statusAccent = if (palette.isDark) palette.ink else palette.brandNavy
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = OttlineStrings.statusLabel(log.status, currentTitle.type, locale),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = statusAccent,
                                    modifier = Modifier.align(Alignment.CenterVertically)
                                )
                                RecordFeelingBadge(
                                    rating = log.rating,
                                    titleType = currentTitle.type,
                                    iconSize = 16.dp,
                                    textStyle = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Medium),
                                    color = palette.ink,
                                    modifier = Modifier.align(Alignment.CenterVertically)
                                )
                                if (log.seasonNumber != null) {
                                    val ep = log.episodeNumber?.let { if (locale == "en") " · Ep $it" else " · ${it}화" }.orEmpty()
                                    Text(
                                        text = (if (locale == "en") "Season ${log.seasonNumber}" else "시즌 ${log.seasonNumber}") + ep,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = palette.mutedInk,
                                        modifier = Modifier.align(Alignment.CenterVertically)
                                    )
                                }
                            }

                            val momentDetails = listOfNotNull(
                                log.ott?.takeIf { it.isNotBlank() }?.let { tr("플랫폼", "Platform") to it },
                                log.place?.let { tr("장소", "Place") to OttlineStrings.placeLabel(it, locale) },
                                log.occasion?.let { tr("함께한 순간", "Occasion") to OttlineStrings.occasionLabel(it, locale) }
                            )
                            if (momentDetails.isNotEmpty()) {
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    momentDetails.forEach { (k, v) ->
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = palette.card,
                                            border = BorderStroke(1.dp, palette.border)
                                        ) {
                                            Text(
                                                text = "$k · $v",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = palette.ink,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                            )
                                        }
                                    }
                                }
                            }

                            if (!log.note.isNullOrBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = palette.card,
                                    border = BorderStroke(1.dp, palette.border),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .then(
                                            if (log.spoiler && !spoilerRevealed) {
                                                Modifier.clickable { spoilerRevealed = true }
                                            } else {
                                                Modifier
                                            }
                                        )
                                ) {
                                    if (log.spoiler && !spoilerRevealed) {
                                        Text(
                                            text = tr("스포일러가 포함된 문장이에요 · 눌러서 보기", "Spoiler note · Tap to reveal"),
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = palette.mutedInk,
                                            modifier = Modifier.padding(14.dp)
                                        )
                                    } else {
                                        Text(
                                            text = log.note.trim(),
                                            style = MaterialTheme.typography.bodyLarge,
                                            color = palette.ink,
                                            modifier = Modifier.padding(14.dp)
                                        )
                                    }
                                }
                            }

                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Button(
                                    onClick = {
                                        onOpenQuickRecord(
                                            QuickRecordRequest(
                                                preselectedTitle = currentTitle,
                                                existingLog = log,
                                                autoFocusSearch = false
                                            )
                                        )
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = palette.brandNavy,
                                        contentColor = palette.onBrandNavy
                                    ),
                                    modifier = Modifier
                                        .weight(1f)
                                        .heightIn(min = 48.dp)
                                ) {
                                    Icon(Icons.Outlined.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(tr("다듬기", "Edit"), fontWeight = FontWeight.Bold)
                                }

                                OutlinedButton(
                                    onClick = { shareCardLog = log },
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier
                                        .weight(1f)
                                        .heightIn(min = 48.dp)
                                ) {
                                    Icon(Icons.Outlined.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(tr("공유 카드", "Share card"))
                                }
                            }
                        }
                    }
                }
            }

            // Revision History ("남겨온 기록")
            if (history.size > 1) {
                item {
                    Text(
                        text = tr("남겨온 기록 (${history.size})", "Revision history (${history.size})"),
                        style = MaterialTheme.typography.titleSmall,
                        color = palette.ink
                    )
                }
                items(history, key = { it.id }) { h ->
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(12.dp)
                        ) {
                            val statusAccent = if (palette.isDark) palette.ink else palette.brandNavy
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "${RecordDate.formatDisplayDate(h.watchedAt, locale)} · ${OttlineStrings.statusLabel(h.status, currentTitle.type, locale)}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = statusAccent,
                                    modifier = Modifier.align(Alignment.CenterVertically)
                                )
                                RecordFeelingBadge(
                                    rating = h.rating,
                                    titleType = currentTitle.type,
                                    iconSize = 14.dp,
                                    textStyle = MaterialTheme.typography.labelMedium,
                                    color = palette.ink,
                                    modifier = Modifier.align(Alignment.CenterVertically)
                                )
                                h.ott?.takeIf { it.isNotBlank() }?.let { ottText ->
                                    Text(
                                        text = "· $ottText",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = palette.mutedInk,
                                        modifier = Modifier.align(Alignment.CenterVertically)
                                    )
                                }
                            }
                            if (!h.note.isNullOrBlank()) {
                                Text(h.note, style = MaterialTheme.typography.bodySmall, color = palette.mutedInk)
                            }
                        }
                    }
                }
            }

            // Together Comments Section
            item {
                CommentsSection(
                    titleId = currentTitle.id,
                    titleType = currentTitle.type,
                    repository = repository,
                    onOpenMentionedTitle = onNavigateToTitle,
                    onReportComment = onReportContent
                )
            }
        }
    }

    shareCardLog?.let { target ->
        ShareCardDialog(
            log = target,
            nickname = prefsSnapshot.nickname,
            personaKey = prefsSnapshot.personaKey,
            onDismiss = { shareCardLog = null },
            onExported = { mode ->
                repository.trackEvent("share_card_export", mapOf("mode" to mode))
            }
        )
    }
}
