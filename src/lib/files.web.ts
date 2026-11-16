// 파일 저장 (웹): 브라우저 IndexedDB 캐시 + 내 구글 드라이브
// 함수 이름과 쓰임은 모바일용 files.ts 와 같아요 (경로는 'idb://아이디.확장자' 형태)
import { getState, update } from './store';
import {
  connectDrive as connect,
  driveDownload,
  driveRename,
  driveTrash,
  driveUpload,
  hasDriveToken,
  isDriveAuthError as isAuthErr,
} from './drive.web';

const DB_NAME = 'study-files';
const STORE = 'files';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const transaction = d.transaction(STORE, mode);
    const r = fn(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(r.result);
    transaction.onabort = () => reject(transaction.error || new Error('파일 저장이 중단됐어요. 브라우저 저장 공간을 확인하세요.'));
    transaction.onerror = () => reject(transaction.error || r.error);
    r.onerror = () => reject(r.error);
  });
}

const keyOf = (uri: string) => uri.replace(/^idb:\/\//, '');
const putBlob = (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key));
const getBlob = (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>);

async function blobOf(uri: string): Promise<Blob> {
  if (uri.startsWith('idb://')) {
    const b = await getBlob(keyOf(uri));
    if (!b) throw new Error('이 브라우저에 파일이 없어요');
    return b;
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`파일을 불러오지 못했어요 (${response.status})`);
  return response.blob();
}

const MIME: Record<string, string> = { pdf: 'application/pdf', html: 'text/html' };

export const localPathFor = (id: string, ext: string) => `idb://${id}.${ext}`;

export async function exists(uri: string): Promise<boolean> {
  try {
    return !!(await getBlob(keyOf(uri)));
  } catch {
    return false;
  }
}

export async function importToLocal(srcUri: string, id: string, ext: string): Promise<string> {
  const blob = await blobOf(srcUri);
  await putBlob(`${id}.${ext}`, blob);
  return localPathFor(id, ext);
}

export async function writeLocalText(id: string, ext: string, text: string): Promise<string> {
  await putBlob(`${id}.${ext}`, new Blob([text], { type: MIME[ext] || 'text/plain' }));
  return localPathFor(id, ext);
}

export async function readBase64(uri: string): Promise<string> {
  const blob = await blobOf(uri);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function readText(uri: string): Promise<string> {
  return (await blobOf(uri)).text();
}

export async function uploadFile(localUri: string, name: string, ext: string): Promise<string> {
  const blob = await blobOf(localUri);
  const fileName = name.toLowerCase().endsWith('.' + ext) ? name : `${name}.${ext}`;
  return driveUpload(blob, fileName, MIME[ext] || 'application/octet-stream');
}

export async function ensureLocal(driveId: string | null | undefined, id: string, ext: string): Promise<string> {
  const path = localPathFor(id, ext);
  if (await exists(path)) return path;
  if (!driveId) throw new Error('이 브라우저에 파일이 없고, 드라이브에도 아직 올라가지 않았어요. 처음 추가한 기기에서 인터넷에 연결해 주세요.');
  const blob = await driveDownload(driveId);
  await putBlob(`${id}.${ext}`, blob);
  return path;
}

export async function deleteLocal(id: string, ext: string) {
  try {
    await tx('readwrite', (s) => s.delete(`${id}.${ext}`));
  } catch {}
}

export async function deleteRemote(driveId?: string | null) {
  if (!driveId) return;
  try {
    await driveTrash(driveId);
  } catch {}
}

export async function renameRemote(driveId: string | null | undefined, name: string, ext: string) {
  if (!driveId) return;
  try {
    await driveRename(driveId, name.toLowerCase().endsWith('.' + ext) ? name : `${name}.${ext}`);
  } catch {}
}

let retrying = false;
export async function retryPendingUploads() {
  if (retrying || !hasDriveToken()) return;
  retrying = true;
  try {
    const s = getState();
    for (const f of Object.values(s.files)) {
      if (f.kind !== 'pdf' || f.driveId) continue;
      const local = localPathFor(f.id, 'pdf');
      if (!(await exists(local))) continue;
      try {
        update('files', f.id, { driveId: await uploadFile(local, f.name, 'pdf'), pendingUpload: false });
      } catch {
        break;
      }
    }
    for (const a of Object.values(s.apps)) {
      if (a.source !== 'html' || a.driveId) continue;
      const local = localPathFor(a.id, 'html');
      if (!(await exists(local))) continue;
      try {
        update('apps', a.id, { driveId: await uploadFile(local, a.name, 'html') });
      } catch {
        break;
      }
    }
  } finally {
    retrying = false;
  }
}

/** 버튼 클릭 안에서: 드라이브 다시 연결 후 밀린 업로드 처리 */
export async function connectDrive() {
  await connect();
  retryPendingUploads();
}
export const isDriveAuthError = isAuthErr;
