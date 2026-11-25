// 공부 타이머 상태 (앱을 꺼도 이어지도록 AsyncStorage에 저장)
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { batch } from '../../lib/store';

export interface Running {
  subject: string;
  color: string;
  source: 'stopwatch' | 'starter';
  taskId?: string | null;
  segStart: number | null; // 진행 중인 구간 시작 (일시정지면 null)
  pausedAt: number | null;
  segments: { start: number; end: number }[];
  restSec: number;
  startedAt: number;
  /** 공부 중 탭·창을 벗어났던 구간 (웹 집중 기록) */
  away?: { start: number; end: number }[];
  /** 지금 벗어나 있는 중이면 그 시작 시각 */
  awayStart?: number | null;
}

/** 이 시간보다 짧게 벗어난 건 이탈로 치지 않음 */
export const AWAY_MIN_MS = 3000;

const KEY = 'running-timer-v1';

const useTimerStore = create<{ running: Running | null }>(() => ({ running: null }));

AsyncStorage.getItem(KEY)
  .then((v: string | null) => {
    if (v) useTimerStore.setState({ running: JSON.parse(v) });
  })
  .catch(() => {});

function persist(r: Running | null) {
  useTimerStore.setState({ running: r });
  if (r) AsyncStorage.setItem(KEY, JSON.stringify(r)).catch(() => {});
  else AsyncStorage.removeItem(KEY).catch(() => {});
}

export const useRunningTimer = () => useTimerStore((s) => s.running);
export const getRunning = () => useTimerStore.getState().running;

export function elapsedSec(r: Running | null, now = Date.now()): number {
  if (!r) return 0;
  const done = r.segments.reduce((a, s) => a + (s.end - s.start), 0);
  return Math.floor((done + (r.segStart ? now - r.segStart : 0)) / 1000);
}

export function startTimer(subject: string, color: string, source: Running['source'] = 'stopwatch', taskId?: string | null) {
  const cur = getRunning();
  if (cur) stopTimer();
  const now = Date.now();
  persist({ subject, color, source, taskId: taskId ?? null, segStart: now, pausedAt: null, segments: [], restSec: 0, startedAt: now, away: [], awayStart: null });
}

export function pauseTimer() {
  const r = getRunning();
  if (!r || !r.segStart) return;
  const now = Date.now();
  persist({ ...r, segments: [...r.segments, { start: r.segStart, end: now }], segStart: null, pausedAt: now });
}

export function resumeTimer() {
  const r = getRunning();
  if (!r || r.segStart) return;
  const now = Date.now();
  persist({ ...r, segStart: now, restSec: r.restSec + (r.pausedAt ? Math.floor((now - r.pausedAt) / 1000) : 0), pausedAt: null });
}

/** 공부 중 탭·창을 벗어남 (공부 중일 때만 기록) */
export function markAway(now = Date.now()) {
  const r = getRunning();
  if (!r || !r.segStart || r.awayStart) return;
  persist({ ...r, awayStart: now });
}

/** 돌아옴. 이탈로 기록된 시간(초)을 돌려줌 (짧으면 0) */
export function markBack(now = Date.now()): number {
  const r = getRunning();
  if (!r || !r.awayStart) return 0;
  const d = now - r.awayStart;
  const counted = d >= AWAY_MIN_MS;
  persist({ ...r, away: counted ? [...(r.away || []), { start: r.awayStart, end: now }] : r.away || [], awayStart: null });
  return counted ? Math.round(d / 1000) : 0;
}

/** 진행 중인 타이머의 이탈 횟수·시간 (지금 벗어나 있는 중인 것 포함) */
export function awayStats(r: Running | null, now = Date.now()): { count: number; sec: number } {
  if (!r) return { count: 0, sec: 0 };
  const list = r.away || [];
  let sec = list.reduce((a, x) => a + (x.end - x.start), 0) / 1000;
  let count = list.length;
  if (r.awayStart && now - r.awayStart >= AWAY_MIN_MS) {
    count += 1;
    sec += (now - r.awayStart) / 1000;
  }
  return { count, sec: Math.round(sec) };
}

/** 멈추고 기록 저장. 1분 미만 구간은 버림 */
export function stopTimer(save = true): number {
  const cur = getRunning();
  if (!cur) return 0;
  const now = Date.now();
  const r: Running =
    cur.awayStart && now - cur.awayStart >= AWAY_MIN_MS
      ? { ...cur, away: [...(cur.away || []), { start: cur.awayStart, end: now }], awayStart: null }
      : cur;
  const segs = r.segStart ? [...r.segments, { start: r.segStart, end: now }] : r.segments;
  const total = Math.floor(segs.reduce((a, s) => a + (s.end - s.start), 0) / 1000);
  if (save) {
    const valid = segs.filter((s) => s.end - s.start >= 60_000);
    // 이탈 구간을 그 시각이 속한 공부 구간에 나눠 담기 (어디에도 안 맞으면 마지막 구간)
    const awayBy = valid.map(() => ({ count: 0, sec: 0 }));
    for (const a of r.away || []) {
      let i = valid.findIndex((s) => a.start >= s.start && a.start <= s.end + 1000);
      if (i < 0) i = valid.length - 1;
      if (i < 0) break;
      awayBy[i].count += 1;
      awayBy[i].sec += Math.round((a.end - a.start) / 1000);
    }
    batch(
      valid.map((s, i) => ({
        op: 'add' as const,
        c: 'sessions' as const,
        data: {
          subject: r.subject,
          color: r.color,
          start: s.start,
          end: s.end,
          sec: Math.floor((s.end - s.start) / 1000),
          restSec: i === valid.length - 1 ? r.restSec : 0,
          source: r.source,
          taskId: r.taskId ?? null,
          ...(awayBy[i].count ? { awayCount: awayBy[i].count, awaySec: awayBy[i].sec } : {}),
        },
      })),
    );
  }
  persist(null);
  return total;
}

/** 1초마다 다시 그리기 */
export function useTick(active = true, ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}
