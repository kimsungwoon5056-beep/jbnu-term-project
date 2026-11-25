import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onBeforeLogout, runBeforeLogout } from '../lib/beforeLogout'
import { DEFAULT_LOOK } from '../profile/look'
import { FirebaseRoomChannel, linkWorld, MemoryRoom, STALE } from './channel'
import { buildLoadout } from './loadout'
import { LOST_LIMIT, OnlineLoop, PracticeLoop, SILENT_LIMIT } from './loop'
import { Playing } from './phases'
import { applyRemote, createWorld, drawIds, OBSTACLES, rankPlayers, spawnEvent, stepWorld } from './world'

// 끊김·늦음·동시 같은 어긋나기 쉬운 상황

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const makeWorld = (...locals) => createWorld({ events: false, mode: 'online', players: ['a', 'b', 'c'].slice(0, locals.length).map((id, i) => ({ id, loadout: loadout(id), local: locals[i] })) })
const put = (player, x, y) => Object.assign(player, { x, y, tx: x, ty: y })
const loopOf = (world, channel, startAt = 0) => new OnlineLoop({ world, renderer: { draw() {} }, input: { commands: () => [] }, meId: 'a', channel, startAt })

describe('늦게 받은 탄', () => {
  const beam = { k: 'skill', s: 'webtoon', o: 'b', x: 40, y: 300, a: 0 }

  it('바로 앞에 있는 사람을 건너뛰지 않는다', () => {
    const world = makeWorld(true, false)
    put(world.players[0], 90, 300)
    put(world.players[1], 40, 300)
    spawnEvent(world, { k: 'shot', o: 'b', x: 40, y: 300, a: 0 }, { ahead: 0.2 })
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
    expect(world.projectiles.size).toBe(0)
    listeners.event(shot)
    expect(world.projectiles.size).toBe(1)
    world.players[1].alive = false
    listeners.event(shot)
    expect(world.projectiles.size).toBe(1)
    const item = world.items[0]
    listeners.event({ k: 'pick', o: 'b', x: 0, y: 0, a: 0, i: item.id, t: 0 })
    expect(item.taken).toBe(true)
    world.over = true
    listeners.event(shot)
    expect(world.projectiles.size).toBe(1)
  })
})

describe('여러 명', () => {
  it('꿰뚫지 않는 탄은 앞에 선 상대에게 막혀 뒤에 선 나까지 맞지 않는다', () => {
    const world = makeWorld(true, false, false) // 나 a, 쏜 사람 b, 앞에 선 사람 c
    put(world.players[0], 200, 230)
    put(world.players[1], 40, 230)
    put(world.players[2], 120, 230)
    spawnEvent(world, { k: 'shot', o: 'b', x: 40, y: 230, a: 0 })
    for (let i = 0; i < 60; i += 1) stepWorld(world, {}, 1 / 60)
    expect(world.players[0].hp).toBe(world.players[0].maxHp)
  })

  it('상대가 밟은 덫은 내 화면에서도 사라진다', () => {
    const world = makeWorld(true, false, false)
    put(world.players[0], 300, 520)
    put(world.players[1], 40, 230)
    put(world.players[2], 160, 230)
    spawnEvent(world, { k: 'skill', s: 'video', o: 'b', x: 40, y: 230, a: 0 })
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
    pass(SILENT_LIMIT + 1)
    expect(b.alive).toBe(true)
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
    jump(SILENT_LIMIT + 1)
    pass(0.05, ack)
    expect(world.players[0].alive).toBe(false)
    expect(world.players[0].downAt).toBeCloseTo(7.05, 1)
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
