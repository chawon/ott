package app.ottline

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import app.ottline.data.local.AppPreferences
import app.ottline.data.local.OttlineDatabase
import app.ottline.domain.RecordDate
import app.ottline.model.LogStatus
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request

class QuickLogWidgetProvider : AppWidgetProvider() {

    enum class LayoutVariant {
        RIBBON,
        COMPACT,
        MEDIUM,
        EXPANDED
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val pendingResult = runCatching { goAsync() }.getOrNull()
        val appCtx = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val snapshot = loadWidgetSnapshot(appCtx)
                for (widgetId in appWidgetIds) {
                    applySnapshotToWidget(appCtx, appWidgetManager, widgetId, snapshot)
                }
            } finally {
                runCatching { pendingResult?.finish() }
            }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        val pendingResult = runCatching { goAsync() }.getOrNull()
        val appCtx = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val snapshot = loadWidgetSnapshot(appCtx)
                applySnapshotToWidget(appCtx, appWidgetManager, appWidgetId, snapshot, newOptions)
            } finally {
                runCatching { pendingResult?.finish() }
            }
        }
    }

    data class WidgetContinueItem(
        val titleId: String,
        val titleName: String,
        val isBook: Boolean,
        val isInProgress: Boolean,
        val metaText: String,
        val noteSnippet: String,
        val posterBitmap: Bitmap?
    )

    data class WidgetRecentItem(
        val titleId: String,
        val titleName: String,
        val statusLabel: String
    )

    data class WidgetSnapshot(
        val isEnglish: Boolean,
        val monthBadge: String,
        val continueItem: WidgetContinueItem?,
        val recentItems: List<WidgetRecentItem>
    )

    companion object {
        const val EXTRA_QUICK_TYPE = "app.ottline.extra.QUICK_TYPE"

        private val widgetHttpClient: OkHttpClient by lazy {
            OkHttpClient.Builder()
                .connectTimeout(4, TimeUnit.SECONDS)
                .readTimeout(4, TimeUnit.SECONDS)
                .build()
        }

        @Volatile
        private var cachedPosterUrl: String? = null

        @Volatile
        private var cachedPosterBitmap: Bitmap? = null

        fun selectVariantForSize(widthDp: Int, heightDp: Int): LayoutVariant = when {
            heightDp < 125 -> LayoutVariant.RIBBON
            widthDp < 225 -> LayoutVariant.COMPACT
            heightDp < 240 -> LayoutVariant.MEDIUM
            else -> LayoutVariant.EXPANDED
        }

        fun updateAllWidgets(context: Context) {
            val appCtx = context.applicationContext
            val manager = runCatching { AppWidgetManager.getInstance(appCtx) }.getOrNull() ?: return
            val ids = runCatching {
                manager.getAppWidgetIds(ComponentName(appCtx, QuickLogWidgetProvider::class.java))
            }.getOrNull() ?: return
            if (ids.isEmpty()) return

            CoroutineScope(Dispatchers.IO).launch {
                runCatching {
                    val snapshot = loadWidgetSnapshot(appCtx)
                    for (id in ids) {
                        applySnapshotToWidget(appCtx, manager, id, snapshot)
                    }
                }
            }
        }

        internal suspend fun loadWidgetSnapshot(context: Context): WidgetSnapshot {
            val ottlineApp = context.applicationContext as? OttlineApplication
            val locale = ottlineApp?.appPreferences?.current?.locale ?: AppPreferences(context).current.locale
            val isEn = locale == "en"
            val db = ottlineApp?.database ?: OttlineDatabase.getInstance(context)
            val activeLogs = runCatching { db.watchLogDao().getActiveLogs() }.getOrDefault(emptyList())

            val nowDate = LocalDate.now(ZoneId.of("Asia/Seoul"))
            val currentMonthKey = RecordDate.monthKey(null)
            val thisMonthCount = activeLogs.count { RecordDate.monthKey(it.watchedAt) == currentMonthKey }
            val monthBadge = if (thisMonthCount > 0) {
                if (isEn) {
                    val mLabel = nowDate.month.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                    "$mLabel · $thisMonthCount"
                } else {
                    "${nowDate.monthValue}월 · ${thisMonthCount}편"
                }
            } else {
                if (isEn) "Timeline" else "타임라인"
            }

            val heroLog = activeLogs.firstOrNull { it.status == LogStatus.IN_PROGRESS.name }
                ?: activeLogs.firstOrNull()

            val continueItem = heroLog?.let { log ->
                val title = runCatching { db.titleDao().getById(log.titleId) }.getOrNull() ?: return@let null
                val titleName = title.name.takeIf { it.isNotBlank() } ?: return@let null
                val isBook = title.type.equals("book", ignoreCase = true)
                val isInProgress = log.status == LogStatus.IN_PROGRESS.name

                val metaParts = buildList {
                    log.ott?.trim()?.takeIf { it.isNotEmpty() }?.let { add(it) }
                    if (isBook) {
                        title.author?.trim()?.takeIf { it.isNotEmpty() }?.let { add(it) }
                    } else if (log.seasonNumber != null) {
                        add(if (isEn) "S${log.seasonNumber}" else "시즌 ${log.seasonNumber}")
                    }
                    if (isEmpty()) {
                        title.year?.let { add(it.toString()) }
                    }
                }
                val metaText = metaParts.joinToString(" · ")

                val rawNote = if (!log.spoiler) log.note?.trim().orEmpty() else ""
                val noteSnippet = when {
                    rawNote.isNotEmpty() -> rawNote.replace('\n', ' ')
                    isInProgress && isEn -> "Tap to update status or leave a quick note"
                    isInProgress -> "탭해서 감상 상태를 바꾸거나 메모를 이어 남겨보세요"
                    isEn -> "Tap to revisit or refine this memory"
                    else -> "탭해서 남긴 기록을 돌아보거나 다듬어보세요"
                }

                val posterUrl = (log.seasonPosterUrl ?: title.posterUrl)?.trim()?.takeIf { it.isNotEmpty() }
                val posterBitmap = posterUrl?.let { loadRoundedPosterBitmap(it) }

                WidgetContinueItem(
                    titleId = log.titleId,
                    titleName = titleName,
                    isBook = isBook,
                    isInProgress = isInProgress,
                    metaText = metaText,
                    noteSnippet = noteSnippet,
                    posterBitmap = posterBitmap
                )
            }

            val recentItems = activeLogs
                .filter { it.id != heroLog?.id }
                .take(2)
                .mapNotNull { log ->
                    val title = runCatching { db.titleDao().getById(log.titleId) }.getOrNull() ?: return@mapNotNull null
                    val name = title.name.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                    val isBook = title.type.equals("book", ignoreCase = true)
                    val status = runCatching { LogStatus.valueOf(log.status) }.getOrDefault(LogStatus.DONE)
                    WidgetRecentItem(
                        titleId = log.titleId,
                        titleName = name,
                        statusLabel = formatStatusLabel(status, isBook, isEn)
                    )
                }

            return WidgetSnapshot(
                isEnglish = isEn,
                monthBadge = monthBadge,
                continueItem = continueItem,
                recentItems = recentItems
            )
        }

        private fun formatStatusLabel(status: LogStatus, isBook: Boolean, isEn: Boolean): String = when (status) {
            LogStatus.IN_PROGRESS -> when {
                isEn && isBook -> "Reading"
                isEn -> "Watching"
                isBook -> "읽는 중"
                else -> "보는 중"
            }
            LogStatus.WISHLIST -> when {
                isEn -> "Saved"
                isBook -> "읽고 싶어요"
                else -> "보고 싶어요"
            }
            LogStatus.DONE -> when {
                isEn && isBook -> "Read"
                isEn -> "Watched"
                isBook -> "읽었어요"
                else -> "봤어요"
            }
        }

        private fun loadRoundedPosterBitmap(url: String): Bitmap? {
            if (url == cachedPosterUrl && cachedPosterBitmap != null) {
                return cachedPosterBitmap
            }
            return runCatching {
                val request = Request.Builder().url(url).build()
                widgetHttpClient.newCall(request).execute().use { resp ->
                    if (!resp.isSuccessful) return@use null
                    val bytes = resp.body?.bytes() ?: return@use null
                    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return@use null
                    val rounded = createRoundedCenterCropBitmap(decoded, targetW = 132, targetH = 192, cornerRadiusPx = 18f)
                    if (decoded != rounded) {
                        decoded.recycle()
                    }
                    cachedPosterUrl = url
                    cachedPosterBitmap = rounded
                    rounded
                }
            }.getOrNull()
        }

        private fun createRoundedCenterCropBitmap(
            src: Bitmap,
            targetW: Int,
            targetH: Int,
            cornerRadiusPx: Float
        ): Bitmap {
            val output = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(output)
            val scale = maxOf(
                targetW.toFloat() / src.width.coerceAtLeast(1),
                targetH.toFloat() / src.height.coerceAtLeast(1)
            )
            val dx = (targetW - src.width * scale) * 0.5f
            val dy = (targetH - src.height * scale) * 0.5f
            val shader = BitmapShader(src, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply {
                setLocalMatrix(Matrix().apply {
                    setScale(scale, scale)
                    postTranslate(dx, dy)
                })
            }
            val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
                this.shader = shader
            }
            canvas.drawRoundRect(
                RectF(0f, 0f, targetW.toFloat(), targetH.toFloat()),
                cornerRadiusPx,
                cornerRadiusPx,
                paint
            )
            return output
        }

        private fun applySnapshotToWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            snapshot: WidgetSnapshot,
            explicitOptions: Bundle? = null
        ) {
            val remoteViews = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val ribbon = buildRibbonViews(context, snapshot)
                val compact = buildCompactViews(context, snapshot)
                val medium = buildMediumViews(context, snapshot)
                val expanded = buildExpandedViews(context, snapshot)
                RemoteViews(
                    mapOf(
                        SizeF(110f, 56f) to ribbon,
                        SizeF(225f, 56f) to ribbon,
                        SizeF(110f, 125f) to compact,
                        SizeF(225f, 125f) to medium,
                        SizeF(225f, 240f) to expanded
                    )
                )
            } else {
                val opts = explicitOptions ?: runCatching { appWidgetManager.getAppWidgetOptions(appWidgetId) }.getOrNull()
                val minW = opts?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180) ?: 180
                val minH = opts?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 160) ?: 160
                when (selectVariantForSize(minW, minH)) {
                    LayoutVariant.RIBBON -> buildRibbonViews(context, snapshot)
                    LayoutVariant.COMPACT -> buildCompactViews(context, snapshot)
                    LayoutVariant.MEDIUM -> buildMediumViews(context, snapshot)
                    LayoutVariant.EXPANDED -> buildExpandedViews(context, snapshot)
                }
            }
            appWidgetManager.updateAppWidget(appWidgetId, remoteViews)
        }

        private fun buildRibbonViews(context: Context, snapshot: WidgetSnapshot): RemoteViews {
            val isEn = snapshot.isEnglish
            val views = RemoteViews(context.packageName, R.layout.widget_quick_log_ribbon)
            val label = snapshot.continueItem?.let { item ->
                val prefix = if (item.isInProgress) {
                    if (isEn) "Now · " else "이어보기 · "
                } else {
                    ""
                }
                "$prefix${item.titleName}"
            } ?: if (isEn) "Quick Record" else "빠른 기록"

            views.setTextViewText(R.id.widget_btn_record_label, label)
            val mainIntent = snapshot.continueItem?.takeIf { it.isInProgress }?.let { cont ->
                buildLaunchPendingIntent(
                    context = context,
                    requestCode = 105,
                    url = "https://ottline.app/?quick=1&title_id=${Uri.encode(cont.titleId)}",
                    quickType = null
                )
            } ?: buildLaunchPendingIntent(context, 101, "https://ottline.app/?quick=1&quick_focus=1", null)

            views.setOnClickPendingIntent(R.id.widget_btn_record, mainIntent)
            bindCoreShortcutIntents(context, views)
            return views
        }

        private fun buildCompactViews(context: Context, snapshot: WidgetSnapshot): RemoteViews {
            val isEn = snapshot.isEnglish
            val views = RemoteViews(context.packageName, R.layout.widget_quick_log)
            views.setTextViewText(R.id.widget_btn_record_label, if (isEn) "Quick Record" else "빠른 기록")
            views.setTextViewText(R.id.widget_btn_video_label, if (isEn) "Video" else "영상")
            views.setTextViewText(R.id.widget_btn_book_label, if (isEn) "Book" else "책")

            val cont = snapshot.continueItem
            if (cont != null) {
                views.setViewVisibility(R.id.widget_continue_container, View.VISIBLE)
                views.setTextViewText(R.id.widget_continue_title, cont.titleName)
                views.setOnClickPendingIntent(
                    R.id.widget_continue_container,
                    buildLaunchPendingIntent(
                        context = context,
                        requestCode = 105,
                        url = "https://ottline.app/?quick=1&title_id=${Uri.encode(cont.titleId)}",
                        quickType = null
                    )
                )
            } else {
                views.setViewVisibility(R.id.widget_continue_container, View.GONE)
            }

            views.setOnClickPendingIntent(
                R.id.widget_btn_record,
                buildLaunchPendingIntent(context, 101, "https://ottline.app/?quick=1&quick_focus=1", null)
            )
            bindCoreShortcutIntents(context, views)
            return views
        }

        private fun buildMediumViews(context: Context, snapshot: WidgetSnapshot): RemoteViews {
            val isEn = snapshot.isEnglish
            val views = RemoteViews(context.packageName, R.layout.widget_quick_log_medium)
            views.setTextViewText(R.id.widget_month_badge, snapshot.monthBadge)
            views.setTextViewText(R.id.widget_btn_record_label, if (isEn) "Quick Record" else "빠른 기록")
            views.setTextViewText(R.id.widget_btn_video_label, if (isEn) "Video" else "영상")
            views.setTextViewText(R.id.widget_btn_book_label, if (isEn) "Book" else "책")

            bindContinueOrEmptyHero(context, views, snapshot, includeNote = false)

            views.setOnClickPendingIntent(
                R.id.widget_btn_record,
                buildLaunchPendingIntent(context, 101, "https://ottline.app/?quick=1&quick_focus=1", null)
            )
            bindCoreShortcutIntents(context, views)
            return views
        }

        private fun buildExpandedViews(context: Context, snapshot: WidgetSnapshot): RemoteViews {
            val isEn = snapshot.isEnglish
            val views = RemoteViews(context.packageName, R.layout.widget_quick_log_expanded)
            views.setTextViewText(R.id.widget_month_badge, snapshot.monthBadge)
            views.setTextViewText(
                R.id.widget_btn_record_label,
                if (isEn) "Search & leave a record" else "작품 검색 · 빠른 기록"
            )
            views.setTextViewText(R.id.widget_btn_video_label, if (isEn) "Video" else "영상 기록")
            views.setTextViewText(R.id.widget_btn_book_label, if (isEn) "Book" else "책 기록")
            views.setTextViewText(R.id.widget_btn_timeline_label, if (isEn) "Timeline" else "타임라인")

            bindContinueOrEmptyHero(context, views, snapshot, includeNote = true)

            val recents = snapshot.recentItems
            if (recents.isNotEmpty()) {
                views.setViewVisibility(R.id.widget_recent_list_container, View.VISIBLE)
                val first = recents[0]
                views.setTextViewText(R.id.widget_recent_title_1, first.titleName)
                views.setTextViewText(R.id.widget_recent_status_1, first.statusLabel)
                views.setOnClickPendingIntent(
                    R.id.widget_recent_row_1,
                    buildLaunchPendingIntent(
                        context = context,
                        requestCode = 201,
                        url = "https://ottline.app/?quick=1&title_id=${Uri.encode(first.titleId)}",
                        quickType = null
                    )
                )

                val second = recents.getOrNull(1)
                if (second != null) {
                    views.setViewVisibility(R.id.widget_recent_row_2, View.VISIBLE)
                    views.setTextViewText(R.id.widget_recent_title_2, second.titleName)
                    views.setTextViewText(R.id.widget_recent_status_2, second.statusLabel)
                    views.setOnClickPendingIntent(
                        R.id.widget_recent_row_2,
                        buildLaunchPendingIntent(
                            context = context,
                            requestCode = 202,
                            url = "https://ottline.app/?quick=1&title_id=${Uri.encode(second.titleId)}",
                            quickType = null
                        )
                    )
                } else {
                    views.setViewVisibility(R.id.widget_recent_row_2, View.GONE)
                }
            } else {
                views.setViewVisibility(R.id.widget_recent_list_container, View.GONE)
            }

            val timelineIntent = buildLaunchPendingIntent(context, 104, "https://ottline.app/timeline", null)
            views.setOnClickPendingIntent(R.id.widget_header_timeline, timelineIntent)
            views.setOnClickPendingIntent(
                R.id.widget_btn_record,
                buildLaunchPendingIntent(context, 101, "https://ottline.app/?quick=1&quick_focus=1", null)
            )
            bindCoreShortcutIntents(context, views)
            return views
        }

        private fun bindContinueOrEmptyHero(
            context: Context,
            views: RemoteViews,
            snapshot: WidgetSnapshot,
            includeNote: Boolean
        ) {
            val isEn = snapshot.isEnglish
            val cont = snapshot.continueItem
            if (cont != null) {
                views.setViewVisibility(R.id.widget_continue_container, View.VISIBLE)
                views.setViewVisibility(R.id.widget_empty_container, View.GONE)

                val badge = when {
                    cont.isInProgress && cont.isBook && isEn -> "Reading"
                    cont.isInProgress && isEn -> "Watching"
                    cont.isInProgress && cont.isBook -> "읽는 중"
                    cont.isInProgress -> "이어보는 중"
                    isEn -> "Recent"
                    else -> "최근 기록"
                }
                views.setTextViewText(R.id.widget_continue_badge, badge)
                views.setInt(
                    R.id.widget_continue_badge,
                    "setBackgroundResource",
                    if (cont.isInProgress) R.drawable.widget_badge_active_bg else R.drawable.widget_badge_recent_bg
                )
                val badgeColorRes = if (cont.isInProgress) {
                    R.color.widget_badge_active_text
                } else {
                    R.color.widget_badge_recent_text
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    views.setColorStateList(R.id.widget_continue_badge, "setTextColor", badgeColorRes)
                } else {
                    views.setTextColor(R.id.widget_continue_badge, context.getColor(badgeColorRes))
                }

                views.setTextViewText(R.id.widget_continue_meta, cont.metaText)
                views.setViewVisibility(
                    R.id.widget_continue_meta,
                    if (cont.metaText.isNotBlank()) View.VISIBLE else View.GONE
                )
                views.setTextViewText(R.id.widget_continue_title, cont.titleName)

                if (includeNote) {
                    views.setTextViewText(R.id.widget_continue_note, cont.noteSnippet)
                }

                if (cont.posterBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_continue_poster, cont.posterBitmap)
                    views.setViewVisibility(R.id.widget_continue_poster, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_continue_poster_fallback, View.GONE)
                } else {
                    views.setViewVisibility(R.id.widget_continue_poster, View.GONE)
                    views.setViewVisibility(R.id.widget_continue_poster_fallback, View.VISIBLE)
                }

                views.setOnClickPendingIntent(
                    R.id.widget_continue_container,
                    buildLaunchPendingIntent(
                        context = context,
                        requestCode = 105,
                        url = "https://ottline.app/?quick=1&title_id=${Uri.encode(cont.titleId)}",
                        quickType = null
                    )
                )
            } else {
                views.setViewVisibility(R.id.widget_continue_container, View.GONE)
                views.setViewVisibility(R.id.widget_empty_container, View.VISIBLE)
                if (includeNote) {
                    views.setTextViewText(
                        R.id.widget_empty_title,
                        if (isEn) "Capture today’s story in a single line" else "오늘 본 장면, 잊히기 전에 한 줄로"
                    )
                    views.setTextViewText(
                        R.id.widget_empty_subtitle,
                        if (isEn) {
                            "Search below or use Share → ottline from any streaming or book app."
                        } else {
                            "아래에서 바로 검색하거나 OTT·도서 앱에서 ‘공유하기 → ottline’을 눌러 기록해보세요."
                        }
                    )
                } else {
                    views.setTextViewText(
                        R.id.widget_empty_title,
                        if (isEn) "Any moment worth keeping today?" else "오늘 남기고 싶은 장면이 있나요?"
                    )
                    views.setTextViewText(
                        R.id.widget_empty_subtitle,
                        if (isEn) "Log movies, series, and books in seconds" else "방금 본 영상이나 읽던 책을 가볍게 기록해보세요"
                    )
                }
                views.setOnClickPendingIntent(
                    R.id.widget_empty_container,
                    buildLaunchPendingIntent(context, 101, "https://ottline.app/?quick=1&quick_focus=1", null)
                )
            }
        }

        private fun bindCoreShortcutIntents(context: Context, views: RemoteViews) {
            views.setOnClickPendingIntent(
                R.id.widget_btn_video,
                buildLaunchPendingIntent(context, 102, "https://ottline.app/?quick=1&quick_type=video&quick_focus=1", "video")
            )
            views.setOnClickPendingIntent(
                R.id.widget_btn_book,
                buildLaunchPendingIntent(context, 103, "https://ottline.app/?quick=1&quick_type=book&quick_focus=1", "book")
            )
            views.setOnClickPendingIntent(
                R.id.widget_btn_timeline,
                buildLaunchPendingIntent(context, 104, "https://ottline.app/timeline", null)
            )
        }

        private fun buildLaunchPendingIntent(
            context: Context,
            requestCode: Int,
            url: String,
            quickType: String?
        ): PendingIntent {
            val intent = Intent(context, LauncherActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse(url)
                if (!quickType.isNullOrBlank()) {
                    putExtra(EXTRA_QUICK_TYPE, quickType)
                }
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}
