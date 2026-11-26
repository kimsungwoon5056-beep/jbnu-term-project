import { describe, expect, it } from 'vitest'
import { characterState } from '../character/state'
import { DEFAULT_LOOK } from '../profile/look'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import { botCommands } from './bot'
import { buildLoadout, debuffLines } from './loadout'
import { Pool } from './pool'
import { isRoomCode, makeRoomCode } from './roomCode'
import { BASIC_SHOT, expandEvent, SKILLS } from './skills'
import { SFX } from '../audio/sfx'
import { matchSummary } from './summary'
import { buildSchedule, bubbleY, DRAIN, ITEM, ITEMS, safeArea, seedOf, STORM } from './schedule'
import { ALARM_EVERY, applyRemote, AREA, createWorld, DASH, MATCH_SECONDS, OBSTACLES, RADIUS, rankPlayers, SHOT_COOLDOWN, spawnEvent, stepWorld } from './world'

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
    expect(expandEvent(ev)).toHaveLength(12)
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
    expect(b.hp).toBe(b.maxHp - BASIC_SHOT.damage)
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

  it('디톡스 실드: 무적 + 회복', () => {
    const world = duel()
    const [a] = world.players
    const [shield] = SKILLS.detox.cast({ o: 'a' })
    a.hp = 30
    stepWorld(world, { a: [{ type: 'skill' }] }, 1 / 60)
    expect(a.hp).toBe(30 + shield.heal)
    expect(a.shieldT).toBeGreaterThan(shield.time - 0.1)
    spawnEvent(world, { k: 'shot', o: 'b', x: Math.round(a.x - 30), y: Math.round(a.y), a: 0 })
    run(world, 0.3)
    expect(a.hp).toBe(30 + shield.heal)
  })

  it('마지막 생존자가 이기고, 판 시간이 다 되면 체력 비율로 순위', () => {
    const world = duel()
    Object.assign(world.players[1], { hp: 0, alive: false, lives: 0 })
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

  it('균형: 알림 폭풍 한 번을 피하지 않고 다 맞아도 가장 낮은 체력(64)의 3분의 1을 넘지 않는다', () => {
    // 가로 판정 폭이 줄 폭의 절반보다 좁아, 한 번 쏟아질 때 말풍선 하나에만 맞는다.
    const laneW = (AREA.x1 - AREA.x0) / STORM.lanes
    expect(STORM.w / 2 + RADIUS * 0.4).toBeLessThan(laneW / 2)
    const worst = STORM.waves * STORM.damage // 목숨이 3개라 판 전체가 아니라 한 번을 본다
    expect(worst).toBeLessThanOrEqual(64 / 3)
    expect(STORM.perWave / STORM.lanes).toBeLessThanOrEqual(0.34)
  })

  it('균형: 폭풍 한가운데 가만히 서 있어도 한 번 쏟아질 때 한 번만 맞는다', () => {
    // 첫 폭풍 동안 줄 경계마다 가만히 서 본다(두 줄이 같이 내려와도 둘 다 맞으면 안 된다).
    const { laneW } = live().schedule
    let worstHits = 0
    for (let edge = 1; edge < STORM.lanes; edge += 1) {
      const test = live()
      test.items.forEach((item) => (item.taken = true))
      const [p, q] = test.players
      Object.assign(q, { x: 330, y: 520 })
      test.time = STORM.starts[0]
      Object.assign(p, { x: AREA.x0 + laneW * edge, y: 60 })
      for (let i = 0; i < 60 * (STORM.warn + STORM.waves * STORM.waveGap + 1); i += 1) {
        p.x = AREA.x0 + laneW * edge
        p.y = 60
        p.stunT = 0
        stepWorld(test, {}, 1 / 60)
      }
      worstHits = Math.max(worstHits, p.stats.storm)
    }
    expect(worstHits).toBeLessThanOrEqual(STORM.waves)
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

  it('배터리 경고: 3분부터 가장자리가 꺼지고, 그 안에 있으면 초당 4씩 깎인다', () => {
    expect(safeArea(AREA, DRAIN.start)).toEqual(AREA)
    const end = safeArea(AREA, DRAIN.end)
    expect(end.x1 - end.x0).toBeCloseTo((AREA.x1 - AREA.x0) * DRAIN.keep)
    const world = live()
    const [a, b] = world.players
    at(world, DRAIN.start + ((DRAIN.end - DRAIN.start) * 2) / 3) // 꺼진 곳이 가장자리를 3분의 2만큼 먹었을 때
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

describe('손맛과 결과', () => {
  it('맞으면 번쩍이고 맞은 방향으로 조금 밀리며, 효과에 누구에게 생긴 일인지 남는다', () => {
    const world = duel()
    const [a, b] = world.players
    Object.assign(a, { x: 100, y: 80, aim: 0 })
    Object.assign(b, { x: 220, y: 80 })
    stepWorld(world, { a: [{ type: 'fire' }] }, 1 / 60)
    expect(world.effects.find((fx) => fx.kind === 'shot')).toMatchObject({ who: 'a' })
    let hitAt = null
    for (let i = 0; i < 60 && hitAt === null; i += 1) {
      stepWorld(world, {}, 1 / 60)
      if (b.hp < b.maxHp) hitAt = b.x
    }
    expect(b.flashT).toBeGreaterThan(0)
    expect(hitAt).toBeGreaterThan(220)
    expect(world.effects.find((fx) => fx.kind === 'hit')).toMatchObject({ who: 'b', text: `-${BASIC_SHOT.damage}` })
  })

  it('상대 화면이 판정한 피해도 내 화면에서 번쩍인다', () => {
    const world = createWorld({ events: false, players: [{ id: 'a', loadout: plain(), local: true }, { id: 'b', loadout: plain(), local: false }] })
    const b = world.players[1]
    applyRemote(world, 'b', { x: b.x, y: b.y, a: 0, hp: b.hp - 6, alive: true })
    expect(b.flashT).toBeGreaterThan(0)
    expect(world.effects.at(-1)).toMatchObject({ kind: 'hit', who: 'b', text: '-6' })
  })

  it('결과 총평: 1등, 알림 폭풍, 배터리 경고, 아이템 없음 순으로 다음 판 조언', () => {
    const player = (stats, health = 50) => ({ hp: 30, maxHp: 80, alive: false, downAt: 41.6, loadout: { health, hp: 80 }, stats: { items: 1, storm: 0, drain: 0, taken: 0, ...stats } })
    expect(matchSummary(player({}, 90), 1).tip).toBe('폰을 내려놓은 사람이 이겼어요!')
    expect(matchSummary(player({ storm: 4 }), 2).tip).toContain('알림 폭풍에 4번')
    expect(matchSummary(player({ drain: 10 }), 2).tip).toContain('가운데로')
    expect(matchSummary(player({ items: 0 }), 3).tip).toContain('충전기')
    expect(matchSummary(player({}), 2).tip).toContain('디지털 건강 50%')
    expect(matchSummary(player({}), 2)).toMatchObject({ survived: 42, items: 1, hp: 30 })
  })

  it('효과음은 모두 음 목록이 있다', () => {
    for (const name of ['shot', 'hit', 'hurt', 'down', 'pick', 'storm', 'tick', 'go', 'win', 'lose']) expect(SFX[name].length).toBeGreaterThan(0)
  })
})

describe('판 길이와 온라인 순위', () => {
  it('기본 공격만으로 가장 낮은 체력(64)을 눕히는 데 10초 넘게 걸린다(판 중간 사건을 볼 시간)', () => {
    const shots = Math.ceil(64 / BASIC_SHOT.damage)
    expect(shots * SHOT_COOLDOWN).toBeGreaterThan(10)
  })

  it('거의 동시에 쓰러지면 나중에 쓰러진 사람이 앞선다(모든 화면에서 같은 기준: 보낸 시각)', () => {
    const screen = (me) => {
      const world = createWorld({ events: false, players: ['a', 'b'].map((id) => ({ id, loadout: plain({ name: id }), local: id === me })) })
      world.startAt = 1000
      return world
    }
    const onA = screen('a')
    const onB = screen('b')
    // a는 11000ms, b는 11080ms에 쓰러졌다. 서로의 소식은 0.1초씩 늦게 온다.
    Object.assign(onA.players[0], { alive: false, hp: 0, lives: 0, downAt: 10 })
    Object.assign(onB.players[1], { alive: false, hp: 0, lives: 0, downAt: 10.08 })
    applyRemote(onA, 'b', { x: 1, y: 1, a: 0, hp: 0, alive: false, t: 11080 }, { now: 11180 })
    applyRemote(onB, 'a', { x: 1, y: 1, a: 0, hp: 0, alive: false, t: 11000 }, { now: 11100 })
    expect(rankPlayers(onA).map((p) => p.id)).toEqual(['b', 'a'])
    expect(rankPlayers(onB).map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('쓰러진 상대는 늦게 온 옛 상태로 되살아나지 않고, 옛 상태는 무시한다', () => {
    const world = createWorld({ events: false, players: [{ id: 'a', loadout: plain(), local: true }, { id: 'b', loadout: plain(), local: false }] })
    const b = world.players[1]
    applyRemote(world, 'b', { x: 100, y: 80, hp: 40, alive: true, t: 500 }, { now: 500 })
    applyRemote(world, 'b', { x: 10, y: 80, hp: 60, alive: true, t: 400 }, { now: 510 })
    expect(b.hp).toBe(40)
    applyRemote(world, 'b', { x: 100, y: 80, hp: 5, alive: false, t: 600 }, { now: 600 })
    applyRemote(world, 'b', { x: 100, y: 80, hp: 50, alive: true, t: 700 }, { now: 700 })
    expect([b.alive, b.hp]).toEqual([false, 0])
  })

  it('예측해 그리는 상대도 앱 아이콘 속으로 들어가지 않는다', () => {
    const world = createWorld({ events: false, players: [{ id: 'a', loadout: plain(), local: true }, { id: 'b', loadout: plain(), local: false }] })
    const b = world.players[1]
    const box = OBSTACLES[0]
    Object.assign(b, { x: box.x - 40, y: box.y + box.h / 2, tx: box.x + box.w / 2, ty: box.y + box.h / 2 })
    run(world, 1)
    expect(b.x > box.x && b.x < box.x + box.w && b.y > box.y && b.y < box.y + box.h).toBe(false)
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
