// 오답 노트 간격 반복 · 연속 공부(스트릭) · 마감 · 수면 계산 · 알림 예약
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { Homework, StudySession, WrongNote } from '../../lib/types';
import { add, getState, update } from '../../lib/store';
import { addDays, atMinutes, parseYmd, ymd } from '../../lib/date';

/* ───────── 오답 노트 ───────── */

/** 등록 후 1일 → 맞히면 3일 → 7일 → 14일 → 졸업 */
export const WRONG_INTERVALS = [1, 3, 7, 14];
export const WRONG_STAGE_LABEL = ['1일 뒤', '3일 뒤', '7일 뒤', '14일 뒤', '졸업'];

export function addWrongNote(p: { subject: string; title: string; image?: string | null; note?: string; answer?: string }) {
  return add('wrongNotes', {
    ...p,
    stage: 0,
    nextReview: ymd(addDays(new Date(), WRONG_INTERVALS[0])),
    wrongCount: 1,
    lastReviewed: null,
  } as any);
}

export function reviewWrong(n: WrongNote, correct: boolean) {
  const today = new Date();
  if (correct) {
    const stage = n.stage + 1;
    update('wrongNotes', n.id, {
      stage,
      nextReview: stage >= WRONG_INTERVALS.length ? null : ymd(addDays(today, WRONG_INTERVALS[stage])),
      lastReviewed: Date.now(),
    });
  } else {
    update('wrongNotes', n.id, {
      stage: 0,
      nextReview: ymd(addDays(today, WRONG_INTERVALS[0])),
      lastReviewed: Date.now(),
      wrongCount: (n.wrongCount || 1) + 1,
    });
  }
}

export const isDue = (n: WrongNote, today = ymd()) => !!n.nextReview && n.nextReview <= today;

/** 사진 찍기/고르기 → 동기화되도록 작게 줄인 JPEG data URL */
export async function pickPhoto(camera: boolean): Promise<string | null> {
  if (camera && Platform.OS !== 'web') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('카메라 권한이 필요해요');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: Platform.OS !== 'web' };
  const r = camera && Platform.OS !== 'web' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const w = a.width || 1200;
  const out = await manipulateAsync(a.uri, w > 1000 ? [{ resize: { width: 1000 } }] : [], {
    compress: 0.6,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!out.base64) return out.uri;
  return 'data:image/jpeg;base64,' + out.base64;
}

/* ───────── 연속 공부 (스트릭) ───────── */

export function studyMinutesByDay(sessions: StudySession[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of sessions) {
    const d = ymd(s.start);
    m[d] = (m[d] || 0) + s.sec / 60;
  }
  return m;
}

/** 하루 최소 기준(분)을 넘긴 날이 이어진 수 */
export function streakInfo(byDay: Record<string, number>, minMin = 10) {
  const ok = (d: string) => (byDay[d] || 0) >= minMin;
  const today = ymd();
  let cur = 0;
  let d = new Date();
  if (!ok(today)) d = addDays(d, -1); // 오늘 아직 안 했으면 어제까지로 셈
  while (ok(ymd(d))) {
    cur++;
    d = addDays(d, -1);
  }
  let best = 0;
  let run = 0;
  const days = Object.keys(byDay).sort();
  if (days.length) {
    for (let x = parseYmd(days[0]); ymd(x) <= today; x = addDays(x, 1)) {
      if (ok(ymd(x))) {
        run++;
        best = Math.max(best, run);
      } else run = 0;
    }
  }
  const total = Object.values(byDay).filter((v) => v >= minMin).length;
  return { current: cur, best: Math.max(best, cur), totalDays: total, doneToday: ok(today) };
}

/** 분 → 잔디 단계 0~4 */
export function grassLevel(min: number, goal: number) {
  if (!min) return 0;
  const r = min / Math.max(30, goal);
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 1) return 3;
  return 4;
}

/* ───────── 마감 ───────── */

export function dueAt(h: Homework) {
  return atMinutes(h.due, h.dueMin ?? 23 * 60 + 59);
}

export function addHomework(p: Omit<Homework, 'id' | 'createdAt' | 'updatedAt' | 'done'>) {
  return add('homework', { ...p, done: false } as any);
}

/* ───────── 수면 계산 ───────── */

export const CYCLE_MIN = 90;

/** 일어날 시각(분) → 잘 시각 후보들 (주기 6·5·4·3) */
export function bedtimesFor(wakeMin: number, fallAsleep: number) {
  return [6, 5, 4, 3].map((c) => {
    const m = (((wakeMin - c * CYCLE_MIN - fallAsleep) % 1440) + 1440) % 1440;
    return { cycles: c, sleepH: (c * CYCLE_MIN) / 60, bedMin: m };
  });
}

/** 지금 자면 → 일어날 시각 후보들 */
export function wakeTimesFrom(nowMin: number, fallAsleep: number) {
  return [3, 4, 5, 6].map((c) => {
    const m = (nowMin + fallAsleep + c * CYCLE_MIN) % 1440;
    return { cycles: c, sleepH: (c * CYCLE_MIN) / 60, wakeMin: m };
  });
}

