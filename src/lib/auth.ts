// 구글 계정 로그인 (Firebase Auth + Google Sign-In 네이티브)
import { create } from 'zustand';
import Constants from 'expo-constants';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as fbSignOut,
} from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_UID, startSync, stopSync } from './store';
import { DRIVE_SCOPE } from './drive';

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

let configured = false;

const LOCAL_FLAG = 'local-mode-v1';
const LOCAL_USER: AppUser = { uid: LOCAL_UID, name: '이 기기 사용자', email: '로그인 없이 이 기기에만 저장 중', photo: null };

/** 로그인 없이 이 기기에만 저장하며 시작 */
export async function startLocalMode() {
  await AsyncStorage.setItem(LOCAL_FLAG, '1');
  useAuth.setState({ user: LOCAL_USER, initializing: false });
  startSync(LOCAL_UID);
}

export function initAuth() {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  AsyncStorage.getItem(LOCAL_FLAG)
    .then((v) => {
      if (cancelled) return;
      if (v === '1') {
        useAuth.setState({ user: LOCAL_USER, initializing: false });
        startSync(LOCAL_UID);
      } else {
        unsub = initFirebaseAuth();
      }
    })
    .catch(() => {
      if (!cancelled) unsub = initFirebaseAuth();
    });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

function initFirebaseAuth() {
  if (!configured) {
    GoogleSignin.configure({
      // Firebase 콘솔 > Authentication > Google > 웹 SDK 구성의 "웹 클라이언트 ID"
      webClientId: (Constants.expoConfig?.extra as any)?.googleWebClientId,
      // PDF·학습 앱 파일을 내 구글 드라이브에 저장하기 위한 권한 (이 앱이 만든 파일만)
      scopes: [DRIVE_SCOPE],
    });
    configured = true;
  }
  try {
    return onAuthStateChanged(getAuth(), (u: any) => {
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
  } catch (e) {
    console.warn('[auth]', e);
    useAuth.setState({ user: null, initializing: false });
    return () => {};
  }
}

export async function signInWithGoogle(): Promise<boolean> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return false; // 사용자가 취소
  const idToken = res.data.idToken;
  if (!idToken) throw new Error('구글 idToken을 받지 못했습니다. webClientId 설정을 확인하세요.');
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(getAuth(), credential);
  return true;
}

export async function signOut() {
  if (useAuth.getState().user?.uid === LOCAL_UID) {
    await AsyncStorage.removeItem(LOCAL_FLAG);
    stopSync();
    useAuth.setState({ user: null, initializing: false });
    return;
  }
  try {
    await GoogleSignin.signOut();
  } catch {}
  await fbSignOut(getAuth());
}
