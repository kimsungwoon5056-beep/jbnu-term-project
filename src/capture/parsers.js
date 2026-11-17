import { createEmptyPhone } from '../records/record'
import { PHONE_CATEGORIES, PHONE_LIMITS } from '../records/recordOptions'
import { categoryOfApp } from './appCategories'

// 캡처 OCR 글자 → 스마트폰·걸음 값.
// 화면마다 읽는 방법이 달라서 "화면별 읽기 규칙"(Strategy)을 두고, 한 캡처에 여러 화면 구역이 보이면 맞는 규칙을 모두 적용한다.
// 각 규칙은 같은 모양의 부분 결과 { phone: {...}, steps, notes }를 돌려주고, mergeReads가 합친다(Adapter 역할: 화면마다 다른 표기 → 같은 기록 모양).

// ---------- 줄 다듬기 ----------

// 칸 사이가 넓게 띄어진 줄은 나누고, 앞쪽 아이콘 잡음("8    Instagram", "© 카카오톡", "@100개")을 지운다.
export function splitLines(lines) {
  return lines
    .flatMap((line) => line.split(/\s{2,}/))
    .map((line) =>
      line
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .replace(/[*•●]+$/u, '')
        .trim(),
    )
    .filter(Boolean)
}

// "2시간 38분", "45분", "5시간 35"(분이 잘림), "29초", "1h 5m" → 분. 아니면 null
export function parseDuration(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  let m = t.match(/^(\d{1,2}) ?시간(?: ?(\d{1,2}) ?분?)?$/)
  if (m) return withinDay(Number(m[1]), Number(m[2] ?? 0))
  m = t.match(/^(\d{1,2}) ?분$/)
  if (m) return withinDay(0, Number(m[1]))
  if (/^\d{1,2} ?[초조]$/.test(t)) return 0
  m = t.match(/^(\d{1,2}) ?h(?: ?(\d{1,2}) ?m)?$/i)
  if (m) return withinDay(Number(m[1]), Number(m[2] ?? 0))
  m = t.match(/^(\d{1,2}) ?m(?:in)?$/i)
  if (m) return withinDay(0, Number(m[1]))
  return null
}

const withinDay = (hours, minutes) => (hours <= 24 && minutes < 60 ? hours * 60 + minutes : null)

// "60번", "131개", "6기"(개가 기로 읽힘), "74회" → { value, unit }. 아니면 null
export function parseCount(text) {
  const m = text.replace(/\s+/g, '').match(/^([\d,]+)(번|회|개|기)$/)
  if (!m) return null
  const value = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(value) ? { value, unit: m[2] === '기' ? '개' : m[2] } : null
}

// "오전 12:03" → "00:03", "오후 3:05" → "15:05"
export function parseClock(text) {
  const m = text.match(/(오전|오후|AM|PM)\s*(\d{1,2}):(\d{2})/i)
  if (!m) return null
  let hours = Number(m[2]) % 12
  if (/오후|PM/i.test(m[1])) hours += 12
  const minutes = Number(m[3])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const HEADER_WORDS = [
  '스크린 타임', '최다 사용', '카테고리', '화면 깨우기', '처음', '알림', '더 보기', '평균', '모든 기기', '기기', '업데이트',
  '오늘', '디지털 웰빙', '화면 시간', '잠금 해제', '걸음', '하이라이트', '대시보드',
]
const CATEGORY_NAMES = Object.entries(PHONE_CATEGORIES).flatMap(([key, option]) => option.ios.map((name) => [name, key]))

// 줄이 아이폰 카테고리 이름이면 그 종류 키. OCR이 끝을 자르기도 해서("생산성 및 금") 앞부분으로 비교한다.
export function categoryKeyOf(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 2) return null
  for (const [name, key] of CATEGORY_NAMES) {
    if (t === name || (t.length >= 3 && name.startsWith(t)) || (t.length >= 4 && t.startsWith(name.slice(0, 4)))) return key
  }
  return null
}

// 앱 이름처럼 보이는 줄인가(글자 2자 이상, 숫자·시각·머리말이 아님)
function isAppName(text) {
  if (text.length < 2 || text.length > 20) return false
  if (/[:/]/.test(text) || parseDuration(text) !== null || parseCount(text) !== null) return false
  const letters = (text.match(/[\p{L}]/gu) ?? []).length
  const digits = (text.match(/\d/g) ?? []).length
  if (letters < 2 || digits > letters) return false
  if (categoryKeyOf(text)) return false
  return !HEADER_WORDS.some((word) => text.includes(word))
}

// 앱 이름 줄 다음 줄이 값이면 짝을 짓는다. 아이폰 목록은 큰 순서라 앞보다 큰 값은 잘못 읽은 것으로 보고 버린다.
function appPairs(lines, readValue) {
  const pairs = []
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!isAppName(lines[i])) continue
    const value = readValue(lines[i + 1])
    if (value === null) continue
    const previous = pairs.at(-1)
    if (previous && value > previous.value) continue
    pairs.push({ name: lines[i], value })
    i += 1
  }
  return pairs
}

const indexOf = (lines, test, from = 0) => {
  for (let i = from; i < lines.length; i += 1) if (test(lines[i])) return i
  return -1
}

// ---------- 화면별 읽기 규칙(Strategy) ----------

export const STRATEGIES = [
  {
    id: 'iosScreenTime',
    label: '아이폰 스크린 타임',
    match: (lines) => lines.some((line) => line.includes('스크린 타임')),
    parse(lines) {
      const start = indexOf(lines, (line) => line.includes('스크린 타임'))
      const phone = {}
      const notes = []
      if (lines.some((line) => /일일 평균|하루 평균/.test(line))) notes.push('주간 화면(일일 평균)이에요. "일" 화면을 캡처해 주세요.')
      const totalAt = indexOf(lines, (line) => parseDuration(line) !== null, start)
      if (totalAt >= 0) phone.total = parseDuration(lines[totalAt])
      // 그래프 아래 카테고리 이름 줄들 → 그 뒤의 시간 줄들을 순서대로 짝짓는다.
      const firstName = indexOf(lines, (line) => categoryKeyOf(line) !== null, Math.max(0, totalAt + 1))
      if (firstName >= 0) {
        const keys = []
        let i = firstName
        for (; i < lines.length && keys.length < 6; i += 1) {
          const key = categoryKeyOf(lines[i])
          if (key) keys.push(key)
          else if (parseDuration(lines[i]) !== null) break
        }
        const minutes = []
        for (; i < lines.length && minutes.length < keys.length; i += 1) {
          const value = parseDuration(lines[i])
          if (value !== null) minutes.push(value)
          else if (lines[i].includes('업데이트') || lines[i].includes('최다')) break
        }
        if (minutes.length === keys.length && keys.length > 0) {
          phone.categories = {}
          keys.forEach((key, k) => {
            phone.categories[key] = (phone.categories[key] ?? 0) + minutes[k]
          })
        }
      }
      return { phone, notes }
    },
  },
  {
    id: 'appUsage',
    label: '앱별 사용 시간',
    match: (lines) => appPairs(lines, parseDuration).length >= 2,
    parse: (lines) => ({ phone: { topApps: appPairs(lines, parseDuration).map(({ name, value }) => ({ name, minutes: value })) } }),
  },
  {
    id: 'iosPickups',
    label: '화면 깨우기',
    match: (lines) => lines.some((line) => line === '화면 깨우기' || line.includes('총 화면 깨우기') || line.includes('처음 깨운')),
    parse(lines) {
      const phone = {}
      const start = indexOf(lines, (line) => line === '화면 깨우기' || line.includes('총 화면 깨우기'))
      if (start >= 0) {
        const at = indexOf(lines, (line) => parseCount(line)?.unit === '번', start)
        if (at >= 0) phone.pickups = parseCount(lines[at]).value
      }
      const clockAt = indexOf(lines, (line) => !line.includes('업데이트') && parseClock(line) !== null, Math.max(0, start))
      if (clockAt >= 0) phone.firstPickup = parseClock(lines[clockAt])
      return { phone }
    },
  },
  {
    id: 'pickupApps',
    label: '깨운 뒤 처음 연 앱',
    match: (lines) => appPairs(lines, (line) => countOf(line, '번')).length >= 2,
    parse: (lines) => ({
      phone: { pickupApps: appPairs(lines, (line) => countOf(line, '번')).map(({ name, value }) => ({ name, count: value })) },
    }),
  },
  {
    id: 'iosNotifications',
    label: '알림',
    match: (lines) => lines.some((line) => line === '알림'),
    parse(lines) {
      const start = indexOf(lines, (line) => line === '알림')
      const at = indexOf(lines, (line) => parseCount(line)?.unit === '개', start)
      return { phone: at >= 0 ? { notifications: parseCount(lines[at]).value } : {} }
    },
  },
  {
    id: 'notifyApps',
    label: '알림이 많은 앱',
    match: (lines) => appPairs(lines, (line) => countOf(line, '개')).length >= 2,
    parse: (lines) => ({
      phone: { notifyApps: appPairs(lines, (line) => countOf(line, '개')).map(({ name, value }) => ({ name, count: value })) },
    }),
  },
  {
    id: 'androidWellbeing',
    label: '안드로이드 디지털 웰빙',
    match: (lines) => lines.some((line) => /디지털 웰빙|잠금 해제/.test(line)),
    parse(lines) {
      const phone = {}
      const start = indexOf(lines, (line) => /디지털 웰빙|화면 시간|오늘/.test(line))
      const totalAt = indexOf(lines, (line) => parseDuration(line) !== null, Math.max(0, start))
      if (totalAt >= 0) phone.total = parseDuration(lines[totalAt])
      const sameOrNext = (word, units) => {
        const at = indexOf(lines, (line) => line.includes(word))
        if (at < 0) return null
        for (const text of [lines[at].replace(word, ''), lines[at + 1] ?? '']) {
          const count = parseCount(text.replace(/수|횟수/g, ''))
          if (count && units.includes(count.unit)) return count.value
        }
        return null
      }
      const unlocks = sameOrNext('잠금 해제', ['번', '회'])
      if (unlocks !== null) phone.pickups = unlocks
      const notifications = sameOrNext('알림', ['개', '회'])
      if (notifications !== null) phone.notifications = notifications
      return { phone }
    },
  },
  {
    id: 'healthSteps',
    label: '건강 앱 걸음 수',
    match: (lines) => lines.some((line) => line.includes('걸음')),
    parse(lines) {
      const notes = []
      const isAverage = (line) => /평균|입니다|\/일|지난/.test(line)
      const stepsIn = (line) => {
        if (isAverage(line)) return null
        const m = line.replace(/\s+/g, ' ').match(/^([\d,]+) ?(?:\/ ?[\d,]+ ?)?걸음$/)
        return m ? Number(m[1].replace(/,/g, '')) : null
      }
      // 아이폰 건강: "● 오늘" 다음에 나오는 "38 걸음". 그 옆의 "평균 2,157 걸음"은 고르지 않는다.
      const todayAt = indexOf(lines, (line) => /^오늘$|^오늘\b/.test(line) && !line.includes(','))
      let at = todayAt >= 0 ? indexOf(lines, (line) => stepsIn(line) !== null, todayAt) : -1
      if (at < 0) at = indexOf(lines, (line) => stepsIn(line) !== null)
      if (at >= 0) return { steps: Math.min(PHONE_LIMITS.maxSteps, stepsIn(lines[at])) }
      if (lines.some(isAverage)) notes.push('걸음 화면에서 "오늘" 걸음 수를 찾지 못했어요. 오늘 값이 보이는 부분을 캡처해 주세요.')
      return { notes }
    },
  },
]

const countOf = (line, unit) => {
  const count = parseCount(line)
  return count && count.unit === unit ? count.value : null
}

// 캡처 한 장(OCR 줄 목록) → 맞는 규칙들의 부분 결과
export function readCapture(rawLines) {
  const lines = splitLines(rawLines)
  return STRATEGIES.filter((strategy) => strategy.match(lines)).map((strategy) => ({ id: strategy.id, ...strategy.parse(lines) }))
}

// ---------- 합치기 ----------

const PHONE_FIELDS = ['total', 'categories', 'topApps', 'pickups', 'firstPickup', 'pickupApps', 'notifications', 'notifyApps']

function mergeApps(lists, field) {
  const totals = new Map()
  for (const list of lists) for (const app of list) totals.set(app.name, Math.max(totals.get(app.name) ?? 0, app[field]))
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PHONE_LIMITS.maxApps)
    .map(([name, value]) => ({ name, [field]: value }))
}

// 여러 캡처(·여러 번 읽기)의 부분 결과 → 기록에 넣을 값과 "캡처에서 읽은 칸" 목록
// 같은 칸을 여러 번 읽었으면 먼저 읽은 값을 쓴다(앱 목록은 합친다).
export function mergeReads(reads) {
  const phone = {}
  const lists = { topApps: [], pickupApps: [], notifyApps: [] }
  const notes = []
  let steps = null
  for (const read of reads) {
    for (const note of read.notes ?? []) if (!notes.includes(note)) notes.push(note)
    if (read.steps !== undefined && read.steps !== null && steps === null) steps = read.steps
    for (const [field, value] of Object.entries(read.phone ?? {})) {
      if (field in lists) lists[field].push(value)
      else if (field === 'categories') phone.categories = { ...value, ...phone.categories }
      else if (phone[field] === undefined) phone[field] = value
    }
  }
  if (lists.topApps.length) phone.topApps = mergeApps(lists.topApps, 'minutes')
  if (lists.pickupApps.length) phone.pickupApps = mergeApps(lists.pickupApps, 'count')
  if (lists.notifyApps.length) phone.notifyApps = mergeApps(lists.notifyApps, 'count')

  const filled = PHONE_FIELDS.filter((field) => phone[field] !== undefined)
  if (steps !== null) {
    filled.push('steps')
    // 다른 캡처에서 오늘 걸음을 찾았으면 "못 찾았다" 안내는 지운다.
    for (let i = notes.length - 1; i >= 0; i -= 1) if (notes[i].includes('걸음')) notes.splice(i, 1)
  }
  if (filled.length === 0) return { phone: null, steps: null, filled, notes }

  const base = createEmptyPhone()
  const result = { ...base, ...phone, categories: { ...base.categories, ...phone.categories } }
  // 카테고리가 보이지 않은 캡처(안드로이드 등)는 많이 쓴 앱으로 종류를 채운다.
  if (!phone.categories && phone.topApps?.length) {
    for (const app of phone.topApps) result.categories[categoryOfApp(app.name)] += app.minutes
    filled.push('categories')
  }
  // 총 시간을 못 읽었으면 종류별 합을 총 시간으로 둔다(사용자가 확인).
  const categorySum = Object.values(result.categories).reduce((sum, minutes) => sum + minutes, 0)
  if (phone.total === undefined) result.total = Math.min(PHONE_LIMITS.maxMinutes, categorySum)
  else if (categorySum > result.total + PHONE_LIMITS.categorySlack) notes.push('종류별 시간의 합이 총 시간보다 커요. 숫자를 확인해 주세요.')
  const hasPhone = PHONE_FIELDS.some((field) => phone[field] !== undefined)
  return { phone: hasPhone ? result : null, steps, filled, notes }
}
