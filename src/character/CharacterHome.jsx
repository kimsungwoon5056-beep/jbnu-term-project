import { useEffect, useMemo, useState } from 'react'
import PixelSprite from '../pixel/PixelSprite'
import { addDays } from '../records/dateKey'
import { useRepositories } from '../data/repositories'
import HealthWidget from '../stats/HealthWidget'
import { computeTodayMetrics } from '../stats/metrics'
import PhoneUsage from '../stats/PhoneUsage'
import LoadoutCard from '../battle/LoadoutCard'
import { buildLoadout } from '../battle/loadout'
import LoadError from '../ui/LoadError'
import Loading from '../ui/Loading'
import { useClock } from '../ui/phone'
import { drawCharacter } from './drawCharacter'
import LockNotices from './LockNotices'
import { lockNotices } from './notifications'
import { explainParts } from './reasons'
import { characterState } from './state'

const LOOKBACK_DAYS = 31 // "N일째 기록 중"을 세는 범위

// 홈: 잠금 화면(시계 + 오늘의 캐릭터 + 칭호 + 부위 설명 알림) → 디지털 건강 띠 → 스크린 타임 → 대결 능력
// 오늘 기록이 없으면 어제 하루로 보여 준다. children은 무대 아래에 이어 붙일 창(대결 능력 등)
function CharacterHome({ profile, todayKey, onHealth, onCapture, onBattle, onDay, children }) {
  const { records } = useRepositories()
  const [state, setState] = useState({ status: 'loading' })
  const [picked, setPicked] = useState(null)
  const [attempt, setAttempt] = useState(0) // 다시 불러오기를 누를 때마다 1씩
  const clock = useClock()

  useEffect(() => {
    let active = true
    records.listBetween(addDays(todayKey, -(LOOKBACK_DAYS - 1)), todayKey).then((result) => {
      if (!active) return
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      const today = computeTodayMetrics(result.records, todayKey)
      setState({ status: 'ready', today, character: characterState(today.metrics, today.details, { hasRecord: today.hasRecord }) })
    })
    return () => {
      active = false
    }
  }, [records, todayKey, attempt])

  const ready = state.status === 'ready'
  const percent = ready && state.character.health.measured ? state.character.health.percent : null
  useEffect(() => {
    onHealth?.(percent)
  }, [percent, onHealth])
  useEffect(() => {
    if (ready) onDay?.(state.today, state.character)
  }, [ready, state, onDay])

  const view = useMemo(() => {
    if (!ready) return null
    const { today, character } = state
    const entries = explainParts(character, today.details, profile.look, { isToday: today.isToday })
    return {
      sprite: drawCharacter(profile.look, character, { scene: true }),
      loadout: buildLoadout({ state: character, look: profile.look, nickname: profile.nickname }),
      entries,
      notices: lockNotices(entries, character, today.details),
    }
  }, [ready, state, profile])

  if (state.status === 'loading') return <Loading text="오늘의 나를 그리고 있어요…" />
  if (state.status === 'error') {
    return (
      <LoadError
        message={state.message}
        onRetry={() => {
          setState({ status: 'loading' })
          setAttempt((n) => n + 1)
        }}
      />
    )
  }

  const { today, character } = state
  const { sprite, entries, notices, loadout } = view
  // 알림(또는 그림)을 고르면 그 부위가 반짝이고 알림이 펼쳐진다. 같은 부위를 다시 고르면 접힌다.
  const opened = entries.find((entry) => entry.key === picked) ?? null
  const pickFromSprite = (key) => {
    const next = entries.some((entry) => entry.key === key) ? key : 'face'
    setPicked((current) => (current === next ? null : next))
  }
  const cta = today.hasRecord
    ? null
    : { text: '스크린 타임 캡처를 넣으면 많이 쓴 앱이 내 머리·옷·손에 스며들어요.', label: '캡처로 불러오기', onClick: onCapture }
  const streak = today.details.streakDays

  return (
    <>
      <section className={`character-card scene-${character.scene}`} aria-label="오늘의 나">
        <div className="lock-screen">
          <p className="lock-clock" aria-hidden="true">
            {clock}
          </p>
          <p className="lock-date">
            {today.hasRecord ? (today.isToday ? '오늘 기록' : '어제 기록 · 오늘 기록하면 바로 바뀌어요') : '아직 기록이 없어요'}
            {streak > 1 && ` · ${streak >= LOOKBACK_DAYS - 1 ? `${LOOKBACK_DAYS - 1}일 넘게` : `${streak}일째`} 기록 중`}
          </p>
        </div>
        <div className="character-stage">
          <PixelSprite
            sprite={sprite}
            label={`${profile.nickname}: ${character.title}`}
            scale={6}
            highlight={opened?.highlight ?? null}
            onPick={pickFromSprite}
          />
        </div>
        <p className="character-name">
          <strong>{profile.nickname}</strong>
          <span>{character.title}</span>
        </p>
        <LockNotices notices={notices} openKey={opened?.key ?? null} onToggle={setPicked} cta={cta} visible={today.hasRecord ? undefined : 0} />
      </section>

      <HealthWidget health={character.health} />
      {today.hasRecord && <PhoneUsage raw={today.details.raw} known={today.details.known} isToday={today.isToday} onCapture={onCapture} />}
      <section className="panel" aria-label="오늘의 대결 능력">
        <h3 className="panel-title">오늘의 대결 능력</h3>
        <LoadoutCard loadout={loadout} compact />
        {onBattle && (
          <button type="button" onClick={onBattle}>
            대결하러 가기
          </button>
        )}
      </section>
      {children}
    </>
  )
}

export default CharacterHome
