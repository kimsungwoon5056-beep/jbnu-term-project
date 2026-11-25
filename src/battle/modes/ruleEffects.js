import { drawAppIcon, pixelBox } from '../art'
import { attackOf } from '../attacks'
import { outlined } from '../fx'
import { skillOfPlayer } from '../loadout'
import { AREA, ARENA } from '../arena'
import { adCount } from './ad'
import { topDealer } from './boss'
import { BEAT, beatsAt } from './rhythm'

// 규칙이 바뀌는 모드의 그리기. 모두 draw(ctx, world, me, info)를 가진다. 세계는 읽기만 한다.
// info: { now, dt, time, t(모드가 켜진 뒤 초), left(남은 초), reduced, sprites }

const W = ARENA.w
const TOP = AREA.y0
const H = AREA.y1 - AREA.y0
const font = (ctx, size, bold = true) => {
  ctx.font = `${bold ? 'bold ' : ''}${size}px Galmuri11, sans-serif`
}

// 위쪽 작은 이름표
function chip(ctx, text, x, y, color, align = 'left') {
  font(ctx, 11)
  const w = ctx.measureText(text).width + 16
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  pixelBox(ctx, Math.round(left), y, Math.round(w), 20, '#14152b', 4)
  pixelBox(ctx, Math.round(left) + 2, y + 2, Math.round(w) - 4, 16, color, 3)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#14152b'
  ctx.fillText(text, left + w / 2, y + 14)
}

// ---------- 짧은 영상 ----------
const CAPTIONS = ['이거 보고 자려고 했는데', '한 편만 더…', '벌써 새벽 3시', '알고리즘이 나를 안다', '다음 영상이 더 재밌대']
export class ShortsEffect {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced
    this.hearts = []
    this.dust = []
  }

  react(signal) {
    if (signal.kind === 'hit' && this.hearts.length < 24) this.hearts.push({ x: W - 26, y: TOP + 300, t: 0, sway: (signal.x ?? 0) % 7 })
    if (signal.kind === 'jump') for (let i = 0; i < 5; i += 1) this.dust.push({ x: signal.x + (i - 2) * 5, y: signal.y + 13, vx: (i - 2) * 26, t: 0 })
  }

  draw(ctx, world, me, info) {
    // 발판 윗면을 밝혀 밟을 수 있는 곳을 알린다.
    const pulse = this.reduced ? 0.7 : 0.6 + Math.sin(info.time * 5) * 0.25
    ctx.globalAlpha = pulse
    ctx.fillStyle = '#25f4ee'
    for (const box of info.obstacles) ctx.fillRect(box.x + 4, box.y - 3, box.w - 8, 3)
    ctx.fillStyle = '#fe2c55'
    ctx.fillRect(0, AREA.y1 - 3, W, 3)
    ctx.globalAlpha = 1
    // 아래로 떨어지는 느낌의 줄
    if (!this.reduced) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      for (let i = 0; i < 14; i += 1) ctx.fillRect((i * 83) % W, TOP + ((i * 61 + info.time * (120 + (i % 3) * 60)) % H), 2, 22)
    }
    for (const bit of this.dust) {
      bit.t += info.dt
      ctx.globalAlpha = Math.max(0, 1 - bit.t / 0.35)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(bit.x + bit.vx * bit.t), Math.round(bit.y - bit.t * 20), 4, 3)
    }
    this.dust = this.dust.filter((bit) => bit.t < 0.35)
    // 오른쪽 단추들
    const likes = Math.floor(120 + info.t * 37)
    ;[
      ['#fe2c55', '♥', `${likes}만`],
      ['#ffffff', '💬', `${Math.floor(likes / 3)}`],
      ['#ffd84a', '➜', '공유'],
    ].forEach(([color, , text], i) => {
      const y = TOP + 250 + i * 54
      ctx.globalAlpha = 0.85
      pixelBox(ctx, W - 40, y, 30, 30, '#14152b', 8)
      pixelBox(ctx, W - 38, y + 2, 26, 26, color, 7)
      ctx.fillStyle = '#14152b'
      if (i === 0) {
        ctx.fillRect(W - 32, y + 9, 5, 5)
        ctx.fillRect(W - 24, y + 9, 5, 5)
        ctx.fillRect(W - 32, y + 13, 13, 4)
        ctx.fillRect(W - 29, y + 17, 7, 3)
        ctx.fillRect(W - 27, y + 20, 3, 2)
      } else if (i === 1) {
        ctx.fillRect(W - 32, y + 9, 14, 9)
        ctx.fillRect(W - 30, y + 18, 4, 4)
      } else {
        ctx.fillRect(W - 32, y + 13, 10, 4)
        ctx.fillRect(W - 25, y + 10, 4, 10)
        ctx.fillRect(W - 21, y + 12, 3, 6)
      }
      font(ctx, 9)
      ctx.textAlign = 'center'
      outlined(ctx, text, W - 25, y + 42, '#ffffff', '#14152b', 3)
    })
    for (const heart of this.hearts) {
      heart.t += info.dt
      const p = heart.t / 1.1
      ctx.globalAlpha = Math.max(0, 1 - p)
      ctx.fillStyle = '#fe2c55'
      const x = Math.round(heart.x + Math.sin(heart.t * 6 + heart.sway) * 8)
      const y = Math.round(heart.y - p * 110)
      ctx.fillRect(x - 4, y - 3, 4, 4)
      ctx.fillRect(x + 1, y - 3, 4, 4)
      ctx.fillRect(x - 4, y, 9, 3)
      ctx.fillRect(x - 2, y + 3, 5, 2)
    }
    this.hearts = this.hearts.filter((heart) => heart.t < 1.1)
    ctx.globalAlpha = 1
    // 자막(바닥에 선 사람을 가리지 않게 위쪽에)과 재생 막대
    font(ctx, 12)
    ctx.textAlign = 'left'
    outlined(ctx, `@나를_닮은_폰 · ${CAPTIONS[Math.floor(info.t / 2.2) % CAPTIONS.length]}`, 10, TOP + 22, '#ffffff', '#14152b', 3)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(0, TOP, W, 3)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, TOP, Math.round(W * Math.min(1, info.t / (info.t + info.left || 1))), 3)
  }
}

// ---------- 광고 ----------
const ADS = [
  { title: '지금 안 보면 손해!', body: '오늘만 99% 할인 (어제도 했음)', color: '#ff1f3d', button: '자세히' },
  { title: '당신만을 위한 추천', body: '방금 말한 거 어떻게 알았지?', color: '#6b5fd3', button: '설치' },
  { title: '폰을 흔들어 보세요', body: '흔들면 앱이 열려요(안 흔들어도 열림)', color: '#00a86b', button: '참여' },
]
export class AdEffect {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced
    this.open = 0 // 광고가 펼쳐진 정도
    this.second = 0
  }

  react() {}

  draw(ctx, world, me, info) {
    const count = me ? adCount(world, me.id) : 0
    this.open = Math.max(0, Math.min(1, this.open + (count >= 1 ? info.dt * 4 : -info.dt * 6)))
    this.second = Math.max(0, Math.min(1, this.second + (count >= 2 ? info.dt * 4 : -info.dt * 6)))
    const wait = Math.max(0, info.skipAt - info.time)
    if (this.open > 0) this.card(ctx, info, ADS[0], 180, TOP + 232, 296, 300, this.open, wait, 0)
    if (this.second > 0) this.card(ctx, info, ADS[1 + (Math.floor(info.time) % 2)], 180, TOP + 410, 250, 130, this.second, wait, 1)
    // 건너뛰기 칸은 광고 위에 보인다.
    const skip = world.items.find((item) => item.kind === 'skip' && !item.taken && info.time >= item.t && info.time < item.until)
    if (skip) this.skipButton(ctx, info, skip)
    if (me && world.modeState.skippedBy === me.id) chip(ctx, '광고를 건너뛰었어요 · 2초 무적', W / 2, TOP + 8, '#ffd84a', 'center')
    else if (world.modeState.skippedBy) chip(ctx, '늦었어요! 광고가 하나 더…', W / 2, TOP + 8, '#ff8a9a', 'center')
    else chip(ctx, wait > 0 ? `${Math.ceil(wait)}초 뒤 건너뛰기` : '건너뛰기를 밟아요!', W / 2, TOP + 8, wait > 0 ? '#dfe6f2' : '#ffd84a', 'center')
  }

  card(ctx, info, ad, cx, cy, w, h, p, wait, n) {
    const ease = 1 - (1 - p) ** 3
    const sway = this.reduced ? 0 : Math.sin(info.time * 1.3 + n * 2) * 8
    ctx.save()
    ctx.translate(Math.round(cx + sway), Math.round(cy + (this.reduced ? 0 : Math.cos(info.time * 1.1 + n) * 5)))
    ctx.scale(ease, ease)
    ctx.globalAlpha = 0.9
    pixelBox(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, '#14152b', 8)
    pixelBox(ctx, -w / 2, -h / 2, w, h, '#ffffff', 6)
    ctx.globalAlpha = 0.95
    pixelBox(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h * 0.55, ad.color, 6)
    // 번쩍이는 줄무늬
    ctx.save()
    ctx.beginPath()
    ctx.rect(-w / 2 + 8, -h / 2 + 8, w - 16, h * 0.55)
    ctx.clip()
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    const shift = this.reduced ? 0 : (info.time * 40) % 40
    for (let i = -h; i < w + h; i += 40) {
      ctx.beginPath()
      ctx.moveTo(-w / 2 + i + shift, h * 0.1)
      ctx.lineTo(-w / 2 + i + 18 + shift, h * 0.1)
      ctx.lineTo(-w / 2 + i + 18 + h * 0.6 + shift, -h / 2)
      ctx.lineTo(-w / 2 + i + h * 0.6 + shift, -h / 2)
      ctx.fill()
    }
    ctx.restore()
    ctx.textAlign = 'center'
    font(ctx, n === 0 ? 24 : 17)
    outlined(ctx, ad.title, 0, -h * 0.2, '#ffffff', '#14152b', 5)
    font(ctx, 12)
    ctx.fillStyle = '#14152b'
    ctx.fillText(ad.body, 0, h * 0.2)
    const bounce = this.reduced ? 1 : 1 + Math.abs(Math.sin(info.time * 5)) * 0.06
    ctx.save()
    ctx.translate(0, h * 0.35)
    ctx.scale(bounce, bounce)
    pixelBox(ctx, -50, -15, 100, 30, '#14152b', 6)
    pixelBox(ctx, -48, -13, 96, 26, '#ffd84a', 5)
    font(ctx, 13)
    ctx.fillStyle = '#14152b'
    ctx.fillText(ad.button, 0, 5)
    ctx.restore()
    font(ctx, 9)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('(광고)', -w / 2 + 14, -h / 2 + 22)
    ctx.restore()
  }

  skipButton(ctx, info, item) {
    const beat = this.reduced ? 0 : Math.abs(Math.sin(info.time * 6)) * 3
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = '#ffd84a'
    ctx.beginPath()
    ctx.arc(item.x, item.y, 34 + beat * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    pixelBox(ctx, item.x - 36, item.y - 15 - beat, 72, 30, '#14152b', 6)
    pixelBox(ctx, item.x - 34, item.y - 13 - beat, 68, 26, '#ffffff', 5)
    font(ctx, 11)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#14152b'
    ctx.fillText('건너뛰기', item.x - 6, item.y + 4 - beat)
    ctx.beginPath()
    ctx.moveTo(item.x + 20, item.y - 5 - beat)
    ctx.lineTo(item.x + 28, item.y - beat)
    ctx.lineTo(item.x + 20, item.y + 5 - beat)
    ctx.fill()
    ctx.fillRect(item.x + 28, item.y - 5 - beat, 2, 10)
    ctx.restore()
  }
}

// ---------- 음악 ----------
const NOTE_COLORS = ['#ff5fa8', '#ffd84a', '#56d7ff', '#b06be0']
export class RhythmEffect {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced
    this.combo = 0
    this.flash = 0
    this.bursts = []
  }

  react(signal, world, meId) {
    if (signal.kind === 'perfect') {
      if (signal.who === meId) {
        this.combo += 1
        this.flash = 1
      }
      this.bursts.push({ x: signal.x, y: signal.y, t: 0 })
    }
    if (signal.kind === 'hit' && signal.who === meId) this.combo = 0
  }

  draw(ctx, world, me, info) {
    const beats = beatsAt(info.t)
    const phase = beats - Math.floor(beats)
    const count = Math.floor(beats)
    const kick = this.reduced ? 0 : (1 - phase) ** 2
    // 바닥 조명: 칸이 박자마다 번갈아 켜진다.
    const size = 45
    for (let y = 0; y * size < H; y += 1) {
      for (let x = 0; x * size < W; x += 1) {
        if ((x + y + count) % 3 !== 0) continue
        ctx.globalAlpha = 0.1 + kick * 0.2
        ctx.fillStyle = NOTE_COLORS[(x * 2 + y + count) % 4]
        ctx.fillRect(x * size + 2, TOP + y * size + 2, size - 4, size - 4)
      }
    }
    // 가장자리 소리 막대
    ctx.globalAlpha = 0.75
    for (let i = 0; i < 24; i += 1) {
      const h = 6 + Math.abs(Math.sin(i * 1.7 + count * 2.1)) * 26 * (this.reduced ? 0.6 : 0.35 + kick)
      ctx.fillStyle = NOTE_COLORS[i % 4]
      ctx.fillRect(i * 15 + 2, AREA.y1 - h, 11, h)
    }
    ctx.globalAlpha = 1
    // 내 둘레의 박자 고리: 줄어들어 겹치는 순간이 박자
    if (me?.alive) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(me.x, me.y - 6, 24, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 0.4 + phase * 0.6
      ctx.strokeStyle = NOTE_COLORS[(count + 1) % 4]
      ctx.beginPath()
      ctx.arc(me.x, me.y - 6, 24 + (1 - phase) * 40, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    for (const burst of this.bursts) {
      burst.t += info.dt
      const p = burst.t / 0.4
      ctx.globalAlpha = Math.max(0, 1 - p)
      ctx.strokeStyle = '#ffd84a'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(burst.x, burst.y - 6, 18 + p * 34, 0, Math.PI * 2)
      ctx.stroke()
    }
    this.bursts = this.bursts.filter((burst) => burst.t < 0.4)
    this.flash = Math.max(0, this.flash - info.dt * 3)
    ctx.globalAlpha = 1
    if (this.combo > 0) {
      ctx.save()
      ctx.translate(W / 2, TOP + 54)
      const pop = 1 + this.flash * 0.35
      ctx.scale(pop, pop)
      font(ctx, 20)
      ctx.textAlign = 'center'
      outlined(ctx, `퍼펙트 ×${this.combo}`, 0, 0, '#ffd84a', '#14152b', 5)
      ctx.restore()
    }
    // 네 박자 표시
    for (let i = 0; i < 4; i += 1) {
      const on = count % 4 === i
      pixelBox(ctx, W / 2 - 46 + i * 24, TOP + 8, 20, 14, '#14152b', 3)
      pixelBox(ctx, W / 2 - 44 + i * 24, TOP + 10, 16, 10, on ? NOTE_COLORS[i] : '#4a4e7a', 2)
    }
  }
}
export const BEAT_SECONDS = BEAT

// ---------- 앱 업데이트 ----------
export class UpdateEffect {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced
  }

  react() {}

  draw(ctx, world, me, info) {
    // 사람마다 머리 위에 바뀐 공격 이름
    font(ctx, 9)
    ctx.textAlign = 'center'
    for (const player of world.players) {
      if (!player.alive) continue
      outlined(ctx, attackOf(player.skillOverride ?? player.loadout.skill).name, Math.min(W - 34, Math.max(34, player.x)), Math.max(TOP + 12, player.y - 62), '#9fd0ff', '#14152b', 3)
    }
    if (info.t < 3 && me) {
      const p = Math.min(1, info.t / 1.2)
      const skill = skillOfPlayer(me)
      ctx.save()
      ctx.globalAlpha = info.t > 2.5 ? (3 - info.t) / 0.5 : 1
      ctx.translate(W / 2, TOP + 250)
      pixelBox(ctx, -132, -62, 264, 124, '#14152b', 8)
      pixelBox(ctx, -128, -58, 256, 116, '#f4f7ff', 7)
      font(ctx, 14)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#14152b'
      ctx.fillText(p < 1 ? '앱 업데이트 설치 중…' : '새 버전으로 바뀌었어요', 0, -34)
      ctx.fillStyle = '#c9d8f2'
      ctx.fillRect(-104, -22, 208, 12)
      ctx.fillStyle = '#2f6bff'
      ctx.fillRect(-104, -22, Math.round(208 * p), 12)
      if (p >= 1) {
        font(ctx, 12)
        ctx.fillStyle = '#2f6bff'
        ctx.fillText(`공격: ${attackOf(me.skillOverride ?? me.loadout.skill).name}`, 0, 14)
        ctx.fillText(`Q: ${skill.name}`, 0, 34)
      } else {
        font(ctx, 11, false)
        ctx.fillStyle = '#565c8f'
        ctx.fillText(`버전 ${(1 + p * 8.9).toFixed(1)} · ${Math.round(p * 100)}%`, 0, 16)
      }
      ctx.restore()
    }
    // 모서리에서 도는 설치 표시
    const turn = this.reduced ? 0 : info.time * 4
    ctx.save()
    ctx.translate(W - 22, TOP + 22)
    ctx.rotate(turn)
    ctx.fillStyle = '#2f6bff'
    for (let i = 0; i < 8; i += 1) {
      ctx.globalAlpha = 0.25 + (i / 8) * 0.75
      ctx.fillRect(Math.cos((i * Math.PI) / 4) * 11 - 2, Math.sin((i * Math.PI) / 4) * 11 - 2, 5, 5)
    }
    ctx.restore()
  }
}

// ---------- 알고리즘 보스 ----------
export class BossEffect {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced
    this.roar = 0
    this.bits = []
    this.texts = []
    this.down = null
  }

  react(signal) {
    if (signal.kind === 'bossshot') this.roar = 1
    if (signal.kind === 'bosshit') {
      for (let i = 0; i < 4; i += 1) this.bits.push({ x: signal.x, y: signal.y, vx: (i - 1.5) * 70, vy: -60 - i * 20, t: 0 })
      if (this.texts.length < 14) this.texts.push({ x: signal.x, y: signal.y, text: signal.text, t: 0 })
    }
    if (signal.kind === 'bossdown') this.down = { x: signal.x, y: signal.y, t: 0 }
    if (signal.kind === 'reward') this.texts.push({ x: signal.x, y: signal.y, text: signal.text, t: 0, good: true })
  }

  draw(ctx, world, me, info) {
    const { boss } = world
    if (boss?.alive) this.body(ctx, boss, me, info)
    if (this.down) {
      this.down.t += info.dt
      const p = this.down.t / 1.2
      if (p < 1) {
        for (let i = 0; i < 26; i += 1) {
          const a = (Math.PI * 2 * i) / 26
          const d = p * (70 + (i % 5) * 26)
          ctx.globalAlpha = 1 - p
          ctx.fillStyle = ['#e50914', '#ffd84a', '#ffffff', '#56d7ff'][i % 4]
          ctx.fillRect(Math.round(this.down.x + Math.cos(a) * d) - 4, Math.round(this.down.y + Math.sin(a) * d) - 4, 8, 8)
        }
        ctx.globalAlpha = 1
        font(ctx, 24)
        ctx.textAlign = 'center'
        outlined(ctx, '알고리즘 차단!', W / 2, TOP + 150, '#ffd84a', '#14152b', 6)
      }
    }
    for (const bit of this.bits) {
      bit.t += info.dt
      ctx.globalAlpha = Math.max(0, 1 - bit.t / 0.4)
      ctx.fillStyle = '#ffd84a'
      ctx.fillRect(Math.round(bit.x + bit.vx * bit.t), Math.round(bit.y + bit.vy * bit.t + 220 * bit.t * bit.t), 4, 4)
    }
    this.bits = this.bits.filter((bit) => bit.t < 0.4).slice(-60)
    ctx.textAlign = 'center'
    for (const item of this.texts) {
      item.t += info.dt
      ctx.globalAlpha = Math.max(0, 1 - item.t / 0.7)
      font(ctx, item.good ? 18 : 12)
      outlined(ctx, item.text, item.x, item.y - item.t * 30, item.good ? '#4cc96b' : '#ffffff', '#14152b', 3)
    }
    this.texts = this.texts.filter((item) => item.t < 0.7)
    ctx.globalAlpha = 1
    this.roar = Math.max(0, this.roar - info.dt * 3)
    if (boss) this.hud(ctx, world, boss, me)
  }

  // 커다란 눈이 달린 추천 카드 더미
  body(ctx, boss, me, info) {
    const { reduced } = this
    const x = Math.round(boss.x)
    const y = Math.round(boss.y + (reduced ? 0 : Math.sin(info.time * 3) * 4))
    ctx.fillStyle = 'rgba(10,8,30,0.4)'
    ctx.beginPath()
    ctx.ellipse(x, y + 58, 46, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    // 둘레를 도는 추천 카드
    for (let i = 0; i < 8; i += 1) {
      const a = (reduced ? 0 : info.time * 1.4) + (Math.PI * 2 * i) / 8
      const cx = x + Math.cos(a) * 58
      const cy = y + Math.sin(a) * 40
      pixelBox(ctx, cx - 11, cy - 8, 22, 16, '#14152b', 3)
      pixelBox(ctx, cx - 9, cy - 6, 18, 12, ['#e50914', '#ff1f3d', '#6b5fd3', '#2f6bff'][i % 4], 2)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(cx - 3, cy - 4)
      ctx.lineTo(cx + 4, cy)
      ctx.lineTo(cx - 3, cy + 4)
      ctx.fill()
    }
    const s = 1 + this.roar * (reduced ? 0 : 0.12)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    const hurt = boss.flashT > 0
    pixelBox(ctx, -42, -40, 84, 80, '#14152b', 12)
    pixelBox(ctx, -39, -37, 78, 74, hurt ? '#ffffff' : '#2a0a12', 11)
    pixelBox(ctx, -34, -32, 68, 64, hurt ? '#ffe3e4' : '#7a0f1c', 9)
    // 눈
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(0, -6, 25, 20, 0, 0, Math.PI * 2)
    ctx.fill()
    const look = me ? Math.atan2(me.y - y, me.x - x) : Math.PI / 2
    const ix = Math.cos(look) * 9
    const iy = -6 + Math.sin(look) * 6
    ctx.fillStyle = '#e50914'
    ctx.beginPath()
    ctx.arc(ix, iy, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#14152b'
    ctx.beginPath()
    ctx.moveTo(ix - 4, iy - 6)
    ctx.lineTo(ix + 6, iy)
    ctx.lineTo(ix - 4, iy + 6)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(ix + 2, iy - 8, 4, 4)
    // 화난 눈꺼풀과 입
    ctx.fillStyle = hurt ? '#ffe3e4' : '#7a0f1c'
    ctx.beginPath()
    ctx.moveTo(-30, -30)
    ctx.lineTo(0, -18)
    ctx.lineTo(30, -30)
    ctx.lineTo(30, -36)
    ctx.lineTo(-30, -36)
    ctx.fill()
    const mouth = 4 + this.roar * 10
    ctx.fillStyle = '#14152b'
    ctx.fillRect(-20, 18, 40, mouth)
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 5; i += 1) ctx.fillRect(-18 + i * 8, 18, 4, 3)
    ctx.restore()
  }

  hud(ctx, world, boss, me) {
    const w = 240
    const x = (W - w) / 2
    const y = TOP + 8
    pixelBox(ctx, x - 3, y, w + 6, 20, '#14152b', 4)
    ctx.fillStyle = '#4a1520'
    ctx.fillRect(x, y + 3, w, 14)
    ctx.fillStyle = '#ff3b5c'
    ctx.fillRect(x, y + 3, Math.round((w * boss.hp) / boss.maxHp), 14)
    font(ctx, 11)
    ctx.textAlign = 'center'
    outlined(ctx, `${boss.name} ${boss.hp}/${boss.maxHp}`, W / 2, y + 14, '#ffffff', '#14152b', 3)
    const top = topDealer(boss)
    const mine = me ? (boss.dealt.get(me.id) ?? 0) : 0
    const leader = world.players.find((player) => player.id === top)
    font(ctx, 10)
    outlined(ctx, top === me?.id ? `내가 1등! 피해 ${mine}` : leader ? `1등 ${leader.name} ${boss.dealt.get(top)} · 나 ${mine}` : '먼저 때려 보세요', W / 2, y + 34, top === me?.id ? '#ffd84a' : '#ffffff', '#14152b', 3)
  }
}

// 앱 아이콘이 날아와 화면 가득 열리는 장면. phase·p: schedule.divePhase
export function drawAppOpen(ctx, mode, { phase, p }, { time, reduced }) {
  const cx = W / 2
  const cy = TOP + H / 2
  if (phase === 'warn') {
    // 아래에서 통통 튀며 올라온다.
    const rise = 1 - (1 - Math.min(1, p / 0.4)) ** 3
    const y = AREA.y1 + 60 - rise * 130 - (reduced ? 0 : Math.abs(Math.sin(p * 14)) * 14 * (1 - p))
    const wiggle = reduced ? 0 : Math.sin(time * 34) * 0.14 * p
    ctx.save()
    ctx.translate(cx, y)
    ctx.rotate(wiggle)
    drawAppIcon(ctx, mode.icon, -32, -32, 64)
    ctx.restore()
    font(ctx, 13)
    ctx.textAlign = 'center'
    outlined(ctx, `${mode.label} 여는 중…`, cx, y + 54, '#ffffff', '#14152b', 4)
    return
  }
  if (phase === 'in') {
    const q = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5
    const size = reduced ? 1 : q * q
    ctx.save()
    ctx.globalAlpha = reduced ? q : 1
    ctx.beginPath()
    ctx.rect(0, TOP, W, H)
    ctx.clip()
    if (p < 0.5) {
      const w = 64 + (W * 1.3 - 64) * size
      const h = 64 + (H * 1.3 - 64) * size
      pixelBox(ctx, cx - w / 2, cy + (1 - size) * 180 - h / 2, w, h, mode.color, 12)
      const icon = 64 + size * 40
      drawAppIcon(ctx, mode.icon, Math.round(cx - icon / 2), Math.round(cy + (1 - size) * 180 - icon / 2), Math.round(icon))
    } else {
      // 열린 앱 화면이 위로 걷힌다.
      const lift = 1 - q
      ctx.fillStyle = mode.color
      ctx.fillRect(0, TOP - lift * H, W, H)
      drawAppIcon(ctx, mode.icon, cx - 52, Math.round(cy - 52 - lift * H), 104)
    }
    ctx.restore()
    return
  }
  if (phase === 'out' && !reduced) {
    // 화면이 아이콘으로 줄어들며 닫힌다.
    const q = 1 - p
    ctx.save()
    ctx.globalAlpha = q
    ctx.strokeStyle = mode.color
    ctx.lineWidth = 10
    const w = 40 + (W - 40) * q * q
    const h = 40 + (H - 40) * q * q
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
    ctx.restore()
  }
}
