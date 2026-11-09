package app.ottline.ui.screens

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Tv
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.ottline.WatchReminderScheduler
import app.ottline.data.OttlineRepository
import app.ottline.data.SyncState
import app.ottline.data.local.AndroidInstallToken
import app.ottline.data.local.PreferencesSnapshot
import app.ottline.data.local.TwaBrowserBridge
import app.ottline.domain.RecordDate
import app.ottline.domain.TimelineMoments
import app.ottline.domain.TitleFallback
import app.ottline.model.DiscussionListItem
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.Place
import app.ottline.model.Provider
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.components.PosterImage
import app.ottline.ui.components.RecordFeelingBadge
import app.ottline.ui.components.SyncNoticeBanner
import app.ottline.ui.components.noSwipeNav
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette

private const val HOME_DISCUSSION_LIMIT = 6

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeScreen(
    logs: List<WatchLog>,
    prefsSnapshot: PreferencesSnapshot,
    syncState: SyncState,
    outboxCount: Int,
    repository: OttlineRepository,
    persistedSelectedMonth: String = RecordDate.monthKey(null),
    onSelectMonth: (String) -> Unit = {},
    onOpenQuickRecord: (QuickRecordRequest) -> Unit,
    onOpenTitleDetail: (String) -> Unit,
    onOpenTimeline: () -> Unit = {},
    onOpenTogether: () -> Unit = {},
    onOpenReport: () -> Unit = {},
    onOpenBookshelf: () -> Unit = {},
    onOpenTimelineWithMoment: (Place?, Occasion?) -> Unit,
    onOpenMySpacePairing: () -> Unit,
    onOpenWatchReminderSettings: () -> Unit
) {
    val context = LocalContext.current
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val primaryAccent = if (palette.isDark) palette.ink else palette.brandNavy

    val doneLogs = remember(logs) {
        logs.filter { it.status == LogStatus.DONE }
            .sortedByDescending { RecordDate.parseInstantMillis(it.watchedAt.ifBlank { it.createdAt }) }
    }
    val availableMonths = remember(doneLogs) {
        if (doneLogs.isEmpty()) emptyList() else TimelineMoments.availableMonths(doneLogs)
    }
    val selectedMonth = remember(availableMonths, persistedSelectedMonth) {
        if (persistedSelectedMonth in availableMonths) {
            persistedSelectedMonth
        } else {
            availableMonths.firstOrNull() ?: RecordDate.monthKey(null)
        }
    }
    val monthLogs = remember(doneLogs, selectedMonth) {
        doneLogs.filter { RecordDate.monthKey(it.watchedAt.ifBlank { it.createdAt }) == selectedMonth }
    }
    val featuredMemory = remember(monthLogs) { monthLogs.firstOrNull() }
    val remainingMonthLogs = remember(monthLogs, featuredMemory) {
        monthLogs.filter { it.id != featuredMemory?.id }.take(6)
    }
    val inProgressLogs = remember(logs) {
        logs.filter { it.status == LogStatus.IN_PROGRESS }
            .sortedByDescending { RecordDate.parseInstantMillis(it.watchedAt.ifBlank { it.createdAt }) }
            .take(4)
    }
    val frequentPlaces = remember(logs) { TimelineMoments.frequentPlaces(logs, 3) }
    val frequentOccasions = remember(logs) { TimelineMoments.frequentOccasions(logs, 3) }
    val hasBookLogs = remember(logs) { logs.any { it.title.type == TitleType.BOOK } }

    // Home Together & Starter Activation feeds (mirrors `apps/web/app/[locale]/page.tsx` `loadDiscussions`)
    var discussions by remember { mutableStateOf<List<DiscussionListItem>>(emptyList()) }
    var trendingTitles by remember { mutableStateOf<List<TitleSearchItem>>(emptyList()) }
    var activationPopularTitles by remember { mutableStateOf<List<TitleSearchItem>>(emptyList()) }
    var discussionsLoading by remember { mutableStateOf(true) }
    var discussionsError by remember { mutableStateOf(false) }
    var reloadNonce by remember { mutableIntStateOf(0) }

    // Starter Activation Panel session state
    var activationTab by rememberSaveable { mutableStateOf("video") } // "video" | "book"
    var activationDismissed by rememberSaveable { mutableStateOf(false) }

    var showSingleDeviceReminder by remember { mutableStateOf(false) }
    var watchPromptDismissed by remember {
        mutableStateOf(WatchReminderScheduler.isHomePromptDismissed(context))
    }
    var shareCardLog by remember { mutableStateOf<WatchLog?>(null) }

    val showTwaMigrationCard = remember(prefsSnapshot.userId, prefsSnapshot.twaMigrationBannerDismissed, logs.size) {
        !prefsSnapshot.twaMigrationBannerDismissed &&
            logs.isEmpty() &&
            TwaBrowserBridge.hasTwaOrUpgradeFootprint(context)
    }

    LaunchedEffect(reloadNonce, logs.size) {
        discussionsLoading = true
        discussionsError = false
        val latestResult = runCatching { repository.api.getDiscussionsLatest(HOME_DISCUSSION_LIMIT, 14) }
        latestResult.onSuccess { latest ->
            discussions = latest
            val missingCount = (HOME_DISCUSSION_LIMIT - latest.size).coerceAtLeast(0)
            val latestVideo = latest.filter { it.titleType == TitleType.MOVIE || it.titleType == TitleType.SERIES }
            val activationMissingCount = (HOME_DISCUSSION_LIMIT - latestVideo.size).coerceAtLeast(0)

            if (missingCount == 0 && activationMissingCount == 0) {
                trendingTitles = emptyList()
                activationPopularTitles = emptyList()
            } else {
                runCatching { repository.api.getPopularTitles(HOME_DISCUSSION_LIMIT * 2) }
                    .onSuccess { trends ->
                        trendingTitles = TitleFallback.selectPopularTitleFillers(latest, trends, missingCount)
                        activationPopularTitles = TitleFallback.selectPopularTitleFillers(
                            latestVideo,
                            trends,
                            activationMissingCount
                        )
                    }
                    .onFailure {
                        if (latest.isEmpty()) discussionsError = true
                        trendingTitles = emptyList()
                        activationPopularTitles = emptyList()
                    }
            }
        }.onFailure {
            discussionsError = true
            discussions = emptyList()
            trendingTitles = emptyList()
            activationPopularTitles = emptyList()
        }
        discussionsLoading = false
    }

    LaunchedEffect(prefsSnapshot.userId, logs.size, prefsSnapshot.singleDeviceCodeReminderShown) {
        if (!prefsSnapshot.userId.isNullOrBlank() && logs.isNotEmpty() && !prefsSnapshot.singleDeviceCodeReminderShown) {
            runCatching { repository.api.getDevices() }
                .onSuccess { devices ->
                    if (devices.size == 1) {
                        showSingleDeviceReminder = true
                    }
                }
        }
    }

    val activationRecentVideoItems = remember(discussions) {
        discussions.filter { it.titleType == TitleType.MOVIE || it.titleType == TitleType.SERIES }
            .take(HOME_DISCUSSION_LIMIT)
    }

    val showActivationPanel = logs.isEmpty() &&
        prefsSnapshot.pairingCode.isNullOrBlank() &&
        !activationDismissed

    LazyColumn(
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 24.dp, bottom = 36.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        // 1. Editorial Header (`HomeTimelineView.tsx` lines 205–241 + `timeline.module.css` lines 835–875)
        item {
            Column(modifier = Modifier.padding(bottom = 16.dp)) {
                Text(
                    text = tr("나의 타임라인", "MY TIMELINE"),
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        letterSpacing = 0.88.sp
                    ),
                    color = palette.mutedInk
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = if (logs.isNotEmpty()) {
                        tr("내 시간 위에 쌓인 이야기", "Stories on your timeline")
                    } else {
                        tr("나의 타임라인에 첫 순간을 남겨요.", "Your timeline. Your first moment.")
                    },
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontSize = 27.sp,
                        lineHeight = 38.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = (-1.0).sp
                    ),
                    color = palette.ink
                )

                Spacer(Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(palette.border)
                )
                Spacer(Modifier.height(12.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = RecordDate.formatHomeToday(locale),
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontSize = 12.sp,
                            lineHeight = 18.sp
                        ),
                        color = palette.mutedInk,
                        modifier = Modifier.weight(1f)
                    )
                    if (logs.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(palette.card)
                                .border(1.dp, palette.border, RoundedCornerShape(8.dp))
                                .clickable { onOpenQuickRecord(QuickRecordRequest(autoFocusSearch = true)) }
                                .padding(horizontal = 11.dp, vertical = 7.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Add,
                                contentDescription = null,
                                tint = primaryAccent,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = tr("기록 남기기", "Keep a story"),
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp,
                                    fontWeight = FontWeight.SemiBold
                                ),
                                color = primaryAccent
                            )
                        }
                    }
                }
            }
        }

        // 2. Sync Notice Banner (only renders when pending/syncing/failed)
        if (outboxCount > 0 || syncState.status != app.ottline.data.SyncStatus.IDLE) {
            item {
                Box(modifier = Modifier.padding(bottom = 24.dp)) {
                    SyncNoticeBanner(
                        syncState = syncState,
                        outboxCount = outboxCount,
                        onRetryClick = { repository.triggerSyncAsync() }
                    )
                }
            }
        }

        // 3. Seamless TWA -> Native Upgrade Continuity Helper
        if (showTwaMigrationCard) {
            item {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = palette.paperStrong,
                    border = BorderStroke(1.dp, palette.brandNavy.copy(alpha = 0.3f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp)
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = tr("이전 버전에서 남긴 기록을 이어받을까요?", "Restore records from the previous app?"),
                            style = MaterialTheme.typography.titleMedium,
                            color = palette.ink
                        )
                        Text(
                            text = tr(
                                "ottline 2.0 네이티브 앱으로 새로워졌어요. 기존 앱(브라우저)에서 쓰던 기록을 버튼 한 번으로 바로 연결할 수 있어요.",
                                "ottline is now a native app! Connect your previous app/browser records automatically with one tap."
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.mutedInk
                        )
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Button(
                                onClick = {
                                    TwaBrowserBridge.launchTwaHandoff(
                                        context = context,
                                        locale = locale,
                                        apiBaseUrl = prefsSnapshot.apiBaseUrl
                                    )
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = palette.brandNavy,
                                    contentColor = palette.onBrandNavy
                                )
                            ) {
                                Text(tr("기존 기록 자동 연결", "Auto-connect records"), fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = onOpenMySpacePairing,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(tr("코드 직접 입력", "Enter code"))
                            }
                            TextButton(onClick = { repository.prefs.dismissTwaMigrationBanner() }) {
                                Text(tr("닫기", "Dismiss"))
                            }
                        }
                    }
                }
            }
        }

        // 4. Single-device Connection Code Reminder (at most once)
        if (showSingleDeviceReminder && !prefsSnapshot.singleDeviceCodeReminderShown) {
            item {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = palette.sageAccent,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp)
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Key, contentDescription = null, tint = palette.brandNavy, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = tr("이 기기에만 연결되어 있어요", "Only linked on this device"),
                                style = MaterialTheme.typography.titleSmall,
                                color = palette.ink
                            )
                        }
                        Text(
                            text = tr(
                                "별도 회원가입 없이 쓰기 때문에, 휴대폰을 바꿀 때를 대비해 연결 코드 보관 카드를 한 번 저장해 두면 안심할 수 있어요.",
                                "Save a private recovery card once so you never lose your timeline when switching phones."
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.mutedInk
                        )
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    repository.prefs.markSingleDeviceReminderShown()
                                    showSingleDeviceReminder = false
                                    onOpenMySpacePairing()
                                },
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(tr("보관 카드 저장하러 가기", "Save recovery card"))
                            }
                            TextButton(
                                onClick = {
                                    repository.prefs.markSingleDeviceReminderShown()
                                    showSingleDeviceReminder = false
                                }
                            ) {
                                Text(tr("확인했어요", "Got it"))
                            }
                        }
                    }
                }
            }
        }

        if (logs.isEmpty()) {
            // === 5A. EMPTY STATE: UNBOXED `.welcome` SECTION (`HomeTimelineView.tsx` lines 301–322 + `timeline.module.css` lines 400–415, 1018–1031) ===
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp, bottom = 20.dp)
                ) {
                    Text(
                        text = tr(
                            "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터.",
                            "A film, a series, a book. Start with one you want to keep."
                        ),
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontSize = 16.sp,
                            lineHeight = 29.sp
                        ),
                        color = palette.mutedInk
                    )

                    Spacer(Modifier.height(24.dp))

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Button(
                            onClick = { onOpenQuickRecord(QuickRecordRequest(autoFocusSearch = true)) },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.brandOrange,
                                contentColor = Color(0xFF0F0F0F)
                            ),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 44.dp)
                        ) {
                            Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(7.dp))
                            Text(
                                text = tr("첫 기록 남기기", "Leave your first record"),
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable(onClick = onOpenMySpacePairing)
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = tr("이미 남긴 기록 이어보기", "Bring my existing records"),
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium
                                ),
                                color = primaryAccent
                            )
                            Spacer(Modifier.width(8.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                                contentDescription = null,
                                tint = primaryAccent,
                                modifier = Modifier.size(17.dp)
                            )
                        }
                    }
                }
            }

            // === 5B. STARTER RECOMMENDATION CARD (`FirstLogActivationPanel.tsx` + `timeline.module.css` `.activation { margin-top: 24px }`) ===
            if (showActivationPanel) {
                item {
                    Box(modifier = Modifier.padding(top = 24.dp)) {
                        FirstLogActivationCard(
                            contentType = activationTab,
                            recentVideoItems = activationRecentVideoItems,
                            popularVideoItems = activationPopularTitles,
                            loading = discussionsLoading,
                            repository = repository,
                            onContentTypeChange = { next ->
                                activationTab = next
                                repository.trackEvent(
                                    "activation_content_type_select",
                                    mapOf("contentType" to next)
                                )
                            },
                            onDismiss = { activationDismissed = true },
                            onVideoSelect = { item, source ->
                                activationDismissed = true
                                onOpenQuickRecord(
                                    QuickRecordRequest(
                                        initialQuery = item.name,
                                        initialTypeTab = "all",
                                        preselectedSearchItem = item,
                                        selectSource = source,
                                        autoFocusSearch = false
                                    )
                                )
                            },
                            onBookStatusSelect = { status ->
                                activationTab = "book"
                                activationDismissed = true
                                repository.trackEvent(
                                    "activation_status_select",
                                    mapOf("contentType" to "book", "status" to status.name)
                                )
                                onOpenQuickRecord(
                                    QuickRecordRequest(
                                        initialTypeTab = "book",
                                        preferredStatus = status,
                                        autoFocusSearch = true
                                    )
                                )
                            },
                            onFindOther = { type ->
                                activationTab = type
                                activationDismissed = true
                                onOpenQuickRecord(
                                    QuickRecordRequest(
                                        initialTypeTab = if (type == "book") "book" else "all",
                                        autoFocusSearch = true
                                    )
                                )
                            }
                        )
                    }
                }
            }
        } else {
            // === 5C. LOGGED STATE: EXACT WEB MOBILE ORDER & AIRY UNBOXED PAPER LAYOUT (`timeline.module.css` lines 876–1017, 1167–1174) ===

            // Month Selector (`.months`, lines 881–911: `padding: 2px 2px 12px`, unselected transparent, selected `var(--card)` + `#1e4d8c` border)
            if (availableMonths.isNotEmpty()) {
                item {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 2.dp, bottom = 12.dp)
                            .noSwipeNav()
                            .horizontalScroll(rememberScrollState())
                    ) {
                        availableMonths.forEach { mk ->
                            val selected = mk == selectedMonth
                            val yearPart = RecordDate.formatMonthYearPart(mk)
                            val monthPart = RecordDate.formatMonthShortPart(mk, locale)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selected) palette.card else Color.Transparent)
                                    .border(
                                        width = 1.dp,
                                        color = if (selected) primaryAccent else palette.border,
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .clickable { onSelectMonth(mk) }
                                    .padding(horizontal = 11.dp, vertical = 6.dp)
                            ) {
                                if (yearPart.isNotEmpty()) {
                                    Text(
                                        text = yearPart,
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontSize = 11.sp,
                                            lineHeight = 14.sp
                                        ),
                                        color = palette.mutedInk
                                    )
                                }
                                Text(
                                    text = monthPart,
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontSize = 13.5.sp,
                                        lineHeight = 18.sp,
                                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium
                                    ),
                                    color = if (selected) primaryAccent else palette.ink
                                )
                            }
                        }
                    }
                }
            }

            // Order 0: Featured Memory Hero Card ("그날의 온기") OR Empty Completed Month Card (`timeline.module.css` line 915 `order: 0`)
            item {
                if (featuredMemory != null) {
                    FeaturedMemoryCard(
                        log = featuredMemory,
                        onOpenDetail = { onOpenTitleDetail(featuredMemory.title.id) },
                        onOpenShareCard = { shareCardLog = featuredMemory }
                    )
                } else {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = tr(
                                    "다 본·읽은 이야기는 이곳에 모아둘게요.",
                                    "Stories you finish watching or reading will gather here."
                                ),
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontSize = 18.sp,
                                    lineHeight = 27.sp,
                                    fontWeight = FontWeight.SemiBold
                                ),
                                color = palette.ink
                            )
                            Spacer(Modifier.height(18.dp))
                            Text(
                                text = tr(
                                    "이어가는 이야기와 아껴둔 작품은 타임라인에서 함께 볼 수 있어요.",
                                    "Your ongoing stories and saved titles are together on your timeline."
                                ),
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 14.sp,
                                    lineHeight = 25.sp
                                ),
                                color = palette.mutedInk
                            )
                            Spacer(Modifier.height(8.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .heightIn(min = 48.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable(onClick = onOpenTimeline)
                            ) {
                                Text(
                                    text = tr("내 타임라인 펼치기", "Open your timeline"),
                                    style = MaterialTheme.typography.labelLarge.copy(
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium
                                    ),
                                    color = primaryAccent
                                )
                                Spacer(Modifier.width(8.dp))
                                Icon(
                                    imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                                    contentDescription = null,
                                    tint = primaryAccent,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Order 1: `.homeSide` (`margin-top: 30px`, `timeline.module.css` lines 972–995)
            // Unboxed "아직 못다 한 이야기" (`IN_PROGRESS`) + Unboxed `.sideLink` (`쌓아온 시간 돌아보기`, `내 서가 펼치기`)
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 30.dp)
                ) {
                    if (inProgressLogs.isNotEmpty()) {
                        Text(
                            text = tr("아직 못다 한 이야기", "Stories still unfolding"),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 18.sp,
                                lineHeight = 27.sp,
                                fontWeight = FontWeight.SemiBold
                            ),
                            color = palette.ink,
                            modifier = Modifier.padding(bottom = 20.dp)
                        )
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(20.dp),
                            contentPadding = PaddingValues(bottom = 10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .noSwipeNav()
                        ) {
                            items(inProgressLogs, key = { "prog_${it.id}" }) { item ->
                                Row(
                                    verticalAlignment = Alignment.Top,
                                    modifier = Modifier
                                        .width(235.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable { onOpenTitleDetail(item.title.id) }
                                ) {
                                    PosterImage(
                                        posterUrl = item.seasonPosterUrl ?: item.title.posterUrl,
                                        titleName = item.title.name,
                                        titleType = item.title.type,
                                        modifier = Modifier.size(width = 54.dp, height = 81.dp),
                                        widthBucket = "w342"
                                    )
                                    Spacer(Modifier.width(14.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = OttlineStrings.statusLabel(item.status, item.title.type, locale),
                                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                            color = palette.mutedInk,
                                            modifier = Modifier.padding(bottom = 5.dp)
                                        )
                                        Text(
                                            text = item.title.name,
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontSize = 16.sp,
                                                lineHeight = 24.sp,
                                                fontWeight = FontWeight.SemiBold
                                            ),
                                            color = palette.ink,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        val progSub = buildList {
                                            if (item.seasonNumber != null) add("S${item.seasonNumber}")
                                            if (item.episodeNumber != null) add("E${item.episodeNumber}")
                                        }.joinToString(" · ")
                                        if (progSub.isNotEmpty()) {
                                            Text(
                                                text = progSub,
                                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                                                color = palette.mutedInk,
                                                maxLines = 1,
                                                modifier = Modifier.padding(top = 6.dp)
                                            )
                                        }
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier
                                                .heightIn(min = 44.dp)
                                                .padding(top = 4.dp)
                                        ) {
                                            Text(
                                                text = tr("이어 적기", "Keep going"),
                                                style = MaterialTheme.typography.labelLarge.copy(
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Medium
                                                ),
                                                color = primaryAccent
                                            )
                                            Spacer(Modifier.width(8.dp))
                                            Icon(
                                                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                                                contentDescription = null,
                                                tint = primaryAccent,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    HomeSideShortcutLink(
                        icon = Icons.Outlined.History,
                        label = tr("쌓아온 시간 돌아보기", "Look back on your time"),
                        onClick = onOpenReport
                    )
                    if (locale != "en" && hasBookLogs) {
                        HomeSideShortcutLink(
                            icon = Icons.Outlined.AutoStories,
                            label = "내 서가 펼치기",
                            onClick = onOpenBookshelf
                        )
                    }
                }
            }

            // Order 2: `.monthEntries` ("이 달에 남긴 시간", `margin-top: 30px`, `timeline.module.css` lines 304–338, 996–1017)
            if (featuredMemory != null) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 30.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                        ) {
                            Column {
                                Text(
                                    text = RecordDate.formatMonthLabel(selectedMonth, locale),
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 11.sp,
                                        lineHeight = 16.sp,
                                        letterSpacing = 0.88.sp
                                    ),
                                    color = palette.mutedInk,
                                    modifier = Modifier.padding(bottom = 6.dp)
                                )
                                Text(
                                    text = tr("이 달에 남긴 시간", "Moments this month"),
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontSize = 18.sp,
                                        lineHeight = 27.sp,
                                        fontWeight = FontWeight.SemiBold
                                    ),
                                    color = palette.ink
                                )
                            }
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .heightIn(min = 48.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable(onClick = onOpenTimeline)
                                    .padding(horizontal = 4.dp)
                            ) {
                                Text(
                                    text = tr("타임라인", "Timeline"),
                                    style = MaterialTheme.typography.labelLarge.copy(
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium
                                    ),
                                    color = primaryAccent
                                )
                                Spacer(Modifier.width(8.dp))
                                Icon(
                                    imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                                    contentDescription = null,
                                    tint = primaryAccent,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(palette.border)
                        )

                        if (remainingMonthLogs.isNotEmpty()) {
                            remainingMonthLogs.forEach { log ->
                                HomeCompactLogRow(
                                    log = log,
                                    onClick = { onOpenTitleDetail(log.title.id) }
                                )
                            }
                        } else {
                            Text(
                                text = tr("이 달에 남겨둔 순간이에요.", "A moment you kept this month."),
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 14.sp,
                                    lineHeight = 25.sp
                                ),
                                color = palette.mutedInk,
                                modifier = Modifier.padding(top = 18.dp)
                            )
                        }
                    }
                }
            }

            // Order 3: `.momentRevisit` ("다시 만나는 그날 / 어떤 순간을 펼쳐볼까요?", `margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border)`)
            if (frequentPlaces.isNotEmpty() || frequentOccasions.isNotEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 24.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(palette.border)
                        )
                        Spacer(Modifier.height(24.dp))

                        Text(
                            text = tr("다시 만나는 그날", "BACK TO A MOMENT"),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 11.sp,
                                lineHeight = 16.sp,
                                letterSpacing = 0.88.sp
                            ),
                            color = palette.mutedInk,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        Text(
                            text = tr("어떤 순간을 펼쳐볼까요?", "Which moments will you revisit?"),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 18.sp,
                                lineHeight = 27.sp,
                                fontWeight = FontWeight.SemiBold
                            ),
                            color = palette.ink,
                            modifier = Modifier.padding(bottom = 20.dp)
                        )
                        Text(
                            text = tr(
                                "이 기기에 모아둔 기록에서 그날의 순간을 다시 만나요.",
                                "Revisit moments from the records kept on this device."
                            ),
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontSize = 14.sp,
                                lineHeight = 24.sp
                            ),
                            color = palette.mutedInk,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )

                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            frequentPlaces.forEach { chip ->
                                MomentRevisitLinkRow(
                                    isPlace = true,
                                    label = OttlineStrings.placeLabel(chip.value, locale),
                                    countText = tr(
                                        "${chip.count}개",
                                        if (chip.count == 1) "1 record" else "${chip.count} records"
                                    ),
                                    onClick = { onOpenTimelineWithMoment(chip.value, null) }
                                )
                            }
                            frequentOccasions.forEach { chip ->
                                MomentRevisitLinkRow(
                                    isPlace = false,
                                    label = OttlineStrings.occasionLabel(chip.value, locale),
                                    countText = tr(
                                        "${chip.count}개",
                                        if (chip.count == 1) "1 record" else "${chip.count} records"
                                    ),
                                    onClick = { onOpenTimelineWithMoment(null, chip.value) }
                                )
                            }
                        }
                    }
                }
            }

            // Android Watch Reminder Card (`AndroidWatchReminderCard` in `page.tsx`, `mt-8` = `32.dp`)
            if (!WatchReminderScheduler.isEnabled(context) && !watchPromptDismissed) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = palette.paperStrong,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 32.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.Top,
                            modifier = Modifier.padding(16.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.NotificationsActive,
                                contentDescription = null,
                                tint = palette.brandNavy,
                                modifier = Modifier
                                    .padding(top = 2.dp)
                                    .size(20.dp)
                            )
                            Spacer(Modifier.width(12.dp))
                            Column(
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = tr("Android 시청 기록 알림", "Android watch reminder"),
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                    color = palette.mutedInk
                                )
                                Text(
                                    text = tr("다 본 뒤, 기록할 타이밍을 알려드릴까요?", "Want a nudge when it is time to log?"),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = palette.ink
                                )
                                Text(
                                    text = tr(
                                        "OTT 앱을 닫은 뒤 기록 화면으로 이어지는 알림을 받을 수 있어요.",
                                        "Get a reminder that opens the logging flow after you leave an OTT app."
                                    ),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = palette.mutedInk
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 4.dp)) {
                                    TextButton(
                                        onClick = onOpenWatchReminderSettings,
                                        contentPadding = PaddingValues(0.dp)
                                    ) {
                                        Text(
                                            text = tr("시청 기록 알림 켜기", "Turn on watch reminders"),
                                            color = primaryAccent,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                    TextButton(
                                        onClick = {
                                            WatchReminderScheduler.dismissHomePromptFor14Days(context)
                                            watchPromptDismissed = true
                                        },
                                        contentPadding = PaddingValues(0.dp)
                                    ) {
                                        Text(tr("나중에", "Maybe later"), color = palette.subtleInk)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // === 6. ALWAYS-VISIBLE BOTTOM TOGETHER SECTION (`page.tsx` lines 603–650 + `timeline.module.css` `.publicSection { margin-top: 32px; padding-top: 24px }`) ===
        item {
            Box(modifier = Modifier.padding(top = 32.dp)) {
                HomeTogetherSection(
                    discussions = discussions,
                    trendingTitles = trendingTitles,
                    loading = discussionsLoading,
                    error = discussionsError,
                    onOpenTogether = onOpenTogether,
                    onOpenTitleDetail = onOpenTitleDetail,
                    onTrendingSelect = { item ->
                        onOpenQuickRecord(
                            QuickRecordRequest(
                                initialQuery = item.name,
                                initialTypeTab = if (item.type == TitleType.BOOK) "book" else "all",
                                preselectedSearchItem = item,
                                selectSource = "popular_title",
                                autoFocusSearch = false
                            )
                        )
                    },
                    onRetry = { reloadNonce += 1 }
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

/**
 * Starter recommendation card (`FirstLogActivationPanel.tsx` parity).
 */
@Composable
private fun FirstLogActivationCard(
    contentType: String,
    recentVideoItems: List<DiscussionListItem>,
    popularVideoItems: List<TitleSearchItem>,
    loading: Boolean,
    repository: OttlineRepository,
    onContentTypeChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onVideoSelect: (TitleSearchItem, String) -> Unit,
    onBookStatusSelect: (LogStatus) -> Unit,
    onFindOther: (String) -> Unit
) {
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    val primaryAccent = if (palette.isDark) palette.ink else palette.brandNavy

    LaunchedEffect(Unit) {
        repository.trackEvent("activation_impression", mapOf("defaultContentType" to "video"))
    }

    val recentSearchItems = remember(recentVideoItems) {
        recentVideoItems.map { item ->
            TitleSearchItem(
                provider = item.titleProvider ?: Provider.LOCAL,
                providerId = item.titleProviderId ?: item.titleId,
                titleId = item.titleId,
                type = item.titleType,
                name = item.titleName,
                year = item.titleYear,
                posterUrl = item.posterUrl
            )
        }
    }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        shadowElevation = 0.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = tr("처음 남길 기록", "First record"),
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = palette.mutedInk
                    )
                    Text(
                        text = tr("하나만 골라볼까요?", "Pick one to start"),
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontSize = 20.sp,
                            lineHeight = 26.sp,
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = palette.ink
                    )
                    Text(
                        text = tr(
                            "찾기 전에 먼저 떠오르는 것부터 가볍게 남겨보세요.",
                            "Start with whatever comes to mind before searching from scratch."
                        ),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 14.sp,
                            lineHeight = 24.sp
                        ),
                        color = palette.mutedInk
                    )
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = tr("시작 패널 닫기", "Close start panel"),
                        tint = palette.mutedInk,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            // 2-column Type Switcher (`영상` / `책`, `min-h-14` = `56.dp`)
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                val videoSelected = contentType == "video"
                val bookSelected = contentType == "book"

                Surface(
                    onClick = { onContentTypeChange("video") },
                    shape = RoundedCornerShape(8.dp),
                    color = if (videoSelected) palette.paperStrong else palette.card,
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (videoSelected) {
                            if (palette.isDark) palette.border else palette.brandNavy.copy(alpha = 0.4f)
                        } else palette.border
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 56.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Movie,
                            contentDescription = null,
                            tint = if (videoSelected) primaryAccent else palette.mutedInk,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = tr("영상", "Video"),
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            ),
                            color = if (videoSelected) primaryAccent else palette.mutedInk
                        )
                    }
                }

                Surface(
                    onClick = { onContentTypeChange("book") },
                    shape = RoundedCornerShape(8.dp),
                    color = if (bookSelected) palette.paperStrong else palette.card,
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (bookSelected) {
                            if (palette.isDark) palette.border else palette.brandNavy.copy(alpha = 0.4f)
                        } else palette.border
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 56.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.AutoStories,
                            contentDescription = null,
                            tint = if (bookSelected) primaryAccent else palette.mutedInk,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = tr("책", "Book"),
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            ),
                            color = if (bookSelected) primaryAccent else palette.mutedInk
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            if (contentType == "video") {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = tr("요즘 많이 남기는 작품 중 본 게 있나요?", "Have you watched any of these lately?"),
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold
                            ),
                            color = palette.ink
                        )
                        Text(
                            text = tr(
                                "포스터를 고르면 바로 기록하기 화면으로 이어져요.",
                                "Pick a poster and it opens the regular logging flow."
                            ),
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 14.sp,
                                lineHeight = 24.sp
                            ),
                            color = palette.mutedInk
                        )
                    }

                    if (loading && recentSearchItems.isEmpty() && popularVideoItems.isEmpty()) {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.noSwipeNav()
                        ) {
                            items(4) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = palette.card,
                                    border = BorderStroke(1.dp, palette.border),
                                    modifier = Modifier.width(116.dp)
                                ) {
                                    Column {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(174.dp)
                                                .background(palette.mutedBg)
                                        )
                                        Column(
                                            verticalArrangement = Arrangement.spacedBy(6.dp),
                                            modifier = Modifier.padding(8.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth(0.85f)
                                                    .height(12.dp)
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(palette.mutedBg)
                                            )
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth(0.55f)
                                                    .height(10.dp)
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(palette.mutedBg)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    } else if (recentSearchItems.isNotEmpty() || popularVideoItems.isNotEmpty()) {
                        if (recentSearchItems.isNotEmpty()) {
                            ActivationPosterRail(
                                sectionTitle = tr("요즘 함께 남긴 작품", "Titles people are logging"),
                                items = recentSearchItems,
                                locale = locale,
                                onSelect = { onVideoSelect(it, "activation_recent_discussion") }
                            )
                        }
                        if (popularVideoItems.isNotEmpty()) {
                            ActivationPosterRail(
                                sectionTitle = tr("요즘 인기 작품", "Popular now"),
                                items = popularVideoItems,
                                locale = locale,
                                onSelect = { onVideoSelect(it, "activation_popular_title") }
                            )
                        }
                    } else {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = palette.background,
                            border = BorderStroke(1.dp, palette.border),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = tr(
                                    "지금 보여줄 작품을 불러오지 못했어요. 직접 찾아서 남길 수 있어요.",
                                    "We could not load titles right now. You can still search directly."
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = palette.mutedInk,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }

                    Surface(
                        onClick = { onFindOther("video") },
                        shape = RoundedCornerShape(8.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.heightIn(min = 44.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Search,
                                contentDescription = null,
                                tint = primaryAccent,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = tr("다른 작품 찾기", "Find another title"),
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold
                                ),
                                color = primaryAccent
                            )
                        }
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = tr("요즘 읽고 있는 책이 있나요?", "Are you reading something these days?"),
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold
                            ),
                            color = palette.ink
                        )
                        Text(
                            text = tr(
                                "다 읽지 않아도 괜찮아요. 상태를 고르고 제목이나 저자로 찾아보세요.",
                                "It does not need to be finished. Choose the state, then search by title or author."
                            ),
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 14.sp,
                                lineHeight = 24.sp
                            ),
                            color = palette.mutedInk
                        )
                    }

                    val bookStatuses = listOf(
                        LogStatus.IN_PROGRESS to tr("읽는 중", "Reading"),
                        LogStatus.DONE to tr("읽었어요", "Read"),
                        LogStatus.WISHLIST to tr("읽고 싶어요", "Want to read")
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        bookStatuses.forEach { (st, label) ->
                            Surface(
                                onClick = { onBookStatusSelect(st) },
                                shape = RoundedCornerShape(8.dp),
                                color = palette.background,
                                border = BorderStroke(1.dp, palette.border),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 48.dp)
                            ) {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp)
                                ) {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelLarge.copy(
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.SemiBold
                                        ),
                                        color = palette.ink
                                    )
                                }
                            }
                        }
                    }

                    Surface(
                        onClick = { onFindOther("book") },
                        shape = RoundedCornerShape(8.dp),
                        color = palette.card,
                        border = BorderStroke(1.dp, palette.border),
                        modifier = Modifier.heightIn(min = 44.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Search,
                                contentDescription = null,
                                tint = primaryAccent,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = tr("책 제목이나 저자 찾기", "Search title or author"),
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold
                                ),
                                color = primaryAccent
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActivationPosterRail(
    sectionTitle: String,
    items: List<TitleSearchItem>,
    locale: String,
    onSelect: (TitleSearchItem) -> Unit
) {
    val palette = LocalOttlinePalette.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = sectionTitle,
            style = MaterialTheme.typography.labelMedium.copy(
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            ),
            color = palette.mutedInk
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.noSwipeNav()
        ) {
            items(items, key = { "${it.provider}_${it.providerId}" }) { item ->
                Surface(
                    onClick = { onSelect(item) },
                    shape = RoundedCornerShape(8.dp),
                    color = palette.card,
                    border = BorderStroke(1.dp, palette.border),
                    modifier = Modifier.width(116.dp)
                ) {
                    Column {
                        PosterImage(
                            posterUrl = item.posterUrl,
                            titleName = item.name,
                            titleType = item.type,
                            modifier = Modifier.size(width = 116.dp, height = 174.dp),
                            widthBucket = "w500"
                        )
                        Column(
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(8.dp)
                        ) {
                            Text(
                                text = item.name,
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontSize = 12.sp,
                                    lineHeight = 18.sp,
                                    fontWeight = FontWeight.SemiBold
                                ),
                                color = palette.ink,
                                minLines = 2,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                            val meta = buildString {
                                append(OttlineStrings.titleTypeLabel(item.type, locale))
                                if (item.year != null) append(" · ${item.year}")
                            }
                            Text(
                                text = meta,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                                color = palette.mutedInk,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Always-visible Home Together section (`page.tsx` lines 603–650 + `DiscussionList.tsx` + `timeline.module.css` `.publicSection`).
 */
@Composable
private fun HomeTogetherSection(
    discussions: List<DiscussionListItem>,
    trendingTitles: List<TitleSearchItem>,
    loading: Boolean,
    error: Boolean,
    onOpenTogether: () -> Unit,
    onOpenTitleDetail: (String) -> Unit,
    onTrendingSelect: (TitleSearchItem) -> Unit,
    onRetry: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    val primaryAccent = if (palette.isDark) palette.ink else palette.brandNavy

    Column(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(palette.border)
        )
        Spacer(Modifier.height(24.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 20.dp)
        ) {
            Column {
                Text(
                    text = tr("함께", "TOGETHER"),
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        letterSpacing = 0.88.sp
                    ),
                    color = palette.mutedInk,
                    modifier = Modifier.padding(bottom = 6.dp)
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.ChatBubbleOutline,
                        contentDescription = null,
                        tint = palette.ink,
                        modifier = Modifier.size(19.dp)
                    )
                    Text(
                        text = tr("함께 만나는 이야기", "Stories to share"),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 18.sp,
                            lineHeight = 27.sp,
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = palette.ink
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = onOpenTogether)
                    .padding(horizontal = 4.dp)
            ) {
                Text(
                    text = tr("전체 보기", "View All"),
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    ),
                    color = primaryAccent
                )
                Spacer(Modifier.width(8.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                    contentDescription = null,
                    tint = primaryAccent,
                    modifier = Modifier.size(17.dp)
                )
            }
        }

        if (loading && discussions.isEmpty() && trendingTitles.isEmpty()) {
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
                    repeat(3) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(width = 48.dp, height = 64.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(palette.mutedBg)
                            )
                            Column(
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(0.65f)
                                        .height(14.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(palette.mutedBg)
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(0.4f)
                                        .height(11.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(palette.mutedBg)
                                )
                            }
                        }
                    }
                }
            }
        } else if (error && discussions.isEmpty() && trendingTitles.isEmpty()) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(20.dp)
                ) {
                    Text(
                        text = tr(
                            "함께 남긴 이야기를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.",
                            "Couldn’t load the shared stories. Please try again in a moment."
                        ),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 14.sp,
                            lineHeight = 25.sp
                        ),
                        color = palette.mutedInk
                    )
                    TextButton(
                        onClick = onRetry,
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(
                            text = tr("다시 불러오기", "Try again"),
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            color = primaryAccent
                        )
                    }
                }
            }
        } else if (discussions.isEmpty() && trendingTitles.isEmpty()) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = tr("아직 함께 기록이 없어요.", "No shared records yet."),
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                    color = palette.mutedInk,
                    modifier = Modifier.padding(20.dp)
                )
            }
        } else {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = palette.card,
                border = BorderStroke(1.dp, palette.border),
                shadowElevation = 0.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    discussions.forEach { d ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { onOpenTitleDetail(d.titleId) }
                                .padding(horizontal = 8.dp, vertical = 8.dp)
                        ) {
                            PosterImage(
                                posterUrl = d.posterUrl,
                                titleName = d.titleName,
                                titleType = d.titleType,
                                modifier = Modifier.size(width = 48.dp, height = 64.dp),
                                widthBucket = "w185"
                            )
                            Spacer(Modifier.width(16.dp))
                            Column(
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = d.titleName,
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold
                                    ),
                                    color = palette.ink,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                val meta = buildString {
                                    append(OttlineStrings.titleTypeLabel(d.titleType, locale))
                                    if (d.titleYear != null) append(" · ${d.titleYear}")
                                }
                                Text(
                                    text = meta,
                                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                    color = palette.mutedInk,
                                    maxLines = 1
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = RecordDate.formatShortMonthDay(d.createdAt, locale),
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp),
                                    color = palette.mutedInk
                                )
                                Text(
                                    text = tr("${d.commentCount}개의 이야기들", "${d.commentCount} comments"),
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp),
                                    color = palette.mutedInk
                                )
                            }
                        }
                    }

                    trendingTitles.forEach { item ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { onTrendingSelect(item) }
                                .padding(horizontal = 8.dp, vertical = 8.dp)
                        ) {
                            PosterImage(
                                posterUrl = item.posterUrl,
                                titleName = item.name,
                                titleType = item.type,
                                modifier = Modifier.size(width = 48.dp, height = 64.dp),
                                widthBucket = "w185"
                            )
                            Spacer(Modifier.width(16.dp))
                            Column(
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = item.name,
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold
                                    ),
                                    color = palette.ink,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                val meta = buildString {
                                    append(OttlineStrings.titleTypeLabel(item.type, locale))
                                    if (item.year != null) append(" · ${item.year}")
                                }
                                Text(
                                    text = meta,
                                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                    color = palette.mutedInk,
                                    maxLines = 1
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(
                                horizontalAlignment = Alignment.End,
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(999.dp),
                                    color = palette.paperStrong,
                                    border = BorderStroke(1.dp, palette.border)
                                ) {
                                    Text(
                                        text = tr("인기 작품", "Popular pick"),
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.SemiBold
                                        ),
                                        color = palette.mutedInk,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                                Text(
                                    text = tr("기록하기", "Record it"),
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    ),
                                    color = palette.mutedInk
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Full-width moment link row (`timeline.module.css` `.momentLinks a` parity: `min-height: 48px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card)`).
 */
@Composable
private fun MomentRevisitLinkRow(
    isPlace: Boolean,
    label: String,
    countText: String,
    onClick: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(12.dp)
        ) {
            Icon(
                imageVector = if (isPlace) Icons.Outlined.Place else Icons.Outlined.Group,
                contentDescription = null,
                tint = palette.mutedInk,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                color = palette.ink,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = countText,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 14.sp),
                color = palette.mutedInk
            )
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                contentDescription = null,
                tint = palette.mutedInk,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

/**
 * Unboxed paper link (`timeline.module.css` `.sideLink` parity: `margin-top: 16px; padding-top: 12px; min-height: 60px; border-top: 1px solid var(--border); color: #1e4d8c; font-size: 14px`).
 */
@Composable
private fun HomeSideShortcutLink(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    val primaryAccent = if (palette.isDark) palette.ink else palette.brandNavy
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 16.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(palette.border)
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
                .heightIn(min = 60.dp)
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClick = onClick)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = primaryAccent,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                ),
                color = primaryAccent,
                modifier = Modifier.weight(1f)
            )
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                contentDescription = null,
                tint = primaryAccent,
                modifier = Modifier.size(17.dp)
            )
        }
    }
}

/**
 * Editorial hero memory card (`그날의 온기`) aligned with `HomeTimelineView.tsx` (`lines 354–451`) and `timeline.module.css` (`lines 915–971`).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FeaturedMemoryCard(
    log: WatchLog,
    onOpenDetail: () -> Unit,
    onOpenShareCard: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    val primaryAccent = if (palette.isDark) palette.ink else palette.brandNavy
    val featuredYear = log.seasonYear ?: log.title.year

    Surface(
        onClick = onOpenDetail,
        shape = RoundedCornerShape(8.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
            ) {
                Text(
                    text = tr("그날의 온기", "A moment kept"),
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                    color = palette.mutedInk
                )
                val formattedDate = RecordDate.formatFeaturedDate(log.watchedAt.ifBlank { log.createdAt }, locale)
                if (formattedDate.isNotEmpty()) {
                    Text(
                        text = formattedDate,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = palette.ink
                    )
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(1.dp)
                        .background(palette.border)
                )
            }

            Row(verticalAlignment = Alignment.Top) {
                PosterImage(
                    posterUrl = log.seasonPosterUrl ?: log.title.posterUrl,
                    titleName = log.title.name,
                    titleType = log.title.type,
                    modifier = Modifier.size(width = 100.dp, height = 150.dp),
                    widthBucket = "w500"
                )
                Spacer(Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    val eyebrow = buildString {
                        append(OttlineStrings.titleTypeLabel(log.title.type, locale))
                        if (featuredYear != null) append(" · $featuredYear")
                    }
                    Text(
                        text = eyebrow,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 11.sp,
                            letterSpacing = 0.88.sp
                        ),
                        color = palette.mutedInk,
                        modifier = Modifier.padding(top = 2.dp, bottom = 6.dp)
                    )

                    Text(
                        text = log.title.name,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontSize = 20.sp,
                            lineHeight = 28.sp,
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = palette.ink,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    val creator = log.title.author ?: log.title.directors?.takeIf { it.isNotEmpty() }?.joinToString(", ")
                    if (!creator.isNullOrBlank()) {
                        Text(
                            text = creator,
                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                            color = palette.mutedInk,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(top = 12.dp)
                    ) {
                        Text(
                            text = OttlineStrings.statusLabel(log.status, log.title.type, locale),
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            color = primaryAccent,
                            modifier = Modifier.align(Alignment.CenterVertically)
                        )
                        RecordFeelingBadge(
                            rating = log.rating,
                            titleType = log.title.type,
                            iconSize = 15.dp,
                            textStyle = MaterialTheme.typography.labelLarge.copy(
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Normal
                            ),
                            color = palette.ink,
                            modifier = Modifier.align(Alignment.CenterVertically)
                        )
                    }

                    val editionText = buildList {
                        if (log.seasonNumber != null) add("S${log.seasonNumber}")
                        if (log.episodeNumber != null) add("E${log.episodeNumber}")
                    }.joinToString(" · ")
                    if (editionText.isNotEmpty()) {
                        Text(
                            text = editionText,
                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                            color = palette.mutedInk,
                            modifier = Modifier.padding(top = 7.dp)
                        )
                    }

                    // Unboxed moment rows with top hairline (`RecordMoment` in `RecordParts.tsx` + `timeline.module.css` lines 234–260, 953–958)
                    val hasMoment = !log.ott.isNullOrBlank() || log.place != null || log.occasion != null
                    if (hasMoment) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(7.dp),
                            modifier = Modifier.padding(top = 14.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(palette.border)
                            )
                            Spacer(Modifier.height(5.dp))
                            if (!log.ott.isNullOrBlank()) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Tv,
                                        contentDescription = null,
                                        tint = palette.mutedInk,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Text(
                                        text = log.ott,
                                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                                        color = palette.mutedInk
                                    )
                                }
                            }
                            log.place?.let { place ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Place,
                                        contentDescription = null,
                                        tint = palette.mutedInk,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Text(
                                        text = OttlineStrings.placeLabel(place, locale),
                                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                                        color = palette.mutedInk
                                    )
                                }
                            }
                            log.occasion?.let { occasion ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Group,
                                        contentDescription = null,
                                        tint = palette.mutedInk,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Text(
                                        text = OttlineStrings.occasionLabel(occasion, locale),
                                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                                        color = palette.mutedInk
                                    )
                                }
                            }
                        }
                    }

                    // Left-ruled blockquote note (`.featuredNote` in `timeline.module.css` lines 261–273, 959–964)
                    if (!log.note.isNullOrBlank()) {
                        val displayNote = if (log.spoiler) {
                            tr("스포일러 포함 문장 · 눌러서 읽기", "Spoiler note · Tap to read")
                        } else {
                            log.note.trim().replace(Regex("\\s*\\n+\\s*"), " ")
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .width(2.dp)
                                    .heightIn(min = 22.dp)
                                    .background(palette.border)
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = displayNote,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 14.sp,
                                    lineHeight = 25.sp
                                ),
                                color = if (log.spoiler) palette.mutedInk else palette.ink,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    // `.featuredActions` inside `.featuredStory` (`timeline.module.css` lines 274–288, 965–971)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.heightIn(min = 48.dp)
                        ) {
                            Text(
                                text = tr("이 기록 펼치기", "Open this memory"),
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                ),
                                color = primaryAccent
                            )
                            Spacer(Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                                contentDescription = null,
                                tint = primaryAccent,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        IconButton(
                            onClick = onOpenShareCard,
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Share,
                                contentDescription = tr("공유 카드 만들기", "Create a share card"),
                                tint = palette.mutedInk,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Unboxed monthly entry row (`HomeTimelineView.tsx` `.entry` + `timeline.module.css` lines 312–338, 1004–1017):
 * `padding: 18px 0; border-bottom: 1px solid var(--border); grid-template-columns: 54px 36px minmax(0, 1fr) 16px; gap: 12px`.
 */
@Composable
private fun HomeCompactLogRow(
    log: WatchLog,
    onClick: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    val shortDate = RecordDate.formatShortMonthDay(log.watchedAt.ifBlank { log.createdAt }, locale)
    val edition = buildList {
        if (log.seasonNumber != null) add("S${log.seasonNumber}")
        if (log.episodeNumber != null) add("E${log.episodeNumber}")
    }.joinToString(" · ")
    val subText = buildString {
        append(OttlineStrings.statusLabel(log.status, log.title.type, locale))
        if (edition.isNotEmpty()) append(" $edition")
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 18.dp)
        ) {
            Text(
                text = shortDate,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                color = palette.mutedInk,
                maxLines = 1,
                modifier = Modifier.width(54.dp)
            )
            Spacer(Modifier.width(12.dp))
            PosterImage(
                posterUrl = log.seasonPosterUrl ?: log.title.posterUrl,
                titleName = log.title.name,
                titleType = log.title.type,
                modifier = Modifier.size(width = 36.dp, height = 54.dp),
                widthBucket = "w185"
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = log.title.name,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    ),
                    color = palette.ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(5.dp))
                Text(
                    text = subText,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                    color = palette.mutedInk,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(Modifier.width(12.dp))
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                contentDescription = null,
                tint = palette.mutedInk,
                modifier = Modifier.size(16.dp)
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(palette.border)
        )
    }
}
