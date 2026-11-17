import { useState } from 'react'
import { signIn, signUp } from '../auth/authService'
import { validateEmail, validatePassword } from '../lib/validation'
import ProfileForm from '../profile/ProfileForm'
import { rememberSignupProfile } from '../profile/profileStore'

const MODES = {
  signIn: { title: '로그인', submit: '로그인', switchText: '계정이 없나요? 회원가입' },
  signUp: { title: '회원가입 1/2', submit: '다음: 내 모습 만들기', switchText: '이미 계정이 있나요? 로그인' },
}

// 로그인·회원가입. 회원가입은 1) 이메일·비밀번호 2) 내 모습 만들기(닉네임·피부색·머리·안경) 두 단계다.
function AuthForm() {
  const [mode, setMode] = useState('signIn')
  const [step, setStep] = useState(1)
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
    setMessage('')
    if (mode === 'signUp') {
      setStep(2)
      return
    }
    setPending(true)
    const result = await signIn(email, password)
    // 성공하면 로그인 상태가 바뀌면서 이 화면이 사라진다.
    if (!result.ok) {
      setMessage(result.message)
      setPending(false)
    }
  }

  // 2단계: 고른 모습을 기억해 두고 계정을 만든다. 저장은 로그인 뒤 ProfileGate가 한다.
  async function finishSignUp(profile) {
    rememberSignupProfile(profile)
    const result = await signUp(email, password)
    if (!result.ok) {
      rememberSignupProfile(null)
      setStep(1)
      setMessage(result.message)
    }
    return result
  }

  function switchMode() {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn')
    setStep(1)
    setMessage('')
  }

  if (mode === 'signUp' && step === 2) {
    return (
      <div className="auth-form">
        <ProfileForm title="회원가입 2/2 · 내 모습 만들기" submitText="가입하기" onSubmit={finishSignUp} onCancel={() => setStep(1)} />
      </div>
    )
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
