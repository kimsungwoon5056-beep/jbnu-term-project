import { addProjectile, applyDamage, ARENA, effect, keepInside, LAG, playerById, RADIUS } from './world'

// 앱 기술(Q): 머리에 스며든 1위 앱 유형마다 하나. 앱 조각이 없으면 가장 강한 "디톡스 실드".
// Factory Method: 기술마다 cast(ev)가 시전 이벤트(누가·어디서·어느 방향)로 "제품" 객체를 만든다.
// 제품(Projectile·Trap·Shockwave·SelfEffect)은 모두 place(world)로 스스로 세계에 놓인다.
// 그래서 세계(world.spawnEvent)는 제품 종류를 몰라도 되고, 새 기술은 cast만 쓰면 된다.
// 같은 이벤트면 어느 화면에서도 같은 결과가 나오도록 무작위를 쓰지 않는다.
// (world.js와 서로 가져오지만, world의 함수는 place 안에서만 부르므로 불러오는 순서와 상관없다.)

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// ---------- 제품: 세계에 놓이는 것들 ----------

// 발사체. 늦게 나가는 것(delay)은 대기 줄에, 바로 나가는 것은 발사체 풀(Object Pool)에 들어간다.
export class Projectile {
  constructor({ owner, x, y, vx, vy, r, damage, life, color, pierce, homing, delay }) {
    Object.assign(this, { owner, x, y, vx, vy, r, damage, life, color, pierce, homing, delay })
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
    })
  }

  // 이벤트를 ahead초 늦게 받았을 때(온라인): 최대 LAG.catchUp초만큼 앞당긴 새 발사체.
  // 연타처럼 늦게 나가는 것은 기다릴 시간을 줄이고, 이미 나간 것은 날아간 만큼 옮긴다.
  caughtUp(ahead) {
    const late = Math.min(LAG.catchUp, Math.max(0, ahead))
    if (late <= 0) return this
    if (this.delay >= late) return new Projectile({ ...this, delay: this.delay - late })
    const flown = late - this.delay
    return new Projectile({ ...this, delay: 0, x: this.x + this.vx * flown, y: this.y + this.vy * flown, life: this.life - flown })
  }

  place(world) {
    if (this.delay > 0) world.pending.push({ delay: this.delay, spec: this, from: this.owner })
    else addProjectile(world, this)
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

// 충격파: 놓이는 순간 둘레 안의 상대(내 화면에서 판정하는 사람)에게 피해를 주고 밀어낸다.
export class Shockwave {
  constructor({ owner, x, y, r, damage, push, color }) {
    Object.assign(this, { owner, x, y, r, damage, push, color })
  }

  place(world) {
    world.rings.push({ ...this, t: 0 })
    for (const player of world.players) {
      if (!player.local || player.id === this.owner || !player.alive) continue
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

export const BASIC_SHOT = { speed: 380, damage: 8, color: '#ffd84a' }

export const SKILLS = {
  detox: {
    name: '디톡스 실드',
    desc: '3초 동안 무적 + 체력 20 회복. 폰을 줄인 사람만 쓰는 가장 강한 기술',
    cooldown: 10,
    cast: (ev) => [new SelfEffect({ owner: ev.o, effect: 'shield', time: 3, heal: 20 })],
  },
  unrecorded: {
    name: '기술 없음',
    desc: '오늘 스크린 타임을 기록하면 앱 기술이 생겨요',
    cooldown: 99,
    cast: () => [],
  },
  messenger: {
    name: '단톡 폭탄',
    desc: '말풍선 3갈래를 두 번 던진다',
    cooldown: 6,
    cast: (ev) => [
      ...spread(ev, 3, 0.22, { speed: 320, damage: 6, color: '#fee500', r: 5 }),
      ...spread(ev, 3, 0.22, { speed: 320, damage: 6, color: '#fee500', r: 5, delay: 0.2 }),
    ],
  },
  feed: {
    name: '좋아요 폭발',
    desc: '하트 8개가 사방으로 터진다',
    cooldown: 7,
    cast: (ev) => spread(ev, 8, (Math.PI * 2) / 8, { speed: 300, damage: 7, color: '#e1306c', r: 5, life: 0.9 }),
  },
  video: {
    name: '자동 재생',
    desc: '조준한 곳에 재생 버튼 덫. 밟으면 0.8초 멈춤 + 피해 12',
    cooldown: 8,
    cast: (ev) => [
      new Trap({ owner: ev.o, x: ev.x + Math.cos(ev.a) * 120, y: ev.y + Math.sin(ev.a) * 120, r: 18, life: 6, damage: 12, stun: 0.8, color: '#ff1f3d' }),
    ],
  },
  music: {
    name: '볼륨 최대',
    desc: '주변을 밀어내는 충격파(피해 10)',
    cooldown: 7,
    cast: (ev) => [new Shockwave({ owner: ev.o, x: ev.x, y: ev.y, r: 95, damage: Math.round(10 * (ev.m ?? 1)), push: 70, color: '#833ab4' })],
  },
  game: {
    name: '연타',
    desc: '0.5초 동안 5발을 빠르게 쏜다',
    cooldown: 6,
    cast: (ev) => Array.from({ length: 5 }, (_, i) => Projectile.aimed(ev, ev.a, { speed: 420, damage: 6, color: '#6b5fd3', delay: i * 0.1 })),
  },
  webtoon: {
    name: '다음 화 보기',
    desc: '벽 전까지 꿰뚫는 빠른 광선(피해 14)',
    cooldown: 7,
    cast: (ev) => [Projectile.aimed(ev, ev.a, { speed: 700, damage: 14, color: '#00c85a', r: 6, pierce: true, life: 1 })],
  },
  shopping: {
    name: '로켓 배송',
    desc: '가장 가까운 상대를 쫓아가는 택배 상자(피해 16)',
    cooldown: 8,
    cast: (ev) => [Projectile.aimed(ev, ev.a, { speed: 230, damage: 16, color: '#c58b54', r: 7, homing: 3, life: 2.4 })],
  },
  finance: {
    name: '잔액 보호',
    desc: '2초 동안 무적',
    cooldown: 9,
    cast: (ev) => [new SelfEffect({ owner: ev.o, effect: 'shield', time: 2, heal: 0 })],
  },
  study: {
    name: '집중 모드',
    desc: '3초 동안 빨라지고 공격이 1.3배',
    cooldown: 9,
    cast: (ev) => [new SelfEffect({ owner: ev.o, effect: 'focus', time: 3, heal: 0 })],
  },
}

// 시전 이벤트 → 제품 목록. ev: { k: 'shot'|'skill', o, x, y, a, s?, m? } (아이템 줍기 'pick'은 world.js가 따로 처리)
// 기본 공격도 같은 제품(Projectile)을 만든다.
export function expandEvent(ev) {
  if (ev.k === 'shot') return [Projectile.aimed(ev, ev.a, BASIC_SHOT)]
  return (SKILLS[ev.s] ?? SKILLS.detox).cast(ev)
}
