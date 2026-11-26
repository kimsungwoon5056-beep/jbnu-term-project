// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { BOT_CAST } from './botCast'
import { buildLoadout } from './loadout'
import { PracticeLoop } from './loop'
import { createWorld } from './world'

// 다른 탭으로 가 화면이 숨겨지면 연습 판은 멈춘다(점검 7회차).
// 온라인은 숨긴 탭에서도 1초에 몇 번 상태를 보내야 하지만, 연습은 보낼 곳이 없고 자리를 비운 사이 봇에게 맞기만 한다.
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })

describe('숨긴 탭의 연습 판', () => {
  let hidden = true
  afterEach(() => {
    vi.useRealTimers()
    delete document.hidden
  })

  it('숨겨져 있는 동안은 판이 흐르지 않고, 돌아오면 이어서 흐른다', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] })
    globalThis.requestAnimationFrame = () => 1 // 숨긴 탭: 화면 그리기 신호가 오지 않는다
    globalThis.cancelAnimationFrame = () => {}
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    const world = createWorld({ seed: 5, events: false, players: [{ id: 'me', loadout: loadout('나'), local: true }, ...BOT_CAST.slice(0, 3).map((bot, i) => ({ id: `bot${i}`, loadout: bot, local: true, bot: true }))] })
    const input = { commands: () => [], idle() {}, clearTaps() {}, detach() {} }
    const loop = new PracticeLoop({ world, renderer: { draw() {} }, input, meId: 'me', onEnd() {} })
    hidden = false
    loop.start()
    vi.advanceTimersByTime(3500) // 카운트다운이 끝나고 판이 시작
    const t = world.time
    expect(t).toBeGreaterThan(0)
    hidden = true
    vi.advanceTimersByTime(30000)
    expect(world.time - t).toBeLessThan(0.2)
    hidden = false
    vi.advanceTimersByTime(1000)
    expect(world.time - t).toBeGreaterThan(0.5)
    expect(world.time - t).toBeLessThan(1.5) // 숨어 있던 30초를 한꺼번에 따라잡지 않는다
    loop.stop()
  })
})
