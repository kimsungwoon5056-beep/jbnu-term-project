import { checkDateWindow, createEmptyPhone, createEmptyRecord, validateRecord } from './record'
import { PHONE_CATEGORIES } from './recordOptions'

// 화면에서 쓰는 기록 객체 → Firestore에 저장할 값. 저장할 필드만 고르고 이름 앞뒤 공백을 지운다.
export function toRecordDoc(record) {
  return {
    date: record.date,
    phone: record.phone ? toPhoneDoc(record.phone) : null,
    steps: record.steps ?? null,
  }
}

function toPhoneDoc(phone) {
  const apps = (list, field) => list.map((app) => ({ name: app.name.trim(), [field]: app[field] }))
  return {
    total: phone.total,
    categories: Object.fromEntries(Object.keys(PHONE_CATEGORIES).map((key) => [key, phone.categories[key] ?? 0])),
    topApps: apps(phone.topApps, 'minutes'),
    pickups: phone.pickups,
    firstPickup: phone.firstPickup || null,
    pickupApps: apps(phone.pickupApps, 'count'),
    notifications: phone.notifications,
    notifyApps: apps(phone.notifyApps, 'count'),
  }
}

function fromPhoneDoc(data) {
  if (!data) return null
  const base = createEmptyPhone()
  return {
    ...base,
    ...data,
    categories: { ...base.categories, ...data.categories },
    firstPickup: data.firstPickup ?? '',
    topApps: data.topApps ?? [],
    pickupApps: data.pickupApps ?? [],
    notifyApps: data.notifyApps ?? [],
  }
}

// Firestore 문서 → 화면에서 쓰는 기록 객체. 예전 기록에 남은 수면·운동 등의 필드는 읽지 않는다.
export function fromRecordDoc(dateKey, data) {
  return { ...createEmptyRecord(dateKey), phone: fromPhoneDoc(data.phone), steps: data.steps ?? null }
}

// 저장 전에 할 일을 정한다. 이미 있는 기록이면 수정, 없으면 새 등록이다.
export function planSave({ record, exists, todayKey }) {
  const errors = validateRecord(record)
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: '입력한 내용을 확인해 주세요.' }
  }
  const action = exists ? 'update' : 'create'
  const dateProblem = checkDateWindow(record.date, todayKey, action)
  if (dateProblem) return { ok: false, errors: {}, message: dateProblem }
  return { ok: true, action }
}

export function planDelete({ dateKey, todayKey }) {
  const dateProblem = checkDateWindow(dateKey, todayKey, 'delete')
  return dateProblem ? { ok: false, message: dateProblem } : { ok: true }
}

// what: 무엇을 하다 실패했는지(record 기록, profile 내 모습, match 전적). 같은 거절이라도 이유 안내가 다르다.
const SUBJECTS = { record: '기록을', profile: '내 모습을', match: '전적을' }
const LATE = { record: '기록이', profile: '내 모습이', match: '전적이' }
const DENIED = {
  // 기록은 보안 규칙의 날짜 창(새로 쓰기는 오늘·어제, 고치기·지우기는 7일 안)에 걸려도 같은 오류가 온다.
  record: '이 기록은 저장할 수 없어요. 새 기록은 오늘·어제 것만, 고치기·지우기는 7일 안의 기록만 할 수 있어요. 날짜가 맞는데도 계속되면 다시 로그인해 주세요.',
  profile: '내 모습을 저장하거나 불러올 권한이 없어요. 다시 로그인해 주세요.',
  match: '전적을 저장하거나 불러올 권한이 없어요. 다시 로그인해 주세요.',
}
const FIRESTORE_MESSAGES = {
  unauthenticated: '로그인이 필요합니다.',
  unavailable: '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.',
  'deadline-exceeded': '응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.',
}

// op: save(저장·지우기) | load(불러오기). 불러오기 거절에 저장 규칙(날짜 창)을 말하지 않고,
// 저장 시간 초과는 인터넷이 돌아오면 저장될 수 있으므로 실패로 단정하지 않는다.
export function firestoreErrorMessage(code, what = 'record', op = 'save') {
  const subject = SUBJECTS[what] ?? SUBJECTS.record
  if (code === 'permission-denied') return op === 'load' ? `${subject} 불러올 권한이 없어요. 다시 로그인해 주세요.` : (DENIED[what] ?? DENIED.record)
  if (code === 'deadline-exceeded' && op === 'save') return `응답이 늦어지고 있어요. 인터넷이 다시 연결되면 ${LATE[what] ?? LATE.record} 저장될 수 있으니, 잠시 뒤 목록에서 확인해 주세요.`
  return FIRESTORE_MESSAGES[code] ?? `${subject} 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.`
}
