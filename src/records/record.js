import { daysBetween, isDateKey } from './dateKey'
import { LIMITS, MOOD_RANGE, PHONE_CATEGORIES, PHONE_LIMITS, WORKOUT_TYPES } from './recordOptions'

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
    phone: null, // 스마트폰 사용(입력 안 하면 null)
    steps: null, // 걸음 수(입력 안 하면 null)
  }
}

// 스마트폰 기록 빈 값. 시간은 분, firstPickup은 "HH:MM" 또는 ''(모름)
export function createEmptyPhone() {
  return {
    total: 0,
    categories: Object.fromEntries(Object.keys(PHONE_CATEGORIES).map((key) => [key, 0])),
    topApps: [],
    pickups: 0,
    firstPickup: '',
    pickupApps: [],
    notifications: 0,
    notifyApps: [],
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

  const phoneError = validatePhone(record.phone)
  if (phoneError) errors.phone = phoneError

  if (record.steps !== null && record.steps !== undefined) {
    if (!Number.isInteger(record.steps) || record.steps < 0 || record.steps > PHONE_LIMITS.maxSteps) {
      errors.steps = '걸음 수는 0~100,000 사이의 정수로 입력해 주세요.'
    }
  }

  return errors
}

const inRange = (value, max) => Number.isInteger(value) && value >= 0 && value <= max

// 스마트폰 기록 검사. 문제가 없으면 null
export function validatePhone(phone) {
  if (phone === null || phone === undefined) return null
  if (!inRange(phone.total, PHONE_LIMITS.maxMinutes)) return '총 화면 시간은 0~24시간 사이로 입력해 주세요.'
  const parts = Object.keys(PHONE_CATEGORIES).map((key) => phone.categories?.[key] ?? 0)
  if (parts.some((minutes) => !inRange(minutes, PHONE_LIMITS.maxMinutes))) return '종류별 시간을 확인해 주세요.'
  if (parts.reduce((total, minutes) => total + minutes, 0) > phone.total + PHONE_LIMITS.categorySlack) {
    return '종류별 시간의 합이 총 화면 시간보다 깁니다.'
  }
  if (!inRange(phone.pickups, PHONE_LIMITS.maxPickups)) return '화면 깨우기는 0~1,000번 사이로 입력해 주세요.'
  if (!inRange(phone.notifications, PHONE_LIMITS.maxNotifications)) return '알림 수는 0~3,000개 사이로 입력해 주세요.'
  if (phone.firstPickup && !TIME_PATTERN.test(phone.firstPickup)) return '처음 깨운 시각을 확인해 주세요.'
  const lists = [
    [phone.topApps, 'minutes', PHONE_LIMITS.maxMinutes],
    [phone.pickupApps, 'count', PHONE_LIMITS.maxAppCount],
    [phone.notifyApps, 'count', PHONE_LIMITS.maxAppCount],
  ]
  for (const [list, field, max] of lists) {
    if (!Array.isArray(list) || list.length > PHONE_LIMITS.maxApps) return `앱 목록은 ${PHONE_LIMITS.maxApps}개까지 넣을 수 있습니다.`
    if (list.some((app) => !isValidName(app.name) || !inRange(app[field], max))) return '앱 이름(1~20자)과 숫자를 확인해 주세요.'
  }
  return null
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
