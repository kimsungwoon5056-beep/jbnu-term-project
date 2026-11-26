import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../../profile/look'
import { buildLoadout } from '../loadout'
import { AREA, ARENA, createWorld, spawnEvent } from '../world'
import { LowPowerEffect, RETRO, toneOf } from './LowPowerEffect'
import { RotateEffect } from './RotateEffect'
import { CAPTIONS, PHOTO, SelfieEffect } from './SelfieEffect'
import { TORCH, TorchEffect } from './TorchEffect'
import { CENTER, fitScale, forwardRotate, inCone, makeLayer, mirrorPoint, outBack, ROTATE, rotatePoint, rotationAt, VIEW_H, VIEW_W } from './transforms'

const PI = Math.PI

describe('자동 회전 계산', () => {
  it('크기와 가운데가 경기장과 같다', () => {
    expect([VIEW_W, VIEW_H]).toEqual([ARENA.w, AREA.y1 - AREA.y0])
    expect(CENTER).toEqual({ x: (AREA.x0 + AREA.x1) / 2, y: (AREA.y0 + AREA.y1) / 2 })
  })

  it('0 → 90 → 180 → 270도로 멈췄다 돌고, 끝나기 0.5초 전부터 0도다', () => {
    const total = 10
    const at = (t) => rotationAt(t, { left: total - t })
    expect(at(0).angle).toBe(0)
    const gap = (total - ROTATE.tail - ROTATE.flick - ROTATE.first) / 3
    for (let k = 0; k < 3; k += 1) expect(at(ROTATE.first + gap * k + 0.5).angle).toBeCloseTo((PI / 2) * (k + 1))
    for (const t of [total - 0.5, total - 0.2, total, total + 1]) expect(at(t).angle).toBeCloseTo(0)
    expect(at(total - 0.6).angle).not.toBe(0)
    expect(at(total).scale).toBe(1)
  })

  it('어느 길이여도 각도·배율이 유한하고, 조금씩만 변하고, 0도로 끝난다', () => {
    for (const total of [0, 0.3, 1, 2, 4, 6, 8, 9.3, 12, 15, 20, 30]) {
      let before = null
      for (let t = 0; t <= total + 1; t += 1 / 240) {
        const { angle, scale } = rotationAt(t, { left: total - t })
        expect(Number.isFinite(angle) && Number.isFinite(scale)).toBe(true)
        expect(scale).toBeGreaterThan(0.5)
        expect(scale).toBeLessThanOrEqual(1)
        if (before !== null) expect(Math.abs(Math.sin((angle - before) / 2)), `${total}초 중 ${t}`).toBeLessThan(0.2)
        before = angle
      }
      expect(rotationAt(total, { left: 0 }).angle).toBe(0)
    }
  })

  it('left가 없으면 계속 돌고, 이상한 값에도 유한하다', () => {
    expect(rotationAt(ROTATE.first + ROTATE.every * 4 + 1).angle).toBeCloseTo(PI / 2)
    for (const t of [NaN, undefined, -5, Infinity]) {
      for (const left of [NaN, undefined, -5, Infinity]) {
        for (const reduced of [false, true]) {
          const { angle, scale } = rotationAt(t, { left, reduced })
          expect(Number.isFinite(angle) && Number.isFinite(scale)).toBe(true)
        }
      }
    }
  })

  it('움직임 줄이기면 0도와 180도뿐이다', () => {
    const seen = new Set()
    for (let t = 0; t <= 10; t += 0.01) {
      const { angle, scale } = rotationAt(t, { reduced: true, left: 10 - t })
      seen.add(angle)
      expect(scale).toBe(1)
    }
    expect([...seen].sort()).toEqual([0, PI])
    expect(rotationAt(9.6, { reduced: true, left: 0.4 }).angle).toBe(0)
  })

  it('돌린 경기장 네 귀퉁이가 늘 화면 안에 있다', () => {
    expect(fitScale(PI / 2)).toBeCloseTo(360 / 512)
    expect(fitScale(0)).toBe(1)
    expect(fitScale(PI)).toBeCloseTo(1)
    for (let t = 0; t < 12; t += 0.02) {
      for (const x of [AREA.x0, AREA.x1]) {
        for (const y of [AREA.y0, AREA.y1]) {
          const p = forwardRotate(x, y, t, { left: 12 - t })
          expect(p.x).toBeGreaterThan(AREA.x0 - 1e-6)
          expect(p.x).toBeLessThan(AREA.x1 + 1e-6)
          expect(p.y).toBeGreaterThan(AREA.y0 - 1e-6)
          expect(p.y).toBeLessThan(AREA.y1 + 1e-6)
        }
      }
    }
  })

  it('시계 방향으로 돈다: 90도에서 오른쪽 점은 아래로 간다', () => {
    const t = ROTATE.first + 1
    const p = forwardRotate(CENTER.x + 100, CENTER.y, t)
    expect(p.x).toBeCloseTo(CENTER.x)
    expect(p.y).toBeCloseTo(CENTER.y + 100 * (360 / 512))
  })

  it('화면의 점을 되돌리면 원래 자리다', () => {
    for (const reduced of [false, true]) {
      for (let t = 0; t < 12; t += 0.037) {
        const opts = { reduced, left: 12 - t }
        for (const [x, y] of [[0, 36], [360, 548], [33, 470], [180, 292]]) {
          const shown = forwardRotate(x, y, t, opts)
          const back = rotatePoint(shown.x, shown.y, t, opts)
          expect(back.x).toBeCloseTo(x)
          expect(back.y).toBeCloseTo(y)
        }
      }
    }
  })

  it('지나쳤다 돌아오는 움직임', () => {
    expect(outBack(0)).toBe(0)
    expect(outBack(1)).toBe(1)
    expect(outBack(0.7)).toBeGreaterThan(1)
    expect(outBack(NaN)).toBe(0)
  })
})

describe('셀카·손전등 계산', () => {
  it('좌우가 바뀐다', () => {
    expect(mirrorPoint(0)).toBe(360)
    expect(mirrorPoint(mirrorPoint(77))).toBe(77)
  })

  it('부채꼴 안인지', () => {
    const me = { x: 100, y: 100 }
    const half = PI / 6
    expect(inCone(150, 100, me, 0, half, 100)).toBe(true)
    expect(inCone(150, 120, me, 0, half, 100)).toBe(true)
    expect(inCone(150, 140, me, 0, half, 100)).toBe(false)
    expect(inCone(250, 100, me, 0, half, 100)).toBe(false)
    expect(inCone(50, 100, me, 0, half, 100)).toBe(false)
    expect(inCone(50, 99, me, PI, half, 100)).toBe(true)
    expect(inCone(50, 101, me, -PI, half, 100)).toBe(true)
    expect(inCone(150, 100, me, PI * 8, half, 100)).toBe(true)
    expect(inCone(100, 100, me, 2, half, 100)).toBe(true)
    expect(inCone(150, 100, null, 0, half, 100)).toBe(false)
    expect(inCone(NaN, 100, me, 0, half, 100)).toBe(false)
    expect(inCone(150, 100, me, NaN, half, 100)).toBe(false)
  })

  it('저전력 색 단계는 밝을수록 커진다', () => {
    expect(toneOf(0, 0, 0)).toBe(0)
    expect(toneOf(255, 1, 1)).toBe(3)
    expect(toneOf(NaN, 0, 0)).toBe(0)
    for (let luma = 1; luma < 256; luma += 1) expect(toneOf(luma, 0, 1)).toBeGreaterThanOrEqual(toneOf(luma - 1, 0, 1))
  })
})

// ---------- 그리기: 가짜 2D 컨텍스트 ----------
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })

const calls = { total: 0, texts: [], byName: {}, depth: 0 }
const NUMERIC = /^(drawImage|fillRect|clearRect|strokeRect|rect|arc|ellipse|moveTo|lineTo|translate|rotate|scale|setTransform|transform|fillText|strokeText|putImageData|getImageData|create.*Gradient)$/

// 숫자 인자에 NaN·Infinity가 오거나 상태를 못 되돌리면 실패한다.
function fakeContext(canvas) {
  const state = { canvas, globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true }
  const stack = []
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'getImageData')
        return (x, y, w, h) => {
          if (![x, y, w, h].every(Number.isFinite)) throw new Error('getImageData에 이상한 숫자')
          calls.byName.getImageData = (calls.byName.getImageData ?? 0) + 1
          if (canvas.locked) throw new Error('SecurityError')
          return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(120) }
        }
      return (...args) => {
        calls.total += 1
        calls.byName[key] = (calls.byName[key] ?? 0) + 1
        if (key === 'fillText') calls.texts.push(String(args[0]))
        if (NUMERIC.test(key)) for (const arg of args) if (arg === undefined || (typeof arg === 'number' && !Number.isFinite(arg))) throw new Error(`${key}에 이상한 숫자: ${args.map(String).join(', ')}`)
        if (key === 'drawImage' && !args[0]) throw new Error('drawImage에 그림이 없음')
        if (key === 'arc' && args[2] < 0) throw new Error('arc 반지름이 음수')
        if (key === 'save') stack.push({ ...target })
        if (key === 'restore') {
          if (stack.length === 0) throw new Error('save 없이 restore')
          Object.assign(target, stack.pop())
        }
        calls.depth = stack.length
        return undefined
      }
    },
    set(target, key, value) {
      if ((key === 'globalAlpha' || key === 'lineWidth') && !Number.isFinite(value)) throw new Error(`${String(key)}가 이상함: ${value}`)
      if (key === 'globalAlpha' && (value < 0 || value > 1)) throw new Error(`globalAlpha가 벗어남: ${value}`)
      if ((key === 'fillStyle' || key === 'strokeStyle') && (value === undefined || /NaN|undefined|Infinity/.test(String(value)))) throw new Error(`색이 이상함: ${value}`)
      target[key] = value
      return true
    },
  })
}

function makeCanvas(w, h, extra = {}) {
  const canvas = { width: w, height: h, toDataURL: () => 'data:image/png;base64,AAAA', ...extra }
  const ctx = fakeContext(canvas)
  canvas.getContext = () => ctx
  return canvas
}

function makeWorld() {
  const world = createWorld({ seed: 3, players: ['a', 'b', 'c'].map((id, i) => ({ id, loadout: loadout(`친구${id}`), local: i === 0 })) })
  world.items[0].t = 0
  return world
}

const EFFECTS = { RotateEffect, SelfieEffect, TorchEffect, LowPowerEffect }
const infoAt = (t, extra = {}) => ({ now: t * 1000, dt: 1 / 60, time: 20 + t, t, left: 12 - t, reduced: false, sprites: new Map(['a', 'b', 'c'].map((id) => [id, makeCanvas(48, 48)])), ...extra })
const SIGNALS = [
  { kind: 'hit', who: 'a', x: 180, y: 200, text: '-3', push: { x: 1, y: 0 } },
  { kind: 'hit', who: 'b', x: 80, y: 100, text: '-9', push: null },
  { kind: 'hit', who: 'a' },
  { kind: 'shot', who: 'b', x: 80, y: 100 },
  { kind: 'skill', who: 'a', x: 180, y: 200 },
  { kind: 'skill', who: 'a', x: NaN, y: 200 },
  { kind: 'storm', who: null },
  { kind: 'down', who: 'c', x: 1, y: 2 },
  { kind: 'splat', who: 'a', x: 1, y: 2, text: 'chat' },
  {},
  null,
]

describe.each(Object.entries(EFFECTS))('%s 그리기', (name, Effect) => {
  beforeEach(() => Object.assign(calls, { total: 0, texts: [], byName: {}, depth: 0 }))

  it('0~12초, 살아 있음·쓰러짐·없음, 여러 신호에도 이상한 숫자 없이 그리고 상태를 되돌린다', () => {
    const world = makeWorld()
    const [me, foe] = world.players
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    for (const reduced of [false, true]) {
      const effect = new Effect({ reduced, makeCanvas })
      for (let t = 0; t <= 12.2; t += 0.1) {
        world.time = 20 + t
        Object.assign(me, { x: (t * 97) % 360, y: AREA.y0 + ((t * 61) % 512), aim: t * 3 - 10, alive: Math.floor(t) % 5 !== 4 })
        foe.alive = t < 8
        if (Math.floor(t * 10) % 7 === 0) {
          spawnEvent(world, { k: 'shot', o: 'b', x: 180, y: 430, a: t })
          for (const signal of SIGNALS) effect.react(signal, world, 'a')
        }
        for (const who of [me, null, undefined]) effect.draw(ctx, world, who, infoAt(t, { reduced }))
        expect(calls.depth).toBe(0)
      }
      effect.dispose()
    }
    expect(calls.total).toBeGreaterThan(100)
    expect(ctx.globalAlpha).toBe(1)
    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('이상한 info·자리·각도와 빈 세계에도 그린다', () => {
    const world = makeWorld()
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    const effect = new Effect({ makeCanvas })
    for (const signal of SIGNALS) effect.react(signal, world, 'a')
    effect.draw(ctx, world, world.players[0], undefined)
    for (const bad of [NaN, undefined, Infinity, -1]) effect.draw(ctx, world, world.players[0], { now: bad, dt: bad, time: bad, t: bad, left: bad })
    Object.assign(world.players[0], { x: NaN, y: NaN, aim: NaN })
    effect.draw(ctx, world, world.players[0], infoAt(3))
    Object.assign(world.players[0], { x: -50, y: 900, aim: 1e9 })
    for (let t = 0; t < 12; t += 0.5) effect.draw(ctx, world, world.players[0], infoAt(t))
    effect.draw(ctx, { players: [], items: [], time: 1 }, null, infoAt(3))
    effect.draw(ctx, {}, null, infoAt(3))
    for (const signal of SIGNALS) effect.react(signal, undefined, undefined)
    effect.dispose()
    effect.draw(ctx, world, null, infoAt(4))
  })

  it('세계를 바꾸지 않는다', () => {
    const world = makeWorld()
    world.time = 25
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    const effect = new Effect({ makeCanvas })
    const snap = () => JSON.stringify({ players: world.players, items: world.items, time: world.time })
    const before = snap()
    for (const signal of SIGNALS) effect.react(signal, world, 'a')
    for (let t = 0; t < 12; t += 0.5) effect.draw(ctx, world, world.players[0], infoAt(t))
    expect(snap()).toBe(before)
  })

  it('2D 컨텍스트를 못 만드는 곳에서도 죽지 않는다', () => {
    const effect = new Effect({ makeCanvas: () => ({ getContext: () => null }) })
    const world = makeWorld()
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    for (const signal of SIGNALS) effect.react(signal, world, 'a')
    for (let t = 0; t < 12; t += 1) effect.draw(ctx, world, world.players[0], infoAt(t))
    effect.dispose()
  })
})

describe('효과마다', () => {
  beforeEach(() => Object.assign(calls, { total: 0, texts: [], byName: {}, depth: 0 }))

  function selfie(canvasOf = makeCanvas) {
    const world = makeWorld()
    const effect = new SelfieEffect({ makeCanvas: canvasOf })
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    const draw = (time) => {
      world.time = time
      effect.draw(ctx, world, world.players[0], infoAt(time - 20))
    }
    const hit = (time, who = 'a') => {
      world.time = time
      effect.react({ kind: 'hit', who, x: 100, y: 100, text: '-3' }, world, 'a')
    }
    draw(20)
    return { effect, draw, hit, world }
  }

  it('자동 회전: 돌 때 알린다', () => {
    const world = makeWorld()
    const effect = new RotateEffect({ makeCanvas })
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    effect.draw(ctx, world, null, infoAt(ROTATE.first + 0.1))
    expect(calls.texts).toContain('자동 회전!')
    calls.texts.length = 0
    effect.draw(ctx, world, null, infoAt(ROTATE.first + 1.5))
    expect(calls.texts).toEqual([])
  })

  it('셀카: 내가 맞으면 찍고, 1.2초에 한 장, 처음 4장만 남긴다', () => {
    const { effect, draw, hit } = selfie()
    hit(21)
    draw(21.05)
    expect(effect.photos).toHaveLength(0)
    draw(21 + PHOTO.delay + 0.01)
    expect(effect.photos).toHaveLength(1)
    expect(calls.texts).toContain('찰칵!')
    for (const time of [21.3, 21.8, 22.1]) {
      hit(time)
      draw(time + 0.15)
    }
    expect(effect.photos).toHaveLength(1)
    const first = effect.photos[0]
    for (let time = 22.5; time < 36; time += 0.3) {
      hit(time)
      draw(time + 0.15)
    }
    expect(effect.photos).toHaveLength(PHOTO.max)
    expect(effect.photos[0]).toBe(first)
    for (const photo of effect.photos) {
      expect(photo.url.startsWith('data:image/')).toBe(true)
      expect(CAPTIONS).toContain(photo.caption)
    }
    expect(new Set(effect.photos.map((photo) => photo.caption)).size).toBeGreaterThan(1)
    effect.dispose()
    expect(effect.photos).toHaveLength(PHOTO.max)
  })

  it('셀카: 남이 맞으면 찍지 않고 웃음 점수만 떨어진다', () => {
    const { effect, draw, hit } = selfie()
    const before = effect.smileOf('b', 21.1)
    hit(21, 'b')
    draw(21.2)
    draw(22)
    effect.dispose()
    expect(effect.photos).toEqual([])
    expect(calls.texts).not.toContain('찰칵!')
    expect(effect.slides).toEqual([])
    const again = selfie()
    again.hit(21, 'b')
    expect(again.effect.smileOf('b', 21.1)).toBeLessThan(before)
  })

  it('셀카: 나가기 직전에 맞아도 사진이 남는다', () => {
    const { effect, hit } = selfie()
    hit(21)
    effect.dispose()
    expect(effect.photos).toHaveLength(1)
  })

  it('셀카: 사진 파일을 못 만들면 사진 없이 이어진다', () => {
    for (const toDataURL of [undefined, () => { throw new Error('막힘') }, () => '']) {
      const { effect, draw, hit } = selfie((w, h) => makeCanvas(w, h, { toDataURL }))
      hit(21)
      draw(21.2)
      expect(effect.photos).toEqual([])
      expect(effect.slides).toHaveLength(1)
    }
  })

  it('셀카: 자막이 열두 개 넘고 종이에 들어갈 길이다', () => {
    expect(new Set(CAPTIONS).size).toBeGreaterThanOrEqual(12)
    for (const caption of CAPTIONS) expect(caption.length).toBeLessThanOrEqual(8)
  })

  it('손전등: 쏘거나 기술을 쓴 자리만 잠깐 보인다', () => {
    const world = makeWorld()
    const effect = new TorchEffect({ makeCanvas })
    world.time = 22
    effect.react({ kind: 'dash', who: 'b', x: 10, y: 60 }, world, 'a')
    expect(effect.flashes.some((slot) => slot.at === 22)).toBe(false)
    for (let i = 0; i < 20; i += 1) effect.react({ kind: 'shot', who: 'b', x: 10 + i, y: 60 }, world, 'a')
    expect(effect.flashes).toHaveLength(8)
    expect(effect.flashes.every((slot) => slot.at === 22)).toBe(true)
    const holes = (time) => {
      calls.byName = {}
      effect.draw(makeCanvas(ARENA.w, ARENA.h).getContext('2d'), world, null, infoAt(time - 20))
      return calls.byName.arc ?? 0
    }
    expect(holes(22.1)).toBeGreaterThan(0)
    expect(holes(22 + TORCH.flashTime + 0.01)).toBe(0)
    expect(calls.texts).toContain('손전등 꺼짐')
  })

  // 1인칭: 세계의 점을 화면 자리로(앞에 없으면 null). y가 300보다 위(먼 쪽)만 보인다고 친다.
  const firstPerson = (extra = {}) => ({ top: false, project: (x, y, h = 0) => (y < 300 ? { x, y: AREA.y0 + 200 - h, depth: 50 } : null), ...extra })

  it('셀카(1인칭): 맞으면 화면에 보이는 내 얼굴 자리(좌우 반전)를 찍는다', () => {
    const world = makeWorld()
    const effect = new SelfieEffect({ makeCanvas })
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    const me = Object.assign(world.players[0], { x: 100, y: 120, alive: true })
    world.time = 21
    effect.draw(ctx, world, me, infoAt(1, firstPerson()))
    effect.react({ kind: 'hit', who: 'a', x: me.x, y: me.y, text: '-3' }, world, 'a')
    world.time = 21 + PHOTO.delay + 0.01
    effect.draw(ctx, world, me, infoAt(1 + PHOTO.delay + 0.01, firstPerson()))
    expect(effect.photos).toHaveLength(1)
    expect(effect.crop.x).toBeCloseTo(ARENA.w - 100, 0) // 화면에서는 좌우가 뒤집혀 보인다
  })

  it('셀카(1인칭): 화면 뒤에 있는 사람에게는 얼굴 틀을 그리지 않는다', () => {
    const world = makeWorld()
    const effect = new SelfieEffect({ makeCanvas })
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    world.players.forEach((player, i) => Object.assign(player, { x: 100 + i * 50, y: 500, alive: true }))
    calls.texts = []
    effect.draw(ctx, world, world.players[0], infoAt(1, firstPerson()))
    expect(calls.texts.some((text) => text.endsWith('%'))).toBe(false)
  })

  it('손전등(1인칭): 빛은 화면 가운데 아래에 있다', () => {
    const world = makeWorld()
    const effect = new TorchEffect({ makeCanvas })
    const me = Object.assign(world.players[0], { x: 30, y: 500, alive: true })
    effect.draw(makeCanvas(ARENA.w, ARENA.h).getContext('2d'), world, me, infoAt(2, firstPerson()))
    expect(effect.light.x).toBeCloseTo(ARENA.w / 2, 0)
    expect(effect.light.y).toBeGreaterThan(AREA.y0 + (AREA.y1 - AREA.y0) / 2)
  })

  it('손전등(1인칭): 쏜 자리가 화면 앞에 있으면 잠깐 밝아지고, 뒤면 구멍을 뚫지 않는다', () => {
    const world = makeWorld()
    const effect = new TorchEffect({ makeCanvas })
    world.time = 22
    const holes = (y) => {
      effect.dispose()
      effect.react({ kind: 'shot', who: 'b', x: 100, y }, world, 'a')
      calls.byName = {}
      effect.draw(makeCanvas(ARENA.w, ARENA.h).getContext('2d'), world, null, infoAt(2.1, firstPerson()))
      return calls.byName.arc ?? 0
    }
    expect(holes(100)).toBeGreaterThan(0)
    expect(holes(500)).toBe(0)
  })

  it('저전력(1인칭): 사람·탄 표시는 화면에 보이는 자리에만, 내 눈으로 볼 때 나는 표시하지 않는다', () => {
    const world = makeWorld()
    const seen = []
    const effect = new LowPowerEffect({ makeCanvas })
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    world.players.forEach((player, i) => Object.assign(player, { x: 100 + i * 60, y: i === 1 ? 500 : 150, alive: true }))
    const project = (x, y, h = 0) => {
      seen.push([x, y])
      return y < 300 ? { x, y: AREA.y0 + 200 - h, depth: 50 } : null
    }
    effect.draw(ctx, world, world.players[0], infoAt(0, { top: false, project }))
    expect(seen.some(([x]) => x === 100)).toBe(false) // 나(a)는 묻지도 않는다
    expect(seen.some(([x]) => x === 220)).toBe(true) // c는 화면 자리를 찾는다
    expect(effect.marks).toBe(1) // b는 화면 뒤
  })

  it('저전력: 초당 15장만 새로 담는다', () => {
    const world = makeWorld()
    const effect = new LowPowerEffect({ makeCanvas })
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    for (let i = 0; i < 120; i += 1) effect.draw(ctx, world, null, infoAt(i / 60))
    expect(calls.byName.getImageData).toBeGreaterThanOrEqual(29)
    expect(calls.byName.getImageData).toBeLessThanOrEqual(32)
  })

  it('저전력: 픽셀을 못 읽으면 한 번만 해 보고 색만 덮는다', () => {
    const effect = new LowPowerEffect({ makeCanvas: (w, h) => makeCanvas(w, h, { locked: w === RETRO.w }) })
    const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
    for (let i = 0; i < 60; i += 1) effect.draw(ctx, makeWorld(), null, infoAt(i / 60))
    expect(calls.byName.getImageData).toBe(1)
    expect(calls.texts).toContain('저전력 모드')
  })

  it('캔버스를 정한 크기로 만든다', () => {
    const { canvas, ctx } = makeLayer(() => makeCanvas(1, 1), VIEW_W, VIEW_H)
    expect([canvas.width, canvas.height]).toEqual([360, 512])
    expect(ctx).toBeTruthy()
  })
})
