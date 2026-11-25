import { strategyFor } from './bot'
import { dropRemote } from './channel'
import { Countdown } from './phases'
import { effect } from './world'

export { STEP } from './phases'

// 내 위치·체력을 보내는 간격(초). 초당 20번이면 상대 화면의 늦음이 평균 25ms 줄어든다.
export const SEND_EVERY = 0.05
// 온라인 판이 끝난 뒤 마지막 상태를 주고받는 시간(초)
export const SETTLE = 0.9
// 연결이 이만큼(초) 끊겨 있으면 아웃으로 본다(서버는 이미 나를 방에서 뺐다).
export const LOST_LIMIT = 4
// 상대의 소식이 이만큼(초) 없으면 나간 것으로 본다(멈춘 채로 맞지도 않고 남아 있지 않게). 숨긴 탭도 1초에 한 번은 보낸다.
export const SILENT_LIMIT = 6
// 내 화면이 통째로 이만큼(초) 멈췄으면 아웃으로 본다. 상대가 나를 지우는 때(SILENT_LIMIT)보다 1초 빨라야 두 화면이 갈리지 않는다.
export const FROZEN_LIMIT = 5

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
    if (!me?.alive) {
      this.input.idle?.()
      return {}
    }
    return { [me.id]: this.input.commands(this.world, me) }
  }

  // 연습은 보낼 곳이 없으니 시전 이벤트를 비운다.
  afterStep() {
    this.world.outbox = []
  }

  countdown() {
    return 0
  }

  finish() {}

  // 판이 끝난 뒤 상대의 마지막 상태를 기다리는 시간(초). 연습은 기다릴 상대가 없다.
  settleTime() {
    return 0
  }
}

// 연습: 봇이 함께 움직인다. 시작 전 3초 카운트다운
// Strategy의 Context: 플레이어마다 명령을 고를 전략 객체를 들고 있다가 commands(world, me)만 부른다.
// 나 = 사람 입력(InputController), 봇 = 성격(bot.js의 kiter·rusher, 시연 인물별). strategies로 바꿔 끼울 수 있다.
export class PracticeLoop extends MatchLoop {
  constructor({ strategies = {}, ...rest }) {
    super(rest)
    this.strategies = new Map()
    for (const player of this.world.players) {
      const strategy = strategies[player.id] ?? (player.bot ? strategyFor(player) : player.id === this.meId ? this.input : null)
      if (strategy) this.strategies.set(player.id, strategy)
    }
  }

  start() {
    this.readyAt = performance.now() + 3000
    super.start()
  }

  countdown() {
    return Math.max(0, (this.readyAt - performance.now()) / 1000)
  }

  collectCommands() {
    const commands = {}
    for (const player of this.world.players) {
      const strategy = this.strategies.get(player.id)
      if (strategy && player.alive) commands[player.id] = strategy.commands(this.world, player)
      else strategy?.idle?.()
    }
    return commands
  }
}

// 온라인: 내 시전 이벤트는 바로, 내 위치·체력은 초당 20번 보낸다. 시간은 서버 시각 기준
// 통신은 RoomChannel(channel.js)만 쓴다. Firebase인지 메모리인지는 모른다(Adapter의 Client).
export class OnlineLoop extends MatchLoop {
  constructor({ channel, startAt, ...rest }) {
    super(rest)
    this.channel = channel
    this.startAt = startAt
    this.world.startAt = startAt // 쓰러진 시각을 모든 화면이 같은 기준(서버 시각)으로 잰다.
    this.sendT = 0
    // 연결이 끊기면 서버가 내 칸을 지워 상대 화면에서는 쓰러진다. 내 화면도 같은 결과가 되게 아웃으로 처리한다.
    this.lostAt = null
    this.offConnection = channel.onConnection?.((connected) => {
      if (!connected) this.lostAt ??= performance.now()
      else if (this.lostAt !== null) this.dropOut()
    })
    this.deathT = null // 내가 쓰러진 시각(ms). 그 뒤로는 늘 이 시각으로 보낸다.
    this.sentT = null // 마지막으로 보낸 상태의 시각(ms)
    this.unheard = 0 // 서버의 답을 못 받은 시간(초)
    this.acks = 0
    this.silent = new Map() // 상대 → { t: 마지막 상태의 시각, quiet: 소식이 없던 시간(초) }
    this.stepAt = null // 마지막 걸음의 시각(ms)
  }

  settleTime() {
    return SETTLE
  }

  sendMe(me, aim = me.aim) {
    const s = { x: Math.round(me.x), y: Math.round(me.y), a: Number(aim.toFixed(2)), hp: me.hp, alive: me.alive }
    this.sentT = this.deathT ?? this.channel.now()
    this.channel.sendState({ t: this.sentT, ...s })
  }

  // 상대 화면도 나에게서 마지막으로 받은 때를 쓰러진 시각으로 본다(channel.js의 dropRemote). 내 화면도 같은 시각으로 맞춘다.
  dropOut() {
    const me = this.me
    if (!me?.alive || this.world.over) return
    this.deathT = this.channel.ackedT ?? this.sentT ?? this.channel.now()
    me.hp = 0
    me.alive = false
    me.downAt = (this.deathT - this.startAt) / 1000
    this.world.disconnected = true
    effect(this.world, 'down', me.x, me.y, '', me.id)
  }

  stop() {
    this.offConnection?.()
    super.stop()
  }

  countdown() {
    return Math.max(0, (this.startAt - this.channel.now()) / 1000)
  }

  // 연결을 지켜본다: 내가 끊겼으면 나를, 상대가 조용하면 상대를 아웃으로 처리한다.
  watchLink(step) {
    const { channel, world } = this
    const now = channel.now()
    const frozen = this.stepAt !== null && now - this.stepAt > FROZEN_LIMIT * 1000 // 화면이 통째로 멈춰 있었다
    this.stepAt = now
    if (channel.acks !== this.acks) this.unheard = 0
    else if (channel.acks !== undefined && this.sentT !== null) this.unheard += step
    this.acks = channel.acks
    const lost = this.lostAt !== null && performance.now() - this.lostAt > LOST_LIMIT * 1000
    if (frozen || lost || world.gone || this.unheard > LOST_LIMIT) this.dropOut()
    // 다시 이어지지 않으면 남은 판을 볼 수 없다: 내 순위(아직 살아 있는 사람들 다음)만 정하고 끝낸다.
    if (world.disconnected && (lost || this.unheard > LOST_LIMIT)) world.over = true
    if (this.unheard > 1.5) return // 내 연결이 나쁠 때는 상대 탓으로 보지 않는다.
    for (const player of world.players) {
      if (player.local || !player.alive) continue
      const seen = this.silent.get(player.id)
      const t = player.lastSnap?.t ?? null
      if (!seen || seen.t !== t) this.silent.set(player.id, { t, quiet: 0 })
      else if ((seen.quiet += step) > SILENT_LIMIT) dropRemote(world, player)
    }
  }

  afterStep(step) {
    for (const ev of this.world.outbox) this.channel.sendEvent(ev)
    this.world.outbox = []
    // 밀린 걸음을 한 번에 따라잡을 때는 아직 남은 걸음만큼 뺀다(빼지 않으면 그만큼 시계가 앞서가 되돌아오지 않는다).
    const behind = Math.max(0, this.acc - step)
    this.world.time = Math.max(this.world.time, (this.channel.now() - this.startAt) / 1000 - behind)
    this.watchLink(step)
    this.sendT -= step
    const me = this.me
    let due = behind < step // 밀린 걸음을 따라잡는 동안에는 같은 때의 상태를 여러 번 보내지 않는다.
    // 쓰러지면 바로 알리고, 내 화면의 쓰러진 시각도 보낸 값과 똑같이 맞춘다(동시에 쓰러져도 순위가 화면마다 같게).
    if (me && !me.alive && !this.deathSent) {
      this.deathT ??= this.channel.now()
      me.downAt = (this.deathT - this.startAt) / 1000
      this.deathSent = true
      this.sendT = 0
      due = true
    }
    // 남은 간격에 더해 가야 부동소수점 오차로 한 걸음씩 밀리지 않는다(예전에는 초당 10번이 실제 약 8.6번).
    if (this.sendT <= 1e-9 && me && due) {
      this.sendT = Math.max(this.sendT + SEND_EVERY, 0)
      this.sendMe(me)
    }
  }

  finish() {
    const me = this.me
    if (me) this.sendMe(me, 0)
  }
}
