import { describe, expect, it } from 'vitest'
import { characterState } from '../character/state'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import { BOT_STRATEGIES, botCommands, kiter, rusher, strategyFor } from './bot'
import { buildLoadout } from './loadout'
import { PracticeLoop } from './loop'
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
  me.x = 180
  me.y = 300
  foe.x = 180 + dist
  foe.y = 300
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

  it('같은 상황에서 거리 유지형은 물러나고, 돌격형은 다가간다', () => {
    // 100: 거리 유지형의 가까운 선(150)보다 가깝고, 돌격형이 옆으로 도는 거리(60)보다 멀다.
    const near1 = faceOff(100)
    const near2 = faceOff(100)
    const kite = kiter.commands(near1, near1.players[0])
    const rush = rusher.commands(near2, near2.players[0])
    expect(approachOf(kite)).toBe(-1)
    expect(approachOf(rush)).toBe(1)
    // 190: 거리 유지형은 거리를 지키며 옆으로만 돌고, 돌격형은 계속 다가간다.
    const w1 = faceOff(190)
    const w2 = faceOff(190)
    expect(approachOf(kiter.commands(w1, w1.players[0]))).toBe(0)
    expect(approachOf(rusher.commands(w2, w2.players[0]))).toBe(1)
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
      let sum = 0
      for (let i = 0; i < 60 * 5; i += 1) {
        stepWorld(world, { [bot.id]: pick.commands(world, bot) }, 1 / 60)
        dummy.hp = dummy.maxHp // 끝나지 않게
        sum += Math.hypot(bot.x - dummy.x, bot.y - dummy.y)
      }
      return sum / (60 * 5)
    }
    expect(avgDist(rusher)).toBeLessThan(avgDist(kiter) - 50)
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
