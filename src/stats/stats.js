import { WINDOW_DAYS } from './metrics'

// 능력치: "총합은 꾸준함, 배분은 생활" (설계안 4-1)
export const STAT_KEYS = ['hp', 'atk', 'spd', 'skill', 'def']
export const STAT_LABELS = { hp: '체력', atk: '공격', spd: '속도', skill: '기술', def: '방어' }
export const STAT_MIN = 20
export const STAT_MAX = 90
const BASE_WEIGHT = 0.1

// 꾸준함(0~1): 최근 7일 중 기록한 날 비율 0.6 + 연속 기록 0.4
export function consistencyOf(recordedDays, streakMetric) {
  return 0.6 * (recordedDays / WINDOW_DAYS) + 0.4 * streakMetric
}

// 성장 단계: 지금까지 기록한 날 수로 정한다(설계안 3-0).
export function growthOf(totalDays) {
  if (totalDays <= 0) return { stage: 'egg', label: '알', factor: 0.5 }
  const factor = 0.6 + (0.4 * Math.min(totalDays - 1, 6)) / 6
  if (totalDays === 1) return { stage: 'baby', label: '새끼', factor }
  if (totalDays < 7) return { stage: 'growing', label: '성장기', factor }
  return { stage: 'adult', label: '완전체', factor }
}

// 생활 지표 → 능력치별 배분 비중. 각 줄은 설계안 3-2의 유전자(몸집·팔·다리·뿔·등 문양 …)에 대응한다.
// known: 스마트폰·걸음을 입력했는지. 입력하지 않은 항목은 배분에 쓰지 않는다.
export function statWeights(m, known = {}) {
  const bodySize = 0.6 * m.power + 0.4 * m.lateSnack
  const boltTail = Math.max(0, (m.weekendRush - 2 / 7) / (1 - 2 / 7))
  const steps = known.steps ? m.steps : 0
  const phone = known.phone ? m : null
  return {
    hp: BASE_WEIGHT + bodySize + 0.5 * m.lateSnack + 0.5 * m.sleepLen + 0.4 * steps,
    atk: BASE_WEIGHT + m.exTotal * m.power + boltTail + (phone ? 0.3 * phone.snsShare + 0.3 * phone.notifications : 0),
    spd: BASE_WEIGHT + m.exTotal * m.cardio + 0.6 * steps,
    skill: BASE_WEIGHT + m.studyTotal + 0.3 * m.studyTotal * m.studySpread + (phone ? 0.4 * phone.gameShare + 0.4 * phone.studyAppShare : 0),
    def: BASE_WEIGHT + 0.4 * m.habitDone + 0.5 * m.exTotal * m.flex + (phone ? 0.6 * (1 - phone.phoneTotal) : 0),
  }
}

// 건강 배수: 스마트폰 과의존·생활 습관 문제가 클수록 몬스터가 약해진다(총합이 최대 40% 줄어든다).
// 문제 점수 = Σ 가중치 × 문제 정도(0~1). 입력하지 않은 항목(폰·걸음)은 판단하지 않는다.
export const PROBLEMS = {
  phoneTotal: { label: '화면 시간', weight: 0.14 },
  lateNightPhone: { label: '밤 폰', weight: 0.06 },
  pickups: { label: '화면 깨우기', weight: 0.05 },
  lowSteps: { label: '걸음 부족', weight: 0.05 },
  lowSleep: { label: '수면 부족', weight: 0.04 },
  notifications: { label: '알림', weight: 0.03 },
  lateSnack: { label: '야식', weight: 0.02 },
  skippedMeals: { label: '끼니 거름', weight: 0.01 },
}

const clamp01 = (value) => Math.min(1, Math.max(0, value))

// 문제 정도(0~1). 수면은 7시간 이상이면 0, 4시간 이하면 1(sleepLen은 4~9시간을 0~1로 둔 값)
export function problemLevels(m, recordedDays, known = {}) {
  if (recordedDays === 0) return Object.fromEntries(Object.keys(PROBLEMS).map((key) => [key, 0]))
  const phone = (value) => (known.phone ? value : 0)
  const sleepHours = 4 + 5 * m.sleepLen
  return {
    phoneTotal: phone(m.phoneTotal),
    lateNightPhone: phone(m.lateNightPhone),
    pickups: phone(m.pickups),
    lowSteps: known.steps ? 1 - m.steps : 0,
    lowSleep: clamp01((7 - sleepHours) / 3),
    notifications: phone(m.notifications),
    lateSnack: m.lateSnack,
    skippedMeals: 1 - m.mealReg,
  }
}

export function wellnessOf(m, recordedDays, known = {}) {
  const levels = problemLevels(m, recordedDays, known)
  const causes = Object.entries(PROBLEMS)
    .map(([key, { label, weight }]) => ({ key, label, amount: weight * levels[key] }))
    .filter((cause) => cause.amount > 0.0005)
    .sort((a, b) => b.amount - a.amount)
  const penalty = causes.reduce((total, cause) => total + cause.amount, 0)
  return { factor: 1 - penalty, penalty, causes, levels }
}

// 모두 STAT_MIN을 먼저 주고, 남은 양을 비중대로 나눈다. STAT_MAX를 넘는 몫은 나머지에 다시 나눈다.
export function allocate(total, weights) {
  const raw = {}
  let active = [...STAT_KEYS]
  for (;;) {
    const fixed = STAT_KEYS.filter((key) => !active.includes(key)).reduce((s, key) => s + raw[key], 0)
    const pool = total - fixed - STAT_MIN * active.length
    const weightSum = active.reduce((s, key) => s + weights[key], 0)
    const over = []
    for (const key of active) {
      raw[key] = STAT_MIN + (pool * weights[key]) / weightSum
      if (raw[key] > STAT_MAX) over.push(key)
    }
    if (over.length === 0) break
    for (const key of over) raw[key] = STAT_MAX
    active = active.filter((key) => !over.includes(key))
  }

  // 정수로 내리고, 모자란 만큼 소수점이 큰 순서로 1씩 더해 합을 총합에 맞춘다.
  const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, Math.floor(raw[key])]))
  let missing = total - STAT_KEYS.reduce((s, key) => s + stats[key], 0)
  const byRemainder = [...STAT_KEYS]
    .filter((key) => stats[key] < STAT_MAX)
    .sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])))
  for (const key of byRemainder) {
    if (missing <= 0) break
    stats[key] += 1
    missing -= 1
  }
  return stats
}

// 전투 스타일. 능력치가 고르면 균형, 아니면 상한(90)으로 잘리기 전의 생활 비중 순서로 판정한다.
export function battleStyleOf(stats, weights) {
  const values = STAT_KEYS.map((key) => stats[key])
  if (Math.max(...values) - Math.min(...values) <= 15) return '균형'
  const [first, second] = [...STAT_KEYS].sort((a, b) => weights[b] - weights[a])
  if (first === 'skill') return '술사'
  const topTwo = new Set([first, second])
  if (topTwo.has('hp') && topTwo.has('def')) return '탱커'
  if (topTwo.has('atk') && topTwo.has('spd')) return '돌격'
  return first === 'hp' || first === 'def' ? '탱커' : '돌격'
}

// metrics: computeMetrics 결과, recordedDays: 최근 7일 중 기록한 날, totalDays: 지금까지 기록한 날
// known: 스마트폰·걸음을 입력했는지(computeMetrics의 details.known)
// 총합 = (250 + 100 × 꾸준함) × 성장 배수 × 건강 배수
export function computeStats(metrics, recordedDays, totalDays, known = {}) {
  const consistency = consistencyOf(recordedDays, metrics.streak)
  const growth = growthOf(totalDays)
  const wellness = wellnessOf(metrics, recordedDays, known)
  const total = Math.round((250 + 100 * consistency) * growth.factor * wellness.factor)
  const weights = statWeights(metrics, known)
  const stats = allocate(total, weights)
  return { consistency, growth, wellness, total, stats, style: battleStyleOf(stats, weights) }
}
