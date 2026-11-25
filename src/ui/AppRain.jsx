import { useEffect, useRef, useState } from 'react'
import { Pool, seededRandom } from '../battle/pool'
import { APP_LOOKS, C } from '../character/appLook'
import {
  burst,
  characterBoxes,
  characterScale,
  clamp,
  clampSpeed,
  createSpawner,
  DRAG_MAX,
  fixedSteps,
  flushState,
  gestureOf,
  GROUND_H,
  iconAt,
  LAND_GAP,
  LAND_MIN,
  landStrength,
  PARTICLE_MAX,
  phrase,
  pileIcons,
  spriteSignature,
  stackPile,
  STEP,
  stepParticle,
  stepSpawner,
  throwVelocity,
} from './rainLogic'
import { useReducedMotion } from '../lib/motion'
import './appRain.css'

const PX = 2 // 배경 도트 한 칸(px)
const NEON = ['#ff7ec8', '#7fe7ff', '#b9b0ff', '#ffd84a']

// ── 도트 그리기 ──────────────────────────────

// 크기가 정해진 오프스크린 캔버스. 그릴 수 없는 환경이면 ctx가 null
function offscreen(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(w))
  canvas.height = Math.max(1, Math.ceil(h))
  return { canvas, ctx: canvas.getContext?.('2d') ?? null }
}

// 둥근 사각형의 i번째 줄이 안으로 들어가는 칸 수
function roundInset(i, h, r) {
  const d = Math.max(0, r - Math.min(i, h - 1 - i) - 0.5)
  return d > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))) : 0
}

// 칸 단위 계단으로 모서리를 둥글린 도트 사각형
function pixelRound(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill
  for (let i = 0; i < h; i += 1) {
    const inset = roundInset(i, h, r)
    ctx.fillRect(x + inset, y + i, w - inset * 2, 1)
  }
}

function disc(ctx, cx, cy, r, fill) {
  ctx.fillStyle = fill
  for (let y = -r; y <= r; y += 1) {
    const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3)
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1)
  }
}

// 5×5 앱 로고(appLook.js)
function drawLogo(ctx, logo, x, y, cell) {
  logo.forEach((row, ry) => {
    ;[...row].forEach((ch, rx) => {
      if (ch === '.') return
      ctx.fillStyle = C[ch] ?? ch
      ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell)
    })
  })
}

// 3×5 숫자: 한 글자가 한 줄(세 칸을 비트로)
const DIGIT_ROWS = ['75557', '26227', '71747', '71717', '55711', '74717', '74757', '71111', '75757', '75717']

function drawNumber(ctx, number, x, y) {
  let left = x
  for (const ch of String(number)) {
    ;[...DIGIT_ROWS[Number(ch)]].forEach((bits, ry) => {
      for (let i = 0; i < 3; i += 1) if (Number(bits) & (4 >> i)) ctx.fillRect(left + i, y + ry, 1, 1)
    })
    left += 4
  }
}

// 앱 아이콘 그림: 둥근 상자, 윤기, 아래 그늘
function iconSprite(kind, size) {
  const { canvas, ctx } = offscreen(size, size)
  if (!ctx) return canvas
  const look = APP_LOOKS[kind]
  const r = Math.round(size * 0.24)
  pixelRound(ctx, 0, 0, size, size, r, '#14152b')
  pixelRound(ctx, 2, 2, size - 4, size - 4, r - 1, look.main)
  if (look.gradient) {
    // 왼쪽 아래 → 오른쪽 위로 흐르는 계단 띠
    const inner = size - 4
    const band = inner / look.gradient.length
    look.gradient.forEach((color, i) => {
      ctx.fillStyle = color
      for (let y = 0; y < inner; y += 1) {
        const inset = roundInset(y, inner, r - 1)
        const from = i === 0 ? inset : clamp(Math.round(i * band + y * 0.5 - inner * 0.25), inset, inner - inset)
        ctx.fillRect(2 + from, 2 + y, inner - inset - from, 1)
      }
    })
  }
  const cell = Math.floor((size - 8) / 5)
  const inset = Math.round((size - cell * 5) / 2)
  drawLogo(ctx, look.logo, inset, inset, cell)
  // 로고가 모서리 밖으로 나가면 잘라 낸다.
  ctx.globalCompositeOperation = 'destination-in'
  pixelRoundFill(ctx, size, r)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(r, 3, size - r * 2, 2)
  ctx.fillRect(3, r, 2, Math.round(size * 0.22))
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(4, 5, size - 8, Math.round(size * 0.3))
  ctx.fillStyle = 'rgba(10,8,30,0.28)'
  ctx.fillRect(r - 1, size - 5, size - r * 2 + 2, 3)
  return canvas
}

// destination-in은 여러 번 칠하면 앞의 것이 지워지므로 한 경로로 채운다.
function pixelRoundFill(ctx, size, r) {
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  for (let i = 0; i < size; i += 1) {
    const inset = roundInset(i, size, r)
    ctx.rect(inset, i, size - inset * 2, 1)
  }
  ctx.fill()
}

function shadowSprite(size) {
  const { canvas, ctx } = offscreen(size, size)
  if (ctx) pixelRound(ctx, 0, 0, size, size, Math.round(size * 0.24), 'rgba(8,4,28,0.4)')
  return canvas
}

// 빨간 알림 배지
function badgeSprite(number) {
  const digits = String(number).length
  const w = digits * 4 + 7
  const { canvas, ctx } = offscreen(w, 13)
  if (!ctx) return canvas
  pixelRound(ctx, 0, 0, w, 13, 5, '#ffffff')
  pixelRound(ctx, 1, 1, w - 2, 11, 4, '#ff3b5c')
  ctx.fillStyle = '#ffffff'
  drawNumber(ctx, number, 4, 4)
  return canvas
}

// 캐릭터 그림(밤 배경에서 또렷하게 밝은 테두리를 두른다). blink면 눈 감은 그림
function characterSprite(sprite, blink) {
  const size = sprite.size + 2
  const { canvas, ctx } = offscreen(size, size)
  if (!ctx) return canvas
  const { body } = sprite.layers
  ctx.fillStyle = '#d9f4ff'
  for (const [x, y] of body) {
    ctx.fillRect(x, y + 1, 3, 1)
    ctx.fillRect(x + 1, y, 1, 3)
  }
  const cells = blink ? [...body, ...(sprite.layers.blink ?? [])] : body
  for (const [x, y, color] of cells) {
    ctx.fillStyle = sprite.palette?.[color] ?? color
    ctx.fillRect(x + 1, y + 1, 1, 1)
  }
  return canvas
}

// ── 배경 ──────────────────────────────

const SKY = ['#0e0a33', '#1a1150', '#2b2668', '#4a2a86', '#7a3a9e', '#b8459c', '#f0648f', '#ff9a76']
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

// 층 사이를 점 무늬로 섞은 하늘
function paintSky(ctx, w, h) {
  for (let y = 0; y < h; y += 1) {
    const t = (y / h) * (SKY.length - 1)
    const i = Math.min(SKY.length - 2, Math.floor(t))
    ctx.fillStyle = SKY[i]
    ctx.fillRect(0, y, w, 1)
    const level = Math.floor((t - i) * 16)
    ctx.fillStyle = SKY[i + 1]
    for (let x = 0; x < w; x += 1) if (BAYER[(y % 4) * 4 + (x % 4)] < level) ctx.fillRect(x, y, 1, 1)
  }
}

function paintMoon(ctx, x, y, r) {
  disc(ctx, x, y, Math.round(r * 2), 'rgba(255,200,240,0.06)')
  disc(ctx, x, y, Math.round(r * 1.6), 'rgba(255,200,240,0.08)')
  disc(ctx, x, y, Math.round(r * 1.25), 'rgba(255,220,240,0.14)')
  disc(ctx, x, y, r, '#ffd79a')
  disc(ctx, x - Math.round(r * 0.1), y - Math.round(r * 0.1), Math.round(r * 0.88), '#fff0c2')
  disc(ctx, x - Math.round(r * 0.22), y - Math.round(r * 0.24), Math.round(r * 0.6), '#fff8de')
  const crater = (dx, dy, cr) => {
    disc(ctx, x + Math.round(r * dx), y + Math.round(r * dy), Math.max(1, Math.round(r * cr)), '#f3cf94')
    disc(ctx, x + Math.round(r * dx) + 1, y + Math.round(r * dy) + 1, Math.max(1, Math.round(r * cr) - 1), '#ffe3ae')
  }
  crater(-0.35, 0.1, 0.2)
  crater(0.3, -0.35, 0.16)
  crater(0.25, 0.42, 0.24)
  crater(-0.1, -0.55, 0.1)
}

function paintCloud(ctx, x, y, w, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, 2)
  ctx.fillRect(x + Math.round(w * 0.15), y - 2, Math.round(w * 0.55), 2)
  ctx.fillRect(x + Math.round(w * 0.35), y - 4, Math.round(w * 0.22), 2)
  ctx.fillRect(x + Math.round(w * 0.3), y + 2, Math.round(w * 0.5), 1)
}

// 빌딩 한 줄. lit이 있으면 창문을 켜고 깜빡일 창을 lights에 모은다.
function paintBlocks(ctx, w, base, rand, { min, max, wide, color, edge, lit = 0, lights }) {
  for (let x = -2; x < w; ) {
    const bw = Math.round(wide[0] + rand() * (wide[1] - wide[0]))
    const bh = Math.round(min + rand() * (max - min))
    const top = base - bh
    ctx.fillStyle = color
    ctx.fillRect(x, top, bw, bh)
    if (edge) {
      ctx.fillStyle = edge
      ctx.fillRect(x, top, bw, 1)
      ctx.fillRect(x, top, 1, bh)
    }
    // 옥상 안테나
    if (rand() < 0.4) {
      const ax = x + Math.round(bw * 0.5)
      ctx.fillStyle = color
      ctx.fillRect(ax, top - 6, 1, 6)
      lights?.push({ x: ax, y: top - 7, w: 1, h: 1, color: '#ff3b5c', phase: rand() * 6, speed: 2.4, blink: true })
    }
    if (lit > 0) {
      for (let wy = top + 3; wy < base - 3; wy += 4) {
        for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
          if (rand() > lit) continue
          const tint = rand() < 0.5 ? '#ffd27a' : NEON[Math.floor(rand() * 3)]
          if (rand() < 0.1) lights?.push({ x: wx, y: wy, w: 2, h: 2, color: tint, phase: rand() * 6, speed: 0.7 + rand() })
          else {
            ctx.globalAlpha = 0.85
            ctx.fillStyle = tint
            ctx.fillRect(wx, wy, 2, 2)
            ctx.globalAlpha = 1
          }
        }
      }
    }
    x += bw + (rand() < 0.3 ? 1 : 0)
  }
}

// 스마트폰 모양 빌딩: 네온 테두리, 카메라 구멍, 앱 화면
function paintPhoneTower(ctx, x, base, w, h, neon, rand, lights) {
  const top = base - h
  ctx.globalAlpha = 0.16
  pixelRound(ctx, x - 3, top - 3, w + 6, h + 6, 6, neon)
  ctx.globalAlpha = 0.28
  pixelRound(ctx, x - 1, top - 1, w + 2, h + 4, 5, neon)
  ctx.globalAlpha = 1
  pixelRound(ctx, x, top, w, h + 6, 4, neon)
  pixelRound(ctx, x + 1, top + 1, w - 2, h + 6, 3, '#140c30')
  // 화면
  for (let y = top + 4; y < base; y += 1) {
    const t = (y - top) / h
    ctx.fillStyle = t < 0.35 ? '#2a1c66' : t < 0.65 ? '#3c2380' : '#552a92'
    ctx.fillRect(x + 2, y, w - 4, 1)
  }
  ctx.fillStyle = '#140c30'
  ctx.fillRect(x + Math.round(w / 2) - 2, top + 3, 4, 2)
  // 시계
  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = 0.9
  ctx.fillRect(x + Math.round(w / 2) - 4, top + 8, 3, 3)
  ctx.fillRect(x + Math.round(w / 2) + 1, top + 8, 3, 3)
  ctx.globalAlpha = 1
  // 앱 칸
  const colors = ['#fee500', '#e1306c', '#ff1f3d', '#25f4ee', '#00c85a', '#5865f2', '#2ac1bc', '#ffb21e', '#ffffff']
  const columns = Math.max(2, Math.floor((w - 5) / 5))
  const left = x + Math.round((w - (columns * 5 - 2)) / 2)
  for (let y = top + 15; y < base - 5; y += 6) {
    for (let i = 0; i < columns; i += 1) {
      const color = colors[Math.floor(rand() * colors.length)]
      if (rand() < 0.18) lights.push({ x: left + i * 5, y, w: 3, h: 3, color, phase: rand() * 6, speed: 1 + rand() * 1.5 })
      else {
        ctx.globalAlpha = 0.9
        ctx.fillStyle = color
        ctx.fillRect(left + i * 5, y, 3, 3)
        ctx.globalAlpha = 1
      }
    }
  }
  // 새 알림
  lights.push({ x: x + w - 3, y: top - 2, w: 4, h: 4, color: '#ff3b5c', phase: rand() * 6, speed: 3, blink: true })
}

// 배경(도트 한 칸 = PX)과 반짝일 것들
function buildBackdrop(width, height) {
  const w = Math.ceil(width / PX)
  const h = Math.ceil(height / PX)
  const { canvas, ctx } = offscreen(w, h)
  const stars = []
  const lights = []
  if (!ctx) return { canvas, stars, lights, bulbs: [] }
  const rand = seededRandom(4207)
  const base = h - Math.floor(GROUND_H / PX)
  paintSky(ctx, w, base)

  const total = Math.round((w * h) / 260)
  for (let i = 0; i < total; i += 1) {
    const x = Math.floor(rand() * w)
    const y = Math.floor(rand() * rand() * base * 0.75)
    if (i % 4 === 0) stars.push({ x, y, phase: rand() * 6, big: i % 12 === 0, color: rand() < 0.7 ? '#ffffff' : NEON[Math.floor(rand() * 3)] })
    else {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(200,190,255,0.4)'
      ctx.fillRect(x, y, 1, 1)
    }
  }

  paintMoon(ctx, Math.round(w * 0.8), Math.round(h * 0.3), Math.max(10, Math.round(Math.min(h * 0.17, w * 0.12))))
  paintCloud(ctx, Math.round(w * 0.06), Math.round(h * 0.34), 34, 'rgba(255,170,220,0.22)')
  paintCloud(ctx, Math.round(w * 0.64), Math.round(h * 0.4), 44, 'rgba(255,190,225,0.35)')
  paintCloud(ctx, Math.round(w * 0.34), Math.round(h * 0.22), 26, 'rgba(190,170,255,0.2)')

  paintBlocks(ctx, w, base, rand, { min: h * 0.14, max: h * 0.36, wide: [7, 15], color: '#8a3f9e' })
  paintBlocks(ctx, w, base, rand, { min: h * 0.1, max: h * 0.3, wide: [9, 18], color: '#4a2380', edge: '#6a35a0', lit: 0.3, lights })

  // 폰 빌딩은 캐릭터가 설 가운데를 비우고 세운다.
  const slots = Math.max(4, Math.round(w / 46))
  for (let i = 0; i < slots; i += 1) {
    const center = (i + 0.5) / slots
    const middle = Math.abs(center - 0.5) < 0.1
    const pw = 18 + Math.floor(rand() * 8)
    const ph = Math.round(h * (middle ? 0.2 : 0.3 + rand() * 0.22))
    paintPhoneTower(ctx, Math.round(center * w - pw / 2 + (rand() - 0.5) * 8), base, pw, ph, NEON[i % 3], rand, lights)
  }
  paintBlocks(ctx, w, base, rand, { min: 4, max: h * 0.1, wide: [10, 24], color: '#1c1046', edge: '#37207a', lit: 0.16, lights })

  // 위쪽 전구 줄
  const bulbs = []
  const span = 46
  const spans = Math.max(1, Math.round(w / span))
  for (let x = 0; x < w; x += 1) {
    const u = ((x / w) * spans) % 1
    const y = 1 + Math.round(5 * 4 * u * (1 - u))
    ctx.fillStyle = '#0e0a33'
    ctx.fillRect(x, y, 1, 1)
    if (x % 9 === 4) bulbs.push({ x: x - 1, y: y + 1, color: NEON[bulbs.length % NEON.length], index: bulbs.length })
  }
  return { canvas, stars, lights, bulbs }
}

// 바닥 띠: 네온 줄과 타일(열릴 때 좌우로 잘라 움직인다)
function buildFloor(width) {
  const w = Math.ceil(width / PX)
  const h = Math.floor(GROUND_H / PX)
  const { canvas, ctx } = offscreen(w, h)
  if (!ctx) return canvas
  ctx.fillStyle = '#231452'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, 1)
  ctx.fillStyle = '#7fe7ff'
  ctx.fillRect(0, 1, w, 1)
  ctx.fillStyle = '#ff7ec8'
  ctx.fillRect(0, 2, w, 1)
  ctx.fillStyle = '#7a2f9c'
  ctx.fillRect(0, 3, w, 1)
  for (let x = 0; x < w; x += 10) {
    ctx.fillStyle = '#37207a'
    ctx.fillRect(x + 1, 5, 8, h - 6)
    ctx.fillStyle = '#4a2c98'
    ctx.fillRect(x + 1, 5, 8, 1)
  }
  return canvas
}

// ── 장면 ──────────────────────────────

// 캔버스 하나를 맡는 장면. live()는 지금의 속성, onCount()는 앱을 지웠을 때
function createScene({ canvas, wrap, ctx, reduced, live, onCount }) {
  const rand = seededRandom(Date.now() >>> 0)
  const spawner = createSpawner((Date.now() ^ 0x5bd1) >>> 0)
  const images = new Map()
  const particles = new Pool(() => ({}))
  const cleanups = []
  let disposed = false
  let width = 0
  let height = 0
  let ratio = 1
  let ground = 0
  let backdrop = null
  let floor = null
  let character = null // { signature, normal, blink, boxes }
  let place = null // 화면 위 캐릭터 자리
  let icons = []
  let mode = 'loading' // 'loading' | 'live' | 'still'
  let M = null
  let engine = null
  let statics = null
  let drag = null
  let frame = 0
  let lastAt = null
  let acc = 0
  let clock = 0
  let wasFlushing = false
  let squash = 0
  let dizzy = 0
  let lastLand = -Infinity
  let onScreen = true
  let pile = 0

  const image = (key, make) => {
    if (!images.has(key)) images.set(key, make())
    return images.get(key)
  }
  const spark = (values) => {
    if (particles.size < PARTICLE_MAX) particles.acquire(values)
  }
  const float = (x, y, text, color, size = 15) =>
    spark({ kind: 'text', x: clamp(x, 30, Math.max(30, width - 30)), y: Math.max(22, y), vx: 0, vy: -46, gravity: 30, life: 0.9, max: 0.9, color, text, size })

  // ── 크기 ──

  function locate() {
    place = null
    if (!character) return
    const { bounds } = character.boxes
    const scale = characterScale(bounds, width, height - GROUND_H)
    const x = Math.round(width / 2 - (bounds.x + bounds.w / 2) * scale)
    const y = Math.round(ground - (bounds.y + bounds.h) * scale)
    const box = ({ x: bx, y: by, w, h }) => ({ x: x + bx * scale, y: y + by * scale, w: w * scale, h: h * scale })
    const torso = box(character.boxes.torso)
    place = { scale, x, y, head: box(character.boxes.head), torso, stand: Math.round(Math.max(torso.w, 36) / (PX * 2)) * PX * 2 }
  }

  // 벽·문·받침·캐릭터 몸을 지금 크기로 다시 놓는다.
  function layout() {
    locate()
    if (mode === 'still') return restack()
    if (!engine) return undefined
    const { Bodies, Body, Composite } = M
    if (statics) Composite.remove(engine.world, statics.all)
    const fixed = { isStatic: true, friction: 0.5, restitution: 0.15 }
    const thick = 240
    const tall = height * 4 + 1200
    const half = place ? place.stand / 2 : 0
    const doorW = width / 2 - half
    const make = (x, y, w, h, label, extra) => Bodies.rectangle(x, y, w, h, { ...fixed, label, ...extra })
    const left = make(-thick / 2, height / 2, thick, tall, 'wall')
    const right = make(width + thick / 2, height / 2, thick, tall, 'wall')
    const ceiling = make(width / 2, -320 - thick / 2, width + thick * 2, thick, 'wall')
    // 문은 얇아도 뚫리지 않게 아래로 두껍게
    const doorL = make(doorW / 2, ground + 60, doorW, 120, 'floor')
    const doorR = make(width - doorW / 2, ground + 60, doorW, 120, 'floor')
    const all = [left, right, ceiling, doorL, doorR]
    if (place) {
      const { head, torso } = place
      all.push(make(width / 2, ground + 60, place.stand, 120, 'floor'))
      const round = (box) => ({ chamfer: { radius: Math.min(box.w, box.h) * 0.42 } })
      const add = (box, label, chamfer) => all.push(make(box.x + box.w / 2, box.y + box.h / 2, box.w, box.h, label, { ...chamfer, friction: 0.08, restitution: 0.55 }))
      add(head, 'head', round(head))
      add(torso, 'torso', { chamfer: { radius: Math.min(torso.w, torso.h) * 0.2 } })
    }
    statics = { all, doorL, doorR, doorW }
    Composite.add(engine.world, all)
    for (const icon of icons) {
      const edge = icon.size / 2
      const x = clamp(icon.body.position.x, edge, Math.max(edge, width - edge))
      const y = Math.min(icon.body.position.y, ground - edge)
      Body.setPosition(icon.body, { x, y })
    }
    sync()
    return undefined
  }

  function resize() {
    const nextW = Math.floor(wrap.clientWidth || wrap.getBoundingClientRect?.().width || 0) || (width ? 0 : 320)
    if (disposed || nextW <= 0) return
    const nextH = Math.max(120, Math.round(live().height) || 260)
    const nextRatio = clamp(window.devicePixelRatio || 1, 1, 2)
    if (nextW === width && nextH === height && nextRatio === ratio) return
    const reshaped = nextW !== width || nextH !== height
    width = nextW
    height = nextH
    ratio = nextRatio
    ground = height - GROUND_H
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    if (reshaped) {
      backdrop = buildBackdrop(width, height)
      floor = buildFloor(width)
      layout()
    }
    draw()
  }

  function setSprite(sprite) {
    const signature = spriteSignature(sprite)
    if ((character?.signature ?? '') === signature) return
    character = signature ? { signature, normal: characterSprite(sprite, false), blink: characterSprite(sprite, true), boxes: characterBoxes(sprite.layers.body) } : null
    layout()
    draw()
  }

  // ── 멈춘 더미 ──

  function restack() {
    const blocks = place ? [place.head, place.torso] : []
    icons = stackPile(icons, width, ground, blocks)
  }

  function goStill() {
    mode = 'still'
    icons = pileIcons(22, 7)
    restack()
    draw()
  }

  // ── 물리 ──

  function sync() {
    for (const icon of icons) {
      icon.x = icon.body.position.x
      icon.y = icon.body.position.y
      icon.angle = icon.body.angle
    }
  }

  function addIcon(spawn) {
    const { Bodies, Body, Composite } = M
    const body = Bodies.rectangle(spawn.x, spawn.y, spawn.size, spawn.size, {
      chamfer: { radius: spawn.size * 0.22 },
      angle: spawn.angle,
      restitution: 0.32,
      friction: 0.35,
      frictionAir: 0.008,
      density: 0.0012,
      label: 'icon',
    })
    Body.setVelocity(body, { x: spawn.vx, y: 2 })
    Body.setAngularVelocity(body, spawn.spin)
    icons.push({ kind: spawn.kind, size: spawn.size, badge: spawn.badge, body, x: spawn.x, y: spawn.y, angle: spawn.angle })
    Composite.add(engine.world, body)
  }

  function removeIcon(icon) {
    if (drag?.icon === icon) drag = null
    icons = icons.filter((item) => item !== icon)
    if (icon.body && engine) M.Composite.remove(engine.world, icon.body)
  }

  function bonk(x, y) {
    squash = 0.3
    dizzy = 1.1
    for (const bit of burst(x, y, ['#ffd84a', '#ffffff', '#ff7ec8'], 8, 130, rand)) spark({ ...bit, kind: 'star' })
    float(x, y - 14, '퍽!', '#ffd84a', 17)
  }

  function collide(event) {
    for (const { bodyA, bodyB, collision } of event.pairs) {
      const labels = [bodyA.label, bodyB.label]
      if (!labels.includes('icon') || labels.includes('wall')) continue
      const dvx = bodyA.velocity.x - bodyB.velocity.x
      const dvy = bodyA.velocity.y - bodyB.velocity.y
      const speed = Math.abs(dvx * collision.normal.x + dvy * collision.normal.y)
      if (speed < LAND_MIN) continue
      const point = collision.supports?.[0] ?? bodyA.position
      const now = performance.now()
      if (now - lastLand >= LAND_GAP) {
        lastLand = now
        live().onLand?.(landStrength(speed))
      }
      if (labels.includes('head')) {
        if (squash <= 0) bonk(point.x, Math.min(point.y, place ? place.head.y + 6 : point.y))
      } else if (labels.includes('floor') && speed > 6) {
        for (const bit of burst(point.x, ground - 2, ['#e8d9ff', '#b9b0ff'], 5, 60, rand)) spark({ ...bit, size: 2, life: 0.3, max: 0.3 })
      }
    }
  }

  function pull() {
    const { Body } = M
    const { icon, target } = drag
    const { body } = icon
    const cos = Math.cos(body.angle)
    const sin = Math.sin(body.angle)
    // 잡은 점이 손가락을 따라오게
    const gx = body.position.x + drag.grab.x * cos - drag.grab.y * sin
    const gy = body.position.y + drag.grab.x * sin + drag.grab.y * cos
    Body.setVelocity(body, clampSpeed((target.x - gx) * 0.32, (target.y - gy) * 0.32, DRAG_MAX))
    Body.setAngularVelocity(body, body.angularVelocity * 0.85)
  }

  function step() {
    const { Body, Engine } = M
    clock += STEP
    const flush = flushState(clock)
    const spawn = stepSpawner(spawner, STEP, { count: icons.length, width, paused: flush.active })
    if (spawn) addIcon(spawn)

    if (flush.active && !wasFlushing) {
      float(width / 2, place ? place.head.y - 16 : ground - 40, '비우는 중!', '#7fe7ff', 14)
      for (const icon of icons) Body.setAngularVelocity(icon.body, (rand() - 0.5) * 0.2)
    }
    wasFlushing = flush.active
    const { doorL, doorR, doorW } = statics
    const shift = flush.open * doorW
    Body.setPosition(doorL, { x: doorW / 2 - shift, y: ground + 60 })
    Body.setPosition(doorR, { x: width - doorW / 2 + shift, y: ground + 60 })
    // 열려 있는 동안 캐릭터 위나 받침에 걸린 것은 바깥으로 밀어낸다.
    if (place && flush.open === 1) {
      for (const icon of icons) {
        const dx = icon.x - width / 2
        if (icon === drag?.icon || Math.abs(dx) > (Math.max(place.stand, place.head.w) + icon.size) / 2) continue
        Body.setVelocity(icon.body, { x: clamp(icon.body.velocity.x + (dx < 0 ? -0.4 : 0.4), -4, 4), y: icon.body.velocity.y })
      }
    }
    // 닫힐 때 바닥에 걸린 것은 문에 끼이지 않게 치운다.
    if (flush.closing) for (const icon of icons) if (icon !== drag?.icon && icon.body.position.y + icon.size / 2 > ground + 4) removeIcon(icon)

    if (drag) pull()
    Engine.update(engine, STEP * 1000)
    sync()
    for (const icon of icons) {
      if (!(icon.y < height + 80 && icon.y > -600 && icon.x > -80 && icon.x < width + 80)) removeIcon(icon)
    }
    squash = Math.max(0, squash - STEP)
    dizzy = Math.max(0, dizzy - STEP)
  }

  function pop(icon) {
    const { x, y, kind } = icon
    const look = APP_LOOKS[kind]
    removeIcon(icon)
    if (mode === 'still') {
      if (icons.length === 0) {
        pile += 1
        icons = pileIcons(22, 7 + pile)
      }
      restack()
    } else {
      for (const bit of burst(x, y, [look.main, look.sub, '#ffffff', '#ffd84a'], 14, 190, rand)) spark(bit)
      spark({ kind: 'ring', x, y, vx: 0, vy: 0, gravity: 0, life: 0.28, max: 0.28, color: '#ffffff', size: icon.size })
      float(x, y - 6, '삭제!', '#ffffff')
    }
    onCount()
    if (frame === 0) draw()
  }

  // ── 그리기 ──

  function drawSky() {
    ctx.drawImage(backdrop.canvas, 0, 0, backdrop.canvas.width * PX, backdrop.canvas.height * PX)
    for (const star of backdrop.stars) {
      const glow = 0.5 + 0.5 * Math.sin(clock * 2.2 + star.phase)
      ctx.globalAlpha = 0.2 + glow * 0.8
      ctx.fillStyle = star.color
      ctx.fillRect(star.x * PX, star.y * PX, PX, PX)
      if (star.big && glow > 0.6) {
        ctx.globalAlpha = (glow - 0.6) * 1.6
        ctx.fillRect((star.x - 1) * PX, star.y * PX, PX * 3, PX)
        ctx.fillRect(star.x * PX, (star.y - 1) * PX, PX, PX * 3)
      }
    }
    for (const light of backdrop.lights) {
      const wave = Math.sin(clock * light.speed + light.phase)
      ctx.globalAlpha = light.blink ? (wave > 0 ? 1 : 0.2) : wave > -0.4 ? 0.95 : 0.25
      ctx.fillStyle = light.color
      ctx.fillRect(light.x * PX, light.y * PX, light.w * PX, light.h * PX)
    }
    // 별똥별: 7초마다 한 번
    const t = (clock + 3) % 7
    if (t < 0.6 && mode === 'live') {
      const turn = Math.floor((clock + 3) / 7)
      const sx = ((turn * 137) % 100) / 100
      for (let i = 0; i < 9; i += 1) {
        ctx.globalAlpha = Math.max(0, (1 - i / 9) * (1 - t / 0.6))
        ctx.fillStyle = i < 2 ? '#ffffff' : '#9fe9ff'
        const x = width * (0.1 + sx * 0.5) + t * 240 - i * 6
        const y = height * 0.06 + t * 100 - i * 2.5
        ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, PX * 2, PX)
      }
    }
    for (const bulb of backdrop.bulbs) {
      const on = (Math.floor(clock * 2) + bulb.index) % 3 !== 0
      ctx.globalAlpha = on ? 0.28 : 0.08
      ctx.fillStyle = bulb.color
      ctx.fillRect((bulb.x - 1) * PX, (bulb.y - 1) * PX, PX * 5, PX * 5)
      ctx.globalAlpha = on ? 1 : 0.5
      ctx.fillRect(bulb.x * PX, bulb.y * PX, PX * 3, PX * 3)
      ctx.globalAlpha = on ? 0.9 : 0.2
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(bulb.x * PX, bulb.y * PX, PX, PX)
    }
    ctx.globalAlpha = 1
  }

  function drawHole(open) {
    if (open <= 0) return
    const rows = Math.ceil((height - ground) / 4)
    for (let i = 0; i < rows; i += 1) {
      ctx.fillStyle = ['#0a0420', '#150a3a', '#2a1464', '#53259a', '#b03fa8', '#ff7ec8'][Math.min(5, i)]
      ctx.fillRect(0, ground + i * 4, width, 4)
    }
  }

  function drawFloor(flush) {
    const half = place ? place.stand / 2 : 0
    const doorW = Math.ceil(width / 2 - half)
    const shift = Math.round((flush.open * doorW) / PX) * PX
    const piece = (sx, sw, dx) => {
      if (sw > 0) ctx.drawImage(floor, sx / PX, 0, sw / PX, floor.height, dx, ground, sw, floor.height * PX)
    }
    piece(0, doorW, -shift)
    piece(width - doorW, doorW, width - doorW + shift)
    if (place) {
      const x = Math.round(width / 2 - half)
      piece(x, place.stand, x)
      if (flush.active) {
        ctx.fillStyle = '#0e0a33'
        ctx.fillRect(x - PX, ground, PX, height - ground)
        ctx.fillRect(x + place.stand, ground, PX, height - ground)
      }
    }
    // 불빛: 열리기 전에는 빨갛게 깜빡인다.
    for (let i = 0; i * 20 < width; i += 1) {
      const x = i * 20 + 8
      const middle = place && Math.abs(x - width / 2) < half
      const dx = middle ? 0 : x < width / 2 ? -shift : shift
      const on = flush.warn || flush.active ? Math.floor(clock * 8) % 2 === 0 : (Math.floor(clock * 3) + i) % 4 === 0
      ctx.globalAlpha = on ? 1 : 0.3
      ctx.fillStyle = flush.warn || flush.active ? '#ff3b5c' : NEON[i % NEON.length]
      ctx.fillRect(x + dx, ground + 14, 4, 4)
    }
    ctx.globalAlpha = 1
  }

  function drawCharacter() {
    if (!place) return
    const { scale } = place
    const blink = clock % 3.4 > 3.25
    const shot = blink || squash > 0 ? character.blink : character.normal
    const size = shot.width * scale
    const cx = width / 2
    // 뒤쪽 조명
    ctx.fillStyle = 'rgba(255,126,200,0.12)'
    const { head } = place
    for (let i = 0; i < 3; i += 1) {
      const r = head.w * (0.95 - i * 0.2)
      for (let y = -r; y <= r; y += 4) {
        const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y)) / 4) * 4
        ctx.fillRect(Math.round(cx - half), Math.round(head.y + head.h * 0.6 + y), half * 2, 4)
      }
    }
    ctx.fillStyle = 'rgba(8,4,28,0.45)'
    ctx.fillRect(Math.round(cx - place.torso.w * 0.5), ground - 3, Math.round(place.torso.w), 5)
    // 맞으면 잠깐 납작해진다(발은 땅에 붙어 있다).
    const k = squash > 0 ? Math.sin((squash / 0.3) * Math.PI) : 0
    const breath = mode === 'live' && k === 0 && Math.sin(clock * 2.4) > 0.6 ? 1 - 1 / (character.boxes.bounds.h * scale) : 1
    ctx.save()
    ctx.translate(cx, ground)
    ctx.scale(1 + k * 0.12, (1 - k * 0.18) * breath)
    ctx.drawImage(shot, place.x - scale - cx, place.y - scale - ground, size, size)
    ctx.restore()
    if (dizzy <= 0) return
    for (let i = 0; i < 4; i += 1) {
      const a = clock * 6 + (i * Math.PI) / 2
      ctx.globalAlpha = Math.min(1, dizzy * 2)
      drawStar(Math.round(cx + Math.cos(a) * head.w * 0.5), Math.round(head.y + 4 + Math.sin(a) * 7), 2, i % 2 ? '#ffffff' : '#ffd84a')
    }
    ctx.globalAlpha = 1
  }

  function drawStar(x, y, p, color) {
    ctx.fillStyle = color
    ctx.fillRect(x - p / 2, y - p * 1.5, p, p * 3)
    ctx.fillRect(x - p * 1.5, y - p / 2, p * 3, p)
  }

  function drawIcon(icon, lifted) {
    const { size, kind, badge } = icon
    // 거의 바로 섰으면 똑바로 그려 또렷하게
    const quarter = Math.round(icon.angle / (Math.PI / 2)) * (Math.PI / 2)
    const angle = Math.abs(icon.angle - quarter) < 0.03 ? quarter : icon.angle
    const x = Math.round(icon.x * ratio) / ratio
    const y = Math.round(icon.y * ratio) / ratio
    const drop = lifted ? 8 : 3
    ctx.save()
    ctx.translate(x + (lifted ? 4 : 2), y + drop)
    ctx.rotate(angle)
    ctx.drawImage(image(`shadow-${size}`, () => shadowSprite(size)), -size / 2, -size / 2)
    ctx.restore()
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    if (lifted) {
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 0.9
      ctx.fillRect(-size / 2 + 5, -size / 2 - 2, size - 10, size + 4)
      ctx.fillRect(-size / 2 - 2, -size / 2 + 5, size + 4, size - 10)
      ctx.globalAlpha = 1
    }
    ctx.drawImage(image(`${kind}-${size}`, () => iconSprite(kind, size)), -size / 2, -size / 2)
    if (badge) {
      const label = image(`badge-${badge}`, () => badgeSprite(badge))
      ctx.drawImage(label, size / 2 - label.width + 4, -size / 2 - 4)
    }
    ctx.restore()
  }

  function drawParticles() {
    for (const bit of particles.active) {
      const t = clamp(bit.life / bit.max, 0, 1)
      ctx.globalAlpha = Math.min(1, t * 1.8)
      const x = Math.round(bit.x)
      const y = Math.round(bit.y)
      if (bit.kind === 'text') {
        ctx.font = `bold ${bit.size}px Galmuri11, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#14152b'
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]]) ctx.fillText(bit.text, x + dx, y + dy)
        ctx.fillStyle = bit.color
        ctx.fillText(bit.text, x, y)
      } else if (bit.kind === 'ring') {
        const r = Math.round((bit.size * (1.3 - t * 0.8)) / 2) * 2
        ctx.fillStyle = bit.color
        ctx.fillRect(x - r + 4, y - r, r * 2 - 8, 3)
        ctx.fillRect(x - r + 4, y + r - 3, r * 2 - 8, 3)
        ctx.fillRect(x - r, y - r + 4, 3, r * 2 - 8)
        ctx.fillRect(x + r - 3, y - r + 4, 3, r * 2 - 8)
      } else if (bit.kind === 'star') {
        drawStar(x, y, bit.size > 4 ? 4 : 2, bit.color)
      } else {
        const size = Math.max(2, Math.round((bit.size * (0.5 + t * 0.5)) / 2) * 2)
        ctx.fillStyle = bit.color
        ctx.fillRect(x - size / 2, y - size / 2, size, size)
      }
    }
    ctx.globalAlpha = 1
  }

  function draw() {
    if (disposed || width === 0) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.imageSmoothingEnabled = false
    const flush = mode === 'live' ? flushState(clock) : { open: 0, active: false, warn: false }
    drawSky()
    drawHole(flush.open)
    drawCharacter()
    for (const icon of icons) if (icon !== drag?.icon) drawIcon(icon, false)
    drawFloor(flush)
    if (drag) drawIcon(drag.icon, true)
    drawParticles()
  }

  // ── 시계 ──

  const canRun = () => !disposed && mode === 'live' && onScreen && !document.hidden

  function tick(now) {
    frame = 0
    if (!canRun()) return
    const dt = lastAt === null ? STEP : Math.min(0.25, (now - lastAt) / 1000)
    lastAt = now
    const plan = fixedSteps(acc, dt)
    acc = plan.acc
    for (let i = 0; i < plan.steps; i += 1) {
      step()
      particles.sweep((bit) => stepParticle(bit, STEP))
    }
    draw()
    frame = requestAnimationFrame(tick)
  }

  function wake() {
    if (canRun()) {
      if (frame === 0) {
        lastAt = null // 쉰 시간은 세지 않는다.
        acc = 0
        frame = requestAnimationFrame(tick)
      }
    } else {
      if (frame !== 0) cancelAnimationFrame(frame)
      frame = 0
      drag = null
    }
  }

  // ── 손가락 ──

  function toLocal(event) {
    const rect = canvas.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) * width) / (rect.width || width || 1), y: ((event.clientY - rect.top) * height) / (rect.height || height || 1) }
  }
  const slopOf = (event) => (event.pointerType === 'mouse' ? 1 : 8)
  const within = ({ x, y }, edge) => ({ x: clamp(x, edge, Math.max(edge, width - edge)), y: clamp(y, edge, ground - edge) })

  function down(event) {
    if (!live().interactive || drag || (event.pointerType === 'mouse' && event.button !== 0)) return
    const point = toLocal(event)
    const icon = iconAt(icons, point.x, point.y, slopOf(event))
    if (!icon) return
    const dx = point.x - icon.x
    const dy = point.y - icon.y
    const cos = Math.cos(icon.angle)
    const sin = Math.sin(icon.angle)
    const at = performance.now()
    drag = {
      icon,
      id: event.pointerId,
      at,
      start: point,
      moved: 0,
      target: within(point, 4),
      grab: { x: dx * cos + dy * sin, y: dy * cos - dx * sin },
      trail: [{ ...point, t: at }],
    }
    try {
      canvas.setPointerCapture?.(event.pointerId)
    } catch {
      // 이미 끝난 손가락이면 잡지 않아도 된다.
    }
    canvas.style.cursor = 'grabbing'
    if (frame === 0) draw()
  }

  function move(event) {
    const point = toLocal(event)
    if (!drag || drag.id !== event.pointerId) {
      if (!drag && event.pointerType === 'mouse') canvas.style.cursor = live().interactive && iconAt(icons, point.x, point.y, 1) ? 'grab' : ''
      return
    }
    drag.moved = Math.max(drag.moved, Math.hypot(point.x - drag.start.x, point.y - drag.start.y))
    drag.target = within(point, 4)
    drag.trail.push({ ...point, t: performance.now() })
    if (drag.trail.length > 12) drag.trail.shift()
  }

  function release(event, cancelled) {
    if (!drag || drag.id !== event.pointerId) return
    const { icon, at, moved, trail } = drag
    drag = null
    canvas.style.cursor = ''
    const now = performance.now()
    if (!cancelled && gestureOf(moved, now - at) === 'tap') pop(icon)
    else if (icon.body && engine) M.Body.setVelocity(icon.body, cancelled ? { x: 0, y: 0 } : throwVelocity(trail, now))
    if (frame === 0) draw()
  }

  // 아이콘에서 시작한 손가락만 화면 넘기기를 막는다.
  function touch(event) {
    if (!live().interactive) return
    const hit = [...(event.changedTouches ?? [])].some((finger) => {
      const point = toLocal(finger)
      return iconAt(icons, point.x, point.y, 8) !== null
    })
    if ((hit || drag) && event.cancelable) event.preventDefault()
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options)
    cleanups.push(() => target.removeEventListener(type, handler, options))
  }

  // ── 시작 ──

  listen(canvas, 'pointerdown', down)
  listen(canvas, 'pointermove', move)
  listen(canvas, 'pointerup', (event) => release(event, false))
  listen(canvas, 'pointercancel', (event) => release(event, true))
  listen(canvas, 'lostpointercapture', (event) => release(event, true))
  listen(canvas, 'touchstart', touch, { passive: false })
  listen(document, 'visibilitychange', wake)
  listen(window, 'resize', resize) // 화면 배율이 바뀔 때도
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    cleanups.push(() => observer.disconnect())
  }
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting
      wake()
    })
    observer.observe(canvas)
    cleanups.push(() => observer.disconnect())
  }

  function startPhysics(module) {
    M = module
    engine = M.Engine.create()
    M.Events.on(engine, 'collisionStart', collide)
    mode = 'live'
    layout()
    draw()
    wake()
  }

  resize()
  setSprite(live().sprite)
  if (reduced) goStill()
  else {
    import('matter-js').then(
      (module) => {
        if (!disposed) startPhysics(module.default ?? module)
      },
      () => {
        if (!disposed) goStill()
      },
    )
  }

  return {
    resize,
    setSprite,
    dispose() {
      disposed = true
      drag = null
      if (frame !== 0) cancelAnimationFrame(frame)
      frame = 0
      for (const undo of cleanups) undo()
      if (engine) {
        M.Events.off(engine)
        M.Composite.clear(engine.world, false, true)
        M.Engine.clear(engine)
      }
      engine = null
      statics = null
      icons = []
      images.clear()
    },
  }
}

// sprite: drawCharacter()·loadoutSprite()가 돌려준 그림(없으면 캐릭터 없이)
// label: 화면 낭독기용 장면 이름, onPop(지운 개수), onLand(세기 0~1)
function AppRain({ sprite = null, height = 260, label = '', onPop, onLand, className = '', interactive = true, children }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const sceneRef = useRef(null)
  const countRef = useRef(0)
  const liveRef = useRef({ sprite, height, interactive, onPop, onLand })
  const [count, setCount] = useState(0)
  const reduced = useReducedMotion()

  // 부모가 다시 그려도 장면은 그대로 두고 값만 바꿔 끼운다.
  useEffect(() => {
    liveRef.current = { sprite, height, interactive, onPop, onLand }
    sceneRef.current?.setSprite(sprite)
    sceneRef.current?.resize()
  }, [sprite, height, interactive, onPop, onLand])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d')
    if (!ctx) return undefined
    const scene = createScene({
      canvas,
      wrap: wrapRef.current,
      ctx,
      reduced,
      live: () => liveRef.current,
      onCount: () => {
        countRef.current += 1
        setCount(countRef.current)
        liveRef.current.onPop?.(countRef.current)
      },
    })
    sceneRef.current = scene
    return () => {
      sceneRef.current = null
      scene.dispose()
    }
  }, [reduced])

  return (
    <div className={`app-rain ${className}`.trim()} role={label ? 'group' : undefined} aria-label={label || undefined}>
      <div className="app-rain-stage" ref={wrapRef} style={{ height }}>
        <canvas className="app-rain-canvas" ref={canvasRef} style={{ height }} aria-hidden="true" />
        {children && <div className="app-rain-overlay">{children}</div>}
      </div>
      {interactive && (
        <p className="app-rain-phrase" aria-live="polite">
          {phrase(count)}
        </p>
      )}
    </div>
  )
}

export default AppRain
