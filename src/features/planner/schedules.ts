// 일반 일정 (교시·조회·점심·종례·학원 등): 반복 펼치기, 빈 시간 계산, 학교 시간표 만들기
import type { Schedule } from '../../lib/types';
import { MIN, addDays, atMinutes, parseYmd, ymd } from '../../lib/date';
import { add, batch, getState, remove, update } from '../../lib/store';

export interface SchedOcc {
  /** 화면에서 쓰는 고유 키: schedId@날짜 */
  key: string;
  schedId: string;
  date: string;
  start: number;
  end: number;
  title: string;
  color: string;
  busy: boolean;
}

export const SCHED_COLOR = '#8B8D98';
export const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export function occursOn(s: Schedule, day: string): boolean {
  if (s.skip?.includes(day)) return false;
  if (s.repeat === 'once') return s.date === day;
  if (s.from && day < s.from) return false;
  if (s.to && day > s.to) return false;
  return !!s.days?.includes(parseYmd(day).getDay());
}

/** from~to (둘 다 포함, YYYY-MM-DD) 사이의 실제 일정들 */
export function expandSchedules(list: Schedule[], from: string, to: string): SchedOcc[] {
  const out: SchedOcc[] = [];
  if (!list.length || from > to) return out;
  for (let d = parseYmd(from), i = 0; i < 800; i++, d = addDays(d, 1)) {
    const day = ymd(d);
    if (day > to) break;
    for (const s of list) {
      if (!occursOn(s, day)) continue;
      out.push({
        key: `${s.id}@${day}`,
        schedId: s.id,
        date: day,
        start: atMinutes(day, s.startMin),
        end: atMinutes(day, s.endMin),
        title: s.title,
        color: s.color || SCHED_COLOR,
        busy: s.busy !== false,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** 자동 배치·빈 칸 찾기에서 피할 시간 (from·to 는 날짜 또는 시각) */
export function scheduleBusy(from: string | number, to: string | number): [number, number][] {
  const list = Object.values(getState().schedules || {});
  if (!list.length) return [];
  const f = typeof from === 'number' ? ymd(from) : from;
  const t = typeof to === 'number' ? ymd(to) : to;
  return expandSchedules(list, f, t)
    .filter((o) => o.busy)
    .map((o) => [o.start, o.end] as [number, number]);
}

/** 오늘부터 며칠 동안 피할 시간 (빈 칸 찾기용 기본값) */
export function scheduleBusyAhead(days = 14): [number, number][] {
  const now = new Date();
  return scheduleBusy(ymd(addDays(now, -1)), ymd(addDays(now, days)));
}

export const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

export function describeRepeat(s: Schedule): string {
  if (s.repeat === 'once') return s.date || '';
  const days = [...(s.days || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const d =
    days.length === 7 ? '매일' : days.join() === '1,2,3,4,5' ? '평일' : days.length ? `매주 ${days.map((x) => WEEKDAY[x]).join('·')}` : '요일 없음';
  const range = s.from || s.to ? ` · ${s.from ? s.from.slice(5).replace('-', '/') : ''}~${s.to ? s.to.slice(5).replace('-', '/') : ''}` : '';
  return d + range;
}

/* ───────── 한 날짜만 빼기 / 지우기 ───────── */

export function skipOnce(id: string, day: string) {
  const s = getState().schedules[id];
  if (!s) return;
  if (s.repeat === 'once') return remove('schedules', id);
  update('schedules', id, { skip: [...new Set([...(s.skip || []), day])] });
}

export function removeGroup(group: string) {
  const ids = Object.values(getState().schedules)
    .filter((s) => s.group === group)
    .map((s) => s.id);
  batch(ids.map((id) => ({ op: 'remove' as const, c: 'schedules' as const, id })));
  return ids.length;
}

/** 묶음 전체에서 하루 빼기 (예: 개교기념일·시험 기간 하루) */
export function skipGroupOn(group: string, day: string) {
  const list = Object.values(getState().schedules).filter((s) => s.group === group && occursOn(s, day));
  batch(list.map((s) => ({ op: 'update' as const, c: 'schedules' as const, id: s.id, data: { skip: [...new Set([...(s.skip || []), day])] } })));
  return list.length;
}

export function groupsOf(list: Schedule[]): { group: string; count: number; title: string }[] {
  const m = new Map<string, { group: string; count: number; title: string }>();
  for (const s of list) {
    if (!s.group) continue;
    const g = m.get(s.group) || { group: s.group, count: 0, title: s.group.split(':')[1] || '묶음' };
    g.count += 1;
    m.set(s.group, g);
  }
  return [...m.values()];
}

/* ───────── 학교 시간표 만들기 ───────── */

export interface SchoolCfg {
  name: string;
  days: number[];
  /** 조회 시작 (분). null 이면 조회 없음 */
  homeroomMin: number | null;
  homeroomLen: number;
  firstMin: number;
  classLen: number;
  breakLen: number;
  /** 요일별 교시 수 */
  periods: Record<number, number>;
  lunchAfter: number;
  lunchLen: number;
  /** 종례 길이 (0 이면 없음) */
  closingLen: number;
  /** 마지막 교시 뒤 종례까지 쉬는 시간 */
  closingGap: number;
  from: string | null;
  to: string | null;
  color: string;
}

export interface SchoolItem {
  title: string;
  startMin: number;
  endMin: number;
  days: number[];
  kind: 'homeroom' | 'class' | 'lunch' | 'closing';
}

/** 하루치 순서 */
export function schoolDay(cfg: SchoolCfg, periods: number): Omit<SchoolItem, 'days'>[] {
  const out: Omit<SchoolItem, 'days'>[] = [];
  if (cfg.homeroomMin != null && cfg.homeroomLen > 0) {
    out.push({ title: '조회', startMin: cfg.homeroomMin, endMin: cfg.homeroomMin + cfg.homeroomLen, kind: 'homeroom' });
  }
  let cur = cfg.firstMin;
  for (let p = 1; p <= periods; p++) {
    out.push({ title: `${p}교시`, startMin: cur, endMin: cur + cfg.classLen, kind: 'class' });
    cur += cfg.classLen;
    if (p === cfg.lunchAfter && p < periods && cfg.lunchLen > 0) {
      out.push({ title: '점심시간', startMin: cur, endMin: cur + cfg.lunchLen, kind: 'lunch' });
      cur += cfg.lunchLen;
    } else if (p < periods) {
      cur += cfg.breakLen;
    }
  }
  if (cfg.closingLen > 0 && periods > 0) {
    const s = cur + cfg.closingGap;
    out.push({ title: '종례', startMin: s, endMin: s + cfg.closingLen, kind: 'closing' });
  }
  return out;
}

/** 요일마다 같은 시각·같은 이름이면 하나로 묶어 반복 일정 목록을 만듦 */
export function buildSchool(cfg: SchoolCfg): SchoolItem[] {
  const m = new Map<string, SchoolItem>();
  for (const d of cfg.days) {
    for (const it of schoolDay(cfg, cfg.periods[d] ?? 0)) {
      const k = `${it.title}|${it.startMin}|${it.endMin}`;
      const prev = m.get(k);
      if (prev) prev.days.push(d);
      else m.set(k, { ...it, days: [d] });
    }
  }
  return [...m.values()].sort((a, b) => a.startMin - b.startMin || a.days[0] - b.days[0]);
}

export function createSchool(cfg: SchoolCfg): number {
  const items = buildSchool(cfg);
  const group = `school-${Date.now().toString(36)}:${cfg.name || '학교 시간표'}`;
  batch(
    items.map((it) => ({
      op: 'add' as const,
      c: 'schedules' as const,
      data: {
        title: it.title,
        color: cfg.color,
        startMin: it.startMin,
        endMin: it.endMin,
        repeat: 'weekly' as const,
        days: it.days,
        from: cfg.from,
        to: cfg.to,
        skip: [],
        group,
        busy: true,
      },
    })),
  );
  return items.length;
}

export function addSchedule(data: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) {
  return add('schedules', data as any);
}

/** 빈 칸 탭 → 기본 30분 일정 시작값 */
export function defaultOnceAt(start: number) {
  const d = new Date(start);
  const sm = d.getHours() * 60 + d.getMinutes();
  return { date: ymd(start), startMin: sm, endMin: Math.min(24 * 60, sm + 30) };
}

export const durLabel = (s: { startMin: number; endMin: number }) => `${hm(s.startMin)}–${hm(s.endMin)}`;
export const occDur = (o: SchedOcc) => Math.round((o.end - o.start) / MIN);
