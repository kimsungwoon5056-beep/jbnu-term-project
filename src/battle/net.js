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
import { withTimeout } from '../lib/withTimeout'
import { MAX_PLAYERS, makeRoomCode } from './roomCode'

// 실시간 대결 연결(Firebase Realtime Database). 경로: rooms/{코드}
//   meta: { host, status: waiting|playing|ended, createdAt, startAt }
//   slots/{0~3}: 참가자 uid(빈 자리에만 쓸 수 있어 5명째는 거절된다)
//   players/{uid}: { name, ready, loadout(시작 후 고정), s: { x, y, a, hp, alive, t } }
//   events/{id}: 발사·기술 시전 { k, o, x, y, a, s?, m?, t }
export const onlineAvailable = Boolean(app && databaseURL)
const database = () => getDatabase(app)
const roomRef = (code, path = '') => ref(database(), `rooms/${code}${path ? `/${path}` : ''}`)

// 실패 안내: 무엇을 하다(what: enter 방 만들기·들어가기 | change 준비·시작·끝내기 | leave 나가기) 어떤 이유로 실패했는지 나눠 알린다.
// 서버가 응답하지 않으면 NET_TIMEOUT_MS 뒤 시간 초과로 실패시킨다(끝나지 않는 버튼이 되지 않게).
export const NET_TIMEOUT_MS = 10000
const MESSAGES = {
  full: '방이 가득 찼어요(최대 4명).',
  missing: '그런 방이 없어요. 코드를 확인해 주세요.',
  started: '이미 시작한 방이에요.',
  busy: '빈 방 코드를 찾지 못했어요. 다시 만들어 주세요.',
  DEADLINE_EXCEEDED: '서버 응답이 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
}
const DENIED = {
  enter: '이 방에 들어갈 수 없어요(이미 시작했거나 가득 찼어요).',
  change: '방 상태를 바꿀 수 없어요. 방에서 나갔다가 다시 들어와 주세요.',
  leave: '방에서 나가는 것을 서버가 거절했어요. 새로고침해 주세요.',
}
export function netErrorMessage(code, what = 'enter') {
  if (code === 'PERMISSION_DENIED') return DENIED[what] ?? DENIED.enter
  return MESSAGES[code] ?? '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 잠시 후 다시 시도해 주세요.'
}
const codeOf = (error) => (MESSAGES[error?.message] ? error.message : (error?.code?.replace(/^.*\//, '').toUpperCase().replace(/-/g, '_') ?? error?.message))

async function run(action, what = 'enter') {
  try {
    return { ok: true, ...(await withTimeout(action(), NET_TIMEOUT_MS)) }
  } catch (error) {
    return { ok: false, message: netErrorMessage(codeOf(error), what) }
  }
}

// 빈 자리(0~3)를 차례로 잡아 본다. 규칙이 빈 자리에만 쓰기를 허용하므로, 권한 거절이면 찬 자리다.
// 그 밖의 오류(연결 끊김 등)는 "가득 찼어요"로 뭉개지 않고 그대로 알린다.
async function claimSlot(code, uid) {
  for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
    try {
      await set(roomRef(code, `slots/${slot}`), uid)
      return slot
    } catch (error) {
      if (codeOf(error) !== 'PERMISSION_DENIED') throw error
    }
  }
  throw new Error('full')
}

async function enter(code, uid, loadout) {
  // 끊겼다 다시 들어오면 내 자리를 그대로 쓴다.
  const slots = (await get(roomRef(code, 'slots'))).val() ?? {}
  const mine = Object.entries(slots).find(([, value]) => value === uid)
  const slot = mine ? Number(mine[0]) : await claimSlot(code, uid)
  try {
    // 연결이 끊기면 내 칸을 지운다(상대 화면에서는 쓰러진 것으로 본다). 자리는 남겨 두어 다시 들어올 수 있다.
    await onDisconnect(roomRef(code, `players/${uid}`)).remove()
    await set(roomRef(code, `players/${uid}`), { name: loadout.name, ready: false, loadout, joinedAt: serverTimestamp() })
  } catch (error) {
    // 그 사이 대결이 시작됐다: 새로 잡은 자리를 돌려준다.
    if (!mine) await remove(roomRef(code, `slots/${slot}`)).catch(() => {})
    throw error
  }
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

// 대기실에서 연결이 끊겨 내 칸이 지워졌을 때 다시 들어간다(자리는 남아 있다).
export const reenterRoom = (code, uid, loadout) => run(() => enter(code, uid, loadout))

export const setReady = (code, uid, ready) => run(() => update(roomRef(code, `players/${uid}`), { ready }), 'change')
export const startRoom = (code) => run(() => update(roomRef(code, 'meta'), { status: 'playing', startAt: serverTimestamp() }), 'change')
export const endRoom = (code) => run(() => update(roomRef(code, 'meta'), { status: 'ended' }), 'change')

// 내 칸과 자리를 지운다. 둘 중 하나라도 실패하면 그 결과({ ok: false, message })를 돌려준다.
export async function leaveRoom(code, uid, slot) {
  const player = await run(() => remove(roomRef(code, `players/${uid}`)), 'leave')
  if (slot === null || slot === undefined) return player
  const seat = await run(() => remove(roomRef(code, `slots/${slot}`)), 'leave')
  return player.ok ? seat : player
}

// 방 구독이 서버에서 끊겼을 때(권한이 바뀜·로그인 만료 등) 보여 줄 문구
export const WATCH_LOST = '방과의 연결이 끊겼어요. 방에서 나갔다가 다시 들어와 주세요.'

// 방 상태 구독: onChange({ meta, players }). 구독이 거절·취소되면 onError(문구)를 부른다(빈 자리가 그대로 남아 보이지 않게).
export function watchRoom(code, onChange, onError = () => {}) {
  let meta = null
  let players = {}
  const loaded = { meta: false, players: false }
  // 두 값이 모두 온 뒤에만 알린다(참가자 목록이 오기 전의 빈 목록을 "모두 나감"으로 읽지 않게).
  const emit = () => loaded.meta && loaded.players && onChange({ meta, players })
  let lost = false
  const fail = () => {
    if (lost) return
    lost = true
    onError(WATCH_LOST)
  }
  const offMeta = onValue(
    roomRef(code, 'meta'),
    (snap) => {
      meta = snap.val()
      loaded.meta = true
      emit()
    },
    fail,
  )
  const offPlayers = onValue(
    roomRef(code, 'players'),
    (snap) => {
      players = snap.val() ?? {}
      loaded.players = true
      emit()
    },
    fail,
  )
  return () => {
    offMeta()
    offPlayers()
  }
}

// 서버 시각과 내 시계의 차이(ms)
export function watchServerOffset(onOffset) {
  return onValue(ref(database(), '.info/serverTimeOffset'), (snap) => onOffset(snap.val() ?? 0))
}

// 서버와 연결돼 있는지
export function watchConnected(onConnected) {
  return onValue(ref(database(), '.info/connected'), (snap) => onConnected(snap.val() === true))
}

// 서버가 받았으면 true, 거절했으면 false. t(보낸 시각)를 넘기면 그 값을 쓰고, 없으면 서버가 받은 시각을 쓴다.
export const sendState = (code, uid, s) => set(roomRef(code, `players/${uid}/s`), { t: serverTimestamp(), ...s }).then(
    () => true,
    () => false,
  )
export const sendEvent = (code, ev) => push(roomRef(code, 'events'), { t: serverTimestamp(), ...ev }).catch(() => {})

// 다른 사람의 시전 이벤트만 넘긴다(내 것은 이미 내 화면에 있다).
export function watchEvents(code, uid, onEvent) {
  return onChildAdded(roomRef(code, 'events'), (snap) => {
    const ev = snap.val()
    if (ev && ev.o !== uid) onEvent(ev)
  })
}
