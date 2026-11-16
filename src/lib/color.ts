import type { Energy } from './types';

/** 과목·항목 색 팔레트 */
export const SUBJECT_COLORS = [
  '#E5484D', // 빨강
  '#F76B15', // 주황
  '#FFB224', // 노랑
  '#30A46C', // 초록
  '#12A594', // 청록
  '#0090FF', // 파랑
  '#3E63DD', // 남색
  '#8E4EC6', // 보라
  '#D6409F', // 분홍
  '#A18072', // 갈색
  '#6E56CF', // 바이올렛
  '#687076', // 회색
];

function parse(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** a와 b를 t(0~1) 비율로 섞기 */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export const lighten = (c: string, t: number) => mix(c, '#ffffff', t);
export const darken = (c: string, t: number) => mix(c, '#000000', t);

export function alpha(c: string, a: number): string {
  const [r, g, b] = parse(c);
  return `rgba(${r},${g},${b},${a})`;
}

export function luminance(c: string): number {
  const [r, g, b] = parse(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 배경 위에 읽기 좋은 글자색 */
export function readableOn(bg: string): string {
  return luminance(bg) > 0.42 ? '#1A1D29' : '#FFFFFF';
}

/**
 * 에너지 코스트 → 과목 색의 짙기
 * 5(매우 힘듦) = 가장 짙은 색, 1(아주 가벼움) = 가장 옅은 색
 */
export function energyShade(base: string, energy: Energy | number): string {
  switch (energy) {
    case 5:
      return darken(base, 0.18);
    case 4:
      return base;
    case 3:
      return lighten(base, 0.32);
    case 2:
      return lighten(base, 0.52);
    default:
      return lighten(base, 0.7);
  }
}

/** GitHub 잔디 색 (0~4 단계) */
export const HEAT_LIGHT = ['#EBEDF0', '#9BE9A8', '#40C463', '#30A14E', '#216E39'];
export const HEAT_DARK = ['#1F2430', '#0E4429', '#006D32', '#26A641', '#39D353'];
