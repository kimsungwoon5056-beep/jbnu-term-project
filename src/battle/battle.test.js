import { describe, expect, it } from 'vitest'
import { characterState } from '../character/state'
import { DEFAULT_LOOK } from '../profile/look'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import { botCommands } from './bot'
import { buildLoadout, debuffLines } from './loadout'
import { Pool } from './pool'
import { isRoomCode, makeRoomCode } from './roomCode'
import { expandEvent, SKILLS } from './skills'
import { buildSchedule, bubbleY, DRAIN, ITEM, ITEMS, safeArea, seedOf, STORM } from './schedule'
import { ALARM_EVERY, AREA, applyRemote, createWorld, DASH, MATCH_SECONDS, OBSTACLES, rankPlayers, RADIUS, spawnEvent, stepWorld } from './world'

const END = '2026-11-15'
const loadoutOf = (key) => {
  const persona = PERSONAS[key]
  const { metrics, details } = computeTodayMetrics(persona.make(END), END)
  return buildLoadout({ state: characterState(metrics, details), look: persona.look, nickname: persona.nickname })
}
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const plain = (changes = {}) =>
  buildLoadout({
    state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, ...changes, marks: { ...CALM, ...changes.marks } },
    look: DEFAULT_LOOK,
    nickname: changes.name ?? '테스트',
  })
const duel = (a = plain(), b = plain({ name: '상대' }), events = false) =>
  createWorld({
    events,
    players: [
      { id: 'a', loadout: a, local: true },
      { id: 'b', loadout: b, local: true },
    ],
  })
const run = (world, seconds, commands = {}) => {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) stepWorld(world, commands, 1 / 60)
}

describe('대결 능력: 폰을 덜 쓴 사람이 유리하다', () => {
  it('체력 = 60 + 40 × 디지털 건강, 운동화면 속도 +20%', () => {
    expect(plain({ health: { percent: 100 } }).hp).toBe(100)
    expect(plain({ health: { percent: 10 } }).hp).toBe(64)
    expect(plain({ marks: { shoes: 'sneakers' } }).speed).toBe(Math.round(plain().speed * 1.2))
  })

  it('앱 조각이 없으면 디톡스 실드, 있으면 머리 앱 유형의 기술', () => {
    expect(plain().skill).toBe('detox')
    expect(plain({ grafts: [{ slot: 'hair', icon: 'kakaotalk', archetype: 'messenger' }] }).skill).toBe('messenger')
    for (const skill of Object.values(SKILLS)) expect(skill.cooldown).toBeGreaterThan(0)
  })

  it('오늘 스마트폰 기록이 없으면 건강 50%로 보고 기술이 없다', () => {
    const loadout = plain({ health: { percent: 100, known: { phone: false, steps: false } } })
    expect(loadout.hp).toBe(80)
    expect(loadout.skill).toBe('unrecorded')
    expect(expandEvent({ k: 'skill', s: 'unrecorded', o: 'a', x: 0, y: 0, a: 0 })).toEqual([])
  })

  it('시연 인물: 아침 러너는 체력·속도가 높고, 새벽 게이머는 디버프가 많다', () => {
    const runner = loadoutOf('morningRunner')
    const gamer = loadoutOf('nightCoder')
    expect(runner.hp).toBeGreaterThan(gamer.hp)
    expect(runner.speed).toBeGreaterThan(gamer.speed)
    expect(runner.skill).toBe('detox')
    expect(gamer.skill).toBe('feed')
    expect(debuffLines(gamer.debuffs).length).toBeGreaterThanOrEqual(3)
    expect(debuffLines(runner.debuffs)).toEqual([])
  })
})

describe('기술(Factory)과 발사체(Object Pool)', () => {
  it('같은 시전 이벤트면 같은 결과', () => {
    const ev = { k: 'skill', s: 'feed', o: 'a', x: 100, y: 100, a: 0 }
    expect(expandEvent(ev)).toEqual(expandEvent(ev))
    expect(expandEvent(ev)).toHaveLength(8)
    expect(expandEvent({ k: 'shot', o: 'a', x: 0, y: 0, a: 0 })).toHaveLength(1)
  })

  it('풀은 다 쓴 객체를 다시 쓴다', () => {
    const pool = new Pool(() => ({}))
    const first = pool.acquire({ n: 1 })
    pool.sweep(() => false)
    expect(pool.size).toBe(0)
    expect(pool.acquire({ n: 2 })).toBe(first)
  })
})

describe('한 판 진행', () => {
  it('맞으면 체력이 줄고, 대시 중에는 맞지 않는다', () => {
    const world = duel()
    const [a, b] = world.players
    a.x = 100
    a.y = 80
    b.x = 220
    b.y = 80
    a.aim = 0
    stepWorld(world, { a: [{ type: 'fire' }] }, 1 / 60)
    run(world, 0.5)
    expect(b.hp).toBe(b.maxHp - 8)
    a.cd.shot = 0
    stepWorld(world, { a: [{ type: 'fire' }], b: [{ type: 'dash' }] }, 1 / 60)
    expect(b.dashT).toBeGreaterThan(0)
    expect(b.dashT).toBeLessThanOrEqual(DASH.time)
  })

  it('거북목이면 대시가 짧다', () => {
    const world = duel(plain({ marks: { slouch: true } }))
    stepWorld(world, { a: [{ type: 'dash' }] }, 1 / 60)
    expect(world.players[0].dashT).toBeLessThan(DASH.time - 0.05)
  })

  it('맞는 쪽만 판정한다: 상대(local 아님)는 내 화면에서 체력이 깎이지 않는다', () => {
    const world = createWorld({
      players: [
        { id: 'a', loadout: plain(), local: true },
        { id: 'b', loadout: plain(), local: false },
      ],
      events: false,
    })
    const [a, b] = world.players
    Object.assign(b, { x: 220, y: 80, tx: 220, ty: 80 })
    Object.assign(a, { x: 100, y: 80, aim: 0 })
    stepWorld(world, { a: [{ type: 'fire' }] }, 1 / 60)
    run(world, 0.5)
    expect(b.hp).toBe(b.maxHp)
    expect(world.outbox[0]).toMatchObject({ k: 'shot', o: 'a' })
    applyRemote(world, 'b', { x: 300, y: 200, a: 1, hp: 3, alive: true })
    expect(b.hp).toBe(3)
  })

  it('알림 배지: 10초마다 배지 수 × 0.3초 멈칫', () => {
    const world = duel(plain({ marks: { badges: 2 } }))
    run(world, ALARM_EVERY - 0.05)
    expect(world.players[0].stunT).toBe(0)
    run(world, 0.1)
    expect(world.players[0].stunT).toBeGreaterThan(0.5)
  })

  it('디톡스 실드: 3초 무적 + 회복', () => {
    const world = duel()
    const [a] = world.players
    a.hp = 30
    stepWorld(world, { a: [{ type: 'skill' }] }, 1 / 60)
    expect(a.hp).toBe(50)
    expect(a.shieldT).toBeGreaterThan(2.9)
    spawnEvent(world, { k: 'shot', o: 'b', x: Math.round(a.x - 30), y: Math.round(a.y), a: 0 })
    run(world, 0.3)
    expect(a.hp).toBe(50)
  })

  it('마지막 생존자가 이기고, 90초가 지나면 체력 비율로 순위', () => {
    const world = duel()
    world.players[1].hp = 1
    world.players[1].alive = false
    stepWorld(world, {}, 1 / 60)
    expect(world.over).toBe(true)
    expect(rankPlayers(world)[0].id).toBe('a')

    const timed = duel()
    timed.players[0].hp = 10
    run(timed, MATCH_SECONDS + 0.1)
    expect(timed.over).toBe(true)
    expect(rankPlayers(timed).map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('봇은 같은 씨앗이면 같은 행동을 하고, 판이 끝난다', () => {
    const make = () =>
      createWorld({
        seed: 7,
        players: ['nightCoder', 'morningRunner', 'weekendRusher'].map((key, i) => ({ id: key, loadout: loadoutOf(key), local: true, bot: i > 0 })),
      })
    const play = (world) => {
      for (let i = 0; i < 60 * 30 && !world.over; i += 1) {
        const commands = Object.fromEntries(world.players.filter((p) => p.bot).map((p) => [p.id, botCommands(world, p)]))
        stepWorld(world, commands, 1 / 60)
      }
      return world.players.map((p) => [Math.round(p.x), Math.round(p.y), p.hp])
    }
    expect(play(make())).toEqual(play(make()))
    const world = make()
    play(world)
    const hurt = world.players.filter((p) => p.hp < p.maxHp)
    expect(hurt.length).toBeGreaterThan(0)
    for (const p of world.players) {
      expect(p.x).toBeGreaterThanOrEqual(RADIUS)
      expect(p.y).toBeGreaterThanOrEqual(RADIUS)
    }
  })
})

describe('폰 화면 아레나: 판 중간 사건', () => {
  const blocked = (x, y, r) => OBSTACLES.some((b) => x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r)
  const plan = (seed) => buildSchedule({ seed, seconds: MATCH_SECONDS, area: AREA, blocked })
  const live = () => duel(plain(), plain({ name: '상대' }), true)
  const at = (world, time) => {
    world.time = time
  }

  it('같은 씨앗이면 같은 일정, 다른 씨앗이면 다른 일정', () => {
    expect(plan(42)).toEqual(plan(42))
    expect(plan(42)).not.toEqual(plan(43))
    expect(seedOf('ABCD', 1700000000000)).toBe(seedOf('ABCD', 1700000000000))
    expect(seedOf('ABCD', 1)).not.toBe(seedOf('ABCE', 1))
  })

  it('아이템은 12초마다 앱 아이콘 밖에 놓이고, 폭풍은 한 번에 6줄 중 3줄만 막는다', () => {
    const { items, bubbles } = plan(9)
    expect(items.length).toBeGreaterThanOrEqual(6)
    for (const item of items) expect(blocked(item.x, item.y, 0)).toBe(false)
    expect(items[1].t - items[0].t).toBe(ITEM.every)
    const waves = Object.groupBy(bubbles, (bubble) => bubble.t)
    for (const wave of Object.values(waves)) expect(new Set(wave.map((bubble) => bubble.lane)).size).toBe(STORM.perWave)
    expect(bubbles.length).toBe(STORM.starts.length * STORM.waves * STORM.perWave)
  })

  it('아이템: 충전기는 회복, 비행기 모드는 무적, 방해 금지는 알림 배지 멈칫을 막는다', () => {
    const world = duel(plain({ marks: { badges: 3 } }), plain({ name: '상대' }), true)
    const [a] = world.players
    const take = (kind) => {
      const item = world.items.find((candidate) => !candidate.taken)
      item.kind = kind
      at(world, item.t)
      Object.assign(a, { x: item.x, y: item.y })
      stepWorld(world, {}, 1 / 60)
      expect(item.taken).toBe(true)
      return item
    }
    a.hp = 40
    take('charger')
    expect(a.hp).toBe(40 + ITEMS.charger.heal)
    expect(world.outbox.at(-1)).toMatchObject({ k: 'pick', o: 'a' })
    take('airplane')
    expect(a.airT).toBeGreaterThan(1.9)
    const before = a.hp
    spawnEvent(world, { k: 'shot', o: 'b', x: Math.round(a.x - 30), y: Math.round(a.y), a: 0 })
    run(world, 0.2)
    expect(a.hp).toBe(before)
    take('dnd')
    a.alarmT = 0.01
    run(world, 0.1)
    expect(a.stunT).toBe(0)
    expect(a.stats.items).toBe(3)
  })

  it('상대가 주운 아이템은 내 화면에서 사라지기만 한다', () => {
    const world = live()
    const [a] = world.players
    const item = world.items[0]
    a.hp = 40
    spawnEvent(world, { k: 'pick', o: 'b', x: 0, y: 0, a: 0, i: item.id })
    expect(item.taken).toBe(true)
    expect(a.hp).toBe(40)
  })

  it('알림 폭풍: 말풍선에 맞으면 피해와 멈칫, 방해 금지면 막는다', () => {
    for (const dnd of [false, true]) {
      const world = live()
      const [a, b] = world.players
      const bubble = world.schedule.bubbles[0]
      Object.assign(b, { x: 330, y: 520 })
      at(world, bubble.t)
      // 말풍선이 0.5초 뒤 지나갈 자리에 세운다(가운데 아이콘과 겹치지 않는 높이).
      const y = bubbleY(bubble, bubble.t + 0.3, AREA)
      Object.assign(a, { x: bubble.x, y: Math.max(y, 60), dndT: dnd ? 5 : 0 })
      const hp = a.hp
      run(world, 0.6)
      if (dnd) expect(a.hp).toBe(hp)
      else {
        expect(a.hp).toBeLessThanOrEqual(hp - STORM.damage)
        expect(a.stats.storm).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('배터리 경고: 60초부터 가장자리가 꺼지고, 그 안에 있으면 초당 4씩 깎인다', () => {
    expect(safeArea(AREA, DRAIN.start)).toEqual(AREA)
    const end = safeArea(AREA, DRAIN.end)
    expect(end.x1 - end.x0).toBeCloseTo((AREA.x1 - AREA.x0) * DRAIN.keep)
    const world = live()
    const [a, b] = world.players
    at(world, 80)
    world.items.forEach((item) => (item.taken = true))
    world.schedule.bubbles = []
    Object.assign(a, { x: 30, y: 60 })
    Object.assign(b, { x: 180, y: 240 })
    const hpA = a.hp
    const hpB = b.hp
    run(world, 1.01)
    expect(a.hp).toBe(hpA - DRAIN.dps)
    expect(b.hp).toBe(hpB)
  })
})

describe('방 코드', () => {
  it('헷갈리는 글자(0·O·1·I) 없이 4자리', () => {
    const codes = Array.from({ length: 50 }, (_, i) => makeRoomCode(() => (i * 0.137) % 1))
    for (const code of codes) expect(isRoomCode(code)).toBe(true)
    expect(isRoomCode('AB0I')).toBe(false)
    expect(isRoomCode('abcd')).toBe(false)
  })
})
