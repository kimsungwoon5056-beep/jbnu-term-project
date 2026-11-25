import { daysBetween, isDateKey } from './dateKey'
import { LIMITS, PHONE_CATEGORIES, PHONE_LIMITS } from './recordOptions'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// 하루 기록: 스마트폰 사용과 걸음 수만 남긴다(2026-11-17, 스마트폰 과의존과 관련 없는 항목은 지움).
export function createEmptyRecord(dateKey) {
  return {
    date: dateKey,
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

export const hasSteps = (record) => record.steps !== null && record.steps !== undefined

const isValidName = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= LIMITS.maxNameLength

// 기록 내용 검사. 문제가 있는 항목만 { 항목: 안내 문구 }로 돌려준다.
export function validateRecord(record) {
  const errors = {}
  if (!isDateKey(record.date)) errors.date = '날짜 형식이 올바르지 않습니다.'
  if (!record.phone && !hasSteps(record)) errors.empty = '스마트폰 사용이나 걸음 수 중 하나는 넣어 주세요.'

  const phoneError = validatePhone(record.phone)
  if (phoneError) errors.phone = phoneError

  if (hasSteps(record) && (!Number.isInteger(record.steps) || record.steps < 0 || record.steps > PHONE_LIMITS.maxSteps)) {
    errors.steps = '걸음 수는 0~100,000 사이의 정수로 입력해 주세요.'
  }
  return errors
}

const inRange = (value, max) => Number.isInteger(value) && value >= 0 && value <= max

// 스마트폰 기록 검사. 문제가 없으면 null
export function validatePhone(phone) {
  if (phone === null || phone === undefined) return null
  if (!inRange(phone.total, PHONE_LIMITS.maxMinutes)) return '총 화면 시간은 0~24시간 사이로 입력해 주세요.'
  if (phone.total === 0) return '총 화면 시간을 넣어 주세요. 0분이면 "오늘 폰을 안 썼다"로 계산돼요.'
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
