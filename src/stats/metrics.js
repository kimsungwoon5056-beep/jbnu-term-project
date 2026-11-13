import { addDays, weekdayOf } from '../records/dateKey'
import { sleepMinutes } from '../records/record'
import { WORKOUT_TYPES } from '../records/recordOptions'

// 최근 7일 기록 → 0~1로 정규화한 생활 지표 (설계안 3-1)
export const WINDOW_DAYS = 7
export const DECAY = 0.8 // 하루 전으로 갈 때마다 비중을 0.8배로
const STREAK_FULL = 14
const EVEN_WEEKEND_SHARE = 2 / 7 // 매일 똑같이 하면 주말 비중이 약 0.29

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

export function computeMetrics(records, endKey) {
  const byDate = new Map(records.map((record) => [record.date, record]))
  const days = Array.from({ length: WINDOW_DAYS }, (_, age) => {
    const dateKey = addDays(endKey, -age)
    return { dateKey, weight: DECAY ** age, record: byDate.get(dateKey) ?? null }
  })
  const recorded = days.filter((day) => day.record)
  const windowWeight = sum(days.map((day) => day.weight))
  const over = (pick) => recorded.map((day) => ({ weight: day.weight, value: pick(day.record) }))

  // 주간 양: 기록 안 한 날은 0분으로 보고 가중 평균한 뒤 7을 곱한다.
  const weeklyAmount = (pick) => (sum(recorded.map((day) => day.weight * pick(day.record))) / windowWeight) * WINDOW_DAYS

  const exerciseByCategory = { cardio: 0, power: 0, flex: 0 }
  const studyBySubject = {}
  for (const { weight, record } of recorded) {
    for (const workout of record.workouts) {
      const category = WORKOUT_TYPES[workout.type]?.category
      if (category) exerciseByCategory[category] += weight * workout.minutes
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

  const metrics = {
    sleepLen: hasRecords ? (weightedMean(over((r) => sleepMinutes(r.sleep.bedTime, r.sleep.wakeTime))) / 60 - 4) / 5 : 0,
    sleepReg: recorded.length >= 2 ? 1 - weightedStd(bedTimes) / 120 : 0,
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
    weekendRush: activeTotal === 0 ? EVEN_WEEKEND_SHARE : weekendActive / activeTotal,
    streak: streakDays / STREAK_FULL,
    gap: (WINDOW_DAYS - recorded.length) / WINDOW_DAYS,
    habitDone: weightedMean(
      habitDays.map((day) => ({
        weight: day.weight,
        value: day.record.customHabits.filter((habit) => habit.done).length / day.record.customHabits.length,
      })),
    ),
  }

  for (const key of Object.keys(metrics)) metrics[key] = clamp01(metrics[key])
  return { metrics, recordedDays: recorded.length, streakDays }
}
