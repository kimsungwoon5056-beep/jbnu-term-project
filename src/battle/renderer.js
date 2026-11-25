import { isReduced } from '../lib/motion'
import { DiveEffect } from './dive'
import { FirstPersonView, VIEW } from './firstPerson/FirstPersonView'
import { CARD_LIFE, CRACK_LIFE, drawBanner, drawCard, drawCrack, drawHurtEdge, drawPop, makeCrack, outlined, WORDS } from './fx'
import { dock, feedCard, statusBar } from './hud'
import { drawIntro } from './intro'
import { BIG_DAMAGE, Motions } from './motions'
import { Pool } from './pool'
import { Rig, rigPose } from './rig'
import { bubbleY, divePhase, isFirstPerson, warningLanes } from './schedule'
import { TopView } from './topView'
import { AREA, ARENA, playerById } from './world'

// 대결 화면 그리기. 세계를 어떤 시점으로 그릴지는 View(Strategy: topView.js·firstPerson)에 맡기고 때에 맞춰 바꿔 끼운다.
// 여기서는 신호에 반응하는 효과(흔들림·파편·의성어·액정 금·알림 카드)와 상태 표시줄·독을 맡는다.

const PARTICLE_COLORS = { hit: ['#ffffff', '#ffd84a', '#ff5a5f'], down: ['#ff3b5c', '#ffd84a', '#7fe7ff', '#ffffff'], item: ['#ffd84a', '#ffffff'], block: ['#b9b0ff', '#ffffff'] }
const HEART_EVERY = 0.9 // 체력이 낮을 때 두근거리는 간격(초)
const LOW_HP = 0.25
const FALL = 1.5 // 1인칭에서 쓰러지는 장면(초)

export class Renderer {
  // Observer: 만들 때 world.signals를 구독해, 신호가 오면 모션·파편·화면 흔들림·푸시 알림을 준비한다.
  constructor(canvas, world, meId, { reduced = isReduced() } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.world = world
    this.meId = meId
    this.reduced = reduced
    // 캐릭터마다 관절 인형 하나. 매 장면 지금 자세를 그려 두고, 어느 시점에서나 그 그림을 쓴다.
    this.rigs = new Map(world.players.map((player) => [player.id, new Rig(player.loadout)]))
    this.sprites = new Map([...this.rigs].map(([id, rig]) => [id, rig.canvas]))
    this.flashes = this.sprites
    this.motions = new Motions({ reduced })
    this.top = new TopView({ meId, sprites: this.sprites, flashes: this.flashes })
    this.first = null // 1인칭 화면은 빨려 들어가기 경고가 뜰 때 만든다.
    this.dive = new DiveEffect({ reduced })
    this.kick = 0
    this.kickDir = 1
    this.recoil = 0
    this.hurtFrom = null
    this.particles = new Pool(() => ({}))
    this.pops = []
    this.cracks = []
    this.cards = []
    this.trails = []
    this.feed = []
    this.banner = null
    this.shake = 0
    this.hurt = 0
    this.heart = 0
    this.heartT = 0
    this.freezeUntil = 0
    this.count = 0 // 의성어를 고를 때 쓰는 차례
    this.last = performance.now()
    this.goAt = null
    this.unsubscribe = world.signals.subscribe((signal) => this.react(signal))
  }

  // 판이 끝나 루프가 멈추면 구독을 끊는다.
  dispose() {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  get me() {
    return playerById(this.world, this.meId)
  }

  react(signal) {
    const now = performance.now()
    const mine = signal.who === this.meId
    const who = signal.who ? playerById(this.world, signal.who) : null
    this.motions.react(signal, who)
    if (signal.kind === 'hit') this.reactHit(signal, mine, now)
    if (signal.kind === 'down') {
      this.burst(signal.x, signal.y - 10, PARTICLE_COLORS.down, 26, 190)
      this.banner = mine
        ? { text: '전원 꺼짐', sub: '끝까지 지켜봐요', color: '#ff3b5c', t: 0, life: 1.6 }
        : { text: `${who?.name ?? '상대'} 로그아웃!`, sub: '폰을 내려놓았어요', color: '#ffd84a', t: 0, life: 1.5 }
      this.freeze(now, 110)
      this.shakeBy(mine ? 0.5 : 0.25)
    }
    if (signal.kind === 'item') {
      this.burst(signal.x, signal.y + 14, PARTICLE_COLORS.item, 14, 120)
      this.pop('item', signal.x, signal.y - 12, { color: '#ffd84a', size: 16 })
      this.feed.push({ text: `${mine ? '나' : (who?.name ?? '상대')} · ${signal.text}`, at: now })
    }
    if (signal.kind === 'block') {
      this.burst(signal.x, signal.y + 12, PARTICLE_COLORS.block, 8, 80)
      this.pop('block', signal.x, signal.y - 8, { color: '#b9b0ff', size: 15 })
    }
    if (signal.kind === 'dash') this.burst(signal.x, signal.y + 8, ['#ffffff', '#cfd6ff'], 6, 60)
    if (signal.kind === 'skill') this.burst(signal.x, signal.y - 8, ['#7fe7ff', '#ffd84a', '#ff7eb6'], 12, 130)
    if (signal.kind === 'splat' && mine && this.cards.length < 3) {
      const n = (this.count += 1)
      this.cards.push({ x: 90 + ((n * 83) % 180), y: AREA.y0 + 110 + ((n * 137) % 240), rot: ((n % 5) - 2) * 0.12, kind: signal.text, t: 0 })
    }
    if (signal.kind === 'storm') this.banner = { text: '알림 폭풍!', sub: '빈 줄로 피해요', color: '#ff3b5c', t: 0, life: 1.3 }
    if (signal.kind === 'go') this.goAt = now
    if (signal.kind === 'shot' && mine) this.recoil = 1
    if (signal.kind === 'glitch') {
      this.prepareFirst()
      this.banner = { text: '화면이 이상하다…', sub: '', color: '#25f4ee', t: 0, life: 1.1 }
    }
    if (signal.kind === 'dive') {
      const touch = Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches)
      this.banner = { text: '폰 속으로!', sub: touch ? '화면을 밀어 둘러봐요' : '마우스로 둘러보기 · WASD 이동', color: '#ff5fa8', t: 0, life: 2.4 }
    }
    if (signal.kind === 'surface') this.banner = { text: '탈출!', sub: '', color: '#4cc96b', t: 0, life: 1 }
  }

  prepareFirst() {
    this.first ??= new FirstPersonView({ world: this.world, meId: this.meId, sprites: this.sprites, flashes: this.flashes })
  }

  // 지금 쓸 시점. 1인칭 중에 쓰러지면 잠깐 넘어지는 화면을 보여 준 뒤 위에서 지켜본다.
  viewOf(world, me) {
    if (!me || !isFirstPerson(world)) return this.top
    if (!me.alive && this.deadAge() >= FALL) return this.top
    this.prepareFirst()
    return this.first
  }

  deadAge() {
    return this.motions.of(this.meId).down?.t ?? Infinity
  }

  reactHit(signal, mine, now) {
    const amount = Math.abs(Number(signal.text)) || 0
    const big = amount >= BIG_DAMAGE
    this.burst(signal.x, signal.y + 10, PARTICLE_COLORS.hit, big ? 16 : 7, big ? 170 : 100)
    this.pop(big ? 'big' : 'hit', signal.x + ((this.count % 3) - 1) * 10, signal.y - 16, { big, color: '#ffffff', size: big ? 22 : 14 })
    if (big) this.freeze(now, 60)
    if (!mine) return
    this.hurt = Math.min(1, this.hurt + 0.3 + amount / 16)
    this.shakeBy(big ? 0.4 : 0.2)
    this.kick = Math.min(1, this.kick + (big ? 0.9 : 0.5))
    this.kickDir = this.motions.of(this.meId).hit?.dir ?? 1
    this.hurtFrom = signal.push ? Math.atan2(-signal.push.y, -signal.push.x) : null
    if (big && this.cracks.length < 2) {
      this.cracks.push(makeCrack((this.count += 1) * 7919))
      this.world.signals.notify({ kind: 'crack', who: this.meId })
    }
  }

  shakeBy(amount) {
    if (!this.reduced) this.shake = Math.max(this.shake, amount)
  }

  // 멈칫: 세계는 그대로 흐르고 그리기만 잠깐 멈춘다.
  freeze(now, ms) {
    if (!this.reduced) this.freezeUntil = Math.max(this.freezeUntil, now + ms)
  }

  pop(kind, x, y, { big = false, color = '#ffffff', size = 14 } = {}) {
    const words = WORDS[kind]
    const n = (this.count += 1)
    if (this.pops.length > 10) this.pops.shift()
    const edge = big ? 58 : 26
    this.pops.push({ text: words[n % words.length], x: Math.min(ARENA.w - edge, Math.max(edge, x)), y: Math.max(AREA.y0 + 20, y), t: 0, life: big ? 0.8 : 0.55, size, big, color, rot: this.reduced ? 0 : ((n % 5) - 2) * 0.1 })
  }

  burst(x, y, colors, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (i % 3) * 0.3
      const v = speed * (0.5 + ((i * 7) % 5) / 8)
      this.particles.acquire({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 40, life: 0.5, color: colors[i % colors.length], size: i % 4 === 0 ? 4 : 3 })
    }
  }

  // 시간이 흐르면 사라지는 것들을 한 번에 흘린다.
  advance(world, dt) {
    this.motions.step(dt, world.players)
    for (const bit of this.particles.active) {
      bit.life -= dt
      bit.x += bit.vx * dt
      bit.y += bit.vy * dt
      bit.vy += 320 * dt
    }
    this.particles.sweep((bit) => bit.life > 0)
    const age = (list, life) => {
      for (const item of list) item.t += dt
      return list.filter((item) => item.t < (item.life ?? life))
    }
    this.pops = age(this.pops)
    this.cracks = age(this.cracks, CRACK_LIFE)
    this.cards = age(this.cards, CARD_LIFE)
    this.trails = age(this.trails, 0.25)
    if (this.banner) {
      this.banner.t += dt
      if (this.banner.t >= this.banner.life) this.banner = null
    }
    this.hurt = Math.max(0, this.hurt - dt * 1.4)
    this.heart = Math.max(0, this.heart - dt * 2.2)
    this.kick = Math.max(0, this.kick - dt * 2.6)
    this.recoil = Math.max(0, this.recoil - dt * 6)
    for (const player of world.players) {
      if (player.alive && player.dashT > 0 && !this.reduced) this.trails.push({ id: player.id, x: player.x, y: player.y, t: 0 })
    }
  }

  // 체력이 낮으면 두근거린다(소리도 같은 신호로 난다).
  beat(world, dt) {
    const { me } = this
    if (!me?.alive || world.over || me.hp / me.maxHp > LOW_HP) return
    this.heartT -= dt
    if (this.heartT > 0) return
    this.heartT = HEART_EVERY
    this.heart = 1
    world.signals.notify({ kind: 'heart', who: this.meId })
  }

  draw(world, { countdown = 0 } = {}) {
    const { ctx } = this
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.last) / 1000)
    if (now < this.freezeUntil) return
    this.last = now
    this.advance(world, dt)
    if (countdown <= 0) this.beat(world, dt)
    this.feed = this.feed.filter((card) => now - card.at < 2200).slice(-3)

    const { me } = this
    const view = this.viewOf(world, me)
    const first = view === this.first
    ctx.imageSmoothingEnabled = false
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, AREA.y0, ARENA.w, AREA.y1 - AREA.y0)
    ctx.clip()
    if (this.shake > 0 && !first) {
      this.shake = Math.max(0, this.shake - dt)
      const power = Math.round(this.shake * 18)
      ctx.translate(((now / 16) % 2 > 1 ? 1 : -1) * power, ((now / 23) % 2 > 1 ? 1 : -1) * power * 0.6)
    }
    this.drawRigs(world)
    const poses = this.motions.poses()
    if (first) {
      view.draw(ctx, world, me, {
        now,
        dt,
        angle: me.aim,
        kick: this.kick,
        roll: this.kick * 0.14 * this.kickDir,
        shot: this.recoil,
        hurtFrom: this.hurtFrom === null ? null : this.hurtFrom - me.aim, // 보는 방향 기준
        hurtPower: this.hurt,
        motions: poses,
        darkCircles: Boolean(me.loadout.debuffs.darkCircles),
        reduced: this.reduced,
        dead: me.alive ? 0 : Math.min(1, this.deadAge() / FALL),
      })
      this.drawFirstPops(view)
    } else {
      view.draw(ctx, world, me, { now, dt, time: world.time, motions: this.motions, poses, particles: this.particles.active, pops: this.pops, trails: this.trails })
    }
    if (world.events) this.dive.draw(ctx, divePhase(world.schedule, world.time), { x: me?.x, y: me?.y, now })
    ctx.restore()

    // 화면(액정)에 생기는 일
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, AREA.y0, ARENA.w, AREA.y1 - AREA.y0)
    ctx.clip()
    drawHurtEdge(ctx, Math.max(this.hurt, this.heart * 0.55))
    for (const card of this.cards) drawCard(ctx, card)
    for (const crack of this.cracks) drawCrack(ctx, crack)
    ctx.restore()

    this.drawHud(world, me, now)
    if (countdown > 0) drawIntro(ctx, world, this.sprites, this.meId, countdown)
    else this.drawGo(now)
  }

  // 지금 자세로 인형을 그린다. 맞은 순간에는 하얗게 번쩍인다.
  drawRigs(world) {
    world.players.forEach((player, i) => {
      const rig = this.rigs.get(player.id)
      const pose = rigPose(this.motions.of(player.id), {
        time: world.time,
        stun: player.alive && player.stunT > 0,
        dash: player.alive && player.dashT > 0,
        aim: player.aim,
        seed: i * 1.7,
        raised: rig.raised,
        reduced: this.reduced,
      })
      rig.draw(pose, { white: player.flashT > 0.1 })
    })
  }

  // 1인칭에서 의성어: 일이 생긴 곳이 화면 어디인지 찾아 그린다. 내게 생긴 일은 화면 가운데 위에
  drawFirstPops(view) {
    for (const pop of this.pops) {
      const { me } = this
      const near = Math.hypot(pop.x - me.x, pop.y + 16 - me.y) < 24
      const spot = near ? null : view.place(pop.x, pop.y + 16)
      if (!near && (!spot || spot.screenX < 0 || spot.screenX > VIEW.w)) continue
      const x = near ? ARENA.w / 2 + pop.rot * 300 : spot.screenX * VIEW.scale
      const y = near ? AREA.y0 + 190 : AREA.y0 + VIEW.horizon * VIEW.scale - Math.min(60, 2400 / Math.max(20, spot.depth))
      drawPop(this.ctx, { ...pop, x, y })
    }
  }

  drawHud(world, me, now) {
    const { ctx } = this
    const { background } = this.top
    const storming = world.events && (warningLanes(world.schedule, world.time).size > 0 || world.schedule.bubbles.some((bubble) => bubbleY(bubble, world.time, AREA) !== null))
    ctx.drawImage(background, 0, 0, ARENA.w, AREA.y0, 0, 0, ARENA.w, AREA.y0)
    statusBar(ctx, world, storming)
    ctx.drawImage(background, 0, AREA.y1, ARENA.w, ARENA.h - AREA.y1, 0, AREA.y1, ARENA.w, ARENA.h - AREA.y1)
    dock(ctx, me)
    if (this.banner) drawBanner(ctx, this.banner)
    this.feed.forEach((card, i) => feedCard(ctx, card.text, i, (now - card.at) / 1000))
  }

  drawGo(now) {
    if (this.goAt === null || now - this.goAt >= 900) return
    const { ctx } = this
    const p = (now - this.goAt) / 900
    ctx.save()
    ctx.globalAlpha = 1 - p
    ctx.translate(ARENA.w / 2, ARENA.h / 2)
    ctx.scale(1 + p * 0.6, 1 + p * 0.6)
    ctx.textAlign = 'center'
    ctx.font = 'bold 36px Galmuri11, sans-serif'
    outlined(ctx, '폰 내려놔!', 0, 0, '#ffd84a', '#14152b', 6)
    ctx.restore()
  }
}
