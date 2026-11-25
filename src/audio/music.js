import { useEffect } from 'react'
import { audioContext, soundOn } from './player'

// 배경음악: 짧은 8비트 곡을 그 자리에서 연주한다(음원 파일 없음, 직접 지은 곡).
// 곡은 16분음표 칸 목록이다. 조금 앞의 음까지 미리 예약해(LOOKAHEAD) 화면이 바빠도 박자가 흔들리지 않는다.
const KEY = 'detox-pvp-music'
const LOOKAHEAD = 0.18 // 초
const TICK = 60 // ms
const VOLUME = 0.5

export function musicOn() {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
// "A4" → 440Hz. "." 은 쉼
export function frequencyOf(note) {
  const m = note.match(/^([A-G]#?)(\d)$/)
  return m ? 440 * 2 ** ((NAMES[m[1]] - 9) / 12 + Number(m[2]) - 4) : null
}
const line = (text) => text.trim().split(/\s+/)

// lead: 가락, bass: 저음, drum: k(쿵) s(탁) h(칙). 칸 수는 모두 같다.
export const TRACKS = {
  lobby: {
    bpm: 92,
    lead: { type: 'triangle', gain: 0.1, notes: line('E5 . G5 . A5 . G5 . E5 . D5 . C5 . . .  D5 . E5 . G5 . E5 . D5 . C5 . A4 . C5 .') },
    bass: { type: 'triangle', gain: 0.14, notes: line('C3 . . . G2 . . . A2 . . . E2 . . .  F2 . . . C3 . . . G2 . . . G2 . B2 .') },
    drum: line('k . . h . . h . s . . h . . h .  k . . h k . h . s . . h . h h .'),
  },
  battle: {
    bpm: 148,
    lead: { type: 'square', gain: 0.045, notes: line('A4 . A4 C5 . E5 . D5 C5 . B4 . G4 . A4 .  A4 . C5 E5 . G5 . E5 F5 . E5 . D5 . B4 .') },
    bass: { type: 'sawtooth', gain: 0.06, notes: line('A2 . A2 . A2 . A2 . F2 . F2 . F2 . F2 .  C3 . C3 . C3 . C3 . G2 . G2 . G2 . E2 .') },
    drum: line('k . h . s . h . k k h . s . h .  k . h . s . h . k . h k s . h h'),
  },
  // 폰 속(1인칭): 같은 조의 낮고 다급한 곡
  dive: {
    bpm: 164,
    lead: { type: 'sawtooth', gain: 0.035, notes: line('A3 . E4 . A4 . E4 . A#3 . F4 . A#4 . F4 .  A3 . E4 . A4 . C5 . B4 . G#4 . E4 . D4 .') },
    bass: { type: 'square', gain: 0.06, notes: line('A1 A1 . A1 A1 . A1 . A#1 A#1 . A#1 A#1 . A#1 .  A1 A1 . A1 A1 . A1 . G#1 G#1 . G#1 E1 . E1 .') },
    drum: line('k . k h s . k h k . k h s . h h  k . k h s . k h k k k h s s h h'),
  },
}

// 지금 연주자. context(): AudioContext, every: 주기 실행(시험할 때 바꿔 끼운다)
export function createMusic({ context, enabled, every = (fn, ms) => setInterval(fn, ms), cancel = (id) => clearInterval(id) }) {
  let track = null
  let timer = null
  let step = 0
  let nextAt = 0
  let noise = null
  let master = null

  function tone(ac, at, frequency, length, { type, gain }) {
    const osc = ac.createOscillator()
    const env = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, at)
    env.gain.setValueAtTime(gain, at)
    env.gain.exponentialRampToValueAtTime(0.0005, at + length)
    osc.connect(env).connect(master)
    osc.start(at)
    osc.stop(at + length + 0.02)
  }

  function drum(ac, at, kind) {
    if (kind === 'k') {
      const osc = ac.createOscillator()
      const env = ac.createGain()
      osc.frequency.setValueAtTime(130, at)
      osc.frequency.exponentialRampToValueAtTime(42, at + 0.1)
      env.gain.setValueAtTime(0.2, at)
      env.gain.exponentialRampToValueAtTime(0.0005, at + 0.13)
      osc.connect(env).connect(master)
      osc.start(at)
      osc.stop(at + 0.15)
      return
    }
    if (!noise) {
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.12), ac.sampleRate)
      const data = noise.getChannelData(0)
      let a = 1
      for (let i = 0; i < data.length; i += 1) {
        a = (Math.imul(a, 1103515245) + 12345) >>> 0
        data[i] = (a >>> 16) / 32768 - 1
      }
    }
    const length = kind === 's' ? 0.1 : 0.03
    const source = ac.createBufferSource()
    const env = ac.createGain()
    source.buffer = noise
    env.gain.setValueAtTime(kind === 's' ? 0.08 : 0.03, at)
    env.gain.exponentialRampToValueAtTime(0.0005, at + length)
    source.connect(env).connect(master)
    source.start(at)
    source.stop(at + length)
  }

  function tick() {
    const ac = context()
    if (!track || !ac || ac.state !== 'running' || !enabled()) {
      nextAt = 0 // 다시 켜지면 그때부터 이어 간다.
      return
    }
    if (!master) {
      master = ac.createGain()
      master.gain.value = VOLUME
      master.connect(ac.destination)
    }
    if (nextAt < ac.currentTime) nextAt = ac.currentTime + 0.05
    const length = 60 / track.bpm / 4
    while (nextAt < ac.currentTime + LOOKAHEAD) {
      const index = step % track.drum.length
      for (const part of [track.lead, track.bass]) {
        const frequency = frequencyOf(part.notes[index])
        if (frequency) tone(ac, nextAt, frequency, length * 1.8, part)
      }
      if (track.drum[index] !== '.') drum(ac, nextAt, track.drum[index])
      step += 1
      nextAt += length
    }
  }

  return {
    play(name) {
      if (TRACKS[name] === track) return
      track = TRACKS[name] ?? null
      step = 0
      nextAt = 0
      if (track && timer === null) timer = every(tick, TICK)
      if (!track && timer !== null) {
        cancel(timer)
        timer = null
      }
    },
    stop() {
      this.play(null)
    },
    tick,
  }
}

const hidden = () => typeof document !== 'undefined' && document.hidden
export const music = createMusic({ context: audioContext, enabled: () => musicOn() && soundOn() && !hidden() })

export function setMusicOn(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // 저장하지 못해도 이번에는 그대로 쓴다.
  }
}

// 화면이 떠 있는 동안 그 곡을 튼다. name이 null이면 끈다.
export function useMusic(name) {
  useEffect(() => {
    music.play(name)
  }, [name])
  useEffect(() => () => music.stop(), [])
}
