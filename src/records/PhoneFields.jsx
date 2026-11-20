import { useState } from 'react'
import { clipNumber } from './clip'
import { createEmptyPhone } from './record'
import { formatMinutes } from './recordFormat'
import { PHONE_CATEGORIES, PHONE_LIMITS } from './recordOptions'

const toInt = (text) => {
  const value = Number.parseInt(text, 10)
  return Number.isNaN(value) ? 0 : Math.max(0, value)
}

// 범위를 넘는 숫자는 최댓값으로 맞추되, 말없이 바꾸지 않고 칸 아래에 알려 준다.
function useClip() {
  const [note, setNote] = useState('')
  const clip = (value, max, label) => {
    const result = clipNumber(value, max, label)
    setNote(result.note)
    return result.value
  }
  return { clip, note }
}

function ClipNote({ note }) {
  return note ? (
    <small className="field-note" role="status">
      {note}
    </small>
  ) : null
}

// 분 값을 "시간·분" 두 칸으로 입력한다.
function DurationInput({ label, value, onChange, className = '' }) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  const { clip, note } = useClip()
  const limit = `하루 ${formatMinutes(PHONE_LIMITS.maxMinutes)}`
  return (
    <div className={`duration ${className}`} role="group" aria-label={label}>
      <span className="duration-label">{label}</span>
      <label>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="24"
          value={hours}
          onChange={(e) => onChange(clip(toInt(e.target.value) * 60 + minutes, PHONE_LIMITS.maxMinutes, limit))}
        />
        <span>시간</span>
      </label>
      <label>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="59"
          value={minutes}
          onChange={(e) => onChange(clip(hours * 60 + Math.min(59, toInt(e.target.value)), PHONE_LIMITS.maxMinutes, limit))}
        />
        <span>분</span>
      </label>
      <ClipNote note={note} />
    </div>
  )
}

function CountInput({ label, unit, value, max, onChange, className = '' }) {
  const { clip, note } = useClip()
  return (
    <>
      <label className={`count-input ${className}`}>
        <span>{label}</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max={max}
          value={value}
          onChange={(e) => onChange(clip(toInt(e.target.value), max, `${max.toLocaleString('ko-KR')}${unit}`))}
        />
        <span>{unit}</span>
      </label>
      <ClipNote note={note} />
    </>
  )
}

const APP_LISTS = [
  ['topApps', '많이 쓴 앱', 'minutes', '분'],
  ['pickupApps', '화면을 깨운 뒤 처음 연 앱', 'count', '번'],
  ['notifyApps', '알림이 많은 앱', 'count', '개'],
]

// 앱 목록(이름 + 숫자) 최대 3개
function AppList({ title, field, unit, apps, onChange }) {
  const change = (index, changes) => onChange(apps.map((app, i) => (i === index ? { ...app, ...changes } : app)))
  return (
    <div className="app-list">
      <span className="app-list-title">{title}</span>
      {apps.map((app, index) => (
        <div key={index} className="entry">
          <input
            type="text"
            placeholder="앱 이름"
            value={app.name}
            maxLength={20}
            onChange={(e) => change(index, { name: e.target.value })}
            aria-label={`${title} ${index + 1} 이름`}
          />
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={app[field]}
            onChange={(e) => change(index, { [field]: toInt(e.target.value) })}
            aria-label={`${title} ${index + 1} ${unit}`}
          />
          <span>{unit}</span>
          <button type="button" className="icon-button" onClick={() => onChange(apps.filter((_, i) => i !== index))} aria-label="앱 지우기">
            ✕
          </button>
        </div>
      ))}
      {apps.length < PHONE_LIMITS.maxApps && (
        <button type="button" className="link-button" onClick={() => onChange([...apps, { name: '', [field]: 0 }])}>
          + 앱 추가
        </button>
      )}
    </div>
  )
}

// marked: 캡처에서 읽은 칸 이름 목록. 노란 테두리로 "확인해 주세요"를 표시한다.
const markOf = (marked, field) => (marked.includes(field) ? 'from-capture' : '')

// 스마트폰 사용 입력. 입력하지 않으면 phone은 null(그날은 판단하지 않음)
export function PhoneFields({ phone, onChange, marked = [] }) {
  if (!phone) {
    return (
      <div className="phone-empty">
        <p className="muted">캡처로 불러오거나 직접 입력하세요. 넣지 않으면 그날 스마트폰 사용은 판단하지 않아요.</p>
        <button type="button" className="secondary" onClick={() => onChange(createEmptyPhone())}>
          + 직접 입력하기
        </button>
      </div>
    )
  }
  const set = (changes) => onChange({ ...phone, ...changes })
  const categorySum = Object.values(phone.categories).reduce((total, minutes) => total + minutes, 0)
  return (
    <div className="phone-fields">
      <DurationInput label="총 화면 시간" value={phone.total} onChange={(total) => set({ total })} className={markOf(marked, 'total')} />
      <details className={`phone-more ${markOf(marked, 'categories')}`} open={categorySum > 0}>
        <summary>종류별 시간 (합 {formatMinutes(categorySum)})</summary>
        {Object.entries(PHONE_CATEGORIES).map(([key, option]) => (
          <DurationInput
            key={key}
            label={option.label}
            value={phone.categories[key]}
            onChange={(minutes) => set({ categories: { ...phone.categories, [key]: minutes } })}
          />
        ))}
      </details>
      <CountInput
        label="화면 깨우기"
        unit="번"
        value={phone.pickups}
        max={PHONE_LIMITS.maxPickups}
        onChange={(pickups) => set({ pickups })}
        className={markOf(marked, 'pickups')}
      />
      <CountInput
        label="알림"
        unit="개"
        value={phone.notifications}
        max={PHONE_LIMITS.maxNotifications}
        onChange={(notifications) => set({ notifications })}
        className={markOf(marked, 'notifications')}
      />
      <label className={`count-input ${markOf(marked, 'firstPickup')}`}>
        <span>화면을 처음 깨운 시각</span>
        <input type="time" value={phone.firstPickup} onChange={(e) => set({ firstPickup: e.target.value })} />
      </label>
      <details
        className={`phone-more ${['topApps', 'pickupApps', 'notifyApps'].some((field) => marked.includes(field)) ? 'from-capture' : ''}`}
        open={phone.topApps.length + phone.pickupApps.length + phone.notifyApps.length > 0}
      >
        <summary>앱 목록 (선택)</summary>
        {APP_LISTS.map(([key, title, field, unit]) => (
          <AppList key={key} title={title} field={field} unit={unit} apps={phone[key]} onChange={(apps) => set({ [key]: apps })} />
        ))}
      </details>
      <button type="button" className="link-button" onClick={() => onChange(null)}>
        스마트폰 기록 빼기
      </button>
    </div>
  )
}

// 걸음 수. 비우면 null
export function StepsField({ steps, onChange, marked = [] }) {
  const { clip, note } = useClip()
  return (
    <>
    <label className={`count-input ${markOf(marked, 'steps')}`}>
      <span>오늘 걸음</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        max={PHONE_LIMITS.maxSteps}
        placeholder="모름"
        value={steps ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : clip(toInt(e.target.value), PHONE_LIMITS.maxSteps, `${PHONE_LIMITS.maxSteps.toLocaleString('ko-KR')}보`))}
      />
      <span>걸음</span>
    </label>
    <ClipNote note={note} />
    </>
  )
}
