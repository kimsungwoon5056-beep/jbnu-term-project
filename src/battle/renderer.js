import { drawCharacter } from '../character/drawCharacter'
import { ARENA, MATCH_SECONDS, OBSTACLES, RADIUS } from './world'

// 캔버스 그리기. 캐릭터는 홈과 같은 도트 그림(48×48)을 1배로 그려 CSS로 키운다.
const TILE = 32

// 대결 능력 스냅샷 → 도트 캐릭터 이미지(배경 없음)
export function spriteCanvas(loadout) {
  const sprite = drawCharacter(loadout.look, { tier: loadout.tier, grafts: loadout.grafts ?? [], marks: loadout.marks, scene: 'home' })
  const canvas = document.createElement('canvas')
  canvas.width = sprite.size
  canvas.height = sprite.size
  const ctx = canvas.getContext('2d')
  for (const [x, y, color] of sprite.layers.body) {
    ctx.fillStyle = sprite.palette[color] ?? color
    ctx.fillRect(x, y, 1, 1)
  }
  return canvas
}

function floor(ctx) {
  for (let y = 0; y < ARENA.h; y += TILE) {
    for (let x = 0; x < ARENA.w; x += TILE) {
      ctx.fillStyle = (x / TILE + y / TILE) % 2 === 0 ? '#2b2e57' : '#30346a'
      ctx.fillRect(x, y, TILE, TILE)
    }
  }
}

// 장애물: 충전 거치대 위의 큰 폰
function obstacles(ctx) {
  for (const box of OBSTACLES) {
    ctx.fillStyle = '#14152b'
    ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4)
    ctx.fillStyle = '#3d4060'
    ctx.fillRect(box.x, box.y, box.w, box.h)
    ctx.fillStyle = '#7fd3ff'
    ctx.fillRect(box.x + 5, box.y + 5, box.w - 10, box.h - 12)
    ctx.fillStyle = '#5ab0e0'
    ctx.fillRect(box.x + 5, box.y + 5, box.w - 10, 4)
  }
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
  ctx.fillStyle = '#ffffff'
  ctx.fillText(player.name, player.x, y - 4)
}

export class Renderer {
  constructor(canvas, world, meId) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.meId = meId
    this.sprites = new Map(world.players.map((player) => [player.id, spriteCanvas(player.loadout)]))
  }

  draw(world, { countdown = 0 } = {}) {
    const { ctx } = this
    ctx.imageSmoothingEnabled = false
    floor(ctx)
    obstacles(ctx)

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
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(Math.round(player.x - 11), Math.round(player.y + 11), 22, 4)
      if (player.dashT > 0) {
        ctx.globalAlpha = 0.35
        ctx.drawImage(sprite, Math.round(player.x - 24 - player.dashX * 14), Math.round(player.y - 34 - player.dashY * 14))
        ctx.globalAlpha = 1
      }
      ctx.drawImage(sprite, Math.round(player.x - 24), Math.round(player.y - 34))
      ctx.globalAlpha = 1
      if (!player.alive) continue
      if (player.shieldT > 0) {
        ctx.strokeStyle = '#7fe7ff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(player.x, player.y - 8, RADIUS + 12, 0, Math.PI * 2)
        ctx.stroke()
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
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'
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

    ctx.textAlign = 'center'
    for (const fx of world.effects) {
      ctx.globalAlpha = 1 - fx.t / 0.8
      ctx.font = 'bold 12px Galmuri11, sans-serif'
      ctx.fillStyle = fx.kind === 'hit' ? '#ffffff' : fx.kind === 'alarm' ? '#ff3b5c' : '#7fe7ff'
      const label = fx.text || { shield: '실드!', focus: '집중!', down: '아웃!' }[fx.kind] || ''
      ctx.fillText(label, fx.x, fx.y - fx.t * 20)
    }
    ctx.globalAlpha = 1

    // 다크서클: 내 시야만 좁아진다.
    const me = world.players.find((player) => player.id === this.meId)
    if (me?.alive && me.loadout.debuffs.darkCircles) {
      const gradient = ctx.createRadialGradient(me.x, me.y, 120, me.x, me.y, 300)
      gradient.addColorStop(0, 'rgba(10,8,30,0)')
      gradient.addColorStop(1, 'rgba(10,8,30,0.85)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, ARENA.w, ARENA.h)
    }

    // 남은 시간
    const left = Math.max(0, Math.ceil(MATCH_SECONDS - world.time))
    ctx.font = 'bold 16px Galmuri11, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, ARENA.w / 2, 20)
    if (countdown > 0) {
      ctx.fillStyle = 'rgba(10,8,30,0.55)'
      ctx.fillRect(0, 0, ARENA.w, ARENA.h)
      ctx.font = 'bold 64px Galmuri11, sans-serif'
      ctx.fillStyle = '#ffd84a'
      ctx.fillText(String(Math.ceil(countdown)), ARENA.w / 2, ARENA.h / 2 + 20)
    }
  }
}
