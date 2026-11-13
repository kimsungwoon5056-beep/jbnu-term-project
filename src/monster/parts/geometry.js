// SVG 경로를 만드는 작은 도구들
const r2 = (value) => Math.round(value * 100) / 100

export function polygonPath(points) {
  return `M${points.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' L')} Z`
}

// 점들을 지나는 부드러운 곡선(Catmull-Rom → 3차 베지어)
export function smoothPath(points, closed = true) {
  const n = points.length
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))])
  let d = `M${r2(points[0][0])},${r2(points[0][1])}`
  const segments = closed ? n : n - 1
  for (let i = 0; i < segments; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${r2(c1[0])},${r2(c1[1])} ${r2(c2[0])},${r2(c2[1])} ${r2(p2[0])},${r2(p2[1])}`
  }
  return closed ? `${d} Z` : d
}

// 중심에서 각도별 반지름 함수로 둘레 점을 만든다. 왼쪽 절반은 비대칭만큼 넓힌다.
export function polarPoints({ cx, cy, rx, ry, count, radiusAt = () => 1, asymmetry = 0 }) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    const r = radiusAt(angle)
    const cos = Math.cos(angle)
    const skew = cos < 0 ? 1 + asymmetry : 1
    return [cx + rx * r * cos * skew, cy + ry * r * Math.sin(angle)]
  })
}

export function regularPolygon(cx, cy, radius, sides, rotationDeg = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = ((rotationDeg - 90) * Math.PI) / 180 + (i / sides) * Math.PI * 2
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
  })
}

export function starPoints(cx, cy, outer, inner, tips = 5, rotationDeg = 0) {
  return Array.from({ length: tips * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner
    const angle = ((rotationDeg - 90) * Math.PI) / 180 + (i / (tips * 2)) * Math.PI * 2
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
  })
}

export function roundedRectPath(cx, cy, halfW, halfH, corner) {
  const [l, r, t, b] = [cx - halfW, cx + halfW, cy - halfH, cy + halfH]
  const c = Math.min(corner, halfW, halfH)
  return [
    `M${r2(l + c)},${r2(t)}`,
    `L${r2(r - c)},${r2(t)} Q${r2(r)},${r2(t)} ${r2(r)},${r2(t + c)}`,
    `L${r2(r)},${r2(b - c)} Q${r2(r)},${r2(b)} ${r2(r - c)},${r2(b)}`,
    `L${r2(l + c)},${r2(b)} Q${r2(l)},${r2(b)} ${r2(l)},${r2(b - c)}`,
    `L${r2(l)},${r2(t + c)} Q${r2(l)},${r2(t)} ${r2(l + c)},${r2(t)} Z`,
  ].join(' ')
}
