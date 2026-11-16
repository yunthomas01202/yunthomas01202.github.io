// 필기 엔진(HTML) 불러오기 (웹): 번들된 에셋을 fetch 로 읽음
import { Asset } from 'expo-asset';

export const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/';

let cached: string | null = null;

export async function loadEngineHtml(): Promise<string> {
  if (cached) return cached;
  const asset = Asset.fromModule(require('../../../assets/engine/study-engine.html'));
  const res = await fetch(asset.uri);
  if (!res.ok) throw new Error(`필기 엔진 파일을 불러오지 못했어요 (${res.status}). Pages의 assets 폴더 업로드를 확인하세요.`);
  const html = await res.text();
  if (!html.includes('window.Engine') || !html.includes('ReactNativeWebView')) {
    throw new Error('필기 엔진 대신 다른 페이지가 반환됐어요. 배포 경로와 404 설정을 확인하세요.');
  }
  cached = html;
  return cached!;
}

export function engineCall(msg: unknown): string {
  return `try{window.Engine&&window.Engine.receive(${JSON.stringify(msg)})}catch(e){};true;`;
}

export function sendBase64(inject: (js: string) => void, key: 'main' | 'src', b64: string, extra?: Record<string, unknown>) {
  const size = 2 * 1024 * 1024;
  const n = Math.max(1, Math.ceil(b64.length / size));
  for (let i = 0; i < n; i++) {
    inject(engineCall({ type: 'chunk', key, data: b64.slice(i * size, (i + 1) * size), i, n, last: i === n - 1, ...(extra || {}) }));
  }
}
