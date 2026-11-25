import { AREA, ARENA } from './arena'

// 화면 효과 그리기: 의성어, 액정 금, 얼굴에 붙은 알림, 붉은 테두리, 로그아웃 묘비와 유령. 모두 그리기만 한다.

export const WORDS = {
  hit: ['퍽!', '뿅!', '콕!', '툭!', '앗!'],
  big: ['쾅!', '으악!', '우지끈!'],
  item: ['띠링!', '득템!'],
  block: ['철벽!'],
  dash: ['휙!'],
}

// 글자에 테두리를 둘러 쓴다.
export function outlined(ctx, text, x, y, fill, line = '#14152b', width = 4) {
  ctx.lineJoin = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = line
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

// 만화 말풍선 폭발 모양
function burstShape(ctx, r, spikes = 10) {
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i += 1) {
    const a = (Math.PI * i) / spikes
    const d = i % 2 === 0 ? r : r * 0.68
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * d * 1.25, Math.sin(a) * d)
  }
  ctx.closePath()
}

// pop: { text, x, y, t, life, size, big, rot, color }
export function drawPop(ctx, pop) {
  const p = pop.t / pop.life
  const scale = p < 0.18 ? 0.4 + (p / 0.18) * 0.9 : 1.3 - Math.min(0.3, (p - 0.18) * 1.2)
  ctx.save()
  ctx.globalAlpha = p > 0.7 ? Math.max(0, (1 - p) / 0.3) : 1
  ctx.translate(Math.round(pop.x), Math.round(pop.y - p * 14))
  ctx.rotate(pop.rot)
  ctx.scale(scale, scale)
  if (pop.big) {
    burstShape(ctx, pop.size * 1.35)
    ctx.fillStyle = '#14152b'
    ctx.fill()
    ctx.scale(0.88, 0.88)
    burstShape(ctx, pop.size * 1.35)
    ctx.fillStyle = '#ffd84a'
    ctx.fill()
  }
  ctx.font = `bold ${pop.size}px Galmuri11, sans-serif`
  ctx.textAlign = 'center'
  outlined(ctx, pop.text, 0, pop.size * 0.35, pop.big ? '#ff3b5c' : pop.color, pop.big ? '#ffffff' : '#14152b', 3)
  ctx.restore()
}

// 머리 위를 도는 별
export function drawStars(ctx, x, y, amount, time) {
  if (amount <= 0) return
  ctx.globalAlpha = Math.min(1, amount * 1.5)
  for (let i = 0; i < 3; i += 1) {
    const a = time * 9 + (Math.PI * 2 * i) / 3
    const sx = Math.round(x + Math.cos(a) * 16)
    const sy = Math.round(y + Math.sin(a) * 5)
    ctx.fillStyle = '#ffd84a'
    ctx.fillRect(sx - 1, sy - 3, 3, 7)
    ctx.fillRect(sx - 3, sy - 1, 7, 3)
  }
  ctx.globalAlpha = 1
}

// 씨앗으로 정해지는 액정 금: 한 점에서 사방으로 뻗는 꺾은선
export function makeCrack(seed) {
  let a = (seed >>> 0) + 1
  const rand = () => {
    a = (Math.imul(a, 1103515245) + 12345) >>> 0
    return (a >>> 8) / 16777216
  }
  const x = 70 + rand() * (ARENA.w - 140)
  const y = AREA.y0 + 110 + rand() * (AREA.y1 - AREA.y0 - 220)
  const lines = []
  for (let i = 0; i < 9; i += 1) {
    let angle = (Math.PI * 2 * i) / 9 + rand() * 0.4
    const points = [[x, y]]
    let px = x
    let py = y
    const steps = 3 + Math.floor(rand() * 4)
    for (let k = 0; k < steps; k += 1) {
      angle += (rand() - 0.5) * 0.9
      const d = 14 + rand() * 34
      px += Math.cos(angle) * d
      py += Math.sin(angle) * d
      points.push([px, py])
    }
    lines.push(points)
  }
  return { x, y, lines, t: 0 }
}

export const CRACK_LIFE = 2.2
export function drawCrack(ctx, crack) {
  const p = crack.t / CRACK_LIFE
  const grow = Math.min(1, crack.t / 0.12)
  ctx.save()
  ctx.globalAlpha = p > 0.6 ? Math.max(0, (1 - p) / 0.4) : 1
  for (const [offset, color, width] of [
    [1.5, 'rgba(20,21,43,0.65)', 3],
    [0, 'rgba(235,245,255,0.95)', 1.5],
  ]) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    for (const points of crack.lines) {
      const count = Math.max(2, Math.ceil(points.length * grow))
      points.slice(0, count).forEach(([x, y], i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](x + offset, y + offset))
    }
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(235,245,255,0.8)'
  ctx.fillRect(crack.x - 4, crack.y - 4, 8, 8)
  ctx.restore()
}

// 얼굴(화면)에 철썩 붙은 알림 카드: 붙었다가 흘러내린다. card: { x, y, rot, kind, t }
export const CARD_LIFE = 2
const CARD_TEXT = {
  chat: ['#fee500', '단톡 99+', 'ㅋㅋㅋㅋㅋㅋㅋ'],
  dm: ['#e1306c', 'DM 1', '이 영상 봤어?'],
  ad: ['#ff1f3d', '(광고)', '지금 안 보면 손해'],
}
export function drawCard(ctx, card) {
  const [color, title, body] = CARD_TEXT[card.kind] ?? CARD_TEXT.chat
  const slap = Math.max(0, 1 - card.t / 0.14)
  const slide = Math.max(0, card.t - 0.9)
  ctx.save()
  ctx.globalAlpha = card.t > CARD_LIFE - 0.3 ? Math.max(0, (CARD_LIFE - card.t) / 0.3) : 1
  ctx.translate(card.x, card.y + slide * slide * 240)
  ctx.rotate(card.rot + slide * 0.2)
  ctx.scale(1 + slap * 0.9, 1 + slap * 0.9)
  ctx.fillStyle = 'rgba(10,8,30,0.35)'
  ctx.fillRect(-83, -21, 172, 50)
  ctx.fillStyle = '#14152b'
  ctx.fillRect(-88, -27, 176, 54)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-85, -24, 170, 48)
  ctx.fillStyle = color
  ctx.fillRect(-78, -16, 32, 32)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-70, -8, 16, 12)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#14152b'
  ctx.font = 'bold 13px Galmuri11, sans-serif'
  ctx.fillText(title, -38, -4)
  ctx.font = '11px Galmuri11, sans-serif'
  ctx.fillText(body, -38, 13)
  ctx.restore()
}

// 화면 가장자리 붉은 테두리. power 0~1
// 그라데이션은 한 번만 그려 두고 투명도만 바꾼다(장면마다 새로 만들면 휴대폰에서 느리다).
let edge = null
export function drawHurtEdge(ctx, power) {
  if (power <= 0.01) return
  if (!edge) {
    edge = document.createElement('canvas')
    edge.width = ARENA.w / 2
    edge.height = (AREA.y1 - AREA.y0) / 2
    const ectx = edge.getContext('2d')
    ectx.scale(0.5, 0.5)
    const gradient = ectx.createRadialGradient(ARENA.w / 2, ARENA.h / 2 - AREA.y0, 150, ARENA.w / 2, ARENA.h / 2 - AREA.y0, 350)
    gradient.addColorStop(0, 'rgba(255,30,70,0)')
    gradient.addColorStop(1, 'rgba(255,30,70,0.7)')
    ectx.fillStyle = gradient
    ectx.fillRect(0, 0, ARENA.w, AREA.y1 - AREA.y0)
  }
  ctx.globalAlpha = Math.min(1, power)
  ctx.drawImage(edge, 0, AREA.y0, ARENA.w, AREA.y1 - AREA.y0)
  ctx.globalAlpha = 1
}

// "로그아웃" 묘비와 위로 올라가는 유령. age: 쓰러진 뒤 흐른 초
export function drawGrave(ctx, x, y, age, time) {
  const rise = Math.min(1, Math.max(0, (age - 0.75) / 0.25))
  if (rise <= 0) return
  const gx = Math.round(x)
  const gy = Math.round(y + 12)
  ctx.save()
  ctx.beginPath()
  ctx.rect(gx - 30, gy - 50, 60, 52)
  ctx.clip()
  ctx.translate(0, Math.round((1 - rise) * 40))
  ctx.fillStyle = '#14152b'
  ctx.fillRect(gx - 21, gy - 34, 42, 36)
  ctx.fillRect(gx - 17, gy - 38, 34, 6)
  ctx.fillStyle = '#aab3cc'
  ctx.fillRect(gx - 18, gy - 32, 36, 34)
  ctx.fillRect(gx - 14, gy - 35, 28, 4)
  ctx.fillStyle = '#7f89a8'
  ctx.fillRect(gx + 12, gy - 32, 6, 34)
  ctx.fillStyle = '#14152b'
  ctx.font = 'bold 9px Galmuri11, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('로그', gx - 2, gy - 20)
  ctx.fillText('아웃', gx - 2, gy - 9)
  ctx.fillStyle = '#3a9e47'
  ctx.fillRect(gx - 24, gy - 3, 48, 5)
  ctx.restore()
  // 유령: 떠오르며 흔들리고 사라진다.
  const ghost = (age - 0.8) / 2.2
  if (ghost <= 0 || ghost >= 1) return
  const hx = Math.round(gx + Math.sin(time * 5) * 6)
  const hy = Math.round(gy - 40 - ghost * 70)
  const flap = Math.floor(time * 8) % 2 === 0 ? 0 : 3
  ctx.save()
  ctx.globalAlpha = 0.9 * (1 - ghost)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(hx - 8, hy - 8, 16, 14)
  ctx.fillRect(hx - 6, hy - 11, 12, 4)
  ctx.fillRect(hx - 8, hy + 6, 4, 4)
  ctx.fillRect(hx - 2, hy + 6, 4, 4)
  ctx.fillRect(hx + 4, hy + 6, 4, 4)
  ctx.fillRect(hx - 18, hy - 6 - flap, 9, 4)
  ctx.fillRect(hx + 9, hy - 6 - flap, 9, 4)
  ctx.fillStyle = '#ffd84a'
  ctx.fillRect(hx - 7, hy - 17, 14, 3)
  ctx.fillStyle = '#14152b'
  ctx.fillRect(hx - 5, hy - 5, 3, 4)
  ctx.fillRect(hx + 2, hy - 5, 3, 4)
  ctx.fillRect(hx - 1, hy + 1, 2, 2)
  ctx.restore()
}

// 가운데 큰 글자("로그아웃 시켰다!"). age: 나온 뒤 흐른 초, life: 보이는 시간
export function drawBanner(ctx, banner) {
  const p = banner.t / banner.life
  if (p >= 1) return
  const pop = p < 0.12 ? 1.8 - (p / 0.12) * 0.8 : 1
  ctx.save()
  ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1
  ctx.translate(ARENA.w / 2, 150)
  ctx.scale(pop, pop)
  ctx.fillStyle = 'rgba(20,21,43,0.78)'
  ctx.fillRect(-150, -26, 300, 52)
  ctx.fillStyle = banner.color
  ctx.fillRect(-150, -26, 300, 4)
  ctx.fillRect(-150, 22, 300, 4)
  ctx.textAlign = 'center'
  ctx.font = 'bold 22px Galmuri11, sans-serif'
  outlined(ctx, banner.text, 0, 2, '#ffffff', '#14152b', 4)
  if (banner.sub) {
    ctx.font = '11px Galmuri11, sans-serif'
    ctx.fillStyle = '#ffd84a'
    ctx.fillText(banner.sub, 0, 17)
  }
  ctx.restore()
}
