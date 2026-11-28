import { FAR } from './farSkills'
import { GUARD } from './guard'
import { skillKey, skillOfPlayer } from './loadout'
import { clearPath, swingPhase, weaponOf } from './melee'
import { bubbleY, itemAlive, safeOf, STORM, warningLanes } from './schedule'
import { AREA, playerById, RADIUS, truced } from './world'
import { swipeComing } from './modes/shorts'

// Strategy: 이번 걸음에 할 명령을 고른다. 공통 인터페이스는 commands(world, me) → [명령…]
// 같은 인터페이스를 가진 것: 봇 성격 kiter·rusher(여기), 사람 입력 InputController(input.js).
// PracticeLoop(loop.js)는 플레이어마다 전략 객체를 들고 commands만 부르므로, 누가 사람이고 어떤 봇인지 모른다.
// 봇은 world.rng(씨앗 고정)만 쓰므로 같은 세계·같은 씨앗이면 같은 행동이다.

function nearestTarget(world, bot) {
  // 보스가 있으면 모두 보스를 노린다.
  if (world.boss?.alive) return { player: world.boss, dist: Math.hypot(world.boss.x - bot.x, world.boss.y - bot.y) }
  let best = null
  for (const player of world.players) {
    if (!player.alive || player.id === bot.id) continue
    const dist = Math.hypot(player.x - bot.x, player.y - bot.y)
    if (!best || dist < best.dist) best = { player, dist }
  }
  return best
}

function incoming(world, bot) {
  return world.projectiles.active.some((shot) => {
    if (shot.owner === bot.id || truced(world, shot.owner)) return false
    const dx = bot.x - shot.x
    const dy = bot.y - shot.y
    const dist = Math.hypot(dx, dy)
    return dist < 70 && (dx * shot.vx + dy * shot.vy) / (dist * Math.hypot(shot.vx, shot.vy) || 1) > 0.8
  })
}

const toward = (bot, x, y) => {
  const length = Math.hypot(x - bot.x, y - bot.y) || 1
  return { x: (x - bot.x) / length, y: (y - bot.y) / length }
}

// ---------- 판 중간 사건에 맞춘 움직임(없으면 null) ----------
// 꺼진 화면 가장자리에 있으면 안쪽 가운데로
function escapeDrain(world, bot) {
  const safe = safeOf(world, AREA)
  if (bot.x < safe.x0 + 10 || bot.x > safe.x1 - 10 || bot.y < safe.y0 + 10 || bot.y > safe.y1 - 10) {
    return toward(bot, (safe.x0 + safe.x1) / 2, (safe.y0 + safe.y1) / 2)
  }
  return null
}

// 알림 폭풍이 오는 줄이면 가장 가까운 안전한 줄로 옆걸음
function dodgeStorm(world, bot) {
  const { laneW } = world.schedule
  const lane = Math.floor((bot.x - AREA.x0) / laneW)
  const danger = warningLanes(world.schedule, world.time)
  for (const bubble of world.schedule.bubbles) {
    const y = bubbleY(bubble, world.time, AREA)
    if (y !== null && y < bot.y + STORM.h && bot.y - y < 220) danger.add(bubble.lane)
  }
  if (!danger.has(lane)) return null
  for (let step = 1; step < 6; step += 1) {
    for (const next of [lane - step, lane + step]) {
      if (next < 0 || next * laneW >= AREA.x1 || danger.has(next)) continue
      return { x: Math.sign(next - lane), y: 0 }
    }
  }
  return null
}

// 200 안에 아이템이 있으면 주우러
function nearItem(world, bot) {
  const item = world.items
    .filter((candidate) => itemAlive(candidate, world.time))
    .map((candidate) => ({ candidate, dist: Math.hypot(candidate.x - bot.x, candidate.y - bot.y) }))
    .sort((a, b) => a.dist - b.dist)[0]
  return item && item.dist < 200 ? toward(bot, item.candidate.x, item.candidate.y) : null
}

// Q 근접 기술을 쓸 만한가(기술의 kind): self는 체력이 60% 밑일 때, close는 리치 안, mid는 리치 밖 150 안, block은 상대가 나를 노리고 준비할 때
const wantsSkill = (world, bot, gap, reach) => {
  const kind = skillOfPlayer(bot).kind
  if (kind === 'self') return bot.hp < bot.maxHp * 0.6
  if (kind === 'close') return gap <= reach + 10
  if (kind === 'mid') return gap > reach * 0.6 && gap < 150
  if (kind === 'block') return Boolean(threat(world, bot))
  return false
}
// E 원거리 기술: 멀리 있고 쓸 수 있으면 가끔
const wantsFar = (world, bot, gap) => world.time >= FAR.lock && bot.cd.far <= 0 && gap > 140 && world.rng() < 0.04

// 옆으로 도는 방향(1 또는 -1)은 1.2~2.2초마다 바뀐다. 봇 플레이어 객체에 적어 둔다.
function strafeOf(world, bot) {
  bot.strafe ??= world.rng() < 0.5 ? 1 : -1
  bot.strafeT = (bot.strafeT ?? 1.5) - 1 / 60
  if (bot.strafeT <= 0) {
    bot.strafe = world.rng() < 0.5 ? 1 : -1
    bot.strafeT = 1.2 + world.rng()
  }
  return bot.strafe
}

// ---------- 근접 ----------
// 무기의 첫 타 리치. 맞는 상대와의 틈(gap)은 몸 두께(보스는 크기)를 뺀 거리다.
const reachOf = (me) => weaponOf(skillKey(me)).combo[0].reach
const gapOf = (target) => target.dist - (target.player.r ?? RADIUS)

// 나를 노리고 준비 중인 휘두르기(리치 안). 내려찍기면 뛰어서, 아니면 물러나거나 대시로 피한다.
function threat(world, me) {
  for (const swing of world.swings) {
    // 보스 휴전 중 사람의 휘두르기는 사람을 때리지 않으니 위험이 아니다.
    if (swing.owner === me.id || truced(world, swing.owner) || swingPhase(swing).phase !== 'windup') continue
    const owner = playerById(world, swing.owner)
    if (!owner) continue
    const ox = swing.anchor === 'origin' ? swing.x : owner.x
    const oy = swing.anchor === 'origin' ? swing.y : owner.y
    if (Math.hypot(me.x - ox, me.y - oy) <= swing.move.reach + RADIUS + 6) return swing
  }
  return null
}

// 짧은 영상: 넘기기 파도가 곧 닿으면 대개 뛰어 넘는다(때릴 상대가 없어도).
function hopWave(world, me) {
  if (world.mode !== 'shorts' || me.z !== 0 || me.cd.jump > 0 || !swipeComing(world, me, 0.3)) return []
  return world.rng() < 0.7 ? [{ type: 'jump' }] : []
}

// 탄이 오면 가끔 뛰어 넘고(뛸 수 있을 때), 아니면 가끔 대시로 피한다.
function dodge(world, me, dashChance) {
  if (me.z === 0 && me.cd.jump <= 0 && world.rng() < 0.25) return [{ type: 'jump' }]
  return world.rng() < dashChance ? [{ type: 'dash' }] : []
}

// 휘두르기를 피한다: 내려찍기는 뛰고, 나머지는 가끔 대시(뒤로 물러나는 이동과 함께).
function dodgeSwing(world, me, swing, dashChance) {
  if (swing.move.shape === 'slam') return me.z === 0 && me.cd.jump <= 0 && world.rng() < 0.5 ? [{ type: 'jump' }] : []
  return me.cd.dash <= 0 && world.rng() < dashChance ? [{ type: 'dash' }] : []
}

// 나를 노린 휘두르기마다 한 번 chance로 막기로 정한다. 정했으면 치지 않고 기다리다가
// 남은 준비가 패링 시간보다 짧아지면 막는다(잘 맞으면 패링). 돌려주는 값: null(막지 않음) · [](기다림) · [막기]
function guardSwing(world, me, swing, chance) {
  if (!swing || me.cd.guard > 0 || me.defendT > 0) return null
  if (me.guardPlan?.swing !== swing) me.guardPlan = { swing, will: world.rng() < chance }
  if (!me.guardPlan.will) return null
  return swing.move.windup - swing.t <= GUARD.parry * 0.9 ? [{ type: 'guard' }] : []
}

const along = (angle, forward, side, sideways) => ({
  type: 'move',
  x: Math.cos(angle) * forward + Math.cos(angle + Math.PI / 2) * side * sideways,
  y: Math.sin(angle) * forward + Math.sin(angle + Math.PI / 2) * side * sideways,
})

// 다가가는데 바로 앞(PROBE)이 앱 아이콘에 막히면 막히지 않는 쪽으로 비켜 간다(근접은 붙어야 때린다).
const PROBE = 40
const open = (me, angle) => clearPath(me.x, me.y, me.x + Math.cos(angle) * (PROBE + RADIUS), me.y + Math.sin(angle) * (PROBE + RADIUS))
function detour(me, player, angle, forward, side, sideways) {
  if (forward <= 0 || open(me, angle)) return along(angle, forward, side, sideways)
  for (const turn of [0.6, 1.1, 1.6]) {
    for (const sign of [side, -side]) {
      const heading = angle + turn * sign
      if (open(me, heading)) return { type: 'move', x: Math.cos(heading), y: Math.sin(heading) }
    }
  }
  return along(angle, 0, side, 1)
}

// ---------- 전략 1: 거리 유지형(치고 빠지기) ----------
// 리치 끝까지 다가가 두 타를 치고, 잠깐(HIT_RUN.back초) 물러났다가 다시 들어간다. 옆으로 돌며 사건에 맞춰 움직인다.
// 상대가 준비 동작을 하면 물러나거나 대시·점프로 피한다.
const HIT_RUN = { back: 0.7, edge: 0.85 }

export const kiter = {
  name: 'kiter',
  label: '거리 유지형',
  commands(world, me) {
    const hop = hopWave(world, me)
    const target = nearestTarget(world, me)
    if (!target) return [{ type: 'move', x: 0, y: 0, ...(world.events ? (escapeDrain(world, me) ?? dodgeStorm(world, me) ?? nearItem(world, me) ?? {}) : {}) }, ...hop]
    const { player } = target
    const gap = gapOf(target)
    const reach = reachOf(me)
    const angle = Math.atan2(player.y - me.y, player.x - me.x)
    const strafe = strafeOf(world, me)
    // 두 번째 타까지 쳤으면 물러난다.
    if (me.combo.step >= 1 && world.time < me.combo.until && !(me.backT > world.time)) me.backT = world.time + HIT_RUN.back
    const danger = threat(world, me)
    const backing = me.backT > world.time || Boolean(danger)
    const approach = backing ? -1 : gap > reach * HIT_RUN.edge ? 1 : 0
    const move = detour(me, player, angle, approach, strafe, approach === 0 ? 0.8 : 0.4)
    if (world.events && !danger) Object.assign(move, escapeDrain(world, me) ?? dodgeStorm(world, me) ?? nearItem(world, me) ?? {})
    const commands = [move, { type: 'aim', a: angle + (world.rng() - 0.5) * 0.2 }, ...hop]
    // 막기를 고르면 그 걸음에는 치지 않는다(막는 동안은 공격이 나가지 않는다).
    const block = guardSwing(world, me, danger, 0.3)
    if (block) commands.push(...block)
    else {
      if (!backing && gap <= reach + 4 && world.rng() < 0.6) commands.push({ type: 'fire' })
      if (danger) commands.push(...dodgeSwing(world, me, danger, 0.3))
      else if (incoming(world, me)) commands.push(...dodge(world, me, 0.3))
    }
    const skill = skillOfPlayer(me)
    if (me.cd.skill <= 0 && wantsSkill(world, me, gap, reach) && world.rng() < 0.05 + 0.02 * (skill.cooldown < 8 ? 1 : 0)) commands.push({ type: 'skill' })
    if (wantsFar(world, me, gap)) commands.push({ type: 'far' })
    return commands
  },
}

// ---------- 전략 2: 돌격형 ----------
// 가장 가까운 상대에게 지그재그로 붙어 연속기를 끝까지 친다. 거리가 애매하면 대시로 파고든다.
// 사건은 꺼진 화면에서 나오는 것과 길목의 아이템만 신경 쓰고, 알림 폭풍은 무시한다. 내려찍기만 뛰어서 피한다.
const RUSH = { close: 0.6, dashMax: 200, skill: 150, weave: 0.9 }

export const rusher = {
  name: 'rusher',
  label: '돌격형',
  commands(world, me) {
    const hop = hopWave(world, me)
    const target = nearestTarget(world, me)
    // 상대가 모두 재부팅 중이어도 꺼진 가장자리에서 빠져나오고 아이템을 줍는다.
    if (!target) return [{ type: 'move', x: 0, y: 0, ...(world.events ? (escapeDrain(world, me) ?? nearItem(world, me) ?? {}) : {}) }, ...hop]
    const { player } = target
    const gap = gapOf(target)
    const reach = reachOf(me)
    const angle = Math.atan2(player.y - me.y, player.x - me.x)
    const side = strafeOf(world, me)
    const forward = gap < reach * RUSH.close ? 0 : 1
    const move = detour(me, player, angle, forward, side, forward ? RUSH.weave * 0.5 : 0.6)
    if (world.events) Object.assign(move, escapeDrain(world, me) ?? nearItem(world, me) ?? {})
    const commands = [move, { type: 'aim', a: angle + (world.rng() - 0.5) * 0.1 }, ...hop]
    const danger = threat(world, me)
    // 내려찍기는 뛰어서 피하고, 나머지는 가끔 막는다(막기를 고르면 그 걸음에는 치지 않는다).
    const block = danger?.move.shape === 'slam' ? null : guardSwing(world, me, danger, 0.18)
    if (block) commands.push(...block)
    else {
      if (gap <= reach + 4 && world.rng() < 0.8) commands.push({ type: 'fire' })
      if (danger?.move.shape === 'slam') commands.push(...dodgeSwing(world, me, danger, 0))
      else if (incoming(world, me)) commands.push(...dodge(world, me, 0.25))
      else if (me.cd.dash <= 0 && gap > reach + 20 && gap < RUSH.dashMax && world.rng() < 0.06) commands.push({ type: 'dash' })
    }
    if (me.cd.skill <= 0 && wantsSkill(world, me, gap, reach) && world.rng() < 0.08) commands.push({ type: 'skill' })
    if (wantsFar(world, me, gap)) commands.push({ type: 'far' })
    return commands
  },
}
export const BOT_STRATEGIES = { kiter, rusher }

// 시험용: 거리 유지형과 같고 바닥에 있으면 늘 뛴다(점프만 누르는 사람이 너무 유리하지 않은지 볼 때). 성격 목록에는 넣지 않는다.
export const hopper = {
  name: 'hopper',
  label: '계속 뛰는 봇',
  commands(world, me) {
    const commands = kiter.commands(world, me).filter((command) => command.type !== 'jump')
    if (me.z === 0 && me.cd.jump <= 0) commands.push({ type: 'jump' })
    return commands
  },
}

// 시연 인물별 성격(봇 이름 = 시연 인물 별명). 정주행러는 돌격형, 나머지는 거리 유지형.
const PERSONALITY = { 정주행러: rusher }

export const strategyFor = (player) => PERSONALITY[player.name] ?? kiter

// 예전 이름: 거리 유지형 봇의 명령
export const botCommands = (world, bot) => kiter.commands(world, bot)
