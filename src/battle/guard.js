import { effect, playerById } from './world'

// 막기·패링: 앱 유형과 상관없이 누구나 쓰는 방어(PC 오른쪽 클릭·F, 휴대폰 막기 버튼).
// 누르면 time초 막기 자세. 자세가 시작하고 parry초 안에 앞(보는 방향 ±front)에서 온 주인 있는 공격을 받으면 패링:
//   피해가 없고, 때린 사람이 reach 안에 있으면 stun초 멈칫하며 휘두르던 것이 튕겨 나간다. 패링하면 바로 다시 막을 수 있다.
// 그 뒤는 막기: 피해를 cut배로 줄이고 밀림·멈칫·출혈이 걸리지 않는다. 막는 동안은 slow배로 걷고 공격하지 않는다.
// 내 공격의 준비·타격 중에 누르면 buffer초 동안 기억했다가 그 타가 끝나자마자 막는다.
// 판정은 맞는 쪽 화면이 한다(world.applyDamage). 자세와 패링은 시전 이벤트(k 'skill' + g 1·2)로 알려 모든 화면에 보인다.
// (world.js와 서로 가져오지만, world의 함수는 place 안에서만 부른다.)
export const GUARD = { time: 0.6, parry: 0.2, cooldown: 1.2, cut: 0.3, slow: 0.4, front: 1.4, stun: 0.7, reach: 110, buffer: 0.3 }

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

// 지금 막기 자세인지, 그중 패링 시간인지
export const defending = (player) => (player.defendT ?? 0) > 0
export const parrying = (player) => defending(player) && GUARD.time - player.defendT < GUARD.parry

// 공격이 앞에서 왔는지. push(맞은 방향)가 있으면 그 반대쪽, 없으면 때린 사람 쪽을 본다.
export function fromFront(player, attacker, push) {
  const fx = push ? -push.x : attacker.x - player.x
  const fy = push ? -push.y : attacker.y - player.y
  if (Math.hypot(fx, fy) < 1e-6) return true
  return Math.abs(wrap(Math.atan2(fy, fx) - player.aim)) <= GUARD.front
}

// 제품: 막기 자세(모든 화면에서 같은 시간만큼)
export class Guard {
  constructor({ owner }) {
    this.owner = owner
  }

  place(world) {
    const owner = playerById(world, this.owner)
    if (!owner?.alive) return
    owner.defendT = GUARD.time
    world.signals.notify({ kind: 'guard', x: owner.x, y: owner.y, who: owner.id })
  }
}

// 제품: 패링당함. target(때린 사람)의 휘두르기가 튕겨 나가고, target을 판정하는 화면에서 멈칫한다.
// late: 이 소식을 몇 초 늦게 받았는지. 패링보다 나중에 시작한 휘두르기·되감기(지난 시간 < late)는 튕겨 낸 것이 아니므로 남긴다.
export class Parried {
  constructor({ owner, target, late = 0 }) {
    this.owner = owner
    this.target = target
    this.late = late
  }

  caughtUp(ahead) {
    return ahead > 0 ? new Parried({ ...this, late: ahead }) : this
  }

  place(world) {
    const target = playerById(world, this.target)
    if (!target?.alive) return
    for (const swing of world.swings) if (swing.owner === target.id && swing.t >= this.late) swing.done = true
    world.swings = world.swings.filter((swing) => !swing.done)
    // 늦게 놓일 되감기(순간이동)도 튕겨 낸다: 패링하고도 상대가 안전한 곳으로 돌아가 반격할 틈이 없어지지 않게
    const before = (timer) => (timer.total ?? Infinity) - timer.delay >= this.late
    world.timers = world.timers.filter((timer) => !(timer.part.owner === target.id && timer.part.kind === 'teleport' && before(timer)))
    effect(world, 'parried', target.x, target.y - 30, '튕겨남!', target.id, { from: this.owner })
    if (!target.local) return
    target.lungeT = 0 // 돌진도 멈춘다(멈칫한 채 미끄러져 지나가지 않게)
    target.guardAt = -1 // 미리 눌러 둔 막기도 잊는다(멈칫이 끝나자마자 저절로 막아 패링의 반격 틈이 사라지지 않게)
    target.stunT = Math.max(target.stunT, GUARD.stun)
    target.combo = { step: 0, until: -1, queued: false }
  }
}
