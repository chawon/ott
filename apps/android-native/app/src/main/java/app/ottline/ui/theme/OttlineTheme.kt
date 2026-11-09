package app.ottline.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.ottline.R
import app.ottline.data.local.ThemeMode

val PretendardFontFamily = FontFamily(
    Font(R.font.pretendard_regular, FontWeight.Normal),
    Font(R.font.pretendard_medium, FontWeight.Medium),
    Font(R.font.pretendard_semibold, FontWeight.SemiBold),
    Font(R.font.pretendard_bold, FontWeight.Bold),
    Font(R.font.pretendard_extrabold, FontWeight.ExtraBold)
)

@Immutable
data class OttlinePalette(
    val isDark: Boolean,
    val background: Color,
    val card: Color,
    val paperStrong: Color,
    val sageAccent: Color,
    val border: Color,
    val mutedBg: Color,
    val ink: Color,
    val mutedInk: Color,
    val subtleInk: Color,
    val brandNavy: Color,
    val onBrandNavy: Color,
    val brandMarkStroke: Color,
    val brandOrange: Color,
    val danger: Color,
    val success: Color
)

val LightOttlinePalette = OttlinePalette(
    isDark = false,
    background = Color(0xFFF8F6F2),
    card = Color(0xFFFFFFFF),
    paperStrong = Color(0xFFFEF9EE),
    sageAccent = Color(0xFFFAF5D7),
    border = Color(0xFFE5E1DA),
    mutedBg = Color(0xFFECEBE9),
    ink = Color(0xFF0F0F0F),
    mutedInk = Color(0xFF4A4A4A),
    subtleInk = Color(0xFF76716A),
    brandNavy = Color(0xFF1E4D8C),
    onBrandNavy = Color(0xFFFFFFFF),
    brandMarkStroke = Color(0xFF1E4D8C),
    brandOrange = Color(0xFFFF9933),
    danger = Color(0xFFC93B2B),
    success = Color(0xFF1D7A4C)
)

val DarkOttlinePalette = OttlinePalette(
    isDark = true,
    background = Color(0xFF15120F),
    card = Color(0xFF211C18),
    paperStrong = Color(0xFF2B241F),
    sageAccent = Color(0xFF3A3027),
    border = Color(0xFF3D342C),
    mutedBg = Color(0xFF2B241F),
    ink = Color(0xFFFFF8EF),
    mutedInk = Color(0xFFD8CFC4),
    subtleInk = Color(0xFF9C9184),
    brandNavy = Color(0xFF8BB4EE),
    onBrandNavy = Color(0xFF15120F),
    brandMarkStroke = Color(0xFFFFF8EF),
    brandOrange = Color(0xFFFF9933),
    danger = Color(0xFFFF7A6B),
    success = Color(0xFF5DD39E)
)

val LocalOttlinePalette = staticCompositionLocalOf { LightOttlinePalette }

private val OttlineTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.5).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 29.sp,
        letterSpacing = (-0.4).sp
    ),
    headlineSmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        lineHeight = 25.sp,
        letterSpacing = (-0.2).sp
    ),
    titleLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 25.sp
    ),
    titleMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    titleSmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 23.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 21.sp
    ),
    bodySmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 18.sp
    ),
    labelLarge = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    labelMedium = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp
    ),
    labelSmall = TextStyle(
        fontFamily = PretendardFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.4.sp
    )
)

@Composable
fun OttlineTheme(
    themeMode: ThemeMode,
    content: @Composable () -> Unit
) {
    val isDark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val palette = if (isDark) DarkOttlinePalette else LightOttlinePalette

    val colorScheme = if (isDark) {
        darkColorScheme(
            primary = palette.brandNavy,
            onPrimary = palette.onBrandNavy,
            secondary = palette.brandNavy,
            onSecondary = palette.onBrandNavy,
            tertiary = palette.brandOrange,
            onTertiary = Color(0xFF0F0F0F),
            background = palette.background,
            onBackground = palette.ink,
            surface = palette.card,
            onSurface = palette.ink,
            surfaceVariant = palette.paperStrong,
            onSurfaceVariant = palette.mutedInk,
            outline = palette.border,
            error = palette.danger
        )
    } else {
        lightColorScheme(
            primary = palette.brandNavy,
            onPrimary = palette.onBrandNavy,
            secondary = palette.brandNavy,
            onSecondary = palette.onBrandNavy,
            tertiary = palette.brandOrange,
            onTertiary = Color(0xFF0F0F0F),
            background = palette.background,
            onBackground = palette.ink,
            surface = palette.card,
            onSurface = palette.ink,
            surfaceVariant = palette.paperStrong,
            onSurfaceVariant = palette.mutedInk,
            outline = palette.border,
            error = palette.danger
        )
    }

    CompositionLocalProvider(LocalOttlinePalette provides palette) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = OttlineTypography,
            content = content
        )
    }
}
