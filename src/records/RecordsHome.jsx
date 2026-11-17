import { useEffect, useState } from 'react'
import CharacterHome from '../character/CharacterHome'
import { appIconOf, archetypeOfApp } from '../capture/appArchetypes'
import Loading from '../ui/Loading'
import PixelIcon from '../ui/PixelIcon'
import { addDays, daysBetween } from './dateKey'
import { hasSteps } from './record'
import { formatDateLabel, formatMinutes, formatShort } from './recordFormat'
import { LIMITS } from './recordOptions'
import { listRecentRecords } from './recordStore'

// 기록 줄의 스크린리더용 요약
function recordLabel(record) {
  const parts = []
  if (record.phone) parts.push(`화면 시간 ${formatMinutes(record.phone.total)}`)
  if (record.phone?.topApps[0]) parts.push(`가장 많이 쓴 앱 ${record.phone.topApps[0].name}`)
  if (hasSteps(record)) parts.push(`걸음 ${record.steps}`)
  return parts.join(', ')
}

// 홈: 오늘의 캐릭터 + 최근 7개 기록
function RecordsHome({ uid, profile, todayKey, onEdit, onHealth, onBattle, onDay, children }) {
  const [state, setState] = useState({ status: 'loading', records: [], message: '' })
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let active = true
    listRecentRecords(uid, 7).then((result) => {
      if (!active) return
      setState(
        result.ok
          ? { status: 'ready', records: result.records, message: '' }
          : { status: 'error', records: [], message: result.message },
      )
    })
    return () => {
      active = false
    }
  }, [uid, reloadCount])

  function reload() {
    setState({ status: 'loading', records: [], message: '' })
    setReloadCount((count) => count + 1)
  }

  const yesterdayKey = addDays(todayKey, -1)
  const hasDate = (dateKey) => state.records.some((record) => record.date === dateKey)
  const ready = state.status === 'ready'

  return (
    <section className="records-home">
      <CharacterHome
        uid={uid}
        profile={profile}
        todayKey={todayKey}
        onHealth={onHealth}
        onDay={onDay}
        onBattle={onBattle}
        onCapture={() => onEdit(todayKey, true)}
      >
        {children}
      </CharacterHome>

      <div className="records-actions">
        <button type="button" onClick={() => onEdit(todayKey)} disabled={!ready}>
          {hasDate(todayKey) ? '오늘 기록 고치기' : '오늘 기록하기'}
        </button>
        <button type="button" className="secondary" onClick={() => onEdit(yesterdayKey)} disabled={!ready}>
          {hasDate(yesterdayKey) ? '어제 기록 고치기' : '어제 기록하기'}
        </button>
      </div>

      <h2 className="section-title">
        <PixelIcon name="book" /> 최근 기록
      </h2>
      {state.status === 'loading' && <Loading text="기록을 불러오고 있어요…" />}
      {state.status === 'error' && (
        <div className="notice">
          <p className="form-error" role="alert">
            {state.message}
          </p>
          <button type="button" className="secondary" onClick={reload}>
            다시 불러오기
          </button>
        </div>
      )}
      {ready && state.records.length === 0 && (
        <div className="empty-state">
          <PixelIcon name="phone" scale={4} className="bounce" />
          <p>
            아직 기록이 없어요.
            <br />
            스크린 타임 캡처 한 장이면 시작할 수 있어요.
          </p>
        </div>
      )}
      {ready && state.records.length > 0 && (
        <ul className="record-list">
          {state.records.map((record) => {
            const age = daysBetween(record.date, todayKey)
            const editable = age <= LIMITS.editWindowDays
            const topApp = record.phone?.topApps[0]
            return (
              <li key={record.date} className={age === 0 ? 'record-row today' : 'record-row'}>
                <span
                  className={`record-app usage-dot type-${topApp ? (appIconOf(topApp.name) ?? archetypeOfApp(topApp.name) ?? 'other') : 'none'}`}
                  aria-hidden="true"
                />
                <div className="record-text">
                  <strong>{formatDateLabel(record.date, todayKey)}</strong>
                  <span className="record-stats" aria-label={recordLabel(record)}>
                    {record.phone && (
                      <span>
                        <PixelIcon name="phone" /> {formatShort(record.phone.total)}
                      </span>
                    )}
                    {topApp && <span>{topApp.name}</span>}
                    {hasSteps(record) && (
                      <span>
                        <PixelIcon name="foot" /> {record.steps.toLocaleString('ko-KR')}
                      </span>
                    )}
                    {!record.phone && !hasSteps(record) && <span>예전 형식 기록(스마트폰·걸음 없음)</span>}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onEdit(record.date)}
                  disabled={!editable}
                  title={editable ? undefined : '7일이 지난 기록은 바꿀 수 없습니다.'}
                >
                  고치기
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default RecordsHome
