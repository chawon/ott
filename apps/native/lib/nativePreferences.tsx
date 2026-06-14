import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getLocales } from 'expo-localization';
import { useColorScheme } from 'react-native';
import { getThemeColors, type NativeColorScheme, type ThemeColors } from '../constants/colors';
import { setAnalyticsTheme } from './api';
import { resolveNativeLocale, type NativeLocale } from './i18n';
import * as SecureStore from './secureStore';
import { STORAGE_KEYS } from './secureStore';

export type NativeThemePreference = NativeColorScheme | 'system';

type NativePreferences = {
  colorScheme: NativeColorScheme;
  colors: ThemeColors;
  locale: NativeLocale;
  setThemePreference: (preference: NativeThemePreference) => Promise<void>;
  systemColorScheme: NativeColorScheme;
  themePreference: NativeThemePreference;
};

const NativePreferencesContext = createContext<NativePreferences | null>(null);

function resolveThemePreference(value: string | null | undefined): NativeThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function NativePreferencesProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const systemColorScheme: NativeColorScheme = systemScheme === 'dark' ? 'dark' : 'light';
  const [themePreference, setThemePreferenceState] = useState<NativeThemePreference>('system');
  const colorScheme: NativeColorScheme = themePreference === 'system' ? systemColorScheme : themePreference;
  const deviceLocale = getLocales()[0];
  const locale = resolveNativeLocale(deviceLocale?.languageTag ?? deviceLocale?.languageCode ?? null);

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(STORAGE_KEYS.themePreference)
      .then((value) => {
        if (mounted) setThemePreferenceState(resolveThemePreference(value));
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAnalyticsTheme(colorScheme);
  }, [colorScheme]);

  const setThemePreference = useCallback(async (preference: NativeThemePreference) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.themePreference, preference);
    setThemePreferenceState(preference);
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      colors: getThemeColors(colorScheme),
      locale,
      setThemePreference,
      systemColorScheme,
      themePreference,
    }),
    [colorScheme, locale, setThemePreference, systemColorScheme, themePreference],
  );

  return (
    <NativePreferencesContext.Provider value={value}>
      {children}
    </NativePreferencesContext.Provider>
  );
}

export function useNativePreferences() {
  const value = useContext(NativePreferencesContext);
  if (!value) {
    throw new Error('useNativePreferences must be used inside NativePreferencesProvider');
  }
  return value;
}
