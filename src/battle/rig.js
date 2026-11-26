import { APP_LOOKS, lookKeyOf } from '../character/appLook'
import { shiftLightness } from '../character/color'
import { addOutline, createGrid, getCell, setCell, toPixels } from '../pixel/grid'
import { loadoutSprite } from './loadout'
import { weaponImage } from './weaponArt'

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

// 뒷모습 그림(순수 함수): 얼굴·눈·안경·입·로고를 지우고 뒤통수와 등을 칠한다. 모자·헬멧·헤드셋·후드·물든 머리는 그대로 남는다.
// 좌우는 앞모습 그대로다. 그릴 때 뒤집는다(폰 든 손이 반대쪽에 보이게).
const HAIR_KEYS = new Set(['hair', 'hairShade', 'hairLight', 'hairBuzz'])
const LONG_BACK = { bob: 28, long: 36 } // 뒷머리가 내려오는 줄(아래쪽 끝)

export function backSprite(sprite, loadout) {
  const { look = {}, marks = {}, grafts = [] } = loadout
  const { body, parts } = sprite.layers
  const graft = grafts.find((item) => item.slot === 'hair')
  const app = graft ? APP_LOOKS[lookKeyOf(graft)] : null
  const gear = app?.gear ?? null
  const hood = gear === 'hood'
  const style = look.hairStyle
  const oy = marks.slouch ? 2 : 0
  const partAt = new Map()
  for (const [key, cells] of Object.entries(parts ?? {})) for (const [x, y] of cells) partAt.set(y * SIZE + x, key)
  const front = new Map()
  for (const [x, y, color] of body) if (color !== 'outline') front.set(y * SIZE + x, color)

  const g = createGrid(SIZE)
  const owner = new Array(SIZE * SIZE).fill(null)
  const paint = (x, y, color, part) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    setCell(g, x, y, color)
    owner[y * SIZE + x] = part
  }
  const oval = (cx, cy, rx, ry, visit) => {
    for (let y = 0; y < 40; y += 1) for (let x = 0; x < SIZE; x += 1) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) visit(x, y)
  }
  const head = new Set(['hair', 'face', 'eyes', 'undereye'])
  // 인스타 머리는 자리마다 색이 다르다(앞모습과 같은 식).
  const hairAt = (x, y, tone = 'hair') => {
    if (style === 'buzz' && tone === 'hair') return 'hairBuzz'
    if (gear === 'dye' && app.gradient) return app.gradient[Math.floor(Math.min(0.999, Math.max(0, (x - 10 + (30 - y)) / 48)) * app.gradient.length)]
    return tone
  }

  // 몸: 옷의 글자·주머니·끈을 지우고 등판을 칠한다.
  const cloth = front.get(31 * SIZE + 18) ?? 'shirt'
  const plain = cloth === 'shirt'
  const edge = plain ? 'shirtShade' : (front.get(36 * SIZE + 20) ?? cloth)
  for (const [x, y, color] of body) {
    if (color === 'outline') continue
    const key = partAt.get(y * SIZE + x)
    if (head.has(key)) continue
    if (key === 'outfit' && x >= 17 && x <= 30 && y >= 27 && y <= 35) continue
    paint(x, y, color, key ?? null)
  }
  for (let y = 28; y <= 35; y += 1) {
    const inset = y === 28 ? 1 : 0
    for (let x = 17 + inset; x <= 30 - inset; x += 1) if (owner[y * SIZE + x] !== 'hand') paint(x, y, x === 17 ? edge : cloth, 'outfit')
  }
  if (plain) for (let x = 20; x <= 27; x += 1) paint(x, 28, 'shirtShade', 'outfit')
  else {
    // 등에 늘어진 후드
    for (const [y, x0, x1] of [[28, 18, 29], [29, 18, 29], [30, 19, 28], [31, 21, 26]]) for (let x = x0; x <= x1; x += 1) paint(x, y, edge, 'outfit')
    for (let x = 20; x <= 27; x += 1) paint(x, 29, cloth, 'outfit')
  }

  // 머리
  if (!hood) {
    // 앞에서 보이던 머리카락 둘레(묶은 머리는 가운데로 다시 그리므로 옆으로 나온 것은 뺀다)
    for (const [at, color] of front) {
      const x = at % SIZE
      const y = Math.floor(at / SIZE)
      if (partAt.get(at) !== 'hair') continue
      if (!HAIR_KEYS.has(color) && !(gear === 'dye' && app.gradient?.includes(color))) continue
      if (style === 'ponytail' && x >= 35) continue
      if (y >= 28 + oy) continue
      if (gear === 'dye' && x >= 28 && x <= 32 && y >= 8 + oy && y <= 12 + oy) continue // 로고 핀 자리
      paint(x, y, hairAt(x, y), 'hair')
    }
    const down = LONG_BACK[style]
    const nape = down ? 99 : (style === 'buzz' ? 22 : 23) + oy
    oval(24, 16 + oy, style === 'buzz' ? 9.9 : 10.5, style === 'buzz' ? 8.6 : 9, (x, y) => {
      if (y < nape) paint(x, y, hairAt(x, y), 'hair')
    })
    oval(24, 18 + oy, 9.5, 8.5, (x, y) => {
      // 짧은 머리는 목덜미가 보이고 끝이 들쭉날쭉하다.
      const ragged = nape + (x % 3 === 0 ? 1 : 0)
      if (y < ragged) paint(x, y, hairAt(x, y), 'hair')
      else paint(x, y, y >= nape + 2 ? 'skinShade' : 'skin', 'face')
    })
    if (down && style === 'bob') for (let y = 20 + oy; y < down + oy && y < 29; y += 1) for (let x = 13; x <= 34; x += 1) paint(x, y, hairAt(x, y), 'hair')
    if (style === 'long') {
      for (let y = 20 + oy; y < down; y += 1) {
        const inset = y < 28 ? 0 : y < down - 1 ? 4 : 5 // 어깨 아래로는 좁아져 팔이 보인다
        for (let x = 12 + inset; x <= 35 - inset; x += 1) paint(x, y, hairAt(x, y), 'hair')
      }
    }
    // 귀
    if (!down) {
      for (let y = 18; y <= 20; y += 1) {
        for (const x of [13, 34]) if (front.get((y + oy) * SIZE + x) === 'skin') paint(x, y + oy, 'skin', 'face')
      }
    }
    if (!down && !marks.slouch) for (let x = 22; x <= 25; x += 1) paint(x, 27, 'skinShade', 'face')
    if (style === 'ponytail') {
      for (let y = 15 + oy; y <= 30 + oy; y += 1) {
        const half = y < 18 + oy ? 2 : y < 27 + oy ? 3 : 32 + oy - y - 1
        for (let x = 24 - half; x < 24 + half; x += 1) paint(x, y, hairAt(x, y, x === 24 - half || x === 23 + half ? 'hairShade' : 'hair'), 'hair')
      }
      for (let x = 22; x <= 25; x += 1) for (const y of [14, 15]) paint(x, y + oy, 'hairTie', 'hair')
    }
    shadeBack(g, hairAt, oy, style)
  }
  paintBackGear(gear, app, { paint, oval, front, oy })

  addOutline(g, 'outline')
  const cells = toPixels(g)
  const out = {}
  owner.forEach((key, i) => {
    if (key && getCell(g, i % SIZE, Math.floor(i / SIZE)) !== null) (out[key] ??= []).push([i % SIZE, Math.floor(i / SIZE)])
  })
  return { size: SIZE, palette: sprite.palette, layers: { body: cells, parts: out } }
}

// 뒷머리 명암: 아래 끝은 어둡게, 결 몇 가닥, 오른쪽 위에 윤기(그릴 때 뒤집히면 왼쪽 위)
function shadeBack(g, hairAt, oy, style) {
  const plain = (x, y) => HAIR_KEYS.has(getCell(g, x, y))
  const ends = []
  for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) if (plain(x, y) && !plain(x, y + 1) && y > 16) ends.push([x, y])
  for (const [x, y] of ends) setCell(g, x, y, 'hairShade')
  if (style !== 'buzz') {
    const strands = style === 'long' ? [[17, 20, 33], [21, 18, 34], [26, 18, 34], [30, 20, 33]] : [[18, 17, 21], [22, 19, 22], [25, 18, 22], [29, 17, 21]]
    for (const [x, from, to] of strands) for (let y = from + oy; y <= to + oy; y += 1) if (plain(x, y) && style !== 'ponytail') setCell(g, x, y, 'hairShade')
  }
  for (const [x, y] of [[31, 10], [30, 9], [29, 9], [28, 8], [27, 8], [32, 11]]) if (plain(x, y + oy)) setCell(g, x, y + oy, hairAt(x, y + oy, 'hairLight'))
}

// 머리에 쓴 것의 뒷모습(로고 없이)
function paintBackGear(gear, app, { paint, oval, front, oy }) {
  if (!app) return
  const main = app.main === '#141414' ? '#34343c' : app.main // 검정 앱은 외곽선과 섞이지 않게(drawCharacter와 같다)
  if (gear === 'hood') {
    const seam = shiftLightness(main, main === '#34343c' ? 12 : -14)
    oval(24, 17 + oy, 12.4, 11.4, (x, y) => {
      if (y <= 27 + oy) paint(x, y, x === 23 && y > 8 + oy ? seam : y >= 26 + oy ? seam : main, 'hair')
    })
  } else if (gear === 'cap') {
    const strap = shiftLightness(main, -18)
    oval(24, 13 + oy, 10.6, 6.6, (x, y) => {
      if (y >= 6 + oy && y <= 12 + oy) paint(x, y, main, 'hair')
    })
    for (let x = 14; x <= 33; x += 1) for (const y of [13, 14, 15]) paint(x, y + oy, main, 'hair')
    // 뒤 조절 구멍과 끈
    for (let y = 12; y <= 14; y += 1) for (let x = y === 12 ? 22 : 21; x <= (y === 12 ? 25 : 26); x += 1) paint(x, y + oy, 'hair', 'hair')
    for (let x = 14; x <= 33; x += 1) paint(x, 15 + oy, strap, 'hair')
  } else if (gear === 'helmet') {
    oval(24, 14 + oy, 11.2, 8.8, (x, y) => {
      if (y >= 5 + oy && y <= 20 + oy) paint(x, y, y >= 17 + oy && y <= 18 + oy ? '#ffffff' : main, 'hair')
    })
  } else if (gear === 'headset') {
    // 띠는 정수리에, 귀덮개는 양옆에 남고 마이크는 앞쪽이라 안 보인다.
    for (const [at, color] of front) {
      const x = at % SIZE
      const y = Math.floor(at / SIZE)
      if (color === '#2d2f3a' && y <= 15 + oy && (y <= 9 + oy || x <= 13 || x >= 34) && x <= 37) paint(x, y, color, 'hair')
    }
    for (let y = 15; y <= 21; y += 1) {
      for (let x = 10; x <= 14; x += 1) paint(x, y + oy, main, 'hair')
      for (let x = 33; x <= 37; x += 1) paint(x, y + oy, main, 'hair')
    }
  }
}
const still = () => ({ x: 0, y: 0, r: 0 })
const clamp01 = (value) => Math.min(1, Math.max(0, value))
const mix = (a, b, p) => a + (b - a) * p

// 폰 든 팔이 쉬고 있을 때 가리키는 방향: 내리고 있으면 아래, 폰을 얼굴 옆에 들고 있으면(raised) 위
const REST_DOWN = Math.PI / 2
const REST_UP = -1.25

// 지금 자세. m: motions.js의 모션, info: { time, stun, dash, aim, seed, raised, reduced }
// 왼쪽을 보고 있으면(flip) 그릴 때 좌우를 뒤집으므로, 여기서는 늘 오른쪽을 본다고 보고 방향 값만 맞춘다.
export function rigPose(m = {}, { time = 0, stun = false, dash = false, aim = 0, seed = 0, raised = false, air = 0, reduced = false, weapon = null } = {}) {
  const rest = raised ? REST_UP : REST_DOWN
  const loose = raised ? 0.35 : 1 // 폰을 든 팔은 덜 흔들린다
  // weapon: 손에 든 무기(앱 유형 열쇠). Rig가 오른손에 그린다.
  const pose = { head: still(), torso: still(), armL: still(), armR: still(), legL: still(), legR: still(), flip: (m.turn ?? 1) < 0, turn: 1, face: 'normal', aim: 0, weapon }
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

  // 공중(짧은 영상 모드): 오를 때는 무릎을 당기고, 떨어질 때는 팔다리를 벌린다.
  if (air !== 0) {
    const up = air < 0
    pose.legL.r = up ? 0.7 : 0.45
    pose.legR.r = up ? -0.2 : -0.45
    pose.legL.y -= up ? 2 : 0
    pose.armL.r = up ? 1.1 : 2.2
    pose.armR.r = raised ? (up ? 0.1 : 0.5) : up ? -1.1 : -2.2
    pose.head.r += up ? -0.06 : 0.08
  }

  if (dash) {
    pose.torso.r += 0.42
    pose.head.r -= 0.2
    pose.legL.r += 1
    pose.legR.r += 0.5
    pose.armL.r += 1.3
    pose.armR.r += raised ? 0.5 : 1.1
  }

  // 근접 휘두르기: 준비(예고) → 타격 → 회복을 모양마다 다른 팔 궤적으로. 팔 각 0은 아래, -π/2는 앞, -π는 위.
  if (m.swing) swingArm(pose, m.swing)

  // 쏘기: 폰 든 팔을 조준한 쪽으로 뻗었다가 반동으로 튀고 내려온다.
  if (m.shot && !m.swing) {
    const hold = m.shot.t < 0.22 ? 1 : 1 - clamp01((m.shot.t - 0.22) / 0.16)
    const local = pose.flip ? Math.PI - aim : aim
    const angle = Math.atan2(Math.sin(local - rest), Math.cos(local - rest))
    const kick = 1 - clamp01(m.shot.t / 0.12)
    pose.aim = hold // 뒷모습은 조준한 각도 대신 앞(화면 안쪽)으로 팔을 뻗는다
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

const ease = (p) => 1 - (1 - p) ** 2
// 모양별 팔 궤적: [준비 끝 각, 타격 끝 각]. 회복 동안 원래 자리로 돌아간다.
const SWING_ARC = {
  arc: [-2.7, -0.4], // 머리 위에서 앞 아래로 크게
  arcBack: [-0.3, -2.6], // 반대로 휘두르면 아래에서 위로 올려 벤다
  thrust: [0.55, -Math.PI / 2], // 뒤로 당겼다가 앞으로 쭉
  line: [0.55, -Math.PI / 2],
  slam: [-3.05, -0.25], // 머리 위로 들었다가 내려찍기
  circle: [-Math.PI / 2, -Math.PI / 2], // 팔을 뻗고 몸이 돈다
}

function swingArm(pose, { t, move }) {
  const [up, down] = SWING_ARC[move.shape === 'arc' && move.sweep === -1 ? 'arcBack' : move.shape] ?? SWING_ARC.arc
  const base = pose.armR.r
  const end = move.windup + move.active
  let r
  let lean = 0
  if (t < move.windup) {
    const p = ease(clamp01(t / move.windup))
    r = mix(base, up, p)
    lean = -0.12 * p
  } else if (t < end) {
    const p = clamp01((t - move.windup) / move.active)
    const straight = move.shape === 'thrust' || move.shape === 'line'
    r = mix(up, down, ease(straight ? clamp01(p * 2) : p)) // 찌르기는 타격 앞쪽 절반에 다 뻗는다
    lean = mix(-0.12, 0.18, p)
    if (move.shape === 'thrust' || move.shape === 'line') pose.armR.x += 3 * p
    if (move.shape === 'circle') pose.turn = Math.cos(p * Math.PI * 2) // 한 바퀴
  } else {
    const p = ease(clamp01((t - end) / move.recovery))
    r = mix(down, base, p)
    lean = 0.18 * (1 - p)
  }
  pose.armR.r = r
  pose.armL.r += lean * 2 // 반대 팔로 균형
  pose.torso.r += lean
  pose.head.r -= lean * 0.5
  if (move.shape === 'slam' && t >= move.windup && t < end) pose.torso.y += 1.5
}

const makeCanvas = (w = SIZE, h = SIZE) => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}
const HAND = [34.5, 35] // 오른손(인형 그림 좌표)
const WEAPON_SCALE = 0.8

// 그림 한 벌을 부위별 캔버스로
function limbImages(sprite) {
  const images = {}
  for (const [limb, cells] of Object.entries(splitLimbs(sprite))) {
    const image = makeCanvas()
    const ctx = image.getContext('2d')
    for (const [x, y, color] of cells) {
      ctx.fillStyle = sprite.palette[color] ?? color
      ctx.fillRect(x, y, 1, 1)
    }
    images[limb] = image
  }
  return images
}

const BACK_LIMBS = ['armR', 'legL', 'legR', 'armL', 'torso', 'head'] // 뒤에서는 폰 든 팔이 몸 앞(먼 쪽)에 있다

// 캐릭터 하나의 인형. draw(pose)를 부르면 canvas(48×48)에 지금 모습이 그려진다.
// drawBack(pose)는 뒷모습을 따로 둔 캔버스(back)에 그린다. 앞모습 canvas는 건드리지 않는다.
export class Rig {
  constructor(loadout) {
    const sprite = loadoutSprite(loadout)
    this.eyeY = 18 + (loadout.marks?.slouch ? 3 : 0)
    this.skin = sprite.palette.skin
    this.raised = Boolean(loadout.marks?.raisePhone && loadout.grafts?.some((graft) => graft.slot === 'hand'))
    this.canvas = makeCanvas()
    this.ctx = this.canvas.getContext('2d')
    this.images = limbImages(sprite)
    this.makeBack = () => limbImages(backSprite(sprite, loadout)) // 추격 카메라가 나올 때만 만든다
    this.backImages = null
    this.backCanvas = null
  }

  // 뒷모습 캔버스(처음 쓸 때 만들고 계속 같은 것을 쓴다)
  get back() {
    this.backCanvas ??= makeCanvas()
    return this.backCanvas
  }

  drawBack(pose, { white = false } = {}) {
    return this.paintBack(this.back, pose, white)
  }

  paintBack(canvas, pose, white) {
    this.backImages ??= this.makeBack()
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.imageSmoothingEnabled = false
    // 앞모습을 거울처럼 뒤집은 것이 뒷모습이다. 바라보는 쪽(flip·turn)은 카메라가 늘 등 뒤에 있으므로 쓰지 않는다.
    ctx.translate(SIZE, 0)
    ctx.scale(-1, 1)
    const aim = pose.aim ?? 0
    for (const limb of BACK_LIMBS) {
      const { x, y, r } = pose[limb]
      const [px, py] = PIVOT[limb]
      ctx.save()
      ctx.translate(Math.round(px + x), Math.round(py + y))
      ctx.rotate(limb === 'armR' && aim > 0 ? mix(r, this.raised ? 0.25 : -2.5, aim) : r)
      ctx.translate(-px, -py)
      ctx.drawImage(this.backImages[limb], 0, 0)
      ctx.restore()
    }
    if (white) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, SIZE, SIZE)
    }
    return canvas
  }

  // back: 뒷모습을 이 canvas에 그린다(둘 다 필요하면 drawBack).
  draw(pose, { white = false, back = false } = {}) {
    if (back) return this.paintBack(this.canvas, pose, white)
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
      // 오른손에 든 무기: 팔과 같이 돈다(손 = 팔 그림의 아래 끝).
      if (limb === 'armR' && pose.weapon) {
        const image = weaponImage(pose.weapon, makeCanvas)
        if (image) ctx.drawImage(image, Math.round(HAND[0] - (image.width * WEAPON_SCALE) / 2), HAND[1], Math.round(image.width * WEAPON_SCALE), Math.round(image.height * WEAPON_SCALE))
      }
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
