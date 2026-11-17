import { skillOf } from './loadout'

// Strategy: 봇이 이번 걸음에 할 명령을 고른다(연습 모드). 같은 세계·같은 씨앗이면 같은 행동이다.
// 거리를 190 안팎으로 유지하며 옆으로 돌고, 날아오는 탄이 가까우면 대시, 사거리 안이면 쏜다.
const KEEP = { near: 150, far: 230 }

function nearestTarget(world, bot) {
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
    if (shot.owner === bot.id) return false
    const dx = bot.x - shot.x
    const dy = bot.y - shot.y
    const dist = Math.hypot(dx, dy)
    return dist < 70 && (dx * shot.vx + dy * shot.vy) / (dist * Math.hypot(shot.vx, shot.vy) || 1) > 0.8
  })
}

export function botCommands(world, bot) {
  const target = nearestTarget(world, bot)
  if (!target) return [{ type: 'move', x: 0, y: 0 }]
  const { player, dist } = target
  const angle = Math.atan2(player.y - bot.y, player.x - bot.x)
  // 옆으로 도는 방향은 1.5초마다 바뀐다.
  bot.strafe ??= world.rng() < 0.5 ? 1 : -1
  bot.strafeT = (bot.strafeT ?? 1.5) - 1 / 60
  if (bot.strafeT <= 0) {
    bot.strafe = world.rng() < 0.5 ? 1 : -1
    bot.strafeT = 1.2 + world.rng()
  }
  const toward = dist > KEEP.far ? 1 : dist < KEEP.near ? -1 : 0
  const move = {
    type: 'move',
    x: Math.cos(angle) * toward + Math.cos(angle + Math.PI / 2) * bot.strafe * 0.8,
    y: Math.sin(angle) * toward + Math.sin(angle + Math.PI / 2) * bot.strafe * 0.8,
  }
  const commands = [move, { type: 'aim', a: angle + (world.rng() - 0.5) * 0.3 }]
  if (dist < 420 && world.rng() < 0.5) commands.push({ type: 'fire' })
  if (incoming(world, bot) && world.rng() < 0.3) commands.push({ type: 'dash' })
  const skill = skillOf(bot.loadout)
  const selfSkill = ['detox', 'finance', 'study'].includes(bot.loadout.skill)
  const wantSkill = selfSkill ? bot.hp < bot.maxHp * 0.6 : dist < 280
  if (bot.cd.skill <= 0 && wantSkill && world.rng() < 0.05 + 0.02 * (skill.cooldown < 8 ? 1 : 0)) commands.push({ type: 'skill' })
  return commands
}
