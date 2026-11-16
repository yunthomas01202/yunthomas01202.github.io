// 구글 드라이브 저장소
//  - 로그인한 구글 계정의 드라이브에 '학습지원' 폴더를 만들고 PDF·학습 앱 HTML을 저장
//  - 권한은 drive.file (이 앱이 만든 파일만 접근, Google 분류상 '비민감' 범위 → 별도 심사 불필요)
//  - 큰 파일도 메모리에 올리지 않고 기기 파일에서 바로 올리고 받음
import * as FS from 'expo-file-system/legacy';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getState, updateSettings } from './store';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME = '학습지원';

async function token(): Promise<string> {
  let user: any = GoogleSignin.getCurrentUser();
  if (!user) {
    const r: any = await GoogleSignin.signInSilently();
    if (r?.type !== 'success') throw new Error('구글 드라이브를 쓰려면 다시 로그인해 주세요');
    user = r.data;
  }
  if (!(user?.scopes || []).includes(DRIVE_SCOPE)) {
    // 예전에 드라이브 권한 없이 로그인한 경우 한 번 더 동의 받기
    const r: any = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!r) throw new Error('구글 드라이브 접근을 허용해야 파일을 저장할 수 있어요');
  }
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

/** 토큰이 만료됐으면 한 번 새로 받아 다시 시도 */
async function authed<T>(fn: (tk: string) => Promise<T & { status: number }>): Promise<T & { status: number }> {
  let tk = await token();
  let res = await fn(tk);
  if (res.status === 401) {
    try {
      await GoogleSignin.clearCachedAccessToken(tk);
    } catch {}
    tk = await token();
    res = await fn(tk);
  }
  return res;
}

let folderPromise: Promise<string> | null = null;

/** 드라이브의 '학습지원' 폴더 id (없으면 만들기, 모든 기기가 같은 폴더를 쓰도록 설정에 기억) */
export function driveFolder(): Promise<string> {
  if (folderPromise) return folderPromise;
  folderPromise = (async () => {
    const saved = getState().settings.driveFolderId;
    if (saved) return saved;
    const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const found = await authed((tk) => fetch(`${API}?q=${q}&fields=files(id)&spaces=drive`, { headers: { Authorization: `Bearer ${tk}` } }));
    const list: any = found.ok ? await found.json() : { files: [] };
    let id: string | undefined = list.files?.[0]?.id;
    if (!id) {
      const made = await authed((tk) =>
        fetch(`${API}?fields=id`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
        }),
      );
      if (!made.ok) throw new Error(`드라이브 폴더를 만들지 못했어요 (${made.status})`);
      id = ((await made.json()) as any).id;
    }
    updateSettings({ driveFolderId: id! });
    return id!;
  })();
  folderPromise.catch(() => (folderPromise = null));
  return folderPromise;
}

/** 기기 파일 → 드라이브 업로드 (재개 가능 업로드). 반환: 드라이브 파일 id */
export async function driveUpload(localUri: string, name: string, mime: string): Promise<string> {
  const parent = await driveFolder();
  const init = await authed((tk) =>
    fetch(`${UPLOAD}?uploadType=resumable&fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tk}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
      },
      body: JSON.stringify({ name, mimeType: mime, parents: [parent] }),
    }),
  );
  const session = init.headers.get('location') || init.headers.get('Location');
  if (!init.ok || !session) throw new Error(`드라이브 업로드를 시작하지 못했어요 (${init.status})`);
  const tk = await token();
  const res = await FS.uploadAsync(session, localUri, {
    httpMethod: 'PUT',
    uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${tk}`, 'Content-Type': mime },
  });
  if (res.status !== 200 && res.status !== 201) throw new Error(`드라이브 업로드 실패 (${res.status})`);
  return JSON.parse(res.body).id;
}

/** 드라이브 파일 → 기기로 내려받기 */
export async function driveDownload(fileId: string, dst: string) {
  const res: any = await authed(async (tk) => {
    const r = await FS.downloadAsync(`${API}/${fileId}?alt=media`, dst, { headers: { Authorization: `Bearer ${tk}` } });
    return r as any;
  });
  if (res.status !== 200) {
    await FS.deleteAsync(dst, { idempotent: true }).catch(() => {});
    throw new Error(res.status === 404 ? '드라이브에서 파일을 찾을 수 없어요 (지워졌을 수 있어요)' : `내려받기 실패 (${res.status})`);
  }
}

/** 삭제 = 드라이브 휴지통으로 (30일 안에 복구 가능) */
export async function driveTrash(fileId: string) {
  await authed((tk) =>
    fetch(`${API}/${fileId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    }),
  );
}

/** 드라이브에서 이름 바꾸기 (앱에서 이름을 바꾸면 드라이브 파일 이름도 맞춤) */
export async function driveRename(fileId: string, name: string) {
  await authed((tk) =>
    fetch(`${API}/${fileId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name }),
    }),
  );
}
