import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { LookController } from './firstPerson/look'
import { buildLoadout } from './loadout'
import { MODES } from './modes'
import { MODE_KEYS, RULE_MODES, VIEW_MODES } from './modes/keys'
import { activeMode, DIVE, divePhase, STORM } from './schedule'
import { createWorld, stepWorld } from './world'

// 빨려 들어가기(갑자기 1인칭): 언제 바뀌는지, 조작이 어떻게 바뀌는지

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const makeWorld = (seed = 1, events = true) => createWorld({ seed, events, players: ['a', 'b'].map((id) => ({ id, loadout: loadout(id), local: true })) })

describe('앱 속으로: 언제 무엇이 나오나', () => {
  it('같은 씨앗이면 모든 화면에서 같은 때이고, 씨앗이 다르면 다르다', () => {
    expect(makeWorld(7).schedule.dives).toEqual(makeWorld(7).schedule.dives)
    expect(makeWorld(7).schedule.dives).not.toEqual(makeWorld(8).schedule.dives)
  })

  it('어느 씨앗이든 알림 폭풍(경고 포함)과 겹치지 않고 판 안에서 끝난다', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { dives } = makeWorld(seed).schedule
      expect(dives).toHaveLength(4)
      expect(new Set(dives.map((dive) => dive.mode)).size).toBe(4) // 네 번 모두 다른 모드
      dives.forEach((dive, k) => expect(k % 2 === 0 ? VIEW_MODES : RULE_MODES).toContain(dive.mode))
      for (let k = 1; k < dives.length; k += 1) expect(dives[k].t - DIVE.warn).toBeGreaterThan(dives[k - 1].end + DIVE.out)
      for (const { t, end } of dives) {
        expect(end).toBeLessThan(90)
        for (const start of STORM.starts) {
          const stormEnd = start + STORM.warn + (STORM.waves - 1) * STORM.waveGap + 2.2
          expect(end + DIVE.out <= start || t - DIVE.warn >= stormEnd).toBe(true)
        }
      }
    }
  })

  it('경고 → 들어감 → 1인칭 → 나옴 순서이고, 1인칭은 들어가는 장면 가운데부터 끝날 때까지다', () => {
    const { schedule } = makeWorld()
    const { t, end } = schedule.dives[0]
    expect(divePhase(schedule, t - DIVE.warn - 0.1).phase).toBe('none')
    expect(divePhase(schedule, t - 0.1).phase).toBe('warn')
    expect(divePhase(schedule, t + 0.1).phase).toBe('in')
    expect(divePhase(schedule, t + DIVE.zoom + 0.1).phase).toBe('on')
    expect(divePhase(schedule, end + 0.1).phase).toBe('out')
    expect(divePhase(schedule, end + DIVE.out + 0.1).phase).toBe('none')
    const at = (time) => activeMode({ events: true, schedule, time })
    const { mode } = schedule.dives[0]
    expect([at(t + 0.1), at(t + DIVE.zoom * 0.6), at(end - 0.1), at(end + 0.1)]).toEqual([null, mode, mode, null])
    expect(activeMode({ events: false, schedule, time: t + 3 })).toBeNull()
  })

  it('열두 모드가 모두 나오고, 연습에서 고른 모드만 나오게 할 수 있다', () => {
    const seen = new Set()
    for (let seed = 1; seed <= 60; seed += 1) for (const dive of makeWorld(seed).schedule.dives) seen.add(dive.mode)
    expect([...seen].sort()).toEqual([...MODE_KEYS].sort())
    expect(Object.keys(MODES).sort()).toEqual([...MODE_KEYS].sort())
    const picked = createWorld({ seed: 3, modes: ['boss'], players: [{ id: 'a', loadout: loadout('a'), local: true }] })
    expect(picked.schedule.dives.map((dive) => dive.mode)).toEqual(['boss', 'boss', 'boss', 'boss'])
  })

  it('단계가 바뀔 때 한 번씩 알린다', () => {
    const world = makeWorld()
    const got = []
    world.signals.subscribe((signal) => ['glitch', 'dive', 'surface'].includes(signal.kind) && got.push(signal.kind))
    world.time = world.schedule.dives[0].t - DIVE.warn - 0.1
    for (let i = 0; i < 60 * 12.2; i += 1) {
      for (const player of world.players) player.hp = player.maxHp
      stepWorld(world, {}, 1 / 60)
    }
    expect(got).toEqual(['glitch', 'dive', 'surface'])
  })
})

describe('1인칭 조작', () => {
  const at = (x, y) => ({ id: 'a', x, y, aim: 0, alive: true })
  const enemy = (x, y) => ({ players: [at(100, 100), { id: 'b', x, y, alive: true }] })

  it('시작하면 가장 가까운 상대 쪽을 본다', () => {
    const look = new LookController()
    const world = enemy(100, 300)
    look.enter(world, world.players[0])
    expect(look.yaw).toBeCloseTo(Math.PI / 2)
  })

  it('앞으로 가면 보는 방향으로, 옆으로 가면 오른쪽으로 움직인다', () => {
    const look = new LookController()
    const world = enemy(300, 100)
    look.enter(world, world.players[0]) // 오른쪽(+x)을 본다
    const [forward, aim] = look.commands(world, world.players[0], { forward: 1 })
    expect([forward.x, forward.y]).toEqual([expect.closeTo(1), expect.closeTo(0)])
    expect(aim).toEqual({ type: 'aim', a: look.yaw })
    const [strafe] = look.commands(world, world.players[0], { strafe: 1 })
    expect([strafe.x, strafe.y]).toEqual([expect.closeTo(0), expect.closeTo(1)]) // 화면 좌표에서 오른쪽을 보면 오른손은 아래(+y)
  })

  it('마우스를 움직인 만큼 한 번만 돌고, 터치로 쏘면 상대 쪽으로 천천히 돌아간다', () => {
    const look = new LookController()
    const world = enemy(300, 100)
    look.enter(world, world.players[0])
    look.mouse(100)
    look.commands(world, world.players[0], {})
    const turned = look.yaw
    expect(turned).toBeGreaterThan(0.2)
    look.commands(world, world.players[0], {})
    expect(look.yaw).toBeCloseTo(turned)
    for (let i = 0; i < 60; i += 1) look.commands(world, world.players[0], { assist: true })
    expect(look.yaw).toBeCloseTo(0)
  })

  it('멈칫하는 동안 움직인 마우스는 버린다(풀렸을 때 휙 돌지 않게)', () => {
    const look = new LookController()
    const world = enemy(300, 100)
    const me = { ...world.players[0], stunT: 0.5, aim: 0.2 }
    look.enter(world, me)
    for (let i = 0; i < 30; i += 1) {
      look.mouse(50)
      look.commands(world, me, { turn: 1 })
    }
    expect(look.yaw).toBeCloseTo(0.2)
    me.stunT = 0
    look.commands(world, me, {})
    expect(look.yaw).toBeCloseTo(0.2)
  })

  it('값은 늘 숫자이고 -π~π 안에 있다', () => {
    const look = new LookController()
    const world = enemy(100, 100) // 상대와 겹쳐 있어도
    look.enter(world, world.players[0])
    look.mouse(Number.NaN)
    for (let i = 0; i < 500; i += 1) {
      const commands = look.commands(world, world.players[0], { forward: 1, turn: 1 })
      for (const value of [commands[0].x, commands[0].y, commands[1].a]) expect(Number.isFinite(value)).toBe(true)
      expect(Math.abs(look.yaw)).toBeLessThanOrEqual(Math.PI + 1e-9)
    }
  })
})
