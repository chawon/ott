import { TextStyle } from 'react-native';

export const Typography = {
  displayLg: {
    fontSize: 48,
    fontWeight: '800',
    color: '#0f0f0f',
  } as TextStyle,

  displayMd: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f0f0f',
  } as TextStyle,

  headlineLg: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f0f0f',
  } as TextStyle,

  headlineMd: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f0f0f',
  } as TextStyle,

  headlineSm: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f0f0f',
  } as TextStyle,

  bodyLg: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: '#0f0f0f',
  } as TextStyle,

  bodyMd: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#0f0f0f',
  } as TextStyle,

  labelLg: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a4a4a',
  } as TextStyle,

  labelSm: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a4a4a',
  } as TextStyle,

  accent: {
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,
} as const;
