import { describe, expect, it } from 'vitest'
import { appIconOf, archetypeOfApp } from '../capture/appArchetypes'
import { addDays } from '../records/dateKey'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { computeMetrics } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { chooseGrafts, graftCount } from './appGrafts'
import { chooseGear, phoneStatus } from './gear'
import { buildGenome } from './genome'
import { speciesName } from './naming'
import { explainParts } from './partReasons'
import { buildLoadout } from './skills'

const END = '2026-11-15'
const week = (makeDay) => Array.from({ length: 7 }, (_, i) => ({ ...createEmptyRecord(addDays(END, -i)), ...makeDay(i) }))
const categories = (changes) => ({ ...createEmptyPhone().categories, ...changes })
const phoneWeek = (phone, steps = null) => week(() => ({ phone: { ...createEmptyPhone(), ...phone }, steps }))
const graftsOf = (records) => chooseGrafts(computeMetrics(records, END).details)
const monsterOf = (records) => {
  const { metrics, details } = computeMetrics(records, END)
  return { genome: buildGenome('graft-test', metrics, details, growthOf(30)), metrics, details }
}
const summary = (grafts) => grafts.map((graft) => `${graft.slot}:${graft.icon ?? graft.archetype}`)

// 사용자가 보내 준 아이폰 캡처와 같은 하루
const USER_DAY = {
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
}

describe('앱 이름 → 유형·아이콘', () => {
  it('대표 앱은 유형과 전용 아이콘이 있다', () => {
    expect(archetypeOfApp('카카오톡')).toBe('messenger')
    expect(archetypeOfApp('Instagram')).toBe('feed')
    expect(archetypeOfApp('You Tube')).toBe('video')
    expect(archetypeOfApp('멜론')).toBe('music')
    expect(archetypeOfApp('브롤스타즈')).toBe('game')
    expect(archetypeOfApp('네이버웹툰')).toBe('webtoon')
    expect(archetypeOfApp('배달의민족')).toBe('shopping')
    expect(archetypeOfApp('토스')).toBe('finance')
    expect(archetypeOfApp('Claude')).toBe('study')
    expect(appIconOf('카카오톡')).toBe('kakaotalk')
    expect(appIconOf('Netflix')).toBe('netflix')
    expect(appIconOf('멜론')).toBeNull()
    expect(archetypeOfApp('처음 보는 앱')).toBeNull()
  })
})

describe('앱 조각: 많이 쓴 앱이 몸이 된다', () => {
  it('하루 화면 시간으로 조각 개수가 정해진다(89분 0개, 90분 1개, 180분 2개, 300분 3개)', () => {
    expect([89, 90, 179, 180, 299, 300, 600].map(graftCount)).toEqual([0, 1, 1, 2, 2, 3, 3])
    const apps = [
      { name: '카카오톡', minutes: 50 },
      { name: '유튜브', minutes: 30 },
      { name: '토스', minutes: 10 },
    ]
    expect(graftsOf(phoneWeek({ total: 89, topApps: apps }))).toEqual([])
    expect(graftsOf(phoneWeek({ total: 90, topApps: apps }))).toHaveLength(1)
    expect(graftsOf(phoneWeek({ total: 180, topApps: apps }))).toHaveLength(2)
    expect(graftsOf(phoneWeek({ total: 300, topApps: apps }))).toHaveLength(3)
  })

  it('1위 앱이 머리(전용 아이콘), 2위 눈, 3위 몸통. 같은 유형은 하나로 묶는다', () => {
    const grafts = graftsOf(
      phoneWeek({
        total: 400,
        topApps: [
          { name: '카카오톡', minutes: 120 },
          { name: '디스코드', minutes: 100 },
          { name: '넷플릭스', minutes: 90 },
        ],
        categories: categories({ sns: 220, video: 90, shopping: 40 }),
      }),
    )
    expect(summary(grafts)).toEqual(['head:kakaotalk', 'eyes:video', 'torso:shopping'])
    expect(grafts[0].apps).toEqual(['카카오톡', '디스코드'])
    expect(grafts[0].minutes).toBe(220)
  })

  it('앱 목록 없이 숫자만 넣으면 종류별 시간 순서로 정한다', () => {
    const grafts = graftsOf(phoneWeek({ total: 320, categories: categories({ game: 150, video: 100, sns: 60 }) }))
    expect(summary(grafts)).toEqual(['head:game', 'eyes:video', 'torso:feed'])
  })

  it('스마트폰을 입력하지 않으면 조각이 없다', () => {
    expect(graftsOf(week(() => ({})))).toEqual([])
  })

  it('사용자 캡처와 같은 하루: 인스타 머리·메신저 눈·영상 몸통, 이름·설명·기술에 드러난다', () => {
    const { genome, metrics, details } = monsterOf(phoneWeek(USER_DAY, 38))
    expect(summary(genome.life.grafts)).toEqual(['head:instagram', 'eyes:messenger', 'torso:video'])
    expect(speciesName(genome, metrics)).toContain('인스타머리')
    const entries = explainParts(genome, metrics, details)
    const head = entries.find((entry) => entry.key === 'graftHead')
    expect(head.label).toBe('인스타')
    expect(head.reason).toContain('Instagram 하루 2시간 38분')
    const torso = entries.find((entry) => entry.key === 'graftTorso')
    expect(torso.next.when).toContain('5시간')
    expect(buildLoadout(genome.life).app.name).toBe('무한 스크롤')
  })

  it('시연 인물: 새벽 코더 3조각, 주말 몰아치기 2조각(유튜브 머리), 아침 러너 0조각 + 운동화', () => {
    expect(summary(monsterOf(nightCoder(END)).genome.life.grafts)).toEqual(['head:instagram', 'eyes:game', 'torso:messenger'])
    expect(summary(monsterOf(weekendRusher(END)).genome.life.grafts)).toEqual(['head:youtube', 'eyes:feed'])
    const runner = monsterOf(morningRunner(END))
    expect(runner.genome.life.grafts).toEqual([])
    expect(runner.genome.life.gear.kind).toBe('sneakers')
    const entry = explainParts(runner.genome, runner.metrics, runner.details).find((e) => e.key === 'graftHead')
    expect(entry.reason).toContain('원래 모습')
  })
})

describe('장비·상태 표시', () => {
  it('많이 걸으면 운동화, 아니면 없음', () => {
    expect(chooseGear({ steps: 0.7 }, { steps: true }).kind).toBe('sneakers')
    expect(chooseGear({ steps: 0.3 }, { steps: true }).kind).toBe('none')
    expect(chooseGear({ steps: 1 }, { steps: false }).kind).toBe('none')
  })

  it('알림·화면 깨우기·화면 시간이 많을수록 표시가 붙고, 폰 기록이 없으면 없음', () => {
    expect(phoneStatus({ notifications: 0.7, pickups: 0.5, phoneTotal: 0.7 }, { phone: true })).toEqual({ badge: 2, jitter: true, slouch: 2 })
    expect(phoneStatus({ notifications: 0.3, pickups: 0.1, phoneTotal: 0.4 }, { phone: true })).toEqual({ badge: 1, jitter: false, slouch: 1 })
    expect(phoneStatus({ notifications: 1, pickups: 1, phoneTotal: 1 }, { phone: false })).toEqual({ badge: 0, jitter: false, slouch: 0 })
  })
})
