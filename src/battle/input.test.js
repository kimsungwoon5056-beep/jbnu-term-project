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

// 휴대폰: 왼손 스틱으로 움직이면서 오른손 하나로 둘러보고 쏠 수 있어야 한다.
describe('휴대폰 조작', () => {
  const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
  const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
  const duel = () => createWorld({ seed: 2, events: false, players: ['a', 'b'].map((id) => ({ id, loadout: loadout(id), local: true })) })
  const aimOf = (list) => list.find((command) => command.type === 'aim').a
  const moveOf = (list) => list.find((command) => command.type === 'move')
  let input
  afterEach(() => input?.detach())

  it('스틱을 살짝 건드린 것은 움직임으로 치지 않는다', () => {
    input = new InputController(document.createElement('canvas'))
    const world = duel()
    const me = world.players[0]
    input.setStick(0.1, -0.05)
    const still = moveOf(input.commands(world, me))
    expect(Math.hypot(still.x, still.y)).toBe(0)
    input.setStick(0, -1)
    const full = moveOf(input.commands(world, me))
    expect(Math.hypot(full.x, full.y)).toBeCloseTo(1)
  })

  it('공격 버튼을 누른 채 밀면 쏘면서 둘러본다', () => {
    input = new InputController(document.createElement('canvas'))
    const world = duel()
    const me = world.players[0]
    input.commands(world, me)
    const before = input.look.yaw
    input.setFire(true)
    input.lookStart(7, 300)
    input.lookMove(7, 340)
    const list = input.commands(world, me)
    expect(list.some((command) => command.type === 'fire')).toBe(true)
    expect(aimOf(list)).toBeGreaterThan(before + 0.3)
  })

  it('손가락으로 둘러보는 중에는 자동 조준이 끌어당기지 않는다', () => {
    input = new InputController(document.createElement('canvas'))
    const world = duel()
    const me = world.players[0]
    input.commands(world, me)
    input.setFire(true)
    input.lookStart(7, 300)
    input.lookMove(7, 420) // 상대에게서 멀리 돌린다
    const turned = aimOf(input.commands(world, me))
    for (let i = 0; i < 30; i += 1) input.commands(world, me)
    expect(input.look.yaw).toBeCloseTo(turned)
  })

  it('누르고만 있으면 가까운 상대 쪽으로 조준을 돕는다', () => {
    input = new InputController(document.createElement('canvas'))
    const world = duel()
    const me = world.players[0]
    input.commands(world, me)
    input.look.yaw += 1.2 // 상대에게서 돌아서 있다
    const away = input.look.yaw
    input.setFire(true)
    input.lookStart(7, 300)
    for (let i = 0; i < 30; i += 1) input.commands(world, me)
    expect(Math.abs(input.look.yaw - away)).toBeGreaterThan(0.5)
  })

  it('두 손가락이 각자 둘러봐도 서로의 자리를 섞지 않고, 뗀 손가락은 잊는다', () => {
    input = new InputController(document.createElement('canvas'))
    const world = duel()
    const me = world.players[0]
    input.commands(world, me)
    const before = input.look.yaw
    input.lookStart(1, 100)
    input.lookStart(2, 600)
    input.lookMove(2, 610)
    input.lookMove(1, 110)
    input.commands(world, me)
    expect(input.look.yaw - before).toBeCloseTo(20 * 0.011, 2)
    input.lookEnd(1)
    input.lookEnd(2)
    input.lookMove(1, 400)
    input.commands(world, me)
    expect(input.look.yaw - before).toBeCloseTo(20 * 0.011, 2)
  })

  it('화면을 손가락으로 밀어도 둘러본다', () => {
    const canvas = document.createElement('canvas')
    input = new InputController(canvas)
    const world = duel()
    const me = world.players[0]
    input.commands(world, me)
    const before = input.look.yaw
    const fire = (type, x) => canvas.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerType: 'touch', pointerId: 3, clientX: x }))
    fire('pointerdown', 100)
    fire('pointermove', 150)
    input.commands(world, me)
    expect(input.look.yaw).toBeGreaterThan(before + 0.3)
  })

  it('쓰러져 있는 동안에도 공격 버튼을 누르고 있으면 다시 시작한 뒤 바로 쏜다', () => {
    input = new InputController(document.createElement('canvas'))
    const world = duel()
    const me = world.players[0]
    input.setFire(true)
    input.lookStart(7, 300)
    for (let i = 0; i < 30; i += 1) input.idle() // 쓰러진 동안 매 장면
    expect(input.commands(world, me).some((command) => command.type === 'fire')).toBe(true)
  })

  it('다른 창으로 가면 쥐고 있던 손가락을 모두 잊는다', () => {
    input = new InputController(document.createElement('canvas'))
    input.setFire(true)
    input.lookStart(7, 300)
    window.dispatchEvent(new Event('blur'))
    expect(input.holdFire).toBe(false)
    expect(input.drags.size).toBe(0)
  })
})
