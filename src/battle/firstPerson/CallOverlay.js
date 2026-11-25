import { seededRandom } from '../pool'
import { AREA, ARENA } from '../arena'
import { INK, pixelArt, pixelBox } from './art'

// 영상통화 화면의 겹침 그림: 통화 이름표, 작은 내 얼굴, 버튼, 테두리, 끊김 효과. 모두 이 앱만의 도트 모양이다.
// 좌표는 AREA 왼쪽 위가 (0, 0)인 360×512. 왼쪽 위의 작은 지도(8~88)는 비워 둔다.

const W = ARENA.w
const H = AREA.y1 - AREA.y0
const FONT = 'Galmuri11, sans-serif'
const RING = 1.35 // "전화 왔어요!" 카드(초)
const GLITCH = 0.9 // 상대가 맞았을 때 끊김(초)
const SWITCH = 1.4 // 다른 사람으로 이어졌다는 알림(초)
const HURT = 0.5
const GAP = 700 // 이만큼(ms) 그리지 않다가 다시 그리면 새 통화다
const HEAD = { x: 98, y: 10, w: 178, h: 46 }
const PIP = { x: 286, y: 10, w: 64, h: 78 }
const BUTTON = 46
const BUTTONS = [
  { key: 'mute', label: '음소거', x: 78, fill: '#3d4170', rows: ['..###..', '..###..', '..###..', '#.###.#', '#.###.#', '.#...#.', '..###..', '...#...', '..###..'] },
  { key: 'camera', label: '화면', x: 157, fill: '#3d4170', rows: ['.........', '######..#', '######.##', '#########', '#########', '######.##', '######..#', '.........'] },
  { key: 'hang', label: '끊기', x: 236, fill: '#ff3b5c', rows: ['...#####...', '.#########.', '###########', '####...####', '###.....###', '.#.......#.'] },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback)

function domCanvas(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

// 2px 칸으로 찍은 동그라미
function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color
  for (let y = -r; y < r; y += 2) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - (y + 1) * (y + 1))) / 2) * 2
    if (half > 0) ctx.fillRect(cx - half, cy + y, half * 2, 2)
  }
}

export const callTime = (seconds) => {
  const total = Math.max(0, Math.floor(num(seconds)))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// 둥근 테두리 + 주사선(한 번만 그려 둔다)
function frameImage(make) {
  const canvas = make(W, H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(8,10,34,0.13)'
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)
  ctx.fillStyle = 'rgba(170,220,255,0.05)'
  for (let y = 2; y < H; y += 4) ctx.fillRect(0, y, W, 1)
  // 가장자리로 갈수록 어둡게
  for (let i = 0; i < 9; i += 1) {
    ctx.fillStyle = `rgba(10,6,34,${(0.16 - i * 0.015).toFixed(3)})`
    const a = i * 4
    ctx.fillRect(a, a, W - a * 2, 4)
    ctx.fillRect(a, H - a - 4, W - a * 2, 4)
    ctx.fillRect(a, a + 4, 4, H - a * 2 - 8)
    ctx.fillRect(W - a - 4, a + 4, 4, H - a * 2 - 8)
  }
  // 네 모서리를 둥글게 깎고 초록 띠를 두른다.
  const r = 24
  for (let y = 0; y < r; y += 2) {
    const cut = Math.ceil((r - Math.sqrt(r * r - (r - y - 1) * (r - y - 1))) / 2) * 2
    for (const top of [y, H - y - 2]) {
      ctx.fillStyle = INK
      ctx.fillRect(0, top, cut + 2, 2)
      ctx.fillRect(W - cut - 2, top, cut + 2, 2)
      ctx.fillStyle = '#4cc96b'
      ctx.fillRect(cut + 2, top, 2, 2)
      ctx.fillRect(W - cut - 4, top, 2, 2)
    }
  }
  ctx.fillStyle = INK
  ctx.fillRect(r, 0, W - r * 2, 2)
  ctx.fillRect(r, H - 2, W - r * 2, 2)
  ctx.fillRect(0, r, 2, H - r * 2)
  ctx.fillRect(W - 2, r, 2, H - r * 2)
  ctx.fillStyle = '#4cc96b'
  ctx.fillRect(r, 2, W - r * 2, 2)
  ctx.fillRect(r, H - 4, W - r * 2, 2)
  ctx.fillRect(2, r, 2, H - r * 2)
  ctx.fillRect(W - 4, r, 2, H - r * 2)
  return canvas
}

function noiseImage(make) {
  const canvas = make(W, 64)
  const ctx = canvas.getContext('2d')
  const rng = seededRandom(77)
  for (let i = 0; i < 260; i += 1) {
    ctx.fillStyle = ['rgba(255,255,255,0.5)', 'rgba(127,231,255,0.45)', 'rgba(255,111,168,0.45)', 'rgba(10,8,30,0.6)'][Math.floor(rng() * 4)]
    ctx.fillRect(Math.floor(rng() * W), Math.floor(rng() * 32) * 2, 4 + Math.floor(rng() * 16), 2)
  }
  return canvas
}

function buttonImage(make, { fill, rows }) {
  const canvas = make(BUTTON, BUTTON)
  const ctx = canvas.getContext('2d')
  const c = BUTTON / 2
  disc(ctx, c, c, c, INK)
  disc(ctx, c, c, c - 2, fill)
  // 위쪽 빛
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillRect(c - 10, 4, 20, 2)
  ctx.fillRect(c - 14, 6, 6, 2)
  const cell = 2
  pixelArt(ctx, rows, Math.round(c - (rows[0].length * cell) / 2), Math.round(c - (rows.length * cell) / 2) + 1, cell, '#ffffff')
  return canvas
}

export class CallOverlay {
  // makeCanvas: 시험에서 가짜 캔버스를 넣는 자리
  constructor({ makeCanvas = domCanvas } = {}) {
    this.makeCanvas = makeCanvas
    this.art = null
    this.reset()
  }

  // 모드가 시작될 때 부른다(부르지 않아도 한동안 안 그리다가 그리면 새 통화로 본다).
  reset() {
    this.last = null
    this.startedAt = 0
    this.targetId = null
    this.targetHp = null
    this.myHp = null
    this.glitch = 0
    this.hurt = 0
    this.switched = 0
  }

  prepare() {
    const make = this.makeCanvas
    this.art = { frame: frameImage(make), noise: noiseImage(make), buttons: BUTTONS.map((button) => ({ ...button, image: buttonImage(make, button) })) }
  }

  // 지난 장면과 견주어 새 통화·다른 사람·맞음을 알아챈다.
  watch(me, target, now, dt) {
    if (this.last === null || now - this.last > GAP || now < this.last) {
      this.reset()
      this.startedAt = now
      this.targetId = target.id
    }
    this.last = now
    this.glitch = Math.max(0, this.glitch - dt)
    this.hurt = Math.max(0, this.hurt - dt)
    this.switched = Math.max(0, this.switched - dt)
    if (target.id !== this.targetId) {
      this.targetId = target.id
      this.targetHp = null
      this.switched = SWITCH
      this.glitch = 0
    }
    const targetHp = num(target.hp)
    if ((this.targetHp !== null && targetHp < this.targetHp) || target.flashT > 0.1) this.glitch = GLITCH
    this.targetHp = targetHp
    const myHp = num(me?.hp)
    if ((this.myHp !== null && myHp < this.myHp) || me?.flashT > 0.1) this.hurt = HURT
    this.myHp = myHp
  }

  // camera: CallCamera가 돌려준 값(없으면 아무것도 그리지 않는다). info: { now(ms), dt(초), reduced, sprites: Map(id → 48×48 캔버스) }
  draw(ctx, world, me, camera, info = {}) {
    const target = camera ? world.players.find((player) => player.id === camera.targetId) : null
    if (!target) return
    if (!this.art) this.prepare()
    const now = num(info?.now)
    const t = now / 1000
    const reduced = Boolean(info?.reduced)
    const sprites = info?.sprites
    this.watch(me, target, now, clamp(num(info?.dt), 0, 0.1))
    const age = (now - this.startedAt) / 1000

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, AREA.y0, W, H)
    ctx.clip()
    ctx.translate(0, AREA.y0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = false
    ctx.textBaseline = 'alphabetic'
    if (this.glitch > 0) this.drawGlitch(ctx, t, reduced)
    this.drawNoise(ctx, t, reduced)
    ctx.drawImage(this.art.frame, 0, 0)
    this.drawHead(ctx, target, t, age, reduced)
    this.drawPip(ctx, me, t, sprites, reduced)
    this.drawButtons(ctx)
    if (this.glitch > 0) this.drawNotice(ctx, '연결이 불안정해요', '#ff3b5c', clamp(this.glitch / 0.2, 0, 1))
    else if (this.switched > 0) this.drawNotice(ctx, `${this.short(target.name)}님과 연결됐어요`, '#1f8f45', clamp(this.switched / 0.25, 0, 1))
    if (age < RING) this.drawRing(ctx, target, t, age, sprites, reduced)
    ctx.restore()
  }

  short(name) {
    const text = String(name ?? '상대')
    return text.length > 8 ? `${text.slice(0, 7)}…` : text
  }

  // 주사선 사이로 천천히 지나가는 밝은 띠
  drawNoise(ctx, t, reduced) {
    if (reduced) return
    const y = Math.round((t * 70) % (H + 80)) - 60
    ctx.fillStyle = 'rgba(200,240,255,0.05)'
    ctx.fillRect(0, y, W, 44)
    ctx.fillStyle = 'rgba(200,240,255,0.06)'
    ctx.fillRect(0, y + 14, W, 12)
  }

  // 상대가 맞으면 화면이 가로로 찢어진다.
  drawGlitch(ctx, t, reduced) {
    const power = clamp(this.glitch / GLITCH, 0, 1)
    if (reduced) {
      ctx.fillStyle = 'rgba(255,59,92,0.12)'
      ctx.fillRect(0, 0, W, H)
      return
    }
    const tick = Math.floor(t * 18)
    for (let i = 0; i < 7; i += 1) {
      const y = (tick * 53 + i * 97) % H
      const h = 4 + ((tick * 7 + i * 13) % 16)
      ctx.globalAlpha = 0.34 * power
      ctx.fillStyle = i % 2 === 0 ? '#25f4ee' : '#ff3b8d'
      ctx.fillRect(((tick + i) % 2 === 0 ? -1 : 1) * 24 + (i % 3) * 30, y, W - 60, h)
    }
    ctx.globalAlpha = 0.75 * power
    for (let y = (tick * 29) % 120; y < H; y += 150) ctx.drawImage(this.art.noise, ((tick * 37) % 60) - 60, y, W + 60, 64)
    ctx.globalAlpha = 1
  }

  // 이름표: 이름 · "통화 중" · 통화 시간 · 신호 세기
  drawHead(ctx, target, t, age, reduced) {
    const { x, y, w, h } = HEAD
    pixelBox(ctx, x, y, w, h, 'rgba(20,21,43,0.86)', 8)
    const weak = this.glitch > 0
    ctx.textAlign = 'left'
    ctx.font = `bold 14px ${FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(this.short(target.name), x + 12, y + 19)
    // 신호 세기
    for (let i = 0; i < 4; i += 1) {
      const on = weak ? i === 0 : true
      ctx.fillStyle = on ? (weak ? '#ff3b5c' : '#7dff9c') : '#4a4e7a'
      ctx.fillRect(x + w - 32 + i * 5, y + 17 - i * 3, 3, 4 + i * 3)
    }
    // 통화 중 알약
    pixelBox(ctx, x + 10, y + 25, 72, 16, weak ? '#5b2236' : '#1f6b3a', 4)
    ctx.globalAlpha = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 5)
    disc(ctx, x + 20, y + 33, 4, weak ? '#ff5a7a' : '#7dff9c')
    ctx.globalAlpha = 1
    ctx.font = `bold 11px ${FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText('통화 중', x + 29, y + 37)
    ctx.textAlign = 'right'
    ctx.font = `bold 13px ${FONT}`
    ctx.fillStyle = '#ffe9a8'
    ctx.fillText(callTime(age - RING), x + w - 12, y + 38)
  }

  // 오른쪽 위 작은 화면: 내 얼굴
  drawPip(ctx, me, t, sprites, reduced) {
    const { w, h } = PIP
    const hurt = this.hurt / HURT
    const x = PIP.x + (reduced ? 0 : Math.round(Math.sin(t * 70) * 5 * hurt))
    const y = PIP.y + (reduced ? 0 : Math.round(Math.cos(t * 57) * 3 * hurt))
    pixelBox(ctx, x - 4, y - 4, w + 8, h + 8, INK, 6)
    pixelBox(ctx, x - 2, y - 2, w + 4, h + 4, hurt > 0 ? '#ff3b5c' : '#ffffff', 4)
    ctx.fillStyle = '#4d4796'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#5e57b2'
    for (let i = 0; i < 4; i += 1) ctx.fillRect(x + (i % 2) * 32, y + i * 20, 32, Math.min(20, h - i * 20))
    const image = sprites?.get?.(me?.id)
    if (image) {
      const off = !me.alive
      ctx.globalAlpha = off ? 0.4 : 1
      ctx.drawImage(image, 8, 4, 32, 37, x, y + h - 74, 64, 74)
      ctx.globalAlpha = 1
    }
    if (hurt > 0) {
      ctx.globalAlpha = 0.45 * hurt
      ctx.fillStyle = '#ff3b5c'
      ctx.fillRect(x, y, w, h)
      ctx.globalAlpha = 1
    }
    pixelBox(ctx, x + 2, y + h - 15, 20, 13, 'rgba(20,21,43,0.85)', 4)
    ctx.textAlign = 'center'
    ctx.font = `bold 10px ${FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(me?.alive === false ? '꺼짐' : '나', x + 12, y + h - 5)
  }

  // 아래쪽 동그란 버튼 세 개(장식)
  drawButtons(ctx) {
    const top = H - BUTTON - 24
    ctx.globalAlpha = 0.92
    for (const button of this.art.buttons) ctx.drawImage(button.image, button.x, top)
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    ctx.font = `10px ${FONT}`
    for (const button of this.art.buttons) {
      ctx.fillStyle = 'rgba(10,8,30,0.85)'
      ctx.fillText(button.label, button.x + BUTTON / 2 + 1, H - 9)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(button.label, button.x + BUTTON / 2, H - 10)
    }
  }

  // 버튼 위 알림 띠
  drawNotice(ctx, text, color, alpha) {
    ctx.globalAlpha = alpha
    pixelBox(ctx, 92, 396, 176, 26, INK, 6)
    pixelBox(ctx, 94, 398, 172, 22, color, 5)
    ctx.textAlign = 'center'
    ctx.font = `bold 12px ${FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, W / 2, 413)
    ctx.globalAlpha = 1
  }

  // 들어갈 때 잠깐 뜨는 카드
  drawRing(ctx, target, t, age, sprites, reduced) {
    const show = clamp(age / 0.18, 0, 1)
    const leave = clamp((age - (RING - 0.25)) / 0.25, 0, 1)
    const shiver = reduced ? 0 : Math.round(Math.sin(t * 60) * 3 * (Math.sin(t * 9) > 0 ? 1 : 0))
    const w = 236
    const h = 78
    const x = (W - w) / 2 + shiver
    const y = reduced ? 168 : Math.round(168 - (1 - show) * 60 - leave * 40)
    ctx.globalAlpha = show * (1 - leave)
    pixelBox(ctx, x + 4, y + 6, w, h, 'rgba(10,8,30,0.45)', 10)
    pixelBox(ctx, x, y, w, h, INK, 10)
    pixelBox(ctx, x + 3, y + 3, w - 6, h - 6, '#f4f6ff', 8)
    // 번지는 고리 + 얼굴
    const cx = x + 44
    const cy = y + h / 2
    if (!reduced) {
      const p = (t * 1.6) % 1
      ctx.globalAlpha = show * (1 - leave) * (1 - p) * 0.7
      disc(ctx, cx, cy, Math.round(24 + p * 10), '#4cc96b')
      ctx.globalAlpha = show * (1 - leave)
    }
    disc(ctx, cx, cy, 26, INK)
    disc(ctx, cx, cy, 24, '#ffd9ec')
    const image = sprites?.get?.(target.id)
    if (image) ctx.drawImage(image, 12, 6, 24, 22, cx - 24, cy - 22, 48, 44)
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = `bold 16px ${FONT}`
    ctx.fillText(this.short(target.name), x + 80, y + 33)
    ctx.font = `bold 13px ${FONT}`
    ctx.fillStyle = '#1f8f45'
    ctx.fillText('전화 왔어요!', x + 80, y + 55)
    disc(ctx, x + w - 30, cy, 16, INK)
    disc(ctx, x + w - 30, cy, 14, '#4cc96b')
    pixelArt(ctx, ['##......', '###.....', '.##.....', '.##.....', '..##....', '...##.##', '....####', '.....##.'], x + w - 38, cy - 8, 2, '#ffffff')
    ctx.globalAlpha = 1
  }
}