// 인터넷이 끊기면 Firebase 쓰기는 다시 연결될 때까지 끝나지 않는다. ms가 지나면 기다리기를 그만두고 시간 초과로 실패시킨다.
// (서버에 늦게 닿아 저장될 수는 있으므로, 화면은 "실패"가 아니라 "응답이 없다"고 안내한다.)
export const TIMEOUT_MS = 12000

export function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'deadline-exceeded' })), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
