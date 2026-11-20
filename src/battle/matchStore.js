import { addDoc, collection, getCountFromServer, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import { firestoreErrorMessage } from '../records/recordDoc'

// 전적: users/{uid}/matches/{id} = { mode: practice|online, rank, players, names[], date, createdAt } (본인만)
const matchesOf = (uid) => collection(db, 'users', uid, 'matches')

export function toMatchDoc({ mode, rank, names, date }) {
  return { mode, rank, players: names.length, names: names.map((name) => String(name).slice(0, 10)), date }
}

export async function saveMatch(uid, match) {
  try {
    await addDoc(matchesOf(uid), { ...toMatchDoc(match), createdAt: serverTimestamp() })
    return { ok: true }
  } catch (error) {
    return { ok: false, message: firestoreErrorMessage(error?.code, 'match') }
  }
}

// { plays, wins } — 온라인·연습 모두
export async function loadRecordSummary(uid) {
  try {
    const [all, wins] = await Promise.all([
      getCountFromServer(matchesOf(uid)),
      getCountFromServer(query(matchesOf(uid), where('rank', '==', 1))),
    ])
    return { ok: true, plays: all.data().count, wins: wins.data().count }
  } catch (error) {
    return { ok: false, plays: 0, wins: 0, message: firestoreErrorMessage(error?.code, 'match') }
  }
}
