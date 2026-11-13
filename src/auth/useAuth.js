import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

// Firebase가 알려 주는 현재 계정을 화면 상태로 바꾼다.
export function useAuth() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!auth)

  useEffect(() => {
    if (!auth) return undefined
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setReady(true)
    })
    return unsubscribe
  }, [])

  return { user, ready }
}
