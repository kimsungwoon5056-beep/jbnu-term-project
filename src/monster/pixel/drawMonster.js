import { paintBody } from './bodies'
import {
  addOutline,
  createGrid,
  drawLine,
  fillEllipse,
  fillPolygon,
  fillRect,
  getCell,
  overlay,
  setCell,
  shade,
  SIZE,
  stamp,
  toPixels,
} from './grid'
import { pixelPalette } from './palette'
import { CROWN, EARS, EYE_WHITES, GLOVE, HABIT_PATTERNS, HORN_TOPS, HORN_TOPS_MINI, MOSS, MOUTHS, SPARKLE, TAIL_TIPS } from './sprites'

// 유전자 → 48×48 도트 몬스터.
// 부품마다 따로 칠하고 외곽선을 둘러 겹친다. 그래서 몸과 머리, 팔다리 사이에도 경계선이 생긴다.
// 돌려주는 값: { size, palette, layers: { shadow, body, blink } }
//   shadow: 바닥 그림자(움직이지 않음), body: 몬스터, blink: 눈 감은 칸(깜빡일 때만 보임)

const GROUND = 44
const clamp01 = (value) => Math.min(1, Math.max(0, value))
const BODY_COLORS = new Set(['M', 'L', 'D'])

function part(paint, { outline = true, shading = false } = {}) {
  const grid = createGrid()
  const result = paint(grid)
  if (shading) shade(grid)
  if (outline) addOutline(grid)
  return { grid, result }
}

function topAt(grid, x) {
  for (let y = 0; y < grid.size; y += 1) if (getCell(grid, x, y) !== null) return y
  return null
}

export function drawMonster(genome) {
  const { innate, life } = genome
  const palette = pixelPalette(innate, life)
  if (!life) return { size: SIZE, palette, layers: drawEgg(innate) }

  const main = createGrid()
  const t = clamp01((life.bodyRadius - 40) / 30)
  const R = Math.max(5, Math.round((7 + 4 * t) * genome.sizeScale))
  const legCells = Math.max(1, Math.round((1 + (life.legLength / 36) * 5) * genome.sizeScale))
  const cx = 23

  // 몸통을 먼저 재서 위치를 정한다.
  const bodyPart = part((grid) => paintBody(grid, innate.bodyType, { cx, cy: 0, R, innate }), { outline: false })
  const { rx, ry, cap } = bodyPart.result
  const bottom = GROUND - 1 - legCells
  const cy = bottom - ry

  const rh = Math.max(4, Math.round(R * life.headRatio * 0.82))
  const ryHead = Math.max(4, Math.round(rh * 0.9))
  const hx = cx
  const hy = cy - ry - Math.round(rh * 0.3)

  // 오라: 연속 기록이면 몬스터 둘레에 반짝이
  if (life.aura) {
    const spots = [
      [5, 12],
      [40, 10],
      [3, 30],
      [42, 28],
      [9, 4],
      [35, 38],
      [2, 20],
      [43, 19],
    ]
    spots.slice(0, life.aura === 1 ? 4 : 8).forEach(([x, y]) => stamp(main, SPARKLE, x, y))
  }

  // 꼬리
  const tail = part(
    (grid) => {
      const joints = life.tailJoints
      const wave = ((joints - 2) / 6) * 2
      const [sx, sy] = [cx + rx - 2, cy + 1]
      let previous = [sx, sy]
      for (let i = 1; i <= joints; i += 1) {
        const k = i / joints
        const point = [sx + Math.round(8 * k), sy - Math.round(9 * k * k) + Math.round(Math.sin(k * Math.PI * (joints / 2)) * wave)]
        drawLine(grid, previous[0], previous[1], point[0], point[1], 'M', 2)
        previous = point
      }
      const tip = TAIL_TIPS[life.tailTip]
      stamp(grid, tip, previous[0] - 1, previous[1] - Math.floor(tip.length / 2))
    },
    { shading: true },
  )
  overlay(main, tail.grid)

  const legWidth = R >= 9 ? 3 : 2
  const drawLegs = (offset) =>
    part((grid) => {
      for (const side of [-1, 1]) {
        const x = side < 0 ? cx - offset - legWidth : cx + offset
        fillRect(grid, x, bottom - 2, legWidth, GROUND - 1 - (bottom - 2), 'D')
        fillRect(grid, side < 0 ? x - 1 : x, GROUND - 1, legWidth + 1, 1, 'D')
      }
    })
  if (life.legCount === 4) overlay(main, drawLegs(Math.max(2, Math.round(rx * 0.72))).grid)

  // 몸통 + 배 + 습관 무늬
  const body = part(
    (grid) => {
      paintBody(grid, innate.bodyType, { cx, cy, R, innate })
      shade(grid)
      const bellyRx = Math.max(2, Math.round(rx * (0.45 + 0.15 * life.belly)))
      const bellyRy = Math.max(2, Math.round(ry * (0.42 + 0.12 * life.belly)))
      const belly = createGrid()
      fillEllipse(belly, cx, cy + ry * 0.35, bellyRx, bellyRy, 'B')
      belly.cells.forEach((color, i) => {
        if (color && BODY_COLORS.has(grid.cells[i])) grid.cells[i] = 'B'
      })
      life.patterns.forEach((pattern, i) => {
        const template = HABIT_PATTERNS[pattern.kind]
        const x = Math.round(cx - rx + 2 + pattern.spot * Math.max(1, 2 * rx - 6))
        const y = Math.round(cy - ry + 2 + (i % 2) * 2)
        const mark = createGrid()
        stamp(mark, template, x, y, { legend: { X: pattern.opacity >= 0.6 ? 'X' : 'D' } })
        mark.cells.forEach((color, j) => {
          if (color && BODY_COLORS.has(grid.cells[j])) grid.cells[j] = color
        })
      })
    },
    { outline: true },
  )
  overlay(main, body.grid)

  overlay(main, drawLegs(Math.max(1, Math.round(rx * 0.35))).grid)

  // 팔(근력 운동이면 굵고, 많이 하면 장갑)
  const armWidth = 1 + Math.round(((life.armWidth - 4) / 14) * 2)
  const arms = part(
    (grid) => {
      for (const side of [-1, 1]) {
        const sx = side < 0 ? cx - rx + 1 : cx + rx - 2
        const sy = cy - 1
        const ex = sx + side * (2 + armWidth)
        const ey = sy + 3
        drawLine(grid, sx, sy, ex, ey, 'M', armWidth)
        if (life.glove) stamp(grid, GLOVE, side < 0 ? ex - 3 : ex, ey - 1, { flip: side > 0 })
      }
    },
    { shading: true },
  )
  overlay(main, arms.grid)

  // 귀 → 머리 → 버섯 갓 → 뿔
  const ear = EARS[innate.earType]
  const earWidth = ear[0].length
  const ears = part((grid) => {
    let left
    let top
    if (innate.earType === 'fin') [left, top] = [hx - rh - earWidth + 2, hy - 1]
    else [left, top] = [hx - Math.round(rh * 0.65) - earWidth + 1, hy - ryHead - ear.length + 2]
    stamp(grid, ear, left, top)
    stamp(grid, ear, 2 * hx - left - earWidth, top, { flip: true })
  })
  overlay(main, ears.grid)

  const head = part((grid) => fillEllipse(grid, hx, hy, rh, ryHead, 'M'), { shading: true })
  overlay(main, head.grid)

  if (cap) {
    const capPart = part((grid) => {
      const capTop = hy - Math.round(ryHead * 0.25)
      fillEllipse(grid, hx, capTop, Math.round(rh * 1.45), Math.round(ryHead * 0.95), 'X')
      for (let y = capTop; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) setCell(grid, x, y, null)
      for (const [dx, dy] of [
        [-0.6, -0.35],
        [0.1, -0.7],
        [0.65, -0.3],
      ]) {
        fillRect(grid, Math.round(hx + dx * rh), Math.round(capTop + dy * ryHead), 2, 2, 'W')
      }
    })
    overlay(main, capPart.grid)
  }

  const headTop = (x) => topAt(main, x) ?? hy - ryHead
  if (life.aura === 'crown') stamp(main, CROWN, hx - 2, headTop(hx) - 3)

  drawHorns(main, life.horns, { hx, rh, headTop })
  const blink = drawEyes(main, { innate, life, hx, hy, rh })
  drawMouth(main, { life, hx, hy, rh })

  // 이끼: 기록을 빠뜨린 날만큼 어깨에
  const mossCount = Math.min(5, life.moss)
  for (let i = 0; i < mossCount; i += 1) {
    const x = Math.round(cx - rx + 1 + ((i + 0.5) / mossCount) * (2 * rx - 4))
    const top = topAt(body.grid, x + 1)
    if (top !== null) stamp(main, MOSS, x, top - 1)
  }

  const shadow = createGrid()
  fillEllipse(shadow, cx, GROUND + 0.5, rx + 1, 1.3, 'S')

  return { size: SIZE, palette, layers: { shadow: toPixels(shadow), body: toPixels(main), blink } }
}

function drawHorns(main, horns, { hx, rh, headTop }) {
  if (horns.length === 0) return
  const grid = createGrid()
  const crowded = horns.length >= 3
  const tops = crowded ? HORN_TOPS_MINI : HORN_TOPS
  const spread = Math.round(rh * (crowded ? 0.95 : 0.62))
  horns.forEach((horn, i) => {
    const bx = horns.length === 1 ? hx : Math.round(hx - spread + (2 * spread * i) / (horns.length - 1))
    const by = headTop(bx)
    const lean = horns.length > 2 && (i === 0 || i === horns.length - 1) ? Math.sign(bx - hx) : 0
    // 붐비면 뿔 높이를 번갈아 달리해 겹치지 않게 한다.
    const total = 3 + Math.round(clamp01((horn.length - 8) / 26) * 6) + (crowded && i % 2 ? 3 : 0)
    if (horn.kind === 'prism') {
      const height = Math.min(total + 1, by - 1)
      fillPolygon(grid, [[bx - 2, by + 1], [bx + 2, by + 1], [bx + 0.5 + lean * 2, by - height]], 'H')
      return
    }
    const top = tops[horn.kind]
    const topHeight = top ? top.length : 5
    const stalk = Math.max(1, Math.min(total - Math.floor(topHeight / 2), by - topHeight - 1))
    const [tx, ty] = [bx + lean, by - stalk]
    drawLine(grid, bx, by, tx, ty, 'T')
    if (top) {
      const width = top[0].length
      stamp(grid, top, tx - Math.floor(width / 2), ty - topHeight)
    } else {
      // 사전에 없는 과목: 꼭짓점 수가 다른 다각형
      const radius = 2.6
      const points = Array.from({ length: horn.sides }, (_, k) => {
        const a = ((horn.twist - 90) * Math.PI) / 180 + (k / horn.sides) * Math.PI * 2
        return [tx + 0.5 + Math.cos(a) * radius, ty - 2.5 + Math.sin(a) * radius]
      })
      fillPolygon(grid, points, 'H')
    }
  })
  addOutline(grid)
  overlay(main, grid)
}

// 눈을 그리고, 깜빡일 때 덮을 칸 목록을 돌려준다.
function drawEyes(main, { innate, life, hx, hy, rh }) {
  const big = rh >= 6
  const shape = innate.eyeShape
  const gap = Math.max(1, Math.round(rh * 0.18))
  const eyes = []
  if (shape === 'cyclops') {
    const white = EYE_WHITES.cyclops[big ? 'big' : 'small']
    eyes.push({ white, x: hx - Math.floor(white[0].length / 2), y: hy - Math.floor(white.length / 2) - 1 })
  } else if (shape === 'compound') {
    for (const side of [-1, 1]) {
      for (const [dx, dy] of [
        [gap, -2],
        [gap + 3, 0],
        [gap, 2],
      ]) {
        eyes.push({ white: EYE_WHITES.compound.big, x: side < 0 ? hx - dx - 2 : hx + dx, y: hy + dy - 1 })
      }
    }
  } else {
    const white = shape === 'dot' ? null : EYE_WHITES[shape][big ? 'big' : 'small']
    const width = white ? white[0].length : big ? 2 : 1
    const height = white ? white.length : 2
    for (const side of [-1, 1]) eyes.push({ white, width, height, x: side < 0 ? hx - gap - width : hx + gap, y: hy - Math.floor(height / 2) - 1 })
  }

  const grid = createGrid()
  const blink = []
  for (const eye of eyes) {
    const width = eye.white ? eye.white[0].length : eye.width
    const height = eye.white ? eye.white.length : eye.height
    const slit = life.pupilSlit > 0.55
    if (eye.white) {
      stamp(grid, eye.white, eye.x, eye.y)
      // 눈동자: 새벽형이면 세로로 가는 고양이 눈동자
      const pw = slit || width <= 2 ? 1 : 2
      const ph = slit ? Math.max(2, height - 1) : Math.min(2, height)
      const px = eye.x + Math.floor((width - pw) / 2) + (width % 2 === 0 && pw === 1 ? 0 : 0)
      const py = eye.y + Math.max(0, height - ph - (height > 2 ? 1 : 0))
      fillRect(grid, px, py, pw, ph, 'P')
      if (!slit && pw === 2 && ph === 2) setCell(grid, px, py, 'W')
      // 졸린 눈꺼풀: 수면이 부족할수록 위에서부터 덮는다.
      const lidRows = Math.round(height * life.eyelid)
      for (let y = 0; y < lidRows; y += 1) {
        for (let x = 0; x < width; x += 1) if (getCell(grid, eye.x + x, eye.y + y)) setCell(grid, eye.x + x, eye.y + y, 'D')
      }
    } else {
      fillRect(main, eye.x, eye.y, eye.width, eye.height, 'P')
      if (life.eyelid > 0.35) fillRect(main, eye.x - 1, eye.y - 1, eye.width + 2, 1, 'o')
    }
    const middle = eye.y + Math.floor(height / 2)
    for (let y = eye.y - 1; y <= eye.y + height; y += 1) for (let x = eye.x - 1; x <= eye.x + width; x += 1) blink.push([x, y, 'M'])
    for (let x = eye.x; x < eye.x + width; x += 1) blink.push([x, middle, 'o'])
    // 다크서클: 새벽형 + 수면 부족
    if (life.darkCircle > 0.25) {
      const rows = life.darkCircle > 0.55 ? 2 : 1
      for (let r = 0; r < rows; r += 1) {
        for (let x = eye.x; x < eye.x + width; x += 1) {
          const y = eye.y + height + 1 + r
          if (BODY_COLORS.has(getCell(main, x, y))) setCell(main, x, y, 'K')
        }
      }
    }
  }
  addOutline(grid)
  overlay(main, grid)
  return blink
}

function drawMouth(main, { life, hx, hy, rh }) {
  const big = rh >= 6
  const kind = life.mouth > 0.25 ? 'smile' : life.mouth < -0.25 ? 'frown' : 'flat'
  const template = MOUTHS[kind][big ? 'big' : 'small']
  const width = template[0].length
  const x0 = hx - Math.floor(width / 2) - (width % 2)
  const y0 = hy + Math.round(rh * 0.42)
  stamp(main, template, x0, y0)
  const teethY = y0 + template.length
  if (life.teeth < 0.15) {
    setCell(main, x0 + 1, teethY, 'W')
    setCell(main, x0 + width - 2, teethY, 'W')
  } else {
    // 끼니가 불규칙할수록 이빨이 들쭉날쭉
    for (let i = 0; i < width; i += 2) {
      setCell(main, x0 + i, teethY, 'W')
      if (life.teeth > 0.5 && i % 4 === 0) setCell(main, x0 + i, teethY + 1, 'W')
    }
  }
  if (life.mouth > 0.4) {
    const cheekY = y0 - 1
    fillRect(main, hx - Math.round(rh * 0.78) - 1, cheekY, 2, 1, 'r')
    fillRect(main, hx + Math.round(rh * 0.78) - 1, cheekY, 2, 1, 'r')
  }
}

// 알: 타고난 색과 껍질 무늬만 보인다.
function drawEgg(innate) {
  const [cx, top, bottom, cy, rx] = [24, 15, 43, 31, 10]
  const egg = createGrid()
  for (let y = top; y < bottom; y += 1) {
    const upper = y < cy
    const v = (y + 0.5 - cy) / (upper ? cy - top : bottom - cy)
    const narrow = upper ? 0.72 + (0.28 * (y - top)) / (cy - top) : 1
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - v * v)) * narrow)
    if (half > 0) fillRect(egg, cx - half, y, half * 2, 1, 'M')
  }
  const marks = createGrid()
  switch (innate.shellPattern) {
    case 'spots':
      for (const [x, y, r] of [
        [20, 22, 2],
        [28, 28, 2.6],
        [21, 35, 2],
        [29, 38, 1.5],
      ])
        fillEllipse(marks, x, y, r, r, 'E')
      break
    case 'zigzag':
      for (let x = cx - rx, k = 0; x < cx + rx; x += 3, k += 1) drawLine(marks, x, cy + (k % 2 ? -2 : 1), x + 3, cy + (k % 2 ? 1 : -2), 'E', 2)
      break
    case 'stripes':
      fillRect(marks, 0, cy - 7, SIZE, 2, 'E')
      fillRect(marks, 0, cy + 3, SIZE, 2, 'E')
      break
    default:
      for (const [x, y] of [
        [19, 22],
        [27, 29],
        [20, 36],
      ])
        stamp(marks, SPARKLE, x, y, { legend: { A: 'E' } })
  }
  marks.cells.forEach((color, i) => {
    if (color && egg.cells[i]) egg.cells[i] = color
  })
  shade(egg)
  addOutline(egg)
  const shadow = createGrid()
  fillEllipse(shadow, cx, bottom + 1.5, rx, 1.3, 'S')
  return { shadow: toPixels(shadow), body: toPixels(egg), blink: [] }
}
