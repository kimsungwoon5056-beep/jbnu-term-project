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
  const s = life ? life.saturation : 60
  const l = life ? clamp(life.lightness, 50, 66) : 70
  const hornHue = (hue + 120) % 360
  return {
    M: hsl(hue, s, l),
    L: hsl(hue, s, clamp(l + 13, 0, 88)),
    D: hsl(hue, clamp(s + 5, 0, 100), l - 15),
    B: hsl(hue, clamp(s - 25, 15, 100), clamp(l + 22, 0, 92)),
    o: hsl(hue, 45, 14),
    H: hsl(hornHue, 70, 58),
    h: hsl(hornHue, 65, 82),
    T: hsl(30, 40, 38),
    W: '#fffaf0',
    P: '#1c1530',
    K: hsl(270, 35, 30),
    S: 'hsl(232 45% 6% / 0.55)',
    A: '#fff3b0',
    G: '#ffcf4a',
    Y: '#ffd84a',
    g: hsl(105, 45, 40),
    r: hsl(350, 85, 72),
    X: hsl((hue + 180) % 360, 55, 42),
    E: hsl(hue, 50, 50),
  }
}
