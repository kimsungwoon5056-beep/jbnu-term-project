import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { linkWorld, MemoryRoom } from './channel'
import { buildLoadout } from './loadout'
import { OnlineLoop, SEND_EVERY } from './loop'
import { moveOf } from './melee'
import { applyRemote, createWorld, LAG, spawnEvent, stepWorld } from './world'

// 온라인 지연 보정: 상대 위치 예측, 늦게 받은 탄 앞당기기, 초당 20번 전송

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) =>
  buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
// 내 화면: a는 나(local), b는 상대(네트워크로 받음)
const myScreen = () =>
  createWorld({
    events: false,
    mode: 'online',
    players: [
      { id: 'a', loadout: loadout('나'), local: true },
      { id: 'b', loadout: loadout('상대'), local: false },
    ],
  })

describe('온라인 지연 보정', () => {
  it('상대가 오른쪽으로 움직이던 중이면, 상태가 오는 동안 움직였을 만큼 앞에 그린다', () => {
    const world = myScreen()
    const b = world.players[1]
    applyRemote(world, 'b', { x: 100, y: 200, hp: 80, alive: true, t: 1000 }, { now: 1000 })
    applyRemote(world, 'b', { x: 110, y: 200, hp: 80, alive: true, t: 1050 }, { now: 1100 }) // 0.05초에 10px → 초속 200
    applyRemote(world, 'b', { x: 120, y: 200, hp: 80, alive: true, t: 1100 }, { now: 1200 }) // 같은 속도, 0.1초 늦게 받음
    // 속도는 이전 값과 반씩 섞는다: (0 + 200) / 2 → (100 + 200) / 2 = 150
    expect(b.vx).toBeCloseTo(150)
    expect(b.tx).toBeCloseTo(120 + 150 * 0.1)
  })

  it('계속 같은 속도로 오면 섞인 속도도 실제 속도에 가까워진다', () => {
    const world = myScreen()
    const b = world.players[1]
    for (let i = 0; i <= 8; i += 1) applyRemote(world, 'b', { x: 50 + i * 10, y: 300, alive: true, t: i * 50 }, { now: i * 50 })
    expect(b.vx).toBeGreaterThan(195)
  })

  it('다음 상태가 안 오면 최대 0.25초까지만 예측하고 멈춘다(엉뚱하게 멀리 가지 않게)', () => {
    const world = myScreen()
    const b = world.players[1]
    applyRemote(world, 'b', { x: 100, y: 300, alive: true, t: 0 }, { now: 0 })
    applyRemote(world, 'b', { x: 110, y: 300, alive: true, t: 50 }, { now: 50 })
    for (let i = 0; i < 60; i += 1) stepWorld(world, {}, 1 / 60) // 1초
    expect(b.tx).toBeCloseTo(110 + b.vx * LAG.predict, 0)
    expect(b.x).toBeCloseTo(b.tx, 0)
  })

  it('같은 상태를 여러 번 받아도 속도가 0이 되지 않는다(방의 다른 변화로 다시 오는 경우)', () => {
    const world = myScreen()
    const b = world.players[1]
    applyRemote(world, 'b', { x: 100, y: 300, alive: true, t: 0 }, { now: 0 })
    applyRemote(world, 'b', { x: 110, y: 300, alive: true, t: 50 }, { now: 60 })
    const v = b.vx
    applyRemote(world, 'b', { x: 110, y: 300, alive: true, t: 50 }, { now: 90 })
    expect(v).toBeGreaterThan(0)
    expect(b.vx).toBe(v)
  })

  it('늦게 받은 근접 공격은 늦은 만큼 준비를 건너뛰고, 준비보다 늦으면 타격부터 시작한다', () => {
    const shot = { k: 'shot', s: 'shopping', c: 0, o: 'b', x: 100, y: 80, a: 0 }
    const swingAt = (ahead) => {
      const world = myScreen()
      spawnEvent(world, shot, { ahead })
      return world.swings[0].t
    }
    expect(swingAt(0)).toBe(0)
    expect(swingAt(0.1)).toBeCloseTo(0.1)
    expect(swingAt(5)).toBeCloseTo(moveOf('shopping', 0).windup)
  })

  it('연타처럼 늦게 나가는 탄은 기다릴 시간만 줄어든다', () => {
    const world = myScreen()
    spawnEvent(world, { k: 'skill', e: 1, s: 'game', o: 'b', x: 100, y: 80, a: 0 }, { ahead: 0.15 })
    // 0.07초 간격 8발: 0·0.07·0.14초짜리는 이미 나갔고, 나머지는 0.15초 덜 기다린다.
    expect(world.projectiles.active).toHaveLength(3)
    expect(world.pending.map((item) => Number(item.delay.toFixed(2)))).toEqual([0.06, 0.13, 0.2, 0.27, 0.34])
  })

  it('통신 창구를 거치면 보낸 시각(t)과 지금 시각의 차이만큼 자동으로 보정한다', () => {
    // 0.1초 늦게 도착하는 창구: 지금 시각은 1100ms, 받은 것은 1000ms에 보낸 것
    const listeners = {}
    const lagging = {
      now: () => 1100,
      onEvent: (fn) => ((listeners.event = fn), () => {}),
      onPeers: (fn) => ((listeners.peers = fn), () => {}),
    }
    const world = myScreen()
    linkWorld(world, lagging, 'a')
    listeners.event({ k: 'shot', s: 'shopping', c: 0, o: 'b', x: 100, y: 80, a: 0, t: 1000 })
    expect(world.swings[0].t).toBeCloseTo(0.1)

    listeners.peers({ b: { x: 100, y: 300, alive: true, t: 1000 } })
    listeners.peers({ b: { x: 110, y: 300, alive: true, t: 1050 } })
    expect(world.players[1].tx).toBeCloseTo(110 + world.players[1].vx * 0.05)
    expect(world.players[1].vx).toBeGreaterThan(0)
  })

  it('메모리 방도 보낸 시각을 붙여 Firebase(serverTimestamp)와 같은 모양으로 보낸다', () => {
    const room = new MemoryRoom({ now: () => 4321 })
    const a = room.join('a')
    const b = room.join('b')
    const got = []
    b.onEvent((ev) => got.push(ev.t))
    a.sendEvent({ k: 'shot', o: 'a', x: 0, y: 0, a: 0 })
    a.sendState({ x: 1, y: 2 })
    expect(got).toEqual([4321])
    expect(room.states.a.t).toBe(4321)
  })

  it('온라인 루프는 내 상태를 초당 20번 보낸다', () => {
    const room = new MemoryRoom()
    const channel = room.join('a')
    let sent = 0
    const realSend = channel.sendState.bind(channel)
    channel.sendState = (s) => {
      sent += 1
      realSend(s)
    }
    const world = myScreen()
    const loop = new OnlineLoop({ world, renderer: { draw() {} }, input: { commands: () => [] }, meId: 'a', channel, startAt: 0 })
    for (let i = 0; i < 60; i += 1) loop.afterStep(1 / 60)
    expect(SEND_EVERY).toBe(0.05)
    expect(sent).toBeGreaterThanOrEqual(19)
    expect(sent).toBeLessThanOrEqual(21)
  })
})
