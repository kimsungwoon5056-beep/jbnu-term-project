import { AREA, RADIUS } from '../arena'
import { seededRandom } from '../pool'
import { aloft, applyDamage } from '../world'

// 짧은 영상: 화면을 넘기듯 "다음 영상" 파도가 정해진 박자로 경기장 한쪽 끝에서 반대쪽 끝까지 바닥을 쓸고 지나간다.
// 바닥에 있다 닿으면 작은 피해와 짧은 기절, 점프해 떠 있으면 아래로 지나간다(world.js의 aloft).
// 언제 어느 쪽에서 오는지는 씨앗과 모드 시각만으로 정해져 모든 화면에서 같다. 판정은 맞는 쪽(내 화면의 나·봇)이 한다.
// first: 모드 시작 뒤 첫 파도, every: 간격, sweep: 끝에서 끝까지 걸리는 초, band: 띠 두께, warn: 오기 전 알림
export const SWIPE = { first: 1, every: 1.6, sweep: 1.1, band: 18, damage: 6, stun: 0.25, warn: 0.5 }
const DIRS = ['down', 'up', 'left', 'right']

// 이 모드 동안의 파도 [{ t, dir }]
export function swipeWaves(dive, seed) {
  const rng = seededRandom((seed ^ Math.round(dive.t * 100)) >>> 0)
  const waves = []
  for (let t = dive.t + SWIPE.first; t + SWIPE.sweep <= dive.end + 1e-9; t += SWIPE.every) {
    waves.push({ t: Number(t.toFixed(2)), dir: DIRS[Math.floor(rng() * DIRS.length)] })
  }
  return waves
}

// 지금 파도의 띠: axis 방향(x·y)의 어느 자리(at)에 있는지. 지나가는 중이 아니면 null
export function bandAt(wave, time) {
  const p = (time - wave.t) / SWIPE.sweep
  if (!(p >= 0 && p < 1)) return null
  if (wave.dir === 'down') return { axis: 'y', at: AREA.y0 + (AREA.y1 - AREA.y0) * p }
  if (wave.dir === 'up') return { axis: 'y', at: AREA.y1 - (AREA.y1 - AREA.y0) * p }
  if (wave.dir === 'right') return { axis: 'x', at: AREA.x0 + (AREA.x1 - AREA.x0) * p }
  return { axis: 'x', at: AREA.x1 - (AREA.x1 - AREA.x0) * p }
}

const touching = (band, player) => Math.abs(player[band.axis] - band.at) <= SWIPE.band / 2 + RADIUS * 0.5

// 봇용: within초 안에 파도가 이 사람에게 닿는지
export function swipeComing(world, player, within) {
  for (const wave of world.modeState?.waves ?? []) {
    for (let dt = 0; dt <= within; dt += 1 / 30) {
      const band = bandAt(wave, world.time + dt)
      if (band && touching(band, player)) return true
    }
  }
  return false
}

export const shorts = {
  enter(world) {
    world.modeState.waves = swipeWaves(world.modeDive, world.schedule.seed)
    world.modeState.swiped = new Set() // 이미 맞은 파도:사람
  },

  step(world) {
    const { waves = [], swiped } = world.modeState
    waves.forEach((wave, i) => {
      const band = bandAt(wave, world.time)
      if (!band) return
      for (const player of world.players) {
        const key = `${i}:${player.id}`
        if (!player.local || !player.alive || swiped.has(key) || aloft(player) || !touching(band, player)) continue
        swiped.add(key)
        if (applyDamage(world, player, SWIPE.damage)) {
          player.stunT = Math.max(player.stunT, SWIPE.stun)
          world.signals.notify({ kind: 'swipe', x: player.x, y: player.y, who: player.id })
        }
      }
    })
  },
}
