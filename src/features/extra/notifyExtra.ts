// 오답 복습 · 마감 · 잘 시간 알림 예약 (안드로이드)
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getState } from '../../lib/store';
import { addDays, atMinutes, parseYmd, ymd } from '../../lib/date';
import { ensureNotificationPermission } from '../../lib/notify';
import { bedtimesFor } from './logic';

/* ───────── 알림 예약 (안드로이드) ───────── */

const TAGS = ['wrong', 'hw', 'bed'];

export async function rescheduleExtraNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const st = getState();
    const s = st.settings;
    const wrong = Object.values(st.wrongNotes);
    const hws = Object.values(st.homework).filter((h) => !h.done);
    const needs = wrong.some((n) => n.nextReview) || hws.length || s.sleep?.bedRemind;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n: any) => TAGS.includes(n.content?.data?.kind))
        .map((n: any) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (!needs) return;
    if (!(await ensureNotificationPermission())) return;
    const now = Date.now();
    const items: { title: string; body: string; at: number; kind: string }[] = [];

    // 오답 복습: 다음 14일 중 복습할 게 있는 날, 정해진 시각에
    const hour = s.wrongNotifyHour ?? 19;
    for (let i = 0; i < 14; i++) {
      const d = ymd(addDays(new Date(), i));
      const cnt = wrong.filter((n) => n.nextReview && n.nextReview <= d && (i > 0 || n.nextReview <= d)).length;
      if (!cnt) continue;
      const at = atMinutes(d, hour * 60);
      if (at > now + 30_000) items.push({ title: '📒 오답 복습 시간', body: `다시 볼 문제가 ${cnt}개 있어요`, at, kind: 'wrong' });
    }

    // 마감: 전날 저녁 · 당일 아침
    const hn = s.homeworkNotify || { dayBefore: true, dayBeforeHour: 20, dayOf: true, dayOfHour: 7 };
    for (const h of hws) {
      if (hn.dayBefore) {
        const at = atMinutes(ymd(addDays(parseYmd(h.due), -1)), hn.dayBeforeHour * 60);
        if (at > now) items.push({ title: `⏰ 내일 마감: ${h.title}`, body: `${h.subject ? h.subject + ' · ' : ''}잊지 말고 챙기세요`, at, kind: 'hw' });
      }
      if (hn.dayOf) {
        const at = atMinutes(h.due, hn.dayOfHour * 60);
        if (at > now) items.push({ title: `🔥 오늘 마감: ${h.title}`, body: `${h.subject ? h.subject + ' · ' : ''}${h.dueMin != null ? `${Math.floor(h.dueMin / 60)}:${String(h.dueMin % 60).padStart(2, '0')}까지` : '오늘까지'}`, at, kind: 'hw' });
      }
    }

    // 잘 시간 알림: 앞으로 7일
    if (s.sleep?.bedRemind) {
      const bed = bedtimesFor(s.sleep.wake, s.sleep.fallAsleepMin).find((b) => b.cycles === (s.sleep!.cycles || 5));
      if (bed) {
        for (let i = 0; i < 7; i++) {
          const d = ymd(addDays(new Date(), i));
          const at = atMinutes(d, bed.bedMin) - 15 * 60_000;
          if (at > now) items.push({ title: '🌙 15분 뒤 잘 시간이에요', body: `지금 정리하면 ${bed.sleepH}시간 푹 잘 수 있어요`, at, kind: 'bed' });
        }
      }
    }

    items.sort((a, b) => a.at - b.at);
    for (const it of items.slice(0, 40)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: it.title, body: it.body, data: { kind: it.kind }, sound: false },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(it.at), channelId: 'study' } as any,
      });
    }
  } catch (e) {
    console.warn('[extra-notify]', e);
  }
}
