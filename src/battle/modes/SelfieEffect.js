import { pixelBox } from '../art'
import { outlined } from '../fx'
import { AREA } from '../arena'
import { domCanvas, makeLayer, mirrorPoint, noise, num, outBack, VIEW_H, VIEW_W } from './transforms'

// 셀카 모드: 앞 카메라처럼 좌우가 바뀐다. 내가 맞으면 "찰칵!" 사진이 남는다(photos: 결과 화면용).
// 이름과 글자가 뒤집혀 보이는 것은 일부러다. 카메라 앱 틀은 뒤집지 않는다.

const INK = '#14152b'
export const PHOTO = { max: 4, every: 1.2, delay: 0.1, crop: 96, w: 112, h: 136, show: 1.5 }
const FLASH = 0.35
const CLICK = 0.7
const SULK = 1.8 // 맞은 뒤 표정이 돌아오는 시간(초)

export const CAPTIONS = [
  '알림 맞는 순간',
  '턱 세 개',
  '눈 감았네',
  '증명사진 확정',
  '필터 무용지물',
  '인생샷 실패',
  '프사로 박제',
  '삭제 금지',
  '단톡방 공유됨',
  '콧구멍 셀카',
  '초점은 배경에',
  '보정 불가 판정',
  '흔들린 우정',
  '좋아요 0개',
  '각도가 문제였다',
  '졸업앨범 후보',
]

const hash = (text) => {
  let h = 7
  for (const ch of String(text)) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0
  return h
}

export class SelfieEffect {
  constructor({ reduced = false, makeCanvas = domCanvas } = {}) {
    this.reduced = reduced
    this.makeCanvas = makeCanvas
    this.buffer = makeLayer(makeCanvas, VIEW_W, VIEW_H)
    this.captured = false
    this.photos = [] // [{ url, caption }]
    this.slides = [] // 왼쪽 아래로 나오는 사진 [{ canvas, at }]
    this.last = null // 마지막 사진(오른쪽 아래 작은 그림)
    this.pending = null // 곧 찍을 사진 { at, x, y, caption }
    this.hits = new Map() // 맞은 사람 → 맞은 시각
    this.shotAt = -Infinity
    this.flashAge = Infinity // 번쩍인 뒤 흐른 초(판이 끝나 세계 시계가 멈춰도 사라지게 따로 잰다)
    this.shots = 0
    this.time = 0
    this.frame = { x: VIEW_W / 2, y: AREA.y0 + VIEW_H / 2 } // 내 마지막 자리
  }

  react(signal, world, meId) {
    if (signal?.kind !== 'hit') return
    const time = num(world?.time, this.time)
    this.hits.set(signal.who, time)
    if (signal.who !== meId || time - this.shotAt < PHOTO.every) return
    this.shotAt = time
    this.flashAge = 0
    if (this.shots >= PHOTO.max) return
    // 하얗게 번쩍인 다음 움찔한 얼굴이 찍히게 조금 늦게 찍는다.
    const caption = CAPTIONS[(hash(meId) + Math.floor(time) + this.shots * 5) % CAPTIONS.length]
    this.shots += 1
    this.pending = { at: time + PHOTO.delay, x: num(signal.x, this.frame.x), y: num(signal.y, this.frame.y) + 20, caption }
  }

  // 나갈 때 아직 안 찍은 사진을 마저 찍는다. photos는 남긴다.
  dispose() {
    this.takePending(Infinity)
    this.slides.length = 0
    this.hits.clear()
  }

  draw(ctx, world, me, info = {}) {
    const reduced = info.reduced ?? this.reduced
    const time = num(info.time, num(world?.time))
    this.time = time
    this.flashAge += num(info.dt)
    if (me && Number.isFinite(me.x) && Number.isFinite(me.y)) {
      this.frame.x = me.x
      this.frame.y = me.y
      if (this.pending) Object.assign(this.pending, { x: me.x, y: me.y })
    }
    ctx.save()
    if (this.capture(ctx)) ctx.drawImage(this.buffer.canvas, 0, AREA.y0)
    this.takePending(time)
    this.drawFaces(ctx, world, me, time)
    this.drawFrame(ctx, info, time, reduced)
    this.drawSlides(ctx, time, reduced)
    const age = this.flashAge
    if (age >= 0 && age < FLASH) {
      ctx.globalAlpha = (reduced ? 0.22 : 0.85) * (1 - age / FLASH)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, AREA.y0, VIEW_W, VIEW_H)
    }
    ctx.restore()
  }

  // 지금 화면을 좌우로 뒤집어 담는다.
  capture(ctx) {
    const layer = this.buffer.ctx
    if (!layer) return false
    layer.save()
    layer.translate(VIEW_W, 0)
    layer.scale(-1, 1)
    layer.drawImage(ctx.canvas, 0, AREA.y0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H)
    layer.restore()
    this.captured = true
    return true
  }

  takePending(time) {
    const { pending } = this
    if (!pending || time < pending.at) return
    this.pending = null
    if (!this.captured) return
    const photo = makeLayer(this.makeCanvas, PHOTO.w, PHOTO.h)
    if (!photo.ctx) return
    this.paintPhoto(photo.ctx, pending)
    this.slides.push({ canvas: photo.canvas, at: this.time })
    this.last = photo.canvas
    try {
      const url = photo.canvas.toDataURL('image/png')
      if (url) this.photos.push({ url, caption: pending.caption })
    } catch {
      // 사진 파일을 못 만드는 기기에서는 화면에만 보여 준다.
    }
  }

  // 즉석 사진 한 장: 흰 종이, 사진, 손글씨 자리
  paintPhoto(ctx, { x, y, caption }) {
    const { crop, w, h } = PHOTO
    const clamp = (value, max) => Math.round(Math.min(max, Math.max(0, value)))
    const sx = clamp(mirrorPoint(x) - crop / 2, VIEW_W - crop)
    const sy = clamp(y - AREA.y0 - crop / 2 - 14, VIEW_H - crop)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = INK
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff6e6'
    ctx.fillRect(1, 1, w - 2, h - 2)
    ctx.fillStyle = '#e8d9bd'
    ctx.fillRect(1, h - 4, w - 2, 3)
    ctx.fillStyle = INK
    ctx.fillRect(7, 7, crop + 2, crop + 2)
    ctx.drawImage(this.buffer.canvas, sx, sy, crop, crop, 8, 8, crop, crop)
    ctx.fillStyle = 'rgba(255,190,120,0.12)'
    ctx.fillRect(8, 8, crop, crop)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(10, 10, 14, 2)
    ctx.fillRect(10, 10, 2, 14)
    ctx.textAlign = 'center'
    ctx.font = 'bold 12px Galmuri11, sans-serif'
    ctx.fillStyle = '#3a2a4a'
    ctx.fillText(caption, w / 2, 124)
  }

  // ---------- 카메라 앱 틀 ----------
  smileOf(id, time) {
    const seed = hash(id) % 997
    const normal = 62 + Math.floor(noise(seed + Math.floor(time * 2)) * 37)
    const age = time - (this.hits.get(id) ?? -Infinity)
    if (!(age >= 0 && age < SULK)) return normal
    const low = 1 + Math.floor(noise(seed + Math.floor(time * 6)) * 12)
    return age < SULK * 0.6 ? low : Math.round(low + (normal - low) * ((age / SULK - 0.6) / 0.4))
  }

  drawFaces(ctx, world, me, time) {
    ctx.textAlign = 'center'
    ctx.font = 'bold 11px Galmuri11, sans-serif'
    for (const player of world?.players ?? []) {
      if (!player.alive || !Number.isFinite(player.x) || !Number.isFinite(player.y)) continue
      const smile = this.smileOf(player.id, time)
      const sad = smile < 40
      const x = Math.round(mirrorPoint(player.x)) - 17
      const y = Math.round(player.y) - 32
      const color = sad ? '#ff8a9a' : player.id === me?.id ? '#ffd84a' : '#ffffff'
      ctx.fillStyle = INK
      brackets(ctx, x + 1, y + 1, 34, 30, 8, 2)
      ctx.fillStyle = color
      brackets(ctx, x, y, 34, 30, 8, 2)
      outlined(ctx, `${sad ? ':(' : ':)'} ${smile}%`, x + 17, y + 60, color, INK, 4)
    }
  }

  drawFrame(ctx, info, time, reduced) {
    const top = AREA.y0
    const bottom = AREA.y1
    // 삼등분 줄
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    for (const k of [1, 2]) {
      ctx.fillRect(Math.round((VIEW_W * k) / 3), top, 1, VIEW_H)
      ctx.fillRect(0, Math.round(top + (VIEW_H * k) / 3), VIEW_W, 1)
    }
    // 둥근 찾기창: 모서리를 계단으로 깎는다.
    ctx.fillStyle = '#0b0a18'
    for (const [size, wide] of STAIRS) {
      ctx.fillRect(0, top + size, wide, 3)
      ctx.fillRect(VIEW_W - wide, top + size, wide, 3)
      ctx.fillRect(0, bottom - size - 3, wide, 3)
      ctx.fillRect(VIEW_W - wide, bottom - size - 3, wide, 3)
    }
    ctx.fillRect(0, top, 3, VIEW_H)
    ctx.fillRect(VIEW_W - 3, top, 3, VIEW_H)
    ctx.fillRect(0, top, VIEW_W, 3)
    ctx.fillRect(0, bottom - 3, VIEW_W, 3)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    brackets(ctx, 12, top + 12, VIEW_W - 24, VIEW_H - 24, 18, 2)

    // 위: 셀카 표시, 남은 시간
    pixelBox(ctx, 20, top + 19, 54, 20, 'rgba(20,21,43,0.82)', 5)
    ctx.fillStyle = '#ff7eb6'
    ctx.fillRect(27, top + 25, 11, 8)
    ctx.fillRect(30, top + 23, 5, 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(31, top + 27, 4, 4)
    ctx.textAlign = 'left'
    ctx.font = 'bold 11px Galmuri11, sans-serif'
    ctx.fillText('셀카', 43, top + 33)
    const left = Math.max(0, Math.ceil(num(info.left)))
    const label = `0:${String(Math.min(59, left)).padStart(2, '0')}`
    pixelBox(ctx, VIEW_W - 74, top + 19, 54, 20, 'rgba(20,21,43,0.82)', 5)
    ctx.fillStyle = reduced || Math.floor(time * 2) % 2 === 0 ? '#ff3b5c' : '#7a2440'
    ctx.fillRect(VIEW_W - 67, top + 26, 7, 5)
    ctx.fillRect(VIEW_W - 66, top + 25, 5, 7)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, VIEW_W - 54, top + 33)

    this.drawShutter(ctx)
  }

  drawShutter(ctx) {
    const x = VIEW_W / 2
    const y = AREA.y1 - 34
    const age = this.flashAge
    const pressed = age >= 0 && age < 0.18
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.beginPath()
    ctx.arc(x, y + 1, 19, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, 18, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = pressed ? '#ff7eb6' : 'rgba(255,255,255,0.88)'
    ctx.beginPath()
    ctx.arc(x, y, pressed ? 11 : 13, 0, Math.PI * 2)
    ctx.fill()
    // 방금 찍은 사진
    const tx = VIEW_W - 58
    const ty = y - 15
    pixelBox(ctx, tx - 2, ty - 2, 34, 34, 'rgba(20,21,43,0.82)', 6)
    if (this.last) ctx.drawImage(this.last, 8, 8, PHOTO.crop, PHOTO.crop, tx + 1, ty + 1, 28, 28)
    else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(tx + 8, ty + 16, 14, 4)
      ctx.fillRect(tx + 11, ty + 12, 8, 4)
    }
    if (this.shots > 0) {
      pixelBox(ctx, tx + 22, ty - 6, 14, 13, '#ff3b5c', 3)
      ctx.textAlign = 'center'
      ctx.font = 'bold 10px Galmuri11, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(this.shots), tx + 29, ty + 4)
    }
    if (age >= 0 && age < CLICK) {
      ctx.globalAlpha = Math.min(1, (CLICK - age) / 0.25)
      ctx.textAlign = 'center'
      ctx.font = 'bold 20px Galmuri11, sans-serif'
      outlined(ctx, '찰칵!', x, y - 30, '#ffffff', '#ff3b5c', 5)
      ctx.globalAlpha = 1
    }
  }

  // 왼쪽 아래로 밀려 나왔다가 들어가는 즉석 사진
  drawSlides(ctx, time, reduced) {
    for (let i = this.slides.length - 1; i >= 0; i -= 1) if (!(time - this.slides[i].at < PHOTO.show)) this.slides.splice(i, 1)
    for (const slide of this.slides) {
      const age = Math.max(0, time - slide.at)
      const enter = outBack(Math.min(1, age / 0.3))
      const leave = Math.max(0, (age - PHOTO.show + 0.25) / 0.25)
      ctx.save()
      if (reduced) {
        ctx.globalAlpha = Math.min(1, age / 0.2) * (1 - leave)
        ctx.translate(66, AREA.y1 - 84)
      } else {
        ctx.translate(Math.round(66 - (1 - enter) * 140), Math.round(AREA.y1 - 84 + leave * leave * 160))
        ctx.rotate(-0.1 + (1 - enter) * 0.5)
      }
      ctx.fillStyle = 'rgba(10,8,30,0.4)'
      ctx.fillRect(-PHOTO.w / 2 + 4, -PHOTO.h / 2 + 6, PHOTO.w, PHOTO.h)
      ctx.drawImage(slide.canvas, -PHOTO.w / 2, -PHOTO.h / 2)
      // 붙임 테이프
      ctx.fillStyle = 'rgba(255,126,182,0.75)'
      ctx.fillRect(-18, -PHOTO.h / 2 - 5, 36, 11)
      ctx.restore()
    }
  }
}

// 찾기창 모서리 계단 [내려온 높이, 가로 길이]
const STAIRS = [
  [0, 18],
  [3, 12],
  [6, 8],
  [9, 6],
  [12, 5],
  [15, 4],
]

// 네 모서리 꺾쇠
function brackets(ctx, x, y, w, h, len, thick) {
  for (const right of [false, true]) {
    for (const low of [false, true]) {
      ctx.fillRect(right ? x + w - len : x, low ? y + h - thick : y, len, thick)
      ctx.fillRect(right ? x + w - thick : x, low ? y + h - len : y, thick, len)
    }
  }
}
