import { describe, expect, it } from 'vitest'
import { createEmptyRecord } from './record'
import {
  copyRecordTo,
  firestoreErrorMessage,
  fromRecordDoc,
  planDelete,
  planSave,
  toRecordDoc,
} from './recordDoc'

const today = '2026-11-14'
const sample = {
  ...createEmptyRecord(today),
  workouts: [{ type: 'running', minutes: 30 }],
  studies: [{ subject: '  수학 ', minutes: 60 }],
  customHabits: [{ name: ' 물 2L ', done: true }],
}

describe('toRecordDoc / fromRecordDoc', () => {
  it('저장할 필드만 남기고 이름 공백을 지운다', () => {
    const doc = toRecordDoc({ ...sample, extra: 'x', workouts: [{ type: 'running', minutes: 30, id: 1 }] })
    expect(doc).not.toHaveProperty('extra')
    expect(doc.workouts).toEqual([{ type: 'running', minutes: 30 }])
    expect(doc.studies[0].subject).toBe('수학')
    expect(doc.customHabits[0].name).toBe('물 2L')
  })

  it('저장했다 불러오면 같은 기록이 된다', () => {
    const doc = toRecordDoc(sample)
    expect(fromRecordDoc(today, { ...doc, updatedAt: 'server-time' })).toEqual(doc)
  })

  it('빠진 필드는 기본값으로 채운다', () => {
    const record = fromRecordDoc(today, { mood: 5 })
    expect(record).toEqual({ ...createEmptyRecord(today), mood: 5 })
  })
})

describe('copyRecordTo', () => {
  it('내용은 그대로, 날짜만 바꾼다', () => {
    const copied = copyRecordTo(sample, '2026-11-15')
    expect(copied.date).toBe('2026-11-15')
    expect(copied.workouts).toEqual(sample.workouts)
    expect(copied.workouts).not.toBe(sample.workouts)
  })
})

describe('planSave', () => {
  it('없는 기록은 새 등록, 있는 기록은 수정', () => {
    expect(planSave({ record: sample, exists: false, todayKey: today })).toEqual({ ok: true, action: 'create' })
    expect(planSave({ record: sample, exists: true, todayKey: today })).toEqual({ ok: true, action: 'update' })
  })

  it('값이 잘못되면 항목별 오류를 돌려준다', () => {
    const result = planSave({ record: { ...sample, mood: 0 }, exists: false, todayKey: today })
    expect(result.ok).toBe(false)
    expect(result.errors.mood).toBe('기분을 골라 주세요.')
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
