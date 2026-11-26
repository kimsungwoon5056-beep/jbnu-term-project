import { LookController } from './firstPerson/look'
import { callCommands } from './firstPerson/camera'
import { MODES } from './modes'
import { activeMode } from './schedule'
import { ARENA } from './world'

// 입력 → 명령(Command). PC: WASD·방향키 이동, 마우스 조준·누르면 발사, Space 점프, Shift 대시, Q 앱 기술
// 휴대폰: 화면의 조이스틱(이동)과 버튼(공격·점프·대시·기술). 공격 버튼을 누른 채 밀거나 화면·조작 칸의 빈 곳을 밀면 둘러보고,
// 누르고만 있으면 가장 가까운 상대 쪽으로 조준을 돕는다.
// 기본은 1인칭: WASD는 보는 방향 기준, 마우스(누르면 포인터 고정)·←→·화면 밀기로 둘러본다. 지도 앱(위에서 보기) 동안만 화면 방향.
// 나가는 명령의 모양은 같다.
const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

const STICK_DEAD = 0.18 // 조이스틱 가운데 쉬는 칸(반지름 비율)
const STEER_SLOP = 8 // 이만큼(px) 밀어야 손가락으로 직접 돌리는 것으로 본다

export class InputController {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = new Set()
    this.mouse = { x: ARENA.w / 2, y: ARENA.h / 2, down: false, inside: false }
    this.stick = { x: 0, y: 0 }
    this.holdFire = false
    this.taps = new Set() // 한 번만 쓰는 명령(jump, dash, skill)
    this.touchMode = false
    this.look = new LookController()
    this.callCamera = null // 영상통화 모드에서 지금 보이는 카메라(렌더러가 알려 준다)
    this.drags = new Map() // 밀어서 둘러보는 손가락: id → { x, moved }
    this.onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (MOVE_KEYS[event.code] || event.code === 'Space' || event.code.startsWith('Shift')) event.preventDefault()
      this.touchMode = false
      this.keys.add(event.code)
      if (event.code === 'Space') this.taps.add('jump')
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.taps.add('dash')
      if (event.code === 'KeyQ') this.taps.add('skill')
    }
    this.onKeyUp = (event) => this.keys.delete(event.code)
    this.onMouseLeave = () => {
      this.mouse.inside = false
    }
    this.onMouseMove = (event) => {
      if (event.pointerType !== 'touch') {
        const box = canvas.getBoundingClientRect()
        this.mouse.x = ((event.clientX - box.left) / box.width) * ARENA.w
        this.mouse.y = ((event.clientY - box.top) / box.height) * ARENA.h
        this.mouse.inside = true
      }
      if (event.pointerType === 'touch') this.lookMove(event.pointerId, event.clientX)
      else if (this.look.active) this.look.mouse(event.movementX)
    }
    this.onMouseDown = (event) => {
      if (event.pointerType === 'touch') {
        this.lookStart(event.pointerId, event.clientX)
        return
      }
      if (event.button !== 0) return
      this.touchMode = false
      this.mouse.down = true
      if (this.look.active) this.lockPointer()
    }
    this.onMouseUp = (event) => {
      if (event?.pointerType === 'touch') {
        this.lookEnd(event.pointerId)
        return
      }
      this.mouse.down = false
    }
    // 다른 창·탭으로 가면 손을 뗀 것으로 본다(떼는 신호가 오지 않아 혼자 계속 걷거나 쏘지 않게).
    this.release = () => {
      this.keys.clear()
      this.taps.clear()
      this.mouse.down = false
      this.holdFire = false
      this.stick = { x: 0, y: 0 }
      this.drags.clear()
    }
    this.onContextMenu = (event) => event.preventDefault()
    window.addEventListener('blur', this.release)
    document.addEventListener('visibilitychange', this.release)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    canvas.addEventListener('pointermove', this.onMouseMove)
    canvas.addEventListener('pointerleave', this.onMouseLeave)
    canvas.addEventListener('pointerdown', this.onMouseDown)
    window.addEventListener('pointerup', this.onMouseUp)
    window.addEventListener('pointercancel', this.onMouseUp)
  }

  // 쓰러졌거나 판이 끝났을 때: 1인칭 조작을 끝내고 마우스를 놓아준다(명령을 더 모으지 않으므로 여기서 해야 한다).
  idle() {
    this.look.leave()
    this.fromTop = false
    this.unlockPointer()
    this.taps.clear()
    this.mouse.down = false
    // 휴대폰 공격 버튼·밀던 손가락은 그대로 둔다: 누른 채 기다리면 다시 시작하자마자 쏜다(뗄 때 버튼이 직접 알린다).
  }

  clearTaps() {
    this.taps.clear()
  }

  detach() {
    window.removeEventListener('blur', this.release)
    document.removeEventListener('visibilitychange', this.release)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.canvas.removeEventListener('pointermove', this.onMouseMove)
    this.canvas.removeEventListener('pointerleave', this.onMouseLeave)
    this.canvas.removeEventListener('pointerdown', this.onMouseDown)
    window.removeEventListener('pointerup', this.onMouseUp)
    window.removeEventListener('pointercancel', this.onMouseUp)
    this.unlockPointer()
  }

  // 화면 버튼(휴대폰)
  // 가운데 가까이(STICK_DEAD 안)는 0으로 보고, 그 밖은 0~1로 다시 늘린다(엄지가 살짝 닿아 혼자 걷지 않게).
  setStick(x, y) {
    this.touchMode = true
    const len = Math.hypot(x, y)
    const scale = len <= STICK_DEAD ? 0 : Math.min(1, (len - STICK_DEAD) / (1 - STICK_DEAD)) / len
    this.stick = { x: x * scale, y: y * scale }
  }
  setFire(down) {
    this.touchMode = true
    this.holdFire = down
  }
  tap(name) {
    this.touchMode = true
    this.taps.add(name)
  }

  // 밀어서 둘러보기(화면·공격 버튼·조작 칸의 빈 곳). 손가락마다 따로 기억해 두 손가락이 섞이지 않는다.
  lookStart(id, x) {
    this.drags.set(id, { x, moved: 0 })
  }
  lookMove(id, x) {
    const drag = this.drags.get(id)
    if (!drag || !Number.isFinite(x)) return
    // 둘러보는 모드가 아닐 때 움직인 만큼은 버린다(모드가 켜지는 순간 화면이 휙 돌지 않게).
    if (this.look.active) this.look.drag(x - drag.x)
    drag.moved += Math.abs(x - drag.x)
    drag.x = x
  }
  lookEnd(id) {
    this.drags.delete(id)
  }
  // 손가락으로 직접 돌리는 중이면 자동 조준이 끌어당기지 않는다.
  get steering() {
    for (const drag of this.drags.values()) if (drag.moved > STEER_SLOP) return true
    return false
  }

  // 포인터 고정: 마우스가 화면 밖으로 나가지 않고 계속 둘러볼 수 있다. 안 되면 화면 끝에서 돈다.
  lockPointer() {
    try {
      this.canvas.requestPointerLock?.()?.catch?.(() => {})
    } catch {
      // 지원하지 않는 브라우저
    }
  }

  unlockPointer() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.()
  }

  // 1인칭 동안의 명령
  lookCommands(world, me) {
    const on = (...codes) => codes.some((code) => this.keys.has(code))
    const locked = document.pointerLockElement === this.canvas
    let turn = (on('ArrowRight') ? 1 : 0) - (on('ArrowLeft') ? 1 : 0)
    // 고정하지 못했으면 마우스를 화면 양끝에 두어 돈다(마우스가 화면 밖으로 나가 있으면 돌지 않는다).
    if (turn === 0 && !this.touchMode && !locked && this.mouse.inside) turn = this.mouse.x < ARENA.w * 0.1 ? -0.7 : this.mouse.x > ARENA.w * 0.9 ? 0.7 : 0
    return this.look.commands(world, me, {
      forward: (on('KeyW', 'ArrowUp') ? 1 : 0) - (on('KeyS', 'ArrowDown') ? 1 : 0) - this.stick.y,
      strafe: (on('KeyD') ? 1 : 0) - (on('KeyA') ? 1 : 0) + this.stick.x,
      turn,
      assist: this.touchMode && this.holdFire && !this.steering,
    })
  }

  // 영상통화: 상대가 보는 화면을 기준으로 움직이고, 쏘면 그 상대 쪽으로 나간다.
  callCommands(world, me) {
    const on = (...codes) => codes.some((code) => this.keys.has(code))
    return callCommands(this.callCamera, world, me, {
      forward: (on('KeyW', 'ArrowUp') ? 1 : 0) - (on('KeyS', 'ArrowDown') ? 1 : 0) - this.stick.y,
      strafe: (on('KeyD', 'ArrowRight') ? 1 : 0) - (on('KeyA', 'ArrowLeft') ? 1 : 0) + this.stick.x,
    })
  }

  // 위에서 볼 때의 명령
  topCommands(world, me) {
    let x = this.stick.x
    let y = this.stick.y
    for (const code of this.keys) {
      const dir = MOVE_KEYS[code]
      if (dir) {
        x += dir[0]
        y += dir[1]
      }
    }
    // 뒤집히거나 돌아간 화면이면 마우스가 가리키는 경기장 자리로 바꾼다.
    let aim = Math.atan2(this.mouse.y - me.y, this.mouse.x - me.x)
    if (this.touchMode) {
      const targets = world.boss?.alive ? [world.boss] : world.players.filter((player) => player.alive && player.id !== me.id)
      const target = targets.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]
      aim = target ? Math.atan2(target.y - me.y, target.x - me.x) : me.aim
    }
    return [
      { type: 'move', x, y },
      { type: 'aim', a: aim },
    ]
  }

  commands(world, me) {
    const steer = MODES[activeMode(world)]?.steer ?? 'look'
    const look = steer === 'look' || (steer === 'call' && !this.callCamera) // 영상통화에서 볼 상대가 없으면 내 눈으로
    if (look !== this.look.active) {
      // 지도 앱에서 돌아올 때는 조준하던 방향을 이어 보고, 처음·다시 시작할 때는 가장 가까운 상대 쪽을 본다.
      if (look) this.look.enter(world, me, { keepAim: this.fromTop })
      else {
        this.look.leave()
        this.unlockPointer()
      }
    }
    this.fromTop = !look
    if (steer !== 'call') this.callCamera = null
    const list = look ? this.lookCommands(world, me) : steer === 'call' && this.callCamera ? this.callCommands(world, me) : this.topCommands(world, me)
    if (this.mouse.down || this.holdFire) list.push({ type: 'fire' })
    for (const name of this.taps) list.push({ type: name })
    this.taps.clear()
    return list
  }
}
