import { useEffect, useState } from 'react'
import { addDays, daysBetween } from './dateKey'
import { summarizeRecord } from './record'
import { LIMITS } from './recordOptions'
import { formatDateLabel, formatMinutes, formatShort, MOODS } from './recordFormat'
import { listRecentRecords } from './recordStore'
import MonsterStats from '../stats/MonsterStats'
import PixelSprite from '../monster/PixelSprite'
import { moodSprite } from './moodSprites'
import Loading from '../ui/Loading'
import PixelIcon from '../ui/PixelIcon'

// 최근 7일 기록 목록과 "오늘·어제 기록하기"
// 기록 줄의 스크린리더용 요약
function recordLabel(record, summary) {
  const parts = [
    `수면 ${formatMinutes(summary.sleepMinutes)}`,
    `운동 ${formatMinutes(summary.exerciseMinutes)}`,
    `공부 ${formatMinutes(summary.studyMinutes)}`,
  ]
  if (record.phone) parts.push(`화면 시간 ${formatMinutes(record.phone.total)}`)
  if (record.steps !== null && record.steps !== undefined) parts.push(`걸음 ${record.steps}`)
  return parts.join(', ')
}

function RecordsHome({ uid, todayKey, onEdit, onHealth }) {
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
      <MonsterStats uid={uid} todayKey={todayKey} onHealth={onHealth} onCapture={() => onEdit(todayKey)} />

      <div className="records-actions">
        <button type="button" onClick={() => onEdit(todayKey)} disabled={!ready}>
          {hasDate(todayKey) ? '오늘 기록 수정' : '오늘 기록하기'}
        </button>
        <button type="button" className="secondary" onClick={() => onEdit(yesterdayKey)} disabled={!ready}>
          {hasDate(yesterdayKey) ? '어제 기록 수정' : '어제 기록하기'}
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
          <PixelIcon name="egg" scale={4} className="bounce" />
          <p>
            아직 기록이 없어요.
            <br />첫 기록을 남기면 내일 알이 깨어나요.
          </p>
        </div>
      )}
      {ready && state.records.length > 0 && (
        <ul className="record-list">
          {state.records.map((record) => {
            const summary = summarizeRecord(record)
            const mood = MOODS.find((item) => item.value === record.mood)
            const age = daysBetween(record.date, todayKey)
            const editable = age <= LIMITS.editWindowDays
            return (
              <li key={record.date} className={age === 0 ? 'record-row today' : 'record-row'}>
                <span className="record-mood" title={mood?.label}>
                  <PixelSprite sprite={moodSprite(record.mood)} label={`기분 ${mood?.label ?? ''}`} scale={3} animate={false} />
                </span>
                <div className="record-text">
                  <strong>{formatDateLabel(record.date, todayKey)}</strong>
                  <span
                    className="record-stats"
                    aria-label={recordLabel(record, summary)}
                  >
                    <span>
                      <PixelIcon name="moon" /> {formatShort(summary.sleepMinutes)}
                    </span>
                    <span>
                      <PixelIcon name="shoe" /> {formatShort(summary.exerciseMinutes)}
                    </span>
                    <span>
                      <PixelIcon name="book" /> {formatShort(summary.studyMinutes)}
                    </span>
                    {record.phone && (
                      <span>
                        <PixelIcon name="phone" /> {formatShort(record.phone.total)}
                      </span>
                    )}
                    {record.steps !== null && record.steps !== undefined && (
                      <span>
                        <PixelIcon name="foot" /> {record.steps.toLocaleString('ko-KR')}
                      </span>
                    )}
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
