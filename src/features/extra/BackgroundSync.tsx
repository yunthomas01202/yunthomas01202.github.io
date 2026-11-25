// 데이터가 바뀌면 (조금 기다렸다가) 알림 예약 · 홈 화면 위젯을 새로 고쳐요
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useData } from '../../lib/store';
import { todayLunch } from '../../lib/neis';
import { rescheduleExtraNotifications } from './notifyExtra';
import { widgetPayload } from './nowNext';

const N: any = Platform.OS === 'android' ? requireOptionalNativeModule('AlarmClock') : null;

async function pushWidget() {
  if (!N?.setWidgetData) return;
  try {
    const lunch = await todayLunch();
    N.setWidgetData(JSON.stringify(widgetPayload(useData.getState(), lunch)));
  } catch (e) {
    console.warn('[widget]', e);
  }
}

export function BackgroundSync() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last: any = null;
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        rescheduleExtraNotifications();
        pushWidget();
      }, 2500);
    };
    const unsub = useData.subscribe((s) => {
      if (!s.ready) return;
      const key = [s.schedules, s.tasks, s.homework, s.wrongNotes, s.settings];
      if (last && key.every((v, i) => v === last[i])) return;
      last = key;
      run();
    });
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    run();
    return () => {
      unsub();
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}
