import { describe, expect, it } from 'vitest'
import { addOutline, createGrid, drawLine, fillEllipse, getCell, shade, stamp, toPixels } from './grid'

describe('grid', () => {
  it('격자 밖 칸은 무시한다', () => {
    const grid = createGrid(8)
    fillEllipse(grid, 0, 0, 6, 6, 'M')
    for (const [x, y] of toPixels(grid)) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(8)
      expect(y).toBeLessThan(8)
    }
  })

  it('외곽선은 칠한 칸 바로 옆 빈 칸에 1칸으로 생긴다', () => {
    const grid = createGrid(8)
    stamp(grid, ['MM', 'MM'], 3, 3)
    addOutline(grid)
    expect(getCell(grid, 2, 3)).toBe('o')
    expect(getCell(grid, 5, 4)).toBe('o')
    expect(getCell(grid, 3, 2)).toBe('o')
    expect(getCell(grid, 2, 2)).toBeNull() // 대각선은 칠하지 않는다
    expect(getCell(grid, 3, 3)).toBe('M')
  })

  it('명암: 왼쪽 위는 밝고 오른쪽 아래는 어둡다', () => {
    const grid = createGrid(16)
    fillEllipse(grid, 8, 8, 7, 7, 'M')
    shade(grid)
    expect(getCell(grid, 4, 3)).toBe('L')
    expect(getCell(grid, 12, 12)).toBe('D')
  })

  it('선은 양 끝을 모두 칠한다', () => {
    const grid = createGrid(10)
    drawLine(grid, 1, 1, 7, 4, 'X')
    expect(getCell(grid, 1, 1)).toBe('X')
    expect(getCell(grid, 7, 4)).toBe('X')
  })

  it('찍기는 좌우 뒤집기를 지원한다', () => {
    const grid = createGrid(6)
    stamp(grid, ['A.', 'AB'], 0, 0, { flip: true })
    expect(getCell(grid, 1, 0)).toBe('A')
    expect(getCell(grid, 0, 1)).toBe('B')
  })
})
