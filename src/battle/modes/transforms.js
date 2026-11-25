// 판 중간 모드의 계산(순수 함수): 자동 회전·셀카·손전등이 화면을 어떻게 바꾸는지.
// 그리기와 조작(마우스 자리 되돌리기)이 같은 식을 쓴다.

// world가 모드를 거쳐 이 파일을 부르므로 AREA를 가져오지 않고 같은 값을 적는다(같은지는 테스트가 본다).
export const VIEW_W = 360
export const VIEW_H = 512
export const CENTER = { x: 180, y: 292 }

// 자동 회전: first초 뒤 첫 회전, every초쯤마다 한 번, 한 번은 flick초, 끝나기 tail초 전에 제자리
export const ROTATE = { first: 0.6, every: 2.6, flick: 0.35, tail: 0.5 }
const MIN_GAP = 0.6 // 이보다 자주 돌아야 할 만큼 짧으면 돌지 않는다.
const QUARTER = Math.PI / 2

// 이상한 값(NaN·없음)은 기본값으로
export const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback)

// 씨앗 하나로 정해지는 0~1 값
export const noise = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// 살짝 지나쳤다가 돌아오는 움직임
export function outBack(p) {
  if (!(p > 0)) return 0
  if (p >= 1) return 1
  const c = 1.70158
  return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2
}

// 어느 각도로 돌아도 경기장 전체가 보이는 배율
export function fitScale(angle) {
  const c = Math.abs(Math.cos(angle))
  const s = Math.abs(Math.sin(angle))
  return Math.min(1, VIEW_W / (VIEW_W * c + VIEW_H * s), VIEW_H / (VIEW_W * s + VIEW_H * c))
}

// 모드가 시작된 뒤 t초의 회전. left(끝날 때까지 남은 초)를 주면 끝나기 전에 0도로 돌아온다.
// { angle(라디안), scale, turn(몇 번째 회전), since(그 회전이 시작된 뒤 초), next(다음 회전까지 초) }
export function rotationAt(t, { reduced = false, left } = {}) {
  const time = Math.max(0, num(t))
  const total = Number.isFinite(left) ? time + Math.max(0, left) : Infinity
  const end = total - ROTATE.tail
  if (reduced) {
    // 움직임 줄이기: 돌아가는 장면 없이 180도로 한 번 바뀌었다가 돌아온다.
    const flipped = time >= ROTATE.first && time < end
    if (flipped) return { angle: Math.PI, scale: 1, turn: 1, since: time - ROTATE.first, next: end - time }
    const after = time >= ROTATE.first && end > ROTATE.first
    return { angle: 0, scale: 1, turn: after ? 2 : 0, since: after ? time - end : Infinity, next: time < ROTATE.first && end > ROTATE.first ? ROTATE.first - time : Infinity }
  }
  // 네 번이 한 바퀴라서, 길이에 맞춰 4의 배수 번 고르게 돈다(마지막은 늘 0도).
  let count = Infinity
  let gap = ROTATE.every
  if (total !== Infinity) {
    const span = end - ROTATE.flick - ROTATE.first
    count = 4 * Math.max(1, Math.round((span / ROTATE.every + 1) / 4))
    gap = span / (count - 1)
    if (!(gap >= MIN_GAP)) return { angle: 0, scale: 1, turn: 0, since: Infinity, next: Infinity }
  }
  const turn = Math.min(count, Math.max(0, Math.floor((time - ROTATE.first) / gap) + 1))
  if (turn === 0) return { angle: 0, scale: 1, turn, since: Infinity, next: ROTATE.first - time }
  const since = time - ROTATE.first - (turn - 1) * gap
  const next = turn < count ? gap - since : Infinity
  const done = since >= ROTATE.flick - 1e-6
  if (done && turn % 4 === 0) return { angle: 0, scale: 1, turn, since, next }
  const angle = (((turn - 1) % 4) + outBack(since / ROTATE.flick)) * QUARTER
  return { angle, scale: fitScale(angle), turn, since, next }
}

// 경기장의 점 → 화면에 보이는 점(그리기와 같은 식)
export function forwardRotate(x, y, t, opts) {
  const { angle, scale } = rotationAt(t, opts)
  const dx = x - CENTER.x
  const dy = y - CENTER.y
  const c = Math.cos(angle) * scale
  const s = Math.sin(angle) * scale
  return { x: CENTER.x + dx * c - dy * s, y: CENTER.y + dx * s + dy * c }
}

// 화면의 점(마우스) → 경기장의 점
export function rotatePoint(x, y, t, opts) {
  const { angle, scale } = rotationAt(t, opts)
  const dx = x - CENTER.x
  const dy = y - CENTER.y
  const c = Math.cos(angle) / scale
  const s = Math.sin(angle) / scale
  return { x: CENTER.x + dx * c + dy * s, y: CENTER.y - dx * s + dy * c }
}

// 셀카: 좌우가 바뀐 자리
export const mirrorPoint = (x) => VIEW_W - x

// 손전등: me에서 aim 쪽으로 펼친 부채꼴(half: 한쪽 각도, range: 거리) 안인지
export function inCone(px, py, me, aim, half, range) {
  if (!me) return false
  const dx = px - me.x
  const dy = py - me.y
  const dist = Math.hypot(dx, dy)
  if (!(dist <= range) || !Number.isFinite(aim)) return false
  if (dist < 1e-9) return true
  const diff = Math.atan2(dy, dx) - aim
  return Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff))) <= half
}

// 그림을 담아 둘 캔버스. 못 만들면 ctx가 null이고, 쓰는 쪽은 그 효과를 건너뛴다.
export function makeLayer(makeCanvas, w, h, options) {
  const canvas = makeCanvas(w, h)
  canvas.width = w
  canvas.height = h
  return { canvas, ctx: canvas.getContext('2d', options) ?? null }
}

export const domCanvas = () => document.createElement('canvas')
