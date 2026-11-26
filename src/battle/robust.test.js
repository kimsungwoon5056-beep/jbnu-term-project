import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onBeforeLogout, runBeforeLogout } from '../lib/beforeLogout'
import { DEFAULT_LOOK } from '../profile/look'
import { FirebaseRoomChannel, linkWorld, MemoryRoom, STALE } from './channel'
import { buildLoadout } from './loadout'
import { FROZEN_LIMIT, LOST_LIMIT, OnlineLoop, PracticeLoop, SILENT_LIMIT } from './loop'
import { Playing } from './phases'
import { applyDamage, applyRemote, createWorld, drawIds, isOut, OBSTACLES, rankPlayers, spawnEvent, stepWorld } from './world'

// 끊김·늦음·동시 같은 어긋나기 쉬운 상황

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const makeWorld = (...locals) => createWorld({ events: false, mode: 'online', players: ['a', 'b', 'c'].slice(0, locals.length).map((id, i) => ({ id, loadout: loadout(id), local: locals[i] })) })
const put = (player, x, y) => Object.assign(player, { x, y, tx: x, ty: y })
const loopOf = (world, channel, startAt = 0) => new OnlineLoop({ world, renderer: { draw() {} }, input: { commands: () => [] }, meId: 'a', channel, startAt })

describe('늦게 받은 탄', () => {
  const beam = { k: 'skill', s: 'webtoon', o: 'b', x: 40, y: 300, a: 0 }

  it('늦게 받은 근접 공격은 준비를 건너뛰고 바로 맞힌다', () => {
    const world = makeWorld(true, false)
    put(world.players[0], 90, 230)
    put(world.players[1], 40, 230)
    spawnEvent(world, { k: 'shot', s: 'detox', c: 2, o: 'b', x: 40, y: 230, a: 0 }, { ahead: 0.2 })
    stepWorld(world, {}, 1 / 60)
    expect(world.players[0].hp).toBeLessThan(world.players[0].maxHp)
  })

  it('앱 아이콘(벽)을 뚫고 나가지 않는다', () => {
    const world = makeWorld(true, false)
    const wall = OBSTACLES[0]
    put(world.players[0], 300, 300)
    spawnEvent(world, { ...beam, x: wall.x - 30, y: wall.y + 28 }, { ahead: 0.2 })
    expect(world.projectiles.active.some((shot) => shot.active)).toBe(false)
  })

  it('끊겼다 몰려온 옛 공격, 이 판에 없는 사람·쓰러진 사람의 공격은 버리고, 아이템 줍기는 받는다', () => {
    const world = makeWorld(true, false)
    const listeners = {}
    linkWorld(world, { now: () => 10000, onEvent: (fn) => ((listeners.event = fn), () => {}), onPeers: () => () => {} }, 'a')
    const shot = { k: 'shot', o: 'b', x: 40, y: 300, a: 0, t: 9990 }
    listeners.event({ ...shot, t: 10000 - STALE * 1000 - 1 })
    listeners.event({ ...shot, o: 'ghost' })
    expect(world.swings).toHaveLength(0)
    listeners.event(shot)
    expect(world.swings).toHaveLength(1)
    world.players[1].alive = false
    listeners.event(shot)
    expect(world.swings).toHaveLength(1)
    const item = world.items[0]
    listeners.event({ k: 'pick', o: 'b', x: 0, y: 0, a: 0, i: item.id, t: 0 })
    expect(item.taken).toBe(true)
    world.over = true
    listeners.event(shot)
    expect(world.swings).toHaveLength(1)
  })
})

describe('여러 명', () => {
  it('근접 공격은 앞에 선 상대 뒤, 리치 밖에 있는 나를 맞히지 않는다', () => {
    const world = makeWorld(true, false, false) // 나 a, 때린 사람 b, 앞에 선 사람 c
    put(world.players[0], 140, 230)
    put(world.players[1], 40, 230)
    put(world.players[2], 80, 230)
    spawnEvent(world, { k: 'shot', s: 'detox', c: 2, o: 'b', x: 40, y: 230, a: 0 })
    for (let i = 0; i < 60; i += 1) stepWorld(world, {}, 1 / 60)
    expect(world.players[0].hp).toBe(world.players[0].maxHp)
  })

  it('상대가 밟은 덫은 내 화면에서도 사라진다', () => {
    const world = makeWorld(true, false, false)
    put(world.players[0], 300, 520)
    put(world.players[1], 40, 230)
    put(world.players[2], 160, 230)
    spawnEvent(world, { k: 'skill', e: 1, s: 'video', o: 'b', x: 40, y: 230, a: 0 })
    expect(world.traps).toHaveLength(1)
    stepWorld(world, {}, 1 / 60)
    expect(world.traps).toHaveLength(0)
  })
})

describe('끊김', () => {
  let clock
  beforeEach(() => {
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => vi.restoreAllMocks())

  const setup = () => {
    const world = makeWorld(true, false)
    const channel = new MemoryRoom().join('a')
    let notify
    channel.onConnection = (fn) => ((notify = fn), () => {})
    const loop = loopOf(world, channel)
    return { world, loop, notify: (on) => notify(on) }
  }

  it('서버가 내 칸을 지운 뒤 다시 이어지면 내 화면에서도 아웃이다(양쪽이 이기지 않게)', () => {
    const { world, notify } = setup()
    notify(false)
    expect(world.players[0].alive).toBe(true)
    notify(true)
    expect(world.players[0].alive).toBe(false)
    expect(world.disconnected).toBe(true)
    expect(rankPlayers(world)[0].id).toBe('b')
  })

  it('오래 끊겨 있으면 다시 이어지기를 기다리지 않고 아웃된다', () => {
    const { world, loop, notify } = setup()
    notify(false)
    clock = LOST_LIMIT * 1000 - 10
    loop.afterStep(1 / 60)
    expect(world.players[0].alive).toBe(true)
    clock = LOST_LIMIT * 1000 + 10
    loop.afterStep(1 / 60)
    expect(world.players[0].alive).toBe(false)
  })

  it('Firebase 창구: 처음의 "아직 연결 전"은 끊김으로 알리지 않는다', () => {
    let emit
    const channel = new FirebaseRoomChannel('ABCD', 'a', { watchServerOffset: () => () => {}, watchConnected: (fn) => ((emit = fn), () => {}) })
    const got = []
    channel.onConnection((on) => got.push(on))
    for (const on of [false, true, false, true]) emit(on)
    expect(got.slice(-2)).toEqual([false, true])
    expect(got.filter((on) => !on)).toHaveLength(1)
  })
})

describe('소식이 끊긴 사람', () => {
  // 시계를 손으로 돌리는 온라인 루프(서버의 답 acks까지)
  function table(...locals) {
    let now = 0
    const sent = []
    const channel = { acks: 0, ackedT: null, now: () => now, sendState: (s) => sent.push(s), sendEvent() {} }
    const world = makeWorld(...locals)
    const loop = loopOf(world, channel)
    const pass = (seconds, each) => {
      for (let i = 0; i < Math.round(seconds * 20); i += 1) {
        now += 50
        each?.(now)
        loop.afterStep(0.05)
      }
    }
    const ack = () => Object.assign(channel, { acks: channel.acks + 1, ackedT: now })
    return { world, loop, channel, sent, pass, ack, jump: (seconds) => (now += seconds * 1000) }
  }

  it('조용한 상대는 마지막 소식의 때 쓰러진 것으로 보고, 소식을 보내는 상대는 그대로 둔다', () => {
    const { world, pass, ack } = table(true, false, false)
    const [, b, c] = world.players
    const talk = (now) => {
      ack()
      applyRemote(world, 'c', { x: 100, y: 300, hp: 50, alive: true, t: now }, { now })
      if (now <= 1000) applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, t: now }, { now })
    }
    pass(1 + SILENT_LIMIT - 0.5, talk)
    expect(b.alive).toBe(true)
    pass(1, talk)
    expect(b.alive).toBe(false)
    expect(b.downAt).toBeCloseTo(1)
    expect(c.alive && world.players[0].alive).toBe(true)
  })

  it('서버의 답이 없으면 상대가 아니라 내가 끊긴 것으로 보고, 서버가 마지막으로 받은 때 쓰러진다', () => {
    const { world, pass, ack, sent } = table(true, false)
    const [me, b] = world.players
    pass(2, (now) => {
      ack()
      applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, t: now }, { now })
    })
    pass(LOST_LIMIT + 0.5)
    expect(me.alive).toBe(false)
    expect(me.downAt).toBeCloseTo(2)
    expect(b.alive).toBe(true)
    expect(sent.at(-1)).toMatchObject({ alive: false, t: 2000 })
    expect(world.over).toBe(true) // 남은 판은 볼 수 없으니 여기서 끝난다
    pass(SILENT_LIMIT + 1)
    expect(b.alive).toBe(true)
  })

  it('끊겼다 바로 이어지면 아웃이지만 남은 판은 끝까지 볼 수 있다', () => {
    let notify
    const world = makeWorld(true, false, false)
    const channel = { now: () => 1000, sendState() {}, sendEvent() {}, onConnection: (fn) => ((notify = fn), () => {}) }
    const loop = loopOf(world, channel)
    loop.afterStep(0.05)
    notify(false)
    notify(true)
    expect(world.players[0].alive).toBe(false)
    const clock = vi.spyOn(performance, 'now').mockReturnValue(performance.now() + (LOST_LIMIT + 1) * 1000)
    loop.afterStep(0.05)
    clock.mockRestore()
    expect(world.over).toBe(false)
  })

  it('잠깐(3초) 답이 없다가 이어지면 아무도 아웃되지 않는다', () => {
    const { world, pass, ack } = table(true, false)
    const talk = (now) => {
      ack()
      applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, t: now }, { now })
    }
    pass(1, talk)
    pass(3)
    pass(1, talk)
    expect(world.players.every((player) => player.alive)).toBe(true)
  })

  it('화면이 통째로 오래 멈췄다 깨어나면 아웃된다(상대 화면에서는 이미 아웃이다)', () => {
    const { world, pass, ack, jump } = table(true, false)
    pass(1, ack)
    jump(FROZEN_LIMIT + 0.1)
    pass(0.05, ack)
    expect(world.players[0].alive).toBe(false)
    expect(world.over).toBe(false) // 연결은 살아 있으니 이어서 구경한다
    expect(SILENT_LIMIT - FROZEN_LIMIT).toBeGreaterThanOrEqual(1)
  })

  it('서버가 내 칸을 지우면 내 화면에서도 아웃되고, 상대의 쓰러진 시각은 마지막 소식의 때다', () => {
    const { world, loop } = table(true, false)
    let peers
    linkWorld(world, { now: () => 900, onEvent: () => () => {}, onPeers: (fn) => ((peers = fn), () => {}) }, 'a')
    peers({ a: null, b: { x: 200, y: 300, hp: 50, alive: true, t: 700 } })
    loop.afterStep(0.05)
    expect(world.players[0].alive).toBe(true)
    peers({ b: { x: 200, y: 300, hp: 50, alive: true, t: 750 } })
    loop.afterStep(0.05)
    expect(world.players[0].alive).toBe(false)
    peers({ a: null })
    expect(world.players[1]).toMatchObject({ alive: false, downAt: 0.75 })
  })

  it('밀린 걸음을 따라잡는 동안에는 상태를 한 번만 보낸다', () => {
    const { world, loop, sent } = table(true, false)
    loop.setPhase(Playing)
    Playing.frame(loop, 1)
    expect(world.over).toBe(false)
    expect(sent.length).toBeLessThanOrEqual(2)
  })
})

describe('목숨과 다시 시작(온라인)', () => {
  function table() {
    let now = 0
    const sent = []
    const channel = { acks: 0, ackedT: null, now: () => now, sendState: (s) => sent.push(s), sendEvent() {} }
    const world = makeWorld(true, false)
    const loop = loopOf(world, channel)
    const pass = (seconds, each) => {
      for (let i = 0; i < Math.round(seconds * 20); i += 1) {
        now += 50
        each?.(now)
        loop.afterStep(0.05)
      }
    }
    const ack = () => Object.assign(channel, { acks: channel.acks + 1, ackedT: now })
    return { world, loop, sent, pass, ack }
  }

  it('목숨이 남은 상대의 쓰러짐은 아웃이 아니다', () => {
    const world = makeWorld(true, false)
    const b = world.players[1]
    applyRemote(world, 'b', { x: 200, y: 300, hp: 0, alive: false, l: 2, t: 1000 })
    expect(b.alive).toBe(false)
    expect(isOut(b)).toBe(false)
    stepWorld(world, {}, 1 / 60)
    expect(world.over).toBe(false)
  })

  it('다시 시작한 상대는 그 자리로 바로 옮긴다', () => {
    const world = makeWorld(true, false)
    const b = world.players[1]
    applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, l: 3, t: 900 })
    applyRemote(world, 'b', { x: 200, y: 300, hp: 0, alive: false, l: 2, t: 1000 })
    const effects = world.effects.length
    applyRemote(world, 'b', { x: 320, y: 500, hp: 80, alive: true, l: 2, t: 4000 })
    expect(b.alive).toBe(true)
    expect([b.x, b.y, b.tx, b.ty]).toEqual([320, 500, 320, 500])
    expect([b.vx, b.vy]).toEqual([0, 0])
    expect(b.hp).toBe(80)
    expect(b.flashT).toBe(0)
    expect(world.effects.length).toBe(effects) // 맞은 숫자·아웃이 뜨지 않는다
  })

  it('받은 목숨은 늘지 않는다', () => {
    const world = makeWorld(true, false)
    applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, l: 1, t: 1000 })
    applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, l: 3, t: 1100 })
    expect(world.players[1].lives).toBe(1)
  })

  it('기다리는 중에 조용한 상대도 아웃된다', () => {
    const { world, pass, ack } = table()
    const b = world.players[1]
    pass(1, (now) => {
      ack()
      applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, l: 3, t: now }, { now })
    })
    applyRemote(world, 'b', { x: 200, y: 300, hp: 0, alive: false, l: 2, t: 1000 })
    pass(SILENT_LIMIT + 1, ack)
    expect(isOut(b)).toBe(true)
    expect(b.downAt).toBeCloseTo(1)
  })

  it('기다리는 동안 소식을 보내던 상대는 잠깐(3.7초) 멈칫해도 아웃되지 않는다', () => {
    const { world, pass, ack } = table()
    const b = world.players[1]
    pass(1, (now) => {
      ack()
      applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, l: 3, t: now }, { now })
    })
    pass(2.5, (now) => {
      ack()
      applyRemote(world, 'b', { x: 200, y: 300, hp: 0, alive: false, l: 2, t: now }, { now })
    })
    pass(3.7, ack)
    expect(isOut(b)).toBe(false)
  })

  it('기다리다 끊긴 상대의 아웃 시각은 마지막 소식의 때다(그 사람 화면과 같게)', () => {
    const { world, pass, ack } = table()
    const b = world.players[1]
    pass(1, (now) => {
      ack()
      applyRemote(world, 'b', { x: 200, y: 300, hp: 50, alive: true, l: 3, t: now }, { now })
    })
    pass(2.5, (now) => {
      ack()
      applyRemote(world, 'b', { x: 200, y: 300, hp: 0, alive: false, l: 2, t: now }, { now })
    })
    pass(SILENT_LIMIT + 1, ack)
    expect(isOut(b)).toBe(true)
    expect(b.downAt).toBeCloseTo(3.5, 1)
  })

  it('다시 시작하면 다음 걸음에 바로 알린다(그 뒤에 쏜 탄이 버려지지 않게)', () => {
    const { world, loop, pass, ack, sent } = table()
    const me = world.players[0]
    pass(0.5, ack)
    applyDamage(world, me, 999)
    pass(0.05, ack)
    Object.assign(me, { alive: true, hp: me.maxHp })
    loop.afterStep(1 / 60)
    expect(sent.at(-1)).toMatchObject({ alive: true })
  })

  it('끊기면 목숨이 남아도 아웃', () => {
    const { world, pass, ack } = table()
    const me = world.players[0]
    pass(2, ack)
    pass(LOST_LIMIT + 0.5)
    expect(me.lives).toBe(0)
    expect(isOut(me)).toBe(true)
  })

  it('목숨이 남은 쓰러짐도 바로 알리고, 그 뒤 다시 시작한 상태를 보낸다', () => {
    const { world, pass, ack, sent } = table()
    const me = world.players[0]
    pass(0.5, ack)
    applyDamage(world, me, 999)
    pass(0.05, ack)
    expect(sent.at(-1)).toMatchObject({ alive: false, l: 2 })
    const downT = sent.at(-1).t
    Object.assign(me, { alive: true, hp: me.maxHp })
    pass(0.1, ack)
    expect(sent.at(-1)).toMatchObject({ alive: true, l: 2 })
    expect(sent.at(-1).t).toBeGreaterThan(downT) // 쓰러진 때로 고정되지 않는다
  })
})

describe('시계와 순위', () => {
  it('한 프레임에 여러 걸음을 따라잡아도 시계가 서버보다 앞서가지 않는다', () => {
    const world = makeWorld(true, false)
    const loop = loopOf(world, { now: () => 1000, sendState() {}, sendEvent() {} })
    loop.setPhase(Playing)
    Playing.frame(loop, 1)
    expect(world.time).toBeLessThanOrEqual(1 + 1 / 60 + 1e-9)
  })

  it('카운트다운 때 누른 대시·기술은 시작할 때 지운다', () => {
    const world = makeWorld(true, false)
    let cleared = 0
    const loop = loopOf(world, { now: () => 0, sendState() {}, sendEvent() {} })
    loop.input = { commands: () => [], clearTaps: () => (cleared += 1) }
    loop.setPhase(Playing)
    expect(cleared).toBe(1)
  })

  it('완전히 같은 결과면 무승부로 본다', () => {
    const world = makeWorld(true, false)
    expect(drawIds(rankPlayers(world))).toEqual(['a', 'b'])
    world.players[1].hp -= 1
    expect(drawIds(rankPlayers(world))).toEqual([])
    for (const player of world.players) Object.assign(player, { hp: 0, alive: false, downAt: 5 })
    expect(drawIds(rankPlayers(world))).toHaveLength(2)
  })
})

describe('로그아웃 전에 할 일', () => {
  it('등록한 일을 기다리고, 끝나지 않으면 정한 시간까지만 기다린다', async () => {
    const done = []
    const off = onBeforeLogout(async () => done.push('left'))
    const offHang = onBeforeLogout(() => new Promise(() => {}))
    await runBeforeLogout(20)
    expect(done).toEqual(['left'])
    off()
    offHang()
    await runBeforeLogout(20)
    expect(done).toEqual(['left'])
  })
})

describe('쓰러진 뒤의 조작', () => {
  it('쓰러지면 명령을 모으지 않고 조작을 놓는다(1인칭에서 잡힌 마우스가 풀리게). 연습도 같다', () => {
    const world = makeWorld(true, false)
    let idle = 0
    const input = { commands: () => [], idle: () => (idle += 1) }
    const online = loopOf(world, { now: () => 0, sendState() {}, sendEvent() {} })
    online.input = input
    expect(online.collectCommands()).toEqual({ a: [] })
    expect(idle).toBe(0)
    world.players[0].alive = false
    expect(online.collectCommands()).toEqual({})
    expect(idle).toBe(1)
    const practice = new PracticeLoop({ world, renderer: { draw() {} }, input, meId: 'a' })
    expect(practice.collectCommands()).toEqual({})
    expect(idle).toBe(2)
  })
})

describe('숫자가 아닌 입력(점검 4회차)', () => {
  it('이동 명령에 NaN·Infinity가 와도 위치가 숫자로 남는다(크기가 0인 조이스틱 등)', async () => {
    const { createWorld, stepWorld } = await import('./world')
    const { buildLoadout } = await import('./loadout')
    const { DEFAULT_LOOK } = await import('../profile/look')
    const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
    const loadout = buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: '나' })
    const world = createWorld({ events: false, players: [{ id: 'a', loadout, local: true }, { id: 'b', loadout, local: true }] })
    const a = world.players[0]
    for (const [x, y] of [[NaN, 0], [Infinity, 1], [0, -Infinity], [NaN, NaN]]) {
      stepWorld(world, { a: [{ type: 'move', x, y }] }, 1 / 60)
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
    }
  })
})

describe('다시 이어진 뒤 남은 판 보기(점검 2회차)', () => {
  it('끊겼다 다시 이어져 아웃된 뒤에는 서버가 상태를 받지 않아도(내 칸이 지워짐) 판을 끝내지 않고 남은 판을 본다', async () => {
    const { createWorld } = await import('./world')
    const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
    const { DEFAULT_LOOK } = await import('../profile/look')
    const loadout = buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: '나' })
    const world = createWorld({ events: false, mode: 'online', players: [{ id: 'a', loadout, local: true }, { id: 'b', loadout, local: false }] })
    let now = 1000
    const sent = []
    const channel = { now: () => now, sendState: (s) => sent.push(s), sendEvent() {}, acks: 0, ackedT: null }
    const loop = new OnlineLoop({ world, renderer: { draw() {} }, input: { commands: () => [] }, meId: 'a', channel, startAt: 0 })
    loop.dropOut() // 다시 이어졌을 때 하는 일
    world.gone = true // 서버가 내 칸을 지웠다
    const before = sent.length
    for (let i = 0; i < 60 * 6; i += 1) {
      now += 1000 / 60
      loop.afterStep(1 / 60)
    }
    expect(world.over).toBe(false)
    expect(sent.length - before).toBeLessThanOrEqual(1) // 받지 않는 서버에 계속 보내지 않는다
  })
})

describe('보내는 상태가 서버 규칙 범위 안(점검 10회차)', () => {
  it('점프 꼭대기에서 띄워져 높이가 200을 넘어도 보내는 z는 200까지(규칙이 상태 쓰기를 통째로 거절하지 않게)', () => {
    const world = makeWorld(true, false)
    const sent = []
    const loop = loopOf(world, { now: () => 1000, sendState: (s) => sent.push(s), sendEvent() {} })
    world.players[0].z = 217.5
    loop.sendMe(world.players[0])
    expect(sent[0].z).toBe(200)
  })
})
