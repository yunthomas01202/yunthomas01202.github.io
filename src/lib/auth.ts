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
import { startSync, stopSync } from './store';
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

export function initAuth() {
  if (!configured) {
    GoogleSignin.configure({
      // Firebase 콘솔 > Authentication > Google > 웹 SDK 구성의 "웹 클라이언트 ID"
      webClientId: (Constants.expoConfig?.extra as any)?.googleWebClientId,
      // PDF·학습 앱 파일을 내 구글 드라이브에 저장하기 위한 권한 (이 앱이 만든 파일만)
      scopes: [DRIVE_SCOPE],
    });
    configured = true;
  }
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
  try {
    await GoogleSignin.signOut();
  } catch {}
  await fbSignOut(getAuth());
}
