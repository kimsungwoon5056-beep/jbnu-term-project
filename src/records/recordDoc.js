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

const FIRESTORE_MESSAGES = {
  'permission-denied': '이 기록을 저장하거나 볼 권한이 없습니다. 다시 로그인해 주세요.',
  unauthenticated: '로그인이 필요합니다.',
  unavailable: '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.',
  'deadline-exceeded': '응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.',
}

export function firestoreErrorMessage(code) {
  return FIRESTORE_MESSAGES[code] ?? '기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
