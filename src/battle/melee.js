// 상수는 arena.js에서 바로 가져온다: world.js와 서로 가져오는 사이라, 모듈을 읽는 순서에 따라 world의 값이 아직 비어 있을 수 있다.
import { OBSTACLES, RADIUS } from './arena'
import { rulesOf } from './modes'
import { applyDamage, aloft, keepInside, playerById, truced } from './world'

// 근접 무기: 폰이 머리에 스며든 1위 앱 유형의 무기로 변한다(기술과 같은 열쇠). 무기마다 2~4타 연속기.
// 한 타(Move)는 범위 모양과 세 단계(준비 → 타격 → 회복)를 가진다. 준비 동안 모션으로 예고하고, 타격 단계에서만 맞는다.
// 판정은 탄처럼 "맞는 쪽" 화면(player.local)이 한다. 같은 이벤트면 어느 화면에서도 같은 휘두르기(Swing)가 놓인다.
//   shape: arc(부채꼴을 쓸고 지나감) · thrust(앞으로 길고 좁게) · circle(둘레) · slam(앞 지점 내려찍기, 떠 있으면 피함) · line(지나간 줄)
//   reach: 리치, width: 부채꼴 각(라디안), sweep: 1(왼→오) / -1(오→왼), thick: 찌르기·줄 폭, radius: 내려찍기 둘레(기본 리치×0.6)
//   damage, hits(타격 단계 안 판정 횟수), tip { from: 리치 비율, mult }, knock(더 밀기), stun(멈칫 초), launch(띄우는 속도),
//   bleed { dps, time }(출혈), pull(주인 쪽으로 끌기), step(타격 때 앞으로 내딛기, 주인 화면에서만), warn(바닥에 맞을 자리 예고)

export const COMBO_WINDOW = 0.35 // 타격이 끝난 뒤 이 안에 다시 누르면 다음 타
export const SWING_SLOW = { swing: 0.35, recovery: 0.7 } // 공격 중 이동 배율(준비·타격 / 회복)
const TOL = RADIUS / 2 // 몸 두께만큼 판정을 넉넉하게
const BAND = 0.35 // 부채꼴: 지금 칼날에서 이만큼(진행도) 뒤까지가 판정 띠

const hit = (shape, reach, extra, windup, active, recovery, damage) => ({ shape, reach, ...extra, windup, active, recovery, damage })

export const WEAPONS = {
  detox: {
    name: '맑은 나뭇가지 봉',
    desc: '균형 잡힌 봉. 가로베기 두 번 뒤 찌르기',
    color: '#4cc96b',
    combo: [
      hit('arc', 56, { width: 1.7, sweep: 1 }, 0.16, 0.12, 0.22, 3),
      hit('arc', 56, { width: 1.7, sweep: -1 }, 0.14, 0.12, 0.22, 3),
      hit('thrust', 62, { thick: 16, knock: 10 }, 0.2, 0.1, 0.32, 4),
    ],
  },
  unrecorded: {
    name: '맨주먹',
    desc: '짧고 약한 주먹. 잽 두 번 뒤 어퍼컷',
    color: '#ffd84a',
    combo: [
      hit('thrust', 40, { thick: 18 }, 0.1, 0.08, 0.16, 2),
      hit('thrust', 40, { thick: 18 }, 0.1, 0.08, 0.16, 2),
      hit('arc', 42, { width: 1.2, sweep: 1, launch: 150 }, 0.16, 0.1, 0.3, 3),
    ],
  },
  messenger: {
    name: '말풍선 너클',
    desc: '가장 빠른 주먹. 잽·잽·훅 뒤 읽씹 펀치(멈칫)',
    color: '#fee500',
    combo: [
      hit('thrust', 46, { thick: 18 }, 0.08, 0.07, 0.14, 2),
      hit('thrust', 46, { thick: 18 }, 0.08, 0.07, 0.14, 2),
      hit('arc', 48, { width: 1.6, sweep: 1, knock: 12 }, 0.12, 0.1, 0.2, 2),
      hit('thrust', 48, { thick: 20, stun: 0.3 }, 0.16, 0.08, 0.32, 3),
    ],
  },
  feed: {
    name: '하트 채찍',
    desc: '가장 긴 채찍. 끝에 맞히면 1.5배, 세 번째에 끌어당긴다',
    color: '#e1306c',
    combo: [
      hit('arc', 66, { width: 2, sweep: 1, tip: { from: 0.7, mult: 1.5 } }, 0.22, 0.14, 0.28, 3),
      hit('arc', 66, { width: 2, sweep: -1, tip: { from: 0.7, mult: 1.5 } }, 0.22, 0.14, 0.28, 3),
      hit('thrust', 68, { thick: 14, pull: 30 }, 0.24, 0.12, 0.36, 3),
    ],
  },
  video: {
    name: '재생바 창',
    desc: '길고 좁은 창. 찌르기 두 번 뒤 앞으로 내딛는 돌진 찌르기',
    color: '#ff1f3d',
    combo: [
      hit('thrust', 62, { thick: 14 }, 0.18, 0.1, 0.24, 3),
      hit('thrust', 62, { thick: 14 }, 0.18, 0.1, 0.24, 3),
      hit('thrust', 66, { thick: 16, step: 40, knock: 12 }, 0.24, 0.12, 0.38, 3),
    ],
  },
  music: {
    name: '마이크 해머',
    desc: '느리고 묵직한 해머. 크게 휘두른 뒤 내려찍기(떠 있으면 피한다)',
    color: '#b06be0',
    combo: [
      hit('arc', 56, { width: 2.2, sweep: 1, knock: 14 }, 0.3, 0.14, 0.3, 4),
      hit('slam', 58, { radius: 34, stun: 0.25, warn: true }, 0.36, 0.1, 0.4, 5),
    ],
  },
  game: {
    name: '패드 쌍검',
    desc: '짧고 빠른 쌍검. 세 번 베고 X자로 두 번 벤다',
    color: '#8f7cff',
    combo: [
      hit('arc', 48, { width: 1.5, sweep: 1 }, 0.08, 0.08, 0.12, 2),
      hit('arc', 48, { width: 1.5, sweep: -1 }, 0.08, 0.08, 0.12, 2),
      hit('arc', 48, { width: 1.5, sweep: 1 }, 0.08, 0.08, 0.12, 2),
      hit('arc', 50, { width: 1.8, sweep: -1, hits: 2 }, 0.14, 0.12, 0.3, 2),
    ],
  },
  webtoon: {
    name: '컷 대검',
    desc: '넓고 느린 대검. 크게 두 번 벤 뒤 내려벤다',
    color: '#00c85a',
    combo: [
      hit('arc', 60, { width: 2.4, sweep: 1 }, 0.3, 0.14, 0.26, 3),
      hit('arc', 60, { width: 2.4, sweep: -1 }, 0.28, 0.14, 0.26, 3),
      hit('slam', 62, { radius: 30, knock: 12, warn: true }, 0.38, 0.12, 0.42, 4),
    ],
  },
  shopping: {
    name: '택배 망치',
    desc: '가장 느리고 센 망치. 내려찍으면 크게 밀리고 멈칫한다',
    color: '#c58b54',
    combo: [hit('slam', 54, { radius: 34, knock: 18, stun: 0.3, warn: true }, 0.45, 0.12, 0.45, 8)],
  },
  finance: {
    name: '카드 단검',
    desc: '빠른 찌르기 두 번 뒤 베면 출혈(3초 동안 초당 1)',
    color: '#ffc928',
    combo: [
      hit('thrust', 50, { thick: 14 }, 0.1, 0.08, 0.14, 2),
      hit('thrust', 50, { thick: 14 }, 0.1, 0.08, 0.14, 2),
      hit('arc', 50, { width: 1.6, sweep: 1, bleed: { dps: 1, time: 3 } }, 0.14, 0.1, 0.3, 3),
    ],
  },
  study: {
    name: '연필 레이피어',
    desc: '정확한 찌르기. 끝에 맞히면 1.6배, 두 번째는 3연속 찌르기',
    color: '#ffb21e',
    combo: [
      hit('thrust', 60, { thick: 12, tip: { from: 0.75, mult: 1.6 } }, 0.2, 0.1, 0.22, 3),
      hit('thrust', 60, { thick: 12, hits: 3, tip: { from: 0.75, mult: 1.6 } }, 0.22, 0.24, 0.36, 2),
    ],
  },
}

export const weaponOf = (key) => WEAPONS[key] ?? WEAPONS.unrecorded
export const moveOf = (key, c = 0) => {
  const { combo } = weaponOf(key)
  return combo[((c % combo.length) + combo.length) % combo.length]
}

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
const clamp01 = (value) => Math.min(1, Math.max(0, value))

// 순수 기하: 주인 (ox, oy)가 a 방향으로 이 타를 할 때, 진행도 p(타격 단계 0~1)에 (px, py)가 맞으면 피해 배율, 아니면 0.
export function inSwing(move, ox, oy, a, px, py, p = 0.5) {
  const dx = px - ox
  const dy = py - oy
  const forward = dx * Math.cos(a) + dy * Math.sin(a)
  const side = -dx * Math.sin(a) + dy * Math.cos(a)
  const dist = Math.hypot(dx, dy)
  const tipOf = (along) => (move.tip && along >= move.reach * move.tip.from ? move.tip.mult : 1)
  switch (move.shape) {
    case 'arc': {
      if (dist > move.reach + TOL) return 0
      const half = move.width / 2
      const angle = wrap(Math.atan2(dy, dx) - a)
      const slack = Math.atan2(TOL, Math.max(1, dist))
      if (dist <= RADIUS) return Math.abs(angle) <= half + slack ? tipOf(dist) : 0
      const blade = (q) => (move.sweep === -1 ? half - clamp01(q) * move.width : -half + clamp01(q) * move.width)
      const from = blade(p - BAND)
      const to = blade(p)
      const low = Math.min(from, to) - slack
      const high = Math.max(from, to) + slack
      return angle >= low && angle <= high ? tipOf(dist) : 0
    }
    case 'thrust':
    case 'line':
      if (forward < -TOL || forward > move.reach + TOL || Math.abs(side) > (move.thick ?? 16) / 2 + TOL) return 0
      return move.shape === 'thrust' ? tipOf(forward) : 1
    case 'circle':
      return dist <= move.reach + TOL ? 1 : 0
    case 'slam': {
      const cx = Math.cos(a) * move.reach * 0.7
      const cy = Math.sin(a) * move.reach * 0.7
      return Math.hypot(dx - cx, dy - cy) <= (move.radius ?? move.reach * 0.6) + TOL ? 1 : 0
    }
    default:
      return 0
  }
}

// 사이에 앱 아이콘(벽)이 없는지: 선을 따라 6px마다 본다.
export function clearPath(x0, y0, x1, y1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6))
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + ((x1 - x0) * i) / steps
    const y = y0 + ((y1 - y0) * i) / steps
    if (OBSTACLES.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)) return false
  }
  return true
}

// 지금 단계: windup → active → recovery → done. p는 그 단계의 진행도(0~1).
export function swingPhase(swing) {
  const { move, t } = swing
  if (t < move.windup) return { phase: 'windup', p: t / move.windup }
  if (t < move.windup + move.active) return { phase: 'active', p: (t - move.windup) / move.active }
  if (t < move.windup + move.active + move.recovery) return { phase: 'recovery', p: (t - move.windup - move.active) / move.recovery }
  return { phase: 'done', p: 1 }
}

// 제품(Factory Method): 시전 이벤트로 만들어 place(world)로 세계에 놓인다.
// anchor: 'owner'면 판정 기준점이 그 화면에서 보이는 주인의 지금 자리(제자리 공격), 'origin'이면 이벤트의 시작 자리(움직이며 때리는 기술).
export class Swing {
  constructor({ owner, x, y, a, move, m = 1, anchor = 'owner', t = 0, key = null, c = 0 }) {
    Object.assign(this, { owner, x, y, a, move, m, anchor, t, key, c })
    this.hits = new Set()
    this.done = false
    this.stepped = false
  }

  static from(ev, move, extra = {}) {
    return new Swing({ owner: ev.o, x: ev.x, y: ev.y, a: ev.a, move, m: ev.m ?? 1, key: ev.s ?? null, c: ev.c ?? 0, ...extra })
  }

  // 늦게 받은 이벤트: 늦은 만큼 준비 단계를 건너뛴다(타격 단계는 줄이지 않는다).
  caughtUp(ahead) {
    const skip = Math.min(Math.max(0, ahead), this.move.windup)
    if (skip <= 0) return this
    return new Swing({ ...this, t: this.t + skip })
  }

  // 같은 주인의 회복 중인 휘두르기는 끝낸다(연속기로 회복을 끊음).
  place(world) {
    for (const other of world.swings) if (other.owner === this.owner && swingPhase(other).phase === 'recovery') other.done = true
    world.swings.push(this)
  }
}

// 한 걸음: 단계 진행, 주인 감속, 타격 단계의 맞는 쪽 판정. world.stepWorld가 부른다.
export function stepSwing(world, swing, dt) {
  const owner = playerById(world, swing.owner)
  // 주인이 쓰러지면(모든 화면이 안다) 휘두르기도 사라진다.
  if (!owner || !owner.alive) {
    swing.done = true
    return
  }
  swing.t += dt
  const { phase, p } = swingPhase(swing)
  if (phase === 'done') {
    swing.done = true
    return
  }
  if (owner.local) owner.attackSlow = Math.min(owner.attackSlow ?? 1, phase === 'recovery' ? SWING_SLOW.recovery : SWING_SLOW.swing)
  if (phase !== 'active') return
  const { move } = swing
  if (!swing.stepped) {
    swing.stepped = true
    if (move.step && owner.local) {
      owner.x += Math.cos(swing.a) * move.step
      owner.y += Math.sin(swing.a) * move.step
      keepInside(owner)
    }
  }
  const slices = move.hits ?? 1
  const slice = Math.min(slices - 1, Math.floor(p * slices))
  const ox = swing.anchor === 'origin' ? swing.x : owner.x
  const oy = swing.anchor === 'origin' ? swing.y : owner.y
  if (truced(world, swing.owner)) {
    hitBoss(world, swing, ox, oy, slice)
    return
  }
  for (const player of world.players) {
    if (player.id === swing.owner || !player.alive) continue
    if (move.shape === 'slam' && aloft(player)) continue
    const key = `${player.id}:${slice}`
    if (swing.hits.has(key)) continue
    const mult = inSwing(move, ox, oy, swing.a, player.x, player.y, p)
    if (!mult || !clearPath(ox, oy, player.x, player.y)) continue
    swing.hits.add(key)
    if (player.local) strike(world, swing, player, ox, oy, mult)
  }
}

// 보스 휴전: 사람 대신 보스를 때린다(조각마다 한 번).
function hitBoss(world, swing, ox, oy, slice) {
  const key = `boss:${slice}`
  if (swing.hits.has(key)) return
  const { move } = swing
  const centered = move.shape === 'circle'
  const reach = centered ? move.reach : move.reach * 0.6
  const x = centered ? ox : ox + Math.cos(swing.a) * reach
  const y = centered ? oy : oy + Math.sin(swing.a) * reach
  if (rulesOf(world)?.hitArea?.(world, swing.owner, x, y, reach, Math.round(move.damage * swing.m))) swing.hits.add(key)
}

// 맞는 쪽 화면에서 피해와 효과
function strike(world, swing, player, ox, oy, mult) {
  const { move } = swing
  const dx = player.x - ox
  const dy = player.y - oy
  const dist = Math.hypot(dx, dy) || 1
  const push = { x: dx / dist, y: dy / dist }
  if (!applyDamage(world, player, Math.round(move.damage * swing.m * mult), push, swing.owner)) return
  if (move.knock) {
    player.x += push.x * move.knock
    player.y += push.y * move.knock
  }
  if (move.pull) {
    const pull = Math.min(move.pull, Math.max(0, dist - RADIUS * 2))
    player.x -= push.x * pull
    player.y -= push.y * pull
  }
  keepInside(player)
  if (move.stun) player.stunT = Math.max(player.stunT, move.stun)
  if (move.launch && player.alive) {
    player.vz = Math.max(player.vz, move.launch)
    player.stunT = Math.max(player.stunT, 0.3)
  }
  if (move.bleed && player.alive) {
    player.bleedT = move.bleed.time
    player.bleedDps = move.bleed.dps
  }
}
