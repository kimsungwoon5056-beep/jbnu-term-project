import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { firestoreErrorMessage } from '../records/recordDoc'
import { normalizeLook, validateProfile } from './look'

// 프로필은 users/{uid} 문서 하나에 둔다: { nickname, look: { skin, hairStyle, hairColor, glasses }, updatedAt }
const profileRef = (uid) => doc(db, 'users', uid)

async function run(action) {
  try {
    return { ok: true, message: '', ...(await action()) }
  } catch (error) {
    return { ok: false, message: firestoreErrorMessage(error?.code, 'profile') }
  }
}

// 프로필이 없으면 profile이 null(가입 중 저장 실패·예전 계정)
export function loadProfile(uid) {
  return run(async () => {
    const snapshot = await getDoc(profileRef(uid))
    const data = snapshot.exists() ? snapshot.data() : null
    return { profile: data?.nickname ? { nickname: data.nickname, look: normalizeLook(data.look) } : null }
  })
}

export async function saveProfile(uid, profile) {
  const errors = validateProfile(profile)
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: '입력한 내용을 확인해 주세요.' }
  const clean = { nickname: profile.nickname.trim(), look: normalizeLook(profile.look) }
  const result = await run(() => setDoc(profileRef(uid), { ...clean, updatedAt: serverTimestamp() }))
  return { ...result, errors: {}, profile: result.ok ? clean : null }
}

// 가입 2단계에서 고른 모습. 계정이 만들어지면 로그인 화면이 바로 바뀌므로, 저장은 로그인 뒤(ProfileGate)에 한다.
let pendingProfile = null
export function rememberSignupProfile(profile) {
  pendingProfile = profile
}
export function takeSignupProfile() {
  const profile = pendingProfile
  pendingProfile = null
  return profile
}
