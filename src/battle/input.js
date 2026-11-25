import { ARENA } from './world'

// 입력 → 명령(Command). PC: WASD·방향키 이동, 마우스 조준·누르면 발사, Space 대시, Q 앱 기술
// 휴대폰: 화면의 조이스틱(이동)과 버튼(공격·대시·기술). 터치로 쏘면 가장 가까운 상대를 자동 조준한다.
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

export class InputController {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = new Set()
    this.mouse = { x: ARENA.w / 2, y: ARENA.h / 2, down: false }
    this.stick = { x: 0, y: 0 }
    this.holdFire = false
    this.taps = new Set() // 한 번만 쓰는 명령(dash, skill)
    this.touchMode = false
    this.onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault()
      this.touchMode = false
      this.keys.add(event.code)
      if (event.code === 'Space') this.taps.add('dash')
      if (event.code === 'KeyQ') this.taps.add('skill')
    }
    this.onKeyUp = (event) => this.keys.delete(event.code)
    this.onMouseMove = (event) => {
      const box = canvas.getBoundingClientRect()
      this.mouse.x = ((event.clientX - box.left) / box.width) * ARENA.w
      this.mouse.y = ((event.clientY - box.top) / box.height) * ARENA.h
    }
    this.onMouseDown = (event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      this.touchMode = false
      this.mouse.down = true
    }
    this.onMouseUp = () => {
      this.mouse.down = false
    }
    // 다른 창·탭으로 가면 손을 뗀 것으로 본다(떼는 신호가 오지 않아 혼자 계속 걷거나 쏘지 않게).
    this.release = () => {
      this.keys.clear()
      this.taps.clear()
      this.mouse.down = false
      this.holdFire = false
      this.stick = { x: 0, y: 0 }
    }
    this.onContextMenu = (event) => event.preventDefault()
    window.addEventListener('blur', this.release)
    document.addEventListener('visibilitychange', this.release)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    canvas.addEventListener('pointermove', this.onMouseMove)
    canvas.addEventListener('pointerdown', this.onMouseDown)
    window.addEventListener('pointerup', this.onMouseUp)
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
    this.canvas.removeEventListener('pointerdown', this.onMouseDown)
    window.removeEventListener('pointerup', this.onMouseUp)
  }

  // 화면 버튼(휴대폰)
  setStick(x, y) {
    this.touchMode = true
    this.stick = { x, y }
  }
  setFire(down) {
    this.touchMode = true
    this.holdFire = down
  }
  tap(name) {
    this.touchMode = true
    this.taps.add(name)
  }

  commands(world, me) {
    let x = this.stick.x
    let y = this.stick.y
    for (const code of this.keys) {
      const dir = MOVE_KEYS[code]
      if (dir) {
        x += dir[0]
        y += dir[1]
      }
    }
    const list = [{ type: 'move', x, y }]
    let aim = Math.atan2(this.mouse.y - me.y, this.mouse.x - me.x)
    if (this.touchMode) {
      const target = world.players
        .filter((player) => player.alive && player.id !== me.id)
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]
      aim = target ? Math.atan2(target.y - me.y, target.x - me.x) : me.aim
    }
    list.push({ type: 'aim', a: aim })
    if (this.mouse.down || this.holdFire) list.push({ type: 'fire' })
    for (const name of this.taps) list.push({ type: name })
    this.taps.clear()
    return list
  }
}
