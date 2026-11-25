// 알람 (안드로이드 기본 시계 앱 스타일)
//  - 실제 알람은 로컬 네이티브 모듈 modules/alarm-clock 이 기기에 저장·예약합니다 (재부팅해도 유지)
//  - 웹·iOS에서는 쓸 수 없어요
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { ensureNotificationPermission } from './notify';

const N: any = Platform.OS === 'android' ? requireOptionalNativeModule('AlarmClock') : null;

export type AlarmMode = 'sound' | 'vibrate' | 'both';
export type VibePattern = 'basic' | 'heartbeat' | 'strong';

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  /** 0=일 … 6=토. 비어 있으면 한 번만 */
  days: number[];
  label: string;
  mode: AlarmMode;
  /** null 이면 기기 기본 알람음 */
  soundUri: string | null;
  soundName: string | null;
  enabled: boolean;
  snoozeMin: number;
  crescendo: boolean;
  vibe: VibePattern;
  volume: number;
  /** 다음 울릴 시각 (읽을 때만) */
  next?: number;
}

export const alarmAvailable = () => !!N;

export function listAlarms(): Alarm[] {
  if (!N) return [];
  try {
    return JSON.parse(N.getAlarms());
  } catch {
    return [];
  }
}

export async function saveAlarm(a: Alarm): Promise<number> {
  if (!N) throw new Error('알람은 안드로이드 앱에서만 쓸 수 있어요');
  if (a.enabled) await ensureNotificationPermission();
  const { next, ...rest } = a;
  return N.saveAlarm(JSON.stringify(rest));
}

export const deleteAlarm = (id: string) => N?.deleteAlarm(id);
export const pickRingtone = (current: string | null): Promise<{ uri: string; name: string } | null> => N.pickRingtone(current);
export const pickAudioFile = (): Promise<{ uri: string; name: string } | null> => N.pickAudioFile();
export const previewAlarm = (a: Pick<Alarm, 'soundUri' | 'mode' | 'vibe' | 'volume'>) => N?.preview(a.soundUri, a.mode, a.vibe, a.volume);
export const stopPreview = () => N?.stopPreview();
export const defaultAlarmName = (): string => (N ? N.defaultAlarmName() : '기본 알람음');

export const permissionState = () => ({
  exact: N ? N.canScheduleExact() : true,
  fullScreen: N ? N.canFullScreen() : true,
});
export const openExactSettings = () => N?.openExactAlarmSettings();
export const openFullScreenSettings = () => N?.openFullScreenSettings();

export function newAlarm(partial?: Partial<Alarm>): Alarm {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    hour: 7,
    minute: 0,
    days: [],
    label: '',
    mode: 'both',
    soundUri: null,
    soundName: null,
    enabled: true,
    snoozeMin: 5,
    crescendo: false,
    vibe: 'basic',
    volume: 80,
    ...partial,
  };
}

/** "5시간 12분 후에 울려요" */
export function untilText(at: number, now = Date.now()): string {
  const m = Math.max(1, Math.round((at - now) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const parts = [d ? `${d}일` : '', h ? `${h}시간` : '', mm ? `${mm}분` : ''].filter(Boolean);
  return `${parts.join(' ')} 후에 울려요`;
}

export function timeLabel(h: number, m: number) {
  const ap = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return { ap, hm: `${hh}:${String(m).padStart(2, '0')}` };
}
