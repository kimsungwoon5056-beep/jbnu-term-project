// 이 파일은 skills.js를 world.js보다 먼저 불러온다(서로 가져오는 두 모듈이 어느 순서로 불려도 동작하는지 확인).
import { expandEvent, Projectile, SelfEffect, Shockwave, SKILLS, Trap, Turret } from './skills'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { ARENA, createWorld, LAG, spawnEvent } from './world'

// Factory Method: 기술마다 cast가 제품 객체를 만들고, 제품은 place(world)로 스스로 세계에 놓인다.

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) =>
  buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
// a = 시전한 사람, b = 맞는 사람. local이면 그 화면이 판정한다.
const world = ({ aLocal = true, bLocal = true } = {}) =>
  createWorld({
    events: false,
    damageScale: 1, // 기본 피해 규칙을 본다(인원별 배율은 lives.test.js)
    players: [
      { id: 'a', loadout: loadout('나'), local: aLocal },
      { id: 'b', loadout: loadout('상대'), local: bLocal },
    ],
  })
const shotSpec = { owner: 'a', x: 100, y: 200, vx: 300, vy: 0, r: 4, damage: 8, life: 1, color: '#fff', pierce: false, homing: 0, delay: 0 }

describe('Factory Method: 기술마다 cast가 만드는 제품', () => {
  const ev = (s) => ({ k: 'skill', s, o: 'a', x: 100, y: 200, a: 0 })
  const productOf = {
    messenger: Projectile,
    feed: Projectile,
    game: Projectile,
    webtoon: Projectile,
    shopping: Projectile,
    music: Shockwave,
  }

  it('기술마다 정해진 종류의 제품을 만들고, 모든 제품은 place를 가진다', () => {
    for (const [key, Product] of Object.entries(productOf)) {
      const parts = SKILLS[key].cast(ev(key))
      expect(parts.length, key).toBeGreaterThan(0)
      for (const part of parts) {
        expect(part, key).toBeInstanceOf(Product)
        expect(typeof part.place).toBe('function')
      }
    }
    const kinds = (key) => new Set(SKILLS[key].cast(ev(key)).map((part) => part.constructor))
    expect(kinds('video')).toEqual(new Set([Trap, Turret]))
    expect(kinds('detox')).toEqual(new Set([SelfEffect, Shockwave]))
    for (const key of ['finance', 'study']) expect(kinds(key)).toEqual(new Set([SelfEffect, Projectile]))
    expect(SKILLS.unrecorded.cast(ev('unrecorded'))).toEqual([])
    expect(expandEvent({ k: 'shot', o: 'a', x: 0, y: 0, a: 0 })[0]).toBeInstanceOf(Projectile)
  })

  it('세계는 제품 종류를 모르고 place만 부른다', () => {
    const placed = []
    SKILLS.fake = { name: '가짜', desc: '', cooldown: 1, cast: (e) => [{ place: (w) => placed.push([w, e.o]) }] }
    try {
      const w = world()
      spawnEvent(w, { k: 'skill', s: 'fake', o: 'a', x: 0, y: 0, a: 0 })
      expect(placed).toEqual([[w, 'a']])
    } finally {
      delete SKILLS.fake
    }
  })
})

describe('제품: place 결과', () => {
  it('Projectile: 바로 나가는 탄은 풀에 값만 복사해 들어간다', () => {
    const w = world()
    const part = new Projectile(shotSpec)
    part.place(w)
    const [pooled] = w.projectiles.active
    expect(pooled).not.toBe(part)
    expect(pooled).not.toBeInstanceOf(Projectile)
    expect(pooled).toMatchObject({ ...shotSpec, active: true })
    expect(pooled.hits.size).toBe(0)
    expect(w.pending).toEqual([])
  })

  it('Projectile: 늦게 나가는 탄은 대기 줄에 들어간다', () => {
    const w = world()
    const part = new Projectile({ ...shotSpec, delay: 0.3 })
    part.place(w)
    expect(w.projectiles.active).toHaveLength(0)
    expect(w.pending).toEqual([{ delay: 0.3, spec: part, from: 'a' }])
  })

  it('Projectile.caughtUp: 늦게 받은 만큼 앞당긴 새 탄(상한 LAG.catchUp), 원래 탄은 그대로', () => {
    const part = new Projectile(shotSpec)
    const moved = part.caughtUp(0.1)
    expect(moved).toBeInstanceOf(Projectile)
    expect(moved).not.toBe(part)
    expect(moved.x).toBeCloseTo(100 + 300 * 0.1)
    expect(moved.life).toBeCloseTo(0.9)
    expect(part.x).toBe(100)
    expect(part.caughtUp(5).x).toBeCloseTo(100 + 300 * LAG.catchUp)
    expect(part.caughtUp(0)).toBe(part)
    const waiting = new Projectile({ ...shotSpec, delay: 0.3 }).caughtUp(0.1)
    expect(waiting.delay).toBeCloseTo(0.2)
    expect(waiting.x).toBe(100)
  })

  it('Trap: 경기장 밖을 조준해도 안쪽에 놓인다', () => {
    const w = world()
    new Trap({ owner: 'a', x: -50, y: ARENA.h + 50, r: 18, life: 6, damage: 12, stun: 0.8, color: '#f00' }).place(w)
    expect(w.traps).toEqual([{ owner: 'a', x: 20, y: ARENA.h - 20, r: 18, life: 6, damage: 12, stun: 0.8, color: '#f00' }])
  })

  it('Shockwave: 둘레 안의 상대만 피해를 입고 밀려난다', () => {
    const w = world()
    const [a, b] = w.players
    b.x = a.x + 40
    b.y = a.y
    const before = b.x
    new Shockwave({ owner: 'a', x: a.x, y: a.y, r: 95, damage: 10, push: 70, color: '#80f' }).place(w)
    expect(w.rings).toHaveLength(1)
    expect(w.rings[0].t).toBe(0)
    expect(b.hp).toBe(b.maxHp - 10)
    expect(b.x).toBeGreaterThan(before)
    expect(a.hp).toBe(a.maxHp)

    const far = world()
    far.players[1].x = far.players[0].x + 200
    new Shockwave({ owner: 'a', x: far.players[0].x, y: far.players[0].y, r: 95, damage: 10, push: 70, color: '#80f' }).place(far)
    expect(far.players[1].hp).toBe(far.players[1].maxHp)
  })

  it('SelfEffect: 효과 글자는 모든 화면에, 상태 변화는 시전한 사람 화면에서만', () => {
    const mine = world()
    const me = mine.players[0]
    me.hp = me.maxHp - 5
    new SelfEffect({ owner: 'a', effect: 'shield', time: 3, heal: 20 }).place(mine)
    expect(me.shieldT).toBe(3)
    expect(me.hp).toBe(me.maxHp)
    expect(mine.effects.map((fx) => fx.kind)).toEqual(['shield'])

    const theirs = world({ aLocal: false })
    new SelfEffect({ owner: 'a', effect: 'focus', time: 3, heal: 0 }).place(theirs)
    expect(theirs.players[0].focusT).toBe(0)
    expect(theirs.effects.map((fx) => fx.kind)).toEqual(['focus'])
  })
})
