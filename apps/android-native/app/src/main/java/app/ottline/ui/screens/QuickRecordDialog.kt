package app.ottline.ui.screens

import android.app.DatePickerDialog
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Tv
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import app.ottline.data.OttlineRepository
import app.ottline.domain.BookshelfBuilder
import app.ottline.domain.RecordDate
import app.ottline.domain.RecordFeelings
import app.ottline.domain.TitleFallback
import app.ottline.model.CreateCommentRequest
import app.ottline.model.DiscussionListItem
import app.ottline.model.EpisodeOption
import app.ottline.model.LogDraft
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.PersonaKey
import app.ottline.model.Place
import app.ottline.model.Provider
import app.ottline.model.SeasonOption
import app.ottline.model.Title
import app.ottline.model.TitleSearchItem
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.QuickRecordDraftState
import app.ottline.ui.QuickRecordStage
import app.ottline.ui.components.FeelingIcon
import app.ottline.ui.components.PosterImage
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import java.time.LocalDate
import java.util.UUID
import kotlin.math.abs
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class QuickRecordRequest(
    val initialQuery: String = "",
    val initialTypeTab: String = "all", // "all" | "movie" | "series" | "book"
    val preselectedTitle: Title? = null,
    val preselectedSearchItem: TitleSearchItem? = null,
    val preferredStatus: LogStatus? = null,
    val selectSource: String? = null,
    val existingLog: WatchLog? = null,
    val prefilledPlatform: String? = null,
    val autoFocusSearch: Boolean = true
)

/**
 * 4-stage mobile QuickRecord modal aligned 100% with web v2 `QuickLogDialog.tsx`,
 * `QuickLogCard.tsx`, `TitleSearchBox.tsx`, `RecordFeelings.tsx`, and `recording.module.css`
 * (`search` -> `status` -> `saved` -> `edit`) and backed by `SavedStateHandle`.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun QuickRecordDialog(
    draft: QuickRecordDraftState,
    onUpdateDraft: ((QuickRecordDraftState) -> QuickRecordDraftState) -> Unit,
    repository: OttlineRepository,
    nickname: String?,
    personaKey: PersonaKey?,
    customVideoPlatforms: List<String>,
    customBookPlatforms: List<String>,
    onDismiss: () -> Unit,
    onOpenTimeline: (() -> Unit)? = null,
    onSavedAndOpenTitle: ((String) -> Unit)? = null
) {
    val locale = LocalAppLocale.current
    val palette = LocalOttlinePalette.current
    val haptics = LocalHapticFeedback.current
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val scope = rememberCoroutineScope()

    var searchResults by remember { mutableStateOf<List<TitleSearchItem>>(emptyList()) }
    var popularSuggestions by remember { mutableStateOf<List<TitleSearchItem>>(emptyList()) }
    var recentDiscussions by remember { mutableStateOf<List<DiscussionListItem>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var searchError by remember { mutableStateOf<String?>(null) }
    var partialSearchHint by remember { mutableStateOf<String?>(null) }
    val searchFocusRequester = remember { FocusRequester() }

    // Series season / episode catalog state
    var seasons by remember { mutableStateOf<List<SeasonOption>>(emptyList()) }
    var episodes by remember { mutableStateOf<List<EpisodeOption>>(emptyList()) }
    var seasonLoading by remember { mutableStateOf(false) }
    var episodeLoading by remember { mutableStateOf(false) }
    var seasonLoadFailed by remember { mutableStateOf(false) }

    var savingInitial by remember { mutableStateOf(false) }
    var savingDetails by remember { mutableStateOf(false) }
    var togetherError by remember { mutableStateOf<String?>(null) }
    var shareCardTargetLog by remember { mutableStateOf<WatchLog?>(null) }
    var dismissAfterShareCard by remember { mutableStateOf(false) }
    var savedBookShelfMajor by remember { mutableStateOf<Int?>(null) }

    val activeTitle = draft.selectedTitle
    val stage = if (activeTitle == null) QuickRecordStage.SEARCH else draft.stage

    LaunchedEffect(stage) {
        if (stage != QuickRecordStage.SEARCH) {
            runCatching { focusManager.clearFocus(force = true) }
            runCatching { keyboardController?.hide() }
        }
    }

    LaunchedEffect(activeTitle?.id, stage) {
        val t = activeTitle
        if (stage == QuickRecordStage.SAVED && t != null && t.type == TitleType.BOOK) {
            savedBookShelfMajor = null
            runCatching { repository.ensureBookClassificationsCached(listOf(t)) }
            val isbn13 = BookshelfBuilder.normalizeBookIsbn13(t)
            if (isbn13 != null) {
                savedBookShelfMajor = runCatching {
                    repository.db.bookClassificationDao().getByIsbns(listOf(isbn13)).firstOrNull()?.kdcMajor
                }.getOrNull()
            }
        } else {
            savedBookShelfMajor = null
        }
    }

    // Load empty-query suggestions once (`TitleSearchBox.tsx` parity: recent discussions + popular titles)
    LaunchedEffect(Unit) {
        runCatching { repository.api.getDiscussionsLatest(6, 14) }
            .onSuccess { recentDiscussions = it }
        runCatching { repository.api.getPopularTitles(8) }
            .onSuccess { popularSuggestions = it }
        if (draft.autoFocusSearch && activeTitle == null) {
            delay(120)
            runCatching { searchFocusRequester.requestFocus() }
        }
    }

    // Reconcile local Title & fire `title_select` analytics when opened directly from Home Starter Card
    LaunchedEffect(activeTitle?.id, draft.pendingSelectSource) {
        val candidate = activeTitle ?: return@LaunchedEffect
        val source = draft.pendingSelectSource ?: return@LaunchedEffect
        val localMatch = repository.findMatchingLocalTitle(candidate)
        val finalTitle = localMatch ?: candidate
        val existingForTitle = repository.db.watchLogDao()
            .getActiveByTitleId(finalTitle.id)
            .firstOrNull()
            ?.toModel(finalTitle)
        repository.trackTitleSelect(finalTitle, source)
        onUpdateDraft { cur ->
            if (existingForTitle != null) {
                cur.copy(
                    pendingSelectSource = null,
                    selectedTitle = finalTitle,
                    savedLog = existingForTitle,
                    chosenStatus = existingForTitle.status,
                    watchedDateStr = RecordDate.recordDateInput(existingForTitle.watchedAt),
                    selectedPlace = existingForTitle.place,
                    selectedOccasion = existingForTitle.occasion,
                    selectedPlatform = existingForTitle.ott ?: cur.selectedPlatform,
                    feelingScore = existingForTitle.rating,
                    noteText = existingForTitle.note.orEmpty(),
                    spoiler = existingForTitle.spoiler,
                    selectedSeason = existingForTitle.seasonNumber,
                    selectedEpisode = existingForTitle.episodeNumber,
                    seasonPosterUrl = existingForTitle.seasonPosterUrl,
                    seasonYear = existingForTitle.seasonYear,
                    manualSeasonText = existingForTitle.seasonNumber?.toString().orEmpty(),
                    manualEpisodeText = existingForTitle.episodeNumber?.toString().orEmpty()
                )
            } else {
                cur.copy(
                    pendingSelectSource = null,
                    selectedTitle = finalTitle
                )
            }
        }
    }

    // 250ms debounced search matching `TitleSearchBox.tsx` (`all` queries both video & book in parallel)
    LaunchedEffect(draft.query, draft.searchTab, stage) {
        if (stage != QuickRecordStage.SEARCH) return@LaunchedEffect
        val trimmed = draft.query.trim()
        if (trimmed.isEmpty()) {
            searchResults = emptyList()
            searchError = null
            partialSearchHint = null
            searching = false
            return@LaunchedEffect
        }
        searching = true
        searchError = null
        partialSearchHint = null
        delay(250)

        if (draft.searchTab == "all") {
            val (videoRes, bookRes) = coroutineScope {
                val vDeferred = async { runCatching { repository.api.searchTitles(trimmed, null) } }
                val bDeferred = async { runCatching { repository.api.searchTitles(trimmed, "book") } }
                vDeferred.await() to bDeferred.await()
            }
            if (videoRes.isFailure && bookRes.isFailure) {
                searchResults = emptyList()
                searchError = videoRes.exceptionOrNull()?.message ?: bookRes.exceptionOrNull()?.message
                searching = false
            } else {
                val combined = buildList {
                    videoRes.getOrNull()?.let { addAll(it) }
                    bookRes.getOrNull()?.let { addAll(it) }
                }
                searchResults = combined
                if (videoRes.isFailure || bookRes.isFailure) {
                    partialSearchHint = if (locale == "en") {
                        "Some title types could not be loaded. Choose a type to try again."
                    } else {
                        "일부 종류의 작품을 불러오지 못했어요. 종류를 골라 다시 찾아보세요."
                    }
                }
                searching = false
                repository.trackTitleSearch(
                    queryLength = trimmed.length,
                    resultCount = combined.size,
                    category = "all"
                )
            }
        } else {
            runCatching {
                repository.api.searchTitles(
                    query = trimmed,
                    typeFilter = draft.searchTab
                )
            }.onSuccess { items ->
                searchResults = items
                searching = false
                repository.trackTitleSearch(
                    queryLength = trimmed.length,
                    resultCount = items.size,
                    category = draft.searchTab
                )
            }.onFailure { err ->
                searchResults = emptyList()
                searchError = err.message
                searching = false
            }
        }
    }

    // Load TMDB seasons & enrich metadata when a series/movie is selected
    LaunchedEffect(activeTitle?.id, activeTitle?.providerId) {
        val t = activeTitle ?: return@LaunchedEffect
        if (t.type == TitleType.SERIES && t.provider == Provider.TMDB && !t.providerId.isNullOrBlank()) {
            seasonLoading = true
            seasonLoadFailed = false
            runCatching { repository.api.getTvSeasons(t.providerId) }
                .onSuccess {
                    seasons = it
                    seasonLoading = false
                }
                .onFailure {
                    seasons = emptyList()
                    seasonLoading = false
                    seasonLoadFailed = true
                }
        } else {
            seasons = emptyList()
            episodes = emptyList()
            seasonLoading = false
            seasonLoadFailed = false
        }

        if ((t.type == TitleType.MOVIE || t.type == TitleType.SERIES) &&
            t.provider == Provider.TMDB &&
            !t.providerId.isNullOrBlank() &&
            t.genres.isNullOrEmpty()
        ) {
            runCatching { repository.api.getTmdbMetadata(t.type, t.providerId) }
                .onSuccess { meta ->
                    onUpdateDraft { cur ->
                        val curTitle = cur.selectedTitle ?: return@onUpdateDraft cur
                        if (curTitle.id != t.id) return@onUpdateDraft cur
                        cur.copy(
                            selectedTitle = curTitle.copy(
                                genres = meta.genres ?: curTitle.genres,
                                directors = meta.directors ?: curTitle.directors,
                                cast = meta.cast ?: curTitle.cast,
                                overview = meta.overview ?: curTitle.overview
                            )
                        )
                    }
                }
        }
    }

    LaunchedEffect(activeTitle?.providerId, draft.selectedSeason, seasons) {
        val t = activeTitle ?: return@LaunchedEffect
        val sNum = draft.selectedSeason
        if (t.type == TitleType.SERIES && t.provider == Provider.TMDB && !t.providerId.isNullOrBlank() && sNum != null) {
            val matchedSeason = seasons.firstOrNull { it.seasonNumber == sNum }
            if (matchedSeason != null && (draft.seasonPosterUrl != matchedSeason.posterUrl || draft.seasonYear != matchedSeason.year)) {
                onUpdateDraft {
                    it.copy(
                        seasonPosterUrl = matchedSeason.posterUrl,
                        seasonYear = matchedSeason.year
                    )
                }
            }
            episodeLoading = true
            runCatching { repository.api.getTvEpisodes(t.providerId, sNum) }
                .onSuccess {
                    episodes = it
                    episodeLoading = false
                }
                .onFailure {
                    episodes = emptyList()
                    episodeLoading = false
                }
        } else {
            episodes = emptyList()
            episodeLoading = false
        }
    }

    fun selectTitleAndAdvance(candidate: Title, source: String, googleBooksUrl: String? = null) {
        runCatching { focusManager.clearFocus(force = true) }
        runCatching { keyboardController?.hide() }
        scope.launch {
            val localMatch = repository.findMatchingLocalTitle(candidate)
            val finalTitle = localMatch ?: candidate
            val existingForTitle = repository.db.watchLogDao()
                .getActiveByTitleId(finalTitle.id)
                .firstOrNull()
                ?.toModel(finalTitle)

            repository.trackTitleSelect(finalTitle, source)

            onUpdateDraft { cur ->
                if (existingForTitle != null) {
                    cur.copy(
                        stage = QuickRecordStage.STATUS,
                        selectedTitle = finalTitle,
                        googleBooksSourceUrl = googleBooksUrl,
                        savedLog = existingForTitle,
                        chosenStatus = existingForTitle.status,
                        watchedDateStr = RecordDate.recordDateInput(existingForTitle.watchedAt),
                        selectedPlace = existingForTitle.place,
                        selectedOccasion = existingForTitle.occasion,
                        selectedPlatform = existingForTitle.ott ?: cur.selectedPlatform,
                        feelingScore = existingForTitle.rating,
                        noteText = existingForTitle.note.orEmpty(),
                        spoiler = existingForTitle.spoiler,
                        selectedSeason = existingForTitle.seasonNumber,
                        selectedEpisode = existingForTitle.episodeNumber,
                        seasonPosterUrl = existingForTitle.seasonPosterUrl,
                        seasonYear = existingForTitle.seasonYear,
                        manualSeasonText = existingForTitle.seasonNumber?.toString().orEmpty(),
                        manualEpisodeText = existingForTitle.episodeNumber?.toString().orEmpty(),
                        statusMomentPreviewExpanded = true
                    )
                } else {
                    cur.copy(
                        stage = QuickRecordStage.STATUS,
                        selectedTitle = finalTitle,
                        googleBooksSourceUrl = googleBooksUrl,
                        savedLog = null,
                        chosenStatus = null,
                        statusMomentPreviewExpanded = true
                    )
                }
            }
        }
    }

    fun buildCurrentDraft(status: LogStatus, state: QuickRecordDraftState = draft): LogDraft {
        val resolvedSeason = if (seasonLoadFailed) state.manualSeasonText.toIntOrNull() else state.selectedSeason
        val resolvedEpisode = if (seasonLoadFailed) state.manualEpisodeText.toIntOrNull() else state.selectedEpisode
        val watchedIso = RecordDate.resolveWatchedAt(state.watchedDateStr, state.savedLog?.watchedAt)
        return LogDraft(
            status = status,
            rating = state.feelingScore,
            note = state.noteText.trim().takeIf { it.isNotEmpty() },
            spoiler = state.spoiler,
            ott = state.selectedPlatform.trim().takeIf { it.isNotEmpty() },
            seasonNumber = resolvedSeason,
            episodeNumber = resolvedEpisode,
            seasonPosterUrl = state.seasonPosterUrl,
            seasonYear = state.seasonYear,
            watchedAt = watchedIso,
            place = state.selectedPlace,
            occasion = state.selectedOccasion
        )
    }

    fun handleStageBack() {
        when (stage) {
            QuickRecordStage.SEARCH -> onDismiss()
            QuickRecordStage.STATUS -> {
                if (draft.lockedPreselectedTitle) {
                    onDismiss()
                } else {
                    onUpdateDraft {
                        it.copy(
                            stage = QuickRecordStage.SEARCH,
                            selectedTitle = null,
                            savedLog = null,
                            chosenStatus = null
                        )
                    }
                }
            }
            QuickRecordStage.SAVED -> onDismiss()
            QuickRecordStage.EDIT -> {
                if (draft.isEditingExisting) {
                    onDismiss()
                } else {
                    onUpdateDraft { it.copy(stage = QuickRecordStage.SAVED) }
                }
            }
        }
    }

    val dialogTitle = when (stage) {
        QuickRecordStage.SEARCH -> tr(
            "오늘은 어떤 이야기를 남길까요?",
            "What story will you keep today?"
        )
        QuickRecordStage.SAVED -> tr(
            "타임라인에 한 순간이 더해졌어요.",
            "One more moment on your timeline."
        )
        QuickRecordStage.STATUS, QuickRecordStage.EDIT -> tr(
            "그날의 순간을 남겨요",
            "Keep this moment"
        )
    }

    BackHandler { handleStageBack() }

    val isSearchStage = stage == QuickRecordStage.SEARCH || activeTitle == null
    val isBottomSheetStage = stage == QuickRecordStage.SAVED && activeTitle != null

    Box(
        contentAlignment = if (isBottomSheetStage) Alignment.BottomCenter else Alignment.TopCenter,
        modifier = Modifier
            .fillMaxSize()
            .zIndex(40f)
            .background(if (isBottomSheetStage) Color.Black.copy(alpha = 0.25f) else palette.card)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                if (isBottomSheetStage) onDismiss()
            }
    ) {
        Surface(
            color = palette.card,
            shape = if (isBottomSheetStage) {
                RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)
            } else {
                RoundedCornerShape(0.dp)
            },
            border = if (isBottomSheetStage) BorderStroke(1.dp, palette.border) else null,
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (isBottomSheetStage) {
                        Modifier.padding(top = 12.dp)
                    } else {
                        Modifier.fillMaxSize()
                    }
                )
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) { /* Consume taps inside dialog sheet */ }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (isBottomSheetStage) {
                            Modifier
                        } else {
                            Modifier.fillMaxSize()
                        }
                    )
            ) {
                // === SHARED DIALOG HEADER (`QuickLogDialog.tsx` + `recording.module.css` `.dialogHeader`) ===
                Row(
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 20.dp, end = 12.dp, top = 16.dp, bottom = 12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 8.dp)
                    ) {
                        Text(
                            text = dialogTitle,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontSize = 20.sp,
                                lineHeight = 28.sp,
                                fontWeight = FontWeight.SemiBold,
                                letterSpacing = (-0.5).sp
                            ),
                            color = palette.ink
                        )
                        // `.dialog[data-record-stage="search"] .description { display: none; }` on mobile
                        if (!isSearchStage) {
                            Text(
                                text = tr(
                                    "영화, 시리즈, 책. 남겨두고 싶은 만큼만 적어요.",
                                    "Films, series, books. Keep as much as you want."
                                ),
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 14.sp,
                                    lineHeight = 22.sp
                                ),
                                color = palette.mutedInk,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(44.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Close,
                            contentDescription = tr("닫기", "Close"),
                            tint = palette.ink,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }

                HorizontalDivider(thickness = 1.dp, color = palette.border)

                when {
                    isSearchStage -> {
                        // === STAGE 1: `SEARCH` (`TitleSearchBox.tsx` + `recording.module.css`) ===
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp)
                                .padding(top = 20.dp)
                        ) {
                                OutlinedTextField(
                                    value = draft.query,
                                    onValueChange = { q -> onUpdateDraft { it.copy(query = q) } },
                                    placeholder = {
                                        Text(
                                            text = tr(
                                                "작품 검색 (예: 듄, 더 베어)",
                                                "Search titles (e.g., Dune, The Bear)"
                                            ),
                                            color = palette.mutedInk
                                        )
                                    },
                                    trailingIcon = {
                                        if (draft.query.isNotEmpty()) {
                                            IconButton(onClick = { onUpdateDraft { it.copy(query = "") } }) {
                                                Icon(
                                                    imageVector = Icons.Outlined.Close,
                                                    contentDescription = tr("지우기", "Clear"),
                                                    tint = palette.mutedInk
                                                )
                                            }
                                        }
                                    },
                                    singleLine = true,
                                    shape = RoundedCornerShape(8.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedContainerColor = palette.card,
                                        unfocusedContainerColor = palette.card,
                                        focusedBorderColor = palette.brandNavy,
                                        unfocusedBorderColor = palette.border,
                                        focusedTextColor = palette.ink,
                                        unfocusedTextColor = palette.ink
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(min = 52.dp)
                                        .focusRequester(searchFocusRequester)
                                )

                                Spacer(Modifier.height(16.dp))

                                // `.typeChoices`: 4 equal-width buttons (`전체` / `영화` / `시리즈` / `책`)
                                val tabs = listOf(
                                    "all" to tr("전체", "All"),
                                    "movie" to tr("영화", "Movie"),
                                    "series" to tr("시리즈", "Series"),
                                    "book" to tr("책", "Book")
                                )
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    tabs.forEach { (key, label) ->
                                        val selected = draft.searchTab == key
                                        Surface(
                                            onClick = { onUpdateDraft { it.copy(searchTab = key) } },
                                            shape = RoundedCornerShape(8.dp),
                                            color = if (selected) palette.paperStrong else Color.Transparent,
                                            border = BorderStroke(
                                                1.dp,
                                                if (selected) palette.ink else palette.border
                                            ),
                                            modifier = Modifier
                                                .weight(1f)
                                                .heightIn(min = 44.dp)
                                        ) {
                                            Box(
                                                contentAlignment = Alignment.Center,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp)
                                            ) {
                                                Text(
                                                    text = label,
                                                    style = MaterialTheme.typography.bodyMedium.copy(
                                                        fontSize = 14.sp,
                                                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                                                    ),
                                                    color = if (selected) palette.ink else palette.mutedInk,
                                                    maxLines = 1
                                                )
                                            }
                                        }
                                    }
                                }

                                Spacer(Modifier.height(16.dp))
                                HorizontalDivider(thickness = 1.dp, color = palette.border)

                                // `.searchResults`
                                LazyColumn(
                                    contentPadding = PaddingValues(bottom = 24.dp),
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxWidth()
                                        .navigationBarsPadding()
                                ) {
                                    if (searching) {
                                        item {
                                            Box(
                                                contentAlignment = Alignment.Center,
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(vertical = 32.dp)
                                            ) {
                                                Text(
                                                    text = tr("검색 중...", "Searching..."),
                                                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                                                    color = palette.mutedInk
                                                )
                                            }
                                        }
                                    } else if (draft.query.trim().isNotEmpty()) {
                                        if (partialSearchHint != null) {
                                            item {
                                                Text(
                                                    text = partialSearchHint!!,
                                                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                                    color = palette.mutedInk,
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .background(palette.paperStrong.copy(alpha = 0.6f))
                                                        .padding(horizontal = 12.dp, vertical = 10.dp)
                                                )
                                                HorizontalDivider(thickness = 1.dp, color = palette.border)
                                            }
                                        }

                                        if (searchError != null) {
                                            item {
                                                Text(
                                                    text = tr(
                                                        "검색 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
                                                        "Search failed. Please try again in a moment."
                                                    ),
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = palette.danger,
                                                    modifier = Modifier.padding(vertical = 16.dp)
                                                )
                                            }
                                        }

                                        if (searchResults.isEmpty() && searchError == null) {
                                            item {
                                                Box(
                                                    contentAlignment = Alignment.Center,
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .padding(vertical = 32.dp)
                                                ) {
                                                    Text(
                                                        text = tr("결과가 없어요", "No results found"),
                                                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                                                        color = palette.mutedInk
                                                    )
                                                }
                                            }
                                        } else {
                                            items(
                                                searchResults,
                                                key = { "${it.provider}_${it.providerId}_${it.type}" }
                                            ) { item ->
                                                val isBookItem = item.type == TitleType.BOOK
                                                val metaLine = if (isBookItem) {
                                                    listOfNotNull(
                                                        OttlineStrings.titleTypeLabel(item.type, locale),
                                                        item.author?.takeIf { it.isNotBlank() },
                                                        item.publisher?.takeIf { it.isNotBlank() },
                                                        item.year?.toString()
                                                    ).joinToString(" · ")
                                                } else {
                                                    listOfNotNull(
                                                        OttlineStrings.titleTypeLabel(item.type, locale),
                                                        item.year?.toString()
                                                    ).joinToString(" · ")
                                                }
                                                val detailLine = if (isBookItem) {
                                                    val isbn = item.isbn13 ?: item.isbn10
                                                    if (!isbn.isNullOrBlank()) "ISBN $isbn" else item.overview
                                                } else {
                                                    item.overview
                                                }

                                                SearchFlatResultRow(
                                                    titleName = item.name,
                                                    titleType = item.type,
                                                    metaLine = metaLine,
                                                    detailLine = detailLine,
                                                    detailBold = false,
                                                    posterUrl = item.posterUrl,
                                                    posterWidth = 64.dp,
                                                    posterHeight = 96.dp,
                                                    onSelect = {
                                                        val resolvedId = item.titleId ?: UUID.randomUUID().toString()
                                                        selectTitleAndAdvance(
                                                            candidate = item.toTitle(resolvedId),
                                                            source = "search_result",
                                                            googleBooksUrl = item.sourceUrl
                                                        )
                                                    }
                                                )
                                            }

                                            if (searchResults.any { it.type != TitleType.BOOK }) {
                                                item {
                                                    TmdbAttributionRow()
                                                }
                                            }
                                        }
                                    } else {
                                        // Empty query: 1) `요즘 함께 하는 작품들` (`recentDiscussions`) + 2) `요즘 인기 작품` (`popularSuggestions`)
                                        val filteredRecent = recentDiscussions.filter { d ->
                                            when (draft.searchTab) {
                                                "movie" -> d.titleType == TitleType.MOVIE
                                                "series" -> d.titleType == TitleType.SERIES
                                                "book" -> d.titleType == TitleType.BOOK
                                                else -> true
                                            }
                                        }.take(6)

                                        val missingCount = (6 - filteredRecent.size).coerceAtLeast(0)
                                        val candidateTrends = if (draft.searchTab == "book") {
                                            emptyList()
                                        } else {
                                            popularSuggestions.filter { p ->
                                                when (draft.searchTab) {
                                                    "movie" -> p.type == TitleType.MOVIE
                                                    "series" -> p.type == TitleType.SERIES
                                                    else -> true
                                                }
                                            }
                                        }
                                        val filteredPopular = TitleFallback.selectPopularTitleFillers(
                                            discussions = filteredRecent,
                                            trends = candidateTrends,
                                            limit = missingCount
                                        )

                                        if (filteredRecent.isNotEmpty()) {
                                            item {
                                                Text(
                                                    text = tr("요즘 함께 하는 작품들", "Titles shared together"),
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        letterSpacing = 1.1.sp
                                                    ),
                                                    color = palette.mutedInk,
                                                    modifier = Modifier.padding(top = 14.dp, bottom = 6.dp)
                                                )
                                            }
                                            items(
                                                filteredRecent,
                                                key = { "disc_${it.id}" }
                                            ) { d ->
                                                val metaLine = listOfNotNull(
                                                    OttlineStrings.titleTypeLabel(d.titleType, locale),
                                                    d.titleYear?.toString()
                                                ).joinToString(" · ")
                                                SearchFlatResultRow(
                                                    titleName = d.titleName,
                                                    titleType = d.titleType,
                                                    metaLine = metaLine,
                                                    detailLine = tr("댓글 ${d.commentCount}", "Comments ${d.commentCount}"),
                                                    detailBold = true,
                                                    posterUrl = d.posterUrl,
                                                    posterWidth = 56.dp,
                                                    posterHeight = 80.dp,
                                                    onSelect = {
                                                        selectTitleAndAdvance(
                                                            candidate = Title(
                                                                id = d.titleId,
                                                                type = d.titleType,
                                                                name = d.titleName,
                                                                year = d.titleYear,
                                                                posterUrl = d.posterUrl,
                                                                provider = d.titleProvider,
                                                                providerId = d.titleProviderId
                                                            ),
                                                            source = "recent_discussion"
                                                        )
                                                    }
                                                )
                                            }
                                        }

                                        if (filteredPopular.isNotEmpty()) {
                                            item {
                                                Text(
                                                    text = tr("요즘 인기 작품", "Popular now"),
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        letterSpacing = 1.1.sp
                                                    ),
                                                    color = palette.mutedInk,
                                                    modifier = Modifier.padding(top = 14.dp, bottom = 6.dp)
                                                )
                                            }
                                            items(
                                                filteredPopular,
                                                key = { "pop_${it.provider}_${it.providerId}" }
                                            ) { pop ->
                                                val metaLine = listOfNotNull(
                                                    OttlineStrings.titleTypeLabel(pop.type, locale),
                                                    pop.year?.toString()
                                                ).joinToString(" · ")
                                                SearchFlatResultRow(
                                                    titleName = pop.name,
                                                    titleType = pop.type,
                                                    metaLine = metaLine,
                                                    detailLine = tr("인기 작품", "Popular title"),
                                                    detailBold = true,
                                                    posterUrl = pop.posterUrl,
                                                    posterWidth = 56.dp,
                                                    posterHeight = 80.dp,
                                                    onSelect = {
                                                        val resolvedId = pop.titleId ?: UUID.randomUUID().toString()
                                                        selectTitleAndAdvance(
                                                            candidate = pop.toTitle(resolvedId),
                                                            source = "popular_title",
                                                            googleBooksUrl = pop.sourceUrl
                                                        )
                                                    }
                                                )
                                            }
                                            item {
                                                TmdbAttributionRow()
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        stage == QuickRecordStage.STATUS && activeTitle != null -> {
                            // === STAGE 2: `STATUS` (`QuickLogCard.tsx` lines 1380-1416 & 1574-1596 + `recording.module.css`) ===
                            val pendingStatus = draft.chosenStatus ?: draft.preferredStatus
                            val watchedDateReady = draft.watchedDateStr.ifBlank { RecordDate.todayInputDate() }.isNotBlank()

                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxWidth()
                                        .verticalScroll(rememberScrollState())
                                        .padding(horizontal = 20.dp, vertical = 20.dp)
                                ) {
                                    UnboxedTitleSummaryRow(
                                        activeTitle = activeTitle,
                                        seasonPosterUrl = draft.seasonPosterUrl,
                                        seasonYear = draft.seasonYear,
                                        selectedSeason = draft.selectedSeason,
                                        selectedEpisode = draft.selectedEpisode,
                                        googleBooksSourceUrl = draft.googleBooksSourceUrl,
                                        onClearTitle = if (!draft.lockedPreselectedTitle) {
                                            { handleStageBack() }
                                        } else {
                                            null
                                        }
                                    )

                                    Text(
                                        text = tr("어떻게 기억해 둘까요?", "How would you like to remember it?"),
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 13.sp,
                                            lineHeight = 22.sp
                                        ),
                                        color = palette.mutedInk
                                    )

                                    // `.statusChoices`: 3 equal columns, `min-height: 64px`, `aria-pressed` secondary/foreground highlight
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 20.dp)
                                    ) {
                                        val statuses = listOf(LogStatus.DONE, LogStatus.IN_PROGRESS, LogStatus.WISHLIST)
                                        statuses.forEach { st ->
                                            val isSelected = pendingStatus == st
                                            Surface(
                                                onClick = {
                                                    if (!savingInitial) {
                                                        onUpdateDraft { it.copy(chosenStatus = st) }
                                                    }
                                                },
                                                shape = RoundedCornerShape(8.dp),
                                                color = if (isSelected) palette.paperStrong else palette.card,
                                                border = BorderStroke(
                                                    1.dp,
                                                    if (isSelected) palette.ink else palette.border
                                                ),
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .heightIn(min = 64.dp)
                                            ) {
                                                Box(
                                                    contentAlignment = Alignment.Center,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 12.dp)
                                                ) {
                                                    Text(
                                                        text = OttlineStrings.statusLabel(st, activeTitle.type, locale),
                                                        style = MaterialTheme.typography.bodyMedium.copy(
                                                            fontSize = 15.sp,
                                                            fontWeight = FontWeight.SemiBold
                                                        ),
                                                        color = palette.ink,
                                                        maxLines = 1
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    Text(
                                        text = tr(
                                            "상태를 고른 뒤 아래의 ‘기록 남기기’를 눌러요. 그날의 순간은 원할 때만 더해요.",
                                            "Choose a status, then tap ‘Keep this record’ below. Add the moment only if you like."
                                        ),
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 13.sp,
                                            lineHeight = 22.sp
                                        ),
                                        color = palette.mutedInk
                                    )

                                    // `<details className={styles.context}>`
                                    Spacer(Modifier.height(24.dp))
                                    HorizontalDivider(thickness = 1.dp, color = palette.border)
                                    Spacer(Modifier.height(20.dp))

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                onUpdateDraft {
                                                    it.copy(statusMomentPreviewExpanded = !it.statusMomentPreviewExpanded)
                                                }
                                            }
                                            .padding(vertical = 4.dp)
                                    ) {
                                        Text(
                                            text = tr("그날의 순간 (선택)", "The moment (optional)"),
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontSize = 17.sp,
                                                fontWeight = FontWeight.SemiBold
                                            ),
                                            color = palette.ink
                                        )
                                        Icon(
                                            imageVector = if (draft.statusMomentPreviewExpanded) {
                                                Icons.Outlined.ExpandLess
                                            } else {
                                                Icons.Outlined.ExpandMore
                                            },
                                            contentDescription = null,
                                            tint = palette.mutedInk
                                        )
                                    }

                                    AnimatedVisibility(visible = draft.statusMomentPreviewExpanded) {
                                        Column(modifier = Modifier.padding(top = 16.dp)) {
                                            MomentContextFieldsGrid(
                                                activeTitle = activeTitle,
                                                draft = draft,
                                                onUpdateDraft = onUpdateDraft,
                                                customVideoPlatforms = customVideoPlatforms,
                                                customBookPlatforms = customBookPlatforms,
                                                seasons = seasons,
                                                episodes = episodes,
                                                seasonLoading = seasonLoading,
                                                episodeLoading = episodeLoading,
                                                seasonLoadFailed = seasonLoadFailed
                                            )
                                        }
                                    }
                                }

                                // Sticky `.saveFooter` (`QuickLogCard.tsx` lines 1574-1596 + `recording.module.css` lines 299-318, 656-658)
                                Surface(
                                    color = palette.card,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column {
                                        HorizontalDivider(thickness = 1.dp, color = palette.border)
                                        Row(
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 20.dp, vertical = 12.dp)
                                        ) {
                                            Text(
                                                text = if (pendingStatus != null) {
                                                    OttlineStrings.statusLabel(pendingStatus, activeTitle.type, locale)
                                                } else {
                                                    tr("상태를 골라주세요.", "Choose a status.")
                                                },
                                                style = MaterialTheme.typography.bodySmall.copy(
                                                    fontSize = 13.sp,
                                                    lineHeight = 20.sp
                                                ),
                                                color = palette.mutedInk,
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .padding(end = 16.dp)
                                                    .semantics { liveRegion = LiveRegionMode.Polite }
                                            )

                                            Button(
                                                onClick = {
                                                    val st = pendingStatus ?: return@Button
                                                    scope.launch {
                                                        savingInitial = true
                                                        val saved = repository.saveLogForTitle(
                                                            rawTitle = activeTitle,
                                                            draft = buildCurrentDraft(st),
                                                            awaitSync = false
                                                        )
                                                        savingInitial = false
                                                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                                        onUpdateDraft {
                                                            it.copy(
                                                                chosenStatus = st,
                                                                savedLog = saved,
                                                                selectedTitle = saved.title,
                                                                stage = QuickRecordStage.SAVED
                                                            )
                                                        }
                                                    }
                                                },
                                                enabled = !savingInitial && pendingStatus != null && watchedDateReady,
                                                shape = RoundedCornerShape(8.dp),
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = palette.brandNavy,
                                                    contentColor = palette.onBrandNavy,
                                                    disabledContainerColor = palette.brandNavy.copy(alpha = 0.5f),
                                                    disabledContentColor = palette.onBrandNavy.copy(alpha = 0.7f)
                                                ),
                                                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                                                modifier = Modifier
                                                    .width(160.dp)
                                                    .heightIn(min = 48.dp)
                                            ) {
                                                Text(
                                                    text = if (savingInitial) {
                                                        tr("남기는 중...", "Keeping...")
                                                    } else {
                                                        tr("기록 남기기", "Keep this record")
                                                    },
                                                    style = MaterialTheme.typography.bodyMedium.copy(
                                                        fontSize = 15.sp,
                                                        fontWeight = FontWeight.SemiBold
                                                    ),
                                                    maxLines = 1
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        stage == QuickRecordStage.SAVED && activeTitle != null -> {
                            // === STAGE 3: `SAVED` (`QuickLogCard.tsx` lines 1408-1481 + `recording.module.css`) ===
                            val currentLog = draft.savedLog
                            val shelfMajor = savedBookShelfMajor

                            Column(
                                modifier = Modifier
                                    .weight(1f, fill = false)
                                    .fillMaxWidth()
                                    .verticalScroll(rememberScrollState())
                                    .padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 28.dp)
                                    .semantics { liveRegion = LiveRegionMode.Polite }
                            ) {
                                UnboxedTitleSummaryRow(
                                    activeTitle = activeTitle,
                                    seasonPosterUrl = draft.seasonPosterUrl,
                                    seasonYear = draft.seasonYear,
                                    selectedSeason = draft.selectedSeason,
                                    selectedEpisode = draft.selectedEpisode,
                                    googleBooksSourceUrl = draft.googleBooksSourceUrl,
                                    onClearTitle = null
                                )

                                // `.confirmation`
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 24.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Check,
                                        contentDescription = null,
                                        tint = palette.ink,
                                        modifier = Modifier.size(32.dp)
                                    )
                                    Spacer(Modifier.height(16.dp))
                                    Text(
                                        text = tr("타임라인에 남겨두었어요.", "Kept on your timeline."),
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.SemiBold
                                        ),
                                        color = palette.ink,
                                        textAlign = TextAlign.Center
                                    )
                                    Text(
                                        text = tr(
                                            "더 남기고 싶을 때 그날의 순간과 메모를 더해요.",
                                            "Add the moment and a note whenever you want."
                                        ),
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontSize = 14.sp,
                                            lineHeight = 23.sp
                                        ),
                                        color = palette.mutedInk,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(top = 12.dp)
                                    )
                                    Text(
                                        text = tr(
                                            "이 기기에 보관했어요. 연결되면 다른 기기에도 이어져요.",
                                            "Kept on this device. It will sync when connected."
                                        ),
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 13.sp,
                                            lineHeight = 22.sp
                                        ),
                                        color = palette.mutedInk,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(top = 12.dp)
                                    )

                                    if (activeTitle.type == TitleType.BOOK) {
                                        val shelfHint = if (shelfMajor == null) {
                                            tr(
                                                "서가에서는 알맞은 자리를 찾고 있어요.",
                                                "It is finding the right shelf now."
                                            )
                                        } else {
                                            val catName = bookshelfCategoryShortName(shelfMajor, locale)
                                            tr(
                                                "${catName} 서가에도 함께 꽂혔어요.",
                                                "It also found a place in ${catName}."
                                            )
                                        }
                                        Text(
                                            text = shelfHint,
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                fontSize = 13.sp,
                                                lineHeight = 22.sp
                                            ),
                                            color = palette.mutedInk,
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier.padding(top = 12.dp)
                                        )
                                    }

                                    // `.actions` Row 1: `그날의 순간·메모 더하기` (secondary) + `완료` (primary)
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(top = 24.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = {
                                                onUpdateDraft { it.copy(stage = QuickRecordStage.EDIT) }
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            border = BorderStroke(1.dp, palette.border),
                                            colors = ButtonDefaults.outlinedButtonColors(
                                                containerColor = palette.card,
                                                contentColor = palette.ink
                                            ),
                                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                                            modifier = Modifier
                                                .weight(1f)
                                                .heightIn(min = 48.dp)
                                        ) {
                                            Text(
                                                text = tr("그날의 순간·메모 더하기", "Add to this moment"),
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.SemiBold
                                                ),
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }

                                        Button(
                                            onClick = onDismiss,
                                            shape = RoundedCornerShape(8.dp),
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = palette.brandNavy,
                                                contentColor = palette.onBrandNavy
                                            ),
                                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                                            modifier = Modifier
                                                .weight(1f)
                                                .heightIn(min = 48.dp)
                                        ) {
                                            Text(
                                                text = tr("완료", "Done"),
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.SemiBold
                                                ),
                                                maxLines = 1
                                            )
                                        }
                                    }

                                    // `.actions` Row 2: `타임라인에서 보기 ->` (quiet) + `공유 카드 만들기` (quiet)
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(top = 12.dp)
                                    ) {
                                        TextButton(
                                            onClick = {
                                                if (onOpenTimeline != null) {
                                                    onOpenTimeline()
                                                } else {
                                                    onDismiss()
                                                }
                                            },
                                            modifier = Modifier
                                                .weight(1f)
                                                .heightIn(min = 48.dp)
                                        ) {
                                            Text(
                                                text = tr("타임라인에서 보기", "View my timeline"),
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.SemiBold
                                                ),
                                                color = palette.mutedInk
                                            )
                                            Spacer(Modifier.width(6.dp))
                                            Icon(
                                                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                                                contentDescription = null,
                                                tint = palette.mutedInk,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }

                                        if (currentLog != null) {
                                            TextButton(
                                                onClick = {
                                                    dismissAfterShareCard = false
                                                    shareCardTargetLog = currentLog
                                                },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .heightIn(min = 48.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Outlined.Share,
                                                    contentDescription = null,
                                                    tint = palette.mutedInk,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                                Spacer(Modifier.width(6.dp))
                                                Text(
                                                    text = tr("공유 카드 만들기", "Create a share card"),
                                                    style = MaterialTheme.typography.bodyMedium.copy(
                                                        fontSize = 15.sp,
                                                        fontWeight = FontWeight.SemiBold
                                                    ),
                                                    color = palette.mutedInk
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        else -> {
                            // === STAGE 4: `EDIT` (`QuickLogCard.tsx` lines 1483-1580 + `recording.module.css`) ===
                            val active = activeTitle ?: return@Column
                            val isBook = active.type == TitleType.BOOK
                            val effectiveStatus = draft.chosenStatus ?: LogStatus.DONE

                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxWidth()
                                        .verticalScroll(rememberScrollState())
                                        .padding(horizontal = 20.dp, vertical = 20.dp)
                                ) {
                                    UnboxedTitleSummaryRow(
                                        activeTitle = active,
                                        seasonPosterUrl = draft.seasonPosterUrl,
                                        seasonYear = draft.seasonYear,
                                        selectedSeason = draft.selectedSeason,
                                        selectedEpisode = draft.selectedEpisode,
                                        googleBooksSourceUrl = draft.googleBooksSourceUrl,
                                        onClearTitle = null
                                    )

                                    // `<label className={styles.field}>` — Status (`상태` / `Status`)
                                    var statusMenuExpanded by remember { mutableStateOf(false) }
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Outlined.Schedule,
                                                contentDescription = null,
                                                tint = palette.mutedInk,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Text(
                                                text = tr("상태", "Status"),
                                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                                                color = palette.mutedInk
                                            )
                                        }
                                        Box {
                                            FieldSelectBox(
                                                valueText = OttlineStrings.statusLabel(effectiveStatus, active.type, locale),
                                                onClick = { statusMenuExpanded = true }
                                            )
                                            DropdownMenu(
                                                expanded = statusMenuExpanded,
                                                onDismissRequest = { statusMenuExpanded = false },
                                                modifier = Modifier.background(palette.card)
                                            ) {
                                                LogStatus.entries.forEach { st ->
                                                    DropdownMenuItem(
                                                        text = {
                                                            Text(
                                                                text = OttlineStrings.statusLabel(st, active.type, locale),
                                                                color = palette.ink
                                                            )
                                                        },
                                                        onClick = {
                                                            statusMenuExpanded = false
                                                            onUpdateDraft { it.copy(chosenStatus = st) }
                                                        }
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    // `<section className={styles.context}>` — `그날의 순간` / `The moment`
                                    Spacer(Modifier.height(24.dp))
                                    HorizontalDivider(thickness = 1.dp, color = palette.border)
                                    Spacer(Modifier.height(24.dp))

                                    Text(
                                        text = tr("그날의 순간", "The moment"),
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.SemiBold
                                        ),
                                        color = palette.ink,
                                        modifier = Modifier.padding(bottom = 16.dp)
                                    )

                                    MomentContextFieldsGrid(
                                        activeTitle = active,
                                        draft = draft,
                                        onUpdateDraft = onUpdateDraft,
                                        customVideoPlatforms = customVideoPlatforms,
                                        customBookPlatforms = customBookPlatforms,
                                        seasons = seasons,
                                        episodes = episodes,
                                        seasonLoading = seasonLoading,
                                        episodeLoading = episodeLoading,
                                        seasonLoadFailed = seasonLoadFailed
                                    )

                                    // `<RecordFeelings />` (`RecordFeelings.tsx` + `recording.module.css` `.feelings`)
                                    Column(
                                        verticalArrangement = Arrangement.spacedBy(12.dp),
                                        modifier = Modifier.padding(vertical = 24.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text(
                                                text = tr("어떤 느낌으로 남았나요? (선택)", "How did it feel? (optional)"),
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.SemiBold
                                                ),
                                                color = palette.ink
                                            )
                                            if (draft.feelingScore != null && !RecordFeelings.isPresetScore(draft.feelingScore)) {
                                                Text(
                                                    text = tr("기존 기록 유지됨", "Legacy feeling kept"),
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = palette.subtleInk
                                                )
                                            }
                                        }
                                        val selectedBucket = RecordFeelings.resolveFeeling(
                                            rating = draft.feelingScore,
                                            isBook = isBook,
                                            locale = locale
                                        )?.value
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            RecordFeelings.PRESET_SCORES.forEach { score ->
                                                val optionValue = score.toInt()
                                                val label = RecordFeelings.feelingLabel(score, isBook, locale).orEmpty()
                                                val selected = selectedBucket == optionValue
                                                val isExactPreset = draft.feelingScore != null && abs(draft.feelingScore - score) < 0.01
                                                Surface(
                                                    onClick = {
                                                        onUpdateDraft {
                                                            it.copy(feelingScore = if (isExactPreset) null else score)
                                                        }
                                                    },
                                                    shape = RoundedCornerShape(8.dp),
                                                    color = if (selected) palette.paperStrong else palette.card,
                                                    border = BorderStroke(
                                                        width = 1.dp,
                                                        color = if (selected) palette.ink else palette.border
                                                    ),
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .heightIn(min = 86.dp)
                                                ) {
                                                    Column(
                                                        horizontalAlignment = Alignment.CenterHorizontally,
                                                        verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterVertically),
                                                        modifier = Modifier
                                                            .fillMaxWidth()
                                                            .padding(horizontal = 8.dp, vertical = 16.dp)
                                                    ) {
                                                        FeelingIcon(
                                                            value = optionValue,
                                                            titleType = active.type,
                                                            size = 24.dp,
                                                            tint = palette.ink
                                                        )
                                                        Text(
                                                            text = label,
                                                            style = MaterialTheme.typography.bodyMedium.copy(
                                                                fontSize = 14.sp,
                                                                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                                                            ),
                                                            color = palette.ink,
                                                            maxLines = 1,
                                                            overflow = TextOverflow.Ellipsis
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                        if (draft.feelingScore != null) {
                                            TextButton(
                                                onClick = { onUpdateDraft { it.copy(feelingScore = null) } },
                                                contentPadding = PaddingValues(horizontal = 0.dp, vertical = 4.dp)
                                            ) {
                                                Text(
                                                    text = tr("느낌 선택 지우기", "Clear feeling"),
                                                    style = MaterialTheme.typography.bodySmall.copy(
                                                        fontSize = 13.sp,
                                                        fontWeight = FontWeight.SemiBold
                                                    ),
                                                    color = palette.mutedInk
                                                )
                                            }
                                        }
                                    }

                                    // `<label className={styles.field}>` — Note (`메모` / `Note`)
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Outlined.ChatBubbleOutline,
                                                contentDescription = null,
                                                tint = palette.mutedInk,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Text(
                                                text = tr("메모", "Note"),
                                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                                                color = palette.mutedInk
                                            )
                                        }
                                        OutlinedTextField(
                                            value = draft.noteText,
                                            onValueChange = { txt ->
                                                onUpdateDraft { it.copy(noteText = txt.take(1500)) }
                                            },
                                            placeholder = {
                                                Text(
                                                    text = tr(
                                                        "나중에 떠올리고 싶은 장면이나 마음을 적어두세요.",
                                                        "Keep a scene, line, or feeling you may want later."
                                                    ),
                                                    color = palette.mutedInk
                                                )
                                            },
                                            minLines = 4,
                                            maxLines = 8,
                                            shape = RoundedCornerShape(8.dp),
                                            colors = OutlinedTextFieldDefaults.colors(
                                                focusedContainerColor = palette.card,
                                                unfocusedContainerColor = palette.card,
                                                focusedBorderColor = palette.brandNavy,
                                                unfocusedBorderColor = palette.border,
                                                focusedTextColor = palette.ink,
                                                unfocusedTextColor = palette.ink
                                            ),
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .heightIn(min = 128.dp)
                                        )
                                    }

                                    // `.shareChoices` (`함께 화면에도 나누기` + `공유 카드 만들기`)
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(top = 20.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier
                                                .heightIn(min = 44.dp)
                                                .clickable {
                                                    onUpdateDraft { it.copy(shareInTogether = !it.shareInTogether) }
                                                }
                                        ) {
                                            Checkbox(
                                                checked = draft.shareInTogether,
                                                onCheckedChange = { sh ->
                                                    onUpdateDraft { it.copy(shareInTogether = sh) }
                                                },
                                                colors = CheckboxDefaults.colors(
                                                    checkedColor = palette.brandNavy,
                                                    checkmarkColor = palette.onBrandNavy
                                                )
                                            )
                                            Text(
                                                text = tr("함께 화면에도 나누기", "Also share in Together"),
                                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                                                color = palette.ink
                                            )
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier
                                                .heightIn(min = 44.dp)
                                                .clickable {
                                                    onUpdateDraft { it.copy(createShareCard = !it.createShareCard) }
                                                }
                                        ) {
                                            Checkbox(
                                                checked = draft.createShareCard,
                                                onCheckedChange = { sc ->
                                                    onUpdateDraft { it.copy(createShareCard = sc) }
                                                },
                                                colors = CheckboxDefaults.colors(
                                                    checkedColor = palette.brandNavy,
                                                    checkmarkColor = palette.onBrandNavy
                                                )
                                            )
                                            Text(
                                                text = tr("공유 카드 만들기", "Create a share card"),
                                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                                                color = palette.ink
                                            )
                                        }
                                    }

                                    if (draft.shareInTogether) {
                                        Text(
                                            text = tr(
                                                "작품과 메모를 다른 사람들도 볼 수 있어요. 날짜·장소·상황은 공개되지 않아요.",
                                                "Your title and note will be public. Date, place and occasion stay private."
                                            ),
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                fontSize = 13.sp,
                                                lineHeight = 22.sp
                                            ),
                                            color = palette.mutedInk,
                                            modifier = Modifier.padding(top = 4.dp)
                                        )
                                    }

                                    if (togetherError != null) {
                                        Text(
                                            text = togetherError!!,
                                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 14.sp),
                                            color = palette.danger,
                                            modifier = Modifier.padding(top = 12.dp)
                                        )
                                    }
                                }

                                // Sticky bottom `.actions` bar (`recording.module.css` lines 608-617)
                                val togetherFailMsg = tr(
                                    "타임라인에는 보관했어요. 함께 화면에는 아직 올리지 못했어요. 다시 시도해 주세요.",
                                    "Kept on your timeline, but sharing did not finish. Please try again."
                                )
                                Surface(
                                    color = palette.card,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column {
                                        HorizontalDivider(thickness = 1.dp, color = palette.border)
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 20.dp, vertical = 12.dp)
                                        ) {
                                            OutlinedButton(
                                                onClick = { handleStageBack() },
                                                enabled = !savingDetails,
                                                shape = RoundedCornerShape(8.dp),
                                                border = BorderStroke(1.dp, palette.border),
                                                colors = ButtonDefaults.outlinedButtonColors(
                                                    containerColor = palette.card,
                                                    contentColor = palette.ink
                                                ),
                                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .heightIn(min = 48.dp)
                                            ) {
                                                Text(
                                                    text = tr("나중에 더할게요", "Maybe later"),
                                                    style = MaterialTheme.typography.bodyMedium.copy(
                                                        fontSize = 15.sp,
                                                        fontWeight = FontWeight.SemiBold
                                                    )
                                                )
                                            }

                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        savingDetails = true
                                                        togetherError = null
                                                        val needCanonicalSync = draft.shareInTogether
                                                        val finalLog = repository.saveLogForTitle(
                                                            rawTitle = active,
                                                            draft = buildCurrentDraft(effectiveStatus),
                                                            awaitSync = needCanonicalSync
                                                        )
                                                        onUpdateDraft {
                                                            it.copy(savedLog = finalLog, selectedTitle = finalLog.title)
                                                        }

                                                        if (needCanonicalSync) {
                                                            val defaultBody = OttlineStrings.statusLabel(
                                                                effectiveStatus,
                                                                active.type,
                                                                locale
                                                            )
                                                            val commentBody = draft.noteText.trim().ifEmpty { defaultBody }
                                                            val posted = runCatching {
                                                                repository.ensureAuthenticated()
                                                                val canonicalTitleId = finalLog.title.id
                                                                val disc = repository.api.getDiscussionByTitle(canonicalTitleId)
                                                                    ?: repository.api.createDiscussion(canonicalTitleId)
                                                                repository.api.createComment(
                                                                    discussionId = disc.id,
                                                                    req = CreateCommentRequest(
                                                                        body = commentBody,
                                                                        mentions = emptyList(),
                                                                        syncLog = false
                                                                    )
                                                                )
                                                            }
                                                            if (posted.isFailure) {
                                                                savingDetails = false
                                                                togetherError = togetherFailMsg
                                                                return@launch
                                                            }
                                                        }
                                                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                                        savingDetails = false
                                                        if (draft.createShareCard) {
                                                            dismissAfterShareCard = true
                                                            shareCardTargetLog = finalLog
                                                        } else if (onSavedAndOpenTitle != null && draft.isEditingExisting) {
                                                            onSavedAndOpenTitle(finalLog.title.id)
                                                        } else {
                                                            onDismiss()
                                                        }
                                                    }
                                                },
                                                enabled = !savingDetails,
                                                shape = RoundedCornerShape(8.dp),
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = palette.brandNavy,
                                                    contentColor = palette.onBrandNavy
                                                ),
                                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .heightIn(min = 48.dp)
                                            ) {
                                                if (savingDetails) {
                                                    CircularProgressIndicator(
                                                        modifier = Modifier.size(16.dp),
                                                        strokeWidth = 2.dp,
                                                        color = palette.onBrandNavy
                                                    )
                                                    Spacer(Modifier.width(8.dp))
                                                    Text(
                                                        text = tr("남기는 중...", "Keeping..."),
                                                        style = MaterialTheme.typography.bodyMedium.copy(
                                                            fontSize = 15.sp,
                                                            fontWeight = FontWeight.SemiBold
                                                        )
                                                    )
                                                } else {
                                                    Text(
                                                        text = tr("이 순간 보관하기", "Keep this moment"),
                                                        style = MaterialTheme.typography.bodyMedium.copy(
                                                            fontSize = 15.sp,
                                                            fontWeight = FontWeight.SemiBold
                                                        )
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

    shareCardTargetLog?.let { target ->
        ShareCardDialog(
            log = target,
            nickname = nickname,
            personaKey = personaKey,
            onDismiss = {
                val shouldCloseParent = dismissAfterShareCard
                shareCardTargetLog = null
                dismissAfterShareCard = false
                if (shouldCloseParent) {
                    onDismiss()
                }
            },
            onExported = { mode ->
                repository.trackEvent("share_card_export", mapOf("mode" to mode))
            }
        )
    }
}

private fun bookshelfCategoryShortName(major: Int, locale: String): String =
    if (locale == "en") {
        when (major) {
            0 -> "General works"
            1 -> "Philosophy"
            2 -> "Religion"
            3 -> "Social sciences"
            4 -> "Natural sciences"
            5 -> "Technology"
            6 -> "Arts"
            7 -> "Language"
            8 -> "Literature"
            9 -> "History"
            else -> "Bookshelf"
        }
    } else {
        when (major) {
            0 -> "총류"
            1 -> "철학"
            2 -> "종교"
            3 -> "사회과학"
            4 -> "자연과학"
            5 -> "기술과학"
            6 -> "예술"
            7 -> "언어"
            8 -> "문학"
            9 -> "역사"
            else -> "서가"
        }
    }

@Composable
private fun UnboxedTitleSummaryRow(
    activeTitle: Title,
    seasonPosterUrl: String?,
    seasonYear: Int?,
    selectedSeason: Int?,
    selectedEpisode: Int?,
    googleBooksSourceUrl: String?,
    onClearTitle: (() -> Unit)?
) {
    val context = LocalContext.current
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    val isBook = activeTitle.type == TitleType.BOOK

    Column(modifier = Modifier.padding(bottom = 24.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            PosterImage(
                posterUrl = seasonPosterUrl ?: activeTitle.posterUrl,
                titleName = activeTitle.name,
                titleType = activeTitle.type,
                modifier = Modifier.size(width = 72.dp, height = 108.dp),
                widthBucket = "w342"
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = activeTitle.name,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 20.sp,
                        lineHeight = 28.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = (-0.5).sp
                    ),
                    color = palette.ink
                )
                val metaText = if (isBook) {
                    listOfNotNull(
                        OttlineStrings.titleTypeLabel(activeTitle.type, locale),
                        activeTitle.author?.takeIf { it.isNotBlank() },
                        activeTitle.publisher?.takeIf { it.isNotBlank() },
                        activeTitle.year?.toString()
                    ).joinToString(" · ")
                } else {
                    listOfNotNull(
                        OttlineStrings.titleTypeLabel(activeTitle.type, locale),
                        (seasonYear ?: activeTitle.year)?.toString()
                    ).joinToString(" · ")
                }
                Text(
                    text = metaText,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontSize = 14.sp,
                        lineHeight = 22.sp
                    ),
                    color = palette.mutedInk,
                    modifier = Modifier.padding(top = 6.dp)
                )

                if (selectedSeason != null) {
                    val seasonEpText = buildString {
                        append(tr("시즌 $selectedSeason", "Season $selectedSeason"))
                        if (selectedEpisode != null) {
                            append(tr(" · ${selectedEpisode}화", " · Episode $selectedEpisode"))
                        }
                    }
                    Text(
                        text = seasonEpText,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 14.sp,
                            lineHeight = 22.sp
                        ),
                        color = palette.mutedInk,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }

            if (onClearTitle != null) {
                IconButton(
                    onClick = onClearTitle,
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = tr("다른 작품 찾기", "Choose another title"),
                        tint = palette.ink,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        if (activeTitle.provider == Provider.GOOGLE_BOOKS && !googleBooksSourceUrl.isNullOrBlank()) {
            TextButton(
                onClick = {
                    runCatching {
                        CustomTabsIntent.Builder().build()
                            .launchUrl(context, Uri.parse(googleBooksSourceUrl))
                    }
                },
                contentPadding = PaddingValues(0.dp),
                modifier = Modifier.padding(top = 4.dp)
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
                    modifier = Modifier.size(12.dp),
                    tint = palette.brandNavy
                )
            }
        }
    }
}

/**
 * 2-column `.contextGrid` matching `QuickLogCard.tsx` `contextFields` (`lines 1078-1243`)
 * and `recording.module.css` (`.contextGrid { grid-template-columns: 1fr 1fr; gap: 16px 12px; }`).
 */
@Composable
private fun MomentContextFieldsGrid(
    activeTitle: Title,
    draft: QuickRecordDraftState,
    onUpdateDraft: ((QuickRecordDraftState) -> QuickRecordDraftState) -> Unit,
    customVideoPlatforms: List<String>,
    customBookPlatforms: List<String>,
    seasons: List<SeasonOption>,
    episodes: List<EpisodeOption>,
    seasonLoading: Boolean,
    episodeLoading: Boolean,
    seasonLoadFailed: Boolean
) {
    val context = LocalContext.current
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    val isBook = activeTitle.type == TitleType.BOOK
    val noneLabel = tr("선택 안함", "None")
    val watchedDate = draft.watchedDateStr.ifBlank { RecordDate.todayInputDate() }

    val platformGroups = remember(isBook, locale) {
        OttlineStrings.platformGroups(isBook, locale)
    }
    val customExtras = if (isBook) customBookPlatforms else customVideoPlatforms

    var platformMenuExpanded by remember { mutableStateOf(false) }
    var placeMenuExpanded by remember { mutableStateOf(false) }
    var occasionMenuExpanded by remember { mutableStateOf(false) }
    var seasonMenuExpanded by remember { mutableStateOf(false) }
    var episodeMenuExpanded by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Row 1: `날짜` / `Date` + `읽은 곳·플랫폼` / `플랫폼`
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Field 1: Date
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CalendarToday,
                        contentDescription = null,
                        tint = palette.mutedInk,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = tr("날짜", "Date"),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                        color = palette.mutedInk
                    )
                }
                FieldSelectBox(
                    valueText = watchedDate,
                    showChevron = false,
                    onClick = {
                        val parsed = runCatching { LocalDate.parse(watchedDate) }
                            .getOrDefault(LocalDate.now())
                        DatePickerDialog(
                            context,
                            { _, y, m, d ->
                                val next = "%04d-%02d-%02d".format(y, m + 1, d)
                                onUpdateDraft { it.copy(watchedDateStr = next) }
                            },
                            parsed.year,
                            parsed.monthValue - 1,
                            parsed.dayOfMonth
                        ).show()
                    }
                )
                Text(
                    text = if (isBook) {
                        tr("읽은 날을 골라주세요.", "Choose the day you read it.")
                    } else {
                        tr("본 날을 골라주세요.", "Choose the day you watched it.")
                    },
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                    color = palette.mutedInk
                )
            }

            // Field 2: Platform / Where you got or read it
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Tv,
                        contentDescription = null,
                        tint = palette.mutedInk,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = if (isBook) {
                            tr("읽은 곳·플랫폼", "Where you got or read it")
                        } else {
                            tr("플랫폼", "Platform")
                        },
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                        color = palette.mutedInk,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                val platformDisplay = when {
                    draft.customPlatformMode -> tr("직접 입력", "Custom Input")
                    draft.selectedPlatform.isNotBlank() -> draft.selectedPlatform
                    else -> noneLabel
                }
                Box {
                    FieldSelectBox(
                        valueText = platformDisplay,
                        onClick = { platformMenuExpanded = true }
                    )
                    DropdownMenu(
                        expanded = platformMenuExpanded,
                        onDismissRequest = { platformMenuExpanded = false },
                        modifier = Modifier
                            .background(palette.card)
                            .heightIn(max = 340.dp)
                    ) {
                        DropdownMenuItem(
                            text = { Text(noneLabel, color = palette.ink) },
                            onClick = {
                                platformMenuExpanded = false
                                onUpdateDraft {
                                    it.copy(customPlatformMode = false, selectedPlatform = "")
                                }
                            }
                        )
                        platformGroups.forEach { group ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = group.label,
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = palette.mutedInk
                                    )
                                },
                                enabled = false,
                                onClick = {}
                            )
                            group.options.forEach { opt ->
                                DropdownMenuItem(
                                    text = { Text(opt, color = palette.ink) },
                                    onClick = {
                                        platformMenuExpanded = false
                                        onUpdateDraft {
                                            it.copy(customPlatformMode = false, selectedPlatform = opt)
                                        }
                                    }
                                )
                            }
                        }
                        if (customExtras.isNotEmpty()) {
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = tr("내 입력", "My Input"),
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = palette.mutedInk
                                    )
                                },
                                enabled = false,
                                onClick = {}
                            )
                            customExtras.forEach { opt ->
                                DropdownMenuItem(
                                    text = { Text(opt, color = palette.ink) },
                                    onClick = {
                                        platformMenuExpanded = false
                                        onUpdateDraft {
                                            it.copy(customPlatformMode = false, selectedPlatform = opt)
                                        }
                                    }
                                )
                            }
                        }
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = tr("직접 입력", "Custom Input"),
                                    fontWeight = FontWeight.SemiBold,
                                    color = palette.brandNavy
                                )
                            },
                            onClick = {
                                platformMenuExpanded = false
                                onUpdateDraft {
                                    it.copy(customPlatformMode = true, selectedPlatform = "")
                                }
                            }
                        )
                    }
                }
                if (draft.customPlatformMode) {
                    OutlinedTextField(
                        value = draft.selectedPlatform,
                        onValueChange = { txt ->
                            onUpdateDraft { it.copy(selectedPlatform = txt.take(40)) }
                        },
                        placeholder = {
                            Text(
                                text = tr("예: 교보문고, 리디, 공공도서관", "e.g. Kindle, Library, Audible"),
                                style = MaterialTheme.typography.bodySmall
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // Row 2: `장소` / `Place` + `누구와·어떤 상황` / `Who you were with or the occasion`
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Field 3: Place
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Place,
                        contentDescription = null,
                        tint = palette.mutedInk,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = tr("장소", "Place"),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                        color = palette.mutedInk
                    )
                }
                val placeDisplay = draft.selectedPlace?.let {
                    OttlineStrings.placeLabel(it, locale)
                } ?: noneLabel
                Box {
                    FieldSelectBox(
                        valueText = placeDisplay,
                        onClick = { placeMenuExpanded = true }
                    )
                    DropdownMenu(
                        expanded = placeMenuExpanded,
                        onDismissRequest = { placeMenuExpanded = false },
                        modifier = Modifier.background(palette.card)
                    ) {
                        DropdownMenuItem(
                            text = { Text(noneLabel, color = palette.ink) },
                            onClick = {
                                placeMenuExpanded = false
                                onUpdateDraft { it.copy(selectedPlace = null) }
                            }
                        )
                        OttlineStrings.placesForType(activeTitle.type).forEach { p ->
                            DropdownMenuItem(
                                text = { Text(OttlineStrings.placeLabel(p, locale), color = palette.ink) },
                                onClick = {
                                    placeMenuExpanded = false
                                    onUpdateDraft { it.copy(selectedPlace = p) }
                                }
                            )
                        }
                    }
                }
            }

            // Field 4: Occasion
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Group,
                        contentDescription = null,
                        tint = palette.mutedInk,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = tr("누구와·어떤 상황", "Who you were with or the occasion"),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                        color = palette.mutedInk,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                val occasionDisplay = draft.selectedOccasion?.let {
                    OttlineStrings.occasionLabel(it, locale)
                } ?: noneLabel
                Box {
                    FieldSelectBox(
                        valueText = occasionDisplay,
                        onClick = { occasionMenuExpanded = true }
                    )
                    DropdownMenu(
                        expanded = occasionMenuExpanded,
                        onDismissRequest = { occasionMenuExpanded = false },
                        modifier = Modifier.background(palette.card)
                    ) {
                        DropdownMenuItem(
                            text = { Text(noneLabel, color = palette.ink) },
                            onClick = {
                                occasionMenuExpanded = false
                                onUpdateDraft { it.copy(selectedOccasion = null) }
                            }
                        )
                        Occasion.entries.forEach { occ ->
                            DropdownMenuItem(
                                text = { Text(OttlineStrings.occasionLabel(occ, locale), color = palette.ink) },
                                onClick = {
                                    occasionMenuExpanded = false
                                    onUpdateDraft { it.copy(selectedOccasion = occ) }
                                }
                            )
                        }
                    }
                }
            }
        }

        // Row 3 (if Series): `시즌` / `Season` + `에피소드` / `Episode`
        if (activeTitle.type == TitleType.SERIES) {
            if (!seasonLoadFailed) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Season
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = tr("시즌", "Season"),
                            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                            color = palette.mutedInk
                        )
                        val selectedSeasonObj = seasons.firstOrNull { it.seasonNumber == draft.selectedSeason }
                        val seasonDisplay = when {
                            draft.selectedSeason == null -> noneLabel
                            selectedSeasonObj != null -> {
                                val base = tr("시즌 ${selectedSeasonObj.seasonNumber}", "Season ${selectedSeasonObj.seasonNumber}")
                                if (selectedSeasonObj.name.isNotBlank()) "$base · ${selectedSeasonObj.name}" else base
                            }
                            else -> tr("시즌 ${draft.selectedSeason}", "Season ${draft.selectedSeason}")
                        }
                        Box {
                            FieldSelectBox(
                                valueText = seasonDisplay,
                                enabled = !seasonLoading,
                                onClick = { seasonMenuExpanded = true }
                            )
                            DropdownMenu(
                                expanded = seasonMenuExpanded,
                                onDismissRequest = { seasonMenuExpanded = false },
                                modifier = Modifier
                                    .background(palette.card)
                                    .heightIn(max = 320.dp)
                            ) {
                                DropdownMenuItem(
                                    text = { Text(noneLabel, color = palette.ink) },
                                    onClick = {
                                        seasonMenuExpanded = false
                                        onUpdateDraft {
                                            it.copy(
                                                selectedSeason = null,
                                                selectedEpisode = null,
                                                seasonPosterUrl = null,
                                                seasonYear = null
                                            )
                                        }
                                    }
                                )
                                seasons.forEach { s ->
                                    val base = tr("시즌 ${s.seasonNumber}", "Season ${s.seasonNumber}")
                                    val label = if (s.name.isNotBlank()) "$base · ${s.name}" else base
                                    DropdownMenuItem(
                                        text = { Text(label, color = palette.ink) },
                                        onClick = {
                                            seasonMenuExpanded = false
                                            onUpdateDraft {
                                                it.copy(
                                                    selectedSeason = s.seasonNumber,
                                                    selectedEpisode = null,
                                                    seasonPosterUrl = s.posterUrl,
                                                    seasonYear = s.year
                                                )
                                            }
                                        }
                                    )
                                }
                            }
                        }
                        if (seasonLoading) {
                            Text(
                                text = tr("시즌 불러오는 중...", "Loading seasons..."),
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                color = palette.mutedInk
                            )
                        }
                    }

                    // Episode
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = tr("에피소드", "Episode"),
                            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                            color = palette.mutedInk
                        )
                        val selectedEpObj = episodes.firstOrNull { it.episodeNumber == draft.selectedEpisode }
                        val episodeDisplay = when {
                            draft.selectedEpisode == null -> noneLabel
                            selectedEpObj != null -> {
                                val base = tr("${selectedEpObj.episodeNumber}화", "Episode ${selectedEpObj.episodeNumber}")
                                if (selectedEpObj.name.isNotBlank()) "$base · ${selectedEpObj.name}" else base
                            }
                            else -> tr("${draft.selectedEpisode}화", "Episode ${draft.selectedEpisode}")
                        }
                        Box {
                            FieldSelectBox(
                                valueText = episodeDisplay,
                                enabled = draft.selectedSeason != null && !episodeLoading,
                                onClick = { episodeMenuExpanded = true }
                            )
                            DropdownMenu(
                                expanded = episodeMenuExpanded,
                                onDismissRequest = { episodeMenuExpanded = false },
                                modifier = Modifier
                                    .background(palette.card)
                                    .heightIn(max = 320.dp)
                            ) {
                                DropdownMenuItem(
                                    text = { Text(noneLabel, color = palette.ink) },
                                    onClick = {
                                        episodeMenuExpanded = false
                                        onUpdateDraft { it.copy(selectedEpisode = null) }
                                    }
                                )
                                episodes.forEach { ep ->
                                    val base = tr("${ep.episodeNumber}화", "Episode ${ep.episodeNumber}")
                                    val label = if (ep.name.isNotBlank()) "$base · ${ep.name}" else base
                                    DropdownMenuItem(
                                        text = { Text(label, color = palette.ink) },
                                        onClick = {
                                            episodeMenuExpanded = false
                                            onUpdateDraft { it.copy(selectedEpisode = ep.episodeNumber) }
                                        }
                                    )
                                }
                            }
                        }
                        if (episodeLoading) {
                            Text(
                                text = tr("에피소드 불러오는 중...", "Loading episodes..."),
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                color = palette.mutedInk
                            )
                        }
                    }
                }
            } else {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = draft.manualSeasonText,
                        onValueChange = { txt ->
                            onUpdateDraft { it.copy(manualSeasonText = txt.filter(Char::isDigit).take(3)) }
                        },
                        label = { Text(tr("시즌", "Season")) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = draft.manualEpisodeText,
                        onValueChange = { txt ->
                            onUpdateDraft { it.copy(manualEpisodeText = txt.filter(Char::isDigit).take(4)) }
                        },
                        label = { Text(tr("에피소드", "Episode")) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun FieldSelectBox(
    valueText: String,
    enabled: Boolean = true,
    showChevron: Boolean = true,
    onClick: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(8.dp),
        color = palette.card,
        border = BorderStroke(1.dp, palette.border),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Text(
                text = valueText,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 16.sp),
                color = if (enabled) palette.ink else palette.mutedInk.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            if (showChevron) {
                Icon(
                    imageVector = Icons.Outlined.ExpandMore,
                    contentDescription = null,
                    tint = if (enabled) palette.mutedInk else palette.mutedInk.copy(alpha = 0.4f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun SearchFlatResultRow(
    titleName: String,
    titleType: TitleType,
    metaLine: String,
    detailLine: String?,
    detailBold: Boolean,
    posterUrl: String?,
    posterWidth: androidx.compose.ui.unit.Dp,
    posterHeight: androidx.compose.ui.unit.Dp,
    onSelect: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onSelect)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp)
        ) {
            PosterImage(
                posterUrl = posterUrl,
                titleName = titleName,
                titleType = titleType,
                modifier = Modifier
                    .size(width = posterWidth, height = posterHeight)
                    .border(1.dp, palette.border.copy(alpha = 0.6f), RoundedCornerShape(6.dp)),
                widthBucket = "w185"
            )
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = titleName,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 22.sp
                    ),
                    color = palette.ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (metaLine.isNotBlank()) {
                    Text(
                        text = metaLine,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                        color = palette.mutedInk,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (!detailLine.isNullOrBlank()) {
                    Text(
                        text = detailLine,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontSize = 12.sp,
                            fontWeight = if (detailBold) FontWeight.SemiBold else FontWeight.Normal
                        ),
                        color = palette.mutedInk,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
        HorizontalDivider(thickness = 1.dp, color = palette.border.copy(alpha = 0.6f))
    }
}

@Composable
private fun TmdbAttributionRow() {
    val palette = LocalOttlinePalette.current
    Text(
        text = "THIS PRODUCT USES THE TMDB API BUT IS NOT ENDORSED OR CERTIFIED BY TMDB.",
        style = MaterialTheme.typography.labelSmall.copy(
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp
        ),
        color = palette.mutedInk.copy(alpha = 0.6f),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp)
    )
}
