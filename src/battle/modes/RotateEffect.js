import { pixelBox } from '../art'
import { AREA } from '../arena'
import { CENTER, domCanvas, makeLayer, num, outBack, ROTATE, rotationAt, VIEW_H, VIEW_W } from './transforms'

// 자동 회전 모드: 폰을 돌린 것처럼 경기장이 휙휙 돈다. 돌고 남은 자리는 흐린 도트 무늬로 채운다.

const INK = '#14152b'
const MOSAIC = { w: 30, h: 42 }
const CHIP_TIME = 1.1 // 회전 알림을 띄우는 시간(초)
const WARN = 0.5 // 돌기 전에 미리 알리는 시간(초)
const CHIP = { w: 124, h: 34, y: AREA.y1 - 46 }

export class RotateEffect {
  constructor({ reduced = false, makeCanvas = domCanvas } = {}) {
    this.reduced = reduced
    this.buffer = makeLayer(makeCanvas, VIEW_W, VIEW_H)
    this.mosaic = makeLayer(makeCanvas, MOSAIC.w, MOSAIC.h)
    this.pattern = makeLayer(makeCanvas, VIEW_W, VIEW_H)
    this.paintPattern()
  }

  // 빈 자리에 깔 무늬: 어두운 체크에 작은 폰이 줄줄이
  paintPattern() {
    const { ctx } = this.pattern
    if (!ctx) return
    ctx.fillStyle = 'rgba(12,10,34,0.5)'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.fillStyle = 'rgba(12,10,34,0.38)'
    for (let y = 0; y < VIEW_H; y += 8) for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < VIEW_W; x += 16) ctx.fillRect(x, y, 8, 8)
    for (let row = 0; row * 64 < VIEW_H; row += 1) {
      for (let col = -1; col * 72 < VIEW_W; col += 1) {
        const x = col * 72 + (row % 2) * 36 + 12
        const y = row * 64 + 12
        ctx.fillStyle = 'rgba(160,140,255,0.16)'
        if ((row + col) % 2 === 0) {
          ctx.fillRect(x + 4, y, 16, 28)
          ctx.clearRect(x + 8, y + 4, 8, 16)
        } else {
          ctx.fillRect(x, y + 6, 28, 16)
          ctx.clearRect(x + 8, y + 10, 16, 8)
        }
      }
    }
  }

  react() {}

  dispose() {}

  draw(ctx, world, me, info = {}) {
    const reduced = info.reduced ?? this.reduced
    const t = Math.max(0, num(info.t))
    const left = Number.isFinite(info.left) ? info.left : undefined
    const turn = rotationAt(t, { reduced, left })
    if (turn.angle !== 0 && this.buffer.ctx) {
      this.buffer.ctx.drawImage(ctx.canvas, 0, AREA.y0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H)
      ctx.save()
      this.drawBack(ctx)
      if (!reduced && turn.since < ROTATE.flick) {
        // 돌아가는 동안 조금 전 모습이 옅게 남는다.
        for (let i = 2; i >= 1; i -= 1) {
          const back = i * 0.045
          this.drawTurned(ctx, rotationAt(t - back, { left: left === undefined ? undefined : left + back }), 0.3 - i * 0.08)
        }
      }
      this.drawTurned(ctx, turn, 1)
      ctx.restore()
    }
    this.drawChip(ctx, turn, reduced)
  }

  drawBack(ctx) {
    const { mosaic, buffer, pattern } = this
    if (mosaic.ctx) {
      mosaic.ctx.imageSmoothingEnabled = true
      mosaic.ctx.drawImage(buffer.canvas, 0, 0, VIEW_W, VIEW_H, 0, 0, MOSAIC.w, MOSAIC.h)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(mosaic.canvas, 0, AREA.y0, VIEW_W, VIEW_H)
    }
    ctx.drawImage(pattern.canvas, 0, AREA.y0)
  }

  drawTurned(ctx, { angle, scale }, alpha) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(CENTER.x, CENTER.y)
    ctx.rotate(angle)
    ctx.scale(scale, scale)
    if (alpha === 1) {
      // 폰 테두리
      ctx.fillStyle = INK
      ctx.fillRect(-VIEW_W / 2 - 8, -VIEW_H / 2 - 8, VIEW_W + 16, VIEW_H + 16)
      ctx.fillStyle = '#8f7bff'
      ctx.fillRect(-VIEW_W / 2 - 3, -VIEW_H / 2 - 3, VIEW_W + 6, VIEW_H + 6)
    }
    ctx.imageSmoothingEnabled = true // 줄어든 도트와 글자가 깨지지 않게
    ctx.drawImage(this.buffer.canvas, -VIEW_W / 2, -VIEW_H / 2)
    ctx.restore()
  }

  // 아래쪽 알림: 돌기 직전에 폰 그림이 까딱거리고, 돌 때 함께 돈다.
  drawChip(ctx, { since, next }, reduced) {
    const warning = next < WARN
    if (!warning && !(since < CHIP_TIME)) return
    const fade = warning ? Math.min(1, (WARN - next) / 0.12) : Math.min(1, (CHIP_TIME - since) / 0.2)
    const rise = reduced || !warning ? 0 : Math.round((1 - fade) * 10)
    const x = Math.round(CENTER.x - CHIP.w / 2)
    const y = CHIP.y + rise
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    pixelBox(ctx, x + 2, y + 3, CHIP.w, CHIP.h, 'rgba(10,8,30,0.5)', 8)
    pixelBox(ctx, x, y, CHIP.w, CHIP.h, INK, 8)
    pixelBox(ctx, x + 2, y + 2, CHIP.w - 4, CHIP.h - 4, warning ? '#3b3560' : '#6b5fd3', 6)
    let angle = 0
    if (!reduced) angle = warning ? Math.sin((WARN - next) * 26) * 0.22 : (outBack(Math.min(1, since / (ROTATE.flick * 1.5))) - 1) * (Math.PI / 2)
    drawPhone(ctx, x + 23, y + CHIP.h / 2, angle)
    ctx.textAlign = 'left'
    ctx.font = 'bold 12px Galmuri11, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(warning ? '곧 돌아가요' : '자동 회전!', x + 44, y + 22)
    ctx.restore()
  }
}

// 도는 폰 그림과 양옆 화살표
function drawPhone(ctx, x, y, angle) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#ffd84a'
  ctx.strokeStyle = '#ffd84a'
  ctx.lineWidth = 2
  for (const turn of [0, Math.PI]) {
    ctx.save()
    ctx.rotate(turn)
    ctx.beginPath()
    ctx.arc(0, 0, 13, -1, 0.15)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(9, 1)
    ctx.lineTo(17, 1)
    ctx.lineTo(13, 7)
    ctx.fill()
    ctx.restore()
  }
  ctx.rotate(angle)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-4, -9, 8, 18)
  ctx.fillRect(-5, -8, 10, 16)
  ctx.fillStyle = '#14152b'
  ctx.fillRect(-3, -6, 6, 10)
  ctx.fillRect(-1, 5, 2, 2)
  ctx.fillStyle = '#7fe7ff'
  ctx.fillRect(-3, -6, 6, 3)
  ctx.restore()
}
