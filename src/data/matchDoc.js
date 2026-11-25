// 전적 문서 모양: { mode: practice|online, rank, players, names[], date } (+ 저장할 때 createdAt)
// 전적은 한 번 쓰면 고치거나 지울 수 없다(보안 규칙도 만들기만 허용). 승패 기록을 나중에 바꿔 "N판 M승"을 부풀리지 못하게 하기 위해서다.
export function toMatchDoc({ mode, rank, names, date }) {
  return { mode, rank, players: names.length, names: names.map((name) => String(name).slice(0, 10)), date }
}

// 저장된 문서 → 화면에 보일 값(빠진 칸이 있어도 안전하게)
export function fromMatchDoc(data = {}) {
  return { mode: data.mode === 'online' ? 'online' : 'practice', rank: Number(data.rank) || 0, players: Number(data.players) || 0, names: Array.isArray(data.names) ? data.names : [], date: String(data.date ?? '') }
}
