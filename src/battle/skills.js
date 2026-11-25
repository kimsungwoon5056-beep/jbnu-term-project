import { ATTACKS, attackOf } from './attacks'
import { addProjectile, applyDamage, ARENA, effect, keepInside, LAG, playerById, RADIUS, stepShot, truced } from './world'

// 앱 기술(Q): 머리에 스며든 1위 앱 유형마다 하나. 앱 조각이 없으면 가장 강한 "디톡스 실드".
// Factory Method: 기술마다 cast(ev)가 시전 이벤트(누가·어디서·어느 방향)로 "제품" 객체를 만든다.
// 제품(Projectile·Trap·Shockwave·SelfEffect)은 모두 place(world)로 스스로 세계에 놓인다.
// 그래서 세계(world.spawnEvent)는 제품 종류를 몰라도 되고, 새 기술은 cast만 쓰면 된다.
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
    for (const player of world.players) {
      if (!player.local || player.id === this.owner || !player.alive || truced(world, this.owner)) continue
      const dx = player.x - this.x
      const dy = player.y - this.y
      const dist = Math.hypot(dx, dy)
      if (dist > this.r + RADIUS) continue
      if (applyDamage(world, player, this.damage) && dist > 0) {
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

// ---------- 기술: 저마다 cast(Factory Method)로 제품을 만든다 ----------

const spread = (ev, count, gap, spec) =>
  Array.from({ length: count }, (_, i) => Projectile.aimed(ev, ev.a + (i - (count - 1) / 2) * gap, spec))

export const BASIC_SHOT = ATTACKS.unrecorded.shots[0]

const HEART = { speed: 300, damage: 8, color: '#e1306c', r: 7, life: 1, shape: 'heart' }

export const SKILLS = {
  detox: {
    name: '디톡스 실드',
    desc: '2.5초 무적 + 체력 12 회복 + 주변을 밀어내는 파동. 폰을 줄인 사람만 쓰는 가장 강한 기술',
    cooldown: 14,
    cast: (ev) => [
      new SelfEffect({ owner: ev.o, effect: 'shield', time: 2.5, heal: 12 }),
      new Shockwave({ owner: ev.o, x: ev.x, y: ev.y, r: 80, damage: 4, push: 60, color: '#7fe7ff' }),
    ],
  },
  unrecorded: {
    name: '기술 없음',
    desc: '오늘 스크린 타임을 기록하면 앱 기술이 생겨요',
    cooldown: 99,
    cast: () => [],
  },
  messenger: {
    name: '단톡 폭탄',
    desc: '커다란 말풍선이 날아가 터지며 알림 8개로 흩어진다',
    cooldown: 6,
    cast: (ev) => [
      Projectile.aimed(ev, ev.a, {
        speed: 260,
        damage: 7,
        color: '#fee500',
        r: 10,
        life: 0.75,
        shape: 'bubble',
        burst: { count: 8, spec: { speed: 260, damage: 5, color: '#fee500', r: 5, life: 0.6, shape: 'bubble' } },
      }),
    ],
  },
  feed: {
    name: '좋아요 소용돌이',
    desc: '하트 12개가 빙글빙글 돌며 퍼진다',
    cooldown: 5,
    cast: (ev) => Array.from({ length: 12 }, (_, i) => Projectile.aimed(ev, ev.a + (i * Math.PI) / 6, { ...HEART, delay: Math.floor(i / 2) * 0.07 })),
  },
  video: {
    name: '자동 재생',
    desc: '조준한 곳에 재생 버튼 덫과, 4초 동안 스스로 쏘는 재생기를 놓는다',
    cooldown: 8,
    cast: (ev) => [
      new Trap({ owner: ev.o, x: ev.x + Math.cos(ev.a) * 120, y: ev.y + Math.sin(ev.a) * 120, r: 18, life: 8, damage: 9, stun: 0.8, color: '#ff1f3d' }),
      new Turret({
        owner: ev.o,
        x: ev.x + Math.cos(ev.a) * 46,
        y: ev.y + Math.sin(ev.a) * 46,
        life: 4,
        every: 1,
        range: 260,
        color: '#ff1f3d',
        spec: { speed: 300, damage: 3, color: '#ff1f3d', r: 5, life: 1, shape: 'play' },
      }),
    ],
  },
  music: {
    name: '볼륨 최대',
    desc: '점점 커지는 소리 파동이 세 번 밀어낸다',
    cooldown: 7,
    cast: (ev) =>
      [
        [64, 6, 0],
        [92, 6, 0.35],
        [120, 7, 0.7],
      ].map(([r, damage, delay]) => new Shockwave({ owner: ev.o, x: ev.x, y: ev.y, r, damage: Math.round(damage * (ev.m ?? 1)), push: 46, color: '#833ab4', delay })),
  },
  game: {
    name: '필살 콤보',
    desc: '8발을 부채처럼 쓸어 쏜다',
    cooldown: 6,
    cast: (ev) => Array.from({ length: 8 }, (_, i) => Projectile.aimed(ev, ev.a + Math.sin((i / 7) * Math.PI * 2) * 0.22, { speed: 430, damage: 3, color: '#6b5fd3', r: 5, shape: 'pixel', delay: i * 0.07 })),
  },
  webtoon: {
    name: '다음 화 보기',
    desc: '벽 전까지 꿰뚫는 빠른 광선(피해 13)',
    cooldown: 7,
    cast: (ev) => [Projectile.aimed(ev, ev.a, { speed: 700, damage: 13, color: '#00c85a', r: 8, pierce: true, life: 1, shape: 'page' })],
  },
  shopping: {
    name: '로켓 배송',
    desc: '택배 상자 2개가 양옆으로 나가 가장 가까운 상대를 쫓아간다',
    cooldown: 8,
    cast: (ev) => [-0.5, 0.5].map((turn) => Projectile.aimed(ev, ev.a + turn, { speed: 230, damage: 7, color: '#c58b54', r: 7, homing: 8, life: 1.6, shape: 'box' })),
  },
  finance: {
    name: '잔액 방패',
    desc: '1.8초 무적이 되며 동전 6개를 뿌린다',
    cooldown: 9,
    cast: (ev) => [
      new SelfEffect({ owner: ev.o, effect: 'shield', time: 1.8, heal: 0 }),
      ...spread(ev, 6, (Math.PI * 2) / 6, { speed: 260, damage: 6, color: '#ffc928', r: 6, grow: 5, life: 0.9, shape: 'coin' }),
    ],
  },
  study: {
    name: '집중 모드',
    desc: '4초 동안 빨라지고 공격이 1.7배, 연필 3자루를 먼저 던진다',
    cooldown: 9,
    cast: (ev) => [
      new SelfEffect({ owner: ev.o, effect: 'focus', time: 4, heal: 0 }),
      ...spread(ev, 3, 0.16, { speed: 520, damage: 4, color: '#ffb21e', r: 4, shape: 'pencil' }),
    ],
  },
}

// 시전 이벤트 → 제품 목록. ev: { k: 'shot'|'skill', o, x, y, a, s?, m? } (아이템 줍기 'pick'은 world.js가 따로 처리)
// 기본 공격(attacks.js, s = 공격 열쇠)도 같은 제품(Projectile)을 만든다.
export function expandEvent(ev) {
  if (ev.k === 'shot') return attackOf(ev.s).shots.map((spec) => Projectile.aimed(ev, ev.a + (spec.angle ?? 0), spec))
  return (SKILLS[ev.s] ?? SKILLS.detox).cast(ev)
}
