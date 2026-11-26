// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'
import { errorText } from './errorText'

// 화면을 그리다 터지거나 화면 묶음을 못 받아도 빈 화면 대신 안내와 다시 시도가 보인다.
let broken = true
function Fragile() {
  if (broken) throw new Error('그리다 터짐')
  return <p>다시 그려졌어요</p>
}

describe('오류 경계', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    broken = true
  })

  it('아래 화면이 터지면 경고와 다시 시도 버튼을 보여 주고, 다시 시도하면 다시 그린다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain('문제가 생겼어요')
    broken = false
    act(() => fireEvent.click(screen.getByText('다시 시도')))
    expect(screen.getByText('다시 그려졌어요')).toBeTruthy()
  })

  it('화면 묶음을 받지 못한 오류(인터넷)는 연결을 확인하라고 안내한다', () => {
    expect(errorText(new TypeError('Failed to fetch dynamically imported module: /assets/BattleScreen.js'))).toContain('인터넷 연결')
    expect(errorText(new Error('ChunkLoadError: Loading chunk 3 failed'))).toContain('인터넷 연결')
    expect(errorText(new Error('x is undefined'))).not.toContain('인터넷 연결')
  })

  it('다시 시도할 때 부르는 함수(onReset)가 있으면 부른다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReset = vi.fn()
    render(
      <ErrorBoundary onReset={onReset}>
        <Fragile />
      </ErrorBoundary>,
    )
    broken = false
    act(() => fireEvent.click(screen.getByText('다시 시도')))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
