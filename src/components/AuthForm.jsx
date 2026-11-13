import { useState } from 'react'
import { signIn, signUp } from '../auth/authService'
import { validateEmail, validatePassword } from '../lib/validation'

const MODES = {
  signIn: { title: '로그인', submit: '로그인', switchText: '계정이 없나요? 회원가입' },
  signUp: { title: '회원가입', submit: '가입하기', switchText: '이미 계정이 있나요? 로그인' },
}

function AuthForm() {
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  const texts = MODES[mode]

  async function handleSubmit(event) {
    event.preventDefault()
    const inputError = validateEmail(email) ?? validatePassword(password)
    if (inputError) {
      setMessage(inputError)
      return
    }

    setPending(true)
    setMessage('')
    const action = mode === 'signIn' ? signIn : signUp
    const result = await action(email, password)
    // 성공하면 로그인 상태가 바뀌면서 이 화면이 사라진다.
    if (!result.ok) {
      setMessage(result.message)
      setPending(false)
    }
  }

  function switchMode() {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn')
    setMessage('')
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>{texts.title}</h2>
      <label>
        이메일
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={pending}
        />
      </label>
      <label>
        비밀번호
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          disabled={pending}
        />
      </label>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? '처리 중…' : texts.submit}
      </button>
      <button type="button" className="link-button" onClick={switchMode} disabled={pending}>
        {texts.switchText}
      </button>
    </form>
  )
}

export default AuthForm
