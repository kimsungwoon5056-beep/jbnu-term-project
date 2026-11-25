import { useEffect } from 'react'
import { batteryLevel, skyOf, useClock } from './phone'
import PixelIcon from './PixelIcon'

// 상태 표시줄: 시각, 신호·와이파이, 배터리(= 디지털 건강)
export function StatusBar({ battery = 100 }) {
  const clock = useClock()
  const level = batteryLevel(battery)
  const unknown = battery == null
  return (
    <div className="status-bar">
      <span className="status-clock">{clock}</span>
      <span className="status-icons">
        <span className="signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={`battery battery-${level}`} role="img" aria-label={unknown ? '디지털 건강(배터리) 모름' : `디지털 건강(배터리) ${battery}%`}>
          <span className="battery-fill" style={{ width: `${unknown ? 50 : Math.max(6, battery)}%` }} />
        </span>
        <span className={`battery-text battery-${level}`}>{unknown ? '?' : battery}%</span>
      </span>
    </div>
  )
}

// 도트 스마트폰 틀: 데스크톱에서는 베젤·노치·홈 막대가 보이고, 휴대폰 폭에서는 화면만 남는다.
function PhoneFrame({ battery, children }) {
  // 하늘은 지금 시각을 따라 낮·노을·밤으로 바뀐다.
  const sky = skyOf(useClock())
  useEffect(() => {
    document.body.dataset.sky = sky
  }, [sky])
  return (
    <div className="phone">
      <div className={`phone-screen sky-${sky}`}>
        <StatusBar battery={battery} />
        {children}
        <p className="legal-note">
          앱 이름·로고의 권리는 각 회사에 있습니다. 이 앱은 비상업 교육용 과제입니다.
        </p>
      </div>
    </div>
  )
}

// 아래 독: 앱 아이콘 모양 버튼. items: [키, 이름, 아이콘, 누르면 할 일]
export function Dock({ current, items }) {
  return (
    // 홈에서는 화면 아래에 붙고, 입력 화면에서는 저장 버튼과 겹치지 않게 맨 아래에 둔다.
    <nav className={current === 'home' ? 'dock' : 'dock static'} aria-label="화면 이동">
      {items.map(([key, label, icon, onClick]) => (
        <button key={key} type="button" className="dock-button" aria-current={current === key ? 'page' : undefined} onClick={onClick}>
          <span className={`dock-icon dock-${key}`}>
            <PixelIcon name={icon} />
          </span>
          <span className="dock-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}

// 푸시 알림 배너(저장·삭제 알림)
export function PushBanner({ message }) {
  return (
    <div className="push-banner" role="status">
      <span className="push-icon">
        <PixelIcon name="phone" />
      </span>
      <span className="push-text">
        <span className="push-app">디톡스 PVP · 지금</span>
        <strong>{message}</strong>
      </span>
    </div>
  )
}

export default PhoneFrame
