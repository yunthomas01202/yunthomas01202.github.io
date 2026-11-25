// 계획 부문 공통 동작 (완료, 배치, 복제, 예열 블록, 쪼개기, 실패 처리)
import { add, batch, getState, update } from '../../lib/store';
import type { Task } from '../../lib/types';
import { MIN, addDays, fmtKDate, fmtTime, parseYmd, ymd } from '../../lib/date';
import { haptic, toast } from '../../components/ui';
import { busyOf, findFreeSlot, nextFreeSlot, taskXP } from './logic';
import { scheduleBusy, scheduleBusyAhead } from './schedules';

export function setTaskDone(t: Task, done: boolean) {
  if (done) {
    update('tasks', t.id, { status: 'done', doneAt: Date.now() });
    haptic('success');
    const sub = getState().subjects[t.subjectId];
    toast(`+${taskXP(t)} XP · ${sub?.name || ''} 경험치가 쌓였어요`);
  } else {
    update('tasks', t.id, { status: 'todo', doneAt: null });
  }
}

export function scheduleTask(id: string, start: number, durMin?: number) {
  const t = getState().tasks[id];
  if (!t) return;
  const dur = durMin ?? (t.end && t.start ? Math.round((t.end - t.start) / MIN) : t.estMin || getState().settings.defaultBlockMin);
  update('tasks', id, { start, end: start + dur * MIN });
}

/** 날짜만 정해서 놓을 때 (월간 보기): 기존 시각 유지 또는 그 날의 빈 칸 */
export function scheduleTaskOnDay(id: string, day: string) {
  const s = getState();
  const t = s.tasks[id];
  if (!t) return;
  const dur = t.start && t.end ? Math.round((t.end - t.start) / MIN) : t.estMin || s.settings.defaultBlockMin;
  const others = Object.values(s.tasks).filter((x) => x.id !== id);
  let start: number | null = null;
  if (t.start) {
    const keep = new Date(t.start);
    const d = parseYmd(day);
    d.setHours(keep.getHours(), keep.getMinutes(), 0, 0);
    start = d.getTime();
  } else {
    start = findFreeSlot(day, dur, busyOf(others, scheduleBusy(day, day)), s.settings, { preferFrom: 16 * 60, preferTo: 23 * 60 });
  }
  if (start === null) {
    toast('그 날엔 빈 시간이 없어요');
    return;
  }
  update('tasks', id, { start, end: start + dur * MIN });
  toast(`${fmtKDate(day)} ${fmtTime(start)}에 배치했어요`);
}

export function unscheduleTask(id: string) {
  update('tasks', id, { start: null, end: null });
}

export function resizeTask(id: string, end: number) {
  const t = getState().tasks[id];
  if (!t?.start) return;
  update('tasks', id, { end: Math.max(t.start + 15 * MIN, end) });
}

export function duplicateTask(t: Task, mode: 'tomorrow' | 'nextWeek' | 'daily') {
  const s = getState();
  const season = s.seasons[t.seasonId];
  const base = { ...t } as any;
  delete base.id;
  delete base.createdAt;
  const mk = (offsetDays: number) => ({
    ...base,
    status: 'todo',
    doneAt: null,
    missCount: 0,
    failReasons: [],
    start: t.start ? addDays(t.start, offsetDays).getTime() + (t.start - parseYmd(ymd(t.start)).getTime()) : null,
    end: t.end && t.start ? addDays(t.start, offsetDays).getTime() + (t.end - parseYmd(ymd(t.start)).getTime()) : null,
  });
  const offsets: number[] = [];
  if (mode === 'tomorrow') offsets.push(1);
  else if (mode === 'nextWeek') offsets.push(7);
  else {
    const last = season?.endDate || ymd(addDays(new Date(), 14));
    const startDay = t.start ? ymd(t.start) : ymd();
    for (let i = 1; i < 120; i++) {
      if (ymd(addDays(parseYmd(startDay), i)) > last) break;
      offsets.push(i);
    }
  }
  batch(offsets.map((o) => ({ op: 'add' as const, c: 'tasks' as const, data: mk(o) })));
  toast(`${offsets.length}개를 복제했어요`);
}

/** 하기 싫은 일 앞에 '딱 5분만' 예열 블록 추가 */
export function addStarterBefore(t: Task) {
  const s = getState();
  let start: number | null = null;
  if (t.start) {
    const cand = t.start - 5 * MIN;
    const busy = busyOf(Object.values(s.tasks).filter((x) => x.id !== t.id), scheduleBusy(cand, cand));
    const clash = busy.some((b) => b[0] < cand + 5 * MIN && cand < b[1]);
    start = clash ? null : cand;
  }
  if (start === null) start = nextFreeSlot(5, busyOf(Object.values(s.tasks), scheduleBusyAhead(8)), s.settings);
  add('tasks', {
    seasonId: t.seasonId,
    subjectId: t.subjectId,
    title: `5분만: ${t.title}`,
    energy: 1,
    estMin: 5,
    places: t.places,
    kind: t.kind,
    status: 'todo',
    starter: true,
    parentTaskId: t.id,
    start,
    end: start ? start + 5 * MIN : null,
  });
  toast(start ? `${fmtTime(start)}에 5분 예열 블록을 넣었어요` : '5분 예열 블록을 목록에 넣었어요');
}

/** 너무 큰 일을 반으로 쪼개기 (둘 다 미배치 상태로) */
export function splitTask(t: Task) {
  const half = Math.max(10, Math.round((t.estMin || 60) / 2 / 5) * 5);
  const base = {
    seasonId: t.seasonId,
    subjectId: t.subjectId,
    energy: (Math.max(1, t.energy - 1) as Task['energy']),
    estMin: half,
    places: t.places,
    kind: t.kind,
    status: 'todo' as const,
    note: t.note,
    parentTaskId: t.id,
  };
  batch([
    { op: 'add', c: 'tasks', data: { ...base, title: `${t.title} (1/2)` } },
    { op: 'add', c: 'tasks', data: { ...base, title: `${t.title} (2/2)` } },
    { op: 'update', c: 'tasks', id: t.id, data: { status: 'failed', failReasons: [...(t.failReasons || []), 'split'] } },
  ]);
}

/** 가장 가까운 빈 칸으로 다시 배치 */
export function rescheduleToNext(t: Task, reason?: string): number | null {
  const s = getState();
  const dur = t.start && t.end ? Math.round((t.end - t.start) / MIN) : t.estMin;
  const busy = busyOf(Object.values(s.tasks).filter((x) => x.id !== t.id && x.status === 'todo'), scheduleBusyAhead(8));
  const start = nextFreeSlot(dur, busy, s.settings);
  update('tasks', t.id, {
    start,
    end: start ? start + dur * MIN : null,
    missCount: (t.missCount || 0) + 1,
    failReasons: reason ? [...(t.failReasons || []), reason] : t.failReasons || [],
  });
  return start;
}

/** 다음 날 같은 시각으로 */
export function rescheduleTomorrowSameTime(t: Task, reason?: string) {
  if (!t.start || !t.end) return;
  let start = t.start;
  while (start < Date.now()) start += 86_400_000;
  update('tasks', t.id, {
    start,
    end: start + (t.end - t.start),
    missCount: (t.missCount || 0) + 1,
    failReasons: reason ? [...(t.failReasons || []), reason] : t.failReasons || [],
  });
}

export function giveUpTask(t: Task, reason?: string) {
  update('tasks', t.id, {
    status: 'failed',
    missCount: (t.missCount || 0) + 1,
    failReasons: reason ? [...(t.failReasons || []), reason] : t.failReasons || [],
  });
}
