package app.ottline.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import app.ottline.domain.RecordDate
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.Place
import app.ottline.model.Title
import app.ottline.model.WatchLog
import app.ottline.ui.screens.QuickRecordRequest
import java.time.YearMonth
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
enum class QuickRecordStage {
    SEARCH,
    STATUS,
    SAVED,
    EDIT
}

@Serializable
data class QuickRecordDraftState(
    val stage: QuickRecordStage = QuickRecordStage.SEARCH,
    val query: String = "",
    val searchTab: String = "all",
    val autoFocusSearch: Boolean = true,
    val lockedPreselectedTitle: Boolean = false,
    val isEditingExisting: Boolean = false,
    val selectedTitle: Title? = null,
    val googleBooksSourceUrl: String? = null,
    val savedLog: WatchLog? = null,
    val chosenStatus: LogStatus? = null,
    val preferredStatus: LogStatus? = null,
    val pendingSelectSource: String? = null,
    val statusMomentPreviewExpanded: Boolean = true,
    val watchedDateStr: String = "",
    val selectedPlace: Place? = null,
    val selectedOccasion: Occasion? = null,
    val selectedPlatform: String = "",
    val customPlatformMode: Boolean = false,
    val feelingScore: Double? = null,
    val noteText: String = "",
    val spoiler: Boolean = false,
    val shareInTogether: Boolean = false,
    val createShareCard: Boolean = false,
    val selectedSeason: Int? = null,
    val selectedEpisode: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val manualSeasonText: String = "",
    val manualEpisodeText: String = ""
)

@Serializable
data class TimelineFilterState(
    val query: String = "",
    val typeFilter: String = "ALL",
    val statusFilter: String = "ALL",
    val placeFilter: Place? = null,
    val occasionFilter: Occasion? = null,
    val shelfFilter: String = "ALL"
)

class OttlineMainViewModel(
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    private val _quickRecordDraft = MutableStateFlow(restoreQuickRecordDraft())
    val quickRecordDraft: StateFlow<QuickRecordDraftState?> = _quickRecordDraft.asStateFlow()

    private val _timelineFilter = MutableStateFlow(restoreTimelineFilter())
    val timelineFilter: StateFlow<TimelineFilterState> = _timelineFilter.asStateFlow()

    private val _homeSelectedMonth = MutableStateFlow(
        savedStateHandle.get<String>(KEY_HOME_MONTH) ?: YearMonth.now().toString()
    )
    val homeSelectedMonth: StateFlow<String> = _homeSelectedMonth.asStateFlow()

    private fun restoreQuickRecordDraft(): QuickRecordDraftState? {
        val raw = savedStateHandle.get<String>(KEY_QUICK_RECORD_JSON) ?: return null
        return runCatching { json.decodeFromString<QuickRecordDraftState>(raw) }.getOrNull()
    }

    private fun restoreTimelineFilter(): TimelineFilterState {
        val raw = savedStateHandle.get<String>(KEY_TIMELINE_FILTER_JSON) ?: return TimelineFilterState()
        return runCatching { json.decodeFromString<TimelineFilterState>(raw) }
            .getOrDefault(TimelineFilterState())
    }

    fun openQuickRecord(request: QuickRecordRequest) {
        val existing = request.existingLog
        val searchCandidate = request.preselectedSearchItem?.let {
            it.toTitle(it.titleId ?: UUID.randomUUID().toString())
        }
        val preselected = request.preselectedTitle ?: existing?.title ?: searchCandidate
        val normalizedTab = when (request.initialTypeTab.lowercase()) {
            "movie" -> "movie"
            "series", "tv" -> "series"
            "book" -> "book"
            else -> "all"
        }
        val initialStage = when {
            existing != null -> QuickRecordStage.EDIT
            preselected != null -> QuickRecordStage.STATUS
            else -> QuickRecordStage.SEARCH
        }
        val state = QuickRecordDraftState(
            stage = initialStage,
            query = request.initialQuery,
            searchTab = normalizedTab,
            autoFocusSearch = request.autoFocusSearch,
            lockedPreselectedTitle = request.preselectedTitle != null || existing != null,
            isEditingExisting = existing != null,
            selectedTitle = preselected,
            googleBooksSourceUrl = request.preselectedSearchItem?.sourceUrl,
            savedLog = existing,
            chosenStatus = existing?.status,
            preferredStatus = request.preferredStatus,
            pendingSelectSource = request.selectSource,
            statusMomentPreviewExpanded = true,
            watchedDateStr = RecordDate.recordDateInput(existing?.watchedAt),
            selectedPlace = existing?.place,
            selectedOccasion = existing?.occasion,
            selectedPlatform = existing?.ott ?: request.prefilledPlatform.orEmpty(),
            customPlatformMode = false,
            feelingScore = existing?.rating,
            noteText = existing?.note.orEmpty(),
            spoiler = existing?.spoiler ?: false,
            shareInTogether = false,
            selectedSeason = existing?.seasonNumber,
            selectedEpisode = existing?.episodeNumber,
            seasonPosterUrl = existing?.seasonPosterUrl,
            seasonYear = existing?.seasonYear,
            manualSeasonText = existing?.seasonNumber?.toString().orEmpty(),
            manualEpisodeText = existing?.episodeNumber?.toString().orEmpty()
        )
        persistQuickRecordDraft(state)
    }

    fun updateQuickRecordDraft(transform: (QuickRecordDraftState) -> QuickRecordDraftState) {
        val current = _quickRecordDraft.value ?: return
        persistQuickRecordDraft(transform(current))
    }

    fun dismissQuickRecord() {
        _quickRecordDraft.value = null
        savedStateHandle.remove<String>(KEY_QUICK_RECORD_JSON)
    }

    private fun persistQuickRecordDraft(state: QuickRecordDraftState) {
        _quickRecordDraft.value = state
        savedStateHandle[KEY_QUICK_RECORD_JSON] = json.encodeToString(state)
    }

    fun updateTimelineFilter(transform: (TimelineFilterState) -> TimelineFilterState) {
        val next = transform(_timelineFilter.value)
        _timelineFilter.value = next
        savedStateHandle[KEY_TIMELINE_FILTER_JSON] = json.encodeToString(next)
    }

    fun applyDeepLinkTimelineFilter(
        contentType: String?,
        status: String?,
        place: Place?,
        occasion: Occasion?,
        query: String?
    ) {
        val normalizedType = when (contentType?.trim()?.uppercase()) {
            "MOVIE" -> "MOVIE"
            "SERIES", "TV" -> "SERIES"
            "BOOK" -> "BOOK"
            "VIDEO" -> "VIDEO"
            else -> "ALL"
        }
        val normalizedStatus = when (status?.trim()?.uppercase()) {
            "DONE" -> "DONE"
            "IN_PROGRESS" -> "IN_PROGRESS"
            "WISHLIST" -> "WISHLIST"
            else -> "ALL"
        }
        updateTimelineFilter {
            TimelineFilterState(
                query = query?.trim().orEmpty(),
                typeFilter = normalizedType,
                statusFilter = normalizedStatus,
                placeFilter = place,
                occasionFilter = occasion,
                shelfFilter = "ALL"
            )
        }
    }

    fun setHomeSelectedMonth(monthKey: String) {
        _homeSelectedMonth.value = monthKey
        savedStateHandle[KEY_HOME_MONTH] = monthKey
    }

    companion object {
        internal const val KEY_QUICK_RECORD_JSON = "ottline.quick_record_draft_json"
        internal const val KEY_TIMELINE_FILTER_JSON = "ottline.timeline_filter_json"
        internal const val KEY_HOME_MONTH = "ottline.home_selected_month"
    }
}
