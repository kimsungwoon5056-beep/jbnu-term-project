import { AREA } from '../arena'
import { DIVE } from '../schedule'
import { Projectile } from '../skills'
import { playerById } from '../world'

// 알고리즘 보스: 서로 피해가 0이 되고, 거대한 "추천 알고리즘"이 정해진 무늬로 탄을 쏜다.
// 때린 피해는 쏜 사람의 화면만 세어 알린다(아이템 줍기 이벤트의 번호에 합계를 실어 보낸다). 그래서 모든 화면의 순위가 같다.
// 보상은 알림이 다 도착할 시간(settle)을 두고 준다. 모드가 끝나기 직전에 때린 것도 도착하지 못하므로 세지 않는다. 가장 많이 때린 살아 있는 사람은 체력을 더 얻는다.
export const BOSS = { id: 'boss', r: 44, hpEach: 42, every: 0.8, first: 0.9, topHeal: 15, allHeal: 5, settle: 1.2, reportEvery: 0.2 }
export const REPORT = 1000000 // 이 번호 이상의 pick은 "보스에게 준 피해 합계" 알림이다

const SHOT = { speed: 165, damage: 3, color: '#ff3b5c', r: 6, life: 3.2, shape: 'play' }

// 모드가 시작한 뒤 t초일 때 보스 자리(위쪽 두 앱 아이콘 사이: 탄이 아이콘 안에서 생기지 않게)
export function bossAt(t) {
  return { x: 180 + Math.sin(t * 0.9) * 44, y: AREA.y0 + 118 + Math.sin(t * 1.7) * 30 }
}

// k번째 공격의 탄 방향들: 둥글게, 회오리, 부채
export function pattern(k) {
  if (k % 3 === 0) return Array.from({ length: 10 }, (_, i) => (Math.PI * 2 * i) / 10 + k * 0.21)
  if (k % 3 === 1) return Array.from({ length: 6 }, (_, i) => (Math.PI * 2 * i) / 6 + k * 0.9)
  return Array.from({ length: 7 }, (_, i) => Math.PI / 2 + (i - 3) * 0.24 + Math.sin(k * 2.3) * 0.5)
}

// 지금까지 쏘았어야 하는 횟수
const shotsBy = (t) => Math.max(0, Math.floor((t - BOSS.first) / BOSS.every) + 1)
const total = (foe) => [...foe.dealt.values()].reduce((sum, damage) => sum + damage, 0)

// 휴전 동안 사람이 깔아 둔 것을 치운다(끝나자마자 터지지 않게).
function clearStaged(world) {
  const mine = (owner) => Boolean(playerById(world, owner))
  for (const shot of world.projectiles.active) if (mine(shot.owner)) shot.active = false
  world.pending = world.pending.filter((item) => !mine(item.from))
  world.timers = world.timers.filter((timer) => !mine(timer.part.owner))
  for (const trap of world.traps) if (mine(trap.owner)) trap.life = 0 // 지금 도는 덫 판정에서도 빠지게
  world.traps = world.traps.filter((trap) => !mine(trap.owner))
  world.turrets = world.turrets.filter((turret) => !mine(turret.owner))
  for (const swing of world.swings) if (mine(swing.owner)) swing.done = true
  world.swings = world.swings.filter((swing) => !mine(swing.owner))
}

// 피해를 센다. 내 화면에서 판정하는 사람(나·봇)의 것만 세고 알린다. 남의 것은 알림으로 받는다.
function deal(world, owner, damage, x, y) {
  const { boss: foe } = world
  foe.flashT = 0.12
  world.signals.notify({ kind: 'bosshit', who: owner, x, y, text: `-${damage}` })
  if (!playerById(world, owner)?.local) return
  const sum = (foe.dealt.get(owner) ?? 0) + damage
  foe.dealt.set(owner, sum)
  foe.due.add(owner)
  settleHp(world)
}

// 쌓인 합계를 한꺼번에 알린다(맞을 때마다 보내면 하트 12개에 12번 보낸다).
function sendReports(world) {
  const { boss: foe } = world
  for (const id of foe.due) {
    const { x, y } = playerById(world, id)
    world.outbox.push({ k: 'pick', o: id, x: Math.round(x), y: Math.round(y), a: 0, i: REPORT + foe.dealt.get(id) })
  }
  foe.due.clear()
  foe.reportAt = world.modeT + BOSS.reportEvery
}

// 끝나기 직전(알림이 도착할 시간이 없을 때)에는 피해를 세지 않는다.
const counting = (world) => world.modeT < DIVE.length - DIVE.zoom / 2 - BOSS.settle

function settleHp(world) {
  const { boss: foe } = world
  foe.hp = Math.max(0, foe.maxHp - total(foe))
  if (foe.hp > 0 || !foe.alive) return
  foe.alive = false
  sendReports(world)
  world.modeState.rewardAt = world.modeT + BOSS.settle
  clearStaged(world)
  for (const shot of world.projectiles.active) if (shot.owner === BOSS.id) shot.active = false
  world.signals.notify({ kind: 'bossdown', who: topDealer(world), x: foe.x, y: foe.y })
}

export const boss = {
  // 보스가 살아 있는 동안만 서로 피해를 주지 않는다.
  truce: (world) => Boolean(world.boss?.alive),

  enter(world) {
    const maxHp = BOSS.hpEach * Math.max(2, world.players.length) // 모든 화면에서 같게: 산 사람 수를 쓰지 않는다
    world.boss = { id: BOSS.id, name: '추천 알고리즘', ...bossAt(world.modeT), r: BOSS.r, hp: maxHp, maxHp, alive: true, dealt: new Map(), due: new Set(), reportAt: 0, flashT: 0 }
    world.modeState.shots = shotsBy(world.modeT)
  },

  step(world, dt) {
    const { boss: foe, modeState } = world
    if (foe?.due.size && world.modeT >= foe.reportAt) sendReports(world)
    if (modeState.rewardAt !== undefined && world.modeT >= modeState.rewardAt) {
      modeState.rewardAt = undefined
      reward(world, true)
    }
    if (!foe?.alive) return
    Object.assign(foe, bossAt(world.modeT))
    foe.flashT = Math.max(0, foe.flashT - dt)
    // 시간이 건너뛰었으면 밀린 공격을 한꺼번에 쏘지 않고 마지막 것만 쏜다.
    modeState.shots = Math.max(modeState.shots, shotsBy(world.modeT) - 1)
    if (modeState.shots >= shotsBy(world.modeT)) return
    for (const angle of pattern(modeState.shots)) Projectile.aimed({ o: BOSS.id, x: foe.x + Math.cos(angle) * 26, y: foe.y + Math.sin(angle) * 26 }, angle, SHOT).place(world)
    modeState.shots += 1
    world.signals.notify({ kind: 'bossshot', who: null, x: foe.x, y: foe.y })
  },

  // 탄이 보스에 맞았으면 true(탄은 사라진다).
  hitShot(world, shot) {
    const { boss: foe } = world
    if (!foe?.alive || !counting(world) || shot.owner === BOSS.id || shot.hits.has(BOSS.id)) return false
    if (Math.hypot(foe.x - shot.x, foe.y - shot.y) > foe.r + shot.r) return false
    shot.hits.add(BOSS.id)
    deal(world, shot.owner, shot.damage, shot.x, shot.y)
    return true
  },

  // 충격파·덫이 보스에 닿았으면 true
  hitArea(world, owner, x, y, r, damage) {
    const { boss: foe } = world
    if (!foe?.alive || !counting(world) || owner === BOSS.id || damage <= 0 || Math.hypot(foe.x - x, foe.y - y) > foe.r + r) return false
    deal(world, owner, damage, foe.x, foe.y + foe.r * 0.6)
    return true
  },

  // 다른 사람이 준 피해 합계 알림
  report(world, owner, sum) {
    const { boss: foe } = world
    if (!foe || playerById(world, owner)?.local) return
    foe.dealt.set(owner, Math.max(foe.dealt.get(owner) ?? 0, sum))
    settleHp(world)
  },

  leave(world) {
    const { boss: foe, modeState } = world
    if (foe?.alive) reward(world, false)
    else if (modeState.rewardAt !== undefined) reward(world, true)
    for (const shot of world.projectiles.active) if (shot.owner === BOSS.id) shot.active = false
    if (foe?.alive) clearStaged(world)
    world.boss = null
  },
}

// 가장 많이 때린 살아 있는 사람(없으면 null). 같으면 열쇠가 앞선 사람
export function topDealer(world) {
  let best = null
  for (const [id, damage] of world.boss.dealt) {
    if (!playerById(world, id)?.alive) continue
    if (!best || damage > best.damage || (damage === best.damage && id < best.id)) best = { id, damage }
  }
  return best?.id ?? null
}

// 쓰러뜨렸으면 모두, 1등은 더. 내 화면의 내 캐릭터(와 봇)만 회복한다.
function reward(world, killed) {
  const top = topDealer(world)
  for (const player of world.players) {
    if (!player.local || !player.alive) continue
    const heal = (killed ? BOSS.allHeal : 0) + (player.id === top ? BOSS.topHeal : 0)
    if (heal <= 0) continue
    player.hp = Math.min(player.maxHp, player.hp + heal)
    world.signals.notify({ kind: 'reward', who: player.id, x: player.x, y: player.y - 26, text: `+${heal}` })
  }
}
