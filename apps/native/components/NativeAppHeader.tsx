import { router } from 'expo-router';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../constants/colors';
import { appShellCopy, type NativeLocale } from '../lib/i18n';
import { useNativePreferences, type NativeThemePreference } from '../lib/nativePreferences';

const logo = require('../assets/ottline_logo.png');
const LOCALE_OPTIONS: Array<{ value: NativeLocale; label: string }> = [
  { value: 'ko', label: 'KO' },
  { value: 'en', label: 'EN' },
];
const THEME_ORDER: NativeThemePreference[] = ['system', 'light', 'dark'];

function nextThemePreference(current: NativeThemePreference): NativeThemePreference {
  const index = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? 'system';
}

function ThemeIcon({ colors, mode }: { colors: ThemeColors; mode: NativeThemePreference }) {
  if (mode === 'dark') {
    return (
      <View style={styles.themeIconBox}>
        <View style={[styles.moonDisc, { backgroundColor: colors.onSurface }]} />
        <View style={[styles.moonCutout, { backgroundColor: colors.surface }]} />
      </View>
    );
  }

  if (mode === 'light') {
    return (
      <View style={styles.themeIconBox}>
        <View style={[styles.sunDisc, { borderColor: colors.onSurface }]} />
        <View style={[styles.sunRay, styles.sunRayTop, { backgroundColor: colors.onSurface }]} />
        <View style={[styles.sunRay, styles.sunRayBottom, { backgroundColor: colors.onSurface }]} />
        <View style={[styles.sunRayHorizontal, styles.sunRayLeft, { backgroundColor: colors.onSurface }]} />
        <View style={[styles.sunRayHorizontal, styles.sunRayRight, { backgroundColor: colors.onSurface }]} />
      </View>
    );
  }

  return (
    <View style={styles.themeIconBox}>
      <View style={[styles.monitorScreen, { borderColor: colors.onSurface }]} />
      <View style={[styles.monitorStand, { backgroundColor: colors.onSurface }]} />
    </View>
  );
}

export function NativeAppHeader() {
  const {
    colors,
    colorScheme,
    locale,
    setLocalePreference,
    setThemePreference,
    themePreference,
  } = useNativePreferences();
  const copy = appShellCopy[locale];
  const stylesForTheme = createStyles(colors, colorScheme);
  const themeLabel =
    themePreference === 'dark'
      ? copy.themeDark
      : themePreference === 'light'
        ? copy.themeLight
        : copy.themeSystem;

  return (
    <SafeAreaView style={stylesForTheme.safeArea}>
      <View style={stylesForTheme.header}>
        <Pressable
          accessibilityLabel="ottline"
          accessibilityRole="button"
          onPress={() =>
            router.replace({
              pathname: '/(tabs)/log',
              params: { reset: String(Date.now()) },
            })
          }
          style={styles.brand}
        >
          <Image source={logo} style={styles.logo} />
          <View style={styles.wordmark}>
            <Text style={styles.brandTitle}>ottline</Text>
            <Text style={styles.brandSubtitle}>On the Timeline</Text>
          </View>
        </Pressable>

        <View style={styles.actions}>
          <View style={stylesForTheme.localeGroup} accessibilityLabel={copy.languageSwitcher}>
            {LOCALE_OPTIONS.map((item) => {
              const active = locale === item.value;
              const languageLabel = item.value === 'ko' ? copy.languageKorean : copy.languageEnglish;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setLocalePreference(item.value)}
                  style={[styles.localeButton, active && styles.localeButtonActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${active ? copy.languageActive : copy.languageSwitchTo}: ${languageLabel}`}
                >
                  <Text style={[stylesForTheme.localeText, active && styles.localeTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setThemePreference(nextThemePreference(themePreference))}
            style={stylesForTheme.themeButton}
            accessibilityRole="button"
            accessibilityLabel={`${copy.themeToggle}: ${themeLabel}`}
          >
            <ThemeIcon colors={colors} mode={themePreference} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors, colorScheme: string) {
  return StyleSheet.create({
    safeArea: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: colorScheme === 'dark' ? 0.22 : 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    header: {
      minHeight: 64,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: colors.surface,
    },
    localeGroup: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 999,
      backgroundColor: colors.background,
      padding: 2,
    },
    localeText: {
      color: colors.onSurfaceVariant,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0,
    },
    themeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
  });
}

const styles = StyleSheet.create({
  brand: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  wordmark: {
    minWidth: 0,
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#1E4D8C',
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 31,
    letterSpacing: 0,
  },
  brandSubtitle: {
    color: '#FF9933',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  actions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  localeButton: {
    minWidth: 30,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  localeButtonActive: {
    backgroundColor: '#FF9933',
  },
  localeTextActive: {
    color: '#0F0F0F',
  },
  themeIconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunDisc: {
    width: 11,
    height: 11,
    borderWidth: 2,
    borderRadius: 6,
  },
  sunRay: {
    position: 'absolute',
    width: 2,
    height: 4,
    borderRadius: 1,
  },
  sunRayTop: {
    top: 1,
  },
  sunRayBottom: {
    bottom: 1,
  },
  sunRayHorizontal: {
    position: 'absolute',
    width: 4,
    height: 2,
    borderRadius: 1,
  },
  sunRayLeft: {
    left: 1,
  },
  sunRayRight: {
    right: 1,
  },
  moonDisc: {
    width: 15,
    height: 15,
    borderRadius: 8,
  },
  moonCutout: {
    position: 'absolute',
    top: 3,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  monitorScreen: {
    width: 18,
    height: 13,
    borderWidth: 2,
    borderRadius: 3,
  },
  monitorStand: {
    width: 9,
    height: 2,
    marginTop: 2,
    borderRadius: 1,
  },
});
