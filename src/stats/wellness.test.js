import { describe, expect, it } from 'vitest'
import { addDays } from '../records/dateKey'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { computeMetrics } from './metrics'
import { morningRunner, nightCoder, weekendRusher } from './personas'
import { computeStats, PROBLEMS, wellnessOf } from './stats'

const END = '2026-11-15'
const week = (makeDay) => Array.from({ length: 7 }, (_, i) => ({ ...createEmptyRecord(addDays(END, -i)), ...makeDay(i) }))
const phoneOf = (changes) => ({ ...createEmptyPhone(), ...changes })
const statsOf = (records) => {
  const { metrics, details, recordedDays } = computeMetrics(records, END)
  return computeStats(metrics, recordedDays, 30, details.known)
}

describe('건강 배수: 문제가 클수록 몬스터가 약해진다', () => {
  it('같은 꾸준함에서 화면 시간이 길수록 총합이 줄어든다', () => {
    const light = statsOf(week(() => ({ phone: phoneOf({ total: 60 }) })))
    const heavy = statsOf(week(() => ({ phone: phoneOf({ total: 420 }) })))
    expect(light.consistency).toBe(heavy.consistency)
    expect(heavy.total).toBeLessThan(light.total)
    expect(heavy.wellness.causes[0].label).toBe('화면 시간')
  })

  it('밤 폰·화면 깨우기·알림·걸음 부족도 총합을 줄인다', () => {
    const base = statsOf(week(() => ({ phone: phoneOf({ total: 60, firstPickup: '07:00' }), steps: 12000 })))
    for (const changes of [
      { phone: phoneOf({ total: 60, firstPickup: '01:00' }), steps: 12000 },
      { phone: phoneOf({ total: 60, firstPickup: '07:00', pickups: 150 }), steps: 12000 },
      { phone: phoneOf({ total: 60, firstPickup: '07:00', notifications: 300 }), steps: 12000 },
      { phone: phoneOf({ total: 60, firstPickup: '07:00' }), steps: 500 },
    ]) {
      expect(statsOf(week(() => changes)).total).toBeLessThan(base.total)
    }
  })

  it('최악이어도 40%까지만 깎인다', () => {
    const worst = { phoneTotal: 1, lateNightPhone: 1, pickups: 1, notifications: 1, steps: 0, sleepLen: 0, lateSnack: 1, mealReg: 0 }
    const { factor } = wellnessOf(worst, 7, { phone: true, steps: true })
    expect(factor).toBeCloseTo(1 - Object.values(PROBLEMS).reduce((sum, problem) => sum + problem.weight, 0))
    expect(factor).toBeGreaterThanOrEqual(0.6)
  })

  it('스마트폰·걸음을 입력하지 않으면 그 항목은 판단하지 않는다', () => {
    const none = statsOf(week(() => ({})))
    expect(none.wellness.factor).toBe(1)
    expect(none.total).toBe(330) // 기존 7일 연속 총합 그대로
  })

  it('잠이 7시간 이상이면 수면 부족 벌점이 없다', () => {
    const { wellness } = statsOf(week(() => ({ sleep: { bedTime: '23:30', wakeTime: '06:45' } })))
    expect(wellness.causes.map((cause) => cause.key)).not.toContain('lowSleep')
    const short = statsOf(week(() => ({ sleep: { bedTime: '02:00', wakeTime: '07:00' } })))
    expect(short.wellness.causes.map((cause) => cause.key)).toContain('lowSleep')
  })

  it('시연 인물: 새벽 코더가 가장 약하고 아침 러너가 가장 건강하다', () => {
    const factor = (make) => statsOf(make(END)).wellness.factor
    expect(factor(nightCoder)).toBeLessThan(factor(weekendRusher))
    expect(factor(weekendRusher)).toBeLessThan(factor(morningRunner))
    expect(factor(morningRunner)).toBeGreaterThan(0.95)
  })

  it('걸음이 많으면 속도가, 게임·공부 앱이 많으면 기술이 커진다', () => {
    const walker = statsOf(week(() => ({ steps: 12000 })))
    const sitter = statsOf(week(() => ({ steps: 2000 })))
    expect(walker.stats.spd).toBeGreaterThan(sitter.stats.spd)
    const gamer = statsOf(week(() => ({ phone: phoneOf({ total: 120, categories: { ...createEmptyPhone().categories, game: 120 } }) })))
    const social = statsOf(week(() => ({ phone: phoneOf({ total: 120, categories: { ...createEmptyPhone().categories, sns: 120 } }) })))
    expect(gamer.stats.skill).toBeGreaterThan(social.stats.skill)
    expect(social.stats.atk).toBeGreaterThan(gamer.stats.atk)
  })
})
