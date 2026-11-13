// 도트 몬스터 색(팔레트). 몬스터마다 색 몇 개만 쓰고, 칸에는 색 이름(글자 하나)을 담는다.
// M 몸 L 밝은 몸 D 어두운 몸 B 배 o 외곽선 H 뿔 h 밝은 뿔 T 뿔 대 W 흰색 P 눈동자
// K 다크서클 S 그림자 A 반짝이 G 금색 Y 번개 g 이끼 r 볼 터치 X 무늬 E 알 무늬
export const hsl = (h, s, l, a = 1) =>
  a === 1
    ? `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
    : `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${a})`

const WARM = 30
const COOL = 220

// 기분이 좋으면 주황 쪽으로, 나쁘면 파랑 쪽으로 색상을 amount(−30~30)만큼 옮긴다.
export function shiftHue(hue, amount) {
  if (amount === 0) return hue
  const target = amount > 0 ? WARM : COOL
  const diff = ((target - hue + 540) % 360) - 180
  const step = Math.sign(diff) * Math.min(Math.abs(diff), Math.abs(amount))
  return (hue + step + 360) % 360
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function pixelPalette(innate, life) {
  const hue = life ? shiftHue(innate.hue, life.hueShift) : innate.hue
  const s = life ? life.saturation : 75
  const l = life ? clamp(life.lightness, 54, 70) : 72
  const accentHue = (hue + (innate.accentOffset ?? 180)) % 360
  const hornHue = (hue + 120) % 360
  // 밝은 화면에서도 또렷하도록 외곽선은 검정 대신 몸 색의 아주 진한 톤을 쓴다.
  return {
    M: hsl(hue, s, l),
    L: hsl(hue, clamp(s - 5, 0, 100), clamp(l + 14, 0, 90)),
    D: hsl(hue, clamp(s + 5, 0, 100), l - 16),
    B: hsl(hue, clamp(s - 30, 20, 100), clamp(l + 22, 0, 94)),
    o: hsl(hue, 55, 20),
    H: hsl(hornHue, 85, 60),
    h: hsl(hornHue, 80, 84),
    T: hsl(28, 50, 40),
    W: '#ffffff',
    P: '#231f3d',
    K: hsl(270, 40, 42),
    S: 'hsl(130 45% 22% / 0.35)',
    A: '#ffc928',
    G: '#ffc928',
    Y: '#ffd84a',
    g: hsl(110, 60, 42),
    r: hsl(350, 90, 70),
    X: hsl(accentHue, 80, 58),
    E: hsl(accentHue, 70, 58),
    // 부위·피부 무늬 고정 색
    n: '#8a5a2b', // 뿌리
    f: '#b6f08f', // 잎맥
    m: '#a9b4c6', // 금속
    c: '#dde3ee', // 밝은 금속
    q: '#5f6b80', // 어두운 금속
    R: '#ff4d2e', // 불꽃·버섯 갓
    v: '#2b2766', // 은하
    V: '#4a3f9c', // 밝은 은하
    C: '#cfe3ff', // 구름 그늘
  }
}
