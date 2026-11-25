// 키보드 단축키 (웹·키보드 연결된 태블릿 브라우저)
//  - 화면별 단축키: useScreenHotkeys — 그 화면이 보이는 동안만 document 에 등록
//  - 전역 단축키: useGlobalHotkeys — window 에 등록, 화면 단축키가 처리(preventDefault)한 키는 건너뜀
//    (이벤트는 document → window 순서로 올라가므로 화면 단축키가 먼저 받습니다)
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { create } from 'zustand';
import { useData } from './store';

export type KeyHandler = (e: KeyboardEvent) => boolean | void;

const isWeb = Platform.OS === 'web' && typeof document !== 'undefined';

/** 글자 입력 중이면 단축키를 쓰지 않음 */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!el.isContentEditable;
}

/** 대소문자·한글 자판 상태와 무관하게 쓰는 키 이름 (KeyA → 'a', Digit1 → '1') */
export function keyOf(e: KeyboardEvent): string {
  const c = e.code || '';
  if (c.startsWith('Key')) return c.slice(3).toLowerCase();
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad') && /\d$/.test(c)) return c.slice(-1);
  if (c === 'Space') return ' ';
  if (c === 'Slash' && e.shiftKey) return '?';
  return e.key;
}

function attach(target: Document | Window, handler: KeyHandler, respectHandled: boolean) {
  const h = (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (respectHandled && e.defaultPrevented) return;
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    // 버튼에 포커스가 있을 때 Space·Enter 는 그 버튼을 누르는 키이므로 양보
    if ((e.code === 'Space' || e.key === 'Enter') && (e.target as HTMLElement)?.closest?.('button,a,[role="button"],[role="link"]')) return;
    if (useData.getState().settings.hotkeys === false) return;
    if (useHelp.getState().open && keyOf(e) !== '?' && e.key !== 'Escape') return;
    if (handler(e) === true) e.preventDefault();
  };
  target.addEventListener('keydown', h);
  return () => target.removeEventListener('keydown', h);
}

/** 이 화면이 보이는 동안만 동작. handler 가 true 를 돌려주면 처리한 것으로 봄 */
export function useScreenHotkeys(handler: KeyHandler) {
  const ref = useRef(handler);
  ref.current = handler;
  useFocusEffect(
    useCallback(() => {
      if (!isWeb) return undefined;
      return attach(document, (e) => ref.current(e), false);
    }, []),
  );
}

/** 앱 어디서나 동작 (화면 단축키가 먼저) */
export function useGlobalHotkeys(handler: KeyHandler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!isWeb) return undefined;
    return attach(window, (e) => ref.current(e), true);
  }, []);
}

/* ───────── 단축키 도움말 ───────── */

export const useHelp = create<{ open: boolean }>(() => ({ open: false }));
export const openHotkeyHelp = () => useHelp.setState({ open: true });
export const closeHotkeyHelp = () => useHelp.setState({ open: false });
export const hotkeysAvailable = () => isWeb;

export const HOTKEY_GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: '어디서나',
    keys: [
      ['S', '공부 타이머 열기'],
      ['F', '집중 화면 (타이머 진행 중)'],
      ['P', '휴식 / 계속 (타이머 진행 중)'],
      ['C', '캘린더 짜기'],
      ['?', '단축키 도움말'],
    ],
  },
  {
    title: '공부 타이머',
    keys: [
      ['1 – 9', 'n번째 과목 시작 · 같은 과목이면 휴식/계속'],
      ['Space', '휴식 / 계속'],
      ['E', '끝내고 기록'],
    ],
  },
  {
    title: '집중 화면',
    keys: [
      ['Space', '휴식 / 계속'],
      ['F', '전체 화면 켜기 / 끄기'],
      ['E', '끝내고 기록'],
      ['Esc · Q', '집중 화면 닫기'],
    ],
  },
  {
    title: '카드 복습',
    keys: [
      ['Space · Enter', '뒤집기 (정답 보기)'],
      ['1 2 3 4', '다시 · 어려움 · 좋음 · 쉬움'],
      ['Esc', '복습 끝내기'],
    ],
  },
  {
    title: '캘린더 짜기',
    keys: [
      ['← →', '이전 / 다음'],
      ['T', '오늘로'],
      ['D · W · M', '일 / 주 / 월 보기'],
      ['N', '일반 일정 추가'],
      ['L', '할 일 목록 열기'],
    ],
  },
  {
    title: '필기 (PDF·노트 화면 안에서)',
    keys: [
      ['V', '손 (이동)'],
      ['P · H · E', '펜 · 형광펜 · 지우개'],
      ['T', '텍스트 선택 (PDF)'],
      ['S', '스포트라이트 (↑ ↓ 로 이동)'],
      ['C', '영역 잘라 카드 만들기'],
      ['1 – 6', '펜·형광펜 색'],
      ['[ ]', '굵기 줄이기 / 늘리기'],
      ['+ − 0', '확대 / 축소 / 100%'],
      ['Ctrl+Z · Ctrl+Shift+Z · Ctrl+Y', '실행 취소 / 다시 실행'],
      ['Esc', '이전 도구로'],
    ],
  },
];
