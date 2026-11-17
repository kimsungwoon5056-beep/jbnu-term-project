import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// 웹 앱 설정값은 .env.local에서 읽는다. 저장소에는 .env.example만 올린다.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
// 실시간 대결(Realtime Database) 주소. 없으면 대결 화면에서 연습 모드만 쓴다.
export const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL ?? ''

// 설정값이 비어 있으면 앱을 만들지 않고 화면에서 설정 안내를 보여 준다.
export const missingConfig = Object.values(config).some((value) => !value)

export const app = missingConfig ? null : initializeApp({ ...config, ...(databaseURL ? { databaseURL } : {}) })
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
