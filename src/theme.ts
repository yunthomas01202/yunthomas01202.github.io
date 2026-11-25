import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { alpha } from './lib/color';
import { useData } from './lib/store';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSub: string;
  textFaint: string;
  primary: string;
  primarySoft: string;
  danger: string;
  success: string;
  warn: string;
  section: { plan: string; study: string; perf: string; support: string };
  heat: string[];
  shadow: object;
}

const shared = {
  section: { plan: '#3E63DD', study: '#8E4EC6', perf: '#F76B15', support: '#12A594' },
};

export const lightTheme: Theme = {
  dark: false,
  bg: '#F4F5FA',
  surface: '#FFFFFF',
  surface2: '#EEF0F6',
  border: '#E2E5EE',
  text: '#161927',
  textSub: '#5B6175',
  textFaint: '#9AA0B2',
  primary: '#4F46E5',
  primarySoft: '#ECEBFD',
  danger: '#E5484D',
  success: '#30A46C',
  warn: '#F5A623',
  heat: ['#EBEDF0', '#9BE9A8', '#40C463', '#30A14E', '#216E39'],
  shadow: {
    shadowColor: '#1B1F3B',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ...shared,
};

export const darkTheme: Theme = {
  dark: true,
  bg: '#0E1016',
  surface: '#171A23',
  surface2: '#20242F',
  border: '#2A2F3C',
  text: '#ECEEF5',
  textSub: '#A3A9BC',
  textFaint: '#6B7186',
  primary: '#8B85FF',
  primarySoft: '#25233F',
  danger: '#FF6369',
  success: '#3DD68C',
  warn: '#FFB224',
  heat: ['#1F2430', '#0E4429', '#006D32', '#26A641', '#39D353'],
  shadow: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  ...shared,
};

/** 꾸미기에서 고를 수 있는 강조색 */
export const ACCENTS = [
  { name: '보라', color: '#4F46E5' },
  { name: '파랑', color: '#2563EB' },
  { name: '하늘', color: '#0EA5E9' },
  { name: '민트', color: '#0D9488' },
  { name: '초록', color: '#16A34A' },
  { name: '노랑', color: '#D97706' },
  { name: '주황', color: '#EA580C' },
  { name: '빨강', color: '#DC2626' },
  { name: '분홍', color: '#DB2777' },
  { name: '자두', color: '#9333EA' },
  { name: '먹색', color: '#334155' },
];

function lighten(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * k));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const pref = useData((s) => s.settings.theme);
  const accent = useData((s) => s.settings.accent);
  const dark = pref === 'system' ? scheme === 'dark' : pref === 'dark';
  return useMemo(() => {
    const base = dark ? darkTheme : lightTheme;
    if (!accent || !/^#[0-9a-fA-F]{6}$/.test(accent)) return base;
    const primary = dark ? lighten(accent, 0.3) : accent;
    return { ...base, primary, primarySoft: dark ? alpha(primary, 0.18) : lighten(accent, 0.88) };
  }, [dark, accent]);
}
