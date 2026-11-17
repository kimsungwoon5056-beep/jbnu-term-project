import { describe, expect, it } from 'vitest'
import { addDays } from '../records/dateKey'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { healthOf, healthTier, HEALTH_MIN, PROBLEMS } from './health'
import { computeMetrics, computeTodayMetrics } from './metrics'
import { morningRunner, nightCoder, weekendRusher } from './personas'

const END = '2026-11-15'
const dayOf = (age, changes = {}) => ({ ...createEmptyRecord(addDays(END, -age)), ...changes })
const phoneOf = (changes) => ({ ...createEmptyPhone(), ...changes })

describe('computeMetrics', () => {
  it('같은 기록이면 같은 지표, 모든 지표는 0~1', () => {
    expect(computeMetrics(nightCoder(END), END)).toEqual(computeMetrics(nightCoder(END), END))
    for (const records of [nightCoder(END), morningRunner(END), weekendRusher(END)]) {
      for (const value of Object.values(computeMetrics(records, END).metrics)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('스마트폰·걸음 지표만 있다(수면·운동·공부 지표는 지웠다)', () => {
    const { metrics } = computeMetrics(nightCoder(END), END)
    expect(Object.keys(metrics)).toEqual([
      'phoneTotal',
      'snsShare',
      'videoShare',
      'gameShare',
      'studyAppShare',
      'creativeShare',
      'shoppingShare',
      'pickups',
      'notifications',
      'lateNightPhone',
      'steps',
    ])
  })

  it('연속 기록 날 수를 센다', () => {
    const records = [0, 1, 2, 4].map((age) => dayOf(age, { steps: 100 }))
    expect(computeMetrics(records, END).streakDays).toBe(3)
  })
})

describe('오늘 하루', () => {
  it('오늘 기록이 있으면 오늘 하루만 쓴다(어제와 평균하지 않음)', () => {
    const records = [dayOf(0, { phone: phoneOf({ total: 335, firstPickup: '00:03' }) }), dayOf(1, { phone: phoneOf({ total: 30 }) })]
    const today = computeTodayMetrics(records, END)
    expect(today.isToday).toBe(true)
    expect(today.details.raw.phoneTotal).toBe(335)
    expect(today.details.raw.firstPickup).toBe('00:03')
    expect(today.details.raw.span).toBe('today')
    expect(today.metrics.lateNightPhone).toBe(1)
  })

  it('오늘 기록이 없으면 어제 하루, 아무 기록도 없으면 hasRecord가 false', () => {
    const yesterday = computeTodayMetrics([dayOf(1, { steps: 9000 })], END)
    expect(yesterday.isToday).toBe(false)
    expect(yesterday.endKey).toBe(addDays(END, -1))
    expect(yesterday.details.raw.steps).toBe(9000)
    expect(computeTodayMetrics([], END).hasRecord).toBe(false)
  })
})

describe('디지털 건강', () => {
  const known = { phone: true, steps: true }
  const calm = { phoneTotal: 0, lateNightPhone: 0, pickups: 0, notifications: 0, steps: 1 }

  it('가중치 합은 0.9(모든 문제가 최대면 10%), 문제가 없으면 100%', () => {
    expect(Object.values(PROBLEMS).reduce((sum, problem) => sum + problem.weight, 0)).toBeCloseTo(0.9)
    expect(healthOf(calm, known).percent).toBe(100)
  })

  it('항목마다 문제가 커지면 건강이 줄어든다', () => {
    const changes = { phoneTotal: { phoneTotal: 1 }, lowSteps: { steps: 0 }, lateNightPhone: { lateNightPhone: 1 }, pickups: { pickups: 1 }, notifications: { notifications: 1 } }
    for (const [key, change] of Object.entries(changes)) {
      const health = healthOf({ ...calm, ...change }, known)
      expect(health.percent).toBe(100 - PROBLEMS[key].weight * 100)
      expect(health.causes[0].key).toBe(key)
    }
  })

  it('모든 문제가 최대여도 10% 아래로 내려가지 않는다', () => {
    const worst = { phoneTotal: 1, lateNightPhone: 1, pickups: 1, notifications: 1, steps: 0 }
    expect(healthOf(worst, known).percent).toBe(HEALTH_MIN)
  })

  it('입력하지 않은 항목은 판단하지 않는다', () => {
    const worst = { phoneTotal: 1, lateNightPhone: 1, pickups: 1, notifications: 1, steps: 0 }
    expect(healthOf(worst, { phone: false, steps: false }).percent).toBe(100)
    expect(healthOf(worst, { phone: false, steps: true }).percent).toBe(80)
  })

  it('시연 인물: 아침 러너는 건강, 새벽 게이머는 낮음', () => {
    const percentOf = (make) => {
      const { metrics, details } = computeTodayMetrics(make(END), END)
      return healthOf(metrics, details.known).percent
    }
    expect(healthTier(percentOf(morningRunner))).toBe('good')
    expect(healthTier(percentOf(nightCoder))).toBe('low')
    expect(percentOf(weekendRusher)).toBeLessThan(percentOf(morningRunner))
  })
})
