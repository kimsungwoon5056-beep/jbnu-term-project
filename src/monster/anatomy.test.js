import { describe, expect, it } from 'vitest'
import { addDays } from '../records/dateKey'
import { createEmptyRecord } from '../records/record'
import { computeMetrics, METRIC_LABELS } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { chooseAnatomy, PART_FAMILIES, SLOTS, themeCounts } from './anatomy'
import { seededRandom } from './random'

const END = '2026-11-15'
const anatomyOf = (records, uid = 'anatomy-test') => {
  const { metrics, details } = computeMetrics(records, END)
  return chooseAnatomy(uid, metrics, details)
}

// 무작위 생활(같은 시드면 같음)
function randomInput(seed) {
  const random = seededRandom(seed)
  const metrics = Object.fromEntries(Object.keys(METRIC_LABELS).map((key) => [key, random()]))
  const parts = [random(), random(), random()]
  const sum = parts[0] + parts[1] + parts[2]
  ;[metrics.cardio, metrics.power, metrics.flex] = parts.map((part) => part / sum)
  const details = { workouts: random() < 0.25 ? { swimming: random() * 300 } : {}, subjects: {}, habits: [], streakDays: 0 }
  return { metrics, details }
}

describe('chooseAnatomy', () => {
  it('같은 계정·기록이면 같은 부위', () => {
    expect(anatomyOf(nightCoder(END))).toEqual(anatomyOf(nightCoder(END)))
  })

  it('새벽 코더는 밤·공부 계열 부위를 가진다', () => {
    const anatomy = anatomyOf(nightCoder(END))
    const kinds = SLOTS.map((slot) => `${slot}:${anatomy[slot].kind}`)
    expect(kinds.some((kind) => ['legs:spider', 'wings:bat', 'jaw:mandible', 'jaw:fangs'].includes(kind))).toBe(true)
  })

  it('아침 러너는 달리기·아침형 계열 부위를 가진다', () => {
    const anatomy = anatomyOf(morningRunner(END))
    const kinds = SLOTS.map((slot) => `${slot}:${anatomy[slot].kind}`)
    expect(kinds.some((kind) => ['legs:beast', 'legs:bird', 'wings:feather', 'jaw:beak'].includes(kind))).toBe(true)
  })

  it('주말 몰아치기는 근력·한 방 계열 부위를 가진다', () => {
    const anatomy = anatomyOf(weekendRusher(END))
    expect(['dragon', 'stinger', 'bolt']).toContain(anatomy.tail.kind)
  })

  it('수영을 하면 물고기 꼬리나 등지느러미가 생긴다', () => {
    const swimmer = Array.from({ length: 7 }, (_, i) => ({
      ...createEmptyRecord(addDays(END, -i)),
      workouts: [{ type: 'swimming', minutes: 60 }],
    }))
    const anatomy = anatomyOf(swimmer)
    expect(anatomy.tail.kind === 'fish' || anatomy.back.kind === 'sail').toBe(true)
  })

  it('유령·슬라임 하반신에는 꼬리가 없다', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const { metrics, details } = randomInput(seed)
      const anatomy = chooseAnatomy(`u${seed}`, metrics, details)
      if (['ghost', 'slime'].includes(anatomy.legs.kind)) expect(anatomy.tail.kind).toBe('none')
    }
  })

  it('계정 500개에서 자리마다 모든 계열이 한 번 이상 나온다', () => {
    const seen = Object.fromEntries(SLOTS.map((slot) => [slot, new Set()]))
    const combos = new Set()
    for (let seed = 1; seed <= 500; seed += 1) {
      const { metrics, details } = randomInput(seed)
      const anatomy = chooseAnatomy(`user-${seed}`, metrics, details)
      for (const slot of SLOTS) seen[slot].add(anatomy[slot].kind)
      combos.add(SLOTS.map((slot) => anatomy[slot].kind).join('/'))
    }
    for (const slot of SLOTS) expect([...seen[slot]].sort()).toEqual(Object.keys(PART_FAMILIES[slot]).sort())
    expect(combos.size).toBeGreaterThan(250)
  })

  it('특징이 약한 새끼는 기본 계열이 많다', () => {
    const { metrics, details } = computeMetrics(nightCoder(END), END)
    const baby = chooseAnatomy('u', metrics, details, 0.2)
    const adult = chooseAnatomy('u', metrics, details, 1)
    const defaults = (a) => SLOTS.filter((slot) => ['biped', 'none', 'stub', 'plain'].includes(a[slot].kind)).length
    expect(defaults(baby)).toBeGreaterThanOrEqual(defaults(adult))
  })

  it('테마 부위 개수를 센다', () => {
    const anatomy = {
      legs: { kind: 'biped' },
      wings: { kind: 'dragon' },
      tail: { kind: 'dragon' },
      jaw: { kind: 'snout' },
      back: { kind: 'none' },
    }
    expect(themeCounts(anatomy).dragon).toBe(3)
  })
})
