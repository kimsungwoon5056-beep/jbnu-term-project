import { useEffect, useState } from 'react'

// 도트 스마트폰 화면의 작은 도우미들(순수 함수 + 시계 훅)

// 한국 시간 "9:05"
export function formatClock(date) {
  const minutes = (date.getUTCHours() * 60 + date.getUTCMinutes() + 9 * 60) % (24 * 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

// 배터리 = 몬스터 건강(0~100%). 80% 이상 초록, 60~80 노랑, 그 아래 빨강
export function batteryLevel(percent) {
  if (percent >= 80) return 'good'
  if (percent >= 60) return 'mid'
  return 'low'
}

// 30초마다 다시 그리는 시계
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(timer)
  }, [])
  return formatClock(now)
}
