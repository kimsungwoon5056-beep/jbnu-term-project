import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PhoneUsage from '../stats/PhoneUsage'
import { batteryLevel, formatClock } from './phone'
import PhoneFrame, { Dock, PushBanner } from './PhoneFrame'

describe('도트 스마트폰 화면', () => {
  it('상태 표시줄 시각은 한국 시간', () => {
    expect(formatClock(new Date('2026-11-17T06:44:00Z'))).toBe('15:44')
    expect(formatClock(new Date('2026-11-17T15:03:00Z'))).toBe('0:03')
  })

  it('배터리(디지털 건강) 색 단계: 80 이상 초록, 60~80 노랑, 그 아래 빨강', () => {
    expect([100, 80, 79, 60, 59, 40].map(batteryLevel)).toEqual(['good', 'good', 'mid', 'mid', 'low', 'low'])
  })

  it('폰 틀: 상태 표시줄 배터리와 권리 안내를 그린다', () => {
    const html = renderToString(
      <PhoneFrame battery={66}>
        <p>내용</p>
      </PhoneFrame>,
    )
    expect(html).toContain('status-bar')
    expect(html).toContain('디지털 건강(배터리) 66%')
    expect(html).toContain('battery-mid')
    expect(html).toContain('비상업 교육용')
  })

  it('독: 지금 화면 버튼에 aria-current, 입력 화면에서는 아래에 고정하지 않음', () => {
    const items = [
      ['home', '캐릭터', 'heart', () => {}],
      ['today', '오늘 기록', 'book', () => {}],
    ]
    const home = renderToString(<Dock current="home" items={items} />)
    expect(home).toContain('aria-current="page"')
    expect(home).toContain('class="dock"')
    const today = renderToString(<Dock current="today" items={items} />)
    expect(today).toContain('dock static')
  })

  it('푸시 알림은 스크린리더에 상태로 알린다', () => {
    const html = renderToString(<PushBanner message="저장했어요!" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('디톡스 PVP · 지금')
  })

  it('스크린 타임 위젯: 기록이 있으면 하루 평균과 앱 막대, 없으면 캡처 버튼', () => {
    const raw = {
      phoneDays: 7,
      phoneTotal: 335,
      topApps: [
        { name: 'Instagram', minutes: 158 * 7 },
        { name: '카카오톡', minutes: 77 * 7 },
      ],
      pickups: 60,
      notifications: 131,
    }
    const html = renderToString(<PhoneUsage raw={raw} known={{ phone: true }} />)
    expect(html).toContain('5시간 35분')
    expect(html).toContain('2시간 38분')
    expect(html).toContain('type-instagram')
    expect(html).toContain('화면 깨우기 <!-- -->60')
    const empty = renderToString(<PhoneUsage raw={{}} known={{ phone: false }} onCapture={() => {}} />)
    expect(empty).toContain('캡처로 불러오기')
  })
})
