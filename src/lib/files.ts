// 파일 저장: 기기 로컬(documentDirectory/study) + 내 구글 드라이브('학습지원' 폴더)
import * as FS from 'expo-file-system/legacy';
import { getState, update } from './store';
import { driveDownload, driveRename, driveTrash, driveUpload } from './drive';

const ROOT = (FS.documentDirectory || '') + 'study/';

export const localPathFor = (id: string, ext: string) => `${ROOT}${id}.${ext}`;

async function ensureDir() {
  const info = await FS.getInfoAsync(ROOT);
  if (!info.exists) await FS.makeDirectoryAsync(ROOT, { intermediates: true });
}

export async function exists(uri: string): Promise<boolean> {
  try {
    const i: any = await FS.getInfoAsync(uri);
    return !!i.exists && (i.size === undefined || i.size > 0);
  } catch {
    return false;
  }
}

/** 선택한 파일을 앱 폴더로 복사 */
export async function importToLocal(srcUri: string, id: string, ext: string): Promise<string> {
  await ensureDir();
  const dst = localPathFor(id, ext);
  await FS.copyAsync({ from: srcUri, to: dst });
  return dst;
}

export async function writeLocalText(id: string, ext: string, text: string): Promise<string> {
  await ensureDir();
  const dst = localPathFor(id, ext);
  await FS.writeAsStringAsync(dst, text);
  return dst;
}

export const readBase64 = (uri: string) => FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
export const readText = (uri: string) => FS.readAsStringAsync(uri);

const MIME: Record<string, string> = { pdf: 'application/pdf', html: 'text/html' };

/** 드라이브에 올리고 드라이브 파일 id 반환 */
export function uploadFile(localUri: string, name: string, ext: string): Promise<string> {
  const fileName = name.toLowerCase().endsWith('.' + ext) ? name : `${name}.${ext}`;
  return driveUpload(localUri, fileName, MIME[ext] || 'application/octet-stream');
}

/** 로컬에 없으면 드라이브에서 내려받아 경로 반환 */
export async function ensureLocal(driveId: string | null | undefined, id: string, ext: string): Promise<string> {
  const dst = localPathFor(id, ext);
  if (await exists(dst)) return dst;
  if (!driveId) throw new Error('이 기기에 파일이 없고, 드라이브에도 아직 올라가지 않았어요. 처음 추가한 기기에서 인터넷에 연결해 주세요.');
  await ensureDir();
  await driveDownload(driveId, dst);
  return dst;
}

export async function deleteLocal(id: string, ext: string) {
  try {
    await FS.deleteAsync(localPathFor(id, ext), { idempotent: true });
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

/** 오프라인에서 추가해 아직 못 올린 파일을 다시 올리기 */
let retrying = false;
export async function retryPendingUploads() {
  if (retrying) return;
  retrying = true;
  try {
    const s = getState();
    for (const f of Object.values(s.files)) {
      if (f.kind !== 'pdf' || f.driveId) continue;
      const local = localPathFor(f.id, 'pdf');
      if (!(await exists(local))) continue;
      try {
        const driveId = await uploadFile(local, f.name, 'pdf');
        update('files', f.id, { driveId, pendingUpload: false });
      } catch {
        break; // 오프라인이면 다음에
      }
    }
    for (const a of Object.values(s.apps)) {
      if (a.source !== 'html' || a.driveId) continue;
      const local = localPathFor(a.id, 'html');
      if (!(await exists(local))) continue;
      try {
        const driveId = await uploadFile(local, a.name, 'html');
        update('apps', a.id, { driveId });
      } catch {
        break;
      }
    }
  } finally {
    retrying = false;
  }
}

/** (웹 전용 기능과 이름 맞춤) 모바일은 로그인할 때 드라이브 권한을 받으므로 따로 연결할 필요가 없어요 */
export async function connectDrive() {
  retryPendingUploads();
}
export const isDriveAuthError = (_e: any) => false;
