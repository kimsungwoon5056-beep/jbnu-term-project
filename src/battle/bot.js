import { skillKey, skillOfPlayer } from './loadout'
import { bubbleY, itemAlive, safeArea, STORM, warningLanes } from './schedule'
import { AREA, truced } from './world'

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
  const safe = safeArea(AREA, world.time)
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

const SELF_SKILLS = ['detox', 'finance', 'study']

// 기술을 쓸 만한가: 자기 효과 기술은 체력이 60% 밑일 때, 공격 기술은 상대가 range 안일 때
const wantsSkill = (bot, dist, range) => (SELF_SKILLS.includes(skillKey(bot)) ? bot.hp < bot.maxHp * 0.6 : dist < range)

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

// ---------- 전략 1: 거리 유지형 ----------
// 거리를 190 안팎으로 유지하며 옆으로 돌고, 사건(꺼진 화면·알림 폭풍·아이템)에 맞춰 움직인다.
// 날아오는 탄이 가까우면 대시, 사거리 안이면 쏜다.
const KEEP = { near: 150, far: 230 }

export const kiter = {
  name: 'kiter',
  label: '거리 유지형',
  commands(world, me) {
    const target = nearestTarget(world, me)
    if (!target) return [{ type: 'move', x: 0, y: 0 }]
    const { player, dist } = target
    const angle = Math.atan2(player.y - me.y, player.x - me.x)
    const strafe = strafeOf(world, me)
    const approach = dist > KEEP.far ? 1 : dist < KEEP.near ? -1 : 0
    const move = {
      type: 'move',
      x: Math.cos(angle) * approach + Math.cos(angle + Math.PI / 2) * strafe * 0.8,
      y: Math.sin(angle) * approach + Math.sin(angle + Math.PI / 2) * strafe * 0.8,
    }
    if (world.events) Object.assign(move, escapeDrain(world, me) ?? dodgeStorm(world, me) ?? nearItem(world, me) ?? {})
    const commands = [move, { type: 'aim', a: angle + (world.rng() - 0.5) * 0.3 }]
    if (dist < 420 && world.rng() < 0.5) commands.push({ type: 'fire' })
    if (incoming(world, me) && world.rng() < 0.3) commands.push({ type: 'dash' })
    const skill = skillOfPlayer(me)
    if (me.cd.skill <= 0 && wantsSkill(me, dist, 280) && world.rng() < 0.05 + 0.02 * (skill.cooldown < 8 ? 1 : 0)) commands.push({ type: 'skill' })
    return commands
  },
}

// ---------- 전략 2: 돌격형 ----------
// 가장 가까운 상대에게 지그재그로 붙고, 붙으면 옆으로 돌며 쏜다. 거리가 애매하면 대시로 파고든다.
// 사건은 꺼진 화면에서 나오는 것과 길목의 아이템만 신경 쓰고, 알림 폭풍은 무시한다.
const RUSH = { close: 60, fire: 380, dashMin: 90, dashMax: 240, skill: 150, weave: 0.9 }

export const rusher = {
  name: 'rusher',
  label: '돌격형',
  commands(world, me) {
    const target = nearestTarget(world, me)
    if (!target) return [{ type: 'move', x: 0, y: 0 }]
    const { player, dist } = target
    const angle = Math.atan2(player.y - me.y, player.x - me.x)
    const side = strafeOf(world, me)
    const forward = dist < RUSH.close ? 0 : 1
    const weave = forward ? RUSH.weave : 1
    const move = {
      type: 'move',
      x: Math.cos(angle) * forward + Math.cos(angle + Math.PI / 2) * side * weave,
      y: Math.sin(angle) * forward + Math.sin(angle + Math.PI / 2) * side * weave,
    }
    if (world.events) Object.assign(move, escapeDrain(world, me) ?? nearItem(world, me) ?? {})
    const commands = [move, { type: 'aim', a: angle + (world.rng() - 0.5) * 0.15 }]
    if (dist < RUSH.fire && world.rng() < 0.7) commands.push({ type: 'fire' })
    if (incoming(world, me) && world.rng() < 0.25) commands.push({ type: 'dash' })
    else if (me.cd.dash <= 0 && dist > RUSH.dashMin && dist < RUSH.dashMax && world.rng() < 0.08) commands.push({ type: 'dash' })
    if (me.cd.skill <= 0 && wantsSkill(me, dist, RUSH.skill) && world.rng() < 0.08) commands.push({ type: 'skill' })
    return commands
  },
}

export const BOT_STRATEGIES = { kiter, rusher }

// 시연 인물별 성격(봇 이름 = 시연 인물 별명). 정주행러는 돌격형, 나머지는 거리 유지형.
const PERSONALITY = { 정주행러: rusher }

export const strategyFor = (player) => PERSONALITY[player.name] ?? kiter

// 예전 이름: 거리 유지형 봇의 명령
export const botCommands = (world, bot) => kiter.commands(world, bot)
