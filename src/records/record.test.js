import { describe, expect, it } from 'vitest'
import { checkDateWindow, createEmptyRecord, sleepMinutes, summarizeRecord, validateRecord } from './record'

const withChanges = (changes) => ({ ...createEmptyRecord('2026-11-13'), ...changes })

describe('sleepMinutes', () => {
  it('자정을 넘겨 잔 시간도 계산한다', () => {
    expect(sleepMinutes('23:30', '07:00')).toBe(450)
    expect(sleepMinutes('02:00', '08:15')).toBe(375)
  })

  it('같은 시각이면 24시간으로 본다', () => {
    expect(sleepMinutes('07:00', '07:00')).toBe(1440)
  })
})

describe('summarizeRecord', () => {
  it('수면·운동·공부 시간을 합친다', () => {
    const record = withChanges({
      workouts: [
        { type: 'running', minutes: 30 },
        { type: 'strength', minutes: 45 },
      ],
      studies: [{ subject: '코딩', minutes: 120 }],
    })
    expect(summarizeRecord(record)).toEqual({ sleepMinutes: 480, exerciseMinutes: 75, studyMinutes: 120 })
  })
})

describe('validateRecord', () => {
  it('빈 기록은 통과한다', () => {
    expect(validateRecord(createEmptyRecord('2026-11-13'))).toEqual({})
  })

  it('수면 16시간 초과와 잘못된 시각을 거절한다', () => {
    expect(validateRecord(withChanges({ sleep: { bedTime: '20:00', wakeTime: '13:00' } })).sleep).toBe(
      '수면 시간은 16시간을 넘을 수 없습니다.',
    )
    expect(validateRecord(withChanges({ sleep: { bedTime: '25:00', wakeTime: '07:00' } })).sleep).toBeDefined()
  })

  it('운동은 종류·시간·하루 합계를 검사한다', () => {
    expect(validateRecord(withChanges({ workouts: [{ type: 'dance', minutes: 30 }] })).workouts).toBe(
      '운동 종류를 선택해 주세요.',
    )
    expect(validateRecord(withChanges({ workouts: [{ type: 'running', minutes: 0 }] })).workouts).toBeDefined()
    expect(
      validateRecord(
        withChanges({
          workouts: [
            { type: 'running', minutes: 400 },
            { type: 'yoga', minutes: 201 },
          ],
        }),
      ).workouts,
    ).toBe('운동은 하루 600분을 넘을 수 없습니다.')
  })

  it('공부는 과목 이름과 하루 합계를 검사한다', () => {
    expect(validateRecord(withChanges({ studies: [{ subject: ' ', minutes: 60 }] })).studies).toBe(
      '과목 이름은 1~20자로 입력해 주세요.',
    )
    expect(validateRecord(withChanges({ studies: [{ subject: '수학', minutes: 601 }] })).studies).toBe(
      '공부는 하루 600분을 넘을 수 없습니다.',
    )
  })

  it('끼니·기분 범위를 검사한다', () => {
    expect(validateRecord(withChanges({ meals: { count: 6, lateSnack: false } })).meals).toBeDefined()
    expect(validateRecord(withChanges({ mood: 0 })).mood).toBe('기분을 골라 주세요.')
    expect(validateRecord(withChanges({ mood: 2.5 })).mood).toBeDefined()
  })

  it('나만의 습관은 5개까지, 이름은 1~20자', () => {
    const habits = Array.from({ length: 6 }, (_, i) => ({ name: `습관${i}`, done: true }))
    expect(validateRecord(withChanges({ customHabits: habits })).customHabits).toBe(
      '나만의 습관은 5개까지 기록할 수 있습니다.',
    )
    expect(
      validateRecord(withChanges({ customHabits: [{ name: '가'.repeat(21), done: false }] })).customHabits,
    ).toBeDefined()
  })
})

describe('checkDateWindow', () => {
  const today = '2026-11-13'

  it('새 기록은 오늘·어제만 허용한다', () => {
    expect(checkDateWindow('2026-11-13', today, 'create')).toBeNull()
    expect(checkDateWindow('2026-11-12', today, 'create')).toBeNull()
    expect(checkDateWindow('2026-11-11', today, 'create')).toBe('새 기록은 오늘과 어제 날짜만 등록할 수 있습니다.')
  })

  it('수정·삭제는 7일 이내만 허용한다', () => {
    expect(checkDateWindow('2026-11-06', today, 'update')).toBeNull()
    expect(checkDateWindow('2026-11-05', today, 'delete')).toBe('7일이 지난 기록은 바꿀 수 없습니다.')
  })

  it('미래 날짜는 어떤 경우에도 거절한다', () => {
    expect(checkDateWindow('2026-11-14', today, 'create')).toBe('미래 날짜는 기록할 수 없습니다.')
    expect(checkDateWindow('2026-11-14', today, 'update')).toBe('미래 날짜는 기록할 수 없습니다.')
  })
})
