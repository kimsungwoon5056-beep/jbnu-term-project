import { describe, expect, it } from 'vitest'
import { addDays } from '../records/dateKey'
import { createEmptyRecord } from '../records/record'
import { computeMetrics } from './metrics'
import { morningRunner, nightCoder, weekendRusher } from './personas'
import { allocate, computeStats, growthOf, STAT_KEYS, STAT_MAX, STAT_MIN } from './stats'

const END = '2026-11-15'
const statsFor = (records, totalDays = 30) => {
  const { metrics, recordedDays } = computeMetrics(records, END)
  return computeStats(metrics, recordedDays, totalDays)
}
const sumOf = (stats) => STAT_KEYS.reduce((total, key) => total + stats[key], 0)
const sevenDays = (makeDay) =>
  Array.from({ length: 7 }, (_, i) => ({ ...createEmptyRecord(addDays(END, -i)), ...makeDay(i) }))

describe('allocate', () => {
  it('각 능력치는 20~90이고 합은 총합과 같다', () => {
    const lopsided = { hp: 0.2, atk: 50, spd: 0.2, skill: 0.2, def: 0.2 }
    for (const total of [125, 150, 250, 350]) {
      const stats = allocate(total, lopsided)
      expect(sumOf(stats)).toBe(total)
      for (const key of STAT_KEYS) {
        expect(stats[key]).toBeGreaterThanOrEqual(STAT_MIN)
        expect(stats[key]).toBeLessThanOrEqual(STAT_MAX)
      }
    }
  })

  it('한 항목만 몰아도 상한 90을 넘지 않는다', () => {
    expect(allocate(350, { hp: 0, atk: 100, spd: 0, skill: 0, def: 0 }).atk).toBe(STAT_MAX)
  })
})

describe('growthOf', () => {
  it('기록한 날 수로 성장 단계와 계수를 정한다', () => {
    expect(growthOf(0)).toMatchObject({ stage: 'egg', factor: 0.5 })
    expect(growthOf(1)).toMatchObject({ stage: 'baby', factor: 0.6 })
    expect(growthOf(4).stage).toBe('growing')
    expect(growthOf(7)).toMatchObject({ stage: 'adult', factor: 1 })
    expect(growthOf(100).factor).toBe(1)
  })
})

describe('computeStats', () => {
  it('같은 기록이면 같은 능력치가 나온다', () => {
    expect(statsFor(nightCoder(END))).toEqual(statsFor(nightCoder(END)))
  })

  it('운동만 한 사람과 공부만 한 사람의 총합은 같고 배분만 다르다', () => {
    const runner = statsFor(sevenDays(() => ({ workouts: [{ type: 'running', minutes: 60 }] })))
    const student = statsFor(sevenDays(() => ({ studies: [{ subject: '수학', minutes: 120 }] })))
    expect(runner.total).toBe(student.total)
    expect(runner.stats.spd).toBeGreaterThan(student.stats.spd)
    expect(student.stats.skill).toBeGreaterThan(runner.stats.skill)
  })

  it('운동 시간을 부풀려도 총합은 그대로다', () => {
    const honest = statsFor(sevenDays(() => ({ workouts: [{ type: 'strength', minutes: 30 }] })))
    const inflated = statsFor(sevenDays(() => ({ workouts: [{ type: 'strength', minutes: 300 }] })))
    expect(inflated.total).toBe(honest.total)
    expect(inflated.stats.atk).toBeGreaterThanOrEqual(honest.stats.atk)
  })

  it('꾸준히 기록할수록 총합이 커진다', () => {
    const daily = statsFor(sevenDays(() => ({})))
    const once = statsFor([createEmptyRecord(END)])
    expect(daily.total).toBeGreaterThan(once.total)
    // 7일 연속은 연속 기록 지표 7/14 = 0.5 → 꾸준함 0.8 → 250 + 80
    expect(daily.total).toBe(330)
  })

  it('기록이 없으면 알 단계이고 능력치가 고르게 나뉜다', () => {
    const result = statsFor([], 0)
    expect(result.growth.stage).toBe('egg')
    expect(result.total).toBe(125)
    expect(result.style).toBe('균형')
    expect(Math.max(...Object.values(result.stats)) - Math.min(...Object.values(result.stats))).toBeLessThanOrEqual(1)
  })

  it('시연 인물: 새벽 코더는 술사, 아침 러너는 돌격(속도 높음), 주말 몰아치기는 공격이 높다', () => {
    const coder = statsFor(nightCoder(END))
    const runner = statsFor(morningRunner(END))
    const rusher = statsFor(weekendRusher(END))
    expect(coder.style).toBe('술사')
    expect(runner.style).toBe('돌격')
    expect(runner.stats.spd).toBeGreaterThan(coder.stats.spd)
    expect(rusher.stats.atk).toBeGreaterThan(runner.stats.atk)
    for (const result of [coder, runner, rusher]) expect(sumOf(result.stats)).toBe(result.total)
  })
})
