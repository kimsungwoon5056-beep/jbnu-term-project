import { healthTier, PROBLEMS } from './health'

// 디지털 건강 위젯: 큰 %와 문제별 막대 5개(막대가 길수록 건강을 많이 깎음)
function HealthWidget({ health }) {
  const tier = health.measured ? healthTier(health.percent) : 'unknown'
  return (
    <section className={`panel health-widget health-${tier}`} aria-label="디지털 건강">
      <div className="health-top">
        <h3 className="panel-title">디지털 건강</h3>
        <p className="health-percent">
          <strong>{health.measured ? health.percent : '?'}</strong>%
        </p>
      </div>
      {!health.measured && <p className="health-note muted">스크린 타임을 기록하면 디지털 건강이 나와요. 그전까지 대결에서는 50%로 계산해요.</p>}
      <ul className="health-bars">
        {Object.entries(PROBLEMS).map(([key, { label, weight }]) => {
          const known = key === 'lowSteps' ? health.known.steps : health.known.phone
          const minus = Math.round(weight * health.levels[key] * 100)
          return (
            <li key={key}>
              <span className="health-name">{label}</span>
              <span className="health-track" aria-hidden="true">
                <span style={{ width: `${Math.round(health.levels[key] * 100)}%` }} />
              </span>
              <span className="health-minus">{known ? (minus > 0 ? `−${minus}%` : '좋음') : '모름'}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default HealthWidget
