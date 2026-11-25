// 1인칭 화면 계산(순수 함수). 화면·DOM을 모르므로 그대로 테스트한다.
// 좌표 약속: 세계는 x가 오른쪽, y가 아래쪽이다(경기장을 위에서 본 그대로). 각도 0은 +x, 커질수록 화면에서 시계 방향.
// 그래서 앞 = (cos, sin), 오른쪽 = (-sin, cos)다. 모든 함수가 이 약속을 쓴다.

const TAU = Math.PI * 2
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback)

export const NEAR = 1 // 이보다 가까우면 그리지 않는다(카메라와 겹친 것)

// ---------- 각도 ----------
// a에서 b로 가려면 얼마나 돌아야 하나(−π 초과 π 이하, 양수 = 오른쪽으로)
export function angleDiff(a, b) {
  const d = finite(b) - finite(a)
  const turn = d - TAU * Math.floor((d + Math.PI) / TAU)
  return turn <= -Math.PI ? Math.PI : turn
}

// angle에서 target 쪽으로 가까운 방향으로 최대 maxDelta만큼 돈 각도
export function turnToward(angle, target, maxDelta) {
  const turn = angleDiff(angle, target)
  const max = Math.abs(finite(maxDelta))
  return finite(angle) + clamp(turn, -max, max)
}

// ---------- 움직임 ----------
// forward: 앞(+)·뒤(−), strafe: 오른쪽(+)·왼쪽(−) → 세계 방향. 길이는 1을 넘지 않는다.
export function relativeMove(forward, strafe, angle) {
  const f = finite(forward)
  const s = finite(strafe)
  const a = finite(angle)
  const x = Math.cos(a) * f - Math.sin(a) * s
  const y = Math.sin(a) * f + Math.cos(a) * s
  const length = Math.hypot(x, y)
  return length > 1 ? { x: x / length, y: y / length } : { x, y }
}

// 가장 가까운 살아 있는 상대 쪽 각도. 상대가 없거나 완전히 겹쳐 있으면 지금 조준(me.aim)
export function fitAngleToNearest(world, me) {
  let best = null
  let bestDist = Infinity
  if (!me) return 0
  for (const player of world?.players ?? []) {
    if (!player.alive || player.id === me.id) continue
    const dist = Math.hypot(player.x - me.x, player.y - me.y)
    if (dist < bestDist) {
      best = player
      bestDist = dist
    }
  }
  if (!best || bestDist < 1e-6) return finite(me.aim)
  return Math.atan2(best.y - me.y, best.x - me.x)
}

// 맞은 방향: 보는 쪽 기준 각도(0 = 앞, 양수 = 오른쪽, ±π = 뒤). 같은 자리이거나 값이 이상하면 null
export function hitDirection(meAngle, fromX, fromY, me) {
  if (!me) return null
  const dx = fromX - me.x
  const dy = fromY - me.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 1e-6) return null
  return angleDiff(meAngle, Math.atan2(dy, dx))
}

// ---------- 광선 ----------
// 상자와 바깥벽에 닿는 곳을 식으로 바로 구한다(한 칸씩 나아가지 않는다).
// boxes: [{ x, y, w, h }], area: { x0, y0, x1, y1 }
// 결과: dist(거리, 광선을 따라), box(바깥벽이면 null), side(면의 법선이 x축인지 y축인지), face(n·s·e·w),
//       u(면을 바라볼 때 왼쪽 0 → 오른쪽 1), hitX·hitY
// 상자 안에서 쏜 광선은 그 상자를 무시한다. out을 주면 새 객체를 만들지 않고 거기에 쓴다.
// face는 상자의 어느 쪽 면인지(위쪽 = n), 바깥벽은 경기장의 어느 벽인지를 뜻한다.
export function castRay(x, y, angle, boxes, area, out = {}) {
  const a = finite(angle)
  const ox = clamp(finite(x, area.x0), area.x0, area.x1)
  const oy = clamp(finite(y, area.y0), area.y0, area.y1)
  const dx = Math.cos(a)
  const dy = Math.sin(a)

  // 바깥벽: 안에서 나가는 거리
  const tx = dx > 0 ? (area.x1 - ox) / dx : dx < 0 ? (area.x0 - ox) / dx : Infinity
  const ty = dy > 0 ? (area.y1 - oy) / dy : dy < 0 ? (area.y0 - oy) / dy : Infinity
  let dist = Math.min(tx, ty)
  let side = tx <= ty ? 'x' : 'y'
  let box = null

  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]
    let near = -Infinity
    let far = Infinity
    let nearSide = 'x'
    if (dx === 0) {
      if (ox <= b.x || ox >= b.x + b.w) continue
    } else {
      const t1 = (b.x - ox) / dx
      const t2 = (b.x + b.w - ox) / dx
      near = Math.min(t1, t2)
      far = Math.max(t1, t2)
    }
    if (dy === 0) {
      if (oy <= b.y || oy >= b.y + b.h) continue
    } else {
      const t1 = (b.y - oy) / dy
      const t2 = (b.y + b.h - oy) / dy
      const enter = Math.min(t1, t2)
      if (enter > near) {
        near = enter
        nearSide = 'y'
      }
      far = Math.min(far, Math.max(t1, t2))
    }
    // near < 0: 상자 안이거나 등 뒤. near === 0: 면에 딱 붙어 안쪽을 본다.
    if (near < 0 || far <= near || near >= dist) continue
    dist = near
    side = nearSide
    box = b
  }

  const hitX = ox + dx * dist
  const hitY = oy + dy * dist
  let face
  let u
  if (box) {
    if (side === 'x') {
      face = dx > 0 ? 'w' : 'e'
      u = (hitY - box.y) / box.h
    } else {
      face = dy > 0 ? 'n' : 's'
      u = (hitX - box.x) / box.w
    }
  } else if (side === 'x') {
    face = dx > 0 ? 'e' : 'w'
    u = (hitY - area.y0) / (area.y1 - area.y0)
  } else {
    face = dy > 0 ? 's' : 'n'
    u = (hitX - area.x0) / (area.x1 - area.x0)
  }
  // 로고·글자가 뒤집히지 않게: 바라보는 사람의 왼쪽이 늘 0이 되게 한다.
  if (side === 'x' ? dx < 0 : dy > 0) u = 1 - u

  out.dist = dist
  out.box = box
  out.side = side
  out.face = face
  out.u = clamp(u, 0, 1)
  out.hitX = hitX
  out.hitY = hitY
  return out
}

// ---------- 투영 ----------
export const focalLength = (fov, viewW) => viewW / 2 / Math.tan(fov / 2)

// 점을 화면에 놓는다. depth는 화면 평면까지의 수직 거리라 어안처럼 휘지 않는다.
// screenX(가로 px), scale(세계 1칸이 몇 px인지). 뒤에 있거나 카메라와 겹치면 null. out을 주면 거기에 쓴다.
export function project(me, angle, fov, viewW, point, out = {}) {
  const a = finite(angle)
  const dx = point.x - me.x
  const dy = point.y - me.y
  const depth = dx * Math.cos(a) + dy * Math.sin(a)
  if (!(depth >= NEAR)) return null
  const focal = focalLength(fov, viewW)
  out.depth = depth
  out.scale = focal / depth
  out.screenX = viewW / 2 + (-dx * Math.sin(a) + dy * Math.cos(a)) * out.scale
  return out
}

// ---------- 그리는 순서·가림 ----------
const byDepth = (a, b) => b.depth - a.depth

// 먼 것부터 그리게 그 자리에서 줄 세운다.
export const sortSprites = (sprites) => sprites.sort(byDepth)

// 화면 x칸에서 depth에 있는 것이 벽에 가리지 않는지
export function columnVisible(zbuffer, x, depth) {
  const column = Math.floor(x)
  return column >= 0 && column < zbuffer.length && depth < zbuffer[column]
}

// 사이에 상자가 없이 보이는지
const lineRay = {}
export function lineOfSight(from, to, boxes, area) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  if (!(dist > 1e-6)) return Number.isFinite(dist)
  return castRay(from.x, from.y, Math.atan2(to.y - from.y, to.x - from.x), boxes, area, lineRay).dist >= dist - 1e-6
}
