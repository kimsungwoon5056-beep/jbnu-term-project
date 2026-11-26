import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../../profile/look'
import { AREA, ARENA, OBSTACLES } from '../arena'
import { buildLoadout } from '../loadout'
import { seededRandom } from '../pool'
import { createWorld, effect, spawnEvent } from '../world'
import { CallOverlay, callTime } from './CallOverlay'
import { CALL, callCommands, CallCamera, CHASE, ChaseCamera, freePoint, SelfieCamera } from './camera'
import { FirstPersonView, VIEW } from './FirstPersonView'
import { angleDiff, castRay, lineOfSight, project } from './raycast'

const PI = Math.PI
const DT = 1 / 60
const player = (id, x, y, rest = {}) => ({ id, x, y, aim: 0, alive: true, ...rest })
const inWall = (x, y) => x <= AREA.x0 || y <= AREA.y0 || x >= AREA.x1 || y >= AREA.y1 || OBSTACLES.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)
const blocked = (x, y, r) => x < AREA.x0 + r || y < AREA.y0 + r || x > AREA.x1 - r || y > AREA.y1 - r || OBSTACLES.some((b) => x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r)
const numbers = (camera, at) => {
  for (const key of ['x', 'y', 'angle', 'eye', 'horizon']) expect(Number.isFinite(camera[key]), `${at} ${key}`).toBe(true)
}
// 구석·면·상자 속까지 섞은 자리
const anywhere = (rng, i) => {
  if (i % 7 === 0) return [rng() < 0.5 ? AREA.x0 : AREA.x1, rng() < 0.5 ? AREA.y0 : AREA.y1]
  if (i % 7 === 1) return [52 + 56 * Math.round(rng()), 120 + 56 * Math.round(rng())]
  return [AREA.x0 + rng() * 360, AREA.y0 + rng() * 512]
}
// 사람이 설 수 있는 자리
const standable = (rng) => {
  for (;;) {
    const x = AREA.x0 + rng() * 360
    const y = AREA.y0 + rng() * 512
    if (!blocked(x, y, 14)) return [x, y]
  }
}

describe('영상통화 카메라', () => {
  it('무작위 2000곳(겹침·구석·벽 속)에서 NaN이 없고 벽 속에 들어가지 않으며 나는 늘 화면 안에 있다', () => {
    const rng = seededRandom(5)
    const kept = new CallCamera()
    for (let i = 0; i < 2000; i += 1) {
      const [x, y] = anywhere(rng, i)
      const [fx, fy] = i % 5 === 0 ? [x, y] : anywhere(rng, i + 3)
      const me = player('a', x, y, { aim: rng() * 14 - 7 })
      const world = { players: [me, player('b', fx, fy)] }
      for (const camera of [new CallCamera(), kept]) {
        const view = camera.update(world, me, rng() * 0.1)
        numbers(view, `${x},${y},${fx},${fy}`)
        expect(inWall(view.x, view.y), `${view.x},${view.y}`).toBe(false)
        expect(view).toMatchObject({ kind: 'call', hideId: 'b', targetId: 'b', weapon: false })
        const p = project(view, view.angle, VIEW.fov, VIEW.w, me)
        if (Math.hypot(view.x - x, view.y - y) > 3) {
          expect(p, `${x},${y}`).not.toBeNull()
          expect(Math.abs(p.screenX - VIEW.w / 2)).toBeLessThan(VIEW.w / 2)
        }
      }
    }
  })

  it('내가 움직여도 시야 안에 있고, 멈추면 화면 가운데로 온다', () => {
    const me = player('a', 180, 500)
    const world = { players: [me, player('b', 180, 400)] }
    const camera = new CallCamera()
    for (let i = 0; i < 240; i += 1) {
      // 상대 둘레를 대시 속도로 돈다.
      me.x = 180 + Math.cos(i * 0.2) * 40
      me.y = 400 + Math.sin(i * 0.2) * 40
      const view = camera.update(world, me, DT)
      const off = Math.abs(angleDiff(view.angle, Math.atan2(me.y - view.y, me.x - view.x)))
      expect(off).toBeLessThanOrEqual(CALL.frame + 1e-9)
    }
    let view
    for (let i = 0; i < 120; i += 1) view = camera.update(world, me, DT)
    expect(angleDiff(view.angle, Math.atan2(me.y - view.y, me.x - view.x))).toBeCloseTo(0, 3)
  })

  it('상대 자리에서 살짝 뒤로 물러서고, 상대가 겹쳐 있어도 나와 거리를 둔다', () => {
    const me = player('a', 180, 500)
    const view = new CallCamera().update({ players: [me, player('b', 180, 400)] }, me, DT)
    expect(view.x).toBeCloseTo(180)
    expect(view.y).toBeCloseTo(400 - CALL.back)
    expect(view.angle).toBeCloseTo(PI / 2)
    const rng = seededRandom(9)
    for (let i = 0; i < 400; i += 1) {
      const [x, y] = standable(rng)
      const same = player('a', x, y)
      const close = new CallCamera().update({ players: [same, player('b', x, y)] }, same, DT)
      expect(Math.hypot(close.x - x, close.y - y), `${x},${y}`).toBeGreaterThan(30)
    }
  })

  it('살아 있는 동안 같은 상대를 잡고, 쓰러지면 다음으로 가까운 상대로 바로 바꾼다', () => {
    const me = player('a', 180, 500)
    const near = player('b', 180, 450)
    const far = player('c', 320, 100)
    const world = { players: [me, far, near] }
    const camera = new CallCamera()
    expect(camera.update(world, me, DT).targetId).toBe('b')
    Object.assign(far, { x: 190, y: 495 }) // 더 가까워져도 그대로
    expect(camera.update(world, me, DT).targetId).toBe('b')
    near.alive = false
    Object.assign(far, { x: 320, y: 100 })
    const view = camera.update(world, me, DT)
    expect(view).toMatchObject({ targetId: 'c', hideId: 'c' })
    expect(angleDiff(view.angle, Math.atan2(me.y - view.y, me.x - view.x))).toBeCloseTo(0) // 바로 나를 본다
    far.alive = false
    expect(camera.update(world, me, DT)).toBeNull()
    expect(camera.update({ players: [me] }, me, DT)).toBeNull()
    expect(camera.update({ players: [] }, undefined, DT)).toBeNull()
    near.alive = true
    expect(camera.update(world, me, DT).targetId).toBe('b')
  })

  it('reset하면 부드럽게 돌지 않고 바로 자리를 잡는다', () => {
    const me = player('a', 40, 500)
    const world = { players: [me, player('b', 180, 400)] }
    const camera = new CallCamera()
    camera.update(world, me, DT)
    Object.assign(me, { x: 340, y: 60 })
    camera.reset()
    const view = camera.update(world, me, 0)
    expect(angleDiff(view.angle, Math.atan2(me.y - view.y, me.x - view.x))).toBeCloseTo(0)
  })
})

describe('영상통화 조작', () => {
  const me = player('a', 180, 500, { aim: 0.3 })
  const world = { players: [me, player('b', 180, 400)] }
  const camera = new CallCamera().update(world, me, DT) // 남쪽(+y)을 보는 카메라

  it.each([
    ['위 = 카메라에서 멀어지기', 1, 0, 0, 1],
    ['아래 = 카메라로 다가가기', -1, 0, 0, -1],
    ['오른쪽 = 화면 오른쪽', 0, 1, -1, 0],
    ['왼쪽 = 화면 왼쪽', 0, -1, 1, 0],
  ])('%s', (_, forward, strafe, x, y) => {
    const [move, aim] = callCommands(camera, world, me, { forward, strafe })
    expect(move.type).toBe('move')
    expect(move.x).toBeCloseTo(x)
    expect(move.y).toBeCloseTo(y)
    expect(aim).toEqual({ type: 'aim', a: -PI / 2 })
  })

  it('움직인 쪽이 화면에서도 그쪽이다', () => {
    const rng = seededRandom(3)
    for (let i = 0; i < 200; i += 1) {
      const [x, y] = standable(rng)
      const [fx, fy] = standable(rng)
      const mine = player('a', x, y)
      const there = { players: [mine, player('b', fx, fy)] }
      const view = new CallCamera().update(there, mine, DT)
      const before = project(view, view.angle, VIEW.fov, VIEW.w, mine)
      const go = (input) => {
        const [move] = callCommands(view, there, mine, input)
        return project(view, view.angle, VIEW.fov, VIEW.w, { x: x + move.x, y: y + move.y })
      }
      expect(go({ strafe: 1 }).screenX).toBeGreaterThan(before.screenX)
      expect(go({ strafe: -1 }).screenX).toBeLessThan(before.screenX)
      expect(go({ forward: 1 }).depth).toBeGreaterThan(before.depth)
    }
  })

  it('대각선은 길이 1을 넘지 않고, 카메라·상대가 없거나 겹쳐도 숫자다', () => {
    const [move] = callCommands(camera, world, me, { forward: 1, strafe: 1 })
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1)
    expect(callCommands(null, world, me, { forward: 1 })[0].y).toBeCloseTo(-1)
    expect(callCommands(null, world, me)[1].a).toBe(0.3)
    expect(callCommands({ ...camera, targetId: 'x' }, world, me, {})[1].a).toBe(0.3)
    expect(callCommands(camera, { players: [me, player('b', 180, 500)] }, me, {})[1].a).toBe(0.3)
    const odd = callCommands({ angle: NaN, targetId: 'b' }, world, player('a', NaN, 1, { aim: NaN }), { forward: NaN })
    expect(Object.values(odd[0]).slice(1).every(Number.isFinite) && Number.isFinite(odd[1].a)).toBe(true)
  })
})

describe('추격 카메라', () => {
  it('무작위 2000곳·각도에서 NaN이 없고 벽 속에 들어가지 않는다', () => {
    const rng = seededRandom(8)
    const kept = new ChaseCamera()
    for (let i = 0; i < 2000; i += 1) {
      const [x, y] = anywhere(rng, i)
      const me = player('a', x, y, { aim: rng() * 14 - 7 })
      for (const camera of [new ChaseCamera(), kept]) {
        const view = camera.update({ players: [me] }, me, rng() * 0.1)
        numbers(view, `${x},${y}`)
        expect(inWall(view.x, view.y), `${x},${y} → ${view.x},${view.y}`).toBe(false)
        expect(view).toMatchObject({ kind: 'chase', hideId: null, weapon: false })
        expect(view.eye).toBeLessThan(60)
      }
    }
  })

  it('걷고 돌고 대시하는 동안에도 벽 속에 들어가지 않고 나와 카메라 사이가 막히지 않는다', () => {
    const rng = seededRandom(21)
    const me = player('a', 180, 400)
    const camera = new ChaseCamera()
    let turn = 0
    for (let i = 0; i < 4000; i += 1) {
      if (i % 20 === 0) turn = (rng() - 0.5) * 8
      me.aim += turn * DT
      const speed = i % 90 < 11 ? 480 : 150
      const x = me.x + Math.cos(me.aim + (i % 3)) * speed * DT
      const y = me.y + Math.sin(me.aim + (i % 3)) * speed * DT
      if (!blocked(x, y, 14)) Object.assign(me, { x, y })
      const view = camera.update({ players: [me] }, me, DT)
      expect(inWall(view.x, view.y)).toBe(false)
      expect(lineOfSight(view, me, OBSTACLES, AREA), `${me.x},${me.y}`).toBe(true)
      expect(Math.abs(angleDiff(view.angle, me.aim))).toBeLessThanOrEqual(CHASE.lag + 1e-9)
      expect(Math.hypot(view.x - me.x, view.y - me.y)).toBeLessThan(CHASE.back * 1.5)
    }
  })

  it('트인 곳에서는 내 뒤 72칸, 나는 화면 가운데 아래에 있다', () => {
    const me = player('a', 180, 400, { aim: -PI / 2 })
    const view = new ChaseCamera().update({ players: [me] }, me, DT)
    expect(view.x).toBeCloseTo(180)
    expect(view.y).toBeCloseTo(472)
    expect(view.angle).toBeCloseTo(-PI / 2)
    const p = project(view, view.angle, VIEW.fov, VIEW.w, me)
    expect(p.screenX).toBeCloseTo(VIEW.w / 2)
    const feet = view.horizon + view.eye * p.scale
    const head = view.horizon + (view.eye - 42) * p.scale
    expect((feet + head) / 2).toBeGreaterThan(VIEW.h * 0.5)
    expect(feet).toBeLessThan(VIEW.h * 0.85)
  })

  it('셀카 카메라는 내 앞에서 나를 마주 보고, 나는 화면 가운데에 있다', () => {
    const me = player('a', 180, 400, { aim: -PI / 2 })
    const view = new SelfieCamera().update({ players: [me] }, me, DT)
    expect(view.kind).toBe('selfie')
    expect(view.x).toBeCloseTo(180)
    expect(view.y).toBeLessThan(400 - 30) // 내가 보는 쪽(위)에 있다
    expect(Math.abs(angleDiff(view.angle, PI / 2))).toBeLessThan(0.01) // 나를 본다
    expect(view.weapon).toBe(false)
    const p = project(view, view.angle, VIEW.fov, VIEW.w, me)
    expect(p.screenX).toBeCloseTo(VIEW.w / 2)
  })

  it('셀카 카메라도 벽 가까이에서는 당겨지고 벽 속에 들어가지 않는다', () => {
    const me = player('a', 180, 60, { aim: -PI / 2 }) // 위쪽 벽을 본다
    const view = new SelfieCamera().update({ players: [me] }, me, DT)
    expect(inWall(view.x, view.y)).toBe(false)
    expect(Math.hypot(view.x - 180, view.y - 60)).toBeLessThan(CHASE.back)
  })

  it('벽이 가까우면 벽 앞까지 당겨지고, 그래도 머리가 화면 안에 보인다', () => {
    for (const [x, y, aim] of [[180, 334, PI / 2], [180, 50, PI / 2], [14, 300, 0], [346, 534, -PI * 0.75]]) {
      const me = player('a', x, y, { aim })
      const view = new ChaseCamera().update({ players: [me] }, me, DT)
      expect(inWall(view.x, view.y)).toBe(false)
      expect(Math.hypot(view.x - x, view.y - y)).toBeLessThan(CHASE.back)
      const p = project(view, view.angle, VIEW.fov, VIEW.w, me)
      expect(view.horizon + (view.eye - 42) * p.scale).toBeLessThan(VIEW.h - 40)
    }
  })

  it('순간 이동하면 바로 따라가고, 벽에서 벗어나면 천천히 물러난다', () => {
    const me = player('a', 180, 50, { aim: PI / 2 })
    const camera = new ChaseCamera()
    const world = { players: [me] }
    const close = Math.hypot(camera.update(world, me, DT).y - 50)
    Object.assign(me, { y: 80 })
    const near = Math.abs(camera.update(world, me, DT).y - 80)
    expect(near).toBeLessThan(CHASE.back * 0.7)
    expect(close).toBeLessThan(CHASE.min)
    Object.assign(me, { x: 300, y: 350 })
    const jumped = camera.update(world, me, DT)
    expect([jumped.x, jumped.y].map(Math.round)).toEqual([300, 278])
    expect(camera.update(world, undefined, DT)).toBeNull()
  })

  it('벽 속의 점은 밖으로 밀어낸다', () => {
    for (const b of OBSTACLES) {
      const spot = freePoint(b.x + 20, b.y + 25)
      expect(inWall(spot.x, spot.y)).toBe(false)
    }
    expect(Object.values(freePoint(NaN, Infinity)).every(Number.isFinite)).toBe(true)
    expect(castRay(freePoint(-9, 999).x, freePoint(-9, 999).y, 0, OBSTACLES, AREA).dist).toBeGreaterThan(0)
  })
})

// ---------- 그리기: 가짜 2D 컨텍스트 ----------
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name, skill) => ({ ...buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name }), ...(skill && { skill }) })

const calls = { total: 0, byName: {}, texts: [], images: [], save: 0, restore: 0 }
const SIZES = { drawImage: 'all', fillRect: 'all', clearRect: 'all', strokeRect: 'all', rect: 'all', arc: 'all', ellipse: 'all', moveTo: 'all', lineTo: 'all', translate: 'all', rotate: 'all', scale: 'all', setTransform: 'all', transform: 'all', fillText: 'all', strokeText: 'all', putImageData: 'all', createRadialGradient: 'all', createLinearGradient: 'all' }

// 숫자 인자에 NaN·Infinity가 오면 바로 실패한다(부르기만 세면 NaN을 놓친다).
function fakeContext(canvas) {
  const state = { canvas }
  const gradient = { addColorStop() {} }
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'createImageData' || key === 'getImageData')
        return (...args) => {
          const [w, h] = args.slice(-2)
          return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(120) }
        }
      if (key === 'measureText') return (text) => ({ width: String(text).length * 8 })
      return (...args) => {
        calls.total += 1
        calls.byName[key] = (calls.byName[key] ?? 0) + 1
        if (key === 'save' || key === 'restore') calls[key] += 1
        if (key === 'fillText') calls.texts.push(String(args[0]))
        if (key === 'drawImage' && calls.images.length < 5000) calls.images.push(args[0])
        if (key in SIZES) for (const arg of args) if (typeof arg === 'number' && !Number.isFinite(arg)) throw new Error(`${key}에 이상한 숫자: ${args.map(String).join(', ')}`)
        if (key === 'drawImage' && !args[0]) throw new Error('drawImage에 그림이 없음')
        if (key === 'arc' && args[2] < 0) throw new Error('arc 반지름이 음수')
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient
        return undefined
      }
    },
    set(target, key, value) {
      if ((key === 'globalAlpha' || key === 'lineWidth') && !Number.isFinite(value)) throw new Error(`${String(key)}가 이상함: ${value}`)
      if ((key === 'fillStyle' || key === 'strokeStyle') && typeof value === 'string' && /NaN|undefined|Infinity/.test(value)) throw new Error(`색이 이상함: ${value}`)
      target[key] = value
      return true
    },
  })
}

function makeCanvas(w, h) {
  const canvas = { width: w, height: h }
  const ctx = fakeContext(canvas)
  canvas.getContext = () => ctx
  return canvas
}

function setup() {
  const ids = ['a', 'b', 'c']
  const world = createWorld({ seed: 3, players: ids.map((id, i) => ({ id, loadout: loadout(`친구${id}`), local: i === 0 })) })
  const sheet = () => new Map(ids.map((id) => [id, makeCanvas(48, 48)]))
  const sprites = sheet()
  const backSprites = sheet()
  const view = new FirstPersonView({ world, meId: 'a', sprites, flashes: sprites, makeCanvas })
  const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
  const [me, foe, third] = world.players
  return { world, view, ctx, me, foe, third, sprites, backSprites }
}
const makers = { call: () => new CallCamera(), chase: () => new ChaseCamera() }

describe('다른 카메라로 그리기', () => {
  beforeEach(() => Object.assign(calls, { total: 0, byName: {}, texts: [], images: [], save: 0, restore: 0 }))

  it.each(['call', 'chase'])('%s: 사건·효과·죽음·느린 기기까지 던지지 않고 그린다', (kind) => {
    const { world, view, ctx, me, foe, third, sprites, backSprites } = setup()
    const camera = makers[kind]()
    const overlay = new CallOverlay({ makeCanvas })
    const rng = seededRandom(4)
    const motions = new Map([['a', { sx: 1.2, sy: 0.8, rot: 0.3, lift: 6, alpha: 0.8, stars: 3 }], ['b', { down: 0.8 }]])
    Object.assign(calls, { save: 0, restore: 0 })
    for (let i = 0; i < 500; i += 1) {
      world.time = rng() * 90
      const [x, y] = anywhere(rng, i)
      Object.assign(me, { x, y, aim: rng() * 14 - 7, hp: rng() * 80, dashT: i % 3, dashX: 1, shieldT: i % 2, focusT: 1, stunT: i % 4, flashT: i % 5 === 0 ? 0.2 : 0, alive: i % 11 !== 0 })
      const [fx, fy] = i % 6 === 0 ? [x, y] : anywhere(rng, i + 2)
      Object.assign(foe, { x: fx, y: fy, hp: rng() * 80, flashT: i % 7 === 0 ? 0.2 : 0, alive: i % 13 !== 0 })
      third.alive = i % 17 !== 0
      spawnEvent(world, { k: 'shot', o: i % 2 ? 'a' : 'b', x: me.x, y: me.y, a: rng() * 6 })
      for (const what of ['hit', 'item', 'down', 'shield']) for (const who of ['a', 'b', null]) effect(world, what, x, y, what === 'hit' ? '-3' : '', who)
      world.rings.push({ x, y, r: 95, t: 0.1, color: '#833ab4' })
      view.lowQuality = i % 10 === 0
      const now = i * 16
      const shown = camera.update(world, me, DT)
      if (!shown) continue // 상대가 모두 쓰러지면 부모가 위에서 보는 화면으로 바꾼다
      view.draw(ctx, world, me, { now, dt: DT, angle: me.aim, camera: shown, backSprites, kick: rng(), roll: 0.1, shot: rng(), hurtFrom: rng() * 6, hurtPower: 1, darkCircles: true, motions, dead: rng(), reduced: i % 4 === 0 })
      overlay.draw(ctx, world, me, shown, { now, dt: DT, sprites, reduced: i % 4 === 0 })
      for (const list of [world.effects, world.rings]) list.length = 0
      world.projectiles.sweep(() => false)
    }
    expect(calls.save).toBe(calls.restore)
    expect(calls.texts).not.toContain('전원 꺼짐')
    view.draw(ctx, world, me, { camera: { kind, hideId: null, weapon: false } }) // 값이 빠진 카메라
    view.draw(ctx, world, undefined, { camera: { kind: 'call', x: NaN, y: NaN, angle: NaN } })
  }, 30000)

  it('나도 빌보드로 그리고, 화면을 보는 상대는 그리지 않는다', () => {
    const { world, view, ctx, me, foe, third, sprites, backSprites } = setup()
    Object.assign(me, { x: 180, y: 500 })
    Object.assign(foe, { x: 180, y: 440 })
    Object.assign(third, { x: 230, y: 540 })
    const shown = new CallCamera().update(world, me, DT)
    view.draw(ctx, world, me, { now: 10, dt: DT, angle: me.aim, camera: shown, backSprites })
    expect(calls.texts).toEqual(expect.arrayContaining(['친구a', '친구c']))
    expect(calls.texts).not.toContain('친구b')
    expect(calls.images).toContain(sprites.get('a'))
    expect(calls.images).not.toContain(backSprites.get('a'))
    expect(view.aimed).toBe(false)
  })

  it('추격에서는 내 뒷모습, 상대는 앞모습. 뒷모습이 없으면 앞모습을 쓴다', () => {
    const { world, view, ctx, me, foe, sprites, backSprites } = setup()
    Object.assign(me, { x: 180, y: 480, aim: -PI / 2 })
    Object.assign(foe, { x: 200, y: 360 })
    const shown = new ChaseCamera().update(world, me, DT)
    const info = { now: 10, dt: DT, angle: me.aim, camera: shown, backSprites }
    view.draw(ctx, world, me, info)
    expect(calls.images).toContain(backSprites.get('a'))
    expect(calls.images).toContain(sprites.get('b'))
    expect(calls.images).not.toContain(sprites.get('a'))
    view.draw(ctx, world, me, { ...info, backSprites: null })
    expect(calls.images).toContain(sprites.get('a'))
  })

  it('손에 든 무기를 그리지 않고, 카메라를 빼면 원래 1인칭으로 돌아온다', () => {
    const { world, view, ctx, me, backSprites } = setup()
    Object.assign(me, { x: 180, y: 480, aim: -PI / 2 })
    view.draw(ctx, world, me, { now: 10, dt: DT, angle: me.aim, camera: new ChaseCamera().update(world, me, DT), backSprites, dead: 1 })
    expect(view.handDrawn).toBe(false)
    view.draw(ctx, world, me, { now: 20, dt: DT, angle: me.aim })
    expect(view.handDrawn).toBe(true)
    expect([view.x, view.y, view.horizon]).toEqual([180, 480, VIEW.horizon])
    expect(Math.abs(view.eye - VIEW.eye)).toBeLessThan(0.01) // 걷는 흔들림이 튀지 않는다
  })

  it('맞은 방향은 카메라가 보는 쪽 기준으로 바뀌고, 화면 좌표를 알려 준다', () => {
    const { world, view, ctx, me, foe } = setup()
    Object.assign(me, { x: 180, y: 500, aim: -PI / 2 })
    Object.assign(foe, { x: 180, y: 400 })
    const shown = new CallCamera().update(world, me, DT)
    view.draw(ctx, world, me, { now: 10, dt: DT, angle: me.aim, camera: shown, hurtFrom: 0, hurtPower: 1, reduced: true })
    expect(Math.abs(view.frame.hurtFrom)).toBeCloseTo(PI) // 내 앞(북쪽)에서 맞음 = 카메라 쪽에서
    const spot = view.toScreen(me.x, me.y, 20)
    expect(spot.x).toBeCloseTo(ARENA.w / 2, 0)
    expect(spot.y).toBeGreaterThan(AREA.y0)
    expect(view.toScreen(180, 300)).toBeNull()
  })
})

describe('영상통화 겹침 그림', () => {
  beforeEach(() => Object.assign(calls, { total: 0, byName: {}, texts: [], images: [], save: 0, restore: 0 }))

  it('전화 카드 → 통화 시간 → 맞으면 끊김 → 다른 사람으로 이어짐', () => {
    const { world, ctx, me, foe, third, sprites } = setup()
    Object.assign(me, { x: 180, y: 500 })
    Object.assign(foe, { x: 180, y: 440 })
    const camera = new CallCamera()
    const overlay = new CallOverlay({ makeCanvas })
    let now = 5000
    const show = (frames = 1) => {
      calls.texts = []
      for (let i = 0; i < frames; i += 1) overlay.draw(ctx, world, me, camera.update(world, me, DT), { now: (now += 16), dt: 0.016, sprites })
      return calls.texts
    }
    expect(show()).toEqual(expect.arrayContaining(['친구b', '통화 중', '00:00', '전화 왔어요!']))
    expect(show(100).slice(-12)).not.toContain('전화 왔어요!')
    show(4000)
    expect(show()).toContain('01:04')
    foe.hp -= 3
    expect(show()).toContain('연결이 불안정해요')
    expect(show(80).slice(-12)).not.toContain('연결이 불안정해요')
    me.hp -= 5
    show()
    expect(overlay.hurt).toBeGreaterThan(0)
    foe.alive = false
    expect(show()).toContain('친구c님과 연결됐어요')
    third.alive = false
    expect(show()).toEqual([]) // 볼 상대가 없으면 그리지 않는다
    third.alive = true
    now += 3000
    expect(show()).toContain('전화 왔어요!') // 한참 뒤면 새 통화
    expect(calls.save).toBe(calls.restore)
  })

  it('통화 시간 글자', () => {
    expect([callTime(-3), callTime(0), callTime(65.9), callTime(NaN)]).toEqual(['00:00', '00:00', '01:05', '00:00'])
  })
})
