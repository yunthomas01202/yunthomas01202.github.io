// 꾸미기: 글꼴 (고른 글꼴만 그때 불러와요)
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Font from 'expo-font';
import { useData } from './store';

export type FontKey = 'system' | 'round' | 'serif' | 'mono';

export const FONT_LABEL: Record<FontKey, string> = {
  system: '기본',
  round: '동글동글 (주아)',
  serif: '명조 (고운바탕)',
  mono: '코딩체 (나눔고딕코딩)',
};

const FILES: Record<Exclude<FontKey, 'system'>, { family: string; file: any }> = {
  round: { family: 'Jua', file: require('../../assets/fonts/Jua-Regular.ttf') },
  serif: { family: 'GowunBatang', file: require('../../assets/fonts/GowunBatang-Regular.ttf') },
  mono: { family: 'NanumGothicCoding', file: require('../../assets/fonts/NanumGothicCoding-Regular.ttf') },
};

const loaded = new Set<string>();

export function useAppFont(): { family?: string; scale: number } {
  const key = (useData((s) => s.settings.font) || 'system') as FontKey;
  const scale = useData((s) => s.settings.fontScale) || 1;
  const [, bump] = useState(0);
  const f = key !== 'system' ? FILES[key] : null;
  useEffect(() => {
    if (!f || loaded.has(f.family)) return;
    Font.loadAsync({ [f.family]: f.file })
      .then(() => {
        loaded.add(f.family);
        fontBus.forEach((fn) => fn());
      })
      .catch(() => {});
  }, [f]);
  useEffect(() => {
    const fn = () => bump((x) => x + 1);
    fontBus.add(fn);
    return () => {
      fontBus.delete(fn);
    };
  }, []);
  if (!f || !loaded.has(f.family)) return { scale };
  return { family: f.family, scale };
}

const fontBus = new Set<() => void>();

/** 굵기를 쓰면 안드로이드가 기본 글꼴로 돌아가는 걸 막기 위해, 사용자 글꼴일 땐 굵기를 빼요 */
export const customFontWeightSafe = Platform.OS === 'android';
