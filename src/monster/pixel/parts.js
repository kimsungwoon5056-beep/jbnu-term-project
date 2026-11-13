import { drawLine, fillEllipse, fillPolygon, fillRect, getCell, setCell, stamp } from './grid'
import { TAIL_TIPS } from './sprites'

// 부위 계열별 도트 그리기. 모두 격자(grid)에 색 이름으로 칠한다. 외곽선은 부르는 쪽에서 두른다.
// ctx: { cx, cy, rx, ry, R, bottom, ground, life }
//   cx: 좌우 대칭 중심(칸 경계), cy: 몸 중심, rx·ry: 몸 반지름, bottom: 몸 아래 끝

const clampX = (x) => Math.max(1, Math.min(46, x))

// ── 날개(몸 뒤) ───────────────────────────────────────────────
export function paintWings(grid, kind, ctx) {
  if (kind === 'none') return
  const { cx, cy, ry, rx, R } = ctx
  for (const side of [-1, 1]) {
    const sx = cx + side * (rx - 2) - (side < 0 ? 1 : 0)
    const sy = cy - ry + 3
    const span = (kind === 'dragon' ? 9 : 7) + Math.round(R * 0.45)
    const tipX = clampX(sx + side * span)
    const at = (k) => sx + side * Math.round(span * k)
    if (kind === 'bat' || kind === 'dragon') {
      const top = kind === 'dragon' ? sy - 8 : sy - 6
      fillPolygon(
        grid,
        [
          [sx, sy],
          [at(0.45), top],
          [tipX, sy - 3],
          [tipX - side, sy + 4],
          [at(0.68), sy + 1],
          [at(0.45), sy + 5],
          [at(0.2), sy + 2],
        ],
        kind === 'dragon' ? 'X' : 'D',
      )
      // 날개 뼈
      drawLine(grid, sx, sy, at(0.45), top, 'o')
      drawLine(grid, at(0.45), top, at(0.68), sy + 1, 'o')
      drawLine(grid, at(0.45), top, at(0.45), sy + 5, 'o')
      if (kind === 'dragon') setCell(grid, at(0.45), top - 1, 'W') // 날개 발톱
    } else if (kind === 'feather') {
      fillPolygon(
        grid,
        [
          [sx, sy],
          [at(0.4), sy - 5],
          [tipX, sy - 4],
          [tipX, sy - 1],
          [at(0.75), sy + 2],
          [at(0.5), sy + 4],
          [at(0.2), sy + 3],
        ],
        'B',
      )
      for (const k of [0.35, 0.6, 0.85]) drawLine(grid, at(k - 0.1), sy, at(k), sy + 3, 'L')
    } else if (kind === 'insect') {
      fillEllipse(grid, at(0.5), sy - 3, span * 0.5, 2.6, 'h')
      fillEllipse(grid, at(0.35), sy + 2, span * 0.36, 2, 'h')
      drawLine(grid, sx, sy - 2, at(0.85), sy - 3, 'A')
    }
  }
}

// ── 꼬리(몸 뒤, 오른쪽) ───────────────────────────────────────
export function paintTail(grid, kind, ctx) {
  const { cx, cy, rx, ry, life } = ctx
  const [bx, by] = [cx + rx - 2, cy + 2]
  switch (kind) {
    case 'none':
      return
    case 'dragon': {
      const points = [
        [bx, by],
        [bx + 4, by + 1],
        [bx + 8, by - 1],
        [bx + 10, by - 5],
      ]
      ;[3, 2, 1].forEach((thickness, i) => drawLine(grid, ...points[i], ...points[i + 1], 'M', thickness))
      for (const [x, y] of [points[1], points[2]]) fillPolygon(grid, [[x - 1, y - 1], [x + 2, y - 1], [x + 0.5, y - 4]], 'H')
      stamp(grid, ['.H.', 'HHH', 'HHH', '.H.'], points[3][0] - 1, points[3][1] - 3)
      return
    }
    case 'stinger': {
      const path = [
        [bx + 1, by - 1],
        [bx + 4, by - 3],
        [bx + 5, by - 7],
        [bx + 4, cy - ry - 1],
        [bx + 1, cy - ry - 3],
      ]
      path.forEach(([x, y]) => fillEllipse(grid, x, y, 1.7, 1.7, 'M'))
      stamp(grid, ['PP.', '.PP', '..P'], path[4][0] - 3, path[4][1] - 1)
      return
    }
    case 'fluffy':
      for (const [dx, dy, r] of [
        [2, 0, 3.6],
        [5, -3, 3.2],
        [4, -7, 2.6],
      ])
        fillEllipse(grid, bx + dx, by + dy, r, r, 'B')
      setCell(grid, bx + 4, by - 4, 'L')
      setCell(grid, bx + 2, by - 1, 'L')
      return
    case 'fish':
      drawLine(grid, bx, by, bx + 4, by - 1, 'M', 2)
      fillPolygon(
        grid,
        [
          [bx + 4, by - 1],
          [bx + 9, by - 6],
          [bx + 7, by - 1],
          [bx + 9, by + 4],
        ],
        'X',
      )
      return
    case 'bolt':
      drawLine(grid, bx, by, bx + 5, by - 3, 'M', 2)
      stamp(grid, TAIL_TIPS.bolt, bx + 4, by - 8)
      return
    default: {
      // 짧은 꼬리: 꼬리 관절 유전자만큼 굽이친다.
      const joints = life.tailJoints
      const wave = ((joints - 2) / 6) * 2
      let previous = [bx, by]
      for (let i = 1; i <= joints; i += 1) {
        const k = i / joints
        const point = [bx + Math.round(6 * k), by - Math.round(7 * k * k) + Math.round(Math.sin(k * Math.PI * (joints / 2)) * wave)]
        drawLine(grid, previous[0], previous[1], point[0], point[1], 'M', 2)
        previous = point
      }
      stamp(grid, TAIL_TIPS.round, previous[0] - 1, previous[1] - 1)
    }
  }
}

// ── 등(몸 뒤에서 위로 삐져나옴) ───────────────────────────────
export function paintBackBehind(grid, kind, ctx, bodyTopAt) {
  const { cx, cy, rx, ry } = ctx
  // 머리에 가리지 않도록 어깨 바깥쪽(몸 가장자리 근처)에 세운다.
  const shoulderY = (x) => (bodyTopAt(x) ?? cy - ry) + 2
  switch (kind) {
    case 'spikes':
      for (const k of [-0.9, -0.62, 0.62, 0.9]) {
        const x = Math.round(cx + k * rx)
        const y = shoulderY(x)
        const lean = Math.sign(k) * 2
        fillPolygon(grid, [[x - 1.5, y], [x + 2.5, y], [x + 0.5 + lean, y - 6]], 'H')
      }
      return
    case 'shell':
      // 몸보다 넓은 등껍질이 양옆으로 테두리처럼 보인다.
      fillEllipse(grid, cx, cy - 1, rx + 3, ry + 2, 'X')
      for (let x = cx - rx - 3; x <= cx + rx + 3; x += 3) for (let y = cy - ry - 3; y <= cy + ry + 2; y += 3) if (getCell(grid, x, y) === 'X') setCell(grid, x, y, 'D')
      return
    case 'crystal':
      for (const [k, h] of [
        [-0.85, 6],
        [0.55, 5],
        [0.9, 7],
      ]) {
        const x = Math.round(cx + k * rx)
        const y = shoulderY(x)
        fillPolygon(grid, [[x - 1.5, y], [x + 0.5, y - h], [x + 2.5, y], [x + 0.5, y + 1]], 'h')
        setCell(grid, x, y - Math.round(h / 2), 'A')
      }
      return
    case 'sail': {
      // 몸보다 넓은 부채꼴 지느러미(위쪽 반)
      const baseY = cy - Math.round(ry * 0.2)
      fillEllipse(grid, cx, baseY, rx * 1.35, ry + 4, 'X')
      for (let y = baseY; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) if (getCell(grid, x, y) === 'X') setCell(grid, x, y, null)
      for (const k of [-1.1, -0.6, 0.6, 1.1]) drawLine(grid, cx + Math.round(k * rx * 0.5), baseY - 1, cx + Math.round(k * rx), baseY - ry - 2, 'o')
      return
    }
    default:
  }
}

// 새싹은 몸 앞(어깨 위)에 얹는다.
export function paintBackFront(grid, kind, ctx, bodyTopAt) {
  if (kind !== 'sprout') return
  const { cx, cy, rx, ry } = ctx
  const x = Math.round(cx + rx * 0.6)
  const y = (bodyTopAt(x + 1) ?? cy - ry) - 4
  stamp(grid, ['r.r.', '.r..', 'g.gg', '.gg.', '..g.'], x, y)
}

// ── 다리 ──────────────────────────────────────────────────────
// 몸 아래 끝 위치: 다리 계열마다 몸이 뜨는 높이가 다르다.
export function bodyBottomFor(kind, legCells, ground) {
  switch (kind) {
    case 'spider':
    case 'insect':
      return ground - 4
    case 'tentacle':
      return ground - 5
    case 'ghost':
      return ground - 6
    case 'slime':
      return ground - 2
    default:
      return ground - 1 - legCells
  }
}

// 몸 뒤에 그릴 다리(거미·곤충 다리, 네 발 짐승 뒷다리)
export function paintLegsBehind(grid, kind, ctx) {
  const { cx, cy, rx, ground } = ctx
  if (kind === 'spider' || kind === 'insect') {
    const pairs = kind === 'spider' ? 4 : 3
    for (const side of [-1, 1]) {
      for (let k = 0; k < pairs; k += 1) {
        const root = [cx + side * (rx - 2), cy - 1 + k * 2]
        const knee = kind === 'spider' ? [cx + side * (rx + 3 + k), cy - 5 + k] : [cx + side * (rx + 2 + k), cy - 1 + k]
        const foot = [clampX(cx + side * (rx + 4 + k * 2)), ground - 1]
        drawLine(grid, ...root, ...knee, 'D')
        drawLine(grid, ...knee, ...foot, 'D')
      }
    }
  } else if (kind === 'beast') {
    // 뒷다리는 몸통 양 끝, 조금 어둡게
    paintPillarLegs(grid, ctx, Math.round(rx * 1.05), 3, 'D', true)
  }
}

// 몸 앞에 그릴 다리
export function paintLegsFront(grid, kind, ctx) {
  const { cx, rx, bottom, ground, R } = ctx
  switch (kind) {
    case 'biped':
      paintPillarLegs(grid, ctx, Math.max(1, Math.round(rx * 0.35)), R >= 9 ? 3 : 2, 'D')
      return
    case 'beast':
      paintPillarLegs(grid, ctx, Math.max(2, Math.round(rx * 0.45)), 3, 'M', true)
      return
    case 'bird':
      for (const side of [-1, 1]) {
        const x = side < 0 ? cx - Math.max(2, Math.round(rx * 0.35)) - 1 : cx + Math.max(2, Math.round(rx * 0.35))
        drawLine(grid, x, bottom - 1, x, ground - 2, 'Y')
        fillRect(grid, x - 1, ground - 1, 3, 1, 'Y')
        setCell(grid, x - side * 2, ground - 1, 'Y')
      }
      return
    case 'tentacle': {
      const count = 4
      for (let i = 0; i < count; i += 1) {
        const baseX = Math.round(cx + (-0.6 + (1.2 * i) / (count - 1)) * rx)
        const outward = baseX < cx ? -1 : 1
        let previous = [baseX, bottom - 1]
        for (let y = bottom; y <= ground - 1; y += 1) {
          const x = baseX + Math.round(Math.sin((y - bottom) * 0.9 + i) * 1.2) + (y === ground - 1 ? outward : 0)
          drawLine(grid, previous[0], previous[1], x, y, 'M', 2)
          previous = [x, y]
        }
      }
      return
    }
    default:
  }
}

function paintPillarLegs(grid, ctx, offset, width, color, claws = false) {
  const { cx, bottom, ground } = ctx
  for (const side of [-1, 1]) {
    const x = side < 0 ? cx - offset - width : cx + offset
    fillRect(grid, x, bottom - 2, width, ground - 1 - (bottom - 2), color)
    fillRect(grid, side < 0 ? x - 1 : x, ground - 1, width + 1, 1, color)
    // 짐승 발톱
    if (claws) for (let k = 0; k < width + 1; k += 2) setCell(grid, (side < 0 ? x - 1 : x) + k, ground - 1, 'W')
  }
}

// 유령 꼬리·슬라임 바닥은 몸통과 한 덩어리로 칠한다(외곽선 전에).
export function paintLowerBody(grid, kind, ctx) {
  const { cx, cy, rx, ry, bottom, ground } = ctx
  if (kind === 'beast') {
    // 네 발 짐승: 몸통을 옆으로 길게 늘인다.
    fillEllipse(grid, cx, cy + Math.round(ry * 0.25), rx * 1.4, ry * 0.75, 'M')
  } else if (kind === 'ghost') {
    for (let x = cx - rx + 1; x < cx + rx - 1; x += 1) {
      const length = 3 + ((((x - cx) % 4) + 4) % 4 < 2 ? 1 : 0)
      fillRect(grid, x, bottom - 2, 1, length + 1, 'M')
    }
  } else if (kind === 'slime') {
    fillEllipse(grid, cx, ground - 1, rx + 3, 1.7, 'M')
    for (const dx of [-rx + 1, 2, rx - 2]) fillRect(grid, Math.round(cx + dx), bottom - 2, 1, 3, 'M')
  }
}

export const LEGS_WITHOUT_ARMS = new Set(['spider', 'insect', 'tentacle', 'beast'])

// ── 입·턱(얼굴 위) ────────────────────────────────────────────
// 기본 입이면 false를 돌려주고 부르는 쪽이 기존 입을 그린다.
export function paintJaw(grid, kind, { hx, my, rh }) {
  const big = rh >= 5
  switch (kind) {
    case 'beak':
      stamp(grid, big ? ['YYYYY', '.YYY.', '..Y..'] : ['YYY', '.Y.'], hx - (big ? 3 : 2), my - 1)
      return true
    case 'fangs':
      fillRect(grid, hx - 2, my, 4, 1, 'o')
      fillRect(grid, hx - 2, my + 1, 1, big ? 3 : 2, 'W')
      fillRect(grid, hx + 1, my + 1, 1, big ? 3 : 2, 'W')
      return true
    case 'mandible':
      for (const side of [-1, 1]) {
        const x = side < 0 ? hx - 3 : hx + 2
        setCell(grid, x, my, 'D')
        setCell(grid, x + side, my + 1, 'D')
        setCell(grid, x + side, my + 2, 'D')
        setCell(grid, x, my + 3, 'D')
      }
      setCell(grid, hx - 1, my + 1, 'o')
      return true
    case 'snout':
      fillEllipse(grid, hx, my + 0.5, big ? 3 : 2.2, 1.8, 'L')
      setCell(grid, hx - 2, my, 'o')
      setCell(grid, hx + 1, my, 'o')
      setCell(grid, hx - 1, my + 2, 'W')
      setCell(grid, hx, my + 2, 'W')
      return true
    case 'maw': {
      const half = big ? 3 : 2
      fillRect(grid, hx - half, my - 1, half * 2, 3, 'P')
      for (let x = hx - half; x < hx + half; x += 2) setCell(grid, x, my - 1, 'W')
      for (let x = hx - half + 1; x < hx + half; x += 2) setCell(grid, x, my + 1, 'W')
      setCell(grid, hx - 1, my + 1, 'r')
      setCell(grid, hx, my + 1, 'r')
      return true
    }
    default:
      return false
  }
}
