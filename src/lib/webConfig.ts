import Constants from 'expo-constants';

type FirebaseWebConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};
type WebSettings = { firebaseWeb?: FirebaseWebConfig; googleWebClientId?: string };

export function getWebSettings(): WebSettings {
  const embedded = (Constants.expoConfig?.extra || {}) as WebSettings;
  const runtime = (globalThis as any).STUDY_WEB_CONFIG as WebSettings | undefined;
  return {
    firebaseWeb: { ...embedded.firebaseWeb, ...runtime?.firebaseWeb },
    googleWebClientId: runtime?.googleWebClientId ?? embedded.googleWebClientId,
  };
}

export function getWebConfigError(): string | null {
  const config = getWebSettings().firebaseWeb || {};
  const required: (keyof FirebaseWebConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter(key => !config[key]?.trim() || /YOUR_|xxxx/i.test(config[key]!));
  return missing.length ? `Firebase 설정이 필요합니다: ${missing.join(', ')}` : null;
}
