// 탄 그림(9×9 도트). '#' 탄 색, '+' 밝은 색, '-' 어두운 테두리, '.' 빈 칸. 오른쪽을 향한 그림이다.
const ART = {
  orb: ['..-----..', '.-+++##-.', '-++####--', '-+#####--', '-######--', '-######--', '-#####---', '.-####--.', '..-----..'],
  leaf: ['.........', '...----..', '.--#++#-.', '-##+###+-', '-#++++++-', '-##+###+-', '.--#++#-.', '...----..', '.........'],
  bubble: ['.-------.', '-+######-', '-#-#-#-#-', '-#######-', '-######-.', '.---##-..', '...-#-...', '...--....', '.........'],
  heart: ['.--...--.', '-+#-.-##-', '-+##-###-', '-#######-', '-#######-', '.-#####-.', '..-###-..', '...-#-...', '....-....'],
  play: ['-----....', '-++##--..', '-+####--.', '-+#++###-', '-##+++##-', '-##++###-', '-#####--.', '-####--..', '-----....'],
  note: ['...-----.', '...-+##-.', '...-#---.', '...-#-...', '...-#-...', '.---#-...', '-+##-....', '-###-....', '.---.....'],
  pixel: ['.........', '.-------.', '.-+++##-.', '.-+#-##-.', '.-+---#-.', '.-##-##-.', '.-#####-.', '.-------.', '.........'],
  page: ['--------.', '-++++++-.', '-+----+-.', '-++++++-.', '-+----+-.', '-++++++-.', '-+---++-.', '-######-.', '--------.'],
  box: ['---------', '-###+###-', '-###+###-', '-###+###-', '-+++++++-', '-###+###-', '-###+###-', '-###+###-', '---------'],
  coin: ['..-----..', '.-+++++-.', '-++###++-', '-+#---#+-', '-+#-###+-', '-+#---#+-', '-++###++-', '.-+++++-.', '..-----..'],
  pencil: ['.........', '.........', '.------..', '-##+###--', '-##++++#-', '-##+###--', '.------..', '.........', '.........'],
}
export const SHAPES = Object.keys(ART)
// 날아가는 쪽으로 돌려 그릴 것과, 빙글빙글 돌 것. 나머지는 똑바로 선다.
const FACING = new Set(['leaf', 'play', 'pencil'])
const SPINNING = new Set(['heart', 'box', 'page', 'pixel'])

const cache = new Map()
function lighten(hex) {
  const value = parseInt(hex.slice(1), 16)
  const part = (shift) => Math.min(255, Math.round(((value >> shift) & 255) * 0.45 + 255 * 0.55))
  return `rgb(${part(16)},${part(8)},${part(0)})`
}

// 탄 그림 한 장(9×9). 모양과 색마다 한 번만 만든다.
export function shotImage(shape, color, makeCanvas = () => document.createElement('canvas')) {
  const key = `${shape}${color}`
  if (cache.has(key)) return cache.get(key)
  const canvas = makeCanvas(9, 9)
  canvas.width = 9
  canvas.height = 9
  const ctx = canvas.getContext('2d')
  const paint = { '#': color, '+': lighten(color), '-': '#14152b' }
  ;(ART[shape] ?? ART.orb).forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      if (ch === '.') return
      ctx.fillStyle = paint[ch]
      ctx.fillRect(x, y, 1, 1)
    })
  })
  cache.set(key, canvas)
  return canvas
}

// 지금 그릴 각도
export function shotAngle(shot) {
  if (FACING.has(shot.shape)) return Math.atan2(shot.vy, shot.vx)
  if (SPINNING.has(shot.shape)) return (shot.age ?? 0) * 9
  return 0
}
