import { addDays, weekdayOf } from '../records/dateKey'
import { sleepMinutes } from '../records/record'
import { WORKOUT_TYPES } from '../records/recordOptions'

// 최근 7일 기록 → 0~1로 정규화한 생활 지표 (설계안 3-1)
export const WINDOW_DAYS = 7
export const DECAY = 0.8 // 하루 전으로 갈 때마다 비중을 0.8배로
const STREAK_FULL = 14
const EVEN_WEEKEND_SHARE = 2 / 7 // 매일 똑같이 하면 주말 비중이 약 0.29
const NEUTRAL = 0.5 // 하루 기록으로는 알 수 없는 지표의 중간값

export const METRIC_LABELS = {
  sleepLen: '수면량',
  sleepReg: '취침 규칙성',
  nightOwl: '야행성',
  exTotal: '운동량',
  cardio: '유산소 비율',
  power: '근력 비율',
  flex: '유연성 비율',
  studyTotal: '공부량',
  studySpread: '과목 다양성',
  mealReg: '끼니 규칙성',
  lateSnack: '야식',
  moodAvg: '기분 평균',
  moodSwing: '기분 변동',
  weekendRush: '주말 몰아치기',
  streak: '연속 기록',
  gap: '공백',
  habitDone: '습관 완료율',
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

// 스마트폰 지표의 기준(하루): 이 값 이하면 0, 이 값 + 범위 이상이면 1
export const PHONE_SCALE = {
  totalMinutes: [60, 360], // 1시간 ~ 7시간
  pickups: [30, 120], // 30번 ~ 150번
  notifications: [50, 250], // 50개 ~ 300개
  steps: [2000, 10000], // 2,000보 ~ 12,000보
}
const NIGHT_END = 5 * 60 // 화면을 처음 깨운 시각이 0:00~4:59면 "밤 폰"

const scaled = (value, [from, range]) => (value - from) / range
const isNightPickup = (time) => Boolean(time) && toMinutes(time) < NIGHT_END

// 앱 목록을 날마다 합쳐 많은 순서로 3개
function topOf(lists, field) {
  const totals = {}
  for (const list of lists) for (const app of list ?? []) totals[app.name] = (totals[app.name] ?? 0) + app[field]
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name, value]) => ({ name, [field]: value }))
}

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const sum = (values) => values.reduce((total, value) => total + value, 0)
const minutesOf = (entries) => sum(entries.map((entry) => entry.minutes))

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// 취침 시각을 저녁 6시부터 지난 분으로 바꾼다. 23:30과 00:30이 1시간 차이로 계산된다.
const bedOffset = (time) => (toMinutes(time) - 18 * 60 + 24 * 60) % (24 * 60)

// 가중 평균과 가중 표준편차. items는 { weight, value } 목록
function weightedMean(items) {
  const totalWeight = sum(items.map((item) => item.weight))
  return totalWeight === 0 ? 0 : sum(items.map((item) => item.weight * item.value)) / totalWeight
}

function weightedStd(items) {
  if (items.length < 2) return 0
  const mean = weightedMean(items)
  return Math.sqrt(weightedMean(items.map((item) => ({ weight: item.weight, value: (item.value - mean) ** 2 }))))
}

function entropyShare(totals) {
  const values = Object.values(totals).filter((value) => value > 0)
  const all = sum(values)
  if (values.length < 2 || all === 0) return 0
  const entropy = -sum(values.map((value) => (value / all) * Math.log(value / all)))
  return entropy / Math.log(5)
}

// 부위 설명에 쓰는 "입력값 그대로"의 최근 7일 숫자. 가중치 없이 합·평균·날짜 수만 낸다.
// (지표는 최근일수록 비중을 크게 두므로, 그 값을 문장에 쓰면 실제로 한 양과 달라진다.)
function rawFacts(records, { activeTotal, weekendActive, streakDays }) {
  const count = records.length
  const mean = (values) => (values.length === 0 ? 0 : sum(values) / values.length)
  const bedOffsets = records.map((record) => bedOffset(record.sleep.bedTime))
  const bedMean = mean(bedOffsets)
  const workouts = {}
  const subjects = {}
  const habits = {}
  for (const record of records) {
    for (const workout of record.workouts) workouts[workout.type] = (workouts[workout.type] ?? 0) + workout.minutes
    for (const study of record.studies) subjects[study.subject] = (subjects[study.subject] ?? 0) + study.minutes
    for (const habit of record.customHabits) {
      const stat = (habits[habit.name] ??= { name: habit.name, days: 0, done: 0 })
      stat.days += 1
      if (habit.done) stat.done += 1
    }
  }
  const habitList = Object.values(habits)
  const habitDays = sum(habitList.map((habit) => habit.days))
  return {
    recordedDays: count,
    sleepMinutes: Math.round(mean(records.map((record) => sleepMinutes(record.sleep.bedTime, record.sleep.wakeTime)))),
    bedTime: count === 0 ? null : Math.round(18 * 60 + bedMean) % (24 * 60),
    bedSpread: count < 2 ? 0 : Math.round(Math.sqrt(mean(bedOffsets.map((offset) => (offset - bedMean) ** 2)))),
    exerciseWeek: sum(records.map((record) => minutesOf(record.workouts))),
    studyWeek: sum(records.map((record) => minutesOf(record.studies))),
    workouts,
    subjects,
    moodAvg: Math.round(mean(records.map((record) => record.mood)) * 10) / 10,
    moodLow: count === 0 ? 0 : Math.min(...records.map((record) => record.mood)),
    moodHigh: count === 0 ? 0 : Math.max(...records.map((record) => record.mood)),
    lateSnackDays: records.filter((record) => record.meals.lateSnack).length,
    fullMealDays: records.filter((record) => record.meals.count >= 3).length,
    weekendShare: activeTotal === 0 ? 0 : Math.round((weekendActive / activeTotal) * 100),
    habitRate: habitDays === 0 ? 0 : Math.round((sum(habitList.map((habit) => habit.done)) / habitDays) * 100),
    habits: habitList,
    streakDays,
    ...rawPhone(records),
  }
}

// 스마트폰·걸음: 입력한 날만의 하루 평균(입력값 그대로)
function rawPhone(records) {
  const mean = (values) => (values.length === 0 ? 0 : Math.round(sum(values) / values.length))
  const phones = records.map((record) => record.phone).filter(Boolean)
  const steps = records.map((record) => record.steps).filter((value) => value !== null && value !== undefined)
  const categoryKeys = phones.length ? Object.keys(phones[0].categories) : []
  return {
    phoneDays: phones.length,
    phoneTotal: mean(phones.map((phone) => phone.total)),
    phoneCategories: Object.fromEntries(categoryKeys.map((key) => [key, mean(phones.map((phone) => phone.categories[key] ?? 0))])),
    pickups: mean(phones.map((phone) => phone.pickups)),
    notifications: mean(phones.map((phone) => phone.notifications)),
    nightPickupDays: phones.filter((phone) => isNightPickup(phone.firstPickup)).length,
    firstPickupDays: phones.filter((phone) => phone.firstPickup).length,
    topApps: topOf(phones.map((phone) => phone.topApps), 'minutes'),
    pickupApps: topOf(phones.map((phone) => phone.pickupApps), 'count'),
    notifyApps: topOf(phones.map((phone) => phone.notifyApps), 'count'),
    stepDays: steps.length,
    steps: mean(steps),
  }
}

// windowDays: 지표를 볼 기간. 7(최근 7일, 기본)이거나 1(그날 하루).
// 하루 모드에서는 하루로 알 수 없는 취침 규칙성·주말 몰아치기를 중간값으로 둔다.
export function computeMetrics(records, endKey, { windowDays = WINDOW_DAYS } = {}) {
  const byDate = new Map(records.map((record) => [record.date, record]))
  const days = Array.from({ length: windowDays }, (_, age) => {
    const dateKey = addDays(endKey, -age)
    return { dateKey, weight: DECAY ** age, record: byDate.get(dateKey) ?? null }
  })
  const recorded = days.filter((day) => day.record)
  const windowWeight = sum(days.map((day) => day.weight))
  const over = (pick) => recorded.map((day) => ({ weight: day.weight, value: pick(day.record) }))

  // 주간 양: 기록 안 한 날은 0분으로 보고 가중 평균한 뒤 7을 곱한다.
  const weeklyAmount = (pick) => (sum(recorded.map((day) => day.weight * pick(day.record))) / windowWeight) * WINDOW_DAYS

  const exerciseByCategory = { cardio: 0, power: 0, flex: 0 }
  const exerciseByType = {}
  const studyBySubject = {}
  for (const { weight, record } of recorded) {
    for (const workout of record.workouts) {
      const category = WORKOUT_TYPES[workout.type]?.category
      if (category) exerciseByCategory[category] += weight * workout.minutes
      exerciseByType[workout.type] = (exerciseByType[workout.type] ?? 0) + weight * workout.minutes
    }
    for (const study of record.studies) {
      studyBySubject[study.subject] = (studyBySubject[study.subject] ?? 0) + weight * study.minutes
    }
  }
  const exerciseWeighted = sum(Object.values(exerciseByCategory))
  const share = (part) => (exerciseWeighted === 0 ? 0 : part / exerciseWeighted)

  const activeMinutes = (record) => minutesOf(record.workouts) + minutesOf(record.studies)
  const activeTotal = sum(recorded.map((day) => activeMinutes(day.record)))
  const weekendActive = sum(
    recorded.filter((day) => [0, 6].includes(weekdayOf(day.dateKey))).map((day) => activeMinutes(day.record)),
  )

  let streakDays = 0
  while (byDate.has(addDays(endKey, -streakDays))) streakDays += 1

  const bedTimes = over((record) => bedOffset(record.sleep.bedTime))
  const moods = over((record) => record.mood)
  const habitDays = recorded.filter((day) => day.record.customHabits.length > 0)
  const hasRecords = recorded.length > 0

  // 스마트폰·걸음은 입력한 날만으로 평균한다(입력 안 한 날은 판단하지 않음).
  const phoneDays = recorded.filter((day) => day.record.phone)
  const stepDays = recorded.filter((day) => day.record.steps !== null && day.record.steps !== undefined)
  const overPhone = (pick) => phoneDays.map((day) => ({ weight: day.weight, value: pick(day.record.phone) }))
  const phoneShare = (key) => weightedMean(overPhone((phone) => (phone.total ? (phone.categories[key] ?? 0) / phone.total : 0)))
  const pickupTimes = phoneDays.filter((day) => day.record.phone.firstPickup)

  const metrics = {
    sleepLen: hasRecords ? (weightedMean(over((r) => sleepMinutes(r.sleep.bedTime, r.sleep.wakeTime))) / 60 - 4) / 5 : 0,
    sleepReg: recorded.length >= 2 ? 1 - weightedStd(bedTimes) / 120 : windowDays === 1 && hasRecords ? NEUTRAL : 0,
    nightOwl: hasRecords ? (weightedMean(bedTimes) - 4 * 60) / (5 * 60) : 0,
    exTotal: weeklyAmount((r) => minutesOf(r.workouts)) / 300,
    cardio: share(exerciseByCategory.cardio),
    power: share(exerciseByCategory.power),
    flex: share(exerciseByCategory.flex),
    studyTotal: weeklyAmount((r) => minutesOf(r.studies)) / 900,
    studySpread: entropyShare(studyBySubject),
    mealReg: weightedMean(over((r) => (r.meals.count >= 3 ? 1 : 0))),
    lateSnack: weightedMean(over((r) => (r.meals.lateSnack ? 1 : 0))),
    moodAvg: hasRecords ? (weightedMean(moods) - 1) / 4 : 0,
    moodSwing: weightedStd(moods) / 2,
    weekendRush: activeTotal === 0 || windowDays === 1 ? EVEN_WEEKEND_SHARE : weekendActive / activeTotal,
    streak: streakDays / STREAK_FULL,
    gap: (windowDays - recorded.length) / windowDays,
    habitDone: weightedMean(
      habitDays.map((day) => ({
        weight: day.weight,
        value: day.record.customHabits.filter((habit) => habit.done).length / day.record.customHabits.length,
      })),
    ),
    phoneTotal: phoneDays.length ? scaled(weightedMean(overPhone((phone) => phone.total)), PHONE_SCALE.totalMinutes) : 0,
    snsShare: phoneShare('sns'),
    videoShare: phoneShare('video'),
    gameShare: phoneShare('game'),
    studyAppShare: phoneShare('study'),
    creativeShare: phoneShare('creative'),
    shoppingShare: phoneShare('shopping'),
    pickups: phoneDays.length ? scaled(weightedMean(overPhone((phone) => phone.pickups)), PHONE_SCALE.pickups) : 0,
    notifications: phoneDays.length ? scaled(weightedMean(overPhone((phone) => phone.notifications)), PHONE_SCALE.notifications) : 0,
    lateNightPhone: weightedMean(
      pickupTimes.map((day) => ({ weight: day.weight, value: isNightPickup(day.record.phone.firstPickup) ? 1 : 0 })),
    ),
    steps: stepDays.length ? scaled(weightedMean(stepDays.map((day) => ({ weight: day.weight, value: day.record.steps }))), PHONE_SCALE.steps) : 0,
  }

  for (const key of Object.keys(metrics)) metrics[key] = clamp01(metrics[key])

  // 외형(과목별 뿔, 습관별 등 문양)에 쓰는 세부 값
  const habitStats = {}
  for (const { weight, record } of recorded) {
    for (const habit of record.customHabits) {
      const stat = (habitStats[habit.name] ??= { weight: 0, done: 0 })
      stat.weight += weight
      if (habit.done) stat.done += weight
    }
  }
  const details = {
    subjects: Object.fromEntries(
      Object.entries(studyBySubject).map(([subject, minutes]) => [subject, (minutes / windowWeight) * WINDOW_DAYS]),
    ),
    workouts: Object.fromEntries(
      Object.entries(exerciseByType).map(([type, minutes]) => [type, (minutes / windowWeight) * WINDOW_DAYS]),
    ),
    habits: Object.entries(habitStats).map(([name, stat]) => ({ name, rate: stat.done / stat.weight })),
    streakDays,
    // 스마트폰·걸음을 입력한 날이 있는지. 없으면 그 지표의 0은 "모름"이다.
    known: { phone: phoneDays.length > 0, steps: stepDays.length > 0 },
    raw: { ...rawFacts(recorded.map((day) => day.record), { activeTotal, weekendActive, streakDays }), span: windowDays === 1 ? 'today' : 'week' },
  }
  return { metrics, details, recordedDays: recorded.length, streakDays }
}

// 오늘 하루의 몬스터: 오늘 기록이 있으면 오늘 하루로, 없으면 가장 최근 하루(어제)로 모습·건강을 정한다.
// 꾸준함(최근 7일 중 기록한 날)·연속 기록·공백은 하루로 알 수 없어 최근 7일 기록으로 계산한다.
export function computeTodayMetrics(records, todayKey) {
  const isToday = records.some((record) => record.date === todayKey)
  const endKey = isToday ? todayKey : addDays(todayKey, -1)
  const week = computeMetrics(records, endKey)
  const day = computeMetrics(records, endKey, { windowDays: 1 })
  return {
    endKey,
    isToday,
    metrics: { ...day.metrics, streak: week.metrics.streak, gap: week.metrics.gap },
    details: { ...day.details, raw: { ...day.details.raw, weekRecordedDays: week.recordedDays } },
    weekRecordedDays: week.recordedDays,
  }
}
