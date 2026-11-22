package app.ottline.ui.layout

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

enum class AdaptiveWindowMode {
    COMPACT,
    TABLET_PORTRAIT,
    TABLET_WIDE
}

/**
 * Window-width adaptive layout metrics aligned with iPad v2 (`OttlinePadAdaptiveComponents.swift`)
 * and `DESIGN.md` Section 8. Based on live available window width so foldables, tablets,
 * rotation, and multi-window split-screen all adapt seamlessly.
 */
@Immutable
data class AdaptiveLayoutMetrics(
    val mode: AdaptiveWindowMode,
    val viewportWidthDp: Int
) {
    val isSpread: Boolean
        get() = mode != AdaptiveWindowMode.COMPACT

    val isWide: Boolean
        get() = mode == AdaptiveWindowMode.TABLET_WIDE

    val isWideThreeColumnHome: Boolean
        get() = isSpread && viewportWidthDp >= HOME_THREE_COLUMN_MIN_WIDTH_DP

    val homeTogetherColumns: Int
        get() = if (isSpread) 2 else 1

    val maxContentWidth: Dp
        get() = if (isSpread) MAX_SPREAD_CONTENT_WIDTH_DP.dp else Dp.Unspecified

    val horizontalPadding: Dp
        get() = if (isSpread) 28.dp else 18.dp

    val togetherTwoPane: Boolean
        get() = isSpread && viewportWidthDp >= TOGETHER_TWO_PANE_MIN_WIDTH_DP

    val togetherLeftPaneWidth: Dp
        get() = if (viewportWidthDp >= WIDE_MIN_WIDTH_DP) 356.dp else 304.dp

    val titleDetailTwoColumn: Boolean
        get() = isSpread && viewportWidthDp >= TITLE_DETAIL_TWO_COL_MIN_WIDTH_DP

    val mySpaceTwoColumn: Boolean
        get() = isSpread && viewportWidthDp >= MY_SPACE_TWO_COL_MIN_WIDTH_DP

    val reportMetricColumns: Int
        get() = if (isSpread) 4 else 2

    val bookshelfTwoColumn: Boolean
        get() = isWide

    val showHeaderTabIcons: Boolean
        get() = viewportWidthDp >= HEADER_ICONS_MIN_WIDTH_DP

    val compactHeaderRecordCta: Boolean
        get() = viewportWidthDp < HEADER_FULL_CTA_MIN_WIDTH_DP

    companion object {
        const val TABLET_SMALLEST_WIDTH_DP = 600
        const val SPREAD_MIN_WIDTH_DP = 700
        const val HOME_THREE_COLUMN_MIN_WIDTH_DP = 800
        const val WIDE_MIN_WIDTH_DP = 1000
        const val MAX_SPREAD_CONTENT_WIDTH_DP = 1180
        const val TOGETHER_TWO_PANE_MIN_WIDTH_DP = 700
        const val HEADER_FULL_CTA_MIN_WIDTH_DP = 800
        const val MY_SPACE_TWO_COL_MIN_WIDTH_DP = 840
        const val TITLE_DETAIL_TWO_COL_MIN_WIDTH_DP = 860
        const val HEADER_ICONS_MIN_WIDTH_DP = 880

        fun resolve(viewportWidthDp: Int): AdaptiveLayoutMetrics {
            val safe = viewportWidthDp.coerceAtLeast(0)
            val mode = when {
                safe < SPREAD_MIN_WIDTH_DP -> AdaptiveWindowMode.COMPACT
                safe < WIDE_MIN_WIDTH_DP -> AdaptiveWindowMode.TABLET_PORTRAIT
                else -> AdaptiveWindowMode.TABLET_WIDE
            }
            return AdaptiveLayoutMetrics(mode = mode, viewportWidthDp = safe)
        }

        fun isTabletDevice(smallestScreenWidthDp: Int): Boolean =
            smallestScreenWidthDp >= TABLET_SMALLEST_WIDTH_DP

        fun deviceLabel(isTablet: Boolean, locale: String): String =
            if (locale == "en") {
                if (isTablet) "Android tablet" else "Android phone"
            } else {
                if (isTablet) "안드로이드 태블릿" else "안드로이드 휴대폰"
            }

        /**
         * Builds the Android native User-Agent.
         * Follows Chrome-on-Android convention: phones include `Mobile`, while tablets (`sw600dp+`)
         * omit `Mobile` and include an explicit `Tablet` token so `/auth/devices` can distinguish them.
         */
        fun buildAndroidUserAgent(
            release: String,
            model: String,
            versionName: String,
            isTablet: Boolean
        ): String {
            val safeRelease = release.ifBlank { "15" }
            val safeModel = model.ifBlank { "Android" }
            return if (isTablet) {
                "Mozilla/5.0 (Linux; Android $safeRelease; $safeModel; Tablet) Chrome/134.0.0.0 Safari/537.36 ottline-android/$versionName"
            } else {
                "Mozilla/5.0 (Linux; Android $safeRelease; $safeModel) Chrome/134.0.0.0 Mobile Safari/537.36 ottline-android/$versionName"
            }
        }
    }
}

val LocalAdaptiveLayoutMetrics = staticCompositionLocalOf {
    AdaptiveLayoutMetrics.resolve(390)
}
