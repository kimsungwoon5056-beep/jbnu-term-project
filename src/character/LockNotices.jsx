import { useState } from 'react'
import PixelIcon from '../ui/PixelIcon'
import './LockNotices.css'
import { VISIBLE_NOTICES } from './notifications'

function NoticeIcon({ icon }) {
  if (icon.dot) return <span className={`notice-icon usage-dot type-${icon.dot}`} aria-hidden="true" />
  return (
    <span className="notice-icon notice-icon-pixel" aria-hidden="true">
      <PixelIcon name={icon.pixel} />
    </span>
  )
}

// 잠금 화면 알림 카드: 누르면 그 부위가 반짝이고(openKey) 이유와 다음 목표가 펼쳐진다. 다시 누르면 접힌다.
// cta: 기록이 없을 때 맨 위에 붙는 "캡처로 불러오기" 알림. visible: 처음에 보여 줄 장 수
function LockNotices({ notices, openKey, onToggle, cta = null, visible = VISIBLE_NOTICES }) {
  const [more, setMore] = useState(false)
  // 접힌 알림을 그림에서 골랐으면 그 한 장만 덧붙인다(나머지는 계속 접어 둔다).
  const shown = more ? notices : notices.filter((notice, i) => i < visible || notice.key === openKey)
  const hidden = notices.length - visible

  return (
    <section className="lock-notices" aria-label="오늘의 알림: 부위 설명">
      {cta && (
        <div className="notice-card notice-cta">
          <NoticeIcon icon={{ pixel: 'phone' }} />
          <span className="notice-body">
            <span className="notice-top">
              <strong>디톡스 PVP</strong>
              <span className="notice-part">지금</span>
            </span>
            <span className="notice-effect">{cta.text}</span>
          </span>
          <button type="button" onClick={cta.onClick}>
            {cta.label}
          </button>
        </div>
      )}
      <ul className="notice-list">
        {shown.map((notice) => {
          const open = notice.key === openKey
          const detailId = `notice-${notice.key}`
          return (
            <li key={notice.key} className={`notice-item${notice.loud ? ' loud' : ''}${open ? ' open' : ''}`}>
              <button
                type="button"
                className="notice-card"
                aria-expanded={open}
                aria-controls={open ? detailId : undefined}
                onClick={() => onToggle(open ? null : notice.key)}
              >
                <NoticeIcon icon={notice.icon} />
                <span className="notice-body">
                  <span className="notice-top">
                    <strong className="notice-headline">{notice.headline}</strong>
                    <span className="notice-part">{notice.title}</span>
                  </span>
                  <span className="notice-effect">{notice.effect}</span>
                </span>
              </button>
              {open && (
                <div className="notice-detail" id={detailId} aria-live="polite">
                  <p>{notice.reason}</p>
                  {notice.next && (
                    <p className="notice-next">
                      {notice.next.when} → <strong>{notice.next.label}</strong>
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" className="notice-more" aria-expanded={more} onClick={() => setMore((value) => !value)}>
          {more ? '알림 접기' : `알림 ${notices.length - shown.length}개 더 보기`}
        </button>
      )}
    </section>
  )
}

export default LockNotices
