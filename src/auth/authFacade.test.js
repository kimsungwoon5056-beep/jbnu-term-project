import { describe, expect, it } from 'vitest'
import { createAuthFacade } from './authService'

// Facade: 화면은 Firebase Auth의 함수 네 개(가입·로그인·로그아웃·상태 구독)와 오류 코드를 모른다.
// 가짜 Auth SDK를 끼워, Facade 하나로 가입 → 상태 알림 → 로그아웃 → 실패 안내가 도는지 본다.
function fakeSdk() {
  const users = new Map()
  const listeners = new Set()
  let current = null
  const notify = () => listeners.forEach((fn) => fn(current))
  const fail = (code) => Promise.reject(Object.assign(new Error(code), { code }))
  return {
    calls: [],
    createUserWithEmailAndPassword(auth, email, password) {
      this.calls.push(['signUp', email])
      if (users.has(email)) return fail('auth/email-already-in-use')
      users.set(email, password)
      current = { uid: `u-${users.size}`, email }
      notify()
      return Promise.resolve({ user: current })
    },
    signInWithEmailAndPassword(auth, email, password) {
      this.calls.push(['signIn', email])
      if (users.get(email) !== password) return fail('auth/invalid-credential')
      current = { uid: 'u-1', email }
      notify()
      return Promise.resolve({ user: current })
    },
    signOut() {
      current = null
      notify()
      return Promise.resolve()
    },
    onAuthStateChanged(auth, fn) {
      listeners.add(fn)
      fn(current)
      return () => listeners.delete(fn)
    },
  }
}

describe('로그인 Facade', () => {
  it('가입·로그인·로그아웃을 { ok, message }로만 돌려주고, 상태 변화는 watch로 알린다', async () => {
    const sdk = fakeSdk()
    const auth = createAuthFacade({ auth: {}, sdk })
    const seen = []
    const stop = auth.watch((user) => seen.push(user?.email ?? null))
    expect(await auth.signUp('  a@test.dev ', 'secret12')).toEqual({ ok: true, message: '' })
    expect(sdk.calls[0]).toEqual(['signUp', 'a@test.dev']) // 앞뒤 공백을 다듬어 넘긴다
    expect(await auth.logOut()).toEqual({ ok: true, message: '' })
    stop()
    await auth.signIn('a@test.dev', 'secret12')
    expect(seen).toEqual([null, 'a@test.dev', null]) // 구독을 끊은 뒤의 로그인은 알리지 않는다
  })

  it('Firebase 오류 코드는 한국어 안내로 바꿔 돌려준다', async () => {
    const auth = createAuthFacade({ auth: {}, sdk: fakeSdk() })
    await auth.signUp('a@test.dev', 'secret12')
    const again = await auth.signUp('a@test.dev', 'secret12')
    expect(again.ok).toBe(false)
    expect(again.message).toMatch(/이미|가입/)
    const wrong = await auth.signIn('a@test.dev', 'nope')
    expect(wrong.ok).toBe(false)
    expect(wrong.message).not.toContain('auth/')
  })
})
