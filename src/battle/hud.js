import { pixelBox } from './art'
import { skillOf } from './loadout'
import { drainLevel, ITEMS } from './schedule'
import { AREA, ARENA, DASH, MATCH_SECONDS } from './world'

// 화면 위아래의 정보: 상태 표시줄(시간·배터리), 독(대시·기술·효과), 푸시 알림. 어느 시점에서나 같다.

// 상태 표시줄: 시계 = 남은 시간, 배터리 = 남은 시간 비율(60초부터 빨강), 가운데 = 지금 일어나는 일
export function statusBar(ctx, world, storming) {
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

export function dock(ctx, me) {
  if (!me) return
  const skill = skillOf(me.loadout)
  const dash = me.cd.dash
  dockSlot(ctx, 14, '대시', dash > 0 ? `${dash.toFixed(1)}초` : '짧은 무적', dash <= 0, dash / DASH.cooldown)
  const left = me.cd.skill
  dockSlot(ctx, 130, `Q ${skill.name}`, me.loadout.skill === 'unrecorded' ? '기록하면 생겨요' : left > 0 ? `${left.toFixed(1)}초` : '준비 완료', left <= 0 && me.loadout.skill !== 'unrecorded', left / skill.cooldown)
  const active = [
    me.airT > 0 && `${ITEMS.airplane.label} ${me.airT.toFixed(1)}`,
    me.dndT > 0 && `${ITEMS.dnd.label} ${me.dndT.toFixed(1)}`,
    me.shieldT > 0 && `실드 ${me.shieldT.toFixed(1)}`,
  ].filter(Boolean)
  dockSlot(ctx, 246, active[0] ?? '효과 없음', active[1] ?? (me.alive ? `체력 ${me.hp}/${me.maxHp}` : '아웃'), active.length > 0, 0)
}

// 위에서 내려오는 푸시 알림(쓰러뜨림·아이템)
export function feedCard(ctx, text, index, age) {
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
