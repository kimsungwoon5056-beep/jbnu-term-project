import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../stats/metrics'
import { addDays } from './dateKey'
import { createEmptyPhone, createEmptyRecord, validatePhone, validateRecord } from './record'
import { fromRecordDoc, toRecordDoc } from './recordDoc'

const END = '2026-11-17'
const phoneOf = (changes) => ({ ...createEmptyPhone(), ...changes })
// 사용자 캡처와 비슷한 하루(숫자는 예시)
const heavy = phoneOf({
  total: 335,
  categories: { ...createEmptyPhone().categories, sns: 260, video: 45, study: 6 },
  topApps: [
    { name: 'Instagram', minutes: 158 },
    { name: '카카오톡', minutes: 77 },
  ],
  pickups: 60,
  firstPickup: '00:03',
  pickupApps: [{ name: '카카오톡', count: 18 }],
  notifications: 131,
  notifyApps: [{ name: '카카오톡', count: 100 }],
})

describe('스마트폰·걸음 기록 검사', () => {
  it('정상 값은 통과한다', () => {
    expect(validateRecord({ ...createEmptyRecord(END), phone: heavy, steps: 38 })).toEqual({})
  })

  it('범위를 벗어난 값과 종류 합이 총 시간보다 긴 경우를 거절한다', () => {
    expect(validatePhone(phoneOf({ total: 1441 }))).toBeTruthy()
    expect(validatePhone(phoneOf({ total: 60, categories: { ...createEmptyPhone().categories, sns: 70 } }))).toContain('합')
    expect(validatePhone(phoneOf({ total: 60, categories: { ...createEmptyPhone().categories, sns: 64 } }))).toBeNull()
    expect(validatePhone(phoneOf({ pickups: -1 }))).toBeTruthy()
    expect(validatePhone(phoneOf({ notifications: 3001 }))).toBeTruthy()
    expect(validatePhone(phoneOf({ firstPickup: '25:00' }))).toBeTruthy()
    expect(validatePhone(phoneOf({ topApps: [{ name: '', minutes: 3 }] }))).toBeTruthy()
    const four = Array.from({ length: 4 }, (_, i) => ({ name: `앱${i}`, count: 1 }))
    expect(validatePhone(phoneOf({ notifyApps: four }))).toBeTruthy()
    expect(validateRecord({ ...createEmptyRecord(END), steps: 100001 }).steps).toBeDefined()
    expect(validateRecord({ ...createEmptyRecord(END), steps: 1.5 }).steps).toBeDefined()
  })

  it('저장 문서로 바꿨다 되돌려도 같고, 예전 문서는 null로 읽는다', () => {
    const record = { ...createEmptyRecord(END), phone: heavy, steps: 38 }
    const doc = toRecordDoc(record)
    expect(doc.phone.firstPickup).toBe('00:03')
    expect(fromRecordDoc(END, doc)).toEqual(record)
    expect(toRecordDoc({ ...record, phone: phoneOf({}) }).phone.firstPickup).toBeNull()
    const old = toRecordDoc(createEmptyRecord(END))
    delete old.phone
    delete old.steps
    expect(fromRecordDoc(END, old).phone).toBeNull()
    expect(fromRecordDoc(END, old).steps).toBeNull()
  })

})

describe('스마트폰·걸음 지표', () => {
  const week = (makeDay) => Array.from({ length: 7 }, (_, i) => ({ ...createEmptyRecord(addDays(END, -i)), ...makeDay(i) }))

  it('입력하지 않으면 0이고 "모름"으로 표시한다', () => {
    const { metrics, details } = computeMetrics(week(() => ({})), END)
    expect(metrics.phoneTotal).toBe(0)
    expect(metrics.steps).toBe(0)
    expect(details.known).toEqual({ phone: false, steps: false })
  })

  it('입력한 날만으로 평균한다(입력 안 한 날을 0으로 세지 않음)', () => {
    const records = week((i) => (i === 0 ? { phone: phoneOf({ total: 420 }), steps: 12000 } : {}))
    const { metrics, details } = computeMetrics(records, END)
    expect(metrics.phoneTotal).toBe(1)
    expect(metrics.steps).toBe(1)
    expect(details.known).toEqual({ phone: true, steps: true })
    expect(details.raw.phoneTotal).toBe(420)
    expect(details.raw.phoneDays).toBe(1)
  })

  it('사용자 캡처와 비슷한 하루: 소셜 비율이 높고 밤 폰, 입력값 그대로의 숫자를 남긴다', () => {
    const { metrics, details } = computeMetrics(week(() => ({ phone: heavy, steps: 38 })), END)
    expect(metrics.snsShare).toBeCloseTo(260 / 335)
    expect(metrics.lateNightPhone).toBe(1)
    expect(metrics.pickups).toBeCloseTo(0.25)
    expect(metrics.notifications).toBeCloseTo((131 - 50) / 250)
    expect(metrics.steps).toBe(0)
    expect(details.raw.pickups).toBe(60)
    expect(details.raw.nightPickupDays).toBe(7)
    expect(details.raw.notifyApps[0]).toEqual({ name: '카카오톡', count: 700 })
    expect(details.raw.topApps.map((app) => app.name)).toEqual(['Instagram', '카카오톡'])
    expect(details.raw.steps).toBe(38)
  })
})
