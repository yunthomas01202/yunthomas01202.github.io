// 시각화: 잔디 히트맵, 헥사곤 스탯, 막대 그래프, 링, 하루 타임라인
import React, { ReactNode, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';
import { addDays, startOfWeek, ymd } from '../lib/date';
import { alpha } from '../lib/color';
import { T } from './ui';

/* ───────── 깃허브식 잔디 히트맵 ───────── */

export function Heatmap({
  levels,
  weeks = 20,
  cell = 14,
  gap = 3,
  weekStartsOn = 1,
  onPressDay,
  selected,
}: {
  levels: Record<string, number>; // ymd → 0~4 (-1 = 기록 없음)
  weeks?: number;
  cell?: number;
  gap?: number;
  weekStartsOn?: 0 | 1;
  onPressDay?: (d: string) => void;
  selected?: string | null;
}) {
  const t = useTheme();
  const cols = useMemo(() => {
    const thisWeek = startOfWeek(new Date(), weekStartsOn);
    const first = addDays(thisWeek, -7 * (weeks - 1));
    return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
  }, [weeks, weekStartsOn]);
  const today = ymd();
  const dayLabels = weekStartsOn === 1 ? ['월', '', '수', '', '금', '', ''] : ['', '월', '', '수', '', '금', ''];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: 10000, y: 0 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginRight: 4, paddingTop: 16 }}>
            {dayLabels.map((l, i) => (
              <Text key={i} style={{ height: cell + gap, fontSize: 10, color: t.textFaint, lineHeight: cell }}>
                {l}
              </Text>
            ))}
          </View>
          {cols.map((col, wi) => {
            const first = col[0];
            const showMonth = first.getDate() <= 7;
            return (
              <View key={wi} style={{ marginRight: gap }}>
                <Text style={{ height: 16, fontSize: 10, color: t.textFaint, width: cell + 20 }}>
                  {showMonth ? `${first.getMonth() + 1}월` : ''}
                </Text>
                {col.map((d) => {
                  const k = ymd(d);
                  const future = k > today;
                  const lv = levels[k];
                  const bg = future ? 'transparent' : lv === undefined || lv < 0 ? t.heat[0] : t.heat[lv];
                  return (
                    <Pressable
                      key={k}
                      disabled={!onPressDay || future}
                      onPress={() => onPressDay?.(k)}
                      style={{
                        width: cell,
                        height: cell,
                        marginBottom: gap,
                        borderRadius: 3,
                        backgroundColor: bg,
                        borderWidth: k === selected || k === today ? 1.5 : 0,
                        borderColor: k === selected ? t.text : t.primary,
                      }}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 6 }}>
        <T size={11} faint>
          적음
        </T>
        {t.heat.map((c, i) => (
          <View key={i} style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: c }} />
        ))}
        <T size={11} faint>
          많음
        </T>
      </View>
    </View>
  );
}

/* ───────── 헥사곤(육각형) 스탯 ───────── */

export function HexRadar({
  axes,
  size = 260,
  color,
}: {
  axes: { label: string; value: number; sub?: string }[]; // value 0~1
  size?: number;
  color?: string;
}) {
  const t = useTheme();
  const c = color || t.primary;
  const n = axes.length || 6;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.33;
  const pt = (i: number, k: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  };
  const ring = (k: number) =>
    Array.from({ length: n }, (_, i) => pt(i, k))
      .map((p) => p.join(','))
      .join(' ');
  const poly = axes.map((a, i) => pt(i, Math.max(0.04, Math.min(1, a.value))).join(',')).join(' ');

  return (
    <Svg width={size} height={size}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <Polygon key={k} points={ring(k)} fill={k === 1 ? alpha(c, 0.04) : 'none'} stroke={t.border} strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={t.border} strokeWidth={1} />;
      })}
      <Polygon points={poly} fill={alpha(c, 0.3)} stroke={c} strokeWidth={2.5} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, Math.max(0.04, Math.min(1, a.value)));
        return <Circle key={i} cx={x} cy={y} r={4} fill={c} />;
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.28);
        return (
          <G key={'l' + i}>
            <SvgText x={x} y={y - 2} fontSize={13} fontWeight="800" fill={t.text} textAnchor="middle">
              {a.label}
            </SvgText>
            {a.sub ? (
              <SvgText x={x} y={y + 13} fontSize={11} fontWeight="600" fill={c} textAnchor="middle">
                {a.sub}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

/* ───────── 원형 진행률 ───────── */

export function Ring({
  size = 120,
  stroke = 12,
  progress,
  color,
  track,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const t = useTheme();
  const rr = (size - stroke) / 2;
  const circ = 2 * Math.PI * rr;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={rr} stroke={track || t.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={rr}
          stroke={color || t.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - p)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ───────── 막대 그래프 (누적 가능) ───────── */

export function BarChart({
  labels,
  series,
  height = 160,
  format,
  highlight,
  goal,
}: {
  labels: string[];
  series: { color: string; values: number[] }[];
  height?: number;
  format?: (v: number) => string;
  highlight?: number;
  goal?: number;
}) {
  const t = useTheme();
  const totals = labels.map((_, i) => series.reduce((s, se) => s + (se.values[i] || 0), 0));
  const max = Math.max(1, goal || 0, ...totals) * 1.12;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {goal ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (goal / max) * height,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: t.danger,
            }}
          />
        ) : null}
        {labels.map((l, i) => (
          <View key={l + i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            {totals[i] > 0 && (
              <Text style={{ fontSize: 9, color: t.textSub, marginBottom: 2 }} numberOfLines={1}>
                {format ? format(totals[i]) : Math.round(totals[i])}
              </Text>
            )}
            <View
              style={{
                width: '72%',
                height: (totals[i] / max) * (height - 16),
                borderRadius: 6,
                overflow: 'hidden',
                flexDirection: 'column-reverse',
                backgroundColor: totals[i] ? undefined : 'transparent',
                opacity: highlight === undefined || highlight === i ? 1 : 0.55,
              }}
            >
              {series.map((se, si) => (
                <View
                  key={si}
                  style={{ height: totals[i] ? `${((se.values[i] || 0) / totals[i]) * 100}%` : 0, backgroundColor: se.color }}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
        {labels.map((l, i) => (
          <Text
            key={l + i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 11,
              color: highlight === i ? t.text : t.textFaint,
              fontWeight: highlight === i ? '800' : '500',
            }}
            numberOfLines={1}
          >
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ───────── 하루 24시간 공부 타임라인 (열품타 스타일) ───────── */

export function DayTimeline({
  day,
  segments,
}: {
  day: string; // ymd
  segments: { start: number; end: number; color: string }[];
}) {
  const t = useTheme();
  const base = new Date(day + 'T00:00:00').getTime();
  const rows = Array.from({ length: 24 }, (_, h) => h);
  return (
    <View>
      {rows.map((h) => {
        const hs = base + h * 3_600_000;
        const he = hs + 3_600_000;
        const parts = segments
          .filter((s) => s.end > hs && s.start < he)
          .map((s) => ({
            left: (Math.max(s.start, hs) - hs) / 3_600_000,
            width: (Math.min(s.end, he) - Math.max(s.start, hs)) / 3_600_000,
            color: s.color,
          }));
        return (
          <View key={h} style={{ flexDirection: 'row', alignItems: 'center', height: 13, marginBottom: 2 }}>
            <Text style={{ width: 22, fontSize: 9, color: t.textFaint }}>{h}</Text>
            <View style={{ flex: 1, height: 10, backgroundColor: t.surface2, borderRadius: 3, overflow: 'hidden' }}>
              {parts.map((p, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${p.left * 100}%`,
                    width: `${Math.max(p.width * 100, 0.8)}%`,
                    top: 0,
                    bottom: 0,
                    backgroundColor: p.color,
                  }}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

