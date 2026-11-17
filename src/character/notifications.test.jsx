import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { computeMetrics, computeTodayMetrics } from '../stats/metrics'
import { morningRunner, nightCoder } from '../stats/personas'
import { usageSegments } from '../stats/usage'
import { drawCharacter } from './drawCharacter'
import LockNotices from './LockNotices'
import { lockNotices } from './notifications'
import { explainParts } from './reasons'
import { characterState } from './state'

const END = '2026-11-17'
// 사용자가 보내 준 아이폰 캡처와 같은 하루(character.test.js와 같은 숫자)
const USER_DAY = {
  ...createEmptyPhone(),
  total: 335,
  categories: { ...createEmptyPhone().categories, sns: 260, video: 45, study: 6 },
  topApps: [
    { name: 'Instagram', minutes: 158 },
    { name: '카카오톡', minutes: 77 },
    { name: 'YouTube', minutes: 45 },
  ],
  pickups: 60,
  firstPickup: '00:03',
  notifications: 131,
  notifyApps: [{ name: '카카오톡', count: 100 }],
}
const noticesOf = (records) => {
  const { metrics, details, hasRecord } = computeTodayMetrics(records, END)
  const state = characterState(metrics, details, { hasRecord })
  return { state, details, notices: lockNotices(explainParts(state, details, DEFAULT_LOOK), state, details) }
}

describe('잠금 화면 알림(부위 설명)', () => {
  const day = noticesOf([{ ...createEmptyRecord(END), phone: USER_DAY, steps: 38 }])
  const byKey = Object.fromEntries(day.notices.map((notice) => [notice.key, notice]))

  it('많이 쓴 앱이 보낸 알림처럼 "앱 · 시간 — 바뀐 부위"', () => {
    expect(byKey.hair).toMatchObject({ headline: 'Instagram · 2시간 38분', effect: '머리에 스며들었어요', icon: { dot: 'instagram' } })
    expect(byKey.outfit).toMatchObject({ headline: '카카오톡 · 1시간 17분', effect: '후드티가 됐어요' })
    expect(byKey.hand).toMatchObject({ headline: 'YouTube · 45분', effect: '손에 폰이 들렸어요' })
    expect(byKey.badge).toMatchObject({ headline: '알림 131개', effect: '머리 위 배지 1개' })
    expect(byKey.shoes).toMatchObject({ headline: '걸음 38보', effect: '슬리퍼' })
    expect(byKey.undereye.headline).toBe('밤 폰 00:03에 깨움')
  })

  it('처음 보여 줄 부위가 맨 위, 바뀐 부위가 그다음, 그대로인 부위는 뒤(부위 설명 순서 유지)', () => {
    // 얼굴·배경은 눈과 같은 "디지털 건강 · N%"라 뒤로 간다.
    expect(day.notices.map((notice) => notice.key)).toEqual(['hair', 'outfit', 'hand', 'eyes', 'undereye', 'posture', 'badge', 'shoes', 'face', 'scene'])
    const runner = noticesOf(morningRunner(END))
    const keys = runner.notices.map((notice) => notice.key)
    expect(keys[0]).toBe('shoes') // 운동화
    const quietFrom = Math.min(...['hair', 'outfit', 'hand'].map((key) => keys.indexOf(key)))
    expect(runner.notices.slice(0, quietFrom).every((notice) => notice.loud)).toBe(true)
  })

  it('처음 보이는 알림끼리는 제목이 겹치지 않는다', () => {
    for (const { notices } of [day, noticesOf(morningRunner(END)), noticesOf(nightCoder(END))]) {
      const top = notices.slice(0, 3).map((notice) => notice.headline)
      expect(new Set(top).size).toBe(3)
    }
  })

  it('펼치면 부위 설명의 이유와 다음 목표를 그대로 쓴다', () => {
    expect(byKey.hair.reason).toContain('Instagram 오늘 2시간 38분')
    expect(byKey.hand.next.when).toContain('5시간')
    expect(byKey.hair.highlight).toBe('hair')
    expect(byKey.posture.highlight).toEqual(['hair', 'face', 'eyes'])
  })

  it('새 계정: 숫자 대신 "기록 없음"·"?%", 바뀐 부위가 없다', () => {
    const empty = noticesOf([])
    expect(empty.notices.every((notice) => !notice.loud)).toBe(true)
    const text = empty.notices.map((notice) => `${notice.headline} ${notice.effect}`).join(' ')
    expect(text).toContain('?%')
    expect(text).not.toMatch(/\d+%/)
    expect(empty.notices.find((notice) => notice.key === 'shoes').headline).toBe('걸음 기록 없음')
  })

  it('카드: 처음 3장만 보이고, 누른 알림만 펼쳐진다', () => {
    const html = renderToString(<LockNotices notices={day.notices} openKey="hand" onToggle={() => {}} />)
    expect(html.match(/class="notice-card"/g)).toHaveLength(3)
    expect(html).toContain('알림 7개 더 보기')
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1)
    expect(html).toContain('5시간')
    // 접힌 알림을 고르면(그림을 눌러서) 그 한 장만 덧붙이고 나머지는 접어 둔다.
    const folded = renderToString(<LockNotices notices={day.notices} openKey="shoes" onToggle={() => {}} />)
    expect(folded.match(/class="notice-card"/g)).toHaveLength(4)
    expect(folded).toContain('걸음 38보')
    expect(folded).toContain('알림 6개 더 보기')
  })
})

describe('스크린 타임 앱 막대', () => {
  it('많이 쓴 앱 3개 + 기타 = 화면 시간', () => {
    const { details } = noticesOf([{ ...createEmptyRecord(END), phone: USER_DAY }])
    const segments = usageSegments(details.raw)
    expect(segments.map((segment) => segment.name)).toEqual(['Instagram', '카카오톡', 'YouTube', '기타'])
    expect(segments.reduce((total, segment) => total + segment.minutes, 0)).toBe(335)
  })

  it('여러 날 평균이면 앱 시간도 하루 평균(머리 알림과 같은 숫자)', () => {
    const { metrics, details } = computeMetrics(nightCoder(END), END)
    const state = characterState(metrics, details, { hasRecord: true })
    expect(details.raw.phoneDays).toBeGreaterThan(1)
    const segments = usageSegments(details.raw)
    const single = state.grafts.filter((graft) => graft.apps.length === 1)
    const matched = single.filter((graft) => segments.some((segment) => segment.name === graft.apps[0]))
    expect(matched.length).toBeGreaterThan(0)
    for (const graft of matched) expect(segments.find((segment) => segment.name === graft.apps[0]).minutes).toBe(graft.minutes)
  })
})

describe('캐릭터 움직임 칸', () => {
  it('폰을 들면 화면 칸, 배지는 배지마다 따로(그림 안, 몸 칸과 같은 자리)', () => {
    const { state } = noticesOf([{ ...createEmptyRecord(END), phone: { ...USER_DAY, notifications: 400 } }])
    const sprite = drawCharacter(DEFAULT_LOOK, state)
    const { fx } = sprite.layers
    expect(state.marks.badges).toBe(3)
    expect(fx.screen.length).toBeGreaterThan(10)
    expect(fx.badges).toHaveLength(3)
    const body = new Set(sprite.layers.body.map(([x, y, color]) => `${x},${y},${color}`))
    for (const cells of fx.badges) {
      expect(cells.length).toBeGreaterThan(20)
      for (const [x, y, color] of cells) expect(body.has(`${x},${y},${color}`)).toBe(true)
    }
    // 배지 칸은 모두 parts.badge, 외곽선만 더해진다.
    const badgeParts = new Set(sprite.layers.parts.badge.map(([x, y]) => `${x},${y}`))
    const moving = fx.badges.flat()
    expect(moving.filter(([x, y]) => badgeParts.has(`${x},${y}`))).toHaveLength(badgeParts.size)
    expect(moving.filter(([x, y]) => !badgeParts.has(`${x},${y}`)).every(([, , color]) => color === 'outline')).toBe(true)
  })

  it('폰·배지가 없으면 움직임 칸도 없다', () => {
    const { state } = noticesOf(morningRunner(END))
    const { fx } = drawCharacter(DEFAULT_LOOK, state).layers
    expect(fx).toEqual({ screen: [], badges: [] })
  })
})
