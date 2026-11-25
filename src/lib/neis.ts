// 나이스(NEIS) 교육정보 개방 포털 오픈API: 학교 찾기, 급식, 학사일정
// https://open.neis.go.kr — 인증키 없이도 조회돼요(호출 수 제한이 낮음). 키가 있으면 설정에 넣어 주세요.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getState } from './store';
import { addDays, parseYmd, ymd as ymdOf, ymd as todayYmd } from './date';

const BASE = 'https://open.neis.go.kr/hub';

export interface SchoolHit {
  office: string; // ATPT_OFCDC_SC_CODE
  officeName: string;
  code: string; // SD_SCHUL_CODE
  name: string;
  kind: string;
  address: string;
}

export interface Meal {
  date: string; // YYYY-MM-DD
  type: string; // 조식/중식/석식
  dishes: string[];
  kcal?: string;
}

export interface SchoolEvent {
  date: string;
  name: string;
  /** 휴업일·공휴일 등 */
  off: boolean;
}

function q(params: Record<string, string | number | undefined>) {
  const key = getState().settings.neisKey;
  const p: Record<string, string> = { Type: 'json', pIndex: '1', pSize: key ? '300' : '5' };
  if (key) p.KEY = key;
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p[k] = String(v);
  return Object.entries(p)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchPage(api: string, params: Record<string, string | number | undefined>) {
  const res = await fetch(`${BASE}/${api}?${q(params)}`);
  if (!res.ok) throw new Error(`나이스 서버 응답 오류 (${res.status})`);
  const j = await res.json();
  const body = j[api];
  if (!body) {
    const code = j?.RESULT?.CODE;
    if (code === 'INFO-200') return { rows: [] as any[], total: 0 }; // 데이터 없음
    throw new Error(j?.RESULT?.MESSAGE || '나이스에서 정보를 받지 못했어요');
  }
  return { rows: (body[1]?.row || []) as any[], total: (body[0]?.head?.[0]?.list_total_count || 0) as number };
}

async function call(api: string, params: Record<string, string | number | undefined>): Promise<any[]> {
  return (await fetchPage(api, { ...params, pIndex: 1, pSize: getState().settings.neisKey ? 300 : 5 })).rows;
}

/**
 * 인증키가 없으면 나이스는 쪽 번호를 무시하고 앞의 5개만 줘요.
 * 그래서 날짜 구간을 잘게(chunkDays) 나눠 여러 번 물어봐요. 키가 있으면 한 번에.
 */
async function callRange(
  api: string,
  params: Record<string, string>,
  fromKey: string,
  toKey: string,
  from: string,
  to: string,
  chunkDays: number,
): Promise<any[]> {
  if (getState().settings.neisKey) return call(api, { ...params, [fromKey]: ymd8(from), [toKey]: ymd8(to) });
  const ranges: [string, string][] = [];
  for (let d = parseYmd(from); ymdOf(d) <= to; d = addDays(d, chunkDays)) {
    const e = addDays(d, chunkDays - 1);
    ranges.push([ymdOf(d), ymdOf(e) > to ? to : ymdOf(e)]);
  }
  const out: any[] = [];
  for (let i = 0; i < ranges.length; i += 6) {
    const part = await Promise.all(ranges.slice(i, i + 6).map(([f, t]) => call(api, { ...params, [fromKey]: ymd8(f), [toKey]: ymd8(t) })));
    part.forEach((r) => out.push(...r));
  }
  return out;
}

const ymd8 = (d: string) => d.replace(/-/g, '');
const fromYmd8 = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

export async function searchSchools(name: string): Promise<SchoolHit[]> {
  if (name.trim().length < 2) return [];
  const rows = (await fetchPage('schoolInfo', { SCHUL_NM: name.trim(), pIndex: 1, pSize: getState().settings.neisKey ? 30 : 5 })).rows;
  return rows.map((r: any) => ({
    office: r.ATPT_OFCDC_SC_CODE,
    officeName: r.ATPT_OFCDC_SC_NM,
    code: r.SD_SCHUL_CODE,
    name: r.SCHUL_NM,
    kind: r.SCHUL_KND_SC_NM,
    address: (r.ORG_RDNMA || '').trim(),
  }));
}

/** 급식 메뉴의 알레르기 번호·괄호 지우기 */
function cleanDish(s: string) {
  return s
    .replace(/\([0-9.\s]+\)/g, '')
    .replace(/[0-9.]+$/g, '')
    .replace(/\*/g, '')
    .trim();
}

const CACHE = 'neis-cache-v1:';
async function cached<T>(key: string, maxAgeMs: number, fn: () => Promise<T>): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(CACHE + key);
    if (raw) {
      const v = JSON.parse(raw);
      if (Date.now() - v.at < maxAgeMs) return v.data;
    }
  } catch {}
  const data = await fn();
  AsyncStorage.setItem(CACHE + key, JSON.stringify({ at: Date.now(), data })).catch(() => {});
  return data;
}

export async function getMeals(from: string, to: string): Promise<Meal[]> {
  const sc = getState().settings.school;
  if (!sc) return [];
  return cached(`meal:${sc.code}:${from}:${to}`, 6 * 3600_000, async () => {
    const rows = await callRange('mealServiceDietInfo', { ATPT_OFCDC_SC_CODE: sc.office, SD_SCHUL_CODE: sc.code }, 'MLSV_FROM_YMD', 'MLSV_TO_YMD', from, to, 1);
    const seen = new Set<string>();
    return rows
      .filter((r: any) => {
        const k = r.MLSV_YMD + r.MMEAL_SC_CODE;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((r: any) => ({
        date: fromYmd8(r.MLSV_YMD),
        type: r.MMEAL_SC_NM,
        order: Number(r.MMEAL_SC_CODE) || 0,
        dishes: String(r.DDISH_NM || '')
          .split(/<br\s*\/?>/i)
          .map(cleanDish)
          .filter(Boolean),
        kcal: r.CAL_INFO,
      }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.order - b.order)
      .map(({ order, ...m }: any) => m as Meal);
  });
}

export async function getSchoolEvents(from: string, to: string): Promise<SchoolEvent[]> {
  const sc = getState().settings.school;
  if (!sc) return [];
  return cached(`sched:${sc.code}:${from}:${to}`, 24 * 3600_000, async () => {
    const rows = await callRange('SchoolSchedule', { ATPT_OFCDC_SC_CODE: sc.office, SD_SCHUL_CODE: sc.code }, 'AA_FROM_YMD', 'AA_TO_YMD', from, to, 4);
    const seen = new Set<string>();
    const out: SchoolEvent[] = [];
    for (const r of rows) {
      const name = String(r.EVENT_NM || '').trim();
      const date = fromYmd8(r.AA_YMD);
      if (!name || name === '토요휴업일') continue;
      const k = date + name;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ date, name, off: r.SBTR_DD_SC_NM === '휴업일' || /공휴일|방학|재량휴업/.test(r.SBTR_DD_SC_NM || '') });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  });
}

/** 시험·방학처럼 디데이로 보면 좋은 행사인가 */
export const isKeyEvent = (name: string) => /고사|시험|평가|방학|수능|모의|개학|종업|졸업|입학/.test(name);

export async function clearNeisCache() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE));
  await AsyncStorage.multiRemove(keys);
}

/** 홈 화면용: 오늘 중식 한 줄 */
export async function todayLunch(): Promise<string | null> {
  if (!getState().settings.school) return null;
  try {
    const d = todayYmd();
    const ms = await getMeals(d, d);
    const m = ms.find((x) => x.type === '중식') || ms[0];
    return m ? m.dishes.slice(0, 5).join(' · ') : null;
  } catch {
    return null;
  }
}
