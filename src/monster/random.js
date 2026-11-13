// 재현 가능한 난수. 같은 글자열(uid 등)이면 항상 같은 값이 나온다.

// FNV-1a 32비트 해시
export function hashString(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// mulberry32: 시드 하나로 0 이상 1 미만의 수를 차례로 만든다.
export function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = (random, list) => list[Math.floor(random() * list.length)]
