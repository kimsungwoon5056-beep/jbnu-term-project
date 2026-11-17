import { useEffect, useMemo, useState } from 'react'
import PixelSprite from '../pixel/PixelSprite'
import { addDays } from '../records/dateKey'
import { listRecordsBetween } from '../records/recordStore'
import HealthWidget from '../stats/HealthWidget'
import { computeTodayMetrics } from '../stats/metrics'
import PhoneUsage from '../stats/PhoneUsage'
import LoadoutCard from '../battle/LoadoutCard'
import { buildLoadout } from '../battle/loadout'
import Loading from '../ui/Loading'
import { useClock } from '../ui/phone'
import { drawCharacter } from './drawCharacter'
import PartGuide from './PartGuide'
import { explainParts, featuredPart } from './reasons'
import { characterState } from './state'

const LOOKBACK_DAYS = 14 // "N일째 기록 중"을 세는 범위

// 홈: 잠금 화면 같은 무대(시계 + 오늘의 캐릭터 + 칭호) → 디지털 건강 → 스크린 타임 → 부위 설명
// 오늘 기록이 없으면 어제 하루로 보여 준다. children은 무대 아래에 이어 붙일 창(대결 능력 등)
function CharacterHome({ uid, profile, todayKey, onHealth, onCapture, onBattle, onDay, children }) {
  const [state, setState] = useState({ status: 'loading' })
  const [picked, setPicked] = useState(null)
  const clock = useClock()

  useEffect(() => {
    let active = true
    listRecordsBetween(uid, addDays(todayKey, -(LOOKBACK_DAYS - 1)), todayKey).then((result) => {
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
  }, [uid, todayKey])

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
      featured: featuredPart(entries, character),
    }
  }, [ready, state, profile])

  if (state.status === 'loading') return <Loading text="오늘의 나를 그리고 있어요…" />
  if (state.status === 'error') {
    return (
      <p className="form-error" role="alert">
        {state.message}
      </p>
    )
  }

  const { today, character } = state
  const { sprite, entries, featured, loadout } = view
  const selected = entries.some((entry) => entry.key === picked) ? picked : featured
  const highlight = picked === null ? null : entries.find((entry) => entry.key === selected)?.highlight
  const pickFromSprite = (key) => setPicked(entries.some((entry) => entry.key === key) ? key : 'face')
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
            {streak > 1 && ` · ${streak}일째 기록 중`}
          </p>
        </div>
        <div className="character-stage">
          <PixelSprite
            sprite={sprite}
            label={`${profile.nickname}: ${character.title}`}
            scale={6}
            highlight={highlight}
            onPick={pickFromSprite}
          />
        </div>
        <p className="character-name">
          <strong>{profile.nickname}</strong>
          <span>{character.title}</span>
        </p>
      </section>

      {!today.hasRecord && (
        <section className="panel first-record">
          <p>스크린 타임 캡처를 넣으면 많이 쓴 앱이 내 머리·옷·손에 스며들어요.</p>
          <button type="button" onClick={onCapture}>
            캡처로 불러오기
          </button>
        </section>
      )}

      <HealthWidget health={character.health} />
      <PhoneUsage raw={today.details.raw} known={today.details.known} onCapture={onCapture} />
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
      <PartGuide entries={entries} selected={selected} onSelect={setPicked} />
    </>
  )
}

export default CharacterHome
