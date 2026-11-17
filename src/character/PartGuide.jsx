import './PartGuide.css'

// 부위 설명: 부위 버튼을 누르면 그 부위가 왜 이렇게 생겼는지 오늘 숫자로 보여 준다.
// 선택 상태는 CharacterHome이 들고 있어, 캐릭터 그림을 눌러도 같은 부위가 선택된다.
function PartGuide({ entries, selected, onSelect }) {
  const current = entries.find((entry) => entry.key === selected) ?? entries[0]
  if (!current) return null

  return (
    <section className="panel part-guide" aria-label="부위 설명">
      <h3 className="panel-title">왜 이렇게 생겼을까?</h3>
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
            {current.next.when} → {current.next.label}
          </p>
        )}
      </div>
    </section>
  )
}

export default PartGuide
