// 방 코드: 4자리. 헷갈리는 글자(0·O·1·I·L)는 뺐다.
export const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const MAX_PLAYERS = 4

export function makeRoomCode(random = Math.random) {
  return Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join('')
}

export const isRoomCode = (code) => typeof code === 'string' && /^[A-Z2-9]{4}$/.test(code) && [...code].every((ch) => CODE_LETTERS.includes(ch))
