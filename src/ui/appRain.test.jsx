// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_LOOK_KEYS } from '../character/appLook'
import { drawCharacter } from '../character/drawCharacter'
import { DEFAULT_LOOK } from '../profile/look'
import AppRain from './AppRain.jsx'
import {
  burst,
  characterBoxes,
  characterScale,
  clampSpeed,
  createSpawner,
  fixedSteps,
  FLUSH_EVERY,
  FLUSH_OPEN,
  flushState,
  gestureOf,
  iconAt,
  landStrength,
  MAX_ICONS,
  MAX_STEPS,
  phrase,
  pileIcons,
  SIZES,
  SPAWN_EVERY,
  spriteSignature,
  stackPile,
  STEP,
  stepParticle,
  stepSpawner,
  THROW_MAX,
  throwVelocity,
} from './rainLogic'

const MARKS = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const makeSprite = (marks = {}) => drawCharacter(DEFAULT_LOOK, { tier: 'good', grafts: [], marks: { ...MARKS, ...marks }, scene: 'home' })

describe('앱 비: 떨어뜨리기', () => {
  const run = (seed, seconds, count = 0) => {
    const spawner = createSpawner(seed)
    const list = []
    for (let i = 0; i < seconds * 60; i += 1) {
      const icon = stepSpawner(spawner, STEP, { count, width: 320 })
      if (icon) list.push(icon)
    }
    return list
  }

  it('0.45초쯤마다 하나씩, 화면 폭 안에서 위쪽에 생긴다', () => {
    const list = run(1, 9)
    expect(Math.abs(list.length - 9 / SPAWN_EVERY)).toBeLessThanOrEqual(1)
    for (const icon of list) {
      expect(APP_LOOK_KEYS).toContain(icon.kind)
      expect(SIZES).toContain(icon.size)
      expect(icon.x).toBeGreaterThanOrEqual(icon.size / 2)
      expect(icon.x).toBeLessThanOrEqual(320 - icon.size / 2)
      expect(icon.y).toBeLessThan(0)
    }
  })

  it('같은 씨앗이면 같은 순서, 최근 네 개와는 다른 앱', () => {
    const list = run(5, 20)
    expect(run(5, 20)).toEqual(list)
    list.forEach((icon, i) => expect(list.slice(Math.max(0, i - 4), i).map((item) => item.kind)).not.toContain(icon.kind))
    expect(list.some((icon) => icon.badge > 0)).toBe(true)
    expect(list.some((icon) => icon.badge === 0)).toBe(true)
  })

  it('가득 차거나 바닥이 열려 있으면 떨어뜨리지 않는다', () => {
    expect(run(1, 5, MAX_ICONS)).toEqual([])
    expect(stepSpawner(createSpawner(1), 10, { count: 0, width: 320, paused: true })).toBeNull()
  })
})

describe('앱 비: 바닥 비우기와 시간', () => {
  it('10초마다 경고 → 열림 → 닫힘', () => {
    expect(flushState(0)).toMatchObject({ open: 0, active: false, warn: false })
    expect(flushState(FLUSH_EVERY - 0.5)).toMatchObject({ open: 0, warn: true })
    expect(flushState(FLUSH_EVERY + FLUSH_OPEN / 2)).toMatchObject({ open: 1, active: true, closing: false })
    const end = flushState(FLUSH_EVERY + FLUSH_OPEN - 0.1)
    expect(end.closing).toBe(true)
    expect(end.open).toBeLessThan(1)
    expect(flushState(FLUSH_EVERY + FLUSH_OPEN + 0.1)).toMatchObject({ open: 0, active: false })
  })

  it('고정 간격으로 나누고, 밀린 시간은 최대 3번만 따라잡는다', () => {
    expect(fixedSteps(0, STEP).steps).toBe(1)
    const half = fixedSteps(0, STEP / 2)
    expect(half.steps).toBe(0)
    expect(fixedSteps(half.acc, STEP / 2).steps).toBe(1)
    expect(fixedSteps(0, 5)).toEqual({ steps: MAX_STEPS, acc: 0 })
  })
})

describe('앱 비: 누르기와 던지기', () => {
  it('조금 움직이고 짧게 누르면 지우기, 아니면 끌기', () => {
    expect(gestureOf(5, 249)).toBe('tap')
    expect(gestureOf(6, 100)).toBe('drag')
    expect(gestureOf(0, 250)).toBe('drag')
  })

  it('던지는 속도에 한계가 있고, 멈췄다 놓으면 0', () => {
    const fast = throwVelocity([{ x: 0, y: 0, t: 0 }, { x: 900, y: 0, t: 40 }], 45)
    expect(Math.hypot(fast.x, fast.y)).toBeCloseTo(THROW_MAX)
    expect(throwVelocity([{ x: 0, y: 0, t: 0 }, { x: 90, y: 0, t: 40 }], 400)).toEqual({ x: 0, y: 0 })
    const slow = throwVelocity([{ x: 0, y: 0, t: 0 }, { x: 30, y: 0, t: 50 }], 50)
    expect(slow.x).toBeCloseTo(10)
    expect(clampSpeed(3, 4, 10)).toEqual({ x: 3, y: 4 })
    expect(clampSpeed(NaN, 0, 10)).toEqual({ x: 0, y: 0 })
  })

  it('돌아간 아이콘도 모양대로, 겹치면 위의 것을 고른다', () => {
    const icons = [
      { x: 50, y: 50, size: 30, angle: 0 },
      { x: 60, y: 50, size: 30, angle: Math.PI / 4 },
    ]
    expect(iconAt(icons, 55, 50)).toBe(icons[1])
    expect(iconAt(icons, 36, 36)).toBe(icons[0])
    expect(iconAt(icons, 79, 50)).toBe(icons[1]) // 돌아간 모서리
    expect(iconAt(icons, 30, 50)).toBeNull()
    expect(iconAt(icons, 30, 50, 8)).toBe(icons[0])
  })

  it('소리 세기는 0~1', () => {
    expect(landStrength(1)).toBe(0)
    expect(landStrength(9)).toBeCloseTo(0.5)
    expect(landStrength(99)).toBe(1)
  })
})

describe('앱 비: 문구와 파편', () => {
  it('지운 개수에 따라 문구가 바뀐다', () => {
    expect(phrase(0)).toBe('앱을 눌러 지워 보세요')
    expect(phrase(3)).toBe('3개 삭제 · 조금 가벼워졌어요')
    const tails = [1, 10, 25, 50].map((count) => phrase(count).split(' · ')[1])
    expect(new Set(tails).size).toBe(4)
  })

  it('파편은 떨어지다가 사라진다', () => {
    const bits = burst(10, 20, ['#fff', '#000'], 6, 100, () => 0.5)
    expect(bits).toHaveLength(6)
    const [bit] = bits
    const vy = bit.vy
    expect(stepParticle(bit, STEP)).toBe(true)
    expect(bit.vy).toBeGreaterThan(vy)
    expect(stepParticle(bit, 5)).toBe(false)
  })
})

describe('앱 비: 캐릭터와 멈춘 더미', () => {
  it('머리와 몸통 상자는 배지가 붙어도 거의 그대로', () => {
    const plain = characterBoxes(makeSprite().layers.body)
    const badged = characterBoxes(makeSprite({ badges: 3 }).layers.body)
    expect(plain.head.w).toBeGreaterThan(plain.torso.w * 0.8)
    expect(plain.head.y + plain.head.h).toBe(plain.torso.y)
    expect(Math.abs(plain.head.w - badged.head.w)).toBeLessThanOrEqual(4)
    expect(Math.abs(plain.head.x - badged.head.x)).toBeLessThanOrEqual(3)
    expect(characterScale(plain.bounds, 360, 236)).toBeGreaterThanOrEqual(3)
    expect(characterScale(plain.bounds, 30, 40)).toBe(1)
  })

  it('다시 그린 같은 그림은 같은 표시, 다른 그림은 다른 표시', () => {
    expect(spriteSignature(makeSprite())).toBe(spriteSignature(makeSprite()))
    expect(spriteSignature(makeSprite())).not.toBe(spriteSignature(makeSprite({ spiral: true })))
    expect(spriteSignature(null)).toBe('')
  })

  it('더미는 바닥 위에 서로 겹치지 않게 쌓인다', () => {
    const block = { x: 130, y: 100, w: 60, h: 136 }
    const pile = stackPile(pileIcons(22, 7), 320, 236, [block])
    expect(pile).toHaveLength(22)
    pile.forEach((a, i) => {
      expect(a.x - a.size / 2).toBeGreaterThanOrEqual(0)
      expect(a.x + a.size / 2).toBeLessThanOrEqual(320)
      expect(a.y + a.size / 2).toBeLessThanOrEqual(236)
      const apart = (b) => Math.abs(a.x - b.x) >= (a.size + b.size) / 2 - 0.01 || Math.abs(a.y - b.y) >= (a.size + b.size) / 2 - 0.01
      expect(pile.slice(0, i).every(apart)).toBe(true)
    })
  })
})

// 그리기 호출을 모두 받아 주는 가짜 2D 문맥(옮긴 자리를 기억해 아이콘 위치를 알 수 있다)
function fakeContext() {
  const seen = { images: 0, moves: [] }
  const ctx = new Proxy(
    {},
    {
      get: (target, key) => {
        if (key in target) return target[key]
        return (...args) => {
          if (key === 'drawImage') seen.images += 1
          if (key === 'translate') seen.moves.push(args)
        }
      },
      set: (target, key, value) => {
        target[key] = value
        return true
      },
    },
  )
  return { ctx, seen }
}

describe('앱 비: 화면', () => {
  let frames
  let now

  beforeEach(() => {
    frames = new Map()
    now = 1000
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      id += 1
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (key) => frames.delete(key))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const play = (count) => {
    for (let i = 0; i < count; i += 1) {
      now += 1000 / 60
      const queue = [...frames.values()]
      frames.clear()
      for (const callback of queue) callback(now)
    }
  }
  const stubContext = () => {
    const { ctx, seen } = fakeContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    return seen
  }
  const loaded = () => vi.waitFor(() => expect(frames.size).toBeGreaterThan(0))
  const pointer = (canvas, type, x, y) => fireEvent(canvas, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }), { pointerId: 1, pointerType: 'touch' }))

  it('캔버스를 못 쓰는 환경에서도 내용과 문구는 보인다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { container, unmount } = render(
      <AppRain label="앱 비" className="login">
        <button type="button">시작</button>
      </AppRain>,
    )
    expect(screen.getByRole('button', { name: '시작' }).closest('.app-rain-overlay')).not.toBeNull()
    expect(container.querySelector('canvas').getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('[aria-live="polite"]').textContent).toBe('앱을 눌러 지워 보세요')
    expect(screen.getByRole('group', { name: '앱 비' }).className).toBe('app-rain login')
    expect(() => unmount()).not.toThrow()
  })

  it('누를 수 없는 장면에는 문구가 없다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { container } = render(<AppRain interactive={false} />)
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it('StrictMode에서 하나만 돌고, 떨어지고, 지우고, 나가면 멈춘다', async () => {
    const seen = stubContext()
    const onPop = vi.fn()
    const onLand = vi.fn()
    const { container, rerender, unmount } = render(
      <StrictMode>
        <AppRain sprite={makeSprite()} onPop={onPop} onLand={onLand} />
      </StrictMode>,
    )
    await loaded()
    play(1)
    expect(frames.size).toBe(1)
    play(240)
    expect(seen.images).toBeGreaterThan(500)
    expect(onLand).toHaveBeenCalled()
    for (const [strength] of onLand.mock.calls) expect(strength).toBeGreaterThanOrEqual(0)

    // 같은 그림으로 다시 그려도 장면이 이어진다.
    rerender(
      <StrictMode>
        <AppRain sprite={makeSprite()} onPop={onPop} onLand={onLand} />
      </StrictMode>,
    )
    expect(frames.size).toBe(1)

    // 화면을 훑으며 누르면 어느 아이콘이든 지워진다.
    const canvas = container.querySelector('canvas')
    for (let y = 230; y > 60 && onPop.mock.calls.length === 0; y -= 10) {
      for (let x = 10; x < 310 && onPop.mock.calls.length === 0; x += 10) {
        act(() => {
          pointer(canvas, 'pointerdown', x, y)
          pointer(canvas, 'pointerup', x, y)
        })
      }
    }
    expect(onPop).toHaveBeenCalledWith(1)
    expect(container.querySelector('.app-rain-phrase').textContent).toBe(phrase(1))

    // 바닥이 열렸다 닫히는 동안에도 문제없이 돈다.
    play(900)
    unmount()
    expect(frames.size).toBe(0)
  })

  it('탭이 숨으면 쉬고, 다시 보이면 이어 간다', async () => {
    stubContext()
    render(<AppRain />)
    await loaded()
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(0)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(1)
  })

  it('아이콘에서 시작한 손가락만 화면 넘기기를 막는다', async () => {
    const seen = stubContext()
    const { container } = render(<AppRain />)
    await loaded()
    play(120)
    seen.moves.length = 0
    play(1)
    const [x, y] = seen.moves[seen.moves.length - 1]
    const canvas = container.querySelector('canvas')
    const touch = (clientX, clientY) => {
      const event = Object.assign(new Event('touchstart', { bubbles: true, cancelable: true }), { changedTouches: [{ clientX, clientY }] })
      canvas.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(touch(x, y)).toBe(true)
    expect(touch(-100, -100)).toBe(false)
  })

  it('움직임 줄이기면 움직이지 않고 더미만, 그래도 지울 수 있다', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const seen = stubContext()
    const onPop = vi.fn()
    const { container } = render(<AppRain sprite={makeSprite()} onPop={onPop} />)
    expect(frames.size).toBe(0)
    expect(seen.images).toBeGreaterThan(40)
    const spot = stackPile(pileIcons(22, 7), 320, 236, [])[0]
    const canvas = container.querySelector('canvas')
    act(() => {
      pointer(canvas, 'pointerdown', spot.x, spot.y)
      pointer(canvas, 'pointerup', spot.x, spot.y)
    })
    expect(onPop).toHaveBeenCalledWith(1)
  })
})
