import { describe, expect, it } from 'vitest'
import { createMusic, frequencyOf, TRACKS } from './music'

// 가짜 AudioContext: 무엇이 언제 예약됐는지만 적는다.
function fakeContext() {
  const starts = []
  const node = (extra = {}) => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (to) => to, start: (at) => starts.push(at), stop() {}, ...extra })
  return {
    starts,
    state: 'running',
    currentTime: 0,
    sampleRate: 1000,
    destination: {},
    createGain: () => node(),
    createOscillator: () => node(),
    createBufferSource: () => node(),
    createBuffer: (_, length) => ({ getChannelData: () => new Float32Array(length) }),
  }
}

describe('배경음악', () => {
  it('음 이름을 주파수로 바꾼다', () => {
    expect(frequencyOf('A4')).toBeCloseTo(440)
    expect(frequencyOf('A3')).toBeCloseTo(220)
    expect(frequencyOf('C5')).toBeCloseTo(523.25, 1)
    expect(frequencyOf('.')).toBeNull()
  })

  it('곡마다 가락·저음·북의 칸 수가 같고, 적힌 음은 모두 읽을 수 있다', () => {
    for (const [name, track] of Object.entries(TRACKS)) {
      expect(track.lead.notes.length, name).toBe(track.drum.length)
      expect(track.bass.notes.length, name).toBe(track.drum.length)
      for (const note of [...track.lead.notes, ...track.bass.notes]) if (note !== '.') expect(frequencyOf(note), `${name} ${note}`).toBeGreaterThan(20)
      for (const hit of track.drum) expect('.ksh').toContain(hit)
    }
  })

  it('박자에 맞춰 조금 앞까지만 예약하고, 끄면 예약하지 않으며, 다시 켜면 지금부터 잇는다', () => {
    const ac = fakeContext()
    let on = true
    let running = 0
    const music = createMusic({ context: () => ac, enabled: () => on, every: () => (running += 1), cancel: () => (running -= 1) })
    music.play('battle')
    expect(running).toBe(1)
    for (let t = 0; t < 2; t += 0.06) {
      ac.currentTime = t
      music.tick()
    }
    expect(ac.starts.length).toBeGreaterThan(20)
    for (const at of ac.starts) expect(at).toBeLessThan(2.3)
    on = false
    const before = ac.starts.length
    ac.currentTime = 5
    music.tick()
    expect(ac.starts).toHaveLength(before)
    on = true
    music.tick()
    expect(ac.starts.slice(before).every((at) => at >= 5)).toBe(true)
    music.stop()
    expect(running).toBe(0)
  })

  it('소리 장치가 없거나 멈춰 있으면 아무 일도 하지 않는다', () => {
    const music = createMusic({ context: () => null, enabled: () => true, every: () => 1, cancel() {} })
    music.play('lobby')
    expect(() => music.tick()).not.toThrow()
  })
})
