// 웹: Firebase JS SDK. 설정 파일이 비어 있어도 초기 페이지는 표시합니다.
import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore as plainFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getWebConfigError, getWebSettings } from './webConfig';

function firebaseApp() {
  const error = getWebConfigError();
  if (error) throw new Error(error);
  return getApps()[0] || initializeApp(getWebSettings().firebaseWeb!);
}
let db: any = null;

/** 오프라인 캐시(IndexedDB)를 켠 Firestore */
export function getFirestore() {
  if (!db) {
    const app = firebaseApp();
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
      db = plainFirestore(app);
    }
  }
  return db;
}
export const webAuth = () => getAuth(firebaseApp());
export {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  writeBatch, getDocs, getDoc, query, where,
} from 'firebase/firestore';
