import { describe, expect, it } from 'vitest'
import { Subject } from '../lib/subject'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from './loadout'
import { FirebaseRoomChannel, linkWorld, MemoryRoom } from './channel'
import { MatchLoop, OnlineLoop } from './loop'
import { Countdown, Over, Playing, Settling, STEP } from './phases'
import { seedOf, STORM } from './schedule'
import { soundBoard } from './sound'
import { CREATORS, creatorOf, expandEvent } from './skills'
import { kiter } from './bot'
import { FirstPersonView } from './firstPerson/FirstPersonView'
import { Renderer } from './renderer'
import { TopView } from './topView'
import { applyDamage, commandOf, createWorld, spawnEvent, stepWorld } from './world'

// 디자인 패턴의 협력 관계를 확인하는 테스트(보고서 3장 근거)

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) =>
  buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
const duelWorld = () =>
  createWorld({
    events: false,
    damageScale: 1, // 기본 피해 규칙을 본다(인원별 배율은 lives.test.js)
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

describe('Template Method: 루프 뼈대(frame)는 그대로, 하위 루프는 훅만 바꾼다', () => {
  it('훅(paused·collectCommands·afterStep)만 바꾼 하위 루프도 뼈대가 정한 순서로 돈다', () => {
    const calls = []
    class HookLoop extends TestLoop {
      paused() {
        calls.push('paused')
        return false
      }
      collectCommands() {
        calls.push('collect')
        return {}
      }
      afterStep() {
        calls.push('after')
        this.world.outbox = []
      }
    }
    const loop = new HookLoop({ world: duelWorld(), renderer: { draw: () => calls.push('draw') } })
    loop.last = 0
    loop.setPhase(Playing)
    calls.length = 0
    loop.frame(STEP * 1000 + 0.01)
    expect(calls).toEqual(['paused', 'collect', 'after', 'draw'])
  })

  it('paused 훅이 참이면 뼈대가 세계를 멈추고 다음 프레임만 예약한다(연습의 숨긴 탭)', () => {
    class PausedLoop extends TestLoop {
      paused() {
        return true
      }
    }
    const world = duelWorld()
    const loop = new PausedLoop({ world, renderer: recorder() })
    loop.last = 0
    loop.setPhase(Playing)
    loop.frame(1000)
    expect(world.time).toBe(0)
    expect(loop.scheduled).toBe(1)
    expect(loop.last).toBe(1000) // 돌아오면 멈춘 시간을 한꺼번에 흘리지 않는다
  })
})

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
    Object.assign(world.players[1], { alive: false, lives: 0 })
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

  it('온라인은 끝나기 전에 정리 단계를 거쳐, 마지막 상태를 보내고 기다린 뒤 결과를 한 번 알린다', () => {
    const world = duelWorld()
    const ends = []
    const loop = new TestLoop({ world, renderer: recorder(), onEnd: () => ends.push(1) })
    loop.settleTime = () => 0.5
    loop.last = 0
    loop.setPhase(Playing)
    Object.assign(world.players[1], { alive: false, lives: 0 })
    loop.frame(1000 * STEP * 2)
    expect(loop.phase).toBe(Settling)
    expect([loop.finished, ends.length]).toEqual([1, 0])
    const frozen = world.time
    loop.frame(loop.last + 300)
    expect(loop.phase).toBe(Settling)
    loop.frame(loop.last + 300)
    expect(loop.phase).toBe(Over)
    expect([loop.finished, ends.length, world.time]).toEqual([1, 1, frozen])
  })

  it('단계 객체는 같은 인터페이스(name·frame)를 가진다', () => {
    for (const phase of [Countdown, Playing, Settling, Over]) {
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

  it('효과음 보드는 내 공격만 소리 내고, 내가 맞으면 다른 소리를 낸다', () => {
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
    expect(played).toEqual(['swing', 'hurt', 'hit', 'pick', 'storm'])
  })

  it('렌더러는 루프가 멈추면 구독을 끊는다', () => {
    const world = duelWorld()
    const renderer = { disposed: 0, dispose() { this.disposed += 1 }, draw() {} }
    const loop = new TestLoop({ world, renderer })
    loop.stop()
    expect(renderer.disposed).toBe(1)
  })
})

describe('Adapter: 대결 통신 창구(RoomChannel)', () => {
  // 두 화면: A 화면에서는 a가 내 캐릭터, B 화면에서는 b가 내 캐릭터. 씨앗은 온라인과 같은 방식(방 코드 + 방을 만든 시각)
  const seed = seedOf('TEST', 1700000000000)
  const screen = (me) =>
    createWorld({
      seed,
      mode: 'online',
      players: [
        { id: 'a', loadout: loadout('A'), local: me === 'a' },
        { id: 'b', loadout: loadout('B'), local: me === 'b' },
      ],
    })
  const connect = () => {
    const room = new MemoryRoom()
    const channels = { a: room.join('a'), b: room.join('b') }
    const worlds = { a: screen('a'), b: screen('b') }
    linkWorld(worlds.a, channels.a, 'a')
    linkWorld(worlds.b, channels.b, 'b')
    // 온라인 루프의 "걸음 뒤 할 일"(내 이벤트·상태 보내기)만 쓴다. 화면·입력은 필요 없다.
    const loops = Object.fromEntries(
      ['a', 'b'].map((id) => [id, new OnlineLoop({ world: worlds[id], renderer: { draw() {} }, input: { commands: () => [] }, meId: id, channel: channels[id], startAt: 0 })]),
    )
    const step = (id, commands = {}) => {
      stepWorld(worlds[id], commands, 1 / 60)
      loops[id].afterStep(1 / 60)
    }
    return { room, channels, worlds, step }
  }

  it('A가 휘두른 공격은 B 화면에도 같은 휘두르기로 생긴다', () => {
    const { worlds, step } = connect()
    Object.assign(worlds.a.players[0], { x: 100, y: 80, aim: 0 })
    step('a', { a: [{ type: 'fire' }] })
    const onB = worlds.b.swings.find((swing) => swing.owner === 'a')
    const onA = worlds.a.swings.find((swing) => swing.owner === 'a')
    expect(onB).toBeDefined()
    expect([onB.a, onB.move, onB.c]).toEqual([onA.a, onA.move, onA.c])
  })

  it('A가 아이템을 주우면 B 화면에서도 사라지고, A의 회복한 체력이 B 화면에 보인다', () => {
    const { worlds, step } = connect()
    const [a] = worlds.a.players
    expect(worlds.a.items.map((i) => [i.x, i.y])).toEqual(worlds.b.items.map((i) => [i.x, i.y])) // 같은 씨앗 → 같은 일정
    const item = worlds.a.items[0]
    item.kind = worlds.b.items[0].kind = 'charger'
    worlds.a.time = worlds.b.time = item.t
    a.hp = 40
    Object.assign(a, { x: item.x, y: item.y })
    step('a')
    expect(worlds.b.items[0].taken).toBe(true)
    expect(worlds.b.players[0].hp).toBe(55)
  })

  it('방에서 나간 사람은 다른 화면에서 쓰러진 것으로 보인다', () => {
    const { channels, worlds } = connect()
    channels.b.close()
    expect(worlds.a.players[1].alive).toBe(false)
  })

  it('FirebaseRoomChannel은 RoomChannel 호출을 net.js 함수(방 코드·uid 포함)로 옮기고, 받은 방 데이터를 상태 묶음으로 바꾼다', () => {
    const calls = []
    let roomListener = null
    let unsubscribed = 0
    const fakeNet = {
      watchServerOffset: (fn) => {
        fn(5000)
        return () => (unsubscribed += 1)
      },
      sendState: (...args) => calls.push(['sendState', ...args]),
      sendEvent: (...args) => calls.push(['sendEvent', ...args]),
      watchEvents: (code, uid) => {
        calls.push(['watchEvents', code, uid])
        return () => (unsubscribed += 1)
      },
      watchRoom: (code, fn) => {
        roomListener = fn
        return () => (unsubscribed += 1)
      },
    }
    const channel = new FirebaseRoomChannel('ABCD', 'me', fakeNet)
    expect(channel.now() - Date.now()).toBeGreaterThanOrEqual(4990)
    channel.sendState({ x: 1 })
    channel.sendEvent({ k: 'shot' })
    channel.onEvent(() => {})
    const peers = []
    channel.onPeers((p) => peers.push(p))
    roomListener({ meta: {}, players: { me: { name: '나', loadout: {}, s: { x: 1 } }, you: { name: '너', loadout: {} }, left: { s: { x: 9 } } } })
    // 보낼 때 서버 기준 내 시각(t)을 붙인다.
    expect(calls.map(([name, ...args]) => [name, ...args.map((arg) => (typeof arg === 'object' ? Object.keys(arg).sort() : arg))])).toEqual([
      ['sendState', 'ABCD', 'me', ['t', 'x']],
      ['sendEvent', 'ABCD', ['k', 't']],
      ['watchEvents', 'ABCD', 'me'],
    ])
    expect(calls[0][3].t - Date.now()).toBeGreaterThanOrEqual(4990)
    expect(peers).toEqual([{ me: { x: 1 }, you: null }])
    channel.close()
    expect(unsubscribed).toBe(3)
  })
})


describe('Factory Method: 시전 이벤트 → 생산자(CREATORS) → 제품', () => {
  const at = (ev) => ({ o: 'a', x: 100, y: 200, a: 0, m: 1, ...ev })
  const EVENTS = [
    at({ k: 'shot', s: 'detox', c: 0 }), // 기본 공격 → Swing
    at({ k: 'skill', s: 'detox', g: 1 }), // 막기 → Guard
    at({ k: 'skill', s: 'detox', g: 2, p: 'b' }), // 패링 → Parried
    at({ k: 'skill', s: 'finance', c: 1 }), // 손절 반격 → Swing
    at({ k: 'skill', s: 'feed', e: 1 }), // E 원거리 → Projectile 등
    at({ k: 'skill', s: 'feed' }), // Q 근접 기술 → 기술마다 다른 제품
  ]

  it('이벤트 종류마다 정확히 하나의 생산자가 맡고, 만든 제품은 모두 place(world)를 가진다', () => {
    for (const ev of EVENTS) {
      expect(creatorOf(ev), JSON.stringify(ev)).toBeTruthy()
      const products = expandEvent(ev)
      expect(products.length, JSON.stringify(ev)).toBeGreaterThan(0)
      for (const product of products) expect(typeof product.place).toBe('function')
    }
    expect(new Set(EVENTS.map((ev) => creatorOf(ev).name)).size).toBe(EVENTS.length)
  })

  it('세계(spawnEvent)는 제품 종류를 모른다: 생산자를 표에 더하면 세계를 고치지 않아도 그 제품이 놓인다', () => {
    const world = duelWorld()
    const placed = []
    CREATORS.unshift({ name: 'test', accepts: (ev) => ev.s === 'zz', create: () => [{ place: (w) => placed.push(w) }] })
    try {
      spawnEvent(world, at({ k: 'skill', s: 'zz' }))
    } finally {
      CREATORS.shift()
    }
    expect(placed).toEqual([world])
  })
})

describe('Command: 입력 → 명령 객체(execute) → 세계', () => {
  it('commandOf가 { type, ... } 명령을 execute(world, player)를 가진 객체로 바꾸고, 모르는 명령은 버린다', () => {
    const world = duelWorld()
    const me = world.players[0]
    const command = commandOf({ type: 'move', x: 1, y: 0 })
    expect(typeof command.execute).toBe('function')
    command.execute(world, me)
    expect(me.moveX).toBe(1)
    expect(commandOf({ type: '없는 명령' })).toBeNull()
  })

  it('명령을 기록해 두면 같은 판을 그대로 다시 돌릴 수 있다(봇 없이 기록만으로)', () => {
    const DT = 1 / 60
    const play = (source) => {
      const world = duelWorld()
      const log = []
      for (let i = 0; i < 60 * 8 && !world.over; i += 1) {
        const commands = source ? source[i] : Object.fromEntries(world.players.filter((p) => p.alive).map((p) => [p.id, kiter.commands(world, p)]))
        log.push(commands)
        stepWorld(world, commands, DT)
      }
      return { log, end: world.players.map((p) => [Math.round(p.x * 100), Math.round(p.y * 100), p.hp, p.cd.shot.toFixed(3)]) }
    }
    const original = play(null)
    const replay = play(original.log)
    expect(original.end.some(([, , hp]) => hp < 80)).toBe(true) // 실제로 싸웠다
    expect(replay.end).toEqual(original.end)
  })
})

describe('Strategy: 시점(TopView·FirstPersonView)을 같은 draw로 바꿔 끼운다', () => {
  it('두 시점은 같은 draw(ctx, world, me, info)를 갖고, Renderer.viewOf가 지금 모드에 맞는 것을 고른다', () => {
    expect(TopView.prototype.draw.length).toBeGreaterThanOrEqual(3)
    expect(FirstPersonView.prototype.draw.length).toBeGreaterThanOrEqual(3)
    const top = { name: 'top' }
    const first = { name: 'first' }
    // Renderer의 상태 중 viewOf가 쓰는 것만 둔 가짜 Context(캔버스 없이)
    const context = { top, first, cameras: {}, meId: 'a', motions: { of: () => ({}) }, deadAge: () => Infinity, prepareFirst() {} }
    const world = createWorld({ seed: 3, modes: ['map'], players: [{ id: 'a', loadout: loadout('나'), local: true }, { id: 'b', loadout: loadout('상대'), local: true }] })
    const me = world.players[0]
    expect(Renderer.prototype.viewOf.call(context, world, me, 0)).toBe(first) // 평소: 1인칭
    world.time = world.schedule.dives[0].t + 3 // 지도 앱이 켜진 동안
    expect(Renderer.prototype.viewOf.call(context, world, me, 0)).toBe(top)
    me.alive = false // 쓰러지고 넘어지는 화면이 끝나면 위에서 지켜본다
    world.time = 0
    expect(Renderer.prototype.viewOf.call(context, world, me, 0)).toBe(top)
  })
})
