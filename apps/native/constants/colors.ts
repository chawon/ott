export const Colors = {
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
} as const;

export type ColorKey = keyof typeof Colors;
