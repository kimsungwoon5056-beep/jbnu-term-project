import { formatMinutes } from '../records/recordFormat'
import PixelIcon from '../ui/PixelIcon'
import { usageSegments } from './usage'
import './stats.css'

// 스크린 타임 위젯: 오늘(raw.span === 'today') 또는 최근 7일 중 입력한 날의 하루 평균(입력값 그대로)
// 화면 시간 + 앱 막대 하나(많이 쓴 앱 3개 + 기타), 화면 깨우기·알림. 기록이 없으면 캡처로 불러오기를 권한다.
function PhoneUsage({ raw, known, onCapture }) {
  if (!known?.phone) {
    return (
      <section className="panel phone-usage empty" aria-label="스크린 타임">
        <h3 className="panel-title">
          <PixelIcon name="phone" /> 스크린 타임
        </h3>
        <p className="muted">스크린 타임 캡처를 넣으면 많이 쓴 앱이 내 캐릭터에 스며들어요.</p>
        {onCapture && (
          <button type="button" onClick={onCapture}>
            캡처로 불러오기
          </button>
        )}
      </section>
    )
  }

  const segments = usageSegments(raw)
  return (
    <section className="panel phone-usage" aria-label="스크린 타임">
      <div className="usage-head">
        <h3 className="panel-title">
          <PixelIcon name="phone" /> 스크린 타임 <span className="muted">{raw.span === 'today' ? '오늘' : '하루 평균'}</span>
        </h3>
        <p className="usage-total">{formatMinutes(raw.phoneTotal)}</p>
      </div>
      {segments.length > 0 && (
        <>
          <span className="usage-stack" aria-hidden="true">
            {segments.map((segment) => (
              <span key={segment.name} className={`usage-dot type-${segment.type}`} style={{ flexGrow: segment.minutes }} />
            ))}
          </span>
          <ul className="usage-legend">
            {segments.map((segment) => (
              <li key={segment.name}>
                <span className={`usage-dot type-${segment.type}`} aria-hidden="true" />
                <span className="usage-name">{segment.name}</span>
                <span className="usage-time">{formatMinutes(segment.minutes)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="usage-counts">
        <span>
          <PixelIcon name="phone" /> 화면 깨우기 {raw.pickups}번
        </span>
        <span>
          <PixelIcon name="bell" /> 알림 {raw.notifications}개
        </span>
      </p>
    </section>
  )
}

export default PhoneUsage
