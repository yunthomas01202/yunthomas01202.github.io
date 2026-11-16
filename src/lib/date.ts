// 외부 라이브러리 없이 쓰는 날짜 유틸 (모두 기기 현지 시각 기준)

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => (n < 10 ? '0' + n : String(n));

export function ymd(d: Date | number = new Date()): string {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfDay(d: Date | number): Date {
  const x = new Date(typeof d === 'number' ? d : d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date | number, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return x;
}

export function startOfWeek(d: Date | number, weekStartsOn: 0 | 1 = 1): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function startOfMonth(d: Date | number): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function sameDay(a: Date | number, b: Date | number): boolean {
  return ymd(a) === ymd(b);
}

export function isToday(d: Date | number | string): boolean {
  return (typeof d === 'string' ? d : ymd(d)) === ymd();
}

/** 그 날 0시 기준 분 → epoch ms */
export function atMinutes(day: Date | number | string, minutes: number): number {
  const base = typeof day === 'string' ? parseYmd(day) : startOfDay(day);
  return base.getTime() + minutes * MIN;
}

export function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtMinOfDay(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function weekdayKo(d: Date | number): string {
  return WEEKDAYS[new Date(typeof d === 'number' ? d : d.getTime()).getDay()];
}

/** 11월 16일 (월) */
export function fmtKDate(d: Date | number | string, withWeekday = true): string {
  const x = typeof d === 'string' ? parseYmd(d) : new Date(typeof d === 'number' ? d : d.getTime());
  const base = `${x.getMonth() + 1}월 ${x.getDate()}일`;
  return withWeekday ? `${base} (${WEEKDAYS[x.getDay()]})` : base;
}

export function fmtYM(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** 오늘 기준 D-day 숫자 (양수 = 남은 날) */
export function daysUntil(dateStr: string): number {
  const t = startOfDay(new Date()).getTime();
  const d = parseYmd(dateStr).getTime();
  return Math.round((d - t) / DAY);
}

export function ddayLabel(n: number): string {
  if (n === 0) return 'D-DAY';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

/** 초 → 01:23:45 */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** 분 → 1시간 20분 */
export function fmtMin(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}

/** 초 → 3h 20m 같은 짧은 표기 */
export function fmtShortDur(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / DAY);
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let d = parseYmd(from);
  const end = parseYmd(to).getTime();
  let guard = 0;
  while (d.getTime() <= end && guard++ < 1000) {
    out.push(ymd(d));
    d = addDays(d, 1);
  }
  return out;
}

export function roundTo(ms: number, stepMin: number): number {
  const step = stepMin * MIN;
  return Math.round(ms / step) * step;
}

export function inRange(dateStr: string, from: string, to: string): boolean {
  return dateStr >= from && dateStr <= to;
}
