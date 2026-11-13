import { useEffect, useState } from 'react'
import { addDays } from './dateKey'
import { createEmptyRecord, sleepMinutes } from './record'
import { copyRecordTo } from './recordDoc'
import { formatDateLabel, formatMinutes, MOODS } from './recordFormat'
import { LIMITS, SUGGESTED_SUBJECTS, WORKOUT_TYPES } from './recordOptions'
import { deleteRecord, loadRecord, saveRecord } from './recordStore'

const STEP = 15
const SLIDER_MAX = 300

function FieldError({ message }) {
  if (!message) return null
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  )
}

function MinutesSlider({ label, value, onChange, disabled }) {
  return (
    <label className="slider">
      <span className="sr-only">{label} 시간</span>
      <input
        type="range"
        min={STEP}
        max={Math.max(SLIDER_MAX, value)}
        step={STEP}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
      />
      <span className="slider-value">{formatMinutes(value)}</span>
    </label>
  )
}

// 30초 기록 입력. 처음 열면 그날 기록, 없으면 전날 기록, 그것도 없으면 빈 기록을 보여 준다.
function RecordForm({ uid, dateKey, todayKey, onDone }) {
  const [loadState, setLoadState] = useState({ status: 'loading', message: '' })
  const [record, setRecord] = useState(() => createEmptyRecord(dateKey))
  const [exists, setExists] = useState(false)
  const [previous, setPrevious] = useState(null)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [subjectDraft, setSubjectDraft] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([loadRecord(uid, dateKey), loadRecord(uid, addDays(dateKey, -1))]).then(([current, before]) => {
      if (!active) return
      if (!current.ok || !before.ok) {
        setLoadState({ status: 'error', message: current.ok ? before.message : current.message })
        return
      }
      setExists(Boolean(current.record))
      setPrevious(before.record)
      if (current.record) setRecord(current.record)
      else if (before.record) setRecord(copyRecordTo(before.record, dateKey))
      setLoadState({ status: 'ready', message: '' })
    })
    return () => {
      active = false
    }
  }, [uid, dateKey])

  const update = (changes) => setRecord((current) => ({ ...current, ...changes }))
  const updateItem = (field, index, changes) =>
    setRecord((current) => ({
      ...current,
      [field]: current[field].map((item, i) => (i === index ? { ...item, ...changes } : item)),
    }))
  const removeItem = (field, index) =>
    setRecord((current) => ({ ...current, [field]: current[field].filter((_, i) => i !== index) }))
  const addItem = (field, item) => setRecord((current) => ({ ...current, [field]: [...current[field], item] }))

  async function save(target) {
    setPending(true)
    setMessage('')
    const result = await saveRecord(uid, target, todayKey)
    if (result.ok) {
      onDone()
      return
    }
    setErrors(result.errors ?? {})
    setMessage(result.message)
    setPending(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    save(record)
  }

  function sameAsYesterday() {
    const copied = copyRecordTo(previous, dateKey)
    setRecord(copied)
    save(copied)
  }

  async function handleDelete() {
    if (!window.confirm(`${formatDateLabel(dateKey, todayKey)} 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setPending(true)
    setMessage('')
    const result = await deleteRecord(uid, dateKey, todayKey)
    if (result.ok) {
      onDone()
      return
    }
    setMessage(result.message)
    setPending(false)
  }

  function addSubject(subject) {
    const name = subject.trim()
    if (!name) return
    addItem('studies', { subject: name, minutes: 60 })
    setSubjectDraft('')
  }

  if (loadState.status === 'loading') return <p className="muted">기록을 불러오고 있습니다…</p>
  if (loadState.status === 'error') {
    return (
      <div className="notice">
        <p className="form-error" role="alert">
          {loadState.message}
        </p>
        <button type="button" className="secondary" onClick={onDone}>
          목록으로
        </button>
      </div>
    )
  }

  const { sleep, workouts, studies, meals, customHabits } = record
  const full = (list, max) => list.length >= max

  return (
    <form className="record-form" onSubmit={handleSubmit} noValidate>
      <div className="form-title">
        <h2>{formatDateLabel(dateKey, todayKey)}</h2>
        <span className="muted">{exists ? '저장된 기록을 고칩니다' : previous ? '전날 기록을 불러왔어요' : '새 기록'}</span>
      </div>

      {previous && !exists && (
        <button type="button" className="secondary wide" onClick={sameAsYesterday} disabled={pending}>
          {dateKey === todayKey ? '어제와' : '전날과'} 같음 (바로 저장)
        </button>
      )}

      <fieldset className="card" disabled={pending}>
        <legend>수면</legend>
        <div className="row">
          <label>
            잠든 시각
            <input type="time" value={sleep.bedTime} onChange={(e) => update({ sleep: { ...sleep, bedTime: e.target.value } })} />
          </label>
          <label>
            일어난 시각
            <input type="time" value={sleep.wakeTime} onChange={(e) => update({ sleep: { ...sleep, wakeTime: e.target.value } })} />
          </label>
        </div>
        {sleep.bedTime && sleep.wakeTime && (
          <p className="muted">수면 {formatMinutes(sleepMinutes(sleep.bedTime, sleep.wakeTime))}</p>
        )}
        <FieldError message={errors.sleep} />
      </fieldset>

      <fieldset className="card" disabled={pending}>
        <legend>운동</legend>
        <div className="chips">
          {Object.entries(WORKOUT_TYPES).map(([type, option]) => (
            <button
              key={type}
              type="button"
              className="chip"
              onClick={() => addItem('workouts', { type, minutes: 30 })}
              disabled={full(workouts, LIMITS.maxEntries)}
            >
              + {option.label}
            </button>
          ))}
        </div>
        {workouts.map((entry, index) => (
          <div key={index} className="entry">
            <span className="entry-name">{WORKOUT_TYPES[entry.type]?.label ?? entry.type}</span>
            <MinutesSlider
              label={WORKOUT_TYPES[entry.type]?.label ?? '운동'}
              value={entry.minutes}
              onChange={(minutes) => updateItem('workouts', index, { minutes })}
            />
            <button type="button" className="icon-button" onClick={() => removeItem('workouts', index)} aria-label="운동 지우기">
              ✕
            </button>
          </div>
        ))}
        {workouts.length === 0 && <p className="muted">오늘 한 운동을 눌러 추가하세요. 없으면 그대로 두면 됩니다.</p>}
        <FieldError message={errors.workouts} />
      </fieldset>

      <fieldset className="card" disabled={pending}>
        <legend>공부</legend>
        <div className="chips">
          {SUGGESTED_SUBJECTS.map((subject) => (
            <button
              key={subject}
              type="button"
              className="chip"
              onClick={() => addSubject(subject)}
              disabled={full(studies, LIMITS.maxEntries)}
            >
              + {subject}
            </button>
          ))}
        </div>
        <div className="row">
          <input
            type="text"
            placeholder="다른 과목"
            value={subjectDraft}
            maxLength={LIMITS.maxNameLength}
            onChange={(e) => setSubjectDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSubject(subjectDraft)
              }
            }}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => addSubject(subjectDraft)}
            disabled={!subjectDraft.trim() || full(studies, LIMITS.maxEntries)}
          >
            추가
          </button>
        </div>
        {studies.map((entry, index) => (
          <div key={index} className="entry">
            <span className="entry-name">{entry.subject}</span>
            <MinutesSlider
              label={entry.subject}
              value={entry.minutes}
              onChange={(minutes) => updateItem('studies', index, { minutes })}
            />
            <button type="button" className="icon-button" onClick={() => removeItem('studies', index)} aria-label="공부 지우기">
              ✕
            </button>
          </div>
        ))}
        <FieldError message={errors.studies} />
      </fieldset>

      <fieldset className="card" disabled={pending}>
        <legend>식사</legend>
        <div className="row">
          <div className="stepper" role="group" aria-label="끼니 수">
            <button
              type="button"
              className="secondary"
              onClick={() => update({ meals: { ...meals, count: meals.count - 1 } })}
              disabled={meals.count <= 0}
              aria-label="끼니 줄이기"
            >
              −
            </button>
            <span>{meals.count}끼</span>
            <button
              type="button"
              className="secondary"
              onClick={() => update({ meals: { ...meals, count: meals.count + 1 } })}
              disabled={meals.count >= LIMITS.maxMeals}
              aria-label="끼니 늘리기"
            >
              +
            </button>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={meals.lateSnack}
              onChange={(e) => update({ meals: { ...meals, lateSnack: e.target.checked } })}
            />
            야식 먹음
          </label>
        </div>
        <FieldError message={errors.meals} />
      </fieldset>

      <fieldset className="card" disabled={pending}>
        <legend>기분</legend>
        <div className="moods">
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              type="button"
              className={record.mood === mood.value ? 'mood selected' : 'mood'}
              aria-pressed={record.mood === mood.value}
              aria-label={mood.label}
              title={mood.label}
              onClick={() => update({ mood: mood.value })}
            >
              {mood.face}
            </button>
          ))}
        </div>
        <FieldError message={errors.mood} />
      </fieldset>

      <fieldset className="card" disabled={pending}>
        <legend>나만의 습관</legend>
        {customHabits.map((habit, index) => (
          <div key={index} className="entry">
            <input
              type="checkbox"
              checked={habit.done}
              onChange={(e) => updateItem('customHabits', index, { done: e.target.checked })}
              aria-label={`${habit.name || '습관'} 완료`}
            />
            <input
              type="text"
              placeholder="예: 물 2L 마시기"
              value={habit.name}
              maxLength={LIMITS.maxNameLength}
              onChange={(e) => updateItem('customHabits', index, { name: e.target.value })}
            />
            <button type="button" className="icon-button" onClick={() => removeItem('customHabits', index)} aria-label="습관 지우기">
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => addItem('customHabits', { name: '', done: true })}
          disabled={full(customHabits, LIMITS.maxCustomHabits)}
        >
          + 습관 추가 ({customHabits.length}/{LIMITS.maxCustomHabits})
        </button>
        <FieldError message={errors.customHabits} />
      </fieldset>

      <FieldError message={message} />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? '처리 중…' : '저장'}
        </button>
        <button type="button" className="secondary" onClick={onDone} disabled={pending}>
          취소
        </button>
        {exists && (
          <button type="button" className="danger" onClick={handleDelete} disabled={pending}>
            삭제
          </button>
        )}
      </div>
    </form>
  )
}

export default RecordForm
