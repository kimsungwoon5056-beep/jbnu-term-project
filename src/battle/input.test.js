// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { InputController } from './input'
import { buildLoadout } from './loadout'
import { DIVE } from './schedule'
import { COMMANDS, createWorld } from './world'

// 키 → 명령: Space는 점프, Shift는 대시, Q는 기술
describe('PC 키', () => {
  let input
  afterEach(() => input?.detach())

  const press = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))
  const taps = () => [...input.taps]

  it('Space는 점프, Shift는 대시, Q는 기술', () => {
    input = new InputController(document.createElement('canvas'))
    press('Space')
    expect(taps()).toEqual(['jump'])
    input.clearTaps()
    press('ShiftLeft')
    press('ShiftRight')
    expect(taps()).toEqual(['dash'])
    input.clearTaps()
    press('KeyQ')
    expect(taps()).toEqual(['skill'])
    expect(typeof COMMANDS.jump).toBe('function')
  })

  it('Space와 Shift는 페이지 스크롤·선택에 쓰이지 않는다', () => {
    input = new InputController(document.createElement('canvas'))
    for (const code of ['Space', 'ShiftLeft']) {
      const event = new KeyboardEvent('keydown', { code, cancelable: true })
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
  })
})

describe('기본 조작', () => {
  const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
  const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
  const mapWorld = () => createWorld({ seed: 2, modes: ['map'], players: ['a', 'b'].map((id) => ({ id, loadout: loadout(id), local: true })) })
  let input
  afterEach(() => input?.detach())

  it('기본 조작은 둘러보기, 지도 앱만 위에서', () => {
    input = new InputController(document.createElement('canvas'))
    const world = mapWorld()
    const me = world.players[0]
    world.time = 1
    input.commands(world, me)
    expect(input.look.active).toBe(true)
    world.time = world.schedule.dives[0].t + DIVE.zoom
    input.commands(world, me)
    expect(input.look.active).toBe(false)
  })

  it('지도 앱에서 나오면 조준 방향을 이어 본다', () => {
    input = new InputController(document.createElement('canvas'))
    const world = mapWorld()
    const me = world.players[0]
    world.time = world.schedule.dives[0].t + DIVE.zoom
    input.commands(world, me)
    me.aim = 1.1
    world.time = world.schedule.dives[0].end + 0.1
    input.commands(world, me)
    expect(input.look.active).toBe(true)
    expect(input.look.yaw).toBeCloseTo(1.1)
  })
})
