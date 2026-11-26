// 오류 경계가 보여 줄 문구: 화면 묶음을 받지 못한 것(인터넷)과 화면을 그리다 터진 것을 나눈다.
const NETWORK = /dynamically imported module|Loading chunk|ChunkLoadError|Failed to fetch|Importing a module script failed/i

export function errorText(error) {
  if (NETWORK.test(String(error?.message ?? error))) return '화면을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  return '화면을 그리다 문제가 생겼어요. 저장을 마친 기록은 그대로 남아 있어요.'
}
