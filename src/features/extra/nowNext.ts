// 지금 수업 / 다음 수업 / 오늘 할 일 (홈 카드와 안드로이드 위젯이 같이 써요)
import { useMemo } from 'react';
import { useData } from '../../lib/store';
import { expandSchedules, type SchedOcc } from '../planner/schedules';
import { addDays, ymd } from '../../lib/date';

export interface NowNext {
  now: SchedOcc | null;
  next: SchedOcc | null;
  /** 오늘 남은 고정 일정 */
  rest: SchedOcc[];
  todos: { title: string; at?: number | null; color?: string }[];
}

export function computeNowNext(st: ReturnType<typeof useData.getState>, at = Date.now()): NowNext {
  const today = ymd(at);
  const occ = expandSchedules(Object.values(st.schedules), today, ymd(addDays(at, 1)));
  const now = occ.find((o) => o.start <= at && at < o.end) || null;
  const next = occ.find((o) => o.start > at) || null;
  const rest = occ.filter((o) => o.date === today && o.end > at);
  const subj = st.subjects;
  const todos: NowNext['todos'] = [];
  for (const tk of Object.values(st.tasks)) {
    if (tk.status !== 'todo' || !tk.start || ymd(tk.start) !== today) continue;
    todos.push({ title: tk.title, at: tk.start, color: subj[tk.subjectId]?.color });
  }
  for (const h of Object.values(st.homework || {})) {
    if (!h.done && h.due === today) todos.push({ title: `마감 · ${h.title}`, at: null, color: '#F76B15' });
  }
  todos.sort((a, b) => (a.at || 9e15) - (b.at || 9e15));
  return { now, next, rest, todos };
}

export function useNowNext(tick: number) {
  const schedules = useData((s) => s.schedules);
  const tasks = useData((s) => s.tasks);
  const homework = useData((s) => s.homework);
  return useMemo(() => computeNowNext(useData.getState()), [schedules, tasks, homework, tick]);
}

/** 위젯에 넘길 오늘~내일 일정 (네이티브가 현재 시각으로 지금/다음을 고름) */
export function widgetPayload(st: ReturnType<typeof useData.getState>, lunch: string | null) {
  const now = Date.now();
  const today = ymd(now);
  const occ = expandSchedules(Object.values(st.schedules), today, ymd(addDays(now, 1))).map((o) => ({ t: o.title, s: o.start, e: o.end, c: o.color }));
  const nn = computeNowNext(st, now);
  return {
    occ,
    todos: nn.todos.slice(0, 4).map((x) => x.title),
    lunch: lunch || '',
    style: st.settings.widgetStyle || 'dark',
    accent: st.settings.accent || '#4F46E5',
    updated: now,
  };
}
