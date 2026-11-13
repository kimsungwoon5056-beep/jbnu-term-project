import { describe, expect, it } from 'vitest'
import { computeMetrics, METRIC_LABELS } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { chooseAnatomy, PART_FAMILIES } from './anatomy'
import { buildGenome } from './genome'
import { seededRandom } from './random'
import { buildLoadout, HORN_SKILLS, PART_SKILLS, SKILLS } from './skills'

const END = '2026-11-15'
const lifeOf = (records, uid = 'skill-test') => {
  const { metrics, details } = computeMetrics(records, END)
  return buildGenome(uid, metrics, details, growthOf(30)).life
}

describe('기술 사전', () => {
  it('모든 부위 계열에 기술이 정해져 있고 수치가 범위 안이다', () => {
    for (const [slot, families] of Object.entries(PART_FAMILIES)) {
      for (const family of Object.keys(families)) {
        expect(PART_SKILLS[slot]).toHaveProperty(family)
        const id = PART_SKILLS[slot][family]
        if (id) expect(SKILLS[id]).toBeDefined()
      }
    }
    for (const id of Object.values(HORN_SKILLS)) expect(SKILLS[id]).toBeDefined()
    for (const skill of Object.values(SKILLS)) {
      expect(skill.damage).toBeGreaterThanOrEqual(0)
      expect(skill.damage).toBeLessThanOrEqual(30)
      expect(skill.cooldown).toBeGreaterThanOrEqual(0)
      expect(skill.cooldown).toBeLessThanOrEqual(15)
      expect(skill.range).toBeGreaterThanOrEqual(0)
      expect(skill.range).toBeLessThanOrEqual(400)
      expect(skill.desc.length).toBeGreaterThan(0)
    }
  })
})

describe('buildLoadout', () => {
  it('Q·E·보조 기술이 서로 겹치지 않는다', () => {
    for (const records of [nightCoder(END), morningRunner(END), weekendRusher(END)]) {
      const loadout = buildLoadout(lifeOf(records))
      const ids = [loadout.q, loadout.e, loadout.assist].filter(Boolean).map((skill) => skill.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(loadout.q).not.toBeNull()
      expect(loadout.e).not.toBeNull()
    }
  })

  it('가장 두드러진 부위의 기술이 Q가 된다', () => {
    const life = lifeOf(nightCoder(END))
    const loadout = buildLoadout(life)
    const strongest = ['wings', 'tail', 'legs', 'jaw'].sort((a, b) => life.anatomy[b].strength - life.anatomy[a].strength)[0]
    expect(loadout.q.from).toBe(strongest)
  })

  it('같은 테마 2개면 반쪽, 3개면 완전한 세트 효과', () => {
    const base = lifeOf(morningRunner(END))
    const half = buildLoadout({
      ...base,
      anatomy: { ...base.anatomy, wings: { kind: 'dragon', strength: 1 }, tail: { kind: 'dragon', strength: 1 }, jaw: { kind: 'plain', strength: 0 } },
    })
    expect(half.sets.find((set) => set.theme === 'dragon')).toMatchObject({ level: 1, name: '반쪽 용' })
    const full = buildLoadout({
      ...base,
      anatomy: { ...base.anatomy, wings: { kind: 'dragon', strength: 1 }, tail: { kind: 'dragon', strength: 1 }, jaw: { kind: 'snout', strength: 1 } },
    })
    expect(full.sets[0]).toMatchObject({ theme: 'dragon', level: 2, name: '완전한 용' })
  })

  it('계정 500개에서 기술 구성이 다양하다', () => {
    const pairs = new Set()
    const full = new Set()
    for (let seed = 1; seed <= 500; seed += 1) {
      const random = seededRandom(seed)
      const metrics = Object.fromEntries(Object.keys(METRIC_LABELS).map((key) => [key, random()]))
      const details = { workouts: random() < 0.25 ? { swimming: random() * 300 } : {}, subjects: {}, habits: [], streakDays: 0 }
      const anatomy = chooseAnatomy(`user-${seed}`, metrics, details)
      const kinds = ['code', 'prism', 'bubble', 'flask', 'brush', 'poly']
      const horns = random() < 0.7 ? [{ kind: kinds[Math.floor(random() * kinds.length)] }] : []
      const loadout = buildLoadout({ anatomy, horns })
      pairs.add(`${loadout.q?.id}/${loadout.e?.id}`)
      full.add([loadout.q?.id, loadout.e?.id, loadout.passive?.id, loadout.trait?.id, loadout.assist?.id, ...loadout.sets.map((s) => s.name)].join('/'))
    }
    expect(pairs.size).toBeGreaterThan(80)
    expect(full.size).toBeGreaterThan(400)
  })
})
