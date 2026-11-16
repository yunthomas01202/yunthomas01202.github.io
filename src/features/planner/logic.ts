// 계획/스케줄 부문의 계산 로직 (통계, 경험치, 빈 시간 찾기, 자동 배치)
import type { Season, Settings, Subject, Task, TaskKind } from '../../lib/types';
import { MIN, addDays, atMinutes, parseYmd, ymd, eachDay } from '../../lib/date';

/* ───────── 시즌 ───────── */

/** 오늘이 포함된 시즌 → 다가올 시즌 → 가장 최근 시즌 */
export function pickActiveSeason(seasons: Season[]): Season | undefined {
  const today = ymd();
  const live = seasons.filter((s) => !s.archived);
  const current = live.filter((s) => s.startDate <= today && s.endDate >= today).sort((a, b) => a.endDate.localeCompare(b.endDate));
  if (current.length) return current[0];
  const upcoming = live.filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (upcoming.length) return upcoming[0];
  return [...live].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
}

export function nextExam(season: Season): { label: string; date: string } | undefined {
  const today = ymd();
  return [...(season.exams || [])].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
}

/* ───────── 실패(기한 지남) ───────── */

export const FAILURE_SNOOZE_KEY = 'failure-snooze-until';

export function overdueTasks(tasks: Task[], now = Date.now()): Task[] {
  return tasks
    .filter((t) => t.status === 'todo' && t.end && t.end < now)
    .sort((a, b) => (a.start || 0) - (b.start || 0));
}

/* ───────── 하루 달성률 / 잔디 ───────── */

export interface DayStat {
  total: number;
  done: number;
}

export function dayStats(tasks: Task[]): Record<string, DayStat> {
  const out: Record<string, DayStat> = {};
  for (const t of tasks) {
    let key: string | null = null;
    if (t.start) key = ymd(t.start);
    else if (t.status === 'done' && t.doneAt) key = ymd(t.doneAt);
    if (!key) continue;
    const s = (out[key] ||= { total: 0, done: 0 });
    s.total++;
    if (t.status === 'done') s.done++;
  }
  return out;
}

export function heatLevel(st?: DayStat): number {
  if (!st || st.total === 0) return -1;
  const r = st.done / st.total;
  if (st.done === 0) return 0;
  if (r < 0.34) return 1;
  if (r < 0.67) return 2;
  if (r < 0.9) return 3;
  return 4;
}

export function heatLevels(stats: Record<string, DayStat>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(stats)) out[k] = heatLevel(v);
  return out;
}

/** 오늘(또는 아직 오늘 기록이 없으면 어제)부터 거꾸로 1개 이상 완료한 연속 일수 */
export function streakDays(stats: Record<string, DayStat>): number {
  let d = new Date();
  if (!(stats[ymd(d)]?.done > 0)) d = addDays(d, -1);
  let n = 0;
  while (stats[ymd(d)]?.done > 0 && n < 2000) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/* ───────── 경험치 / 헥사곤 스탯 ───────── */

export function taskXP(t: Pick<Task, 'energy' | 'estMin'>): number {
  return t.energy * 10 + Math.round((t.estMin || 0) / 15) * 4;
}

const KIND_AXIS: Partial<Record<TaskKind, string>> = {
  memorize: '암기',
  problem: '문제풀이',
  concept: '개념',
  review: '복습',
  reading: '독서',
};

/** 완료한 할 일의 경험치를 6개 축에 분배 (과목 축 + 유형 축) */
export function axisXP(tasks: Task[], subjects: Record<string, Subject>, axes: string[], studyMinBySubject?: Record<string, number>) {
  const xp: Record<string, number> = Object.fromEntries(axes.map((a) => [a, 0]));
  for (const t of tasks) {
    if (t.status !== 'done') continue;
    const v = taskXP(t);
    const sub = subjects[t.subjectId];
    const subjectAxis = sub?.statKey && axes.includes(sub.statKey) ? sub.statKey : axes.find((a) => sub?.name?.includes(a));
    const kindAxis = KIND_AXIS[t.kind] && axes.includes(KIND_AXIS[t.kind]!) ? KIND_AXIS[t.kind]! : undefined;
    if (subjectAxis && kindAxis && subjectAxis !== kindAxis) {
      xp[subjectAxis] += v * 0.6;
      xp[kindAxis] += v * 0.4;
    } else if (subjectAxis) xp[subjectAxis] += v;
    else if (kindAxis) xp[kindAxis] += v;
  }
  // 공부 타이머 시간도 과목명이 축 이름을 포함하면 반영 (10분 = 3xp)
  if (studyMinBySubject) {
    for (const [name, min] of Object.entries(studyMinBySubject)) {
      const axis = axes.find((a) => name.includes(a));
      if (axis) xp[axis] += (min / 10) * 3;
    }
  }
  return xp;
}

export function levelOf(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
  const cur = 40 * (level - 1) ** 2;
  const next = 40 * level ** 2;
  return { level, progress: (xp - cur) / (next - cur), toNext: Math.ceil(next - xp) };
}

export function titleOf(level: number): string {
  if (level >= 30) return '전설의 수험생';
  if (level >= 22) return '마스터';
  if (level >= 15) return '에이스';
  if (level >= 10) return '숙련자';
  if (level >= 6) return '꾸준러';
  if (level >= 3) return '견습생';
  return '새싹';
}

/* ───────── 빈 시간 찾기 / 자동 배치 ───────── */

export type Interval = [number, number];

export function overlaps(a: Interval, b: Interval) {
  return a[0] < b[1] && b[0] < a[1];
}

export function busyOf(tasks: Task[], extra: Interval[] = []): Interval[] {
  const out: Interval[] = [...extra];
  for (const t of tasks) if (t.start && t.end) out.push([t.start, t.end]);
  return out;
}

/** 그 날 dayStart~dayEnd 사이에서 durMin분짜리 빈 칸 (15분 단위) */
export function findFreeSlot(
  day: string,
  durMin: number,
  busy: Interval[],
  settings: Pick<Settings, 'dayStartHour' | 'dayEndHour'>,
  opts?: { notBefore?: number; preferFrom?: number; preferTo?: number },
): number | null {
  const step = 15;
  const tryRange = (fromMin: number, toMin: number): number | null => {
    for (let m = fromMin; m + durMin <= toMin; m += step) {
      const s = atMinutes(day, m);
      if (opts?.notBefore && s < opts.notBefore) continue;
      const iv: Interval = [s, s + durMin * MIN];
      if (!busy.some((b) => overlaps(b, iv))) return s;
    }
    return null;
  };
  const dayFrom = settings.dayStartHour * 60;
  const dayTo = Math.min(24 * 60, settings.dayEndHour * 60);
  if (opts?.preferFrom !== undefined && opts?.preferTo !== undefined) {
    const p = tryRange(Math.max(dayFrom, opts.preferFrom), Math.min(dayTo, opts.preferTo));
    if (p !== null) return p;
  }
  return tryRange(dayFrom, dayTo);
}

/** 지금 이후 가장 가까운 빈 칸 (오늘 → 내일 → …) */
export function nextFreeSlot(
  durMin: number,
  busy: Interval[],
  settings: Pick<Settings, 'dayStartHour' | 'dayEndHour'>,
  fromDay = ymd(),
  days = 7,
): number | null {
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    const day = ymd(addDays(parseYmd(fromDay), i));
    const s = findFreeSlot(day, durMin, busy, settings, { notBefore: now + 5 * MIN });
    if (s !== null) return s;
  }
  return null;
}

/**
 * 자동 배치: 에너지가 큰 일부터, 집중이 잘 되는 시간대(peak)에 먼저 넣고
 * 하루 총량(dailyLimitMin)을 넘지 않게 앞에서부터 채운다
 */
export function autoPlace(
  tasks: Task[],
  fromDay: string,
  toDay: string,
  busy: Interval[],
  settings: Settings,
  dailyLimitMin: number,
): { id: string; start: number; end: number }[] {
  const days = eachDay(fromDay, toDay);
  const order = [...tasks].sort((a, b) => b.energy - a.energy || a.estMin - b.estMin);
  const used: Record<string, number> = {};
  const occ = [...busy];
  for (const iv of busy) {
    const k = ymd(iv[0]);
    used[k] = (used[k] || 0) + (iv[1] - iv[0]) / MIN;
  }
  const out: { id: string; start: number; end: number }[] = [];
  const now = Date.now();
  for (const t of order) {
    const dur = t.estMin || settings.defaultBlockMin;
    for (const day of days) {
      if ((used[day] || 0) + dur > dailyLimitMin) continue;
      const s = findFreeSlot(day, dur, occ, settings, {
        notBefore: now + 10 * MIN,
        preferFrom: t.energy >= 4 ? settings.peakStartHour * 60 : undefined,
        preferTo: t.energy >= 4 ? settings.peakEndHour * 60 : undefined,
      });
      if (s !== null) {
        const iv: Interval = [s, s + dur * MIN];
        occ.push(iv);
        used[day] = (used[day] || 0) + dur;
        out.push({ id: t.id, start: iv[0], end: iv[1] });
        break;
      }
    }
  }
  return out;
}

/** 같은 날 겹치는 블록들을 나란히 놓기 위한 열(lane) 계산 */
export function layoutLanes<T extends { id: string; start: number; end: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const res: Record<string, { lane: number; lanes: number }> = {};
  let cluster: T[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const laneEnds: number[] = [];
    const lanes: Record<string, number> = {};
    for (const it of cluster) {
      let l = laneEnds.findIndex((e) => e <= it.start);
      if (l === -1) {
        l = laneEnds.length;
        laneEnds.push(it.end);
      } else laneEnds[l] = it.end;
      lanes[it.id] = l;
    }
    for (const it of cluster) res[it.id] = { lane: lanes[it.id], lanes: laneEnds.length };
    cluster = [];
    clusterEnd = -Infinity;
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return res;
}
