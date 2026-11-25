// 공부 배경음: 빗소리·카페·백색소음 등을 여러 개 겹쳐 켜고 끄기, 타이머가 끝나면 서서히 줄이기
import { create } from 'zustand';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export interface Ambient {
  key: string;
  name: string;
  emoji: string;
  file: any;
}

export const AMBIENTS: Ambient[] = [
  { key: 'rain', name: '빗소리', emoji: '🌧️', file: require('../../assets/sounds/rain.mp3') },
  { key: 'cafe', name: '카페', emoji: '☕', file: require('../../assets/sounds/cafe.mp3') },
  { key: 'white', name: '백색소음', emoji: '🌫️', file: require('../../assets/sounds/white.mp3') },
  { key: 'pink', name: '핑크노이즈', emoji: '🌸', file: require('../../assets/sounds/pink.mp3') },
  { key: 'brown', name: '브라운노이즈', emoji: '🟤', file: require('../../assets/sounds/brown.mp3') },
  { key: 'waves', name: '파도', emoji: '🌊', file: require('../../assets/sounds/waves.mp3') },
  { key: 'fire', name: '모닥불', emoji: '🔥', file: require('../../assets/sounds/fire.mp3') },
];

interface AState {
  /** key → 음량 0~1 (목록에 있으면 켜진 것) */
  on: Record<string, number>;
  master: number;
  fading: boolean;
  /** 타이머가 끝나면 서서히 끄기 */
  fadeWithTimer: boolean;
}

export const useAmbient = create<AState>(() => ({ on: {}, master: 0.8, fading: false, fadeWithTimer: true }));

const players: Record<string, AudioPlayer> = {};
let modeSet = false;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

async function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' } as any);
  } catch {}
}

function apply() {
  const { on, master } = useAmbient.getState();
  for (const a of AMBIENTS) {
    const v = on[a.key];
    const p = players[a.key];
    if (v === undefined) {
      if (p) {
        try {
          p.pause();
          p.remove();
        } catch {}
        delete players[a.key];
      }
      continue;
    }
    let pl = p;
    if (!pl) {
      pl = createAudioPlayer(a.file);
      pl.loop = true;
      players[a.key] = pl;
    }
    pl.volume = Math.max(0, Math.min(1, v * master));
    if (!pl.playing) pl.play();
  }
}

export function toggleAmbient(key: string) {
  ensureMode();
  stopFade();
  const on = { ...useAmbient.getState().on };
  if (on[key] !== undefined) delete on[key];
  else on[key] = 0.7;
  useAmbient.setState({ on });
  apply();
}

export function setAmbientVolume(key: string, v: number) {
  const on = { ...useAmbient.getState().on };
  if (on[key] === undefined) return;
  on[key] = v;
  useAmbient.setState({ on });
  apply();
}

export function setMaster(v: number) {
  stopFade();
  useAmbient.setState({ master: v });
  apply();
}

export function stopAllAmbient() {
  stopFade();
  useAmbient.setState({ on: {} });
  apply();
}

function stopFade() {
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = null;
  if (useAmbient.getState().fading) useAmbient.setState({ fading: false });
}

/** 서서히 줄여서 끄기 (기본 20초) */
export function fadeOutAmbient(sec = 20) {
  const st = useAmbient.getState();
  if (!Object.keys(st.on).length || st.fading) return;
  const start = st.master;
  const steps = Math.max(1, Math.round(sec * 4));
  let i = 0;
  useAmbient.setState({ fading: true });
  fadeTimer = setInterval(() => {
    i++;
    const m = start * (1 - i / steps);
    for (const a of AMBIENTS) {
      const v = useAmbient.getState().on[a.key];
      if (v !== undefined && players[a.key]) players[a.key].volume = Math.max(0, v * m);
    }
    if (i >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      useAmbient.setState({ on: {}, fading: false, master: start });
      apply();
    }
  }, 250);
}

/** 타이머가 끝났을 때 부르기 */
export function onTimerFinished() {
  if (useAmbient.getState().fadeWithTimer) fadeOutAmbient();
}

export const ambientPlaying = () => Object.keys(useAmbient.getState().on).length > 0;
