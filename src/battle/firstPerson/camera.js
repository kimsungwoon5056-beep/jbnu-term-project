import { AREA, OBSTACLES } from '../arena'
import { angleDiff, castRay, focalLength, relativeMove } from './raycast'

// 3D 화면의 다른 카메라(순수 계산, 세계를 읽기만 한다). 그리기는 FirstPersonView가 info.camera로 받아서 한다.
//   CallCamera: 영상통화. 가장 가까운 상대의 눈으로 나를 본다.
//   ChaseCamera: 추격. 내 뒤 위에서 내가 보는 쪽을 본다.
// update()가 돌려주는 값: { kind, x, y, angle, eye(눈높이), horizon(작은 화면에서 지평선 줄), hideId(그리지 않을 사람), targetId, weapon }

export const CALL = { back: 16, near: 58, turn: 8, frame: 0.35, eye: 36, horizon: 104 }
export const CHASE = { back: 72, min: 18, turn: 14, follow: 16, lag: 0.7, eye: 56, horizon: 92, nearEye: 58, nearHorizon: 72, head: 41, headRow: 168 }
const MARGIN = 5 // 벽에서 이만큼 떨어진다(가까운 벽이 화면을 뚫지 않게)
const FOCAL = focalLength((72 * Math.PI) / 180, 180) // FirstPersonView의 VIEW와 같은 화각·폭
const JUMP = 60 // 한 장면에 이보다 멀리 움직이면 순간 이동으로 본다

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback)
const ease = (rate, dt) => 1 - Math.exp(-rate * dt)
const step = (dt) => clamp(num(dt), 0, 0.1)

// 카메라가 갈 수 있는 곳: 벽을 MARGIN만큼 두껍게 본다.
const ROOM = { x0: AREA.x0 + MARGIN, y0: AREA.y0 + MARGIN, x1: AREA.x1 - MARGIN, y1: AREA.y1 - MARGIN }
const WALLS = OBSTACLES.map((b) => ({ x: b.x - MARGIN, y: b.y - MARGIN, w: b.w + MARGIN * 2, h: b.h + MARGIN * 2 }))
const ray = {}

// 벽 속이면 가장 가까운 밖으로 밀어낸 점(온라인에서 예측한 상대 위치가 벽에 걸칠 수 있다)
export function freePoint(x, y) {
  const spot = { x: clamp(num(x, (AREA.x0 + AREA.x1) / 2), ROOM.x0, ROOM.x1), y: clamp(num(y, (AREA.y0 + AREA.y1) / 2), ROOM.y0, ROOM.y1) }
  for (const b of WALLS) {
    const left = spot.x - b.x
    const right = b.x + b.w - spot.x
    const up = spot.y - b.y
    const down = b.y + b.h - spot.y
    const out = Math.min(left, right, up, down)
    if (out <= 0) continue
    const push = 0.001
    if (out === left) spot.x = b.x - push
    else if (out === right) spot.x = b.x + b.w + push
    else if (out === up) spot.y = b.y - push
    else spot.y = b.y + b.h + push
  }
  return spot
}

// from에서 angle 쪽으로 want만큼 갈 수 있는 거리
const roomAt = (from, angle, want) => clamp(castRay(from.x, from.y, angle, WALLS, ROOM, ray).dist - 0.01, 0, want)

const reach = (from, angle, dist) => ({ x: clamp(from.x + Math.cos(angle) * dist, ROOM.x0, ROOM.x1), y: clamp(from.y + Math.sin(angle) * dist, ROOM.y0, ROOM.y1) })

// a에서 b 쪽 각도. 겹쳐 있으면 fallback
function bearing(a, b, fallback) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy) < 1e-3 ? fallback : Math.atan2(dy, dx)
}

// 가장 가까운 살아 있는 상대
function nearestOpponent(world, me) {
  let best = null
  let bestDist = Infinity
  for (const player of world?.players ?? []) {
    if (!player.alive || player.id === me.id) continue
    const dist = Math.hypot(num(player.x) - num(me.x), num(player.y) - num(me.y))
    if (dist < bestDist) {
      best = player
      bestDist = dist
    }
  }
  return best
}

// ---------- 영상통화 ----------
// 상대 뒤로 물러설 방향 후보: 곧장 뒤가 막혔거나 내가 너무 가까우면 옆으로 비켜선다.
const SWINGS = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]

export class CallCamera {
  constructor() {
    this.reset()
  }

  // 모드가 시작될 때 부른다. 다음 update는 부드럽게 돌지 않고 바로 나를 본다.
  reset() {
    this.targetId = null
    this.angle = null
    this.back = 0 // 상대에게서 카메라 쪽 방향
    this.dist = 0 // 상대에게서 물러선 거리
  }

  // 살아 있는 상대가 없으면 null(위에서 보는 화면으로 돌아간다).
  update(world, me, dt) {
    if (!me) return null
    let target = this.targetId === null ? null : (world?.players ?? []).find((player) => player.id === this.targetId && player.alive && player.id !== me.id)
    if (!target) {
      target = nearestOpponent(world, me)
      if (!target) {
        this.reset()
        return null
      }
    }
    const fresh = target.id !== this.targetId || this.angle === null
    this.targetId = target.id
    const t = step(dt)
    const from = freePoint(target.x, target.y)
    const seen = { x: num(me.x, from.x), y: num(me.y, from.y) }

    // 내가 있는 쪽의 반대로 물러선다. 바싹 붙어 있으면 내 몸이 화면을 다 가리지 않게 더 물러선다.
    const gap = Math.hypot(seen.x - from.x, seen.y - from.y)
    const straight = bearing(seen, from, fresh ? num(target.aim) + Math.PI : this.back)
    const want = Math.max(CALL.back, CALL.near - gap)
    let best = straight
    let bestScore = -Infinity
    for (const swing of SWINGS) {
      const angle = straight + swing
      const room = roomAt(from, angle, want)
      const spot = reach(from, angle, room)
      const far = Math.min(CALL.near, Math.hypot(spot.x - seen.x, spot.y - seen.y))
      // 지금 쓰는 방향을 조금 더 좋아한다(두 방향을 오가며 떨지 않게).
      const score = far + room * 0.2 - Math.abs(swing) * 4 - (fresh ? 0 : Math.abs(angleDiff(this.back, angle)) * 3)
      if (score > bestScore) {
        best = angle
        bestScore = score
      }
    }
    this.back = fresh ? best : this.back + angleDiff(this.back, best) * ease(6, t)
    const room = roomAt(from, this.back, want)
    this.dist = fresh ? room : Math.min(room, this.dist + (room - this.dist) * ease(6, t))
    const spot = reach(from, this.back, this.dist)

    const aim = bearing(spot, seen, this.angle ?? this.back + Math.PI)
    if (fresh) this.angle = aim
    else {
      // 부드럽게 따라 돌되, 내가 화면 밖으로 나가지는 않게 한다.
      const left = angleDiff(this.angle, aim)
      const after = clamp(left * (1 - ease(CALL.turn, t)), -CALL.frame, CALL.frame)
      this.angle = aim - after
    }
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle))
    return { kind: 'call', x: spot.x, y: spot.y, angle: this.angle, eye: CALL.eye, horizon: CALL.horizon, hideId: target.id, targetId: target.id, weapon: false }
  }
}

// 영상통화에서의 조작. 상대가 보는 화면을 기준으로: 위 = 화면 안쪽으로 멀어지기(camera.angle), 오른쪽 = 화면 오른쪽.
// 조준은 늘 통화하는 상대 쪽이다. camera: CallCamera가 돌려준 값(또는 CallCamera). 없으면 위에서 볼 때처럼 움직인다.
export function callCommands(camera, world, me, { forward = 0, strafe = 0 } = {}) {
  const angle = Number.isFinite(camera?.angle) ? camera.angle : -Math.PI / 2
  const { x, y } = relativeMove(forward, strafe, angle)
  const target = camera ? world.players.find((player) => player.id === camera.targetId) : null
  const a = target?.alive ? bearing(me, target, num(me.aim)) : num(me.aim)
  return [
    { type: 'move', x, y },
    { type: 'aim', a: num(a, num(me.aim)) },
  ]
}

// ---------- 추격 ----------
export class ChaseCamera {
  constructor() {
    this.reset()
  }

  // 모드가 시작될 때 부른다. 다음 update는 부드럽게 따라가지 않고 바로 자리를 잡는다.
  reset() {
    this.angle = null
    this.dist = CHASE.back
    this.lagX = 0
    this.lagY = 0
    this.lastX = 0
    this.lastY = 0
    this.low = 0 // 벽에 막혀 당겨진 정도(0~1)
  }

  update(world, me, dt) {
    if (!me) return null
    const t = step(dt)
    const from = freePoint(me.x, me.y)
    const aim = num(me.aim)
    const fresh = this.angle === null
    const moved = fresh ? 0 : Math.hypot(from.x - this.lastX, from.y - this.lastY)

    // 각도: 부드럽게 돌되 너무 뒤처지지 않게
    if (fresh || moved > JUMP) this.angle = aim
    else {
      const left = angleDiff(this.angle, aim)
      this.angle = aim - clamp(left * (1 - ease(CHASE.turn, t)), -CHASE.lag, CHASE.lag)
    }
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle))

    // 자리: 내 움직임을 조금 늦게 따라간다(대시할 때 살짝 멀어진다).
    if (fresh || moved > JUMP) {
      this.lagX = 0
      this.lagY = 0
    } else {
      const keep = 1 - ease(CHASE.follow, t)
      this.lagX = clamp((this.lagX + this.lastX - from.x) * keep, -22, 22)
      this.lagY = clamp((this.lagY + this.lastY - from.y) * keep, -22, 22)
    }
    this.lastX = from.x
    this.lastY = from.y

    // 나에게서 카메라 쪽으로 광선을 쏘아 벽 앞까지만 물러선다. 당길 때는 바로, 물러날 때는 천천히.
    const wantX = -Math.cos(this.angle) * CHASE.back + this.lagX
    const wantY = -Math.sin(this.angle) * CHASE.back + this.lagY
    const back = Math.atan2(wantY, wantX)
    const want = clamp(Math.hypot(wantX, wantY), CHASE.min, CHASE.back * 1.4)
    const room = roomAt(from, back, want)
    // CHASE.min보다 가까운 벽이면 벽이 먼저다(벽을 뚫지 않는다).
    this.dist = fresh || moved > JUMP ? room : Math.min(room, Math.max(Math.min(room, CHASE.min), this.dist + (want - this.dist) * ease(5, t)))
    const spot = reach(from, back, this.dist)

    // 당겨지면 눈을 높이고 더 내려다본다(내 머리 너머로 앞이 보이게). 아주 가까우면 머리 끝이 화면 아래에 남을 만큼만 높인다.
    this.low = clamp((CHASE.back - this.dist) / (CHASE.back - CHASE.min), 0, 1)
    const horizon = CHASE.horizon + (CHASE.nearHorizon - CHASE.horizon) * this.low * this.low
    const high = CHASE.eye + (CHASE.nearEye - CHASE.eye) * this.low
    const eye = Math.min(high, CHASE.head + ((CHASE.headRow - horizon) * this.dist) / FOCAL)
    return { kind: 'chase', x: spot.x, y: spot.y, angle: this.angle, eye, horizon, hideId: null, targetId: null, weapon: false }
  }
}

// 셀카: 앞에 든 카메라가 나를 마주 본다. 추격 카메라를 내가 보는 쪽의 반대로 돌려 쓴다(카메라는 내 앞, 보는 쪽은 나와 내 등 뒤).
export class SelfieCamera extends ChaseCamera {
  update(world, me, dt) {
    if (!me) return null
    const view = super.update(world, { ...me, aim: num(me.aim) + Math.PI }, dt)
    return view && { ...view, kind: 'selfie' }
  }
}
