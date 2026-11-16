// 알림 (웹): 휴대폰 앱 전용 기능이라 웹에서는 아무것도 하지 않아요
export interface Reminder {
  id: string;
  title: string;
  body: string;
  at: number;
}
export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}
export async function rescheduleReminders(_items: Reminder[]) {}
export async function notifyNow(_title: string, _body: string) {}
export async function scheduleAt(_title: string, _body: string, _at: number, _tag: string): Promise<string | null> {
  return null;
}
export async function cancelById(_id: string | null | undefined) {}
