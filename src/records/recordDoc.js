import { checkDateWindow, createEmptyRecord, validateRecord } from './record'

// 화면에서 쓰는 기록 객체 → Firestore에 저장할 값. 저장할 필드만 고르고 이름 앞뒤 공백을 지운다.
export function toRecordDoc(record) {
  return {
    date: record.date,
    sleep: { bedTime: record.sleep.bedTime, wakeTime: record.sleep.wakeTime },
    workouts: record.workouts.map(({ type, minutes }) => ({ type, minutes })),
    studies: record.studies.map(({ subject, minutes }) => ({ subject: subject.trim(), minutes })),
    meals: { count: record.meals.count, lateSnack: record.meals.lateSnack },
    mood: record.mood,
    customHabits: record.customHabits.map(({ name, done }) => ({ name: name.trim(), done })),
  }
}

// Firestore 문서 → 화면에서 쓰는 기록 객체. 빠진 필드는 빈 기록의 기본값으로 채운다.
export function fromRecordDoc(dateKey, data) {
  const base = createEmptyRecord(dateKey)
  return {
    date: dateKey,
    sleep: { ...base.sleep, ...data.sleep },
    workouts: data.workouts ?? base.workouts,
    studies: data.studies ?? base.studies,
    meals: { ...base.meals, ...data.meals },
    mood: data.mood ?? base.mood,
    customHabits: data.customHabits ?? base.customHabits,
  }
}

// 다른 날짜의 기록을 내용만 그대로 가져온다("어제와 같음", 전날 기록을 기본값으로 쓸 때).
export function copyRecordTo(record, dateKey) {
  return { ...fromRecordDoc(dateKey, toRecordDoc(record)), date: dateKey }
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
