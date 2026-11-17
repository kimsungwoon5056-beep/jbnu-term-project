import { describe, expect, it } from 'vitest'
import { formatDateLabel, formatMinutes, formatShort, formatSteps, visibleRecords } from './recordFormat'

describe('formatMinutes', () => {
  it('시간과 분으로 나눠 보여 준다', () => {
    expect(formatMinutes(450)).toBe('7시간 30분')
    expect(formatMinutes(60)).toBe('1시간')
    expect(formatMinutes(45)).toBe('45분')
    expect(formatMinutes(0)).toBe('0분')
  })
})

describe('formatDateLabel', () => {
  it('요일과 오늘·어제를 붙인다', () => {
    expect(formatDateLabel('2026-11-14', '2026-11-14')).toBe('11월 14일 (토) · 오늘')
    expect(formatDateLabel('2026-11-13', '2026-11-14')).toBe('11월 13일 (금) · 어제')
    expect(formatDateLabel('2026-11-09', '2026-11-14')).toBe('11월 9일 (월)')
  })
})

describe('formatShort', () => {
  it('목록용 짧은 시간 표시', () => {
    expect(formatShort(450)).toBe('7h30')
    expect(formatShort(60)).toBe('1h')
    expect(formatShort(45)).toBe('45m')
    expect(formatShort(0)).toBe('0')
  })
})

describe('기록 목록 표시', () => {
  it('걸음에 "보"를 붙인다', () => {
    expect(formatSteps(3800)).toBe('3,800보')
    expect(formatSteps(0)).toBe('0보')
  })

  it('스마트폰·걸음이 모두 없는 예전 형식 기록은 목록에서만 숨긴다', () => {
    const records = [
      { date: '2026-11-14', phone: { total: 60 }, steps: null },
      { date: '2026-11-13', phone: null, steps: 0 },
      { date: '2026-11-12', phone: null, steps: null },
      { date: '2026-11-11' },
    ]
    expect(visibleRecords(records).map((record) => record.date)).toEqual(['2026-11-14', '2026-11-13'])
    expect(records).toHaveLength(4)
  })
})
