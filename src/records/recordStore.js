import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { firestoreErrorMessage, fromRecordDoc, planDelete, planSave, toRecordDoc } from './recordDoc'

const recordsOf = (uid) => collection(db, 'users', uid, 'records')
const recordRef = (uid, dateKey) => doc(db, 'users', uid, 'records', dateKey)

// 화면에서는 성공 여부와 안내 문구만 다루도록 Firestore 호출 결과를 정리한다.
async function run(action) {
  try {
    return { ok: true, message: '', ...(await action()) }
  } catch (error) {
    return { ok: false, message: firestoreErrorMessage(error?.code) }
  }
}

// 그날 기록. 없으면 record가 null이다.
export function loadRecord(uid, dateKey) {
  return run(async () => {
    const snapshot = await getDoc(recordRef(uid, dateKey))
    return { record: snapshot.exists() ? fromRecordDoc(dateKey, snapshot.data()) : null }
  })
}

// 최근 기록부터 count개
export function listRecentRecords(uid, count = 7) {
  return run(async () => {
    const snapshot = await getDocs(query(recordsOf(uid), orderBy('date', 'desc'), limit(count)))
    return { records: snapshot.docs.map((item) => fromRecordDoc(item.id, item.data())) }
  })
}

export async function saveRecord(uid, record, todayKey) {
  const existing = await run(async () => ({ exists: (await getDoc(recordRef(uid, record.date))).exists() }))
  if (!existing.ok) return { ...existing, errors: {} }

  const plan = planSave({ record, exists: existing.exists, todayKey })
  if (!plan.ok) return plan

  const result = await run(() =>
    setDoc(recordRef(uid, record.date), { ...toRecordDoc(record), updatedAt: serverTimestamp() }),
  )
  return { ...result, errors: {}, action: plan.action }
}

export async function deleteRecord(uid, dateKey, todayKey) {
  const plan = planDelete({ dateKey, todayKey })
  if (!plan.ok) return plan
  return run(() => deleteDoc(recordRef(uid, dateKey)))
}
