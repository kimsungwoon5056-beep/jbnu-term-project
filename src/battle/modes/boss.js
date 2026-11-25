import { Projectile } from '../skills'
import { AREA } from '../arena'

// 알고리즘 보스: 서로 피해가 0이 되고, 거대한 "추천 알고리즘"이 정해진 무늬로 탄을 쏜다.
// 각 화면이 모든 사람의 탄이 보스에 맞는 것을 센다. 가장 많이 때린 사람은 체력을 얻는다(자기 화면의 내 캐릭터만 회복).
export const BOSS = { id: 'boss', r: 44, hpEach: 42, every: 0.8, first: 0.9, topHeal: 15, allHeal: 5 }

const SHOT = { speed: 165, damage: 3, color: '#ff3b5c', r: 6, life: 3.2, shape: 'play' }

// 모드가 시작한 뒤 t초일 때 보스 자리
export function bossAt(t) {
  return { x: 180 + Math.sin(t * 0.9) * 92, y: AREA.y0 + 118 + Math.sin(t * 1.7) * 30 }
}

// k번째 공격의 탄 방향들: 둥글게, 회오리, 부채
export function pattern(k) {
  if (k % 3 === 0) return Array.from({ length: 10 }, (_, i) => (Math.PI * 2 * i) / 10 + k * 0.21)
  if (k % 3 === 1) return Array.from({ length: 6 }, (_, i) => (Math.PI * 2 * i) / 6 + k * 0.9)
  return Array.from({ length: 7 }, (_, i) => Math.PI / 2 + (i - 3) * 0.24 + Math.sin(k * 2.3) * 0.5)
}

// 지금까지 쏘았어야 하는 횟수
const shotsBy = (t) => Math.max(0, Math.floor((t - BOSS.first) / BOSS.every) + 1)

export const boss = {
  truce: true,

  enter(world) {
    const alive = world.players.filter((player) => player.alive).length
    const maxHp = BOSS.hpEach * Math.max(2, alive)
    world.boss = { id: BOSS.id, name: '추천 알고리즘', ...bossAt(world.modeT), r: BOSS.r, hp: maxHp, maxHp, alive: true, dealt: new Map(), flashT: 0 }
    world.modeState.shots = shotsBy(world.modeT)
  },

  step(world, dt) {
    const { boss: foe } = world
    if (!foe?.alive) return
    Object.assign(foe, bossAt(world.modeT))
    foe.flashT = Math.max(0, foe.flashT - dt)
    for (; world.modeState.shots < shotsBy(world.modeT); world.modeState.shots += 1) {
      for (const angle of pattern(world.modeState.shots)) Projectile.aimed({ o: BOSS.id, x: foe.x + Math.cos(angle) * 26, y: foe.y + Math.sin(angle) * 26 }, angle, SHOT).place(world)
      world.signals.notify({ kind: 'bossshot', who: null, x: foe.x, y: foe.y })
    }
  },

  // 탄이 보스에 맞았으면 true(탄은 사라진다).
  hitShot(world, shot) {
    const { boss: foe } = world
    if (!foe?.alive || shot.owner === BOSS.id || shot.hits.has(BOSS.id)) return false
    if (Math.hypot(foe.x - shot.x, foe.y - shot.y) > foe.r + shot.r) return false
    shot.hits.add(BOSS.id)
    foe.hp = Math.max(0, foe.hp - shot.damage)
    foe.flashT = 0.12
    foe.dealt.set(shot.owner, (foe.dealt.get(shot.owner) ?? 0) + shot.damage)
    world.signals.notify({ kind: 'bosshit', who: shot.owner, x: shot.x, y: shot.y, text: `-${shot.damage}` })
    if (foe.hp === 0) {
      foe.alive = false
      reward(world, BOSS.allHeal)
      world.signals.notify({ kind: 'bossdown', who: topDealer(foe), x: foe.x, y: foe.y })
    }
    return true
  },

  leave(world) {
    if (world.boss?.alive) reward(world, 0)
    for (const shot of world.projectiles.active) if (shot.owner === BOSS.id) shot.active = false
    world.boss = null
  },
}

// 가장 많이 때린 사람(없으면 null). 같으면 열쇠가 앞선 사람
export function topDealer(foe) {
  let best = null
  for (const [id, damage] of foe.dealt) if (!best || damage > best.damage || (damage === best.damage && id < best.id)) best = { id, damage }
  return best?.id ?? null
}

function reward(world, all) {
  const top = topDealer(world.boss)
  for (const player of world.players) {
    if (!player.local || !player.alive) continue
    const heal = all + (player.id === top ? BOSS.topHeal : 0)
    if (heal <= 0) continue
    player.hp = Math.min(player.maxHp, player.hp + heal)
    world.signals.notify({ kind: 'reward', who: player.id, x: player.x, y: player.y - 26, text: `+${heal}` })
  }
}
