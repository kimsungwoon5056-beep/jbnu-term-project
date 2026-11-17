import { healthTier, PROBLEMS } from './health'

// 디지털 건강 위젯: 큰 %와 문제별 막대 5개(막대가 길수록 건강을 많이 깎음)
function HealthWidget({ health }) {
  const tier = healthTier(health.percent)
  return (
    <section className={`panel health-widget health-${tier}`} aria-label="디지털 건강">
      <div className="health-top">
        <h3 className="panel-title">디지털 건강</h3>
        <p className="health-percent">
          <strong>{health.percent}</strong>%
        </p>
      </div>
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
