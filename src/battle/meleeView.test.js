import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { moveOf, Swing, WEAPONS } from './melee'
import { Motions } from './motions'
import { rigPose } from './rig'
import { soundBoard } from './sound'
import { TopView } from './topView'
import { WEAPON_ART, weaponRows } from './weaponArt'
import { createWorld, stepWorld } from './world'

// 근접 공격의 모습: 몸 자세, 모션 신호, 때린 쪽 손맛 신호, 소리, 무기 도트
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const armed = (name, skill) => ({ ...buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name }), skill })
const SHAPES = ['arc', 'thrust', 'slam', 'circle', 'line']
const moveLike = (shape) => ({ shape, reach: 50, width: 1.6, sweep: 1, thick: 16, windup: 0.2, active: 0.1, recovery: 0.2, damage: 3 })

describe('휘두르는 몸 자세', () => {
  it('모양마다 준비·타격·회복 어디서도 자세 값이 숫자다', () => {
    for (const shape of SHAPES) {
      for (const t of [0, 0.1, 0.2, 0.25, 0.3, 0.45, 0.6]) {
        for (const raised of [false, true]) {
          const pose = rigPose({ swing: { t, move: moveLike(shape) }, turn: -1 }, { time: 1, aim: 0.4, raised, weapon: 'feed' })
          for (const limb of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) for (const v of Object.values(pose[limb])) expect(Number.isFinite(v), `${shape} ${t} ${limb}`).toBe(true)
          expect(Number.isFinite(pose.turn)).toBe(true)
        }
      }
    }
  })

  it('찌르기는 타격 때 팔을 앞으로 뻗고, 내려찍기는 준비 때 팔을 머리 위로 든다', () => {
    const thrust = rigPose({ swing: { t: 0.25, move: moveLike('thrust') } }, { time: 0 })
    expect(Math.abs(thrust.armR.r + Math.PI / 2)).toBeLessThan(0.35)
    const slam = rigPose({ swing: { t: 0.19, move: moveLike('slam') } }, { time: 0 })
    expect(slam.armR.r).toBeLessThan(-2.3)
    const arcStart = rigPose({ swing: { t: 0.2, move: moveLike('arc') } }, { time: 0 }).armR.r
    const arcEnd = rigPose({ swing: { t: 0.3, move: moveLike('arc') } }, { time: 0 }).armR.r
    expect(Math.abs(arcEnd - arcStart)).toBeGreaterThan(1.2) // 타격 동안 크게 휘두른다
    expect(rigPose({}, { weapon: 'video' }).weapon).toBe('video')
    expect(rigPose({}, {}).weapon).toBe(null)
  })

  it('공격 신호를 받으면 그 무기 그 타의 휘두르기 모션이 생기고, 끝나면 지워진다', () => {
    const motions = new Motions()
    motions.react({ kind: 'shot', who: 'a', s: 'feed', c: 1 }, { id: 'a', aim: 0 })
    const move = moveOf('feed', 1)
    expect(motions.of('a').swing.move).toBe(move)
    motions.step(move.windup + move.active + move.recovery + 0.05, [{ id: 'a', x: 0, y: 0, alive: true, aim: 0 }])
    expect(motions.of('a').swing).toBe(null)
  })
})

describe('때린 쪽 손맛과 소리', () => {
  const duel = (bLocal) =>
    createWorld({
      events: false,
      damageScale: 1,
      players: [
        { id: 'a', loadout: armed('a', 'webtoon'), local: true },
        { id: 'b', loadout: armed('b', 'detox'), local: bLocal },
      ],
    })
  const place = (player, x, y) => Object.assign(player, { x, y, tx: x, ty: y })
  const swingAt = (bLocal) => {
    const world = duel(bLocal)
    const [a, b] = world.players
    place(a, 100, 220)
    place(b, 135, 220)
    const signals = []
    world.signals.subscribe((signal) => signals.push(signal))
    new Swing({ owner: 'a', x: 100, y: 220, a: 0, move: moveOf('webtoon', 0) }).place(world)
    for (let i = 0; i < 40; i += 1) stepWorld(world, {}, 1 / 60)
    return { signals, b }
  }

  it('원격 상대와 겹치면 내 화면에 부딪힘(clash) 신호가 한 번만 나고 체력은 그대로다', () => {
    const { signals, b } = swingAt(false)
    expect(signals.filter((s) => s.kind === 'clash')).toHaveLength(1)
    expect(signals.find((s) => s.kind === 'clash')).toMatchObject({ who: 'a', text: 'b' })
    expect(b.hp).toBe(b.maxHp)
  })

  it('내 화면에서 판정하는 상대면 부딪힘 대신 진짜 맞음 신호에 때린 사람이 담긴다', () => {
    const { signals } = swingAt(true)
    expect(signals.some((s) => s.kind === 'clash')).toBe(false)
    expect(signals.find((s) => s.kind === 'hit')).toMatchObject({ who: 'b', from: 'a' })
  })

  it('내 공격은 휘두르는 소리, 내 부딪힘은 부딪히는 소리', () => {
    const played = []
    const board = soundBoard('a', (name) => played.push(name))
    board({ kind: 'shot', who: 'a', s: 'webtoon', c: 0 })
    board({ kind: 'shot', who: 'b', s: 'webtoon', c: 0 })
    board({ kind: 'clash', who: 'a' })
    board({ kind: 'clash', who: 'b' })
    expect(played).toEqual(['swing', 'clash'])
  })
})

describe('무기 도트', () => {
  it('맨주먹을 뺀 무기마다 도트가 있고, 줄 길이가 같고, 쓰는 글자는 팔레트 안이다', () => {
    for (const key of Object.keys(WEAPONS)) {
      const rows = weaponRows(key)
      if (key === 'unrecorded') {
        expect(rows).toBe(null)
        continue
      }
      expect(rows.length, key).toBeGreaterThan(5)
      for (const row of rows) {
        expect(row.length, key).toBe(rows[0].length)
        for (const ch of row) expect('.kwadbgpy', `${key} ${ch}`).toContain(ch)
      }
    }
    expect(Object.keys(WEAPON_ART).sort()).toEqual(Object.keys(WEAPONS).filter((key) => key !== 'unrecorded').sort())
  })
})

describe('지도 앱 화면의 휘두르기', () => {
  it('큰 공격의 준비는 빨간 맞을 자리, 타격은 칼날 띠를 그린다(값은 모두 숫자)', () => {
    const world = createWorld({ events: false, players: ['a', 'b'].map((id) => ({ id, loadout: armed(id, 'shopping'), local: true })) })
    const nums = []
    const ctx = new Proxy({}, { get: (target, key) => (key in target ? target[key] : (...args) => nums.push(...args.filter((v) => typeof v === 'number'))), set: (target, key, value) => ((target[key] = value), true) })
    const view = { swingMarks: null }
    const marks = (move, t, key = 'shopping') => {
      world.swings = [new Swing({ owner: 'b', x: 200, y: 300, a: 1, move, key, t })]
      TopView.prototype.drawSwings.call(view, ctx, world)
      return view.swingMarks
    }
    const slam = moveOf('shopping', 0)
    expect(marks(slam, slam.windup / 2)).toEqual({ warns: 1, trails: 0 })
    expect(marks(slam, slam.windup + slam.active / 2)).toEqual({ warns: 0, trails: 1 })
    for (const [key, weapon] of Object.entries(WEAPONS)) for (const move of weapon.combo) marks(move, move.windup + move.active / 2, key)
    expect(nums.every(Number.isFinite)).toBe(true)
  })
})