import { describe, expect, it } from 'vitest'
import { soundBoard } from '../battle/sound'
import { createPlayer } from './player'
import { SFX } from './sfx'

// 가짜 합성기: 무엇을 몇 번 냈는지만 센다.
function fakeEngine() {
  const played = []
  return { played, module: { ZZFX: { audioContext: { state: 'running' }, buildSamples: (...values) => values, playSamples: ([samples]) => played.push(samples) } } }
}
const makePlayer = (changes = {}) => {
  const engine = fakeEngine()
  let time = 0
  const player = createPlayer({ load: async () => engine.module, now: () => time, enabled: () => true, wait: (fn) => fn(), random: () => 0, ...changes })
  return { ...player, engine, tick: (ms) => (time += ms) }
}

describe('효과음 표', () => {
  it('모든 소리의 값이 숫자(또는 비움)이고 주파수가 있다', () => {
    for (const [name, notes] of Object.entries(SFX)) {
      expect(notes.length, name).toBeGreaterThan(0)
      for (const [at, values] of notes) {
        expect(at).toBeGreaterThanOrEqual(0)
        expect(values[2], name).toBeGreaterThan(0)
        expect(values.every((value) => value === undefined || Number.isFinite(value)), name).toBe(true)
      }
    }
  })

  it('대결에서 나는 신호는 모두 표에 있는 소리를 낸다', () => {
    const names = []
    const board = soundBoard('a', (name) => names.push(name))
    for (const kind of ['shot', 'hit', 'down', 'item', 'storm', 'tick', 'go', 'block', 'alarm', 'dash', 'skill', 'shield', 'focus', 'guard', 'parry', 'parried']) {
      board({ kind, who: 'a', text: '-3' })
      board({ kind, who: 'b', text: '-12' })
    }
    expect(names.length).toBeGreaterThan(10)
    for (const name of names) expect(SFX[name], name).toBeDefined()
    expect(names).toContain('boom') // 크게 맞으면 다른 소리
    expect(names).toContain('ko')
    expect(names).toContain('parry')
    expect(names).toContain('guard')
  })
})

describe('효과음 내기', () => {
  it('꺼 두면 내지 않고, 없는 이름은 무시한다', async () => {
    const off = makePlayer({ enabled: () => false })
    expect(await off.play('shot')).toBe(false)
    const on = makePlayer()
    expect(await on.play('nothing')).toBe(false)
    expect(on.engine.played).toHaveLength(0)
  })

  it('같은 소리는 40ms 안에 겹치지 않고, 다른 소리는 난다', async () => {
    const { play, tick, engine } = makePlayer()
    await play('hit')
    await play('hit')
    expect(engine.played).toHaveLength(1)
    await play('pop')
    expect(engine.played).toHaveLength(2)
    tick(50)
    await play('hit')
    expect(engine.played).toHaveLength(3)
  })

  it('여러 음으로 된 소리는 음마다 낸다', async () => {
    const { play, engine } = makePlayer()
    await play('win')
    expect(engine.played).toHaveLength(SFX.win.length)
  })

  it('합성기를 못 불러오거나 소리 장치가 막혀도 오류를 내지 않는다', async () => {
    const broken = createPlayer({ load: async () => Promise.reject(new Error('x')), now: () => 0, enabled: () => true })
    expect(await broken.play('shot')).toBe(false)
    expect(await broken.unlock()).toBe(false)
    const blocked = makePlayer({
      load: async () => ({
        ZZFX: {
          audioContext: { state: 'running' },
          buildSamples: () => [],
          playSamples() {
            throw new Error('blocked')
          },
        },
      }),
    })
    expect(await blocked.play('shot')).toBe(true)
  })
})
