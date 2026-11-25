import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { makeCrack } from './fx'
import { buildLoadout } from './loadout'
import { LENGTH, Motions, poseOf } from './motions'
import { STORM } from './schedule'
import { applyDamage, AREA, createWorld, stepWorld } from './world'

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const REST = poseOf(null)
const players = [{ id: 'a', x: 0, y: 0, alive: true, aim: 0 }]

describe('캐릭터 모션', () => {
  it('맞으면 찌그러졌다가 시간이 지나면 원래 자세로 돌아온다', () => {
    const motions = new Motions()
    motions.react({ kind: 'hit', who: 'a', text: '-3', push: { x: 1, y: 0 } }, players[0])
    motions.step(0.05, players)
    const pose = motions.pose('a')
    expect(pose.sy).toBeLessThan(1)
    expect(pose.sx).toBeGreaterThan(1)
    expect(pose.rot).toBeGreaterThan(0) // 오른쪽으로 맞으면 오른쪽으로 기운다
    for (let i = 0; i < 60; i += 1) motions.step(LENGTH.big / 30, players)
    expect(motions.pose('a')).toEqual(REST)
  })

  it('크게 맞으면 더 크게 움직이고 별이 돈다', () => {
    const small = poseOf({ hit: { t: 0.05, power: 0.9, dir: 1 } })
    const big = poseOf({ hit: { t: 0.05, power: 1.6, dir: 1 } })
    expect(big.rot).toBeGreaterThan(small.rot)
    expect(small.stars).toBe(0)
    expect(big.stars).toBeGreaterThan(0)
  })

  it('쓰러지면 튀어 올라 돌다가 사라지고, 그 뒤 맞아도 바뀌지 않는다', () => {
    const motions = new Motions()
    motions.react({ kind: 'down', who: 'a' }, players[0])
    motions.step(LENGTH.down * 0.3, players)
    expect(motions.pose('a').lift).toBeGreaterThan(30)
    motions.react({ kind: 'hit', who: 'a', text: '-9' }, players[0])
    expect(motions.of('a').hit).toBeFalsy()
    motions.step(LENGTH.down, players)
    expect(motions.pose('a').alpha).toBe(0)
  })

  it('동작 줄이기면 찌그러지거나 돌지 않는다', () => {
    const still = { reduced: true }
    expect(poseOf({ hit: { t: 0.05, power: 1.6, dir: 1 }, walk: 1 }, still)).toEqual(REST)
    const down = poseOf({ down: { t: 1, dir: 1 } }, still)
    expect([down.rot, down.lift]).toEqual([0, 0])
    expect(down.alpha).toBeGreaterThan(0)
  })

  it('걸으면 들썩이고 멈추면 가만히 있다', () => {
    const motions = new Motions()
    const me = { id: 'a', x: 0, y: 0, alive: true, aim: 0 }
    motions.step(0.016, [me])
    for (let i = 0; i < 5; i += 1) {
      me.x += 3
      motions.step(0.016, [me])
    }
    expect(motions.pose('a').dy).toBeLessThan(0)
    motions.step(0.016, [me])
    expect(motions.pose('a')).toEqual(REST)
  })

  it('자세 값에 NaN이 없다', () => {
    for (let t = 0; t < 3; t += 0.07) {
      const pose = poseOf({ hit: { t, power: 1.6, dir: -1 }, pick: { t }, shot: { t, aim: 2 }, walk: t * 5 })
      const down = poseOf({ down: { t, dir: -1 } })
      for (const value of [...Object.values(pose), ...Object.values(down)]) expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe('모션에 쓰는 신호', () => {
  it('피해 신호에 밀린 방향이, 알림 말풍선에 맞으면 종류가 함께 온다', () => {
    const world = createWorld({ players: [{ id: 'a', loadout: loadout('나'), local: true }], seed: 3 })
    const got = []
    world.signals.subscribe((signal) => got.push(signal))
    applyDamage(world, world.players[0], 3, { x: -1, y: 0 })
    expect(got[0]).toMatchObject({ kind: 'hit', push: { x: -1, y: 0 } })

    const bubble = world.schedule.bubbles[0]
    world.time = bubble.t + 1
    Object.assign(world.players[0], { x: bubble.x, y: Math.min(AREA.y1 - 20, AREA.y0 - STORM.h + STORM.speed) })
    stepWorld(world, {}, 1 / 60)
    const splat = got.find((signal) => signal.kind === 'splat')
    expect(splat).toMatchObject({ who: 'a', text: bubble.kind })
  })

  it('액정 금은 같은 씨앗이면 같고, 값이 모두 숫자다', () => {
    expect(makeCrack(5)).toEqual(makeCrack(5))
    expect(makeCrack(5)).not.toEqual(makeCrack(6))
    expect(makeCrack(5).lines.flat(2).every(Number.isFinite)).toBe(true)
  })
})
