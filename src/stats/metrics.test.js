import { describe, expect, it } from 'vitest'
import { createEmptyRecord } from '../records/record'
import { computeMetrics } from './metrics'
import { morningRunner, nightCoder, weekendRusher } from './personas'

// 2026-11-15는 일요일. 창은 11-09(월)~11-15(일)
const END = '2026-11-15'

describe('computeMetrics', () => {
  it('같은 기록이면 같은 지표가 나온다', () => {
    expect(computeMetrics(nightCoder(END), END)).toEqual(computeMetrics(nightCoder(END), END))
  })

  it('모든 지표는 0~1 사이다', () => {
    for (const records of [nightCoder(END), morningRunner(END), weekendRusher(END)]) {
      for (const value of Object.values(computeMetrics(records, END).metrics)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('새벽 코더: 야행성·공부량·야식이 높고 수면량·규칙성이 낮다', () => {
    const { metrics } = computeMetrics(nightCoder(END), END)
    expect(metrics.nightOwl).toBeGreaterThan(0.7)
    expect(metrics.sleepLen).toBeLessThan(0.35)
    expect(metrics.sleepReg).toBeLessThan(0.7)
    expect(metrics.studyTotal).toBeGreaterThan(0.9)
    expect(metrics.lateSnack).toBeGreaterThan(0.6)
  })

  it('아침 러너: 유산소 비율 1, 취침이 규칙적이고 기분이 좋다', () => {
    const { metrics } = computeMetrics(morningRunner(END), END)
    expect(metrics.cardio).toBe(1)
    expect(metrics.power).toBe(0)
    expect(metrics.sleepReg).toBeGreaterThan(0.9)
    expect(metrics.nightOwl).toBeLessThan(0.3)
    expect(metrics.moodAvg).toBeGreaterThan(0.6)
    expect(metrics.habitDone).toBe(1)
  })

  it('주말 몰아치기: 주말 비중·근력·과목 다양성·기분 변동이 높다', () => {
    const { metrics } = computeMetrics(weekendRusher(END), END)
    expect(metrics.weekendRush).toBe(1)
    expect(metrics.power).toBe(1)
    expect(metrics.studySpread).toBeGreaterThan(0.8)
    expect(metrics.moodSwing).toBeGreaterThan(0.6)
  })

  it('자정을 넘긴 취침(23:30, 00:30)도 1시간 차이로 본다', () => {
    const records = [
      { ...createEmptyRecord('2026-11-15'), sleep: { bedTime: '23:30', wakeTime: '07:00' } },
      { ...createEmptyRecord('2026-11-14'), sleep: { bedTime: '00:30', wakeTime: '08:00' } },
    ]
    expect(computeMetrics(records, END).metrics.sleepReg).toBeGreaterThan(0.5)
  })

  it('최근 날일수록 비중이 크다', () => {
    const run = (dateKey) => ({ ...createEmptyRecord(dateKey), workouts: [{ type: 'running', minutes: 60 }] })
    const recent = computeMetrics([run('2026-11-15')], END).metrics.exTotal
    const old = computeMetrics([run('2026-11-09')], END).metrics.exTotal
    expect(recent).toBeGreaterThan(old)
  })

  it('기록이 없으면 대부분 0이고 공백은 1이다', () => {
    const { metrics, recordedDays } = computeMetrics([], END)
    expect(recordedDays).toBe(0)
    expect(metrics.gap).toBe(1)
    expect(metrics.exTotal).toBe(0)
    expect(metrics.moodAvg).toBe(0)
  })

  it('연속 기록은 끝 날짜부터 거꾸로 센다', () => {
    const records = ['2026-11-15', '2026-11-14', '2026-11-12'].map(createEmptyRecord)
    expect(computeMetrics(records, END).streakDays).toBe(2)
    expect(computeMetrics(records, '2026-11-13').streakDays).toBe(0)
  })
})

describe('computeMetrics details', () => {
  it('과목별 주간 공부 분과 습관 완료율을 돌려준다', () => {
    const { details } = computeMetrics(nightCoder(END), END)
    expect(details.subjects['코딩']).toBeGreaterThan(details.subjects['수학'])
    expect(computeMetrics(morningRunner(END), END).details.habits).toEqual([{ name: '스트레칭 5분', rate: 1 }])
  })
})
