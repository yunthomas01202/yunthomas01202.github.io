// 간격 반복(SM-2 변형) — 플래시카드 복습 일정
import type { SrsState } from './types';
import { DAY, MIN, startOfDay } from './date';

export type Grade = 0 | 1 | 2 | 3; // 다시 / 어려움 / 좋음 / 쉬움

export const GRADE_LABEL = ['다시', '어려움', '좋음', '쉬움'];

export const newSrs = (): SrsState => ({ due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0 });

export function review(s: SrsState, g: Grade, now = Date.now()): SrsState {
  let { interval, ease, reps, lapses } = s;
  if (g === 0) {
    return { due: now + 10 * MIN, interval: 0, ease: Math.max(1.3, ease - 0.2), reps: 0, lapses: lapses + 1 };
  }
  if (reps === 0) interval = g === 3 ? 3 : 1;
  else if (reps === 1) interval = g === 1 ? 2 : g === 2 ? 3 : 6;
  else interval = Math.max(interval + 1, Math.round(interval * (g === 1 ? 1.2 : g === 2 ? ease : ease * 1.3)));
  ease = Math.max(1.3, ease + (g === 1 ? -0.15 : g === 3 ? 0.15 : 0));
  // 그 날 새벽 4시에 복습 대상이 되도록
  const due = startOfDay(now + interval * DAY).getTime() + 4 * 3_600_000;
  return { due, interval, ease, reps: reps + 1, lapses };
}

export function nextLabel(s: SrsState, g: Grade): string {
  const r = review(s, g);
  if (r.interval === 0) return '10분';
  if (r.interval < 30) return `${r.interval}일`;
  if (r.interval < 365) return `${Math.round(r.interval / 30)}달`;
  return `${(r.interval / 365).toFixed(1)}년`;
}

/** 백지 복습 점수 → 다음 복습까지 일 수 */
export function recallNextDays(score: number, prevCount: number): number {
  const base = score >= 90 ? 7 : score >= 75 ? 4 : score >= 55 ? 2 : 1;
  return Math.min(60, base * Math.max(1, Math.round(prevCount / 2) + 1));
}
