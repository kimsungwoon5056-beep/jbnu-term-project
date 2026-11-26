import { SFX } from './sfx'

// 효과음 내기. zzfx는 첫 소리를 낼 때 한 번 불러온다(불러오자마자 AudioContext를 만들기 때문).
// 켜고 끈 설정은 이 브라우저에만 기억한다.
const KEY = 'detox-pvp-sound'
const SAME_GAP = 40 // 같은 소리는 이 시간(ms) 안에 겹쳐 내지 않는다.
const VARIANTS = 3 // 같은 소리도 조금씩 다르게

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
    // 저장하지 못해도 이번에는 그대로 쓴다.
  }
}

// 합성기 하나를 만든다. load(): zzfx를 불러오는 함수, now(): 지금 시각(ms) — 시험할 때 바꿔 끼운다.
export function createPlayer({ load, now = () => performance.now(), enabled = soundOn, wait = setTimeout, random = Math.random }) {
  let engine = null // null: 아직, false: 쓸 수 없음
  let loading = null
  const cache = new Map()
  const lastAt = new Map()

  async function prepare() {
    if (engine !== null) return engine
    loading ??= Promise.resolve()
      .then(load)
      .then((module) => module.ZZFX)
      .catch(() => false) // 소리를 못 내도 앱은 그대로 돈다.
    engine = await loading
    return engine
  }

  function emit(zzfx, name, index, values) {
    const key = `${name}:${index}:${Math.floor(random() * VARIANTS)}`
    if (!cache.has(key)) cache.set(key, zzfx.buildSamples(...values))
    try {
      zzfx.playSamples([cache.get(key)], 1, 0.96 + random() * 0.08)
    } catch {
      // 소리 장치가 없거나 막혀 있으면 조용히 넘어간다.
    }
  }

  // 사용자가 화면을 처음 만졌을 때 부른다(브라우저는 손짓이 있어야 소리를 허락한다).
  async function unlock() {
    const zzfx = await prepare()
    if (zzfx && zzfx.audioContext?.state === 'suspended') await zzfx.audioContext.resume().catch(() => {})
    return Boolean(zzfx)
  }

  async function play(name) {
    if (!enabled() || !SFX[name]) return false
    if (globalThis.document?.hidden) return false // 다른 탭에 가 있는 동안은 소리를 내지 않는다(배경음악과 같게)
    const at = now()
    if (at - (lastAt.get(name) ?? -Infinity) < SAME_GAP) return false
    lastAt.set(name, at)
    const zzfx = await prepare()
    if (!zzfx || zzfx.audioContext?.state === 'closed') return false
    if (zzfx.audioContext?.state === 'suspended') zzfx.audioContext.resume().catch(() => {})
    SFX[name].forEach(([delay, values], index) => {
      if (delay > 0) wait(() => enabled() && emit(zzfx, name, index, values), delay * 1000)
      else emit(zzfx, name, index, values)
    })
    return true
  }

  return { play, unlock, context: () => engine?.audioContext ?? null }
}

const player = createPlayer({
  load: () => (typeof window !== 'undefined' && window.AudioContext ? import('zzfx') : Promise.reject(new Error('no audio'))),
})
export const play = player.play
export const unlockAudio = player.unlock
export const audioContext = player.context // 아직 소리를 낸 적이 없으면 null
