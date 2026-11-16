import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { addDays } from '../records/dateKey'
import { computeMetrics } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { DEFAULT_FAMILY, PART_FAMILIES, SLOTS } from './anatomy'
import { buildGenome } from './genome'
import PartGuide from './PartGuide'
import { explainParts, featuredPart, PART_REASONS } from './partReasons'
import { seededRandom } from './random'

const END = '2026-11-15'
const guideOf = (records, { uid = 'guide-test', days = 30 } = {}) => {
  const { metrics, details } = computeMetrics(records, END)
  const genome = buildGenome(uid, metrics, details, growthOf(days))
  return { genome, entries: explainParts(genome, metrics, details) }
}
const bySlot = (entries) => Object.fromEntries(entries.map((entry) => [entry.key, entry]))

// 무작위 생활 기록 7일(같은 시드면 같음)
const WORKOUTS = ['running', 'walking', 'cycling', 'swimming', 'strength', 'climbing', 'ball', 'yoga', 'stretching']
const SUBJECTS = ['코딩', '예술', '수학', '영어', '음악']
const HABITS = ['물 마시기', '일기', '스트레칭']
const time = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function randomWeek(seed) {
  const random = seededRandom(seed)
  const pick = (list, chance) => list.filter(() => random() < chance)
  const baseBed = 21 * 60 + random() * 7 * 60
  const skip = random() * 0.5
  const records = []
  for (let i = 0; i < 7; i += 1) {
    if (random() < skip) continue
    const bed = baseBed + (random() - 0.5) * random() * 240
    records.push({
      date: addDays(END, -i),
      sleep: { bedTime: time(bed), wakeTime: time(bed + 240 + random() * 360) },
      workouts: pick(WORKOUTS, 0.15).map((type) => ({ type, minutes: 10 + Math.round(random() * 90) })),
      studies: pick(SUBJECTS, 0.25).map((subject) => ({ subject, minutes: 10 + Math.round(random() * 180) })),
      meals: { count: 1 + Math.floor(random() * 3), lateSnack: random() < 0.4 },
      mood: 1 + Math.floor(random() * 5),
      customHabits: pick(HABITS, 0.3).map((name) => ({ name, done: random() < 0.6 })),
    })
  }
  return records
}

describe('explainParts', () => {
  it('모든 부위 계열에 조건 문장이 있고, 기본 계열이 아니면 근거 함수가 있다', () => {
    for (const slot of SLOTS) {
      for (const family of Object.keys(PART_FAMILIES[slot])) {
        const reason = PART_REASONS[slot][family]
        expect(reason?.when, `${slot}.${family}`).toBeTruthy()
        if (family !== DEFAULT_FAMILY[slot] && !(slot === 'tail' && family === 'none')) expect(typeof reason.facts).toBe('function')
      }
    }
  })

  it('같은 기록이면 같은 설명이 나온다', () => {
    expect(guideOf(nightCoder(END)).entries).toEqual(guideOf(nightCoder(END)).entries)
  })

  it('6자리 설명은 항상 있고, 알 단계는 설명이 없다', () => {
    const keys = guideOf(morningRunner(END)).entries.map((entry) => entry.key)
    for (const slot of SLOTS) expect(keys).toContain(slot)
    expect(guideOf(nightCoder(END), { days: 0 }).entries).toEqual([])
  })

  it('새벽 코더는 취침 시각과 코딩 시간이, 아침 러너는 달리기 시간이 설명에 나온다', () => {
    const coder = guideOf(nightCoder(END)).entries.map((entry) => entry.reason).join(' ')
    expect(coder).toContain('평균 취침 2:10')
    expect(coder).toContain('코딩 7일 14시간')
    const runner = guideOf(morningRunner(END)).entries.map((entry) => entry.reason).join(' ')
    expect(runner).toContain('달리기 7일 3시간 20분')
    const rusher = guideOf(weekendRusher(END)).entries
    expect(rusher.map((entry) => entry.reason).join(' ')).toContain('근력 7일 4시간')
  })

  it('무작위 계정 500개: 고른 부위의 근거는 비어 있지 않고, 0인 숫자를 근거로 들지 않는다', () => {
    const chosen = new Set()
    for (let seed = 1; seed <= 500; seed += 1) {
      const { genome, entries } = guideOf(randomWeek(seed), { uid: `user-${seed}` })
      const slots = bySlot(entries)
      for (const slot of SLOTS) {
        const part = genome.life.anatomy[slot]
        const entry = slots[slot]
        expect(entry.reason).not.toMatch(/(^|[ ~])0(분|일|%)/)
        if (part.kind === DEFAULT_FAMILY[slot] || part.forced) continue
        chosen.add(`${slot}.${part.kind}`)
        expect(entry.facts, `${slot}.${part.kind} (seed ${seed})`).toBeTruthy()
      }
      for (const entry of entries) expect(entry.reason).not.toContain('null')
    }
    // 무작위 기록이 충분히 여러 계열을 거쳐야 위 검사가 의미 있다.
    expect(chosen.size).toBeGreaterThan(35)
  })

  it('기본 계열은 기본 문장, 다음 후보는 기본 계열이 아닌 다른 계열이다', () => {
    const plain = Array.from({ length: 7 }, (_, i) => ({
      date: addDays(END, -i),
      sleep: { bedTime: '23:00', wakeTime: '07:00' },
      workouts: [],
      studies: [],
      meals: { count: 3, lateSnack: false },
      mood: 3,
      customHabits: [],
    }))
    const { genome, entries } = guideOf(plain)
    const slots = bySlot(entries)
    for (const slot of SLOTS) {
      const part = genome.life.anatomy[slot]
      if (part.kind === DEFAULT_FAMILY[slot]) expect(slots[slot].reason).toContain('기본 모양')
      if (part.next) {
        expect(part.next).not.toBe(part.kind)
        expect(part.next).not.toBe(DEFAULT_FAMILY[slot])
        expect(slots[slot].next.label).toBe(PART_FAMILIES[slot][part.next])
      }
    }
  })

  it('하반신 때문에 꼬리가 없으면 그 이유를 말하고 다음 후보를 내지 않는다', () => {
    let found = 0
    for (let seed = 1; seed <= 500 && found < 3; seed += 1) {
      const { genome, entries } = guideOf(randomWeek(seed), { uid: `user-${seed}` })
      if (!genome.life.anatomy.tail.forced) continue
      found += 1
      const tail = bySlot(entries).tail
      expect(tail.reason).toContain('꼬리가 붙지 않아요')
      expect(tail.next).toBeUndefined()
    }
    expect(found).toBeGreaterThan(0)
  })

  it('처음 보여 줄 부위는 특징이 가장 강한 부위다', () => {
    const entries = [
      { key: 'legs', strength: 0.1 },
      { key: 'wings', strength: 0.4 },
      { key: 'tail', strength: 0.4 },
    ]
    expect(featuredPart(entries)).toBe('wings')
    expect(featuredPart([])).toBeNull()
    // 생활 근거로 고른 부위가 있으면 뿔보다 먼저
    expect(featuredPart([{ key: 'horns', strength: 0.06 }, { key: 'legs', strength: 0.01, facts: '공부 7일 1시간' }])).toBe('legs')
  })
})

describe('PartGuide', () => {
  it('부위 버튼과 바뀌는 말풍선을 그린다', () => {
    const { entries } = guideOf(nightCoder(END))
    const html = renderToString(<PartGuide entries={entries} selected="legs" onSelect={() => {}} />)
    for (const title of ['다리', '날개', '꼬리', '입', '등', '피부']) expect(html).toContain(`>${title}</button>`)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain(bySlot(entries).legs.label)
  })
})
