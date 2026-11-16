// 로컬 알림: 배치한 블록 시작 N분 전 알림 (앱을 열 때마다 다음 24시간 분을 다시 예약)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let asked = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('study', {
        name: '공부 알림',
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
        vibrationPattern: [0, 200],
      });
    }
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (asked) return false;
    asked = true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export interface Reminder {
  id: string;
  title: string;
  body: string;
  at: number;
}

export async function rescheduleReminders(items: Reminder[]) {
  try {
    const ok = await ensureNotificationPermission();
    if (!ok) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n: any) => n.content?.data?.kind === 'block')
        .map((n: any) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    const now = Date.now();
    const upcoming = items.filter((i) => i.at > now + 30_000 && i.at < now + 36 * 3_600_000).slice(0, 48);
    for (const it of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: { title: it.title, body: it.body, data: { kind: 'block', id: it.id }, sound: false },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(it.at),
          channelId: 'study',
        } as any,
      });
    }
  } catch (e) {
    console.warn('[notify]', e);
  }
}

export async function notifyNow(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: null,
    });
  } catch {}
}

export async function scheduleAt(title: string, body: string, at: number, tag: string): Promise<string | null> {
  try {
    const ok = await ensureNotificationPermission();
    if (!ok) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false, data: { kind: tag } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'study' } as any,
    });
  } catch {
    return null;
  }
}

export async function cancelById(id: string | null | undefined) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}
