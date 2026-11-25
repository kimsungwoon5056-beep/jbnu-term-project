import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { play, setSoundOn, soundOn, unlockAudio } from './audio/player'
import { logOut } from './auth/authService'
import { runBeforeLogout } from './lib/beforeLogout'
import { useAuth } from './auth/useAuth'
import AuthForm from './components/AuthForm'
import { missingConfig } from './firebase'
import ProfileForm from './profile/ProfileForm'
import { createFirestoreRepositories, RepositoryContext, useRepositories } from './data/repositories'
import { rememberSignupProfile, takeSignupProfile } from './profile/signupProfile'
import { msUntilNextDay, toDateKey } from './records/dateKey'
import RecordForm from './records/RecordForm'
import RecordsHome from './records/RecordsHome'
import Loading from './ui/Loading'
import MotionButton from './ui/MotionButton'
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
  const repositories = useRepositories()
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()))
  // 화면을 켜 둔 채 자정이 지나면 "오늘"을 바꾼다(그대로 두면 앱은 어제를 오늘로 보고, 서버 규칙은 거절한다).
  useEffect(() => {
    const refresh = () => setTodayKey(toDateKey(new Date()))
    const timer = setTimeout(refresh, msUntilNextDay() + 1000)
    // 휴대폰이 자는 동안에는 타이머가 늦어진다. 화면을 다시 볼 때도 확인한다.
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [todayKey])

  // 저장·삭제 알림은 푸시 알림처럼 잠깐 보였다가 사라진다.
  useEffect(() => {
    if (!toast) return undefined
    play('toast')
    const timer = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function goHome(message) {
    setScreen({ name: 'home' })
    if (message) setToast(message)
  }

  async function handleLogout() {
    await runBeforeLogout()
    const result = await logOut()
    setLogoutError(result.ok ? '' : result.message)
  }

  async function saveLook(next) {
    const result = await repositories.profile.save(next)
    if (result.ok) {
      onProfile(result.profile)
      // 저장하는 동안 다른 화면으로 갔으면 홈으로 끌고 가지 않는다.
      setScreen((now) => (now.name === 'look' ? { name: 'home' } : now))
      setToast('내 모습을 바꿨어요.')
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
        key={screen.date}
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
        <span className="account-actions">
          <MotionButton />
          <SoundButton />
          <button type="button" className="link-button" onClick={handleLogout}>
            로그아웃
          </button>
        </span>
      </div>
      {logoutError && (
        <p className="form-error" role="alert">
          {logoutError}
        </p>
      )}
      {/* 앱을 열 때처럼 커지며 나타난다 */}
      <div key={screen.name} className={`screen screen-${screen.name}`}>
        {content}
      </div>
      {toast && <PushBanner message={toast} />}
      <Dock current={current} items={dockItems} />
    </div>
  )
}

// 소리 켜기·끄기(이 브라우저에만 기억)
function SoundButton() {
  const [on, setOn] = useState(soundOn)
  return (
    <button
      type="button"
      className="link-button"
      aria-pressed={on}
      onClick={() => {
        setSoundOn(!on)
        setOn(!on)
        if (!on) play('toast')
      }}
    >
      {on ? '소리 끄기' : '소리 켜기'}
    </button>
  )
}

// 화면 어디서나 버튼을 누르면 짧은 소리가 난다(대결 중 조작 버튼은 빼고).
function useButtonSounds() {
  useEffect(() => {
    const onDown = (event) => {
      unlockAudio()
      const button = event.target.closest?.('button, summary, .capture-button')
      if (!button || button.disabled || button.closest('.game-view')) return
      play(button.classList.contains('dock-button') ? 'open' : 'click')
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
}

// 프로필을 못 불러왔거나 아직 없을 때의 로그아웃. 가입 중 기억해 둔 모습이 다른 계정에 저장되지 않게 지운다.
function LogoutButton() {
  return (
    <button
      type="button"
      className="secondary"
      onClick={() => {
        rememberSignupProfile(null)
        logOut()
      }}
    >
      로그아웃
    </button>
  )
}

// 로그인 뒤 프로필(닉네임·모습)을 불러온다. 없으면(가입 직후·예전 계정) 내 모습 만들기를 먼저 보여 준다.
// 로그인한 사람의 저장소(Repository)를 여기서 한 번 만들어 아래 화면 전체에 내려준다.
function ProfileGate({ user, onHealth }) {
  const [state, setState] = useState({ status: 'loading', profile: null, message: '' })
  const repositories = useMemo(() => createFirestoreRepositories(user.uid), [user.uid])

  useEffect(() => {
    let active = true
    async function load() {
      const loaded = await repositories.profile.load()
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
      const saved = chosen ? await repositories.profile.save(chosen) : null
      if (!active) return
      setState(saved?.ok ? { status: 'ready', profile: saved.profile, message: '' } : { status: 'missing', profile: chosen, message: saved?.message ?? '' })
    }
    load()
    return () => {
      active = false
    }
  }, [repositories])

  async function create(profile) {
    const result = await repositories.profile.save(profile)
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
        <LogoutButton />
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
        <LogoutButton />
      </>
    )
  }
  return (
    <RepositoryContext.Provider value={repositories}>
      <SignedIn user={user} profile={state.profile} onProfile={(profile) => setState({ ...state, profile })} onHealth={onHealth} />
    </RepositoryContext.Provider>
  )
}

function App() {
  const { user, ready } = useAuth()
  useButtonSounds()
  // 상태 표시줄 배터리 = 디지털 건강(%). 로그인 전은 100%, 홈이 건강을 계산하기 전이나 잴 수 없으면 null("?")
  // 계정을 바꾸면 앞 사람의 건강이 보이지 않게, 누구의 값인지 함께 둔다.
  const [battery, setBattery] = useState({ uid: null, percent: null })
  const uid = user?.uid ?? null
  const showHealth = useCallback((percent) => setBattery({ uid, percent }), [uid])

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
    content = <ProfileGate key={user.uid} user={user} onHealth={showHealth} />
  }

  return (
    <div className="app">
      <PhoneFrame battery={!user ? 100 : battery.uid === uid ? battery.percent : null}>
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
