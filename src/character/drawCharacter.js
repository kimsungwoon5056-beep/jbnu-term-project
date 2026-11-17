import { LOOK_OPTIONS, normalizeLook } from '../profile/look'
import { addOutline, createGrid, drawLine, fillEllipse, fillRect, getCell, setCell, SIZE, stamp, toPixels } from '../pixel/grid'
import { APP_LOOKS, C, lookKeyOf } from './appLook'
import { dull, mix, shiftLightness } from './color'
import { paintScene } from './scenes'

// 도트 SD 캐릭터(48×48). drawCharacter(모습, 상태)는 순수 함수라 같은 모습 + 같은 사용이면 같은 그림이다.
// 모습(look): 가입할 때 고른 피부색·머리 모양·머리색·안경. 상태(state): characterState()의 오늘 사용.
// 칸마다 어느 부위가 칠했는지(parts)를 남겨 부위 설명에서 그 부위만 강조한다.

const MID = 47 // 좌우 대칭: x ↔ 47 − x
const mirrorX = (x, w = 1) => MID - (x + w - 1)

function fillMirror(g, x, y, w, h, color) {
  fillRect(g, x, y, w, h, color)
  fillRect(g, mirrorX(x, w), y, w, h, color)
}

const inEllipse = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1
const inFace = (x, y, oy) => inEllipse(x, y, 24, 18 + oy, 9.5, 8.5)

// ---------- 머리 모양 ----------
// hairline(x): 얼굴 안에서 이 줄 위쪽은 머리카락. side: 얼굴 밖(옆머리)이 내려오는 줄. 모두 고개를 들었을 때(oy = 0) 기준
const centerGap = (x) => Math.abs(x - 23.5)
const HAIR_STYLES = {
  short: { hairline: (x) => (centerGap(x) > 6.5 ? 15 : [18, 21, 26, 29].includes(x) ? 14 : 13), side: 18 },
  bangs: { hairline: (x) => (centerGap(x) > 7 ? 19 : x % 2 === 0 ? 17 : 16), side: 20 },
  side: { hairline: (x) => (x >= 31 ? 18 : x <= 19 ? 13 : Math.min(17, 13 + Math.floor((x - 19) / 2))), side: 19 },
  bob: {
    hairline: (x) => (centerGap(x) > 7 ? 26 : x % 3 === 0 ? 16 : 15),
    side: 27,
    front(g, oy) {
      fillMirror(g, 12, 15 + oy, 2, 12, 'hair')
      setCell(g, 12, 26 + oy, null)
      setCell(g, 35, 26 + oy, null)
    },
  },
  long: {
    hairline: (x) => (centerGap(x) > 7 ? 27 : x % 3 === 0 ? 16 : 15),
    side: 28,
    back(g, oy) {
      fillEllipse(g, 24, 18 + oy, 12, 11, 'hair')
      fillMirror(g, 11, 18 + oy, 6, 19 - oy, 'hair')
      setCell(g, 11, 36, null)
      setCell(g, 36, 36, null)
    },
    front(g, oy) {
      fillMirror(g, 12, 15 + oy, 2, 14, 'hair')
    },
  },
  ponytail: {
    hairline: (x) => (centerGap(x) > 6.5 ? 16 : 14),
    side: 18,
    back(g, oy) {
      fillEllipse(g, 37.5, 18 + oy, 3, 6.5, 'hair')
    },
    front(g, oy) {
      fillRect(g, 34, 12 + oy, 2, 2, 'hairTie')
    },
  },
  curly: {
    hairline: (x) => (centerGap(x) > 7 ? 18 : x % 3 === 0 ? 15 : 14),
    side: 21,
    back(g, oy) {
      for (let i = 0; i <= 8; i += 1) {
        const angle = Math.PI * (0.02 + (0.96 * i) / 8)
        fillEllipse(g, 24 + 10.6 * Math.cos(angle), 16 + oy - 9 * Math.sin(angle), 2.7, 2.7, 'hair')
      }
      fillEllipse(g, 13.5, 20 + oy, 2.4, 2.6, 'hair')
      fillEllipse(g, 34.5, 20 + oy, 2.4, 2.6, 'hair')
    },
  },
  buzz: { hairline: (x) => (centerGap(x) > 7.5 ? 14 : 12), side: 14, tight: true, color: 'hairBuzz' },
}

// 머리카락 덮개: 머리 윗부분 타원에서 얼굴 안은 hairline 위쪽, 얼굴 밖은 side 위쪽만 칠한다.
function paintHairCap(g, style, oy, { insideOnly = false } = {}) {
  const shape = HAIR_STYLES[style]
  const [rx, ry] = shape.tight ? [9.9, 8.6] : [10.5, 9]
  const color = shape.color ?? 'hair'
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!inEllipse(x, y, 24, 16 + oy, rx, ry)) continue
      const face = inFace(x, y, oy)
      if (face ? y < shape.hairline(x) + oy : !insideOnly && y < shape.side + oy) setCell(g, x, y, color)
    }
  }
  if (!insideOnly) shape.front?.(g, oy)
}

// 머리카락 명암: 얼굴 바로 위 칸은 어둡게, 왼쪽 위에 윤기 한 줄
function shadeHair(g, oy) {
  const isHair = (x, y) => ['hair', 'hairBuzz'].includes(getCell(g, x, y))
  for (let y = SIZE - 1; y >= 0; y -= 1) {
    for (let x = 0; x < SIZE; x += 1) if (isHair(x, y) && getCell(g, x, y + 1) === 'skin') setCell(g, x, y, 'hairShade')
  }
  for (const [x, y] of [[16, 10], [17, 9], [18, 9], [19, 8], [20, 8], [15, 11]]) if (isHair(x, y + oy)) setCell(g, x, y + oy, 'hairLight')
}

// 인스타그램 머리: 왼쪽 아래 노랑 → 오른쪽 위 보라 그라데이션
function gradientHair(g, colors) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!['hair', 'hairShade', 'hairLight'].includes(getCell(g, x, y))) continue
      const t = Math.min(0.999, Math.max(0, (x - 10 + (30 - y)) / 48))
      setCell(g, x, y, colors[Math.floor(t * colors.length)])
    }
  }
}

const logo = (g, key, x, y) => stamp(g, APP_LOOKS[key].logo, x, y, { legend: C })

// ---------- 머리에 오는 앱(1위) ----------
const GEARS = {
  cap(g, key, oy) {
    const look = APP_LOOKS[key]
    for (let y = 6 + oy; y <= 12 + oy; y += 1) for (let x = 12; x < 36; x += 1) if (inEllipse(x, y, 24, 13 + oy, 10.6, 6.6)) setCell(g, x, y, look.main)
    fillRect(g, 13, 13 + oy, 22, 1, look.sub === C.W ? shiftLightness(look.main, -18) : look.sub)
    fillRect(g, 15, 14 + oy, 18, 1, shiftLightness(look.sub === C.W ? look.main : look.sub, -28))
    logo(g, key, 21, 7 + oy)
  },
  helmet(g, key, oy) {
    const look = APP_LOOKS[key]
    for (let y = 5 + oy; y <= 15 + oy; y += 1) for (let x = 11; x < 37; x += 1) if (inEllipse(x, y, 24, 14 + oy, 11.2, 8.8)) setCell(g, x, y, look.main)
    fillRect(g, 13, 14 + oy, 22, 2, C.W)
    fillMirror(g, 14, 16 + oy, 1, 7, '#4a4f63')
    logo(g, key, 26, 7 + oy)
  },
  headset(g, key, oy) {
    const look = APP_LOOKS[key]
    for (let y = 5 + oy; y <= 9 + oy; y += 1) {
      for (let x = 12; x < 36; x += 1) {
        if (inEllipse(x, y, 24, 17 + oy, 11.6, 11.6) && !inEllipse(x, y, 24, 17 + oy, 10.2, 10.2)) setCell(g, x, y, C.k)
      }
    }
    fillRect(g, 12, 9 + oy, 2, 6, C.k)
    fillRect(g, 34, 9 + oy, 2, 6, C.k)
    fillRect(g, 10, 15 + oy, 5, 7, look.main)
    logo(g, key, 10, 16 + oy)
    fillRect(g, 33, 15 + oy, 5, 7, look.main)
    drawLine(g, 14, 22 + oy, 19, 25 + oy, C.k)
    fillRect(g, 19, 24 + oy, 2, 2, look.main)
  },
}

// 검정 앱 색은 외곽선과 섞이지 않게 조금 밝힌 검정으로 칠한다.
const cloth = (hex) => (hex === C.Z ? '#34343c' : hex)

// 후드: 머리 뒤를 감싸는 천. 얼굴 둘레에만 한 칸 어두운 단을 두고, 아래는 어깨까지 내려온다.
function paintHood(g, key, oy) {
  const main = cloth(APP_LOOKS[key].main)
  const rim = shiftLightness(main, main === '#34343c' ? 12 : -14)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!inEllipse(x, y, 24, 17 + oy, 12.4, 11.4) || y > 27 + oy) continue
      setCell(g, x, y, inEllipse(x, y, 24, 18 + oy, 10.6, 9.6) ? rim : main)
    }
  }
}

// ---------- 얼굴 ----------
const EYE_X = [18, 28] // 왼쪽 눈, 오른쪽 눈의 왼쪽 칸

function paintEyes(g, mode, oy, lookDown) {
  const top = 18 + oy + (lookDown ? 1 : 0)
  for (const ex of EYE_X) {
    if (mode === 'spiral') {
      stamp(g, ['.##.', '#::#', '#:##', '.#..'], ex - 1, 17 + oy, { legend: { '#': 'eye', ':': 'eyeWhite' }, flip: ex > 24 })
    } else if (mode === 'sleepy') {
      fillRect(g, ex - 1, top, 4, 1, 'skinShade')
      fillRect(g, ex, top + 1, 2, 2, 'eye')
    } else {
      fillRect(g, ex, top, 2, 3, 'eye')
      setCell(g, ex, top, 'eyeWhite')
      if (mode === 'sparkle') setCell(g, ex + 1, top + 2, 'eyeWhite')
    }
  }
}

// 깜빡임 칸: 눈을 감은 모양(평소 눈일 때만)
function blinkCells(mode, oy, lookDown) {
  if (mode === 'spiral' || mode === 'sleepy') return []
  const top = 18 + oy + (lookDown ? 1 : 0)
  const cells = []
  for (const ex of EYE_X) {
    for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 2; dx += 1) cells.push([ex + dx, top + dy, dy === 2 ? 'eye' : 'skin'])
  }
  return cells
}

function paintMouth(g, tier, oy) {
  const y = 23 + oy
  if (tier === 'good') {
    setCell(g, 22, y, 'mouth')
    setCell(g, 25, y, 'mouth')
    fillRect(g, 23, y + 1, 2, 1, 'mouth')
  } else if (tier === 'low') {
    fillRect(g, 23, y, 2, 1, 'mouth')
    setCell(g, 22, y + 1, 'mouth')
    setCell(g, 25, y + 1, 'mouth')
  } else {
    fillRect(g, 23, y + 1, 2, 1, 'mouth')
  }
}

function paintGlasses(g, kind, oy) {
  for (const left of [16, 26]) {
    fillRect(g, left + 1, 17 + oy, 4, 1, 'frame')
    fillRect(g, left + 1, 22 + oy, 4, 1, 'frame')
    fillRect(g, left, 18 + oy, 1, 4, 'frame')
    fillRect(g, left + 5, 18 + oy, 1, 4, 'frame')
    if (kind === 'square') {
      for (const [dx, dy] of [[0, 17], [5, 17], [0, 22], [5, 22]]) setCell(g, left + dx, dy + oy, 'frame')
    }
  }
  fillRect(g, 22, 18 + oy, 4, 1, 'frame')
  fillRect(g, 14, 18 + oy, 2, 1, 'frame')
  fillRect(g, 32, 18 + oy, 2, 1, 'frame')
}

// ---------- 몸 ----------
function paintOutfit(g, outfitKey) {
  const look = outfitKey ? APP_LOOKS[outfitKey] : null
  const main = look ? cloth(look.main) : 'shirt'
  const shade = look ? shiftLightness(main, -14) : 'shirtShade'
  // 몸통
  fillRect(g, 18, 28, 12, 1, main)
  fillRect(g, 17, 29, 14, 8, main)
  fillRect(g, 30, 29, 1, 8, shade)
  fillRect(g, 17, 36, 14, 1, shade)
  // 팔: 몸통과 한 칸 띄워 외곽선이 생기게 한다.
  if (look) {
    fillMirror(g, 13, 29, 3, 6, main)
    fillMirror(g, 13, 34, 3, 1, look.sub)
    fillRect(g, 20, 34, 8, 1, shade) // 주머니
    setCell(g, 20, 29, look.sub)
    setCell(g, 20, 30, look.sub)
    setCell(g, 27, 29, look.sub)
    setCell(g, 27, 30, look.sub)
    logo(g, outfitKey, 21, 29)
  } else {
    fillMirror(g, 13, 29, 3, 2, main)
    fillMirror(g, 13, 31, 3, 4, 'skin')
    fillRect(g, 22, 28, 4, 1, 'skin')
    fillRect(g, 21, 28, 1, 1, 'shirtShade')
    fillRect(g, 26, 28, 1, 1, 'shirtShade')
    fillRect(g, 22, 29, 4, 1, 'shirtShade')
  }
}

function paintHoodBack(g, outfitKey) {
  if (outfitKey) fillRect(g, 18, 26, 12, 3, shiftLightness(cloth(APP_LOOKS[outfitKey].main), -20))
}

function paintHands(g, holding) {
  fillRect(g, 13, 35, 3, 2, 'skin')
  if (!holding) fillRect(g, 32, 35, 3, 2, 'skin')
}

function paintLegs(g, walking) {
  fillRect(g, 18, 37, 12, 2, 'pants')
  if (walking) {
    fillRect(g, 17, 39, 5, 3, 'pants')
    fillRect(g, 26, 39, 5, 3, 'pants')
  } else {
    fillRect(g, 18, 39, 5, 3, 'pants')
    fillRect(g, 25, 39, 5, 3, 'pants')
  }
  fillRect(g, 29, 37, 1, 2, 'pantsShade')
}

function paintShoes(g, kind) {
  if (kind === 'sneakers') {
    fillRect(g, 16, 42, 6, 1, 'sneaker')
    fillRect(g, 26, 42, 6, 1, 'sneaker')
    fillRect(g, 16, 43, 6, 1, 'sneakerSole')
    fillRect(g, 26, 43, 6, 1, 'sneakerSole')
    setCell(g, 18, 42, 'sneakerSole')
    setCell(g, 28, 42, 'sneakerSole')
  } else if (kind === 'slippers') {
    fillRect(g, 17, 42, 6, 1, 'slipper')
    fillRect(g, 25, 42, 6, 1, 'slipper')
    fillRect(g, 17, 43, 6, 1, 'skin')
    fillRect(g, 25, 43, 6, 1, 'skin')
    fillRect(g, 16, 44, 7, 1, 'slipperSole')
    fillRect(g, 25, 44, 7, 1, 'slipperSole')
  } else {
    fillRect(g, 17, 42, 6, 2, 'shoe')
    fillRect(g, 25, 42, 6, 2, 'shoe')
    fillRect(g, 17, 43, 6, 1, 'shoeSole')
    fillRect(g, 25, 43, 6, 1, 'shoeSole')
  }
}

// 손에 든 폰(3위 앱). 화면에 앱이 켜져 있다. raise면 얼굴 옆까지 들어 올린다.
function paintPhone(g, key, raise) {
  const top = raise ? 14 : 27
  fillRect(g, 34, top, 7, 11, C.k)
  fillRect(g, 35, top + 1, 5, 8, APP_LOOKS[key].main)
  logo(g, key, 35, top + 2)
  fillRect(g, 36, top + 9, 3, 1, '#5a5d6e')
  if (raise) {
    fillRect(g, 32, 29, 3, 2, 'sleeve')
    fillRect(g, 33, 24, 2, 6, 'sleeve')
    fillRect(g, 33, 22, 3, 3, 'skin')
  } else {
    fillRect(g, 32, 29, 3, 5, 'sleeve')
    fillRect(g, 33, 33, 3, 3, 'skin')
  }
}

// 알림 배지: 머리 위 빨간 풍선(!)
const BADGE_SPOTS = [
  [31, 3],
  [37, 8],
  [25, 0],
]
function paintBadges(g, count, oy) {
  for (const [x, y0] of BADGE_SPOTS.slice(0, count)) {
    const y = y0 + Math.min(oy, 1)
    fillRect(g, x, y + 1, 5, 4, 'badge')
    fillRect(g, x + 1, y, 3, 6, 'badge')
    fillRect(g, x + 2, y + 1, 1, 2, C.W)
    setCell(g, x + 2, y + 4, C.W)
  }
}

// ---------- 팔레트 ----------
function paletteOf(look, tier) {
  const skin = LOOK_OPTIONS.skin.choices[look.skin]
  const hair = LOOK_OPTIONS.hairColor.choices[look.hairColor].color
  const dullness = tier === 'low' ? 0.55 : tier === 'mid' ? 0.15 : 0
  const skinColor = dull(skin.color, dullness)
  return {
    skin: skinColor,
    skinShade: dull(skin.shade, dullness),
    skinGlow: mix(skinColor, '#9fdcff', 0.35),
    blush: '#ff8fa3',
    hair,
    hairShade: shiftLightness(hair, -12),
    hairLight: shiftLightness(hair, 18),
    hairBuzz: mix(hair, skin.color, 0.3),
    hairTie: '#ff5a7a',
    eye: '#231f3d',
    eyeWhite: '#ffffff',
    circle: '#8e6bb0',
    mouth: '#8a3b3b',
    frame: '#2d2f3a',
    shirt: '#f7f7f7',
    shirtShade: '#d5dae4',
    pants: '#3d5a99',
    pantsShade: '#2d4475',
    shoe: '#4a4f63',
    shoeSole: '#c9ced9',
    sneaker: '#ff7a2e',
    sneakerSole: '#ffffff',
    slipper: '#5fb4ff',
    slipperSole: '#e8ecf3',
    badge: '#ff3b5c',
    screenFlash: '#ffffff',
    outline: '#2a2238',
    shadow: 'hsl(240 30% 20% / 0.25)',
  }
}

// 부위별로 칠한 칸을 기록한다(바뀐 칸 = 그 부위).
function tracker(g) {
  const owner = new Array(SIZE * SIZE).fill(null)
  return {
    owner,
    part(key, paint) {
      const before = g.cells.slice()
      paint()
      g.cells.forEach((color, i) => {
        if (color !== before[i]) owner[i] = color === null ? null : key
      })
    },
  }
}

// 움직임 칸(body·parts는 그대로 두고 따로 알려 준다)
// screen: 손에 든 폰 화면 칸(깜빡이는 빛을 덮는다). badges: 배지마다 [배지 칸 + 그 배지만 감싼 외곽선 칸]
function motionCells(g, owner, marks, handKey, oy) {
  const fx = { screen: [], badges: [] }
  if (handKey) {
    const top = (marks.raisePhone ? 14 : 27) + 1
    for (let y = top; y < top + 8; y += 1) {
      for (let x = 35; x < 40; x += 1) {
        if (owner[y * SIZE + x] === 'hand' && !['skin', 'sleeve'].includes(getCell(g, x, y))) fx.screen.push([x, y, 'screenFlash'])
      }
    }
  }
  if (marks.badges > 0) {
    const cores = BADGE_SPOTS.slice(0, marks.badges).map(([x, y0]) => ({ x, y: y0 + Math.min(oy, 1) }))
    const spotOf = (x, y) => cores.findIndex((core) => x >= core.x && x < core.x + 5 && y >= core.y && y < core.y + 6)
    const isBadge = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && owner[y * SIZE + x] === 'badge'
    fx.badges = cores.map(() => [])
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const color = getCell(g, x, y)
        if (color === null) continue
        if (isBadge(x, y)) {
          const spot = spotOf(x, y)
          if (spot >= 0) fx.badges[spot].push([x, y, color])
          continue
        }
        if (color !== 'outline') continue
        // 외곽선은 둘레가 모두 배지일 때만 배지와 함께 움직인다(머리·장식과 나눠 쓰는 칸은 남긴다).
        const around = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([dx, dy]) => [x + dx, y + dy])
          .filter(([nx, ny]) => {
            const near = getCell(g, nx, ny)
            return near !== null && near !== 'outline'
          })
        if (around.length === 0 || !around.every(([nx, ny]) => isBadge(nx, ny))) continue
        const spot = spotOf(...around[0])
        if (spot >= 0) fx.badges[spot].push([x, y, color])
      }
    }
  }
  return fx
}

// look: 모습, state: characterState() 결과. scene: 배경을 함께 그릴지
export function drawCharacter(lookInput, state, { scene = false } = {}) {
  const look = normalizeLook(lookInput)
  const { marks, grafts, tier } = state
  const slot = (name) => {
    const graft = grafts.find((item) => item.slot === name)
    return graft ? lookKeyOf(graft) : null
  }
  const hairKey = slot('hair')
  const outfitKey = slot('outfit')
  const handKey = slot('hand')
  const gear = hairKey ? APP_LOOKS[hairKey].gear : null
  const oy = marks.slouch ? 2 : 0
  const eyeMode = marks.spiral ? 'spiral' : tier === 'low' ? 'sleepy' : tier === 'good' ? 'sparkle' : 'normal'

  const g = createGrid()
  const t = tracker(g)
  const palette = paletteOf(look, tier)
  // 손에 든 폰의 소매는 옷 색을 따른다.
  palette.sleeve = outfitKey ? cloth(APP_LOOKS[outfitKey].main) : palette.skin

  // 뒤쪽(긴 머리·묶은 머리·후드)
  t.part('hair', () => {
    if (gear === 'hood') paintHood(g, hairKey, oy)
    else HAIR_STYLES[look.hairStyle].back?.(g, oy)
  })
  t.part('outfit', () => paintHoodBack(g, outfitKey))
  t.part('shoes', () => {
    paintLegs(g, marks.shoes === 'sneakers')
    paintShoes(g, marks.shoes)
  })
  t.part('outfit', () => {
    paintOutfit(g, outfitKey)
    paintHands(g, Boolean(handKey))
  })
  t.part('face', () => {
    if (!marks.slouch) fillRect(g, 22, 27, 4, 1, 'skin')
    fillEllipse(g, 24, 18 + oy, 9.5, 8.5, 'skin')
    fillMirror(g, 13, 18 + oy, 1, 3, 'skin')
  })
  t.part('hair', () => {
    if (gear === 'hood') {
      paintHairCap(g, look.hairStyle, oy, { insideOnly: true })
    } else {
      paintHairCap(g, look.hairStyle, oy)
    }
    shadeHair(g, oy)
    if (gear === 'dye') {
      const app = APP_LOOKS[hairKey]
      if (app.gradient) gradientHair(g, app.gradient)
      else {
        palette.hair = cloth(app.main)
        palette.hairShade = shiftLightness(palette.hair, -14)
        palette.hairLight = shiftLightness(palette.hair, 18)
        palette.hairBuzz = palette.hair
      }
      logo(g, hairKey, 28, 8 + oy)
    } else if (gear && gear !== 'hood') {
      GEARS[gear](g, hairKey, oy)
    }
    if (gear === 'hood') logo(g, hairKey, 29, 8 + oy)
  })
  t.part('face', () => {
    setCell(g, 23, 21 + oy, 'skinShade')
    if (tier === 'good' && !marks.darkCircles) {
      fillMirror(g, 15, 22 + oy, 2, 1, 'blush')
    }
    paintMouth(g, tier, oy)
    // 화면 빛: 폰을 든 쪽(오른쪽) 볼과 턱에 푸른 빛
    if (marks.glow) {
      for (let y = 20 + oy; y <= 26 + oy; y += 1) for (let x = 25; x < 34; x += 1) if (getCell(g, x, y) === 'skin') setCell(g, x, y, 'skinGlow')
    }
  })
  t.part('eyes', () => paintEyes(g, eyeMode, oy, marks.slouch))
  if (marks.darkCircles) t.part('undereye', () => fillMirror(g, 18, 21 + oy + (marks.slouch ? 1 : 0), 2, 1, 'circle'))
  if (look.glasses !== 'none') t.part('face', () => paintGlasses(g, look.glasses, oy))
  if (handKey) t.part('hand', () => paintPhone(g, handKey, marks.raisePhone))
  if (marks.badges > 0) t.part('badge', () => paintBadges(g, marks.badges, oy))

  addOutline(g, 'outline')

  const body = toPixels(g)
  const parts = {}
  g.cells.forEach((color, i) => {
    const key = t.owner[i]
    if (!key || color === null) return
    ;(parts[key] ??= []).push([i % SIZE, Math.floor(i / SIZE)])
  })

  const shadow = createGrid()
  fillEllipse(shadow, 24, 45.5, 10, 1.4, 'shadow')

  const layers = { shadow: toPixels(shadow), body, blink: blinkCells(eyeMode, oy, marks.slouch), parts, fx: motionCells(g, t.owner, marks, handKey, oy) }
  if (scene) {
    const backdrop = paintScene(state.scene, { glow: marks.glow || Boolean(handKey) })
    layers.backdrop = backdrop.pixels
    Object.assign(palette, backdrop.palette)
    const covered = new Set(body.map(([x, y]) => `${x},${y}`))
    parts.scene = backdrop.pixels.filter(([x, y]) => !covered.has(`${x},${y}`)).map(([x, y]) => [x, y])
  }
  return { size: SIZE, palette, layers }
}
