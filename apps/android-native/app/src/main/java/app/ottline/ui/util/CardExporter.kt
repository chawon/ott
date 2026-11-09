package app.ottline.ui.util

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import app.ottline.OttlineApplication
import app.ottline.R
import app.ottline.domain.RecordDate
import app.ottline.domain.RecordFeelings
import app.ottline.model.PersonalReport
import app.ottline.model.PersonaKey
import app.ottline.model.SeasonalRecapPoster
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.ui.components.tmdbResizeUrl
import app.ottline.ui.i18n.OttlineStrings
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request

enum class ShareCardRatio(val width: Int, val height: Int) {
    STORY_9_16(1080, 1920),
    FEED_4_5(1080, 1350)
}

enum class RecapCardKind {
    WEEKLY,
    MONTHLY,
    HALF_YEAR
}

object CardExporter {

    private fun pretendardBold(context: Context): Typeface =
        runCatching { ResourcesCompat.getFont(context, R.font.pretendard_bold) }.getOrNull() ?: Typeface.DEFAULT_BOLD

    private fun pretendardRegular(context: Context): Typeface =
        runCatching { ResourcesCompat.getFont(context, R.font.pretendard_regular) }.getOrNull() ?: Typeface.DEFAULT

    private fun pretendardSemiBold(context: Context): Typeface =
        runCatching { ResourcesCompat.getFont(context, R.font.pretendard_semibold) }.getOrNull() ?: Typeface.DEFAULT_BOLD

    /**
     * Renders the Log Share Card (`renderShareCard` in `apps/web/app/[locale]/og/share-card/route.tsx` parity):
     * - Top 70%: Full-bleed poster (`center top` for books, `center 12%` for video) + bottom 36% gradient fade.
     * - Adaptive dark background extracted from poster average RGB (`0.20x` top, `0.25x` content area; fallback `#0B0C10` / `#0B1224`).
     * - Bottom 30%: Bold white title (`stripBookSubtitle` + `formatTitleForCard`), optional `#DBE4FF` quote note,
     *   translucent capsule pills (`👀 상태`, `느낌 아이콘 + 라벨`, `🗓 YYYY.MM.DD`), and bottom-left signature / `ottline.app`.
     */
    suspend fun renderShareCardBitmap(
        context: Context,
        log: WatchLog,
        ratio: ShareCardRatio,
        includeMoment: Boolean = true,
        includeNote: Boolean = true,
        includeSignature: Boolean = false,
        nickname: String? = null,
        personaKey: PersonaKey? = null,
        locale: String = "ko"
    ): Bitmap = withContext(Dispatchers.IO) {
        val w = ratio.width
        val h = ratio.height
        val isFeed = ratio == ShareCardRatio.FEED_4_5
        val scale = if (isFeed) 0.8f else 1.0f
        fun s(value: Int): Float = kotlin.math.round(value * scale)

        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        val boldTf = pretendardBold(context)
        val semiTf = pretendardSemiBold(context)
        val regTf = pretendardRegular(context)

        val isBook = log.title.type == TitleType.BOOK
        val posterUrl = log.seasonPosterUrl?.takeIf { it.isNotBlank() } ?: log.title.posterUrl
        val posterBitmap = fetchRemoteBitmap(context, tmdbResizeUrl(posterUrl, "w780") ?: posterUrl)

        var backgroundColor = Color.parseColor("#0B0C10")
        var contentBgColor = Color.parseColor("#0B1224")

        if (posterBitmap != null) {
            val avg = computeAverageRgb(posterBitmap)
            if (avg != null) {
                val (r, g, b) = avg
                backgroundColor = Color.rgb(
                    (r * 0.20f).toInt().coerceIn(0, 255),
                    (g * 0.20f).toInt().coerceIn(0, 255),
                    (b * 0.20f).toInt().coerceIn(0, 255)
                )
                contentBgColor = Color.rgb(
                    (r * 0.25f).toInt().coerceIn(0, 255),
                    (g * 0.25f).toInt().coerceIn(0, 255),
                    (b * 0.25f).toInt().coerceIn(0, 255)
                )
            }
        }

        val topHeight = h * 0.70f
        val topRect = RectF(0f, 0f, w.toFloat(), topHeight)
        val bottomRect = RectF(0f, topHeight, w.toFloat(), h.toFloat())

        canvas.drawRect(topRect, Paint().apply { color = backgroundColor })
        canvas.drawRect(bottomRect, Paint().apply { color = contentBgColor })

        if (posterBitmap != null) {
            drawCoverAnchored(
                canvas = canvas,
                bitmap = posterBitmap,
                box = topRect,
                verticalAnchorRatio = if (isBook) 0.0f else 0.12f
            )
        } else {
            val fallbackTitlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = boldTf
                textSize = s(52)
                color = Color.argb(90, 255, 255, 255)
            }
            drawMultilineText(
                canvas = canvas,
                text = log.title.name,
                paint = fallbackTitlePaint,
                x = s(88),
                y = topHeight * 0.42f,
                maxWidth = (w - s(176)).toInt(),
                maxLines = 3
            )
        }

        // Bottom 36% of the top 70% poster area fades smoothly into contentBgColor
        val gradTop = topHeight * 0.64f
        val transparentContentBg = Color.argb(
            0,
            Color.red(contentBgColor),
            Color.green(contentBgColor),
            Color.blue(contentBgColor)
        )
        val gradPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                0f,
                gradTop,
                0f,
                topHeight + 2f,
                transparentContentBg,
                contentBgColor,
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawRect(0f, gradTop, w.toFloat(), topHeight + 2f, gradPaint)

        // Bottom 30% content stack (`padding: s(64) s(88) s(72)`, `gap: s(18)`)
        val contentLeft = s(88)
        val maxContentWidth = (w - s(176)).toInt()
        var cursorY = topHeight + s(64)

        val cleanedTitle = if (isBook) stripBookSubtitle(log.title.name) else log.title.name
        val formattedTitle = formatTitleForCard(clampText(cleanedTitle, 60))

        val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = s(if (isBook) 64 else 84)
            letterSpacing = -0.02f
            color = Color.WHITE
        }
        val titleHeight = drawMultilineText(
            canvas = canvas,
            text = formattedTitle,
            paint = titlePaint,
            x = contentLeft,
            y = cursorY,
            maxWidth = maxContentWidth,
            maxLines = 2,
            lineSpacingMultiplier = if (isBook) 1.08f else 1.03f
        )
        cursorY += titleHeight + s(18)

        val normalizedNote = if (includeNote && !log.note.isNullOrBlank()) {
            clampText(
                normalizeNote(log.note, if (isBook) 3 else 2),
                if (isBook) 120 else 80
            )
        } else null

        if (!normalizedNote.isNullOrBlank()) {
            val notePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = semiTf
                textSize = s(if (isBook) 40 else 38)
                color = Color.parseColor("#DBE4FF")
            }
            val noteHeight = drawMultilineText(
                canvas = canvas,
                text = "“$normalizedNote”",
                paint = notePaint,
                x = contentLeft,
                y = cursorY,
                maxWidth = maxContentWidth,
                maxLines = if (isBook) 3 else 2,
                lineSpacingMultiplier = 1.22f
            )
            cursorY += noteHeight + s(18)
        }

        // Capsule pills (`👀 상태`, `느낌`, `🗓 YYYY.MM.DD`)
        val pillHeight = s(48)
        val pillPadH = s(16)
        val pillGap = s(12)
        val pillFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(21, 255, 255, 255) // rgba(255,255,255,0.08)
        }
        val pillTextPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = semiTf
            textSize = s(if (isBook) 26 else 28)
            color = Color.parseColor("#CBD5F5")
        }

        val statusLabel = OttlineStrings.statusLabel(log.status, log.title.type, locale)
        val feeling = if (includeMoment) {
            RecordFeelings.resolveFeeling(log.rating, isBook, locale)
        } else null
        val dotDate = formatShareCardDotDate(log.watchedAt.ifBlank { log.createdAt })

        var pillX = contentLeft
        val fm = pillTextPaint.fontMetrics
        val textCenterOffset = -((fm.ascent + fm.descent) / 2f)

        fun drawTextPill(text: String, iconValue: Int? = null) {
            val iconSize = if (iconValue != null) s(24) else 0f
            val iconGap = if (iconValue != null) s(8) else 0f
            val textW = pillTextPaint.measureText(text)
            val pillW = pillPadH * 2f + iconSize + iconGap + textW
            val rect = RectF(pillX, cursorY, pillX + pillW, cursorY + pillHeight)
            canvas.drawRoundRect(rect, pillHeight / 2f, pillHeight / 2f, pillFillPaint)

            var innerX = pillX + pillPadH
            if (iconValue != null) {
                drawFeelingIcon(
                    canvas = canvas,
                    left = innerX,
                    top = rect.centerY() - iconSize / 2f,
                    size = iconSize,
                    value = iconValue,
                    isBook = isBook,
                    color = Color.parseColor("#CBD5F5")
                )
                innerX += iconSize + iconGap
            }
            canvas.drawText(text, innerX, rect.centerY() + textCenterOffset, pillTextPaint)
            pillX += pillW + pillGap
        }

        drawTextPill("👀 $statusLabel")
        if (feeling != null) {
            drawTextPill(feeling.label, iconValue = feeling.value)
        }
        drawTextPill("🗓 $dotDate")

        // Bottom-left signature (`bottom: s(64), left: s(88)`)
        val footerBaselineY = h - s(64)
        val trimmedNick = nickname?.trim()?.takeIf { it.isNotEmpty() }?.let { clampText(it, 32) }
        val showSignature = includeSignature && trimmedNick != null && personaKey != null

        val watermarkPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = semiTf
            textSize = s(26)
            color = Color.argb(191, 255, 255, 255) // rgba(255,255,255,0.75)
        }

        if (showSignature && trimmedNick != null && personaKey != null) {
            var sigX = contentLeft
            val avatarSize = s(40)
            val avatarTop = footerBaselineY - avatarSize + s(8)
            val avatarRect = RectF(sigX, avatarTop, sigX + avatarSize, avatarTop + avatarSize)

            val avatarBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(31, 255, 255, 255) // rgba(255,255,255,0.12)
            }
            val avatarBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(46, 255, 255, 255) // rgba(255,255,255,0.18)
                style = Paint.Style.STROKE
                strokeWidth = 2f
            }
            canvas.drawRoundRect(avatarRect, s(12), s(12), avatarBgPaint)

            val avatarBmp = runCatching {
                BitmapFactory.decodeResource(context.resources, OttlineStrings.personaAvatarRes(personaKey))
            }.getOrNull()
            if (avatarBmp != null) {
                canvas.save()
                val clipPath = Path().apply {
                    addRoundRect(avatarRect, s(12), s(12), Path.Direction.CW)
                }
                canvas.clipPath(clipPath)
                canvas.drawBitmap(
                    avatarBmp,
                    null,
                    avatarRect,
                    Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
                )
                canvas.restore()
            }
            canvas.drawRoundRect(avatarRect, s(12), s(12), avatarBorderPaint)
            sigX += avatarSize + s(20)

            val nickPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = semiTf
                textSize = s(26)
                color = Color.argb(224, 255, 255, 255) // rgba(255,255,255,0.88)
            }
            val dotPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = semiTf
                textSize = s(26)
                color = Color.argb(107, 255, 255, 255) // rgba(255,255,255,0.42)
            }

            canvas.drawText(trimmedNick, sigX, footerBaselineY, nickPaint)
            sigX += nickPaint.measureText(trimmedNick) + s(16)
            canvas.drawText("·", sigX, footerBaselineY, dotPaint)
            sigX += dotPaint.measureText("·") + s(16)
            canvas.drawText("by ottline.app", sigX, footerBaselineY, watermarkPaint)
        } else {
            canvas.drawText("ottline.app", contentLeft, footerBaselineY, watermarkPaint)
        }

        bmp
    }

    /**
     * Renders 9:16 (`1080×1920`) Story Recap cards (`renderRecapShareCard` in `/og/share-card/route.tsx` parity):
     * - Top `1040px`: Full-bleed adaptive 1–6 poster mosaic (`recapMosaicSlots` with `4px` `#F8F6F2` borders & `#211F1C`/`#3A332B` fallback tiles).
     * - Bottom `880px`: `#F8F6F2` surface with `#FF9933` period badge, `84px` bold title, `38px` subtitle, 3 white stat cards, and footer row.
     */
    suspend fun renderRecapCardBitmap(
        context: Context,
        kind: RecapCardKind,
        report: PersonalReport,
        monthPosters: List<SeasonalRecapPoster> = emptyList(),
        nickname: String?,
        locale: String
    ): Bitmap = withContext(Dispatchers.IO) {
        val w = 1080
        val h = 1920
        val heroHeight = 1040f
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        canvas.drawColor(Color.parseColor("#F8F6F2"))

        val boldTf = pretendardBold(context)
        val semiTf = pretendardSemiBold(context)
        val regTf = pretendardRegular(context)

        val isEn = locale == "en"
        val seasonal = report.seasonalRecap
        val h1TopTypeLabel = seasonal?.topType?.takeIf { it != "-" }?.let {
            OttlineStrings.titleTypeLabel(TitleType.fromWire(it), locale)
        } ?: "-"
        val topGenre = report.monthlyTopGenre.ifBlank { "-" }

        val (periodBadge, headline, subtitle, metrics, posters, footerLeft) = when (kind) {
            RecapCardKind.WEEKLY -> RecapSpec(
                periodBadge = "WEEKLY",
                headline = if (isEn) "Weekly record recap" else "지난주 기록 회고",
                subtitle = if (isEn) {
                    "${report.previousWeekLogs} records from last week, gathered into one card."
                } else {
                    "지난주 남긴 ${report.previousWeekLogs}개의 기록을 한 장에 모았습니다."
                },
                metrics = listOf(
                    (if (isEn) "Last week's records" else "지난주 기록") to "${report.previousWeekLogs}",
                    (if (isEn) "Total records" else "총 기록") to "${report.totalLogs}",
                    (if (isEn) "Recording streak" else "연속 기록") to "${report.streakDays}"
                ),
                posters = report.previousWeekPosters.orEmpty().take(6),
                footerLeft = "ottline.app"
            )
            RecapCardKind.MONTHLY -> RecapSpec(
                periodBadge = "MONTHLY",
                headline = if (isEn) "Monthly genre recap" else "이번 달 장르 회고",
                subtitle = if (topGenre != "-") {
                    if (isEn) {
                        "Your most logged genre this month is $topGenre, with ${report.monthlyTopGenreCount} records."
                    } else {
                        "이번 달 가장 많이 남긴 장르는 ${topGenre}입니다. 총 ${report.monthlyTopGenreCount}회 기록했어요."
                    }
                } else {
                    if (isEn) {
                        "Log more this month to make your genre card richer."
                    } else {
                        "이번 달 기록을 더 남기면 장르 회고 카드가 풍성해집니다."
                    }
                },
                metrics = listOf(
                    (if (isEn) "Records this month" else "이번 달 기록") to "${report.thisMonthLogs}",
                    (if (isEn) "Top genre this month" else "이번 달 최다 장르") to topGenre,
                    (if (isEn) "Records with a note" else "메모 남긴 비율") to "${report.noteFillPct}%"
                ),
                posters = monthPosters.ifEmpty { report.previousWeekPosters.orEmpty() }.take(6),
                footerLeft = "ottline.app"
            )
            RecapCardKind.HALF_YEAR -> {
                val h1Count = seasonal?.totalLogs ?: report.totalLogs
                RecapSpec(
                    periodBadge = if (isEn) "Jan 1 - Jun 30, 2026" else "2026.01.01 - 2026.06.30",
                    headline = if (isEn) "2026 first-half recap" else "2026년 상반기 돌아보기",
                    subtitle = if (isEn) {
                        "A poster recap of your $h1Count records from the first half of 2026."
                    } else {
                        "상반기에 남긴 ${h1Count}개의 기록을 포스터 카드로 모았어요."
                    },
                    metrics = listOf(
                        (if (isEn) "First-half records" else "상반기 기록") to "$h1Count",
                        (if (isEn) "Most recorded type" else "가장 많이 남긴 종류") to h1TopTypeLabel,
                        (if (isEn) "Records with a note" else "메모 남긴 비율") to "${seasonal?.noteFillPct ?: report.noteFillPct}%"
                    ),
                    posters = seasonal?.posters.orEmpty().ifEmpty { monthPosters }.take(6),
                    footerLeft = if (isEn) "A first half of watching, reading, and remembering" else "보고, 읽고, 남긴 상반기"
                )
            }
        }

        // Top 1040px full-bleed mosaic area
        drawRecapHeroMosaic(
            context = context,
            canvas = canvas,
            heroHeight = heroHeight,
            posters = posters,
            boldTf = boldTf
        )

        // Bottom 880px content area (`padding: 62px 72px`)
        val contentLeft = 72f
        val contentRight = w - 72f
        val contentWidth = (contentRight - contentLeft).toInt()
        var cursorY = heroHeight + 62f

        val whiteFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        val cardBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#ECEBE9")
            style = Paint.Style.STROKE
            strokeWidth = 2f
        }

        // 1. Period badge (`#FFFFFF` box, `#ECEBE9` border, `#FF9933` 26px bold text)
        val badgeTextPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = 26f
            color = Color.parseColor("#FF9933")
        }
        val badgeW = badgeTextPaint.measureText(periodBadge) + 32f
        val badgeH = 50f
        val badgeRect = RectF(contentLeft, cursorY, contentLeft + badgeW, cursorY + badgeH)
        canvas.drawRoundRect(badgeRect, 8f, 8f, whiteFill)
        canvas.drawRoundRect(badgeRect, 8f, 8f, cardBorderPaint)
        canvas.drawText(periodBadge, contentLeft + 16f, cursorY + 34f, badgeTextPaint)
        cursorY += badgeH + 22f

        // 2. Headline (`84px` bold `#0F0F0F`)
        val headPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = 76f
            color = Color.parseColor("#0F0F0F")
        }
        cursorY += drawMultilineText(
            canvas = canvas,
            text = clampText(headline, 46),
            paint = headPaint,
            x = contentLeft,
            y = cursorY,
            maxWidth = contentWidth,
            maxLines = 2,
            lineSpacingMultiplier = 1.06f
        ) + 20f

        // 3. Subtitle (`38px` `#4A4A4A`)
        val subPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = regTf
            textSize = 36f
            color = Color.parseColor("#4A4A4A")
        }
        cursorY += drawMultilineText(
            canvas = canvas,
            text = clampText(subtitle, 92),
            paint = subPaint,
            x = contentLeft,
            y = cursorY,
            maxWidth = contentWidth,
            maxLines = 2,
            lineSpacingMultiplier = 1.28f
        ) + 28f

        // 4. 3 Stat Cards (`gap: 14px`, `minHeight: 142px`, `borderRadius: 8px`)
        val gap = 14f
        val boxW = (contentWidth - gap * 2f) / 3f
        val boxH = 148f
        metrics.take(3).forEachIndexed { idx, (label, value) ->
            val left = contentLeft + idx * (boxW + gap)
            val box = RectF(left, cursorY, left + boxW, cursorY + boxH)
            canvas.drawRoundRect(box, 8f, 8f, whiteFill)
            canvas.drawRoundRect(box, 8f, 8f, cardBorderPaint)

            val labelPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = regTf
                textSize = 22f
                color = Color.parseColor("#4A4A4A")
            }
            val valPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = boldTf
                textSize = if (value.length > 7) 34f else 42f
                color = Color.parseColor("#0F0F0F")
            }
            canvas.drawText(clampText(label, 16), left + 22f, cursorY + 46f, labelPaint)
            canvas.drawText(clampText(value, 14), left + 22f, cursorY + boxH - 28f, valPaint)
        }

        // 5. Footer row (`borderTop: 1px solid #ECEBE9`, left footer text + right `#FF9933` watermark pill)
        val footerTop = h - 134f
        canvas.drawLine(contentLeft, footerTop, contentRight, footerTop, cardBorderPaint)

        val footerTextPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = 27f
            color = Color.parseColor("#4A4A4A")
        }
        canvas.drawText(clampText(footerLeft, 48), contentLeft, footerTop + 56f, footerTextPaint)

        val wmText = "ottline.app"
        val wmPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = 27f
            color = Color.parseColor("#FF9933")
        }
        val wmW = wmPaint.measureText(wmText) + 36f
        val wmH = 54f
        val wmRect = RectF(contentRight - wmW, footerTop + 18f, contentRight, footerTop + 18f + wmH)
        canvas.drawRoundRect(wmRect, 8f, 8f, whiteFill)
        canvas.drawRoundRect(wmRect, 8f, 8f, cardBorderPaint)
        canvas.drawText(wmText, wmRect.left + 18f, wmRect.top + 36f, wmPaint)

        bmp
    }

    private data class RecapSpec(
        val periodBadge: String,
        val headline: String,
        val subtitle: String,
        val metrics: List<Pair<String, String>>,
        val posters: List<SeasonalRecapPoster>,
        val footerLeft: String
    )

    private fun recapMosaicSlots(count: Int, heroHeight: Float): List<RectF> {
        return when {
            count <= 1 -> listOf(RectF(0f, 0f, 1080f, heroHeight))
            count == 2 -> listOf(
                RectF(0f, 0f, 540f, heroHeight),
                RectF(540f, 0f, 1080f, heroHeight)
            )
            count == 3 -> listOf(
                RectF(0f, 0f, 540f, heroHeight),
                RectF(540f, 0f, 1080f, heroHeight * 0.5f),
                RectF(540f, heroHeight * 0.5f, 1080f, heroHeight)
            )
            count == 4 -> listOf(
                RectF(0f, 0f, 540f, heroHeight * 0.5f),
                RectF(540f, 0f, 1080f, heroHeight * 0.5f),
                RectF(0f, heroHeight * 0.5f, 540f, heroHeight),
                RectF(540f, heroHeight * 0.5f, 1080f, heroHeight)
            )
            count == 5 -> listOf(
                RectF(0f, 0f, 540f, heroHeight * 0.5f),
                RectF(540f, 0f, 1080f, heroHeight * 0.5f),
                RectF(0f, heroHeight * 0.5f, 360f, heroHeight),
                RectF(360f, heroHeight * 0.5f, 720f, heroHeight),
                RectF(720f, heroHeight * 0.5f, 1080f, heroHeight)
            )
            else -> listOf(
                RectF(0f, 0f, 360f, heroHeight * 0.55f),
                RectF(360f, 0f, 720f, heroHeight * 0.45f),
                RectF(720f, 0f, 1080f, heroHeight * 0.58f),
                RectF(0f, heroHeight * 0.55f, 360f, heroHeight),
                RectF(360f, heroHeight * 0.45f, 720f, heroHeight),
                RectF(720f, heroHeight * 0.58f, 1080f, heroHeight)
            )
        }
    }

    private fun drawRecapHeroMosaic(
        context: Context,
        canvas: Canvas,
        heroHeight: Float,
        posters: List<SeasonalRecapPoster>,
        boldTf: Typeface
    ) {
        val heroRect = RectF(0f, 0f, 1080f, heroHeight)
        val hasPosters = posters.isNotEmpty()
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor(if (hasPosters) "#292724" else "#FEF9EE")
        }
        canvas.drawRect(heroRect, bgPaint)

        if (!hasPosters) return

        val slots = recapMosaicSlots(posters.size, heroHeight)
        val slotBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#F8F6F2")
            style = Paint.Style.STROKE
            strokeWidth = 8f
        }
        val fallbackTitlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = 30f
            color = Color.parseColor("#FFF8EF")
        }

        posters.take(6).forEachIndexed { idx, item ->
            val slot = slots.getOrElse(idx) { slots.first() }
            val cellFill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.parseColor(if (idx % 2 == 0) "#211F1C" else "#3A332B")
            }
            canvas.drawRect(slot, cellFill)

            val bmp = fetchRemoteBitmap(context, tmdbResizeUrl(item.posterUrl, "w500") ?: item.posterUrl)
            if (bmp != null) {
                drawCoverAnchored(canvas, bmp, slot, verticalAnchorRatio = 0.25f)
            } else {
                drawMultilineText(
                    canvas = canvas,
                    text = clampText(item.title, 32),
                    paint = fallbackTitlePaint,
                    x = slot.left + 28f,
                    y = (slot.bottom - 110f).coerceAtLeast(slot.top + 24f),
                    maxWidth = (slot.width() - 56f).toInt(),
                    maxLines = 2
                )
            }
            canvas.drawRect(slot, slotBorderPaint)
        }
    }

    suspend fun renderRecoveryCardBitmap(
        context: Context,
        pairingCode: String,
        nickname: String?,
        locale: String
    ): Bitmap = withContext(Dispatchers.IO) {
        val w = 1080
        val h = 1350
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        canvas.drawColor(Color.parseColor("#F8F6F2"))

        val cardRect = RectF(64f, 72f, w - 64f, h - 72f)
        val whiteFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#E5E1DA")
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }
        canvas.drawRoundRect(cardRect, 28f, 28f, whiteFill)
        canvas.drawRoundRect(cardRect, 28f, 28f, borderPaint)

        val boldTf = pretendardBold(context)
        val semiTf = pretendardSemiBold(context)
        val regTf = pretendardRegular(context)

        drawBrandLockup(
            canvas = canvas,
            left = 128f,
            top = 124f,
            markSize = 60f,
            boldTf = boldTf,
            semiTf = semiTf
        )
        val subPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = semiTf
            textSize = 21f
            letterSpacing = 0.06f
            color = Color.parseColor("#76716A")
        }
        canvas.drawText(
            if (locale == "en") "PRIVATE RECOVERY CARD" else "연결 코드 개인 보관 카드",
            128f,
            232f,
            subPaint
        )

        val headlinePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = 40f
            color = Color.parseColor("#0F0F0F")
        }
        val who = nickname?.takeIf { it.isNotBlank() }?.let { "$it · " }.orEmpty()
        drawMultilineText(
            canvas = canvas,
            text = if (locale == "en") "${who}Keep this card somewhere private" else "${who}새 기기에서 기록을 이어보는 열쇠예요",
            paint = headlinePaint,
            x = 128f,
            y = 280f,
            maxWidth = w - 256,
            maxLines = 2
        )

        val codeBox = RectF(128f, 400f, w - 128f, 610f)
        val codeFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#FEF9EE") }
        val codeBorder = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#1E4D8C")
            style = Paint.Style.STROKE
            strokeWidth = 4f
        }
        canvas.drawRoundRect(codeBox, 20f, 20f, codeFill)
        canvas.drawRoundRect(codeBox, 20f, 20f, codeBorder)

        val codePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.MONOSPACE
            isFakeBoldText = true
            textSize = 62f
            letterSpacing = 0.08f
            color = Color.parseColor("#0F0F0F")
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(pairingCode, w / 2f, 526f, codePaint)

        val guidePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = regTf
            textSize = 30f
            color = Color.parseColor("#4A4A4A")
        }
        val guideText = if (locale == "en") {
            "1. Open ottline on your new phone or browser.\n2. Go to My space → Link with code.\n3. Enter the code above to restore your timeline."
        } else {
            "1. 새 휴대폰이나 웹에서 ottline을 열어요.\n2. [내 공간 → 연결 코드로 이어받기]를 선택해요.\n3. 위의 연결 코드를 입력하면 타임라인이 그대로 이어져요."
        }
        drawMultilineText(canvas, guideText, guidePaint, 128f, 690f, w - 256, 6)

        val warnBox = RectF(128f, 960f, w - 128f, 1140f)
        val warnFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#FFF2F0") }
        canvas.drawRoundRect(warnBox, 18f, 18f, warnFill)
        val warnPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = semiTf
            textSize = 27f
            color = Color.parseColor("#C93B2B")
        }
        val warnText = if (locale == "en") {
            "Anyone with this code can access your timeline. Never post this card publicly."
        } else {
            "이 코드는 비밀번호와 같아요. SNS나 공개된 곳에 올리지 말고 나만 볼 수 있는 곳에 보관해 주세요."
        }
        drawMultilineText(canvas, warnText, warnPaint, 160f, 1005f, w - 320, 3)

        val footerPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = regTf
            textSize = 24f
            color = Color.parseColor("#76716A")
        }
        canvas.drawText(
            RecordDate.formatDisplayDate(RecordDate.nowIso(), locale) + " · ottline.app",
            128f,
            1215f,
            footerPaint
        )

        bmp
    }

    suspend fun renderReportCardBitmap(
        context: Context,
        report: PersonalReport,
        nickname: String?,
        locale: String
    ): Bitmap = renderRecapCardBitmap(
        context = context,
        kind = RecapCardKind.MONTHLY,
        report = report,
        nickname = nickname,
        locale = locale
    )

    private fun PlaceOrDash(raw: String, locale: String): String =
        app.ottline.model.Place.fromWire(raw)?.let { OttlineStrings.placeLabel(it, locale) } ?: raw

    private fun OccasionOrDash(raw: String, locale: String): String =
        app.ottline.model.Occasion.fromWire(raw)?.let { OttlineStrings.occasionLabel(it, locale) } ?: raw

    suspend fun saveBitmapToGallery(context: Context, bitmap: Bitmap, fileNamePrefix: String): Result<Uri> =
        withContext(Dispatchers.IO) {
            runCatching {
                val fileName = "${fileNamePrefix}_${System.currentTimeMillis()}.png"
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                        put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/ottline")
                        put(MediaStore.Images.Media.IS_PENDING, 1)
                    }
                    val resolver = context.contentResolver
                    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                        ?: error("MediaStore insert failed")
                    resolver.openOutputStream(uri)?.use { out ->
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                    }
                    values.clear()
                    values.put(MediaStore.Images.Media.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                    uri
                } else {
                    writeBitmapToShareCache(context, bitmap, fileNamePrefix)
                }
            }
        }

    suspend fun shareBitmap(context: Context, bitmap: Bitmap, fileNamePrefix: String, chooserTitle: String) {
        val uri = withContext(Dispatchers.IO) {
            writeBitmapToShareCache(context, bitmap, fileNamePrefix)
        }
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, chooserTitle).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    suspend fun shareCsvText(context: Context, csvContent: String, fileName: String, chooserTitle: String) {
        val uri = withContext(Dispatchers.IO) {
            val dir = File(context.cacheDir, "exports").apply { mkdirs() }
            val file = File(dir, fileName)
            file.writeText(csvContent, Charsets.UTF_8)
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        }
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/csv"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, chooserTitle).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun writeBitmapToShareCache(context: Context, bitmap: Bitmap, prefix: String): Uri {
        val dir = File(context.cacheDir, "shared").apply { mkdirs() }
        val file = File(dir, "${prefix}_${System.currentTimeMillis()}.png")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    private fun fetchRemoteBitmap(context: Context, url: String?): Bitmap? {
        if (url.isNullOrBlank()) return null
        return runCatching {
            val app = context.applicationContext as? OttlineApplication
            val client = app?.apiClient?.httpClient ?: return null
            val req = Request.Builder().url(url).build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return null
                val bytes = resp.body?.bytes() ?: return null
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            }
        }.getOrNull()
    }

    private fun drawCoverAnchored(
        canvas: Canvas,
        bitmap: Bitmap,
        box: RectF,
        verticalAnchorRatio: Float
    ) {
        val bw = bitmap.width.toFloat()
        val bh = bitmap.height.toFloat()
        if (bw <= 0f || bh <= 0f) return
        val scale = maxOf(box.width() / bw, box.height() / bh)
        val sw = (box.width() / scale).toInt().coerceIn(1, bitmap.width)
        val sh = (box.height() / scale).toInt().coerceIn(1, bitmap.height)
        val sx = ((bitmap.width - sw) / 2).coerceIn(0, (bitmap.width - sw).coerceAtLeast(0))
        val sy = ((bitmap.height - sh) * verticalAnchorRatio.coerceIn(0f, 1f)).toInt()
            .coerceIn(0, (bitmap.height - sh).coerceAtLeast(0))
        val src = Rect(sx, sy, sx + sw, sy + sh)
        canvas.drawBitmap(bitmap, src, box, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
    }

    private fun computeAverageRgb(bitmap: Bitmap): Triple<Int, Int, Int>? {
        val w = bitmap.width
        val h = bitmap.height
        if (w <= 0 || h <= 0) return null
        val step = maxOf(1, minOf(w, h) / 32)
        var rSum = 0L
        var gSum = 0L
        var bSum = 0L
        var count = 0L
        var y = 0
        while (y < h) {
            var x = 0
            while (x < w) {
                val pixel = bitmap.getPixel(x, y)
                val alpha = Color.alpha(pixel)
                if (alpha >= 32) {
                    rSum += Color.red(pixel)
                    gSum += Color.green(pixel)
                    bSum += Color.blue(pixel)
                    count++
                }
                x += step
            }
            y += step
        }
        if (count == 0L) return null
        return Triple(
            (rSum / count).toInt().coerceIn(0, 255),
            (gSum / count).toInt().coerceIn(0, 255),
            (bSum / count).toInt().coerceIn(0, 255)
        )
    }

    internal fun formatShareCardDotDate(iso: String): String {
        val date = RecordDate.parseToLocalDate(iso) ?: java.time.LocalDate.now()
        return "%04d.%02d.%02d".format(date.year, date.monthValue, date.dayOfMonth)
    }

    internal fun clampText(text: String, maxLen: Int): String {
        val clean = text.trim()
        if (clean.length <= maxLen) return clean
        return "${clean.substring(0, (maxLen - 1).coerceAtLeast(1))}…"
    }

    internal fun normalizeNote(text: String, maxLines: Int = 2): String {
        val lines = text
            .split(Regex("\\r?\\n"))
            .map { it.replace(Regex("\\s+"), " ").trim() }
            .filter { it.isNotEmpty() }
            .take(maxLines.coerceAtLeast(1))
        return lines.joinToString("\n")
    }

    internal fun stripBookSubtitle(title: String): String {
        val trimmed = title.trim()
        val match = Regex("^(.+?)\\s[-–—]\\s.+$").find(trimmed)
        if (match == null) return trimmed
        val main = match.groupValues[1].trim()
        return main.ifEmpty { trimmed }
    }

    internal fun formatTitleForCard(title: String): String {
        val trimmed = title.trim()
        val colonIndex = trimmed.indexOf(':')
        if (colonIndex <= 0 || colonIndex >= trimmed.length - 1) return trimmed
        val head = trimmed.substring(0, colonIndex + 1).trim()
        val tail = trimmed.substring(colonIndex + 1).trim()
        if (head.isEmpty() || tail.isEmpty()) return trimmed
        return "$head\n$tail"
    }

    private fun drawBitmapInside(canvas: Canvas, bitmap: Bitmap, box: RectF, fitContain: Boolean) {
        val bw = bitmap.width.toFloat()
        val bh = bitmap.height.toFloat()
        if (bw <= 0f || bh <= 0f) return
        canvas.save()
        if (fitContain) {
            val scale = minOf((box.width() - 20f) / bw, (box.height() - 20f) / bh)
            val dw = bw * scale
            val dh = bh * scale
            val dst = RectF(
                box.centerX() - dw / 2f,
                box.centerY() - dh / 2f,
                box.centerX() + dw / 2f,
                box.centerY() + dh / 2f
            )
            canvas.drawBitmap(bitmap, null, dst, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        } else {
            val scale = maxOf(box.width() / bw, box.height() / bh)
            val sw = (box.width() / scale).toInt().coerceAtMost(bitmap.width)
            val sh = (box.height() / scale).toInt().coerceAtMost(bitmap.height)
            val sx = ((bitmap.width - sw) / 2).coerceAtLeast(0)
            val sy = ((bitmap.height - sh) / 2).coerceAtLeast(0)
            val src = Rect(sx, sy, sx + sw, sy + sh)
            canvas.drawBitmap(bitmap, src, box, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        }
        canvas.restore()
    }

    private fun drawMultilineText(
        canvas: Canvas,
        text: String,
        paint: TextPaint,
        x: Float,
        y: Float,
        maxWidth: Int,
        maxLines: Int,
        lineSpacingMultiplier: Float = 1.15f
    ): Float {
        val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, maxWidth.coerceAtLeast(100))
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setLineSpacing(4f, lineSpacingMultiplier)
            .setMaxLines(maxLines)
            .setEllipsize(android.text.TextUtils.TruncateAt.END)
            .build()
        canvas.save()
        canvas.translate(x, y)
        layout.draw(canvas)
        canvas.restore()
        return layout.height.toFloat()
    }

    /**
     * Renders the official v2 CI lockup (`mark.svg` + `#1E4D8C` `ottline` + `3.3:1` `#FF9933` `ON THE TIMELINE`).
     */
    private fun drawBrandLockup(
        canvas: Canvas,
        left: Float,
        top: Float,
        markSize: Float,
        boldTf: Typeface,
        semiTf: Typeface
    ) {
        val sx = markSize / 96f
        val sy = markSize / 96f
        val bookPath = Path().apply {
            moveTo(left + 14f * sx, top + 34f * sy)
            lineTo(left + 14f * sx, top + 28f * sy)
            cubicTo(left + 14f * sx, top + 22.477f * sy, left + 18.477f * sx, top + 18f * sy, left + 24f * sx, top + 18f * sy)
            cubicTo(left + 34f * sx, top + 18f * sy, left + 41.5f * sx, top + 21.8f * sy, left + 48f * sx, top + 27f * sy)
            cubicTo(left + 55.8f * sx, top + 21.8f * sy, left + 65.5f * sx, top + 18f * sy, left + 77f * sx, top + 18f * sy)
            cubicTo(left + 82.523f * sx, top + 18f * sy, left + 87f * sx, top + 22.477f * sy, left + 87f * sx, top + 28f * sy)
            lineTo(left + 87f * sx, top + 64f * sy)
            cubicTo(left + 87f * sx, top + 69.523f * sy, left + 82.523f * sx, top + 74f * sy, left + 77f * sx, top + 74f * sy)
            cubicTo(left + 66.5f * sx, top + 74f * sy, left + 57.2f * sx, top + 76.9f * sy, left + 51.5f * sx, top + 81f * sy)
        }
        val playPath = Path().apply {
            moveTo(left + 15f * sx, top + 49f * sy)
            lineTo(left + 36.5f * sx, top + 62.75f * sy)
            lineTo(left + 15f * sx, top + 76.5f * sy)
            close()
        }
        val markPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#1E4D8C")
            style = Paint.Style.STROKE
            strokeWidth = 8f * sx
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        canvas.drawPath(bookPath, markPaint)
        canvas.drawPath(playPath, markPaint)

        val textLeft = left + markSize + (markSize * 0.2f)
        val wordSize = markSize * 0.76f
        val subSize = wordSize * 0.30f
        val brandPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = boldTf
            textSize = wordSize
            letterSpacing = -0.025f
            color = Color.parseColor("#1E4D8C")
        }
        val subBrandPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = semiTf
            textSize = subSize
            letterSpacing = 0.10f
            color = Color.parseColor("#FF9933")
        }
        canvas.drawText("ottline", textLeft, top + wordSize * 0.88f, brandPaint)
        canvas.drawText("ON THE TIMELINE", textLeft + 1f, top + wordSize * 0.88f + subSize * 1.28f, subBrandPaint)
    }

    /**
     * Draws Lucide feeling icons (`Smile`, `BookOpen`, `Meh`, `Frown`) onto exported share card Canvas (`FeelingIcon.tsx` parity).
     */
    private fun drawFeelingIcon(
        canvas: Canvas,
        left: Float,
        top: Float,
        size: Float,
        value: Int,
        isBook: Boolean,
        color: Int
    ) {
        val s = size / 24f
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.STROKE
            strokeWidth = 2.1f * s
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.FILL
        }

        if (value == 5 && isBook) {
            canvas.drawLine(left + 12f * s, top + 7f * s, left + 12f * s, top + 21f * s, strokePaint)
            val bookPath = Path().apply {
                moveTo(left + 2f * s, top + 17f * s)
                lineTo(left + 2f * s, top + 4f * s)
                quadTo(left + 2f * s, top + 3f * s, left + 3f * s, top + 3f * s)
                lineTo(left + 8f * s, top + 3f * s)
                quadTo(left + 12f * s, top + 3f * s, left + 12f * s, top + 7f * s)
                quadTo(left + 12f * s, top + 3f * s, left + 16f * s, top + 3f * s)
                lineTo(left + 21f * s, top + 3f * s)
                quadTo(left + 22f * s, top + 3f * s, left + 22f * s, top + 4f * s)
                lineTo(left + 22f * s, top + 17f * s)
                quadTo(left + 22f * s, top + 18f * s, left + 21f * s, top + 18f * s)
                lineTo(left + 15f * s, top + 18f * s)
                quadTo(left + 12f * s, top + 18f * s, left + 12f * s, top + 21f * s)
                quadTo(left + 12f * s, top + 18f * s, left + 9f * s, top + 18f * s)
                lineTo(left + 3f * s, top + 18f * s)
                quadTo(left + 2f * s, top + 18f * s, left + 2f * s, top + 17f * s)
            }
            canvas.drawPath(bookPath, strokePaint)
            return
        }

        canvas.drawCircle(left + 12f * s, top + 12f * s, 10f * s, strokePaint)
        canvas.drawCircle(left + 9f * s, top + 9f * s, 1.15f * s, fillPaint)
        canvas.drawCircle(left + 15f * s, top + 9f * s, 1.15f * s, fillPaint)

        when (value) {
            5 -> {
                val smilePath = Path().apply {
                    moveTo(left + 8f * s, top + 14f * s)
                    cubicTo(
                        left + 8f * s,
                        top + 14f * s,
                        left + 9.5f * s,
                        top + 16f * s,
                        left + 12f * s,
                        top + 16f * s
                    )
                    cubicTo(
                        left + 14.5f * s,
                        top + 16f * s,
                        left + 16f * s,
                        top + 14f * s,
                        left + 16f * s,
                        top + 14f * s
                    )
                }
                canvas.drawPath(smilePath, strokePaint)
            }
            3 -> {
                canvas.drawLine(left + 8f * s, top + 15f * s, left + 16f * s, top + 15f * s, strokePaint)
            }
            else -> {
                val frownPath = Path().apply {
                    moveTo(left + 16f * s, top + 16f * s)
                    cubicTo(
                        left + 16f * s,
                        top + 16f * s,
                        left + 14.5f * s,
                        top + 14f * s,
                        left + 12f * s,
                        top + 14f * s
                    )
                    cubicTo(
                        left + 9.5f * s,
                        top + 14f * s,
                        left + 8f * s,
                        top + 16f * s,
                        left + 8f * s,
                        top + 16f * s
                    )
                }
                canvas.drawPath(frownPath, strokePaint)
            }
        }
    }
}
