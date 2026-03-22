// Design System: "The Luminescent Layer" (Neon Stratosphere)
// 기존 ottline 브랜드 #1e4d8c와 완벽하게 일치하는 팔레트

export const Colors = {
  // 배경 레이어 (Surface Tiers)
  background: '#0b1326',
  surfaceContainerLowest: '#060e20',
  surfaceContainerLow: '#131b2e',
  surfaceContainer: '#171f33',
  surfaceContainerHigh: '#222a3d',
  surfaceContainerHighest: '#2d3449',
  surfaceBright: '#31394d',

  // 브랜드 (ottline 기존 색상 그대로)
  primary: '#a9c7ff',           // glow text
  primaryContainer: '#1e4d8c',  // ottline 브랜드 파란색
  primaryFixed: '#d6e3ff',
  primaryFixedDim: '#a9c7ff',

  // 포인트 (Cyan Glow)
  secondary: '#7bd0ff',
  secondaryContainer: '#00a6e0',

  // 희귀 보상 전용 (배지, 레벨업 - 과도 사용 금지)
  tertiary: '#ffb781',
  tertiaryFixedDim: '#ffb781',

  // 텍스트
  onBackground: '#dae2fd',
  onSurface: '#dae2fd',
  onSurfaceVariant: '#c3c6d2',
  onPrimary: '#003063',
  onSecondary: '#00354a',

  // 구조
  outline: '#8d919b',
  outlineVariant: '#434750',

  // 상태 색
  statusDone: '#7bd0ff',       // secondary = 완료
  statusInProgress: '#ffb781', // tertiary = 진행중
  statusWishlist: '#434750',   // outline-variant = 위시리스트

  // 에러
  error: '#ffb4ab',
} as const;

export type ColorKey = keyof typeof Colors;
