import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, setLogLevel, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// firestore.rules를 에뮬레이터에 올리고 비로그인·본인(alice)·다른 계정(bob)으로 읽고 써 본다.
// 쓰는 값은 앱이 실제로 보내는 모양과 같다(src/data/firestoreRepositories.js, records/recordDoc.js, data/matchDoc.js).
// 규칙이 request.time과 같기를 요구하는 칸(updatedAt·createdAt)은 앱처럼 serverTimestamp()로 보낸다.

const OWNER = 'alice'
const OTHER = 'bob'
let env

// 한국 시간 기준 오늘에서 days일 전의 날짜 키(YYYY-MM-DD). 음수면 미래
const DAY = 24 * 60 * 60 * 1000
const kstKey = (days = 0) => new Date(Date.now() + 9 * 60 * 60 * 1000 - days * DAY).toISOString().slice(0, 10)

const owner = () => env.authenticatedContext(OWNER).firestore()
const other = () => env.authenticatedContext(OTHER).firestore()
const anon = () => env.unauthenticatedContext().firestore()

// 규칙을 끄고 미리 넣어 둔다(오래된 기록처럼 지금은 새로 만들 수 없는 문서)
const seed = (path, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data))

const look = { skin: 'fair', hairStyle: 'short', hairColor: 'black', glasses: 'none' }
const profile = (extra = {}) => ({ nickname: '디톡스', look, updatedAt: serverTimestamp(), ...extra })

// recordDoc.toRecordDoc + updatedAt
const phone = (extra = {}) => ({
  total: 180,
  categories: { sns: 60, video: 60, game: 30, study: 10, creative: 0, shopping: 10, other: 10 },
  topApps: [{ name: '유튜브', minutes: 60 }],
  pickups: 50,
  firstPickup: '07:30',
  pickupApps: [{ name: '카카오톡', count: 20 }],
  notifications: 120,
  notifyApps: [{ name: '카카오톡', count: 80 }],
  ...extra,
})
const record = (date, extra = {}) => ({ date, phone: phone(), steps: 8000, updatedAt: serverTimestamp(), ...extra })
const recordPath = (uid, date) => `users/${uid}/records/${date}`

// matchDoc.toMatchDoc + createdAt
const match = (extra = {}) => ({ mode: 'online', rank: 1, players: 2, names: ['디톡스', '상대'], date: kstKey(), createdAt: serverTimestamp(), ...extra })
const matches = (db, uid = OWNER) => collection(db, 'users', uid, 'matches')

beforeAll(async () => {
  setLogLevel('error')
  env = await initializeTestEnvironment({
    projectId: 'demo-jbnu',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(() => env.clearFirestore())

afterAll(() => env.cleanup())

describe('프로필 users/{uid}', () => {
  it('본인은 만들고 읽고 고칠 수 있다', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'users', OWNER), profile()))
    await assertSucceeds(getDoc(doc(owner(), 'users', OWNER)))
    await assertSucceeds(setDoc(doc(owner(), 'users', OWNER), profile({ nickname: '새닉네임' })))
  })

  it('비로그인은 만들거나 읽을 수 없다', async () => {
    await assertFails(setDoc(doc(anon(), 'users', OWNER), profile()))
    await seed(`users/${OWNER}`, { nickname: '디톡스', look, updatedAt: new Date() })
    await assertFails(getDoc(doc(anon(), 'users', OWNER)))
  })

  it('다른 계정은 남의 프로필을 만들거나 읽거나 고칠 수 없다', async () => {
    await assertFails(setDoc(doc(other(), 'users', OWNER), profile()))
    await seed(`users/${OWNER}`, { nickname: '디톡스', look, updatedAt: new Date() })
    await assertFails(getDoc(doc(other(), 'users', OWNER)))
    await assertFails(setDoc(doc(other(), 'users', OWNER), profile({ nickname: '바꿔치기' })))
  })

  it('본인도 지울 수 없다', async () => {
    await seed(`users/${OWNER}`, { nickname: '디톡스', look, updatedAt: new Date() })
    await assertFails(deleteDoc(doc(owner(), 'users', OWNER)))
  })

  it('닉네임은 2~10자이고 앞뒤 공백이 없어야 한다', async () => {
    const ref = doc(owner(), 'users', OWNER)
    await assertSucceeds(setDoc(ref, profile({ nickname: '디톡' })))
    await assertSucceeds(setDoc(ref, profile({ nickname: '가나다라마바사아자차' })))
    await assertFails(setDoc(ref, profile({ nickname: '디' })))
    await assertFails(setDoc(ref, profile({ nickname: '가나다라마바사아자차카' })))
    await assertFails(setDoc(ref, profile({ nickname: ' 디톡스' })))
    await assertFails(setDoc(ref, profile({ nickname: '디톡스 ' })))
    await assertFails(setDoc(ref, profile({ nickname: 12345 })))
    // 글자 수는 UTF-16 단위(이모지 하나 = 2): 앱의 validateNickname(name.length)과 같게 센다(점검 10회차)
    await assertSucceeds(setDoc(ref, profile({ nickname: '😀' })))
    await assertSucceeds(setDoc(ref, profile({ nickname: '😀😀😀😀😀' })))
    await assertFails(setDoc(ref, profile({ nickname: '😀😀😀😀😀😀' })))
  })

  it('모습은 정해진 목록의 값만, 네 칸 모두 있어야 한다', async () => {
    const ref = doc(owner(), 'users', OWNER)
    await assertSucceeds(setDoc(ref, profile({ look: { skin: 'deep', hairStyle: 'ponytail', hairColor: 'ash', glasses: 'round' } })))
    await assertFails(setDoc(ref, profile({ look: { ...look, skin: 'green' } })))
    await assertFails(setDoc(ref, profile({ look: { ...look, hairStyle: 'mohawk' } })))
    await assertFails(setDoc(ref, profile({ look: { ...look, hairColor: 'pink' } })))
    await assertFails(setDoc(ref, profile({ look: { ...look, glasses: 'sunglasses' } })))
    await assertFails(setDoc(ref, profile({ look: { skin: 'fair', hairStyle: 'short', hairColor: 'black' } })))
    await assertFails(setDoc(ref, profile({ look: { ...look, hat: 'cap' } })))
  })

  it('정해지지 않은 칸을 넣거나 시각을 직접 쓰면 거절된다', async () => {
    const ref = doc(owner(), 'users', OWNER)
    await assertFails(setDoc(ref, profile({ admin: true })))
    await assertFails(setDoc(ref, profile({ updatedAt: new Date() })))
    await assertFails(setDoc(ref, { nickname: '디톡스', look }))
  })
})

describe('하루 기록 users/{uid}/records/{YYYY-MM-DD}', () => {
  it('본인은 오늘·어제(한국 시간) 기록을 새로 만들 수 있다', async () => {
    await assertSucceeds(setDoc(doc(owner(), recordPath(OWNER, kstKey(0))), record(kstKey(0))))
    await assertSucceeds(setDoc(doc(owner(), recordPath(OWNER, kstKey(1))), record(kstKey(1))))
  })

  it('그저께 이전이나 내일 기록은 새로 만들 수 없다', async () => {
    await assertFails(setDoc(doc(owner(), recordPath(OWNER, kstKey(2))), record(kstKey(2))))
    await assertFails(setDoc(doc(owner(), recordPath(OWNER, kstKey(-1))), record(kstKey(-1))))
  })

  it('본인만 읽을 수 있다', async () => {
    const date = kstKey(0)
    await seed(recordPath(OWNER, date), { date, steps: 100, updatedAt: new Date() })
    await assertSucceeds(getDoc(doc(owner(), recordPath(OWNER, date))))
    await assertFails(getDoc(doc(other(), recordPath(OWNER, date))))
    await assertFails(getDoc(doc(anon(), recordPath(OWNER, date))))
  })

  it('비로그인·다른 계정은 만들거나 고치거나 지울 수 없다', async () => {
    const date = kstKey(0)
    await assertFails(setDoc(doc(anon(), recordPath(OWNER, date)), record(date)))
    await assertFails(setDoc(doc(other(), recordPath(OWNER, date)), record(date)))
    await seed(recordPath(OWNER, date), { date, steps: 100, updatedAt: new Date() })
    await assertFails(setDoc(doc(other(), recordPath(OWNER, date)), record(date, { steps: 99999 })))
    await assertFails(deleteDoc(doc(other(), recordPath(OWNER, date))))
    await assertFails(deleteDoc(doc(anon(), recordPath(OWNER, date))))
  })

  it('고치기·지우기는 7일 안의 기록만 된다', async () => {
    for (const days of [6, 7, 8]) {
      const date = kstKey(days)
      await seed(recordPath(OWNER, date), { date, steps: 100, updatedAt: new Date() })
    }
    await assertSucceeds(setDoc(doc(owner(), recordPath(OWNER, kstKey(6))), record(kstKey(6))))
    await assertSucceeds(setDoc(doc(owner(), recordPath(OWNER, kstKey(7))), record(kstKey(7))))
    await assertFails(setDoc(doc(owner(), recordPath(OWNER, kstKey(8))), record(kstKey(8))))
    await assertSucceeds(deleteDoc(doc(owner(), recordPath(OWNER, kstKey(7)))))
    await assertFails(deleteDoc(doc(owner(), recordPath(OWNER, kstKey(8)))))
  })

  it('문서의 date는 문서 이름(날짜)과 같아야 하고, 날짜 모양이어야 한다', async () => {
    await assertFails(setDoc(doc(owner(), recordPath(OWNER, kstKey(0))), record(kstKey(1))))
    await assertFails(setDoc(doc(owner(), recordPath(OWNER, 'today')), record('today')))
    await assertFails(setDoc(doc(owner(), recordPath(OWNER, '2026-02-30')), record('2026-02-30')))
  })

  it('값 범위를 벗어나면 거절된다', async () => {
    const date = kstKey(0)
    const ref = doc(owner(), recordPath(OWNER, date))
    const bad = [
      { steps: 100001 },
      { steps: -1 },
      { steps: 1.5 },
      { phone: phone({ total: 1441 }) },
      { phone: phone({ categories: { ...phone().categories, sns: 1441 } }) },
      { phone: phone({ pickups: 1001 }) },
      { phone: phone({ notifications: 3001 }) },
      { phone: phone({ firstPickup: '25:00' }) },
      { phone: phone({ topApps: [1, 2, 3, 4].map((n) => ({ name: `앱${n}`, minutes: n })) }) },
    ]
    for (const extra of bad) await assertFails(setDoc(ref, record(date, extra)))
    await assertSucceeds(setDoc(ref, record(date, { steps: 100000, phone: phone({ total: 1440, pickups: 1000, notifications: 3000, firstPickup: null }) })))
  })

  it('스마트폰·걸음 중 하나는 있어야 하고, 하나만 있어도 된다', async () => {
    const date = kstKey(0)
    const ref = doc(owner(), recordPath(OWNER, date))
    await assertFails(setDoc(ref, record(date, { phone: null, steps: null })))
    await assertSucceeds(setDoc(ref, record(date, { phone: null })))
    await assertSucceeds(setDoc(ref, record(date, { steps: null })))
  })

  it('정해지지 않은 칸(지운 수면 기록·종류)을 넣거나 시각을 직접 쓰면 거절된다', async () => {
    const date = kstKey(0)
    const ref = doc(owner(), recordPath(OWNER, date))
    await assertFails(setDoc(ref, record(date, { sleep: 7 })))
    await assertFails(setDoc(ref, record(date, { phone: phone({ categories: { ...phone().categories, webtoon: 30 } }) })))
    await assertFails(setDoc(ref, record(date, { phone: phone({ battery: 50 }) })))
    await assertFails(setDoc(ref, record(date, { updatedAt: new Date() })))
  })
})

describe('대결 전적 users/{uid}/matches/{id}', () => {
  it('본인은 새 전적을 쓰고 읽을 수 있다', async () => {
    const ref = await assertSucceeds(addDoc(matches(owner()), match()))
    await assertSucceeds(getDoc(doc(owner(), ref.path)))
  })

  it('비로그인·다른 계정은 남의 전적을 쓰거나 읽을 수 없다', async () => {
    await assertFails(addDoc(matches(anon()), match()))
    await assertFails(addDoc(matches(other()), match()))
    await seed(`users/${OWNER}/matches/m1`, { ...match(), createdAt: new Date() })
    await assertFails(getDoc(doc(other(), `users/${OWNER}/matches/m1`)))
    await assertFails(getDoc(doc(anon(), `users/${OWNER}/matches/m1`)))
  })

  it('한 번 쓴 전적은 본인도 고치거나 지울 수 없다', async () => {
    await seed(`users/${OWNER}/matches/m1`, { ...match({ rank: 2 }), createdAt: new Date() })
    const ref = doc(owner(), `users/${OWNER}/matches/m1`)
    await assertFails(updateDoc(ref, { rank: 1 }))
    await assertFails(setDoc(ref, match({ rank: 1 })))
    await assertFails(deleteDoc(ref))
  })

  it('순위는 1~참가자 수, 참가자는 2~4명, 이름 수는 참가자 수와 같아야 한다', async () => {
    const db = owner()
    await assertSucceeds(addDoc(matches(db), match({ rank: 4, players: 4, names: ['가', '나', '다', '라'] })))
    await assertFails(addDoc(matches(db), match({ rank: 0 })))
    await assertFails(addDoc(matches(db), match({ rank: 3 })))
    await assertFails(addDoc(matches(db), match({ rank: 1.5 })))
    await assertFails(addDoc(matches(db), match({ players: 1, names: ['혼자'] })))
    await assertFails(addDoc(matches(db), match({ players: 5, names: ['가', '나', '다', '라', '마'] })))
    await assertFails(addDoc(matches(db), match({ names: ['디톡스'] })))
    await assertFails(addDoc(matches(db), match({ names: ['디톡스', '상대', '셋째'] })))
  })

  it('모드·날짜 모양이 틀리거나, 정해지지 않은 칸이 있거나, 시각을 직접 쓰면 거절된다', async () => {
    const db = owner()
    await assertFails(addDoc(matches(db), match({ mode: 'ranked' })))
    await assertFails(addDoc(matches(db), match({ date: '어제' })))
    await assertFails(addDoc(matches(db), match({ score: 999 })))
    await assertFails(addDoc(matches(db), match({ createdAt: new Date() })))
  })
})

describe('그 밖의 경로', () => {
  it('규칙에 없는 경로는 본인이어도 거절된다', async () => {
    await assertFails(setDoc(doc(owner(), 'rankings', OWNER), { score: 1 }))
    await assertFails(setDoc(doc(owner(), `users/${OWNER}/secrets/x`), { a: 1 }))
  })
})
