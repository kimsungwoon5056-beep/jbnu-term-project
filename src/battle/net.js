import {
  get,
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database'
import { app, databaseURL } from '../firebase'
import { MAX_PLAYERS, makeRoomCode } from './roomCode'

// 실시간 대결 연결(Firebase Realtime Database). 경로: rooms/{코드}
//   meta: { host, status: waiting|playing|ended, createdAt, startAt }
//   slots/{0~3}: 참가자 uid(빈 자리에만 쓸 수 있어 5명째는 거절된다)
//   players/{uid}: { name, ready, loadout(시작 후 고정), s: { x, y, a, hp, alive, t } }
//   events/{id}: 발사·기술 시전 { k, o, x, y, a, s?, m?, t }
export const onlineAvailable = Boolean(app && databaseURL)
const database = () => getDatabase(app)
const roomRef = (code, path = '') => ref(database(), `rooms/${code}${path ? `/${path}` : ''}`)

const MESSAGES = {
  PERMISSION_DENIED: '이 방에 들어갈 수 없어요(이미 시작했거나 가득 찼어요).',
  full: '방이 가득 찼어요(최대 4명).',
  missing: '그런 방이 없어요. 코드를 확인해 주세요.',
  started: '이미 시작한 방이에요.',
}
export const netErrorMessage = (code) => MESSAGES[code] ?? '연결하지 못했어요. 잠시 후 다시 시도해 주세요.'

async function run(action) {
  try {
    return { ok: true, ...(await action()) }
  } catch (error) {
    const code = error?.code?.replace(/^.*\//, '').toUpperCase().replace(/-/g, '_') ?? error?.message
    return { ok: false, message: netErrorMessage(MESSAGES[error?.message] ? error.message : code) }
  }
}

// 빈 자리(0~3)를 차례로 잡아 본다. 규칙이 빈 자리에만 쓰기를 허용한다.
async function claimSlot(code, uid) {
  for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
    try {
      await set(roomRef(code, `slots/${slot}`), uid)
      return slot
    } catch {
      // 이미 찬 자리
    }
  }
  throw new Error('full')
}

async function enter(code, uid, loadout) {
  // 끊겼다 다시 들어오면 내 자리를 그대로 쓴다.
  const slots = (await get(roomRef(code, 'slots'))).val() ?? {}
  const mine = Object.entries(slots).find(([, value]) => value === uid)
  const slot = mine ? Number(mine[0]) : await claimSlot(code, uid)
  // 연결이 끊기면 내 칸을 지운다(상대 화면에서는 쓰러진 것으로 본다). 자리는 남겨 두어 다시 들어올 수 있다.
  await onDisconnect(roomRef(code, `players/${uid}`)).remove()
  await set(roomRef(code, `players/${uid}`), { name: loadout.name, ready: false, loadout, joinedAt: serverTimestamp() })
  return { code, slot }
}

export function createRoom(uid, loadout) {
  return run(async () => {
    for (let tries = 0; tries < 5; tries += 1) {
      const code = makeRoomCode()
      const meta = await get(roomRef(code, 'meta'))
      if (meta.exists()) continue
      await set(roomRef(code, 'meta'), { host: uid, status: 'waiting', createdAt: serverTimestamp() })
      return enter(code, uid, loadout)
    }
    throw new Error('busy')
  })
}

export function joinRoom(code, uid, loadout) {
  return run(async () => {
    const meta = await get(roomRef(code, 'meta'))
    if (!meta.exists()) throw new Error('missing')
    if (meta.val().status !== 'waiting') throw new Error('started')
    return enter(code, uid, loadout)
  })
}

export const setReady = (code, uid, ready) => run(() => update(roomRef(code, `players/${uid}`), { ready }))
export const startRoom = (code) => run(() => update(roomRef(code, 'meta'), { status: 'playing', startAt: serverTimestamp() }))
export const endRoom = (code) => run(() => update(roomRef(code, 'meta'), { status: 'ended' }))

// 내 칸과 자리를 지운다. 둘 중 하나라도 실패하면 그 결과({ ok: false, message })를 돌려준다.
export async function leaveRoom(code, uid, slot) {
  const player = await run(() => remove(roomRef(code, `players/${uid}`)))
  if (slot === null || slot === undefined) return player
  const seat = await run(() => remove(roomRef(code, `slots/${slot}`)))
  return player.ok ? seat : player
}

// 방 상태 구독: onChange({ meta, players })
export function watchRoom(code, onChange) {
  let meta = null
  let players = {}
  const loaded = { meta: false, players: false }
  // 두 값이 모두 온 뒤에만 알린다(참가자 목록이 오기 전의 빈 목록을 "모두 나감"으로 읽지 않게).
  const emit = () => loaded.meta && loaded.players && onChange({ meta, players })
  const offMeta = onValue(roomRef(code, 'meta'), (snap) => {
    meta = snap.val()
    loaded.meta = true
    emit()
  })
  const offPlayers = onValue(roomRef(code, 'players'), (snap) => {
    players = snap.val() ?? {}
    loaded.players = true
    emit()
  })
  return () => {
    offMeta()
    offPlayers()
  }
}

// 서버 시각과 내 시계의 차이(ms)
export function watchServerOffset(onOffset) {
  return onValue(ref(database(), '.info/serverTimeOffset'), (snap) => onOffset(snap.val() ?? 0))
}

// t(보낸 시각)를 넘기면 그 값을 쓰고, 없으면 서버가 받은 시각을 쓴다.
export const sendState = (code, uid, s) => set(roomRef(code, `players/${uid}/s`), { t: serverTimestamp(), ...s }).catch(() => {})
export const sendEvent = (code, ev) => push(roomRef(code, 'events'), { t: serverTimestamp(), ...ev }).catch(() => {})

// 다른 사람의 시전 이벤트만 넘긴다(내 것은 이미 내 화면에 있다).
export function watchEvents(code, uid, onEvent) {
  return onChildAdded(roomRef(code, 'events'), (snap) => {
    const ev = snap.val()
    if (ev && ev.o !== uid) onEvent(ev)
  })
}
