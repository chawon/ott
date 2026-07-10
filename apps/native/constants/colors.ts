export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  action: string;
  onAction: string;
  selectedSurface: string;
  onSelected: string;
  link: string;
  focus: string;
  onBackground: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  success: string;
  warning: string;
  error: string;
};

export const LightColors: ThemeColors = {
  background: '#f8f6f2',
  surface: '#ffffff',
  surfaceMuted: '#fef9ee',
  surfaceStrong: '#faf5d7',
  action: '#ff9933',
  onAction: '#0f0f0f',
  selectedSurface: '#faf5d7',
  onSelected: '#0f0f0f',
  link: '#1e4d8c',
  focus: '#ff9933',
  onBackground: '#0f0f0f',
  onSurface: '#0f0f0f',
  onSurfaceVariant: '#4a4a4a',
  outline: '#d8d2ca',
  outlineVariant: '#ecebe9',
  success: '#238a56',
  warning: '#b25e09',
  error: '#c83333',
};

export const DarkColors: ThemeColors = {
  background: '#15120f',
  surface: '#211c18',
  surfaceMuted: '#2b241f',
  surfaceStrong: '#3a3027',
  action: '#ff9933',
  onAction: '#0f0f0f',
  selectedSurface: '#3a3027',
  onSelected: '#fff8ef',
  link: '#d8cfc4',
  focus: '#ff9933',
  onBackground: '#fff8ef',
  onSurface: '#fff8ef',
  onSurfaceVariant: '#d8cfc4',
  outline: '#5c5046',
  outlineVariant: '#3a3027',
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
