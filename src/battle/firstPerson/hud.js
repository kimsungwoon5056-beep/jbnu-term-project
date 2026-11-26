import { DEFAULT_LOOK, LOOK_OPTIONS } from '../../profile/look'
import { skillKey } from '../loadout'
import { swingPhase, weaponOf } from '../melee'
import { paintWeapon } from '../weaponArt'
import { bubbleY, itemAlive } from '../schedule'
import { AREA } from '../world'
import { INK, ITEM_COLORS, MAP, MAP_SCALE, pixelBox } from './art'
import { angleDiff } from './raycast'

// 1인칭 화면 앞쪽에 겹쳐 그리는 것: 손에 든 무기, 조준점, 미니맵, 방향 화살표, 맞은 방향, 쓰러질 때 화면.
// 좌표는 AREA 왼쪽 위가 (0, 0)인 360×512.

const W = 360
const H = 512
const FONT = 'Galmuri11, sans-serif'
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback)

// ---------- 손에 든 무기(폰이 앱 무기로 변했다) ----------
// 휘두르는 내 Swing(frame.swing)의 모양과 단계로 손이 움직인다: 부채꼴은 화면을 가로지르고, 찌르기는 앞으로 쭉, 내려찍기는 위에서 아래로.
const CELL = 7 // 무기 도트 한 칸 크기
const REST = { rot: -0.3, dx: 0, dy: 0, s: 1 }
const lerp = (a, b, p) => ({ rot: a.rot + (b.rot - a.rot) * p, dx: a.dx + (b.dx - a.dx) * p, dy: a.dy + (b.dy - a.dy) * p, s: a.s + (b.s - a.s) * p })
const easeOut = (p) => 1 - (1 - p) ** 2
// 모양별 [준비 끝 자세, 타격 끝 자세]
function handKeys(move) {
  const dir = move.sweep === -1 ? -1 : 1
  if (move.shape === 'arc') return [{ rot: -1.25 * dir, dx: -150 * dir, dy: -30, s: 1 }, { rot: 1.1 * dir, dx: 70 * dir, dy: 10, s: 1 }]
  if (move.shape === 'slam') return [{ rot: 0.35, dx: -50, dy: -150, s: 1.1 }, { rot: -0.15, dx: -40, dy: 40, s: 1 }]
  if (move.shape === 'circle') return [{ rot: -0.8, dx: -60, dy: 0, s: 1 }, { rot: -0.8, dx: -60, dy: 0, s: 1 }]
  return [{ rot: -0.1, dx: -20, dy: 50, s: 1 }, { rot: -0.05, dx: -60, dy: -110, s: 0.75 }] // thrust·line
}

// 지금 손 자세와 잔상(smear). still이면 움직임을 줄인다.
export function handPose(swing, still = false) {
  if (!swing?.move) return { ...REST, smear: null }
  const { move } = swing
  const { phase, p } = swingPhase(swing)
  const [ready, done] = handKeys(move)
  let pose
  let smear = null
  if (phase === 'windup') pose = lerp(REST, ready, easeOut(p))
  else if (phase === 'active') {
    const q = move.shape === 'thrust' || move.shape === 'line' ? Math.min(1, p * 2) : p
    pose = lerp(ready, done, q)
    if (move.shape === 'circle') {
      pose.rot = -0.8 + p * Math.PI * 2
      pose.dx = Math.sin(p * Math.PI * 2) * 120
    }
    smear = { shape: move.shape, p, dir: move.sweep === -1 ? -1 : 1 }
  } else if (phase === 'recovery') pose = lerp(done, REST, easeOut(p))
  else pose = { ...REST }
  if (still) pose = lerp(REST, pose, 0.45)
  return { ...pose, smear }
}

function drawSmear(ctx, smear, color, still) {
  const { shape, p, dir } = smear
  ctx.save()
  if (shape === 'arc' || shape === 'circle') {
    // 칼날이 지나간 호
    const from = -Math.PI / 2 - 0.95 * dir
    const to = shape === 'circle' ? from + Math.PI * 2 * p * dir : from + 1.9 * p * dir
    const back = dir < 0
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = color
    ctx.lineWidth = still ? 14 : 28
    ctx.beginPath()
    ctx.arc(W / 2, H + 60, 250, from, to, back)
    ctx.stroke()
    ctx.globalAlpha = 0.95
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(W / 2, H + 60, 262, to - 0.3 * dir, to, back) // 칼날 앞쪽의 하얀 날
    ctx.stroke()
  } else if (shape === 'slam') {
    // 내려찍는 순간 바닥 충격
    if (p > 0.5) {
      const k = (p - 0.5) / 0.5
      ctx.globalAlpha = 1 - k
      ctx.strokeStyle = color
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.ellipse(W / 2 - 30, H - 70, 30 + k * 110, 10 + k * 34, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    // 찌르기: 가운데로 모이는 속도 선
    ctx.globalAlpha = 0.6 * (1 - p)
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 5; i += 1) {
      const x = W / 2 - 80 + i * 40
      ctx.fillRect(x, H * 0.45 + Math.abs(i - 2) * 18, 3, 40 + p * 40)
    }
  }
  ctx.restore()
}

// 주먹(무기를 쥔 손): 피부색 도트 덩어리
function drawFist(ctx, skin) {
  ctx.fillStyle = INK
  ctx.fillRect(-19, -14, 38, 32)
  ctx.fillStyle = skin.color
  ctx.fillRect(-16, -11, 32, 26)
  ctx.fillStyle = skin.shade
  for (let i = 0; i < 4; i += 1) ctx.fillRect(-14 + i * 8, -11, 2, 9)
  ctx.fillRect(-16, 9, 32, 6)
}

export function drawWeapon(ctx, view, me) {
  const { frame } = view
  const still = frame.reduced
  const swayX = still ? 0 : Math.sin(view.bob) * 9 * view.bobPower
  const swayY = still ? 0 : Math.abs(Math.cos(view.bob)) * 7 * view.bobPower + Math.sin(frame.now * 2.1) * 2
  const drop = frame.dead * 320
  const key = me?.loadout ? skillKey(me) : 'unrecorded'
  const pose = handPose(frame.swing, still)
  const gx = Math.round(W * 0.66 + swayX + pose.dx)
  const gy = Math.round(H - 34 + swayY + drop + pose.dy)
  if (gy - 160 > H) return
  if (pose.smear && frame.dead <= 0) drawSmear(ctx, pose.smear, weaponOf(key).color, still)
  const skin = LOOK_OPTIONS.skin.choices[me?.loadout?.look?.skin] ?? LOOK_OPTIONS.skin.choices[DEFAULT_LOOK.skin]
  ctx.save()
  ctx.translate(gx, gy)
  ctx.rotate(pose.rot + (still ? 0 : frame.roll * 0.5))
  ctx.scale(pose.s, pose.s)
  // 무기 그림은 손잡이가 위라서 반 바퀴 돌려 머리가 위로 오게 한다.
  ctx.rotate(Math.PI)
  paintWeapon(ctx, key, 0, -6, key === 'messenger' ? CELL + 1 : CELL)
  ctx.rotate(-Math.PI)
  drawFist(ctx, skin)
  ctx.restore()
  view.handDrawn = true
}

// ---------- 겹치는 막 ----------
export function drawOverlays(ctx, view, me) {
  const { frame, art } = view
  ctx.globalAlpha = 1
  ctx.drawImage(art.edge, 0, 0, W, H)
  if (frame.darkCircles) ctx.drawImage(art.dark, 0, 0, W, H)
  if (view.meOutside) {
    // 꺼진 화면 안: 붉은 잡음이 흐른다.
    const shift = frame.reduced ? 0 : Math.floor(frame.now * 14) * 34
    ctx.fillStyle = 'rgba(70,4,30,0.2)'
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.42
    for (let y = -(shift % 240); y < H; y += 240) for (let x = -((shift * 3) % 240); x < W; x += 240) ctx.drawImage(art.noise, x, y, 240, 240)
    ctx.globalAlpha = 1
  }
  const alive = me?.alive && num(me.maxHp) > 0
  if (alive && me.hp / me.maxHp < 0.25) {
    ctx.globalAlpha = frame.reduced ? 0.4 : 0.4 + 0.2 * Math.sin(frame.now * 5.5)
    ctx.drawImage(art.hurt, 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (frame.kick > 0) {
    ctx.globalAlpha = clamp(frame.kick * 0.55, 0, 1)
    ctx.drawImage(art.hurt, 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  if (me?.alive && (me.shieldT > 0 || me.airT > 0)) {
    // 내 실드: 화면 테두리의 하늘빛 도트
    ctx.fillStyle = me.airT > 0 ? '#9fc2ff' : '#7fe7ff'
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(frame.now * 8)
    for (let y = 0; y < H; y += 16) {
      const a = 4 + Math.round(3 * Math.sin(y * 0.11 + frame.now * 5))
      ctx.fillRect(0, y, a, 12)
      ctx.fillRect(W - a, y, a, 12)
    }
    for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 12, 4 + Math.round(3 * Math.sin(x * 0.11 + frame.now * 5)))
    ctx.globalAlpha = 1
  }
  if (me?.alive && me.focusT > 0) {
    ctx.fillStyle = '#ffd84a'
    for (let i = 0; i < 10; i += 1) {
      const t = (frame.now * 0.9 + i * 0.137) % 1
      ctx.globalAlpha = (1 - t) * 0.7
      ctx.fillRect(i % 2 ? 4 + ((i * 13) % 20) : W - 8 - ((i * 13) % 20), Math.round(H - t * H), 4, 10)
    }
    ctx.globalAlpha = 1
  }
  if (me?.alive && me.stunT > 0) {
    ctx.textAlign = 'center'
    ctx.font = `bold 22px ${FONT}`
    ctx.fillStyle = 'rgba(10,8,30,0.85)'
    ctx.fillText('멈칫!', W / 2 + 2, 170)
    ctx.fillStyle = '#ff5a7a'
    ctx.fillText('멈칫!', W / 2, 168)
  }
}

// ---------- HUD ----------
export function drawHud(ctx, view, world, me) {
  if (me?.alive) {
    if (view.armed) drawCrosshair(ctx, view)
    drawCompass(ctx, view, world, me)
    drawStormWarning(ctx, view, world)
  }
  drawHurtArc(ctx, view)
  drawMinimap(ctx, view, world, me)
}

const center = (view) => Math.round(view.horizon * 2)

function drawCrosshair(ctx, view) {
  const cx = W / 2
  const cy = center(view)
  const spread = Math.round(view.frame.shot * 8 + view.bobPower * 3)
  const color = view.aimed ? '#ff3b5c' : '#ffffff'
  const bar = (x, y, w, h) => {
    ctx.fillStyle = 'rgba(10,8,30,0.75)'
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  const gap = 6 + spread
  bar(cx - gap - 7, cy - 1, 7, 2)
  bar(cx + gap, cy - 1, 7, 2)
  bar(cx - 1, cy - gap - 7, 2, 7)
  bar(cx - 1, cy + gap, 2, 7)
  bar(cx - 1, cy - 1, 2, 2)
  if (!view.aimed) return
  // 조준되면 네 모서리가 조여든다.
  ctx.fillStyle = color
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.fillRect(cx + sx * 15 - (sx > 0 ? 6 : 0), cy + sy * 15 - 1, 6, 2)
    ctx.fillRect(cx + sx * 15 - 1, cy + sy * 15 - (sy > 0 ? 6 : 0), 2, 6)
  }
}

// 화면 밖에 있는 상대 쪽 가장자리 화살표. 뒤에 있을수록 아래에 뜬다.
function drawCompass(ctx, view, world) {
  const edge = 0.6 // 시야 절반(36°)보다 조금 안쪽
  for (const other of world.players) {
    if (!other.alive || other.id === view.meId || other.id === view.eyesOf) continue
    const dx = other.x - view.x
    const dy = other.y - view.y
    if (Math.hypot(dx, dy) < 1e-6) continue
    const rel = angleDiff(view.frame.angle, Math.atan2(dy, dx))
    if (Math.abs(rel) < edge) continue
    const right = rel > 0
    const back = clamp((Math.abs(rel) - edge) / (Math.PI - edge), 0, 1)
    const y = Math.round(center(view) + back * 108)
    const push = Math.round(Math.sin(view.frame.now * 6) * 2)
    arrow(ctx, right ? W - 8 + push : 8 - push, y, right ? 1 : -1, '#ff5a5f', back > 0.72 ? 14 : 11)
    ctx.font = `10px ${FONT}`
    ctx.textAlign = right ? 'right' : 'left'
    const tx = right ? W - 28 : 28
    ctx.fillStyle = 'rgba(10,8,30,0.85)'
    ctx.fillText(other.name ?? '', tx + 1, y + 5)
    ctx.fillStyle = '#ffd0d4'
    ctx.fillText(other.name ?? '', tx, y + 4)
  }
}

// 도트 세모. dir 1 = 오른쪽, -1 = 왼쪽(뾰족한 끝이 x)
function arrow(ctx, x, y, dir, color, size) {
  ctx.fillStyle = INK
  for (let i = -1; i <= size; i += 1) ctx.fillRect(dir > 0 ? x - i : x + i - 1, y - i - 2, 1, i * 2 + 4)
  ctx.fillStyle = color
  for (let i = 0; i < size; i += 1) ctx.fillRect(dir > 0 ? x - i : x + i - 1, y - i, 1, i * 2)
}

// 내가 선 줄에 알림 말풍선이 온다: 북쪽(위)에서 오는 방향을 알려 준다.
function drawStormWarning(ctx, view, world) {
  if (!world.events) return
  let danger = view.lanes.has(Math.floor((view.meX - AREA.x0) / view.laneW))
  for (const bubble of world.schedule.bubbles) {
    if (danger) break
    const y = bubbleY(bubble, world.time, AREA)
    if (y !== null && y < view.meY && Math.abs(bubble.x - view.meX) < 34) danger = true
  }
  if (!danger) return
  const rel = angleDiff(view.frame.angle, -Math.PI / 2)
  const blink = Math.sin(view.frame.now * 16) > -0.4
  if (!blink) return
  const side = Math.abs(rel) < 0.6 ? 0 : Math.sign(rel)
  pixelBox(ctx, W / 2 - 70, 78, 140, 24, INK, 6)
  pixelBox(ctx, W / 2 - 68, 80, 136, 20, '#ff3b5c', 5)
  ctx.font = `bold 12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(side === 0 ? '앞에서 알림! 피해!' : side > 0 ? '오른쪽에서 알림!' : '왼쪽에서 알림!', W / 2, 95)
  if (side !== 0) arrow(ctx, side > 0 ? W - 8 : 8, 90, side, '#ffd84a', 14)
}

// 맞은 방향: 조준점 둘레의 붉은 호(위 = 앞)
function drawHurtArc(ctx, view) {
  const { hurtFrom, hurtPower } = view.frame
  if (hurtFrom === null || hurtPower <= 0) return
  const a = hurtFrom - Math.PI / 2
  const cy = center(view)
  ctx.lineCap = 'butt'
  for (const [radius, width, color, span] of [[98, 14, 'rgba(60,0,16,0.6)', 0.46], [98, 10, '#ff2a4d', 0.42], [101, 3, '#ffb3bf', 0.3]]) {
    ctx.globalAlpha = hurtPower
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(W / 2, cy, radius, a - span, a + span)
    ctx.stroke()
  }
  // 바깥쪽 쐐기
  ctx.fillStyle = '#ff2a4d'
  for (let i = 0; i < 5; i += 1) {
    const r = 108 + i * 3
    const s = 10 - i * 2
    ctx.fillRect(Math.round(W / 2 + Math.cos(a) * r - s / 2), Math.round(cy + Math.sin(a) * r - s / 2), s, s)
  }
  ctx.globalAlpha = 1
}

// 미니맵: 작은 폰. 위 = 북쪽(상태 표시줄)
function drawMinimap(ctx, view, world, me) {
  const { frame, art } = view
  const ox = MAP.x + MAP.pad
  const oy = MAP.y + MAP.pad
  const mx = (x) => ox + clamp((x - AREA.x0) * MAP_SCALE, 0, MAP.w)
  const my = (y) => oy + clamp((y - AREA.y0) * MAP_SCALE, 0, MAP.h)
  ctx.globalAlpha = 0.92
  ctx.drawImage(art.minimap, MAP.x, MAP.y)
  ctx.globalAlpha = 1

  if (view.lanes.size > 0) {
    ctx.fillStyle = Math.sin(frame.now * 16) > 0 ? 'rgba(255,59,92,0.6)' : 'rgba(255,59,92,0.3)'
    for (const lane of view.lanes) ctx.fillRect(ox + lane * view.laneW * MAP_SCALE + 1, oy, view.laneW * MAP_SCALE - 2, MAP.h)
  }
  if (view.safe) {
    const { x0, y0, x1, y1 } = view.safe
    ctx.fillStyle = 'rgba(20,2,10,0.65)'
    ctx.fillRect(ox, oy, MAP.w, my(y0) - oy)
    ctx.fillRect(ox, my(y1), MAP.w, oy + MAP.h - my(y1))
    ctx.fillRect(ox, my(y0), mx(x0) - ox, my(y1) - my(y0))
    ctx.fillRect(mx(x1), my(y0), ox + MAP.w - mx(x1), my(y1) - my(y0))
    ctx.fillStyle = Math.sin(frame.now * 12) > 0 ? '#ff3b5c' : '#ffd84a'
    ctx.fillRect(mx(x0), my(y0), mx(x1) - mx(x0), 1)
    ctx.fillRect(mx(x0), my(y1) - 1, mx(x1) - mx(x0), 1)
    ctx.fillRect(mx(x0), my(y0), 1, my(y1) - my(y0))
    ctx.fillRect(mx(x1) - 1, my(y0), 1, my(y1) - my(y0))
  }
  if (world.events) {
    for (const item of world.items) {
      if (!itemAlive(item, world.time)) continue
      dot(ctx, mx(item.x), my(item.y), 5, ITEM_COLORS[item.kind] ?? '#ffffff', '#ffffff')
    }
    ctx.fillStyle = '#ffffff'
    for (const bubble of world.schedule.bubbles) {
      const y = bubbleY(bubble, world.time, AREA)
      if (y !== null) ctx.fillRect(Math.round(mx(bubble.x) - 4), Math.round(my(y) - 2), 9, 4)
    }
  }
  ctx.fillStyle = '#ff1f3d'
  for (const trap of world.traps) ctx.fillRect(Math.round(mx(trap.x) - 2), Math.round(my(trap.y) - 1), 4, 3)
  ctx.fillStyle = '#ffd84a'
  for (const shot of world.projectiles.active) ctx.fillRect(Math.round(mx(shot.x)) - 1, Math.round(my(shot.y)) - 1, 2, 2)

  // 시야 부채꼴(카메라 자리에서) + 나
  const px = mx(view.meX)
  const py = my(view.meY)
  const cx = mx(view.x)
  const cy = my(view.y)
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, MAP.w, MAP.h)
  ctx.clip()
  ctx.fillStyle = 'rgba(160,230,255,0.25)'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, 34, frame.angle - 0.628, frame.angle + 0.628)
  ctx.fill()
  ctx.restore()
  for (const other of world.players) {
    if (other.id === view.meId || other === me) continue
    dot(ctx, mx(other.x), my(other.y), 5, other.alive ? '#ff5a5f' : '#6a6f92', INK)
  }
  if (!me) return
  dot(ctx, px, py, 6, '#4cc96b', '#ffffff')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(Math.round(px + Math.cos(view.meAngle) * 6) - 1, Math.round(py + Math.sin(view.meAngle) * 6) - 1, 2, 2)
}

function dot(ctx, x, y, size, color, border) {
  const left = Math.round(x - size / 2)
  const top = Math.round(y - size / 2)
  ctx.fillStyle = border
  ctx.fillRect(left - 1, top - 1, size + 2, size + 2)
  ctx.fillStyle = color
  ctx.fillRect(left, top, size, size)
}

// ---------- 쓰러짐 ----------
// 카메라가 넘어진 뒤(0~0.72) 폰 전원이 꺼지듯 화면이 한 줄로 접히고, 점이 되어 사라진다.
export function drawDead(ctx, view) {
  const { dead, reduced } = view.frame
  ctx.globalAlpha = 0.45 * clamp(dead / 0.6, 0, 1)
  ctx.fillStyle = '#3a0418'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1
  const off = clamp((dead - 0.72) / 0.28, 0, 1)
  if (reduced) {
    // 움직임 줄이기: 천천히 어두워지기만 한다.
    ctx.globalAlpha = clamp((dead - 0.3) / 0.5, 0, 1)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  } else if (off > 0) {
    const cy = H / 2
    ctx.fillStyle = '#000000'
    if (off < 0.5) {
      // 위아래가 닫힌다.
      const open = Math.max(3, (H / 2) * (1 - off / 0.5) ** 2)
      ctx.fillRect(0, 0, W, cy - open)
      ctx.fillRect(0, cy + open, W, H)
      ctx.globalAlpha = 0.25 + off
      ctx.fillStyle = '#dff3ff'
      ctx.fillRect(0, cy - open, W, open * 2)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, cy - open, W, 2)
      ctx.fillRect(0, cy + open - 2, W, 2)
    } else {
      // 한 줄이 가운데 점으로 모인다.
      ctx.fillRect(0, 0, W, H)
      const k = clamp((off - 0.5) / 0.25, 0, 1)
      const half = Math.round((W / 2) * (1 - k) ** 2)
      if (off < 0.8) {
        ctx.fillStyle = 'rgba(127,231,255,0.4)'
        ctx.fillRect(W / 2 - half - 6, cy - 4, half * 2 + 12, 8)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(W / 2 - half - 2, cy - 1, half * 2 + 4, 3)
      }
    }
  }
  const show = clamp(((reduced ? dead : off) - 0.7) / 0.25, 0, 1)
  if (show <= 0) return
  ctx.globalAlpha = show
  ctx.fillStyle = '#ff5a7a'
  // 전원 표시
  for (let i = 0; i < 26; i += 1) {
    const a = -Math.PI / 2 + 0.55 + (i / 25) * (Math.PI * 2 - 1.1)
    ctx.fillRect(Math.round((W / 2 + Math.cos(a) * 22) / 2) * 2 - 2, Math.round((H / 2 - 52 + Math.sin(a) * 22) / 2) * 2 - 2, 4, 4)
  }
  ctx.fillRect(W / 2 - 2, H / 2 - 78, 4, 24)
  ctx.textAlign = 'center'
  ctx.font = `bold 22px ${FONT}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText('전원 꺼짐', W / 2, H / 2 + 8)
  ctx.globalAlpha = 1
}
