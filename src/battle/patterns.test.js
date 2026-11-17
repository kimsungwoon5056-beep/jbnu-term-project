import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { MatchLoop } from './loop'
import { Countdown, Over, Playing, STEP } from './phases'
import { createWorld } from './world'

// 디자인 패턴의 협력 관계를 확인하는 테스트(보고서 3장 근거)

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) =>
  buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const duelWorld = () =>
  createWorld({
    events: false,
    players: [
      { id: 'a', loadout: loadout('나'), local: true },
      { id: 'b', loadout: loadout('상대'), local: true },
    ],
  })

// 화면 없이 도는 루프: 다음 프레임 예약 대신 직접 frame(now)을 부른다.
class TestLoop extends MatchLoop {
  constructor({ countdownLeft = 0, ...rest }) {
    super({ input: { commands: () => [] }, meId: 'a', ...rest })
    this.countdownLeft = countdownLeft
    this.scheduled = 0
    this.finished = 0
  }
  schedule() {
    this.scheduled += 1
  }
  unschedule() {}
  countdown() {
    return this.countdownLeft
  }
  finish() {
    this.finished += 1
  }
}

const recorder = () => {
  const draws = []
  return { draws, draw: (world, options) => draws.push(options.countdown) }
}

describe('State: 한 판의 단계(카운트다운 → 진행 → 끝)', () => {
  it('카운트다운 중에는 세계가 움직이지 않고 남은 초만 그린다', () => {
    const world = duelWorld()
    const renderer = recorder()
    const loop = new TestLoop({ world, renderer, countdownLeft: 2.5 })
    loop.last = 0
    loop.frame(500)
    expect(loop.phase).toBe(Countdown)
    expect(world.time).toBe(0)
    expect(renderer.draws).toEqual([2.5])
  })

  it('카운트다운이 끝나면 진행 단계로 바뀌고, 진행 단계는 고정 걸음으로 세계를 움직인다', () => {
    const world = duelWorld()
    const loop = new TestLoop({ world, renderer: recorder(), countdownLeft: 1 })
    loop.last = 0
    loop.frame(100)
    loop.countdownLeft = 0
    loop.frame(200)
    expect(loop.phase).toBe(Playing)
    expect(loop.acc).toBe(0) // 진행에 들어가는 순간 쌓인 시간은 버린다.
    loop.frame(200 + 1000 * STEP * 3)
    expect(world.time).toBeCloseTo(STEP * 3, 5)
  })

  it('판이 끝나면 끝 단계로 바뀌고, 결과는 한 번만 알리며 다음 프레임을 예약하지 않는다', () => {
    const world = duelWorld()
    const ends = []
    const loop = new TestLoop({ world, renderer: recorder(), onEnd: (ranking) => ends.push(ranking.map((p) => p.id)) })
    loop.last = 0
    loop.setPhase(Playing)
    world.players[1].alive = false
    world.players[1].hp = 0
    const before = loop.scheduled
    loop.frame(1000 * STEP * 2)
    expect(loop.phase).toBe(Over)
    expect(ends).toEqual([['a', 'b']])
    expect(loop.finished).toBe(1)
    expect(loop.scheduled).toBe(before)
    loop.frame(5000)
    expect(ends).toHaveLength(1)
  })

  it('단계 객체는 같은 인터페이스(name·frame)를 가진다', () => {
    for (const phase of [Countdown, Playing, Over]) {
      expect(typeof phase.name).toBe('string')
      expect(typeof phase.frame).toBe('function')
    }
    expect(Over.done).toBe(true)
  })
})
