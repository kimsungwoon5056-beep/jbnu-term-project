import { APP_LOOKS, C, lookLabel } from '../character/appLook'
import { loadoutSprite, skillOf } from './loadout'
import { Pool } from './pool'
import { bubbleY, drainLevel, ITEMS, itemAlive, safeArea, STORM, warningLanes } from './schedule'
import { AREA, ARENA, DASH, MATCH_SECONDS, OBSTACLES, playerById, RADIUS } from './world'

// 캔버스 그리기. 경기장은 거대한 폰 홈 화면이다: 상태 표시줄, 배경화면, 앱 아이콘(장애물), 독.
// 캐릭터는 홈과 같은 도트 그림(48×48)을 1배로 그리고 캔버스를 CSS로 키운다.

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
function pixelBox(ctx, x, y, w, h, fill, cut = 4) {
  ctx.fillStyle = fill
  ctx.fillRect(x + cut, y, w - cut * 2, h)
  ctx.fillRect(x, y + cut, w, h - cut * 2)
  ctx.fillRect(x + cut / 2, y + cut / 2, w - cut, h - cut)
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

function drawAppIcon(ctx, key, x, y, size) {
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
function buildBackground() {
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

function drawItem(ctx, item, time) {
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

function drawBubble(ctx, bubble, y) {
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

function hpBar(ctx, player, color) {
  const w = 36
  const x = Math.round(player.x - w / 2)
  const y = Math.round(player.y - 46)
  ctx.fillStyle = '#14152b'
  ctx.fillRect(x - 1, y - 1, w + 2, 6)
  ctx.fillStyle = '#5b2236'
  ctx.fillRect(x, y, w, 4)
  ctx.fillStyle = color
  ctx.fillRect(x, y, Math.round((w * player.hp) / player.maxHp), 4)
  ctx.font = '10px Galmuri11, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(10,8,30,0.7)'
  ctx.fillText(player.name, player.x + 1, y - 3)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(player.name, player.x, y - 4)
}

// 상태 표시줄: 시계 = 남은 시간, 배터리 = 남은 시간 비율(60초부터 빨강), 가운데 = 지금 일어나는 일
function statusBar(ctx, world, storming) {
  const left = Math.max(0, Math.ceil(MATCH_SECONDS - world.time))
  ctx.textAlign = 'left'
  ctx.font = 'bold 15px Galmuri11, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, 12, 24)
  const level = Math.max(0, 1 - world.time / MATCH_SECONDS)
  const low = drainLevel(world.time) > 0
  const bx = ARENA.w - 48
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(bx, 11, 30, 16)
  ctx.fillRect(bx + 30, 15, 3, 8)
  ctx.fillStyle = '#14152b'
  ctx.fillRect(bx + 2, 13, 26, 12)
  ctx.fillStyle = low ? '#ff3b5c' : level > 0.5 ? '#4cc96b' : '#ffd84a'
  ctx.fillRect(bx + 3, 14, Math.max(2, Math.round(24 * level)), 10)
  ctx.textAlign = 'center'
  ctx.font = 'bold 11px Galmuri11, sans-serif'
  const notice = storming ? '알림 폭풍!' : low ? '배터리 부족 · 가운데로!' : ''
  if (notice && Math.floor(world.time * 4) % 2 === 0) {
    ctx.fillStyle = storming ? '#ffd84a' : '#ff8a9a'
    ctx.fillText(notice, ARENA.w / 2, 23)
  }
}

// 독 = 내 상태 칸: 대시, 앱 기술, 아이템 효과. 재사용 대기 중이면 어둡게 덮고 남은 초를 쓴다.
function dockSlot(ctx, x, label, sub, ready, fill) {
  const y = AREA.y1 + 10
  const w = 100
  const h = 36
  pixelBox(ctx, x, y, w, h, '#14152b', 6)
  pixelBox(ctx, x + 2, y + 2, w - 4, h - 4, ready ? '#ffd84a' : '#4a4e7a', 5)
  if (!ready && fill > 0) {
    ctx.fillStyle = 'rgba(255,216,74,0.45)'
    ctx.fillRect(x + 4, y + 4, Math.round((w - 8) * (1 - fill)), h - 8)
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = ready ? '#14152b' : '#ffffff'
  ctx.font = 'bold 11px Galmuri11, sans-serif'
  ctx.fillText(label, x + w / 2, y + 16)
  ctx.font = '9px Galmuri11, sans-serif'
  ctx.fillText(sub, x + w / 2, y + 28)
}

function dock(ctx, me) {
  if (!me) return
  const skill = skillOf(me.loadout)
  const dash = me.cd.dash
  dockSlot(ctx, 14, '대시', dash > 0 ? `${dash.toFixed(1)}초` : 'Space · 짧은 무적', dash <= 0, dash / DASH.cooldown)
  const left = me.cd.skill
  dockSlot(ctx, 130, `Q ${skill.name}`, left > 0 ? `${left.toFixed(1)}초` : '준비 완료', left <= 0 && me.loadout.skill !== 'unrecorded', left / skill.cooldown)
  const active = [
    me.airT > 0 && `${ITEMS.airplane.label} ${me.airT.toFixed(1)}`,
    me.dndT > 0 && `${ITEMS.dnd.label} ${me.dndT.toFixed(1)}`,
    me.shieldT > 0 && `실드 ${me.shieldT.toFixed(1)}`,
  ].filter(Boolean)
  dockSlot(ctx, 246, active[0] ?? '효과 없음', active[1] ?? (me.alive ? `체력 ${me.hp}/${me.maxHp}` : '아웃'), active.length > 0, 0)
}

// 위에서 내려오는 푸시 알림(쓰러뜨림·아이템)
function feedCard(ctx, text, index, age) {
  const slide = Math.min(1, age / 0.2)
  const y = AREA.y0 + 6 + index * 30 - Math.round((1 - slide) * 30)
  ctx.globalAlpha = age > 1.8 ? Math.max(0, (2.2 - age) / 0.4) : 1
  pixelBox(ctx, 40, y, ARENA.w - 80, 26, 'rgba(20,21,43,0.85)', 5)
  pixelBox(ctx, 46, y + 5, 16, 16, '#4cc96b', 3)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(51, y + 9, 6, 8)
  ctx.textAlign = 'left'
  ctx.font = 'bold 11px Galmuri11, sans-serif'
  ctx.fillText(text, 70, y + 17)
  ctx.globalAlpha = 1
}

const PARTICLE_COLORS = { hit: ['#ffffff', '#ffd84a', '#ff5a5f'], down: ['#ff3b5c', '#ffd84a', '#7fe7ff', '#ffffff'], item: ['#ffd84a', '#ffffff'] }

export class Renderer {
  // Observer: 만들 때 world.signals를 구독해, 신호가 오면 파편·화면 흔들림·푸시 알림·"폰 내려놔!"를 준비한다.
  constructor(canvas, world, meId) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.world = world
    this.meId = meId
    this.background = buildBackground()
    this.sprites = new Map(world.players.map((player) => [player.id, spriteCanvas(player.loadout)]))
    this.flashes = new Map(world.players.map((player) => [player.id, spriteCanvas(player.loadout, true)]))
    this.particles = new Pool(() => ({}))
    this.feed = []
    this.shake = 0
    this.last = performance.now()
    this.goAt = null
    this.unsubscribe = world.signals.subscribe((signal) => this.react(signal))
  }

  // 판이 끝나 루프가 멈추면 구독을 끊는다.
  dispose() {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  react(signal) {
    const now = performance.now()
    const mine = signal.who === this.meId
    const who = signal.who ? playerById(this.world, signal.who) : null
    if (signal.kind === 'hit') {
      this.burst(signal.x, signal.y + 10, PARTICLE_COLORS.hit, 6, 90)
      if (mine) this.shake = 0.25
    }
    if (signal.kind === 'down') {
      this.burst(signal.x, signal.y - 10, PARTICLE_COLORS.down, 18, 160)
      this.feed.push({ text: mine ? '내가 쓰러졌어요' : `${who?.name ?? '상대'} 아웃!`, at: now })
      if (mine) this.shake = 0.4
    }
    if (signal.kind === 'item') {
      this.burst(signal.x, signal.y + 14, PARTICLE_COLORS.item, 10, 110)
      this.feed.push({ text: `${mine ? '나' : (who?.name ?? '상대')} · ${signal.text}`, at: now })
    }
    if (signal.kind === 'go') this.goAt = now
  }

  burst(x, y, colors, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (i % 3) * 0.3
      const v = speed * (0.5 + ((i * 7) % 5) / 8)
      this.particles.acquire({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 40, life: 0.5, color: colors[i % colors.length], size: i % 4 === 0 ? 4 : 3 })
    }
  }

  draw(world, { countdown = 0 } = {}) {
    const { ctx } = this
    const time = world.time
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.feed = this.feed.filter((card) => now - card.at < 2200).slice(-3)

    ctx.imageSmoothingEnabled = false
    ctx.save()
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt)
      const power = Math.round(this.shake * 16)
      ctx.translate(((now / 16) % 2 > 1 ? 1 : -1) * power, ((now / 23) % 2 > 1 ? 1 : -1) * power * 0.6)
    }
    ctx.drawImage(this.background, 0, 0)

    // 알림 폭풍 경고 줄
    const warned = world.events ? warningLanes(world.schedule, time) : new Set()
    for (const lane of warned) {
      const x = AREA.x0 + lane * world.schedule.laneW
      ctx.fillStyle = Math.floor(time * 8) % 2 === 0 ? 'rgba(255,59,92,0.28)' : 'rgba(255,59,92,0.16)'
      ctx.fillRect(x + 4, AREA.y0, world.schedule.laneW - 8, AREA.y1 - AREA.y0)
      pixelBox(ctx, x + world.schedule.laneW / 2 - 9, AREA.y0 + 6, 18, 18, '#ff3b5c', 4)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x + world.schedule.laneW / 2 - 1, AREA.y0 + 9, 3, 7)
      ctx.fillRect(x + world.schedule.laneW / 2 - 1, AREA.y0 + 18, 3, 3)
    }

    if (world.events) for (const item of world.items) if (itemAlive(item, time)) drawItem(ctx, item, time)

    for (const trap of world.traps) {
      ctx.fillStyle = trap.color
      ctx.fillRect(trap.x - 12, trap.y - 9, 24, 18)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(trap.x - 4, trap.y - 5)
      ctx.lineTo(trap.x + 6, trap.y)
      ctx.lineTo(trap.x - 4, trap.y + 5)
      ctx.fill()
    }
    for (const ring of world.rings) {
      ctx.strokeStyle = ring.color
      ctx.globalAlpha = 1 - ring.t / 0.4
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(ring.x, ring.y, ring.r * (0.4 + ring.t * 1.5), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const order = [...world.players].sort((a, b) => a.y - b.y)
    for (const player of order) {
      const sprite = this.sprites.get(player.id)
      ctx.globalAlpha = player.alive ? 1 : 0.3
      ctx.fillStyle = 'rgba(10,8,30,0.35)'
      ctx.fillRect(Math.round(player.x - 11), Math.round(player.y + 11), 22, 4)
      if (player.dashT > 0) {
        ctx.globalAlpha = 0.35
        ctx.drawImage(sprite, Math.round(player.x - 24 - player.dashX * 14), Math.round(player.y - 34 - player.dashY * 14))
        ctx.globalAlpha = 1
      }
      ctx.drawImage(player.flashT > 0 ? this.flashes.get(player.id) : sprite, Math.round(player.x - 24), Math.round(player.y - 34))
      ctx.globalAlpha = 1
      if (!player.alive) continue
      if (player.shieldT > 0 || player.airT > 0) {
        ctx.strokeStyle = player.airT > 0 ? '#9fc2ff' : '#7fe7ff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(player.x, player.y - 8, RADIUS + 12, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (player.dndT > 0) {
        // 방해 금지: 체력 막대 왼쪽 보라 달
        pixelBox(ctx, player.x - 34, player.y - 52, 12, 12, '#6b5fd3', 3)
        ctx.fillStyle = '#ffd84a'
        ctx.fillRect(player.x - 31, player.y - 49, 4, 6)
        ctx.fillRect(player.x - 29, player.y - 50, 3, 2)
      }
      if (player.stunT > 0) {
        ctx.fillStyle = '#ff3b5c'
        ctx.fillRect(player.x + 10, player.y - 44, 10, 12)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(player.x + 14, player.y - 42, 2, 5)
        ctx.fillRect(player.x + 14, player.y - 35, 2, 2)
      }
      hpBar(ctx, player, player.id === this.meId ? '#4cc96b' : '#ff5a5f')
      if (player.id === this.meId) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(player.x + Math.cos(player.aim) * 20, player.y + Math.sin(player.aim) * 20)
        ctx.lineTo(player.x + Math.cos(player.aim) * 34, player.y + Math.sin(player.aim) * 34)
        ctx.stroke()
      }
    }

    for (const shot of world.projectiles.active) {
      const size = shot.r * 2
      ctx.fillStyle = '#14152b'
      ctx.fillRect(Math.round(shot.x - shot.r - 1), Math.round(shot.y - shot.r - 1), size + 2, size + 2)
      ctx.fillStyle = shot.color
      ctx.fillRect(Math.round(shot.x - shot.r), Math.round(shot.y - shot.r), size, size)
    }

    // 알림 말풍선(사람 위로 쏟아진다)
    let storming = warned.size > 0
    if (world.events) {
      for (const bubble of world.schedule.bubbles) {
        const y = bubbleY(bubble, time, AREA)
        if (y === null) continue
        storming = true
        drawBubble(ctx, bubble, y)
      }
    }

    for (const bit of this.particles.active) {
      bit.life -= dt
      bit.x += bit.vx * dt
      bit.y += bit.vy * dt
      bit.vy += 320 * dt
      ctx.globalAlpha = Math.max(0, bit.life / 0.5)
      ctx.fillStyle = bit.color
      ctx.fillRect(Math.round(bit.x), Math.round(bit.y), bit.size, bit.size)
    }
    ctx.globalAlpha = 1
    this.particles.sweep((bit) => bit.life > 0)

    ctx.textAlign = 'center'
    for (const fx of world.effects) {
      if (fx.kind === 'shot') continue
      ctx.globalAlpha = 1 - fx.t / 0.8
      ctx.font = 'bold 12px Galmuri11, sans-serif'
      ctx.fillStyle = { hit: '#ffffff', alarm: '#ff3b5c', item: '#ffd84a', block: '#b9b0ff' }[fx.kind] ?? '#7fe7ff'
      const label = fx.text || { shield: '실드!', focus: '집중!', down: '아웃!' }[fx.kind] || ''
      ctx.fillText(label, fx.x, fx.y - fx.t * 20)
    }
    ctx.globalAlpha = 1

    // 배터리 경고: 가장자리부터 꺼진 화면
    if (world.events && drainLevel(time) > 0) {
      const safe = safeArea(AREA, time)
      ctx.fillStyle = 'rgba(8,8,16,0.72)'
      ctx.fillRect(0, AREA.y0, ARENA.w, safe.y0 - AREA.y0)
      ctx.fillRect(0, safe.y1, ARENA.w, AREA.y1 - safe.y1)
      ctx.fillRect(0, safe.y0, safe.x0, safe.y1 - safe.y0)
      ctx.fillRect(safe.x1, safe.y0, ARENA.w - safe.x1, safe.y1 - safe.y0)
      ctx.strokeStyle = Math.floor(time * 4) % 2 === 0 ? '#ff3b5c' : '#ffd84a'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(safe.x0, safe.y0, safe.x1 - safe.x0, safe.y1 - safe.y0)
      ctx.setLineDash([])
    }

    // 다크서클: 내 시야 가장자리만 어둡다.
    const me = world.players.find((player) => player.id === this.meId)
    if (me?.alive && me.loadout.debuffs.darkCircles) {
      const gradient = ctx.createRadialGradient(me.x, me.y, 170, me.x, me.y, 420)
      gradient.addColorStop(0, 'rgba(20,10,40,0)')
      gradient.addColorStop(1, 'rgba(20,10,40,0.6)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, AREA.y0, ARENA.w, AREA.y1 - AREA.y0)
    }

    ctx.restore()
    ctx.drawImage(this.background, 0, 0, ARENA.w, AREA.y0, 0, 0, ARENA.w, AREA.y0)
    statusBar(ctx, world, storming)
    ctx.drawImage(this.background, 0, AREA.y1, ARENA.w, ARENA.h - AREA.y1, 0, AREA.y1, ARENA.w, ARENA.h - AREA.y1)
    dock(ctx, me)
    this.feed.forEach((card, i) => feedCard(ctx, card.text, i, (now - card.at) / 1000))

    ctx.textAlign = 'center'
    if (countdown > 0) {
      ctx.fillStyle = 'rgba(10,8,30,0.55)'
      ctx.fillRect(0, 0, ARENA.w, ARENA.h)
      const pop = 1 + (countdown % 1) * 0.4
      ctx.font = `bold ${Math.round(64 * pop)}px Galmuri11, sans-serif`
      ctx.fillStyle = '#ffd84a'
      ctx.fillText(String(Math.ceil(countdown)), ARENA.w / 2, ARENA.h / 2 + 20)
      ctx.font = '13px Galmuri11, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText('폰을 덜 쓴 사람이 체력이 높아요', ARENA.w / 2, ARENA.h / 2 + 60)
    } else if (this.goAt !== null && now - this.goAt < 900) {
      ctx.globalAlpha = 1 - (now - this.goAt) / 900
      ctx.font = 'bold 34px Galmuri11, sans-serif'
      ctx.fillStyle = '#14152b'
      ctx.fillText('폰 내려놔!', ARENA.w / 2 + 2, ARENA.h / 2 + 2)
      ctx.fillStyle = '#ffd84a'
      ctx.fillText('폰 내려놔!', ARENA.w / 2, ARENA.h / 2)
      ctx.globalAlpha = 1
    }
  }
}
