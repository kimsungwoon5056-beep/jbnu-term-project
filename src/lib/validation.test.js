import { describe, expect, it } from 'vitest'
import { authErrorMessage, validateEmail, validatePassword } from './validation'

describe('validateEmail', () => {
  it('빈 값이면 입력을 요청한다', () => {
    expect(validateEmail('')).toBe('이메일을 입력해 주세요.')
    expect(validateEmail('   ')).toBe('이메일을 입력해 주세요.')
  })

  it('형식이 틀리면 안내한다', () => {
    expect(validateEmail('student')).toBe('이메일 형식이 올바르지 않습니다.')
    expect(validateEmail('student@jbnu')).toBe('이메일 형식이 올바르지 않습니다.')
  })

  it('올바른 이메일이면 null을 돌려준다', () => {
    expect(validateEmail('student@jbnu.ac.kr')).toBeNull()
    expect(validateEmail('  student@jbnu.ac.kr  ')).toBeNull()
  })
})

describe('validatePassword', () => {
  it('빈 값이면 입력을 요청한다', () => {
    expect(validatePassword('')).toBe('비밀번호를 입력해 주세요.')
  })

  it('6자 미만이면 거절한다', () => {
    expect(validatePassword('12345')).toBe('비밀번호는 6자 이상이어야 합니다.')
  })

  it('6자 이상이면 null을 돌려준다', () => {
    expect(validatePassword('123456')).toBeNull()
  })
})

describe('authErrorMessage', () => {
  it('알려진 오류 코드는 해당 문구로 바꾼다', () => {
    expect(authErrorMessage('auth/email-already-in-use')).toBe('이미 가입된 이메일입니다.')
    expect(authErrorMessage('auth/invalid-credential')).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
  })

  it('모르는 오류 코드는 기본 문구로 바꾼다', () => {
    expect(authErrorMessage('auth/unknown')).toBe('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(authErrorMessage(undefined)).toBe('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })
})
