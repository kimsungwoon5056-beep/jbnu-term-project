import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { drawCharacter } from '../character/drawCharacter'
import { characterState } from '../character/state'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import PixelSprite from './PixelSprite'
import { toRuns } from './runs'

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
  const END = '2026-11-15'
  const { metrics, details } = computeTodayMetrics(PERSONAS.nightCoder.make(END), END)
  const sprite = drawCharacter(PERSONAS.nightCoder.look, characterState(metrics, details), { scene: true })

  it('또렷한 도트 svg를 그리고 NaN·undefined가 없다', () => {
    const html = renderToString(<PixelSprite sprite={sprite} label="캐릭터" scale={4} />)
    expect(html).toMatch(/^<svg/)
    expect(html).toContain('crispEdges')
    expect(html).toContain('width="192"')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('부위를 고르면 그 칸만 또렷하게(여러 부위도 함께)', () => {
    const one = renderToString(<PixelSprite sprite={sprite} label="캐릭터" highlight="hair" />)
    expect(one).toContain('sprite-focus')
    const many = renderToString(<PixelSprite sprite={sprite} label="캐릭터" highlight={['hair', 'face']} />)
    expect(many.length).toBeGreaterThan(one.length)
    const none = renderToString(<PixelSprite sprite={sprite} label="캐릭터" />)
    expect(none).not.toContain('sprite-focus')
  })
})
