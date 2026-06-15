export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  primary: string;
  primaryContainer: string;
  secondary: string;
  tertiary: string;
  onBackground: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  statusDone: string;
  statusInProgress: string;
  statusWishlist: string;
  success: string;
  warning: string;
  error: string;
};

export const LightColors: ThemeColors = {
  background: '#f7f8fb',
  surface: '#ffffff',
  surfaceMuted: '#eef2f7',
  surfaceStrong: '#dde6f2',
  primary: '#0f1f3a',
  primaryContainer: '#1e4d8c',
  secondary: '#1377c9',
  tertiary: '#e2743f',
  onBackground: '#142033',
  onSurface: '#142033',
  onSurfaceVariant: '#617086',
  outline: '#c7d1df',
  outlineVariant: '#e1e7f0',
  statusDone: '#1377c9',
  statusInProgress: '#e2743f',
  statusWishlist: '#667085',
  success: '#238a56',
  warning: '#b25e09',
  error: '#c83333',
};

export const DarkColors: ThemeColors = {
  background: '#0f172a',
  surface: '#172033',
  surfaceMuted: '#1f2a44',
  surfaceStrong: '#2a3a5c',
  primary: '#e6edf7',
  primaryContainer: '#60a5fa',
  secondary: '#7cc7ff',
  tertiary: '#f2a066',
  onBackground: '#e6edf7',
  onSurface: '#e6edf7',
  onSurfaceVariant: '#a9b7cc',
  outline: '#53657f',
  outlineVariant: '#33435d',
  statusDone: '#7cc7ff',
  statusInProgress: '#f2a066',
  statusWishlist: '#a9b7cc',
  success: '#60d394',
  warning: '#f6b35d',
  error: '#ff8f8f',
};

export const Colors = LightColors;

export type ColorKey = keyof ThemeColors;
export type NativeColorScheme = 'light' | 'dark';

export function getThemeColors(scheme?: string | null): ThemeColors {
  return scheme === 'dark' ? DarkColors : LightColors;
}
