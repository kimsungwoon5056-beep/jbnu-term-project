import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { BODY_TYPES, buildGenome, EYE_SHAPES } from './genome'
import MonsterSvg from './MonsterSvg'

const END = '2026-11-15'

describe('MonsterSvg', () => {
  it('시연 인물·성장 단계마다 오류 없이 svg를 그린다', () => {
    for (const make of [nightCoder, morningRunner, weekendRusher]) {
      const { metrics, details } = computeMetrics(make(END), END)
      for (const days of [0, 1, 4, 30]) {
        const html = renderToString(<MonsterSvg genome={buildGenome('u1', metrics, details, growthOf(days))} label="몬스터" />)
        expect(html).toMatch(/^<svg/)
        expect(html).toContain('aria-label="몬스터"')
        expect(html).not.toContain('NaN')
      }
    }
  })

  it('몸통 8종·눈 6종을 모두 그릴 수 있다', () => {
    const { metrics, details } = computeMetrics(weekendRusher(END), END)
    const base = buildGenome('u2', metrics, details, growthOf(30))
    for (const bodyType of Object.keys(BODY_TYPES)) {
      for (const eyeShape of Object.keys(EYE_SHAPES)) {
        const genome = { ...base, innate: { ...base.innate, bodyType, eyeShape } }
        const html = renderToString(<MonsterSvg genome={genome} label="x" />)
        expect(html).not.toContain('NaN')
      }
    }
  })
})
