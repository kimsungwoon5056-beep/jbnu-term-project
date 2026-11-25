import { useLayoutEffect } from 'react'

// 화면이 바뀌면 맨 위부터 보인다(앞 화면에서 내려 둔 만큼 내려가 있지 않게).
export function useScrollTop(screen) {
  useLayoutEffect(() => {
    if (globalThis.scrollY > 0) globalThis.scrollTo(0, 0)
  }, [screen])
}
