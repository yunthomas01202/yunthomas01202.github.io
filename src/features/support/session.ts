// 공부 시작/끝 (앱 잠금 연동 포함)
import { getState } from '../../lib/store';
import { haptic, toast } from '../../components/ui';
import { getPermissions, lockAvailable, startLock, stopLock } from '../../lib/applock';
import { startTimer, stopTimer } from './timerStore';

export async function beginStudy(subject: string, color: string, taskId?: string | null, source: 'stopwatch' | 'starter' = 'stopwatch') {
  const cur = getState();
  startTimer(subject, color, source, taskId);
  haptic('medium');
  const lock = cur.settings.lockApps;
  if (lock.withTimer && lockAvailable() && (await getPermissions()).ready) {
    await startLock(240, lock.androidPackages);
    toast('집중 잠금이 켜졌어요');
  }
}

export async function endStudy(save = true): Promise<number> {
  const s = getState();
  const sec = stopTimer(save);
  if (s.settings.lockApps.withTimer && lockAvailable()) await stopLock();
  return sec;
}
