import { describe, expect, it } from 'vitest'
import { hashString, seededRandom } from './random'

describe('hashString', () => {
  it('같은 글자열은 같은 값, 다른 글자열은 다른 값', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })
})

describe('seededRandom', () => {
  it('같은 시드면 같은 순서로 나오고 값은 0 이상 1 미만이다', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const values = Array.from({ length: 100 }, () => a())
    expect(values).toEqual(Array.from({ length: 100 }, () => b()))
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
