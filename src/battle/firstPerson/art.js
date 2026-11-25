import { APP_LOOKS, C, lookKeyOf, lookLabel } from '../../character/appLook'
import { DEFAULT_LOOK, LOOK_OPTIONS } from '../../profile/look'
import { seededRandom } from '../pool'
import { AREA, ARENA, OBSTACLES } from '../world'

// 1인칭 화면의 그림 재료. 모두 이 앱의 그림(폰 화면·앱 아이콘·도트)으로 한 번만 그려 두고 쓴다.
// 세계 1칸 = 벽 텍스처 2px. make(w, h)는 캔버스를 만드는 함수(시험에서는 가짜 캔버스).

export const WALL = { box: 60, outer: 70 } // 벽 높이(세계 단위)
export const TEX = 2 // 텍스처 px / 세계 칸
export const OUTER_TILE = 128 // 바깥벽 무늬가 되풀이되는 폭(세계 단위)
export const STRIP = { y: 23, h: 14, w: 512 } // 바깥벽에 흐르는 알림 띠(위에서 23칸 아래, 높이 14칸, 폭 px)
export const REFLECT = 20 // 바닥에 비치는 높이(세계 단위)
export const PAN = { w: 780, h: 176 } // 하늘 한 바퀴
export const INK = '#14152b'
const FONT = 'Galmuri11, sans-serif'

// 모서리를 한 칸 깎은 도트 사각형
export function pixelBox(ctx, x, y, w, h, fill, cut = 4) {
  ctx.fillStyle = fill
  ctx.fillRect(x + cut, y, w - cut * 2, h)
  ctx.fillRect(x, y + cut, w, h - cut * 2)
  ctx.fillRect(x + cut / 2, y + cut / 2, w - cut, h - cut)
}

// 글자 그림: rows의 '#'(또는 colors에 있는 글자)만 칠한다.
export function pixelArt(ctx, rows, x, y, cell, colors) {
  rows.forEach((row, ry) => {
    ;[...row].forEach((ch, rx) => {
      const color = typeof colors === 'string' ? (ch === '#' ? colors : null) : colors[ch]
      if (!color) return
      ctx.fillStyle = color
      ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell)
    })
  })
}

export const drawLogo = (ctx, logo, x, y, cell) => pixelArt(ctx, logo, x, y, cell, C)

export const ICONS = {
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  bubble: ['.#####.', '#######', '#.#.#.#', '#######', '.####..', '.##....'],
  bell: ['...#...', '..###..', '.#####.', '.#####.', '#######', '...#...'],
  box: ['#######', '#..#..#', '#..#..#', '#######', '#..#..#', '#######'],
  diamond: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  shield: ['#######', '#######', '#######', '.#####.', '.#####.', '..###..', '...#...'],
  question: ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'],
}

// 아이템 아이콘(renderer.js의 ITEM_ART와 같은 그림)
const ITEM_ART = {
  airplane: { color: '#2f6bff', rows: ['...#...', '..###..', '#######', '..###..', '...#...', '..###..'] },
  charger: { color: '#ffb21e', rows: ['....##', '...##.', '..####', '.####.', '..##..', '.##...', '##....'] },
  dnd: { color: '#6b5fd3', rows: ['..###.', '.##...', '##....', '##....', '.##...', '..###.'] },
}
export const ITEM_COLORS = Object.fromEntries(Object.entries(ITEM_ART).map(([kind, art]) => [kind, art.color]))

const BUBBLE_STYLE = {
  chat: { icon: '#fee500', dot: '#3c1e1e', text: 'ㅋㅋㅋ', bar: '#fff4a8' },
  dm: { icon: '#e1306c', dot: '#ffffff', text: 'DM 1', bar: '#ffc4dc' },
  ad: { icon: '#ff1f3d', dot: '#ffffff', text: '광고', bar: '#ffc9c9' },
}

function sheet(make, w, h) {
  const canvas = make(w, h)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  return [canvas, ctx]
}

// 그림을 어둡게 한 사본(옆면)
function shaded(make, source, fill) {
  const [canvas, ctx] = sheet(make, source.width, source.height)
  ctx.drawImage(source, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

// 멀리서 볼 때 쓰는 절반 크기 그림(글자·도트가 지글거리지 않게)
function half(make, source) {
  const [canvas, ctx] = sheet(make, source.width / 2, source.height / 2)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

// 벽 아래쪽을 뒤집어 흐리게 한 그림(유리 바닥에 비친 모습)
function reflection(make, source) {
  const h = REFLECT * TEX
  const [canvas, ctx] = sheet(make, source.width, h)
  for (let y = 0; y < h; y += 1) {
    ctx.globalAlpha = 0.34 * (1 - y / h) ** 1.5
    ctx.drawImage(source, 0, source.height - 1 - y, source.width, 1, 0, y, source.width, 1)
  }
  ctx.globalAlpha = 1
  return canvas
}

// ---------- 벽 ----------

// 우뚝 선 앱 아이콘 한 면: 폭 56칸 × 높이 60칸
function towerTexture(make, key) {
  const w = 56 * TEX
  const h = WALL.box * TEX
  const look = APP_LOOKS[key]
  const [canvas, ctx] = sheet(make, w, h)
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = look.main
  ctx.fillRect(4, 4, w - 8, h - 8)
  if (look.gradient) {
    // 대각선으로 번지는 앱 색(도트 계단)
    for (let y = 4; y < h - 4; y += 4) {
      for (let x = 4; x < w - 4; x += 4) {
        const t = (x + (h - y)) / (w + h)
        ctx.fillStyle = look.gradient[Math.min(look.gradient.length - 1, Math.max(0, Math.floor(t * look.gradient.length + (((x + y) / 4) % 2) * 0.3)))]
        ctx.fillRect(x, y, 4, 4)
      }
    }
  }
  // 위쪽 밝은 테, 왼쪽 밝은 테, 오른쪽·아래 어두운 테
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillRect(8, 4, w - 16, 3)
  ctx.fillRect(4, 8, 3, h - 40)
  ctx.fillStyle = 'rgba(10,8,30,0.28)'
  ctx.fillRect(w - 8, 8, 4, h - 16)
  // 로고 바탕 원판과 로고
  const cell = 13
  const lx = Math.round((w - cell * 5) / 2)
  ctx.fillStyle = 'rgba(10,8,30,0.22)'
  look.logo.forEach((row, ry) => {
    ;[...row].forEach((ch, rx) => {
      if (ch !== '.') ctx.fillRect(lx + rx * cell + 3, 16 + ry * cell + 4, cell, cell)
    })
  })
  drawLogo(ctx, look.logo, lx, 14, cell)
  // 로고 칸마다 안쪽 그림자를 넣어 도트 타일처럼
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  for (let i = 0; i < 5; i += 1) ctx.fillRect(lx, 14 + i * cell, cell * 5, 2)
  ctx.fillStyle = 'rgba(10,8,30,0.1)'
  for (let i = 0; i < 5; i += 1) ctx.fillRect(lx + i * cell + cell - 2, 14, 2, cell * 5)
  // 유리 광택(계단 대각선)
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  for (let y = 4; y < 60; y += 4) ctx.fillRect(4, y, Math.max(0, 58 - y), 4)
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  for (let y = 4; y < 88; y += 4) ctx.fillRect(Math.max(4, 74 - y), y, 8, 4)
  // 이름표 띠
  pixelBox(ctx, 8, h - 34, w - 16, 26, 'rgba(10,8,30,0.82)', 4)
  ctx.font = `24px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(lookLabel(key), w / 2, h - 20)
  // 바닥 빛 줄
  ctx.fillStyle = look.main === C.Z ? look.sub : look.main
  ctx.fillRect(4, h - 5, w - 8, 3)
  // 검은 앱은 배경에 묻히지 않게 밝은 테를 두른다.
  ctx.fillStyle = look.main === C.Z ? look.sub : 'rgba(255,255,255,0.35)'
  ctx.fillRect(0, 0, w, 2)
  ctx.fillRect(0, 0, 2, h)
  ctx.fillRect(w - 2, 0, 2, h)
  return canvas
}

const HUES = {
  n: { main: '#37d5ff', soft: 'rgba(55,213,255,0.28)' },
  s: { main: '#ff6fa8', soft: 'rgba(255,111,168,0.28)' },
  e: { main: '#9d7bff', soft: 'rgba(157,123,255,0.28)' },
  w: { main: '#5f8bff', soft: 'rgba(95,139,255,0.28)' },
}
export const WALL_COLORS = { n: HUES.n.main, s: HUES.s.main, e: HUES.e.main, w: HUES.w.main }

// 바깥벽: 빛나는 폰 유리 테두리. 벽마다 색이 달라 방향을 알 수 있다(북 = 하늘, 남 = 분홍, 동 = 보라, 서 = 파랑).
function glassTexture(make, face) {
  const w = OUTER_TILE * TEX
  const h = WALL.outer * TEX
  const hue = HUES[face]
  const rng = seededRandom(face.charCodeAt(0) * 7919)
  const [canvas, ctx] = sheet(make, w, h)
  const base = ctx.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, '#2a2766')
  base.addColorStop(0.5, '#191a45')
  base.addColorStop(1, '#0d0d28')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  // 유리판 두 장 + 판마다 앱 무늬
  for (let i = 0; i < 2; i += 1) {
    const x = i * 128
    pixelBox(ctx, x + 12, 14, 104, 26, 'rgba(255,255,255,0.05)', 4)
    pixelBox(ctx, x + 12, 82, 104, 40, 'rgba(0,0,10,0.35)', 4)
    const icon = [ICONS.heart, ICONS.bubble, ICONS.bell, ICONS.diamond][(face.charCodeAt(0) + i) % 4]
    pixelArt(ctx, icon, x + 50, 88, 4, hue.soft)
  }
  // 회로 무늬: 씨앗으로 정해진 꺾은선
  ctx.fillStyle = hue.soft
  for (let i = 0; i < 12; i += 1) {
    let x = Math.floor((rng() * w) / 4) * 4
    let y = rng() < 0.5 ? 12 + Math.floor(rng() * 8) * 4 : 80 + Math.floor(rng() * 11) * 4
    for (let k = 0; k < 4; k += 1) {
      const len = (3 + Math.floor(rng() * 6)) * 4
      if (k % 2 === 0) {
        ctx.fillRect(x, y, Math.min(len, w - x), 2)
        x = Math.min(w - 4, x + len)
      } else {
        const up = rng() < 0.5 ? -1 : 1
        const ny = Math.max(10, Math.min(h - 16, y + up * 8))
        ctx.fillRect(x, Math.min(y, ny), 2, Math.abs(ny - y) + 2)
        y = ny
      }
    }
    ctx.fillRect(x - 2, y - 2, 6, 6)
  }
  // 유리에 비친 빛(계단 대각선)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let y = 10; y < h - 12; y += 4) {
    ctx.fillRect((150 - y + w) % w, y, 22, 4)
    ctx.fillRect((262 - y + w) % w, y, 8, 4)
  }
  // 알림 띠가 지나갈 홈
  ctx.fillStyle = '#07071a'
  ctx.fillRect(0, STRIP.y * TEX - 3, w, STRIP.h * TEX + 6)
  ctx.fillStyle = hue.main
  ctx.fillRect(0, STRIP.y * TEX - 4, w, 1)
  ctx.fillRect(0, (STRIP.y + STRIP.h) * TEX + 3, w, 1)
  // 기둥(베젤)
  for (const x of [0, 128]) {
    ctx.fillStyle = '#0a0a20'
    ctx.fillRect(x, 0, 9, STRIP.y * TEX - 4)
    ctx.fillRect(x, (STRIP.y + STRIP.h) * TEX + 4, 9, h)
    ctx.fillStyle = hue.main
    ctx.fillRect(x + 3, 10, 2, STRIP.y * TEX - 16)
    ctx.fillRect(x + 3, (STRIP.y + STRIP.h) * TEX + 8, 2, h - 92)
  }
  // 위 빛 테와 번짐
  ctx.fillStyle = hue.soft
  ctx.fillRect(0, 0, w, 10)
  ctx.fillRect(0, 0, w, 7)
  ctx.fillStyle = hue.main
  ctx.fillRect(0, 0, w, 4)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 1, w, 1)
  // 아래 LED 줄
  ctx.fillStyle = hue.soft
  ctx.fillRect(0, h - 12, w, 12)
  ctx.fillStyle = hue.main
  for (let x = 2; x < w; x += 16) ctx.fillRect(x, h - 7, 10, 3)
  return canvas
}

// 벽에 흐르는 알림 띠. 좌우가 이어지도록 카드 폭을 고정한다.
function stripTexture(make) {
  const h = STRIP.h * TEX
  const [canvas, ctx] = sheet(make, STRIP.w, h)
  const cards = [
    ['#fee500', '새 메시지 300'],
    ['#e1306c', '좋아요 99+'],
    ['#ff1f3d', '다음 영상 재생'],
    ['#4cc96b', '폰 내려놔!'],
  ]
  const w = STRIP.w / cards.length
  ctx.font = `12px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  cards.forEach(([color, text], i) => {
    const x = i * w
    pixelBox(ctx, x + 4, 1, w - 8, h - 2, 'rgba(236,238,255,0.92)', 4)
    pixelBox(ctx, x + 9, 5, 18, 18, color, 4)
    ctx.fillStyle = INK
    ctx.fillRect(x + 14, 10, 8, 6)
    ctx.fillRect(x + 15, 16, 3, 2)
    ctx.fillText(text, x + 32, h / 2 + 1)
  })
  return canvas
}

// ---------- 하늘 ----------
// 좌우가 이어지는 밤하늘 한 바퀴. x = 각도 / 2π × PAN.w
function skyTexture(make) {
  const [canvas, ctx] = sheet(make, PAN.w, PAN.h)
  // 4px 띠로 나눈 해 질 녘(경기장 배경화면과 같은 색)
  const stops = [
    [0, 9, 9, 34],
    [0.35, 30, 24, 78],
    [0.62, 74, 44, 118],
    [0.84, 150, 74, 148],
    [1, 236, 130, 160],
  ]
  for (let y = 0; y < PAN.h; y += 4) {
    const t = y / PAN.h
    let i = 0
    while (i < stops.length - 2 && t > stops[i + 1][0]) i += 1
    const k = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])
    const mixed = [1, 2, 3].map((c) => Math.round(stops[i][c] + (stops[i + 1][c] - stops[i][c]) * k))
    ctx.fillStyle = `rgb(${mixed.join(',')})`
    ctx.fillRect(0, y, PAN.w, 4)
  }
  const rng = seededRandom(20)
  for (let i = 0; i < 260; i += 1) {
    const x = Math.floor(rng() * PAN.w)
    const y = Math.floor(rng() ** 1.4 * (PAN.h - 40))
    const big = rng() < 0.12
    ctx.fillStyle = ['rgba(255,255,255,0.9)', 'rgba(180,200,255,0.6)', 'rgba(255,200,230,0.5)'][i % 3]
    ctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1)
    if (big && i % 4 === 0) {
      ctx.fillRect(x - 2, y, 6, 1)
      ctx.fillRect(x, y - 2, 1, 6)
    }
  }
  // 은하수 대신 떠다니는 데이터 띠
  for (let i = 0; i < 420; i += 1) {
    const x = Math.floor(rng() * PAN.w)
    const y = Math.floor(88 + Math.sin((x / PAN.w) * Math.PI * 4) * 22 + (rng() + rng() - 1) * 22)
    ctx.fillStyle = i % 2 ? 'rgba(150,130,255,0.22)' : 'rgba(110,210,255,0.16)'
    ctx.fillRect(x, y, 2, 2)
  }
  const at = (angle) => Math.round((((angle / (Math.PI * 2)) % 1) + 1) % 1 * PAN.w)
  moon(ctx, at(-Math.PI / 2 + 0.3), 90)
  constellation(ctx, at(-Math.PI / 2 - 0.45), 96, BUBBLE_STARS)
  constellation(ctx, at(0.1), 98, HEART_STARS)
  constellation(ctx, at(Math.PI / 2 + 0.2), 96, BUBBLE_STARS)
  constellation(ctx, at(Math.PI), 98, BELL_STARS)
  // 지평선의 폰 빌딩들(불 켜진 창 = 안 끈 화면)
  for (let i = 0; i < 46; i += 1) {
    const x = Math.floor((i / 46) * PAN.w)
    const bw = 8 + Math.floor(rng() * 11)
    const bh = 22 + Math.floor(rng() * 38)
    ctx.fillStyle = i % 2 ? '#2a1c56' : '#35215f'
    ctx.fillRect(x, PAN.h - bh, bw, bh)
    ctx.fillRect(x + 1, PAN.h - bh - 1, bw - 2, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.fillRect(x + 1, PAN.h - bh + 1, bw - 2, 1)
    for (let wy = PAN.h - bh + 4; wy < PAN.h - 3; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
        if (rng() < 0.6) continue
        ctx.fillStyle = ['#ffd84a', '#7fe7ff', '#ff8ac0'][Math.floor(rng() * 3)]
        ctx.fillRect(wx, wy, 1, 2)
      }
    }
  }
  return canvas
}

// 방해 금지 초승달
function moon(ctx, cx, cy) {
  for (let y = -20; y <= 20; y += 2) {
    for (let x = -20; x <= 20; x += 2) {
      const d = Math.hypot(x, y)
      const cut = Math.hypot(x - 9, y + 6)
      if (d > 19.5) continue
      ctx.fillStyle = cut < 16 ? 'rgba(255,240,200,0.07)' : d > 17 ? '#ffe9a8' : (x + y) % 4 === 0 && d < 15 ? '#f3cf7a' : '#ffdf8a'
      ctx.fillRect(cx + x, cy + y, 2, 2)
    }
  }
  ctx.fillStyle = 'rgba(255,230,160,0.07)'
  for (const r of [26, 32]) {
    for (let a = 0; a < 48; a += 1) ctx.fillRect(Math.round(cx + Math.cos(a * 0.131) * r), Math.round(cy + Math.sin(a * 0.131) * r), 2, 2)
  }
}

const BUBBLE_STARS = [[-46, -18], [-30, -30], [30, -30], [46, -18], [46, 6], [30, 18], [-8, 18], [-26, 34], [-26, 18], [-46, 6]]
const HEART_STARS = [[0, -14], [12, -28], [28, -28], [38, -14], [34, 4], [0, 34], [-34, 4], [-38, -14], [-28, -28], [-12, -28]]
const BELL_STARS = [[0, -34], [18, -24], [24, 2], [36, 18], [-36, 18], [-24, 2], [-18, -24]]

// 별자리: 별 사이를 점선으로 이은 커다란 알림 말풍선·하트·종
function constellation(ctx, cx, cy, stars) {
  stars.forEach(([x, y], i) => {
    const [nx, ny] = stars[(i + 1) % stars.length]
    const steps = Math.max(1, Math.round(Math.hypot(nx - x, ny - y) / 4))
    ctx.fillStyle = 'rgba(185,215,255,0.75)'
    for (let k = 1; k < steps; k += 1) ctx.fillRect((Math.round(cx + x + ((nx - x) * k) / steps) + PAN.w) % PAN.w, Math.round(cy + y + ((ny - y) * k) / steps), 2, 1)
  })
  for (const [x, y] of stars) {
    const px = (cx + x + PAN.w) % PAN.w
    ctx.fillStyle = 'rgba(160,200,255,0.35)'
    ctx.fillRect(px - 2, cy + y, 5, 1)
    ctx.fillRect(px, cy + y - 2, 1, 5)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(px - 1, cy + y - 1, 3, 3)
  }
  if (stars === BUBBLE_STARS) {
    ctx.fillStyle = '#cfe0ff'
    for (const dx of [-16, 0, 16]) ctx.fillRect((cx + dx - 1 + PAN.w) % PAN.w, cy - 7, 3, 3)
  }
}

// ---------- 바닥 ----------
// 홈 화면 배경화면을 위에서 본 그림(세계 1칸 = 1px, AREA 크기)
export function floorTexture(make) {
  const w = AREA.x1 - AREA.x0
  const h = AREA.y1 - AREA.y0
  const [canvas, ctx] = sheet(make, w, h)
  const sky = ctx.createLinearGradient(0, -AREA.y0, 0, ARENA.h - AREA.y0)
  sky.addColorStop(0, '#2b2668')
  sky.addColorStop(0.55, '#6d4592')
  sky.addColorStop(1, '#c9688f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // 유리 타일: 번갈아 조금 밝게
  for (let ty = 0; ty < h; ty += 32) {
    for (let tx = 0; tx < w; tx += 30) {
      if ((tx / 30 + ty / 32) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.035)'
        ctx.fillRect(tx, ty, 30, 32)
      }
    }
  }
  // 점선 격자와 교차점
  for (let y = 0; y <= h; y += 32) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    for (let x = 0; x < w; x += 6) ctx.fillRect(x, y, 3, 1)
  }
  for (let x = 0; x <= w; x += 30) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    for (let y = 0; y < h; y += 6) ctx.fillRect(x, y, 1, 3)
  }
  for (let y = 0; y <= h; y += 32) {
    for (let x = 0; x <= w; x += 30) {
      ctx.fillStyle = 'rgba(200,230,255,0.55)'
      ctx.fillRect(x - 2, y, 5, 1)
      ctx.fillRect(x, y - 2, 1, 5)
    }
  }
  // 빈 앱 자리
  for (const sy of [40, 112, 184, 256, 328, 400, 472]) {
    for (const sx of [80, 180, 280]) {
      const blocked = OBSTACLES.some((b) => sx + 24 > b.x && sx - 24 < b.x + b.w && sy + AREA.y0 + 24 > b.y && sy + AREA.y0 - 24 < b.y + b.h)
      if (blocked) continue
      pixelBox(ctx, sx - 22, sy - 22, 44, 44, 'rgba(255,255,255,0.2)', 8)
      pixelBox(ctx, sx - 20, sy - 20, 40, 40, 'rgba(40,24,84,0.4)', 7)
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fillRect(sx - 7, sy - 1, 14, 3)
      ctx.fillRect(sx - 1, sy - 7, 3, 14)
    }
  }
  // 배경화면 별
  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = i % 5 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)'
    ctx.fillRect((i * 97) % w, (i * 53) % h, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1)
  }
  // 앱 아이콘 둘레: 앱 색 빛 + 접촉 그림자
  for (const b of OBSTACLES) {
    const y = b.y - AREA.y0
    const look = APP_LOOKS[b.app]
    ctx.fillStyle = look.main === C.Z ? look.sub : look.main
    for (const [grow, alpha] of [[16, 0.07], [12, 0.08], [8, 0.1]]) {
      ctx.globalAlpha = alpha
      ctx.fillRect(b.x - grow, y - grow, b.w + grow * 2, b.h + grow * 2)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(10,6,30,0.45)'
    ctx.fillRect(b.x - 4, y - 4, b.w + 8, b.h + 8)
  }
  // 벽 밑 빛 번짐
  for (const [grow, alpha] of [[22, 0.08], [14, 0.12], [7, 0.2]]) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = HUES.n.main
    ctx.fillRect(0, 0, w, grow)
    ctx.fillStyle = HUES.s.main
    ctx.fillRect(0, h - grow, w, grow)
    ctx.fillStyle = HUES.w.main
    ctx.fillRect(0, 0, grow, h)
    ctx.fillStyle = HUES.e.main
    ctx.fillRect(w - grow, 0, grow, h)
  }
  ctx.globalAlpha = 1
  return canvas
}

// ---------- 빌보드 ----------
function itemTexture(make, kind) {
  const art = ITEM_ART[kind]
  const [canvas, ctx] = sheet(make, 34, 34)
  pixelBox(ctx, 0, 0, 34, 34, 'rgba(255,255,255,0.35)', 8)
  pixelBox(ctx, 2, 2, 30, 30, INK, 6)
  pixelBox(ctx, 4, 4, 26, 26, '#ffffff', 5)
  ctx.fillStyle = '#dfe6f2'
  ctx.fillRect(9, 26, 16, 3)
  const cell = 3
  const w = art.rows[0].length * cell
  const h = art.rows.length * cell
  pixelArt(ctx, art.rows, 4 + Math.round((26 - w) / 2), 4 + Math.round((26 - h) / 2), cell, art.color)
  return canvas
}

// 빛무리: 도트 계단 원
function glowTexture(make, color) {
  const [canvas, ctx] = sheet(make, 48, 48)
  ctx.fillStyle = color
  for (const [r, alpha] of [[23, 0.1], [18, 0.14], [13, 0.2], [8, 0.3]]) {
    ctx.globalAlpha = alpha
    disc(ctx, 24, 24, r, 2)
  }
  ctx.globalAlpha = 1
  return canvas
}

function disc(ctx, cx, cy, r, cell = 1, ry = r) {
  for (let y = -Math.ceil(ry); y < ry; y += cell) {
    const half = Math.round((r * Math.sqrt(Math.max(0, 1 - ((y + cell / 2) / ry) ** 2))) / cell) * cell
    if (half > 0) ctx.fillRect(cx - half, cy + y, half * 2, cell)
  }
}

// 탄: 색(기술)마다 모양이 다르다.
const SHOT_SHAPES = { '#e1306c': ICONS.heart, '#fee500': ICONS.bubble, '#c58b54': ICONS.box, '#6b5fd3': ICONS.diamond }
function shotTexture(make, color) {
  const [canvas, ctx] = sheet(make, 20, 20)
  const shape = SHOT_SHAPES[color]
  if (shape) {
    const ox = 3
    const oy = Math.round((20 - shape.length * 2) / 2)
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [2, -2], [-2, 2]]) pixelArt(ctx, shape, ox + dx, oy + dy, 2, INK)
    pixelArt(ctx, shape, ox, oy, 2, color)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(ox + 2, oy + 2, 4, 2)
    ctx.fillRect(ox + 2, oy + 4, 2, 2)
    return canvas
  }
  ctx.fillStyle = INK
  disc(ctx, 10, 10, 10, 2)
  ctx.fillStyle = color
  disc(ctx, 10, 10, 8, 2)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  disc(ctx, 10, 10, 5, 1)
  ctx.fillStyle = '#ffffff'
  disc(ctx, 10, 10, 3, 1)
  return canvas
}

// 알림 폭풍 말풍선 카드(세계 1칸 = 2px)
function stormTexture(make, kind) {
  const style = BUBBLE_STYLE[kind]
  const [canvas, ctx] = sheet(make, 104, 68)
  pixelBox(ctx, 0, 4, 100, 50, INK, 8)
  ctx.fillStyle = INK
  ctx.fillRect(18, 52, 18, 6)
  ctx.fillRect(18, 56, 12, 6)
  ctx.fillRect(18, 60, 6, 6)
  pixelBox(ctx, 3, 7, 94, 44, '#ffffff', 7)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(21, 50, 12, 5)
  ctx.fillRect(21, 54, 6, 5)
  ctx.fillStyle = style.bar
  ctx.fillRect(10, 40, 80, 6)
  pixelBox(ctx, 10, 13, 26, 24, style.icon, 5)
  ctx.fillStyle = style.dot
  ctx.fillRect(17, 20, 12, 8)
  ctx.fillRect(18, 28, 5, 3)
  ctx.font = `bold 20px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.fillText(style.text, 41, 26)
  // 안 읽음 배지
  ctx.fillStyle = INK
  disc(ctx, 92, 11, 11, 1)
  ctx.fillStyle = '#ff3b5c'
  disc(ctx, 92, 11, 9, 1)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(91, 5, 3, 8)
  ctx.fillRect(91, 15, 3, 3)
  return canvas
}

function shieldTexture(make, color) {
  const [canvas, ctx] = sheet(make, 72, 72)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.16
  disc(ctx, 36, 36, 33, 2)
  ctx.globalAlpha = 0.28
  for (let y = 8; y < 64; y += 8) {
    for (let x = 8 + ((y / 8) % 2) * 4; x < 64; x += 8) if (Math.hypot(x - 36, y - 36) < 30) ctx.fillRect(x, y, 2, 2)
  }
  for (let i = 0; i < 200; i += 1) {
    const a = (i / 200) * Math.PI * 2
    ctx.globalAlpha = 0.95
    ctx.fillRect(Math.round((36 + Math.cos(a) * 33) / 2) * 2 - 1, Math.round((36 + Math.sin(a) * 33) / 2) * 2 - 1, 2, 2)
    ctx.globalAlpha = 0.35
    ctx.fillRect(Math.round((36 + Math.cos(a) * 30) / 2) * 2 - 1, Math.round((36 + Math.sin(a) * 30) / 2) * 2 - 1, 2, 2)
  }
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(18, 16, 8, 4)
  ctx.fillRect(14, 20, 4, 8)
  ctx.globalAlpha = 1
  return canvas
}

function badgeTexture(make, kind) {
  const [canvas, ctx] = sheet(make, 14, 14)
  if (kind === 'dnd') {
    pixelBox(ctx, 0, 0, 14, 14, INK, 4)
    pixelBox(ctx, 1, 1, 12, 12, '#6b5fd3', 3)
    ctx.fillStyle = '#ffd84a'
    ctx.fillRect(4, 4, 4, 6)
    ctx.fillRect(6, 3, 4, 2)
    ctx.fillRect(6, 9, 4, 2)
  } else if (kind === 'stun') {
    pixelBox(ctx, 0, 0, 14, 14, INK, 4)
    pixelBox(ctx, 1, 1, 12, 12, '#ff3b5c', 3)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(6, 3, 2, 5)
    ctx.fillRect(6, 10, 2, 2)
  } else {
    // 어질어질 별
    ctx.fillStyle = INK
    ctx.fillRect(4, 0, 6, 14)
    ctx.fillRect(0, 4, 14, 6)
    ctx.fillStyle = '#ffd84a'
    ctx.fillRect(6, 1, 2, 12)
    ctx.fillRect(1, 6, 12, 2)
    ctx.fillRect(5, 5, 4, 4)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(6, 6, 2, 2)
  }
  return canvas
}

// 바닥 그림자·덫 발판(납작한 원)
function blobTexture(make, color, ring = null) {
  const [canvas, ctx] = sheet(make, 48, 24)
  ctx.fillStyle = ring ?? color
  disc(ctx, 24, 12, 23, 1, 11.5)
  ctx.fillStyle = color
  if (ring) disc(ctx, 24, 12, 19, 1, 9)
  return canvas
}

// 덫: 떠 있는 재생 단추
function trapTexture(make) {
  const [canvas, ctx] = sheet(make, 36, 28)
  pixelBox(ctx, 0, 0, 36, 28, INK, 8)
  pixelBox(ctx, 2, 2, 32, 24, '#ff1f3d', 7)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(8, 4, 20, 2)
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect(13 + i * 2, 7 + i, 2, 14 - i * 2)
  }
  return canvas
}

// 줄 경고 표지(알림 폭풍이 곧 내려오는 줄)
function signTexture(make) {
  const [canvas, ctx] = sheet(make, 32, 32)
  pixelBox(ctx, 0, 0, 32, 32, INK, 8)
  pixelBox(ctx, 2, 2, 28, 28, '#ff3b5c', 7)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(14, 6, 5, 12)
  ctx.fillRect(14, 22, 5, 5)
  return canvas
}

// 꺼진 화면 경계의 붉은 잡음 커튼(아래가 진하고 위로 옅어진다)
export const CURTAIN = { w: 64, h: 40 } // 무늬 폭 px, 높이(세계 단위)
function curtainTexture(make) {
  const [canvas, ctx] = sheet(make, CURTAIN.w, CURTAIN.h)
  const rng = seededRandom(77)
  for (let y = 0; y < CURTAIN.h; y += 1) {
    const solid = y / CURTAIN.h
    for (let x = 0; x < CURTAIN.w; x += 2) {
      const n = rng()
      ctx.fillStyle = n < 0.15 ? '#ffd84a' : n < 0.55 ? '#ff3b5c' : '#5a0f2c'
      ctx.globalAlpha = Math.min(0.75, solid * (0.25 + rng() * 0.6))
      ctx.fillRect(x, y, 2, 1)
    }
  }
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#ff3b5c'
  for (let x = 0; x < CURTAIN.w; x += 16) ctx.fillRect(x, CURTAIN.h - 2, 10, 2)
  ctx.globalAlpha = 1
  return canvas
}

// 화면 가득 잡음(꺼진 화면 안에 있을 때)
function noiseTexture(make) {
  const [canvas, ctx] = sheet(make, 120, 120)
  const rng = seededRandom(5)
  for (let y = 0; y < 120; y += 2) {
    for (let x = 0; x < 120; x += 4) {
      const n = rng()
      if (n < 0.6) continue
      ctx.fillStyle = n > 0.97 ? 'rgba(255,220,230,0.5)' : n > 0.8 ? 'rgba(255,59,92,0.26)' : 'rgba(0,0,0,0.3)'
      ctx.fillRect(x, y, 4, 2)
    }
  }
  return canvas
}

// 가장자리 비네트(180×256, 도트 계단)
function vignetteTexture(make, color, inner, strength) {
  const w = 90
  const h = 128
  const [canvas, ctx] = sheet(make, w, h)
  ctx.fillStyle = color
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const d = Math.hypot((x + 1 - w / 2) / (w / 2), (y + 1 - h / 2) / (h / 2))
      const edge = Math.max(0, (d - inner) / (1.42 - inner))
      if (edge <= 0) continue
      ctx.globalAlpha = Math.min(1, Math.round(edge * strength * 10) / 10)
      ctx.fillRect(x, y, 2, 2)
    }
  }
  ctx.globalAlpha = 1
  return canvas
}

// ---------- 손과 폰 ----------
export const PHONE = { w: 130, h: 104, screenX: 42, screenY: 20, screenW: 46, screenH: 62 }

// 기술(또는 1위 앱)의 화면 그림: { rows, color, colors }
export function weaponLogo(loadout) {
  const graft = loadout?.grafts?.find((item) => item.slot === 'hair')
  const key = graft && lookKeyOf(graft)
  if (loadout?.skill === 'unrecorded') return { rows: ICONS.question, colors: '#ffffff', bg: '#4a4e7a', tint: '#b9b0ff' }
  if (loadout?.skill === 'detox' || !APP_LOOKS[key ?? loadout?.skill]) return { rows: ICONS.heart, colors: '#ffffff', bg: '#ff5a7a', tint: '#7fe7ff' }
  const look = APP_LOOKS[key ?? loadout.skill]
  return { rows: look.logo, colors: C, bg: look.main, tint: look.main === C.Z ? look.sub : look.main }
}

function phoneTexture(make, tint) {
  const [canvas, ctx] = sheet(make, PHONE.w, PHONE.h)
  const x = 34
  const w = 62
  // 위쪽 발사 렌즈
  pixelBox(ctx, x + 18, 2, 26, 12, INK, 4)
  pixelBox(ctx, x + 20, 4, 22, 9, '#3d4058', 3)
  ctx.fillStyle = tint
  ctx.fillRect(x + 25, 5, 12, 4)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + 28, 6, 6, 1)
  // 몸체: 두꺼운 옆면 + 앞판
  pixelBox(ctx, x - 2, 10, w + 6, 104, INK, 8)
  pixelBox(ctx, x, 12, w + 2, 102, '#6a6f92', 7)
  pixelBox(ctx, x, 14, w - 2, 100, '#2d2f45', 6)
  ctx.fillStyle = '#8f95bd'
  ctx.fillRect(x + 6, 12, w - 10, 2)
  ctx.fillStyle = '#4a4e6e'
  ctx.fillRect(x + w - 1, 34, 3, 12)
  ctx.fillRect(x + w - 1, 52, 3, 18)
  // 화면 홈과 카메라
  pixelBox(ctx, PHONE.screenX - 2, PHONE.screenY - 2, PHONE.screenW + 4, PHONE.screenH + 4, '#0b0b1c', 4)
  ctx.fillStyle = '#0b0b1c'
  ctx.fillRect(x + 25, 15, 12, 2)
  // 옆면 알림 LED 줄
  ctx.fillStyle = tint
  for (let i = 0; i < 5; i += 1) ctx.fillRect(x + 1, 30 + i * 11, 2, 6)
  return canvas
}

// 두 손: 손가락이 옆면을 감싸고 엄지가 화면 아래를 누른다.
function handsTexture(make, loadout) {
  const [canvas, ctx] = sheet(make, PHONE.w, PHONE.h)
  const skin = LOOK_OPTIONS.skin.choices[loadout?.look?.skin] ?? LOOK_OPTIONS.skin.choices[DEFAULT_LOOK.skin]
  const graft = loadout?.grafts?.find((item) => item.slot === 'outfit')
  const main = graft ? APP_LOOKS[lookKeyOf(graft)]?.main : null
  const sleeve = main === C.Z ? '#34343c' : (main ?? '#f7f7f7')
  const block = (x, y, w, h, fill) => {
    pixelBox(ctx, x - 2, y - 2, w + 4, h + 4, INK, 4)
    pixelBox(ctx, x, y, w, h, fill, 4)
  }
  for (const side of [-1, 1]) {
    const mx = (x, w) => (side < 0 ? x : PHONE.w - x - w)
    // 소매 → 손등 → 손가락 → 엄지
    block(mx(12, 24), 52, 24, 32, skin.color)
    ctx.fillStyle = skin.shade
    ctx.fillRect(mx(14, 4), 56, 4, 20)
    block(mx(2, 34), 76, 34, 34, sleeve)
    ctx.fillStyle = 'rgba(10,8,30,0.2)'
    ctx.fillRect(mx(4, 30), 79, 30, 4)
    ctx.fillRect(mx(4, 4), 84, 4, 20)
    for (let i = 0; i < 3; i += 1) {
      block(mx(22, 16), 34 + i * 13, 16, 10, skin.color)
      ctx.fillStyle = skin.shade
      ctx.fillRect(mx(24, 12), 41 + i * 13, 12, 2)
    }
    block(mx(28, 22), 76, 22, 11, skin.color)
    ctx.fillStyle = skin.shade
    ctx.fillRect(mx(30, 16), 84, 16, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillRect(mx(44, 4), 78, 4, 4)
  }
  return canvas
}

// 발사 순간: 알림 배지가 터지는 별
function burstTexture(make, tint) {
  const [canvas, ctx] = sheet(make, 64, 64)
  const star = (r, fill) => {
    ctx.fillStyle = fill
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      const len = i % 2 ? r * 0.62 : r
      for (let d = 0; d < len; d += 2) {
        const s = Math.max(2, Math.round((1 - d / len) * r * 0.42))
        ctx.fillRect(Math.round(32 + Math.cos(a) * d - s / 2), Math.round(32 + Math.sin(a) * d - s / 2), s, s)
      }
    }
  }
  star(31, tint)
  star(24, '#ffd84a')
  star(16, '#ffffff')
  return canvas
}

// ---------- 미니맵 ----------
export const MAP = { x: 8, y: 8, w: 72, h: 102, pad: 4 }
export const MAP_SCALE = MAP.w / (AREA.x1 - AREA.x0)
function minimapTexture(make) {
  const w = MAP.w + MAP.pad * 2
  const h = MAP.h + MAP.pad * 2
  const [canvas, ctx] = sheet(make, w, h)
  pixelBox(ctx, 0, 0, w, h, 'rgba(255,255,255,0.75)', 8)
  pixelBox(ctx, 1, 1, w - 2, h - 2, INK, 8)
  pixelBox(ctx, MAP.pad, MAP.pad, MAP.w, MAP.h, '#3b2f74', 4)
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  for (let y = 0; y < MAP.h; y += 8) ctx.fillRect(MAP.pad + 2, MAP.pad + y, MAP.w - 4, 1)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillRect(w / 2 - 8, 1, 16, 2)
  for (const b of OBSTACLES) {
    const look = APP_LOOKS[b.app]
    const x = MAP.pad + (b.x - AREA.x0) * MAP_SCALE
    const y = MAP.pad + (b.y - AREA.y0) * MAP_SCALE
    ctx.fillStyle = INK
    ctx.fillRect(x - 1, y - 1, b.w * MAP_SCALE + 2, b.h * MAP_SCALE + 2)
    ctx.fillStyle = look.main === C.Z ? look.sub : look.main
    ctx.fillRect(x, y, b.w * MAP_SCALE, b.h * MAP_SCALE)
  }
  return canvas
}

// 모든 재료를 한 번에 만든다.
export function buildArt(make, loadout) {
  const towers = {}
  for (const { app } of OBSTACLES) {
    if (towers[app]) continue
    const lit = towerTexture(make, app)
    const dim = shaded(make, lit, 'rgba(14,6,48,0.36)')
    towers[app] = { lit, dim, litFar: half(make, lit), dimFar: half(make, dim), litFloor: reflection(make, lit), dimFloor: reflection(make, dim) }
  }
  const glass = {}
  for (const face of ['n', 's', 'e', 'w']) {
    const wall = glassTexture(make, face)
    glass[face] = { wall, far: half(make, wall), floor: reflection(make, wall) }
  }
  const logo = weaponLogo(loadout)
  const glows = new Map()
  const shots = new Map()
  // 색마다 한 번만 만들어 둔다.
  const cached = (map, build) => (color) => {
    let canvas = map.get(color)
    if (!canvas) {
      canvas = build(make, color)
      map.set(color, canvas)
    }
    return canvas
  }
  return {
    towers,
    glass,
    strip: stripTexture(make),
    sky: skyTexture(make),
    items: Object.fromEntries(Object.keys(ITEM_ART).map((kind) => [kind, itemTexture(make, kind)])),
    storms: Object.fromEntries(Object.keys(BUBBLE_STYLE).map((kind) => [kind, stormTexture(make, kind)])),
    glow: cached(glows, glowTexture),
    shot: cached(shots, shotTexture),
    shield: shieldTexture(make, '#7fe7ff'),
    air: shieldTexture(make, '#9fc2ff'),
    dnd: badgeTexture(make, 'dnd'),
    stun: badgeTexture(make, 'stun'),
    star: badgeTexture(make, 'star'),
    shadow: blobTexture(make, 'rgba(8,4,24,0.5)'),
    redShadow: blobTexture(make, 'rgba(60,4,24,0.6)', 'rgba(255,59,92,0.55)'),
    pad: blobTexture(make, 'rgba(90,6,24,0.8)', 'rgba(255,31,61,0.95)'),
    focus: blobTexture(make, 'rgba(255,216,74,0.12)', 'rgba(255,216,74,0.7)'),
    trap: trapTexture(make),
    sign: signTexture(make),
    curtain: curtainTexture(make),
    noise: noiseTexture(make),
    hurt: vignetteTexture(make, '#ff1f46', 0.55, 1.1),
    dark: vignetteTexture(make, '#0a0418', 0.18, 1.5),
    edge: vignetteTexture(make, '#0a0420', 0.72, 0.75),
    logo,
    phone: phoneTexture(make, logo.tint),
    hands: handsTexture(make, loadout),
    burst: burstTexture(make, logo.tint),
    minimap: minimapTexture(make),
  }
}
