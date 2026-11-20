import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db as defaultDb } from '../firebase'
import { normalizeLook, validateProfile } from '../profile/look'
import { firestoreErrorMessage, fromRecordDoc, planDelete, planSave, toRecordDoc } from '../records/recordDoc'
import { toMatchDoc } from './matchDoc'

// Repository의 Firestore 구현. 화면은 이 클래스를 모르고 repositories.js의 인터페이스만 쓴다.
// 저장 경로: users/{uid}(프로필), users/{uid}/records/{날짜}(하루 기록), users/{uid}/matches/{id}(전적)
// 결과는 언제나 { ok, message, ... }로 돌려준다. 화면은 Firebase 오류 코드 대신 이 모양만 다룬다.

async function run(what, action) {
  try {
    return { ok: true, message: '', ...(await action()) }
  } catch (error) {
    return { ok: false, message: firestoreErrorMessage(error?.code, what) }
  }
}

export class FirestoreRecordRepository {
  constructor(uid, db = defaultDb) {
    this.records = collection(db, 'users', uid, 'records')
    this.ref = (dateKey) => doc(db, 'users', uid, 'records', dateKey)
  }

  // 그날 기록. 없으면 record가 null
  load(dateKey) {
    return run('record', async () => {
      const snapshot = await getDoc(this.ref(dateKey))
      return { record: snapshot.exists() ? fromRecordDoc(dateKey, snapshot.data()) : null }
    })
  }

  // 최근 기록부터 count개
  listRecent(count = 7) {
    return run('record', async () => {
      const snapshot = await getDocs(query(this.records, orderBy('date', 'desc'), limit(count)))
      return { records: snapshot.docs.map((item) => fromRecordDoc(item.id, item.data())) }
    })
  }

  // fromKey ~ toKey(양 끝 포함), 최근 날짜부터
  listBetween(fromKey, toKey) {
    return run('record', async () => {
      const snapshot = await getDocs(query(this.records, where('date', '>=', fromKey), where('date', '<=', toKey), orderBy('date', 'desc')))
      return { records: snapshot.docs.map((item) => fromRecordDoc(item.id, item.data())) }
    })
  }

  // 서비스 규칙(날짜 창·값 검사)은 planSave가 정한다. 메모리 구현도 같은 함수를 쓴다.
  async save(record, todayKey) {
    const existing = await run('record', async () => ({ exists: (await getDoc(this.ref(record.date))).exists() }))
    if (!existing.ok) return { ...existing, errors: {} }
    const plan = planSave({ record, exists: existing.exists, todayKey })
    if (!plan.ok) return plan
    const result = await run('record', () => setDoc(this.ref(record.date), { ...toRecordDoc(record), updatedAt: serverTimestamp() }))
    return { ...result, errors: {}, action: plan.action }
  }

  async remove(dateKey, todayKey) {
    const plan = planDelete({ dateKey, todayKey })
    if (!plan.ok) return plan
    return run('record', () => deleteDoc(this.ref(dateKey)))
  }
}

export class FirestoreProfileRepository {
  constructor(uid, db = defaultDb) {
    this.ref = doc(db, 'users', uid)
  }

  // 프로필이 없으면 profile이 null(가입 중 저장 실패·예전 계정)
  load() {
    return run('profile', async () => {
      const snapshot = await getDoc(this.ref)
      const data = snapshot.exists() ? snapshot.data() : null
      return { profile: data?.nickname ? { nickname: data.nickname, look: normalizeLook(data.look) } : null }
    })
  }

  async save(profile) {
    const errors = validateProfile(profile)
    if (Object.keys(errors).length > 0) return { ok: false, errors, message: '입력한 내용을 확인해 주세요.' }
    const clean = { nickname: profile.nickname.trim(), look: normalizeLook(profile.look) }
    const result = await run('profile', () => setDoc(this.ref, { ...clean, updatedAt: serverTimestamp() }))
    return { ...result, errors: {}, profile: result.ok ? clean : null }
  }
}

export class FirestoreMatchRepository {
  constructor(uid, db = defaultDb) {
    this.matches = collection(db, 'users', uid, 'matches')
  }

  save(match) {
    return run('match', () => addDoc(this.matches, { ...toMatchDoc(match), createdAt: serverTimestamp() }).then(() => ({})))
  }

  // { plays, wins } — 온라인·연습 모두. 문서를 다 받지 않고 서버에서 개수만 센다.
  async summary() {
    const result = await run('match', async () => {
      const [all, wins] = await Promise.all([getCountFromServer(this.matches), getCountFromServer(query(this.matches, where('rank', '==', 1)))])
      return { plays: all.data().count, wins: wins.data().count }
    })
    return result.ok ? result : { ...result, plays: 0, wins: 0 }
  }
}
