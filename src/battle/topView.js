import { buildBackground, drawBubble, drawItem, hpBar, pixelBox } from './art'
import { drawGrave, drawPop, drawStars } from './fx'
import { bubbleY, drainLevel, itemAlive, safeArea, warningLanes } from './schedule'
import { AREA, ARENA, RADIUS } from './world'

// 위에서 보는 화면(View). 1인칭 화면(firstPerson)과 같은 draw(ctx, world, me, info)를 가져 렌더러가 바꿔 끼운다(Strategy).
// 경기장은 거대한 폰 홈 화면이다. info: { now, time, poses, motions, particles, pops, trails }

export class TopView {
  constructor({ meId, sprites, flashes }) {
    this.meId = meId
    this.sprites = sprites
    this.flashes = flashes
    this.background = buildBackground()
  }

  draw(ctx, world, me, info) {
    const { time } = info
    ctx.drawImage(this.background, 0, 0)
    this.drawWarnings(ctx, world, time)
    if (world.events) for (const item of world.items) if (itemAlive(item, time)) drawItem(ctx, item, time)
    this.drawGround(ctx, world, time)
    for (const ghost of info.trails) {
      ctx.globalAlpha = 0.45 * (1 - ghost.t / 0.25)
      ctx.drawImage(this.sprites.get(ghost.id), Math.round(ghost.x - 24), Math.round(ghost.y - 34))
    }
    ctx.globalAlpha = 1
    for (const player of [...world.players].sort((a, b) => a.y - b.y)) this.drawPlayer(ctx, player, info)
    this.drawShots(ctx, world)
    if (world.events) {
      for (const bubble of world.schedule.bubbles) {
        const y = bubbleY(bubble, time, AREA)
        if (y !== null) drawBubble(ctx, bubble, y)
      }
    }
    for (const bit of info.particles) {
      ctx.globalAlpha = Math.max(0, bit.life / 0.5)
      ctx.fillStyle = bit.color
      ctx.fillRect(Math.round(bit.x), Math.round(bit.y), bit.size, bit.size)
    }
    ctx.globalAlpha = 1
    this.drawTexts(ctx, world)
    for (const pop of info.pops) drawPop(ctx, pop)
    this.drawDrain(ctx, world, time)
    if (me?.alive && me.loadout.debuffs.darkCircles) this.drawDark(ctx, me)
  }

  // 알림 폭풍 경고 줄
  drawWarnings(ctx, world, time) {
    if (!world.events) return
    for (const lane of warningLanes(world.schedule, time)) {
      const x = AREA.x0 + lane * world.schedule.laneW
      ctx.fillStyle = Math.floor(time * 8) % 2 === 0 ? 'rgba(255,59,92,0.28)' : 'rgba(255,59,92,0.16)'
      ctx.fillRect(x + 4, AREA.y0, world.schedule.laneW - 8, AREA.y1 - AREA.y0)
      pixelBox(ctx, x + world.schedule.laneW / 2 - 9, AREA.y0 + 6, 18, 18, '#ff3b5c', 4)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x + world.schedule.laneW / 2 - 1, AREA.y0 + 9, 3, 7)
      ctx.fillRect(x + world.schedule.laneW / 2 - 1, AREA.y0 + 18, 3, 3)
    }
  }

  // 덫과 충격파
  drawGround(ctx, world, time) {
    for (const trap of world.traps) {
      const pulse = 1 + Math.sin(time * 6) * 0.08
      ctx.save()
      ctx.translate(trap.x, trap.y)
      ctx.scale(pulse, pulse)
      ctx.fillStyle = '#14152b'
      ctx.fillRect(-14, -11, 28, 22)
      ctx.fillStyle = trap.color
      ctx.fillRect(-12, -9, 24, 18)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(-4, -5)
      ctx.lineTo(6, 0)
      ctx.lineTo(-4, 5)
      ctx.fill()
      ctx.restore()
    }
    for (const ring of world.rings) {
      const p = ring.t / 0.4
      ctx.strokeStyle = ring.color
      ctx.globalAlpha = Math.max(0, 1 - p)
      for (const [k, width] of [
        [1, 5],
        [0.72, 3],
        [0.45, 2],
      ]) {
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.arc(ring.x, ring.y, ring.r * (0.4 + p * 0.6) * k, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  drawPlayer(ctx, player, info) {
    const sprite = player.flashT > 0 ? this.flashes.get(player.id) : this.sprites.get(player.id)
    const pose = info.poses.get(player.id) ?? { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0, lift: 0, alpha: 1, stars: 0 }
    const downAge = info.motions.of(player.id).down?.t ?? 0
    const x = player.x + pose.dx
    const feet = player.y + 12
    if (!player.alive) drawGrave(ctx, player.x, player.y, downAge, info.time)
    if (pose.alpha <= 0) return
    // 그림자: 뜰수록 작아진다.
    const shadow = Math.max(0.3, 1 - pose.lift / 90)
    ctx.globalAlpha = 0.35 * pose.alpha
    ctx.fillStyle = '#0a081e'
    ctx.fillRect(Math.round(x - 11 * shadow), Math.round(player.y + 11), Math.round(22 * shadow), 4)
    ctx.globalAlpha = pose.alpha
    ctx.save()
    if (!player.alive) {
      // 쓰러지면 몸 가운데를 중심으로 빙글 돈다.
      ctx.translate(Math.round(x), Math.round(player.y - 10 - pose.lift))
      ctx.rotate(pose.rot)
      ctx.scale(pose.sx, pose.sy)
      ctx.drawImage(sprite, -24, -24)
    } else {
      // 발을 중심으로 찌그러지고 기운다.
      ctx.translate(Math.round(x), Math.round(feet + pose.dy - pose.lift))
      ctx.rotate(pose.rot)
      ctx.scale(pose.sx, pose.sy)
      ctx.drawImage(sprite, -24, -46)
    }
    ctx.restore()
    ctx.globalAlpha = 1
    if (!player.alive) return
    this.drawMarks(ctx, player, info.time)
    drawStars(ctx, x, player.y - 38, Math.max(pose.stars, player.stunT > 0 ? 0.8 : 0), info.time)
    hpBar(ctx, player, player.id === this.meId ? '#4cc96b' : '#ff5a5f')
    if (player.id === this.meId) this.drawAim(ctx, player)
  }

  // 실드·비행기·방해 금지·멈칫
  drawMarks(ctx, player, time) {
    if (player.shieldT > 0 || player.airT > 0) {
      const r = RADIUS + 12 + Math.sin(time * 10) * 1.5
      ctx.strokeStyle = player.airT > 0 ? '#9fc2ff' : '#7fe7ff'
      ctx.fillStyle = player.airT > 0 ? 'rgba(159,194,255,0.18)' : 'rgba(127,231,255,0.18)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(player.x, player.y - 8, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(player.x + Math.cos(time * 4) * r) - 2, Math.round(player.y - 8 + Math.sin(time * 4) * r) - 2, 4, 4)
    }
    if (player.focusT > 0) {
      ctx.fillStyle = '#ffd84a'
      for (let i = 0; i < 4; i += 1) {
        const p = (time * 1.6 + i / 4) % 1
        ctx.globalAlpha = 1 - p
        ctx.fillRect(Math.round(player.x - 14 + i * 9), Math.round(player.y + 10 - p * 44), 2, 7)
      }
      ctx.globalAlpha = 1
    }
    const top = Math.max(AREA.y0 + 8, player.y - 52)
    if (player.dndT > 0) {
      // 방해 금지: 체력 막대 왼쪽 보라 달
      pixelBox(ctx, player.x - 34, top, 12, 12, '#6b5fd3', 3)
      ctx.fillStyle = '#ffd84a'
      ctx.fillRect(player.x - 31, top + 3, 4, 6)
      ctx.fillRect(player.x - 29, top + 2, 3, 2)
    }
    if (player.stunT > 0) {
      ctx.fillStyle = '#ff3b5c'
      ctx.fillRect(player.x + 10, player.y - 44, 10, 12)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(player.x + 14, player.y - 42, 2, 5)
      ctx.fillRect(player.x + 14, player.y - 35, 2, 2)
    }
  }

  drawAim(ctx, player) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (const d of [20, 27, 34]) ctx.fillRect(Math.round(player.x + Math.cos(player.aim) * d) - 1, Math.round(player.y + Math.sin(player.aim) * d) - 1, 3, 3)
  }

  // 탄: 꼬리와 함께
  drawShots(ctx, world) {
    for (const shot of world.projectiles.active) {
      const size = shot.r * 2
      ctx.fillStyle = shot.color
      for (let i = 3; i >= 1; i -= 1) {
        const r = shot.r * (1 - i * 0.2)
        ctx.globalAlpha = 0.32 - i * 0.07
        ctx.fillRect(Math.round(shot.x - shot.vx * 0.014 * i - r), Math.round(shot.y - shot.vy * 0.014 * i - r), Math.round(r * 2), Math.round(r * 2))
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = '#14152b'
      ctx.fillRect(Math.round(shot.x - shot.r - 1), Math.round(shot.y - shot.r - 1), size + 2, size + 2)
      ctx.fillStyle = shot.color
      ctx.fillRect(Math.round(shot.x - shot.r), Math.round(shot.y - shot.r), size, size)
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillRect(Math.round(shot.x - shot.r + 1), Math.round(shot.y - shot.r + 1), Math.max(2, shot.r - 1), Math.max(2, shot.r - 1))
    }
  }

  // 떠오르는 숫자·글자
  drawTexts(ctx, world) {
    ctx.textAlign = 'center'
    for (const fx of world.effects) {
      if (fx.kind === 'shot') continue
      const big = fx.kind === 'hit' && Math.abs(Number(fx.text)) >= 8
      const label = fx.text || { shield: '실드!', focus: '집중!', down: '로그아웃!' }[fx.kind] || ''
      if (!label) continue
      ctx.globalAlpha = Math.max(0, 1 - fx.t / 0.8)
      ctx.font = `bold ${big ? 20 : 13}px Galmuri11, sans-serif`
      ctx.lineWidth = 3
      ctx.strokeStyle = '#14152b'
      const y = fx.y - fx.t * 26
      ctx.strokeText(label, fx.x, y)
      ctx.fillStyle = { hit: big ? '#ff5a5f' : '#ffffff', alarm: '#ff3b5c', item: '#ffd84a', block: '#b9b0ff' }[fx.kind] ?? '#7fe7ff'
      ctx.fillText(label, fx.x, y)
    }
    ctx.globalAlpha = 1
  }

  // 배터리 경고: 가장자리부터 꺼진 화면
  drawDrain(ctx, world, time) {
    if (!world.events || drainLevel(time) <= 0) return
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
  drawDark(ctx, me) {
    const gradient = ctx.createRadialGradient(me.x, me.y, 170, me.x, me.y, 420)
    gradient.addColorStop(0, 'rgba(20,10,40,0)')
    gradient.addColorStop(1, 'rgba(20,10,40,0.6)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, AREA.y0, ARENA.w, AREA.y1 - AREA.y0)
  }
}
