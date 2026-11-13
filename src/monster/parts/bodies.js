import { polarPoints, polygonPath, roundedRectPath, smoothPath } from './geometry'
import { hashString, seededRandom } from '../random'

// 몸통 8종. 모두 중심 (100, 120), 기준 반지름 R로 그린다.
// rx·ry는 부품 연결점(머리·팔·다리·꼬리)을 정하는 기준 크기다.
export const BODY_CENTER = { x: 100, y: 120 }

const shapes = {
  jelly: (R, asymmetry) => ({
    path: smoothPath(
      polarPoints({
        ...center(R, 1, 0.92),
        count: 24,
        asymmetry,
        radiusAt: (a) => 1 + 0.05 * Math.sin(3 * a + 0.5) - (Math.sin(a) > 0 ? 0.04 : 0),
      }),
    ),
    rx: R,
    ry: R * 0.92,
  }),
  rock: (R, asymmetry, seed) => {
    const random = seededRandom(seed)
    const jitter = Array.from({ length: 9 }, () => 0.88 + random() * 0.22)
    return {
      path: polygonPath(
        polarPoints({ ...center(R, 1.02, 0.9), count: 9, asymmetry, radiusAt: (a) => jitter[Math.round((a / (Math.PI * 2)) * 9) % 9] }),
      ),
      rx: R,
      ry: R * 0.9,
    }
  },
  spiky: (R, asymmetry) => ({
    path: polygonPath(
      polarPoints({ ...center(R, 1, 1), count: 16, asymmetry, radiusAt: (a) => (Math.round((a / (Math.PI * 2)) * 16) % 2 ? 1.22 : 0.9) }),
    ),
    rx: R * 0.95,
    ry: R * 0.95,
  }),
  snake: (R, asymmetry) => ({
    path: smoothPath(polarPoints({ ...center(R, 1.32, 0.68), count: 24, asymmetry, radiusAt: (a) => 1 + 0.06 * Math.sin(2 * a) })),
    rx: R * 1.32,
    ry: R * 0.68,
  }),
  cloud: (R, asymmetry) => ({
    path: smoothPath(
      polarPoints({ ...center(R, 1.08, 0.88), count: 40, asymmetry, radiusAt: (a) => 0.94 + 0.1 * Math.abs(Math.sin(4 * a)) }),
    ),
    rx: R * 1.08,
    ry: R * 0.88,
  }),
  mushroom: (R) => ({
    path: roundedRectPath(BODY_CENTER.x, BODY_CENTER.y, R * 0.72, R * 0.9, R * 0.4),
    rx: R * 0.72,
    ry: R * 0.9,
    cap: true,
  }),
  drop: (R, asymmetry) => ({
    path: smoothPath(
      polarPoints({
        ...center(R, 0.95, 0.95),
        count: 28,
        asymmetry,
        radiusAt: (a) => 1 + 0.42 * Math.max(0, -Math.sin(a)) ** 6,
      }),
    ),
    rx: R * 0.95,
    ry: R * 0.95,
  }),
  box: (R) => ({
    path: roundedRectPath(BODY_CENTER.x, BODY_CENTER.y, R * 0.95, R * 0.82, 10),
    rx: R * 0.95,
    ry: R * 0.82,
  }),
}

function center(R, xScale, yScale) {
  return { cx: BODY_CENTER.x, cy: BODY_CENTER.y, rx: R * xScale, ry: R * yScale }
}

export function bodyShape(type, R, innate) {
  const seed = hashString(`body:${type}:${innate.hue}`)
  const shape = (shapes[type] ?? shapes.jelly)(R, innate.asymmetry, seed)
  const { x: cx, y: cy } = BODY_CENTER
  return {
    ...shape,
    cx,
    cy,
    top: cy - shape.ry,
    bottom: cy + shape.ry,
  }
}
