import { useEffect, useState } from 'react'
import { authFacade } from './authService'

// 로그인 Facade(authService.js)가 알려 주는 현재 계정을 화면 상태로 바꾼다. Firebase Auth를 직접 부르지 않는다.
export function useAuth(facade = authFacade) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!facade.available)

  useEffect(() => {
    if (!facade.available) return undefined
    return facade.watch((currentUser) => {
      setUser(currentUser)
      setReady(true)
    })
  }, [facade])

  return { user, ready }
}
