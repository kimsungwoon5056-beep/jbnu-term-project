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
import PhoneFrame, { Dock, PushBanner } from './ui/PhoneFrame'
import PixelIcon from './ui/PixelIcon'
import TitleScene from './ui/TitleScene'

const TOAST_MS = 2500

function SignedIn({ user, onHealth }) {
  const [editing, setEditing] = useState(null) // { date, capture } 또는 null(홈)
  const [logoutError, setLogoutError] = useState('')
  const [toast, setToast] = useState('')

  // 저장·삭제 알림은 푸시 알림처럼 잠깐 보였다가 사라진다.
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function finishEditing(message) {
    setEditing(null)
    if (message) setToast(message)
  }
  // 화면을 열 때의 한국 날짜. 자정을 넘기면 새로고침 후 바뀐다.
  const [todayKey] = useState(() => toDateKey(new Date()))

  async function handleLogout() {
    const result = await logOut()
    setLogoutError(result.ok ? '' : result.message)
  }

  const current = !editing ? 'home' : editing.capture ? 'capture' : 'today'
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
      {editing ? (
        <RecordForm
          key={`${editing.date}-${editing.capture}`}
          uid={user.uid}
          dateKey={editing.date}
          todayKey={todayKey}
          onDone={finishEditing}
          focusCapture={editing.capture}
        />
      ) : (
        <RecordsHome uid={user.uid} todayKey={todayKey} onEdit={(date) => setEditing({ date, capture: false })} onHealth={onHealth} />
      )}
      {toast && <PushBanner message={toast} />}
      <Dock
        current={current}
        onHome={() => setEditing(null)}
        onToday={() => setEditing({ date: todayKey, capture: false })}
        onCapture={() => setEditing({ date: todayKey, capture: true })}
      />
    </div>
  )
}

function App() {
  const { user, ready } = useAuth()
  // 상태 표시줄 배터리 = 몬스터 건강(%). 로그인 전·알 단계는 100%
  const [battery, setBattery] = useState(100)

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
    content = <SignedIn key={user.uid} user={user} onHealth={setBattery} />
  }

  return (
    <div className="app">
      <PhoneFrame battery={user ? battery : 100}>
        <header className="app-header">
          <span className="app-icon" aria-hidden="true">
            <PixelIcon name="egg" />
          </span>
          <span>
            <h1>디톡스 몬스터</h1>
            <p>폰을 내려놓을수록 강해지는 내 몬스터</p>
          </span>
        </header>
        <main className="app-main">{content}</main>
      </PhoneFrame>
    </div>
  )
}

export default App
