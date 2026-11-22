package app.ottline.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.ottline.data.FutureTimelineUiState
import app.ottline.data.local.TwaBrowserBridge
import app.ottline.model.Provider
import app.ottline.model.RecommendationItem
import app.ottline.model.RecommendationQuota
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.ui.components.PosterImage
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.delay

private val FUTURE_LOADING_MESSAGES_KO = listOf(
    "남겨둔 이야기를 펼쳐보고 있어요.",
    "마음에 남았던 작품들을 살펴보고 있어요.",
    "다음에 만날 이야기를 고르고 있어요.",
    "미래의 타임라인을 준비하고 있어요.",
    "작품의 표지를 불러오고 있어요."
)

private val FUTURE_LOADING_MESSAGES_EN = listOf(
    "Looking through the stories you kept.",
    "Revisiting the titles that stayed with you.",
    "Finding a few stories you might enjoy.",
    "Putting your future timeline together.",
    "Bringing in the covers."
)

internal fun formatRecommendationResetTime(quota: RecommendationQuota, locale: String): String {
    val raw = quota.resetsAt.trim()
    if (raw.isEmpty()) return ""
    return runCatching {
        val zone = runCatching { ZoneId.of(quota.timezone.ifBlank { "Asia/Seoul" }) }
            .getOrDefault(ZoneId.of("Asia/Seoul"))
        val zoned = OffsetDateTime.parse(raw).atZoneSameInstant(zone)
        val pattern = if (locale == "en") "MMM d, HH:mm" else "M월 d일 HH:mm"
        val javaLocale = if (locale == "en") Locale.ENGLISH else Locale.KOREAN
        zoned.format(DateTimeFormatter.ofPattern(pattern, javaLocale))
    }.getOrDefault(raw)
}

internal fun googleBooksAttributionUrl(item: TitleSearchItem?): String? {
    if (item == null || item.provider != Provider.GOOGLE_BOOKS) return null
    val source = item.sourceUrl?.trim()?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
    return source ?: item.providerId.trim().takeIf { it.isNotEmpty() }?.let {
        "https://books.google.com/books?id=$it"
    }
}

@OptIn(ExperimentalLayoutApi::class)
fun LazyListScope.futureTimelineItems(
    state: FutureTimelineUiState,
    visibleItems: List<RecommendationItem>,
    onGenerate: () -> Unit,
    onRetry: () -> Unit,
    onSyncRetry: () -> Unit,
    onOpenItem: (RecommendationItem) -> Unit,
    onDismissItem: (RecommendationItem) -> Unit,
    onUndoDismiss: () -> Unit
) {
    // Controls, quota, and data disclosure
    item(key = "future_header_controls") {
        val locale = LocalAppLocale.current
        val palette = LocalOttlinePalette.current
        val quota = state.quota
        val resetLabel = remember(quota?.resetsAt, quota?.timezone, locale) {
            quota?.let { formatRecommendationResetTime(it, locale) }.orEmpty()
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = tr(
                    "추천을 새로 받으면 최근 기록의 작품·종류·장르·느낌과 적어둔 메모·장소·상황, 추천에서 뺀 작품명을 OpenAI에 보내요.",
                    "When you request new stories, OpenAI receives your recent titles, types, genres, feelings, any notes, places or occasions, and excluded titles."
                ),
                style = MaterialTheme.typography.bodySmall,
                color = palette.mutedInk
            )

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedButton(
                    onClick = onGenerate,
                    enabled = state.canRefresh,
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(
                        1.dp,
                        if (state.canRefresh) palette.border else palette.mutedBg
                    ),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                    modifier = Modifier.heightIn(min = 48.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Refresh,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = tr("다른 이야기 펼쳐보기", "Explore other stories"),
                        style = MaterialTheme.typography.labelLarge
                    )
                }

                if (quota != null) {
                    val quotaText = if (quota.remaining > 0) {
                        tr(
                            "오늘 ${quota.remaining}번 더 펼쳐볼 수 있어요.",
                            "You can explore ${quota.remaining} more times today."
                        )
                    } else {
                        tr(
                            "오늘은 세 번의 이야기를 모두 펼쳐봤어요.",
                            "You've explored three times today."
                        )
                    }
                    Text(
                        text = quotaText,
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk,
                        modifier = Modifier
                            .align(Alignment.CenterVertically)
                            .semantics { liveRegion = LiveRegionMode.Polite }
                    )
                }
            }

            if (quota != null && quota.remaining == 0 && resetLabel.isNotBlank()) {
                Text(
                    text = tr(
                        "한국 시간 ${resetLabel}에 다시 펼쳐볼 수 있어요.",
                        "You can explore again at $resetLabel (Korea time)."
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.subtleInk
                )
            }

            Text(
                text = tr(
                    "지금 남기는 기록은 다음 이야기를 고를 때 함께 살펴봐요.",
                    "The records you keep now will help us choose your next stories."
                ),
                style = MaterialTheme.typography.bodySmall,
                color = palette.subtleInk
            )
        }
    }

    // Undo banner after dismissing an item
    if (state.lastDismissed != null) {
        item(key = "future_undo_banner") {
            val palette = LocalOttlinePalette.current
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = palette.paperStrong,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = tr(
                            "이 작품은 추천에서 빼두었어요.",
                            "This title is hidden from your recommendations."
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.ink,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    OutlinedButton(
                        onClick = onUndoDismiss,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                        modifier = Modifier.heightIn(min = 48.dp)
                    ) {
                        Text(tr("되돌리기", "Undo"), style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }
    }

    // Offline pending exclusion/restore banner
    if (state.pendingCount > 0 || state.syncError) {
        item(key = "future_sync_banner") {
            val palette = LocalOttlinePalette.current
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = palette.paperStrong,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = tr(
                            "이 기기에서 먼저 바꿨어요. 연결되면 다른 기기에도 이어둘게요.",
                            "Kept on this device first. We'll carry the change to your other devices when connected."
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    OutlinedButton(
                        onClick = onSyncRetry,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                        modifier = Modifier.heightIn(min = 48.dp)
                    ) {
                        Text(tr("다시 불러오기", "Try again"), style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }
    }

    // Loading state: preserve existing items below while loading a refresh/recovery; show skeletons when empty.
    if (state.loading) {
        item(key = "future_loading_status") {
            FutureLoadingStatusBanner(showSkeletons = visibleItems.isEmpty())
        }
    }

    // Error banner: keep previous items visible below so users never lose already-fetched stories.
    if (!state.loading && state.error != null) {
        item(key = "future_error_banner") {
            val palette = LocalOttlinePalette.current
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = palette.paperStrong,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = tr(
                            "다음 이야기를 불러오지 못했어요. 잠시 뒤 다시 만나볼까요?",
                            "Could not bring in the next stories. Please try again in a little while."
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.ink
                    )
                    OutlinedButton(
                        onClick = onRetry,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                        modifier = Modifier.heightIn(min = 48.dp)
                    ) {
                        Text(
                            text = tr("다시 불러오기", "Try again"),
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            }
        }
    }

    // Empty / need-more-logs state
    if (!state.loading && state.error == null && state.server != null && visibleItems.isEmpty()) {
        item(key = "future_empty_state") {
            val palette = LocalOttlinePalette.current
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = palette.paperStrong,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = if (state.eligible) {
                        tr(
                            "아직 펼쳐볼 작품이 없어요. 나중에 다시 만나요.",
                            "No stories to open just yet. Come back another time."
                        )
                    } else {
                        tr(
                            "기록이 5개 모이면 다음에 만날 이야기도 펼쳐볼 수 있어요.",
                            "With five records, you can explore a few stories to meet next."
                        )
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.mutedInk,
                    modifier = Modifier.padding(24.dp)
                )
            }
        }
    }

    // Recommendation cards (kept visible during refresh/recovery or error)
    if (visibleItems.isNotEmpty()) {
        items(
            items = visibleItems,
            key = { rec ->
                "rec:${rec.type.wireValue}:${rec.provider?.name.orEmpty()}:${rec.providerId ?: rec.name}"
            }
        ) { rec ->
            FutureRecommendationCard(
                item = rec,
                onOpen = { onOpenItem(rec) },
                onDismiss = { onDismissItem(rec) }
            )
        }
    }
}

@Composable
private fun FutureLoadingStatusBanner(showSkeletons: Boolean) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val messages = if (locale == "en") FUTURE_LOADING_MESSAGES_EN else FUTURE_LOADING_MESSAGES_KO
    var msgIndex by remember(locale) { mutableIntStateOf(0) }

    LaunchedEffect(locale) {
        while (true) {
            delay(2_000L)
            msgIndex = (msgIndex + 1) % messages.size
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = palette.paperStrong,
            border = BorderStroke(1.dp, palette.border),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)
            ) {
                CircularProgressIndicator(
                    color = palette.brandNavy,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = messages[msgIndex],
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.mutedInk
                )
            }
        }

        if (showSkeletons) {
            repeat(3) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(modifier = Modifier.padding(14.dp)) {
                        Box(
                            modifier = Modifier
                                .size(width = 64.dp, height = 96.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(palette.mutedBg)
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.7f)
                                    .height(16.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(palette.mutedBg)
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.35f)
                                    .height(12.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(palette.mutedBg)
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(12.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(palette.mutedBg)
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.8f)
                                    .height(12.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(palette.mutedBg)
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FutureRecommendationCard(
    item: RecommendationItem,
    onOpen: () -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val googleUrl = remember(item.catalogTitle) { googleBooksAttributionUrl(item.catalogTitle) }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            modifier = Modifier.padding(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onOpen)
            ) {
                PosterImage(
                    posterUrl = item.posterUrl,
                    titleName = item.name,
                    titleType = item.type,
                    modifier = Modifier.size(width = 64.dp, height = 96.dp),
                    widthBucket = "w342"
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.ink,
                    modifier = Modifier.clickable(onClick = onOpen)
                )

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = palette.sageAccent
                    ) {
                        Text(
                            text = OttlineStrings.titleTypeLabel(item.type, locale),
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.mutedInk,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                    item.year?.let { year ->
                        Text(
                            text = year.toString(),
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.subtleInk,
                            modifier = Modifier.align(Alignment.CenterVertically)
                        )
                    }
                    item.genres.take(3).forEach { genre ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = palette.mutedBg
                        ) {
                            Text(
                                text = genre,
                                style = MaterialTheme.typography.labelSmall,
                                color = palette.mutedInk,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                }

                if (!item.author.isNullOrBlank()) {
                    Text(
                        text = item.author,
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.subtleInk
                    )
                }

                if (item.reason.isNotBlank()) {
                    Text(
                        text = item.reason,
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.mutedInk
                    )
                }

                if (googleUrl != null) {
                    TextButton(
                        onClick = { TwaBrowserBridge.launchInExternalCustomTab(context, googleUrl) },
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(
                            text = "Google Books",
                            style = MaterialTheme.typography.labelSmall,
                            color = palette.brandNavy
                        )
                        Spacer(Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.OpenInNew,
                            contentDescription = null,
                            tint = palette.brandNavy,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 2.dp)
                ) {
                    OutlinedButton(
                        onClick = onOpen,
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, palette.brandNavy.copy(alpha = 0.45f)),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                        modifier = Modifier.heightIn(min = 48.dp)
                    ) {
                        Text(
                            text = if (item.type == TitleType.BOOK) {
                                tr("읽고 싶어요", "Want to read")
                            } else {
                                tr("보고 싶어요", "Want to watch")
                            },
                            style = MaterialTheme.typography.labelLarge,
                            color = palette.brandNavy
                        )
                    }
                    OutlinedButton(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, palette.border),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                        modifier = Modifier.heightIn(min = 48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Close,
                            contentDescription = null,
                            tint = palette.subtleInk,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = tr("이미 본·읽은 작품", "Already seen or read"),
                            style = MaterialTheme.typography.labelMedium,
                            color = palette.subtleInk
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun FutureCatalogPickerDialog(
    targetItem: RecommendationItem,
    candidates: List<TitleSearchItem>,
    loading: Boolean,
    error: Boolean,
    onRetry: () -> Unit,
    onSelectCandidate: (TitleSearchItem) -> Unit,
    onSearchManually: () -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val palette = LocalOttlinePalette.current
    val isBook = targetItem.type == TitleType.BOOK

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = palette.card,
            border = BorderStroke(1.dp, palette.border),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 24.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 16.dp, top = 16.dp, end = 8.dp, bottom = 12.dp)
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = if (isBook) {
                                tr("어떤 판본으로 남겨둘까요?", "Which edition would you like to keep?")
                            } else {
                                tr("남겨둘 작품을 골라주세요.", "Choose the title you'd like to keep.")
                            },
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.ink
                        )
                        Text(
                            text = if (isBook) {
                                tr(
                                    "표지와 저자, 출판사를 보고 남겨둘 책을 골라요.",
                                    "Check the cover, author, and publisher to choose your book."
                                )
                            } else {
                                tr(
                                    "제목과 연도를 확인하고 만날 작품을 골라요.",
                                    "Check the title and year to find the story you have in mind."
                                )
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.mutedInk
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Outlined.Close,
                            contentDescription = tr("작품 고르기 닫기", "Close title choices"),
                            tint = palette.mutedInk
                        )
                    }
                }

                HorizontalDivider(color = palette.border)

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 160.dp, max = 440.dp)
                        .padding(16.dp)
                ) {
                    when {
                        loading -> {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.align(Alignment.Center)
                            ) {
                                CircularProgressIndicator(
                                    color = palette.brandNavy,
                                    strokeWidth = 2.dp,
                                    modifier = Modifier.size(20.dp)
                                )
                                Text(
                                    text = tr("작품 정보를 불러오고 있어요.", "Bringing in the title details."),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = palette.mutedInk
                                )
                            }
                        }

                        error -> {
                            Column(
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = tr(
                                        "작품 정보를 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.",
                                        "Could not bring in the title details. Please try again in a little while."
                                    ),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = palette.mutedInk
                                )
                                OutlinedButton(
                                    onClick = onRetry,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.heightIn(min = 48.dp)
                                ) {
                                    Text(tr("다시 불러오기", "Try again"))
                                }
                            }
                        }

                        candidates.isEmpty() -> {
                            Column(
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = tr(
                                        "같은 작품을 찾지 못했어요. 다른 제목으로 찾아볼까요?",
                                        "We couldn't find the same title. Try searching for another name."
                                    ),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = palette.mutedInk
                                )
                                OutlinedButton(
                                    onClick = onSearchManually,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.heightIn(min = 48.dp)
                                ) {
                                    Text(tr("직접 찾아보기", "Search for a title"))
                                }
                            }
                        }

                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                items(
                                    items = candidates,
                                    key = { c -> "${c.provider.name}:${c.providerId}" }
                                ) { candidate ->
                                    val metaLine = listOfNotNull(
                                        candidate.author?.takeIf { it.isNotBlank() },
                                        candidate.publisher?.takeIf { it.isNotBlank() },
                                        candidate.year?.toString()
                                    ).joinToString(" · ")
                                    val isbn = candidate.isbn13?.takeIf { it.isNotBlank() }
                                        ?: candidate.isbn10?.takeIf { it.isNotBlank() }
                                    val gUrl = googleBooksAttributionUrl(candidate)

                                    Surface(
                                        onClick = { onSelectCandidate(candidate) },
                                        shape = RoundedCornerShape(8.dp),
                                        color = palette.background,
                                        border = BorderStroke(1.dp, palette.border),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.Top,
                                            modifier = Modifier.padding(12.dp)
                                        ) {
                                            PosterImage(
                                                posterUrl = candidate.posterUrl,
                                                titleName = candidate.name,
                                                titleType = candidate.type,
                                                modifier = Modifier.size(width = 48.dp, height = 72.dp),
                                                widthBucket = "w185"
                                            )
                                            Spacer(Modifier.width(12.dp))
                                            Column(
                                                verticalArrangement = Arrangement.spacedBy(4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) {
                                                Text(
                                                    text = candidate.name,
                                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                                                    color = palette.ink,
                                                    maxLines = 2,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                                if (metaLine.isNotBlank()) {
                                                    Text(
                                                        text = metaLine,
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = palette.mutedInk,
                                                        maxLines = 2,
                                                        overflow = TextOverflow.Ellipsis
                                                    )
                                                }
                                                if (!isbn.isNullOrBlank()) {
                                                    Text(
                                                        text = "ISBN $isbn",
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = palette.subtleInk
                                                    )
                                                }
                                                if (gUrl != null) {
                                                    Text(
                                                        text = "Google Books ↗",
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = palette.brandNavy,
                                                        modifier = Modifier.clickable {
                                                            TwaBrowserBridge.launchInExternalCustomTab(context, gUrl)
                                                        }
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
