// 앱 잠금 (웹): 휴대폰 앱 전용이라 웹에서는 쓸 수 없음
export interface LockPermissions {
  ready: boolean;
  usage?: boolean;
  overlay?: boolean;
  screenTime?: boolean;
}
export const IOS_SELECTION_ID = 'study-focus';
export const DeviceActivitySelectionView: any = null;
export const lockAvailable = () => false;
export async function getPermissions(): Promise<LockPermissions> {
  return { ready: false };
}
export async function requestScreenTime() {}
export const openUsageSettings = () => {};
export const openOverlaySettings = () => {};
export async function androidApps(): Promise<{ packageName: string; label: string }[]> {
  return [];
}
export async function saveIosSelection(_s: string) {}
export async function loadIosSelection(): Promise<string | null> {
  return null;
}
export async function startLock(_minutes: number, _pk: string[]) {
  return 0;
}
export async function stopLock() {}
export async function lockUntil(): Promise<number> {
  return 0;
}
export async function releaseExpiredLock() {}
export const pinThisApp = () => {};
export const unpinThisApp = () => {};
