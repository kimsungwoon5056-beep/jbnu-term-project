// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMotion, isReduced, setMotionOn } from './motion'

describe('움직임 설정', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('고르지 않았으면 기기의 동작 줄이기를 따른다', () => {
    expect(isReduced()).toBe(false)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(isReduced()).toBe(true)
    applyMotion()
    expect(document.documentElement.dataset.motion).toBe('reduce')
  })

  it('앱에서 켜거나 끄면 기기 설정보다 먼저이고, 화면(html)에 바로 반영된다', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    setMotionOn(true)
    expect(isReduced()).toBe(false)
    expect(document.documentElement.dataset.motion).toBe('full')
    setMotionOn(false)
    expect(isReduced()).toBe(true)
    expect(document.documentElement.dataset.motion).toBe('reduce')
  })
})
