// 로그아웃하기 전에 끝내야 하는 일(예: 대결 방에서 나가기). 로그아웃한 뒤에는 권한이 없어 할 수 없다.
const tasks = new Set()

// 할 일을 등록하고 해지 함수를 돌려준다.
export function onBeforeLogout(task) {
  tasks.add(task)
  return () => tasks.delete(task)
}

// 모두 부른다. 인터넷이 끊겨 끝나지 않으면 timeoutMs까지만 기다린다.
export async function runBeforeLogout(timeoutMs = 2000) {
  const work = Promise.allSettled([...tasks].map(async (task) => task()))
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, timeoutMs))])
}
