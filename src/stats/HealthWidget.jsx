import { healthTier, PROBLEMS } from './health'
import './stats.css'

// 디지털 건강 띠: 무대 바로 아래 큰 % + 배터리 막대. 문제별 막대 5개(길수록 건강을 많이 깎음)는 "자세히"로 펼친다.
function HealthWidget({ health }) {
  const tier = health.measured ? healthTier(health.percent) : 'unknown'
  return (
    <section className={`panel health-strip health-${tier}`} aria-label="디지털 건강">
      <div className="health-top">
        <h3 className="panel-title">디지털 건강</h3>
        <span className="health-battery" aria-hidden="true">
          <span style={{ width: health.measured ? `${health.percent}%` : '0%' }} />
        </span>
        <p className="health-percent">
          <strong>{health.measured ? health.percent : '?'}</strong>%
        </p>
      </div>
      {!health.measured && <p className="health-note muted">스크린 타임을 기록하면 디지털 건강이 나와요. 그전까지 대결에서는 50%로 계산해요.</p>}
      <details className="health-more">
        <summary>자세히 · 무엇이 건강을 깎았나</summary>
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
      </details>
    </section>
  )
}

export default HealthWidget
