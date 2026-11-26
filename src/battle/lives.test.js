import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { safeOf } from './schedule'
import { applyDamage, AREA, createWorld, isOut, LIVES, MATCH_SECONDS, OBSTACLES, RADIUS, rankPlayers, RESPAWN, stepWorld } from './world'

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const plain = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const table = (count = 2, events = false) => createWorld({ events, players: ['a', 'b', 'c', 'd'].slice(0, count).map((id) => ({ id, loadout: plain(id), local: true })) })
const run = (world, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) stepWorld(world, {}, 1 / 60)
}
const knock = (world, player) => applyDamage(world, player, 999)

describe('목숨 3개와 다시 시작', () => {
  it('체력이 0이 되면 목숨이 줄고 3초 뒤 꽉 찬 체력으로 다시 시작한다', () => {
    const world = table()
    const a = world.players[0]
    expect(a.lives).toBe(LIVES)
    a.x = 200
    knock(world, a)
    expect(a.alive).toBe(false)
    expect(a.lives).toBe(LIVES - 1)
    run(world, RESPAWN.wait - 0.1)
    expect(a.alive).toBe(false)
    run(world, 0.2)
    expect(a.alive).toBe(true)
    expect(a.hp).toBe(a.maxHp)
    expect([a.x, a.y]).toEqual([40, 72]) // 처음 자리(사건이 없는 판이라 꺼진 곳이 없다)
  })

  it('다시 시작한 뒤 2초는 맞지 않는다', () => {
    const world = table()
    const a = world.players[0]
    knock(world, a)
    run(world, RESPAWN.wait + 0.1)
    expect(applyDamage(world, a, 10)).toBe(false)
    run(world, RESPAWN.guard)
    expect(applyDamage(world, a, 10)).toBe(true)
  })

  it('마지막 목숨을 잃으면 아웃이고 다시 시작하지 않는다', () => {
    const world = table(3)
    const a = world.players[0]
    for (let i = 0; i < LIVES; i += 1) {
      a.airT = 0
      knock(world, a)
      if (i < LIVES - 1) run(world, RESPAWN.wait + 0.1)
    }
    expect(isOut(a)).toBe(true)
    run(world, RESPAWN.wait + 1)
    expect(a.alive).toBe(false)
  })

  it('다시 기다리는 사람이 있으면 판이 끝나지 않는다', () => {
    const world = table()
    knock(world, world.players[0])
    run(world, 0.1)
    expect(world.over).toBe(false)
  })

  it('마지막 상대가 아웃되면 내가 기다리는 중이어도 끝나고 내가 1등', () => {
    const world = table()
    const [a, b] = world.players
    knock(world, a)
    b.lives = 1
    knock(world, b)
    run(world, 0.05)
    expect(world.over).toBe(true)
    expect(rankPlayers(world)[0].id).toBe('a')
  })

  it('5분이 되면 남은 목숨 → 체력 순으로 순위', () => {
    const world = table(3)
    const [a, b, c] = world.players
    Object.assign(a, { lives: 2, hp: 50 })
    Object.assign(b, { lives: 3, hp: 10 })
    Object.assign(c, { lives: 2, hp: 70 })
    world.time = MATCH_SECONDS - 0.01
    run(world, 0.05)
    expect(world.over).toBe(true)
    expect(rankPlayers(world).map((player) => player.id)).toEqual(['b', 'c', 'a'])
  })

  it('배터리 경고가 가장 좁을 때도 켜진 자리에서 다시 시작한다', () => {
    const world = table(4, true)
    world.time = 280
    const safe = safeOf(world, AREA)
    for (const player of world.players) {
      knock(world, player)
      player.respawnAt = world.time
    }
    stepWorld(world, {}, 1 / 60)
    for (const player of world.players) {
      expect(player.alive).toBe(true)
      expect(player.x).toBeGreaterThanOrEqual(safe.x0 + RADIUS)
      expect(player.x).toBeLessThanOrEqual(safe.x1 - RADIUS)
      expect(player.y).toBeGreaterThanOrEqual(safe.y0 + RADIUS)
      expect(player.y).toBeLessThanOrEqual(safe.y1 - RADIUS)
      for (const box of OBSTACLES) {
        const nx = Math.min(box.x + box.w, Math.max(box.x, player.x))
        const ny = Math.min(box.y + box.h, Math.max(box.y, player.y))
        expect(Math.hypot(player.x - nx, player.y - ny)).toBeGreaterThanOrEqual(RADIUS)
      }
    }
  })
})

describe('인원별 피해', () => {
  it('인원이 적을수록 피해가 줄어들고(2인 0.6배, 3인 0.8배, 4인 그대로), 체력은 정수로 남는다', () => {
    for (const [count, expected] of [[2, 6], [3, 8], [4, 10]]) {
      const world = table(count)
      const a = world.players[0]
      applyDamage(world, a, 10)
      expect(a.maxHp - a.hp, `${count}인`).toBe(expected)
    }
    const world = table(2)
    const a = world.players[0]
    applyDamage(world, a, 1)
    expect(a.maxHp - a.hp).toBe(1) // 아무리 작아도 1은 깎인다
  })
})
