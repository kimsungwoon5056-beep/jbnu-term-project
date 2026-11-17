import { skillOf } from './loadout'
import { Pool, seededRandom } from './pool'
import { expandEvent } from './skills'

// 대결 한 판의 세계와 한 걸음(stepWorld). 화면·네트워크와 떨어진 순수 계산이라 테스트할 수 있다.
// 판정은 "맞는 쪽"이 한다: local인 플레이어(내 캐릭터, 연습의 봇)만 피해를 계산하고, 상대는 네트워크로 받은 값을 쓴다.

export const ARENA = { w: 640, h: 400 }
// 가운데 장애물: 충전 거치대 모양 블록
export const OBSTACLES = [
  { x: 130, y: 150, w: 56, h: 100 },
  { x: 454, y: 150, w: 56, h: 100 },
  { x: 292, y: 64, w: 56, h: 36 },
  { x: 292, y: 300, w: 56, h: 36 },
]
export const SPAWNS = [
  [60, 60],
  [580, 340],
  [580, 60],
  [60, 340],
]
export const RADIUS = 14
export const MATCH_SECONDS = 90
export const SHOT_COOLDOWN = 0.35
export const DASH = { cooldown: 2.5, time: 0.18, slouchTime: 0.1, mult: 3.2 }
export const ALARM_EVERY = 10 // 알림 배지: 10초마다 멈칫
export const JITTER = 0.24 // 빙글 눈: 조준 흔들림(라디안 폭)
const FOCUS = { speed: 1.25, power: 1.3 }

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function createPlayer({ id, loadout, local = false, bot = false, spawn = 0 }) {
  const [x, y] = SPAWNS[spawn % SPAWNS.length]
  return {
    id,
    name: loadout.name,
    loadout,
    local,
    bot,
    x,
    y,
    tx: x,
    ty: y,
    aim: Math.atan2(ARENA.h / 2 - y, ARENA.w / 2 - x),
    moveX: 0,
    moveY: 0,
    hp: loadout.hp,
    maxHp: loadout.hp,
    alive: true,
    downAt: null,
    cd: { shot: 0, dash: 0, skill: 0 },
    dashT: 0,
    dashX: 0,
    dashY: 0,
    shieldT: 0,
    focusT: 0,
    stunT: 0,
    alarmT: ALARM_EVERY,
  }
}

const newProjectile = () => ({ hits: new Set() })

// players: [{ id, loadout, local, bot }], seed: 봇·흔들림용 씨앗
export function createWorld({ players, seed = 1, mode = 'practice' }) {
  return {
    mode,
    time: 0,
    over: false,
    players: players.map((player, i) => createPlayer({ ...player, spawn: i })),
    projectiles: new Pool(newProjectile),
    pending: [], // 늦게 나가는 발사체 { delay, spec }
    traps: [],
    rings: [],
    effects: [], // 화면 효과(피해 숫자·알림 등)
    outbox: [], // 내가 만든 시전 이벤트(온라인이면 보낸다)
    rng: seededRandom(seed),
  }
}

export const playerById = (world, id) => world.players.find((player) => player.id === id)
const invulnerable = (player) => player.shieldT > 0 || player.dashT > 0

function effect(world, kind, x, y, text = '') {
  world.effects.push({ kind, x, y, text, t: 0 })
}

export function applyDamage(world, player, damage) {
  if (!player.alive || invulnerable(player) || damage <= 0) return false
  player.hp = Math.max(0, player.hp - damage)
  effect(world, 'hit', player.x, player.y - 20, `-${damage}`)
  if (player.hp === 0) {
    player.alive = false
    player.downAt = world.time
    effect(world, 'down', player.x, player.y)
  }
  return true
}

// ---------- 시전 이벤트 → 세계에 생기는 것 ----------
function addProjectile(world, spec) {
  world.projectiles.acquire({ ...spec, active: true, hits: new Set() })
}

export function spawnEvent(world, ev) {
  for (const spec of expandEvent(ev)) {
    if (spec.type === 'proj') {
      if (spec.delay > 0) world.pending.push({ delay: spec.delay, spec, from: ev.o })
      else addProjectile(world, spec)
    } else if (spec.type === 'trap') {
      world.traps.push({ ...spec, x: clamp(spec.x, 20, ARENA.w - 20), y: clamp(spec.y, 20, ARENA.h - 20) })
    } else if (spec.type === 'ring') {
      world.rings.push({ ...spec, t: 0 })
      for (const player of world.players) {
        if (!player.local || player.id === spec.owner || !player.alive) continue
        const dx = player.x - spec.x
        const dy = player.y - spec.y
        const dist = Math.hypot(dx, dy)
        if (dist > spec.r + RADIUS) continue
        if (applyDamage(world, player, spec.damage) && dist > 0) {
          player.x += (dx / dist) * spec.push
          player.y += (dy / dist) * spec.push
          keepInside(player)
        }
      }
    } else if (spec.type === 'self') {
      const owner = playerById(world, spec.owner)
      if (!owner) continue
      effect(world, spec.effect, owner.x, owner.y - 26)
      if (!owner.local) continue
      if (spec.effect === 'shield') owner.shieldT = spec.time
      if (spec.effect === 'focus') owner.focusT = spec.time
      if (spec.heal) owner.hp = Math.min(owner.maxHp, owner.hp + spec.heal)
    }
  }
}

function emit(world, ev) {
  world.outbox.push(ev)
  spawnEvent(world, ev)
}

// ---------- Command: 입력 → 행동 ----------
const castEvent = (player, extra) => ({ o: player.id, x: Math.round(player.x), y: Math.round(player.y), m: player.focusT > 0 ? FOCUS.power : 1, ...extra })

export const COMMANDS = {
  move(world, player, { x = 0, y = 0 }) {
    const length = Math.hypot(x, y)
    player.moveX = length > 1 ? x / length : x
    player.moveY = length > 1 ? y / length : y
  },
  aim(world, player, { a }) {
    if (Number.isFinite(a)) player.aim = a
  },
  fire(world, player) {
    if (player.cd.shot > 0) return
    player.cd.shot = SHOT_COOLDOWN
    const jitter = player.loadout.debuffs.jitter ? (world.rng() - 0.5) * JITTER : 0
    emit(world, castEvent(player, { k: 'shot', a: Number((player.aim + jitter).toFixed(3)) }))
  },
  dash(world, player) {
    if (player.cd.dash > 0) return
    player.cd.dash = DASH.cooldown
    player.dashT = player.loadout.debuffs.slouch ? DASH.slouchTime : DASH.time
    const moving = Math.hypot(player.moveX, player.moveY) > 0.1
    player.dashX = moving ? player.moveX : Math.cos(player.aim)
    player.dashY = moving ? player.moveY : Math.sin(player.aim)
  },
  skill(world, player) {
    if (player.cd.skill > 0) return
    player.cd.skill = skillOf(player.loadout).cooldown
    emit(world, castEvent(player, { k: 'skill', s: player.loadout.skill, a: Number(player.aim.toFixed(3)) }))
  },
}

export function executeCommands(world, player, commands = []) {
  for (const command of commands) COMMANDS[command.type]?.(world, player, command)
}

// ---------- 움직임·충돌 ----------
function keepInside(player) {
  player.x = clamp(player.x, RADIUS, ARENA.w - RADIUS)
  player.y = clamp(player.y, RADIUS, ARENA.h - RADIUS)
  for (const box of OBSTACLES) {
    const nx = clamp(player.x, box.x, box.x + box.w)
    const ny = clamp(player.y, box.y, box.y + box.h)
    const dx = player.x - nx
    const dy = player.y - ny
    const dist = Math.hypot(dx, dy)
    if (dist >= RADIUS) continue
    if (dist === 0) {
      player.y = box.y - RADIUS
      continue
    }
    player.x = nx + (dx / dist) * RADIUS
    player.y = ny + (dy / dist) * RADIUS
  }
}

const insideWall = (x, y) => x < 0 || y < 0 || x > ARENA.w || y > ARENA.h || OBSTACLES.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)

function movePlayer(player, dt) {
  const speed = player.loadout.speed * (player.focusT > 0 ? FOCUS.speed : 1)
  if (player.dashT > 0) {
    player.x += player.dashX * speed * DASH.mult * dt
    player.y += player.dashY * speed * DASH.mult * dt
  } else if (player.stunT <= 0) {
    player.x += player.moveX * speed * dt
    player.y += player.moveY * speed * dt
  }
  keepInside(player)
}

function nearestEnemy(world, from, ownerId) {
  let best = null
  let bestDist = Infinity
  for (const player of world.players) {
    if (!player.alive || player.id === ownerId) continue
    const dist = Math.hypot(player.x - from.x, player.y - from.y)
    if (dist < bestDist) {
      best = player
      bestDist = dist
    }
  }
  return best
}

function tickTimers(world, player, dt) {
  for (const key of Object.keys(player.cd)) player.cd[key] = Math.max(0, player.cd[key] - dt)
  player.dashT = Math.max(0, player.dashT - dt)
  player.shieldT = Math.max(0, player.shieldT - dt)
  player.focusT = Math.max(0, player.focusT - dt)
  player.stunT = Math.max(0, player.stunT - dt)
  const badges = player.loadout.debuffs.badges
  if (badges > 0) {
    player.alarmT -= dt
    if (player.alarmT <= 0) {
      player.alarmT += ALARM_EVERY
      player.stunT = Math.max(player.stunT, badges * 0.3)
      effect(world, 'alarm', player.x, player.y - 30, '!')
    }
  }
}

// commands: { [playerId]: [명령…] } — local인 플레이어 것만 쓴다.
export function stepWorld(world, commands, dt) {
  if (world.over) return
  world.time += dt
  for (const player of world.players) {
    if (!player.alive) continue
    if (!player.local) {
      // 상대: 네트워크로 받은 위치로 부드럽게 따라간다(보간).
      const k = Math.min(1, dt * 12)
      player.x += (player.tx - player.x) * k
      player.y += (player.ty - player.y) * k
      continue
    }
    tickTimers(world, player, dt)
    if (player.stunT <= 0) executeCommands(world, player, commands[player.id])
    movePlayer(player, dt)
  }

  // 늦게 나가는 발사체(연타·두 번째 말풍선)
  for (const item of world.pending) {
    item.delay -= dt
    if (item.delay <= 0) addProjectile(world, { ...item.spec, delay: 0 })
  }
  world.pending = world.pending.filter((item) => item.delay > 0)

  // 발사체: 움직임, 벽, 맞는 쪽 판정
  for (const shot of world.projectiles.active) {
    if (shot.homing) {
      const target = nearestEnemy(world, shot, shot.owner)
      if (target) {
        const want = Math.atan2(target.y - shot.y, target.x - shot.x)
        const now = Math.atan2(shot.vy, shot.vx)
        const turn = clamp(((want - now + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -shot.homing * dt, shot.homing * dt)
        const speed = Math.hypot(shot.vx, shot.vy)
        shot.vx = Math.cos(now + turn) * speed
        shot.vy = Math.sin(now + turn) * speed
      }
    }
    shot.x += shot.vx * dt
    shot.y += shot.vy * dt
    shot.life -= dt
    if (shot.life <= 0 || insideWall(shot.x, shot.y)) {
      shot.active = false
      continue
    }
    for (const player of world.players) {
      if (!player.local || !player.alive || player.id === shot.owner || shot.hits.has(player.id)) continue
      if (Math.hypot(player.x - shot.x, player.y - shot.y) > RADIUS + shot.r) continue
      shot.hits.add(player.id)
      applyDamage(world, player, shot.damage)
      if (!shot.pierce) shot.active = false
    }
  }
  world.projectiles.sweep((shot) => shot.active)

  // 덫: 밟으면 피해 + 멈춤
  for (const trap of world.traps) {
    trap.life -= dt
    for (const player of world.players) {
      if (trap.life <= 0 || !player.local || !player.alive || player.id === trap.owner) continue
      if (Math.hypot(player.x - trap.x, player.y - trap.y) > RADIUS + trap.r) continue
      if (applyDamage(world, player, trap.damage)) player.stunT = Math.max(player.stunT, trap.stun)
      trap.life = 0
    }
  }
  world.traps = world.traps.filter((trap) => trap.life > 0)

  for (const ring of world.rings) ring.t += dt
  world.rings = world.rings.filter((ring) => ring.t < 0.4)
  for (const fx of world.effects) fx.t += dt
  world.effects = world.effects.filter((fx) => fx.t < 0.8)

  const alive = world.players.filter((player) => player.alive)
  if ((world.players.length >= 2 && alive.length <= 1) || world.time >= MATCH_SECONDS) world.over = true
}

// 상대 상태 반영(온라인): snap = { x, y, a, hp, alive }
export function applyRemote(world, id, snap) {
  const player = playerById(world, id)
  if (!player || player.local || !snap) return
  player.tx = snap.x
  player.ty = snap.y
  if (Number.isFinite(snap.a)) player.aim = snap.a
  if (Number.isFinite(snap.hp)) player.hp = snap.hp
  if (snap.alive === false && player.alive) {
    player.alive = false
    player.downAt = world.time
    effect(world, 'down', player.x, player.y)
  }
}

// 순위: 살아 있는 사람 → 남은 체력 비율 → 늦게 쓰러진 사람
export function rankPlayers(world) {
  return [...world.players].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1
    const ratio = b.hp / b.maxHp - a.hp / a.maxHp
    if (Math.abs(ratio) > 1e-9) return ratio
    return (b.downAt ?? 0) - (a.downAt ?? 0)
  })
}
