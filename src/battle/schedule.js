import { RULE_MODES, VIEW_MODES } from './modes/keys'
import { seededRandom } from './pool'

// 판 중간 사건의 일정(순수 함수). 같은 씨앗이면 어느 화면에서도 같은 시각·같은 자리에 같은 일이 생긴다.
// 온라인은 시간이 서버 시각에 맞춰 흐르므로, 일정만 같으면 네트워크를 더 쓰지 않고도 모두 같은 사건을 본다.

// 아이템: 폰 중독을 이기는 도구
export const ITEMS = {
  airplane: { label: '비행기 모드', desc: '2초 동안 무적', time: 2 },
  charger: { label: '충전기', desc: '체력 +15', heal: 15 },
  dnd: { label: '방해 금지', desc: '8초 동안 알림 폭풍·알림 배지 멈칫을 막는다', time: 8 },
}
export const ITEM_KINDS = Object.keys(ITEMS)
// 광고 모드의 "건너뛰기" 칸도 아이템처럼 줍는다(무작위로는 나오지 않는다).
export const SKIP = { label: '광고 건너뛰기', time: 2 }
export const itemInfo = (kind) => (kind === 'skip' ? SKIP : ITEMS[kind])
export const ITEM = { first: 6, every: 12, life: 20, pickRadius: 24 }

// 알림 폭풍: 화면 위에서 알림 말풍선이 정해진 줄을 따라 쏟아진다.
export const STORM = {
  starts: [36, 60],
  warn: 1.5, // 말풍선이 내려오기 전 경고 시간
  lanes: 6, // 화면을 세로 줄 6개로 나눈다
  waves: 3, // 한 번에 3번 쏟아짐
  waveGap: 0.7,
  perWave: 2, // 한 번에 2줄(6줄 중 4줄은 비어 피하기 쉽다)
  speed: 300,
  damage: 3,
  stun: 0.3,
  w: 46, // 말풍선 크기
  h: 22,
}
export const BUBBLE_KINDS = ['chat', 'dm', 'ad']

// 배터리 경고: 60초부터 가장자리가 꺼진 화면이 되며 90초에 가운데 60%만 남는다.
export const DRAIN = { start: 60, end: 90, keep: 0.6, dps: 4 }

// 앱 속으로: 정해진 동안 모두의 화면이 갑자기 다른 장르로 바뀐다(모드 12가지, modes/).
// 알림 폭풍(36·60초)과 겹치지 않는 때에, 씨앗으로 정해진 시각에 시작한다.
// 보는 법만 바뀌는 모드와 규칙까지 바뀌는 모드가 번갈아 나온다.
export const DIVE = { starts: [[8, 10], [22, 24], [45, 47], [68, 70]], length: 10, warn: 1.2, zoom: 0.8, out: 0.6, skipAfter: 5 }

// 문자열(방 코드·방을 만든 시각) → 씨앗
export function seedOf(...parts) {
  let hash = 2166136261
  for (const ch of parts.join('|')) {
    hash ^= ch.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 1000000007
}

// area: 놀 수 있는 곳 { x0, y0, x1, y1 }, blocked(x, y, r): 장애물과 겹치면 true
// modes: 나올 모드를 정해 두려면 열쇠 목록(연습의 "앱 고르기"). 없으면 씨앗으로 고른다.
export function buildSchedule({ seed, seconds, area, blocked, modes = null }) {
  const rng = seededRandom(seed ^ 0x5eed)
  const items = []
  for (let t = ITEM.first, id = 0; t < seconds - 4; t += ITEM.every, id += 1) {
    const kind = ITEM_KINDS[Math.floor(rng() * ITEM_KINDS.length)]
    let x = 0
    let y = 0
    for (let tries = 0; tries < 40; tries += 1) {
      x = Math.round(area.x0 + 30 + rng() * (area.x1 - area.x0 - 60))
      y = Math.round(area.y0 + 40 + rng() * (area.y1 - area.y0 - 80))
      if (!blocked(x, y, 20)) break
    }
    items.push({ id, t, kind, x, y })
  }

  const laneW = (area.x1 - area.x0) / STORM.lanes
  const bubbles = []
  for (const start of STORM.starts) {
    if (start >= seconds) continue
    for (let wave = 0; wave < STORM.waves; wave += 1) {
      const lanes = [...Array(STORM.lanes).keys()]
      // 섞어서 앞의 몇 줄을 쓴다(빈 줄이 늘 남아 피할 수 있다).
      for (let i = lanes.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1))
        ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
      }
      for (const lane of lanes.slice(0, STORM.perWave)) {
        bubbles.push({
          id: bubbles.length,
          t: Number((start + STORM.warn + wave * STORM.waveGap).toFixed(2)),
          lane,
          x: Math.round(area.x0 + laneW * (lane + 0.5)),
          kind: BUBBLE_KINDS[Math.floor(rng() * BUBBLE_KINDS.length)],
        })
      }
    }
  }
  // 아이템·폭풍의 무작위 순서가 바뀌지 않게 맨 뒤에서 정한다.
  const shuffled = (list) => {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }
  const views = shuffled(VIEW_MODES)
  const rules = shuffled(RULE_MODES)
  if (rules[1] === 'shorts') rules.reverse() // 넷째는 배터리 경고와 겹치므로 중력 모드를 넣지 않는다
  const dives = DIVE.starts
    .map(([from, to], k) => {
      const t = Number((from + rng() * (to - from)).toFixed(2))
      const mode = modes?.length ? modes[k % modes.length] : k % 2 === 0 ? views[k / 2] : rules[(k - 1) / 2]
      return { t, end: Number((t + DIVE.length).toFixed(2)), mode }
    })
    .filter((dive) => dive.end < seconds)
  // 광고 모드: 5초 뒤 "건너뛰기" 칸이 생긴다.
  dives.forEach((dive, k) => {
    if (dive.mode !== 'ad') return
    let x = 180
    let y = 230
    for (let tries = 0; tries < 40; tries += 1) {
      x = Math.round(area.x0 + 50 + rng() * (area.x1 - area.x0 - 100))
      y = Math.round(area.y0 + 60 + rng() * (area.y1 - area.y0 - 120))
      if (!blocked(x, y, 26)) break
    }
    items.push({ id: 900 + k, t: Number((dive.t + DIVE.skipAfter).toFixed(2)), until: dive.end, kind: 'skip', x, y })
  })
  return { items, bubbles, laneW, dives, seed }
}

// 말풍선의 지금 위치(시간만으로 정해진다). 화면에 없으면 null
export function bubbleY(bubble, time, area) {
  if (time < bubble.t) return null
  const y = area.y0 - STORM.h + (time - bubble.t) * STORM.speed
  return y > area.y1 + STORM.h ? null : y
}

// 지금 경고 중인 줄: 곧 말풍선이 내려올 줄 번호들
export function warningLanes(schedule, time) {
  const lanes = new Set()
  for (const bubble of schedule.bubbles) if (time >= bubble.t - STORM.warn && time < bubble.t) lanes.add(bubble.lane)
  return lanes
}

// 꺼진 화면이 먹어 들어온 정도(0~1)와 남은 안전 구역
export function drainLevel(time) {
  if (time <= DRAIN.start) return 0
  return Math.min(1, (time - DRAIN.start) / (DRAIN.end - DRAIN.start))
}

export function safeArea(area, time) {
  const level = drainLevel(time)
  const insetX = ((area.x1 - area.x0) * (1 - DRAIN.keep) * level) / 2
  const insetY = ((area.y1 - area.y0) * (1 - DRAIN.keep) * level) / 2
  return { x0: area.x0 + insetX, y0: area.y0 + insetY, x1: area.x1 - insetX, y1: area.y1 - insetY }
}

// 지금 판에서 켜져 있는 자리: 바닥에 설 수밖에 없는 모드(짧은 영상)에서는 아래쪽이 꺼지지 않는다.
export function safeOf(world, area) {
  const safe = safeArea(area, world.time)
  return world.floorSafe ? { ...safe, y1: area.y1 } : safe
}

// 지금이 어느 단계인지. none → warn(지지직) → in(들어감) → on(모드 안) → out(나옴). p: 그 단계의 0~1, dive: 그 모드
export function divePhase(schedule, time) {
  for (const dive of schedule.dives) {
    const { t, end } = dive
    if (time < t - DIVE.warn || time >= end + DIVE.out) continue
    if (time < t) return { phase: 'warn', p: (time - t + DIVE.warn) / DIVE.warn, dive }
    if (time < t + DIVE.zoom) return { phase: 'in', p: (time - t) / DIVE.zoom, dive }
    if (time < end) return { phase: 'on', p: (time - t - DIVE.zoom) / (end - t - DIVE.zoom), dive }
    return { phase: 'out', p: (time - end) / DIVE.out, dive }
  }
  return { phase: 'none', p: 0, dive: null }
}

// 지금 켜져 있는 모드(들어가는 장면의 가운데부터 끝날 때까지). 없으면 null
export function activeDive(world) {
  if (!world.events) return null
  const { phase, p, dive } = divePhase(world.schedule, world.time)
  return phase === 'on' || (phase === 'in' && p >= 0.5) ? dive : null
}
export const activeMode = (world) => activeDive(world)?.mode ?? null
// 모드 시계: 켜진 뒤 흐른 초와 끝날 때까지 남은 초
export const modeClock = (world) => {
  const dive = activeDive(world)
  return dive ? { t: world.time - dive.t - DIVE.zoom / 2, left: dive.end - world.time } : { t: 0, left: 0 }
}

export const itemAlive = (item, time) => !item.taken && time >= item.t && time < (item.until ?? item.t + ITEM.life)
