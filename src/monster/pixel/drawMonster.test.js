import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../../stats/personas'
import { growthOf } from '../../stats/stats'
import { BODY_TYPES, buildGenome, EYE_SHAPES } from '../genome'
import { drawMonster } from './drawMonster'
import { SIZE } from './grid'

const END = '2026-11-15'
const genomeOf = (records, days = 30, uid = 'pixel-test') => {
  const { metrics, details } = computeMetrics(records, END)
  return buildGenome(uid, metrics, details, growthOf(days))
}
const cellsOf = (sprite) => new Map(sprite.layers.body.map(([x, y, c]) => [`${x},${y}`, c]))

describe('drawMonster', () => {
  it('같은 유전자면 같은 도트가 나온다', () => {
    expect(drawMonster(genomeOf(nightCoder(END)))).toEqual(drawMonster(genomeOf(nightCoder(END))))
  })

  it('몸통 8종 × 눈 6종 × 성장 단계를 모두 격자 안에 그린다', () => {
    for (const days of [0, 1, 4, 30]) {
      const base = genomeOf(weekendRusher(END), days)
      for (const bodyType of Object.keys(BODY_TYPES)) {
        for (const eyeShape of Object.keys(EYE_SHAPES)) {
          const sprite = drawMonster({ ...base, innate: { ...base.innate, bodyType, eyeShape } })
          const all = [...sprite.layers.shadow, ...sprite.layers.body, ...sprite.layers.blink]
          expect(sprite.layers.body.length).toBeGreaterThan(80)
          for (const [x, y, color] of all) {
            expect(x).toBeGreaterThanOrEqual(0)
            expect(y).toBeGreaterThanOrEqual(0)
            expect(x).toBeLessThan(SIZE)
            expect(y).toBeLessThan(SIZE)
            expect(sprite.palette[color]).toBeDefined()
          }
        }
      }
    }
  })

  it('몸 둘레에 외곽선이 있다', () => {
    const sprite = drawMonster(genomeOf(morningRunner(END)))
    const cells = cellsOf(sprite)
    const outline = [...cells.values()].filter((color) => color === 'o').length
    expect(outline).toBeGreaterThan(40)
    // 가장 왼쪽 칸은 외곽선이거나 반짝이다
    const leftmost = Math.min(...sprite.layers.body.filter(([, , c]) => c !== 'A').map(([x]) => x))
    const leftColors = sprite.layers.body.filter(([x, , c]) => x === leftmost && c !== 'A').map(([, , c]) => c)
    expect(leftColors.every((color) => color === 'o')).toBe(true)
  })

  it('다리가 길수록 몸이 높이 뜬다', () => {
    const base = genomeOf(morningRunner(END))
    const topOf = (legLength) => {
      const sprite = drawMonster({ ...base, life: { ...base.life, legLength, aura: 0, horns: [] } })
      return Math.min(...sprite.layers.body.map(([, y]) => y))
    }
    expect(topOf(36)).toBeLessThan(topOf(0))
  })

  it('뿔이 있으면 뿔 색 칸이 생긴다', () => {
    const coder = drawMonster(genomeOf(nightCoder(END)))
    expect([...cellsOf(coder).values()].filter((c) => c === 'H' || c === 'h').length).toBeGreaterThan(10)
    const base = genomeOf(nightCoder(END))
    const bald = drawMonster({ ...base, life: { ...base.life, horns: [] } })
    expect([...cellsOf(bald).values()].filter((c) => c === 'h').length).toBe(0)
  })

  it('알 단계는 알만 그리고 깜빡임이 없다', () => {
    const egg = drawMonster(genomeOf([], 0))
    expect(egg.layers.blink).toEqual([])
    expect(egg.layers.body.length).toBeGreaterThan(200)
  })
})
