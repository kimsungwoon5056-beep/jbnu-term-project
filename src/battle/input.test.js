// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { InputController } from './input'
import { COMMANDS } from './world'

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
