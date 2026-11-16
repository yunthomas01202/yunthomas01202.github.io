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
}

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
  persist({ subject, color, source, taskId: taskId ?? null, segStart: now, pausedAt: null, segments: [], restSec: 0, startedAt: now });
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

/** 멈추고 기록 저장. 1분 미만 구간은 버림 */
export function stopTimer(save = true): number {
  const r = getRunning();
  if (!r) return 0;
  const now = Date.now();
  const segs = r.segStart ? [...r.segments, { start: r.segStart, end: now }] : r.segments;
  const total = Math.floor(segs.reduce((a, s) => a + (s.end - s.start), 0) / 1000);
  if (save) {
    const valid = segs.filter((s) => s.end - s.start >= 60_000);
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
