import { describe, expect, it } from 'vitest'
import { appIconOf, archetypeOfApp } from '../capture/appArchetypes'
import { addDays } from '../records/dateKey'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { computeMetrics, computeTodayMetrics } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { chooseGrafts, graftCount } from './appGrafts'

const END = '2026-11-15'
const week = (makeDay) => Array.from({ length: 7 }, (_, i) => ({ ...createEmptyRecord(addDays(END, -i)), ...makeDay(i) }))
const categories = (changes) => ({ ...createEmptyPhone().categories, ...changes })
const phoneWeek = (phone, steps = null) => week(() => ({ phone: { ...createEmptyPhone(), ...phone }, steps }))
const graftsOf = (records) => chooseGrafts(computeMetrics(records, END).details)
const todayGrafts = (records) => chooseGrafts(computeTodayMetrics(records, END).details)
const summary = (grafts) => grafts.map((graft) => `${graft.slot}:${graft.icon ?? graft.archetype}`)

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

describe('앱 조각: 많이 쓴 앱이 머리·옷·손에 스며든다', () => {
  it('하루 화면 시간으로 개수가 정해진다(89분 0개, 90분 1개, 180분 2개, 300분 3개)', () => {
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

  it('1위 앱이 머리, 2위 옷, 3위 손. 같은 유형은 하나로 묶고, 아이콘은 모든 자리에 쓴다', () => {
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
    expect(summary(grafts)).toEqual(['hair:kakaotalk', 'outfit:netflix', 'hand:shopping'])
    expect(grafts[0].apps).toEqual(['카카오톡', '디스코드'])
    expect(grafts[0].minutes).toBe(220)
  })

  it('앱 목록 없이 숫자만 넣으면 종류별 시간 순서로 정한다', () => {
    const grafts = graftsOf(phoneWeek({ total: 320, categories: categories({ game: 150, video: 100, sns: 60 }) }))
    expect(summary(grafts)).toEqual(['hair:game', 'outfit:video', 'hand:feed'])
  })

  it('스마트폰을 입력하지 않으면 조각이 없다', () => {
    expect(graftsOf(week(() => ({ steps: 3000 })))).toEqual([])
  })

  it('시연 인물(오늘 하루): 새벽 게이머 3개, 유튜브 정주행 2개(유튜브 머리), 아침 러너 0개', () => {
    expect(summary(todayGrafts(nightCoder(END)))).toEqual(['hair:instagram', 'outfit:game', 'hand:discord'])
    expect(summary(todayGrafts(weekendRusher(END)))).toEqual(['hair:youtube', 'outfit:kakaotalk', 'hand:coupang'])
    expect(todayGrafts(morningRunner(END))).toEqual([])
  })
})
