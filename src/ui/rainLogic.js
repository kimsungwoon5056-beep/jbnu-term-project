import { seededRandom } from '../battle/pool'
import { APP_LOOK_KEYS } from '../character/appLook'

// 앱 비: 하늘에서 앱 아이콘이 떨어지는 장면의 계산(화면·물리 엔진 없이 돌아가는 순수 함수)

export const MAX_ICONS = 28 // 한 번에 쌓이는 아이콘 수
export const SPAWN_EVERY = 0.45 // 초
export const FLUSH_EVERY = 10 // 초: 이만큼 쌓이면 바닥이 열려 비운다.
export const FLUSH_OPEN = 1.7 // 바닥이 열려 있는 시간(열리고 닫히는 시간 포함)
export const FLUSH_WARN = 1.2 // 열리기 전에 불빛이 깜빡이는 시간
export const DOOR_MOVE = 0.3 // 문이 움직이는 시간
export const STEP = 1 / 60
export const MAX_STEPS = 3 // 한 화면에 계산하는 최대 횟수(탭을 오래 떠났다 와도 폭주하지 않게)
export const SIZES = [26, 30, 34, 40]
export const BADGES = [1, 2, 3, 5, 9, 12, 99]
export const BADGE_CHANCE = 0.4
export const GROUND_H = 24 // 바닥 두께(px)
export const THROW_MAX = 17 // 던지는 속도 한계(px/스텝)
export const DRAG_MAX = 24 // 끌 때 속도 한계(px/스텝)
export const TAP_DISTANCE = 6
export const TAP_MS = 250
export const LAND_GAP = 120 // onLand 간격(ms)
export const LAND_MIN = 4 // 이보다 느리게 닿으면 조용하다(px/스텝).
export const PARTICLE_MAX = 180

const pick = (list, rand) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// ── 떨어질 아이콘 정하기 ──────────────────────────────

export const createSpawner = (seed = 1) => ({ rand: seededRandom(seed), wait: 0.15, recent: [] })

// 아이콘 하나: 최근 네 개와 다른 앱, 크기, 배지 숫자(없으면 0)
export function nextIcon(spawner) {
  const { rand, recent } = spawner
  const kind = pick(
    APP_LOOK_KEYS.filter((key) => !recent.includes(key)),
    rand,
  )
  recent.push(kind)
  if (recent.length > 4) recent.shift()
  return { kind, size: pick(SIZES, rand), badge: rand() < BADGE_CHANCE ? pick(BADGES, rand) : 0 }
}

// 시간을 dt만큼 보내고, 떨어뜨릴 때가 되면 아이콘을 돌려준다(아니면 null).
export function stepSpawner(spawner, dt, { count, width, paused = false }) {
  if (paused || count >= MAX_ICONS) return null
  spawner.wait -= dt
  if (spawner.wait > 0) return null
  spawner.wait += SPAWN_EVERY
  const icon = nextIcon(spawner)
  const { rand } = spawner
  const edge = icon.size / 2 + 6
  return {
    ...icon,
    x: edge + rand() * Math.max(0, width - edge * 2),
    y: -icon.size,
    angle: (rand() - 0.5) * 1.2,
    spin: (rand() - 0.5) * 0.08,
    vx: (rand() - 0.5) * 1.6,
  }
}

// ── 바닥 열기 ──────────────────────────────

// 장면 시간(초) → 바닥 상태. open은 0(닫힘)~1(다 열림)
export function flushState(time) {
  const t = time % (FLUSH_EVERY + FLUSH_OPEN)
  const opened = t - FLUSH_EVERY
  if (opened < 0) return { open: 0, active: false, closing: false, warn: t >= FLUSH_EVERY - FLUSH_WARN }
  const left = FLUSH_OPEN - opened
  const open = clamp(Math.min(opened, left) / DOOR_MOVE, 0, 1)
  return { open, active: true, closing: left < DOOR_MOVE, warn: false }
}

// ── 시간 ──────────────────────────────

// 쌓인 시간을 고정 간격(1/60초) 몇 번으로 나눌지
export function fixedSteps(acc, dt) {
  const total = acc + Math.max(0, dt)
  const steps = Math.floor(total / STEP + 1e-6)
  if (steps > MAX_STEPS) return { steps: MAX_STEPS, acc: 0 }
  return { steps, acc: Math.max(0, total - steps * STEP) }
}

// ── 누르기·던지기 ──────────────────────────────

// 조금 움직이고 짧게 누르면 탭(지우기), 아니면 끌기
export const gestureOf = (moved, ms) => (moved < TAP_DISTANCE && ms < TAP_MS ? 'tap' : 'drag')

export function clampSpeed(vx, vy, max) {
  const speed = Math.hypot(vx, vy)
  if (!(speed > max)) return { x: vx || 0, y: vy || 0 }
  return { x: (vx / speed) * max, y: (vy / speed) * max }
}

// 손가락 자취([{x, y, t(ms)}]) → 놓을 때 속도(px/스텝). 멈췄다 놓으면 0
export function throwVelocity(trail, now) {
  const recent = trail.filter((point) => now - point.t <= 90)
  if (recent.length < 2) return { x: 0, y: 0 }
  const first = recent[0]
  const last = recent[recent.length - 1]
  const ms = Math.max(8, last.t - first.t)
  const k = (STEP * 1000) / ms
  return clampSpeed((last.x - first.x) * k, (last.y - first.y) * k, THROW_MAX)
}

// 점이 돌아간 아이콘 안에 있나(slop: 손가락 여유)
export function hitsIcon(icon, px, py, slop = 0) {
  const dx = px - icon.x
  const dy = py - icon.y
  const cos = Math.cos(icon.angle)
  const sin = Math.sin(icon.angle)
  const half = icon.size / 2 + slop
  return Math.abs(dx * cos + dy * sin) <= half && Math.abs(dy * cos - dx * sin) <= half
}

// 가장 위에 그려진(나중 것) 아이콘 고르기: 정확히 맞은 것 먼저, 없으면 여유 안에서 가까운 것
export function iconAt(icons, px, py, slop = 0) {
  for (let i = icons.length - 1; i >= 0; i -= 1) if (hitsIcon(icons[i], px, py)) return icons[i]
  let best = null
  let bestDistance = Infinity
  for (const icon of icons) {
    const distance = Math.hypot(px - icon.x, py - icon.y)
    if (distance < bestDistance && hitsIcon(icon, px, py, slop)) {
      best = icon
      bestDistance = distance
    }
  }
  return best
}

// 부딪힌 빠르기(px/스텝) → 소리 세기 0~1
export const landStrength = (speed) => clamp((speed - LAND_MIN) / 10, 0, 1)

// ── 문구 ──────────────────────────────

export function phrase(count) {
  if (count <= 0) return '앱을 눌러 지워 보세요'
  if (count >= 50) return `${count}개 삭제 · 알림이 포기하고 집에 갔어요`
  if (count >= 25) return `${count}개 삭제 · 이쯤이면 도를 닦는 중이에요`
  if (count >= 10) return `${count}개 삭제 · 폰이 숨을 쉬기 시작했어요`
  return `${count}개 삭제 · 조금 가벼워졌어요`
}

// ── 파편 ──────────────────────────────

// 사방으로 튀는 파편 값들
export function burst(x, y, colors, count, speed, rand) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + rand() * 0.5
    const v = speed * (0.45 + rand() * 0.75)
    const life = 0.45 + rand() * 0.35
    return { kind: 'bit', x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - speed * 0.45, gravity: 520, life, max: life, color: colors[i % colors.length], size: i % 3 === 0 ? 6 : 4 }
  })
}

// dt만큼 움직이고 아직 살아 있는지 돌려준다(Pool.sweep에 쓴다).
export function stepParticle(bit, dt) {
  bit.life -= dt
  bit.x += bit.vx * dt
  bit.y += bit.vy * dt
  bit.vy += bit.gravity * dt
  return bit.life > 0
}

// ── 캐릭터 ──────────────────────────────

// 같은 그림인지 값으로 비교할 짧은 표시(부모가 다시 그려도 장면을 새로 만들지 않게)
export function spriteSignature(sprite) {
  if (!sprite?.layers?.body?.length) return ''
  let hash = 2166136261
  const add = (value) => {
    const text = String(value)
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
    hash = Math.imul(hash ^ 44, 16777619)
  }
  for (const [x, y, color] of sprite.layers.body) {
    add(x * 100 + y)
    add(sprite.palette?.[color] ?? color)
  }
  return `${sprite.size}-${sprite.layers.body.length}-${(hash >>> 0).toString(36)}`
}

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]

// 도트 몸 → 부딪히는 상자 둘(머리·몸통, 그림 칸 단위). 배지처럼 삐져나온 조각은 중앙값으로 무시한다.
export function characterBoxes(cells) {
  const rows = new Map()
  let x0 = Infinity
  let x1 = -Infinity
  for (const [x, y] of cells) {
    const row = rows.get(y) ?? { min: x, max: x, count: 0 }
    row.min = Math.min(row.min, x)
    row.max = Math.max(row.max, x)
    row.count += 1
    rows.set(y, row)
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
  }
  const solid = [...rows.keys()].filter((y) => rows.get(y).count >= 6).sort((a, b) => a - b)
  const ys = solid.length > 0 ? solid : [...rows.keys()].sort((a, b) => a - b)
  const top = ys[0]
  const bottom = Math.max(...rows.keys()) + 1
  const neck = Math.round(top + (bottom - top) * 0.53)
  const box = (list, from, to) => {
    const left = median(list.map((y) => rows.get(y).min))
    const right = median(list.map((y) => rows.get(y).max)) + 1
    return { x: left, y: from, w: right - left, h: to - from }
  }
  const upper = ys.filter((y) => y < neck)
  const lower = ys.filter((y) => y >= neck)
  const head = box(upper.length > 0 ? upper : ys, top, neck)
  const torso = box(lower.length > 0 ? lower : ys, neck, bottom)
  return { head, torso, bounds: { x: x0, y: top, w: x1 + 1 - x0, h: bottom - top } }
}

// 정수 배율: 3배쯤, 낮은 화면·좁은 화면에서는 2배
export function characterScale(bounds, width, height) {
  const fit = Math.min((height * 0.62) / bounds.h, (width * 0.5) / bounds.w)
  return clamp(Math.floor(fit), 1, 4)
}

// ── 멈춘 더미(움직임 줄이기·물리 엔진을 못 불러왔을 때) ──────────────────────────────

export function pileIcons(count = 22, seed = 7) {
  const spawner = createSpawner(seed)
  return Array.from({ length: count }, () => nextIcon(spawner))
}

// 아이콘을 낮은 곳부터 쌓은 자리를 돌려준다. blocks: 피할 상자(캐릭터) [{x, y, w, h}]
export function stackPile(icons, width, ground, blocks = [], seed = 3) {
  const rand = seededRandom(seed)
  const placed = []
  return icons.map((icon) => {
    const half = icon.size / 2
    const gap = half + 1
    let best = null
    for (let x = gap; x <= Math.max(gap, width - gap); x += 4) {
      let floor = ground
      for (const other of placed) if (Math.abs(other.x - x) < other.size / 2 + half) floor = Math.min(floor, other.y - other.size / 2)
      for (const block of blocks) if (x + half > block.x && x - half < block.x + block.w) floor = Math.min(floor, block.y)
      const score = floor + rand() * 5
      if (!best || score > best.score) best = { x, floor, score }
    }
    const spot = { ...icon, x: best.x, y: best.floor - half, angle: 0 }
    placed.push(spot)
    return spot
  })
}
