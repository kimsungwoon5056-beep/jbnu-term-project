import { drawLine, fillEllipse, fillPolygon, fillRect, getCell, setCell, stamp } from './grid'
import { TAIL_TIPS } from './sprites'

// 부위 계열별 도트 그리기. 모두 격자(grid)에 색 이름으로 칠한다. 외곽선은 부르는 쪽에서 두른다.
// ctx: { cx, cy, rx, ry, R, bottom, ground, life, hx, hy, rh, ryHead, headTopY }
//   cx: 좌우 대칭 중심(칸 경계), cy: 몸 중심, rx·ry: 몸 반지름, bottom: 몸 아래 끝, hx·hy·rh: 머리

const clampX = (x) => Math.max(1, Math.min(46, x))
const BODY_COLORS = new Set(['M', 'L', 'D'])

// ── 날개(몸 뒤) ───────────────────────────────────────────────
export function paintWings(grid, kind, ctx) {
  if (kind === 'none') return
  const { cx, cy, ry, rx, R } = ctx
  if (kind === 'propeller') {
    // 머리 위 축과 날개 2장
    const { hx, headTopY } = ctx
    const top = Math.max(3, headTopY - 4)
    drawLine(grid, hx, headTopY, hx, top, 'q')
    fillRect(grid, hx - 6, top - 1, 5, 2, 'm')
    fillRect(grid, hx + 1, top - 1, 5, 2, 'm')
    fillRect(grid, hx - 1, top - 2, 2, 3, 'X')
    setCell(grid, hx - 6, top - 1, 'q')
    setCell(grid, hx + 5, top, 'q')
    return
  }
  for (const side of [-1, 1]) {
    const sx = cx + side * (rx - 2) - (side < 0 ? 1 : 0)
    const sy = cy - ry + 3
    const span = (kind === 'dragon' ? 9 : kind === 'angel' ? 4 : 7) + Math.round(R * (kind === 'angel' ? 0.3 : 0.45))
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
    } else if (kind === 'feather' || kind === 'angel') {
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
        kind === 'angel' ? 'W' : 'B',
      )
      for (const k of [0.35, 0.6, 0.85]) drawLine(grid, at(k - 0.1), sy, at(k), sy + 3, kind === 'angel' ? 'C' : 'L')
    } else if (kind === 'insect') {
      fillEllipse(grid, at(0.5), sy - 3, span * 0.5, 2.6, 'h')
      fillEllipse(grid, at(0.35), sy + 2, span * 0.36, 2, 'h')
      drawLine(grid, sx, sy - 2, at(0.85), sy - 3, 'A')
    } else if (kind === 'butterfly') {
      // 위아래 두 쌍, 보조 색에 눈알 무늬
      fillEllipse(grid, at(0.55), sy - 3, span * 0.55, 4.2, 'X')
      fillEllipse(grid, at(0.4), sy + 3, span * 0.38, 3, 'X')
      fillEllipse(grid, at(0.62), sy - 3, 1.7, 1.7, 'W')
      setCell(grid, at(0.62), sy - 3, 'P')
      fillEllipse(grid, at(0.42), sy + 3, 1.1, 1.1, 'h')
    } else if (kind === 'leaf') {
      fillPolygon(
        grid,
        [
          [sx, sy],
          [at(0.5), sy - 5],
          [tipX, sy - 3],
          [at(0.65), sy + 3],
          [at(0.25), sy + 2],
        ],
        'g',
      )
      drawLine(grid, sx, sy, tipX - side, sy - 3, 'f')
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
    case 'peacock': {
      // 몸 뒤로 펼친 부채꼴 깃, 가장자리에 눈알 무늬
      const fanY = cy - 1
      fillEllipse(grid, cx, fanY, rx + 7, ry + 7, 'X')
      for (let y = fanY + 2; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) if (getCell(grid, x, y) === 'X') setCell(grid, x, y, null)
      for (let i = 0; i < 7; i += 1) {
        const a = Math.PI * (1.1 + (0.8 * i) / 6)
        const x = Math.round(cx + Math.cos(a) * (rx + 5))
        const y = Math.round(fanY + Math.sin(a) * (ry + 5))
        fillEllipse(grid, x, y, 1.6, 1.6, 'h')
        setCell(grid, x, y, 'P')
      }
      return
    }
    case 'curly': {
      const path = [
        [bx, by],
        [bx + 2, by - 1],
        [bx + 3, by - 3],
        [bx + 2, by - 5],
        [bx, by - 4],
        [bx + 1, by - 2],
      ]
      for (let i = 1; i < path.length; i += 1) drawLine(grid, ...path[i - 1], ...path[i], 'L')
      return
    }
    case 'flame':
      drawLine(grid, bx, by, bx + 3, by - 2, 'M', 2)
      stamp(grid, ['..R..', '.RRR.', 'RRYRR', 'RYYYR', '.RYR.'], bx + 2, by - 7)
      return
    case 'leaf':
      drawLine(grid, bx, by, bx + 5, by - 4, 'g')
      fillEllipse(grid, bx + 6, by - 6, 2.6, 1.7, 'g')
      fillEllipse(grid, bx + 3, by - 4, 1.9, 1.3, 'g')
      setCell(grid, bx + 6, by - 6, 'f')
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
    case 'mane': {
      // 머리 둘레의 들쭉날쭉한 털뭉치
      const { hx, hy, rh, ryHead } = ctx
      fillEllipse(grid, hx, hy, rh + 3, ryHead + 3, 'X')
      const edge = []
      for (let y = 0; y < grid.size; y += 1) {
        for (let x = 0; x < grid.size; x += 1) {
          if (getCell(grid, x, y) !== 'X' || (x + y) % 2) continue
          const open = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => getCell(grid, x + dx, y + dy) === null)
          if (open) edge.push([x, y])
        }
      }
      for (const [x, y] of edge) setCell(grid, x, y, null)
      return
    }
    case 'gears':
      for (const k of [-0.85, 0.8]) {
        const x = Math.round(cx + k * rx)
        const y = shoulderY(x) - 2
        fillEllipse(grid, x, y, 2.6, 2.6, 'm')
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2
          setCell(grid, Math.round(x + Math.cos(a) * 3.3), Math.round(y + Math.sin(a) * 3.3), 'm')
        }
        setCell(grid, x, y, 'q')
      }
      return
    default:
  }
}

// 몸 앞(어깨 위)에 얹는 등 부위: 새싹·버섯·별자리
export function paintBackFront(grid, kind, ctx, bodyTopAt) {
  const { cx, cy, rx, ry } = ctx
  const topAt = (x) => bodyTopAt(x) ?? cy - ry
  switch (kind) {
    case 'sprout': {
      const x = Math.round(cx + rx * 0.6)
      stamp(grid, ['r.r.', '.r..', 'g.gg', '.gg.', '..g.'], x, topAt(x + 1) - 4)
      return
    }
    case 'mushrooms':
      for (const k of [-0.7, 0.55]) {
        const x = Math.round(cx + k * rx)
        const y = topAt(x) + 1
        fillRect(grid, x, y - 2, 2, 2, 'W')
        fillEllipse(grid, x + 1, y - 3, 2.7, 1.7, 'R')
        setCell(grid, x, y - 4, 'W')
        setCell(grid, x + 2, y - 3, 'W')
      }
      return
    case 'stars': {
      // 몸 위쪽의 별자리: 별 세 개를 잇는다.
      const points = [
        [Math.round(cx - rx * 0.5), Math.round(cy - ry * 0.45)],
        [Math.round(cx + rx * 0.1), Math.round(cy - ry * 0.7)],
        [Math.round(cx + rx * 0.55), Math.round(cy - ry * 0.3)],
      ]
      drawLine(grid, ...points[0], ...points[1], 'G')
      drawLine(grid, ...points[1], ...points[2], 'G')
      for (const [x, y] of points) stamp(grid, ['.G.', 'GWG', '.G.'], x - 1, y - 1)
      return
    }
    default:
  }
}

// ── 다리 ──────────────────────────────────────────────────────
// 몸 아래 끝 위치: 다리 계열마다 몸이 뜨는 높이가 다르다.
export function bodyBottomFor(kind, legCells, ground) {
  switch (kind) {
    case 'spider':
    case 'insect':
    case 'crab':
      return ground - 4
    case 'tentacle':
      return ground - 5
    case 'ghost':
      return ground - 6
    case 'cloud':
      return ground - 7
    case 'slime':
      return ground - 2
    case 'frog':
    case 'roots':
      return ground - 3
    default:
      return ground - 1 - legCells
  }
}

export const FLOATING_LEGS = new Set(['ghost', 'cloud'])

// 몸 뒤에 그릴 다리(거미·곤충·게 다리, 네 발 짐승 뒷다리)
export function paintLegsBehind(grid, kind, ctx) {
  const { cx, cy, rx, ground } = ctx
  if (kind === 'spider' || kind === 'insect' || kind === 'crab') {
    const pairs = kind === 'spider' ? 4 : 3
    for (const side of [-1, 1]) {
      for (let k = 0; k < pairs; k += 1) {
        const root = [cx + side * (rx - 2), cy - 1 + k * 2]
        const knee =
          kind === 'spider'
            ? [cx + side * (rx + 3 + k), cy - 5 + k]
            : kind === 'crab'
              ? [cx + side * (rx + 2 + k), cy + k]
              : [cx + side * (rx + 2 + k), cy - 1 + k]
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
  const { cx, cy, rx, bottom, ground, R } = ctx
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
    case 'frog':
      // 굽은 넓적다리 + 큰 물갈퀴 발
      for (const side of [-1, 1]) {
        const tx = cx + side * rx * 0.6
        fillEllipse(grid, tx, bottom - 1, 2.8, 2.3, 'M')
        const footX = side < 0 ? Math.round(tx) - 5 : Math.round(tx)
        drawLine(grid, Math.round(tx), bottom, footX + 2, ground - 2, 'D', 2)
        fillRect(grid, footX, ground - 1, 6, 1, 'D')
        for (const k of [0, 2, 5]) setCell(grid, footX + k, ground - 2, 'D')
      }
      return
    case 'crab':
      // 몸 앞으로 내민 집게
      for (const side of [-1, 1]) {
        const x = side < 0 ? cx - rx - 4 : cx + rx
        stamp(grid, ['XX.X', 'XXXX', '.XX.'], x, cy, { flip: side > 0 })
      }
      return
    case 'roots':
      // 몸 아래에서 갈라져 땅으로 뻗는 뿌리
      for (let i = 0; i < 5; i += 1) {
        const startX = Math.round(cx + (-0.6 + 0.3 * i) * rx)
        const endX = startX + (i - 2) * 2
        drawLine(grid, startX, bottom - 1, endX, ground - 1, 'n')
        drawLine(grid, Math.round((startX + endX) / 2), ground - 2, Math.round((startX + endX) / 2) + (i < 2 ? -2 : 2), ground - 1, 'n')
      }
      return
    case 'cloud':
      // 흰 도트 구름에 올라탄다.
      fillEllipse(grid, cx - 4, bottom + 0.5, 4.5, 2.5, 'W')
      fillEllipse(grid, cx + 4, bottom + 0.5, 4.5, 2.5, 'W')
      fillEllipse(grid, cx, bottom + 1.5, 6.5, 2.5, 'W')
      for (let y = bottom + 2; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) if (getCell(grid, x, y) === 'W') setCell(grid, x, y, 'C')
      return
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

// 유령 꼬리·슬라임 바닥·짐승 몸통은 몸통과 한 덩어리로 칠한다(외곽선 전에).
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

export const LEGS_WITHOUT_ARMS = new Set(['spider', 'insect', 'tentacle', 'beast', 'crab'])

// ── 피부 무늬(몸통·머리 칸 위에) ──────────────────────────────
// 은하·금속판은 피부 색 자체를 바꾸므로 팔·꼬리·다리에도 recolorOnly로 칠한다.
const RECOLOR = {
  galaxy: { M: 'v', L: 'V', D: 'v' },
  plates: { M: 'm', L: 'c', D: 'q' },
}

export function paintSkin(grid, kind, { recolorOnly = false } = {}) {
  if (kind === 'plain') return
  const cells = []
  for (let y = 0; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) if (BODY_COLORS.has(getCell(grid, x, y))) cells.push([x, y])
  if (cells.length === 0) return
  const recolor = RECOLOR[kind]
  if (recolor) for (const [x, y] of cells) setCell(grid, x, y, recolor[getCell(grid, x, y)])
  if (recolorOnly) return
  const top = Math.min(...cells.map(([, y]) => y))
  const left = Math.min(...cells.map(([x]) => x))
  const onSkin = (x, y) => {
    const color = getCell(grid, x, y)
    return BODY_COLORS.has(color) || (recolor && Object.values(recolor).includes(color))
  }
  const mark = (x, y, color) => {
    if (onSkin(x, y)) setCell(grid, x, y, color)
  }
  for (const [x, y] of cells) {
    switch (kind) {
      case 'stripes':
        if ((y - top + Math.round(Math.sin(x * 0.7))) % 4 === 0) mark(x, y, 'D')
        break
      case 'spots':
        if (x % 5 === 0 && (y + (Math.floor(x / 5) % 2) * 2) % 4 === 0) {
          mark(x, y, 'X')
          mark(x + 1, y, 'X')
          mark(x, y + 1, 'X')
          mark(x + 1, y + 1, 'X')
        }
        break
      case 'scales':
        if (y % 3 === 0 && (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0) {
          mark(x - 1, y, 'D')
          mark(x, y + 1, 'D')
          mark(x + 1, y, 'D')
        }
        break
      case 'fur':
        if ((x * 3 + y * 5) % 7 === 0) mark(x, y, 'L')
        else if ((x * 5 + y * 3) % 11 === 0) mark(x, y, 'D')
        break
      case 'galaxy':
        if ((x * 7 + y * 11) % 13 === 0) mark(x, y, 'W')
        else if ((x * 5 + y * 3) % 17 === 0) mark(x, y, 'h')
        break
      case 'plates': {
        const row = Math.floor((y - top) / 5)
        if ((y - top) % 5 === 0 || (x - left + (row % 2) * 3) % 6 === 0) mark(x, y, 'q')
        else if ((y - top) % 5 === 1 && (x - left + (row % 2) * 3) % 6 === 1) mark(x, y, 'W')
        break
      }
      default:
    }
  }
}

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
    case 'tusks':
      // 입꼬리에서 위로 휜 엄니
      fillRect(grid, hx - 2, my, 4, 1, 'o')
      for (const [x, y] of [
        [hx - 3, my],
        [hx - 4, my - 1],
        [hx - 4, my - 2],
        [hx + 2, my],
        [hx + 3, my - 1],
        [hx + 3, my - 2],
      ])
        setCell(grid, x, y, 'W')
      return true
    case 'whiskers':
      setCell(grid, hx - 1, my - 1, 'r')
      setCell(grid, hx, my - 1, 'r')
      setCell(grid, hx - 1, my, 'o')
      setCell(grid, hx, my, 'o')
      for (const dy of [-1, 0, 1]) {
        drawLine(grid, hx - 3, my + dy, hx - 6, my + dy * 2, 'o')
        drawLine(grid, hx + 2, my + dy, hx + 5, my + dy * 2, 'o')
      }
      return true
    case 'tongue':
      fillRect(grid, hx - 2, my, 4, 1, 'o')
      setCell(grid, hx - 3, my - 1, 'o')
      setCell(grid, hx + 2, my - 1, 'o')
      fillRect(grid, hx - 1, my + 1, 2, big ? 3 : 2, 'r')
      return true
    case 'trunk':
      fillRect(grid, hx - 1, my - 2, 2, big ? 6 : 5, 'L')
      setCell(grid, hx + 1, my + (big ? 3 : 2), 'L')
      setCell(grid, hx + 2, my + (big ? 2 : 1), 'L')
      setCell(grid, hx - 1, my, 'D')
      setCell(grid, hx, my + 2, 'D')
      return true
    default:
      return false
  }
}
