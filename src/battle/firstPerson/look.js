import { fitAngleToNearest, relativeMove, turnToward } from './raycast'

// 1인칭에서의 조작 해석: 보는 방향(yaw)을 들고 있다가, 누른 것을 세계가 아는 명령(move·aim)으로 바꾼다.
// 세계에는 위에서 볼 때와 똑같은 명령만 나간다.
const TURN = 2.6 // 화살표·화면 끝 회전 속도(라디안/초)
const ASSIST = 3.4 // 터치로 쏠 때 가까운 상대 쪽으로 돌려 주는 속도
const MOUSE = 0.0045
const TOUCH = 0.011

export class LookController {
  constructor() {
    this.yaw = 0
    this.active = false
    this.pending = 0 // 다음 걸음에 더할 회전(마우스·터치)
  }

  // 1인칭이 시작되면 가장 가까운 상대 쪽을 본다.
  enter(world, me) {
    this.active = true
    this.pending = 0
    const yaw = fitAngleToNearest(world, me)
    this.yaw = Number.isFinite(yaw) ? yaw : me.aim
  }

  leave() {
    this.active = false
    this.pending = 0
  }

  mouse(dx) {
    if (Number.isFinite(dx)) this.pending += Math.max(-120, Math.min(120, dx)) * MOUSE
  }

  drag(dx) {
    if (Number.isFinite(dx)) this.pending += dx * TOUCH
  }

  // forward·strafe: -1~1, turn: -1(왼쪽)·0·1, assist: 터치로 쏘는 중이면 조준을 도와준다.
  commands(world, me, { forward = 0, strafe = 0, turn = 0, assist = false, dt = 1 / 60 }) {
    // 멈칫하는 동안은 세계가 조준을 받지 않는다. 쌓아 두었다가 한 번에 휙 돌지 않게 버린다.
    if (me.stunT > 0) {
      this.yaw = me.aim
      this.pending = 0
      turn = 0
      assist = false
    }
    this.yaw += this.pending + turn * TURN * dt
    this.pending = 0
    if (assist) {
      const target = fitAngleToNearest(world, me)
      if (Number.isFinite(target)) this.yaw = turnToward(this.yaw, target, ASSIST * dt)
    }
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)) // -π~π
    const { x, y } = relativeMove(forward, strafe, this.yaw)
    return [
      { type: 'move', x, y },
      { type: 'aim', a: this.yaw },
    ]
  }
}
