// Plus Jakarta Sans — 단일 폰트 패밀리
// OLED 다크 배경 최적화: Regular 사용 금지, Medium 이상만 사용

import { TextStyle } from 'react-native';

export const Typography = {
  // 레벨업, 달성 숫자 — ExtraBold, -2% letter-spacing
  displayLg: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -0.96,
    color: '#a9c7ff',
  } as TextStyle,

  displayMd: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.72,
    color: '#a9c7ff',
  } as TextStyle,

  // 섹션 타이틀
  headlineLg: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.24,
    color: '#dae2fd',
  } as TextStyle,

  headlineMd: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#dae2fd',
  } as TextStyle,

  headlineSm: {
    fontSize: 17,
    fontWeight: '700',
    color: '#dae2fd',
  } as TextStyle,

  // 본문 — Medium 이상 (OLED 가독성)
  bodyLg: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#dae2fd',
  } as TextStyle,

  bodyMd: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#dae2fd',
  } as TextStyle,

  // 메타데이터 라벨 — 대문자, +5% letter-spacing (텔레메트리 느낌)
  labelLg: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#c3c6d2',
  } as TextStyle,

  labelSm: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#c3c6d2',
  } as TextStyle,

  // 스트릭, XP 강조
  accent: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: '#7bd0ff',
  } as TextStyle,
} as const;
