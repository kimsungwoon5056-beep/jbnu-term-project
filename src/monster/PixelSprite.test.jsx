import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../stats/metrics'
import { nightCoder } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { buildGenome } from './genome'
import { drawMonster } from './pixel/drawMonster'
import PixelSprite from './PixelSprite'
import { toRuns } from './pixel/runs'

describe('toRuns', () => {
  it('같은 줄에서 이어진 같은 색 칸을 하나로 합친다', () => {
    const runs = toRuns([
      [0, 0, 'M'],
      [1, 0, 'M'],
      [2, 0, 'o'],
      [4, 0, 'o'],
      [0, 1, 'M'],
    ])
    expect(runs).toEqual([
      { x: 0, y: 0, width: 2, color: 'M' },
      { x: 2, y: 0, width: 1, color: 'o' },
      { x: 4, y: 0, width: 1, color: 'o' },
      { x: 0, y: 1, width: 1, color: 'M' },
    ])
  })
})

describe('PixelSprite', () => {
  it('또렷한 도트 svg를 그리고 NaN이 없다', () => {
    const END = '2026-11-15'
    const { metrics, details } = computeMetrics(nightCoder(END), END)
    for (const days of [0, 1, 30]) {
      const sprite = drawMonster(buildGenome('u', metrics, details, growthOf(days)))
      const html = renderToString(<PixelSprite sprite={sprite} label="몬스터" scale={4} />)
      expect(html).toMatch(/^<svg/)
      expect(html).toContain('crispEdges')
      expect(html).toContain('width="192"')
      expect(html).not.toContain('NaN')
      expect(html).not.toContain('undefined')
    }
  })
})
