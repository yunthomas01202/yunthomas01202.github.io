// 일/주/월 캘린더 + 드롭존. 계획 부문과 수행 부문이 함께 사용
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { alpha, darken, readableOn } from '../../lib/color';
import {
  MIN,
  addDays,
  addMonths,
  atMinutes,
  fmtKDate,
  fmtTime,
  fmtYM,
  minutesOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  ymd,
} from '../../lib/date';
import { layoutLanes } from '../../features/planner/logic';
import { IconBtn, Segmented, haptic } from '../ui';
import { DragPayload, Draggable, measureView, useDragActions, useDragActive } from './drag';

export type CalMode = 'day' | 'week' | 'month';

export interface CalBlock {
  id: string;
  kind: 'block' | 'perfBlock';
  title: string;
  subtitle?: string;
  start: number;
  end: number;
  color: string;
  done?: boolean;
  dim?: boolean;
  failed?: boolean;
}

export interface CalAllDay {
  id: string;
  date: string;
  title: string;
  color: string;
}

export interface CalendarBoardProps {
  mode: CalMode;
  onMode: (m: CalMode) => void;
  anchor: Date;
  onAnchor: (d: Date) => void;
  blocks: CalBlock[];
  allDay?: CalAllDay[];
  heat?: Record<string, number>;
  rangeStart?: string;
  rangeEnd?: string;
  dayStartHour: number;
  dayEndHour: number;
  weekStartsOn: 0 | 1;
  acceptKinds: string[];
  onDropNew: (p: DragPayload, start: number | null, day: string) => void;
  onMoveBlock: (id: string, kind: string, start: number | null, day: string) => void;
  onResizeBlock: (id: string, kind: string, end: number) => void;
  onPressBlock: (id: string, kind: string) => void;
  onPressDay?: (day: string) => void;
  onPressAllDay?: (id: string) => void;
  onPressSlot?: (start: number, day: string) => void;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  banner?: ReactNode;
}

const GUTTER = 40;

export function CalendarBoard(props: CalendarBoardProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const { mode, anchor, weekStartsOn } = props;

  const days = useMemo(() => {
    if (mode === 'day') return [startOfDay(anchor)];
    if (mode === 'week') {
      const s = startOfWeek(anchor, weekStartsOn);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    return [];
  }, [mode, anchor, weekStartsOn]);

  const shift = (dir: number) => {
    haptic();
    if (mode === 'day') props.onAnchor(addDays(anchor, dir));
    else if (mode === 'week') props.onAnchor(addDays(anchor, dir * 7));
    else props.onAnchor(addMonths(anchor, dir));
  };

  const title =
    mode === 'day'
      ? fmtKDate(anchor)
      : mode === 'week'
        ? `${days[0].getMonth() + 1}월 ${days[0].getDate()}일 – ${days[6].getMonth() + 1}월 ${days[6].getDate()}일`
        : fmtYM(anchor);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 2 }}>
        {props.headerLeft}
        <IconBtn name="chevron-back" size={20} onPress={() => shift(-1)} />
        <Pressable onPress={() => props.onAnchor(new Date())} style={{ flexShrink: 1 }}>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: wide ? 18 : 15 }} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
        <IconBtn name="chevron-forward" size={20} onPress={() => shift(1)} />
        <View style={{ flex: 1 }} />
        <Segmented
          style={{ width: wide ? 200 : 132 }}
          value={mode}
          onChange={props.onMode}
          options={[
            { value: 'day', label: '일' },
            { value: 'week', label: '주' },
            { value: 'month', label: '월' },
          ]}
        />
        {props.headerRight}
      </View>
      {props.banner}
      {mode === 'month' ? <MonthGrid {...props} /> : <TimeGrid {...props} days={days} ppm={wide ? 1.15 : 0.95} />}
    </View>
  );
}

/* ───────────────────────── 일/주 시간표 ───────────────────────── */

function TimeGrid(props: CalendarBoardProps & { days: Date[]; ppm: number }) {
  const t = useTheme();
  const { days, ppm, blocks } = props;
  const actions = useDragActions();
  const active = useDragActive();
  const viewport = useRef<View>(null);
  const scrollRef = useRef<any>(null);
  const scrollY = useRef(0);
  const vpRect = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const edge = useRef(0);
  const [vw, setVw] = useState(0);
  const [preview, setPreview] = useState<{ col: number; startMin: number; dur: number; color: string } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; end: number } | null>(null);

  const startMin = props.dayStartHour * 60;
  const endMin = Math.max(startMin + 60, Math.min(24 * 60, props.dayEndHour * 60));
  const totalH = (endMin - startMin) * ppm;
  const colW = vw > 0 ? (vw - GUTTER) / days.length : 0;

  // 최신 값을 드롭존 콜백에서 쓰기 위한 ref
  const live = useRef({ props, days, colW, startMin, endMin, ppm });
  live.current = { props, days, colW, startMin, endMin, ppm };

  const locate = (x: number, y: number, grabY = 0) => {
    const r = vpRect.current;
    const L = live.current;
    if (!r || !L.colW) return null;
    const col = Math.floor((x - r.x - GUTTER) / L.colW);
    if (col < 0 || col >= L.days.length) return null;
    const ly = y - r.y + scrollY.current - grabY;
    let m = L.startMin + ly / L.ppm;
    m = Math.round(m / 15) * 15;
    return { col, min: Math.max(L.startMin, Math.min(L.endMin - 15, m)) };
  };

  useEffect(
    () =>
      actions.register({
        id: 'timegrid',
        accepts: (p) =>
          p.source === 'calendar' ? p.kind === 'block' || p.kind === 'perfBlock' : live.current.props.acceptKinds.includes(p.kind),
        measure: async () => {
          const r = await measureView(viewport.current);
          vpRect.current = r;
          return r;
        },
        onHover: (p, x, y) => {
          if (!p) {
            setPreview(null);
            edge.current = 0;
            return;
          }
          const r = vpRect.current;
          if (r) edge.current = y < r.y + 46 ? -1 : y > r.y + r.height - 46 ? 1 : 0;
          const loc = locate(x, y, p.source === 'calendar' ? p.grabY || 0 : 0);
          if (!loc) return setPreview(null);
          setPreview((prev) =>
            prev && prev.col === loc.col && prev.startMin === loc.min
              ? prev
              : { col: loc.col, startMin: loc.min, dur: p.durationMin, color: p.color },
          );
        },
        onDrop: (p, x, y) => {
          setPreview(null);
          edge.current = 0;
          const loc = locate(x, y, p.source === 'calendar' ? p.grabY || 0 : 0);
          if (!loc) return;
          const day = live.current.days[loc.col];
          const start = atMinutes(day, loc.min);
          if (p.source === 'calendar') live.current.props.onMoveBlock(p.id, p.kind, start, ymd(day));
          else live.current.props.onDropNew(p, start, ymd(day));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions],
  );

  // 드래그 중 위/아래 가장자리에 손가락을 두면 자동 스크롤
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      if (!edge.current) return;
      const max = Math.max(0, totalH - (vpRect.current?.height || 0) + 20);
      scrollY.current = Math.max(0, Math.min(max, scrollY.current + edge.current * 9));
      scrollRef.current?.scrollTo({ y: scrollY.current, animated: false });
    }, 30);
    return () => clearInterval(iv);
  }, [active, totalH]);

  // 처음 열 때 지금 시간(또는 오전 8시) 근처로 스크롤
  const firstKey = ymd(days[0]);
  useEffect(() => {
    const todayIn = days.some((d) => ymd(d) === ymd());
    const target = todayIn ? minutesOfDay(Date.now()) - 90 : 8 * 60;
    const y = Math.max(0, (target - startMin) * ppm);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, days.length]);

  const today = ymd();
  const nowMin = minutesOfDay(Date.now());
  const hours: number[] = [];
  for (let h = Math.ceil(startMin / 60); h * 60 <= endMin; h++) hours.push(h);

  const byDay = useMemo(() => {
    const m: Record<string, CalBlock[]> = {};
    for (const b of blocks) {
      const k = ymd(b.start);
      (m[k] ||= []).push(b);
    }
    return m;
  }, [blocks]);

  const allDayByDay = useMemo(() => {
    const m: Record<string, CalAllDay[]> = {};
    for (const a of props.allDay || []) (m[a.date] ||= []).push(a);
    return m;
  }, [props.allDay]);

  const hasAllDay = days.some((d) => allDayByDay[ymd(d)]?.length);

  return (
    <View style={{ flex: 1 }}>
      {/* 날짜 머리줄 */}
      <View style={{ flexDirection: 'row', paddingLeft: GUTTER, borderBottomWidth: 1, borderColor: t.border }}>
        {days.map((d) => {
          const k = ymd(d);
          const isT = k === today;
          const out = props.rangeStart && props.rangeEnd && (k < props.rangeStart || k > props.rangeEnd);
          return (
            <Pressable
              key={k}
              onPress={() => props.onPressDay?.(k)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 4, opacity: out ? 0.45 : 1 }}
            >
              <Text style={{ fontSize: 11, color: d.getDay() === 0 ? t.danger : t.textSub }}>
                {['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}
              </Text>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isT ? t.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontWeight: '800', color: isT ? '#fff' : t.text }}>{d.getDate()}</Text>
              </View>
              {props.heat && props.heat[k] !== undefined && props.heat[k] >= 0 && k <= today ? (
                <View style={{ width: 16, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: t.heat[props.heat[k]] }} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {hasAllDay && (
        <View style={{ flexDirection: 'row', paddingLeft: GUTTER, borderBottomWidth: 1, borderColor: t.border, paddingVertical: 3 }}>
          {days.map((d) => (
            <View key={ymd(d)} style={{ flex: 1, paddingHorizontal: 1, gap: 2 }}>
              {(allDayByDay[ymd(d)] || []).slice(0, 3).map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => props.onPressAllDay?.(a.id)}
                  style={{ backgroundColor: a.color, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}
                >
                  <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: readableOn(a.color) }}>
                    {a.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      <View ref={viewport} collapsable={false} style={{ flex: 1 }} onLayout={(e) => setVw(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollRef}
          scrollEventThrottle={16}
          onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          contentContainerStyle={{ height: totalH + 24 }}
        >
          <View style={{ height: totalH, marginTop: 10, flexDirection: 'row' }}>
            {/* 시간 눈금 */}
            <View style={{ width: GUTTER }}>
              {hours.map((h) => (
                <Text
                  key={h}
                  style={{
                    position: 'absolute',
                    top: (h * 60 - startMin) * ppm - 7,
                    right: 6,
                    fontSize: 10,
                    color: t.textFaint,
                  }}
                >
                  {h === 24 ? '24' : h}
                </Text>
              ))}
            </View>
            {days.map((d, col) => {
              const k = ymd(d);
              const list = byDay[k] || [];
              const lanes = layoutLanes(
                list.map((b) => ({ id: b.id, start: b.start, end: resizing?.id === b.id ? resizing.end : b.end })),
              );
              const out = props.rangeStart && props.rangeEnd && (k < props.rangeStart || k > props.rangeEnd);
              return (
                <Pressable
                  key={k}
                  onPress={(e) => {
                    if (!props.onPressSlot) return;
                    let m = startMin + e.nativeEvent.locationY / ppm;
                    m = Math.floor(m / 15) * 15;
                    props.onPressSlot(atMinutes(d, m), k);
                  }}
                  style={{
                    flex: 1,
                    borderLeftWidth: 1,
                    borderColor: t.border,
                    backgroundColor: out ? alpha(t.textFaint, 0.07) : k === today ? alpha(t.primary, 0.03) : 'transparent',
                  }}
                >
                  {hours.map((h) => (
                    <View
                      key={h}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: (h * 60 - startMin) * ppm,
                        left: 0,
                        right: 0,
                        height: 1,
                        backgroundColor: t.border,
                        opacity: 0.7,
                      }}
                    />
                  ))}
                  {list.map((b) => {
                    const end = resizing?.id === b.id ? resizing.end : b.end;
                    const s = Math.max(startMin, minutesOfDay(b.start));
                    const eMin = Math.min(endMin, ymd(end) !== k ? 24 * 60 : minutesOfDay(end));
                    const top = (s - startMin) * ppm;
                    const height = Math.max(18, (eMin - s) * ppm - 2);
                    const ln = lanes[b.id] || { lane: 0, lanes: 1 };
                    const w = colW ? (colW - 4) / ln.lanes : 0;
                    return (
                      <BlockView
                        key={b.id}
                        b={{ ...b, end }}
                        top={top}
                        height={height}
                        left={2 + ln.lane * w}
                        width={Math.max(0, w - 1)}
                        ppm={ppm}
                        hidden={active?.source === 'calendar' && active.id === b.id}
                        onPress={() => props.onPressBlock(b.id, b.kind)}
                        onResizing={(newEnd) => setResizing(newEnd === null ? null : { id: b.id, end: newEnd })}
                        onResizeEnd={(newEnd) => props.onResizeBlock(b.id, b.kind, newEnd)}
                      />
                    );
                  })}
                  {k === today && nowMin >= startMin && nowMin <= endMin && (
                    <View
                      pointerEvents="none"
                      style={{ position: 'absolute', left: -4, right: 0, top: (nowMin - startMin) * ppm, height: 2, backgroundColor: t.danger }}
                    >
                      <View style={{ position: 'absolute', left: 0, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: t.danger }} />
                    </View>
                  )}
                  {preview && preview.col === col && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: 2,
                        right: 2,
                        top: (preview.startMin - startMin) * ppm,
                        height: Math.max(18, preview.dur * ppm),
                        borderRadius: 8,
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        borderColor: preview.color,
                        backgroundColor: alpha(preview.color, 0.18),
                        padding: 3,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: t.text }}>
                        {fmtTime(atMinutes(d, preview.startMin))}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function BlockView({
  b,
  top,
  height,
  left,
  width,
  ppm,
  hidden,
  onPress,
  onResizing,
  onResizeEnd,
}: {
  b: CalBlock;
  top: number;
  height: number;
  left: number;
  width: number;
  ppm: number;
  hidden: boolean;
  onPress: () => void;
  onResizing: (end: number | null) => void;
  onResizeEnd: (end: number) => void;
}) {
  const t = useTheme();
  const fg = readableOn(b.color);
  const dur = Math.round((b.end - b.start) / MIN);
  const latest = useRef({ b, ppm, onResizing, onResizeEnd });
  latest.current = { b, ppm, onResizing, onResizeEnd };
  const pending = useRef<number | null>(null);

  const resize = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(120)
        .runOnJS(true)
        .onStart(() => haptic('medium'))
        .onUpdate((e) => {
          const L = latest.current;
          const raw = L.b.end + (e.translationY / L.ppm) * MIN;
          const snapped = Math.max(L.b.start + 15 * MIN, Math.round(raw / (15 * MIN)) * 15 * MIN);
          if (snapped !== pending.current) {
            pending.current = snapped;
            L.onResizing(snapped);
          }
        })
        .onEnd(() => {
          if (pending.current) latest.current.onResizeEnd(pending.current);
        })
        .onFinalize(() => {
          pending.current = null;
          latest.current.onResizing(null);
        }),
    [],
  );

  const payload: DragPayload = {
    kind: b.kind,
    id: b.id,
    title: b.title,
    color: b.color,
    durationMin: dur,
    source: 'calendar',
  };

  return (
    <View style={{ position: 'absolute', top, left, width, height, opacity: hidden ? 0.25 : 1 }}>
      <Draggable payload={payload} onTap={onPress} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: b.color,
            borderRadius: 7,
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderLeftWidth: 3,
            borderLeftColor: darken(b.color, 0.25),
            opacity: b.dim ? 0.3 : b.done ? 0.55 : 1,
            borderWidth: b.failed ? 2 : 0,
            borderColor: b.failed ? t.danger : undefined,
            overflow: 'hidden',
          }}
        >
          <Text
            numberOfLines={height > 44 ? 3 : 1}
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: fg,
              textDecorationLine: b.done ? 'line-through' : 'none',
            }}
          >
            {b.done ? '✓ ' : b.failed ? '! ' : ''}
            {b.title}
          </Text>
          {height > 36 && (
            <Text style={{ fontSize: 9, color: fg, opacity: 0.85 }} numberOfLines={1}>
              {fmtTime(b.start)}–{fmtTime(b.end)}
              {b.subtitle ? ` · ${b.subtitle}` : ''}
            </Text>
          )}
        </View>
      </Draggable>
      {height >= 26 && (
        <GestureDetector gesture={resize}>
          <View
            collapsable={false}
            style={{ position: 'absolute', left: 0, right: 0, bottom: -4, height: 14, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: alpha(fg, 0.7) }} />
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

/* ───────────────────────── 월간 ───────────────────────── */

function MonthGrid(props: CalendarBoardProps) {
  const t = useTheme();
  const actions = useDragActions();
  const gridRef = useRef<View>(null);
  const rect = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const month = startOfMonth(props.anchor);
  const start = startOfWeek(month, props.weekStartsOn);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(start, i)), [start.getTime()]); // eslint-disable-line
  const live = useRef({ props, cells });
  live.current = { props, cells };

  const locate = (x: number, y: number) => {
    const r = rect.current;
    if (!r) return null;
    const col = Math.floor(((x - r.x) / r.width) * 7);
    const row = Math.floor(((y - r.y) / r.height) * 6);
    if (col < 0 || col > 6 || row < 0 || row > 5) return null;
    return row * 7 + col;
  };

  useEffect(
    () =>
      actions.register({
        id: 'monthgrid',
        accepts: (p) =>
          p.source === 'calendar' ? p.kind === 'block' || p.kind === 'perfBlock' : live.current.props.acceptKinds.includes(p.kind),
        measure: async () => {
          const r = await measureView(gridRef.current);
          rect.current = r;
          return r;
        },
        onHover: (p, x, y) => setHover(p ? locate(x, y) : null),
        onDrop: (p, x, y) => {
          setHover(null);
          const i = locate(x, y);
          if (i === null) return;
          const day = ymd(live.current.cells[i]);
          if (p.source === 'calendar') live.current.props.onMoveBlock(p.id, p.kind, null, day);
          else live.current.props.onDropNew(p, null, day);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions],
  );

  const byDay = useMemo(() => {
    const m: Record<string, CalBlock[]> = {};
    for (const b of props.blocks) (m[ymd(b.start)] ||= []).push(b);
    Object.values(m).forEach((l) => l.sort((a, b) => a.start - b.start));
    return m;
  }, [props.blocks]);
  const allDayBy = useMemo(() => {
    const m: Record<string, CalAllDay[]> = {};
    for (const a of props.allDay || []) (m[a.date] ||= []).push(a);
    return m;
  }, [props.allDay]);

  const heads = props.weekStartsOn === 1 ? ['월', '화', '수', '목', '금', '토', '일'] : ['일', '월', '화', '수', '목', '금', '토'];
  const today = ymd();

  return (
    <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {heads.map((h) => (
          <Text key={h} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: t.textSub, paddingVertical: 4 }}>
            {h}
          </Text>
        ))}
      </View>
      <View ref={gridRef} collapsable={false} style={{ flex: 1 }}>
        {Array.from({ length: 6 }, (_, row) => (
          <View key={row} style={{ flex: 1, flexDirection: 'row' }}>
            {cells.slice(row * 7, row * 7 + 7).map((d, ci) => {
              const i = row * 7 + ci;
              const k = ymd(d);
              const inMonth = d.getMonth() === month.getMonth();
              const lv = props.heat?.[k];
              const out = props.rangeStart && props.rangeEnd && (k < props.rangeStart || k > props.rangeEnd);
              const items = [
                ...(allDayBy[k] || []).map((a) => ({ id: a.id, title: a.title, color: a.color, done: false, all: true })),
                ...(byDay[k] || []).map((b) => ({ ...b, all: false })),
              ];
              const heatBg = lv !== undefined && lv > 0 && k <= today ? alpha(t.heat[lv], t.dark ? 0.55 : 0.65) : undefined;
              return (
                <Pressable
                  key={k}
                  onPress={() => props.onPressDay?.(k)}
                  style={{
                    flex: 1,
                    margin: 1,
                    borderRadius: 8,
                    padding: 2,
                    backgroundColor: hover === i ? alpha(t.primary, 0.2) : heatBg || (t.dark ? t.surface : t.surface),
                    opacity: inMonth ? (out ? 0.5 : 1) : 0.35,
                    borderWidth: k === today ? 1.5 : 0,
                    borderColor: t.primary,
                    overflow: 'hidden',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: d.getDay() === 0 ? t.danger : t.text,
                      marginLeft: 2,
                    }}
                  >
                    {d.getDate()}
                  </Text>
                  {items.slice(0, 3).map((it) =>
                    it.all ? (
                      <View key={it.id} style={{ backgroundColor: it.color, borderRadius: 3, paddingHorizontal: 2, marginTop: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '700', color: readableOn(it.color) }}>
                          {it.title}
                        </Text>
                      </View>
                    ) : (
                      <Draggable
                        key={it.id}
                        payload={{
                          kind: (it as CalBlock).kind,
                          id: it.id,
                          title: it.title,
                          color: it.color,
                          durationMin: Math.round(((it as CalBlock).end - (it as CalBlock).start) / MIN),
                          source: 'calendar',
                        }}
                        onTap={() => props.onPressBlock(it.id, (it as CalBlock).kind)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 }}>
                          <View style={{ width: 3, height: 10, borderRadius: 2, backgroundColor: it.color }} />
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 9,
                              color: t.text,
                              flex: 1,
                              textDecorationLine: it.done ? 'line-through' : 'none',
                              opacity: it.done ? 0.5 : 1,
                            }}
                          >
                            {it.title}
                          </Text>
                        </View>
                      </Draggable>
                    ),
                  )}
                  {items.length > 3 && <Text style={{ fontSize: 9, color: t.textSub, marginLeft: 2 }}>+{items.length - 3}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────────────────── 사이드바 + 본문 레이아웃 ───────────────────────── */

/**
 * 태블릿: 왼쪽에 고정 사이드바 (클로드 화면의 대화 목록처럼)
 * 휴대폰: 왼쪽에서 열리는 서랍. 할 일을 길게 눌러 끌기 시작하면 서랍이 자동으로 닫혀 캘린더가 보임
 */
export function SplitLayout({
  sidebar,
  children,
  open,
  onClose,
  sidebarWidth = 310,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  sidebarWidth?: number;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const drawerW = Math.min(340, width * 0.86);
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [open, anim]);

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: sidebarWidth, borderRightWidth: 1, borderColor: t.border, backgroundColor: t.surface }}>{sidebar}</View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {children}
      {open && (
        <Pressable onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
      )}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: drawerW,
          backgroundColor: t.surface,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          overflow: 'hidden',
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-drawerW - 10, 0] }) }],
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        {sidebar}
      </Animated.View>
    </View>
  );
}

export function SidebarToggle({ onPress, count }: { onPress: () => void; count?: number }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  if (width >= 820) return null;
  return (
    <Pressable onPress={onPress} style={{ padding: 6, flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name="list" size={24} color={t.text} />
      {count ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: t.danger,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
