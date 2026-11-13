import { useEffect, useState } from 'react'
import './App.css'
import { logOut } from './auth/authService'
import { useAuth } from './auth/useAuth'
import AuthForm from './components/AuthForm'
import { missingConfig } from './firebase'
import { toDateKey } from './records/dateKey'
import RecordForm from './records/RecordForm'
import RecordsHome from './records/RecordsHome'
import Loading from './ui/Loading'
import PixelIcon from './ui/PixelIcon'
import TitleScene from './ui/TitleScene'

const TOAST_MS = 2500

function SignedIn({ user }) {
  const [editingDate, setEditingDate] = useState(null)
  const [logoutError, setLogoutError] = useState('')
  const [toast, setToast] = useState('')

  // 저장·삭제 알림은 잠깐 보였다가 사라진다.
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function finishEditing(message) {
    setEditingDate(null)
    if (message) setToast(message)
  }
  // 화면을 열 때의 한국 날짜. 자정을 넘기면 새로고침 후 바뀐다.
  const [todayKey] = useState(() => toDateKey(new Date()))

  async function handleLogout() {
    const result = await logOut()
    setLogoutError(result.ok ? '' : result.message)
  }

  return (
    <div className="signed-in">
      <div className="account-bar">
        <span className="muted">{user.email}</span>
        <button type="button" className="link-button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
      {logoutError && (
        <p className="form-error" role="alert">
          {logoutError}
        </p>
      )}
      {editingDate ? (
        <RecordForm uid={user.uid} dateKey={editingDate} todayKey={todayKey} onDone={finishEditing} />
      ) : (
        <RecordsHome uid={user.uid} todayKey={todayKey} onEdit={setEditingDate} />
      )}
      {toast && (
        <p className="toast" role="status">
          <PixelIcon name="sparkle" /> {toast}
        </p>
      )}
    </div>
  )
}

function App() {
  const { user, ready } = useAuth()

  let content
  if (missingConfig) {
    content = (
      <p className="form-error" role="alert">
        Firebase 설정값이 없습니다. README의 안내대로 .env.local을 만들어 주세요.
      </p>
    )
  } else if (!ready) {
    content = <Loading text="로그인 상태를 확인하고 있어요…" />
  } else if (!user) {
    content = (
      <>
        <TitleScene />
        <AuthForm />
      </>
    )
  } else {
    // 계정이 바뀌면 화면 상태를 새로 시작한다.
    content = <SignedIn key={user.uid} user={user} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>나를 닮은 몬스터</h1>
        <p>하루 기록이 몬스터의 모습과 능력치가 됩니다.</p>
      </header>
      <main className="app-main">{content}</main>
    </div>
  )
}

export default App
