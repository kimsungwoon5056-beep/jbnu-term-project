import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import { logOut } from './auth/authService'
import { useAuth } from './auth/useAuth'
import AuthForm from './components/AuthForm'
import { missingConfig } from './firebase'
import ProfileForm from './profile/ProfileForm'
import { loadProfile, saveProfile, takeSignupProfile } from './profile/profileStore'
import { toDateKey } from './records/dateKey'
import RecordForm from './records/RecordForm'
import RecordsHome from './records/RecordsHome'
import Loading from './ui/Loading'
import PhoneFrame, { Dock, PushBanner } from './ui/PhoneFrame'
import PixelIcon from './ui/PixelIcon'
import TitleScene from './ui/TitleScene'

const TOAST_MS = 2500
// 대결 화면(실시간 연결 코드 포함)은 열 때 불러온다.
const BattleScreen = lazy(() => import('./battle/BattleScreen'))

function SignedIn({ user, profile, onProfile, onHealth }) {
  const [screen, setScreen] = useState({ name: 'home' }) // home | record { date, capture } | battle | look
  const [logoutError, setLogoutError] = useState('')
  const [toast, setToast] = useState('')
  // 화면을 열 때의 한국 날짜. 자정을 넘기면 새로고침 후 바뀐다.
  const [todayKey] = useState(() => toDateKey(new Date()))

  // 저장·삭제 알림은 푸시 알림처럼 잠깐 보였다가 사라진다.
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function goHome(message) {
    setScreen({ name: 'home' })
    if (message) setToast(message)
  }

  async function handleLogout() {
    const result = await logOut()
    setLogoutError(result.ok ? '' : result.message)
  }

  async function saveLook(next) {
    const result = await saveProfile(user.uid, next)
    if (result.ok) {
      onProfile(result.profile)
      goHome('내 모습을 바꿨어요.')
    }
    return result
  }

  const openRecord = (date, capture = false) => setScreen({ name: 'record', date, capture })
  const current = screen.name === 'record' && screen.date === todayKey ? 'today' : screen.name
  const dockItems = [
    ['home', '캐릭터', 'heart', () => goHome()],
    ['today', '오늘 기록', 'book', () => openRecord(todayKey)],
    ['battle', '대결', 'sword', () => setScreen({ name: 'battle' })],
    ['look', '내 모습', 'sparkle', () => setScreen({ name: 'look' })],
  ]

  let content
  if (screen.name === 'record') {
    content = (
      <RecordForm
        key={`${screen.date}-${screen.capture}`}
        uid={user.uid}
        dateKey={screen.date}
        todayKey={todayKey}
        onDone={goHome}
        focusCapture={screen.capture}
      />
    )
  } else if (screen.name === 'battle') {
    content = (
      <Suspense fallback={<Loading text="대결장을 여는 중…" />}>
        <BattleScreen uid={user.uid} profile={profile} todayKey={todayKey} />
      </Suspense>
    )
  } else if (screen.name === 'look') {
    content = <ProfileForm initial={profile} title="내 모습 고치기" submitText="저장" onSubmit={saveLook} onCancel={() => goHome()} />
  } else {
    content = (
      <RecordsHome
        uid={user.uid}
        profile={profile}
        todayKey={todayKey}
        onEdit={openRecord}
        onHealth={onHealth}
        onBattle={() => setScreen({ name: 'battle' })}
      />
    )
  }

  return (
    <div className="signed-in">
      <div className="account-bar">
        <span className="muted">{profile.nickname}</span>
        <button type="button" className="link-button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
      {logoutError && (
        <p className="form-error" role="alert">
          {logoutError}
        </p>
      )}
      {content}
      {toast && <PushBanner message={toast} />}
      <Dock current={current} items={dockItems} />
    </div>
  )
}

// 로그인 뒤 프로필(닉네임·모습)을 불러온다. 없으면(가입 직후·예전 계정) 내 모습 만들기를 먼저 보여 준다.
function ProfileGate({ user, onHealth }) {
  const [state, setState] = useState({ status: 'loading', profile: null, message: '' })

  useEffect(() => {
    let active = true
    async function load() {
      const loaded = await loadProfile(user.uid)
      if (!active) return
      if (!loaded.ok) {
        setState({ status: 'error', profile: null, message: loaded.message })
        return
      }
      if (loaded.profile) {
        setState({ status: 'ready', profile: loaded.profile, message: '' })
        return
      }
      // 방금 가입하며 고른 모습이 있으면 바로 저장한다.
      const chosen = takeSignupProfile()
      const saved = chosen ? await saveProfile(user.uid, chosen) : null
      if (!active) return
      setState(saved?.ok ? { status: 'ready', profile: saved.profile, message: '' } : { status: 'missing', profile: chosen, message: saved?.message ?? '' })
    }
    load()
    return () => {
      active = false
    }
  }, [user.uid])

  async function create(profile) {
    const result = await saveProfile(user.uid, profile)
    if (result.ok) setState({ status: 'ready', profile: result.profile, message: '' })
    return result
  }

  if (state.status === 'loading') return <Loading text="내 캐릭터를 찾고 있어요…" />
  if (state.status === 'error') {
    return (
      <div className="notice">
        <p className="form-error" role="alert">
          {state.message}
        </p>
        <button type="button" className="secondary" onClick={() => logOut()}>
          로그아웃
        </button>
      </div>
    )
  }
  if (state.status === 'missing') {
    return (
      <>
        {state.message && (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        )}
        <ProfileForm initial={state.profile} onSubmit={create} />
      </>
    )
  }
  return <SignedIn user={user} profile={state.profile} onProfile={(profile) => setState({ ...state, profile })} onHealth={onHealth} />
}

function App() {
  const { user, ready } = useAuth()
  // 상태 표시줄 배터리 = 디지털 건강(%). 로그인 전은 100%, 홈이 건강을 계산하기 전이나 잴 수 없으면 null("?")
  const [battery, setBattery] = useState(null)

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
    content = <ProfileGate key={user.uid} user={user} onHealth={setBattery} />
  }

  return (
    <div className="app">
      <PhoneFrame battery={user ? battery : 100}>
        <header className="app-header">
          <span className="app-icon" aria-hidden="true">
            <PixelIcon name="phone" />
          </span>
          <span>
            <h1>디톡스 PVP</h1>
            <p>폰을 내려놓은 사람이 이긴다</p>
          </span>
        </header>
        <main className="app-main">{content}</main>
      </PhoneFrame>
    </div>
  )
}

export default App
