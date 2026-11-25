import { APP_LOOKS, C, lookLabel } from '../character/appLook'
import { loadoutSprite } from './loadout'
import { STORM } from './schedule'
import { AREA, ARENA, OBSTACLES } from './world'

// 대결 화면의 도트 그림 조각(캐릭터·배경·아이콘·아이템·말풍선·체력 막대). 위에서 보는 화면과 1인칭 화면이 함께 쓴다.

// 대결 능력 스냅샷 → 도트 캐릭터 이미지(배경 없음). flash면 맞았을 때 쓰는 흰 실루엣
export function spriteCanvas(loadout, flash = false) {
  const sprite = loadoutSprite(loadout)
  const canvas = document.createElement('canvas')
  canvas.width = sprite.size
  canvas.height = sprite.size
  const ctx = canvas.getContext('2d')
  for (const [x, y, color] of sprite.layers.body) {
    ctx.fillStyle = flash ? '#ffffff' : (sprite.palette[color] ?? color)
    ctx.fillRect(x, y, 1, 1)
  }
  return canvas
}

// 모서리를 한 칸 깎은 도트 사각형
export function pixelBox(ctx, x, y, w, h, fill, cut = 4) {
  ctx.fillStyle = fill
  ctx.fillRect(x + cut, y, w - cut * 2, h)
  ctx.fillRect(x, y + cut, w, h - cut * 2)
  ctx.fillRect(x + cut / 2, y + cut / 2, w - cut, h - cut)
}

// 5×5 앱 로고(appLook.js)
export function drawLogo(ctx, logo, x, y, cell) {
  logo.forEach((row, ry) => {
    ;[...row].forEach((ch, rx) => {
      if (ch === '.') return
      ctx.fillStyle = C[ch] ?? ch
      ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell)
    })
  })
}

export function drawAppIcon(ctx, key, x, y, size) {
  const look = APP_LOOKS[key]
  pixelBox(ctx, x + 2, y + 4, size, size, 'rgba(10,8,30,0.35)', 8)
  pixelBox(ctx, x, y, size, size, '#14152b', 8)
  pixelBox(ctx, x + 2, y + 2, size - 4, size - 4, look.main, 7)
  const cell = Math.floor((size - 12) / 5)
  drawLogo(ctx, look.logo, x + Math.round((size - cell * 5) / 2), y + Math.round((size - cell * 5) / 2), cell)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(x + 8, y + 4, size - 16, 2)
}

// 배경(바뀌지 않는 부분)은 한 번만 그려 둔다.
export function buildBackground() {
  const canvas = document.createElement('canvas')
  canvas.width = ARENA.w
  canvas.height = ARENA.h
  const ctx = canvas.getContext('2d')
  // 배경화면: 해 질 녘 그라데이션 + 도트 별
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA.h)
  sky.addColorStop(0, '#2b2668')
  sky.addColorStop(0.55, '#7a4c9e')
  sky.addColorStop(1, '#e0789a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, ARENA.w, ARENA.h)
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 97) % ARENA.w
    const y = (i * 53) % 320
    ctx.fillStyle = i % 5 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'
    ctx.fillRect(x, y + 40, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1)
  }
  // 도트 언덕
  ctx.fillStyle = 'rgba(40,20,70,0.35)'
  for (let x = 0; x < ARENA.w; x += 4) {
    const h = 40 + Math.round(18 * Math.sin(x / 37) + 10 * Math.sin(x / 13))
    ctx.fillRect(x, AREA.y1 - h, 4, h)
  }
  // 앱 아이콘(장애물)과 이름
  ctx.font = '10px Galmuri11, sans-serif'
  ctx.textAlign = 'center'
  for (const box of OBSTACLES) {
    drawAppIcon(ctx, box.app, box.x, box.y, box.w)
    ctx.fillStyle = 'rgba(10,8,30,0.6)'
    ctx.fillText(lookLabel(box.app), box.x + box.w / 2 + 1, box.y + box.h + 15)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(lookLabel(box.app), box.x + box.w / 2, box.y + box.h + 14)
  }
  // 페이지 점
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i === 1 ? '#ffffff' : 'rgba(255,255,255,0.45)'
    ctx.fillRect(ARENA.w / 2 - 14 + i * 12, AREA.y1 - 12, 4, 4)
  }
  // 독(벽)
  pixelBox(ctx, 8, AREA.y1 + 4, ARENA.w - 16, ARENA.h - AREA.y1 - 10, 'rgba(255,255,255,0.28)', 8)
  // 상태 표시줄 바탕
  ctx.fillStyle = 'rgba(10,8,30,0.55)'
  ctx.fillRect(0, 0, ARENA.w, AREA.y0)
  return canvas
}

// 아이템 아이콘(7칸 그림)
const ITEM_ART = {
  airplane: { color: '#2f6bff', rows: ['...#...', '..###..', '#######', '..###..', '...#...', '..###..'] },
  charger: { color: '#ffb21e', rows: ['....##', '...##.', '..####', '.####.', '..##..', '.##...', '##....'] },
  dnd: { color: '#6b5fd3', rows: ['..###.', '.##...', '##....', '##....', '.##...', '..###.'] },
}

export function drawItem(ctx, item, time) {
  const bob = Math.round(Math.sin(time * 4 + item.id) * 3)
  const art = ITEM_ART[item.kind]
  ctx.fillStyle = 'rgba(10,8,30,0.35)'
  ctx.fillRect(item.x - 10, item.y + 12, 20, 4)
  const x = item.x - 13
  const y = item.y - 13 + bob
  pixelBox(ctx, x - 2, y - 2, 30, 30, '#14152b', 6)
  pixelBox(ctx, x, y, 26, 26, '#ffffff', 5)
  const cell = 3
  const w = art.rows[0].length * cell
  const h = art.rows.length * cell
  art.rows.forEach((row, ry) => {
    ;[...row].forEach((ch, rx) => {
      if (ch !== '#') return
      ctx.fillStyle = art.color
      ctx.fillRect(x + Math.round((26 - w) / 2) + rx * cell, y + Math.round((26 - h) / 2) + ry * cell, cell, cell)
    })
  })
  // 반짝임
  if (Math.floor(time * 3 + item.id) % 3 === 0) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + 22, y - 6, 2, 6)
    ctx.fillRect(x + 20, y - 4, 6, 2)
  }
}

const BUBBLE_STYLE = {
  chat: { icon: '#fee500', dot: '#3c1e1e', text: 'ㅋㅋㅋ' },
  dm: { icon: '#e1306c', dot: '#ffffff', text: 'DM 1' },
  ad: { icon: '#ff1f3d', dot: '#ffffff', text: '광고' },
}

export function drawBubble(ctx, bubble, y) {
  const style = BUBBLE_STYLE[bubble.kind]
  const x = Math.round(bubble.x - STORM.w / 2)
  const top = Math.round(y - STORM.h / 2)
  pixelBox(ctx, x - 2, top - 2, STORM.w + 4, STORM.h + 4, '#14152b', 4)
  pixelBox(ctx, x, top, STORM.w, STORM.h, '#ffffff', 3)
  ctx.fillStyle = style.icon
  ctx.fillRect(x + 4, top + 4, 14, 14)
  ctx.fillStyle = style.dot
  ctx.fillRect(x + 8, top + 8, 6, 5)
  ctx.font = 'bold 9px Galmuri11, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#14152b'
  ctx.fillText(style.text, x + 21, top + 15)
}

export function hpBar(ctx, player, color) {
  const w = 36
  // 벽에 붙어도 막대와 이름이 화면 밖으로 잘리지 않게
  ctx.font = '10px Galmuri11, sans-serif'
  const half = Math.max(w, ctx.measureText(player.name).width) / 2 + 3
  const cx = Math.round(Math.min(ARENA.w - half, Math.max(half, player.x)))
  const x = cx - w / 2
  const y = Math.max(AREA.y0 + 14, Math.round(player.y - 46)) // 맨 위에 있어도 상태 표시줄에 가리지 않게
  ctx.fillStyle = '#14152b'
  ctx.fillRect(x - 1, y - 1, w + 2, 6)
  ctx.fillStyle = '#5b2236'
  ctx.fillRect(x, y, w, 4)
  ctx.fillStyle = color
  ctx.fillRect(x, y, Math.round((w * player.hp) / player.maxHp), 4)
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(10,8,30,0.7)'
  ctx.fillText(player.name, cx + 1, y - 3)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(player.name, cx, y - 4)
}
