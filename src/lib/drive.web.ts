// 구글 드라이브 저장소 (웹)
//  - 로그인 팝업에서 받은 접근 토큰(1시간)을 쓰고, 만료되면 버튼 한 번으로 다시 연결 (구글 정책상 팝업은 클릭할 때만 열 수 있음)
//  - 모바일 앱과 같은 '학습지원' 폴더·같은 파일을 씀
import { getWebSettings } from './webConfig';
import { getState, updateSettings } from './store';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME = '학습지원';
const TOKEN_KEY = 'drive-token-v1';

export class DriveAuthError extends Error {
  code = 'drive-auth';
  constructor() {
    super('구글 드라이브 연결이 필요해요');
  }
}
export const isDriveAuthError = (e: any) => e?.code === 'drive-auth';

let cached: { token: string; exp: number; email?: string } | null = null;
try {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (raw) cached = JSON.parse(raw);
} catch {}

export function setDriveToken(token: string, expiresInSec: number, email?: string | null) {
  cached = { token, exp: Date.now() + expiresInSec * 1000, email: email || cached?.email };
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(cached));
  } catch {}
}

export function clearDriveToken() {
  cached = null;
  folderPromise = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export const hasDriveToken = () => !!cached && cached.exp - 60_000 > Date.now();

function token(): string {
  if (!hasDriveToken()) throw new DriveAuthError();
  return cached!.token;
}

/* Google Identity Services: 버튼을 눌렀을 때 토큰 다시 받기 */
let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error('구글 로그인 스크립트를 불러오지 못했어요'));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}
// 화면이 뜨면 미리 불러두기 (클릭 시 팝업이 막히지 않도록)
if (typeof window !== 'undefined') setTimeout(() => loadGis().catch(() => {}), 1500);

/** 반드시 버튼 클릭 안에서 호출하세요 */
export async function connectDrive(): Promise<void> {
  const clientId = getWebSettings().googleWebClientId;
  if (!clientId || /YOUR_/i.test(clientId)) throw new Error('web-config.js의 googleWebClientId를 설정해 주세요.');
  await loadGis();
  await new Promise<void>((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      hint: cached?.email,
      callback: (resp: any) => {
        if (resp?.error || !resp?.access_token) return reject(new Error(resp?.error_description || '드라이브 연결이 취소됐어요'));
        setDriveToken(resp.access_token, Number(resp.expires_in) || 3500);
        resolve();
      },
      error_callback: (err: any) => reject(new Error(err?.message || '드라이브 연결 창이 닫혔어요')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token()}` } });
  if (res.status === 401) {
    clearDriveToken();
    throw new DriveAuthError();
  }
  return res;
}

let folderPromise: Promise<string> | null = null;
export function driveFolder(): Promise<string> {
  if (folderPromise) return folderPromise;
  folderPromise = (async () => {
    const saved = getState().settings.driveFolderId;
    if (saved) return saved;
    const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const found = await call(`${API}?q=${q}&fields=files(id)&spaces=drive`);
    const list: any = found.ok ? await found.json() : { files: [] };
    let id: string | undefined = list.files?.[0]?.id;
    if (!id) {
      const made = await call(`${API}?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
      });
      if (!made.ok) throw new Error(`드라이브 폴더를 만들지 못했어요 (${made.status})`);
      id = ((await made.json()) as any).id;
    }
    updateSettings({ driveFolderId: id! });
    return id!;
  })();
  folderPromise.catch(() => (folderPromise = null));
  return folderPromise;
}

async function multipart(blob: Blob, meta: object, mime: string): Promise<string> {
  const b = 'study' + Math.random().toString(36).slice(2);
  const body = new Blob(
    [`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${b}--`],
    { type: `multipart/related; boundary=${b}` },
  );
  const res = await call(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body,
  });
  if (!res.ok) throw new Error(`드라이브 업로드 실패 (${res.status})`);
  return ((await res.json()) as any).id;
}

export async function driveUpload(blob: Blob, name: string, mime: string): Promise<string> {
  const parent = await driveFolder();
  const meta = { name, mimeType: mime, parents: [parent] };
  if (blob.size <= 5 * 1024 * 1024) return multipart(blob, meta, mime);
  // 큰 파일: 재개 가능 업로드
  const init = await call(`${UPLOAD}?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime },
    body: JSON.stringify(meta),
  });
  const session = init.headers.get('location');
  if (!init.ok || !session) return multipart(blob, meta, mime);
  const put = await fetch(session, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
  if (!put.ok) throw new Error(`드라이브 업로드 실패 (${put.status})`);
  return ((await put.json()) as any).id;
}

export async function driveDownload(fileId: string): Promise<Blob> {
  const res = await call(`${API}/${fileId}?alt=media`);
  if (!res.ok) throw new Error(res.status === 404 ? '드라이브에서 파일을 찾을 수 없어요 (지워졌을 수 있어요)' : `내려받기 실패 (${res.status})`);
  return res.blob();
}

export async function driveTrash(fileId: string) {
  await call(`${API}/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

export async function driveRename(fileId: string, name: string) {
  await call(`${API}/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ name }),
  });
}
