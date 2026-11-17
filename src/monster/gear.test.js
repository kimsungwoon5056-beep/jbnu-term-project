import { describe, expect, it } from 'vitest'
import { addDays } from '../records/dateKey'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { computeMetrics } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { chooseGear, phoneStatus } from './gear'
import { buildGenome } from './genome'
import { speciesName } from './naming'
import { explainParts } from './partReasons'
import { buildLoadout } from './skills'

const END = '2026-11-15'
const week = (makeDay) => Array.from({ length: 7 }, (_, i) => ({ ...createEmptyRecord(addDays(END, -i)), ...makeDay(i) }))
const categories = (changes) => ({ ...createEmptyPhone().categories, ...changes })
const phoneWeek = (phone, steps = null) => week(() => ({ phone: { ...createEmptyPhone(), ...phone }, steps }))
const gearOf = (records) => {
  const { metrics, details } = computeMetrics(records, END)
  return chooseGear(metrics, details.known).kind
}
const monsterOf = (records) => {
  const { metrics, details } = computeMetrics(records, END)
  const genome = buildGenome('gear-test', metrics, details, growthOf(30))
  return { genome, metrics, details }
}

describe('장비: 가장 많이 쓴 앱 종류가 눈에 보인다', () => {
  it('종류별로 다른 장비', () => {
    const heavy = (key) => phoneWeek({ total: 300, categories: categories({ [key]: 200 }) })
    expect(gearOf(heavy('sns'))).toBe('heartPhone')
    expect(gearOf(heavy('video'))).toBe('headphones')
    expect(gearOf(heavy('game'))).toBe('gamepad')
    expect(gearOf(heavy('study'))).toBe('glasses')
    expect(gearOf(heavy('creative'))).toBe('camera')
    expect(gearOf(heavy('shopping'))).toBe('shoppingBag')
  })

  it('고르게 쓰면 그냥 폰, 적게 쓰면 빈손, 적게 쓰고 많이 걸으면 운동화', () => {
    expect(gearOf(phoneWeek({ total: 300, categories: categories({ sns: 60, video: 60, game: 60, study: 60 }) }))).toBe('phone')
    expect(gearOf(phoneWeek({ total: 60, categories: categories({ sns: 60 }) }))).toBe('none')
    expect(gearOf(phoneWeek({ total: 60, categories: categories({ sns: 60 }) }, 11000))).toBe('sneakers')
    expect(gearOf(week(() => ({})))).toBe('none') // 기록하지 않으면 판단하지 않음
  })

  it('사용자 캡처와 같은 하루(소셜 4시간 20분/총 5시간 35분): 하트 폰, 알림 배지, 이름에 "하트폰"', () => {
    const records = phoneWeek(
      {
        total: 335,
        categories: categories({ sns: 260, video: 45, study: 6 }),
        topApps: [
          { name: 'Instagram', minutes: 158 },
          { name: '카카오톡', minutes: 77 },
          { name: 'YouTube', minutes: 45 },
        ],
        pickups: 60,
        firstPickup: '00:03',
        notifications: 131,
      },
      38,
    )
    const { genome, metrics, details } = monsterOf(records)
    expect(genome.life.gear.kind).toBe('heartPhone')
    expect(genome.life.status.badge).toBe(1)
    expect(speciesName(genome, metrics)).toContain('하트폰')
    const gearEntry = explainParts(genome, metrics, details).find((entry) => entry.key === 'gear')
    expect(gearEntry.label).toBe('하트 폰')
    expect(gearEntry.reason).toContain('Instagram')
    expect(gearEntry.reason).toContain('카카오톡')
    expect(gearEntry.reason).not.toContain('YouTube') // 영상 앱은 소셜 장비의 근거가 아니다
    expect(buildLoadout(genome.life).gear.name).toBe('무한 스크롤')
  })

  it('시연 인물: 새벽 코더는 하트 폰, 주말 몰아치기는 헤드폰, 아침 러너는 운동화', () => {
    expect(gearOf(nightCoder(END))).toBe('heartPhone')
    expect(gearOf(weekendRusher(END))).toBe('headphones')
    expect(gearOf(morningRunner(END))).toBe('sneakers')
  })

  it('상태 표시: 알림·화면 깨우기·화면 시간이 많을수록, 폰 기록이 없으면 없음', () => {
    expect(phoneStatus({ notifications: 0.7, pickups: 0.5, phoneTotal: 0.7 }, { phone: true })).toEqual({ badge: 2, jitter: true, slouch: 2 })
    expect(phoneStatus({ notifications: 0.3, pickups: 0.1, phoneTotal: 0.4 }, { phone: true })).toEqual({ badge: 1, jitter: false, slouch: 1 })
    expect(phoneStatus({ notifications: 1, pickups: 1, phoneTotal: 1 }, { phone: false })).toEqual({ badge: 0, jitter: false, slouch: 0 })
  })
})
