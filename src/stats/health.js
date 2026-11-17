// 디지털 건강(%): 스마트폰 과의존 문제가 클수록 낮아진다. 상태 표시줄 배터리와 대결 체력에 쓴다.
// 건강 = 100 × (1 − Σ 가중치 × 문제 정도), 10~100%. 입력하지 않은 항목(폰·걸음)은 판단하지 않는다.
export const PROBLEMS = {
  phoneTotal: { label: '화면 시간', weight: 0.3 },
  lowSteps: { label: '걸음 부족', weight: 0.2 },
  lateNightPhone: { label: '밤 폰', weight: 0.15 },
  pickups: { label: '화면 깨우기', weight: 0.15 },
  notifications: { label: '알림', weight: 0.1 },
}
export const HEALTH_MIN = 10

// 문제 정도(0~1). metrics는 computeMetrics 결과, known은 details.known
export function problemLevels(m, known = {}) {
  const phone = (value) => (known.phone ? value : 0)
  return {
    phoneTotal: phone(m.phoneTotal),
    lowSteps: known.steps ? 1 - m.steps : 0,
    lateNightPhone: phone(m.lateNightPhone),
    pickups: phone(m.pickups),
    notifications: phone(m.notifications),
  }
}

// { percent, levels, causes(큰 순서), known }
export function healthOf(m, known = {}) {
  const levels = problemLevels(m, known)
  const causes = Object.entries(PROBLEMS)
    .map(([key, { label, weight }]) => ({ key, label, weight, level: levels[key], amount: weight * levels[key] }))
    .filter((cause) => cause.amount > 0.0005)
    .sort((a, b) => b.amount - a.amount)
  const penalty = causes.reduce((total, cause) => total + cause.amount, 0)
  const percent = Math.max(HEALTH_MIN, Math.round(100 * (1 - penalty)))
  return { percent, levels, causes, known }
}

// 건강 단계: 캐릭터 얼굴·배경·칭호에 쓴다.
export function healthTier(percent) {
  if (percent >= 80) return 'good'
  if (percent >= 55) return 'mid'
  return 'low'
}
