import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isDateKey, toDateKey } from './dateKey'

describe('toDateKey', () => {
  it('한국 시간 기준 날짜를 돌려준다', () => {
    // UTC 11월 12일 15:30 = 한국 11월 13일 00:30
    expect(toDateKey(new Date('2026-11-12T15:30:00Z'))).toBe('2026-11-13')
    expect(toDateKey(new Date('2026-11-12T14:59:00Z'))).toBe('2026-11-12')
  })
})

describe('isDateKey', () => {
  it('올바른 날짜 키만 인정한다', () => {
    expect(isDateKey('2026-11-13')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-1-3')).toBe(false)
    expect(isDateKey(20261113)).toBe(false)
  })
})

describe('addDays, daysBetween', () => {
  it('달과 해가 바뀌어도 날짜를 더하고 뺀다', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('두 날짜의 차이를 일 단위로 센다', () => {
    expect(daysBetween('2026-11-13', '2026-11-20')).toBe(7)
    expect(daysBetween('2026-11-13', '2026-11-12')).toBe(-1)
  })
})
