import { botCommands } from './bot'
import { Countdown } from './phases'

export { STEP } from './phases'

// Template Method: 고정 시간(초당 60번) 게임 루프의 뼈대.
// 입력 모으기 → 한 걸음 → 걸음 뒤 할 일 → 그리기 순서는 같고, 연습·온라인은 훅(collectCommands·afterStep·countdown)만 다르다.
// State: 프레임마다 할 일은 지금 단계 객체(phases.js: 카운트다운 → 진행 → 끝)가 정한다. 루프는 단계를 들고 있다가 바꿔 끼우기만 한다.

export class MatchLoop {
  constructor({ world, renderer, input, meId, onEnd }) {
    this.world = world
    this.renderer = renderer
    this.input = input
    this.meId = meId
    this.onEnd = onEnd
    this.acc = 0
    this.phase = Countdown
    this.frame = this.frame.bind(this)
  }

  get me() {
    return this.world.players.find((player) => player.id === this.meId)
  }

  start() {
    this.last = performance.now()
    this.phase = Countdown
    this.schedule()
  }

  // 단계 바꾸기: 새 단계의 enter를 부른다.
  setPhase(next) {
    if (next === this.phase) return
    this.phase = next
    next.enter?.(this)
  }

  // 다음 프레임: requestAnimationFrame을 기다리되, 100ms 안에 오지 않으면(다른 탭으로 가 화면이 숨겨짐) 타이머로 돈다.
  // 숨긴 탭에서도 내 위치·체력을 상대에게 계속 보내야 하기 때문이다. 먼저 온 쪽만 쓴다.
  schedule() {
    this.raf = requestAnimationFrame(this.frame)
    this.timer = setTimeout(() => this.frame(performance.now()), 100)
  }

  unschedule() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.timer)
  }

  stop() {
    this.stopped = true
    this.unschedule()
    this.input?.detach()
    this.renderer?.dispose?.()
  }

  frame(now) {
    this.unschedule()
    if (this.stopped) return
    const dt = Math.min(1, (now - this.last) / 1000)
    this.last = now
    this.setPhase(this.phase.frame(this, dt))
    if (!this.phase.done) this.schedule()
  }

  // ---- 훅 ----
  collectCommands() {
    const me = this.me
    return me?.alive ? { [me.id]: this.input.commands(this.world, me) } : {}
  }

  // 연습은 보낼 곳이 없으니 시전 이벤트를 비운다.
  afterStep() {
    this.world.outbox = []
  }

  countdown() {
    return 0
  }

  finish() {}
}

// 연습: 봇(Strategy)이 함께 움직인다. 시작 전 3초 카운트다운
export class PracticeLoop extends MatchLoop {
  start() {
    this.readyAt = performance.now() + 3000
    super.start()
  }

  countdown() {
    return Math.max(0, (this.readyAt - performance.now()) / 1000)
  }

  collectCommands() {
    const commands = super.collectCommands()
    for (const player of this.world.players) {
      if (player.bot && player.alive) commands[player.id] = botCommands(this.world, player)
    }
    return commands
  }
}

// 온라인: 내 시전 이벤트는 바로, 내 위치·체력은 초당 10번 보낸다. 시간은 서버 시각 기준
// 통신은 RoomChannel(channel.js)만 쓴다. Firebase인지 메모리인지는 모른다(Adapter의 Client).
export class OnlineLoop extends MatchLoop {
  constructor({ channel, startAt, ...rest }) {
    super(rest)
    this.channel = channel
    this.startAt = startAt
    this.sendT = 0
  }

  countdown() {
    return Math.max(0, (this.startAt - this.channel.now()) / 1000)
  }

  afterStep(step) {
    for (const ev of this.world.outbox) this.channel.sendEvent(ev)
    this.world.outbox = []
    this.world.time = Math.max(this.world.time, (this.channel.now() - this.startAt) / 1000)
    this.sendT -= step
    const me = this.me
    if (this.sendT <= 0 && me) {
      this.sendT = 0.1
      this.channel.sendState({ x: Math.round(me.x), y: Math.round(me.y), a: Number(me.aim.toFixed(2)), hp: me.hp, alive: me.alive })
    }
  }

  finish() {
    const me = this.me
    if (me) this.channel.sendState({ x: Math.round(me.x), y: Math.round(me.y), a: 0, hp: me.hp, alive: me.alive })
  }
}
