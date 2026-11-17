import { describe, expect, it } from 'vitest'
import { createEmptyPhone, createEmptyRecord } from './record'
import { firestoreErrorMessage, fromRecordDoc, planDelete, planSave, toRecordDoc } from './recordDoc'

const today = '2026-11-14'
const sample = {
  ...createEmptyRecord(today),
  phone: { ...createEmptyPhone(), total: 200, topApps: [{ name: ' Instagram ', minutes: 120 }], firstPickup: '07:10' },
  steps: 5400,
}

describe('toRecordDoc / fromRecordDoc', () => {
  it('저장할 필드(날짜·스마트폰·걸음)만 남기고 앱 이름 공백을 지운다', () => {
    const doc = toRecordDoc({ ...sample, extra: 'x' })
    expect(Object.keys(doc).sort()).toEqual(['date', 'phone', 'steps'])
    expect(doc.phone.topApps[0].name).toBe('Instagram')
  })

  it('저장했다 불러오면 같은 기록이 된다', () => {
    const doc = toRecordDoc(sample)
    const back = fromRecordDoc(today, { ...doc, updatedAt: 'server-time' })
    expect(toRecordDoc(back)).toEqual(doc)
  })

  it('예전 기록의 수면·운동·기분 필드는 읽지 않는다', () => {
    const record = fromRecordDoc(today, { sleep: { bedTime: '23:00', wakeTime: '07:00' }, mood: 5, steps: 3000 })
    expect(record).toEqual({ ...createEmptyRecord(today), steps: 3000 })
  })
})

describe('planSave', () => {
  it('없는 기록은 새 등록, 있는 기록은 수정', () => {
    expect(planSave({ record: sample, exists: false, todayKey: today })).toEqual({ ok: true, action: 'create' })
    expect(planSave({ record: sample, exists: true, todayKey: today })).toEqual({ ok: true, action: 'update' })
  })

  it('값이 잘못되면 항목별 오류를 돌려준다', () => {
    const result = planSave({ record: { ...sample, steps: -5 }, exists: false, todayKey: today })
    expect(result.ok).toBe(false)
    expect(result.errors.steps).toBeDefined()
  })

  it('3일 전 새 기록은 거절하고, 3일 전 기록 수정은 허용한다', () => {
    const old = { ...sample, date: '2026-11-11' }
    expect(planSave({ record: old, exists: false, todayKey: today }).message).toBe(
      '새 기록은 오늘과 어제 날짜만 등록할 수 있습니다.',
    )
    expect(planSave({ record: old, exists: true, todayKey: today }).ok).toBe(true)
  })
})

describe('planDelete', () => {
  it('7일 이내만 삭제할 수 있다', () => {
    expect(planDelete({ dateKey: '2026-11-07', todayKey: today }).ok).toBe(true)
    expect(planDelete({ dateKey: '2026-11-06', todayKey: today }).message).toBe('7일이 지난 기록은 바꿀 수 없습니다.')
  })
})

describe('firestoreErrorMessage', () => {
  it('권한 오류와 모르는 오류를 안내한다', () => {
    expect(firestoreErrorMessage('permission-denied')).toContain('권한')
    expect(firestoreErrorMessage('something-else')).toBe('기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })
})
