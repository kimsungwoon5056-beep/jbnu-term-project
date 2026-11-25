import { AREA, ARENA } from './world'

// 빨려 들어가기 장면 전환: 지지직(경고) → 소용돌이(들어감) → 번쩍(나옴). 그린 화면(canvas)을 찢고 돌려 다시 그린다.

const W = ARENA.w
const H = AREA.y1 - AREA.y0
const noise = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

export class DiveEffect {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced
    this.buffer = document.createElement('canvas')
    this.buffer.width = W
    this.buffer.height = H
    this.bctx = this.buffer.getContext('2d')
  }

  capture(ctx) {
    this.bctx.drawImage(ctx.canvas, 0, AREA.y0, W, H, 0, 0, W, H)
  }

  // phase·p: schedule.divePhase의 값. x, y: 빨려 들어가는 곳(내 위치)
  draw(ctx, { phase, p }, { x = W / 2, y = AREA.y0 + H / 2, now = 0 } = {}) {
    if (phase === 'none' || phase === 'on') return
    if (this.reduced) {
      // 흔들거나 돌리지 않고 밝기만 바뀐다.
      const alpha = phase === 'warn' ? 0 : phase === 'in' ? 1 - Math.abs(p - 0.5) * 2 : 1 - p
      ctx.fillStyle = `rgba(20,21,43,${Math.max(0, alpha).toFixed(3)})`
      ctx.fillRect(0, AREA.y0, W, H)
      return
    }
    this.capture(ctx)
    if (phase === 'warn') this.glitch(ctx, p, now)
    if (phase === 'in') this.swirl(ctx, p, x, y)
    if (phase === 'out') this.burst(ctx, p)
  }

  // 지지직: 가로로 찢어 어긋나게 그리고 색 줄을 얹는다. 갈수록 심해진다.
  glitch(ctx, p, now) {
    const tick = Math.floor(now / 60)
    const slices = 14
    const h = H / slices
    for (let i = 0; i < slices; i += 1) {
      const r = noise(tick * 13 + i)
      if (r > 0.25 + p * 0.5) continue
      const dx = Math.round((noise(tick * 7 + i * 3) - 0.5) * 70 * p)
      ctx.drawImage(this.buffer, 0, i * h, W, h, dx, AREA.y0 + i * h, W, h)
      ctx.globalAlpha = 0.18 + p * 0.2
      ctx.fillStyle = ['#ff2d78', '#25f4ee', '#ffd84a'][i % 3]
      ctx.fillRect(dx, AREA.y0 + i * h + h * 0.4, W, 3)
      ctx.globalAlpha = 1
    }
    if (tick % 3 === 0) {
      ctx.fillStyle = `rgba(255,255,255,${(0.1 + p * 0.15).toFixed(2)})`
      for (let k = 0; k < 60 * p; k += 1) ctx.fillRect(Math.round(noise(tick + k) * W), AREA.y0 + Math.round(noise(tick * 3 + k) * H), 3, 2)
    }
  }

  // 소용돌이: 앞 절반은 내 쪽으로 돌며 빨려 들어가고, 뒤 절반은 1인칭 화면이 튀어나온다.
  swirl(ctx, p, x, y) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, AREA.y0, W, H)
    ctx.clip()
    ctx.fillStyle = '#0a081e'
    ctx.fillRect(0, AREA.y0, W, H)
    if (p < 0.5) {
      const q = p / 0.5
      for (let i = 4; i >= 0; i -= 1) {
        const k = q * q * (1 + i * 0.5)
        ctx.save()
        ctx.globalAlpha = i === 0 ? 1 : 0.35
        ctx.translate(x, y)
        ctx.rotate(k * 2.4 * (i % 2 === 0 ? 1 : -0.4))
        ctx.scale(1 + k * 3.2, 1 + k * 3.2)
        ctx.drawImage(this.buffer, -x, -(y - AREA.y0))
        ctx.restore()
      }
      this.streaks(ctx, x, y, q)
      ctx.fillStyle = `rgba(255,255,255,${(Math.max(0, q - 0.7) / 0.3).toFixed(3)})`
    } else {
      const q = (p - 0.5) / 0.5
      const ease = 1 - (1 - q) ** 3
      ctx.save()
      ctx.translate(W / 2, AREA.y0 + H / 2)
      ctx.rotate((1 - ease) * -0.7)
      ctx.scale(2.4 - ease * 1.4, 2.4 - ease * 1.4)
      ctx.drawImage(this.buffer, -W / 2, -H / 2)
      ctx.restore()
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - q * 1.6).toFixed(3)})`
    }
    ctx.fillRect(0, AREA.y0, W, H)
    ctx.restore()
  }

  // 빨려 들어가는 빛줄기
  streaks(ctx, x, y, q) {
    ctx.save()
    ctx.translate(x, y)
    ctx.lineWidth = 3
    for (let i = 0; i < 26; i += 1) {
      const a = (Math.PI * 2 * i) / 26 + q * 3
      const far = 420 * (1 - ((q * 1.4 + noise(i)) % 1))
      ctx.strokeStyle = ['#ffd84a', '#ff5fa8', '#56d7ff', '#ffffff'][i % 4]
      ctx.globalAlpha = 0.7 * q
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * far, Math.sin(a) * far)
      ctx.lineTo(Math.cos(a + 0.12) * (far + 60), Math.sin(a + 0.12) * (far + 60))
      ctx.stroke()
    }
    ctx.restore()
  }

  // 튕겨 나옴: 하얗게 번쩍이며 화면이 살짝 커졌다가 자리를 잡는다.
  burst(ctx, p) {
    const ease = 1 - (1 - p) ** 3
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, AREA.y0, W, H)
    ctx.clip()
    ctx.translate(W / 2, AREA.y0 + H / 2)
    ctx.scale(1.25 - ease * 0.25, 1.25 - ease * 0.25)
    ctx.drawImage(this.buffer, -W / 2, -H / 2)
    ctx.restore()
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - p * 1.5).toFixed(3)})`
    ctx.fillRect(0, AREA.y0, W, H)
  }
}
