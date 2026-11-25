import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { BOT_STRATEGIES } from './bot'
import { linkWorld } from './channel'
import { buildLoadout } from './loadout'
import { OnlineLoop } from './loop'
import { seededRandom } from './pool'
import { AREA, createWorld, MATCH_SECONDS, OBSTACLES, RADIUS, rankPlayers, stepWorld } from './world'

// 자동 실험: 봇만으로 판을 많이 돌려 이상 상태를 찾고(연습), 60~180ms 지연을 흉내 낸 2~4명 온라인 판에서 모든 화면의 결과가 같은지 본다.
const ARCH = ['messenger', 'feed', 'video', 'music', 'game', 'webtoon', 'shopping', 'finance', 'study']
const marksOf = (rng) => ({ slouch: rng() < 0.3, raisePhone: false, spiral: rng() < 0.3, darkCircles: rng() < 0.3, glow: false, badges: Math.floor(rng() * 4), shoes: rng() < 0.3 ? 'sneakers' : 'plain' })
const makeLoadout = (rng, name) => {
  const skillPick = rng()
  const grafts = skillPick < 0.15 ? [] : [{ slot: 'hair', icon: null, archetype: ARCH[Math.floor(rng() * ARCH.length)] }]
  return buildLoadout({ state: { tier: 'mid', grafts, scene: 'home', health: { percent: 10 + Math.round(rng() * 90), known: { phone: true } }, marks: marksOf(rng) }, look: DEFAULT_LOOK, nickname: name })
}
const problems = new Map()
const note = (kind, detail) => {
  if (!problems.has(kind)) problems.set(kind, { count: 0, first: detail })
  problems.get(kind).count += 1
}
const check = (world, tag) => {
  for (const p of world.players) {
    if (![p.x, p.y, p.hp, p.aim].every(Number.isFinite)) note('NaN', `${tag} ${p.id} ${p.x},${p.y},${p.hp},${p.aim}`)
    if (p.x < AREA.x0 + RADIUS - 0.01 || p.x > AREA.x1 - RADIUS + 0.01 || p.y < AREA.y0 + RADIUS - 0.01 || p.y > AREA.y1 - RADIUS + 0.01) note('밖으로', `${tag} ${p.id} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    for (const b of OBSTACLES) if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) note('장애물 안', `${tag} ${p.id} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    if (p.hp < 0 || p.hp > p.maxHp) note('체력 범위', `${tag} ${p.id} ${p.hp}/${p.maxHp}`)
    if (!Number.isInteger(p.hp)) note('체력 소수', `${tag} ${p.id} ${p.hp}`)
    if ((p.hp === 0) === p.alive) note('체력0/생존 불일치', `${tag} ${p.id} hp=${p.hp} alive=${p.alive}`)
  }
}

beforeEach(() => problems.clear())

describe('자동 실험', () => {
  it('연습 160판: 위치·체력·생존이 어긋나지 않고 90초 안에 끝나며, 판 길이 중앙값이 20초를 넘는다', () => {
    const lengths = []
    const wins = {}
    const plays = {}
    for (let seed = 1; seed <= 160; seed += 1) {
      const rng = seededRandom(seed * 7919)
      const n = 2 + Math.floor(rng() * 3)
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, loadout: makeLoadout(rng, `p${i}`), local: true, bot: true }))
      const names = Object.keys(BOT_STRATEGIES)
      const strat = Object.fromEntries(players.map((p) => [p.id, names[Math.floor(rng() * names.length)]]))
      const world = createWorld({ players, seed })
      const deadAt = {}
      let steps = 0
      while (!world.over && steps < 60 * 95) {
        const commands = Object.fromEntries(world.players.filter((p) => p.alive).map((p) => [p.id, BOT_STRATEGIES[strat[p.id]].commands(world, p)]))
        stepWorld(world, commands, 1 / 60)
        steps += 1
        check(world, `연습#${seed}@${world.time.toFixed(1)}`)
        for (const p of world.players) {
          if (!p.alive && !deadAt[p.id]) deadAt[p.id] = [p.x, p.y]
          else if (!p.alive && (Math.abs(deadAt[p.id][0] - p.x) > 1 || Math.abs(deadAt[p.id][1] - p.y) > 1)) note('죽은 뒤 이동', `#${seed} ${p.id}`)
        }
      }
      if (!world.over) note('끝나지 않음', `#${seed} time=${world.time}`)
      if (world.time > MATCH_SECONDS + 0.1) note('90초 초과', `#${seed}`)
      lengths.push(world.time)
      const rank = rankPlayers(world)
      for (const p of world.players) {
        const w = rank[0].id === p.id ? 1 : 0
        plays[p.loadout.skill] = (plays[p.loadout.skill] ?? 0) + 1
        wins[p.loadout.skill] = (wins[p.loadout.skill] ?? 0) + w
      }
    }
    lengths.sort((a, b) => a - b)
    expect([...problems]).toEqual([])
    expect(lengths[Math.floor(lengths.length / 2)]).toBeGreaterThan(20) // 너무 빨리 끝나면 판 중간 사건을 볼 수 없다
    // 폰을 줄여 앱 조각이 없는 사람의 디톡스 실드가 다른 기술보다 약하지 않다
    const others = Object.keys(plays).filter((k) => k !== 'detox')
    const rate = (keys) => keys.reduce((n, k) => n + wins[k], 0) / keys.reduce((n, k) => n + plays[k], 0)
    expect(rate(['detox'])).toBeGreaterThan(rate(others))
  }, 60000)

  it('온라인 30판(2~4명, 지연 흉내): 1등·순위·생존이 모든 화면에서 같다', () => {
    let diffWinner = 0
    let diffOrder = 0
    let diffAlive = 0
    const total = 30
    const samples = []
    for (let seed = 1; seed <= total; seed += 1) {
      const rng = seededRandom(seed * 104729)
      const n = 2 + (seed % 3)
      const ids = Array.from({ length: n }, (_, i) => `p${i}`)
      const loadouts = Object.fromEntries(ids.map((id) => [id, makeLoadout(rng, id)]))
      let clock = 0
      const queue = []
      const listeners = Object.fromEntries(ids.map((id) => [id, { ev: [], peers: [] }]))
      const states = Object.fromEntries(ids.map((id) => [id, null]))
      const lag = () => 60 + rng() * 120
      const lastAt = {}
      const channelOf = (id) => ({
        now: () => clock,
        sendState(s) {
          const at = Math.max(lastAt[id] ?? 0, clock + lag())
          lastAt[id] = at
          const snap = { t: clock, ...s }
          queue.push({ at, run: () => { states[id] = snap; for (const other of ids) listeners[other].peers.forEach((fn) => fn({ ...states })) } })
        },
        sendEvent(ev) {
          const t = clock
          for (const other of ids) if (other !== id) queue.push({ at: clock + lag(), run: () => listeners[other].ev.forEach((fn) => fn({ ...ev, t })) })
        },
        onEvent: (fn) => (listeners[id].ev.push(fn), () => {}),
        onPeers: (fn) => (listeners[id].peers.push(fn), () => {}),
      })
      const screens = Object.fromEntries(
        ids.map((me) => {
          const world = createWorld({ seed, mode: 'online', players: ids.map((id) => ({ id, loadout: loadouts[id], local: id === me })) })
          const channel = channelOf(me)
          linkWorld(world, channel, me)
          const loop = new OnlineLoop({ world, renderer: { draw() {} }, input: { commands: () => [] }, meId: me, channel, startAt: 0 })
          return [me, { world, loop }]
        }),
      )
      const strat = Object.fromEntries(ids.map((id) => [id, seed % 2 ? 'kiter' : 'rusher']))
      const ended = {}
      const settle = {}
      for (let step = 0; step < 60 * 94; step += 1) {
        clock += 1000 / 60
        queue.sort((a, b) => a.at - b.at)
        while (queue.length && queue[0].at <= clock) queue.shift().run()
        for (const me of ids) {
          const { world, loop } = screens[me]
          if (ended[me]) continue
          if (settle[me] !== undefined) {
            if (clock >= settle[me]) ended[me] = rankPlayers(world).map((x) => x.id)
            continue
          }
          const p = world.players.find((x) => x.id === me)
          const commands = p.alive ? { [me]: BOT_STRATEGIES[strat[me]].commands(world, p) } : {}
          stepWorld(world, commands, 1 / 60)
          loop.afterStep(1 / 60)
          check(world, `온라인#${seed}/${me}@${world.time.toFixed(1)}`)
          if (world.over && settle[me] === undefined) {
            loop.finish()
            settle[me] = clock + 900
          }
        }
        if (ids.every((id) => ended[id])) break
      }
      const orders = ids.map((id) => (ended[id] ?? rankPlayers(screens[id].world).map((x) => x.id)).join('>'))
      if (new Set(orders.map((o) => o.split('>')[0])).size > 1) {
        diffWinner += 1
        if (samples.length < 4) samples.push(`#${seed} n=${n} ${ids.map((id, i) => `${id}:${orders[i]}@${screens[id].world.time.toFixed(2)}[${screens[id].world.players.map((x) => `${x.id}${x.alive ? '' : 'X'}${x.hp}`).join(',')}]`).join(' | ')}`)
      }
      if (new Set(orders).size > 1) diffOrder += 1
      if (new Set(ids.map((id) => screens[id].world.players.map((x) => x.alive).join())).size > 1) diffAlive += 1
    }
    expect({ diffWinner, diffOrder, diffAlive, samples }).toEqual({ diffWinner: 0, diffOrder: 0, diffAlive: 0, samples: [] })
    expect([...problems]).toEqual([])
  }, 60000)
})
