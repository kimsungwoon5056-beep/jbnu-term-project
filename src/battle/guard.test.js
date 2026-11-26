import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { kiter, rusher } from './bot'
import { GUARD } from './guard'
import { buildLoadout } from './loadout'
import { applyDamage, createWorld, spawnEvent, stepWorld } from './world'

// 막기·패링: 누구나 쓰는 방어(PC 오른쪽 클릭·F, 휴대폰 막기 버튼)
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const armed = (name, skill = 'detox') => ({ ...buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name }), skill })
const DT = 1 / 60
const place = (player, x, y) => Object.assign(player, { x, y, tx: x, ty: y })
// a는 (100, 220)에서 오른쪽을, b는 (140, 220)에서 a 쪽(왼쪽)을 본다.
function duel({ bLocal = true } = {}) {
  const world = createWorld({ events: false, damageScale: 1, players: [{ id: 'a', loadout: armed('a'), local: true }, { id: 'b', loadout: armed('b'), local: bLocal }] })
  const [a, b] = world.players
  place(a, 100, 220)
  place(b, 140, 220)
  a.aim = 0
  b.aim = Math.PI
  return world
}
const run = (world, seconds, commands = {}) => {
  for (let i = 0; i < Math.round(seconds / DT); i += 1) stepWorld(world, commands, DT)
}
// a의 찌르기(디톡스 3타: 피해 4, 준비 0.2초). m배로 세게
const thrust = (world, m = 4) => spawnEvent(world, { k: 'shot', s: 'detox', c: 2, o: 'a', x: 100, y: 220, a: 0, m })
const guard = (world) => stepWorld(world, { b: [{ type: 'guard' }] }, DT)
const hurt = (player) => player.maxHp - player.hp

describe('막기·패링', () => {
  it('누르면 막기 자세가 되고, 다시 쓰기까지 기다린다. 이벤트는 Firebase 규칙의 칸(k·o·x·y·a)을 갖는다', () => {
    const world = duel()
    const b = world.players[1]
    guard(world)
    expect(b.defendT).toBeGreaterThan(GUARD.time - 0.05)
    expect(b.cd.guard).toBeGreaterThan(GUARD.cooldown - 0.05)
    const ev = world.outbox.find((item) => item.g === 1)
    expect(ev).toMatchObject({ k: 'skill', o: 'b' })
    for (const key of ['x', 'y', 'a']) expect(Number.isFinite(ev[key])).toBe(true)
    run(world, GUARD.time + 0.05)
    expect(b.defendT).toBe(0)
    guard(world)
    expect(b.defendT).toBe(0) // 아직 다시 쓸 수 없다
    run(world, GUARD.cooldown)
    guard(world)
    expect(b.defendT).toBeGreaterThan(0)
  })

  it('막기 자세가 시작하고 처음 잠깐(패링) 안에 앞에서 맞으면 피해가 없고, 때린 사람은 멈칫하며 휘두르던 것이 튕겨 나간다', () => {
    const world = duel()
    const [a, b] = world.players
    const kinds = []
    world.signals.subscribe((signal) => kinds.push(signal.kind))
    thrust(world)
    run(world, 0.1)
    guard(world)
    run(world, 0.2)
    expect(hurt(b)).toBe(0)
    expect(kinds).toContain('parry')
    expect(world.outbox.some((ev) => ev.g === 2 && ev.p === 'a')).toBe(true)
    expect(a.stunT).toBeGreaterThan(GUARD.stun - 0.3)
    expect(world.swings.filter((swing) => swing.owner === 'a')).toHaveLength(0)
    expect(b.cd.guard).toBe(0) // 패링하면 바로 다시 막을 수 있다
  })

  it('패링 시간이 지난 막기는 피해를 30%로 줄이고 밀리지 않는다', () => {
    const world = duel()
    const b = world.players[1]
    const kinds = []
    world.signals.subscribe((signal) => kinds.push(signal.kind))
    guard(world)
    run(world, GUARD.parry + 0.05)
    thrust(world) // 피해 16
    run(world, 0.3)
    expect(hurt(b)).toBe(Math.round(16 * GUARD.cut))
    expect(b.x).toBeCloseTo(140, 5)
    expect(kinds).toContain('block')
    expect(kinds).not.toContain('parry')
  })

  it('막으면 멈칫·출혈이 걸리지 않는다', () => {
    const world = duel()
    const b = world.players[1]
    guard(world)
    run(world, GUARD.parry + 0.05)
    // 카드 단검 3타(출혈)와 택배 망치(멈칫) 대신, 같은 효과를 가진 찌르기를 직접 놓는다.
    spawnEvent(world, { k: 'shot', s: 'finance', c: 2, o: 'a', x: 100, y: 220, a: 0, m: 2 })
    run(world, 0.35)
    expect(hurt(b)).toBeGreaterThan(0)
    expect(b.bleedT).toBe(0)
    expect(b.stunT).toBe(0)
  })

  it('뒤나 옆에서 온 공격과 주인 없는 피해는 막지 못한다', () => {
    const world = duel()
    const b = world.players[1]
    b.aim = 0 // a에게 등을 보인다
    guard(world)
    run(world, GUARD.parry + 0.05)
    thrust(world)
    run(world, 0.3)
    expect(hurt(b)).toBe(16)
    const other = duel()
    const c = other.players[1]
    guard(other)
    applyDamage(other, c, 6) // 알림 폭풍·배터리처럼 주인이 없다
    expect(hurt(c)).toBe(6)
  })

  it('멀리서 온 공격을 패링하면 피해만 없고 멈추게 하지 않는다', () => {
    const world = duel()
    const [a, b] = world.players
    place(a, -200, 220)
    guard(world)
    applyDamage(world, b, 10, { x: 1, y: 0 }, 'a')
    expect(hurt(b)).toBe(0)
    expect(world.outbox.some((ev) => ev.g === 2)).toBe(false)
    expect(a.stunT).toBe(0)
  })

  it('자기 공격 준비·타격 중에 누르면 미리 누른 다음 타를 버리고, 그 타가 끝나자마자 막는다', () => {
    const world = duel()
    const b = world.players[1]
    stepWorld(world, { b: [{ type: 'fire' }] }, DT)
    stepWorld(world, { b: [{ type: 'fire' }] }, DT) // 다음 타를 미리 누름
    guard(world)
    expect(b.defendT).toBe(0)
    run(world, 0.3)
    expect(b.defendT).toBeGreaterThan(0)
    expect(world.swings.filter((swing) => swing.owner === 'b')).toHaveLength(1) // 다음 타는 나가지 않았다
    // 기억은 잠깐만: 막기를 다시 쓸 수 있을 때까지 기다린 사이에 눌렀던 것은 잊는다.
    const late = duel()
    const c = late.players[1]
    c.cd.shot = 1
    guard(late)
    run(late, 1.2)
    expect(c.defendT).toBe(0)
  })

  it('막는 동안에는 공격하지 않고 느리게 걷는다', () => {
    const world = duel()
    const b = world.players[1]
    guard(world)
    const swings = world.swings.length
    stepWorld(world, { b: [{ type: 'fire' }] }, DT)
    expect(world.swings.length).toBe(swings)
    const x = b.x
    run(world, 0.2, { b: [{ type: 'move', x: 0, y: 1 }] })
    const guarded = Math.abs(b.y - 220)
    const free = duel()
    run(free, 0.2, { b: [{ type: 'move', x: 0, y: 1 }] })
    expect(guarded).toBeLessThan(Math.abs(free.players[1].y - 220) * 0.6)
    expect(b.x).toBeCloseTo(x, 5)
  })

  it('다른 화면의 막기도 받은 이벤트로 같은 시간만큼 보이고, 기술 신호는 내지 않는다', () => {
    const world = duel({ bLocal: false })
    const b = world.players[1]
    const kinds = []
    world.signals.subscribe((signal) => kinds.push(signal.kind))
    spawnEvent(world, { k: 'skill', s: 'detox', g: 1, o: 'b', x: 140, y: 220, a: Math.PI })
    expect(b.defendT).toBeCloseTo(GUARD.time, 5)
    expect(kinds).toContain('guard')
    expect(kinds).not.toContain('skill')
    run(world, GUARD.time + 0.05)
    expect(b.defendT).toBe(0)
  })

  it('받은 패링 이벤트: 내 화면의 내 캐릭터가 멈칫하고 휘두르던 것이 사라진다', () => {
    const world = duel({ bLocal: false })
    const a = world.players[0]
    thrust(world)
    spawnEvent(world, { k: 'skill', s: 'detox', g: 2, p: 'a', o: 'b', x: 140, y: 220, a: Math.PI })
    expect(a.stunT).toBeGreaterThan(GUARD.stun - 0.05)
    expect(world.swings).toHaveLength(0)
  })

  it('쓰러지면 막기 자세가 풀린다', () => {
    const world = duel()
    const b = world.players[1]
    guard(world)
    applyDamage(world, b, 999)
    expect(b.alive).toBe(false)
    expect(b.defendT).toBe(0)
  })

  it('봇도 상대가 준비 동작을 하면 가끔 막는다', () => {
    for (const strategy of [kiter, rusher]) {
      const world = duel()
      const [a, b] = world.players
      let guards = 0
      world.signals.subscribe((signal) => signal.kind === 'guard' && signal.who === 'b' && (guards += 1))
      for (let i = 0; i < 60 * 12; i += 1) {
        place(a, b.x - 40, b.y)
        stepWorld(world, { a: [{ type: 'aim', a: 0 }, { type: 'fire' }], b: strategy.commands(world, b) }, DT)
        Object.assign(b, { hp: b.maxHp, alive: true })
        Object.assign(a, { hp: a.maxHp, alive: true, stunT: 0 })
      }
      expect(guards, strategy.name).toBeGreaterThanOrEqual(2)
    }
  })
})
