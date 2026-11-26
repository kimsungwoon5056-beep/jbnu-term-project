import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { blinkEnd, expandEvent, Projectile, Shockwave, SKILLS, Trap } from './skills'
import { STORM } from './schedule'
import { applyDamage, createWorld, JUMP, OBSTACLES, spawnEvent, stepWorld } from './world'

// Q 근접 기술: 모션이 저마다 다른 근접 기술 11종(설계안 4-4)
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const armed = (name, skill) => ({ ...buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name }), skill })
const DT = 1 / 60
const table = (skill, count = 3) =>
  createWorld({ events: false, damageScale: 1, players: ['a', 'b', 'c'].slice(0, count).map((id) => ({ id, loadout: armed(id, id === 'a' ? skill : 'detox'), local: true })) })
const place = (player, x, y) => Object.assign(player, { x, y, tx: x, ty: y })
const run = (world, seconds, each) => {
  for (let i = 0; i < Math.round(seconds / DT); i += 1) {
    stepWorld(world, {}, DT)
    each?.(world)
  }
}
// a가 (x, y)에서 오른쪽(a=0)으로 기술을 쓴다.
const cast = (world, s, x = 60, y = 220, a = 0, extra = {}) => {
  place(world.players[0], x, y)
  spawnEvent(world, { k: 'skill', s, o: 'a', x, y, a, m: 1, ...extra })
}
const hurt = (player) => player.maxHp - player.hp

describe('Q 근접 기술', () => {
  it('모든 기술은 쿨다운·이름·설명·쓰는 때(kind)를 갖고, 쓰면 NaN 없이 12초 안에 다 끝난다', () => {
    for (const [key, skill] of Object.entries(SKILLS)) {
      expect(skill.cooldown, key).toBeGreaterThan(0)
      expect(['self', 'close', 'mid', 'block', 'none'], key).toContain(skill.kind)
      const world = table(key)
      place(world.players[1], 110, 220)
      place(world.players[2], 160, 240)
      cast(world, key)
      run(world, 12, () => {
        for (const p of world.players) expect([p.x, p.y, p.z, p.hp].every(Number.isFinite), key).toBe(true)
      })
      expect([world.swings.length, world.timers.length, world.traps.length], key).toEqual([0, 0, 0])
    }
  })

  it('읽씹 태클: 앞으로 돌진하며 길 위의 상대 모두를 한 번씩 때리고 기절시킨다', () => {
    const world = table('messenger')
    const [a, b, c] = world.players
    place(b, 100, 220)
    place(c, 150, 222)
    cast(world, 'messenger')
    run(world, 0.6)
    expect(a.x).toBeGreaterThan(130)
    for (const foe of [b, c]) {
      expect(hurt(foe)).toBe(5)
      expect(foe.stunT).toBeGreaterThan(0)
    }
  })

  it('좋아요 회오리: 1초 동안 둘레를 세 번 벤다', () => {
    const world = table('feed', 2)
    place(world.players[1], 100, 220)
    cast(world, 'feed', 60, 220)
    run(world, 1.4, () => place(world.players[1], 100, 220))
    expect(hurt(world.players[1])).toBe(9)
  })

  it('되감기: 돌진해 찌르고 1초 뒤 시작 자리로 돌아온다', () => {
    const world = table('video', 2)
    const [a, b] = world.players
    place(b, 130, 220)
    cast(world, 'video', 60, 220)
    run(world, 0.4)
    expect(a.x).toBeGreaterThan(100)
    expect(hurt(b)).toBe(6)
    run(world, 0.8)
    expect([Math.round(a.x), Math.round(a.y)]).toEqual([60, 220])
  })

  it('드롭: 높이 떠올랐다가 내려앉을 때 둘레를 내려찍고, 떠 있는 상대는 피한다', () => {
    const world = table('music')
    const [a, b, c] = world.players
    place(b, 100, 220)
    place(c, 60, 270)
    cast(world, 'music', 60, 220)
    let peak = 0
    run(world, 0.6, () => (peak = Math.max(peak, a.z)))
    expect(peak).toBeGreaterThan(JUMP.clear * 2)
    expect(hurt(b)).toBe(0) // 아직 내려오지 않았다
    c.z = 40 // c는 그때 떠 있다
    c.vz = 330 // 내려찍는 동안 계속 떠 있게
    run(world, 1.2)
    expect(hurt(b)).toBe(7)
    expect(hurt(c)).toBe(0)
  })

  it('필살 콤보: 앞을 여러 번 벤 뒤 마지막 타가 띄운다', () => {
    const world = table('game', 2)
    const b = world.players[1]
    place(b, 95, 220)
    cast(world, 'game')
    let lifted = 0
    run(world, 1.3, () => {
      lifted = Math.max(lifted, b.z)
      if (b.z === 0) place(b, 95, 220)
    })
    expect(hurt(b)).toBe(5 * 2 + 3)
    expect(lifted).toBeGreaterThan(0)
  })

  it('컷 전환: 벽 앞까지 순간이동하며 지나간 줄만 벤다', () => {
    const box = OBSTACLES[2] // 유튜브(152~208, 264~320)
    const end = blinkEnd(60, 292, 0, 140)
    expect(end.x).toBeLessThan(box.x - 10)
    const world = table('webtoon')
    const [a, b, c] = world.players
    place(b, 110, 292)
    place(c, 230, 292) // 벽 너머
    cast(world, 'webtoon', 60, 292)
    run(world, 0.5)
    expect(Math.round(a.x)).toBe(Math.round(end.x))
    expect(hurt(b)).toBe(7)
    expect(hurt(c)).toBe(0)
  })

  it('당일 배송: 0.6초 모은 뒤 크게 내려찍어 멀리 밀고 멈칫하게 한다', () => {
    const world = table('shopping', 2)
    const b = world.players[1]
    place(b, 105, 220)
    cast(world, 'shopping')
    run(world, 0.55)
    expect(hurt(b)).toBe(0)
    run(world, 0.25)
    expect(hurt(b)).toBe(10)
    expect(b.x).toBeGreaterThan(130)
    expect(b.stunT).toBeGreaterThan(0)
  })

  it('손절 반격: 막는 동안 주인 있는 피해(휘두르기·탄·충격파·덫)는 0, 반격 이벤트를 하나 보낸다', () => {
    for (const hit of ['swing', 'shot', 'wave', 'trap']) {
      const world = table('finance', 2)
      const [a, b] = world.players
      place(b, 100, 220)
      cast(world, 'finance')
      world.outbox = []
      if (hit === 'swing') spawnEvent(world, { k: 'shot', s: 'detox', c: 2, o: 'b', x: 100, y: 220, a: Math.PI, m: 1 })
      if (hit === 'shot') Projectile.aimed({ o: 'b', x: 100, y: 220 }, Math.PI, { speed: 300, damage: 4, r: 5, life: 1 }).place(world)
      if (hit === 'wave') new Shockwave({ owner: 'b', x: 70, y: 220, r: 40, damage: 4, push: 10 }).place(world)
      if (hit === 'trap') new Trap({ owner: 'b', x: 60, y: 220, r: 18, life: 2, damage: 4, stun: 0.5 }).place(world)
      run(world, 0.4)
      expect(a.hp, hit).toBe(a.maxHp)
      const counters = world.outbox.filter((ev) => ev.k === 'skill' && ev.s === 'finance' && ev.c === 1)
      expect(counters, hit).toHaveLength(1)
      expect(Math.cos(counters[0].a), hit).toBeGreaterThan(0.8) // 막은 공격의 주인(오른쪽) 쪽으로
    }
  })

  it('손절 반격: 알림 폭풍·배터리 같은 주인 없는 피해는 막지 않고, 반격 베기는 피해 12', () => {
    const world = table('finance', 2)
    const [a, b] = world.players
    cast(world, 'finance')
    expect(applyDamage(world, a, STORM.damage)).toBe(true)
    place(b, 100, 220)
    spawnEvent(world, { k: 'skill', s: 'finance', c: 1, o: 'a', x: 60, y: 220, a: 0, m: 1 })
    run(world, 0.3)
    expect(hurt(b)).toBe(12)
    expect(expandEvent({ k: 'skill', s: 'finance', c: 1, o: 'a', x: 0, y: 0, a: 0 })).toHaveLength(1)
  })

  it('벼락치기: 3초 집중하고 곧바로 세 번 찌른다', () => {
    const world = table('study', 2)
    const [a, b] = world.players
    place(b, 100, 220)
    cast(world, 'study')
    expect(a.focusT).toBeGreaterThan(2.9)
    run(world, 0.8)
    expect(hurt(b)).toBe(9)
  })

  it('디톡스 실드는 그대로: 무적·회복·밀어내는 파동', () => {
    const world = table('detox', 2)
    const [a, b] = world.players
    a.hp = 30
    place(b, 90, 220)
    cast(world, 'detox')
    expect(a.shieldT).toBeGreaterThan(2)
    expect(a.hp).toBe(42)
    expect(hurt(b)).toBeGreaterThan(0)
  })
})
