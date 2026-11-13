import { describe, expect, it } from 'vitest'
import { formatDateLabel, formatMinutes } from './recordFormat'

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
