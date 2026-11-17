// 색 계산(16진수 색 ↔ HSL). 캐릭터 팔레트의 명암·칙칙함에 쓴다.
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const lig = l / 100
  const k = (n) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// amount: −100 ~ 100(명도 차이)
export function shiftLightness(hex, amount) {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, s, clamp(l + amount, 0, 100))
}

// amount: 0~1. 채도를 그만큼 줄이고 살짝 어둡게(건강이 낮을 때 칙칙한 얼굴)
export function dull(hex, amount) {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, s * (1 - amount), clamp(l - 8 * amount, 0, 100))
}

// 두 색을 t(0~1)만큼 섞는다.
export function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16)
  const b = parseInt(hexB.slice(1), 16)
  const channel = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`
}
