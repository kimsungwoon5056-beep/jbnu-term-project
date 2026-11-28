import { ATTACKS } from './attacks'
import { AREA, OBSTACLES } from './arena'
import { farOf } from './farSkills'
import { moveOf, Swing } from './melee'
import { rulesOf } from './modes'
import { Guard, Parried } from './guard'
import { addProjectile, aloft, applyDamage, ARENA, effect, JUMP, keepInside, LAG, landed, playerById, RADIUS, stepShot, truced } from './world'

// 앱 기술(Q): 머리에 스며든 1위 앱 유형마다 하나. 앱 조각이 없으면 가장 강한 "디톡스 실드".
// Factory Method: 시전 이벤트(누가·어디서·어느 방향)마다 맞는 생산자(아래 CREATORS)가 "제품" 객체를 만든다.
//   Q 근접 기술은 기술마다 cast, E 원거리 기술은 farSkills.js의 cast, 기본 공격·막기·패링·반격은 표의 생산자가 만든다.
// 제품(Swing·Lunge·Teleport·Leap·Block·Shockwave·SelfEffect, farSkills의 Projectile·Trap·Turret, guard.js의 Guard·Parried)은
// 모두 place(world)로 스스로 세계에 놓인다. 그래서 세계(world.spawnEvent)는 제품 종류를 몰라도 되고, 새 기술은 cast만 쓰면 된다.
// 같은 이벤트면 어느 화면에서도 같은 결과가 나오도록 무작위를 쓰지 않는다.
// (world.js와 서로 가져오지만, world의 함수는 place 안에서만 부르므로 불러오는 순서와 상관없다.)

const FLY_STEP = 1 / 60
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// ---------- 제품: 세계에 놓이는 것들 ----------

// 발사체. 늦게 나가는 것(delay)은 대기 줄에, 바로 나가는 것은 발사체 풀(Object Pool)에 들어간다.
export class Projectile {
  // 움직임 값: dirX·dirY(처음 방향), accel(그 방향으로 빨라짐), wave(옆으로 흔들림), bounce(튕길 횟수), grow(커짐), burst(끝날 때 터져 나오는 탄)
  constructor({ owner, x, y, vx, vy, r, damage, life, color, pierce, homing, delay, flown = 0, dirX = 0, dirY = 0, accel = 0, wave = null, bounce = 0, grow = 0, burst = null, shape = 'orb', age = 0 }) {
    Object.assign(this, { owner, x, y, vx, vy, r, damage, life, color, pierce, homing, delay, flown, dirX, dirY, accel, wave, bounce, grow, burst, shape, age })
  }

  // 시전 위치에서 angle 방향으로 18 앞에서 나가는 탄
  static aimed(ev, angle, spec) {
    return new Projectile({
      owner: ev.o,
      x: ev.x + Math.cos(angle) * 18,
      y: ev.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * spec.speed,
      vy: Math.sin(angle) * spec.speed,
      r: spec.r ?? 4,
      damage: Math.round(spec.damage * (ev.m ?? 1)),
      life: spec.life ?? 1.1,
      color: spec.color,
      pierce: spec.pierce ?? false,
      homing: spec.homing ?? 0,
      delay: spec.delay ?? 0,
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      accel: spec.accel,
      wave: spec.wave,
      bounce: spec.bounce,
      grow: spec.grow,
      burst: spec.burst,
      shape: spec.shape,
    })
  }

  // 이벤트를 ahead초 늦게 받았을 때(온라인): 최대 LAG.catchUp초만큼 앞당긴 새 발사체.
  // 연타처럼 늦게 나가는 것은 기다릴 시간을 줄이고, 이미 나간 것은 날아간 만큼 옮긴다.
  caughtUp(ahead) {
    const late = Math.min(LAG.catchUp, Math.max(0, ahead))
    if (late <= 0) return this
    if (this.delay >= late) return new Projectile({ ...this, delay: this.delay - late })
    const flown = late - this.delay
    return new Projectile({ ...this, delay: 0, x: this.x + this.vx * flown, y: this.y + this.vy * flown, life: this.life - flown, flown })
  }

  place(world) {
    if (this.delay > 0) world.pending.push({ delay: this.delay, spec: this, from: this.owner })
    else if (this.flown > 0) this.fly(world)
    else addProjectile(world, this)
  }

  // 앞당긴 탄은 나간 자리부터 한 걸음씩 날려, 그 사이에 있던 벽이나 사람을 건너뛰지 않게 한다.
  fly(world) {
    const { flown } = this
    const shot = addProjectile(world, { ...this, x: this.x - this.vx * flown, y: this.y - this.vy * flown, life: this.life + flown })
    for (let left = flown; left > 1e-9 && shot.active; left -= FLY_STEP) stepShot(world, shot, Math.min(FLY_STEP, left))
  }
}

// 덫: 경기장 안쪽에 놓이고, 밟으면 피해 + 멈춤(판정은 world.stepWorld)
export class Trap {
  constructor({ owner, x, y, r, life, damage, stun, color }) {
    Object.assign(this, { owner, x, y, r, life, damage, stun, color })
  }

  place(world) {
    world.traps.push({ ...this, x: clamp(this.x, 20, ARENA.w - 20), y: clamp(this.y, 20, ARENA.h - 20) })
  }
}

// 포탑: 놓인 자리에서 가까운 상대에게 스스로 쏜다(판정은 다른 탄처럼 맞는 쪽이 한다).
export class Turret {
  constructor({ owner, x, y, life, every, range, color, spec }) {
    Object.assign(this, { owner, x, y, life, every, range, color, spec })
  }

  place(world) {
    world.turrets.push({ ...this, x: clamp(this.x, 24, ARENA.w - 24), y: clamp(this.y, 60, ARENA.h - 76), fireT: 0.4, t: 0 })
  }
}

// 포탑의 한 걸음
export function stepTurret(world, turret, dt, target) {
  turret.life -= dt
  turret.t += dt
  turret.fireT -= dt
  if (turret.fireT > 0) return
  turret.fireT += turret.every
  if (!target || Math.hypot(target.x - turret.x, target.y - turret.y) > turret.range) return
  const angle = Math.atan2(target.y - turret.y, target.x - turret.x)
  turret.aim = angle
  Projectile.aimed({ o: turret.owner, x: turret.x, y: turret.y }, angle, turret.spec).place(world)
}

// 충격파: 놓이는 순간 둘레 안의 상대(내 화면에서 판정하는 사람)에게 피해를 주고 밀어낸다.
export class Shockwave {
  constructor({ owner, x, y, r, damage, push, color, delay = 0 }) {
    Object.assign(this, { owner, x, y, r, damage, push, color, delay })
  }

  place(world) {
    if (this.delay > 0) {
      world.timers.push({ delay: this.delay, part: new Shockwave({ ...this, delay: 0 }) })
      return
    }
    world.rings.push({ ...this, t: 0 })
    rulesOf(world)?.hitArea?.(world, this.owner, this.x, this.y, this.r, this.damage)
    for (const player of world.players) {
      if (!player.local || player.id === this.owner || !player.alive || truced(world, this.owner) || aloft(player)) continue
      const dx = player.x - this.x
      const dy = player.y - this.y
      const dist = Math.hypot(dx, dy)
      if (dist > this.r + RADIUS) continue
      if (landed(applyDamage(world, player, this.damage, null, this.owner)) && dist > 0) {
        player.x += (dx / dist) * this.push
        player.y += (dy / dist) * this.push
        keepInside(player)
      }
    }
  }
}

// 자기 효과(실드·집중): 효과 글자는 모든 화면에 뜨고, 상태는 시전한 사람 화면에서만 바뀐다.
export class SelfEffect {
  constructor({ owner, effect, time, heal }) {
    Object.assign(this, { owner, effect, time, heal })
  }

  place(world) {
    const owner = playerById(world, this.owner)
    if (!owner) return
    effect(world, this.effect, owner.x, owner.y - 26)
    if (!owner.local) return
    if (this.effect === 'shield') owner.shieldT = this.time
    if (this.effect === 'focus') owner.focusT = this.time
    if (this.heal) owner.hp = Math.min(owner.maxHp, owner.hp + this.heal)
  }
}


// ---------- 몸을 옮기는 제품(움직이며 때리는 기술) ----------
// 위치는 시전한 사람 화면에서만 바꾼다. 다른 화면은 위치 동기화로 본다. 판정 길은 함께 놓는 Swing(anchor: 'origin')이 이벤트 자리로 계산한다.

// 돌진: time초 동안 a 쪽으로 dist만큼(앱 아이콘에서는 멈춘다)
export class Lunge {
  constructor({ owner, a, dist, time }) {
    Object.assign(this, { owner, a, dist, time })
  }

  place(world) {
    const player = playerById(world, this.owner)
    if (!player?.local || !player.alive) return
    player.lungeT = this.time
    player.lungeX = (Math.cos(this.a) * this.dist) / this.time
    player.lungeY = (Math.sin(this.a) * this.dist) / this.time
  }
}

// 순간이동: (x, y)로. delay가 있으면 그만큼 뒤에(되감기).
export class Teleport {
  constructor({ owner, x, y, delay = 0 }) {
    Object.assign(this, { owner, x, y, delay })
    this.kind = 'teleport' // 패링이 늦게 놓일 되감기를 찾을 표시(빌드하면 클래스 이름이 바뀌어 이름으로는 못 찾는다)
  }

  place(world) {
    if (this.delay > 0) {
      world.timers.push({ delay: this.delay, total: this.delay, part: new Teleport({ ...this, delay: 0 }) }) // total: 지난 시간을 셀 수 있게(늦은 패링)
      return
    }
    const player = playerById(world, this.owner)
    if (!player?.local || !player.alive) return
    Object.assign(player, { x: this.x, y: this.y, tx: this.x, ty: this.y })
    keepInside(player)
    world.signals.notify({ kind: 'blink', x: player.x, y: player.y, who: this.owner })
  }
}

// 도약: 위로 vz 속도로 뛰어오른다(내려앉는 시각은 정해져 있다).
export class Leap {
  constructor({ owner, vz }) {
    Object.assign(this, { owner, vz })
  }

  place(world) {
    const player = playerById(world, this.owner)
    if (!player?.local || !player.alive) return
    player.vz = Math.max(player.vz, this.vz)
  }
}

// 막기: time초 동안 주인 있는 피해를 한 번 막고 반격한다(world.applyDamage).
export class Block {
  constructor({ owner, time }) {
    Object.assign(this, { owner, time })
  }

  place(world) {
    const player = playerById(world, this.owner)
    if (!player) return
    effect(world, 'block', player.x, player.y - 26, '막기', this.owner)
    if (player.local) player.blockT = this.time
  }
}

// 순간이동 길 끝: (x, y)에서 a 쪽으로 dist까지 가다가 앱 아이콘·벽에 닿기 직전에서 멈춘다(순수 계산, 모든 화면이 같다).
export function blinkEnd(x, y, a, dist) {
  // 아이콘과의 거리는 keepInside처럼 둥근 모서리로 잰다(모서리 옆 설 수 있는 자리에서도 움직이게).
  const nearBox = (px, py, b) => Math.hypot(px - Math.min(Math.max(px, b.x), b.x + b.w), py - Math.min(Math.max(py, b.y), b.y + b.h)) < RADIUS - 0.01
  const clear = (px, py) => px >= AREA.x0 + RADIUS && px <= AREA.x1 - RADIUS && py >= AREA.y0 + RADIUS && py <= AREA.y1 - RADIUS && !OBSTACLES.some((b) => nearBox(px, py, b))
  let end = { x, y }
  for (let s = 4; s <= dist; s += 4) {
    const px = x + Math.cos(a) * s
    const py = y + Math.sin(a) * s
    if (!clear(px, py)) break
    end = { x: px, y: py }
  }
  return end
}

// ---------- Q 근접 기술: 저마다 cast(Factory Method)로 제품을 만든다 ----------
// kind: 봇이 언제 쓸지 — self(체력이 낮을 때), close(붙었을 때), mid(조금 떨어져 있을 때), block(상대가 준비 동작을 할 때), none

export const BASIC_SHOT = ATTACKS.unrecorded.shots[0]

const swingOf = (ev, move, extra = {}) => Swing.from(ev, move, extra)
// 드롭: 두 배로 뛰었을 때 떠 있는 시간(JUMP는 world.js 값이라 불러오는 순서와 상관없게 쓸 때 계산한다)
const airTime = () => (2 * JUMP.speed * 2) / JUMP.gravity
export const COUNTER = { shape: 'arc', reach: 60, width: 2.4, sweep: 1, windup: 0.05, active: 0.12, recovery: 0.25, damage: 12 }

export const SKILLS = {
  detox: {
    name: '디톡스 실드',
    desc: '2.5초 무적 + 체력 12 회복 + 주변을 밀어내는 파동. 폰을 줄인 사람만 쓰는 가장 강한 기술',
    cooldown: 14,
    kind: 'self',
    cast: (ev) => [
      new SelfEffect({ owner: ev.o, effect: 'shield', time: 2.5, heal: 12 }),
      new Shockwave({ owner: ev.o, x: ev.x, y: ev.y, r: 80, damage: Math.round(4 * (ev.m ?? 1)), push: 60, color: '#7fe7ff' }),
    ],
  },
  unrecorded: {
    name: '기술 없음',
    desc: '오늘 스크린 타임을 기록하면 앱 기술이 생겨요',
    cooldown: 99,
    kind: 'none',
    cast: () => [],
  },
  messenger: {
    name: '읽씹 태클',
    desc: '0.3초 앞으로 돌진해 길 위의 상대를 모두 치고 0.8초 기절시킨다',
    cooldown: 7,
    kind: 'mid',
    cast: (ev) => [
      new Lunge({ owner: ev.o, a: ev.a, dist: 110, time: 0.3 }),
      swingOf(ev, { shape: 'line', reach: 124, thick: 30, extend: true, windup: 0.02, active: 0.3, recovery: 0.2, damage: 5, stun: 0.8 }, { anchor: 'origin' }),
    ],
  },
  feed: {
    name: '좋아요 회오리',
    desc: '1초 동안 빙글빙글 돌며 둘레를 세 번 벤다(도는 동안 천천히 움직일 수 있다)',
    cooldown: 8,
    kind: 'close',
    cast: (ev) => [swingOf(ev, { shape: 'circle', reach: 52, hits: 3, windup: 0.1, active: 1, recovery: 0.2, damage: 3 })],
  },
  video: {
    name: '되감기',
    desc: '앞으로 돌진해 찌르고, 1초 뒤 처음 자리로 되돌아간다',
    cooldown: 8,
    kind: 'mid',
    cast: (ev) => [
      new Lunge({ owner: ev.o, a: ev.a, dist: 60, time: 0.15 }),
      swingOf(ev, { shape: 'line', reach: 90, thick: 22, extend: true, windup: 0.02, active: 0.18, recovery: 0.3, damage: 6, knock: 14 }, { anchor: 'origin' }),
      new Teleport({ owner: ev.o, x: ev.x, y: ev.y, delay: 1 }),
    ],
  },
  music: {
    name: '드롭',
    desc: '높이 뛰어올랐다가 내려앉으며 둘레를 내려찍는다(그때 떠 있으면 피한다)',
    cooldown: 9,
    kind: 'mid',
    cast: (ev) => [new Leap({ owner: ev.o, vz: JUMP.speed * 2 }), swingOf(ev, { shape: 'circle', reach: 62, ground: true, warn: true, windup: airTime(), active: 0.1, recovery: 0.35, damage: 7, knock: 16, stun: 0.3 })],
  },
  game: {
    name: '필살 콤보',
    desc: '제자리에서 다섯 번 난무한 뒤 마지막 타로 띄운다',
    cooldown: 8,
    kind: 'close',
    cast: (ev) => [
      swingOf(ev, { shape: 'arc', reach: 50, width: 1.8, sweep: 1, full: true, hits: 5, windup: 0.1, active: 0.75, recovery: 0.05, damage: 2 }),
      swingOf(ev, { shape: 'arc', reach: 52, width: 1.6, sweep: -1, full: true, windup: 0.9, active: 0.1, recovery: 0.3, damage: 3, launch: 220 }),
    ],
  },
  webtoon: {
    name: '컷 전환',
    desc: '보는 방향으로 최대 140 순간이동하며 지나간 줄을 벤다(앱 아이콘 앞에서 멈춘다)',
    cooldown: 9,
    kind: 'mid',
    cast: (ev) => {
      const end = blinkEnd(ev.x, ev.y, ev.a, 140)
      const dist = Math.hypot(end.x - ev.x, end.y - ev.y)
      return [new Teleport({ owner: ev.o, x: end.x, y: end.y }), swingOf(ev, { shape: 'line', reach: dist + 10, thick: 30, windup: 0.02, active: 0.12, recovery: 0.3, damage: 7 }, { anchor: 'origin' })]
    },
  },
  shopping: {
    name: '당일 배송',
    desc: '0.6초 모은 뒤 거대한 망치로 내려찍어 멀리 밀고 멈칫하게 한다',
    cooldown: 10,
    kind: 'close',
    cast: (ev) => [swingOf(ev, { shape: 'slam', reach: 62, radius: 38, windup: 0.6, active: 0.12, recovery: 0.5, damage: 8, knock: 26, stun: 0.35, warn: true })],
  },
  finance: {
    name: '손절 반격',
    desc: '0.8초 막기 자세. 그 사이 상대 공격을 맞으면 피해 없이 곧바로 반격 베기(피해 12)',
    cooldown: 9,
    kind: 'block',
    cast: (ev) => [new Block({ owner: ev.o, time: 0.8 })],
  },
  study: {
    name: '벼락치기',
    desc: '3초 동안 빨라지고 공격이 1.7배, 곧바로 세 번 찌른다',
    cooldown: 10,
    kind: 'close',
    cast: (ev) => [
      new SelfEffect({ owner: ev.o, effect: 'focus', time: 3, heal: 0 }),
      swingOf(ev, { shape: 'thrust', reach: 64, thick: 14, hits: 3, windup: 0.12, active: 0.36, recovery: 0.25, damage: 3 }),
    ],
  },
}

// ---------- 생산자(Creator) 표 ----------
// 시전 이벤트 ev: { k: 'shot'|'skill', o, x, y, a, s?, c?, e?, g?, p?, m? } (아이템 줍기 'pick'은 world.js가 따로 처리)
// 생산자마다 accepts(ev)로 자기가 맡을 이벤트인지 답하고, create(ev)로 제품 목록을 만든다. 위에서부터 처음 맞는 하나가 맡는다.
// 세계(world.spawnEvent)는 expandEvent가 돌려준 제품의 place(world)만 부르므로, 제품이 무엇인지 모른다.
// 새 종류의 공격은 생산자 하나를 이 표에 더하면 된다(세계·렌더러는 그대로).
export const CREATORS = [
  // 기본 공격: 무기(s)의 연속기 c번째 타 → 근접 휘두르기(melee.js Swing)
  { name: 'basic', accepts: (ev) => ev.k === 'shot', create: (ev) => [Swing.from(ev, moveOf(ev.s, ev.c ?? 0))] },
  // 막기 자세(guard.js Guard)
  { name: 'guard', accepts: (ev) => ev.g === 1, create: (ev) => [new Guard({ owner: ev.o })] },
  // 패링(guard.js Parried): p = 튕겨 낸 상대 id
  { name: 'parry', accepts: (ev) => ev.g === 2, create: (ev) => (typeof ev.p === 'string' ? [new Parried({ owner: ev.o, target: ev.p })] : []) },
  // E 원거리 기술(farSkills.js): 발사체·덫·포탑 등
  { name: 'far', accepts: (ev) => Boolean(ev.e), create: (ev) => farOf(ev.s).cast(ev) },
  // 손절 반격의 막기에서 나간 반격
  { name: 'counter', accepts: (ev) => ev.s === 'finance' && ev.c === 1, create: (ev) => [Swing.from(ev, COUNTER)] },
  // Q 근접 기술: 기술마다 cast가 Swing·Lunge·Teleport·Leap·Block·Shockwave·SelfEffect 등을 만든다
  { name: 'skill', accepts: (ev) => ev.k === 'skill', create: (ev) => (SKILLS[ev.s] ?? SKILLS.detox).cast(ev) },
]

export const creatorOf = (ev) => CREATORS.find((creator) => creator.accepts(ev)) ?? null

// 시전 이벤트 → 제품 목록
export function expandEvent(ev) {
  return creatorOf(ev)?.create(ev) ?? []
}