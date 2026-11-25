package app.ottline.ui

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlin.math.abs
import kotlinx.coroutines.delay
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.ottline.data.OttlineRepository
import app.ottline.data.local.AutoHandoffDecision
import app.ottline.data.local.BrowserHandoffPolicy
import app.ottline.data.local.BrowserHandoffState
import app.ottline.data.local.PlayInstallReferrerManager
import app.ottline.data.local.ThemeMode
import app.ottline.data.local.TwaBrowserBridge
import app.ottline.domain.ShareIntentParser
import app.ottline.model.Occasion
import app.ottline.model.PersonaKey
import app.ottline.model.Place
import app.ottline.ui.components.LocalNoSwipeNavTracker
import app.ottline.ui.components.MainTab
import app.ottline.ui.components.NoSwipeNavTracker
import app.ottline.ui.components.OttlineBottomBar
import app.ottline.ui.components.OttlineIntroSplashOverlay
import app.ottline.ui.components.OttlineSpreadTopHeader
import app.ottline.ui.components.OttlineTopBar
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.layout.AdaptiveLayoutMetrics
import app.ottline.ui.layout.LocalAdaptiveLayoutMetrics
import app.ottline.ui.screens.BookshelfScreen
import app.ottline.ui.screens.DiscussionDetailScreen
import app.ottline.ui.screens.FeedbackScreen
import app.ottline.ui.screens.GuideInfoScreen
import app.ottline.ui.screens.HomeScreen
import app.ottline.ui.screens.MySpaceScreen
import app.ottline.ui.screens.QuickRecordDialog
import app.ottline.ui.screens.QuickRecordRequest
import app.ottline.ui.screens.ReportScreen
import app.ottline.ui.screens.TimelineScreen
import app.ottline.ui.screens.TitleDetailScreen
import app.ottline.ui.screens.TogetherScreen
import app.ottline.ui.screens.WatchReminderScreen
import app.ottline.ui.theme.LocalOttlinePalette
import app.ottline.ui.theme.OttlineTheme

sealed interface LaunchCommand {
    data class OpenRoute(val route: String) : LaunchCommand
    data class OpenTimeline(
        val contentType: String? = null,
        val status: String? = null,
        val place: Place? = null,
        val occasion: Occasion? = null,
        val query: String? = null
    ) : LaunchCommand
    data class OpenQuickRecord(
        val query: String = "",
        val typeTab: String = "all",
        val platform: String? = null,
        val titleId: String? = null
    ) : LaunchCommand
    data class OpenSharedContent(
        val sharedText: String?,
        val sharedSubject: String?
    ) : LaunchCommand
    data class OpenExternalBrowser(val url: String) : LaunchCommand
    data class CompleteTwaHandoff(
        val status: String,
        val userId: String?,
        val deviceId: String?,
        val pairingCode: String?,
        val nickname: String?,
        val personaKey: PersonaKey?
    ) : LaunchCommand
}

internal fun resolveDirectMainTab(route: String): MainTab? = when {
    route == "home" -> MainTab.HOME
    route == "timeline" -> MainTab.TIMELINE
    route == "together" || route.startsWith("discussion/") -> MainTab.TOGETHER
    route == "my_space" || route == "watch_reminder" || route == "guides" -> MainTab.MY_SPACE
    else -> null
}

internal fun resolveActiveMainTab(currentRoute: String, ownerTab: MainTab): MainTab =
    resolveDirectMainTab(currentRoute) ?: ownerTab

@Composable
fun OttlineAppRoot(
    repository: OttlineRepository,
    pendingCommand: LaunchCommand?,
    onConsumeCommand: () -> Unit,
    mainViewModel: OttlineMainViewModel = viewModel()
) {
    val context = LocalContext.current
    val prefsSnapshot by repository.prefs.state.collectAsState()
    val syncState by repository.syncState.collectAsState()
    val outboxCount by repository.outboxCountFlow.collectAsState(initial = 0)
    val allLogs by repository.activeLogsFlow.collectAsState(initial = emptyList())
    val classifications by repository.bookClassificationsFlow.collectAsState(initial = emptyList())

    val quickRecordDraft by mainViewModel.quickRecordDraft.collectAsState()
    val timelineFilter by mainViewModel.timelineFilter.collectAsState()
    val togetherFilter by mainViewModel.togetherFilter.collectAsState()
    val homeSelectedMonth by mainViewModel.homeSelectedMonth.collectAsState()

    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: "home"

    var pendingFeedbackReportBody by rememberSaveable { mutableStateOf<String?>(null) }
    var showIntroSplash by rememberSaveable { mutableStateOf(pendingCommand == null) }
    var pendingReviewCheckAfterSave by rememberSaveable { mutableStateOf(false) }
    var lastMainTab by rememberSaveable { mutableStateOf(MainTab.HOME) }

    val directMainTab = resolveDirectMainTab(currentRoute)
    LaunchedEffect(directMainTab) {
        if (directMainTab != null) {
            lastMainTab = directMainTab
        }
    }

    LaunchedEffect(pendingReviewCheckAfterSave, quickRecordDraft == null, showIntroSplash) {
        if (pendingReviewCheckAfterSave && quickRecordDraft == null && !showIntroSplash) {
            pendingReviewCheckAfterSave = false
            kotlinx.coroutines.delay(700L)
            InAppReviewHelper.maybeRequestInAppReview(
                context = context,
                prefs = repository.prefs,
                activeLogsCount = allLogs.size
            )
        }
    }

    fun navigateTopTab(tab: MainTab) {
        val target = when (tab) {
            MainTab.HOME -> "home"
            MainTab.TIMELINE -> "timeline"
            MainTab.TOGETHER -> "together"
            MainTab.MY_SPACE -> "my_space"
        }
        lastMainTab = tab
        if (currentRoute == target) return
        // Return cleanly to the target tab's root (never save/restore stale detail sub-stacks
        // like `title/{id}` across tab switches; filter/selection/scroll states live in ViewModel).
        val poppedToExisting = navController.popBackStack(target, inclusive = false)
        if (!poppedToExisting) {
            navController.navigate(target) {
                popUpTo(navController.graph.findStartDestination().id) {
                    inclusive = false
                    saveState = false
                }
                launchSingleTop = true
                restoreState = false
            }
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    var sawPauseWhileHandoffPending by remember { mutableStateOf(false) }
    var resumeSignal by remember { mutableIntStateOf(0) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> {
                    if (repository.prefs.current.browserHandoffState == BrowserHandoffState.PENDING) {
                        sawPauseWhileHandoffPending = true
                    }
                }
                Lifecycle.Event.ON_RESUME -> {
                    resumeSignal++
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Detect return from Custom Tab without `ottline://open?handoff=1...` callback
    // (e.g., Cloudflare 522, network error, or user closing the browser / pressing Back).
    LaunchedEffect(resumeSignal, pendingCommand) {
        if (pendingCommand is LaunchCommand.CompleteTwaHandoff) {
            sawPauseWhileHandoffPending = false
            return@LaunchedEffect
        }
        if (!BrowserHandoffPolicy.shouldMarkIncompleteOnResume(
                prefs = repository.prefs.current,
                sawPauseWhilePending = sawPauseWhileHandoffPending,
                hasPendingHandoffCallback = false
            )
        ) {
            return@LaunchedEffect
        }
        // Grace window so any concurrent onNewIntent callback settles first
        delay(350)
        if (pendingCommand is LaunchCommand.CompleteTwaHandoff) {
            sawPauseWhileHandoffPending = false
            return@LaunchedEffect
        }
        if (BrowserHandoffPolicy.shouldMarkIncompleteOnResume(
                prefs = repository.prefs.current,
                sawPauseWhilePending = sawPauseWhileHandoffPending,
                hasPendingHandoffCallback = false
            )
        ) {
            sawPauseWhileHandoffPending = false
            repository.prefs.markBrowserHandoffIncompleteReturn()
            val msg = if (repository.prefs.current.locale == "en") {
                "Browser connection didn't finish. You can try again or link with a code."
            } else {
                "브라우저에서 연결이 완료되지 않았어요. 다시 시도하거나 연결 코드로 이어받을 수 있어요."
            }
            Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
        }
    }

    // Track session-deduplicated `app_open` once per app session (F08) + Install Referrer + automatic TWA/Web handoff
    LaunchedEffect(Unit) {
        repository.deduplicateLocalRecordsIfNeeded()
        val firstInstallReferrer = if (!repository.prefs.current.installReferrerChecked) {
            PlayInstallReferrerManager.checkAndProcessOnce(context, repository)
        } else {
            null
        }
        repository.trackAppOpenOnce(
            entrySource = if (pendingCommand != null) "deeplink" else "launcher",
            extraAttribution = firstInstallReferrer?.toAppOpenAttributionProps().orEmpty()
        )

        val decision = BrowserHandoffPolicy.decideAutoHandoffOnStart(
            prefs = repository.prefs.current,
            hasPendingHandoffCallback = pendingCommand is LaunchCommand.CompleteTwaHandoff,
            hasTwaFootprint = TwaBrowserBridge.hasTwaOrUpgradeFootprint(context),
            referrerWebHandoff = firstInstallReferrer?.webHandoff == true
        )

        when (decision) {
            AutoHandoffDecision.MARK_INCOMPLETE_RETURN -> {
                repository.prefs.markBrowserHandoffIncompleteReturn()
            }
            AutoHandoffDecision.TRY_TOKEN_THEN_BROWSER -> {
                val restoredByToken = if (repository.prefs.current.userId.isNullOrBlank()) {
                    repository.tryRestoreFromTwaInstallToken()
                } else {
                    false
                }
                if (restoredByToken) {
                    val msg = if (repository.prefs.current.locale == "en") {
                        "Connected your previous records."
                    } else {
                        "기존 기록을 자동으로 연결했어요."
                    }
                    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                } else if (!repository.prefs.current.twaBrowserHandoffCompleted) {
                    val launched = TwaBrowserBridge.launchManagedHandoff(
                        context = context,
                        prefs = repository.prefs,
                        isAutomatic = true
                    )
                    if (!launched) {
                        val msg = if (repository.prefs.current.locale == "en") {
                            "Couldn't open a browser. You can link with your connection code."
                        } else {
                            "브라우저를 열지 못했어요. 연결 코드로 바로 이어받을 수 있어요."
                        }
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    }
                }
            }
            AutoHandoffDecision.LAUNCH_REFERRER_BROWSER -> {
                repository.trackEvent(
                    "web_to_app_handoff_start",
                    mapOf("campaign" to (firstInstallReferrer?.utmCampaign ?: "unknown"))
                )
                val launched = TwaBrowserBridge.launchManagedHandoff(
                    context = context,
                    prefs = repository.prefs,
                    isAutomatic = true
                )
                if (!launched) {
                    val msg = if (repository.prefs.current.locale == "en") {
                        "Couldn't open a browser. You can link with your connection code."
                    } else {
                        "브라우저를 열지 못했어요. 연결 코드로 바로 이어받을 수 있어요."
                    }
                    Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                }
            }
            AutoHandoffDecision.NONE -> Unit
        }
    }

    // Initial background sync if already registered
    LaunchedEffect(prefsSnapshot.userId) {
        if (!prefsSnapshot.userId.isNullOrBlank()) {
            repository.triggerSyncAsync()
        }
    }

    // Handle external intents (Shortcuts, Widget, App Links, Share Sheet)
    LaunchedEffect(pendingCommand) {
        val cmd = pendingCommand ?: return@LaunchedEffect
        when (cmd) {
            is LaunchCommand.OpenRoute -> {
                navController.navigate(cmd.route) {
                    launchSingleTop = true
                }
            }
            is LaunchCommand.OpenTimeline -> {
                mainViewModel.applyDeepLinkTimelineFilter(
                    contentType = cmd.contentType,
                    status = cmd.status,
                    place = cmd.place,
                    occasion = cmd.occasion,
                    query = cmd.query
                )
                navigateTopTab(MainTab.TIMELINE)
            }
            is LaunchCommand.OpenQuickRecord -> {
                val targetTitleId = cmd.titleId
                val localTitle = targetTitleId?.let { repository.db.titleDao().getById(it)?.toModel() }
                val existingLog = localTitle?.let {
                    repository.db.watchLogDao().getActiveByTitleId(it.id).firstOrNull()?.toModel(it)
                }
                mainViewModel.openQuickRecord(
                    QuickRecordRequest(
                        initialQuery = cmd.query,
                        initialTypeTab = cmd.typeTab,
                        preselectedTitle = localTitle,
                        existingLog = existingLog,
                        prefilledPlatform = cmd.platform,
                        autoFocusSearch = localTitle == null
                    )
                )
            }
            is LaunchCommand.OpenSharedContent -> {
                val parsed = ShareIntentParser.parse(cmd.sharedText, cmd.sharedSubject)
                val urls = ShareIntentParser.extractUrls(cmd.sharedText, cmd.sharedSubject)
                val inferredPlatform = ShareIntentParser.inferPlatform(cmd.sharedText, cmd.sharedSubject)

                var finalQuery = parsed?.query.orEmpty()
                val finalType = parsed?.contentType ?: "video"

                if (finalQuery.isBlank() && urls.isNotEmpty()) {
                    val htmlTitle = repository.api.resolveSharedUrlTitle(urls.first())
                    finalQuery = ShareIntentParser.sanitizeResolvedTitle(htmlTitle).orEmpty()
                }

                mainViewModel.openQuickRecord(
                    QuickRecordRequest(
                        initialQuery = finalQuery,
                        initialTypeTab = finalType,
                        prefilledPlatform = parsed?.platform ?: inferredPlatform,
                        autoFocusSearch = finalQuery.isBlank()
                    )
                )
            }
            is LaunchCommand.OpenExternalBrowser -> {
                TwaBrowserBridge.launchInExternalCustomTab(context, cmd.url)
            }
            is LaunchCommand.CompleteTwaHandoff -> {
                sawPauseWhileHandoffPending = false
                val outcome = repository.completeTwaHandoffWithOutcome(
                    status = cmd.status,
                    userId = cmd.userId,
                    deviceId = cmd.deviceId,
                    pairingCode = cmd.pairingCode,
                    nickname = cmd.nickname,
                    personaKey = cmd.personaKey
                )
                val isEn = repository.prefs.current.locale == "en"
                when (outcome) {
                    OttlineRepository.HandoffOutcome.CONNECTED -> {
                        val msg = if (isEn) {
                            "Connected your previous records."
                        } else {
                            "기존 기록을 성공적으로 연결했어요."
                        }
                        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                        navigateTopTab(MainTab.HOME)
                    }
                    OttlineRepository.HandoffOutcome.EMPTY_SESSION -> {
                        val msg = if (isEn) {
                            "No saved records were found in this browser. Try linking with your code if you used another browser."
                        } else {
                            "이 브라우저에서 저장된 기록을 찾지 못했어요. 다른 브라우저를 쓰셨다면 연결 코드로 이어받을 수 있어요."
                        }
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    }
                    OttlineRepository.HandoffOutcome.SERVER_ERROR -> {
                        val msg = if (isEn) {
                            "Couldn’t verify your account with the server. Your device records are safe—please try again shortly."
                        } else {
                            "서버와 연결을 확인하지 못했어요. 이 기기의 기록은 그대로 보관돼 있으니 잠시 후 다시 시도해 주세요."
                        }
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    }
                    OttlineRepository.HandoffOutcome.INVALID_CALLBACK,
                    OttlineRepository.HandoffOutcome.MERGE_FAILED -> {
                        val msg = if (isEn) {
                            "Couldn't finish connecting your records. Your device records are safe—please try again."
                        } else {
                            "기존 기록 연결을 완료하지 못했어요. 이 기기의 기록은 그대로 보관돼 있으니 다시 시도해 주세요."
                        }
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
        onConsumeCommand()
    }

    val activeMainTab = resolveActiveMainTab(currentRoute = currentRoute, ownerTab = lastMainTab)

    // Matches `SwipeNav.tsx` (`currentTab(pathname)`): active on the 4 top-level tab routes
    val swipeCurrentTab: MainTab? = when (currentRoute) {
        "home" -> MainTab.HOME
        "timeline" -> MainTab.TIMELINE
        "together" -> MainTab.TOGETHER
        "my_space" -> MainTab.MY_SPACE
        else -> null
    }

    val noSwipeTracker = remember { NoSwipeNavTracker() }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val adaptiveMetrics = remember(maxWidth) {
            AdaptiveLayoutMetrics.resolve(maxWidth.value.toInt())
        }

        CompositionLocalProvider(
            LocalAppLocale provides prefsSnapshot.locale,
            LocalNoSwipeNavTracker provides noSwipeTracker,
            LocalAdaptiveLayoutMetrics provides adaptiveMetrics
        ) {
            OttlineTheme(themeMode = prefsSnapshot.themeMode) {
                val palette = LocalOttlinePalette.current
                val toggleThemeAction = {
                    val nextMode = when (prefsSnapshot.themeMode) {
                        ThemeMode.SYSTEM -> ThemeMode.LIGHT
                        ThemeMode.LIGHT -> ThemeMode.DARK
                        ThemeMode.DARK -> ThemeMode.SYSTEM
                    }
                    repository.prefs.setThemeMode(nextMode)
                }

                Box(modifier = Modifier.fillMaxSize()) {
                    Scaffold(
                        containerColor = palette.background,
                        topBar = {
                            if (adaptiveMetrics.isSpread) {
                                OttlineSpreadTopHeader(
                                    currentTab = activeMainTab,
                                    nickname = prefsSnapshot.nickname,
                                    personaKey = prefsSnapshot.personaKey,
                                    locale = prefsSnapshot.locale,
                                    themeMode = prefsSnapshot.themeMode,
                                    syncState = syncState,
                                    outboxCount = outboxCount,
                                    showTabIcons = adaptiveMetrics.showHeaderTabIcons,
                                    compactRecordCta = adaptiveMetrics.compactHeaderRecordCta,
                                    maxContentWidth = adaptiveMetrics.maxContentWidth,
                                    horizontalPadding = adaptiveMetrics.horizontalPadding,
                                    onSelectTab = { navigateTopTab(it) },
                                    onQuickRecordClick = {
                                        mainViewModel.openQuickRecord(QuickRecordRequest(autoFocusSearch = true))
                                    },
                                    onSyncClick = { repository.triggerSyncAsync() },
                                    onSelectLocale = { nextLocale ->
                                        repository.prefs.setLocale(nextLocale)
                                    },
                                    onToggleTheme = toggleThemeAction,
                                    onLogoClick = { navigateTopTab(MainTab.HOME) },
                                    onProfileClick = { navigateTopTab(MainTab.MY_SPACE) }
                                )
                            } else {
                                OttlineTopBar(
                                    nickname = prefsSnapshot.nickname,
                                    personaKey = prefsSnapshot.personaKey,
                                    locale = prefsSnapshot.locale,
                                    themeMode = prefsSnapshot.themeMode,
                                    onSelectLocale = { nextLocale ->
                                        repository.prefs.setLocale(nextLocale)
                                    },
                                    onToggleTheme = toggleThemeAction,
                                    onLogoClick = { navigateTopTab(MainTab.HOME) },
                                    onProfileClick = { navigateTopTab(MainTab.MY_SPACE) }
                                )
                            }
                        },
                        bottomBar = {
                            if (!adaptiveMetrics.isSpread) {
                                OttlineBottomBar(
                                    currentTab = activeMainTab,
                                    onSelectTab = { navigateTopTab(it) },
                                    onQuickRecordClick = {
                                        mainViewModel.openQuickRecord(QuickRecordRequest(autoFocusSearch = true))
                                    }
                                )
                            }
                        }
                    ) { innerPadding ->
                        val swipeModifier = if (!adaptiveMetrics.isSpread) {
                            Modifier.pointerInput(swipeCurrentTab, noSwipeTracker) {
                                val tab = swipeCurrentTab ?: return@pointerInput
                                val edgeGuardPx = 24.dp.toPx()
                                val minSwipeXPx = 72.dp.toPx()
                                val maxSwipeYPx = 48.dp.toPx()
                                val maxDurationMs = 700L

                                awaitEachGesture {
                                    noSwipeTracker.ignoreCurrentGesture = false
                                    val down = awaitFirstDown(
                                        requireUnconsumed = false,
                                        pass = PointerEventPass.Initial
                                    )
                                    val startX = down.position.x
                                    val startY = down.position.y
                                    if (startX <= edgeGuardPx || startX >= size.width - edgeGuardPx) {
                                        return@awaitEachGesture
                                    }

                                    val startTime = System.currentTimeMillis()
                                    var endX = startX
                                    var endY = startY
                                    var aborted = false

                                    while (true) {
                                        val event = awaitPointerEvent(PointerEventPass.Initial)
                                        if (noSwipeTracker.ignoreCurrentGesture || event.changes.size > 1) {
                                            aborted = true
                                        }
                                        val change = event.changes.firstOrNull { it.id == down.id }
                                            ?: event.changes.firstOrNull()
                                        if (change != null) {
                                            endX = change.position.x
                                            endY = change.position.y
                                        }
                                        if (event.changes.none { it.pressed }) {
                                            break
                                        }
                                    }

                                    if (aborted) return@awaitEachGesture
                                    val dt = System.currentTimeMillis() - startTime
                                    val dx = endX - startX
                                    val dy = endY - startY

                                    if (dt > maxDurationMs) return@awaitEachGesture
                                    if (abs(dx) < minSwipeXPx) return@awaitEachGesture
                                    if (abs(dy) > maxSwipeYPx) return@awaitEachGesture

                                    val order = MainTab.entries
                                    val idx = order.indexOf(tab)
                                    if (idx < 0) return@awaitEachGesture

                                    // Swipe left (`dx < 0`) -> next tab, swipe right (`dx > 0`) -> previous tab
                                    val nextIdx = if (dx < 0f) idx + 1 else idx - 1
                                    if (nextIdx in order.indices) {
                                        navigateTopTab(order[nextIdx])
                                    }
                                }
                            }
                        } else {
                            Modifier
                        }

                        Box(
                            contentAlignment = Alignment.TopCenter,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(innerPadding)
                                .then(if (adaptiveMetrics.isSpread) Modifier.navigationBarsPadding() else Modifier)
                                .then(swipeModifier)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .then(
                                        if (adaptiveMetrics.isSpread) {
                                            Modifier.widthIn(max = adaptiveMetrics.maxContentWidth)
                                        } else {
                                            Modifier
                                        }
                                    )
                                    .fillMaxWidth()
                            ) {
                                NavHost(
                                    navController = navController,
                                    startDestination = "home"
                                ) {
                                    composable("home") {
                                        HomeScreen(
                                            logs = allLogs,
                                            prefsSnapshot = prefsSnapshot,
                                            syncState = syncState,
                                            outboxCount = outboxCount,
                                            repository = repository,
                                            persistedSelectedMonth = homeSelectedMonth,
                                            onSelectMonth = { mainViewModel.setHomeSelectedMonth(it) },
                                            onOpenQuickRecord = { req -> mainViewModel.openQuickRecord(req) },
                                            onOpenTitleDetail = { id ->
                                                navController.navigate("title/${Uri.encode(id)}")
                                            },
                                            onOpenTimeline = { navigateTopTab(MainTab.TIMELINE) },
                                            onOpenTogether = { navigateTopTab(MainTab.TOGETHER) },
                                            onOpenReport = { navController.navigate("report") { launchSingleTop = true } },
                                            onOpenBookshelf = { navController.navigate("bookshelf") { launchSingleTop = true } },
                                            onOpenTimelineWithMoment = { place, occ ->
                                                mainViewModel.applyDeepLinkTimelineFilter(
                                                    contentType = null,
                                                    status = null,
                                                    place = place,
                                                    occasion = occ,
                                                    query = null
                                                )
                                                navigateTopTab(MainTab.TIMELINE)
                                            },
                                            onOpenMySpacePairing = { navigateTopTab(MainTab.MY_SPACE) },
                                            onOpenWatchReminderSettings = { navController.navigate("watch_reminder") }
                                        )
                                    }

                                    composable("timeline") {
                                        TimelineScreen(
                                            allLogs = allLogs,
                                            classifications = classifications,
                                            prefsSnapshot = prefsSnapshot,
                                            repository = repository,
                                            filterState = timelineFilter,
                                            onUpdateFilter = { mainViewModel.updateTimelineFilter(it) },
                                            onOpenQuickRecord = { req -> mainViewModel.openQuickRecord(req) },
                                            onOpenTitleDetail = { id ->
                                                navController.navigate("title/${Uri.encode(id)}")
                                            },
                                            onOpenReport = { navController.navigate("report") },
                                            onOpenBookshelf = { navController.navigate("bookshelf") }
                                        )
                                    }

                                    composable("together") {
                                        TogetherScreen(
                                            prefsSnapshot = prefsSnapshot,
                                            repository = repository,
                                            filterState = togetherFilter,
                                            onUpdateFilter = { mainViewModel.updateTogetherFilter(it) },
                                            onOpenDiscussion = { discId ->
                                                mainViewModel.selectTogetherDiscussion(discId)
                                                navController.navigate("discussion/${Uri.encode(discId)}")
                                            },
                                            onOpenTitleDetail = { titleId ->
                                                navController.navigate("title/${Uri.encode(titleId)}")
                                            },
                                            onReportContent = { reportText ->
                                                pendingFeedbackReportBody = reportText
                                                navController.navigate("feedback")
                                            }
                                        )
                                    }

                                    composable("my_space") {
                                        MySpaceScreen(
                                            allLogs = allLogs,
                                            prefsSnapshot = prefsSnapshot,
                                            repository = repository,
                                            onOpenReport = { navController.navigate("report") },
                                            onOpenBookshelf = { navController.navigate("bookshelf") },
                                            onOpenFeedback = { navController.navigate("feedback") },
                                            onOpenWatchReminder = { navController.navigate("watch_reminder") },
                                            onOpenGuides = { navController.navigate("guides") }
                                        )
                                    }

                                    composable(
                                        route = "title/{titleId}",
                                        arguments = listOf(navArgument("titleId") { type = NavType.StringType })
                                    ) { entry ->
                                        val rawId = entry.arguments?.getString("titleId").orEmpty()
                                        TitleDetailScreen(
                                            titleId = Uri.decode(rawId),
                                            allLogs = allLogs,
                                            prefsSnapshot = prefsSnapshot,
                                            repository = repository,
                                            onBack = { navController.popBackStack() },
                                            onOpenQuickRecord = { req -> mainViewModel.openQuickRecord(req) },
                                            onNavigateToTitle = { nextId ->
                                                navController.navigate("title/${Uri.encode(nextId)}")
                                            },
                                            onReportContent = { reportText ->
                                                pendingFeedbackReportBody = reportText
                                                navController.navigate("feedback")
                                            }
                                        )
                                    }

                                    composable(
                                        route = "discussion/{discussionId}",
                                        arguments = listOf(navArgument("discussionId") { type = NavType.StringType })
                                    ) { entry ->
                                        val decodedId = Uri.decode(entry.arguments?.getString("discussionId").orEmpty())
                                        LaunchedEffect(decodedId) {
                                            if (decodedId.isNotBlank()) {
                                                mainViewModel.selectTogetherDiscussion(decodedId)
                                            }
                                        }
                                        // When expanding from compact detail back into a wide two-pane window
                                        // from the Together list, merge seamlessly into the two-pane view with
                                        // the same discussion selected (while preserving direct deep-link routes).
                                        LaunchedEffect(adaptiveMetrics.togetherTwoPane, decodedId) {
                                            if (adaptiveMetrics.togetherTwoPane &&
                                                navController.previousBackStackEntry?.destination?.route == "together"
                                            ) {
                                                navController.popBackStack()
                                            }
                                        }
                                        DiscussionDetailScreen(
                                            discussionId = decodedId,
                                            prefsSnapshot = prefsSnapshot,
                                            repository = repository,
                                            onBack = { navController.popBackStack() },
                                            onOpenTitleDetail = { titleId ->
                                                navController.navigate("title/${Uri.encode(titleId)}")
                                            },
                                            onReportContent = { reportText ->
                                                pendingFeedbackReportBody = reportText
                                                navController.navigate("feedback")
                                            }
                                        )
                                    }

                                    composable("report") {
                                        ReportScreen(
                                            allLogs = allLogs,
                                            prefsSnapshot = prefsSnapshot,
                                            repository = repository,
                                            onBack = { navController.popBackStack() },
                                            onOpenTitleDetail = { id ->
                                                navController.navigate("title/${Uri.encode(id)}")
                                            }
                                        )
                                    }

                                    composable("bookshelf") {
                                        BookshelfScreen(
                                            allLogs = allLogs,
                                            classifications = classifications,
                                            repository = repository,
                                            onBack = { navController.popBackStack() },
                                            onOpenTitleDetail = { id ->
                                                navController.navigate("title/${Uri.encode(id)}")
                                            },
                                            onOpenQuickBookRecord = {
                                                mainViewModel.openQuickRecord(QuickRecordRequest(initialTypeTab = "book"))
                                            }
                                        )
                                    }

                                    composable("feedback") {
                                        FeedbackScreen(
                                            repository = repository,
                                            prefilledReportBody = pendingFeedbackReportBody,
                                            onConsumePrefill = { pendingFeedbackReportBody = null },
                                            onBack = { navController.popBackStack() }
                                        )
                                    }

                                    composable("watch_reminder") {
                                        WatchReminderScreen(onBack = { navController.popBackStack() })
                                    }

                                    composable("guides") {
                                        GuideInfoScreen(onBack = { navController.popBackStack() })
                                    }
                                }
                            }
                        }
                    }

                    quickRecordDraft?.let { draft ->
                        QuickRecordDialog(
                            draft = draft,
                            onUpdateDraft = { mainViewModel.updateQuickRecordDraft(it) },
                            repository = repository,
                            nickname = prefsSnapshot.nickname,
                            personaKey = prefsSnapshot.personaKey,
                            customVideoPlatforms = prefsSnapshot.customVideoPlatforms,
                            customBookPlatforms = prefsSnapshot.customBookPlatforms,
                            onDismiss = {
                                if (draft.savedLog != null) {
                                    pendingReviewCheckAfterSave = true
                                }
                                mainViewModel.dismissQuickRecord()
                            },
                            onOpenTimeline = {
                                if (draft.savedLog != null) {
                                    pendingReviewCheckAfterSave = true
                                }
                                mainViewModel.dismissQuickRecord()
                                navigateTopTab(MainTab.TIMELINE)
                            },
                            onSavedAndOpenTitle = { savedTitleId ->
                                pendingReviewCheckAfterSave = true
                                mainViewModel.dismissQuickRecord()
                                navController.navigate("title/${Uri.encode(savedTitleId)}") {
                                    launchSingleTop = true
                                }
                            }
                        )
                    }

                    OttlineIntroSplashOverlay(
                        visible = showIntroSplash,
                        nickname = prefsSnapshot.nickname,
                        onFinished = { showIntroSplash = false }
                    )
                }
            }
        }
    }
}
