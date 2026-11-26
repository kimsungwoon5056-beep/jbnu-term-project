import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { makeCrack } from './fx'
import { buildLoadout, loadoutSprite } from './loadout'
import { LENGTH, Motions, poseOf } from './motions'
import { backSprite, LIMBS, rigPose, splitLimbs } from './rig'
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
    const fallen = players.map((player, i) => (i === 0 ? { ...player, alive: false } : player)) // 쓰러지면 alive가 false다
    motions.react({ kind: 'down', who: 'a' }, fallen[0])
    motions.step(LENGTH.down * 0.3, fallen)
    expect(motions.pose('a').lift).toBeGreaterThan(30)
    motions.react({ kind: 'hit', who: 'a', text: '-9' }, fallen[0])
    expect(motions.of('a').hit).toBeFalsy()
    motions.step(LENGTH.down, fallen)
    expect(motions.pose('a').alpha).toBe(0)
  })

  it('동작 줄이기면 찌그러지거나 돌지 않는다', () => {
    const still = { reduced: true }
    expect(poseOf({ hit: { t: 0.05, power: 1.6, dir: 1 }, cast: { t: 0.2 } }, still)).toEqual(REST)
    const down = poseOf({ down: { t: 1, dir: 1 } }, still)
    expect([down.rot, down.lift]).toEqual([0, 0])
    expect(down.alpha).toBeGreaterThan(0)
  })

  it('걸으면 간 거리만큼 발이 나가고 멈추면 천천히 선다', () => {
    const motions = new Motions()
    const me = { id: 'a', x: 0, y: 0, alive: true, aim: 0 }
    motions.step(0.016, [me])
    for (let i = 0; i < 5; i += 1) {
      me.x += 3
      motions.step(0.016, [me])
    }
    const { run, phase } = motions.of('a')
    expect(run).toBeGreaterThan(0.3)
    expect(phase).toBeCloseTo(15 * 0.16)
    for (let i = 0; i < 60; i += 1) motions.step(0.016, [me])
    expect(motions.of('a').run).toBe(0)
    expect(motions.of('a').phase).toBeCloseTo(phase)
  })

  it('자세 값에 NaN이 없다', () => {
    for (let t = 0; t < 3; t += 0.07) {
      const pose = poseOf({ hit: { t, power: 1.6, dir: -1 }, pick: { t }, shot: { t, aim: 2 }, cast: { t } })
      const down = poseOf({ down: { t, dir: -1 } })
      for (const value of [...Object.values(pose), ...Object.values(down)]) expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe('관절 인형', () => {
  it('그림의 모든 칸이 부위 하나 이상에 들어가고, 외곽선이 아닌 칸은 한 부위에만 있다', () => {
    const sprite = loadoutSprite(loadout('나'))
    const limbs = splitLimbs(sprite)
    const count = new Map()
    for (const limb of LIMBS) for (const [x, y] of limbs[limb]) count.set(`${x},${y}`, (count.get(`${x},${y}`) ?? 0) + 1)
    for (const [x, y, color] of sprite.layers.body) {
      expect(count.get(`${x},${y}`)).toBeGreaterThan(0)
      if (color !== 'outline') expect(count.get(`${x},${y}`)).toBe(1)
    }
    for (const limb of LIMBS) expect(limbs[limb].length, limb).toBeGreaterThan(8)
  })

  it('뒷모습에는 얼굴·눈·입·안경이 없고, 부위가 모두 있으며 48칸 안에 들어온다', () => {
    const hidden = new Set(['eye', 'eyeWhite', 'mouth', 'blush', 'circle', 'skinGlow', 'frame', 'screenFlash'])
    const styles = ['short', 'bangs', 'side', 'bob', 'long', 'ponytail', 'curly', 'buzz']
    const gears = [null, 'kakaotalk', 'instagram', 'youtube', 'tiktok', 'discord', 'baemin']
    for (const hairStyle of styles) {
      for (const icon of gears) {
        for (const slouch of [false, true]) {
          const marks = { ...CALM, slouch, spiral: slouch, darkCircles: true, glow: true, badges: 3, raisePhone: slouch }
          const grafts = [icon && { slot: 'hair', icon, archetype: 'feed' }, { slot: 'outfit', icon: 'toss', archetype: 'finance' }, { slot: 'hand', icon: 'x', archetype: 'feed' }].filter(Boolean)
          const full = { ...loadout('나'), look: { ...DEFAULT_LOOK, hairStyle, glasses: 'round' }, marks, grafts }
          const front = loadoutSprite(full)
          const back = backSprite(front, full)
          const at = `${hairStyle} ${icon} ${slouch}`
          const limbs = splitLimbs(back)
          for (const limb of LIMBS) expect(limbs[limb].length, `${at} ${limb}`).toBeGreaterThan(8)
          for (const [x, y, color] of back.layers.body) {
            expect(x >= 0 && y >= 0 && x < 48 && y < 48, at).toBe(true)
            expect(hidden.has(color), `${at} ${color}`).toBe(false)
            expect(color.startsWith('#') || front.palette[color] !== undefined, `${at} ${color}`).toBe(true)
          }
          // 배지와 손에 든 폰은 남는다.
          expect(back.layers.parts.badge.length, at).toBeGreaterThan(20)
          expect(back.layers.parts.hand.length, at).toBeGreaterThan(20)
        }
      }
    }
  })

  it('걸으면 두 다리가 반대로 움직이고, 팔은 다리와 엇갈린다', () => {
    const pose = rigPose({ run: 1, phase: 1 })
    expect(pose.legL.r).toBeCloseTo(-pose.legR.r)
    expect(Math.sign(pose.armL.r)).toBe(-Math.sign(pose.legL.r))
  })

  it('쏘면 폰 든 팔이 조준한 쪽을 향하고, 왼쪽을 보면 좌우를 뒤집어 같은 쪽을 향한다', () => {
    const right = rigPose({ shot: { t: 0.15 }, turn: 1 }, { aim: 0 })
    const left = rigPose({ shot: { t: 0.15 }, turn: -1 }, { aim: Math.PI })
    expect(right.armR.r).toBeCloseTo(-Math.PI / 2, 1)
    expect(left.flip).toBe(true)
    expect(left.armR.r).toBeCloseTo(right.armR.r, 1)
  })

  it('맞으면 아픈 표정, 멈칫하면 어질한 표정. 동작 줄이기면 자세는 그대로다', () => {
    expect(rigPose({ hit: { t: 0.05, power: 1, dir: 1 } }).face).toBe('hurt')
    expect(rigPose({}, { stun: true }).face).toBe('dizzy')
    const still = rigPose({ run: 1, phase: 1, hit: { t: 0.05, power: 1, dir: 1 } }, { reduced: true })
    expect([still.legL.r, still.head.x]).toEqual([0, 0])
  })

  it('자세 값에 NaN이 없다', () => {
    for (let t = 0; t < 2; t += 0.05) {
      const pose = rigPose({ run: t / 2, phase: t * 9, lean: 1 - t, turn: 1 - t, hit: { t, power: 1.6, dir: -1 }, shot: { t }, cast: { t }, pick: { t }, down: { t, dir: 1 } }, { time: t, stun: true, dash: true, aim: t * 3 })
      for (const limb of LIMBS) for (const value of Object.values(pose[limb])) expect(Number.isFinite(value)).toBe(true)
      expect(pose.turn).toBeGreaterThan(0)
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

describe('다시 시작한 뒤의 모습', () => {
  it('쓰러졌다 다시 시작하면 투명하게 남지 않고 원래 모습으로 돌아온다', () => {
    const motions = new Motions()
    const player = { id: 'a', x: 100, y: 100, aim: 0, alive: false }
    motions.react({ kind: 'down', who: 'a' }, player)
    for (let i = 0; i < 120; i += 1) motions.step(1 / 60, [player])
    expect(poseOf(motions.of('a')).alpha).toBeLessThan(0.1) // 쓰러진 동안은 사라진다
    Object.assign(player, { alive: true, x: 40, y: 72 })
    motions.step(1 / 60, [player])
    const pose = poseOf(motions.of('a'))
    expect(pose.alpha).toBe(1)
    expect(pose.down).toBe(0)
    expect(pose.rot).toBe(0)
  })
})
