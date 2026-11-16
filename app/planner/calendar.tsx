// 캘린더 짜기: 왼쪽 할 일 목록(과목별·에너지순)을 드래그해서 일/주/월 캘린더에 배치
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView as RNScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '../../src/theme';
import { batch, getState, useData, useList } from '../../src/lib/store';
import type { Task } from '../../src/lib/types';
import { energyShade, readableOn } from '../../src/lib/color';
import { MIN, addDays, fmtKDate, fmtMin, fmtTime, parseYmd, ymd } from '../../src/lib/date';
import { Btn, Chip, Dot, IconBtn, Label, Row, Sheet, Stepper, T, toast } from '../../src/components/ui';
import { CalendarBoard, CalBlock, CalMode, SidebarToggle, SplitLayout } from '../../src/components/calendar/CalendarBoard';
import { DragProvider, Draggable, measureView, useDragActions } from '../../src/components/calendar/drag';
import { PlaceTabs, TaskEditor, matchesPlace } from '../../src/features/planner/components';
import { autoPlace, busyOf, dayStats, heatLevels, pickActiveSeason } from '../../src/features/planner/logic';
import {
  addStarterBefore,
  duplicateTask,
  resizeTask,
  scheduleTask,
  scheduleTaskOnDay,
  setTaskDone,
  unscheduleTask,
} from '../../src/features/planner/actions';

export default function PlannerCalendar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ season?: string }>();
  const settings = useData((s) => s.settings);
  const seasonsMap = useData((s) => s.seasons);
  const subjects = useData((s) => s.subjects);
  const seasons = useList('seasons');
  const tasks = useList('tasks');

  const [seasonId, setSeasonId] = useState<string | null>(() => params.season || pickActiveSeason(seasons)?.id || null);
  const [mode, setMode] = useState<CalMode>(width >= 820 ? 'week' : 'day');
  const [anchor, setAnchor] = useState(new Date());
  const [drawer, setDrawer] = useState(false);
  const [place, setPlace] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Task | null>(null);
  const [blockSheet, setBlockSheet] = useState<string | null>(null);
  const [taskEdit, setTaskEdit] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [autoOpen, setAutoOpen] = useState(false);

  const season = seasonId ? seasonsMap[seasonId] : undefined;

  // 시즌을 바꾸면 캘린더를 그 시즌 기간으로 이동
  const prevSeason = useRef(seasonId);
  useEffect(() => {
    if (prevSeason.current === seasonId) return;
    prevSeason.current = seasonId;
    if (!season) return;
    const today = ymd();
    const k = ymd(anchor);
    if (k < season.startDate || k > season.endDate) {
      setAnchor(parseYmd(today >= season.startDate && today <= season.endDate ? today : season.startDate));
    }
  }, [seasonId, season, anchor]);

  const now = Date.now();
  const blocks: CalBlock[] = useMemo(
    () =>
      tasks
        .filter((x) => x.start && x.end && x.status !== 'failed')
        .map((x) => {
          const sub = subjects[x.subjectId];
          return {
            id: x.id,
            kind: 'block' as const,
            title: x.title,
            subtitle: sub?.name,
            start: x.start!,
            end: x.end!,
            color: energyShade(sub?.color || '#888', x.energy),
            done: x.status === 'done',
            failed: x.status === 'todo' && x.end! < now,
            dim: !matchesPlace(x, place),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, subjects, place],
  );

  const allDay = useMemo(
    () =>
      seasons.flatMap((s) =>
        (s.exams || []).map((e) => ({ id: s.id + e.id, date: e.date, title: `${e.label} 시험`, color: t.section.plan })),
      ),
    [seasons, t],
  );
  const heat = useMemo(() => heatLevels(dayStats(tasks)), [tasks]);
  const unscheduledCount = useMemo(
    () => tasks.filter((x) => x.seasonId === seasonId && !x.start && x.status === 'todo').length,
    [tasks, seasonId],
  );

  const sheetTask = blockSheet ? tasks.find((x) => x.id === blockSheet) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <DragProvider onDragStateChange={(d) => d && setDrawer(false)}>
        <SplitLayout
          open={drawer}
          onClose={() => setDrawer(false)}
          sidebar={
            <TaskSidebar
              seasonId={seasonId}
              onSeason={setSeasonId}
              place={place}
              onPlace={setPlace}
              onPick={(task) => {
                setPlacing(task);
                setDrawer(false);
                toast('캘린더에서 넣을 칸을 탭하세요');
              }}
              onEdit={(task) => setTaskEdit({ open: true, task })}
              onAdd={() => setTaskEdit({ open: true, task: null })}
              onAuto={() => setAutoOpen(true)}
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
            heat={heat}
            rangeStart={season?.startDate}
            rangeEnd={season?.endDate}
            dayStartHour={settings.dayStartHour}
            dayEndHour={settings.dayEndHour}
            weekStartsOn={settings.weekStartsOn}
            acceptKinds={['task']}
            onDropNew={(p, start, day) => (start ? scheduleTask(p.id, start) : scheduleTaskOnDay(p.id, day))}
            onMoveBlock={(id, _k, start, day) => (start ? scheduleTask(id, start) : scheduleTaskOnDay(id, day))}
            onResizeBlock={(id, _k, end) => resizeTask(id, end)}
            onPressBlock={(id) => setBlockSheet(id)}
            onPressDay={(day) => {
              setAnchor(parseYmd(day));
              setMode('day');
            }}
            onPressSlot={(start) => {
              if (!placing) return;
              scheduleTask(placing.id, start);
              toast(`${fmtTime(start)}에 '${placing.title}' 배치`);
              setPlacing(null);
            }}
            headerLeft={
              <Row gap={0}>
                <IconBtn name="chevron-back" size={22} onPress={() => (router.canGoBack() ? router.back() : router.replace('/planner'))} />
                <SidebarToggle onPress={() => setDrawer(true)} count={unscheduledCount} />
              </Row>
            }
            banner={
              placing ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: t.primary,
                    marginHorizontal: 8,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginBottom: 4,
                  }}
                >
                  <Ionicons name="hand-left" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', flex: 1, marginLeft: 8 }} numberOfLines={1}>
                    '{placing.title}' 넣을 시간을 탭하세요
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

      <BlockSheet
        task={sheetTask}
        onClose={() => setBlockSheet(null)}
        onEdit={(task) => {
          setBlockSheet(null);
          setTimeout(() => setTaskEdit({ open: true, task }), 300);
        }}
      />
      <TaskEditor
        visible={taskEdit.open}
        task={taskEdit.task}
        seasonId={taskEdit.task?.seasonId || seasonId || ''}
        onClose={() => setTaskEdit({ open: false, task: null })}
      />
      <AutoPlaceSheet visible={autoOpen} onClose={() => setAutoOpen(false)} seasonId={seasonId} place={place} />
    </View>
  );
}

/* ───────────────────────── 왼쪽 할 일 목록 ───────────────────────── */

function TaskSidebar({
  seasonId,
  onSeason,
  place,
  onPlace,
  onPick,
  onEdit,
  onAdd,
  onAuto,
}: {
  seasonId: string | null;
  onSeason: (id: string) => void;
  place: string | null;
  onPlace: (p: string | null) => void;
  onPick: (t: Task) => void;
  onEdit: (t: Task) => void;
  onAdd: () => void;
  onAuto: () => void;
}) {
  const t = useTheme();
  const actions = useDragActions();
  const rootRef = useRef<View>(null);
  const seasons = useList('seasons');
  const subjectsList = useList('subjects');
  const tasks = useList('tasks');
  const placesSetting = useData((s) => s.settings.places);
  const [showDone, setShowDone] = useState(false);
  const [showPlaced, setShowPlaced] = useState(false);

  // 캘린더 블록을 여기로 끌어오면 배치 해제
  useEffect(
    () =>
      actions.register({
        id: 'sidebar',
        priority: 1,
        accepts: (p) => p.source === 'calendar' && p.kind === 'block',
        measure: () => measureView(rootRef.current),
        onDrop: (p) => {
          unscheduleTask(p.id);
          toast('배치를 해제했어요');
        },
      }),
    [actions],
  );

  const subjects = useMemo(
    () => subjectsList.filter((s) => s.seasonId === seasonId).sort((a, b) => a.order - b.order),
    [subjectsList, seasonId],
  );
  const seasonTasks = useMemo(() => tasks.filter((x) => x.seasonId === seasonId), [tasks, seasonId]);
  const doneList = useMemo(
    () => seasonTasks.filter((x) => x.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)),
    [seasonTasks],
  );
  const placed = seasonTasks.filter((x) => x.start && x.status === 'todo');

  return (
    <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
      <View style={{ padding: 14, paddingBottom: 6 }}>
        <Row>
          <T size={18} weight="900" style={{ flex: 1 }}>
            할 일
          </T>
          <IconBtn name="sparkles-outline" size={20} onPress={onAuto} />
          <IconBtn name="add-circle" size={24} color={t.primary} onPress={onAdd} disabled={!seasonId || subjects.length === 0} />
        </Row>
        <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
          {seasons
            .filter((s) => !s.archived || s.id === seasonId)
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
            .map((s) => (
              <Chip key={s.id} small label={s.name} selected={s.id === seasonId} onPress={() => onSeason(s.id)} />
            ))}
          <Chip small icon="add" label="시즌" onPress={() => router.push('/planner/seasons')} />
        </RNScrollView>
        <PlaceTabs value={place} onChange={onPlace} />
        <T size={11} faint style={{ marginTop: 4 }}>
          길게 눌러 캘린더로 끌어다 놓기 · 탭하면 칸 선택해서 넣기
        </T>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4, paddingBottom: 40 }}>
        {!seasonId && <T sub>시즌을 먼저 선택하세요</T>}
        {seasonId && subjects.length === 0 && (
          <View style={{ gap: 8, paddingVertical: 10 }}>
            <T sub>이 시즌에 과목이 없어요.</T>
            <Btn small title="과목 추가하러 가기" onPress={() => router.push(`/planner/season/${seasonId}`)} />
          </View>
        )}
        {subjects.map((s) => {
          const list = seasonTasks
            .filter((x) => x.subjectId === s.id && !x.start && x.status === 'todo' && matchesPlace(x, place))
            .sort((a, b) => b.energy - a.energy || a.createdAt - b.createdAt);
          return (
            <View key={s.id} style={{ marginBottom: 12 }}>
              <Row gap={6} style={{ marginBottom: 6 }}>
                <Dot color={s.color} />
                <T weight="800" size={14}>
                  {s.name}
                </T>
                <T size={11} faint>
                  {list.length}
                </T>
              </Row>
              {list.length === 0 ? (
                <T size={11} faint style={{ marginLeft: 16, marginBottom: 4 }}>
                  배치할 일이 없어요
                </T>
              ) : (
                list.map((x) => {
                  const bg = energyShade(s.color, x.energy);
                  const fg = readableOn(bg);
                  return (
                    <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                      <Draggable
                        style={{ flex: 1 }}
                        payload={{ kind: 'task', id: x.id, title: x.title, color: bg, durationMin: x.estMin, source: 'sidebar' }}
                        onTap={() => onPick(x)}
                      >
                        <View style={{ backgroundColor: bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
                          <Text numberOfLines={2} style={{ color: fg, fontWeight: '800', fontSize: 13 }}>
                            {x.title}
                          </Text>
                          <Text style={{ color: fg, opacity: 0.85, fontSize: 11, marginTop: 2 }}>
                            {'⚡'.repeat(x.energy)} · {fmtMin(x.estMin)}{' '}
                            {(x.places || []).map((pid) => placesSetting.find((p) => p.id === pid)?.emoji || '').join('')}
                          </Text>
                        </View>
                      </Draggable>
                      <IconBtn name="ellipsis-vertical" size={16} color={t.textFaint} onPress={() => onEdit(x)} />
                    </View>
                  );
                })
              )}
            </View>
          );
        })}

        {placed.length > 0 && (
          <Pressable onPress={() => setShowPlaced(!showPlaced)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
            <Ionicons name={showPlaced ? 'chevron-down' : 'chevron-forward'} size={16} color={t.textSub} />
            <T weight="700" sub>
              배치된 일 {placed.length}
            </T>
          </Pressable>
        )}
        {showPlaced &&
          placed
            .sort((a, b) => a.start! - b.start!)
            .map((x) => (
              <Pressable key={x.id} onPress={() => onEdit(x)} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5, paddingLeft: 8 }}>
                <Dot color={subjects.find((s) => s.id === x.subjectId)?.color || '#888'} size={8} />
                <T size={12} style={{ flex: 1 }} numberOfLines={1}>
                  {x.title}
                </T>
                <T size={11} faint>
                  {fmtKDate(x.start!, false)} {fmtTime(x.start!)}
                </T>
              </Pressable>
            ))}

        <View style={{ height: 1, backgroundColor: t.border, marginVertical: 10 }} />
        <Pressable onPress={() => setShowDone(!showDone)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
          <Ionicons name={showDone ? 'chevron-down' : 'chevron-forward'} size={16} color={t.success} />
          <T weight="800" color={t.success}>
            완료된 일 {doneList.length}
          </T>
        </Pressable>
        {showDone &&
          doneList.map((x) => (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6 }}>
              <Pressable hitSlop={8} onPress={() => setTaskDone(x, false)}>
                <Ionicons name="checkmark-circle" size={20} color={t.success} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <T size={13} numberOfLines={1} style={{ textDecorationLine: 'line-through', opacity: 0.6 }}>
                  {x.title}
                </T>
                <T size={10} faint>
                  {subjects.find((s) => s.id === x.subjectId)?.name} · {x.doneAt ? fmtKDate(x.doneAt, false) : ''}
                </T>
              </View>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── 블록 상세 시트 ───────────────────────── */

function BlockSheet({ task, onClose, onEdit }: { task?: Task; onClose: () => void; onEdit: (t: Task) => void }) {
  const t = useTheme();
  const subject = useData((s) => (task ? s.subjects[task.subjectId] : undefined));
  if (!task) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const dur = task.start && task.end ? Math.round((task.end - task.start) / MIN) : task.estMin;
  const done = task.status === 'done';
  const color = energyShade(subject?.color || '#888', task.energy);
  return (
    <Sheet visible={!!task} onClose={onClose} title={task.title}>
      <Row style={{ marginBottom: 12 }}>
        <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color }} />
        <T sub>
          {subject?.name} · {'⚡'.repeat(task.energy)} · {task.start ? `${fmtKDate(task.start)} ${fmtTime(task.start)}–${fmtTime(task.end!)}` : '미배치'}
        </T>
      </Row>
      <Btn
        title={done ? '완료 취소' : '완료했어요'}
        icon={done ? 'refresh' : 'checkmark'}
        color={done ? t.textSub : t.success}
        onPress={() => {
          setTaskDone(task, !done);
          onClose();
        }}
      />
      {task.start && (
        <>
          <Label>시간 조정</Label>
          <Row style={{ marginBottom: 8 }}>
            <T style={{ width: 54 }} weight="700">
              시작
            </T>
            <Stepper
              value={task.start}
              step={15 * MIN}
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              format={(v) => fmtTime(v)}
              onChange={(v) => scheduleTask(task.id, v, dur)}
            />
          </Row>
          <Row style={{ marginBottom: 8 }}>
            <T style={{ width: 54 }} weight="700">
              길이
            </T>
            <Stepper value={dur} step={15} min={15} max={600} format={fmtMin} onChange={(v) => scheduleTask(task.id, task.start!, v)} />
          </Row>
        </>
      )}
      <Label>더 하기</Label>
      <Row wrap>
        <Btn small variant="secondary" icon="play" title="타이머로 시작" onPress={() => { onClose(); router.push(`/support/stopwatch?task=${task.id}`); }} />
        {!task.starter && (
          <Btn small variant="secondary" icon="flame" color="#F76B15" title="5분 예열 블록" onPress={() => { addStarterBefore(task); onClose(); }} />
        )}
        <Btn small variant="secondary" icon="copy-outline" title="내일 복제" onPress={() => duplicateTask(task, 'tomorrow')} />
        <Btn small variant="secondary" icon="copy-outline" title="다음 주 복제" onPress={() => duplicateTask(task, 'nextWeek')} />
        <Btn small variant="secondary" icon="repeat" title="매일 반복(시즌 끝까지)" onPress={() => { duplicateTask(task, 'daily'); onClose(); }} />
        <Btn small variant="secondary" icon="create-outline" title="수정" onPress={() => onEdit(task)} />
        {task.start && (
          <Btn small variant="secondary" color={t.danger} icon="remove-circle-outline" title="배치 해제" onPress={() => { unscheduleTask(task.id); onClose(); }} />
        )}
      </Row>
    </Sheet>
  );
}

/* ───────────────────────── 자동 배치 ───────────────────────── */

function AutoPlaceSheet({
  visible,
  onClose,
  seasonId,
  place,
}: {
  visible: boolean;
  onClose: () => void;
  seasonId: string | null;
  place: string | null;
}) {
  const t = useTheme();
  const settings = useData((s) => s.settings);
  const season = useData((s) => (seasonId ? s.seasons[seasonId] : undefined));
  const [days, setDays] = useState(7);
  const [limit, setLimit] = useState(settings.dailyGoalMin);
  const tasks = useList('tasks');
  const candidates = tasks.filter((x) => x.seasonId === seasonId && !x.start && x.status === 'todo' && matchesPlace(x, place));

  const run = () => {
    const from = ymd();
    let to = ymd(addDays(new Date(), days - 1));
    if (season && to > season.endDate) to = season.endDate;
    const busy = busyOf(Object.values(getState().tasks).filter((x) => x.status !== 'failed'));
    const res = autoPlace(candidates, from, to, busy, settings, limit);
    batch(res.map((r) => ({ op: 'update' as const, c: 'tasks' as const, id: r.id, data: { start: r.start, end: r.end } })));
    toast(res.length ? `${res.length}개를 배치했어요` : '빈 시간이 부족해요. 기간이나 하루 한도를 늘려보세요');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="자동 배치" footer={<Btn title={`${candidates.length}개 자동 배치`} onPress={run} disabled={!candidates.length} />}>
      <T sub style={{ marginBottom: 14, lineHeight: 20 }}>
        에너지가 높은 일은 집중이 잘 되는 시간({settings.peakStartHour}시~{settings.peakEndHour}시)에 먼저, 나머지는 빈 시간에 차례로
        채워 넣어요. 이미 배치한 일정은 건드리지 않아요.
      </T>
      <Label>기간</Label>
      <Row wrap style={{ marginBottom: 14 }}>
        {[1, 3, 7, 14].map((d) => (
          <Chip key={d} label={d === 1 ? '오늘만' : `${d}일`} selected={days === d} onPress={() => setDays(d)} />
        ))}
        {season && (
          <Chip
            label="시즌 끝까지"
            selected={days === 999}
            onPress={() => setDays(999)}
          />
        )}
      </Row>
      <Label>하루 최대 공부량</Label>
      <Stepper value={limit} onChange={setLimit} step={30} min={30} max={900} format={fmtMin} />
      <T size={12} faint style={{ marginTop: 12 }}>
        {place ? '선택한 장소 태그에 맞는 일만 배치해요' : '모든 장소의 일을 배치해요'}
      </T>
      <View style={{ height: 8 }} />
      <T size={12} color={t.textSub}>
        대상: 배치 안 된 할 일 {candidates.length}개
      </T>
    </Sheet>
  );
}
