import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { ATTACKS, attackOf } from './attacks'
import { buildLoadout } from './loadout'
import { SHAPES } from './shotArt'
import { expandEvent, SKILLS } from './skills'
import { createWorld, OBSTACLES, spawnEvent, stepWorld } from './world'

// 앱 유형마다 다른 기본 공격과 기술의 움직임

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (archetype) =>
  buildLoadout({
    state: { tier: 'mid', grafts: archetype ? [{ slot: 'hair', icon: null, archetype }] : [], scene: 'home', health: { percent: 50 }, marks: CALM },
    look: DEFAULT_LOOK,
    nickname: archetype ?? '디톡스',
  })
const makeWorld = (a = null) => {
  const world = createWorld({ events: false, players: [{ id: 'a', loadout: loadout(a), local: true }, { id: 'b', loadout: loadout(null), local: true }] })
  Object.assign(world.players[0], { x: 30, y: 230 })
  Object.assign(world.players[1], { x: 330, y: 520 })
  return world
}
const run = (world, seconds, each) => {
  for (let i = 0; i < seconds * 60; i += 1) {
    stepWorld(world, {}, 1 / 60)
    each?.(world, i / 60)
  }
}
const shoot = (world, s, a = 0) => spawnEvent(world, { k: 'shot', s, o: 'a', x: 30, y: 230, a })

describe('기본 공격', () => {
  it('모든 기술 열쇠에 공격이 있고, 탄 그림이 있으며, 초당 피해가 4~10 사이다', () => {
    expect(Object.keys(ATTACKS).sort()).toEqual(Object.keys(SKILLS).sort())
    for (const [key, attack] of Object.entries(ATTACKS)) {
      const perShot = attack.shots.reduce((sum, shot) => sum + shot.damage, 0)
      expect(perShot / attack.cooldown, key).toBeGreaterThan(4)
      expect(perShot / attack.cooldown, key).toBeLessThan(10)
      for (const shot of attack.shots) expect(SHAPES).toContain(shot.shape)
    }
    expect(attackOf('없는 기술')).toBe(ATTACKS.unrecorded)
  })

  it('쏘면 내 앱의 공격이 그 간격으로 나가고, 이벤트에 어떤 공격인지 담긴다(상대 화면에서도 같은 탄)', () => {
    const world = makeWorld('game')
    stepWorld(world, { a: [{ type: 'fire' }] }, 1 / 60)
    expect(world.outbox[0]).toMatchObject({ k: 'shot', s: 'game' })
    expect(world.players[0].cd.shot).toBe(ATTACKS.game.cooldown)
    expect(expandEvent(world.outbox[0])).toHaveLength(1)
    expect(expandEvent({ ...world.outbox[0], s: 'webtoon' })).toHaveLength(3)
    expect(expandEvent({ k: 'shot', o: 'a', x: 0, y: 0, a: 0 })[0].shape).toBe('orb') // 예전 이벤트
  })

  it('하트는 날아갔다가 돌아온다', () => {
    const world = makeWorld()
    shoot(world, 'feed')
    const [shot] = world.projectiles.active
    let far = 0
    run(world, 1.4, () => (far = Math.max(far, shot.x)))
    expect(far).toBeGreaterThan(150)
    expect(shot.x).toBeLessThan(far - 60)
  })

  it('재생 버튼은 빨라지고, 동전은 커지고, 음표는 옆으로 출렁인다', () => {
    const world = makeWorld()
    shoot(world, 'video')
    shoot(world, 'finance')
    shoot(world, 'music')
    const [play, coin, note] = world.projectiles.active
    const startSpeed = play.vx
    let low = Infinity
    let high = -Infinity
    run(world, 0.5, () => {
      low = Math.min(low, note.y)
      high = Math.max(high, note.y)
    })
    expect(play.vx).toBeGreaterThan(startSpeed + 200)
    expect(coin.r).toBeGreaterThan(6)
    expect(high - low).toBeGreaterThan(10)
  })

  it('택배 상자는 벽에 두 번까지 튕기고 세 번째에 사라진다', () => {
    const world = makeWorld()
    const box = OBSTACLES[0]
    spawnEvent(world, { k: 'shot', s: 'shopping', o: 'a', x: box.x - 20, y: box.y + 28, a: 0 })
    const [shot] = world.projectiles.active
    run(world, 0.1)
    expect(shot.vx).toBeLessThan(0)
    expect(shot.bounce).toBe(1)
    run(world, 2)
    expect(world.projectiles.size).toBe(0)
  })
})

describe('기술', () => {
  it('단톡 폭탄은 끝나면 8개로 터진다', () => {
    const world = makeWorld()
    spawnEvent(world, { k: 'skill', s: 'messenger', o: 'a', x: 30, y: 230, a: 0 })
    expect(world.projectiles.size).toBe(1)
    run(world, 0.85)
    expect(world.projectiles.size).toBe(8)
  })

  it('자동 재생 재생기는 4초 동안 가까운 상대에게 쏘고 사라진다', () => {
    const world = makeWorld()
    Object.assign(world.players[1], { x: 130, y: 230 })
    spawnEvent(world, { k: 'skill', s: 'video', o: 'a', x: 30, y: 200, a: 0 })
    expect(world.turrets).toHaveLength(1)
    run(world, 3)
    expect(world.players[1].hp).toBeLessThan(world.players[1].maxHp)
    run(world, 1.5)
    expect(world.turrets).toHaveLength(0)
  })

  it('로켓 배송은 가까이서도 멀리서도 가만히 선 상대를 맞힌다', () => {
    for (const distance of [34, 45, 60, 80, 110, 160]) {
      const world = makeWorld()
      Object.assign(world.players[1], { x: 30, y: 230 + distance })
      spawnEvent(world, { k: 'skill', s: 'shopping', o: 'a', x: 30, y: 230, a: Math.PI / 2 })
      run(world, 1.7)
      expect(world.players[1].hp, `거리 ${distance}`).toBeLessThan(world.players[1].maxHp)
    }
  })

  it('볼륨 최대는 파동이 세 번 차례로 나간다', () => {
    const world = makeWorld()
    Object.assign(world.players[1], { x: 80, y: 230 })
    spawnEvent(world, { k: 'skill', s: 'music', o: 'a', x: 30, y: 230, a: 0 })
    expect(world.rings).toHaveLength(1)
    expect(world.timers).toHaveLength(2)
    run(world, 1)
    expect(world.timers).toHaveLength(0)
  })

  it('모든 공격·기술을 쏘아도 값에 NaN이 없고, 탄은 결국 모두 사라진다', () => {
    const world = makeWorld()
    for (const s of Object.keys(SKILLS)) {
      spawnEvent(world, { k: 'skill', s, o: 'a', x: 180, y: 230, a: 1 })
      spawnEvent(world, { k: 'shot', s, o: 'a', x: 180, y: 230, a: 2 })
    }
    run(world, 12, () => {
      for (const player of world.players) Object.assign(player, { hp: player.maxHp, alive: true })
      for (const shot of world.projectiles.active) expect([shot.x, shot.y, shot.vx, shot.vy, shot.r].every(Number.isFinite)).toBe(true)
    })
    expect(world.projectiles.size).toBe(0)
    expect(world.traps).toHaveLength(0)
  })
})
