import { describe, expect, it } from 'vitest'
import { ATTACKS } from '../attacks'
import { BOT_STRATEGIES } from '../bot'
import { linkWorld, MemoryRoom } from '../channel'
import { DEFAULT_LOOK } from '../../profile/look'
import { buildLoadout, skillKey } from '../loadout'
import { DIVE } from '../schedule'
import { applyDamage, applyRemote, AREA, createWorld, OBSTACLES, RADIUS, spawnEvent, stepWorld } from '../world'
import { adCount, skippedBy } from './ad'
import { BOSS, bossAt, pattern } from './boss'
import { MODES } from './index'
import { MODE_KEYS } from './keys'
import { BEAT, onBeat } from './rhythm'
import { JUMP } from './shorts'
import { shuffleSkills } from './update'

// 규칙이 바뀌는 모드: 들어가고 나올 때 깨끗한지, 규칙이 맞는지

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (archetype) =>
  buildLoadout({ state: { tier: 'mid', grafts: archetype ? [{ slot: 'hair', icon: null, archetype }] : [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: archetype ?? '디톡스' })
const makeWorld = (mode, skills = ['game', 'feed', null]) =>
  createWorld({ seed: 5, modes: [mode], players: skills.map((skill, i) => ({ id: 'abc'[i], loadout: loadout(skill), local: true })) })
// 모드가 막 켜진 때로
const enter = (world) => {
  world.time = world.schedule.dives[0].t + DIVE.zoom / 2 + 0.02
  stepWorld(world, {}, 1 / 60)
  return world
}
const run = (world, seconds, commands = {}, each) => {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    stepWorld(world, typeof commands === 'function' ? commands(world) : commands, 1 / 60)
    each?.(world)
  }
}
const put = (player, x, y) => Object.assign(player, { x, y, tx: x, ty: y })

describe('시간이 건너뛸 때', () => {
  it('들어감·나옴 신호를 빠뜨리지도 두 번 내지도 않는다', () => {
    const world = makeWorld('rhythm', ['game'])
    const got = []
    world.signals.subscribe((signal) => ['glitch', 'dive', 'surface'].includes(signal.kind) && got.push(signal.kind))
    const { t, end } = world.schedule.dives[0]
    world.time = t + 4 // 경고와 들어감을 건너뜀
    stepWorld(world, {}, 1 / 60)
    world.time = end + 1 // 나옴을 건너뜀
    stepWorld(world, {}, 1 / 60)
    expect(got).toEqual(['dive', 'surface'])
    got.length = 0
    world.time = world.schedule.dives[1].t - DIVE.warn - 0.05
    run(world, 13, {}, (w) => w.players.forEach((player) => Object.assign(player, { hp: player.maxHp, alive: true })))
    expect(got).toEqual(['glitch', 'dive', 'surface'])
  })
})

describe('모든 모드', () => {
  it('들어가고 나오면 모드 값이 깨끗이 돌아온다', () => {
    for (const mode of MODE_KEYS) {
      const world = makeWorld(mode)
      enter(world)
      expect(world.mode, mode).toBe(mode)
      run(world, 12, {}, (w) => w.players.forEach((player) => Object.assign(player, { hp: player.maxHp, alive: true })))
      expect(world.mode, mode).toBeNull()
      expect(world.boss, mode).toBeNull()
      for (const player of world.players) {
        expect(player.vyG, mode).toBeUndefined()
        expect(skillKey(player), mode).toBe(player.loadout.skill)
      }
    }
  })

  it('이름·안내·색이 있고, 봇이 어느 모드에서나 멈추지 않으며 값에 NaN이 없다', () => {
    for (const mode of MODE_KEYS) {
      expect(MODES[mode].label.length).toBeGreaterThan(1)
      expect(MODES[mode].hint.touch.length).toBeGreaterThan(3)
      const world = enter(makeWorld(mode))
      const start = world.players.map((player) => [player.x, player.y])
      const far = world.players.map(() => 0)
      run(
        world,
        9,
        (w) => Object.fromEntries(w.players.filter((p) => p.alive).map((p, i) => [p.id, BOT_STRATEGIES[i % 2 ? 'rusher' : 'kiter'].commands(w, p)])),
        (w) =>
          w.players.forEach((player, i) => {
            for (const value of [player.x, player.y, player.hp, player.aim]) expect(Number.isFinite(value), mode).toBe(true)
            expect(player.x, mode).toBeGreaterThanOrEqual(AREA.x0 + RADIUS - 0.01)
            expect(player.y, mode).toBeLessThanOrEqual(AREA.y1 - RADIUS + 0.01)
            far[i] = Math.max(far[i], Math.hypot(player.x - start[i][0], player.y - start[i][1]))
          }),
      )
      expect(Math.max(...far), mode).toBeGreaterThan(30)
    }
  })
})

describe('짧은 영상(중력)', () => {
  it('떨어져 바닥에 서고, 위로 밀면 발판 간격보다 높이 뛰며, 공중에서는 다시 뛰지 못한다', () => {
    const world = enter(makeWorld('shorts', ['game']))
    const me = world.players[0]
    put(me, 180, 450)
    run(world, 1)
    expect(me.y).toBeCloseTo(AREA.y1 - RADIUS, 0)
    let top = me.y
    run(world, 0.8, { a: [{ type: 'move', x: 0, y: -1 }] }, () => (top = Math.min(top, me.y)))
    const height = AREA.y1 - RADIUS - top
    expect(height).toBeGreaterThan(144)
    expect(height).toBeLessThan(JUMP ** 2 / 2 / 1150 + 8)
  })

  it('상대 위치를 예측할 때 발판을 뚫고 내려가지 않고, 쓰러진 사람은 바닥까지 떨어진다', () => {
    const world = enter(createWorld({ seed: 5, modes: ['shorts'], players: ['a', 'b', 'c'].map((id) => ({ id, loadout: loadout(null), local: id === 'a' })) }))
    const foe = world.players[1]
    const box = OBSTACLES[2]
    const y = box.y - RADIUS
    for (let i = 0; i < 4; i += 1) applyRemote(world, 'b', { x: 180, y: y - 60 + i * 20, hp: 80, alive: true, t: i * 50 }, { now: i * 50 + 150 })
    run(world, 0.3)
    expect(foe.y).toBeLessThanOrEqual(y + 1)
    Object.assign(foe, { alive: false, x: 30, y: 200 })
    run(world, 1.5)
    expect(foe.y).toBeCloseTo(AREA.y1 - RADIUS, 0)
  })

  it('앱 아이콘 위에 설 수 있다', () => {
    const world = enter(makeWorld('shorts', ['game']))
    const me = world.players[0]
    const box = OBSTACLES[2]
    put(me, box.x + box.w / 2, box.y - 60)
    run(world, 1)
    expect(me.y).toBeCloseTo(box.y - RADIUS, 0)
  })
})

describe('광고', () => {
  it('건너뛰기는 5초 뒤에 나오고, 먼저 밟은 사람만 광고가 사라지며 잠깐 무적이다', () => {
    const world = enter(makeWorld('ad', ['game', 'feed']))
    const skip = world.items.find((item) => item.kind === 'skip')
    expect(skip.t).toBeCloseTo(world.schedule.dives[0].t + 5)
    expect([adCount(world, 'a'), adCount(world, 'b')]).toEqual([1, 1])
    put(world.players[0], skip.x, skip.y)
    put(world.players[1], 30, 530)
    run(world, 3)
    expect(skip.taken).toBe(false)
    run(world, 2.5, {}, () => put(world.players[0], skip.x, skip.y))
    expect(skip.taken).toBe(true)
    expect([adCount(world, 'a'), adCount(world, 'b')]).toEqual([0, 2])
    expect(world.players[0].airT).toBeGreaterThan(0)
    expect(world.players[1].airT).toBe(0)
  })

  it('거의 동시에 밟으면 먼저 밟은 사람이 이기고, 진 사람의 무적은 거둔다(받은 순서와 상관없이 같다)', () => {
    const order = (first, second) => {
      const world = enter(makeWorld('ad', ['game', 'feed']))
      world.startAt = 0
      const skip = world.items.find((item) => item.kind === 'skip')
      world.time = skip.t + 0.5
      for (const [id, t] of [first, second]) spawnEvent(world, { k: 'pick', o: id, x: 0, y: 0, a: 0, i: skip.id, t })
      return [skippedBy(world), world.players.map((player) => player.airT > 0)]
    }
    expect(order(['a', 9000], ['b', 8990])).toEqual(order(['b', 8990], ['a', 9000]))
    expect(order(['a', 9000], ['b', 8990])[0]).toBe('b')
    expect(order(['b', 9000], ['a', 9000])[0]).toBe('a')
  })

  it('온라인에서도 누가 건너뛰었는지 같다', () => {
    const room = new MemoryRoom({ now: () => 1000 })
    const screen = (me) => createWorld({ seed: 5, modes: ['ad'], players: ['a', 'b'].map((id) => ({ id, loadout: loadout(null), local: id === me })) })
    const worlds = { a: enter(screen('a')), b: enter(screen('b')) }
    const channels = { a: room.join('a'), b: room.join('b') }
    linkWorld(worlds.a, channels.a, 'a')
    linkWorld(worlds.b, channels.b, 'b')
    const skip = worlds.a.items.find((item) => item.kind === 'skip')
    for (const world of Object.values(worlds)) world.time = skip.t + 0.1
    put(worlds.a.players[0], skip.x, skip.y)
    stepWorld(worlds.a, {}, 1 / 60)
    for (const ev of worlds.a.outbox) channels.a.sendEvent(ev)
    stepWorld(worlds.b, {}, 1 / 60)
    expect(skippedBy(worlds.b)).toBe('a')
    expect(adCount(worlds.b, 'b')).toBe(2)
  })
})

describe('음악', () => {
  it('박자에 맞춰 쏘면 두 배, 아니면 그대로다', () => {
    for (const [t, m] of [
      [BEAT * 4, 2],
      [BEAT * 4.5, 1],
    ]) {
      const world = enter(makeWorld('rhythm', ['game', 'feed']))
      world.time = world.schedule.dives[0].t + DIVE.zoom / 2 + t - 1 / 60
      stepWorld(world, { a: [{ type: 'fire' }] }, 1 / 60)
      expect(world.outbox.find((ev) => ev.k === 'shot').m).toBe(m)
    }
    expect(onBeat(0)).toBe(true)
    expect(onBeat(BEAT / 2)).toBe(false)
  })

  it('박자마다 한 번씩 알린다', () => {
    const world = enter(makeWorld('rhythm', ['game']))
    const beats = []
    world.signals.subscribe((signal) => signal.kind === 'beat' && beats.push(signal.text))
    run(world, 4)
    expect(beats.length).toBeGreaterThanOrEqual(8)
    expect(beats.length).toBeLessThanOrEqual(9)
  })
})

describe('앱 업데이트', () => {
  it('공격과 기술이 서로 바뀌고 끝나면 돌아온다', () => {
    const world = enter(makeWorld('update', ['game', 'feed', 'music']))
    expect(world.players.map(skillKey)).toEqual(['feed', 'music', 'game'])
    stepWorld(world, { a: [{ type: 'fire' }] }, 1 / 60)
    expect(world.outbox[0].s).toBe('feed')
    expect(world.players[0].cd.shot).toBe(ATTACKS.feed.cooldown)
  })

  it('모두 같거나 기술이 없어도 저마다 다른 쓸 수 있는 기술을 받는다', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      for (const list of [['game', 'game'], ['unrecorded', 'unrecorded'], ['unrecorded', 'detox', 'game'], ['feed']]) {
        shuffleSkills(list, seed).forEach((key, i) => {
          expect(key).not.toBe('unrecorded')
          expect(key).not.toBe(list[i])
          expect(ATTACKS[key]).toBeDefined()
        })
      }
    }
  })
})

describe('알고리즘 보스', () => {
  it('사람끼리는 맞지 않고, 보스의 탄에는 맞는다', () => {
    const world = enter(makeWorld('boss', ['game', 'feed']))
    put(world.players[0], 60, 500)
    put(world.players[1], 120, 500)
    for (const s of ['shopping', 'music', 'feed', 'video']) spawnEvent(world, { k: 'skill', s, o: 'a', x: 60, y: 500, a: 0 })
    spawnEvent(world, { k: 'shot', s: 'study', o: 'a', x: 60, y: 500, a: 0 })
    run(world, 0.8, {}, () => put(world.players[1], 120, 500))
    expect(world.players[1].hp).toBe(world.players[1].maxHp)
    run(world, 8)
    expect(world.players.some((player) => player.hp < player.maxHp)).toBe(true)
  })

  it('탄이 보스에 맞으면 때린 사람의 피해로 세고, 가장 많이 때린 사람이 회복한다', () => {
    const world = enter(makeWorld('boss', ['game', 'feed']))
    for (const player of world.players) Object.assign(player, { hp: 40 })
    put(world.players[0], 20, 530)
    put(world.players[1], 340, 530)
    const { boss } = world
    for (let i = 0; i < 200 && boss.alive; i += 1) {
      spawnEvent(world, { k: 'shot', s: 'study', o: 'a', x: boss.x, y: boss.y + 70, a: -Math.PI / 2 })
      stepWorld(world, {}, 1 / 60)
      for (const player of world.players) player.airT = 1
    }
    expect(boss.alive).toBe(false)
    expect(world.players[0].hp).toBe(40) // 알림이 다 도착할 시간을 두고 준다
    run(world, BOSS.settle + 0.1, {}, () => world.players.forEach((player) => (player.airT = 1)))
    expect(boss.dealt.get('a')).toBeGreaterThanOrEqual(boss.maxHp)
    expect(world.players[0].hp).toBe(40 + BOSS.allHeal + BOSS.topHeal)
    expect(world.players[1].hp).toBe(40 + BOSS.allHeal)
  })

  it('내 화면은 내 피해만 세고 알리며, 남의 피해는 알림으로만 센다', () => {
    const world = enter(createWorld({ seed: 5, modes: ['boss'], players: ['a', 'b'].map((id) => ({ id, loadout: loadout(null), local: id === 'a' })) }))
    const { boss } = world
    for (const o of ['a', 'b']) spawnEvent(world, { k: 'shot', s: 'study', o, x: boss.x, y: boss.y + 70, a: -Math.PI / 2 })
    run(world, 0.3, {}, () => world.players.forEach((player) => (player.airT = 1)))
    expect(boss.dealt.get('a')).toBe(5)
    expect(boss.dealt.has('b')).toBe(false)
    expect(world.outbox.some((ev) => ev.k === 'pick' && ev.i === 1000005)).toBe(true)
    spawnEvent(world, { k: 'pick', o: 'b', x: 0, y: 0, a: 0, i: 1000020 })
    spawnEvent(world, { k: 'pick', o: 'b', x: 0, y: 0, a: 0, i: 1000012 }) // 늦게 온 옛 알림
    expect(boss.dealt.get('b')).toBe(20)
    expect(boss.hp).toBe(boss.maxHp - 25)
  })

  it('충격파와 덫도 보스를 때리고, 보스가 쓰러지면 휴전이 끝나며 깔아 둔 것이 치워진다', () => {
    const world = enter(makeWorld('boss', ['music', 'feed']))
    const { boss } = world
    spawnEvent(world, { k: 'skill', s: 'music', o: 'a', x: boss.x, y: boss.y + 60, a: 0 })
    expect(boss.dealt.get('a')).toBeGreaterThan(0)
    spawnEvent(world, { k: 'skill', s: 'video', o: 'a', x: 60, y: 480, a: 0 })
    expect(world.traps.length + world.turrets.length).toBeGreaterThan(0)
    boss.dealt.set('a', boss.maxHp)
    spawnEvent(world, { k: 'shot', s: 'study', o: 'a', x: boss.x, y: boss.y + 60, a: -Math.PI / 2 })
    run(world, 0.2, {}, () => world.players.forEach((player) => (player.airT = 1)))
    expect(boss.alive).toBe(false)
    expect([world.traps.length, world.turrets.length]).toEqual([0, 0])
    put(world.players[0], 60, 500)
    put(world.players[1], 120, 500)
    for (const player of world.players) player.airT = 0
    spawnEvent(world, { k: 'shot', s: 'study', o: 'a', x: 60, y: 500, a: 0 })
    run(world, 0.3)
    expect(world.players[1].hp).toBeLessThan(world.players[1].maxHp)
  })

  it('보스 자리와 무늬는 시각만으로 정해지고 경기장 안이다', () => {
    for (let t = 0; t < 12; t += 0.1) {
      const spot = bossAt(t)
      expect(spot.x - BOSS.r).toBeGreaterThan(AREA.x0)
      expect(spot.x + BOSS.r).toBeLessThan(AREA.x1)
      expect(spot.y - BOSS.r).toBeGreaterThan(AREA.y0)
    }
    expect(pattern(4)).toEqual(pattern(4))
  })

  it('보스가 사라지면 다시 서로 맞는다', () => {
    const world = enter(makeWorld('boss', ['game', 'feed']))
    run(world, 12, {}, (w) => w.players.forEach((player) => Object.assign(player, { hp: player.maxHp, alive: true })))
    put(world.players[0], 60, 500)
    put(world.players[1], 120, 500)
    world.players[1].hp = world.players[1].maxHp
    spawnEvent(world, { k: 'shot', s: 'study', o: 'a', x: 60, y: 500, a: 0 })
    run(world, 0.3)
    expect(world.players[1].hp).toBeLessThan(world.players[1].maxHp)
    expect(applyDamage(world, world.players[0], 3)).toBe(true)
  })
})
