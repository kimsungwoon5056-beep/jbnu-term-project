import { useMemo, useState } from 'react'
import { drawCharacter } from '../character/drawCharacter'
import { PLAIN_STATE } from '../character/state'
import PixelSprite from '../pixel/PixelSprite'
import { DEFAULT_LOOK, LOOK_KEYS, LOOK_OPTIONS, NICKNAME_RANGE, validateProfile } from './look'
import './profile.css'

// 색 고르기는 색 칸, 나머지는 글자 칩
function Choices({ field, value, onChange, disabled }) {
  const { label, choices } = LOOK_OPTIONS[field]
  return (
    <fieldset className="look-field" disabled={disabled}>
      <legend>{label}</legend>
      <div className="look-choices" role="radiogroup" aria-label={label}>
        {Object.entries(choices).map(([key, choice]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            className={choice.color ? 'look-swatch' : 'chip look-chip'}
            style={choice.color ? { '--swatch': choice.color } : undefined}
            title={choice.label}
            onClick={() => onChange(key)}
          >
            {choice.color ? <span className="sr-only">{choice.label}</span> : choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// 내 모습 만들기: 닉네임과 모습(피부색·머리 모양·머리색·안경). 가입할 때, 그리고 언제든 고칠 때 쓴다.
// onSubmit(profile) → { ok, message, errors }
function ProfileForm({ initial, title = '내 모습 만들기', submitText = '이 모습으로 시작', onSubmit, onCancel }) {
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [look, setLook] = useState(initial?.look ?? DEFAULT_LOOK)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const sprite = useMemo(() => drawCharacter(look, PLAIN_STATE, { scene: true }), [look])

  async function handleSubmit(event) {
    event.preventDefault()
    const profile = { nickname, look }
    const found = validateProfile(profile)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setPending(true)
    setMessage('')
    const result = await onSubmit(profile)
    if (!result.ok) {
      setErrors(result.errors ?? {})
      setMessage(result.message)
      setPending(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>
      <h2>{title}</h2>
      <p className="muted">나를 닮게 골라 주세요. 이 모습 위에 오늘의 폰 사용이 입혀져요.</p>
      <div className="profile-preview">
        <PixelSprite sprite={sprite} label="내 캐릭터 미리보기" scale={4} />
      </div>
      <label>
        닉네임
        <input
          type="text"
          value={nickname}
          maxLength={NICKNAME_RANGE.max}
          onChange={(event) => setNickname(event.target.value)}
          placeholder={`${NICKNAME_RANGE.min}~${NICKNAME_RANGE.max}자`}
          disabled={pending}
          autoComplete="nickname"
        />
      </label>
      <p className="muted field-note">대결에서 상대에게 보이는 이름이에요. 실명은 쓰지 않아도 돼요.</p>
      {errors.nickname && (
        <p className="form-error" role="alert">
          {errors.nickname}
        </p>
      )}
      {LOOK_KEYS.map((field) => (
        <Choices key={field} field={field} value={look[field]} onChange={(value) => setLook({ ...look, [field]: value })} disabled={pending} />
      ))}
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={pending}>
          {pending ? '저장 중…' : submitText}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel} disabled={pending}>
            취소
          </button>
        )}
      </div>
    </form>
  )
}

export default ProfileForm
