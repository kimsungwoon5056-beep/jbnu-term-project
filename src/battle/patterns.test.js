import { describe, expect, it } from 'vitest'
import { Subject } from '../lib/subject'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { MatchLoop } from './loop'
import { Countdown, Over, Playing, STEP } from './phases'
import { STORM } from './schedule'
import { soundBoard } from './sound'
import { applyDamage, createWorld, stepWorld } from './world'

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
    super({ input: { commands: () => [], detach() {} }, meId: 'a', ...rest })
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

describe('Observer: 대결 신호(world.signals)를 구독자가 각자 받는다', () => {
  it('Subject: 구독한 모두에게 알리고, 해지하면 더 받지 않으며, 알리는 도중 해지해도 안전하다', () => {
    const subject = new Subject()
    const got = { a: [], b: [] }
    const offA = subject.subscribe((s) => got.a.push(s))
    let offB = null
    offB = subject.subscribe((s) => {
      got.b.push(s)
      offB() // 알림을 받는 중에 스스로 해지
    })
    subject.notify(1)
    subject.notify(2)
    offA()
    subject.notify(3)
    expect(got).toEqual({ a: [1, 2], b: [1] })
    expect(subject.size).toBe(0)
  })

  it('맞으면 world가 누구에게 생긴 일인지 담아 hit 신호를 보낸다(그리기·소리가 같은 신호를 받음)', () => {
    const world = duelWorld()
    const first = []
    const second = []
    world.signals.subscribe((s) => first.push(s))
    world.signals.subscribe((s) => second.push(s.kind))
    applyDamage(world, world.players[1], 8)
    expect(first.at(-1)).toMatchObject({ kind: 'hit', who: 'b', text: '-8' })
    expect(second).toEqual(['hit'])
  })

  it('알림 폭풍 경고는 경고가 시작될 때 한 번만 알린다', () => {
    const world = createWorld({ players: [{ id: 'a', loadout: loadout('나'), local: true }], seed: 5 })
    world.items.forEach((item) => (item.taken = true))
    const storms = []
    world.signals.subscribe((s) => s.kind === 'storm' && storms.push(world.time))
    world.time = STORM.starts[0] - 0.5
    for (let i = 0; i < 60 * 3; i += 1) stepWorld(world, {}, 1 / 60)
    expect(storms).toHaveLength(1)
    expect(storms[0]).toBeGreaterThanOrEqual(STORM.starts[0])
  })

  it('카운트다운 단계는 3·2·1마다 tick, 진행으로 바뀔 때 go를 알린다', () => {
    const world = duelWorld()
    const kinds = []
    world.signals.subscribe((s) => kinds.push(s.kind === 'tick' ? `tick${s.count}` : s.kind))
    const loop = new TestLoop({ world, renderer: recorder(), countdownLeft: 3 })
    loop.last = 0
    for (const left of [3, 2.5, 2, 1, 0]) {
      loop.countdownLeft = left
      loop.frame(loop.last + 100)
    }
    expect(kinds).toEqual(['tick3', 'tick2', 'tick1', 'go'])
  })

  it('효과음 보드는 내 발사만 소리 내고, 내가 맞으면 다른 소리를 낸다', () => {
    // 소리는 브라우저에서만 나므로, 어떤 소리를 고르는지만 확인한다.
    const played = []
    const board = soundBoard('a', (name) => played.push(name))
    for (const signal of [
      { kind: 'shot', who: 'a' },
      { kind: 'shot', who: 'b' },
      { kind: 'hit', who: 'a' },
      { kind: 'hit', who: 'b' },
      { kind: 'item', who: 'b' },
      { kind: 'storm', who: null },
    ])
      board(signal)
    expect(played).toEqual(['shot', 'hurt', 'hit', 'pick', 'storm'])
  })

  it('렌더러는 루프가 멈추면 구독을 끊는다', () => {
    const world = duelWorld()
    const renderer = { disposed: 0, dispose() { this.disposed += 1 }, draw() {} }
    const loop = new TestLoop({ world, renderer })
    loop.stop()
    expect(renderer.disposed).toBe(1)
  })
})

