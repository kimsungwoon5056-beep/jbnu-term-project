import { describe, expect, it } from 'vitest'
import { characterState } from '../character/state'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import { BOT_STRATEGIES, botCommands, hopper, kiter, rusher, strategyFor } from './bot'
import { buildLoadout } from './loadout'
import { PracticeLoop } from './loop'
import { BASIC_SHOT, Projectile } from './skills'
import { createWorld, stepWorld } from './world'

// Strategy: 봇 성격(kiter·rusher)과 사람 입력이 같은 인터페이스 commands(world, me)를 가진다.

const END = '2026-11-15'
const loadoutOf = (key) => {
  const persona = PERSONAS[key]
  const { metrics, details } = computeTodayMetrics(persona.make(END), END)
  return buildLoadout({ state: characterState(metrics, details), look: persona.look, nickname: persona.nickname })
}
const KEYS = ['nightCoder', 'morningRunner', 'weekendRusher']

// 두 봇이 dist만큼 떨어져 마주 선 세계(사건 없음)
const faceOff = (dist, seed = 5) => {
  const world = createWorld({
    seed,
    events: false,
    players: [
      { id: 'me', loadout: loadoutOf('morningRunner'), local: true, bot: true },
      { id: 'foe', loadout: loadoutOf('nightCoder'), local: true },
    ],
  })
  const [me, foe] = world.players
  me.x = 120 // 앱 아이콘 사이의 빈 줄
  me.y = 220
  foe.x = 120 + dist
  foe.y = 220
  return world
}
// 이동 명령이 상대 쪽(+1)인지 반대쪽(-1)인지 옆(0)인지
const approachOf = (commands) => Math.round(commands.find((c) => c.type === 'move').x * 10) / 10 + 0 // + 0: -0을 0으로

// 한 판(최대 30초)을 strategy로만 돌리고 마지막 위치·체력
const play = (seed, pick, events = true) => {
  const world = createWorld({ seed, events, players: KEYS.map((key) => ({ id: key, loadout: loadoutOf(key), local: true, bot: true })) })
  const strategies = Object.fromEntries(world.players.map((p) => [p.id, pick(p)]))
  for (let i = 0; i < 60 * 30 && !world.over; i += 1) {
    const commands = Object.fromEntries(world.players.filter((p) => p.alive).map((p) => [p.id, strategies[p.id].commands(world, p)]))
    stepWorld(world, commands, 1 / 60)
  }
  return world
}

describe('Strategy: 봇 성격', () => {
  it('두 성격 모두 같은 인터페이스 commands(world, me)를 가진다', () => {
    expect(Object.keys(BOT_STRATEGIES)).toEqual(['kiter', 'rusher'])
    for (const strategy of Object.values(BOT_STRATEGIES)) expect(typeof strategy.commands).toBe('function')
  })

  it('둘 다 리치 밖이면 다가가고, 리치 안이면 때린다', () => {
    for (const strategy of [kiter, rusher]) {
      const far = faceOff(190)
      expect(approachOf(strategy.commands(far, far.players[0]))).toBe(1)
      const near = faceOff(36)
      const fired = Array.from({ length: 20 }, () => strategy.commands(near, near.players[0])).some((list) => list.some((c) => c.type === 'fire'))
      expect(fired).toBe(true)
    }
  })

  it('두 타를 친 뒤 거리 유지형은 물러나고, 돌격형은 붙어 있는다', () => {
    const hitTwice = (world) => Object.assign(world.players[0].combo, { step: 1, until: world.time + 0.3 })
    const w1 = faceOff(36)
    const w2 = faceOff(36)
    hitTwice(w1)
    hitTwice(w2)
    expect(approachOf(kiter.commands(w1, w1.players[0]))).toBe(-1)
    expect(approachOf(rusher.commands(w2, w2.players[0]))).toBeGreaterThanOrEqual(0)
  })

  it('상대가 내려찍기를 준비하면 뛰어서 피한다', () => {
    let jumped = 0
    for (let seed = 1; seed <= 10; seed += 1) {
      const world = faceOff(40, seed)
      const [me, foe] = world.players
      world.swings.push({ owner: foe.id, x: foe.x, y: foe.y, a: Math.PI, anchor: 'owner', t: 0, move: { shape: 'slam', reach: 54, windup: 0.45, active: 0.1, recovery: 0.4 } })
      if (rusher.commands(world, me).some((c) => c.type === 'jump')) jumped += 1
    }
    expect(jumped).toBeGreaterThanOrEqual(3)
  })
  it('돌격형은 거리 유지형보다 상대 가까이에서 싸운다', () => {
    const avgDist = (pick) => {
      const world = createWorld({
        seed: 11,
        events: false,
        players: [
          { id: 'bot', loadout: loadoutOf('morningRunner'), local: true, bot: true },
          { id: 'dummy', loadout: loadoutOf('nightCoder'), local: true },
        ],
      })
      const [bot, dummy] = world.players
      Object.assign(bot, { x: 100, y: 220 }) // 가까이에서 시작(다가가는 시간이 평균을 가리지 않게)
      Object.assign(dummy, { x: 220, y: 220 })
      let sum = 0
      for (let i = 0; i < 60 * 5; i += 1) {
        stepWorld(world, { [bot.id]: pick.commands(world, bot) }, 1 / 60)
        dummy.hp = dummy.maxHp // 끝나지 않게
        sum += Math.hypot(bot.x - dummy.x, bot.y - dummy.y)
      }
      return sum / (60 * 5)
    }
    expect(avgDist(rusher)).toBeLessThan(avgDist(kiter) - 12) // 근접이라 거리 유지형도 리치 안팎을 오간다
  })

  it('같은 씨앗이면 같은 행동(두 성격 모두)', () => {
    const final = (world) => world.players.map((p) => [Math.round(p.x * 1000), Math.round(p.y * 1000), p.hp])
    for (const pick of [() => kiter, () => rusher, strategyFor]) {
      const first = play(9, pick)
      expect(final(first)).toEqual(final(play(9, pick)))
      expect(first.players.some((p) => p.hp < p.maxHp)).toBe(true)
    }
    expect(final(play(9, () => rusher))).not.toEqual(final(play(9, () => kiter)))
  })

  it('예전 이름 botCommands는 거리 유지형과 같은 명령을 낸다', () => {
    const make = () => createWorld({ seed: 7, players: KEYS.map((key) => ({ id: key, loadout: loadoutOf(key), local: true, bot: true })) })
    const one = make()
    const two = make()
    expect(botCommands(one, one.players[0])).toEqual(BOT_STRATEGIES.kiter.commands(two, two.players[0]))
  })

  it('시연 인물별 성격: 정주행러는 돌격형, 나머지는 거리 유지형', () => {
    const world = createWorld({ events: false, players: KEYS.map((key) => ({ id: key, loadout: loadoutOf(key), local: true, bot: true })) })
    expect(world.players.map((p) => strategyFor(p).name)).toEqual(['kiter', 'kiter', 'rusher'])
  })
})

describe('Strategy의 Context: PracticeLoop는 플레이어마다 전략을 들고 부른다', () => {
  const setup = () =>
    createWorld({
      events: false,
      players: [
        { id: 'me', loadout: loadoutOf('morningRunner'), local: true },
        ...KEYS.map((key, i) => ({ id: `bot${i}`, loadout: loadoutOf(key), local: true, bot: true })),
      ],
    })

  it('나는 사람 입력, 봇은 인물별 성격을 같은 방식으로 부른다', () => {
    const world = setup()
    const calls = []
    const input = { commands: (w, me) => (calls.push([w, me.id]), [{ type: 'fire' }]), detach() {} }
    const loop = new PracticeLoop({ world, input, meId: 'me' })
    expect(loop.strategies.get('me')).toBe(input)
    expect([1, 2, 3].map((i) => loop.strategies.get(`bot${i - 1}`))).toEqual([kiter, kiter, rusher])

    world.players[2].alive = false
    const commands = loop.collectCommands()
    expect(calls).toEqual([[world, 'me']])
    expect(commands.me).toEqual([{ type: 'fire' }])
    expect(Object.keys(commands)).toEqual(['me', 'bot0', 'bot2'])
  })

  it('전략을 바꿔 끼울 수 있다', () => {
    const world = setup()
    const idle = { commands: () => [{ type: 'move', x: 0, y: 0 }] }
    const loop = new PracticeLoop({ world, input: idle, meId: 'me', strategies: { bot0: rusher, bot1: idle } })
    expect(loop.strategies.get('bot0')).toBe(rusher)
    expect(loop.collectCommands().bot1).toEqual([{ type: 'move', x: 0, y: 0 }])
  })
})

describe('봇 점프', () => {
  // 상대가 계속 봇을 향해 쏘는 판에서 봇이 낸 명령을 센다.
  const under = (strategy) => {
    const world = createWorld({ seed: 11, events: false, players: KEYS.slice(0, 2).map((key, i) => ({ id: key, loadout: loadoutOf(key), local: true, bot: i === 0 })) })
    const [bot, foe] = world.players
    Object.assign(bot, { x: 180, y: 300 })
    Object.assign(foe, { x: 180, y: 480 })
    let jumps = 0
    for (let i = 0; i < 400; i += 1) {
      if (!world.projectiles.active.some((shot) => shot.active)) Projectile.aimed({ o: foe.id, x: bot.x, y: bot.y + 60 }, -Math.PI / 2, BASIC_SHOT).place(world)
      const commands = strategy.commands(world, bot)
      if (commands.some((command) => command.type === 'jump')) jumps += 1
      stepWorld(world, { [bot.id]: commands }, 1 / 60)
      Object.assign(bot, { hp: bot.maxHp, alive: true })
    }
    return jumps
  }

  it('탄(원거리 기술)이 오면 봇이 가끔 뛴다', () => {
    expect(under(kiter)).toBeGreaterThanOrEqual(1)
    expect(under(rusher)).toBeGreaterThanOrEqual(1)
  })

  it('시험용 hopper는 바닥에 있으면 늘 뛰고, 성격 목록에는 없다', () => {
    expect(under(hopper)).toBeGreaterThan(under(kiter))
    expect(Object.values(BOT_STRATEGIES)).not.toContain(hopper)
  })
})

describe('봇과 짧은 영상', () => {
  it('넘기기 파도가 오면 봇이 뛰어 넘으려 한다(쏠 상대가 없어도)', () => {
    const world = createWorld({ seed: 4, modes: ['shorts'], players: KEYS.slice(0, 1).map((key) => ({ id: key, loadout: loadoutOf(key), local: true, bot: true })) })
    const dive = world.schedule.dives[0]
    world.time = dive.t + 0.5
    let jumps = 0
    world.signals.subscribe((signal) => signal.kind === 'jump' && (jumps += 1))
    for (let i = 0; i < 60 * 9; i += 1) {
      const commands = Object.fromEntries(world.players.filter((p) => p.alive).map((p) => [p.id, kiter.commands(world, p)]))
      stepWorld(world, commands, 1 / 60)
      for (const player of world.players) Object.assign(player, { hp: player.maxHp, alive: true })
    }
    expect(jumps).toBeGreaterThanOrEqual(3)
  })
})

describe('봇의 Q·E', () => {
  const armed = (key, skill) => ({ ...loadoutOf(key), skill })
  const duelOf = (skill, dist) => {
    const world = createWorld({ seed: 4, events: false, players: [{ id: 'me', loadout: armed('morningRunner', skill), local: true, bot: true }, { id: 'foe', loadout: armed('nightCoder', 'detox'), local: true }] })
    const [me, foe] = world.players
    Object.assign(me, { x: 60, y: 220 })
    Object.assign(foe, { x: 60 + dist, y: 220 })
    return world
  }
  const uses = (strategy, world, type, tries = 200) => Array.from({ length: tries }, () => strategy.commands(world, world.players[0])).some((list) => list.some((c) => c.type === type))

  it('멀리 있으면 가끔 E를 쓰고, 판 시작 잠금 동안은 쓰지 않는다', () => {
    for (const strategy of [kiter, rusher]) {
      const locked = duelOf('feed', 250)
      expect(uses(strategy, locked, 'far')).toBe(false)
      const open = duelOf('feed', 250)
      open.time = 12
      expect(uses(strategy, open, 'far')).toBe(true)
      const near = duelOf('feed', 40)
      near.time = 12
      expect(uses(strategy, near, 'far')).toBe(false)
    }
  })

  it('막기 기술(손절 반격)은 상대가 나를 노리고 준비할 때만 쓴다', () => {
    const calm = duelOf('finance', 40)
    expect(uses(kiter, calm, 'skill')).toBe(false)
    const threatened = duelOf('finance', 40)
    const foe = threatened.players[1]
    threatened.swings.push({ owner: foe.id, x: foe.x, y: foe.y, a: Math.PI, anchor: 'owner', t: 0, move: { shape: 'arc', reach: 56, width: 1.7, windup: 0.3, active: 0.1, recovery: 0.2 } })
    expect(uses(kiter, threatened, 'skill')).toBe(true)
  })
})