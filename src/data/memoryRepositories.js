import { normalizeLook, validateProfile } from '../profile/look'
import { planDelete, planSave } from '../records/recordDoc'
import { fromMatchDoc, toMatchDoc } from './matchDoc'

// Repository의 메모리 구현: Firestore 없이 같은 인터페이스로 동작한다(테스트·시연용).
// 서비스 규칙은 Firestore 구현과 같은 planSave·planDelete·validateProfile을 써서, 저장 방식이 달라도 규칙은 같다.
// fail: 이름을 넣으면 그 메서드가 실패한다(화면이 실패를 드러내는지 시험할 때). 예) new MemoryMatchRepository({ fail: ['save'] })

const failed = (message) => ({ ok: false, message })
const FAIL_MESSAGE = '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.'

export class MemoryRecordRepository {
  constructor({ records = [], fail = [] } = {}) {
    this.store = new Map(records.map((record) => [record.date, structuredClone(record)]))
    this.fail = new Set(fail)
  }

  async load(dateKey) {
    if (this.fail.has('load')) return failed(FAIL_MESSAGE)
    const record = this.store.get(dateKey)
    return { ok: true, message: '', record: record ? structuredClone(record) : null }
  }

  async listRecent(count = 7) {
    if (this.fail.has('listRecent')) return failed(FAIL_MESSAGE)
    return { ok: true, message: '', records: this.sorted().slice(0, count) }
  }

  async listBetween(fromKey, toKey) {
    if (this.fail.has('listBetween')) return failed(FAIL_MESSAGE)
    return { ok: true, message: '', records: this.sorted().filter((record) => record.date >= fromKey && record.date <= toKey) }
  }

  async save(record, todayKey) {
    if (this.fail.has('save')) return { ...failed(FAIL_MESSAGE), errors: {} }
    const plan = planSave({ record, exists: this.store.has(record.date), todayKey })
    if (!plan.ok) return plan
    this.store.set(record.date, structuredClone(record))
    return { ok: true, message: '', errors: {}, action: plan.action }
  }

  async remove(dateKey, todayKey) {
    if (this.fail.has('remove')) return failed(FAIL_MESSAGE)
    const plan = planDelete({ dateKey, todayKey })
    if (!plan.ok) return plan
    this.store.delete(dateKey)
    return { ok: true, message: '' }
  }

  sorted() {
    return [...this.store.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).map((record) => structuredClone(record))
  }
}

export class MemoryProfileRepository {
  constructor({ profile = null, fail = [] } = {}) {
    this.profile = profile
    this.fail = new Set(fail)
  }

  async load() {
    if (this.fail.has('load')) return failed(FAIL_MESSAGE)
    return { ok: true, message: '', profile: this.profile }
  }

  async save(profile) {
    const errors = validateProfile(profile)
    if (Object.keys(errors).length > 0) return { ok: false, errors, message: '입력한 내용을 확인해 주세요.' }
    if (this.fail.has('save')) return { ...failed(FAIL_MESSAGE), errors: {}, profile: null }
    this.profile = { nickname: profile.nickname.trim(), look: normalizeLook(profile.look) }
    return { ok: true, message: '', errors: {}, profile: this.profile }
  }
}

export class MemoryMatchRepository {
  constructor({ matches = [], fail = [] } = {}) {
    this.matches = [...matches]
    this.fail = new Set(fail)
  }

  async save(match) {
    if (this.fail.has('save')) return failed(FAIL_MESSAGE)
    this.matches.push(toMatchDoc(match))
    return { ok: true, message: '' }
  }

  async recent(count = 5) {
    if (this.fail.has('recent')) return { ...failed(FAIL_MESSAGE), matches: [] }
    return { ok: true, message: '', matches: this.matches.map((match, i) => ({ id: String(i), ...fromMatchDoc(match) })).reverse().slice(0, count) }
  }

  async summary() {
    if (this.fail.has('summary')) return { ...failed(FAIL_MESSAGE), plays: 0, wins: 0 }
    return { ok: true, message: '', plays: this.matches.length, wins: this.matches.filter((match) => match.rank === 1).length }
  }
}
