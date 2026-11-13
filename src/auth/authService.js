import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'
import { authErrorMessage } from '../lib/validation'

// 화면에서는 성공 여부와 안내 문구만 다루도록 Firebase 호출 결과를 정리한다.
async function run(action) {
  try {
    await action()
    return { ok: true, message: '' }
  } catch (error) {
    return { ok: false, message: authErrorMessage(error?.code) }
  }
}

export function signIn(email, password) {
  return run(() => signInWithEmailAndPassword(auth, email.trim(), password))
}

export function signUp(email, password) {
  return run(() => createUserWithEmailAndPassword(auth, email.trim(), password))
}

export function logOut() {
  return run(() => signOut(auth))
}
