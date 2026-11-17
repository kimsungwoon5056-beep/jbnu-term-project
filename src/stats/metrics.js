import { addDays } from '../records/dateKey'
import { hasSteps } from '../records/record'

// 기록 → 0~1로 정규화한 스마트폰·걸음 지표 (설계안 3-1)
// 2026-11-17: 스마트폰 과의존과 관련 없는 수면·운동·공부·식사·기분·습관 지표는 지웠다.
export const WINDOW_DAYS = 7
export const DECAY = 0.8 // 7일 모드에서 하루 전으로 갈 때마다 비중을 0.8배로

export const METRIC_LABELS = {
  phoneTotal: '화면 시간',
  snsShare: '소셜 비율',
  videoShare: '영상 비율',
  gameShare: '게임 비율',
  studyAppShare: '공부 앱 비율',
  creativeShare: '창작 앱 비율',
  shoppingShare: '쇼핑 앱 비율',
  pickups: '화면 깨우기',
  notifications: '알림',
  lateNightPhone: '밤 폰',
  steps: '걸음',
}

// 지표의 기준(하루): 이 값 이하면 0, 이 값 + 범위 이상이면 1
export const PHONE_SCALE = {
  totalMinutes: [60, 360], // 1시간 ~ 7시간
  pickups: [30, 120], // 30번 ~ 150번
  notifications: [50, 250], // 50개 ~ 300개
  steps: [2000, 10000], // 2,000보 ~ 12,000보
}
const NIGHT_END = 5 * 60 // 화면을 처음 깨운 시각이 0:00~4:59면 "밤 폰"

const scaled = (value, [from, range]) => (value - from) / range
const clamp01 = (value) => Math.min(1, Math.max(0, value))
const sum = (values) => values.reduce((total, value) => total + value, 0)

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
export const isNightPickup = (time) => Boolean(time) && toMinutes(time) < NIGHT_END

function weightedMean(items) {
  const totalWeight = sum(items.map((item) => item.weight))
  return totalWeight === 0 ? 0 : sum(items.map((item) => item.weight * item.value)) / totalWeight
}

// 앱 목록을 날마다 합쳐 많은 순서로 3개
function topOf(lists, field) {
  const totals = {}
  for (const list of lists) for (const app of list ?? []) totals[app.name] = (totals[app.name] ?? 0) + app[field]
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name, value]) => ({ name, [field]: value }))
}

// 부위 설명·위젯에 쓰는 "입력값 그대로"의 숫자. 입력한 날만의 하루 평균(하루 모드면 그날 값)
function rawFacts(records) {
  const mean = (values) => (values.length === 0 ? 0 : Math.round(sum(values) / values.length))
  const phones = records.map((record) => record.phone).filter(Boolean)
  const steps = records.filter(hasSteps).map((record) => record.steps)
  const categoryKeys = phones.length ? Object.keys(phones[0].categories) : []
  return {
    recordedDays: records.length,
    phoneDays: phones.length,
    phoneTotal: mean(phones.map((phone) => phone.total)),
    phoneCategories: Object.fromEntries(categoryKeys.map((key) => [key, mean(phones.map((phone) => phone.categories[key] ?? 0))])),
    pickups: mean(phones.map((phone) => phone.pickups)),
    notifications: mean(phones.map((phone) => phone.notifications)),
    firstPickup: phones.length === 1 ? phones[0].firstPickup || null : null,
    nightPickupDays: phones.filter((phone) => isNightPickup(phone.firstPickup)).length,
    firstPickupDays: phones.filter((phone) => phone.firstPickup).length,
    topApps: topOf(phones.map((phone) => phone.topApps), 'minutes'),
    pickupApps: topOf(phones.map((phone) => phone.pickupApps), 'count'),
    notifyApps: topOf(phones.map((phone) => phone.notifyApps), 'count'),
    stepDays: steps.length,
    steps: mean(steps),
  }
}

// windowDays: 지표를 볼 기간. 7(최근 7일, 최근 날일수록 비중이 큼)이거나 1(그날 하루).
// 스마트폰·걸음은 입력한 날만으로 평균한다(입력 안 한 날은 판단하지 않음).
export function computeMetrics(records, endKey, { windowDays = WINDOW_DAYS } = {}) {
  const byDate = new Map(records.map((record) => [record.date, record]))
  const days = Array.from({ length: windowDays }, (_, age) => {
    const dateKey = addDays(endKey, -age)
    return { dateKey, weight: DECAY ** age, record: byDate.get(dateKey) ?? null }
  })
  const recorded = days.filter((day) => day.record)
  const phoneDays = recorded.filter((day) => day.record.phone)
  const stepDays = recorded.filter((day) => hasSteps(day.record))
  const overPhone = (pick) => weightedMean(phoneDays.map((day) => ({ weight: day.weight, value: pick(day.record.phone) })))
  const share = (key) => overPhone((phone) => (phone.total ? (phone.categories[key] ?? 0) / phone.total : 0))
  const pickupTimes = phoneDays.filter((day) => day.record.phone.firstPickup)
  const known = { phone: phoneDays.length > 0, steps: stepDays.length > 0 }

  const metrics = {
    phoneTotal: known.phone ? scaled(overPhone((phone) => phone.total), PHONE_SCALE.totalMinutes) : 0,
    snsShare: share('sns'),
    videoShare: share('video'),
    gameShare: share('game'),
    studyAppShare: share('study'),
    creativeShare: share('creative'),
    shoppingShare: share('shopping'),
    pickups: known.phone ? scaled(overPhone((phone) => phone.pickups), PHONE_SCALE.pickups) : 0,
    notifications: known.phone ? scaled(overPhone((phone) => phone.notifications), PHONE_SCALE.notifications) : 0,
    lateNightPhone: weightedMean(
      pickupTimes.map((day) => ({ weight: day.weight, value: isNightPickup(day.record.phone.firstPickup) ? 1 : 0 })),
    ),
    steps: known.steps ? scaled(weightedMean(stepDays.map((day) => ({ weight: day.weight, value: day.record.steps }))), PHONE_SCALE.steps) : 0,
  }
  for (const key of Object.keys(metrics)) metrics[key] = clamp01(metrics[key])

  let streakDays = 0
  while (byDate.has(addDays(endKey, -streakDays))) streakDays += 1

  const raw = { ...rawFacts(recorded.map((day) => day.record)), streakDays, span: windowDays === 1 ? 'today' : 'week' }
  // known: 스마트폰·걸음을 입력한 날이 있는지. 없으면 그 지표의 0은 "모름"이다.
  return { metrics, details: { known, raw, streakDays }, recordedDays: recorded.length, streakDays }
}

// 오늘 하루의 캐릭터: 오늘 기록이 있으면 오늘 하루로, 없으면 가장 최근 하루(어제)로 정한다.
// 연속 기록("N일째")은 날짜를 거슬러 센다.
export function computeTodayMetrics(records, todayKey) {
  const isToday = records.some((record) => record.date === todayKey)
  const endKey = isToday ? todayKey : addDays(todayKey, -1)
  const day = computeMetrics(records, endKey, { windowDays: 1 })
  return { endKey, isToday, metrics: day.metrics, details: day.details, hasRecord: day.recordedDays > 0 }
}
