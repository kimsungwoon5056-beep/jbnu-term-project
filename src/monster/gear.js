// 장비와 스마트폰 상태 표시.
// 많이 쓴 앱은 "앱 조각"(appGrafts.js)으로 몸 자체가 되고, 여기서는 건강한 습관의 장비(운동화)와
// 폰 습관의 상태 표시(알림 배지·떨림·거북목)만 정한다.

export const GEAR = {
  none: { label: '없음' },
  sneakers: { label: '운동화', prefix: '운동화', desc: '많이 걸으면 운동화를 신는다.' },
}

// 하루 8,000보 이상(steps 0.6) 걸으면 운동화
export const GEAR_RULES = { minSteps: 0.6 }

export function chooseGear(m, known = {}) {
  if (known.steps && m.steps >= GEAR_RULES.minSteps) return { kind: 'sneakers' }
  return { kind: 'none' }
}

// 상태 표시: 알림 배지(0~2), 산만함 떨림(화면 깨우기), 거북목(화면 시간, 0~2칸)
export function phoneStatus(m, known = {}) {
  if (!known.phone) return { badge: 0, jitter: false, slouch: 0 }
  return {
    badge: m.notifications >= 0.6 ? 2 : m.notifications >= 0.25 ? 1 : 0,
    jitter: m.pickups >= 0.4,
    slouch: m.phoneTotal >= 0.6 ? 2 : m.phoneTotal >= 0.35 ? 1 : 0,
  }
}
