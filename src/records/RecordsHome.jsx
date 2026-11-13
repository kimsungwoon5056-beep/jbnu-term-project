import { useEffect, useState } from 'react'
import { addDays, daysBetween } from './dateKey'
import { summarizeRecord } from './record'
import { LIMITS } from './recordOptions'
import { formatDateLabel, formatMinutes, MOODS } from './recordFormat'
import { listRecentRecords } from './recordStore'

// 최근 7일 기록 목록과 "오늘·어제 기록하기"
function RecordsHome({ uid, todayKey, onEdit }) {
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
      <div className="records-actions">
        <button type="button" onClick={() => onEdit(todayKey)} disabled={!ready}>
          {hasDate(todayKey) ? '오늘 기록 수정' : '오늘 기록하기'}
        </button>
        <button type="button" className="secondary" onClick={() => onEdit(yesterdayKey)} disabled={!ready}>
          {hasDate(yesterdayKey) ? '어제 기록 수정' : '어제 기록하기'}
        </button>
      </div>

      <h2>최근 기록</h2>
      {state.status === 'loading' && <p className="muted">기록을 불러오고 있습니다…</p>}
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
        <p className="muted">아직 기록이 없어요. 오늘 기록부터 시작해 보세요.</p>
      )}
      {ready && state.records.length > 0 && (
        <ul className="record-list">
          {state.records.map((record) => {
            const summary = summarizeRecord(record)
            const mood = MOODS.find((item) => item.value === record.mood)
            const editable = daysBetween(record.date, todayKey) <= LIMITS.editWindowDays
            return (
              <li key={record.date} className="record-row">
                <span className="record-mood" title={mood?.label} aria-label={`기분 ${mood?.label ?? ''}`}>
                  {mood?.face}
                </span>
                <div className="record-text">
                  <strong>{formatDateLabel(record.date, todayKey)}</strong>
                  <span className="muted">
                    수면 {formatMinutes(summary.sleepMinutes)} · 운동 {formatMinutes(summary.exerciseMinutes)} · 공부{' '}
                    {formatMinutes(summary.studyMinutes)}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onEdit(record.date)}
                  disabled={!editable}
                  title={editable ? undefined : '7일이 지난 기록은 바꿀 수 없습니다.'}
                >
                  수정
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
