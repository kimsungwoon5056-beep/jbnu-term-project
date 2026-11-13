const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

// 입력값이 올바르면 null, 아니면 화면에 보여 줄 안내 문구를 돌려준다.
export function validateEmail(email) {
  const value = email.trim()
  if (!value) return '이메일을 입력해 주세요.'
  if (!EMAIL_PATTERN.test(value)) return '이메일 형식이 올바르지 않습니다.'
  return null
}

export function validatePassword(password) {
  if (!password) return '비밀번호를 입력해 주세요.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  }
  return null
}

// Firebase Authentication 오류 코드를 사용자 안내 문구로 바꾼다.
const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth/user-not-found': '가입되지 않은 이메일입니다.',
  'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
  'auth/email-already-in-use': '이미 가입된 이메일입니다.',
  'auth/weak-password': `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
  'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
  'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
}

const DEFAULT_AUTH_ERROR = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export function authErrorMessage(code) {
  return AUTH_ERROR_MESSAGES[code] ?? DEFAULT_AUTH_ERROR
}
