import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../../stats/personas'
import { growthOf } from '../../stats/stats'
import { PART_FAMILIES } from '../anatomy'
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

describe('부위 계열 그리기', () => {
  const base = genomeOf(nightCoder(END))
  const withPart = (slot, kind) => ({
    ...base,
    life: { ...base.life, anatomy: { ...base.life.anatomy, [slot]: { kind, strength: 1 } } },
  })

  it('모든 계열을 몸통 8종과 함께 격자 안에 그린다', () => {
    for (const [slot, families] of Object.entries(PART_FAMILIES)) {
      for (const kind of Object.keys(families)) {
        for (const bodyType of Object.keys(BODY_TYPES)) {
          const genome = withPart(slot, kind)
          const sprite = drawMonster({ ...genome, innate: { ...genome.innate, bodyType } })
          for (const [x, y, color] of [...sprite.layers.body, ...sprite.layers.shadow]) {
            expect(x >= 0 && y >= 0 && x < SIZE && y < SIZE).toBe(true)
            expect(sprite.palette[color]).toBeDefined()
          }
        }
      }
    }
  })

  it('떠 있는 유령은 그림자가 작다', () => {
    const shadowWidth = (sprite) => new Set(sprite.layers.shadow.map(([x]) => x)).size
    expect(shadowWidth(drawMonster(withPart('legs', 'ghost')))).toBeLessThan(shadowWidth(drawMonster(withPart('legs', 'biped'))))
  })

  it('계열이 바뀌면 그림이 달라진다', () => {
    for (const [slot, families] of Object.entries(PART_FAMILIES)) {
      const drawings = Object.keys(families).map((kind) => JSON.stringify(drawMonster(withPart(slot, kind)).layers.body))
      expect(new Set(drawings).size).toBe(drawings.length)
    }
  })
})
