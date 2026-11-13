import { hashString, seededRandom } from '../random'
import { fillEllipse, fillPolygon, fillRect, setCell } from './grid'

// 몸통 8종을 격자에 'M'으로 칠한다. cx는 칸 경계(좌우 대칭의 중심)다.
// 돌려주는 rx·ry는 다리·팔·꼬리를 붙이는 기준 크기다.
const painters = {
  jelly(grid, { cx, cy, R, asym }) {
    const ry = Math.round(R * 0.9)
    fillEllipse(grid, cx, cy, R, ry, 'M', R * (1 + asym))
    fillRect(grid, Math.round(cx - R + 2), cy + ry - 1, Math.round(2 * R - 4), 1, 'M')
    return { rx: R, ry }
  },
  rock(grid, { cx, cy, R, asym, seed }) {
    const random = seededRandom(seed)
    const points = Array.from({ length: 8 }, (_, i) => {
      const angle = ((i * 45 + random() * 16 - 8) * Math.PI) / 180
      const radius = R * (0.86 + random() * 0.2)
      const skew = Math.cos(angle) < 0 ? 1 + asym : 1
      return [cx + Math.cos(angle) * radius * skew, cy + Math.sin(angle) * radius * 0.88]
    })
    fillPolygon(grid, points, 'M')
    return { rx: R, ry: Math.round(R * 0.85) }
  },
  spiky(grid, { cx, cy, R, asym }) {
    const r = R - 1
    fillEllipse(grid, cx, cy, r, r, 'M', r * (1 + asym))
    // 아래쪽(다리 자리)을 뺀 다섯 방향으로 가시
    for (const deg of [180, 225, 270, 315, 0]) {
      const a = (deg * Math.PI) / 180
      const side = (spread) => [cx + Math.cos(a + spread) * (r - 1), cy + Math.sin(a + spread) * (r - 1)]
      fillPolygon(grid, [side(-0.32), side(0.32), [cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4)]], 'M')
    }
    return { rx: r, ry: r }
  },
  snake(grid, { cx, cy, R, asym }) {
    const rx = Math.round(R * 1.35)
    const ry = Math.round(R * 0.62)
    fillEllipse(grid, cx, cy, rx, ry, 'M', rx * (1 + asym))
    fillEllipse(grid, cx - rx + 2, cy + ry - 2, R * 0.5, R * 0.5, 'M') // 뒤쪽 똬리
    return { rx, ry }
  },
  cloud(grid, { cx, cy, R }) {
    for (const [dx, dy, r] of [
      [0, 0, 0.78],
      [-0.58, 0.18, 0.58],
      [0.58, 0.18, 0.58],
      [-0.32, -0.42, 0.52],
      [0.36, -0.38, 0.56],
    ]) {
      fillEllipse(grid, cx + dx * R, cy + dy * R, r * R, r * R, 'M')
    }
    return { rx: Math.round(R * 1.1), ry: Math.round(R * 0.82) }
  },
  mushroom(grid, { cx, cy, R }) {
    const rx = Math.round(R * 0.72)
    const ry = Math.round(R * 0.92)
    fillEllipse(grid, cx, cy, rx, ry, 'M')
    return { rx, ry, cap: true }
  },
  drop(grid, { cx, cy, R, asym }) {
    const ry = Math.round(R * 0.9)
    fillEllipse(grid, cx, cy, R, ry, 'M', R * (1 + asym))
    fillPolygon(
      grid,
      [
        [cx - R * 0.62, cy - ry * 0.45],
        [cx + R * 0.62, cy - ry * 0.45],
        [cx, cy - ry - R * 0.6],
      ],
      'M',
    )
    return { rx: R, ry }
  },
  box(grid, { cx, cy, R }) {
    const rx = R
    const ry = Math.round(R * 0.85)
    const [left, top] = [cx - rx, cy - ry]
    fillRect(grid, left, top, rx * 2, ry * 2, 'M')
    for (const [x, y] of [
      [left, top],
      [left + rx * 2 - 1, top],
      [left, top + ry * 2 - 1],
      [left + rx * 2 - 1, top + ry * 2 - 1],
    ]) {
      setCell(grid, x, y, null)
    }
    return { rx, ry }
  },
}

export function paintBody(grid, type, { cx, cy, R, innate }) {
  const seed = hashString(`body:${type}:${innate.hue}`)
  const painter = painters[type] ?? painters.jelly
  return painter(grid, { cx, cy, R, asym: innate.asymmetry, seed })
}
