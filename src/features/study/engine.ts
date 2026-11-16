// 필기 엔진(HTML) 불러오기 + RN ↔ 엔진 메시지 도우미
import { Asset } from 'expo-asset';
import * as FS from 'expo-file-system/legacy';

// pdf.js는 CDN에서 받아옵니다 (WebView가 한 번 받으면 캐시). baseUrl을 같은 곳으로 두어 워커가 같은 출처로 동작
export const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/';

let cached: string | null = null;

export async function loadEngineHtml(): Promise<string> {
  if (cached) return cached;
  const asset = Asset.fromModule(require('../../../assets/engine/study-engine.html'));
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  cached = await FS.readAsStringAsync(uri);
  return cached!;
}

export function engineCall(msg: unknown): string {
  return `try{window.Engine&&window.Engine.receive(${JSON.stringify(msg)})}catch(e){};true;`;
}

/** base64 문자열을 잘라서 엔진으로 보내기 */
export function sendBase64(inject: (js: string) => void, key: 'main' | 'src', b64: string, extra?: Record<string, unknown>) {
  const size = 512 * 1024;
  const n = Math.max(1, Math.ceil(b64.length / size));
  for (let i = 0; i < n; i++) {
    inject(engineCall({ type: 'chunk', key, data: b64.slice(i * size, (i + 1) * size), i, n, last: i === n - 1, ...(extra || {}) }));
  }
}
