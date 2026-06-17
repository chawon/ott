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
  setLocalePreference: (preference: NativeLocale) => Promise<void>;
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
  const [localePreference, setLocalePreferenceState] = useState<NativeLocale | null>(null);
  const colorScheme: NativeColorScheme = themePreference === 'system' ? systemColorScheme : themePreference;
  const deviceLocale = getLocales()[0];
  const systemLocale = resolveNativeLocale(deviceLocale?.languageTag ?? deviceLocale?.languageCode ?? null);
  const locale = localePreference ?? systemLocale;

  useEffect(() => {
    let mounted = true;
    Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.themePreference),
      SecureStore.getItemAsync(STORAGE_KEYS.localePreference),
    ])
      .then(([storedTheme, storedLocale]) => {
        if (!mounted) return;
        setThemePreferenceState(resolveThemePreference(storedTheme));
        if (storedLocale === 'ko' || storedLocale === 'en') {
          setLocalePreferenceState(storedLocale);
        }
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

  const setLocalePreference = useCallback(async (preference: NativeLocale) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.localePreference, preference);
    setLocalePreferenceState(preference);
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      colors: getThemeColors(colorScheme),
      locale,
      setLocalePreference,
      setThemePreference,
      systemColorScheme,
      themePreference,
    }),
    [colorScheme, locale, setLocalePreference, setThemePreference, systemColorScheme, themePreference],
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
