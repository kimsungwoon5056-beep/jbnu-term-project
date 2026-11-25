import { describe, expect, it } from 'vitest'
import { checkDateWindow, createEmptyPhone, createEmptyRecord, validateRecord } from './record'

const withChanges = (changes) => ({ ...createEmptyRecord('2026-11-13'), ...changes })

describe('createEmptyRecord', () => {
  it('하루 기록은 날짜·스마트폰·걸음만 담는다', () => {
    expect(createEmptyRecord('2026-11-13')).toEqual({ date: '2026-11-13', phone: null, steps: null })
  })
})

describe('validateRecord', () => {
  it('스마트폰이나 걸음 중 하나는 있어야 한다', () => {
    expect(validateRecord(createEmptyRecord('2026-11-13')).empty).toBeDefined()
    expect(validateRecord(withChanges({ steps: 0 }))).toEqual({})
    expect(validateRecord(withChanges({ phone: { ...createEmptyPhone(), total: 90 } }))).toEqual({})
  })

  it('총 화면 시간이 0분이면 저장하지 않는다(캡처에서 못 읽은 칸이 "안 썼다"로 저장되지 않게)', () => {
    expect(validateRecord(withChanges({ phone: createEmptyPhone() })).phone).toContain('총 화면 시간')
  })

  it('걸음 수는 0~100,000 정수', () => {
    expect(validateRecord(withChanges({ steps: -1 })).steps).toBeDefined()
    expect(validateRecord(withChanges({ steps: 100001 })).steps).toBeDefined()
    expect(validateRecord(withChanges({ steps: 12.5 })).steps).toBeDefined()
  })

  it('날짜 형식을 검사한다', () => {
    expect(validateRecord({ ...withChanges({ steps: 10 }), date: '2026-1-3' }).date).toBeDefined()
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
