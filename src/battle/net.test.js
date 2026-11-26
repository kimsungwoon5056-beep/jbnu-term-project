import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 실시간 대결 방(net.js)의 실패 안내: 권한 거절·시간 초과·방 가득을 서로 다른 문구로, 구독이 끊기면 알린다.
// Firebase는 가짜로 바꿔 끼운다(무엇이 실패하는지만 정한다).
const fake = vi.hoisted(() => ({ set: null, get: null, update: null, onValue: [], removed: [] }))
vi.mock('../firebase', () => ({ app: {}, databaseURL: 'https://example' }))
vi.mock('firebase/database', () => ({
  getDatabase: () => ({}),
  ref: (_, path) => path,
  get: (path) => fake.get(path),
  set: (path, value) => fake.set(path, value),
  update: (path, value) => fake.update(path, value),
  remove: async (path) => {
    fake.removed.push(path)
  },
  push: async () => {},
  onDisconnect: () => ({ remove: async () => {} }),
  serverTimestamp: () => 0,
  onChildAdded: () => () => {},
  onValue: (path, next, fail) => {
    fake.onValue.push({ path, next, fail })
    return () => {}
  },
}))

const net = await import('./net')
const denied = () => Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' })
const meta = (status = 'waiting') => ({ exists: () => true, val: () => ({ status }) })

describe('대결 방 실패 안내', () => {
  beforeEach(() => {
    fake.get = async (path) => (path.endsWith('meta') ? meta() : { val: () => ({}) })
    fake.set = async () => {}
    fake.update = async () => {}
    fake.onValue = []
  })
  afterEach(() => vi.useRealTimers())

  it('자리를 잡다가 권한 거절이 아닌 오류(연결 등)가 나면 "가득 찼어요"로 뭉개지 않는다', async () => {
    fake.set = async (path) => {
      if (path.includes('slots')) throw Object.assign(new Error('net'), { code: 'NETWORK_ERROR' })
    }
    const result = await net.joinRoom('ABCD', 'me', { name: '나' })
    expect(result.ok).toBe(false)
    expect(result.message).not.toContain('가득')
    expect(result.message).toContain('연결')
  })

  it('모든 자리가 거절되면 방이 가득 찼다고 알린다', async () => {
    fake.set = async (path) => {
      if (path.includes('slots')) throw denied()
    }
    expect((await net.joinRoom('ABCD', 'me', { name: '나' })).message).toContain('가득')
  })

  it('준비·시작·끝내기의 권한 거절은 "들어갈 수 없어요"가 아니라 방 상태를 바꿀 수 없다고 알린다', async () => {
    fake.update = async () => {
      throw denied()
    }
    for (const result of [await net.setReady('ABCD', 'me', true), await net.startRoom('ABCD'), await net.endRoom('ABCD')]) {
      expect(result.ok).toBe(false)
      expect(result.message).not.toContain('들어갈 수 없어요')
      expect(result.message).toContain('바꿀 수 없어요')
    }
  })

  it('서버가 응답하지 않으면 기다리다 시간 초과로 안내한다(성공으로 보이지 않게)', async () => {
    vi.useFakeTimers()
    fake.update = () => new Promise(() => {})
    const pending = net.setReady('ABCD', 'me', true)
    await vi.advanceTimersByTimeAsync(net.NET_TIMEOUT_MS + 10)
    const result = await pending
    expect(result.ok).toBe(false)
    expect(result.message).toContain('응답')
  })

  it('방 구독이 거절·취소되면 onError로 알린다', () => {
    const errors = []
    net.watchRoom('ABCD', () => {}, (message) => errors.push(message))
    fake.onValue[0].fail(denied())
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('연결이 끊겼어요')
  })

  it('시간 초과로 실패라고 알린 들어가기가 뒤늦게 끝나면, 그 자리와 칸을 지워 유령 참가자를 남기지 않는다(점검 2회차)', async () => {
    vi.useFakeTimers()
    fake.removed = []
    fake.set = (path) => (path.includes('slots') ? new Promise((resolve) => setTimeout(resolve, net.NET_TIMEOUT_MS + 3000)) : Promise.resolve())
    const pending = net.joinRoom('ABCD', 'me', { name: '나' })
    await vi.advanceTimersByTimeAsync(net.NET_TIMEOUT_MS + 10)
    expect((await pending).ok).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fake.removed).toContain('rooms/ABCD/players/me')
    expect(fake.removed).toContain('rooms/ABCD/slots/0')
  })
})