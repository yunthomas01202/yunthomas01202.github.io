// 앱 잠금 (공부하는 동안 다른 앱·사이트 막기)
//  - iOS: Apple 스크린 타임 API (react-native-device-activity) — Safari 포함 앱/웹사이트 선택 가능
//  - Android: 이 프로젝트의 로컬 네이티브 모듈 modules/app-blocker (사용 정보 접근 + 다른 앱 위에 표시 권한)
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';

let RNDA: any = null;
if (Platform.OS === 'ios') {
  try {
    RNDA = require('react-native-device-activity');
  } catch {
    RNDA = null;
  }
}
const Blocker: any = Platform.OS === 'android' ? requireOptionalNativeModule('AppBlocker') : null;

export const IOS_SELECTION_ID = 'study-focus';
const UNTIL_KEY = 'applock-until';
const SEL_KEY = 'applock-ios-selection';

export const DeviceActivitySelectionView: any = RNDA?.DeviceActivitySelectionView ?? null;

export function lockAvailable(): boolean {
  return Platform.OS === 'ios' ? !!RNDA : !!Blocker;
}

/* ───────── 권한 ───────── */

export interface LockPermissions {
  ready: boolean;
  usage?: boolean; // Android
  overlay?: boolean; // Android
  screenTime?: boolean; // iOS
}

export async function getPermissions(): Promise<LockPermissions> {
  try {
    if (Platform.OS === 'ios') {
      const st = RNDA?.getAuthorizationStatus?.();
      const ok = st === 2 || st === 'approved';
      return { ready: ok, screenTime: ok };
    }
    if (!Blocker) return { ready: false };
    const usage = !!Blocker.hasUsageAccess();
    const overlay = !!Blocker.canDrawOverlays();
    return { ready: usage && overlay, usage, overlay };
  } catch {
    return { ready: false };
  }
}

export async function requestScreenTime() {
  await RNDA?.requestAuthorization?.();
}
export const openUsageSettings = () => Blocker?.openUsageAccessSettings();
export const openOverlaySettings = () => Blocker?.openOverlaySettings();

/* ───────── 앱 고르기 ───────── */

export async function androidApps(): Promise<{ packageName: string; label: string }[]> {
  if (!Blocker) return [];
  const list = await Blocker.getLaunchableApps();
  return (list || []).sort((a: any, b: any) => a.label.localeCompare(b.label));
}

export async function saveIosSelection(selection: string) {
  await AsyncStorage.setItem(SEL_KEY, selection);
  RNDA?.setFamilyActivitySelectionId?.({ id: IOS_SELECTION_ID, familyActivitySelection: selection });
}
export async function loadIosSelection(): Promise<string | null> {
  return AsyncStorage.getItem(SEL_KEY);
}

/* ───────── 잠그기 / 풀기 ───────── */

export async function startLock(minutes: number, androidPackages: string[]) {
  const until = Date.now() + minutes * 60_000;
  await AsyncStorage.setItem(UNTIL_KEY, String(until));
  if (Platform.OS === 'ios') {
    RNDA?.updateShield?.(
      {
        title: '지금은 공부 시간이에요 📚',
        subtitle: '학습지원 앱에서 켠 집중 잠금이 걸려 있어요.',
        primaryButtonLabel: '돌아가서 공부하기',
      },
      { primary: { behavior: 'close' } },
    );
    RNDA?.blockSelection?.({ activitySelectionId: IOS_SELECTION_ID });
  } else {
    Blocker?.startBlocking(androidPackages, until, '지금은 공부 시간이에요 📚', '집중 잠금이 끝나면 다시 쓸 수 있어요.');
  }
  return until;
}

export async function stopLock() {
  await AsyncStorage.removeItem(UNTIL_KEY);
  if (Platform.OS === 'ios') {
    try {
      RNDA?.unblockSelection?.({ activitySelectionId: IOS_SELECTION_ID });
    } catch {}
    try {
      RNDA?.resetBlocks?.();
    } catch {}
  } else {
    Blocker?.stopBlocking();
  }
}

export async function lockUntil(): Promise<number> {
  return Number((await AsyncStorage.getItem(UNTIL_KEY)) || 0);
}

/** 앱을 열 때 호출: 잠금 시간이 지났으면 자동 해제 (iOS는 앱이 직접 풀어야 함) */
export async function releaseExpiredLock() {
  const u = await lockUntil();
  if (u && u < Date.now()) await stopLock();
}

/** Android: 이 앱 화면 고정 (다른 앱으로 못 나가게) */
export const pinThisApp = () => Blocker?.startScreenPinning?.();
export const unpinThisApp = () => Blocker?.stopScreenPinning?.();
