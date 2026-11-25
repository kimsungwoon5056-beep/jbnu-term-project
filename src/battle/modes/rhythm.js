// 음악: 정해진 박자에 맞춰 쏘면 피해가 두 배다. 박자는 모드가 시작한 시각부터 세므로 모든 화면에서 같다.
export const BPM = 132
export const BEAT = 60 / BPM
export const WINDOW = 0.1 // 박자에서 이만큼(초) 안이면 퍼펙트
export const PERFECT = 2

// 모드가 시작한 뒤 몇 박자째인지(소수)
export const beatsAt = (t) => t / BEAT
// 가장 가까운 박자까지 남은 초
export function offBeat(t) {
  const phase = beatsAt(t) - Math.floor(beatsAt(t))
  return Math.min(phase, 1 - phase) * BEAT
}
export const onBeat = (t) => offBeat(t) <= WINDOW

export const rhythm = {
  enter(world) {
    world.modeState.beat = Math.floor(beatsAt(world.modeT))
  },

  step(world) {
    const beat = Math.floor(beatsAt(world.modeT))
    if (beat === world.modeState.beat) return
    world.modeState.beat = beat
    world.signals.notify({ kind: 'beat', who: null, text: String(beat % 4) })
  },

  // 쏘는 순간의 세기(시전 이벤트의 m에 곱한다)
  power(world, player) {
    if (!onBeat(world.modeT)) return 1
    world.signals.notify({ kind: 'perfect', who: player.id, x: player.x, y: player.y })
    return PERFECT
  },
}
