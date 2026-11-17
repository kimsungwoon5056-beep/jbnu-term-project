// 8비트 효과음: 소리 파일 없이 Web Audio 발진기로 만든다. 켜고 끈 설정은 이 브라우저에만 기억한다.
const KEY = 'detox-pvp-sound'

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // 저장하지 못해도 이번 판에는 그대로 쓴다.
  }
}

// [주파수(Hz), 길이(초), 파형, 크기] 음을 차례로 낸다.
export const TONES = {
  shot: [[880, 0.035, 'square', 0.03]],
  hit: [[260, 0.05, 'square', 0.06]],
  hurt: [
    [200, 0.06, 'sawtooth', 0.1],
    [130, 0.09, 'sawtooth', 0.08],
  ],
  down: [
    [330, 0.08, 'square', 0.08],
    [220, 0.08, 'square', 0.08],
    [130, 0.18, 'square', 0.08],
  ],
  pick: [
    [660, 0.06, 'square', 0.07],
    [990, 0.1, 'square', 0.07],
  ],
  storm: [
    [740, 0.09, 'triangle', 0.09],
    [0, 0.05],
    [740, 0.09, 'triangle', 0.09],
    [0, 0.05],
    [740, 0.09, 'triangle', 0.09],
  ],
  tick: [[440, 0.07, 'square', 0.06]],
  go: [
    [660, 0.08, 'square', 0.08],
    [990, 0.2, 'square', 0.08],
  ],
  win: [
    [523, 0.1, 'square', 0.08],
    [659, 0.1, 'square', 0.08],
    [784, 0.1, 'square', 0.08],
    [1046, 0.3, 'square', 0.08],
  ],
  lose: [
    [392, 0.15, 'triangle', 0.09],
    [330, 0.15, 'triangle', 0.09],
    [262, 0.35, 'triangle', 0.09],
  ],
}

let context = null

function audio() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContext) return null
  context ??= new AudioContext()
  if (context.state === 'suspended') context.resume().catch(() => {})
  return context
}

export function play(name) {
  if (!soundOn() || !TONES[name]) return
  const ac = audio()
  if (!ac) return
  let at = ac.currentTime
  for (const [freq, length, type = 'square', volume = 0.08] of TONES[name]) {
    if (freq > 0) {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, at)
      gain.gain.setValueAtTime(volume, at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
      osc.connect(gain).connect(ac.destination)
      osc.start(at)
      osc.stop(at + length)
    }
    at += length
  }
}

// Observer: 대결 신호 → 효과음. world.signals.subscribe(soundBoard(내 id))로 붙인다. sound는 시험할 때 바꿔 끼울 수 있다.
export function soundBoard(meId, sound = play) {
  return (signal) => {
    const mine = signal.who === meId
    if (signal.kind === 'shot') {
      if (mine) sound('shot')
    } else if (signal.kind === 'hit') sound(mine ? 'hurt' : 'hit')
    else if (signal.kind === 'item') sound('pick')
    else if (['down', 'storm', 'tick', 'go'].includes(signal.kind)) sound(signal.kind)
  }
}
