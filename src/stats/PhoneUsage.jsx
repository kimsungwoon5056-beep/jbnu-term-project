import { appIconOf, archetypeOfApp } from '../capture/appArchetypes'
import { formatMinutes } from '../records/recordFormat'
import PixelIcon from '../ui/PixelIcon'

// 스크린 타임 위젯: 최근 7일 중 스마트폰을 입력한 날의 하루 평균(입력값 그대로)
// 화면 시간, 많이 쓴 앱 3개 막대, 화면 깨우기·알림. 기록이 없으면 캡처로 불러오기를 권한다.
function PhoneUsage({ raw, known, onCapture }) {
  if (!known?.phone) {
    return (
      <section className="panel phone-usage empty" aria-label="스크린 타임">
        <h3 className="panel-title">
          <PixelIcon name="phone" /> 스크린 타임
        </h3>
        <p className="muted">스크린 타임 캡처를 넣으면 많이 쓴 앱이 몬스터의 몸이 돼요.</p>
        {onCapture && (
          <button type="button" onClick={onCapture}>
            캡처로 불러오기
          </button>
        )}
      </section>
    )
  }

  const days = Math.max(1, raw.phoneDays)
  const apps = (raw.topApps ?? []).map((app) => ({ ...app, daily: Math.round(app.minutes / days) }))
  const longest = Math.max(1, ...apps.map((app) => app.daily))
  return (
    <section className="panel phone-usage" aria-label="스크린 타임">
      <h3 className="panel-title">
        <PixelIcon name="phone" /> 스크린 타임 <span className="muted">하루 평균</span>
      </h3>
      <p className="usage-total">{formatMinutes(raw.phoneTotal)}</p>
      {apps.length > 0 && (
        <ul className="usage-apps">
          {apps.map((app) => (
            <li key={app.name}>
              <span className={`usage-dot type-${appIconOf(app.name) ?? archetypeOfApp(app.name) ?? 'other'}`} aria-hidden="true" />
              <span className="usage-name">{app.name}</span>
              <span className="usage-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((app.daily / longest) * 100)}%` }} />
              </span>
              <span className="usage-time">{formatMinutes(app.daily)}</span>
            </li>
          ))}
        </ul>
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
