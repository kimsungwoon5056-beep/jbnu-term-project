import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { BODY_TYPES, buildGenome, hornFor, innateGenes } from './genome'
import { speciesName } from './naming'

const END = '2026-11-15'
const ADULT = growthOf(30)
const genomeOf = (records, uid = 'demo-user', growth = ADULT) => {
  const { metrics, details } = computeMetrics(records, END)
  return { genome: buildGenome(uid, metrics, details, growth), metrics }
}

describe('innateGenes', () => {
  it('같은 uid면 같고, uid가 다르면 대부분 다르다', () => {
    expect(innateGenes('abc')).toEqual(innateGenes('abc'))
    const many = Array.from({ length: 200 }, (_, i) => innateGenes(`user-${i}`))
    const bodyCounts = Object.keys(BODY_TYPES).map((type) => many.filter((g) => g.bodyType === type).length)
    // 몸통 8종이 모두 나오고 한쪽으로 크게 쏠리지 않는다(기대값 25).
    for (const count of bodyCounts) {
      expect(count).toBeGreaterThan(10)
      expect(count).toBeLessThan(45)
    }
    expect(new Set(many.map((g) => g.hue)).size).toBeGreaterThan(120)
  })
})

describe('buildGenome', () => {
  it('같은 uid·기록이면 같은 유전자가 나온다', () => {
    expect(genomeOf(nightCoder(END)).genome).toEqual(genomeOf(nightCoder(END)).genome)
  })

  it('모든 수치가 설계 범위 안에 있다', () => {
    for (const records of [nightCoder(END), morningRunner(END), weekendRusher(END), []]) {
      const { life } = genomeOf(records).genome
      expect(life.bodyRadius).toBeGreaterThanOrEqual(40)
      expect(life.bodyRadius).toBeLessThanOrEqual(70)
      expect(life.legLength).toBeGreaterThanOrEqual(0)
      expect(life.legLength).toBeLessThanOrEqual(36)
      expect(life.armWidth).toBeGreaterThanOrEqual(4)
      expect(life.armWidth).toBeLessThanOrEqual(18)
      expect(life.eyelid).toBeLessThanOrEqual(0.7)
      expect(life.darkCircle).toBeLessThanOrEqual(0.8)
      expect(life.horns.length).toBeLessThanOrEqual(5)
      expect(life.saturation).toBeGreaterThanOrEqual(60)
      expect(life.saturation).toBeLessThanOrEqual(95)
    }
  })

  it('새벽 코더: 세로 동공, 짙은 다크서클, 코딩 뿔이 가장 길고 배가 볼록하다', () => {
    const { genome, metrics } = genomeOf(nightCoder(END))
    const { life } = genome
    expect(life.pupilSlit).toBeGreaterThan(0.7)
    expect(life.darkCircle).toBeGreaterThan(0.4)
    expect(life.horns.map((horn) => horn.kind)).toEqual(['code', 'prism'])
    expect(life.horns[0].length).toBeGreaterThan(life.horns[1].length)
    expect(life.belly).toBeGreaterThan(0.6)
    const name = speciesName(genome, metrics)
    expect(name).toContain('새벽형')
    expect(name).toMatch(/거미다리|집게턱|박쥐날개|<\/>뿔/)
  })

  it('아침 러너: 다리 4개, 동그라미 꼬리 끝, 말풍선 뿔 1개, 행복한', () => {
    const { genome, metrics } = genomeOf(morningRunner(END))
    expect(genome.life.legCount).toBe(2)
    expect(genome.life.legLength).toBeGreaterThan(16)
    expect(genome.life.tailTip).toBe('round')
    expect(genome.life.horns.map((horn) => horn.kind)).toEqual(['bubble'])
    expect(genome.life.aura).toBe(1)
    expect(speciesName(genome, metrics)).toMatch(/새|네발|깃털날개|부리|행복한/)
  })

  it('주말 몰아치기: 번개 꼬리, 뿔 4개, 굵은 팔(장갑)', () => {
    const { genome, metrics } = genomeOf(weekendRusher(END))
    expect(genome.life.tailTip).toBe('bolt')
    expect(genome.life.horns).toHaveLength(4)
    expect(genome.life.glove).toBe(true)
    expect(speciesName(genome, metrics)).toMatch(/전갈꼬리|용꼬리|번개꼬리/)
  })

  it('달리기를 매일 하면 다리가 4개가 된다', () => {
    const runner = morningRunner(END).map((record) => ({
      ...record,
      workouts: [{ type: 'running', minutes: 60 }],
    }))
    expect(genomeOf(runner).genome.life.legCount).toBe(4)
  })

  it('알 단계에는 생활 유전자가 없고, 새끼는 특징이 약하다', () => {
    const egg = genomeOf(nightCoder(END), 'demo-user', growthOf(0)).genome
    expect(egg.life).toBeNull()
    expect(speciesName(egg, {})).toMatch(/알$/)
    const baby = genomeOf(nightCoder(END), 'demo-user', growthOf(1)).genome
    const adult = genomeOf(nightCoder(END)).genome
    expect(baby.sizeScale).toBeLessThan(adult.sizeScale)
    expect(baby.life.darkCircle).toBeLessThan(adult.life.darkCircle)
  })

  it('사전에 없는 과목은 이름 해시로 다각형 뿔을 만든다', () => {
    expect(hornFor('수학').kind).toBe('prism')
    expect(hornFor('경제학')).toEqual(hornFor('경제학'))
    expect(hornFor('경제학').kind).toBe('poly')
  })
})
