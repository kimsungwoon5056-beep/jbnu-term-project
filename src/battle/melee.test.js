import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { COMBO_WINDOW, inSwing, moveOf, Swing, swingPhase, SWING_SLOW, weaponOf, WEAPONS } from './melee'
import { SKILLS } from './skills'
import { createWorld, MATCH_SECONDS, spawnEvent, stepWorld } from './world'

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
export const plain = (name = '테스트') => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })

// 기하만: 주인(0,0)이 오른쪽(a=0)을 보고 휘두를 때 (px,py)에 선 사람이 맞는지와 피해 배율
describe('휘두르기 범위', () => {
  it('부채꼴: 쓸고 지나간 각만 맞고, 리치 밖은 안 맞는다', () => {
    const arc = { shape: 'arc', reach: 50, width: 1.6, sweep: 1 }
    expect(inSwing(arc, 0, 0, 0, 40, 0, 0.5)).toBe(1)
    const at = (angle, p) => inSwing(arc, 0, 0, 0, Math.cos(angle) * 40, Math.sin(angle) * 40, p)
    expect(at(-0.8, 0.9)).toBe(0) // 시작 쪽 끝은 이미 지나갔다
    expect(at(0.8, 0.2)).toBe(0) // 반대 끝은 아직
    expect(at(0.8, 1)).toBe(1)
    expect(inSwing(arc, 0, 0, 0, 60, 0, 0.5)).toBe(0)
    // 반대로 휘두르면 반대 끝부터
    expect(inSwing({ ...arc, sweep: -1 }, 0, 0, 0, Math.cos(0.8) * 40, Math.sin(0.8) * 40, 0.1)).toBe(1)
  })

  it('찌르기: 길고 좁고, 끝부분은 피해 배율이 붙고, 뒤는 안 맞는다', () => {
    const thrust = { shape: 'thrust', reach: 70, thick: 16, tip: { from: 0.75, mult: 1.6 } }
    expect(inSwing(thrust, 0, 0, 0, 30, 0, 0.5)).toBe(1)
    expect(inSwing(thrust, 0, 0, 0, 65, 0, 0.5)).toBe(1.6)
    expect(inSwing(thrust, 0, 0, 0, 30, 20, 0.5)).toBe(0)
    expect(inSwing(thrust, 0, 0, 0, -10, 0, 0.5)).toBe(0)
    // 조준 방향으로 돈다
    expect(inSwing(thrust, 0, 0, Math.PI / 2, 0, 30, 0.5)).toBe(1)
  })

  it('원·내려찍기·줄', () => {
    const circle = { shape: 'circle', reach: 45 }
    for (let i = 0; i < 8; i += 1) expect(inSwing(circle, 0, 0, 0, Math.cos(i) * 40, Math.sin(i) * 40, 0.5)).toBe(1)
    const slam = { shape: 'slam', reach: 30 }
    expect(inSwing(slam, 0, 0, 0, 21, 0, 0.5)).toBe(1) // 앞 지점(리치×0.7) 둘레
    expect(inSwing(slam, 0, 0, 0, -30, 0, 0.5)).toBe(0)
    const line = { shape: 'line', reach: 140, thick: 20 }
    expect(inSwing(line, 0, 0, 0, 70, 8, 0.5)).toBe(1)
    expect(inSwing(line, 0, 0, 0, 150, 0, 0.5)).toBe(0)
  })

  it('무기 11종은 기술 열쇠와 같고, 모든 타가 단계 시간을 갖고 판정이 숫자다', () => {
    expect(Object.keys(WEAPONS).sort()).toEqual(Object.keys(SKILLS).sort())
    for (const [key, weapon] of Object.entries(WEAPONS)) {
      expect(weapon.combo.length, key).toBeGreaterThanOrEqual(1)
      const total = weapon.combo.reduce((sum, move) => sum + move.damage * (move.hits ?? 1), 0)
      expect(total, key).toBeGreaterThanOrEqual(7)
      expect(total, key).toBeLessThanOrEqual(12)
      for (const move of weapon.combo) {
        for (const time of [move.windup, move.active, move.recovery]) expect(time, key).toBeGreaterThan(0)
        for (const p of [0, 0.5, 1]) expect(Number.isNaN(inSwing(move, 0, 0, 0.3, 30, 10, p)), key).toBe(false)
      }
    }
    expect(weaponOf('없는 열쇠')).toBe(WEAPONS.unrecorded)
    expect(moveOf('messenger', 5)).toBe(WEAPONS.messenger.combo[1])
  })
})

// 세계 안에서: a가 b를 때린다. 피해 배율 1, 사건 없음.
const DT = 1 / 60
const armed = (name, skill) => ({ ...plain(name), skill })
const duel = ({ skill = 'messenger', bLocal = true, aLocal = true } = {}) =>
  createWorld({
    events: false,
    damageScale: 1,
    players: [
      { id: 'a', loadout: armed('a', skill), local: aLocal },
      { id: 'b', loadout: armed('b', 'detox'), local: bLocal },
    ],
  })
const place = (player, x, y) => Object.assign(player, { x, y, tx: x, ty: y, predictT: 0 })
const run = (world, seconds, commands = {}) => {
  for (let i = 0; i < Math.round(seconds / DT); i += 1) stepWorld(world, typeof commands === 'function' ? commands() : commands, DT)
}
const fire = (world) => stepWorld(world, { a: [{ type: 'fire' }] }, DT)
const shots = (world) => world.outbox.filter((ev) => ev.k === 'shot')
const ready = (world, skill) => {
  const [a, b] = world.players
  place(a, 100, 220) // 앱 아이콘(y 120~176, 264~320) 사이의 빈 줄
  place(b, 130, 220)
  a.aim = 0
  return { a, b, move: moveOf(skill, 0) }
}

describe('휘두르기 판정', () => {
  it('공격하면 무기의 첫 타 이벤트가 나가고 휘두르기가 하나 놓인다', () => {
    const world = duel()
    ready(world, 'messenger')
    fire(world)
    expect(world.outbox[0]).toMatchObject({ k: 'shot', s: 'messenger', c: 0, o: 'a' })
    expect(world.swings).toHaveLength(1)
  })

  it('연속기: 창 안에서 누르면 다음 타, 늦으면 첫 타, 마지막 다음은 첫 타', () => {
    const world = duel()
    ready(world, 'messenger')
    const combo = WEAPONS.messenger.combo
    const hitEnd = (c) => combo[c].windup + combo[c].active
    fire(world)
    run(world, hitEnd(0))
    fire(world)
    expect(shots(world).map((ev) => ev.c)).toEqual([0, 1])
    run(world, hitEnd(1) + COMBO_WINDOW + 0.1)
    fire(world)
    expect(shots(world).at(-1).c).toBe(0)
    for (let c = 1; c < combo.length; c += 1) {
      run(world, hitEnd(c - 1))
      fire(world)
    }
    run(world, hitEnd(combo.length - 1))
    fire(world)
    expect(shots(world).slice(-combo.length - 1).map((ev) => ev.c)).toEqual([...combo.map((_, c) => c), 0])
  })

  it('준비 중에 한 번 누른 것은 기억했다가 창이 열리면 나간다', () => {
    const world = duel()
    ready(world, 'messenger')
    fire(world)
    fire(world) // 아직 준비 중
    expect(shots(world)).toHaveLength(1)
    run(world, moveOf('messenger', 0).windup + moveOf('messenger', 0).active + 0.02)
    expect(shots(world).map((ev) => ev.c)).toEqual([0, 1])
  })

  it('준비 동안은 안 맞고 타격 단계에서 한 번만 맞는다', () => {
    const world = duel()
    const { b, move } = ready(world, 'messenger')
    fire(world)
    run(world, move.windup - 2 * DT)
    expect(b.hp).toBe(b.maxHp)
    run(world, move.active + move.recovery)
    expect(b.hp).toBe(b.maxHp - move.damage)
  })

  it('여러 번 판정하는 타는 그 횟수만큼 맞는다(연필 3연속 찌르기)', () => {
    const world = duel({ skill: 'study' })
    const { b } = ready(world, 'study')
    const move = moveOf('study', 1)
    spawnEvent(world, { k: 'shot', o: 'a', x: 100, y: 220, a: 0, s: 'study', c: 1, m: 1 })
    run(world, move.windup + move.active + 0.05)
    expect(b.maxHp - b.hp).toBe(move.damage * 3)
  })

  it('원격 상대(내 화면에서 판정하지 않는 사람)는 체력이 줄지 않는다', () => {
    const world = duel({ bLocal: false })
    const { b, move } = ready(world, 'messenger')
    fire(world)
    run(world, move.windup + move.active + 0.05)
    expect(b.hp).toBe(b.maxHp)
  })

  it('공격 중에는 준비·타격 동안 0.35배, 회복 동안 0.7배로 움직인다', () => {
    const world = duel({ skill: 'shopping' })
    const { a, b, move } = ready(world, 'shopping')
    place(b, 300, 500)
    const walk = (seconds) => {
      const x = a.x
      run(world, seconds, { a: [{ type: 'move', x: 1, y: 0 }] })
      return a.x - x
    }
    const free = walk(0.1)
    stepWorld(world, { a: [{ type: 'fire' }, { type: 'move', x: 1, y: 0 }] }, DT)
    expect(walk(0.1) / free).toBeCloseTo(SWING_SLOW.swing, 1)
    run(world, move.windup + move.active - 0.1)
    expect(walk(0.1) / free).toBeCloseTo(SWING_SLOW.recovery, 1)
    expect(a.loadout.speed).toBe(128)
  })

  it('원격 주인이 휘두르는 동안 움직이면 그 화면에서 보이는 자리로 판정한다', () => {
    const world = duel({ aLocal: false, skill: 'video' })
    const [a, b] = world.players
    const move = moveOf('video', 0)
    place(a, 100, 220)
    place(b, 230, 220)
    spawnEvent(world, { k: 'shot', o: 'a', x: 100, y: 220, a: 0, s: 'video', c: 0, m: 1 })
    place(a, 170, 220) // 받은 위치로 옮겨 감
    run(world, move.windup + move.active + 0.05)
    expect(b.hp).toBe(b.maxHp - move.damage)
    expect([a.x, a.y, b.x, b.y].every(Number.isFinite)).toBe(true)
  })

  it('휘두르는 도중 주인이 쓰러지면 휘두르기가 사라지고 아무도 맞지 않는다', () => {
    const world = duel({ skill: 'shopping' })
    const { a, b, move } = ready(world, 'shopping')
    fire(world)
    a.alive = false
    a.lives = 0
    run(world, move.windup + move.active)
    expect(world.swings).toHaveLength(0)
    expect(b.hp).toBe(b.maxHp)
  })

  it('준비 시간보다 늦게 받은 이벤트는 바로 타격 단계로 시작한다', () => {
    const world = duel({ aLocal: false, skill: 'shopping' })
    const { b, move } = ready(world, 'shopping')
    spawnEvent(world, { k: 'shot', o: 'a', x: 100, y: 220, a: 0, s: 'shopping', c: 0, m: 1 }, { ahead: move.windup + 0.02 })
    expect(swingPhase(world.swings[0]).phase).toBe('active')
    run(world, move.active)
    expect(b.hp).toBe(b.maxHp - move.damage)
  })

  it('사이에 앱 아이콘이 있으면 근접도 맞지 않는다', () => {
    const hitThrough = (y) => {
      const world = duel({ aLocal: false, skill: 'feed' })
      const [a, b] = world.players
      place(a, 224, y)
      place(b, 136, y)
      // 아이콘(폭 56)을 사이에 두려면 리치가 길어야 해서 시험용 찌르기를 직접 놓는다.
      new Swing({ owner: 'a', x: 224, y, a: Math.PI, move: { shape: 'thrust', reach: 100, thick: 16, windup: 0.02, active: 0.1, recovery: 0.1, damage: 3 } }).place(world)
      run(world, 0.3)
      return b.hp < b.maxHp
    }
    expect(hitThrough(292)).toBe(false) // 유튜브 아이콘(152~208, 264~320) 너머
    expect(hitThrough(345)).toBe(true)
  })

  it('내려찍기는 떠 있는 사람을 피하고, 베기는 맞힌다', () => {
    const hits = (skill, c) => {
      const world = duel({ aLocal: false, skill })
      const [a, b] = world.players
      place(a, 100, 220)
      place(b, 135, 220)
      b.z = 40
      b.vz = 0
      const move = moveOf(skill, c)
      spawnEvent(world, { k: 'shot', o: 'a', x: 100, y: 220, a: 0, s: skill, c, m: 1 }, { ahead: move.windup })
      run(world, move.active)
      return b.hp < b.maxHp
    }
    expect(hits('shopping', 0)).toBe(false)
    expect(hits('webtoon', 0)).toBe(true)
  })

  it('맞은 효과: 멈칫·띄움·끌어당김·출혈', () => {
    const strikeWith = (skill, c, bx = 130) => {
      const world = duel({ aLocal: false, skill })
      const [a, b] = world.players
      place(a, 100, 220)
      place(b, bx, 220)
      const move = moveOf(skill, c)
      spawnEvent(world, { k: 'shot', o: 'a', x: 100, y: 220, a: 0, s: skill, c, m: 1 }, { ahead: move.windup })
      run(world, move.active)
      return { world, b }
    }
    expect(strikeWith('messenger', 3).b.stunT).toBeGreaterThan(0.2)
    const launched = strikeWith('unrecorded', 2).b
    expect(launched.z).toBeGreaterThan(0)
    const { b: pulled } = strikeWith('feed', 2, 150)
    expect(pulled.x).toBeLessThan(150)
    const { world, b: bleeding } = strikeWith('finance', 2)
    const after = bleeding.hp
    run(world, 3.2)
    expect(after - bleeding.hp).toBe(3) // 3초 동안 초당 1
    expect(bleeding.bleedT).toBe(0)
  })

  it('판 5분 동안 휘두르기가 쌓이지 않는다', () => {
    const world = duel({ skill: 'game' })
    const [a, b] = world.players
    place(a, 40, 72)
    place(b, 320, 512)
    run(world, MATCH_SECONDS - 1, { a: [{ type: 'fire' }] })
    expect(world.swings.length).toBeLessThanOrEqual(3)
  })
})