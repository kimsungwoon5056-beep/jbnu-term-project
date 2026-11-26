import { Subject } from '../lib/subject'
import { AREA, ARENA, LIVES, MATCH_SECONDS, OBSTACLES, RADIUS, RESPAWN, SPAWNS } from './arena'
import { FAR, farOf } from './farSkills'
import { skillKey, skillOfPlayer } from './loadout'
import { COMBO_WINDOW, stepSwing, weaponOf } from './melee'
import { rulesOf } from './modes'
import { REPORT } from './modes/boss'
import { Pool, seededRandom } from './pool'
import { activeDive, bubbleY, buildSchedule, divePhase, DRAIN, ITEM, itemInfo, modeClock, itemAlive, safeOf, STORM, warningLanes } from './schedule'
import { expandEvent, Projectile, stepTurret } from './skills'

export { AREA, ARENA, LIVES, MATCH_SECONDS, OBSTACLES, RADIUS, RESPAWN, SPAWNS } from './arena'

// 대결 한 판의 세계와 한 걸음(stepWorld). 화면·네트워크와 떨어진 순수 계산이라 테스트할 수 있다.
// 판정은 "맞는 쪽"이 한다: local인 플레이어(내 캐릭터, 연습의 봇)만 피해를 계산하고, 상대는 네트워크로 받은 값을 쓴다.

export const SHOT_COOLDOWN = 0.5
export const DASH = { cooldown: 2.5, time: 0.18, slouchTime: 0.1, mult: 3.2 }
// 점프: 최고 높이 약 40(눈높이 26·탄 높이 20), 체공 약 0.6초. clear 이상이면 탄·덫·충격파가 아래로 지나간다(체공의 절반쯤).
// 땅에 내린 뒤 cooldown초가 지나야 다시 뛰고, 내린 직후 land초는 landSlow배로 느리다(Space만 누르고 있어도 무적이 되지 않게).
export const JUMP = { speed: 266, gravity: 890, clear: 28, cooldown: 0.5, land: 0.15, landSlow: 0.5 }
export const ALARM_EVERY = 10 // 알림 배지: 10초마다 멈칫
export const JITTER = 0.24 // 빙글 눈: 조준 흔들림(라디안 폭)
const FOCUS = { speed: 1.25, power: 1.7 }
// 온라인 지연 보정: 상대 위치는 받은 속도로 최대 predict초 앞까지 예측해 그리고, 늦게 받은 탄은 최대 catchUp초만큼 앞당긴다(skills.js의 Projectile.caughtUp).
export const LAG = { predict: 0.25, catchUp: 0.2, follow: 20 }
const KNOCKBACK = 7
// 판이 5분(목숨 3개)이 되어 인원이 적을수록 피해를 줄인다(정수로 반올림, 최소 1). 인원은 모든 화면에서 같다.
// 봇 실험으로 맞춘 값: 2인 판이 너무 빨리 끝나지 않고, 4인 판은 대부분 5분 안에 끝나게
export const DAMAGE_SCALE = { 2: 0.6, 3: 0.8, 4: 1 }
export const damageScale = (count) => DAMAGE_SCALE[count] ?? 1

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function createPlayer({ id, loadout, local = false, bot = false, spawn = 0, lives = LIVES }) {
  const [x, y] = SPAWNS[spawn % SPAWNS.length]
  return {
    id,
    slot: spawn % SPAWNS.length, // 처음 자리(다시 시작할 때 여기서 가장 가까운 켜진 자리로)
    lives, // 남은 목숨. 0이고 쓰러져 있으면 아웃
    respawnAt: null, // 다시 시작할 세계 시각(내 화면에서 판정하는 사람만)
    name: loadout.name,
    loadout,
    local,
    bot,
    x,
    y,
    tx: x,
    ty: y,
    vx: 0, // 상대: 최근 두 상태로 계산한 속도(예측용)
    vy: 0,
    predictT: 0, // 상대: 앞으로 더 예측할 시간
    lastSnap: null, // 상대: 마지막으로 받은 상태 { x, y, t }
    aim: Math.atan2(ARENA.h / 2 - y, ARENA.w / 2 - x),
    moveX: 0,
    moveY: 0,
    hp: loadout.hp,
    maxHp: loadout.hp,
    alive: true,
    downAt: null,
    cd: { shot: 0, dash: 0, skill: 0, jump: 0, far: 0 }, // far: E 원거리 기술
    combo: { step: 0, until: -1, queued: false }, // 근접 연속기: 지난 타 번호, 다음 타로 이을 수 있는 마지막 시각, 미리 누른 것
    attackSlow: 1, // 휘두르는 동안 이동 배율(melee.js가 정함)
    bleedT: 0, // 출혈 남은 초
    bleedDps: 0,
    bleedAcc: 0,
    blockT: 0, // 손절 반격: 막기 자세 남은 초
    lungeT: 0, // 돌진 기술: 남은 초와 속도
    lungeX: 0,
    lungeY: 0,
    dashT: 0,
    dashX: 0,
    dashY: 0,
    z: 0, // 높이(바닥 0)
    vz: 0,
    tz: 0, // 상대: 받은 높이
    landT: 0, // 내린 직후 느려지는 시간
    shieldT: 0,
    focusT: 0,
    stunT: 0,
    airT: 0, // 비행기 모드(무적)
    guardT: 0, // 다시 시작한 뒤의 무적(airT로 막고, 이것은 표시용)
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
// modes: 나올 모드를 정해 두려면 열쇠 목록(연습의 "앱 고르기")
// lives: 한 사람의 목숨(기본 3). 시험에서 한 번에 끝나는 판을 보려면 1
// damageScale: 피해 배율(기본은 인원별 DAMAGE_SCALE). 시험에서 기본 피해 규칙을 보려면 1
export function createWorld({ players, seed = 1, mode = 'practice', events = true, modes = null, lives = LIVES, damageScale: scale = damageScale(players.length) }) {
  const schedule = buildSchedule({ seed, seconds: MATCH_SECONDS, area: AREA, blocked, modes })
  return {
    playMode: mode, // practice | online
    events,
    mode: null, // 지금 켜져 있는 "앱 속으로" 모드 열쇠(modes/)
    modeDive: null,
    modeT: 0, // 모드가 켜진 뒤 흐른 초
    modeState: {}, // 모드가 쓰는 값
    boss: null,
    schedule,
    items: schedule.items.map((item) => ({ ...item, taken: false })),
    stormHits: new Set(), // 이미 맞은 말풍선(말풍선 번호:플레이어)
    announced: null, // 들어갔다고 알린 모드
    divePhase: 'none', // 앱 속으로 단계(바뀔 때 한 번만 알리려고)
    stormAlert: false, // 알림 폭풍 경고 중인지(경고가 시작될 때 한 번만 알리려고)
    signals: new Subject(), // Observer: 피격·아웃·아이템·발사·폭풍 경고·카운트다운 신호를 구독자(그리기·소리)에게 알린다
    time: 0,
    over: false,
    players: players.map((player, i) => createPlayer({ ...player, spawn: i, lives })),
    projectiles: new Pool(newProjectile),
    swings: [], // 근접 휘두르기(melee.js의 Swing)
    pending: [], // 늦게 나가는 발사체 { delay, spec }
    timers: [], // 늦게 놓이는 제품 { delay, part }(충격파 연타)
    turrets: [],
    traps: [],
    rings: [],
    effects: [], // 화면 효과(피해 숫자·알림 등)
    outbox: [], // 내가 만든 시전 이벤트(온라인이면 보낸다)
    rng: seededRandom(seed),
    damageScale: scale,
  }
}

export const playerById = (world, id) => world.players.find((player) => player.id === id)
// 마지막 목숨까지 잃었는지. 다시 시작을 기다리는 사람은 아직 남은 사람이다.
export const isOut = (player) => !player.alive && player.lives <= 0
export const remaining = (player) => !isOut(player)
// 공중에 높이 떠 있어 바닥 높이로 나는 탄·덫·충격파를 피하는지
export const aloft = (player) => player.z >= JUMP.clear
const invulnerable = (player) => player.shieldT > 0 || player.dashT > 0 || player.airT > 0

// 화면 효과: world.effects에 넣어 떠오르는 글자로 그리고, 같은 효과를 신호로 구독자에게 알린다(Observer). who = 일이 생긴 플레이어
// extra: 그리기에 쓸 값(맞은 방향 push 등)
export function effect(world, kind, x, y, text = '', who = null, extra = {}) {
  const fx = { kind, x, y, text, who, t: 0, ...extra }
  world.effects.push(fx)
  world.signals.notify(fx)
}

// push: 맞은 방향(단위 벡터). 맞는 쪽 판정이라 내 화면의 내 캐릭터만 밀린다.
// from: 때린 사람 id(주인이 없는 피해 — 알림 폭풍·배터리·출혈 — 는 null)
export function applyDamage(world, player, damage, push = null, from = null) {
  if (!player.alive || invulnerable(player) || damage <= 0) return false
  // 막기 자세(손절 반격): 주인 있는 피해를 한 번 막고, 내 화면이면 막은 공격의 주인 쪽으로 반격을 보낸다.
  const attacker = from && from !== player.id ? playerById(world, from) : null
  if (attacker && player.blockT > 0) {
    player.blockT = 0
    effect(world, 'block', player.x, player.y - 30, '반격!', player.id)
    if (player.local) emit(world, castEvent(world, player, { k: 'skill', s: 'finance', c: 1, a: Number(Math.atan2(attacker.y - player.y, attacker.x - player.x).toFixed(3)) }))
    return false
  }
  damage = Math.max(1, Math.round(damage * (world.damageScale ?? 1)))
  player.stats.taken += Math.min(player.hp, damage)
  player.hp = Math.max(0, player.hp - damage)
  player.flashT = 0.15
  if (push && player.local) {
    player.x += push.x * KNOCKBACK
    player.y += push.y * KNOCKBACK
    keepInside(player)
  }
  effect(world, 'hit', player.x, player.y - 20, `-${damage}`, player.id, { push, from })
  if (player.hp === 0) {
    player.alive = false
    player.downAt = world.time
    player.z = 0
    player.vz = 0
    // 걸려 있던 효과는 쓰러질 때 끝난다(쓰러진 동안 멈춰 있다가 다시 시작해서 이어 쓰지 않게).
    player.focusT = 0
    player.dndT = 0
    player.bleedT = 0
    player.bleedAcc = 0
    player.blockT = 0
    player.lungeT = 0
    player.lives = Math.max(0, player.lives - 1)
    player.respawnAt = player.lives > 0 ? world.time + RESPAWN.wait : null
    effect(world, 'down', player.x, player.y, '', player.id, { push, final: player.lives === 0 })
  }
  return true
}

// ---------- 시전 이벤트 → 세계에 생기는 것 ----------
// 발사체 풀에는 제품(Projectile)의 값만 복사해 넣는다(풀의 객체는 계속 다시 쓴다).
export function addProjectile(world, spec) {
  return world.projectiles.acquire({ ...spec, active: true, hits: new Set() })
}

// 광고 건너뛰기를 거의 동시에 밟았으면 먼저 밟은 사람(같으면 열쇠가 앞선 사람)이 이긴다. 진 사람의 무적은 거둔다.
function settleSkip(world, item, id, at) {
  if (item.kind !== 'skip' || item.by === id) return
  const earlier = at < item.at - 1e-6 || (Math.abs(at - item.at) <= 1e-6 && id < item.by)
  if (!earlier) return
  const loser = playerById(world, item.by)
  if (loser?.local) loser.airT = Math.min(loser.airT, Math.max(0, (item.airBefore ?? 0) - (world.time - item.at))) // 비행기 모드로 얻은 것은 남긴다
  Object.assign(item, { by: id, at })
  const winner = playerById(world, id)
  if (winner?.local) winner.airT = itemInfo('skip').time
}

// 아이템 줍기: 주운 사람 화면이 정하고 이벤트로 알린다. 받은 화면은 아이템을 없애기만 한다.
function pickItem(world, ev) {
  // 보스에게 준 피해 합계 알림(modes/boss.js)
  if (ev.i >= REPORT) {
    rulesOf(world)?.report?.(world, ev.o, ev.i - REPORT)
    return
  }
  const item = world.items.find((candidate) => candidate.id === ev.i)
  if (!item) return
  const at = Number.isFinite(ev.t) && Number.isFinite(world.startAt) ? (ev.t - world.startAt) / 1000 : world.time
  if (item.taken) {
    settleSkip(world, item, ev.o, at)
    return
  }
  Object.assign(item, { taken: true, by: ev.o, at })
  const info = itemInfo(item.kind)
  effect(world, 'item', item.x, item.y - 14, info.label, ev.o)
  const owner = playerById(world, ev.o)
  if (!owner?.local) return
  owner.stats.items += 1
  if (item.kind === 'skip') item.airBefore = owner.airT
  if (item.kind === 'airplane' || item.kind === 'skip') owner.airT = Math.max(owner.airT, info.time)
  if (item.kind === 'charger') owner.hp = Math.min(owner.maxHp, owner.hp + info.heal)
  if (item.kind === 'dnd') owner.dndT = info.time
}

// 시전 이벤트 → 기술이 만든 제품(skills.js의 Factory Method)을 세계에 놓는다.
// 세계는 제품이 발사체인지 덫인지 모른다. 제품마다 place(world)로 스스로 놓이고,
// 늦게 받은 이벤트(ahead초)는 앞당길 수 있는 제품(caughtUp이 있는 발사체)만 앞당긴다.
export function spawnEvent(world, ev, { ahead = 0 } = {}) {
  if (ev.k === 'pick') {
    pickItem(world, ev)
    return
  }
  // 쏘기·기술 자세는 내 것이든 받은 것이든 같은 신호로 알린다(내 쏘기는 fire에서 이미 알렸다).
  const owner = playerById(world, ev.o)
  if (owner && ev.k === 'skill' && (ev.s !== 'unrecorded' || ev.e)) world.signals.notify({ kind: 'skill', x: ev.x, y: ev.y, who: ev.o, e: ev.e ?? 0 })
  if (owner && ev.k === 'shot' && !owner.local) world.signals.notify({ kind: 'shot', x: ev.x, y: ev.y, who: ev.o, s: ev.s, c: ev.c ?? 0 })
  for (const part of expandEvent(ev)) {
    const placed = part.caughtUp ? part.caughtUp(ahead) : part
    placed.place(world)
  }
}

function emit(world, ev) {
  world.outbox.push(ev)
  spawnEvent(world, ev)
}

// ---------- Command: 입력 → 행동 ----------
const castEvent = (world, player, extra) => ({
  o: player.id,
  x: Math.round(player.x),
  y: Math.round(player.y),
  m: (player.focusT > 0 ? FOCUS.power : 1) * (rulesOf(world)?.power?.(world, player) ?? 1),
  ...extra,
})

export const COMMANDS = {
  move(world, player, { x = 0, y = 0 }) {
    const length = Math.hypot(x, y)
    player.moveX = length > 1 ? x / length : x
    player.moveY = length > 1 ? y / length : y
  },
  aim(world, player, { a }) {
    if (Number.isFinite(a)) player.aim = a
  },
  // 근접 연속기: 지난 타의 타격이 끝나고 COMBO_WINDOW 안이면 다음 타, 아니면 첫 타. 아직 못 치면 한 번 기억해 둔다.
  fire(world, player) {
    if (player.cd.shot > 0) {
      player.combo.queued = true
      return
    }
    const key = skillKey(player)
    const { combo } = weaponOf(key)
    const c = world.time <= player.combo.until ? (player.combo.step + 1) % combo.length : 0
    const move = combo[c]
    player.cd.shot = move.windup + move.active
    player.combo = { step: c, until: world.time + move.windup + move.active + COMBO_WINDOW, queued: false }
    effect(world, 'shot', player.x, player.y, '', player.id, { s: key, c })
    const jitter = player.loadout.debuffs.jitter ? (world.rng() - 0.5) * JITTER : 0
    emit(world, castEvent(world, player, { k: 'shot', s: key, c, a: Number((player.aim + jitter).toFixed(3)) }))
  },
  dash(world, player) {
    if (player.cd.dash > 0) return
    player.cd.dash = DASH.cooldown
    world.signals.notify({ kind: 'dash', x: player.x, y: player.y, who: player.id })
    player.dashT = player.loadout.debuffs.slouch ? DASH.slouchTime : DASH.time
    const moving = Math.hypot(player.moveX, player.moveY) > 0.1
    player.dashX = moving ? player.moveX : Math.cos(player.aim)
    player.dashY = moving ? player.moveY : Math.sin(player.aim)
  },
  jump(world, player) {
    if (player.z > 0 || player.cd.jump > 0 || player.stunT > 0) return
    player.vz = JUMP.speed
    world.signals.notify({ kind: 'jump', x: player.x, y: player.y, who: player.id })
  },
  // E 원거리 기술: 판이 시작하고 FAR.lock초 뒤부터, 쓰면 그 기술의 쿨다운(18초 안팎)을 기다린다.
  far(world, player) {
    if (world.time < FAR.lock || player.cd.far > 0) return
    const key = skillKey(player)
    player.cd.far = farOf(key).cooldown
    emit(world, castEvent(world, player, { k: 'skill', s: key, e: 1, a: Number(player.aim.toFixed(3)) }))
  },
  skill(world, player) {
    if (player.cd.skill > 0 || skillKey(player) === 'unrecorded') return
    player.cd.skill = skillOfPlayer(player).cooldown
    emit(world, castEvent(world, player, { k: 'skill', s: skillKey(player), a: Number(player.aim.toFixed(3)) }))
  },
}

export function executeCommands(world, player, commands = []) {
  for (const command of commands) COMMANDS[command.type]?.(world, player, command)
}

// ---------- 움직임·충돌 ----------
export function keepInside(player) {
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

export const speedOf = (player) => player.loadout.speed * (player.focusT > 0 ? FOCUS.speed : 1)

function movePlayer(world, player, dt) {
  const rules = rulesOf(world)
  if (rules?.move) {
    rules.move(world, player, dt)
    return
  }
  const speed = speedOf(player) * (player.landT > 0 ? JUMP.landSlow : 1)
  if (player.lungeT > 0) {
    // 돌진 기술: 정해진 속도로 곧장(앱 아이콘에서 멈춘다)
    player.x += player.lungeX * dt
    player.y += player.lungeY * dt
  } else if (player.dashT > 0) {
    player.x += player.dashX * speed * DASH.mult * dt
    player.y += player.dashY * speed * DASH.mult * dt
  } else if (player.stunT <= 0) {
    const slow = player.attackSlow ?? 1
    player.x += player.moveX * speed * slow * dt
    player.y += player.moveY * speed * slow * dt
  }
  keepInside(player)
}

// 다시 시작하는 자리: 처음 자리에서 가장 가까운, 꺼진 화면 밖이고 앱 아이콘과 겹치지 않는 곳(8px 격자에서 찾는다).
export function respawnSpot(world, player) {
  const [sx, sy] = SPAWNS[player.slot ?? 0]
  const safe = world.events ? safeOf(world, AREA) : AREA
  const x0 = Math.max(AREA.x0, safe.x0) + RADIUS
  const x1 = Math.min(AREA.x1, safe.x1) - RADIUS
  const y0 = Math.max(AREA.y0, safe.y0) + RADIUS
  const y1 = Math.min(AREA.y1, safe.y1) - RADIUS
  const free = (x, y) => !blocked(x, y, RADIUS)
  const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1
  if (inside(sx, sy) && free(sx, sy)) return { x: sx, y: sy }
  let best = null
  let bestDist = Infinity
  for (let x = x0; x <= x1; x += 8) {
    for (let y = y0; y <= y1; y += 8) {
      const dist = Math.hypot(x - sx, y - sy)
      if (dist < bestDist && free(x, y)) {
        best = { x, y }
        bestDist = dist
      }
    }
  }
  return best ?? { x: (AREA.x0 + AREA.x1) / 2, y: (AREA.y0 + AREA.y1) / 2 }
}

// 내 화면에서 판정하는 사람이 다시 시작한다: 꽉 찬 체력, 잠깐 무적, 쿨다운 없음.
function respawn(world, player) {
  const { x, y } = respawnSpot(world, player)
  Object.assign(player, { x, y, tx: x, ty: y, z: 0, vz: 0, hp: player.maxHp, alive: true, downAt: null, respawnAt: null, airT: RESPAWN.guard, guardT: RESPAWN.guard, stunT: 0, dashT: 0, landT: 0, zoneT: 0, blockT: 0, lungeT: 0 })
  // 다시 시작하면 쿨다운이 없다. E(원거리)만은 이어진다(자주 쓰지 않게).
  for (const key of Object.keys(player.cd)) if (key !== 'far') player.cd[key] = 0
  if (player.savedSkillCd !== undefined) player.savedSkillCd = 0 // 앱 업데이트가 끝날 때 원래 기술도 준비된 채로
  world.signals.notify({ kind: 'respawn', x, y, who: player.id })
}

// 높이: 떠 있으면 중력으로 떨어지고, 바닥에 닿으면 멈춘다(내린 때부터 다시 뛰기 대기).
function stepJump(player, dt) {
  if (player.z <= 0 && player.vz <= 0) return
  player.vz -= JUMP.gravity * dt
  player.z += player.vz * dt
  if (player.z > 0) return
  player.z = 0
  player.vz = 0
  player.landT = JUMP.land
  player.cd.jump = JUMP.cooldown
}

// 서로 피해를 주지 않는 때(보스 모드)에 사람이 쏜 것인지
export const truced = (world, ownerId) => Boolean(rulesOf(world)?.truce?.(world) && playerById(world, ownerId))

export function nearestEnemy(world, from, ownerId) {
  if (truced(world, ownerId)) return world.boss?.alive ? world.boss : null
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
  player.guardT = Math.max(0, (player.guardT ?? 0) - dt)
  player.blockT = Math.max(0, (player.blockT ?? 0) - dt)
  player.lungeT = Math.max(0, (player.lungeT ?? 0) - dt)
  player.dndT = Math.max(0, player.dndT - dt)
  player.landT = Math.max(0, player.landT - dt)
  // 출혈: 남은 시간 동안 초당 bleedDps씩(1씩 나눠서) 피해
  if (player.bleedT > 0) {
    const step = Math.min(dt, player.bleedT)
    player.bleedT = Math.max(0, player.bleedT - dt)
    player.bleedAcc += step * player.bleedDps
    while (player.bleedAcc >= 1 - 1e-6 && player.alive) {
      player.bleedAcc -= 1
      applyDamage(world, player, 1)
    }
    if (player.bleedT <= 0) player.bleedAcc = 0
  }
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
      // 주운 시각을 함께 보낸다(거의 동시에 주웠을 때 모든 화면이 같은 시각을 비교하게).
      const t = Number.isFinite(world.startAt) ? { t: world.startAt + world.time * 1000 } : {}
      emit(world, { k: 'pick', o: player.id, x: Math.round(player.x), y: Math.round(player.y), a: 0, i: item.id, ...t })
      break
    }
  }
}

function stepStorm(world) {
  // 경고가 처음 켜질 때 한 번 알린다(소리·화면이 각자 반응).
  const warning = warningLanes(world.schedule, world.time).size > 0
  if (warning && !world.stormAlert) world.signals.notify({ kind: 'storm', who: null })
  world.stormAlert = warning
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
        world.signals.notify({ kind: 'splat', x: player.x, y: player.y, text: bubble.kind, who: player.id })
      }
    }
  }
}

// 앱 속으로: 단계가 바뀌면 알리고, 모드가 켜지고 꺼질 때 그 모드의 규칙을 부른다. 무엇을 하는지는 모드 객체만 안다(modes/).
const DIVE_SIGNAL = { warn: 'glitch', in: 'dive', out: 'surface' }
function stepMode(world, dt) {
  const { phase, dive } = divePhase(world.schedule, world.time)
  const active = activeDive(world)
  if (active !== world.modeDive) {
    rulesOf(world)?.leave?.(world)
    world.modeDive = active
    world.mode = active?.mode ?? null
    world.modeState = {}
    world.modeT = modeClock(world).t
    rulesOf(world)?.enter?.(world)
  }
  if (active) {
    world.modeT = modeClock(world).t
    rulesOf(world)?.step?.(world, dt)
  }
  // 다른 탭에 있다 와서 시간이 건너뛰었어도 들어감·나옴을 빠뜨리지 않는다(음악·안내가 그대로 남지 않게).
  if (world.announced && world.announced !== active && world.announced !== dive) announce(world, 'surface', world.announced)
  if (phase !== world.divePhase) {
    world.divePhase = phase
    if (DIVE_SIGNAL[phase] && !(phase === 'in' && world.announced === dive)) announce(world, DIVE_SIGNAL[phase], dive)
  }
  if (active && world.announced !== active) announce(world, 'dive', active)
}

function announce(world, kind, dive) {
  if (kind === 'dive') world.announced = dive
  if (kind === 'surface') world.announced = null
  world.signals.notify({ kind, who: null, text: dive.mode })
}

// 꺼진 화면 안에 있으면 0.5초마다 피해(초당 DRAIN.dps)
function stepDrain(world, dt) {
  const safe = safeOf(world, AREA)
  for (const player of world.players) {
    if (!player.local || !player.alive) continue
    const outside = player.x < safe.x0 || player.x > safe.x1 || player.y < safe.y0 || player.y > safe.y1
    if (!outside) {
      // 잠깐 들어왔다 나가는 것으로 피해를 피하지 못하게 천천히 줄인다.
      player.zoneT = Math.max(0, player.zoneT - dt)
      continue
    }
    player.zoneT += dt
    if (player.zoneT >= 0.5) {
      player.zoneT -= 0.5
      if (applyDamage(world, player, DRAIN.dps / 2)) player.stats.drain += DRAIN.dps / 2
    }
  }
}

// 튕기기: 가로로만 움직였을 때 벽이면 가로를, 세로로만 움직였을 때 벽이면 세로를 뒤집고 제자리로 되돌린다.
function bounceShot(shot, fromX, fromY) {
  const flipX = insideWall(shot.x, fromY)
  const flipY = insideWall(fromX, shot.y)
  if (flipX || !flipY) shot.vx = -shot.vx
  if (flipY || !flipX) shot.vy = -shot.vy
  shot.x = fromX
  shot.y = fromY
  shot.bounce -= 1
}

// 터지기: 끝난 자리에서 사방으로 작은 탄이 나간다.
function burstShot(world, shot, x, y) {
  const { count, spec } = shot.burst
  for (let i = 0; i < count; i += 1) {
    const angle = Math.atan2(shot.dirY, shot.dirX) + (Math.PI * 2 * i) / count
    Projectile.aimed({ o: shot.owner, x: x - Math.cos(angle) * 14, y: y - Math.sin(angle) * 14 }, angle, spec).place(world)
  }
}

// 발사체 하나를 dt초 움직이고 벽·맞음을 본다. 늦게 받은 탄을 앞당길 때도 이 함수를 잘게 불러 벽과 사람을 건너뛰지 않는다(skills.js).
export function stepShot(world, shot, dt) {
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
  if (shot.accel) {
    shot.vx += shot.dirX * shot.accel * dt
    shot.vy += shot.dirY * shot.accel * dt
  }
  shot.age += dt
  if (shot.grow) shot.r = Math.min(15, shot.r + shot.grow * dt)
  const fromX = shot.x
  const fromY = shot.y
  // 출렁임: 나아가는 방향의 옆으로 흔든다.
  const sway = shot.wave ? Math.cos(shot.age * shot.wave.freq) * shot.wave.amp * shot.wave.freq * dt : 0
  shot.x += shot.vx * dt - shot.dirY * sway
  shot.y += shot.vy * dt + shot.dirX * sway
  shot.life -= dt
  const wall = insideWall(shot.x, shot.y)
  if (wall && shot.bounce > 0 && shot.life > 0) {
    bounceShot(shot, fromX, fromY)
  } else if (shot.life <= 0 || wall) {
    shot.active = false
    if (shot.burst) burstShot(world, shot, wall ? fromX : shot.x, wall ? fromY : shot.y)
    return
  }
  if (rulesOf(world)?.hitShot?.(world, shot)) {
    shot.active = false
    // 이 탄에 보스가 쓰러졌으면 터지지 않는다(휴전이 끝나자마자 옆 사람이 맞지 않게).
    if (shot.burst && world.boss?.alive) burstShot(world, shot, shot.x, shot.y)
    return
  }
  if (truced(world, shot.owner)) return
  for (const player of world.players) {
    if (!shot.active || !player.alive || player.id === shot.owner || shot.hits.has(player.id) || aloft(player)) continue
    if (Math.hypot(player.x - shot.x, player.y - shot.y) > RADIUS + shot.r) continue
    shot.hits.add(player.id)
    // 피해는 맞는 쪽 화면만 계산한다. 다른 화면에서는 꿰뚫지 않는 탄을 없애기만 한다(뒤에 선 사람까지 맞지 않게).
    if (player.local) {
      const speed = Math.hypot(shot.vx, shot.vy) || 1
      applyDamage(world, player, shot.damage, { x: shot.vx / speed, y: shot.vy / speed }, shot.owner)
    }
    if (!shot.pierce) {
      shot.active = false
      if (shot.burst) burstShot(world, shot, shot.x, shot.y)
    }
  }
}

// commands: { [playerId]: [명령…] } — local인 플레이어 것만 쓴다.
export function stepWorld(world, commands, dt) {
  if (world.over) return
  world.time += dt
  if (world.events) stepMode(world, dt)
  for (const player of world.players) {
    player.flashT = Math.max(0, player.flashT - dt)
    if (!player.alive) {
      rulesOf(world)?.fallen?.(player, dt)
      if (player.local && player.respawnAt !== null && world.time >= player.respawnAt) respawn(world, player)
      continue
    }
    if (!player.local) {
      // 상대: 받은 위치에서 움직이던 방향으로 잠깐 더 예측하고(다음 상태가 올 때까지), 그 자리로 빠르게 따라간다.
      if (player.predictT > 0) {
        const step = Math.min(dt, player.predictT)
        const { predict } = rulesOf(world) ?? {}
        if (predict) predict(player, step)
        else {
          player.tx += player.vx * step
          player.ty += player.vy * step
        }
        player.predictT -= step
        player.tx = clamp(player.tx, AREA.x0 + RADIUS, AREA.x1 - RADIUS)
        player.ty = clamp(player.ty, AREA.y0 + RADIUS, AREA.y1 - RADIUS)
      }
      const k = Math.min(1, dt * LAG.follow)
      player.x += (player.tx - player.x) * k
      player.y += (player.ty - player.y) * k
      const z = player.z
      player.z += (player.tz - player.z) * k // 받은 높이로 떠오른다
      player.vz = dt > 0 ? (player.z - z) / dt : 0 // 오르는지 내리는지(뛰는 자세)
      keepInside(player) // 예측·보간하다 앱 아이콘 속으로 들어가 보이지 않게
      continue
    }
    tickTimers(world, player, dt)
    if (player.stunT <= 0) {
      executeCommands(world, player, commands[player.id])
      // 미리 눌러 둔 다음 타: 칠 수 있게 되면 바로(창이 지나면 잊는다)
      if (player.combo.queued && player.cd.shot <= 0) {
        if (world.time <= player.combo.until) COMMANDS.fire(world, player)
        else player.combo.queued = false
      }
    }
    movePlayer(world, player, dt)
    stepJump(player, dt)
  }

  // 늦게 나가는 발사체(연타·두 번째 말풍선)
  for (const item of world.pending) {
    item.delay -= dt
    if (item.delay <= 0) addProjectile(world, { ...item.spec, delay: 0 })
  }
  world.pending = world.pending.filter((item) => item.delay > 0)

  // 늦게 놓이는 제품과 포탑
  for (const timer of world.timers) {
    timer.delay -= dt
    if (timer.delay <= 0) timer.part.place(world)
  }
  world.timers = world.timers.filter((timer) => timer.delay > 0)
  for (const turret of world.turrets) stepTurret(world, turret, dt, nearestEnemy(world, turret, turret.owner))
  world.turrets = world.turrets.filter((turret) => turret.life > 0)

  // 발사체: 움직임, 벽, 맞는 쪽 판정
  for (const shot of world.projectiles.active) if (shot.active) stepShot(world, shot, dt)
  world.projectiles.sweep((shot) => shot.active)

  // 근접 휘두르기: 단계, 주인 감속(다음 걸음 이동에 쓴다), 맞는 쪽 판정
  for (const player of world.players) player.attackSlow = 1
  for (const swing of world.swings) stepSwing(world, swing, dt)
  world.swings = world.swings.filter((swing) => !swing.done)

  // 덫: 밟으면 피해 + 멈춤
  for (const trap of world.traps) {
    trap.life -= dt
    if (trap.life > 0 && rulesOf(world)?.hitArea?.(world, trap.owner, trap.x, trap.y, trap.r, trap.damage)) trap.life = 0
    for (const player of world.players) {
      if (trap.life <= 0 || !player.alive || player.id === trap.owner || truced(world, trap.owner) || aloft(player)) continue
      if (Math.hypot(player.x - trap.x, player.y - trap.y) > RADIUS + trap.r) continue
      if (player.local && applyDamage(world, player, trap.damage, null, trap.owner)) player.stunT = Math.max(player.stunT, trap.stun)
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

  const left = world.players.filter(remaining)
  if ((world.players.length >= 2 && left.length <= 1) || world.time >= MATCH_SECONDS) world.over = true
}

// 상대 상태 반영(온라인): snap = { x, y, a, hp, alive }
// now: 서버 기준 지금 시각(ms). snap.t(보낸 시각)와 함께 있으면, 오는 동안 움직였을 만큼 앞을 예측한다.
export function applyRemote(world, id, snap, { now = null } = {}) {
  const player = playerById(world, id)
  if (!player || player.local || !snap || isOut(player)) return // 아웃된 사람은 다시 움직이지 않는다.
  if (Number.isFinite(player.lastSnap?.t) && Number.isFinite(snap.t) && snap.t < player.lastSnap.t && snap.alive !== false) return // 늦게 온 옛 상태
  if (Number.isFinite(snap.l)) player.lives = Math.min(player.lives, snap.l)
  if (!player.alive) {
    // 다시 시작을 기다리는 상대: 쓰러짐이 다시 와도 그대로, 다시 시작했으면 그 자리로 바로 옮긴다.
    if (snap.alive !== true) {
      // 소식을 받은 때는 늘 앞으로(소식 없음 검사와 끊겼을 때의 아웃 시각이 쓰러진 때에 묶이지 않게)
      if (Number.isFinite(snap.t) && !(snap.t <= player.lastSnap?.t)) player.lastSnap = { ...(player.lastSnap ?? { x: player.x, y: player.y }), t: snap.t }
      if (snap.alive === false && !(snap.l > 0)) goneFor(world, player, snap)
      return
    }
    Object.assign(player, { alive: true, x: snap.x, y: snap.y, tx: snap.x, ty: snap.y, vx: 0, vy: 0, predictT: 0, lastSnap: null, downAt: null, flashT: 0 })
    if (Number.isFinite(snap.hp)) player.hp = snap.hp
  }
  const prev = player.lastSnap
  if (Number.isFinite(snap.t) && prev && snap.t > prev.t) {
    // 최근 두 상태로 속도를 구한다(대시보다 빠를 수는 없다).
    // 이전 속도와 반씩 섞어 들쭉날쭉한 간격에도 부드럽게 한다.
    const seconds = (snap.t - prev.t) / 1000
    const max = player.loadout.speed * DASH.mult
    player.vx = (player.vx + clamp((snap.x - prev.x) / seconds, -max, max)) / 2
    // 중력이 있으면 속도가 빠르게 바뀌므로 섞지 않고 방금 값을 쓴다.
    const vy = clamp((snap.y - prev.y) / seconds, -max * 2, max * 2)
    player.vy = rulesOf(world)?.predict ? vy : (player.vy + clamp(vy, -max, max)) / 2
  } else if (!prev || snap.t !== prev.t) {
    player.vx = 0
    player.vy = 0
  } else if (Number.isFinite(prev.vy)) player.vy = prev.vy // 같은 상태가 다시 왔다: 예측하며 더해진 중력을 되돌리고 다시 예측한다.
  if (Number.isFinite(snap.t)) player.lastSnap = { x: snap.x, y: snap.y, t: snap.t, vy: player.vy }
  const travel = Number.isFinite(snap.t) && now !== null ? Math.min(LAG.predict, Math.max(0, (now - snap.t) / 1000)) : 0
  player.tx = snap.x
  player.ty = snap.y
  const { predict } = rulesOf(world) ?? {}
  if (predict) for (let left = travel; left > 1e-6; left -= 1 / 60) predict(player, Math.min(1 / 60, left))
  else {
    player.tx += player.vx * travel
    player.ty += player.vy * travel
  }
  player.predictT = snap.alive === false ? 0 : LAG.predict - travel
  if (Number.isFinite(snap.a)) player.aim = snap.a
  player.tz = Number.isFinite(snap.z) ? Math.max(0, snap.z) : 0
  if (Number.isFinite(snap.hp)) {
    // 상대 화면이 판정한 피해도 내 화면에서 번쩍이고 숫자가 뜬다.
    if (snap.hp < player.hp && player.alive) {
      player.flashT = 0.15
      effect(world, 'hit', player.x, player.y - 20, `-${player.hp - snap.hp}`, player.id)
    }
    player.hp = snap.hp
  }
  if (snap.alive === false) {
    player.alive = false
    player.hp = 0
    player.z = 0
    player.tz = 0
    if (!(snap.l > 0)) player.lives = 0 // 목숨을 알리지 않는 상태(끊김·옛 판)는 아웃
    player.downAt = downTime(world, snap)
    effect(world, 'down', player.x, player.y, '', player.id, { final: player.lives === 0 })
  }
}

const downTime = (world, snap) => (Number.isFinite(snap.t) && Number.isFinite(world.startAt) ? (snap.t - world.startAt) / 1000 : world.time)

// 기다리던 상대가 아웃되었다(끊김 등). 쓰러진 모습은 이미 있으니 순위의 때만 고친다.
function goneFor(world, player, snap) {
  player.lives = 0
  player.downAt = downTime(world, snap)
}

// 순위: 아웃되지 않은 사람 → 남은 목숨 → 남은 체력 비율(기다리는 사람은 0) → 늦게 쓰러진 사람
export function rankPlayers(world) {
  return [...world.players].sort((a, b) => {
    if (isOut(a) !== isOut(b)) return isOut(a) ? 1 : -1
    if (a.lives !== b.lives) return b.lives - a.lives
    const ratio = b.hp / b.maxHp - a.hp / a.maxHp
    if (Math.abs(ratio) > 1e-9) return ratio
    const down = (b.downAt ?? 0) - (a.downAt ?? 0)
    if (Math.abs(down) > 1e-6) return down
    return a.id < b.id ? -1 : 1 // 완전히 같으면 모든 화면에서 같은 순서
  })
}

const sameResult = (a, b) => isOut(a) === isOut(b) && a.lives === b.lives && Math.abs(a.hp / a.maxHp - b.hp / b.maxHp) < 1e-9 && Math.abs((a.downAt ?? 0) - (b.downAt ?? 0)) < 1e-6

// 무승부: 1위와 완전히 같은 결과(같은 체력 비율, 또는 같은 순간에 쓰러짐)인 사람들. 혼자 1위면 빈 목록
export function drawIds(ranking) {
  const top = ranking.filter((player) => sameResult(player, ranking[0]))
  return top.length > 1 ? top.map((player) => player.id) : []
}
