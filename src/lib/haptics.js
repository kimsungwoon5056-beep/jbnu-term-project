import { isReduced } from './motion'

// 휴대폰 진동(지원하는 기기만). 움직임을 끈 사람에게는 울리지 않는다.
export function buzz(pattern) {
  if (isReduced()) return
  try {
    globalThis.navigator?.vibrate?.(pattern)
  } catch {
    // 진동을 막아 둔 브라우저
  }
}
