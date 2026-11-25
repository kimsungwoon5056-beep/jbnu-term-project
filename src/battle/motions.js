// 캐릭터 모션: 신호(맞음·아웃·아이템 등)를 받아 플레이어마다 "지금 자세"를 시간으로 계산한다.
// 세계(위치·체력)는 건드리지 않고 그리기에만 쓴다. 자세는 순수 함수(poseOf)라 테스트할 수 있다.

export const LENGTH = { hit: 0.42, big: 0.65, pick: 0.35, shot: 0.12, down: 1.5 }
export const BIG_DAMAGE = 8 // 이만큼 이상이면 크게 맞은 것

const REST = Object.freeze({ sx: 1, sy: 1, rot: 0, dx: 0, dy: 0, lift: 0, alpha: 1, stars: 0, down: 0 })
const clamp01 = (value) => Math.min(1, Math.max(0, value))
// 0 → 1 → 0으로 튀었다가 잦아드는 흔들림
const wobble = (p, turns) => Math.sin(p * Math.PI * 2 * turns) * (1 - p) ** 2

// motion: { hit: { t, power, dir }, pick: { t }, shot: { t, aim }, down: { t, dir }, walk: 걸음 위상 }
// t는 시작한 뒤 흐른 초. 없는 항목은 쉬는 자세다.
export function poseOf(motion, { reduced = false } = {}) {
  if (!motion) return REST
  const pose = { ...REST }
  if (motion.down) {
    const p = clamp01(motion.down.t / LENGTH.down)
    pose.down = p
    if (reduced) {
      pose.alpha = 1 - p * 0.8
      return pose
    }
    // 빙글빙글 돌며 튀어 올랐다가 작아지며 떨어진다.
    const fly = clamp01(p / 0.6)
    pose.lift = Math.sin(fly * Math.PI) * 70
    pose.rot = fly * Math.PI * 4 * motion.down.dir
    pose.dx = fly * 26 * motion.down.dir
    pose.sx = 1 - fly * 0.45
    pose.sy = 1 - fly * 0.45
    pose.alpha = p < 0.55 ? 1 : 1 - clamp01((p - 0.55) / 0.1)
    return pose
  }
  if (reduced) return pose
  if (motion.walk) {
    pose.dy -= Math.abs(Math.sin(motion.walk)) * 2
    pose.rot += Math.sin(motion.walk) * 0.04
  }
  if (motion.hit) {
    const p = clamp01(motion.hit.t / (motion.hit.power > 1 ? LENGTH.big : LENGTH.hit))
    const power = motion.hit.power
    const w = wobble(p, 2)
    // 처음에 납작해졌다가(옆으로 넓게) 길쭉하게 튀어 오르고 잦아든다.
    const squash = p < 0.15 ? p / 0.15 : w
    pose.sx += (p < 0.15 ? 0.28 : 0.2) * squash * power
    pose.sy -= (p < 0.15 ? 0.3 : 0.22) * squash * power
    pose.rot += (1 - p) ** 2 * 0.35 * power * motion.hit.dir
    pose.dx += (1 - p) ** 3 * 5 * power * motion.hit.dir
    pose.stars = power > 1 ? 1 - p : 0
  }
  if (motion.pick) {
    const p = clamp01(motion.pick.t / LENGTH.pick)
    pose.sy += Math.sin(p * Math.PI) * 0.22
    pose.sx -= Math.sin(p * Math.PI) * 0.12
    pose.lift += Math.sin(p * Math.PI) * 8
  }
  if (motion.shot) {
    const p = 1 - clamp01(motion.shot.t / LENGTH.shot)
    pose.dx -= Math.cos(motion.shot.aim) * 3 * p
    pose.dy -= Math.sin(motion.shot.aim) * 3 * p
  }
  return pose
}

// 플레이어별 모션을 들고 있다가 시간을 흘린다.
export class Motions {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced
    this.map = new Map()
    this.last = new Map() // 지난 위치(걷는지 보려고)
    this.flip = 1
  }

  of(id) {
    if (!this.map.has(id)) this.map.set(id, {})
    return this.map.get(id)
  }

  // signal: world.signals의 신호. player: 그 일이 생긴 플레이어
  react(signal, player) {
    if (!signal.who || !player) return
    const motion = this.of(signal.who)
    if (signal.kind === 'hit' && !motion.down) {
      const amount = Math.abs(Number(signal.text)) || 0
      motion.hit = { t: 0, power: amount >= BIG_DAMAGE ? 1.6 : 0.9, dir: this.direction(signal.push) }
    }
    if (signal.kind === 'down') motion.down = { t: 0, dir: motion.hit?.dir ?? this.direction(signal.push) }
    if (signal.kind === 'item') motion.pick = { t: 0 }
    if (signal.kind === 'shot') motion.shot = { t: 0, aim: player.aim }
  }

  // 맞은 방향(왼쪽 -1, 오른쪽 1). 모르면 번갈아 쓴다.
  direction(push) {
    if (push && Math.abs(push.x) > 0.1) return Math.sign(push.x)
    this.flip = -this.flip
    return this.flip
  }

  step(dt, players) {
    for (const player of players) {
      const motion = this.of(player.id)
      for (const key of ['hit', 'pick', 'shot', 'down']) {
        if (!motion[key]) continue
        motion[key].t += dt
        const length = key === 'hit' ? (motion.hit.power > 1 ? LENGTH.big : LENGTH.hit) : LENGTH[key]
        if (key !== 'down' && motion[key].t >= length) motion[key] = null
      }
      const before = this.last.get(player.id)
      const moved = before ? Math.hypot(player.x - before.x, player.y - before.y) : 0
      this.last.set(player.id, { x: player.x, y: player.y })
      motion.walk = moved > 0.4 && player.alive ? (motion.walk ?? 0) + dt * 14 : 0
    }
  }

  pose(id) {
    return poseOf(this.map.get(id), { reduced: this.reduced })
  }

  poses() {
    return new Map([...this.map.keys()].map((id) => [id, this.pose(id)]))
  }
}
