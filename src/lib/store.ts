// ─────────────────────────────────────────────────────────────
// 데이터 저장소
//  - 로그인한 사용자의 Firestore 컬렉션(users/{uid}/...)을 실시간 구독해 메모리에 보관
//  - Firestore 네이티브 SDK의 오프라인 캐시 덕분에 인터넷이 없어도 읽기/쓰기가 됩니다
//  - 쓰기는 기다리지 않습니다(오프라인에선 서버 확인까지 Promise가 끝나지 않기 때문)
// ─────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  query,
  where,
} from './fb';
import type {
  Base,
  Card,
  Deck,
  Folder,
  ID,
  PerfBlock,
  PerfCategory,
  PerfEvent,
  PerfItem,
  QuickLink,
  RecallLog,
  Schedule,
  WrongNote,
  Homework,
  Season,
  Settings,
  StudyApp,
  StudyFile,
  StudySession,
  Subject,
  Task,
} from './types';
import { DEFAULT_SETTINGS } from './types';

export const COLLECTIONS = [
  'seasons',
  'subjects',
  'tasks',
  'perfCategories',
  'perfItems',
  'perfBlocks',
  'events',
  'folders',
  'files',
  'decks',
  'cards',
  'apps',
  'sessions',
  'links',
  'recallLogs',
  'schedules',
  'wrongNotes',
  'homework',
] as const;

export type CollName = (typeof COLLECTIONS)[number];

export interface CollTypes {
  seasons: Season;
  subjects: Subject;
  tasks: Task;
  perfCategories: PerfCategory;
  perfItems: PerfItem;
  perfBlocks: PerfBlock;
  events: PerfEvent;
  folders: Folder;
  files: StudyFile;
  decks: Deck;
  cards: Card;
  apps: StudyApp;
  sessions: StudySession;
  links: QuickLink;
  recallLogs: RecallLog;
  schedules: Schedule;
  wrongNotes: WrongNote;
  homework: Homework;
}

type Maps = { [K in CollName]: Record<ID, CollTypes[K]> };

export interface DataState extends Maps {
  uid: string | null;
  settings: Settings;
  ready: boolean;
}

const emptyMaps = (): Maps => Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) as unknown as Maps;

export const useData = create<DataState>(() => ({
  uid: null,
  settings: DEFAULT_SETTINGS,
  ready: false,
  ...emptyMaps(),
}));

/* ───────── 이 기기에만 저장 (로그인 없이) ───────── */

export const LOCAL_UID = 'local';
const LOCAL_KEY = 'local-data-v1';
export const isLocal = () => useData.getState().uid === LOCAL_UID;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistLocal() {
  if (!isLocal()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const s: any = useData.getState();
    const out: any = { settings: s.settings };
    for (const c of COLLECTIONS) out[c] = s[c];
    AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(out)).catch(warn);
  }, 300);
}
useData.subscribe(() => persistLocal());

async function startLocal() {
  useData.setState({ uid: LOCAL_UID, ready: false, settings: DEFAULT_SETTINGS, ...emptyMaps() });
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const v = raw ? JSON.parse(raw) : {};
    const patch: any = { settings: { ...DEFAULT_SETTINGS, ...(v.settings || {}) } };
    for (const c of COLLECTIONS) patch[c] = v[c] || {};
    useData.setState(patch);
  } catch (e) {
    warn(e);
  }
  useData.setState({ ready: true });
}

/* ───────── 구독 ───────── */

let unsubs: (() => void)[] = [];
let readyTimer: ReturnType<typeof setTimeout> | null = null;

export function stopSync() {
  unsubs.forEach((u) => {
    try {
      u();
    } catch {}
  });
  unsubs = [];
  if (readyTimer) clearTimeout(readyTimer);
}

export function startSync(uid: string) {
  stopSync();
  if (uid === LOCAL_UID) {
    startLocal();
    return;
  }
  useData.setState({ uid, ready: false, settings: DEFAULT_SETTINGS, ...emptyMaps() });
  const db = getFirestore();
  const loaded = new Set<string>();
  const total = COLLECTIONS.length + 1;
  const mark = (k: string) => {
    if (loaded.has(k)) return;
    loaded.add(k);
    if (loaded.size >= total) useData.setState({ ready: true });
  };

  for (const c of COLLECTIONS) {
    let ref: any = collection(db, 'users', uid, c);
    if (c === 'sessions') {
      // 공부 기록은 최근 400일만 구독
      ref = query(ref, where('start', '>=', Date.now() - 400 * 86_400_000));
    }
    const unsub = onSnapshot(
      ref,
      (snap: any) => {
        const map: Record<string, any> = {};
        snap.docs.forEach((d: any) => {
          map[d.id] = { ...d.data(), id: d.id };
        });
        useData.setState({ [c]: map } as Partial<DataState>);
        mark(c);
      },
      (err: any) => {
        console.warn('[sync]', c, err?.message);
        mark(c);
      },
    );
    unsubs.push(unsub);
  }

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap: any) => {
        const data = snap?.data?.() || {};
        useData.setState({ settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) } });
        mark('settings');
      },
      () => mark('settings'),
    ),
  );

  // 오프라인 첫 실행 등으로 응답이 늦어도 4초 뒤엔 화면을 연다
  readyTimer = setTimeout(() => useData.setState({ ready: true }), 4000);
}

/* ───────── 쓰기 ───────── */

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/** Firestore는 undefined를 거부하므로 재귀적으로 제거 */
export function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => clean(x)) as any;
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) {
      if (val !== undefined) out[k] = clean(val);
    }
    return out;
  }
  return v;
}

function uidOrThrow(): string {
  const uid = useData.getState().uid;
  if (!uid) throw new Error('로그인이 필요합니다');
  return uid;
}

const ref = (c: string, id: string) => doc(getFirestore(), 'users', uidOrThrow(), c, id);
const warn = (e: any) => console.warn('[write]', e?.message || e);

type NewDoc<K extends CollName> = Omit<CollTypes[K], 'id' | 'createdAt'> & Partial<Base>;

export function add<K extends CollName>(c: K, data: NewDoc<K>): string {
  const id = data.id || newId();
  const obj = clean({ ...data, id, createdAt: data.createdAt ?? Date.now() }) as CollTypes[K];
  useData.setState((s) => ({ [c]: { ...s[c], [id]: obj } }) as any);
  if (!isLocal()) setDoc(ref(c, id), obj).catch(warn);
  return id;
}

export function update<K extends CollName>(c: K, id: ID, patch: Partial<CollTypes[K]>) {
  const p = clean({ ...patch, updatedAt: Date.now() }) as any;
  useData.setState((s) => {
    const cur = (s[c] as any)[id];
    if (!cur) return {} as any;
    return { [c]: { ...s[c], [id]: { ...cur, ...p } } } as any;
  });
  if (!isLocal()) updateDoc(ref(c, id), p).catch(warn);
}

export function remove<K extends CollName>(c: K, id: ID) {
  useData.setState((s) => {
    const next = { ...(s[c] as any) };
    delete next[id];
    return { [c]: next } as any;
  });
  if (!isLocal()) deleteDoc(ref(c, id)).catch(warn);
}

export type BatchOp =
  | { op: 'add'; c: CollName; data: any }
  | { op: 'update'; c: CollName; id: ID; data: any }
  | { op: 'remove'; c: CollName; id: ID };

/** 여러 문서를 한 번에 (최대 450개씩 끊어서) */
export function batch(ops: BatchOp[]): string[] {
  const ids: string[] = [];
  const now = Date.now();
  // 낙관적 반영
  useData.setState((s) => {
    const next: any = {};
    for (const o of ops) {
      const map = next[o.c] || { ...(s as any)[o.c] };
      if (o.op === 'add') {
        const id = o.data.id || newId();
        o.data = clean({ ...o.data, id, createdAt: o.data.createdAt ?? now });
        map[id] = o.data;
        ids.push(id);
      } else if (o.op === 'update') {
        o.data = clean({ ...o.data, updatedAt: now });
        if (map[o.id]) map[o.id] = { ...map[o.id], ...o.data };
      } else {
        delete map[o.id];
      }
      next[o.c] = map;
    }
    return next;
  });
  if (isLocal()) return ids;
  const db = getFirestore();
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db);
    for (const o of ops.slice(i, i + 450)) {
      if (o.op === 'add') b.set(ref(o.c, o.data.id), o.data);
      else if (o.op === 'update') b.update(ref(o.c, o.id), o.data);
      else b.delete(ref(o.c, o.id));
    }
    b.commit().catch(warn);
  }
  return ids;
}

export function updateSettings(patch: Partial<Settings>) {
  const uid = uidOrThrow();
  const next = { ...useData.getState().settings, ...patch };
  useData.setState({ settings: next });
  if (isLocal()) return;
  setDoc(doc(getFirestore(), 'users', uid), { settings: clean(next) }, { merge: true }).catch(warn);
}

/* ───────── 필기(잉크) 데이터: users/{uid}/ink/{fileId}__{pageKey} ───────── */

const localGet = async (k: string) => {
  try {
    return JSON.parse((await AsyncStorage.getItem(k)) || 'null');
  } catch {
    return null;
  }
};
const localSet = (k: string, v: any) => AsyncStorage.setItem(k, JSON.stringify(v)).catch(warn);

export async function loadInk(fileId: string): Promise<Record<string, string>> {
  const uid = uidOrThrow();
  if (isLocal()) return (await localGet('ink:' + fileId)) || {};
  const snap: any = await getDocs(query(collection(getFirestore(), 'users', uid, 'ink'), where('fileId', '==', fileId)));
  const out: Record<string, string> = {};
  snap.docs.forEach((d: any) => {
    const v = d.data();
    if (v?.key) out[v.key] = v.data || '';
  });
  return out;
}

export function saveInk(fileId: string, key: string, data: string) {
  const uid = uidOrThrow();
  if (isLocal()) {
    localGet('ink:' + fileId).then((m) => localSet('ink:' + fileId, { ...(m || {}), [key]: data }));
    return;
  }
  setDoc(doc(getFirestore(), 'users', uid, 'ink', `${fileId}__${key}`), {
    fileId,
    key,
    data,
    updatedAt: Date.now(),
  }).catch(warn);
}

export async function deleteInk(fileId: string) {
  const uid = uidOrThrow();
  if (isLocal()) return void AsyncStorage.removeItem('ink:' + fileId);
  const db = getFirestore();
  const snap: any = await getDocs(query(collection(db, 'users', uid, 'ink'), where('fileId', '==', fileId)));
  const b = writeBatch(db);
  snap.docs.forEach((d: any) => b.delete(d.ref));
  b.commit().catch(warn);
}

/* ───────── 학습 앱(아티팩트) 저장 데이터: users/{uid}/appData/{appId} ───────── */

export async function loadAppData(appId: string): Promise<{ kv: Record<string, string>; ls: Record<string, string> }> {
  const uid = uidOrThrow();
  if (isLocal()) {
    const v = (await localGet('appData:' + appId)) || {};
    return { kv: v.kv || {}, ls: v.ls || {} };
  }
  const snap: any = await getDoc(doc(getFirestore(), 'users', uid, 'appData', appId));
  const v = snap?.data?.() || {};
  return { kv: v.kv || {}, ls: v.ls || {} };
}

export function saveAppData(appId: string, data: { kv: Record<string, string>; ls: Record<string, string> }) {
  const uid = uidOrThrow();
  if (isLocal()) return void localSet('appData:' + appId, data);
  setDoc(doc(getFirestore(), 'users', uid, 'appData', appId), { ...data, updatedAt: Date.now() }).catch(warn);
}

/* ───────── 훅 ───────── */

/** 컬렉션을 배열로 (map이 바뀔 때만 다시 계산) */
export function useList<K extends CollName>(c: K): CollTypes[K][] {
  const map = useData((s) => s[c]) as Record<ID, CollTypes[K]>;
  return useMemo(() => Object.values(map), [map]);
}

export function useDoc<K extends CollName>(c: K, id: ID | undefined | null): CollTypes[K] | undefined {
  return useData((s) => (id ? (s[c] as any)[id] : undefined));
}

export const getState = () => useData.getState();
