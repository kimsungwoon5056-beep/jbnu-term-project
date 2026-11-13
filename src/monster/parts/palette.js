// 색 규칙 (설계안 3-5-1): 모두 HSL로 계산해 어떤 조합이 나와도 서로 어울리게 한다.
export const hsl = (h, s, l, a = 1) =>
  a === 1 ? `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)` : `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${a})`

const WARM = 30 // 기분이 좋으면 주황 쪽으로
const COOL = 220 // 나쁘면 파랑 쪽으로

// amount(−30~30)만큼 색상을 따뜻하거나 차갑게 옮긴다.
export function shiftHue(hue, amount) {
  if (amount === 0) return hue
  const target = amount > 0 ? WARM : COOL
  const diff = ((target - hue + 540) % 360) - 180 // −180~180, 가까운 방향
  const step = Math.sign(diff) * Math.min(Math.abs(diff), Math.abs(amount))
  return (hue + step + 360) % 360
}

export function monsterPalette(innate, life) {
  const hue = life ? shiftHue(innate.hue, life.hueShift) : innate.hue
  const s = life ? life.saturation : 55
  const l = life ? life.lightness : 74
  return {
    body: hsl(hue, s, l),
    limb: hsl(hue, s, l - 8),
    belly: hsl(hue, Math.max(20, s - 20), Math.min(92, l + 15)),
    horn: hsl((hue + 120) % 360, Math.min(75, s + 5), 62),
    hornLight: hsl((hue + 120) % 360, 60, 85),
    outline: hsl(hue, 35, 25),
    accent: hsl((hue + 180) % 360, 45, 45),
    aura: hsl(hue, 85, 72),
    blush: hsl(350, 80, 70, 0.45),
  }
}
