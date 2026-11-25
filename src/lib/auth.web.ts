// 구글 계정 로그인 (웹): Firebase 팝업 로그인 + 드라이브 권한 함께 받기
import { create } from 'zustand';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { webAuth } from './fb.web';
import { startSync, stopSync } from './store';
import { DRIVE_SCOPE, clearDriveToken, setDriveToken } from './drive.web';
import { getWebConfigError } from './webConfig';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photo: string | null;
}

interface AuthState {
  user: AppUser | null;
  initializing: boolean;
}

export const useAuth = create<AuthState>(() => ({ user: null, initializing: true }));

export function initAuth() {
  if (getWebConfigError()) {
    useAuth.setState({ user: null, initializing: false });
    return () => {};
  }
  return onAuthStateChanged(webAuth(), (u: any) => {
    if (u) {
      useAuth.setState({
        user: { uid: u.uid, name: u.displayName || '학생', email: u.email || '', photo: u.photoURL || null },
        initializing: false,
      });
      startSync(u.uid);
    } else {
      stopSync();
      useAuth.setState({ user: null, initializing: false });
    }
  });
}

export async function signInWithGoogle(): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const res = await signInWithPopup(webAuth(), provider);
    const cred = GoogleAuthProvider.credentialFromResult(res);
    if (cred?.accessToken) setDriveToken(cred.accessToken, 3500, res.user.email);
    return true;
  } catch (e: any) {
    if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return false;
    if (e?.code === 'auth/unauthorized-domain') throw new Error('Firebase Authentication → 설정 → 승인된 도메인에 이 사이트의 도메인을 추가해 주세요. README.md를 참고하세요.');
    if (e?.code === 'auth/popup-blocked') throw new Error('브라우저가 로그인 팝업을 막았어요. 팝업을 허용해 주세요');
    throw e;
  }
}

export async function signOut() {
  clearDriveToken();
  await fbSignOut(webAuth());
}

/** 웹은 Firebase 로그인만 지원해요 (기기 전용 모드는 안드로이드 앱 전용) */
export async function startLocalMode() {
  throw new Error('웹에서는 Google 로그인이 필요해요');
}
