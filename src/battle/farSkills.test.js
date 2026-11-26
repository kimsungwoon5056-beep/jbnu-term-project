// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { FAR, FAR_SKILLS, farOf } from './farSkills'
import { dock } from './hud'
import { InputController } from './input'
import { buildLoadout } from './loadout'
import { expandEvent, Projectile, SKILLS, Trap, Turret } from './skills'
import { applyDamage, createWorld, RESPAWN, stepWorld } from './world'

// E 원거리 기술: 가끔만(18초) 쓰는 앱 유형별 원거리 기술
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const armed = (name, skill) => ({ ...buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name }), skill })
const duel = (skill = 'feed') => createWorld({ events: false, players: ['a', 'b'].map((id) => ({ id, loadout: armed(id, skill), local: true })) })
const far = (world) => stepWorld(world, { a: [{ type: 'far' }] }, 1 / 60)
const farEvents = (world) => world.outbox.filter((ev) => ev.k === 'skill' && ev.e === 1)

describe('E 원거리 기술', () => {
  it('모든 앱 유형에 있고 쿨다운이 길다(기록 없음은 더 길다)', () => {
    expect(Object.keys(FAR_SKILLS).sort()).toEqual(Object.keys(SKILLS).sort())
    for (const [key, skill] of Object.entries(FAR_SKILLS)) {
      expect(skill.cooldown, key).toBeGreaterThanOrEqual(FAR.cooldown)
      expect(skill.name.length, key).toBeGreaterThan(0)
    }
    expect(FAR_SKILLS.unrecorded.cooldown).toBeGreaterThan(FAR.cooldown)
    expect(farOf('없는 열쇠')).toBe(FAR_SKILLS.unrecorded)
  })

  it('판이 시작하고 10초 동안은 못 쓰고, 쓰면 18초를 기다린다', () => {
    const world = duel()
    far(world)
    expect(farEvents(world)).toHaveLength(0)
    world.time = FAR.lock
    far(world)
    expect(farEvents(world)).toHaveLength(1)
    expect(farEvents(world)[0]).toMatchObject({ s: 'feed', e: 1, o: 'a' })
    expect(world.players[0].cd.far).toBeCloseTo(FAR.cooldown, 1)
    far(world)
    expect(farEvents(world)).toHaveLength(1)
  })

  it('다시 시작해도 E 기다림은 이어진다(Q·대시는 새로 준비)', () => {
    const world = duel()
    const a = world.players[0]
    world.time = FAR.lock
    far(world)
    a.cd.skill = 5
    applyDamage(world, a, 999)
    for (let i = 0; i < Math.round((RESPAWN.wait + 0.05) * 60); i += 1) stepWorld(world, {}, 1 / 60)
    expect(a.alive).toBe(true)
    expect(a.cd.skill).toBe(0)
    expect(a.cd.far).toBeGreaterThan(FAR.cooldown - RESPAWN.wait - 1)
  })

  it('E 이벤트는 원거리 제품(탄·덫·재생기)을 만든다', () => {
    const kinds = (s) => expandEvent({ k: 'skill', e: 1, s, o: 'a', x: 100, y: 200, a: 0, m: 1 }).map((part) => part.constructor)
    expect(kinds('video')).toEqual([Trap, Turret])
    for (const s of ['detox', 'messenger', 'feed', 'music', 'game', 'webtoon', 'shopping', 'finance', 'study', 'unrecorded']) {
      expect(kinds(s).length, s).toBeGreaterThan(0)
      expect(kinds(s).every((kind) => kind === Projectile), s).toBe(true)
    }
  })
})

describe('E 조작과 표시', () => {
  let input
  afterEach(() => input?.detach())

  it('PC는 E 키가 원거리 기술', () => {
    input = new InputController(document.createElement('canvas'))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', cancelable: true }))
    expect([...input.taps]).toEqual(['far'])
  })

  it('아래 칸에 대시·Q·E·목숨 네 칸이 보이고, E는 남은 시간을 보여 준다', () => {
    const world = duel('webtoon')
    const a = world.players[0]
    a.cd.far = 7.4
    const texts = []
    const ctx = new Proxy({}, { get: (_, key) => (key === 'fillText' ? (text) => texts.push(String(text)) : key === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true })
    dock(ctx, a, 12)
    expect(texts.some((text) => text.startsWith('E '))).toBe(true)
    expect(texts).toContain('7.4초')
    expect(texts.some((text) => text.startsWith('Q '))).toBe(true)
    expect(texts.some((text) => text.startsWith('목숨'))).toBe(true)
  })
})
