import { useState } from 'react'
import './App.css'
import { logOut } from './auth/authService'
import { useAuth } from './auth/useAuth'
import AuthForm from './components/AuthForm'
import { missingConfig } from './firebase'

function App() {
  const { user, ready } = useAuth()
  const [logoutError, setLogoutError] = useState('')

  async function handleLogout() {
    const result = await logOut()
    setLogoutError(result.ok ? '' : result.message)
  }

  let content
  if (missingConfig) {
    content = (
      <p className="form-error" role="alert">
        Firebase 설정값이 없습니다. README의 안내대로 .env.local을 만들어 주세요.
      </p>
    )
  } else if (!ready) {
    content = <p>로그인 상태를 확인하고 있습니다…</p>
  } else if (!user) {
    content = <AuthForm />
  } else {
    content = (
      <div className="signed-in">
        <p>
          <strong>{user.email}</strong> 계정으로 로그인했습니다.
        </p>
        <button type="button" onClick={handleLogout}>
          로그아웃
        </button>
        {logoutError && (
          <p className="form-error" role="alert">
            {logoutError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>초급프로젝트 Term Project</h1>
        <p>서비스를 준비하고 있습니다.</p>
      </header>
      <main className="app-main">{content}</main>
    </div>
  )
}

export default App
