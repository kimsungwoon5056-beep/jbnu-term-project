import { describe, expect, it } from 'vitest'
import { ICON_PALETTE, ICONS, iconSprite, timeOfDay } from './icons'

describe('도트 아이콘', () => {
  it('모든 아이콘은 12×12이고 팔레트에 있는 색만 쓴다', () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      expect(rows, name).toHaveLength(12)
      for (const row of rows) {
        expect(row.length, `${name}: ${row}`).toBe(12)
        for (const char of row) if (char !== '.') expect(ICON_PALETTE[char], `${name} ${char}`).toBeDefined()
      }
      expect(iconSprite(name).layers.body.length).toBeGreaterThan(10)
    }
  })
})

describe('timeOfDay', () => {
  // 한국 시간 = UTC + 9
  const at = (kstHour) => new Date(Date.UTC(2026, 10, 14, (kstHour - 9 + 24) % 24))
  it('한국 시간 기준으로 아침·낮·저녁·밤을 나눈다', () => {
    expect(timeOfDay(at(7))).toBe('morning')
    expect(timeOfDay(at(13))).toBe('day')
    expect(timeOfDay(at(18))).toBe('evening')
    expect(timeOfDay(at(23))).toBe('night')
    expect(timeOfDay(at(3))).toBe('night')
  })
})
