import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { OnlineLoop } from './loop'
import { Shockwave, Trap } from './skills'
import { aloft, applyRemote, createWorld, JUMP, spawnEvent, stepWorld } from './world'

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const plain = (name = '테스트') => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const duel = () =>
  createWorld({
    events: false,
    players: [
      { id: 'a', loadout: plain(), local: true },
      { id: 'b', loadout: plain('상대'), local: true },
    ],
  })
const DT = 1 / 60
const step = (world, commands = {}) => stepWorld(world, commands, DT)
const jump = (world) => step(world, { a: [{ type: 'jump' }] })
// 내릴 때까지 걸음마다 높이를 모은다.
function flight(world, me) {
  const heights = []
  jump(world)
  heights.push(me.z)
  for (let i = 0; i < 120 && me.z > 0; i += 1) {
    step(world)
    heights.push(me.z)
  }
  return heights
}

describe('점프', () => {
  it('바닥에서만 뛰고 공중에서 다시 뛸 수 없다', () => {
    const world = duel()
    const me = world.players[0]
    jump(world)
    step(world)
    const vz = me.vz
    jump(world)
    expect(me.z).toBeGreaterThan(0)
    expect(me.vz).toBeLessThan(vz) // 다시 솟지 않고 계속 떨어지는 중
  })

  it('최고 높이는 36~44, 체공은 0.5~0.7초', () => {
    const world = duel()
    const heights = flight(world, world.players[0])
    expect(Math.max(...heights)).toBeGreaterThanOrEqual(36)
    expect(Math.max(...heights)).toBeLessThanOrEqual(44)
    expect(heights.length * DT).toBeGreaterThanOrEqual(0.5)
    expect(heights.length * DT).toBeLessThanOrEqual(0.7)
  })

  it('피할 수 있는 높이는 체공의 35~60%', () => {
    const world = duel()
    const me = world.players[0]
    const heights = flight(world, me)
    const share = heights.filter((z) => z >= JUMP.clear).length / heights.length
    expect(share).toBeGreaterThanOrEqual(0.35)
    expect(share).toBeLessThanOrEqual(0.6)
  })

  it('내린 뒤 0.5초 동안은 다시 못 뛰고, 그 뒤엔 바로 뛴다', () => {
    const world = duel()
    const me = world.players[0]
    flight(world, me)
    expect(me.z).toBe(0)
    for (let i = 0; i < 24; i += 1) step(world)
    jump(world)
    expect(me.z).toBe(0)
    for (let i = 0; i < 10; i += 1) step(world)
    jump(world)
    expect(me.z).toBeGreaterThan(0)
  })

  it('내린 직후 0.15초는 느리다', () => {
    const world = duel()
    const me = world.players[0]
    flight(world, me)
    const move = { a: [{ type: 'move', x: 1, y: 0 }] }
    let x = me.x
    step(world, move)
    const slow = me.x - x
    for (let i = 0; i < 12; i += 1) step(world, move)
    x = me.x
    step(world, move)
    expect(slow).toBeLessThan((me.x - x) * 0.7)
  })

  it('기절 중에는 못 뛴다', () => {
    const world = duel()
    const me = world.players[0]
    me.stunT = 1
    me.cd.jump = 0
    jump(world)
    expect(me.z).toBe(0)
  })

  it('공중 높이에서는 탄·덫·충격파를 맞지 않고, 알림 말풍선은 맞는다', () => {
    const world = duel()
    const [me, other] = world.players
    Object.assign(me, { x: 180, y: 220, z: JUMP.clear + 2, vz: 0 })
    expect(aloft(me)).toBe(true)
    const hold = () => Object.assign(me, { z: JUMP.clear + 2, vz: 0 })
    spawnEvent(world, { k: 'shot', s: 'study', o: other.id, x: 180, y: 300, a: -Math.PI / 2 })
    for (let i = 0; i < 40; i += 1) {
      hold()
      step(world)
    }
    new Trap({ owner: other.id, x: me.x, y: me.y, r: 12, damage: 5, stun: 0.5, life: 5 }).place(world)
    hold()
    step(world)
    new Shockwave({ owner: other.id, x: me.x, y: me.y, r: 40, damage: 8, push: 10 }).place(world)
    expect(me.hp).toBe(me.maxHp)
  })

  it('쓰러지면 높이가 0으로 돌아온다', () => {
    const world = duel()
    const me = world.players[0]
    me.lives = 1
    jump(world)
    step(world)
    me.hp = 1
    me.z = 5 // 피할 높이보다 낮다
    new Shockwave({ owner: 'b', x: me.x, y: me.y, r: 40, damage: 8, push: 0 }).place(world)
    expect(me.alive).toBe(false)
    expect(me.z).toBe(0)
    expect(me.vz).toBe(0)
  })

  it('공중 대시는 높이를 유지한다', () => {
    const world = duel()
    const me = world.players[0]
    jump(world)
    for (let i = 0; i < 6; i += 1) step(world)
    const before = me.z
    step(world, { a: [{ type: 'dash' }] })
    expect(me.dashT).toBeGreaterThan(0)
    expect(me.z).toBeGreaterThan(before - 3)
  })
})

describe('높이 보내기', () => {
  const online = () => createWorld({ events: false, mode: 'online', players: [{ id: 'a', loadout: plain(), local: true }, { id: 'b', loadout: plain('상대'), local: false }] })

  it('보내는 상태에 높이와 목숨이 있다', () => {
    const world = online()
    const sent = []
    const loop = new OnlineLoop({ world, renderer: { draw() {} }, input: { commands: () => [] }, meId: 'a', startAt: 0, channel: { now: () => 100, sendState: (s) => sent.push(s), sendEvent() {} } })
    world.players[0].z = 12.345
    loop.sendMe(world.players[0])
    expect(sent.at(-1)).toMatchObject({ z: 12.3, l: 3 })
  })

  it('받은 높이로 상대가 떠오른다', () => {
    const world = online()
    const b = world.players[1]
    applyRemote(world, 'b', { x: b.x, y: b.y, hp: 50, alive: true, z: 30, t: 100 })
    for (let i = 0; i < 20; i += 1) step(world)
    expect(b.z).toBeGreaterThan(28)
  })

  it('높이가 없는 옛 상태도 받는다', () => {
    const world = online()
    const b = world.players[1]
    applyRemote(world, 'b', { x: 100, y: 200, hp: 50, alive: true, t: 100 })
    step(world)
    expect(b.z).toBe(0)
    expect(b.hp).toBe(50)
  })
})

describe('Firebase 규칙', () => {
  const rules = JSON.parse(readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8'))
  const state = rules.rules.rooms.$code.players.$uid.s

  it('상태에 높이 z와 목숨 l 칸이 있고, 다른 칸은 여전히 막는다', () => {
    expect(state.z['.validate']).toContain('newData.isNumber()')
    expect(state.z['.validate']).toContain('<= 200')
    expect(state.l['.validate']).toContain('<= 3')
    expect(state.l['.validate']).toContain('newData.val() <= data.val()') // 판 중에는 늘 수 없다
    expect(state.$other['.validate']).toBe(false)
  })
})
