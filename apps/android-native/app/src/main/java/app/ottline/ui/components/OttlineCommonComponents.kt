package app.ottline.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.ottline.data.SyncFailureReason
import app.ottline.data.SyncState
import app.ottline.data.SyncStatus
import app.ottline.data.local.ThemeMode
import app.ottline.domain.RecordFeelings
import app.ottline.model.PersonaKey
import app.ottline.model.TitleType
import app.ottline.ui.i18n.LocalAppLocale
import app.ottline.ui.i18n.OttlineStrings
import app.ottline.ui.i18n.tr
import app.ottline.ui.theme.LocalOttlinePalette
import coil3.compose.SubcomposeAsyncImage
import kotlinx.coroutines.launch

enum class MainTab {
    HOME,
    TIMELINE,
    TOGETHER,
    MY_SPACE
}

class NoSwipeNavTracker {
    @Volatile
    var ignoreCurrentGesture: Boolean = false
}

val LocalNoSwipeNavTracker = compositionLocalOf { NoSwipeNavTracker() }

/**
 * Marks a horizontal scroll region (matching web `[data-no-swipe-nav]`) so horizontal gestures
 * starting inside it never trigger top-level tab swipe navigation, without consuming or
 * interfering with any child touch/scroll events.
 */
@Composable
fun Modifier.noSwipeNav(): Modifier {
    val tracker = LocalNoSwipeNavTracker.current
    return this.pointerInput(tracker) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            tracker.ignoreCurrentGesture = true
        }
    }
}

/**
 * Official CI v2 open-book + play symbol rendered with exact 96x96 viewBox geometry.
 */
@Composable
fun OttlineBrandMark(
    modifier: Modifier = Modifier,
    size: Dp = 28.dp,
    strokeColor: Color = LocalOttlinePalette.current.brandMarkStroke
) {
    Canvas(modifier = modifier.size(size)) {
        val sx = this.size.width / 96f
        val sy = this.size.height / 96f

        val bookPath = Path().apply {
            moveTo(14f * sx, 34f * sy)
            lineTo(14f * sx, 28f * sy)
            cubicTo(14f * sx, 22.477f * sy, 18.477f * sx, 18f * sy, 24f * sx, 18f * sy)
            cubicTo(34f * sx, 18f * sy, 41.5f * sx, 21.8f * sy, 48f * sx, 27f * sy)
            cubicTo(55.8f * sx, 21.8f * sx, 65.5f * sx, 18f * sy, 77f * sx, 18f * sy)
            cubicTo(82.523f * sx, 18f * sy, 87f * sx, 22.477f * sy, 87f * sx, 28f * sy)
            lineTo(87f * sx, 64f * sy)
            cubicTo(87f * sx, 69.523f * sy, 82.523f * sx, 74f * sy, 77f * sx, 74f * sy)
            cubicTo(66.5f * sx, 74f * sy, 57.2f * sx, 76.9f * sy, 51.5f * sx, 81f * sy)
        }

        val playPath = Path().apply {
            moveTo(15f * sx, 49f * sy)
            lineTo(36.5f * sx, 62.75f * sy)
            lineTo(15f * sx, 76.5f * sy)
            close()
        }

        val stroke = Stroke(
            width = 8f * sx,
            cap = StrokeCap.Round,
            join = StrokeJoin.Round
        )
        drawPath(path = bookPath, color = strokeColor, style = stroke)
        drawPath(path = playPath, color = strokeColor, style = stroke)
    }
}

/**
 * Warm editorial brand splash screen with animated open-book + play stroke drawing,
 * warm message reveal, and timeline node progression.
 */
@Composable
fun OttlineIntroSplashOverlay(
    visible: Boolean,
    nickname: String?,
    onFinished: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    val locale = LocalAppLocale.current
    val strokeProgress = remember { Animatable(0f) }
    val copyProgress = remember { Animatable(0f) }
    val timelineProgress = remember { Animatable(0f) }

    val messageIndex = remember {
        (java.time.LocalDate.now().dayOfYear) % 3
    }

    LaunchedEffect(visible) {
        if (!visible) return@LaunchedEffect
        strokeProgress.snapTo(0f)
        copyProgress.snapTo(0f)
        timelineProgress.snapTo(0f)

        kotlinx.coroutines.delay(150)
        kotlinx.coroutines.coroutineScope {
            launch {
                strokeProgress.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 780, easing = FastOutSlowInEasing)
                )
            }
            launch {
                kotlinx.coroutines.delay(220)
                copyProgress.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 620, easing = LinearOutSlowInEasing)
                )
            }
            launch {
                kotlinx.coroutines.delay(300)
                timelineProgress.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 1350, easing = FastOutSlowInEasing)
                )
            }
        }
        kotlinx.coroutines.delay(350)
        onFinished()
    }

    AnimatedVisibility(
        visible = visible,
        exit = fadeOut(animationSpec = tween(360, easing = FastOutSlowInEasing)) +
            scaleOut(targetScale = 1.03f, animationSpec = tween(360, easing = FastOutSlowInEasing))
    ) {
        val interactionSource = remember { MutableInteractionSource() }
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxSize()
                .background(palette.background)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    onClick = onFinished
                )
        ) {
            // Subtle warm radial glow behind the brand symbol
            Canvas(modifier = Modifier.fillMaxSize()) {
                val radius = size.minDimension * 0.55f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            palette.brandOrange.copy(alpha = 0.10f * strokeProgress.value),
                            palette.brandNavy.copy(alpha = 0.05f * strokeProgress.value),
                            Color.Transparent
                        ),
                        center = Offset(size.width * 0.5f, size.height * 0.44f),
                        radius = radius
                    ),
                    radius = radius,
                    center = Offset(size.width * 0.5f, size.height * 0.44f)
                )
            }

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier
                    .padding(horizontal = 32.dp)
                    .fillMaxWidth()
            ) {
                // Animated Stroke-Drawing Brand Symbol
                val markScale = 0.86f + 0.14f * strokeProgress.value
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(84.dp)
                        .graphicsLayer {
                            scaleX = markScale
                            scaleY = markScale
                            alpha = (strokeProgress.value * 1.4f).coerceIn(0f, 1f)
                        }
                ) {
                    val strokeColor = palette.brandMarkStroke
                    val accentOrange = palette.brandOrange
                    val progress = strokeProgress.value
                    Canvas(modifier = Modifier.size(76.dp)) {
                        val sx = this.size.width / 96f
                        val sy = this.size.height / 96f

                        val bookPath = Path().apply {
                            moveTo(14f * sx, 34f * sy)
                            lineTo(14f * sx, 28f * sy)
                            cubicTo(14f * sx, 22.477f * sy, 18.477f * sx, 18f * sy, 24f * sx, 18f * sy)
                            cubicTo(34f * sx, 18f * sy, 41.5f * sx, 21.8f * sy, 48f * sx, 27f * sy)
                            cubicTo(55.8f * sx, 21.8f * sx, 65.5f * sx, 18f * sy, 77f * sx, 18f * sy)
                            cubicTo(82.523f * sx, 18f * sy, 87f * sx, 22.477f * sy, 87f * sx, 28f * sy)
                            lineTo(87f * sx, 64f * sy)
                            cubicTo(87f * sx, 69.523f * sy, 82.523f * sy, 74f * sy, 77f * sx, 74f * sy)
                            cubicTo(66.5f * sx, 74f * sy, 57.2f * sx, 76.9f * sy, 51.5f * sx, 81f * sy)
                        }

                        val playPath = Path().apply {
                            moveTo(15f * sx, 49f * sy)
                            lineTo(36.5f * sx, 62.75f * sy)
                            lineTo(15f * sx, 76.5f * sy)
                            close()
                        }

                        val stroke = Stroke(
                            width = 8f * sx,
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )

                        val bookMeasure = PathMeasure().apply { setPath(bookPath, false) }
                        val animatedBook = Path()
                        bookMeasure.getSegment(0f, bookMeasure.length * progress, animatedBook, true)
                        drawPath(path = animatedBook, color = strokeColor, style = stroke)

                        val playProgress = ((progress - 0.25f) / 0.75f).coerceIn(0f, 1f)
                        if (playProgress > 0f) {
                            if (playProgress >= 0.85f) {
                                val fillAlpha = ((playProgress - 0.85f) / 0.15f).coerceIn(0f, 1f) * 0.18f
                                drawPath(path = playPath, color = accentOrange.copy(alpha = fillAlpha))
                            }
                            val playMeasure = PathMeasure().apply { setPath(playPath, true) }
                            val animatedPlay = Path()
                            playMeasure.getSegment(0f, playMeasure.length * playProgress, animatedPlay, true)
                            drawPath(path = animatedPlay, color = strokeColor, style = stroke)
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))

                // Wordmark & Tagline + Editorial Copy
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.graphicsLayer {
                        alpha = copyProgress.value
                        translationY = (1f - copyProgress.value) * 14.dp.toPx()
                    }
                ) {
                    Text(
                        text = "ottline",
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 34.sp,
                            lineHeight = 38.sp,
                            letterSpacing = (-0.8).sp
                        ),
                        color = palette.brandMarkStroke
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "ON THE TIMELINE",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 9.5.sp,
                            lineHeight = 12.sp,
                            letterSpacing = 1.8.sp
                        ),
                        color = palette.brandOrange
                    )

                    Spacer(Modifier.height(26.dp))

                    // Personalized eyebrow pill
                    val eyebrowText = if (!nickname.isNullOrBlank()) {
                        if (locale == "en") "${nickname}'s timeline notebook" else "${nickname}님의 기록 수첩"
                    } else {
                        if (locale == "en") "Your personal timeline notebook" else "나만의 감상 기록 수첩"
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(palette.paperStrong)
                            .border(1.dp, palette.border, RoundedCornerShape(999.dp))
                            .padding(horizontal = 12.dp, vertical = 5.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(palette.brandOrange)
                        )
                        Text(
                            text = eyebrowText,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            color = palette.mutedInk
                        )
                    }

                    Spacer(Modifier.height(14.dp))

                    val splashMessage = when (messageIndex) {
                        0 -> tr(
                            "지나간 장면과 문장,\n그날의 온기를 다시 꺼내봅니다.",
                            "Revisiting the warmth of the scenes\nand lines you loved."
                        )
                        1 -> tr(
                            "보고 읽은 순간이 사라지지 않도록,\n나만의 타임라인에 남겨요.",
                            "Keep the moments you watch and read\non your own timeline."
                        )
                        else -> tr(
                            "기억하고 싶은 이야기들이\n차곡차곡 쌓이는 공간",
                            "A quiet notebook where the stories\nyou love gather over time."
                        )
                    }

                    Text(
                        text = splashMessage,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 15.sp,
                            lineHeight = 24.sp,
                            fontWeight = FontWeight.Medium
                        ),
                        color = palette.ink,
                        textAlign = TextAlign.Center
                    )

                    Spacer(Modifier.height(32.dp))

                    // Animated 3-dot timeline line (`● ─── ● ─── ●`)
                    val lineProg = timelineProgress.value
                    Canvas(modifier = Modifier.size(width = 112.dp, height = 10.dp)) {
                        val cy = size.height / 2f
                        val startX = 6.dp.toPx()
                        val endX = size.width - 6.dp.toPx()
                        val midX = size.width / 2f
                        val totalLen = endX - startX

                        // Base track
                        drawLine(
                            color = palette.border,
                            start = Offset(startX, cy),
                            end = Offset(endX, cy),
                            strokeWidth = 2.dp.toPx(),
                            cap = StrokeCap.Round
                        )
                        // Active progress track
                        drawLine(
                            color = palette.brandOrange,
                            start = Offset(startX, cy),
                            end = Offset(startX + totalLen * lineProg, cy),
                            strokeWidth = 2.dp.toPx(),
                            cap = StrokeCap.Round
                        )

                        listOf(startX to 0f, midX to 0.5f, endX to 0.95f).forEach { (nx, threshold) ->
                            val active = lineProg >= threshold
                            drawCircle(
                                color = if (active) palette.brandOrange else palette.border,
                                radius = if (active) 3.5.dp.toPx() else 2.5.dp.toPx(),
                                center = Offset(nx, cy)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OttlineTopBar(
    nickname: String?,
    personaKey: PersonaKey?,
    locale: String,
    themeMode: ThemeMode,
    onSelectLocale: (String) -> Unit,
    onToggleTheme: () -> Unit,
    onLogoClick: () -> Unit,
    onProfileClick: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    Surface(
        color = palette.background,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .heightIn(min = 76.dp)
                    .padding(horizontal = 18.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = onLogoClick)
                        .padding(vertical = 4.dp)
                ) {
                    OttlineBrandMark(size = 32.dp)
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "ottline",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 24.sp,
                                lineHeight = 25.sp,
                                letterSpacing = (-0.6).sp
                            ),
                            color = palette.brandMarkStroke
                        )
                        Text(
                            text = "ON THE TIMELINE",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 7.sp,
                                lineHeight = 8.sp,
                                letterSpacing = 0.6.sp
                            ),
                            color = palette.brandOrange
                        )
                    }
                }

                // Right actions matching mobile web `AppHeader.tsx` + `AppShell.module.css` (`KO`/`EN`, theme icon, avatar)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        listOf("ko" to "KO", "en" to "EN").forEach { (code, shortLabel) ->
                            val active = locale == code
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .widthIn(min = 32.dp)
                                    .heightIn(min = 44.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .clickable {
                                        if (!active) onSelectLocale(code)
                                    }
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        text = shortLabel,
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontSize = 10.5.sp,
                                            lineHeight = 12.sp,
                                            fontWeight = FontWeight.SemiBold
                                        ),
                                        color = if (active) palette.ink else palette.mutedInk
                                    )
                                    Spacer(Modifier.height(3.dp))
                                    Box(
                                        modifier = Modifier
                                            .width(14.dp)
                                            .height(1.5.dp)
                                            .background(if (active) palette.ink else Color.Transparent)
                                    )
                                }
                            }
                        }
                    }

                    val themeIcon = when (themeMode) {
                        ThemeMode.SYSTEM -> OttlineNavIcons.Monitor
                        ThemeMode.DARK -> OttlineNavIcons.Moon
                        ThemeMode.LIGHT -> OttlineNavIcons.Sun
                    }
                    val themeA11yLabel = when (themeMode) {
                        ThemeMode.SYSTEM -> tr("테마 변경 (현재: 시스템)", "Change theme (current: System)")
                        ThemeMode.DARK -> tr("테마 변경 (현재: 다크)", "Change theme (current: Dark)")
                        ThemeMode.LIGHT -> tr("테마 변경 (현재: 라이트)", "Change theme (current: Light)")
                    }
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .widthIn(min = 40.dp)
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = onToggleTheme)
                            .semantics {
                                role = Role.Button
                                contentDescription = themeA11yLabel
                            }
                    ) {
                        Icon(
                            imageVector = themeIcon,
                            contentDescription = null,
                            tint = palette.mutedInk,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    val profileA11yLabel = nickname?.takeIf { it.isNotBlank() } ?: tr("내 프로필", "My profile")
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable(onClick = onProfileClick)
                            .semantics {
                                role = Role.Button
                                contentDescription = profileA11yLabel
                            }
                    ) {
                        PersonaAvatar(
                            personaKey = personaKey,
                            nickname = profileA11yLabel,
                            size = 40.dp,
                            shape = RoundedCornerShape(8.dp)
                        )
                    }
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(palette.border.copy(alpha = 0.75f))
            )
        }
    }
}

/**
 * Exact 24x24 Lucide icons matching `BottomNav.tsx` (`Home`, `Clock`, `Plus`, `MessageCircle`, `UserRound`).
 */
private object OttlineNavIcons {
    val Home: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideHome",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(15f, 21f)
                verticalLineTo(13f)
                arcTo(1f, 1f, 0f, isMoreThanHalf = false, isPositiveArc = false, 14f, 12f)
                horizontalLineTo(10f)
                arcTo(1f, 1f, 0f, isMoreThanHalf = false, isPositiveArc = false, 9f, 13f)
                verticalLineTo(21f)
            }
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(3f, 10f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 3.709f, 8.472f)
                lineTo(10.709f, 2.473f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 13.291f, 2.473f)
                lineTo(20.291f, 8.472f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 21f, 10f)
                verticalLineTo(19f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 19f, 21f)
                horizontalLineTo(5f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 3f, 19f)
                close()
            }
        }.build()
    }

    val Clock: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideClock",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(22f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 2f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 22f, 12f)
                close()
                moveTo(12f, 6f)
                verticalLineTo(12f)
                lineTo(16f, 14f)
            }
        }.build()
    }

    val Plus: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucidePlus",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2.2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(5f, 12f)
                horizontalLineTo(19f)
                moveTo(12f, 5f)
                verticalLineTo(19f)
            }
        }.build()
    }

    val MessageCircle: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideMessageCircle",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(7.9f, 20f)
                arcTo(9f, 9f, 0f, isMoreThanHalf = true, isPositiveArc = false, 4f, 16.1f)
                lineTo(2f, 22f)
                close()
            }
        }.build()
    }

    val UserRound: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideUserRound",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(17f, 8f)
                arcTo(5f, 5f, 0f, isMoreThanHalf = true, isPositiveArc = true, 7f, 8f)
                arcTo(5f, 5f, 0f, isMoreThanHalf = true, isPositiveArc = true, 17f, 8f)
                close()
                moveTo(20f, 21f)
                arcTo(8f, 8f, 0f, isMoreThanHalf = false, isPositiveArc = false, 12f, 13f)
                arcTo(8f, 8f, 0f, isMoreThanHalf = false, isPositiveArc = false, 4f, 21f)
            }
        }.build()
    }

    val Sun: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideSun",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(16f, 12f)
                arcTo(4f, 4f, 0f, isMoreThanHalf = true, isPositiveArc = true, 8f, 12f)
                arcTo(4f, 4f, 0f, isMoreThanHalf = true, isPositiveArc = true, 16f, 12f)
                close()
                moveTo(12f, 2f)
                verticalLineTo(4f)
                moveTo(12f, 20f)
                verticalLineTo(22f)
                moveTo(4.93f, 4.93f)
                lineTo(6.34f, 6.34f)
                moveTo(17.66f, 17.66f)
                lineTo(19.07f, 19.07f)
                moveTo(2f, 12f)
                horizontalLineTo(4f)
                moveTo(20f, 12f)
                horizontalLineTo(22f)
                moveTo(6.34f, 17.66f)
                lineTo(4.93f, 19.07f)
                moveTo(19.07f, 4.93f)
                lineTo(17.66f, 6.34f)
            }
        }.build()
    }

    val Moon: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideMoon",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 3f)
                arcTo(6f, 6f, 0f, isMoreThanHalf = false, isPositiveArc = false, 21f, 12f)
                arcTo(9f, 9f, 0f, isMoreThanHalf = true, isPositiveArc = true, 12f, 3f)
                close()
            }
        }.build()
    }

    val Monitor: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideMonitor",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(4f, 3f)
                horizontalLineTo(20f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 22f, 5f)
                verticalLineTo(15f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 20f, 17f)
                horizontalLineTo(4f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 2f, 15f)
                verticalLineTo(5f)
                arcTo(2f, 2f, 0f, isMoreThanHalf = false, isPositiveArc = true, 4f, 3f)
                close()
                moveTo(8f, 21f)
                horizontalLineTo(16f)
                moveTo(12f, 17f)
                verticalLineTo(21f)
            }
        }.build()
    }
}

@Composable
fun OttlineBottomBar(
    currentTab: MainTab,
    onSelectTab: (MainTab) -> Unit,
    onQuickRecordClick: () -> Unit
) {
    val palette = LocalOttlinePalette.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(palette.background)
            .navigationBarsPadding()
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = palette.card,
            border = BorderStroke(1.dp, palette.border),
            tonalElevation = 0.dp,
            shadowElevation = 8.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 68.dp)
                    .padding(horizontal = 6.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                BottomNavItem(
                    label = tr("홈", "Home"),
                    icon = OttlineNavIcons.Home,
                    selected = currentTab == MainTab.HOME,
                    onClick = { onSelectTab(MainTab.HOME) },
                    modifier = Modifier.weight(1f)
                )
                BottomNavItem(
                    label = tr("타임라인", "Timeline"),
                    icon = OttlineNavIcons.Clock,
                    selected = currentTab == MainTab.TIMELINE,
                    onClick = { onSelectTab(MainTab.TIMELINE) },
                    modifier = Modifier.weight(1f)
                )

                // Center tactile Quick Record action — icon-only `+` matching `BottomNav.tsx` (`iconOnly`)
                Surface(
                    onClick = onQuickRecordClick,
                    shape = RoundedCornerShape(8.dp),
                    color = palette.brandOrange,
                    modifier = Modifier
                        .padding(horizontal = 5.dp)
                        .size(53.dp)
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        Icon(
                            imageVector = OttlineNavIcons.Plus,
                            contentDescription = tr("기록 남기기", "Keep a story"),
                            tint = Color(0xFF0F0F0F),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }

                BottomNavItem(
                    label = tr("함께", "Together"),
                    icon = OttlineNavIcons.MessageCircle,
                    selected = currentTab == MainTab.TOGETHER,
                    onClick = { onSelectTab(MainTab.TOGETHER) },
                    modifier = Modifier.weight(1f)
                )
                BottomNavItem(
                    label = tr("내 공간", "My space"),
                    icon = OttlineNavIcons.UserRound,
                    selected = currentTab == MainTab.MY_SPACE,
                    onClick = { onSelectTab(MainTab.MY_SPACE) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun BottomNavItem(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val palette = LocalOttlinePalette.current
    val activeTint = if (palette.isDark) palette.ink else palette.brandNavy
    val tint = if (selected) activeTint else palette.mutedInk
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .heightIn(min = 54.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
    ) {
        if (selected) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .width(15.dp)
                    .height(2.dp)
                    .background(palette.brandOrange)
            )
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 2.dp, vertical = 4.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = tint,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.height(5.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 10.sp,
                    lineHeight = 13.sp,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                ),
                color = tint,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * Storybook persona avatar (`ProfileAvatar.tsx` parity).
 * - When `personaKey != null`: renders the selected storybook avatar illustration.
 * - When `personaKey == null` (before profile setup or after account deletion / local reset):
 *   renders the clean `UserRound` silhouette inside the `paperStrong` rounded frame.
 */
@Composable
fun PersonaAvatar(
    personaKey: PersonaKey?,
    nickname: String? = null,
    size: Dp = 40.dp,
    shape: Shape = RoundedCornerShape(8.dp),
    modifier: Modifier = Modifier
) {
    val palette = LocalOttlinePalette.current
    if (personaKey != null) {
        Image(
            painter = painterResource(id = OttlineStrings.personaAvatarRes(personaKey)),
            contentDescription = nickname ?: personaKey.wireValue,
            contentScale = ContentScale.Crop,
            modifier = modifier
                .size(size)
                .clip(shape)
                .background(palette.paperStrong)
                .border(1.dp, palette.border, shape)
        )
    } else {
        val iconTint = if (palette.isDark) palette.ink else palette.brandNavy
        Box(
            contentAlignment = Alignment.Center,
            modifier = modifier
                .size(size)
                .clip(shape)
                .background(palette.paperStrong)
                .border(1.dp, palette.border, shape)
        ) {
            Icon(
                imageVector = OttlineNavIcons.UserRound,
                contentDescription = nickname,
                tint = iconTint,
                modifier = Modifier.size(size * 0.45f)
            )
        }
    }
}

fun tmdbResizeUrl(rawUrl: String?, widthBucket: String = "w500"): String? {
    if (rawUrl.isNullOrBlank()) return null
    if (!rawUrl.contains("image.tmdb.org/t/p/")) return rawUrl
    return rawUrl.replace(Regex("""/t/p/(w\d+|original)/"""), "/t/p/$widthBucket/")
}

/**
 * DPR-aware Poster & Book Cover component:
 * - Books use `ContentScale.Fit` (`contain`) so full cover proportions are never cropped.
 * - TMDB posters try resized bucket first, automatically falling back to original URL, then a warm typographic card.
 */
@Composable
fun PosterImage(
    posterUrl: String?,
    titleName: String,
    titleType: TitleType,
    modifier: Modifier = Modifier,
    widthBucket: String = "w500"
) {
    val palette = LocalOttlinePalette.current
    val isBook = titleType == TitleType.BOOK
    val candidates = remember(posterUrl, widthBucket) {
        if (posterUrl.isNullOrBlank()) {
            emptyList()
        } else {
            val resized = tmdbResizeUrl(posterUrl, widthBucket)
            listOfNotNull(resized, posterUrl).distinct()
        }
    }
    var attemptIndex by remember(candidates) { mutableIntStateOf(0) }
    val activeUrl = candidates.getOrNull(attemptIndex)

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (isBook) palette.paperStrong else palette.mutedBg)
            .border(1.dp, palette.border, RoundedCornerShape(8.dp))
    ) {
        if (activeUrl != null) {
            SubcomposeAsyncImage(
                model = activeUrl,
                contentDescription = titleName,
                contentScale = if (isBook) ContentScale.Fit else ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(if (isBook) 3.dp else 0.dp),
                onError = {
                    if (attemptIndex + 1 < candidates.size) {
                        attemptIndex += 1
                    } else {
                        attemptIndex = candidates.size
                    }
                },
                error = {
                    PosterFallbackCard(titleName = titleName, isBook = isBook)
                }
            )
        } else {
            PosterFallbackCard(titleName = titleName, isBook = isBook)
        }
    }
}

@Composable
private fun PosterFallbackCard(titleName: String, isBook: Boolean) {
    val palette = LocalOttlinePalette.current
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(6.dp)
    ) {
        if (isBook) {
            Icon(
                imageVector = Icons.Outlined.AutoStories,
                contentDescription = null,
                tint = palette.brandNavy.copy(alpha = 0.65f),
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.height(4.dp))
        }
        Text(
            text = titleName,
            style = MaterialTheme.typography.labelSmall,
            color = palette.mutedInk,
            textAlign = TextAlign.Center,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun SyncNoticeBanner(
    syncState: SyncState,
    outboxCount: Int,
    onRetryClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val palette = LocalOttlinePalette.current
    val show = outboxCount > 0 || syncState.status != SyncStatus.IDLE
    if (!show) return

    val (title, subtitle, showRetry) = when (syncState.status) {
        SyncStatus.OFFLINE -> Triple(
            tr("오프라인 보관 중 ($outboxCount)", "Saved offline ($outboxCount)"),
            tr("연결이 돌아오면 이 기기의 기록을 자동으로 동기화해요.", "Your records are safe on this device and will sync when online."),
            true
        )
        SyncStatus.SYNCING -> Triple(
            tr("타임라인 동기화 중…", "Syncing timeline…"),
            tr("남겨둔 기록을 조용히 맞추고 있어요.", "Aligning your kept moments."),
            false
        )
        SyncStatus.FAILED -> {
            val detail = when (syncState.failure) {
                SyncFailureReason.AUTH -> tr("연결 정보를 다시 확인해 주세요.", "Please check your account connection.")
                SyncFailureReason.REJECTED -> tr("일부 기록 형식을 서버에서 확인하지 못했어요.", "Some record changes could not be accepted.")
                else -> tr("서버 응답이 지연되고 있어요. 기록은 이 기기에 안전하게 남아 있어요.", "Server sync failed, but your record is safe on this device.")
            }
            Triple(tr("동기화 확인 필요", "Sync needs attention"), detail, true)
        }
        SyncStatus.IDLE -> Triple(
            tr("동기화 대기 중 ($outboxCount)", "Pending sync ($outboxCount)"),
            tr("잠시 후 서버와 기록을 맞춰둘게요.", "Will sync with the server shortly."),
            true
        )
    }

    Surface(
        shape = RoundedCornerShape(10.dp),
        color = palette.paperStrong,
        border = BorderStroke(1.dp, palette.border),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    color = palette.ink
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.mutedInk
                )
            }
            if (showRetry) {
                TextButton(
                    onClick = onRetryClick,
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    colors = ButtonDefaults.textButtonColors(contentColor = palette.brandNavy),
                    modifier = Modifier.heightIn(min = 48.dp)
                ) {
                    Icon(Icons.Outlined.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(tr("다시 시도", "Retry"), style = MaterialTheme.typography.labelMedium)
                }
            }
        }
    }
}

/**
 * Exact 24x24 Lucide feeling icons (`FeelingIcon.tsx` parity: `Smile`, `BookOpen`, `Meh`, `Frown`).
 */
object OttlineFeelingIcons {
    val Smile: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideSmile",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(22f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 2f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 22f, 12f)
                close()
                moveTo(8f, 14f)
                curveTo(8f, 14f, 9.5f, 16f, 12f, 16f)
                curveTo(14.5f, 16f, 16f, 14f, 16f, 14f)
            }
            path(fill = SolidColor(Color.Black)) {
                moveTo(10.05f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 7.95f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 10.05f, 9f)
                close()
                moveTo(16.05f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 13.95f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 16.05f, 9f)
                close()
            }
        }.build()
    }

    val Meh: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideMeh",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(22f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 2f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 22f, 12f)
                close()
                moveTo(8f, 15f)
                horizontalLineTo(16f)
            }
            path(fill = SolidColor(Color.Black)) {
                moveTo(10.05f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 7.95f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 10.05f, 9f)
                close()
                moveTo(16.05f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 13.95f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 16.05f, 9f)
                close()
            }
        }.build()
    }

    val Frown: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideFrown",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(22f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 2f, 12f)
                arcTo(10f, 10f, 0f, isMoreThanHalf = true, isPositiveArc = true, 22f, 12f)
                close()
                moveTo(16f, 16f)
                curveTo(16f, 16f, 14.5f, 14f, 12f, 14f)
                curveTo(9.5f, 14f, 8f, 16f, 8f, 16f)
            }
            path(fill = SolidColor(Color.Black)) {
                moveTo(10.05f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 7.95f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 10.05f, 9f)
                close()
                moveTo(16.05f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 13.95f, 9f)
                arcTo(1.05f, 1.05f, 0f, isMoreThanHalf = true, isPositiveArc = true, 16.05f, 9f)
                close()
            }
        }.build()
    }

    val BookOpen: ImageVector by lazy {
        ImageVector.Builder(
            name = "LucideBookOpen",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(12f, 7f)
                verticalLineTo(21f)
                moveTo(3f, 18f)
                arcTo(1f, 1f, 0f, isMoreThanHalf = false, isPositiveArc = true, 2f, 17f)
                verticalLineTo(4f)
                arcTo(1f, 1f, 0f, isMoreThanHalf = false, isPositiveArc = true, 3f, 3f)
                horizontalLineTo(8f)
                arcTo(4f, 4f, 0f, isMoreThanHalf = false, isPositiveArc = true, 12f, 7f)
                arcTo(4f, 4f, 0f, isMoreThanHalf = false, isPositiveArc = true, 16f, 3f)
                horizontalLineTo(21f)
                arcTo(1f, 1f, 0f, isMoreThanHalf = false, isPositiveArc = true, 22f, 4f)
                verticalLineTo(17f)
                arcTo(1f, 1f, 0f, isMoreThanHalf = false, isPositiveArc = true, 21f, 18f)
                horizontalLineTo(15f)
                arcTo(3f, 3f, 0f, isMoreThanHalf = false, isPositiveArc = false, 12f, 21f)
                arcTo(3f, 3f, 0f, isMoreThanHalf = false, isPositiveArc = false, 9f, 18f)
                close()
            }
        }.build()
    }

    fun forValue(value: Int, isBook: Boolean): ImageVector = when (value) {
        5 -> if (isBook) BookOpen else Smile
        3 -> Meh
        else -> Frown
    }
}

/**
 * Normalized feeling icon (`FeelingIcon.tsx` parity) used when choosing and revisiting a record.
 */
@Composable
fun FeelingIcon(
    value: Int,
    titleType: TitleType,
    size: Dp = 16.dp,
    tint: Color = LocalContentColor.current,
    modifier: Modifier = Modifier
) {
    Icon(
        imageVector = OttlineFeelingIcons.forValue(value = value, isBook = titleType == TitleType.BOOK),
        contentDescription = null,
        tint = tint,
        modifier = modifier.size(size)
    )
}

/**
 * Inline feeling icon + label (`RecordFeeling` in `RecordParts.tsx` / `.feeling` in `timeline.module.css`).
 */
@Composable
fun RecordFeelingBadge(
    rating: Double?,
    titleType: TitleType,
    iconSize: Dp = 16.dp,
    textStyle: TextStyle = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Medium),
    color: Color = LocalOttlinePalette.current.ink,
    modifier: Modifier = Modifier
) {
    val locale = LocalAppLocale.current
    val feeling = RecordFeelings.resolveFeeling(
        rating = rating,
        isBook = titleType == TitleType.BOOK,
        locale = locale
    ) ?: return

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        modifier = modifier
    ) {
        FeelingIcon(
            value = feeling.value,
            titleType = titleType,
            size = iconSize,
            tint = color
        )
        Text(
            text = feeling.label,
            style = textStyle,
            color = color,
            maxLines = 1
        )
    }
}
