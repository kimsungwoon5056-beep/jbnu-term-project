import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../../profile/look'
import { buildLoadout } from '../loadout'
import { seededRandom } from '../pool'
import { DRAIN, STORM } from '../schedule'
import { AREA, ARENA, createWorld, effect, OBSTACLES, spawnEvent } from '../world'
import { FirstPersonView } from './FirstPersonView'
import { angleDiff, castRay, columnVisible, fitAngleToNearest, focalLength, hitDirection, lineOfSight, project, relativeMove, sortSprites, turnToward } from './raycast'

const PI = Math.PI
const FOV = (70 * PI) / 180

describe('광선', () => {
  const box = { x: 100, y: 100, w: 50, h: 50 }
  const area = { x0: 0, y0: 0, x1: 300, y1: 400 }

  it('상자의 네 면까지 거리·면·u가 맞고, 보는 사람의 왼쪽이 u=0이다', () => {
    const east = castRay(20, 110, 0, [box], area) // 동쪽을 봄 → 서쪽 면, 왼쪽은 북쪽
    expect(east).toMatchObject({ box, side: 'x', face: 'w' })
    expect(east.dist).toBeCloseTo(80)
    expect(east.u).toBeCloseTo(0.2)
    const west = castRay(250, 110, PI, [box], area)
    expect(west).toMatchObject({ box, side: 'x', face: 'e' })
    expect(west.dist).toBeCloseTo(100)
    expect(west.u).toBeCloseTo(0.8)
    const south = castRay(110, 20, PI / 2, [box], area)
    expect(south).toMatchObject({ box, side: 'y', face: 'n' })
    expect(south.dist).toBeCloseTo(80)
    expect(south.u).toBeCloseTo(0.8)
    const north = castRay(110, 350, -PI / 2, [box], area)
    expect(north).toMatchObject({ box, side: 'y', face: 's' })
    expect(north.dist).toBeCloseTo(200)
    expect(north.u).toBeCloseTo(0.2)
    expect(north.hitX).toBeCloseTo(110)
    expect(north.hitY).toBeCloseTo(150)
  })

  it('비스듬한 광선은 빗변 길이를 준다', () => {
    const ray = castRay(60, 85, Math.atan2(30, 40), [box], area)
    expect(ray.dist).toBeCloseTo(50)
    expect(ray.hitX).toBeCloseTo(100)
    expect(ray.hitY).toBeCloseTo(115)
  })

  it('상자를 비껴가면 바깥벽에 닿고 box는 null이다', () => {
    const ray = castRay(20, 90, 0, [box], area)
    expect(ray).toMatchObject({ box: null, side: 'x', face: 'e' })
    expect(ray.dist).toBeCloseTo(280)
    expect(ray.u).toBeCloseTo(90 / 400)
    expect(castRay(20, 90, -PI / 2, [box], area)).toMatchObject({ box: null, face: 'n' })
    expect(castRay(20, 90, PI / 2, [box], area)).toMatchObject({ box: null, face: 's' })
    expect(castRay(20, 90, PI, [box], area)).toMatchObject({ box: null, face: 'w' })
  })

  it('여러 상자 중 가까운 쪽에 닿는다(가림)', () => {
    const behind = { x: 200, y: 100, w: 50, h: 50 }
    expect(castRay(20, 120, 0, [behind, box], area).box).toBe(box)
    expect(castRay(180, 120, 0, [behind, box], area).box).toBe(behind)
  })

  it('상자 안·면 위·모서리·경기장 밖에서도 값이 이상하지 않다', () => {
    expect(castRay(125, 125, 0, [box], area).box).toBeNull() // 안에서는 그 상자를 무시
    expect(castRay(100, 125, 0, [box], area)).toMatchObject({ box, dist: 0 }) // 면에 붙어 안쪽
    expect(castRay(100, 125, PI, [box], area).box).toBeNull() // 면에 붙어 바깥쪽
    expect(castRay(100, 20, PI / 2, [box], area).dist).toBeGreaterThan(0)
    for (const [x, y, a] of [[-50, -50, 1], [999, 999, 4], [0, 0, PI], [100, 100, PI / 4], [NaN, 10, NaN]]) {
      const ray = castRay(x, y, a, [box], area)
      for (const key of ['dist', 'u', 'hitX', 'hitY']) expect(Number.isFinite(ray[key]), `${x},${y},${a} ${key}`).toBe(true)
      expect(ray.dist).toBeGreaterThanOrEqual(0)
    }
  })

  it('무작위 2000곳: 유한한 값, 닿은 곳은 경기장 안, 닿기 직전은 상자 밖', () => {
    const rng = seededRandom(7)
    for (let i = 0; i < 2000; i += 1) {
      const x = AREA.x0 + rng() * (AREA.x1 - AREA.x0)
      const y = AREA.y0 + rng() * (AREA.y1 - AREA.y0)
      // 넷에 하나는 축에 나란한 각도
      const angle = i % 4 === 0 ? (Math.floor(rng() * 4) * PI) / 2 : rng() * PI * 4 - PI * 2
      const ray = castRay(x, y, angle, OBSTACLES, AREA)
      const at = `${x},${y},${angle}`
      for (const key of ['dist', 'u', 'hitX', 'hitY']) expect(Number.isFinite(ray[key]), at).toBe(true)
      expect(ray.u).toBeGreaterThanOrEqual(0)
      expect(ray.u).toBeLessThanOrEqual(1)
      expect(ray.dist).toBeLessThan(Math.hypot(360, 512) + 1)
      const px = x + Math.cos(angle) * (ray.dist - 0.01)
      const py = y + Math.sin(angle) * (ray.dist - 0.01)
      const inside = (b, qx, qy) => qx > b.x && qx < b.x + b.w && qy > b.y && qy < b.y + b.h
      const started = OBSTACLES.find((b) => inside(b, x, y))
      if (ray.dist > 0.1) expect(OBSTACLES.some((b) => b !== started && inside(b, px, py)), at).toBe(false)
      const p = project({ x, y }, angle, FOV, 180, { x: rng() * 360, y: rng() * 600 })
      if (p) for (const key of ['depth', 'screenX', 'scale']) expect(Number.isFinite(p[key]), at).toBe(true)
    }
  })
})

describe('투영', () => {
  it('오른쪽에 있는 것은 화면 오른쪽에 보인다(거울상이 아니다)', () => {
    const me = { x: 180, y: 500 }
    expect(project(me, -PI / 2, FOV, 180, { x: 250, y: 300 }).screenX).toBeGreaterThan(90)
    expect(project(me, -PI / 2, FOV, 180, { x: 110, y: 300 }).screenX).toBeLessThan(90)
    expect(project(me, -PI / 2, FOV, 180, { x: 180, y: 300 }).screenX).toBeCloseTo(90)
    expect(project(me, 0, FOV, 180, { x: 300, y: 560 }).screenX).toBeGreaterThan(90)
  })

  it('뒤에 있거나 겹친 점은 null', () => {
    const me = { x: 100, y: 100 }
    expect(project(me, 0, FOV, 180, { x: 50, y: 100 })).toBeNull()
    expect(project(me, 0, FOV, 180, { x: 100, y: 200 })).toBeNull()
    expect(project(me, 0, FOV, 180, { x: 100, y: 100 })).toBeNull()
    expect(project(me, 0, FOV, 180, { x: NaN, y: 100 })).toBeNull()
  })

  it('어안이 아니다: 나란한 벽 위의 점은 depth와 scale이 같고 화면 간격이 고르다', () => {
    const me = { x: 0, y: 0 }
    const points = [-60, -30, 0, 30, 60].map((y) => project(me, 0, FOV, 180, { x: 100, y }))
    for (const p of points) expect(p.depth).toBeCloseTo(100)
    for (let i = 1; i < 5; i += 1) expect(points[i].screenX - points[i - 1].screenX).toBeCloseTo(30 * (focalLength(FOV, 180) / 100))
    // 시야 끝 각도의 점은 화면 끝에 놓인다.
    expect(project(me, 0, FOV, 180, { x: 100, y: 100 * Math.tan(FOV / 2) }).screenX).toBeCloseTo(180)
  })

  it('광선과 투영이 같은 칸을 가리킨다', () => {
    const me = { x: 180, y: 480 }
    const angle = -1.3
    for (const column of [3, 60, 90, 150, 176]) {
      const rayAngle = angle + Math.atan((column + 0.5 - 90) / focalLength(FOV, 180))
      const ray = castRay(me.x, me.y, rayAngle, OBSTACLES, AREA)
      const p = project(me, angle, FOV, 180, { x: ray.hitX, y: ray.hitY })
      expect(p.screenX).toBeCloseTo(column + 0.5)
      expect(p.depth).toBeCloseTo(ray.dist * Math.cos(rayAngle - angle))
    }
  })

  it('먼 것부터 줄 세우고, 벽 뒤는 안 보인다', () => {
    expect(sortSprites([{ depth: 5 }, { depth: 50 }, { depth: 20 }]).map((s) => s.depth)).toEqual([50, 20, 5])
    const z = Float32Array.from([10, 100])
    expect(columnVisible(z, 0.9, 50)).toBe(false)
    expect(columnVisible(z, 1.2, 50)).toBe(true)
    expect(columnVisible(z, -0.1, 1)).toBe(false)
    expect(columnVisible(z, 2, 1)).toBe(false)
    expect(columnVisible(z, NaN, 1)).toBe(false)
  })

  it('앱 아이콘이 사이에 있으면 보이지 않는다', () => {
    expect(lineOfSight({ x: 180, y: 200 }, { x: 180, y: 400 }, OBSTACLES, AREA)).toBe(false)
    expect(lineOfSight({ x: 30, y: 200 }, { x: 30, y: 400 }, OBSTACLES, AREA)).toBe(true)
    expect(lineOfSight({ x: 30, y: 200 }, { x: 30, y: 200 }, OBSTACLES, AREA)).toBe(true)
  })
})

describe('움직임·각도', () => {
  it('보는 쪽 기준 이동이 세계 방향이 된다', () => {
    const close = (v, x, y) => {
      expect(v.x).toBeCloseTo(x)
      expect(v.y).toBeCloseTo(y)
    }
    close(relativeMove(1, 0, 0), 1, 0)
    close(relativeMove(0, 1, 0), 0, 1)
    close(relativeMove(1, 0, -PI / 2), 0, -1)
    close(relativeMove(0, 1, -PI / 2), 1, 0)
    close(relativeMove(-1, 0, PI), 1, 0)
    close(relativeMove(0, -1, PI / 2), 1, 0)
    close(relativeMove(0.5, 0, 0), 0.5, 0) // 조이스틱의 작은 값은 그대로
    expect(Math.hypot(...Object.values(relativeMove(1, 1, 0.7)))).toBeCloseTo(1)
    close(relativeMove(NaN, undefined, NaN), 0, 0)
  })

  it('각도 차이와 돌기', () => {
    expect(angleDiff(0, 1)).toBeCloseTo(1)
    expect(angleDiff(3, -3)).toBeCloseTo(PI * 2 - 6)
    expect(angleDiff(0, PI * 7)).toBeCloseTo(PI)
    expect(angleDiff(0, -PI)).toBeCloseTo(PI)
    expect(turnToward(0, 2, 0.5)).toBeCloseTo(0.5)
    expect(turnToward(0, -0.2, 0.5)).toBeCloseTo(-0.2)
    expect(angleDiff(turnToward(3, -3, 0.1), 3.1)).toBeCloseTo(0)
  })

  it('맞은 방향: 앞 0, 오른쪽 양수, 뒤 π', () => {
    const me = { x: 100, y: 100 }
    expect(hitDirection(0, 200, 100, me)).toBeCloseTo(0)
    expect(hitDirection(0, 100, 200, me)).toBeCloseTo(PI / 2)
    expect(hitDirection(-PI / 2, 200, 100, me)).toBeCloseTo(PI / 2)
    expect(Math.abs(hitDirection(0, 0, 100, me))).toBeCloseTo(PI)
    expect(hitDirection(0, 100, 100, me)).toBeNull()
    expect(hitDirection(0, NaN, 1, me)).toBeNull()
    expect(hitDirection(0, 1, 1, undefined)).toBeNull()
  })

  it('가장 가까운 살아 있는 상대를 본다', () => {
    const me = { id: 'a', x: 100, y: 100, aim: 0.4, alive: true }
    const players = [me, { id: 'b', x: 100, y: 200, alive: true }, { id: 'c', x: 110, y: 100, alive: false }, { id: 'd', x: 20, y: 100, alive: true }]
    expect(fitAngleToNearest({ players }, me)).toBeCloseTo(PI)
    expect(fitAngleToNearest({ players: players.slice(0, 3) }, me)).toBeCloseTo(PI / 2)
    expect(fitAngleToNearest({ players: [me] }, me)).toBeCloseTo(0.4)
    expect(fitAngleToNearest({ players: [me, { id: 'b', x: 100, y: 100, alive: true }] }, me)).toBeCloseTo(0.4)
    expect(fitAngleToNearest({ players: [] }, undefined)).toBe(0)
  })
})

// ---------- 그리기: 가짜 2D 컨텍스트 ----------
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name, skill) => ({ ...buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name }), ...(skill && { skill }) })

const calls = { total: 0, byName: {}, texts: [], save: 0, restore: 0 }
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

function setup({ skill, events = true, count = 3 } = {}) {
  const ids = ['a', 'b', 'c', 'd'].slice(0, count)
  const world = createWorld({ seed: 3, events, players: ids.map((id, i) => ({ id, loadout: loadout(`친구${id}`, i === 0 ? skill : null), local: i === 0 })) })
  const sprites = new Map(ids.map((id) => [id, makeCanvas(48, 48)]))
  const flashes = new Map(ids.map((id) => [id, makeCanvas(48, 48)]))
  const view = new FirstPersonView({ world, meId: 'a', sprites, flashes, makeCanvas })
  const ctx = makeCanvas(ARENA.w, ARENA.h).getContext('2d')
  const [me, foe] = world.players
  const draw = (info = {}) => view.draw(ctx, world, me, info)
  return { world, view, ctx, me, foe, draw }
}

describe('1인칭 화면 그리기', () => {
  beforeEach(() => Object.assign(calls, { total: 0, byName: {}, texts: [], save: 0, restore: 0 }))

  it('살아 있을 때 벽·사람을 그리고, 저장한 캔버스 상태를 모두 되돌린다', () => {
    const { draw, me, foe } = setup()
    Object.assign(me, { x: 180, y: 520 })
    Object.assign(foe, { x: 180, y: 420 })
    Object.assign(calls, { save: 0, restore: 0 })
    draw({ now: 1000, dt: 0.016, angle: -PI / 2 })
    expect(calls.total).toBeGreaterThan(200)
    expect(calls.byName.clip).toBeGreaterThan(0)
    expect(calls.texts).toContain('친구b')
    expect(calls.save).toBe(calls.restore)
  })

  it('내가 뛰면 눈높이가 오른다', () => {
    const { draw, me, view } = setup()
    Object.assign(me, { x: 180, y: 520 })
    draw({ now: 1000, dt: 0.016, angle: -PI / 2, reduced: true })
    const ground = view.eye
    me.z = 30
    draw({ now: 1016, dt: 0.016, angle: -PI / 2, reduced: true })
    expect(view.eye - ground).toBeCloseTo(30, 0)
  })

  it('상대가 뛰면 그림과 이름표가 오르고, 목숨이 이름표에 붙는다', () => {
    const { draw, me, foe, view } = setup()
    Object.assign(me, { x: 180, y: 520 })
    Object.assign(foe, { x: 180, y: 400, lives: 2 })
    const labelY = () => view.labels.find((label) => label.text === '친구b')?.y
    draw({ now: 1000, dt: 0.016, angle: -PI / 2, reduced: true })
    const ground = labelY()
    expect(view.labels.find((label) => label.text === '친구b').lives).toBe(2)
    foe.z = 30
    draw({ now: 1016, dt: 0.016, angle: -PI / 2, reduced: true })
    expect(labelY()).toBeLessThan(ground - 5)
  })

  it('벽 뒤의 상대는 이름이 보이지 않는다', () => {
    const { draw, me, foe, world } = setup()
    Object.assign(me, { x: 180, y: 400 })
    Object.assign(foe, { x: 180, y: 200 })
    world.players[2].x = 20
    world.players[2].y = 500
    draw({ now: 1000, dt: 0.016, angle: -PI / 2 })
    expect(calls.texts).not.toContain('친구b')
  })

  it('info가 비어 있거나 me가 없거나 그림이 빠져도 그린다', () => {
    const { draw, view, ctx, world, me } = setup()
    draw()
    draw({})
    view.draw(ctx, world, undefined, undefined)
    view.draw(ctx, world, null, { now: 5, dead: 1 })
    view.sprites.delete('b')
    view.flashes.clear()
    world.players[1].flashT = 0.1
    Object.assign(world.players[1], { x: me.x + 60, y: me.y })
    draw({ angle: 0 })
    draw({ angle: NaN, kick: NaN, roll: NaN, shot: NaN, dead: NaN, hurtFrom: NaN, hurtPower: NaN, now: NaN, dt: NaN })
    expect(calls.total).toBeGreaterThan(0)
  })

  it('알림 폭풍 경고·말풍선, 아이템, 덫, 충격파, 탄, 효과 글자, 대시·실드·방해 금지·멈춤', () => {
    const { draw, me, foe, world } = setup({ skill: 'feed' })
    Object.assign(me, { x: 180, y: 500 })
    const s = STORM.starts[0]
    for (const t of [7, s + 0.5, s + 1.8, s + 2.4, s + 3, DRAIN.start + 0.4, DRAIN.start + 2]) {
      world.time = t
      for (const angle of [-PI / 2, 0, PI / 2, PI]) {
        Object.assign(foe, { x: 180, y: 430, dashT: 0.1, dashX: 1, dashY: 0, shieldT: 1, airT: t % 2, dndT: 1, stunT: 1, focusT: 1, flashT: t % 2 })
        Object.assign(me, { shieldT: 1, airT: 1, dndT: 1, stunT: 1, focusT: 1, dashT: 0.1 })
        world.traps.push({ owner: 'b', x: 180, y: 440, r: 18, life: 4, color: '#ff1f3d' }, { owner: 'b', x: 20, y: 20, r: 18, life: 4, color: '#ff1f3d' })
        world.rings.push({ x: me.x, y: me.y, r: 95, t: 0.1, color: '#833ab4' }, { x: 180, y: 440, r: 95, t: 0.39, color: '#833ab4' })
        for (const s of ['messenger', 'feed', 'game', 'webtoon', 'shopping']) spawnEvent(world, { k: 'skill', s, o: 'b', x: 180, y: 430, a: angle })
        spawnEvent(world, { k: 'shot', o: 'a', x: me.x, y: me.y, a: angle })
        for (const kind of ['hit', 'alarm', 'item', 'block', 'shield', 'focus', 'down', 'shot']) {
          effect(world, kind, 180, 410, kind === 'hit' ? '-3' : '', 'b')
          effect(world, kind, me.x, me.y - 20, '', 'a')
        }
        draw({ now: t * 1000, dt: 0.016, angle, kick: 1, roll: 0.1, shot: 1, hurtFrom: 2, hurtPower: 1, darkCircles: true })
        world.effects.length = 0
        world.rings.length = 0
        world.traps.length = 0
        world.projectiles.sweep(() => false)
      }
    }
    expect(calls.texts).toEqual(expect.arrayContaining(['-3', '실드!', '멈칫!', '앞에서 알림! 피해!']))
  })

  it('모션(찌그러짐·기울기·별)과 꺼진 화면 구역 안팎', () => {
    const { draw, me, foe, world } = setup()
    Object.assign(foe, { x: 180, y: 440 })
    const motions = new Map([
      ['b', { sx: 1.2, sy: 0.8, rot: 0.3, lift: 6, alpha: 0.8, stars: 3 }],
      ['c', {}],
    ])
    for (const time of [65, 75, 89.9, 120]) {
      world.time = time
      for (const [x, y] of [[180, 500], [10, 40], [180, 300], [359, 547]]) {
        Object.assign(me, { x, y })
        draw({ now: time * 1000, dt: 0.016, angle: -PI / 2, motions })
        draw({ now: time * 1000, dt: 0.016, angle: 1, motions, reduced: true, roll: 0.2, kick: 1 })
      }
    }
    expect(calls.texts).toContain('친구b')
  })

  it('쓰러지면 폰이 꺼진다', () => {
    const { draw, me, foe } = setup()
    Object.assign(me, { alive: false, hp: 0 })
    foe.alive = false
    Object.assign(foe, { x: me.x + 60, y: me.y })
    for (const dead of [0, 0.3, 0.5, 0.75, 0.85, 0.9, 0.95, 1, 2]) {
      draw({ now: 100, dt: 0.016, angle: 0, dead })
      draw({ now: 100, dt: 0.016, angle: 0, dead, reduced: true })
    }
    expect(calls.texts).toContain('전원 꺼짐')
  })

  it('위치가 겹치거나 상자 면·모서리·안, 경기장 밖이어도 그린다', () => {
    const { draw, me, foe, world } = setup()
    world.time = 70
    for (const [x, y] of [[52, 120], [52, 148], [108, 176], [80, 148], [0, 36], [360, 548], [-20, 0], [500, 900], [180, 264]]) {
      Object.assign(me, { x, y })
      Object.assign(foe, { x, y })
      for (const angle of [0, PI / 2, PI, -PI / 2, 0.7, 12.3]) draw({ now: 100, dt: 0.016, angle })
    }
    expect(calls.total).toBeGreaterThan(0)
  })

  it('무작위 자리 2000곳·각도에서 NaN 없이 그린다', () => {
    const { draw, me, foe, world } = setup({ count: 4 })
    const rng = seededRandom(11)
    for (let i = 0; i < 2000; i += 1) {
      world.time = rng() * 90
      Object.assign(me, { x: rng() * 360, y: AREA.y0 + rng() * 512, hp: rng() * 80 })
      Object.assign(foe, { x: rng() * 360, y: AREA.y0 + rng() * 512 })
      draw({ now: world.time * 1000, dt: 0.016, angle: rng() * 14 - 7, kick: rng(), roll: rng() * 0.2 - 0.1, shot: rng(), hurtFrom: rng() * 6 - 3, hurtPower: rng() })
    }
    expect(calls.total).toBeGreaterThan(0)
  }, 60000)

  it('느린 기기 모드·사건 끔에서도 그리고, 느리면 스스로 낮춘다', () => {
    const { draw, view, me } = setup({ events: false })
    draw({ now: 1, dt: 0.016, angle: 0 })
    expect(view.lowQuality).toBe(false)
    for (let i = 0; i < 12; i += 1) view.noteCost(5)
    view.noteCost(900) // 한 번 튄 것으로는 낮추지 않는다
    expect(view.lowQuality).toBe(false)
    for (let i = 0; i < 200; i += 1) view.noteCost(30)
    expect(view.lowQuality).toBe(true)
    Object.assign(me, { x: 180, y: 300 })
    draw({ now: 2, dt: 0.016, angle: 1 })
  })

  it('세계를 바꾸지 않는다', () => {
    const { draw, world } = setup()
    world.time = 32
    const before = JSON.stringify({ players: world.players, items: world.items, time: world.time })
    draw({ now: 1, dt: 0.016, angle: -PI / 2 })
    expect(JSON.stringify({ players: world.players, items: world.items, time: world.time })).toBe(before)
  })
})
