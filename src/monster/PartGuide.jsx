import './PartGuide.css'

// 부위 설명: 부위 버튼을 누르면 그 부위가 왜 이렇게 생겼는지 최근 7일 기록 숫자로 보여 준다.
// 선택 상태는 MonsterStats가 들고 있어, 몬스터 그림을 눌러도 같은 부위가 선택된다.
function PartGuide({ entries, selected, onSelect }) {
  const current = entries.find((entry) => entry.key === selected) ?? entries[0]
  if (!current) return null

  return (
    <div className="part-guide">
      <p className="part-guide-title">왜 이렇게 생겼을까? 부위를 눌러 보세요.</p>
      <div className="part-buttons" role="group" aria-label="부위 고르기">
        {entries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className="part-button"
            aria-pressed={entry.key === current.key}
            onClick={() => onSelect(entry.key)}
          >
            {entry.title}
          </button>
        ))}
      </div>
      <div className="part-bubble" aria-live="polite">
        <p className="part-bubble-head">
          <strong>{current.title}</strong> · {current.label}
        </p>
        <p>{current.reason}</p>
        {current.next && (
          <p className="part-next">
            다음 후보: {current.next.when} → {current.next.label}
          </p>
        )}
      </div>
      <p className="muted part-note">같은 생활이라도 계정마다 조금 다른 부위가 나올 수 있어요.</p>
    </div>
  )
}

export default PartGuide
