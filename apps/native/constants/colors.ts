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
  background: '#f8f6f2',
  surface: '#ffffff',
  surfaceMuted: '#fef9ee',
  surfaceStrong: '#faf5d7',
  primary: '#0f0f0f',
  primaryContainer: '#ff9933',
  secondary: '#ff9933',
  tertiary: '#e9b83f',
  onBackground: '#0f0f0f',
  onSurface: '#0f0f0f',
  onSurfaceVariant: '#4a4a4a',
  outline: '#d8d2ca',
  outlineVariant: '#ecebe9',
  statusDone: '#ff9933',
  statusInProgress: '#e9b83f',
  statusWishlist: '#4a4a4a',
  success: '#238a56',
  warning: '#b25e09',
  error: '#c83333',
};

export const DarkColors: ThemeColors = {
  background: '#15120f',
  surface: '#211c18',
  surfaceMuted: '#2b241f',
  surfaceStrong: '#3a3027',
  primary: '#fff8ef',
  primaryContainer: '#ff9933',
  secondary: '#ff9933',
  tertiary: '#e9b83f',
  onBackground: '#fff8ef',
  onSurface: '#fff8ef',
  onSurfaceVariant: '#d8cfc4',
  outline: '#5c5046',
  outlineVariant: '#3a3027',
  statusDone: '#ff9933',
  statusInProgress: '#e9b83f',
  statusWishlist: '#d8cfc4',
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
