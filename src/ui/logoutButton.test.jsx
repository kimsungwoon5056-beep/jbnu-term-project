// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LogoutButton from './LogoutButton'

// 프로필 오류·만들기 화면의 로그아웃: 실패하면 이유를 보여 주고, 가입 중 기억해 둔 모습은 지운다.
describe('로그아웃 버튼', () => {
  afterEach(cleanup)

  it('로그아웃에 실패하면 이유를 경고로 보여 준다', async () => {
    const forget = vi.fn()
    render(<LogoutButton logOut={async () => ({ ok: false, message: '로그아웃하지 못했어요. 다시 시도해 주세요.' })} forget={forget} />)
    fireEvent.click(screen.getByText('로그아웃'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('로그아웃하지 못했어요'))
    expect(forget).toHaveBeenCalled()
  })

  it('성공하면 경고가 없다', async () => {
    const logOut = vi.fn(async () => ({ ok: true }))
    render(<LogoutButton logOut={logOut} forget={() => {}} />)
    fireEvent.click(screen.getByText('로그아웃'))
    await waitFor(() => expect(logOut).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
