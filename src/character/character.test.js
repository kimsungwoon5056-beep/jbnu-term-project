import { describe, expect, it } from 'vitest'
import { APP_ICONS } from '../capture/appArchetypes'
import { DEFAULT_LOOK, LOOK_OPTIONS, normalizeLook, validateNickname, validateProfile } from '../profile/look'
import { addDays } from '../records/dateKey'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import { computeTodayMetrics } from '../stats/metrics'
import { morningRunner, nightCoder } from '../stats/personas'
import { APP_LOOK_KEYS, APP_LOOKS } from './appLook'
import { drawCharacter } from './drawCharacter'
import { explainParts, featuredPart } from './reasons'
import { characterState, MARKS } from './state'

const END = '2026-11-17'
const SIZE = 48
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const stateOf = (changes = {}) => ({ tier: 'mid', grafts: [], scene: 'home', ...changes, marks: { ...CALM, ...changes.marks } })
const graftOf = (slot, key) =>
  APP_ICONS[key] ? { slot, icon: key, archetype: 'feed', apps: [], minutes: 100 } : { slot, icon: null, archetype: key === 'webtoonGeneric' ? 'webtoon' : key, apps: [], minutes: 100 }
const fingerprint = (sprite) => JSON.stringify(sprite.layers.body.map(([x, y, color]) => [x, y, sprite.palette[color] ?? color]))
const inside = (sprite) => sprite.layers.body.every(([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE)

// 사용자가 보내 준 아이폰 캡처와 같은 하루
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
const today = (records) => {
  const result = computeTodayMetrics(records, END)
  return { ...result, state: characterState(result.metrics, result.details, { hasRecord: result.hasRecord }) }
}

describe('나를 닮은 모습(look)', () => {
  it('모르는 값은 기본값으로, 닉네임은 2~10자', () => {
    expect(normalizeLook({ skin: 'tan', hairStyle: '???' })).toEqual({ ...DEFAULT_LOOK, skin: 'tan' })
    expect(validateNickname(' 가 ')).toBeTruthy()
    expect(validateNickname('폰줄이기')).toBeNull()
    expect(validateNickname('가'.repeat(11))).toBeTruthy()
    expect(validateProfile({ nickname: '폰줄이기', look: DEFAULT_LOOK })).toEqual({})
    expect(validateProfile({ nickname: '폰줄이기', look: { ...DEFAULT_LOOK, glasses: 'big' } }).glasses).toBeDefined()
  })

  it('머리 모양·머리색·피부색·안경마다 그림이 다르다', () => {
    for (const [field, { choices }] of Object.entries(LOOK_OPTIONS)) {
      const prints = Object.keys(choices).map((value) => fingerprint(drawCharacter({ ...DEFAULT_LOOK, [field]: value }, stateOf())))
      expect(new Set(prints).size).toBe(prints.length)
    }
  })
})

describe('캐릭터 그리기', () => {
  it('같은 모습 + 같은 사용이면 같은 그림(계정과 상관없음)', () => {
    const a = today([{ ...createEmptyRecord(END), phone: USER_DAY, steps: 38 }])
    const b = today([{ ...createEmptyRecord(END), phone: USER_DAY, steps: 38 }])
    expect(drawCharacter(DEFAULT_LOOK, a.state, { scene: true })).toEqual(drawCharacter(DEFAULT_LOOK, b.state, { scene: true }))
  })

  it('앱 21종이 머리·옷·손 어디에 와도 격자 안에 그려지고 서로 다르다', () => {
    expect(APP_LOOK_KEYS).toHaveLength(21)
    for (const slot of ['hair', 'outfit', 'hand']) {
      const sprites = APP_LOOK_KEYS.map((key) => drawCharacter(DEFAULT_LOOK, stateOf({ grafts: [graftOf(slot, key)] })))
      for (const sprite of sprites) {
        expect(inside(sprite)).toBe(true)
        expect(sprite.layers.parts[slot]?.length).toBeGreaterThan(10)
      }
      expect(new Set(sprites.map(fingerprint)).size).toBe(APP_LOOK_KEYS.length)
    }
  })

  it('앱 로고는 모두 5×5이고 정해진 색만 쓴다', () => {
    for (const look of Object.values(APP_LOOKS)) {
      expect(look.logo).toHaveLength(5)
      for (const row of look.logo) expect(row).toHaveLength(5)
    }
  })

  it('상태 표시마다 그림이 바뀌고, 부위 칸이 기록된다', () => {
    const base = fingerprint(drawCharacter(DEFAULT_LOOK, stateOf()))
    for (const marks of [{ slouch: true }, { spiral: true }, { darkCircles: true }, { glow: true }, { badges: 2 }, { shoes: 'sneakers' }, { shoes: 'slippers' }]) {
      expect(fingerprint(drawCharacter(DEFAULT_LOOK, stateOf({ marks })))).not.toBe(base)
    }
    const sprite = drawCharacter(DEFAULT_LOOK, stateOf({ marks: { badges: 3, darkCircles: true } }), { scene: true })
    for (const key of ['hair', 'face', 'eyes', 'undereye', 'outfit', 'shoes', 'badge', 'scene']) expect(sprite.layers.parts[key]?.length).toBeGreaterThan(0)
  })

  it('건강 단계에 따라 얼굴색이 칙칙해진다(고른 피부색은 그대로 두고 채도만)', () => {
    const skins = ['good', 'mid', 'low'].map((tier) => drawCharacter(DEFAULT_LOOK, stateOf({ tier })).palette.skin)
    expect(new Set(skins).size).toBe(3)
  })
})

describe('사용자 캡처와 같은 하루', () => {
  const day = today([{ ...createEmptyRecord(END), phone: USER_DAY, steps: 38 }])

  it('인스타 머리·카톡 후드티·유튜브 폰, 알림 배지 1개, 다크서클, 거북목, 슬리퍼', () => {
    const { state } = day
    expect(state.grafts.map((graft) => `${graft.slot}:${graft.icon}`)).toEqual(['hair:instagram', 'outfit:kakaotalk', 'hand:youtube'])
    expect(state.marks).toMatchObject({ badges: 1, darkCircles: true, slouch: true, spiral: false, shoes: 'slippers' })
    expect(state.scene).toBe('room')
    expect(state.title).toBe('인스타에 잠긴 나')
  })

  it('부위 설명에 오늘 숫자와 다음 목표가 나온다', () => {
    const entries = explainParts(day.state, day.details, DEFAULT_LOOK)
    const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry]))
    expect(byKey.hair.label).toBe('인스타 물든 머리')
    expect(byKey.hair.reason).toContain('Instagram 오늘 2시간 38분')
    expect(byKey.hand.next.when).toContain('5시간')
    expect(byKey.undereye.reason).toContain('00:03')
    expect(byKey.badge.reason).toContain('카카오톡 100개')
    expect(byKey.shoes.label).toBe('슬리퍼')
    expect(featuredPart(entries, day.state)).toBe('hair')
  })
})

describe('시연 인물', () => {
  it('아침 러너: 앱 조각 없음, 운동화, 공원, 칭호 "폰 내려놓기 고수"', () => {
    const { state } = today(morningRunner(END))
    expect(state.grafts).toEqual([])
    expect(state.marks.shoes).toBe('sneakers')
    expect(state.scene).toBe('park')
    expect(state.title).toBe('폰 내려놓기 고수')
  })

  it('새벽 게이머: 빙글 눈(화면 깨우기 100번 이상), 배지 2개, 화면 빛', () => {
    const { state, details } = today(nightCoder(END))
    expect(details.raw.pickups).toBeGreaterThanOrEqual(MARKS.spiralPickups)
    expect(state.marks).toMatchObject({ spiral: true, badges: 2, glow: true })
  })

  it('기록이 없으면 칭호 "오늘을 기다리는 나", 앱 조각 없음', () => {
    const { state } = today([{ ...createEmptyRecord(addDays(END, -5)), steps: 100 }])
    expect(state.title).toBe('오늘을 기다리는 나')
    expect(state.grafts).toEqual([])
  })
})
