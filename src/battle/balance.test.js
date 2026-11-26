import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { BOT_STRATEGIES } from './bot'
import { buildLoadout } from './loadout'
import { seededRandom } from './pool'
import { createWorld, MATCH_SECONDS, rankPlayers, stepWorld } from './world'

// 균형 실험(느려서 평소에는 건너뜀): $env:BALANCE='1'; npx.cmd vitest run src/battle/balance.test.js
// 봇끼리 판을 돌려 인원별 판 길이와 앱 유형(무기·기술)별 승률을 표로 찍는다. 앱 유형은 고르게 섞고, 디톡스는 폰을 덜 쓴 사람(건강 높음)이다.
const ARCH = ['messenger', 'feed', 'video', 'music', 'game', 'webtoon', 'shopping', 'finance', 'study']
const KEYS = ['detox', ...ARCH]
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadoutOf = (key, rng, name) => {
  const health = key === 'detox' ? 70 + Math.round(rng() * 30) : 20 + Math.round(rng() * 60)
  const grafts = key === 'detox' ? [] : [{ slot: 'hair', icon: null, archetype: key }]
  return buildLoadout({ state: { tier: 'mid', grafts, scene: 'home', health: { percent: health, known: { phone: true } }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })
}

function play(seed, count) {
  const rng = seededRandom(seed * 104729)
  const players = Array.from({ length: count }, (_, i) => {
    const key = KEYS[Math.floor(rng() * KEYS.length)]
    return { id: `p${i}`, loadout: loadoutOf(key, rng, `p${i}`), local: true, bot: true }
  })
  const names = Object.keys(BOT_STRATEGIES)
  const strat = Object.fromEntries(players.map((p) => [p.id, BOT_STRATEGIES[names[Math.floor(rng() * names.length)]]]))
  const world = createWorld({ players, seed })
  while (!world.over) {
    const commands = Object.fromEntries(world.players.filter((p) => p.alive).map((p) => [p.id, strat[p.id].commands(world, p)]))
    stepWorld(world, commands, 1 / 60)
  }
  return { time: world.time, winner: rankPlayers(world)[0], players: world.players }
}

describe.runIf(process.env.BALANCE)('균형 실험', () => {
  it('인원별 판 길이와 앱 유형별 승률', () => {
    const rows = []
    for (const [count, matches] of [
      [2, Number(process.env.BALANCE_N2 ?? 200)],
      [3, Number(process.env.BALANCE_N3 ?? 120)],
      [4, Number(process.env.BALANCE_N4 ?? 120)],
    ]) {
      const lengths = []
      const wins = {}
      const plays = {}
      for (let seed = 1; seed <= matches; seed += 1) {
        const result = play(seed + count * 10000, count)
        lengths.push(result.time)
        for (const p of result.players) {
          plays[p.loadout.skill] = (plays[p.loadout.skill] ?? 0) + 1
          wins[p.loadout.skill] = (wins[p.loadout.skill] ?? 0) + (result.winner.id === p.id ? 1 : 0)
        }
      }
      lengths.sort((a, b) => a - b)
      const rate = (key) => (plays[key] ? Math.round((100 * wins[key]) / plays[key]) : '-')
      rows.push(
        `${count}인 ${matches}판: 중앙값 ${lengths[Math.floor(lengths.length / 2)].toFixed(0)}초, 5분 안에 끝남 ${Math.round((100 * lengths.filter((t) => t < MATCH_SECONDS - 0.5).length) / lengths.length)}% | ` +
          KEYS.map((key) => `${key} ${rate(key)}%`).join(' '),
      )
    }
    console.log(rows.join('\n'))
    expect(rows).toHaveLength(3)
  }, 1200000)
})
