// 수행/세특 캘린더: 왼쪽 상위/하위 항목을 끌어 캘린더에 작업 블록으로 배치 + 날짜별 특별 일정
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '../../src/theme';
import { add, getState, remove, update, useData, useList } from '../../src/lib/store';
import type { PerfBlock, PerfCategory, PerfEvent, PerfItem } from '../../src/lib/types';
import { energyShade, readableOn } from '../../src/lib/color';
import { MIN, atMinutes, daysUntil, ddayLabel, fmtKDate, fmtMin, fmtTime, parseYmd, ymd } from '../../src/lib/date';
import { Badge, Btn, Dot, IconBtn, Label, Row, Sheet, Stepper, T, haptic, toast } from '../../src/components/ui';
import { CalendarBoard, CalBlock, CalMode, SidebarToggle, SplitLayout } from '../../src/components/calendar/CalendarBoard';
import { DragProvider, Draggable, measureView, useDragActions } from '../../src/components/calendar/drag';
import { CategoryEditor, EventEditor, ItemEditor, itemColor } from '../../src/features/perf/components';
import { findFreeSlot } from '../../src/features/planner/logic';

export default function PerfCalendar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const settings = useData((s) => s.settings);
  const cats = useData((s) => s.perfCategories);
  const itemsMap = useData((s) => s.perfItems);
  const blocksList = useList('perfBlocks');
  const events = useList('events');
  const items = useList('perfItems');

  const [mode, setMode] = useState<CalMode>(width >= 820 ? 'week' : 'month');
  const [anchor, setAnchor] = useState(new Date());
  const [drawer, setDrawer] = useState(false);
  const [placing, setPlacing] = useState<PerfItem | null>(null);
  const [blockSheet, setBlockSheet] = useState<string | null>(null);
  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [eventEdit, setEventEdit] = useState<{ open: boolean; event: PerfEvent | null; date?: string }>({ open: false, event: null });
  const [catEdit, setCatEdit] = useState<{ open: boolean; cat: PerfCategory | null }>({ open: false, cat: null });
  const [itemEdit, setItemEdit] = useState<{ open: boolean; item: PerfItem | null; categoryId?: string }>({ open: false, item: null });

  const blocks: CalBlock[] = useMemo(
    () =>
      blocksList
        .filter((b) => itemsMap[b.itemId])
        .map((b) => {
          const it = itemsMap[b.itemId];
          return {
            id: b.id,
            kind: 'perfBlock' as const,
            title: it.title,
            subtitle: cats[it.categoryId]?.name,
            start: b.start,
            end: b.end,
            color: energyShade(itemColor(it, cats), it.energy),
            done: b.done,
          };
        }),
    [blocksList, itemsMap, cats],
  );

  const allDay = useMemo(
    () => [
      ...events.map((e) => ({ id: 'e:' + e.id, date: e.date, title: (e.startMin != null ? fmtTime(atMinutes(e.date, e.startMin)) + ' ' : '') + e.title, color: e.color })),
      ...items.filter((i) => i.dueDate && i.status !== 'done').map((i) => ({ id: 'd:' + i.id, date: i.dueDate!, title: `⏰ ${i.title}`, color: itemColor(i, cats) })),
    ],
    [events, items, cats],
  );

  const placeOnDay = (itemId: string, day: string) => {
    const it = getState().perfItems[itemId];
    if (!it) return;
    const busy = [
      ...Object.values(getState().perfBlocks).map((b) => [b.start, b.end] as [number, number]),
      ...Object.values(getState().tasks).filter((x) => x.start && x.end).map((x) => [x.start!, x.end!] as [number, number]),
    ];
    const s = findFreeSlot(day, it.estMin, busy, settings, { preferFrom: 18 * 60, preferTo: 23 * 60 });
    if (s === null) return toast('그 날엔 빈 시간이 없어요');
    add('perfBlocks', { itemId, start: s, end: s + it.estMin * MIN, done: false });
    if (it.status === 'todo') update('perfItems', itemId, { status: 'doing' });
    toast(`${fmtKDate(day, false)} ${fmtTime(s)}에 배치했어요`);
  };

  const placeAt = (itemId: string, start: number) => {
    const it = getState().perfItems[itemId];
    if (!it) return;
    add('perfBlocks', { itemId, start, end: start + it.estMin * MIN, done: false });
    if (it.status === 'todo') update('perfItems', itemId, { status: 'doing' });
  };

  const moveBlock = (id: string, start: number | null, day: string) => {
    const b = getState().perfBlocks[id];
    if (!b) return;
    const dur = b.end - b.start;
    if (start === null) {
      const keep = new Date(b.start);
      const d = parseYmd(day);
      d.setHours(keep.getHours(), keep.getMinutes(), 0, 0);
      start = d.getTime();
    }
    update('perfBlocks', id, { start, end: start + dur });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <DragProvider onDragStateChange={(d) => d && setDrawer(false)}>
        <SplitLayout
          open={drawer}
          onClose={() => setDrawer(false)}
          sidebar={
            <ItemSidebar
              onPick={(it) => {
                setPlacing(it);
                setDrawer(false);
                toast('캘린더에서 넣을 칸(월간은 날짜)을 탭하세요');
              }}
              onAddCat={() => setCatEdit({ open: true, cat: null })}
              onEditCat={(c) => setCatEdit({ open: true, cat: c })}
              onAddItem={(cid) => setItemEdit({ open: true, item: null, categoryId: cid })}
            />
          }
        >
          <CalendarBoard
            mode={mode}
            onMode={setMode}
            anchor={anchor}
            onAnchor={setAnchor}
            blocks={blocks}
            allDay={allDay}
            dayStartHour={settings.dayStartHour}
            dayEndHour={settings.dayEndHour}
            weekStartsOn={settings.weekStartsOn}
            acceptKinds={['perfItem']}
            onDropNew={(p, start, day) => (start ? placeAt(p.id, start) : placeOnDay(p.id, day))}
            onMoveBlock={(id, _k, start, day) => moveBlock(id, start, day)}
            onResizeBlock={(id, _k, end) => {
              const b = getState().perfBlocks[id];
              if (b) update('perfBlocks', id, { end: Math.max(b.start + 15 * MIN, end) });
            }}
            onPressBlock={(id) => setBlockSheet(id)}
            onPressAllDay={(aid) => {
              if (aid.startsWith('e:')) setEventEdit({ open: true, event: getState().events[aid.slice(2)] || null });
              else router.push(`/perf/item/${aid.slice(2)}`);
            }}
            onPressDay={(day) => {
              if (placing && mode === 'month') {
                placeOnDay(placing.id, day);
                setPlacing(null);
                return;
              }
              setDaySheet(day);
            }}
            onPressSlot={(start) => {
              if (!placing) return;
              placeAt(placing.id, start);
              toast(`${fmtTime(start)}에 '${placing.title}' 배치`);
              setPlacing(null);
            }}
            headerLeft={
              <Row gap={0}>
                <IconBtn name="chevron-back" size={22} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
                <SidebarToggle onPress={() => setDrawer(true)} />
              </Row>
            }
            headerRight={<IconBtn name="add-circle-outline" size={22} onPress={() => setEventEdit({ open: true, event: null, date: ymd(anchor) })} />}
            banner={
              placing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.section.perf, marginHorizontal: 8, borderRadius: 12, padding: 8, marginBottom: 4 }}>
                  <Ionicons name="hand-left" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', flex: 1, marginLeft: 8 }} numberOfLines={1}>
                    '{placing.title}' 넣을 곳을 탭하세요
                  </Text>
                  <Pressable onPress={() => setPlacing(null)}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>취소</Text>
                  </Pressable>
                </View>
              ) : null
            }
          />
        </SplitLayout>
      </DragProvider>

      <PerfBlockSheet id={blockSheet} onClose={() => setBlockSheet(null)} />
      <DaySheet
        day={daySheet}
        onClose={() => setDaySheet(null)}
        onAddEvent={(d) => {
          setDaySheet(null);
          setTimeout(() => setEventEdit({ open: true, event: null, date: d }), 300);
        }}
        onEditEvent={(e) => {
          setDaySheet(null);
          setTimeout(() => setEventEdit({ open: true, event: e }), 300);
        }}
        onOpenDay={(d) => {
          setDaySheet(null);
          setAnchor(parseYmd(d));
          setMode('day');
        }}
      />
      <EventEditor visible={eventEdit.open} event={eventEdit.event} date={eventEdit.date} onClose={() => setEventEdit({ open: false, event: null })} />
      <CategoryEditor visible={catEdit.open} cat={catEdit.cat} onClose={() => setCatEdit({ open: false, cat: null })} />
      <ItemEditor visible={itemEdit.open} item={itemEdit.item} categoryId={itemEdit.categoryId} onClose={() => setItemEdit({ open: false, item: null })} />
    </View>
  );
}

/* ───────── 왼쪽: 상위/하위 항목 ───────── */

function ItemSidebar({
  onPick,
  onAddCat,
  onEditCat,
  onAddItem,
}: {
  onPick: (i: PerfItem) => void;
  onAddCat: () => void;
  onEditCat: (c: PerfCategory) => void;
  onAddItem: (catId: string) => void;
}) {
  const t = useTheme();
  const actions = useDragActions();
  const root = useRef<View>(null);
  const cats = useList('perfCategories').sort((a, b) => a.order - b.order);
  const catsMap = useData((s) => s.perfCategories);
  const items = useList('perfItems');
  const blocks = useList('perfBlocks');
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [showDone, setShowDone] = useState(false);

  useEffect(
    () =>
      actions.register({
        id: 'perf-sidebar',
        priority: 1,
        accepts: (p) => p.source === 'calendar' && p.kind === 'perfBlock',
        measure: () => measureView(root.current),
        onDrop: (p) => {
          remove('perfBlocks', p.id);
          toast('작업 블록을 뺐어요');
        },
      }),
    [actions],
  );

  const workMin = (itemId: string) => blocks.filter((b) => b.itemId === itemId && b.done).reduce((a, b) => a + (b.end - b.start) / MIN, 0);
  const done = items.filter((i) => i.status === 'done');

  return (
    <View ref={root} collapsable={false} style={{ flex: 1 }}>
      <View style={{ padding: 14, paddingBottom: 4 }}>
        <Row>
          <T size={18} weight="900" style={{ flex: 1 }}>
            수행 · 세특
          </T>
          <Btn small variant="secondary" icon="add" title="상위 항목" color={t.section.perf} onPress={onAddCat} />
        </Row>
        <T size={11} faint style={{ marginTop: 6 }}>
          하위 항목을 길게 눌러 캘린더로 끌면 작업 블록이 생겨요 (여러 번 배치 가능)
        </T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        {cats.length === 0 && (
          <View style={{ gap: 8, paddingVertical: 10 }}>
            <T sub>'수행평가', '세특 활동' 같은 상위 항목부터 만들어 보세요.</T>
            <Btn small title="상위 항목 만들기" color={t.section.perf} onPress={onAddCat} />
          </View>
        )}
        {cats.map((c) => {
          const list = items.filter((i) => i.categoryId === c.id && i.status !== 'done').sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9') || b.energy - a.energy);
          const isClosed = closed[c.id];
          return (
            <View key={c.id} style={{ marginBottom: 12 }}>
              <Pressable onPress={() => setClosed({ ...closed, [c.id]: !isClosed })} onLongPress={() => onEditCat(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                <Ionicons name={isClosed ? 'chevron-forward' : 'chevron-down'} size={14} color={t.textSub} />
                <Dot color={c.color} />
                <T weight="800" style={{ flex: 1 }}>
                  {c.name}
                </T>
                <IconBtn name="settings-outline" size={15} color={t.textFaint} onPress={() => onEditCat(c)} />
                <IconBtn name="add" size={18} color={c.color} onPress={() => onAddItem(c.id)} />
              </Pressable>
              {!isClosed &&
                (list.length === 0 ? (
                  <T size={11} faint style={{ marginLeft: 22 }}>
                    + 로 하위 항목 추가
                  </T>
                ) : (
                  list.map((it) => {
                    const bg = energyShade(itemColor(it, catsMap), it.energy);
                    const fg = readableOn(bg);
                    const d = it.dueDate ? daysUntil(it.dueDate) : null;
                    const w = workMin(it.id);
                    return (
                      <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 14, marginTop: 5 }}>
                        <Draggable
                          style={{ flex: 1 }}
                          payload={{ kind: 'perfItem', id: it.id, title: it.title, color: bg, durationMin: it.estMin, source: 'sidebar' }}
                          onTap={() => onPick(it)}
                        >
                          <View style={{ backgroundColor: bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
                            <Text numberOfLines={2} style={{ color: fg, fontWeight: '800', fontSize: 13 }}>
                              {it.title}
                            </Text>
                            <Text style={{ color: fg, opacity: 0.85, fontSize: 11, marginTop: 2 }}>
                              {'⚡'.repeat(it.energy)} · {fmtMin(it.estMin)}
                              {w ? ` · 작업 ${fmtMin(w)}` : ''}
                              {d !== null ? ` · ${ddayLabel(d)}` : ''}
                            </Text>
                          </View>
                        </Draggable>
                        <IconBtn name="open-outline" size={16} color={t.textFaint} onPress={() => router.push(`/perf/item/${it.id}`)} />
                      </View>
                    );
                  })
                ))}
            </View>
          );
        })}
        {done.length > 0 && (
          <>
            <Pressable onPress={() => setShowDone(!showDone)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
              <Ionicons name={showDone ? 'chevron-down' : 'chevron-forward'} size={16} color={t.success} />
              <T weight="800" color={t.success}>
                완료 {done.length}
              </T>
            </Pressable>
            {showDone &&
              done.map((it) => (
                <Pressable key={it.id} onPress={() => router.push(`/perf/item/${it.id}`)} style={{ paddingVertical: 5, paddingLeft: 22 }}>
                  <T size={13} style={{ textDecorationLine: 'line-through', opacity: 0.6 }} numberOfLines={1}>
                    {it.title}
                  </T>
                </Pressable>
              ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ───────── 작업 블록 시트 ───────── */

function PerfBlockSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTheme();
  const b: PerfBlock | undefined = useData((s) => (id ? s.perfBlocks[id] : undefined));
  const it = useData((s) => (b ? s.perfItems[b.itemId] : undefined));
  if (!b || !it) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const dur = Math.round((b.end - b.start) / MIN);
  return (
    <Sheet visible={!!id} onClose={onClose} title={it.title}>
      <T sub style={{ marginBottom: 12 }}>
        {fmtKDate(b.start)} {fmtTime(b.start)}–{fmtTime(b.end)}
      </T>
      <Btn
        title={b.done ? '완료 취소' : '이번 작업 완료'}
        icon={b.done ? 'refresh' : 'checkmark'}
        color={b.done ? t.textSub : t.success}
        onPress={() => {
          update('perfBlocks', b.id, { done: !b.done });
          if (!b.done) haptic('success');
          onClose();
        }}
      />
      <Label>시간 조정</Label>
      <Row style={{ marginBottom: 8 }}>
        <T style={{ width: 50 }} weight="700">
          시작
        </T>
        <Stepper value={b.start} step={15 * MIN} min={0} max={Number.MAX_SAFE_INTEGER} format={fmtTime} onChange={(v) => update('perfBlocks', b.id, { start: v, end: v + dur * MIN })} />
      </Row>
      <Row style={{ marginBottom: 14 }}>
        <T style={{ width: 50 }} weight="700">
          길이
        </T>
        <Stepper value={dur} step={15} min={15} max={600} format={fmtMin} onChange={(v) => update('perfBlocks', b.id, { end: b.start + v * MIN })} />
      </Row>
      <Row wrap>
        <Btn small variant="secondary" icon="open-outline" title="항목 열기 · 세특 기록" onPress={() => { onClose(); router.push(`/perf/item/${it.id}`); }} />
        <Btn small variant="secondary" icon="play" title="타이머로 시작" onPress={() => { onClose(); router.push(`/support/stopwatch?perf=${it.id}`); }} />
        <Btn small variant="secondary" color={t.danger} icon="trash-outline" title="블록 삭제" onPress={() => { remove('perfBlocks', b.id); onClose(); }} />
      </Row>
    </Sheet>
  );
}

/* ───────── 날짜 시트: 그 날의 일정 + 이벤트 추가 ───────── */

function DaySheet({
  day,
  onClose,
  onAddEvent,
  onEditEvent,
  onOpenDay,
}: {
  day: string | null;
  onClose: () => void;
  onAddEvent: (d: string) => void;
  onEditEvent: (e: PerfEvent) => void;
  onOpenDay: (d: string) => void;
}) {
  const t = useTheme();
  const events = useList('events');
  const blocks = useList('perfBlocks');
  const items = useData((s) => s.perfItems);
  const cats = useData((s) => s.perfCategories);
  const itemsList = useList('perfItems');
  if (!day) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const ev = events.filter((e) => e.date === day).sort((a, b) => (a.startMin ?? -1) - (b.startMin ?? -1));
  const bl = blocks.filter((b) => ymd(b.start) === day && items[b.itemId]).sort((a, b) => a.start - b.start);
  const dues = itemsList.filter((i) => i.dueDate === day);
  const d = daysUntil(day);
  return (
    <Sheet
      visible
      onClose={onClose}
      title={fmtKDate(day)}
      footer={
        <Row>
          <Btn title="시간표로 보기" variant="secondary" onPress={() => onOpenDay(day)} />
          <Btn title="특별 일정 추가" icon="add" flex color={t.section.perf} onPress={() => onAddEvent(day)} />
        </Row>
      }
    >
      <Badge label={ddayLabel(d)} color={d < 0 ? t.textFaint : t.section.perf} />
      <View style={{ height: 10 }} />
      {ev.length + bl.length + dues.length === 0 && <T sub>이 날은 일정이 없어요</T>}
      {dues.map((i) => (
        <Pressable key={i.id} onPress={() => { onClose(); router.push(`/perf/item/${i.id}`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <Ionicons name="alarm" size={18} color={t.danger} />
          <T weight="700" style={{ flex: 1 }}>
            마감: {i.title}
          </T>
        </Pressable>
      ))}
      {ev.map((e) => (
        <Pressable key={e.id} onPress={() => onEditEvent(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <Dot color={e.color} />
          <T weight="700" style={{ flex: 1 }}>
            {e.title}
          </T>
          <T size={12} sub>
            {e.startMin != null ? `${fmtTime(atMinutes(day, e.startMin))}` : '종일'}
          </T>
        </Pressable>
      ))}
      {bl.map((b) => (
        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <Ionicons name={b.done ? 'checkmark-circle' : 'time-outline'} size={18} color={b.done ? t.success : itemColor(items[b.itemId], cats)} />
          <T style={{ flex: 1 }}>{items[b.itemId].title}</T>
          <T size={12} sub>
            {fmtTime(b.start)}–{fmtTime(b.end)}
          </T>
        </View>
      ))}
    </Sheet>
  );
}
