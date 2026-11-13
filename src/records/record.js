import { daysBetween, isDateKey } from './dateKey'
import { LIMITS, MOOD_RANGE, WORKOUT_TYPES } from './recordOptions'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function createEmptyRecord(dateKey) {
  return {
    date: dateKey,
    sleep: { bedTime: '23:00', wakeTime: '07:00' },
    workouts: [],
    studies: [],
    meals: { count: 3, lateSnack: false },
    mood: 3,
    customHabits: [],
  }
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// 잠든 시각부터 일어난 시각까지. 자정을 넘기면 다음 날로 계산한다.
export function sleepMinutes(bedTime, wakeTime) {
  const diff = toMinutes(wakeTime) - toMinutes(bedTime)
  return diff > 0 ? diff : diff + 24 * 60
}

const sumMinutes = (entries) => entries.reduce((total, entry) => total + entry.minutes, 0)

export function summarizeRecord(record) {
  return {
    sleepMinutes: sleepMinutes(record.sleep.bedTime, record.sleep.wakeTime),
    exerciseMinutes: sumMinutes(record.workouts),
    studyMinutes: sumMinutes(record.studies),
  }
}

const isWholeMinutes = (value) => Number.isInteger(value) && value > 0
const isValidName = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= LIMITS.maxNameLength

// 기록 내용 검사. 문제가 있는 항목만 { 항목: 안내 문구 }로 돌려준다.
export function validateRecord(record) {
  const errors = {}

  if (!isDateKey(record.date)) errors.date = '날짜 형식이 올바르지 않습니다.'

  const { bedTime, wakeTime } = record.sleep
  if (!TIME_PATTERN.test(bedTime) || !TIME_PATTERN.test(wakeTime)) {
    errors.sleep = '잠든 시각과 일어난 시각을 확인해 주세요.'
  } else if (sleepMinutes(bedTime, wakeTime) > LIMITS.sleepMaxMinutes) {
    errors.sleep = '수면 시간은 16시간을 넘을 수 없습니다.'
  }

  if (record.workouts.length > LIMITS.maxEntries) {
    errors.workouts = `운동은 하루 ${LIMITS.maxEntries}개까지 기록할 수 있습니다.`
  } else if (record.workouts.some((entry) => !WORKOUT_TYPES[entry.type])) {
    errors.workouts = '운동 종류를 선택해 주세요.'
  } else if (record.workouts.some((entry) => !isWholeMinutes(entry.minutes))) {
    errors.workouts = '운동 시간은 1분 이상의 정수로 입력해 주세요.'
  } else if (sumMinutes(record.workouts) > LIMITS.dailyMaxMinutes) {
    errors.workouts = '운동은 하루 600분을 넘을 수 없습니다.'
  }

  if (record.studies.length > LIMITS.maxEntries) {
    errors.studies = `공부는 하루 ${LIMITS.maxEntries}개까지 기록할 수 있습니다.`
  } else if (record.studies.some((entry) => !isValidName(entry.subject))) {
    errors.studies = '과목 이름은 1~20자로 입력해 주세요.'
  } else if (record.studies.some((entry) => !isWholeMinutes(entry.minutes))) {
    errors.studies = '공부 시간은 1분 이상의 정수로 입력해 주세요.'
  } else if (sumMinutes(record.studies) > LIMITS.dailyMaxMinutes) {
    errors.studies = '공부는 하루 600분을 넘을 수 없습니다.'
  }

  const { count, lateSnack } = record.meals
  if (!Number.isInteger(count) || count < 0 || count > LIMITS.maxMeals || typeof lateSnack !== 'boolean') {
    errors.meals = '끼니 수는 0~5 사이로 입력해 주세요.'
  }

  if (!Number.isInteger(record.mood) || record.mood < MOOD_RANGE.min || record.mood > MOOD_RANGE.max) {
    errors.mood = '기분을 골라 주세요.'
  }

  if (record.customHabits.length > LIMITS.maxCustomHabits) {
    errors.customHabits = `나만의 습관은 ${LIMITS.maxCustomHabits}개까지 기록할 수 있습니다.`
  } else if (record.customHabits.some((habit) => !isValidName(habit.name) || typeof habit.done !== 'boolean')) {
    errors.customHabits = '습관 이름은 1~20자로 입력해 주세요.'
  }

  return errors
}

// 날짜 규칙: 새 기록은 오늘·어제만, 수정·삭제는 7일 이내, 미래 날짜는 불가
export function checkDateWindow(dateKey, todayKey, action) {
  const age = daysBetween(dateKey, todayKey)
  if (age < 0) return '미래 날짜는 기록할 수 없습니다.'
  if (action === 'create' && age > LIMITS.createWindowDays) {
    return '새 기록은 오늘과 어제 날짜만 등록할 수 있습니다.'
  }
  if (action !== 'create' && age > LIMITS.editWindowDays) {
    return '7일이 지난 기록은 바꿀 수 없습니다.'
  }
  return null
}
