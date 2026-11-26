import { pixelBox } from '../art'
import { itemAlive } from '../schedule'
import { AREA } from '../arena'
import { domCanvas, inCone, makeLayer, noise, num, VIEW_H, VIEW_W } from './transforms'

// 손전등 모드: 깜깜한 화면에 내가 보는 쪽만 보인다. 작은 어둠 그림에서 빛을 파내고 크게 늘려 도트 계단을 만든다.

const INK = '#14152b'
const CELL = 4 // 어둠 한 칸의 크기
const DARK = 0.94
const DARK_DEAD = 0.5 // 쓰러진 뒤(지켜보기)
export const TORCH = { half: (32 * Math.PI) / 180, range: 190, glow: 34, flash: 46, flashTime: 0.4 }
// 1인칭: 화면 가운데 아래(조준점 아래 바닥)에 둥근 빛. 화면 자리(AREA 안 비율)와 반지름
const FIRST = { x: 0.5, y: 0.66, range: 150 }
const FLASHES = 8
// 바깥부터 안쪽으로 파내는 빛: [각도 배율, 거리 배율, 세기, 체크무늬]
const STEPS = [
  [1.2, 1.06, 0.5, true],
  [1.07, 1, 0.45, false],
  [1, 0.95, 0.7, true],
  [0.92, 0.88, 0.6, false],
  [0.8, 0.78, 0.8, true],
  [0.68, 0.66, 0.85, false],
]
const GLOW_STEPS = [
  [1.15, 0.5, true],
  [1, 0.5, false],
  [0.75, 0.6, true],
  [0.55, 0.7, false],
]

export class TorchEffect {
  constructor({ reduced = false, makeCanvas = domCanvas } = {}) {
    this.reduced = reduced
    this.mask = makeLayer(makeCanvas, VIEW_W / CELL, VIEW_H / CELL)
    this.flashes = Array.from({ length: FLASHES }, () => ({ x: 0, y: 0, at: -Infinity }))
    this.nextFlash = 0
    this.time = 0
    this.checker = this.makeChecker(makeCanvas)
    this.light = { x: 0, y: 0, r: 0 } // 지금 빛의 화면 자리(시험용)
  }

  // 한 칸씩 건너 칠하는 체크무늬(파낸 빛의 가장자리)
  makeChecker(makeCanvas) {
    const tile = makeLayer(makeCanvas, 2, 2)
    if (!tile.ctx || !this.mask.ctx) return null
    tile.ctx.fillStyle = '#000000'
    tile.ctx.fillRect(0, 0, 1, 1)
    tile.ctx.fillRect(1, 1, 1, 1)
    return this.mask.ctx.createPattern(tile.canvas, 'repeat') ?? null
  }

  react(signal, world) {
    if (signal?.kind !== 'shot' && signal?.kind !== 'skill') return
    if (!Number.isFinite(signal.x) || !Number.isFinite(signal.y)) return
    const slot = this.flashes[this.nextFlash]
    this.nextFlash = (this.nextFlash + 1) % FLASHES
    slot.x = signal.x
    slot.y = signal.y
    slot.at = num(world?.time, this.time)
  }

  dispose() {
    for (const slot of this.flashes) slot.at = -Infinity
  }

  draw(ctx, world, me, info = {}) {
    const reduced = info.reduced ?? this.reduced
    const time = num(info.time, num(world?.time))
    this.time = time
    const lit = Boolean(me?.alive && Number.isFinite(me.x) && Number.isFinite(me.y))
    const aim = num(me?.aim)
    // 배터리가 간당간당해 가끔 살짝 어두워진다.
    const weak = !reduced && noise(Math.floor(time * 8)) < 0.07
    const power = weak ? 0.8 : 1
    // 1인칭이면 세계 자리를 info.project로 화면 자리로 바꿔 그린다. 위에서 볼 때(지도 앱)는 세계 자리가 곧 화면 자리다.
    const project = info.top === false && typeof info.project === 'function' ? info.project : null
    ctx.save()
    if (this.mask.ctx) {
      this.paintMask(me, lit, aim, power, time, project)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(this.mask.canvas, 0, 0, VIEW_W / CELL, VIEW_H / CELL, 0, AREA.y0, VIEW_W, VIEW_H)
    }
    if (lit) this.drawSparkles(ctx, world, me, aim, time, reduced, project)
    this.drawFrame(ctx, info, lit, weak)
    ctx.restore()
  }

  paintMask(me, lit, aim, power, time, project = null) {
    const { ctx } = this.mask
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, VIEW_W / CELL, VIEW_H / CELL)
    ctx.globalAlpha = lit ? DARK : DARK_DEAD
    ctx.fillStyle = '#05050f'
    ctx.fillRect(0, 0, VIEW_W / CELL, VIEW_H / CELL)
    ctx.globalCompositeOperation = 'destination-out'
    if (lit && project) {
      const x = (VIEW_W * FIRST.x) / CELL
      const y = (VIEW_H * FIRST.y) / CELL
      this.light = { x: x * CELL, y: AREA.y0 + y * CELL, r: FIRST.range }
      for (const [, far, alpha, dither] of STEPS) this.hole(ctx, x, y, (FIRST.range * far) / CELL, alpha * power, dither)
    } else if (lit) {
      const x = me.x / CELL
      const y = (me.y - AREA.y0) / CELL
      this.light = { x: me.x, y: me.y, r: TORCH.range }
      for (const [wide, far, alpha, dither] of STEPS) this.hole(ctx, x, y, (TORCH.range * far) / CELL, alpha * power, dither, aim, TORCH.half * wide)
      for (const [size, alpha, dither] of GLOW_STEPS) this.hole(ctx, x, y - 2, (TORCH.glow * size) / CELL, alpha, dither)
    }
    for (const slot of this.flashes) {
      const age = time - slot.at
      if (!(age >= 0 && age < TORCH.flashTime)) continue
      const strength = 1 - age / TORCH.flashTime
      const spot = project ? project(slot.x, slot.y, 20) : { x: slot.x, y: slot.y, depth: 60 }
      if (!spot) continue // 화면 뒤에서 쏜 것
      const size0 = TORCH.flash * Math.min(1.5, Math.max(0.4, 60 / num(spot.depth, 60)))
      const x = spot.x / CELL
      const y = (spot.y - AREA.y0) / CELL
      for (const [size, alpha, dither] of GLOW_STEPS) this.hole(ctx, x, y - 2, (size0 * size) / CELL, alpha * strength, dither)
    }
    // 파낸 자리에 따뜻한 빛을 얇게 깐다(어두운 곳 밑이라 빛 안에서만 보인다).
    if (lit) {
      ctx.globalCompositeOperation = 'destination-over'
      ctx.globalAlpha = 0.1 * power
      ctx.fillStyle = '#ffe08a'
      const x = this.light.x / CELL
      const y = (this.light.y - AREA.y0) / CELL
      ctx.beginPath()
      if (project) ctx.arc(x, y, (FIRST.range * 0.95) / CELL, 0, Math.PI * 2)
      else {
        ctx.moveTo(x, y)
        ctx.arc(x, y, (TORCH.range * 0.95) / CELL, aim - TORCH.half, aim + TORCH.half)
      }
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  // 어둠에서 동그라미나 부채꼴(aim·half)을 파낸다.
  hole(ctx, x, y, r, alpha, dither, aim = 0, half = Math.PI) {
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha))
    ctx.fillStyle = (dither && this.checker) || '#000000'
    ctx.beginPath()
    if (half < Math.PI) {
      ctx.moveTo(x, y)
      ctx.arc(x, y, r, aim - half, aim + half)
    } else ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 어둠 속에서도 아이템은 반짝이고 탄은 희미하게 빛난다.
  // project가 있으면(1인칭) 화면 자리로 바꾸고, 빛 원 안이거나 화면 뒤에 있는 것은 건너뛴다.
  drawSparkles(ctx, world, me, aim, time, reduced, project = null) {
    const place = (x, y, height, half, range) => {
      if (!project) return inCone(x, y, me, aim, half, range) ? null : { x, y }
      const spot = project(x, y, height)
      if (!spot || Math.hypot(spot.x - this.light.x, spot.y - this.light.y) < this.light.r * 0.8) return null
      return spot
    }
    if (world?.events) {
      for (const item of world.items ?? []) {
        if (!itemAlive(item, time)) continue
        const spot = place(item.x, item.y, 12, TORCH.half, TORCH.range)
        if (!spot) continue
        const wave = reduced ? 0.6 : Math.max(0, Math.sin(time * 3 + num(item.id) * 2))
        const x = Math.round(num(spot.x))
        const y = Math.round(num(spot.y))
        const len = 1 + Math.round(wave * 4)
        ctx.globalAlpha = 0.35 + wave * 0.6
        ctx.fillStyle = '#ffd84a'
        ctx.fillRect(x - len, y - 1, len * 2 + 2, 2)
        ctx.fillRect(x, y - 1 - len, 2, len * 2 + 2)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, y - 1, 2, 2)
      }
    }
    for (const shot of world?.projectiles?.active ?? []) {
      if (shot.active === false || !Number.isFinite(shot.x) || !Number.isFinite(shot.y)) continue
      const spot = place(shot.x, shot.y, 20, TORCH.half * 0.85, TORCH.range * 0.8)
      if (!spot) continue
      const x = Math.round(num(spot.x))
      const y = Math.round(num(spot.y))
      ctx.fillStyle = shot.color || '#ffffff'
      ctx.globalAlpha = 0.2
      ctx.fillRect(x - 6, y - 3, 12, 6)
      ctx.fillRect(x - 3, y - 6, 6, 12)
      ctx.globalAlpha = 0.6
      ctx.fillRect(x - 3, y - 2, 6, 4)
      ctx.fillRect(x - 2, y - 3, 4, 6)
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 0.7
      ctx.fillRect(x - 1, y - 1, 2, 2)
    }
    ctx.globalAlpha = 1
  }

  drawFrame(ctx, info, lit, weak) {
    const t = Math.max(0, num(info.t))
    const left = Math.max(0, num(info.left))
    const level = t + left > 0 ? left / (t + left) : 0
    // 건전지 모양 테두리: 남은 시간만큼 양옆 칸이 켜져 있다.
    const cells = 16
    const on = Math.ceil(level * cells)
    const gap = (VIEW_H - 24) / cells
    for (let i = 0; i < cells; i += 1) {
      const y = Math.round(AREA.y1 - 12 - (i + 1) * gap) + 2
      ctx.fillStyle = i < on ? (level < 0.25 ? '#ff5a5f' : weak ? '#b8963a' : '#ffd84a') : 'rgba(255,255,255,0.1)'
      ctx.fillRect(2, y, 4, Math.round(gap) - 4)
      ctx.fillRect(VIEW_W - 6, y, 4, Math.round(gap) - 4)
    }
    const x = VIEW_W / 2 - 59
    const y = AREA.y0 + 8
    pixelBox(ctx, x, y, 118, 26, '#4a4320', 6)
    pixelBox(ctx, x + 2, y + 2, 114, 22, INK, 5)
    // 손전등
    ctx.fillStyle = '#8d93b8'
    ctx.fillRect(x + 10, y + 10, 10, 6)
    ctx.fillRect(x + 20, y + 8, 4, 10)
    ctx.fillStyle = '#ff5a5f'
    ctx.fillRect(x + 14, y + 11, 3, 2)
    if (lit) {
      ctx.fillStyle = '#ffd84a'
      ctx.fillRect(x + 24, y + 9, 2, 8)
      ctx.globalAlpha = weak ? 0.35 : 0.75
      ctx.fillRect(x + 27, y + 12, 4, 2)
      ctx.fillRect(x + 27, y + 7, 3, 2)
      ctx.fillRect(x + 27, y + 17, 3, 2)
      ctx.globalAlpha = 1
    }
    ctx.textAlign = 'left'
    ctx.font = 'bold 11px Galmuri11, sans-serif'
    ctx.fillStyle = lit ? '#ffe9a8' : '#8d93b8'
    ctx.fillText(lit ? '손전등 켜짐' : '손전등 꺼짐', x + 38, y + 17)
  }
}
