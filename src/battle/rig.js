import { loadoutSprite } from './loadout'

// 관절 인형: 도트 캐릭터를 머리·몸통·팔 둘·다리 둘로 나누어, 관절을 돌려 걷고 쏘고 맞는 모습을 그린다.
// 그림은 그대로(앱 조각·머리·옷) 쓰고, 나누기(splitLimbs)와 자세(rigPose)는 순수 함수다.

const SIZE = 48
const HEAD_PARTS = new Set(['hair', 'face', 'eyes', 'undereye', 'badge'])
export const LIMBS = ['legL', 'legR', 'torso', 'armL', 'head', 'armR'] // 그리는 차례
export const PIVOT = { head: [24, 27], torso: [24, 38], armL: [14.5, 29.5], armR: [33.5, 29.5], legL: [20.5, 38.5], legR: [27.5, 38.5] }

function limbOf(x, y, part) {
  if (part === 'hand') return 'armR'
  if (HEAD_PARTS.has(part) || y <= 27) return 'head'
  if (y >= 39) return x < 24 ? 'legL' : 'legR'
  if (y <= 37 && x <= 15) return 'armL'
  if (y <= 37 && x >= 32) return 'armR'
  return 'torso'
}

// sprite.layers.body → { 부위: [[x, y, 색]…] }. 외곽선 칸은 이웃한 부위 모두에 넣어 떨어져도 테두리가 남게 한다.
export function splitLimbs(sprite) {
  const { body, parts } = sprite.layers
  const partAt = new Map()
  for (const [key, cells] of Object.entries(parts ?? {})) for (const [x, y] of cells) partAt.set(y * SIZE + x, key)
  const limbAt = new Map()
  const limbs = Object.fromEntries(LIMBS.map((limb) => [limb, []]))
  for (const [x, y, color] of body) {
    if (color === 'outline') continue
    const limb = limbOf(x, y, partAt.get(y * SIZE + x))
    limbAt.set(y * SIZE + x, limb)
    limbs[limb].push([x, y, color])
  }
  for (const [x, y, color] of body) {
    if (color !== 'outline') continue
    const near = new Set()
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const limb = limbAt.get((y + dy) * SIZE + x + dx)
      if (limb) near.add(limb)
    }
    for (const limb of near.size > 0 ? near : [limbOf(x, y)]) limbs[limb].push([x, y, color])
  }
  return limbs
}

const still = () => ({ x: 0, y: 0, r: 0 })
const clamp01 = (value) => Math.min(1, Math.max(0, value))
const mix = (a, b, p) => a + (b - a) * p

// 폰 든 팔이 쉬고 있을 때 가리키는 방향: 내리고 있으면 아래, 폰을 얼굴 옆에 들고 있으면(raised) 위
const REST_DOWN = Math.PI / 2
const REST_UP = -1.25

// 지금 자세. m: motions.js의 모션, info: { time, stun, dash, aim, seed, raised, reduced }
// 왼쪽을 보고 있으면(flip) 그릴 때 좌우를 뒤집으므로, 여기서는 늘 오른쪽을 본다고 보고 방향 값만 맞춘다.
export function rigPose(m = {}, { time = 0, stun = false, dash = false, aim = 0, seed = 0, raised = false, reduced = false } = {}) {
  const rest = raised ? REST_UP : REST_DOWN
  const loose = raised ? 0.35 : 1 // 폰을 든 팔은 덜 흔들린다
  const pose = { head: still(), torso: still(), armL: still(), armR: still(), legL: still(), legR: still(), flip: (m.turn ?? 1) < 0, turn: 1, face: 'normal' }
  if (reduced) {
    if (m.hit) pose.face = 'hurt'
    return pose
  }
  const sign = pose.flip ? -1 : 1
  // 돌아설 때 종이처럼 홀쭉해졌다가 펴진다.
  pose.turn = m.turn === undefined ? 1 : mix(0.25, 1, clamp01(Math.abs(m.turn)))

  // 숨쉬기
  const breath = Math.sin(time * 3 + seed)
  pose.head.y += breath * 0.6
  pose.armL.r += breath * 0.07
  pose.armR.r -= breath * 0.07

  // 걷기: 간 거리로 발이 나가므로 미끄러지지 않는다.
  const run = m.run ?? 0
  if (run > 0.01) {
    const swing = Math.sin(m.phase ?? 0)
    const step = Math.cos(m.phase ?? 0)
    pose.legL.r += swing * 0.8 * run
    pose.legR.r -= swing * 0.8 * run
    pose.legL.y -= Math.max(0, step) * 2.5 * run
    pose.legR.y -= Math.max(0, -step) * 2.5 * run
    pose.armL.r -= swing * 0.9 * run
    pose.armR.r += swing * 0.7 * run * loose
    const bob = -Math.abs(step) * 1.6 * run
    pose.torso.y += bob
    pose.torso.r += (m.lean ?? 0) * sign * 0.16 * run
    pose.head.r -= (m.lean ?? 0) * sign * 0.08 * run
    pose.head.y += Math.abs(swing) * 0.8 * run
  }

  if (dash) {
    pose.torso.r += 0.42
    pose.head.r -= 0.2
    pose.legL.r += 1
    pose.legR.r += 0.5
    pose.armL.r += 1.3
    pose.armR.r += raised ? 0.5 : 1.1
  }

  // 쏘기: 폰 든 팔을 조준한 쪽으로 뻗었다가 반동으로 튀고 내려온다.
  if (m.shot) {
    const hold = m.shot.t < 0.22 ? 1 : 1 - clamp01((m.shot.t - 0.22) / 0.16)
    const local = pose.flip ? Math.PI - aim : aim
    const angle = Math.atan2(Math.sin(local - rest), Math.cos(local - rest))
    const kick = 1 - clamp01(m.shot.t / 0.12)
    pose.armR.r = mix(pose.armR.r, angle - kick * 0.35, hold)
    pose.armR.x -= kick * 2.5
    pose.torso.r -= kick * 0.1
    pose.head.r -= kick * 0.08
    pose.torso.x -= kick
  }

  // 기술: 움츠렸다가 두 팔을 번쩍 든다.
  if (m.cast) {
    const p = clamp01(m.cast.t / CAST)
    const crouch = p < 0.25 ? Math.sin((p / 0.25) * Math.PI) : 0
    const up = p < 0.25 ? 0 : Math.sin(clamp01((p - 0.25) / 0.75) * Math.PI)
    pose.torso.y += crouch * 3 - up * 1.5
    pose.armL.r += up * 2.6
    pose.armR.r -= raised ? -up * 0.3 : up * 2.6
    pose.legL.r += up * 0.35
    pose.legR.r -= up * 0.35
    pose.head.r -= up * 0.15
  }

  // 줍기: 한 손을 번쩍
  if (m.pick) {
    const up = Math.sin(clamp01(m.pick.t / 0.35) * Math.PI)
    pose.armL.r += up * 2.6
    pose.torso.y -= up
  }

  // 멈칫(스턴): 머리가 빙글, 팔은 축 늘어진다.
  if (stun) {
    pose.head.x += Math.sin(time * 9) * 2
    pose.head.r += Math.cos(time * 9) * 0.18
    pose.armL.r += 0.25
    pose.armR.r += raised ? 1.9 : -0.25
    pose.face = 'dizzy'
  }

  // 맞기: 머리가 젖혀지고 팔다리가 벌어진다.
  if (m.hit) {
    const length = m.hit.power > 1 ? 0.65 : 0.42
    const p = clamp01(m.hit.t / length)
    const snap = (1 - p) ** 2 * m.hit.power
    const wobble = Math.sin(p * Math.PI * 5) * (1 - p)
    const dir = m.hit.dir * sign
    pose.head.x += dir * 2 * snap
    pose.head.r += dir * (0.28 * snap + 0.18 * wobble)
    pose.torso.r += dir * 0.14 * snap
    pose.armL.r += 1.2 * snap + wobble * 0.4
    pose.armR.r += raised ? 0.7 * snap : wobble * 0.4 - 1.2 * snap
    pose.legL.r += 0.45 * snap
    pose.legR.r -= 0.45 * snap
    if (p < 0.75) pose.face = 'hurt'
  }

  // 쓰러지기: 팔다리가 제멋대로 흔들린다.
  if (m.down) {
    const k = Math.max(0, 1 - m.down.t / 1.4)
    const t = m.down.t * 22
    pose.armL.r += Math.sin(t) * 1.4 * k
    pose.armR.r += Math.sin(t + 2) * 1.4 * k
    pose.legL.r += Math.sin(t + 1) * 1.1 * k
    pose.legR.r += Math.sin(t + 4) * 1.1 * k
    pose.head.r += Math.sin(t * 0.7) * 0.4 * k
    pose.face = 'hurt'
  }
  // 머리와 팔은 몸통을 따라가고, 다리는 몸통이 들리면 조금 따라 들린다.
  if (pose.torso.y < 0) {
    pose.legL.y += pose.torso.y * 0.6
    pose.legR.y += pose.torso.y * 0.6
  }
  for (const limb of ['head', 'armL', 'armR']) {
    pose[limb].y += pose.torso.y
    pose[limb].x += pose.torso.x + Math.sin(pose.torso.r) * 8
  }
  return pose
}

export const CAST = 0.5 // 기술 자세 길이(초)

const makeCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  return canvas
}

// 캐릭터 하나의 인형. draw(pose)를 부르면 canvas(48×48)에 지금 모습이 그려진다.
export class Rig {
  constructor(loadout) {
    const sprite = loadoutSprite(loadout)
    this.eyeY = 18 + (loadout.marks?.slouch ? 3 : 0)
    this.skin = sprite.palette.skin
    this.raised = Boolean(loadout.marks?.raisePhone && loadout.grafts?.some((graft) => graft.slot === 'hand'))
    this.canvas = makeCanvas()
    this.ctx = this.canvas.getContext('2d')
    this.images = {}
    for (const [limb, cells] of Object.entries(splitLimbs(sprite))) {
      const image = makeCanvas()
      const ctx = image.getContext('2d')
      for (const [x, y, color] of cells) {
        ctx.fillStyle = sprite.palette[color] ?? color
        ctx.fillRect(x, y, 1, 1)
      }
      this.images[limb] = image
    }
  }

  draw(pose, { white = false } = {}) {
    const { ctx } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.imageSmoothingEnabled = false
    // 뒤집기·돌아서기는 몸 가운데를 축으로
    ctx.translate(SIZE / 2, 0)
    ctx.scale((pose.flip ? -1 : 1) * pose.turn, 1)
    ctx.translate(-SIZE / 2, 0)
    for (const limb of LIMBS) {
      const { x, y, r } = pose[limb]
      const [px, py] = PIVOT[limb]
      ctx.save()
      ctx.translate(Math.round(px + x), Math.round(py + y))
      ctx.rotate(r)
      ctx.translate(-px, -py)
      ctx.drawImage(this.images[limb], 0, 0)
      if (limb === 'head' && pose.face !== 'normal') this.drawFace(pose.face)
      ctx.restore()
    }
    if (white) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, SIZE, SIZE)
    }
    return this.canvas
  }

  // 아픈 눈(> <)과 어질한 눈(@ @)
  drawFace(face) {
    const { ctx, eyeY } = this
    for (const [ex, side] of [
      [17, 1],
      [27, -1],
    ]) {
      ctx.fillStyle = this.skin
      ctx.fillRect(ex, eyeY - 1, 4, 5)
      ctx.fillStyle = '#231f3d'
      if (face === 'hurt') {
        const points = [
          [0, 0],
          [1, 1],
          [2, 1.5],
          [1, 2],
          [0, 3],
        ]
        for (const [x, y] of points) ctx.fillRect(side > 0 ? ex + x : ex + 3 - x, eyeY + Math.round(y) - 0, 1, 1)
      } else {
        ctx.fillRect(ex, eyeY, 4, 1)
        ctx.fillRect(ex, eyeY, 1, 3)
        ctx.fillRect(ex, eyeY + 3, 4, 1)
        ctx.fillRect(ex + 3, eyeY + 1, 1, 2)
        ctx.fillRect(ex + 1, eyeY + 1, 1, 1)
      }
    }
    ctx.fillStyle = '#8a3b3b'
    ctx.fillRect(22, eyeY + 5, 4, face === 'hurt' ? 3 : 1)
  }
}
