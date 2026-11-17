import { describe, expect, it } from 'vitest'
import { explainParts } from '../monster/partReasons'
import { buildGenome } from '../monster/genome'
import { addDays } from '../records/dateKey'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { computeTodayMetrics } from './metrics'
import { computeStats, growthOf } from './stats'

const TODAY = '2026-11-17'
const dayOf = (age, changes = {}) => ({ ...createEmptyRecord(addDays(TODAY, -age)), ...changes })
const heavyPhone = {
  ...createEmptyPhone(),
  total: 335,
  categories: { ...createEmptyPhone().categories, sns: 260, video: 45, study: 6 },
  topApps: [
    { name: 'Instagram', minutes: 158 },
    { name: '카카오톡', minutes: 77 },
    { name: 'YouTube', minutes: 45 },
  ],
  pickups: 60,
  firstPickup: '00:03',
  notifications: 131,
}

describe('오늘 하루의 몬스터', () => {
  it('오늘 기록이 있으면 오늘 하루만으로 모습·건강을 정한다(지난 날의 폰 사용은 섞지 않음)', () => {
    const records = [dayOf(0, { phone: heavyPhone, steps: 38 }), dayOf(1, { phone: { ...createEmptyPhone(), total: 30 } }), dayOf(2)]
    const today = computeTodayMetrics(records, TODAY)
    expect(today.isToday).toBe(true)
    expect(today.endKey).toBe(TODAY)
    expect(today.details.raw.phoneTotal).toBe(335) // 어제 30분과 평균하지 않음
    expect(today.details.raw.span).toBe('today')
    expect(today.metrics.lateNightPhone).toBe(1)
  })

  it('꾸준함·연속 기록·공백은 최근 7일로 센다', () => {
    const records = [0, 1, 2].map((age) => dayOf(age))
    const today = computeTodayMetrics(records, TODAY)
    expect(today.weekRecordedDays).toBe(3)
    expect(today.metrics.streak).toBeCloseTo(3 / 14)
    expect(today.metrics.gap).toBeCloseTo(4 / 7)
  })

  it('오늘 기록이 없으면 어제 하루로 보여 준다', () => {
    const today = computeTodayMetrics([dayOf(1, { steps: 9000 })], TODAY)
    expect(today.isToday).toBe(false)
    expect(today.endKey).toBe(addDays(TODAY, -1))
    expect(today.details.raw.steps).toBe(9000)
  })

  it('하루로 알 수 없는 취침 규칙성·주말 몰아치기는 중간값', () => {
    const { metrics } = computeTodayMetrics([dayOf(0)], TODAY)
    expect(metrics.sleepReg).toBe(0.5)
    expect(metrics.weekendRush).toBeCloseTo(2 / 7)
  })

  it('저장한 오늘 기록이 바로 앱 조각·건강·설명에 드러난다("오늘" 문장)', () => {
    const records = [dayOf(0, { phone: heavyPhone, steps: 38 }), ...[1, 2, 3, 4, 5, 6].map((age) => dayOf(age))]
    const { metrics, details, weekRecordedDays } = computeTodayMetrics(records, TODAY)
    const result = computeStats(metrics, weekRecordedDays, 7, details.known)
    expect(result.wellness.factor).toBeLessThan(0.8)
    const genome = buildGenome('today-test', metrics, details, growthOf(7))
    expect(genome.life.grafts.map((graft) => graft.icon ?? graft.archetype)).toEqual(['instagram', 'messenger', 'video'])
    const entries = explainParts(genome, metrics, details)
    const text = entries.map((entry) => entry.reason).join(' ')
    expect(entries.find((entry) => entry.key === 'graftHead').reason).toContain('Instagram 오늘 2시간 38분')
    expect(text).toContain('오늘 화면 시간 5시간 35분')
    expect(text).not.toContain('하루 평균')
    expect(text).not.toMatch(/7일 중 \d+일/)
  })
})
