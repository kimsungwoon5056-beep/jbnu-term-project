// 기록 날짜는 한국 시간 기준 'YYYY-MM-DD' 문자열(날짜 키)로 다룬다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function toDateKey(date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

// 날짜 키가 가리키는 한국 시간 자정의 UTC 밀리초
export function dayStartMs(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day) - KST_OFFSET_MS
}

export function isDateKey(value) {
  return (
    typeof value === 'string' &&
    DATE_KEY_PATTERN.test(value) &&
    toDateKey(new Date(dayStartMs(value))) === value
  )
}

export function addDays(dateKey, days) {
  return toDateKey(new Date(dayStartMs(dateKey) + days * DAY_MS))
}

// to가 from보다 며칠 뒤인지(앞이면 음수)
export function daysBetween(fromKey, toKey) {
  return Math.round((dayStartMs(toKey) - dayStartMs(fromKey)) / DAY_MS)
}
