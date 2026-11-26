import { pixelBox } from '../art'
import { AREA } from '../arena'
import { domCanvas, makeLayer, num, VIEW_H, VIEW_W } from './transforms'

// 저전력 모드: 초당 15장, 초록 네 단계 색으로만 보이는 옛날 화면. 작게 담아 색을 줄이고 도트 그대로 늘린다.

const INK = '#0f2a1c'
export const RETRO = { w: 120, h: 170, fps: 15 }
// 어두운 것부터 네 단계 초록(R, G, B)
const PALETTE = [
  [14, 38, 28],
  [44, 90, 52],
  [124, 160, 58],
  [214, 232, 140],
]
// 2×2 바둑판 디더: 칸마다 조금 다른 기준으로 잘라 중간 밝기를 흉내 낸다.
const BAYER = [
  [0.125, 0.625],
  [0.875, 0.375],
]
const SLOW = 10 // 한 장 읽는 데 평균 이만큼(ms) 걸리면 읽지 않는다.
const EDGES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const DITHER = 0.6 // 디더 세기(1이면 온통 바둑판)

// 밝기(0~255) → 단계(0~3)
export function toneOf(luma, x, y) {
  const level = Math.min(1, Math.max(0, (num(luma) - 26) / 190)) * 3
  return Math.min(3, Math.max(0, Math.floor(level + 0.5 + (BAYER[y & 1][x & 1] - 0.5) * DITHER)))
}

export class LowPowerEffect {
  constructor({ reduced = false, makeCanvas = domCanvas } = {}) {
    this.reduced = reduced
    this.small = makeLayer(makeCanvas, RETRO.w, RETRO.h, { willReadFrequently: true })
    this.lines = makeLayer(makeCanvas, VIEW_W, VIEW_H)
    this.wait = 0 // 다음 장면까지 남은 시간(초)
    this.readable = Boolean(this.small.ctx) // 픽셀을 읽어 네 단계로 바꿀 수 있는지
    this.cost = 0 // 한 장 읽는 데 걸린 시간의 평균(ms)
    this.ready = false
    this.paintLines()
  }

  // 가로줄과 어두운 네 귀퉁이
  paintLines() {
    const { ctx } = this.lines
    if (!ctx) return
    ctx.fillStyle = 'rgba(10,30,18,0.16)'
    for (let y = 0; y < VIEW_H; y += 3) ctx.fillRect(0, y, VIEW_W, 1)
    ctx.fillStyle = 'rgba(10,30,18,0.4)'
    ctx.fillRect(0, 0, VIEW_W, 3)
    ctx.fillRect(0, VIEW_H - 3, VIEW_W, 3)
    ctx.fillRect(0, 0, 3, VIEW_H)
    ctx.fillRect(VIEW_W - 3, 0, 3, VIEW_H)
  }

  react() {}

  dispose() {
    this.ready = false
  }

  draw(ctx, world, me, info = {}) {
    const reduced = info.reduced ?? this.reduced
    const time = num(info.time, num(world?.time))
    ctx.save()
    this.wait -= Math.max(0, num(info.dt))
    if (this.small.ctx && (!this.ready || this.wait <= 0)) {
      this.wait = Math.max(0, this.wait + 1 / RETRO.fps)
      // 1인칭이면 세계 자리를 info.project로 화면 자리로 바꿔 표시한다.
      this.capture(ctx, world, me, info.sprites, info.top === false && typeof info.project === 'function' ? info.project : null)
    }
    if (this.ready) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(this.small.canvas, 0, 0, RETRO.w, RETRO.h, 0, AREA.y0, VIEW_W, VIEW_H)
    }
    if (!this.readable) this.tint(ctx)
    ctx.drawImage(this.lines.canvas, 0, AREA.y0)
    this.drawBanner(ctx, time, reduced)
    ctx.restore()
  }

  capture(ctx, world, me, sprites, project = null) {
    const { ctx: small } = this.small
    const { w, h } = RETRO
    small.imageSmoothingEnabled = true
    small.drawImage(ctx.canvas, 0, AREA.y0, VIEW_W, VIEW_H, 0, 0, w, h)
    if (project) this.liftFirst(small, world, me, project)
    else this.lift(small, world, me, sprites)
    this.ready = true
    if (!this.readable) return
    const start = performance.now()
    try {
      const image = small.getImageData(0, 0, w, h)
      const { data } = image
      for (let y = 0, i = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1, i += 4) {
          const tone = PALETTE[toneOf(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11, x, y)]
          data[i] = tone[0]
          data[i + 1] = tone[1]
          data[i + 2] = tone[2]
          data[i + 3] = 255
        }
      }
      small.putImageData(image, 0, 0)
      // 읽기가 계속 느린 기기에서도 그만 읽는다(한 번 튄 것으로는 그만두지 않는다).
      this.cost += (Math.min(60, performance.now() - start) - this.cost) * 0.1
      if (this.cost > SLOW) this.readable = false
    } catch {
      // 픽셀을 못 읽는 기기: 도트로 늘리고 초록으로 덮기만 한다.
      this.readable = false
    }
  }

  // 색이 사라져도 사람을 찾을 수 있게, 테두리 있는 밝은 원 위에 캐릭터를 다시 그린다. 나는 위에 세모를 붙인다.
  lift(small, world, me, sprites) {
    for (const player of world?.players ?? []) {
      if (!player.alive || !Number.isFinite(player.x) || !Number.isFinite(player.y)) continue
      const x = Math.round((player.x * RETRO.w) / VIEW_W)
      const y = Math.round(((player.y - 8 - AREA.y0) * RETRO.h) / VIEW_H)
      small.fillStyle = '#000000'
      disc(small, x, y, 10)
      small.fillStyle = player.flashT > 0.1 ? '#9a9a9a' : '#ffffff'
      disc(small, x, y, 9)
      const sprite = sprites?.get?.(player.id)
      if (sprite) {
        // 그림자를 네 쪽으로 밀어 검은 테두리를 두른다.
        small.shadowColor = '#000000'
        for (const [dx, dy] of EDGES) {
          small.shadowOffsetX = dx
          small.shadowOffsetY = dy
          small.drawImage(sprite, x - 10, y - 12, 20, 20)
        }
        small.shadowColor = 'transparent'
      }
      if (player.id !== me?.id) continue
      small.fillStyle = '#000000'
      small.fillRect(x - 4, y - 22, 9, 4)
      small.fillRect(x - 3, y - 18, 7, 2)
      small.fillRect(x - 2, y - 16, 5, 1)
      small.fillStyle = '#ffffff'
      small.fillRect(x - 3, y - 21, 7, 2)
      small.fillRect(x - 2, y - 19, 5, 1)
      small.fillRect(x - 1, y - 18, 3, 2)
    }
    // 탄은 어떤 색이든 테두리 있는 밝은 점
    for (const shot of world?.projectiles?.active ?? []) {
      if (shot.active === false || !Number.isFinite(shot.x) || !Number.isFinite(shot.y)) continue
      const x = Math.round((shot.x * RETRO.w) / VIEW_W)
      const y = Math.round(((shot.y - AREA.y0) * RETRO.h) / VIEW_H)
      small.fillStyle = '#000000'
      disc(small, x, y, 4)
      small.fillStyle = '#ffffff'
      disc(small, x, y, 2)
    }
  }
  // 1인칭: 보이는 사람의 몸 가운데에 테두리 있는 밝은 고리, 탄은 밝은 점(멀수록 작게). 내 눈으로 보는 나는 표시하지 않는다.
  liftFirst(small, world, me, project) {
    const toSmall = (spot) => ({ x: Math.round((spot.x * RETRO.w) / VIEW_W), y: Math.round(((spot.y - AREA.y0) * RETRO.h) / VIEW_H) })
    this.marks = 0
    for (const player of world?.players ?? []) {
      if (!player.alive || player.id === me?.id || !Number.isFinite(player.x) || !Number.isFinite(player.y)) continue
      const spot = project(player.x, player.y, 24)
      if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) continue
      const { x, y } = toSmall(spot)
      const r = Math.max(3, Math.min(10, Math.round(400 / Math.max(1, num(spot.depth, 60)))))
      small.fillStyle = '#000000'
      disc(small, x, y, r + 1)
      small.fillStyle = player.flashT > 0.1 ? '#9a9a9a' : '#ffffff'
      disc(small, x, y, r)
      small.fillStyle = '#000000'
      disc(small, x, y, Math.max(1, r - 2))
      this.marks += 1
    }
    for (const shot of world?.projectiles?.active ?? []) {
      if (shot.active === false || !Number.isFinite(shot.x) || !Number.isFinite(shot.y)) continue
      const spot = project(shot.x, shot.y, 20)
      if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) continue
      const { x, y } = toSmall(spot)
      small.fillStyle = '#000000'
      disc(small, x, y, 3)
      small.fillStyle = '#ffffff'
      disc(small, x, y, 2)
    }
  }

  // 대신 쓰는 방법: 색을 빼고(saturation) 초록을 곱한다.
  tint(ctx) {
    ctx.globalCompositeOperation = 'saturation'
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, AREA.y0, VIEW_W, VIEW_H)
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = '#a8cc6a'
    ctx.fillRect(0, AREA.y0, VIEW_W, VIEW_H)
    ctx.globalCompositeOperation = 'source-over'
  }

  drawBanner(ctx, time, reduced) {
    const w = 132
    const x = VIEW_W / 2 - w / 2
    const y = AREA.y0 + 8
    pixelBox(ctx, x, y, w, 26, INK, 6)
    pixelBox(ctx, x + 2, y + 2, w - 4, 22, '#d6e88c', 5)
    ctx.textAlign = 'left'
    ctx.font = 'bold 12px Galmuri11, sans-serif'
    ctx.fillStyle = INK
    ctx.fillText('저전력 모드', x + 10, y + 17)
    // 배터리 1%
    const bx = x + 80
    ctx.fillRect(bx, y + 8, 18, 10)
    ctx.fillRect(bx + 18, y + 11, 2, 4)
    ctx.fillStyle = '#d6e88c'
    ctx.fillRect(bx + 2, y + 10, 14, 6)
    if (reduced || Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = INK
      ctx.fillRect(bx + 3, y + 11, 2, 4)
      ctx.font = 'bold 11px Galmuri11, sans-serif'
      ctx.fillText('1%', bx + 24, y + 17)
    }
  }
}

// 매끈하게 번지지 않는 도트 원
function disc(ctx, x, y, r) {
  for (let dy = -r; dy <= r; dy += 1) {
    const half = Math.round(Math.sqrt(r * r - dy * dy))
    ctx.fillRect(x - half, y + dy, half * 2, 1)
  }
}
