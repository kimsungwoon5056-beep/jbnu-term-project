import { describe, expect, it } from 'vitest'
import { reuseUntilFail } from '../capture/ocr'
import { msUntilNextDay, toDateKey } from './dateKey'

describe('자정이 지나면 오늘 날짜 갱신', () => {
  it('한국 시간 23:59:30이면 다음 자정까지 30초', () => {
    const now = new Date('2026-11-21T14:59:30Z') // 한국 시간 23:59:30
    expect(toDateKey(now)).toBe('2026-11-21')
    expect(msUntilNextDay(now)).toBe(30 * 1000)
    expect(toDateKey(new Date(now.getTime() + msUntilNextDay(now) + 1000))).toBe('2026-11-22')
  })

  it('한국 시간 자정 직후면 거의 하루가 남는다', () => {
    const now = new Date('2026-11-21T15:00:01Z') // 한국 시간 11/22 00:00:01
    expect(msUntilNextDay(now)).toBe(24 * 60 * 60 * 1000 - 1000)
  })
})

describe('캡처 읽기 엔진 준비', () => {
  it('성공하면 한 번 만든 것을 다시 쓴다', async () => {
    let made = 0
    const get = reuseUntilFail(async () => {
      made += 1
      return { id: made }
    })
    expect(await get()).toEqual({ id: 1 })
    expect(await get()).toEqual({ id: 1 })
    expect(made).toBe(1)
  })

  it('만들기에 실패하면 기억하지 않고, 다음에 다시 만든다(새로고침 없이 재시도)', async () => {
    let tries = 0
    const get = reuseUntilFail(async () => {
      tries += 1
      if (tries === 1) throw new Error('언어 데이터를 받지 못함')
      return 'ready'
    })
    await expect(get()).rejects.toThrow('언어 데이터를 받지 못함')
    expect(await get()).toBe('ready')
    expect(tries).toBe(2)
  })
})
