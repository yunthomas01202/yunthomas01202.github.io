// 웹 집중 기록: 공부 타이머가 도는 동안 탭을 옮기거나 다른 창으로 가면 '이탈'로 기록
//  - 브라우저는 다른 앱을 막을 수 없어서, 대신 벗어난 횟수·시간을 남겨 리포트에 보여줍니다
//  - 필기 화면의 iframe 을 클릭해 생기는 blur 는 이탈이 아님
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getState } from '../../lib/store';
import { toast } from '../../components/ui';
import { fmtShortDur } from '../../lib/date';
import { awayStats, getRunning, markAway, markBack, pauseTimer } from './timerStore';

const isWeb = Platform.OS === 'web' && typeof document !== 'undefined';

export function useFocusGuard() {
  useEffect(() => {
    if (!isWeb) return undefined;
    let savedTitle: string | null = null;
    let pausedByLeave = false;

    const leave = () => {
      const r = getRunning();
      if (!r || !r.segStart) return;
      const s = getState().settings;
      if (s.trackAway !== false) markAway();
      if (s.pauseOnLeave) {
        pauseTimer();
        pausedByLeave = true;
      }
      if (savedTitle === null) {
        savedTitle = document.title;
        document.title = `⏸ ${r.subject} 공부 중이에요`;
      }
    };

    const back = () => {
      if (savedTitle !== null) {
        document.title = savedTitle;
        savedTitle = null;
      }
      const sec = markBack();
      const r = getRunning();
      if (pausedByLeave) {
        pausedByLeave = false;
        toast(sec ? `${fmtShortDur(sec)} 자리를 비워서 일시정지했어요` : '자리를 비워서 일시정지했어요');
      } else if (sec && r) {
        const st = awayStats(r);
        toast(`${fmtShortDur(sec)} 동안 벗어났어요 · 이번 공부에서 ${st.count}번째`);
      }
    };

    const onVis = () => (document.hidden ? leave() : back());
    const onBlur = () => {
      // 포커스가 화면 안 iframe(필기 엔진·학습 앱)으로 옮겨간 경우는 무시
      setTimeout(() => {
        if (document.hidden) return;
        const a = document.activeElement as HTMLElement | null;
        if (a && a.tagName === 'IFRAME') return;
        if (!document.hasFocus()) leave();
      }, 0);
    };
    const onFocus = () => {
      if (!document.hidden) back();
    };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      if (savedTitle !== null) document.title = savedTitle;
    };
  }, []);
}

/* ───────── 전체 화면 (웹) ───────── */

export const fullscreenSupported = () => isWeb && !!document.documentElement?.requestFullscreen;
export const isFullscreen = () => isWeb && !!document.fullscreenElement;

export async function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported() || document.fullscreenElement) return !!document.fullscreenElement;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' } as any);
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen() {
  if (!isWeb || !document.fullscreenElement) return;
  try {
    await document.exitFullscreen();
  } catch {}
}

export function onFullscreenChange(cb: (on: boolean) => void): () => void {
  if (!isWeb) return () => {};
  const h = () => cb(!!document.fullscreenElement);
  document.addEventListener('fullscreenchange', h);
  return () => document.removeEventListener('fullscreenchange', h);
}
