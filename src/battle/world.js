import { skillOf } from './loadout'
import { Pool, seededRandom } from './pool'
import { bubbleY, buildSchedule, DRAIN, ITEM, itemAlive, ITEMS, safeArea, STORM } from './schedule'
import { expandEvent } from './skills'

// 대결 한 판의 세계와 한 걸음(stepWorld). 화면·네트워크와 떨어진 순수 계산이라 테스트할 수 있다.
// 판정은 "맞는 쪽"이 한다: local인 플레이어(내 캐릭터, 연습의 봇)만 피해를 계산하고, 상대는 네트워크로 받은 값을 쓴다.

// 경기장 = 세로 폰 화면. 맨 위 상태 표시줄과 맨 아래 독은 벽이고, 그 사이 홈 화면에서 싸운다.
export const ARENA = { w: 360, h: 600 }
export const AREA = { x0: 0, y0: 36, x1: 360, y1: 548 }
// 장애물: 홈 화면의 앱 아이콘(app: 그릴 앱 모양 키, appLook.js)
export const OBSTACLES = [
  { x: 52, y: 120, w: 56, h: 56, app: 'kakaotalk' },
  { x: 252, y: 120, w: 56, h: 56, app: 'instagram' },
  { x: 152, y: 264, w: 56, h: 56, app: 'youtube' },
  { x: 52, y: 408, w: 56, h: 56, app: 'tiktok' },
  { x: 252, y: 408, w: 56, h: 56, app: 'baemin' },
]
export const SPAWNS = [
  [40, 72],
  [320, 512],
  [320, 72],
  [40, 512],
]
export const RADIUS = 14
export const MATCH_SECONDS = 90
export const SHOT_COOLDOWN = 0.35
export const DASH = { cooldown: 2.5, time: 0.18, slouchTime: 0.1, mult: 3.2 }
export const ALARM_EVERY = 10 // 알림 배지: 10초마다 멈칫
export const JITTER = 0.24 // 빙글 눈: 조준 흔들림(라디안 폭)
const FOCUS = { speed: 1.25, power: 1.3 }
const KNOCKBACK = 7

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
    airT: 0, // 비행기 모드(무적)
    dndT: 0, // 방해 금지
    zoneT: 0,
    flashT: 0, // 맞았을 때 하얗게 번쩍이는 시간
    alarmT: ALARM_EVERY,
    stats: { items: 0, storm: 0, drain: 0, taken: 0 }, // 결과 화면용: 주운 아이템, 맞은 알림 말풍선, 꺼진 화면 피해, 받은 피해
  }
}

const newProjectile = () => ({ hits: new Set() })

const blocked = (x, y, r) => OBSTACLES.some((b) => x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r)

// players: [{ id, loadout, local, bot }], seed: 사건 일정·봇·흔들림용 씨앗
// events: false면 아이템·알림 폭풍·배터리 경고를 끈다(기본 규칙만 시험할 때)
export function createWorld({ players, seed = 1, mode = 'practice', events = true }) {
  const schedule = buildSchedule({ seed, seconds: MATCH_SECONDS, area: AREA, blocked })
  return {
    mode,
    events,
    schedule,
    items: schedule.items.map((item) => ({ ...item, taken: false })),
    stormHits: new Set(), // 이미 맞은 말풍선(말풍선 번호:플레이어)
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
const invulnerable = (player) => player.shieldT > 0 || player.dashT > 0 || player.airT > 0

// 화면 효과(Observer): 그리기·소리는 world.effects에 새로 생긴 것을 보고 반응한다. who = 일이 생긴 플레이어
function effect(world, kind, x, y, text = '', who = null) {
  world.effects.push({ kind, x, y, text, who, t: 0 })
}

// push: 맞은 방향(단위 벡터). 맞는 쪽 판정이라 내 화면의 내 캐릭터만 밀린다.
export function applyDamage(world, player, damage, push = null) {
  if (!player.alive || invulnerable(player) || damage <= 0) return false
  player.stats.taken += Math.min(player.hp, damage)
  player.hp = Math.max(0, player.hp - damage)
  player.flashT = 0.15
  if (push && player.local) {
    player.x += push.x * KNOCKBACK
    player.y += push.y * KNOCKBACK
    keepInside(player)
  }
  effect(world, 'hit', player.x, player.y - 20, `-${damage}`, player.id)
  if (player.hp === 0) {
    player.alive = false
    player.downAt = world.time
    effect(world, 'down', player.x, player.y, '', player.id)
  }
  return true
}

// ---------- 시전 이벤트 → 세계에 생기는 것 ----------
function addProjectile(world, spec) {
  world.projectiles.acquire({ ...spec, active: true, hits: new Set() })
}

// 아이템 줍기: 주운 사람 화면이 정하고 이벤트로 알린다. 받은 화면은 아이템을 없애기만 한다.
function pickItem(world, ev) {
  const item = world.items.find((candidate) => candidate.id === ev.i)
  if (!item || item.taken) return
  item.taken = true
  const info = ITEMS[item.kind]
  effect(world, 'item', item.x, item.y - 14, info.label, ev.o)
  const owner = playerById(world, ev.o)
  if (!owner?.local) return
  owner.stats.items += 1
  if (item.kind === 'airplane') owner.airT = info.time
  if (item.kind === 'charger') owner.hp = Math.min(owner.maxHp, owner.hp + info.heal)
  if (item.kind === 'dnd') owner.dndT = info.time
}

export function spawnEvent(world, ev) {
  if (ev.k === 'pick') {
    pickItem(world, ev)
    return
  }
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
    effect(world, 'shot', player.x, player.y, '', player.id)
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
  player.x = clamp(player.x, AREA.x0 + RADIUS, AREA.x1 - RADIUS)
  player.y = clamp(player.y, AREA.y0 + RADIUS, AREA.y1 - RADIUS)
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

const insideWall = (x, y) => x < AREA.x0 || y < AREA.y0 || x > AREA.x1 || y > AREA.y1 || OBSTACLES.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)

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
  player.airT = Math.max(0, player.airT - dt)
  player.dndT = Math.max(0, player.dndT - dt)
  const badges = player.loadout.debuffs.badges
  if (badges > 0) {
    player.alarmT -= dt
    if (player.alarmT <= 0) {
      player.alarmT += ALARM_EVERY
      // 방해 금지 중이면 알림이 울려도 멈칫하지 않는다.
      if (player.dndT > 0) effect(world, 'block', player.x, player.y - 30, '방해 금지')
      else {
        player.stunT = Math.max(player.stunT, badges * 0.3)
        effect(world, 'alarm', player.x, player.y - 30, '!')
      }
    }
  }
}

// ---------- 판 중간 사건: 아이템, 알림 폭풍, 배터리 경고 ----------
function stepItems(world) {
  for (const item of world.items) {
    if (!itemAlive(item, world.time)) continue
    for (const player of world.players) {
      if (!player.local || !player.alive) continue
      if (Math.hypot(player.x - item.x, player.y - item.y) > ITEM.pickRadius) continue
      emit(world, { k: 'pick', o: player.id, x: Math.round(player.x), y: Math.round(player.y), a: 0, i: item.id })
      break
    }
  }
}

function stepStorm(world) {
  for (const bubble of world.schedule.bubbles) {
    const y = bubbleY(bubble, world.time, AREA)
    if (y === null) continue
    for (const player of world.players) {
      if (!player.local || !player.alive) continue
      const key = `${bubble.id}:${player.id}`
      if (world.stormHits.has(key)) continue
      // 가로 판정 폭(23 + 5.6)은 줄 폭의 절반(30)보다 좁아서, 한 번 쏟아질 때 말풍선 하나에만 맞는다.
      if (Math.abs(player.x - bubble.x) > STORM.w / 2 + RADIUS * 0.4 || Math.abs(player.y - y) > STORM.h / 2 + RADIUS * 0.6) continue
      world.stormHits.add(key)
      if (player.dndT > 0) {
        effect(world, 'block', player.x, player.y - 30, '방해 금지')
        continue
      }
      if (applyDamage(world, player, STORM.damage)) {
        player.stunT = Math.max(player.stunT, STORM.stun)
        player.stats.storm += 1
      }
    }
  }
}

// 꺼진 화면 안에 있으면 0.5초마다 피해(초당 DRAIN.dps)
function stepDrain(world, dt) {
  const safe = safeArea(AREA, world.time)
  for (const player of world.players) {
    if (!player.local || !player.alive) continue
    const outside = player.x < safe.x0 || player.x > safe.x1 || player.y < safe.y0 || player.y > safe.y1
    if (!outside) {
      player.zoneT = 0
      continue
    }
    player.zoneT += dt
    if (player.zoneT >= 0.5) {
      player.zoneT -= 0.5
      if (applyDamage(world, player, DRAIN.dps / 2)) player.stats.drain += DRAIN.dps / 2
    }
  }
}

// commands: { [playerId]: [명령…] } — local인 플레이어 것만 쓴다.
export function stepWorld(world, commands, dt) {
  if (world.over) return
  world.time += dt
  for (const player of world.players) {
    player.flashT = Math.max(0, player.flashT - dt)
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
      const speed = Math.hypot(shot.vx, shot.vy) || 1
      applyDamage(world, player, shot.damage, { x: shot.vx / speed, y: shot.vy / speed })
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

  if (world.events) {
    stepItems(world)
    stepStorm(world)
    stepDrain(world, dt)
  }

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
  if (Number.isFinite(snap.hp)) {
    // 상대 화면이 판정한 피해도 내 화면에서 번쩍이고 숫자가 뜬다.
    if (snap.hp < player.hp && player.alive) {
      player.flashT = 0.15
      effect(world, 'hit', player.x, player.y - 20, `-${player.hp - snap.hp}`, player.id)
    }
    player.hp = snap.hp
  }
  if (snap.alive === false && player.alive) {
    player.alive = false
    player.downAt = world.time
    effect(world, 'down', player.x, player.y, '', player.id)
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
