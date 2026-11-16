// 사이드바 ↔ 캘린더 드래그 앤 드롭
// - 길게 눌러(0.25초) 끌기 시작 → 손가락을 따라다니는 고스트 표시 → 놓은 위치의 드롭존이 처리
// - 액션 컨텍스트(고정)와 상태 컨텍스트(바뀜)를 분리해 드래그 도중 제스처가 끊기지 않게 함
import React, { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { readableOn } from '../../lib/color';
import { fmtMin } from '../../lib/date';
import { haptic } from '../ui';

export interface DragPayload {
  kind: string; // 'task' | 'perfItem' | 'block' | 'perfBlock'
  id: string;
  title: string;
  color: string;
  durationMin: number;
  source: 'sidebar' | 'calendar';
  /** 블록 안에서 손가락이 닿은 세로 위치(px) — 옮길 때 위치 보정용 */
  grabY?: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropZone {
  id: string;
  accepts: (p: DragPayload) => boolean;
  measure: () => Promise<Rect | null>;
  onHover?: (p: DragPayload | null, x: number, y: number) => void;
  onDrop: (p: DragPayload, x: number, y: number) => void;
  priority?: number;
}

interface Actions {
  begin: (p: DragPayload, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (x: number, y: number) => void;
  cancel: () => void;
  register: (z: DropZone) => () => void;
}

const ActionsCtx = createContext<Actions | null>(null);
const ActiveCtx = createContext<DragPayload | null>(null);

export const useDragActions = () => {
  const c = useContext(ActionsCtx);
  if (!c) throw new Error('DragProvider 안에서만 사용할 수 있어요');
  return c;
};
export const useDragActive = () => useContext(ActiveCtx);

export const measureView = (v: View | null): Promise<Rect | null> =>
  new Promise((res) => {
    if (!v) return res(null);
    v.measureInWindow((x, y, width, height) => res(width ? { x, y, width, height } : null));
  });

export function DragProvider({
  children,
  onDragStateChange,
}: {
  children: ReactNode;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const [active, setActive] = useState<DragPayload | null>(null);
  const activeRef = useRef<DragPayload | null>(null);
  const zones = useRef(new Map<string, DropZone>());
  const rects = useRef(new Map<string, Rect>());
  const hoverId = useRef<string | null>(null);
  const root = useRef<View>(null);
  const rootOff = useRef({ x: 0, y: 0 });
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cb = useRef(onDragStateChange);
  cb.current = onDragStateChange;

  const hit = (x: number, y: number, p: DragPayload): DropZone | null => {
    let best: DropZone | null = null;
    zones.current.forEach((z, id) => {
      const r = rects.current.get(id);
      if (!r || !z.accepts(p)) return;
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        if (!best || (z.priority || 0) > (best.priority || 0)) best = z;
      }
    });
    return best;
  };

  const measureAll = useCallback(() => {
    root.current?.measureInWindow((x, y) => (rootOff.current = { x, y }));
    zones.current.forEach(async (z, id) => {
      const r = await z.measure();
      if (r) rects.current.set(id, r);
      else rects.current.delete(id);
    });
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      begin(p, x, y) {
        activeRef.current = p;
        pos.setValue({ x: x - rootOff.current.x, y: y - rootOff.current.y });
        setActive(p);
        cb.current?.(true);
        // 사이드바가 닫히는 애니메이션 뒤의 위치까지 다시 측정
        measureAll();
        setTimeout(measureAll, 280);
      },
      move(x, y) {
        const p = activeRef.current;
        if (!p) return;
        pos.setValue({ x: x - rootOff.current.x, y: y - rootOff.current.y });
        const z = hit(x, y, p);
        if (hoverId.current && hoverId.current !== z?.id) zones.current.get(hoverId.current)?.onHover?.(null, x, y);
        hoverId.current = z?.id ?? null;
        z?.onHover?.(p, x, y);
      },
      end(x, y) {
        const p = activeRef.current;
        if (!p) return;
        const z = hit(x, y, p);
        if (hoverId.current) zones.current.get(hoverId.current)?.onHover?.(null, x, y);
        hoverId.current = null;
        activeRef.current = null;
        setActive(null);
        cb.current?.(false);
        if (z) {
          haptic('success');
          z.onDrop(p, x, y);
        }
      },
      cancel() {
        if (!activeRef.current) return;
        if (hoverId.current) zones.current.get(hoverId.current)?.onHover?.(null, 0, 0);
        hoverId.current = null;
        activeRef.current = null;
        setActive(null);
        cb.current?.(false);
      },
      register(z) {
        zones.current.set(z.id, z);
        return () => {
          zones.current.delete(z.id);
          rects.current.delete(z.id);
        };
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <ActionsCtx.Provider value={actions}>
      <ActiveCtx.Provider value={active}>
        <View
          ref={root}
          style={{ flex: 1 }}
          collapsable={false}
          onLayout={() => root.current?.measureInWindow((x, y) => (rootOff.current = { x, y }))}
        >
          {children}
          {active && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: [{ translateX: Animated.add(pos.x, -75) }, { translateY: Animated.add(pos.y, -64) }],
              }}
            >
              <View
                style={{
                  width: 150,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: active.color,
                  opacity: 0.94,
                  shadowColor: '#000',
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 10,
                }}
              >
                <Text numberOfLines={1} style={{ color: readableOn(active.color), fontWeight: '800', fontSize: 13 }}>
                  {active.title}
                </Text>
                <Text style={{ color: readableOn(active.color), opacity: 0.8, fontSize: 11 }}>{fmtMin(active.durationMin)}</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </ActiveCtx.Provider>
    </ActionsCtx.Provider>
  );
}

/** 길게 눌러 끌 수 있는 래퍼. 짧게 탭하면 onTap */
export function Draggable({
  payload,
  children,
  onTap,
  disabled,
  style,
}: {
  payload: DragPayload;
  children: ReactNode;
  onTap?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const actions = useDragActions();
  const pRef = useRef(payload);
  pRef.current = payload;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(!disabled)
      .activateAfterLongPress(250)
      .runOnJS(true)
      .onStart((e) => {
        haptic('medium');
        actions.begin({ ...pRef.current, grabY: e.y }, e.absoluteX, e.absoluteY);
      })
      .onUpdate((e) => actions.move(e.absoluteX, e.absoluteY))
      .onEnd((e) => actions.end(e.absoluteX, e.absoluteY))
      .onFinalize(() => actions.cancel());
    const tap = Gesture.Tap()
      .maxDuration(240)
      .runOnJS(true)
      .onEnd((_e, ok) => {
        if (ok) tapRef.current?.();
      });
    return Gesture.Exclusive(pan, tap);
  }, [actions, disabled]);

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={style}>
        {children}
      </View>
    </GestureDetector>
  );
}
