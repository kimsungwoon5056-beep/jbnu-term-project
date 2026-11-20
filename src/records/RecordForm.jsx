import { useEffect, useState } from 'react'
import Loading from '../ui/Loading'
import PixelIcon from '../ui/PixelIcon'
import CaptureImport from './CaptureImport'
import { PhoneFields, StepsField } from './PhoneFields'
import { createEmptyRecord } from './record'
import { formatDateLabel } from './recordFormat'
import { useRepositories } from '../data/repositories'

function FieldError({ message }) {
  if (!message) return null
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  )
}

// 하루 기록 입력: 캡처로 불러오기 → 확인 → 저장. 스마트폰 사용과 걸음 수만 받는다.
function RecordForm({ dateKey, todayKey, onDone, focusCapture = false }) {
  const { records } = useRepositories()
  const [loadState, setLoadState] = useState({ status: 'loading', message: '' })
  const [record, setRecord] = useState(() => createEmptyRecord(dateKey))
  const [exists, setExists] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [marked, setMarked] = useState([]) // 캡처에서 읽은 칸

  useEffect(() => {
    let active = true
    records.load(dateKey).then((current) => {
      if (!active) return
      if (!current.ok) {
        setLoadState({ status: 'error', message: current.message })
        return
      }
      setExists(Boolean(current.record))
      if (current.record) setRecord(current.record)
      setLoadState({ status: 'ready', message: '' })
    })
    return () => {
      active = false
    }
  }, [records, dateKey])

  // 홈의 "캡처로 불러오기"로 열었으면 캡처 버튼으로 이동한다.
  useEffect(() => {
    if (!focusCapture || loadState.status !== 'ready') return
    document.querySelector('.capture-button input')?.focus()
  }, [focusCapture, loadState.status])

  const update = (changes) => setRecord((current) => ({ ...current, ...changes }))

  async function handleSubmit(event) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    const result = await records.save(record, todayKey)
    if (result.ok) {
      onDone('저장했어요! 캐릭터가 바로 바뀌었어요.')
      return
    }
    setErrors(result.errors ?? {})
    setMessage(result.errors?.empty ?? result.message)
    setPending(false)
  }

  async function handleDelete() {
    if (!window.confirm(`${formatDateLabel(dateKey, todayKey)} 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setPending(true)
    setMessage('')
    const result = await records.remove(dateKey, todayKey)
    if (result.ok) {
      onDone('기록을 지웠어요.')
      return
    }
    setMessage(result.message)
    setPending(false)
  }

  // 캡처에서 읽은 값만 덮어쓴다(읽지 못한 칸은 그대로).
  function applyCapture(result) {
    setRecord((current) => {
      const next = { ...current }
      if (result.phone) {
        const picked = Object.fromEntries(result.filled.filter((field) => field !== 'steps').map((field) => [field, result.phone[field]]))
        next.phone = current.phone ? { ...current.phone, ...picked } : result.phone
      }
      if (result.steps !== null) next.steps = result.steps
      return next
    })
    setMarked(result.filled)
  }

  if (loadState.status === 'loading') return <Loading text="기록을 불러오고 있어요…" />
  if (loadState.status === 'error') {
    return (
      <div className="notice">
        <p className="form-error" role="alert">
          {loadState.message}
        </p>
        <button type="button" className="secondary" onClick={() => onDone()}>
          홈으로
        </button>
      </div>
    )
  }

  return (
    <form className="record-form" onSubmit={handleSubmit} noValidate>
      <div className="form-title">
        <h2>{formatDateLabel(dateKey, todayKey)}</h2>
        <span className="muted">{exists ? '저장된 기록을 고칩니다' : '새 기록'}</span>
      </div>

      <fieldset className="card phone-card" disabled={pending}>
        <legend>
          <PixelIcon name="phone" /> 스크린 타임
        </legend>
        <CaptureImport onResult={applyCapture} disabled={pending} />
        <PhoneFields phone={record.phone} onChange={(phone) => update({ phone })} marked={marked} />
        <FieldError message={errors.phone} />
      </fieldset>

      <fieldset className="card" disabled={pending}>
        <legend>
          <PixelIcon name="foot" /> 걸음 수
        </legend>
        <StepsField steps={record.steps} onChange={(steps) => update({ steps })} marked={marked} />
        <FieldError message={errors.steps} />
      </fieldset>

      <FieldError message={message} />

      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? '처리 중…' : '저장'}
        </button>
        <button type="button" className="secondary" onClick={() => onDone()} disabled={pending}>
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
