// 도트 그림 격자. 칸마다 색 이름(팔레트 키) 하나를 담는다. null은 빈 칸.
export const SIZE = 48

export function createGrid(size = SIZE) {
  return { size, cells: new Array(size * size).fill(null) }
}

const inside = (grid, x, y) => x >= 0 && y >= 0 && x < grid.size && y < grid.size

export function getCell(grid, x, y) {
  return inside(grid, x, y) ? grid.cells[y * grid.size + x] : null
}

export function setCell(grid, x, y, color) {
  if (inside(grid, x, y)) grid.cells[y * grid.size + x] = color
}

export function fillRect(grid, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setCell(grid, xx, yy, color)
}

// 칸 중심이 타원 안에 들면 칠한다. 왼쪽·오른쪽 반지름을 따로 줄 수 있다(비대칭).
export function fillEllipse(grid, cx, cy, rx, ry, color, rxLeft = rx) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) {
    for (let x = Math.floor(cx - rxLeft - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
      const dx = x + 0.5 - cx
      const r = dx < 0 ? rxLeft : rx
      if ((dx / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) setCell(grid, x, y, color)
    }
  }
}

export function fillPolygon(grid, points, color) {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) setCell(grid, x, y, color)
    }
  }
}

function pointInPolygon(px, py, points) {
  let inPolygon = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inPolygon = !inPolygon
  }
  return inPolygon
}

// Bresenham 선. thickness만큼 네모 붓으로 칠한다.
export function drawLine(grid, x0, y0, x1, y1, color, thickness = 1) {
  let [x, y] = [Math.round(x0), Math.round(y0)]
  const [tx, ty] = [Math.round(x1), Math.round(y1)]
  const dx = Math.abs(tx - x)
  const dy = -Math.abs(ty - y)
  const sx = x < tx ? 1 : -1
  const sy = y < ty ? 1 : -1
  let err = dx + dy
  const half = Math.floor((thickness - 1) / 2)
  for (;;) {
    fillRect(grid, x - half, y - half, thickness, thickness, color)
    if (x === tx && y === ty) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

// 글자로 적은 도트 그림을 찍는다. '.'과 공백은 건너뛴다. legend로 글자 → 색 이름을 바꿀 수 있다.
export function stamp(grid, rows, ox, oy, { legend = {}, flip = false } = {}) {
  const width = Math.max(...rows.map((row) => row.length))
  rows.forEach((row, dy) => {
    ;[...row].forEach((char, dx) => {
      if (char === '.' || char === ' ') return
      const x = flip ? ox + (width - 1 - dx) : ox + dx
      setCell(grid, x, oy + dy, legend[char] ?? char)
    })
  })
}

// 칠한 칸 바로 옆(상하좌우) 빈 칸을 외곽선으로 칠한다. 도트 게임의 진한 1칸 테두리.
export function addOutline(grid, outlineColor = 'o') {
  const toPaint = []
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      if (getCell(grid, x, y) !== null) continue
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const neighbor = getCell(grid, x + dx, y + dy)
        return neighbor !== null && neighbor !== outlineColor
      })
      if (touches) toPaint.push([x, y])
    }
  }
  for (const [x, y] of toPaint) setCell(grid, x, y, outlineColor)
  return grid
}

// 왼쪽 위는 밝게, 오른쪽 아래는 어둡게. 경계는 체크무늬로 섞는다(디더링).
export function shade(grid, { from = 'M', light = 'L', dark = 'D' } = {}) {
  const cells = []
  for (let y = 0; y < grid.size; y += 1) for (let x = 0; x < grid.size; x += 1) if (getCell(grid, x, y) === from) cells.push([x, y])
  if (cells.length === 0) return grid
  const xs = cells.map(([x]) => x)
  const ys = cells.map(([, y]) => y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  for (const [x, y] of cells) {
    const s = (x - minX) / w + (y - minY) / h // 0(왼쪽 위) ~ 2(오른쪽 아래)
    const checker = (x + y) % 2 === 0
    if (s < 0.55 || (s < 0.72 && checker)) setCell(grid, x, y, light)
    else if (s > 1.5 || (s > 1.32 && checker)) setCell(grid, x, y, dark)
  }
  return grid
}

// 위 격자를 아래 격자에 겹친다(빈 칸은 그대로 둔다).
export function overlay(base, top) {
  top.cells.forEach((color, i) => {
    if (color !== null) base.cells[i] = color
  })
  return base
}

export function toPixels(grid) {
  const pixels = []
  grid.cells.forEach((color, i) => {
    if (color !== null) pixels.push([i % grid.size, Math.floor(i / grid.size), color])
  })
  return pixels
}

export function shiftPixels(pixels, dx, dy) {
  return pixels.map(([x, y, color]) => [x + dx, y + dy, color])
}
