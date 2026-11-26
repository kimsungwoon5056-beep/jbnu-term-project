import * as firebaseAuth from 'firebase/auth'
import { auth as defaultAuth } from '../firebase'
import { authErrorMessage } from '../lib/validation'

// Facade: 로그인 서브시스템(Firebase Auth의 가입·로그인·로그아웃·상태 구독 네 함수, auth 객체, 오류 코드)을
// 화면이 쓰기 쉬운 작은 창구 하나로 감싼다. 화면(AuthForm·App·useAuth)은 Firebase Auth를 직접 부르지 않고
//   signIn / signUp / logOut → { ok, message }(실패면 한국어 안내), watch(onUser) → 구독 해지 함수
// 만 쓴다. sdk를 바꿔 끼우면 Firebase 없이 시험할 수 있다(authFacade.test.js).
export function createAuthFacade({ auth = defaultAuth, sdk = firebaseAuth } = {}) {
  async function run(action) {
    try {
      await action()
      return { ok: true, message: '' }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error?.code) }
    }
  }
  return {
    available: Boolean(auth),
    signIn: (email, password) => run(() => sdk.signInWithEmailAndPassword(auth, email.trim(), password)),
    signUp: (email, password) => run(() => sdk.createUserWithEmailAndPassword(auth, email.trim(), password)),
    logOut: () => run(() => sdk.signOut(auth)),
    watch: (onUser) => sdk.onAuthStateChanged(auth, onUser),
  }
}

// 앱이 쓰는 하나의 창구
export const authFacade = createAuthFacade()
export const signIn = (email, password) => authFacade.signIn(email, password)
export const signUp = (email, password) => authFacade.signUp(email, password)
export const logOut = () => authFacade.logOut()
