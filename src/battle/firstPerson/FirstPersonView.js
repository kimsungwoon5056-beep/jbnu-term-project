import { bubbleY, drainLevel, itemAlive, safeOf, STORM, warningLanes } from '../schedule'
import { shotAngle, shotImage } from '../shotArt'
import { AREA, ARENA, OBSTACLES, playerById } from '../world'
import { buildArt, CURTAIN, floorTexture, ITEM_COLORS, OUTER_TILE, PAN, REFLECT, STRIP, TEX, WALL } from './art'
import { drawDead, drawHud, drawOverlays, drawWeapon } from './hud'
import { angleDiff, castRay, columnVisible, focalLength, lineOfSight, project, sortSprites } from './raycast'

// 1인칭 3D 화면. 같은 세계를 읽기만 하고 바꾸지 않는다(온라인 결과가 갈라지지 않게).
// 180×256 작은 화면에 하늘 → 바닥 → 벽 → 빌보드를 그리고, 2배로 키워 경기장 자리(AREA)에 붙인다.
// 이름·숫자·HUD는 작은 화면을 거치지 않고 본 캔버스에 바로 그려 또렷하게 한다.
// info.camera(camera.js의 값)가 있으면 내 눈 대신 그 카메라로 그린다. 나도 빌보드가 되고 hideId인 사람은 그리지 않는다.

export const VIEW = { w: 180, h: 256, fov: (72 * Math.PI) / 180, horizon: 112, eye: 26, scale: 2 }
export const SLOW_MS = 22 // 평균 그리기 시간이 이보다 길면 바닥을 단순하게 그린다
const W = VIEW.w
const H = VIEW.h
const FOCAL = focalLength(VIEW.fov, W)
const BODY = 48 // 캐릭터 그림 크기(세계 단위)
const FOG = { r: 58, g: 36, b: 104, from: 70, range: 560, max: 0.7 }
const FOG_STEPS = 24
const fogStyles = Array.from({ length: FOG_STEPS + 1 }, (_, i) => `rgba(${FOG.r},${FOG.g},${FOG.b},${(i / FOG_STEPS).toFixed(3)})`)
const FOG_PIXEL = (0xff000000 | (FOG.b << 16) | (FOG.g << 8) | FOG.r) >>> 0
const RED_PIXEL = 0x5c3bff // 바닥 경고색(0xBBGGRR)
const HALF_RED = (RED_PIXEL & 0xfefefe) >>> 1
const SHOT_HEIGHT = 20
const FAR_SCALE = 1.25

// 화면 칸마다 정해진 각도
const COL_ANGLE = Float64Array.from({ length: W }, (_, c) => Math.atan((c + 0.5 - W / 2) / FOCAL))
const COL_COS = COL_ANGLE.map((a) => Math.cos(a))

// 효과 글자는 세계에서 사람 머리 위(y가 작은 쪽)에 놓인다. 3D에서는 그만큼 되돌려 발 위치를 찾는다.
const EFFECT_OFFSET = { hit: 20, alarm: 30, block: 30, item: 14, shield: 26, focus: 26, down: 0 }
const EFFECT_COLOR = { hit: '#ffffff', alarm: '#ff3b5c', item: '#ffd84a', block: '#b9b0ff' }
const EFFECT_TEXT = { shield: '실드!', focus: '집중!', down: '아웃!' }
const BITS = { hit: ['#ffffff', '#ffd84a', '#ff5a5f'], down: ['#ff3b5c', '#ffd84a', '#7fe7ff', '#ffffff'], item: ['#ffd84a', '#ffffff'] }

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback)
const unit = (value) => clamp(num(value), 0, 1)
const fogAt = (depth) => clamp((depth - FOG.from) / FOG.range, 0, FOG.max)
const clock = () => globalThis.performance?.now?.() ?? Date.now()
const NO_LANES = new Set()
const NO_BOXES = []

function domCanvas(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

// 로그아웃 묘비(위에서 볼 때와 같은 모양)
function graveImage(makeCanvas) {
  const canvas = makeCanvas(40, 38)
  const ctx = canvas.getContext('2d')
  const box = (color, x, y, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  box('#14152b', 1, 5, 38, 33)
  box('#14152b', 5, 1, 30, 6)
  box('#aab3cc', 4, 7, 32, 31)
  box('#aab3cc', 8, 4, 24, 4)
  box('#7f89a8', 30, 7, 6, 31)
  ctx.fillStyle = '#14152b'
  ctx.font = 'bold 9px Galmuri11, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('로그', 18, 18)
  ctx.fillText('아웃', 18, 29)
  box('#3a9e47', 0, 34, 40, 4)
  return canvas
}

export class FirstPersonView {
  // sprites·flashes: Map(플레이어 id → 48×48 캔버스), makeCanvas: 시험에서 가짜 캔버스를 넣는 자리
  constructor({ world, meId, sprites = new Map(), flashes = new Map(), makeCanvas = domCanvas }) {
    this.meId = meId
    this.sprites = sprites
    this.flashes = flashes
    this.makeCanvas = makeCanvas
    this.grave = graveImage(makeCanvas)
    const me = world ? playerById(world, meId) : null
    this.art = buildArt(makeCanvas, me?.loadout)
    this.buffer = makeCanvas(W, H)
    this.bctx = this.buffer.getContext('2d')
    this.bctx.imageSmoothingEnabled = false
    this.scratch = makeCanvas(BODY * 2, BODY * 2) // 기울인 캐릭터를 잠깐 그리는 곳
    this.sctx = this.scratch.getContext('2d')
    this.sctx.imageSmoothingEnabled = false
    this.zbuffer = new Float32Array(W).fill(Infinity)
    this.lowQuality = false
    this.avgCost = 8
    this.frames = 0
    this.prepareFloor(makeCanvas)

    // 카메라와 이번 프레임 값(프레임마다 새 객체를 만들지 않고 고쳐 쓴다)
    this.x = num(me?.x, (AREA.x0 + AREA.x1) / 2)
    this.y = num(me?.y, (AREA.y0 + AREA.y1) / 2)
    this.lastX = this.x
    this.lastY = this.y
    this.bob = 0
    this.bobPower = 0
    this.frame = { now: 0, dt: 0, angle: 0, kick: 0, roll: 0, shot: 0, dead: 0, hurtFrom: null, hurtPower: 0, motions: null, darkCircles: false, reduced: false }
    this.horizon = VIEW.horizon
    this.eye = VIEW.eye
    // 다른 카메라(영상통화·추격)로 볼 때. 카메라 자리(x, y)와 내 자리(meX, meY)를 나눠 둔다. 내 눈이면 둘이 같다.
    this.camera = null
    this.eyesOf = meId // 이 화면을 보는 눈의 주인(그리지 않는 사람). 추격처럼 아무도 아니면 null
    this.armed = true // 손에 든 폰과 조준점을 그릴지
    this.backSprites = null
    this.meX = this.x
    this.meY = this.y
    this.meAngle = 0
    this.lanes = NO_LANES
    this.safe = null
    this.outside = false // 카메라가 안전 구역 밖인지
    this.meOutside = false // 내가 안전 구역 밖인지
    this.aimed = false // 조준점 안에 보이는 상대가 있는지
    this.ray = {}
    this.point = { x: 0, y: 0 }
    this.spot = {}
    this.safeBoxes = [{ x: 0, y: 0, w: 0, h: 0 }]
    this.queue = [] // 이번 프레임에 그릴 빌보드
    this.pool = []
    this.labels = []
    this.labelPool = []
  }

  // 바닥 텍스처를 픽셀 배열로 꺼내 둔다. 꺼낼 수 없으면 단순 바닥으로.
  prepareFloor(makeCanvas) {
    this.floorW = AREA.x1 - AREA.x0
    this.floorH = AREA.y1 - AREA.y0
    this.lowFloor = makeCanvas(1, 64)
    const low = this.lowFloor.getContext('2d')
    for (let y = 0; y < 64; y += 1) {
      const k = Math.min(1, y / 40)
      low.fillStyle = `rgb(${Math.round(58 + 74 * k)},${Math.round(36 + 40 * k)},${Math.round(104 + 42 * k)})`
      low.fillRect(0, y, 1, 1)
    }
    try {
      const data = floorTexture(makeCanvas).getContext('2d').getImageData(0, 0, this.floorW, this.floorH).data
      this.floorTex = new Uint32Array(data.buffer.slice(0))
      this.floorImage = this.bctx.createImageData(W, H)
      this.floorPix = new Uint32Array(this.floorImage.data.buffer)
    } catch {
      this.lowQuality = true
    }
  }

  // 그리기 시간 평균. 처음 몇 장(그림 준비)은 빼고, 한 번 튄 값은 60ms로 잘라 쓴다.
  noteCost(ms) {
    this.frames += 1
    if (this.frames <= 8) return
    this.avgCost += (Math.min(60, num(ms)) - this.avgCost) * 0.05
    if (this.avgCost > SLOW_MS) this.lowQuality = true
  }

  // ctx의 AREA 자리(360×512)에만 그린다.
  draw(ctx, world, me, info = {}) {
    const started = clock()
    const player = me ?? playerById(world, this.meId) ?? null
    this.read(info, player)
    this.readEvents(world)
    this.scene(world, player)
    const { frame } = this

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, AREA.y0, ARENA.w, AREA.y1 - AREA.y0)
    ctx.clip()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.textBaseline = 'alphabetic'
    ctx.lineJoin = 'miter'
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#05040f'
    ctx.fillRect(0, AREA.y0, ARENA.w, AREA.y1 - AREA.y0)

    // 3D 화면: 흔들림·기울기는 붙일 때 준다. 기울이면 모서리가 비지 않게 그만큼 키운다.
    const fall = clamp(frame.dead / 0.72, 0, 1)
    const roll = frame.reduced ? 0 : frame.roll + fall * fall * 1.2
    const shake = frame.reduced || this.camera ? 0 : frame.kick * 7
    ctx.save()
    ctx.translate(ARENA.w / 2 + Math.round(Math.sin(frame.now * 91) * shake), AREA.y0 + H + Math.round(Math.sin(frame.now * 73 + 1) * shake))
    ctx.rotate(roll)
    const cover = Math.cos(Math.abs(roll)) + (H / W) * Math.sin(Math.min(Math.PI / 2, Math.abs(roll))) + (shake > 0 ? 0.04 : 0)
    ctx.scale(cover, cover)
    ctx.drawImage(this.buffer, -W, -H, W * 2, H * 2)
    this.drawLabels(ctx)
    ctx.restore()

    ctx.translate(0, AREA.y0)
    if (player && this.armed) drawWeapon(ctx, this, player)
    drawOverlays(ctx, this, player)
    if (frame.dead < 0.6) drawHud(ctx, this, world, player)
    if (frame.dead > 0) drawDead(ctx, this)
    ctx.restore()
    this.noteCost(clock() - started)
  }

  // info를 안전한 값으로 옮긴다.
  read(info, player) {
    const { frame } = this
    const source = info ?? {}
    frame.now = num(source.now) / 1000
    frame.dt = clamp(num(source.dt), 0, 0.1)
    frame.angle = num(source.angle, num(player?.aim))
    frame.kick = unit(source.kick)
    frame.roll = clamp(num(source.roll), -0.6, 0.6)
    frame.shot = unit(source.shot)
    frame.dead = unit(source.dead)
    frame.hurtFrom = Number.isFinite(source.hurtFrom) ? source.hurtFrom : null
    frame.hurtPower = unit(source.hurtPower)
    frame.motions = source.motions ?? null
    frame.darkCircles = Boolean(source.darkCircles)
    frame.reduced = Boolean(source.reduced)
    this.camera = source.camera ?? null
    this.backSprites = source.backSprites ?? null
    this.eyesOf = this.camera ? (this.camera.hideId ?? null) : this.meId
    this.armed = this.camera?.weapon !== false
    this.meAngle = this.camera ? num(player?.aim, frame.angle) : frame.angle
    this.meX = clamp(num(player?.x, this.meX), AREA.x0 + 1, AREA.x1 - 1)
    this.meY = clamp(num(player?.y, this.meY), AREA.y0 + 1, AREA.y1 - 1)
    if (this.camera) {
      this.readCamera(this.camera)
      return
    }

    this.x = this.meX
    this.y = this.meY
    // 걷는 흔들림: 위치가 변한 만큼(순간 이동은 뺀다)
    const moved = Math.hypot(this.x - this.lastX, this.y - this.lastY)
    this.lastX = this.x
    this.lastY = this.y
    const speed = frame.dt > 0 && moved < 40 ? moved / frame.dt : 0
    this.bob += (moved < 40 ? moved : 0) * 0.075
    this.bobPower += (clamp(speed / 150, 0, 1.2) - this.bobPower) * Math.min(1, frame.dt * 9)
    const walk = frame.reduced ? 0 : Math.sin(this.bob * 2) * this.bobPower * 0.9
    const fall = clamp(frame.dead / 0.72, 0, 1)
    this.eye = VIEW.eye + walk - fall * fall * 19
    this.horizon = VIEW.horizon + (frame.reduced ? 0 : frame.kick * 9 - frame.shot * 2)
  }

  // 다른 카메라: 자리·각도·눈높이를 그대로 쓴다. 걷는 흔들림·반동·쓰러지는 장면은 내 눈으로 볼 때만 있다.
  readCamera(camera) {
    const { frame } = this
    const angle = num(camera.angle, frame.angle)
    // 맞은 방향은 info.angle(내 조준) 기준으로 온다. 카메라가 보는 쪽 기준으로 바꾼다.
    if (frame.hurtFrom !== null) frame.hurtFrom = angleDiff(angle, frame.hurtFrom + frame.angle)
    frame.angle = angle
    frame.dead = 0
    frame.roll = 0
    if (!this.armed) frame.shot = 0
    this.x = clamp(num(camera.x, this.meX), AREA.x0 + 1, AREA.x1 - 1)
    this.y = clamp(num(camera.y, this.meY), AREA.y0 + 1, AREA.y1 - 1)
    this.eye = num(camera.eye, VIEW.eye)
    this.horizon = num(camera.horizon, VIEW.horizon)
    // 내 눈으로 돌아올 때 걷는 흔들림이 튀지 않게
    this.lastX = this.meX
    this.lastY = this.meY
    this.bobPower = 0
    if (camera.kind === 'call' && !frame.reduced) {
      // 손으로 든 폰처럼 아주 조금 흔들린다.
      this.horizon += Math.sin(frame.now * 1.3) * 1.6 + Math.sin(frame.now * 2.9 + 1) * 0.6
      frame.angle += Math.sin(frame.now * 0.9) * 0.007
      frame.roll = Math.sin(frame.now * 1.1 + 2) * 0.012
    }
  }

  // 세계의 점(높이 height)이 본 캔버스 어디에 보이는지 { x, y, depth }. 화면 앞에 없으면 null
  toScreen(x, y, height = 0) {
    const spot = this.place(x, y)
    if (!spot) return null
    return { x: spot.screenX * VIEW.scale, y: AREA.y0 + (this.horizon + (this.eye - height) * spot.scale) * VIEW.scale, depth: spot.depth }
  }

  // 알림 폭풍 경고 줄과 안전 구역(사건이 꺼진 판에서는 없다)
  readEvents(world) {
    this.lanes = world.events ? warningLanes(world.schedule, world.time) : NO_LANES
    this.laneW = world.schedule?.laneW || 60
    this.safe = world.events && drainLevel(world.time) > 0 ? safeOf(world, AREA) : null
    this.outside = this.beyond(this.x, this.y)
    this.meOutside = this.beyond(this.meX, this.meY)
  }

  // 안전 구역 밖인 자리인지
  beyond(x, y) {
    const { safe } = this
    return Boolean(safe) && (x < safe.x0 || x > safe.x1 || y < safe.y0 || y > safe.y1)
  }

  // 세계의 점을 화면에 놓는다. 앞에 없으면 null. 돌려준 객체는 다음 호출 때 다시 쓴다.
  place(x, y) {
    this.point.x = x
    this.point.y = y
    return project(this, this.frame.angle, VIEW.fov, W, this.point, this.spot)
  }

  scene(world, player) {
    const ctx = this.bctx
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = false
    this.labels.length = 0
    this.queue.length = 0
    this.drawSky(ctx)
    if (this.lowQuality) this.drawLowFloor(ctx)
    else this.drawFloor(ctx)
    this.drawWalls(ctx)
    for (const ring of world.rings) this.drawRing(ctx, ring)
    if (this.safe) this.drawCurtain(ctx)
    this.collect(world, player)
    sortSprites(this.queue)
    for (const sprite of this.queue) this[sprite.kind](ctx, sprite, world)
    this.drawBits(ctx, world)
    this.collectEffects(world)
    ctx.globalAlpha = 1
    this.findAimed(world, player)
  }

  // ---------- 배경 ----------
  drawSky(ctx) {
    const turns = this.frame.angle / (Math.PI * 2)
    const center = Math.round((turns - Math.floor(turns)) * PAN.w)
    const y = Math.round(this.horizon) - PAN.h + 1
    if (y > 0) {
      ctx.fillStyle = '#090922'
      ctx.fillRect(0, 0, W, y)
    }
    const left = W / 2 - center
    ctx.drawImage(this.art.sky, left, y)
    if (left > 0) ctx.drawImage(this.art.sky, left - PAN.w, y)
    if (left + PAN.w < W) ctx.drawImage(this.art.sky, left + PAN.w, y)
    // 쓰러져 지평선이 움직여도 아래가 비지 않게
    ctx.fillStyle = fogStyles[FOG_STEPS]
    ctx.fillRect(0, Math.round(this.horizon), W, H)
  }

  // 바닥 캐스팅: 화면 줄마다 거리가 하나라서 줄 단위로 텍스처를 훑는다.
  drawFloor(ctx) {
    const { floorPix: out, floorTex: tex, floorW: tw, floorH: th, horizon, eye, safe, lanes, laneW } = this
    const cos = Math.cos(this.frame.angle)
    const sin = Math.sin(this.frame.angle)
    const top = clamp(Math.ceil(horizon), 0, H)
    const ox = this.x - AREA.x0
    const oy = this.y - AREA.y0
    const tick = Math.floor(this.frame.now * 10)
    const scroll = Math.floor(this.frame.now * 90)
    const special = safe !== null || lanes.size > 0
    let mask = 0
    for (const lane of lanes) mask |= 1 << lane
    const sx0 = safe ? safe.x0 - AREA.x0 : -1
    const sx1 = safe ? safe.x1 - AREA.x0 : tw
    const sy0 = safe ? safe.y0 - AREA.y0 : -1
    const sy1 = safe ? safe.y1 - AREA.y0 : th
    const fogRB = FOG_PIXEL & 0xff00ff
    const fogG = FOG_PIXEL & 0xff00
    for (let row = top; row < H; row += 1) {
      const depth = (eye * FOCAL) / (row + 0.5 - horizon)
      const fog = Math.round(fogAt(depth) * 256)
      const keep = 256 - fog
      const addRB = Math.imul(fogRB, fog)
      const addG = Math.imul(fogG, fog)
      const step = depth / FOCAL
      const dx = -sin * step
      const dy = cos * step
      let fx = ox + depth * cos - dx * (W / 2 - 0.5)
      let fy = oy + depth * sin - dy * (W / 2 - 0.5)
      let at = row * W
      const end = at + W
      for (; at < end; at += 1, fx += dx, fy += dy) {
        if (!(fx >= 0 && fy >= 0 && fx < tw && fy < th)) {
          out[at] = FOG_PIXEL
          continue
        }
        const ix = fx | 0
        const iy = fy | 0
        let pixel = tex[iy * tw + ix]
        if (special) {
          if (ix < sx0 || ix > sx1 || iy < sy0 || iy > sy1) {
            // 꺼진 화면: 어둡고, 붉은 점이 깜박인다.
            pixel = (pixel >>> 2) & 0x3f3f3f
            if ((((ix >> 2) * 73) ^ ((iy >> 2) * 151) ^ (tick * 37)) % 23 === 0) pixel = 0x32149a
          } else if (mask !== 0 && (mask >> ((ix / laneW) | 0)) & 1) {
            // 경고 줄: 붉은 바닥 위로 내려오는 화살 무늬
            const off = Math.abs((ix % laneW) - laneW / 2) | 0
            pixel = ((pixel & 0xfefefe) >>> 1) + HALF_RED
            if (off < 20 && ((iy + off - scroll) & 31) < 9) pixel = RED_PIXEL
          }
        }
        const rb = ((Math.imul(pixel & 0xff00ff, keep) + addRB) >>> 8) & 0xff00ff
        const g = ((Math.imul(pixel & 0xff00, keep) + addG) >>> 8) & 0xff00
        out[at] = 0xff000000 | rb | g
      }
    }
    if (top < H) ctx.putImageData(this.floorImage, 0, 0, 0, top, W, H - top)
  }

  // 느린 기기: 그라데이션 + 격자 선
  drawLowFloor(ctx) {
    const top = Math.round(this.horizon)
    ctx.drawImage(this.lowFloor, 0, top, W, H - top)
    ctx.fillStyle = 'rgba(220,210,255,0.28)'
    for (let x = AREA.x0; x <= AREA.x1; x += 60) this.floorLine(ctx, x, AREA.y0, x, AREA.y1, 1)
    for (let y = AREA.y0; y <= AREA.y1; y += 64) this.floorLine(ctx, AREA.x0, y, AREA.x1, y, 1)
    ctx.fillStyle = 'rgba(255,59,92,0.75)'
    for (const lane of this.lanes) {
      const x = AREA.x0 + lane * this.laneW
      for (const off of [8, this.laneW / 2, this.laneW - 8]) this.floorLine(ctx, x + off, AREA.y0, x + off, AREA.y1, 2)
    }
    if (this.safe) {
      const { x0, y0, x1, y1 } = this.safe
      this.floorLine(ctx, x0, y0, x1, y0, 2)
      this.floorLine(ctx, x1, y0, x1, y1, 2)
      this.floorLine(ctx, x0, y1, x1, y1, 2)
      this.floorLine(ctx, x0, y0, x0, y1, 2)
    }
  }

  // 바닥 위 선분을 점으로 찍는다(가까운 쪽은 잘라 낸다).
  floorLine(ctx, ax, ay, bx, by, size) {
    const cos = Math.cos(this.frame.angle)
    const sin = Math.sin(this.frame.angle)
    let d1 = (ax - this.x) * cos + (ay - this.y) * sin
    let r1 = -(ax - this.x) * sin + (ay - this.y) * cos
    let d2 = (bx - this.x) * cos + (by - this.y) * sin
    let r2 = -(bx - this.x) * sin + (by - this.y) * cos
    const near = 6
    if (d1 < near && d2 < near) return
    if (d1 < near) {
      r1 += ((r2 - r1) * (near - d1)) / (d2 - d1)
      d1 = near
    } else if (d2 < near) {
      r2 += ((r1 - r2) * (near - d2)) / (d1 - d2)
      d2 = near
    }
    const x1 = W / 2 + (r1 / d1) * FOCAL
    const y1 = this.horizon + (this.eye / d1) * FOCAL
    const x2 = W / 2 + (r2 / d2) * FOCAL
    const y2 = this.horizon + (this.eye / d2) * FOCAL
    const steps = clamp(Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2), 1, 160)
    for (let i = 0; i <= steps; i += 1) ctx.fillRect(Math.round(x1 + ((x2 - x1) * i) / steps), Math.round(y1 + ((y2 - y1) * i) / steps), size, size)
  }

  drawWalls(ctx) {
    const { art, ray, zbuffer, horizon, eye, frame, lowQuality } = this
    const flow = frame.reduced ? 0 : frame.now * 26
    for (let c = 0; c < W; c += 1) {
      castRay(this.x, this.y, frame.angle + COL_ANGLE[c], OBSTACLES, AREA, ray)
      const depth = Math.max(0.6, ray.dist * COL_COS[c])
      zbuffer[c] = depth
      const scale = FOCAL / depth
      const height = ray.box ? WALL.box : WALL.outer
      const top = Math.round(horizon - (height - eye) * scale)
      const bottom = Math.max(top + 1, Math.round(horizon + eye * scale))
      const fog = Math.round(fogAt(depth) * FOG_STEPS)
      const far = scale < FAR_SCALE // 멀면 절반 크기 그림을 쓴다
      let texture
      let floor
      let sx // 텍스처 가로 px(원래 크기 기준)
      let stripX = -1
      if (ray.box) {
        const tower = art.towers[ray.box.app]
        const lit = ray.side === 'y'
        texture = lit ? (far ? tower.litFar : tower.lit) : far ? tower.dimFar : tower.dim
        floor = lit ? tower.litFloor : tower.dimFloor
        sx = Math.min(tower.lit.width - 1, Math.floor(ray.u * tower.lit.width))
      } else {
        const glass = art.glass[ray.face]
        texture = far ? glass.far : glass.wall
        floor = glass.floor
        const along = ray.u * (ray.side === 'x' ? this.floorH : this.floorW) * TEX
        sx = Math.floor(along) % (OUTER_TILE * TEX)
        stripX = Math.floor(along + flow) % STRIP.w
      }
      ctx.drawImage(texture, far ? sx >> 1 : sx, 0, 1, texture.height, c, top, 1, bottom - top)
      if (stripX >= 0) {
        const stripTop = Math.round(horizon - (height - STRIP.y - eye) * scale)
        ctx.drawImage(art.strip, stripX, 0, 1, STRIP.h * TEX, c, stripTop, 1, Math.max(1, Math.round(STRIP.h * scale)))
      }
      if (fog > 0) {
        ctx.fillStyle = fogStyles[fog]
        ctx.fillRect(c, top, 1, bottom - top)
      }
      if (!lowQuality && bottom < H) ctx.drawImage(floor, sx, 0, 1, floor.height, c, bottom, 1, Math.max(1, Math.round(REFLECT * scale)))
    }
  }

  // 꺼진 화면 경계: 칸마다 경계에 닿는 거리를 구해 붉은 커튼을 세운다.
  drawCurtain(ctx) {
    const { safe, frame, ray, zbuffer, horizon, eye } = this
    const box = this.safeBoxes[0]
    box.x = safe.x0
    box.y = safe.y0
    box.w = safe.x1 - safe.x0
    box.h = safe.y1 - safe.y0
    const shift = Math.floor(frame.now * 12) * 7
    // 커튼 밖에 있으면 눈앞을 다 막지 않게 옅게
    ctx.globalAlpha = (this.outside ? 0.36 : 0.72) + 0.12 * Math.sin(frame.now * 7)
    for (let c = 0; c < W; c += 1) {
      const angle = frame.angle + COL_ANGLE[c]
      if (this.outside) {
        castRay(this.x, this.y, angle, this.safeBoxes, AREA, ray)
        if (!ray.box) continue
      } else castRay(this.x, this.y, angle, NO_BOXES, safe, ray)
      const depth = Math.max(1.5, ray.dist * COL_COS[c])
      if (depth >= zbuffer[c]) continue
      const scale = FOCAL / depth
      const along = ray.side === 'x' ? ray.hitY : ray.hitX
      const sx = (Math.floor(along * 1.5) + shift) % CURTAIN.w
      ctx.drawImage(this.art.curtain, Math.max(0, sx), 0, 1, CURTAIN.h, c, Math.round(horizon - (CURTAIN.h - eye) * scale), 1, Math.max(1, Math.round(CURTAIN.h * scale)))
    }
    ctx.globalAlpha = 1
  }

  // ---------- 빌보드 ----------
  // 그림을 벽에 가리지 않는 칸만 그린다. 이어진 칸은 한 번에 그려 호출을 줄인다.
  strip(ctx, image, left, top, width, height, depth, sourceW = image.width, sourceH = image.height) {
    const x0 = Math.round(left)
    const w = Math.max(1, Math.round(width))
    const y0 = Math.round(top)
    const h = Math.max(1, Math.round(height))
    if (x0 >= W || x0 + w <= 0 || y0 >= H || y0 + h <= 0) return false
    const { zbuffer } = this
    const last = Math.min(W, x0 + w)
    let start = -1
    let seen = false
    for (let c = Math.max(0, x0); c <= last; c += 1) {
      const open = c < last && depth < zbuffer[c]
      if (open && start < 0) start = c
      if (!open && start >= 0) {
        ctx.drawImage(image, ((start - x0) / w) * sourceW, 0, ((c - start) / w) * sourceW, sourceH, start, y0, c - start, h)
        start = -1
        seen = true
      }
    }
    return seen
  }

  // 바닥에 놓인 납작한 원(그림자·발판)
  blob(ctx, image, spot, radius, alpha = 1) {
    const w = radius * 2 * spot.scale
    const h = clamp((radius * 2 * this.eye * spot.scale) / spot.depth, 1, w * 0.8)
    ctx.globalAlpha = alpha
    this.strip(ctx, image, spot.screenX - w / 2, this.horizon + this.eye * spot.scale - h / 2, w, h, spot.depth + 1)
    ctx.globalAlpha = 1
  }

  // 세계 크기 w×h인 그림을 바닥에서 base만큼 띄워 세운다.
  stand(ctx, image, spot, w, h, base) {
    return this.strip(ctx, image, spot.screenX - (w * spot.scale) / 2, this.horizon + (this.eye - base - h) * spot.scale, w * spot.scale, h * spot.scale, spot.depth)
  }

  add(kind, x, y, ref, extra = 0) {
    const spot = this.place(x, y)
    if (!spot || spot.depth < 2) return
    // 화면에서 한참 벗어난 것은 줄 세우지 않는다.
    if (spot.screenX < -W - 40 * spot.scale || spot.screenX > W * 2 + 40 * spot.scale) return
    const sprite = this.pool[this.queue.length] ?? (this.pool[this.queue.length] = {})
    sprite.kind = kind
    sprite.depth = spot.depth
    sprite.scale = spot.scale
    sprite.screenX = spot.screenX
    sprite.ref = ref
    sprite.extra = extra
    this.queue.push(sprite)
  }

  collect(world, player) {
    for (const other of world.players) {
      if (this.camera ? other.id === this.eyesOf : other === player || other.id === this.meId) continue
      this.add('drawPlayer', other.x, other.y, other)
    }
    for (const trap of world.traps) this.add('drawTrap', trap.x, trap.y, trap)
    for (const turret of world.turrets ?? []) this.add('drawTurret', turret.x, turret.y, turret)
    for (const shot of world.projectiles.active) this.add('drawShot', shot.x, shot.y, shot)
    if (!world.events) return
    for (const item of world.items) if (itemAlive(item, world.time)) this.add('drawItem', item.x, item.y, item)
    for (const bubble of world.schedule.bubbles) {
      const y = bubbleY(bubble, world.time, AREA)
      if (y === null) continue
      // 지나온 자리에 잔상 두 장
      this.add('drawStorm', bubble.x, y - 34, bubble, 2)
      this.add('drawStorm', bubble.x, y - 17, bubble, 1)
      this.add('drawStorm', bubble.x, y, bubble, 0)
    }
    for (const lane of this.lanes) this.add('drawSign', AREA.x0 + (lane + 0.5) * this.laneW, AREA.y0 + 8, null, lane)
  }

  drawPlayer(ctx, spot, world) {
    const player = spot.ref
    const mine = this.camera !== null && player.id === this.meId
    const chased = mine && this.camera.kind === 'chase'
    const back = chased ? this.backSprites?.get?.(player.id) : null // 추격에서는 내 뒷모습
    const image = back || (player.flashT > 0 && this.flashes.get(player.id)) || this.sprites.get(player.id)
    if (!image) return
    const { scale, depth, screenX } = spot
    const now = this.frame.now
    const motion = this.frame.motions?.get?.(player.id)
    const sx = clamp(num(motion?.sx, 1), 0.2, 3)
    const sy = clamp(num(motion?.sy, 1), 0.2, 3)
    const lift = num(motion?.lift)
    const lying = !player.alive && !Number.isFinite(motion?.rot)
    const rot = lying ? Math.PI / 2 : num(motion?.rot)
    // 바로 앞까지 붙으면 화면을 다 가리지 않게 흐려진다.
    const near = chased ? this.chaseAlpha(spot) : clamp((depth - 2) / 14, 0.15, 1)
    const alpha = clamp(num(motion?.alpha, 1), 0, 1) * near * (player.alive ? 1 : 0.3)
    const floorY = this.horizon + this.eye * scale
    this.blob(ctx, this.art.shadow, spot, 13, player.alive ? near : 0.4)
    if (!player.alive && num(motion?.down) > 0.5) {
      this.stand(ctx, this.grave, spot, 40, 38 * clamp((motion.down - 0.5) / 0.17, 0.05, 1), -1)
      if (alpha <= 0) return
    }
    if (player.alive && player.focusT > 0) this.blob(ctx, this.art.focus, spot, 20 + Math.sin(now * 8) * 2, near)
    const bodyW = BODY * scale * sx
    const bodyH = BODY * scale * sy
    const top = floorY - bodyH - lift * scale + scale

    if (player.alive && player.dashT > 0) {
      // 대시 잔상
      for (let i = 2; i >= 1; i -= 1) {
        const ghost = this.place(player.x - num(player.dashX) * 14 * i, player.y - num(player.dashY) * 14 * i)
        if (!ghost) continue
        ctx.globalAlpha = (0.42 - i * 0.12) * near
        this.stand(ctx, back || (this.sprites.get(player.id) ?? image), ghost, BODY, BODY, -1)
      }
    }

    if (player.alive && near > 0.6 && !chased) this.coverLabels(spot, 26, 0, BODY)
    const traced = mine && !chased && player.alive // 영상통화: 벽 뒤에 있어도 내 자리를 알 수 있게 흐린 그림을 비친다.
    if (traced && rot === 0) {
      ctx.globalAlpha = alpha * 0.4
      ctx.drawImage(image, Math.round(screenX - bodyW / 2), Math.round(top), Math.max(1, Math.round(bodyW)), Math.max(1, Math.round(bodyH)))
    }
    ctx.globalAlpha = alpha
    if (rot === 0) this.strip(ctx, image, screenX - bodyW / 2, top, bodyW, bodyH, depth)
    else {
      const s = this.sctx
      const side = BODY * 2
      s.setTransform(1, 0, 0, 1, 0, 0)
      s.clearRect(0, 0, side, side)
      // 누우면 몸 가운데를, 기울면 발을 축으로 돌린다.
      s.translate(BODY, lying ? side - 12 : side - BODY / 2)
      s.rotate(rot)
      s.scale(sx, sy)
      s.drawImage(image, -BODY / 2, lying ? -BODY / 2 : -BODY + 1)
      const size = side * scale
      const base = lying ? 0 : (BODY / 2) * scale
      this.strip(ctx, this.scratch, screenX - size / 2, floorY - size - lift * scale + base, size, size, depth)
    }
    ctx.globalAlpha = 1
    if (!player.alive) return

    if (player.shieldT > 0 || player.airT > 0) {
      const pulse = 60 + Math.sin(now * 6) * 2
      ctx.globalAlpha = near * 0.9
      this.stand(ctx, player.airT > 0 ? this.art.air : this.art.shield, spot, pulse, pulse, 23 - pulse / 2 + lift)
    }
    ctx.globalAlpha = near
    const badge = Math.max(9, 11 * scale)
    if (player.dndT > 0) this.strip(ctx, this.art.dnd, screenX - bodyW * 0.42 - badge / 2, top - badge * 0.2, badge, badge, depth)
    if (player.stunT > 0) this.strip(ctx, this.art.stun, screenX + bodyW * 0.42 - badge / 2, top - badge * 0.2 - Math.abs(Math.sin(now * 9)) * 2 * scale, badge, badge, depth)
    const stars = motion?.stars === true ? 3 : num(motion?.stars)
    if (stars > 0) {
      const count = Math.min(5, Math.ceil(stars <= 1 ? stars * 3 : stars))
      const size = Math.max(4, 8 * scale)
      for (let i = 0; i < count; i += 1) {
        const turn = now * 5 + (i / count) * Math.PI * 2
        this.strip(ctx, this.art.star, screenX + Math.cos(turn) * 15 * scale - size / 2, top + (4 + Math.sin(turn) * 4) * scale - size / 2, size, size, depth)
      }
    }
    ctx.globalAlpha = 1

    // 이름·체력 막대: 몸 가운데나 좌우 어깨가 보일 때만
    const seen = columnVisible(this.zbuffer, screenX, depth) || columnVisible(this.zbuffer, screenX - bodyW / 5, depth) || columnVisible(this.zbuffer, screenX + bodyW / 5, depth)
    if ((seen || traced) && depth > 8) {
      // 추격에서 내 이름표는 앞을 가리지 않게 발밑에 둔다.
      const label = this.label('name', screenX, chased ? clamp(floorY + 12, 13, H - 8) : Math.max(13, top - 3), player.name ?? '')
      label.own = mine
      label.ratio = clamp(num(player.hp) / (num(player.maxHp) || 1), 0, 1)
      label.alpha = world.over ? 0.6 : 1
    }
  }

  // 추격: 벽에 막혀 바싹 당겨지면 거의 안 보이게, 내 몸이 상대를 가리면 흐려져 앞이 보이게 한다.
  chaseAlpha(spot) {
    const near = clamp((spot.depth - 14) / 34, 0.08, 1)
    const top = this.horizon + (this.eye - 42) * spot.scale // 머리 끝(그림 위쪽은 비어 있다)
    for (const other of this.queue) {
      if (other.kind !== 'drawPlayer' || !other.ref.alive || other.depth <= spot.depth) continue
      if (Math.abs(other.screenX - spot.screenX) > 15 * spot.scale || this.horizon + this.eye * other.scale < top) continue
      if (columnVisible(this.zbuffer, other.screenX, other.depth)) return near * 0.65
    }
    return near
  }

  drawItem(ctx, spot) {
    const item = spot.ref
    const image = this.art.items[item.kind]
    if (!image) return
    const now = this.frame.now
    const color = ITEM_COLORS[item.kind]
    this.blob(ctx, this.art.shadow, spot, 12)
    const lift = 8 + Math.sin(now * 4 + item.id) * 3
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.75 + 0.2 * Math.sin(now * 5 + item.id)
    this.stand(ctx, this.art.glow(color), spot, 62, 62, lift - 16)
    // 멀리서도 보이는 빛기둥
    ctx.globalAlpha = 0.28
    this.stand(ctx, this.art.glow(color), spot, 12, 120, -10)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    // 제자리에서 도는 느낌: 폭을 줄였다 늘린다.
    const turn = 0.55 + 0.45 * Math.abs(Math.cos(now * 2.2 + item.id))
    this.stand(ctx, image, spot, 28 * turn, 28, lift)
  }

  drawTrap(ctx, spot) {
    const now = this.frame.now
    this.blob(ctx, this.art.pad, spot, 18, 0.8 + 0.2 * Math.sin(now * 10))
    ctx.globalAlpha = 0.85
    this.stand(ctx, this.art.trap, spot, 24, 18, 7 + Math.sin(now * 5) * 1.5)
    ctx.globalAlpha = 1
  }

  drawShot(ctx, spot) {
    const shot = spot.ref
    const color = typeof shot.color === 'string' ? shot.color : '#ffd84a'
    const image = this.art.shot(color)
    const head = shotImage(shot.shape, color, this.makeCanvas)
    const glow = this.art.glow(color)
    const mine = this.eyesOf !== null && shot.owner === this.eyesOf
    // 내 탄은 손의 폰에서 나가 점점 조준점 높이로 올라간다.
    const height = (depth) => (mine ? SHOT_HEIGHT + 4 - 12 * clamp(1 - (depth - 14) / 90, 0, 1) : SHOT_HEIGHT)
    const limit = mine ? 22 : 60
    const radius = num(shot.r, 4)
    const beam = shot.pierce === true
    const count = beam ? 9 : 3
    const gap = beam ? 0.011 : 0.02
    this.blob(ctx, this.art.shadow, spot, radius, 0.7)
    for (let i = count; i >= 1; i -= 1) {
      const back = this.place(shot.x - num(shot.vx) * gap * i, shot.y - num(shot.vy) * gap * i)
      if (!back || back.depth < 3) continue
      const size = clamp(radius * 2.4 * back.scale, 2, limit) * (beam ? 1 - i / (count + 3) : 1 - i / (count + 1.4))
      ctx.globalAlpha = 0.65 * (1 - i / (count + 1))
      this.strip(ctx, image, back.screenX - size / 2, this.horizon + (this.eye - height(back.depth)) * back.scale - size / 2, size, size, back.depth)
    }
    const size = clamp(radius * 2.8 * spot.scale, 5, limit)
    const y = this.horizon + (this.eye - height(spot.depth)) * spot.scale
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.8
    this.strip(ctx, glow, spot.screenX - size * 1.4, y - size * 1.4, size * 2.8, size * 2.8, spot.depth)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    const spin = shotAngle(shot)
    // 도는 탄은 폭을 줄였다 늘려 도는 느낌을 낸다.
    const width = shot.shape && spin !== 0 && shot.shape !== 'leaf' ? size * (0.35 + 0.65 * Math.abs(Math.cos(num(shot.age) * 9))) : size
    this.strip(ctx, head, spot.screenX - width * 0.6, y - size * 0.6, width * 1.2, size * 1.2, spot.depth - 0.1)
  }

  // 스스로 쏘는 재생기
  drawTurret(ctx, spot) {
    const turret = spot.ref
    this.blob(ctx, this.art.shadow, spot, 16)
    this.stand(ctx, shotImage('play', turret.color, this.makeCanvas), spot, 30, 30, 6 + Math.sin(num(turret.t) * 8) * 2)
  }

  drawStorm(ctx, spot) {
    const image = this.art.storms[spot.ref.kind] ?? this.art.storms.chat
    const near = clamp((spot.depth - 2) / 16, 0.2, 1)
    if (spot.extra === 0) this.blob(ctx, this.art.redShadow, spot, STORM.w / 2, 0.9 * near)
    ctx.globalAlpha = near * [1, 0.28, 0.13][spot.extra]
    const seen = this.stand(ctx, image, spot, STORM.w + 6, 34, 8 + Math.sin(this.frame.now * 12 + spot.ref.id) * 1.5)
    ctx.globalAlpha = 1
    if (seen && spot.extra === 0 && near > 0.5) this.coverLabels(spot, STORM.w + 6, 8, 42)
  }

  drawSign(ctx, spot) {
    ctx.globalAlpha = Math.sin(this.frame.now * 16) > -0.3 ? 1 : 0.35
    this.stand(ctx, this.art.sign, spot, 26, 26, 36 + Math.abs(Math.sin(this.frame.now * 6 + spot.extra)) * 5)
    ctx.globalAlpha = 1
  }

  // 충격파: 바닥에 퍼지는 도트 고리 세 겹
  drawRing(ctx, ring) {
    const t = num(ring.t)
    const r = ring.r * (0.4 + t * 1.5)
    ctx.fillStyle = ring.color ?? '#ffffff'
    for (let layer = 0; layer < 3; layer += 1) {
      const radius = r * (1 - layer * 0.1)
      const height = layer === 0 ? 2 + t * 22 : 0
      ctx.globalAlpha = clamp(1 - t / 0.4, 0, 1) * [1, 0.6, 0.3][layer]
      for (let i = 0; i < 120; i += 1) {
        const a = (i / 120) * Math.PI * 2
        const spot = this.place(ring.x + Math.cos(a) * radius, ring.y + Math.sin(a) * radius)
        if (!spot || spot.depth < 4 || !columnVisible(this.zbuffer, spot.screenX, spot.depth)) continue
        const size = clamp(Math.round((radius / 14) * spot.scale), 1, 14)
        ctx.fillRect(Math.round(spot.screenX - size / 2), Math.round(this.horizon + (this.eye - height) * spot.scale), size, Math.max(1, Math.round(size * 0.6)))
      }
    }
    ctx.globalAlpha = 1
  }

  // 효과의 발 위치: 사람에게 생긴 일이면 그 사람 자리, 아니면 글자 자리에서 되돌린다.
  effectSpot(world, fx) {
    const who = fx.who ? playerById(world, fx.who) : null
    if (who && fx.kind !== 'item') return this.place(who.x, who.y)
    return this.place(fx.x, fx.y + (EFFECT_OFFSET[fx.kind] ?? 0))
  }

  // 맞거나 쓰러지거나 아이템을 주운 순간의 도트 파편(효과가 생긴 뒤 시간만으로 자리를 정한다)
  drawBits(ctx, world) {
    for (const fx of world.effects) {
      const colors = BITS[fx.kind]
      if (!colors || fx.t > 0.55 || (this.eyesOf !== null && fx.who === this.eyesOf && fx.kind !== 'item')) continue
      const who = fx.kind !== 'item' && fx.who ? playerById(world, fx.who) : null
      const x = who ? who.x : fx.x
      const y = who ? who.y : fx.y + (EFFECT_OFFSET[fx.kind] ?? 0)
      const count = fx.kind === 'down' ? 18 : 9
      ctx.globalAlpha = clamp(1.2 - fx.t / 0.5, 0, 1)
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count + (i % 3) * 0.3
        const v = (fx.kind === 'down' ? 70 : 48) * (0.5 + ((i * 7) % 5) / 8)
        const spot = this.place(x + Math.cos(a) * v * fx.t, y + Math.sin(a) * v * fx.t)
        if (!spot || spot.depth < 4 || !columnVisible(this.zbuffer, spot.screenX, spot.depth - 12)) continue
        const h = Math.max(1, 24 + (40 + ((i * 11) % 7) * 10) * fx.t - 190 * fx.t * fx.t)
        const size = clamp(Math.round((i % 4 === 0 ? 4 : 2.6) * spot.scale), 2, 9)
        ctx.fillStyle = colors[i % colors.length]
        ctx.fillRect(Math.round(spot.screenX), Math.round(this.horizon + (this.eye - h) * spot.scale), size, size)
      }
    }
    ctx.globalAlpha = 1
  }

  // ---------- 글자(본 캔버스에 또렷하게) ----------
  label(kind, x, y, text) {
    const item = this.labelPool[this.labels.length] ?? (this.labelPool[this.labels.length] = {})
    item.kind = kind
    item.x = x
    item.y = y
    item.text = text
    item.alpha = 1
    item.ratio = 0
    item.own = false
    item.color = '#ffffff'
    this.labels.push(item)
    return item
  }

  collectEffects(world) {
    let mine = 0
    for (const fx of world.effects) {
      if (fx.kind === 'shot') continue
      const text = fx.text || EFFECT_TEXT[fx.kind] || ''
      if (!text) continue
      const t = num(fx.t)
      const alpha = clamp(1 - t / 0.8, 0, 1)
      let x
      let y
      if (this.eyesOf !== null && fx.who === this.eyesOf) {
        // 나(영상통화에서는 화면을 보는 상대)에게 생긴 일은 눈앞 아래쪽에 띄운다.
        x = W / 2 + ((mine % 3) - 1) * 26
        y = (this.camera ? 184 : 162) - t * 22
        mine += 1
      } else {
        const spot = this.effectSpot(world, fx)
        if (!spot || spot.depth < 4 || !columnVisible(this.zbuffer, spot.screenX, spot.depth - 10)) continue
        x = spot.screenX
        y = clamp(this.horizon + (this.eye - BODY - 4) * spot.scale - 10 - t * 16, 16, H)
      }
      const label = this.label('effect', x, y, text)
      label.alpha = alpha
      label.color = fx.kind === 'hit' && fx.who === this.meId ? '#ff8a9a' : (EFFECT_COLOR[fx.kind] ?? '#7fe7ff')
    }
  }

  drawLabels(ctx) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    for (const label of this.labels) {
      const x = Math.round(label.x * 2 - W)
      const y = Math.round(label.y * 2 - H)
      ctx.globalAlpha = label.alpha
      if (label.kind === 'name') {
        ctx.fillStyle = 'rgba(20,21,43,0.9)'
        ctx.fillRect(x - 23, y - 7, 46, 8)
        ctx.fillStyle = '#5b2236'
        ctx.fillRect(x - 21, y - 5, 42, 4)
        ctx.fillStyle = label.own ? '#4cc96b' : '#ff5a5f'
        ctx.fillRect(x - 21, y - 5, Math.round(42 * label.ratio), 4)
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillRect(x - 21, y - 5, Math.round(42 * label.ratio), 1)
        ctx.font = '11px Galmuri11, sans-serif'
        ctx.fillStyle = 'rgba(10,8,30,0.85)'
        ctx.fillText(label.text, x + 1, y - 10)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(label.text, x, y - 11)
      } else {
        ctx.font = 'bold 16px Galmuri11, sans-serif'
        ctx.fillStyle = 'rgba(10,8,30,0.85)'
        ctx.fillText(label.text, x + 2, y + 2)
        ctx.fillStyle = label.color
        ctx.fillText(label.text, x, y)
      }
    }
    ctx.globalAlpha = 1
  }

  // 먼 것부터 그리므로, 이미 모은 이름표는 모두 지금 것보다 뒤에 있다. 앞을 가리면 흐리게 한다.
  coverLabels(spot, width, bottom, top) {
    const half = (width * spot.scale) / 2
    const y0 = this.horizon + (this.eye - top) * spot.scale
    const y1 = this.horizon + (this.eye - bottom) * spot.scale
    for (const label of this.labels) {
      if (Math.abs(label.x - spot.screenX) < half && label.y > y0 && label.y - 10 < y1) label.alpha = Math.min(label.alpha, 0.15)
    }
  }

  // 조준점에서 6° 안에 보이는 상대가 있는지
  findAimed(world, player) {
    this.aimed = false
    if (!this.armed) return
    for (const other of world.players) {
      if (!other.alive || other === player || other.id === this.meId) continue
      const dx = other.x - this.x
      const dy = other.y - this.y
      if (Math.hypot(dx, dy) < 1e-6) continue
      if (Math.abs(angleDiff(this.frame.angle, Math.atan2(dy, dx))) > (6 * Math.PI) / 180) continue
      if (lineOfSight(this, other, OBSTACLES, AREA)) {
        this.aimed = true
        return
      }
    }
  }
}
