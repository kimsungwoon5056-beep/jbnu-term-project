import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { get, push, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// database.rules.json을 에뮬레이터에 올리고 대결 방(rooms/{코드})을 비로그인·방장·참가자·방 밖 사람으로 써 본다.
// 쓰는 값은 src/battle/net.js(createRoom·joinRoom·setReady·startRoom·endRoom·leaveRoom·sendState·sendEvent)와 같은 모양이다.

const HOST = 'alice' // 방장(0번 자리)
const GUEST = 'bob' // 참가자(1번 자리)
const OUTSIDER = 'carol' // 자리가 없는 로그인 사용자
const CODE = 'AB23'
let env

const as = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database()
const at = (uid, path = '') => ref(as(uid), `rooms/${CODE}${path ? `/${path}` : ''}`)

// 능력(loadout.js buildLoadout 결과에서 규칙이 보는 칸만 남김)
const loadout = (name) => ({ name, hp: 80, speed: 128, skill: 'detox', tier: 1 })
// loop.js sendMe가 보내는 상태 + net.sendState의 t
const state = (extra = {}) => ({ t: serverTimestamp(), x: 100, y: 200, a: 0.5, hp: 50, alive: true, l: 2, z: 0, ...extra })
const shot = (o, extra = {}) => ({ t: Date.now(), k: 'shot', o, x: 100, y: 200, a: 1.2, s: 'detox', c: 1, ...extra })

// 규칙을 끄고 방을 차려 둔다: 방장 alice(0번)·참가자 bob(1번), 둘 다 능력과 상태가 있다.
async function seedRoom(status = 'waiting') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), `rooms/${CODE}`), {
      meta: { host: HOST, status, createdAt: 1 },
      slots: { 0: HOST, 1: GUEST },
      players: {
        [HOST]: { name: '방장', ready: true, loadout: loadout('방장'), joinedAt: 1, s: { t: 1, x: 0, y: 0, a: 0, hp: 50, alive: true, l: 2, z: 0 } },
        [GUEST]: { name: '참가자', ready: false, loadout: loadout('참가자'), joinedAt: 1, s: { t: 1, x: 0, y: 0, a: 0, hp: 50, alive: true, l: 2, z: 0 } },
      },
      events: { e1: shot(HOST) },
    })
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-jbnu',
    database: { rules: readFileSync('database.rules.json', 'utf8') },
  })
})

beforeEach(() => env.clearDatabase())

afterAll(() => env.cleanup())

describe('방 만들기 meta', () => {
  it('로그인한 사용자는 자기를 방장으로, 대기 상태로 방을 만들 수 있다 (createRoom)', async () => {
    await assertSucceeds(set(at(HOST, 'meta'), { host: HOST, status: 'waiting', createdAt: serverTimestamp() }))
  })

  it('비로그인은 방을 만들 수 없다', async () => {
    await assertFails(set(at(null, 'meta'), { host: 'someone', status: 'waiting', createdAt: serverTimestamp() }))
  })

  it('방 코드는 헷갈리는 글자(0·O·1·I·L)를 뺀 대문자·숫자 4자리여야 한다', async () => {
    for (const code of ['ab23', 'AB2', 'AB234', 'AB1O', 'ABIL', 'AB-2']) {
      await assertFails(set(ref(as(HOST), `rooms/${code}/meta`), { host: HOST, status: 'waiting', createdAt: serverTimestamp() }))
    }
    await assertSucceeds(set(ref(as(HOST), 'rooms/ZZ99/meta'), { host: HOST, status: 'waiting', createdAt: serverTimestamp() }))
  })

  it('남을 방장으로 적거나, 시작한 상태로 만들거나, 정해지지 않은 칸을 넣을 수 없다', async () => {
    await assertFails(set(at(HOST, 'meta'), { host: GUEST, status: 'waiting', createdAt: serverTimestamp() }))
    await assertFails(set(at(HOST, 'meta'), { host: HOST, status: 'playing', createdAt: serverTimestamp() }))
    await assertFails(set(at(HOST, 'meta'), { host: HOST, status: 'waiting', createdAt: serverTimestamp(), prize: 100 }))
    await assertFails(set(at(HOST, 'meta'), { host: HOST, createdAt: serverTimestamp() }))
  })

  it('이미 있는 방을 남이 덮어쓸 수 없다', async () => {
    await seedRoom()
    await assertFails(set(at(OUTSIDER, 'meta'), { host: OUTSIDER, status: 'waiting', createdAt: serverTimestamp() }))
  })
})

describe('방 상태 바꾸기 meta.status·host', () => {
  it('방장은 대기 → 시작 → 끝 순서로 바꿀 수 있다 (startRoom·endRoom)', async () => {
    await seedRoom()
    await assertSucceeds(update(at(HOST, 'meta'), { status: 'playing', startAt: serverTimestamp() }))
    await assertSucceeds(update(at(HOST, 'meta'), { status: 'ended' }))
  })

  it('상태를 되돌리거나 건너뛸 수 없다', async () => {
    await seedRoom('ended')
    await assertFails(update(at(HOST, 'meta'), { status: 'waiting' }))
    await assertFails(update(at(HOST, 'meta'), { status: 'playing' }))
    await seedRoom('playing')
    await assertFails(update(at(HOST, 'meta'), { status: 'waiting' }))
    await seedRoom('waiting')
    await assertFails(update(at(HOST, 'meta'), { status: 'ended' }))
    await assertFails(update(at(HOST, 'meta'), { status: 'paused' }))
  })

  it('방장이 아니면 상태를 바꿀 수 없다', async () => {
    await seedRoom()
    await assertFails(update(at(GUEST, 'meta'), { status: 'playing', startAt: serverTimestamp() }))
    await assertFails(update(at(OUTSIDER, 'meta'), { status: 'playing', startAt: serverTimestamp() }))
  })

  it('방장을 바꿀 수 없다(방장 본인도)', async () => {
    await seedRoom()
    await assertFails(update(at(HOST, 'meta'), { host: GUEST }))
    await assertFails(update(at(GUEST, 'meta'), { host: GUEST }))
  })
})

describe('자리 slots/{0~3}', () => {
  it('대기 중인 방의 빈 자리는 자기 uid로 잡을 수 있다 (joinRoom claimSlot)', async () => {
    await seedRoom()
    await assertSucceeds(set(at(OUTSIDER, 'slots/2'), OUTSIDER))
  })

  it('남이 앉은 자리를 빼앗거나 비울 수 없다', async () => {
    await seedRoom()
    await assertFails(set(at(OUTSIDER, 'slots/0'), OUTSIDER))
    await assertFails(remove(at(OUTSIDER, 'slots/1')))
    await assertFails(remove(at(GUEST, 'slots/0')))
  })

  it('빈 자리에 남의 uid를 적을 수 없다', async () => {
    await seedRoom()
    await assertFails(set(at(OUTSIDER, 'slots/2'), 'dave'))
  })

  it('시작한 방이나 없는 방의 자리는 잡을 수 없다', async () => {
    await seedRoom('playing')
    await assertFails(set(at(OUTSIDER, 'slots/2'), OUTSIDER))
    await assertFails(set(ref(as(OUTSIDER), 'rooms/QQ22/slots/0'), OUTSIDER))
  })

  it('자리는 0~3번뿐이다(5명째 거절)', async () => {
    await seedRoom()
    await assertFails(set(at(OUTSIDER, 'slots/4'), OUTSIDER))
  })

  it('비로그인은 자리를 잡을 수 없다', async () => {
    await seedRoom()
    await assertFails(set(at(null, 'slots/2'), 'anon'))
  })

  it('자기 자리는 비울 수 있다 (leaveRoom)', async () => {
    await seedRoom()
    await assertSucceeds(remove(at(GUEST, 'slots/1')))
  })
})

describe('참가자 칸 players/{uid}', () => {
  it('자리를 잡은 사람은 자기 칸을 만들고 준비를 바꾸고 지울 수 있다 (enter·setReady·leaveRoom)', async () => {
    await seedRoom()
    await assertSucceeds(set(at(OUTSIDER, 'slots/2'), OUTSIDER))
    await assertSucceeds(set(at(OUTSIDER, `players/${OUTSIDER}`), { name: '셋째', ready: false, loadout: loadout('셋째'), joinedAt: serverTimestamp() }))
    await assertSucceeds(update(at(OUTSIDER, `players/${OUTSIDER}`), { ready: true }))
    await assertSucceeds(remove(at(OUTSIDER, `players/${OUTSIDER}`)))
  })

  it('자리가 없으면 자기 칸도 만들 수 없다', async () => {
    await seedRoom()
    await assertFails(set(at(OUTSIDER, `players/${OUTSIDER}`), { name: '셋째', ready: false, loadout: loadout('셋째'), joinedAt: serverTimestamp() }))
  })

  it('남의 칸은 쓰거나 지울 수 없다', async () => {
    await seedRoom()
    await assertFails(update(at(GUEST, `players/${HOST}`), { ready: false }))
    await assertFails(remove(at(GUEST, `players/${HOST}`)))
    await assertFails(set(at(null, `players/${HOST}/s`), state()))
  })

  it('이름은 1~10자, 준비는 참·거짓이어야 하고 정해지지 않은 칸은 거절된다', async () => {
    await seedRoom()
    await assertFails(update(at(GUEST, `players/${GUEST}`), { name: '' }))
    await assertFails(update(at(GUEST, `players/${GUEST}`), { name: '가나다라마바사아자차카' }))
    await assertSucceeds(update(at(GUEST, `players/${GUEST}`), { name: '가나다라마바사아자차' }))
    await assertFails(update(at(GUEST, `players/${GUEST}`), { ready: 'yes' }))
    await assertFails(update(at(GUEST, `players/${GUEST}`), { admin: true }))
  })

  it('능력(loadout)은 대기 중에만 바꿀 수 있다', async () => {
    await seedRoom()
    await assertSucceeds(set(at(GUEST, `players/${GUEST}/loadout`), { ...loadout('참가자'), speed: 150 }))
    await seedRoom('playing')
    await assertFails(set(at(GUEST, `players/${GUEST}/loadout`), { ...loadout('참가자'), hp: 100 }))
  })
})

describe('대결 상태 players/{uid}/s', () => {
  it('자기 상태는 보낼 수 있다 (sendState)', async () => {
    await seedRoom('playing')
    await assertSucceeds(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 40, l: 1 })))
  })

  it('남의 상태는 쓸 수 없다(방 안 사람도)', async () => {
    await seedRoom('playing')
    await assertFails(set(at(GUEST, `players/${HOST}/s`), state({ hp: 0, alive: false, l: 0 })))
    await assertFails(set(at(OUTSIDER, `players/${HOST}/s`), state({ hp: 0 })))
  })

  it('대결 중에는 체력을 능력 최대치(80)보다 높이 올릴 수 없다', async () => {
    await seedRoom('playing')
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 81 })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 100 })))
    // 최대치까지 회복(되살아남·실드 회복)은 된다
    await assertSucceeds(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 80 })))
  })

  it('대결 중에는 목숨을 늘릴 수 없다', async () => {
    await seedRoom('playing')
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ l: 3 })))
    await assertSucceeds(set(at(GUEST, `players/${GUEST}/s`), state({ l: 1 })))
  })

  it('값 범위를 벗어나거나 정해지지 않은 칸이 있으면 거절된다', async () => {
    await seedRoom('waiting')
    await assertSucceeds(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 100, l: 3 })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 101 })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ hp: -1 })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ l: 4 })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ z: 201 })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ x: 'far' })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ alive: 1 })))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ god: true })))
  })
})

describe('시전 이벤트 events/{id}', () => {
  it('자리가 있는 사람은 자기 이름(o)으로 이벤트를 보낼 수 있다 (sendEvent)', async () => {
    await seedRoom('playing')
    await assertSucceeds(push(at(GUEST, 'events'), { ...shot(GUEST), t: serverTimestamp() }))
    await assertSucceeds(push(at(GUEST, 'events'), { t: serverTimestamp(), k: 'skill', o: GUEST, x: 1, y: 2, a: 0, s: 'detox' }))
    await assertSucceeds(push(at(GUEST, 'events'), { t: serverTimestamp(), k: 'pick', o: GUEST, x: 1, y: 2, a: 0, i: 3 }))
  })

  it('남의 이름(o)으로 보내거나 o를 빼면 거절된다', async () => {
    await seedRoom('playing')
    await assertFails(push(at(GUEST, 'events'), shot(HOST)))
    await assertFails(push(at(GUEST, 'events'), { t: Date.now(), k: 'shot', x: 1, y: 2, a: 0 }))
  })

  it('이미 있는 이벤트는 덮어쓰거나 지울 수 없다(보낸 사람도)', async () => {
    await seedRoom('playing')
    await assertFails(set(at(GUEST, 'events/e1'), shot(GUEST)))
    await assertFails(set(at(HOST, 'events/e1'), shot(HOST, { c: 99 })))
    await assertFails(remove(at(HOST, 'events/e1')))
  })

  it('자리가 없거나 비로그인이면 보낼 수 없다', async () => {
    await seedRoom('playing')
    await assertFails(push(at(OUTSIDER, 'events'), shot(OUTSIDER)))
    await assertFails(push(at(null, 'events'), shot('anon')))
  })

  it('종류(k)는 shot·skill·pick만, pick은 아이템 번호(i)가 있어야 하고, x·y·a가 있어야 한다', async () => {
    await seedRoom('playing')
    await assertFails(push(at(GUEST, 'events'), shot(GUEST, { k: 'kill' })))
    await assertFails(push(at(GUEST, 'events'), { t: Date.now(), k: 'pick', o: GUEST, x: 1, y: 2, a: 0 }))
    await assertFails(push(at(GUEST, 'events'), { t: Date.now(), k: 'shot', o: GUEST, x: 1, a: 0 }))
  })
})

// 지웠다가 다시 쓰기: .validate는 지우기에는 돌지 않으므로, 지운 뒤 다시 써서 검사를 건너뛰는 길을 막는다(2026-11-27 고침, 예전 "알려진 빈틈").
describe('지웠다가 다시 쓰기', () => {
  it('방 전체는 방장도 지울 수 없다', async () => {
    await seedRoom('playing')
    await assertFails(remove(at(HOST)))
  })

  it('대결 중에는 자기 상태(s)만 지울 수 없다(지운 뒤 체력·목숨을 처음 값으로 되돌리는 길)', async () => {
    await seedRoom('playing')
    await assertFails(remove(at(GUEST, `players/${GUEST}/s`)))
    await assertFails(update(at(GUEST, `players/${GUEST}`), { s: null }))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 100, l: 3 })))
  })

  it('대결 중에도 자기 칸 전체는 지울 수 있다(나가기·연결 끊김, leaveRoom·onDisconnect)', async () => {
    await seedRoom('playing')
    await assertSucceeds(remove(at(GUEST, `players/${GUEST}`)))
  })

  it('대결의 첫 상태(아직 s가 없음)는 능력 최대치까지만 보낼 수 있다', async () => {
    await seedRoom('playing')
    await env.withSecurityRulesDisabled((ctx) => remove(ref(ctx.database(), `rooms/${CODE}/players/${GUEST}/s`)))
    await assertFails(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 100, l: 3 })))
    await assertSucceeds(set(at(GUEST, `players/${GUEST}/s`), state({ hp: 80, l: 3 })))
  })

  it('방장도 meta를 지울 수 없다(지운 뒤 끝난 방을 대기로 되돌리거나 남이 방장으로 다시 만드는 길)', async () => {
    await seedRoom('ended')
    await assertFails(update(at(HOST, 'meta'), { status: 'waiting' }))
    await assertFails(remove(at(HOST, 'meta')))
    await assertFails(set(at(OUTSIDER, 'meta'), { host: OUTSIDER, status: 'waiting', createdAt: serverTimestamp() }))
  })
})

describe('읽기', () => {
  it('meta·slots는 로그인한 누구나, 방 전체(참가자·이벤트)는 자리가 있는 사람만 읽는다', async () => {
    await seedRoom('waiting')
    await assertSucceeds(get(at(OUTSIDER, 'meta')))
    await assertSucceeds(get(at(OUTSIDER, 'slots')))
    await assertSucceeds(get(at(GUEST, '')))
    await assertSucceeds(get(at(GUEST, 'events')))
    await assertFails(get(at(OUTSIDER, 'players')))
    await assertFails(get(at(OUTSIDER, 'events')))
    await assertFails(get(at(null, 'meta')))
    await assertFails(get(ref(as(HOST), 'rooms')))
  })
})
