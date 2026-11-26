import { outlined } from './fx'
import { ARENA } from './world'

// 카운트다운 동안의 VS 화면: 나는 왼쪽에서, 상대는 오른쪽에서 미끄러져 들어온다. left: 남은 초(3 → 0)
const ease = (p) => 1 - (1 - Math.min(1, Math.max(0, p))) ** 3
const COLORS = ['#ff5a5f', '#ffb21e', '#2ac1bc']

// 초상화 카드 하나
function card(ctx, sprite, player, x, y, w, h, color, flip) {
  ctx.fillStyle = '#14152b'
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
  const gradient = ctx.createLinearGradient(x, y, x + w, y)
  gradient.addColorStop(flip ? 1 : 0, color)
  gradient.addColorStop(flip ? 0 : 1, '#2b2668')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, w, h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  // 빗금
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  for (let i = -h; i < w; i += 18) {
    ctx.beginPath()
    ctx.moveTo(x + i, y + h)
    ctx.lineTo(x + i + 8, y + h)
    ctx.lineTo(x + i + 8 + h, y)
    ctx.lineTo(x + i + h, y)
    ctx.fill()
  }
  const size = 48 * 2
  const sx = flip ? x + w - size - 4 : x + 4
  ctx.drawImage(sprite, sx, y + h - size + 34, size, size)
  ctx.restore()
  ctx.textAlign = flip ? 'left' : 'right'
  const tx = flip ? x + 12 : x + w - 12
  ctx.font = 'bold 16px Galmuri11, sans-serif'
  outlined(ctx, player.name, tx, y + h / 2 - 2, '#ffffff')
  ctx.font = 'bold 11px Galmuri11, sans-serif'
  outlined(ctx, `체력 ${player.maxHp} · 건강 ${player.loadout.health}%`, tx, y + h / 2 + 16, '#ffd84a', '#14152b', 3)
}

export function drawIntro(ctx, world, sprites, meId, left) {
  const age = 3 - left
  ctx.fillStyle = 'rgba(10,8,30,0.72)'
  ctx.fillRect(0, 0, ARENA.w, ARENA.h)
  const me = world.players.find((player) => player.id === meId)
  const rivals = world.players.filter((player) => player.id !== meId).slice(0, 3)
  const w = 300
  if (me) card(ctx, sprites.get(me.id), me, -w + ease(age / 0.5) * (w + 14), 92, w, 74, '#4cc96b', false)
  rivals.forEach((player, i) => card(ctx, sprites.get(player.id), player, ARENA.w - ease((age - 0.25 - i * 0.15) / 0.5) * (w + 14), 250 + i * 88, w, 74, COLORS[i], true))
  // VS
  const pop = Math.max(0, Math.min(1, (age - 0.5) / 0.2))
  if (pop > 0) {
    ctx.save()
    ctx.translate(ARENA.w / 2, 212)
    ctx.rotate(-0.08)
    ctx.scale(2.6 - pop * 1.6, 2.6 - pop * 1.6)
    ctx.globalAlpha = pop
    ctx.textAlign = 'center'
    ctx.font = 'bold 46px Galmuri11, sans-serif'
    outlined(ctx, 'VS', 0, 14, '#ff3b5c', '#ffffff', 6)
    ctx.restore()
  }
  // 남은 초
  const beat = 1 + (left % 1) * 0.5
  ctx.textAlign = 'center'
  ctx.font = `bold ${Math.round(48 * beat)}px Galmuri11, sans-serif`
  outlined(ctx, String(Math.ceil(left)), ARENA.w / 2, 72, '#ffd84a', '#14152b', 6)
  const touch = Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches)
  ctx.font = 'bold 13px Galmuri11, sans-serif'
  outlined(ctx, touch ? '스틱 이동 · 공격 누른 채 밀어 둘러보기' : 'WASD 이동 · 마우스 둘러보기 · Space 점프 · Shift 대시', ARENA.w / 2, 556, '#ffd84a', '#14152b', 3)
  ctx.font = '12px Galmuri11, sans-serif'
  outlined(ctx, '폰을 덜 쓴 사람이 체력이 높아요', ARENA.w / 2, 580, '#ffffff', '#14152b', 3)
}
