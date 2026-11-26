import { weaponOf } from './melee'

// 무기 도트(원작): 손잡이가 위(0줄, 손), 머리가 아래로 가는 9칸 폭 그림. 글자마다 색이 다르고 둘레에 검은 외곽선을 자동으로 두른다.
//   k 외곽선색 · w 흰색 · a 무기 색(앱 색) · d 무기 색 어둡게 · b 나무 손잡이 · g 쇠 · p 분홍(지우개) · y 노랑
// 같은 그림을 다른 사람 손(작게)과 1인칭 손(크게)에 쓴다. 맨주먹(unrecorded)은 그림이 없다.
export const WEAPON_ART = {
  // 맑은 나뭇가지 봉: 긴 나뭇가지 끝에 잎사귀
  detox: ['....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '...bbb...', '..aab.a..', '.aaabaaa.', '..aaaaa..', '...ada...', '....a....'],
  // 말풍선 너클: 주먹을 감싼 노란 말풍선과 꼬리
  messenger: ['.aaaaaaa.', 'aawawawaa', 'aaaaaaaaa', 'adaaaaada', '.aaaaaaa.', '....aad..', '.....ad..', '......d..'],
  // 하트 채찍: 짧은 손잡이와 구불구불한 줄, 끝에 하트
  feed: ['...bb....', '...bb....', '...bb....', '....a....', '.....a...', '.....a...', '....a....', '...a.....', '...a.....', '....a....', '.....a...', '.....a...', '..aa.aa..', '.awaaaaa.', '.aaaaaaa.', '..aaaaa..', '...ada...', '....a....'],
  // 재생바 창: 긴 재생바 자루, 끝에 재생 삼각형 날
  video: ['....g....', '....g....', '....d....', '....a....', '....a....', '....w....', '....a....', '....a....', '....a....', '....a....', '....a....', '....a....', '...ggg...', '..aaaaa..', '..awaaa..', '...aaa...', '...aa....', '....a....'],
  // 마이크 해머: 검은 손잡이 끝에 커다란 마이크 머리
  music: ['....d....', '....d....', '....d....', '....d....', '....d....', '....d....', '....d....', '...ddd...', '...ggg...', '..aaaaa..', '.awawawa.', '.aaaaaaa.', '.awawawa.', '.aaaaaaa.', '..aaaaa..', '...ddd...'],
  // 패드 쌍검: 게임 패드 손잡이에 짧은 보라 칼날
  game: ['..ddddd..', '..dwdyd..', '..ddddd..', '....g....', '...aaw...', '...aaw...', '...aaw...', '...aaw...', '...aaw...', '....aw...', '....a....'],
  // 컷 대검: 넓은 초록 칼날(웹툰 칸처럼 흰 줄)
  webtoon: ['....b....', '....b....', '....b....', '..ggggg..', '.aaaaaaa.', '.awwwwwa.', '.aaaaaaa.', '.aaaaaaa.', '.awwwwwa.', '.aaaaaaa.', '.aaaaaaa.', '.awwwwwa.', '..aaaaa..', '...aaa...', '....a....'],
  // 택배 망치: 나무 자루 끝에 테이프 붙은 택배 상자
  shopping: ['....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '....b....', '.aaaaaaa.', '.aaayaaa.', '.aaayaaa.', '.dddyddd.', '.aaayaaa.', '.aaaaaaa.'],
  // 카드 단검: 금색 카드를 칼날처럼, 칩과 줄
  finance: ['....b....', '....b....', '...ggg...', '..aaaaa..', '..ayyaa..', '..ayyaa..', '..aaaaa..', '..adada..', '..aaaaa..', '..aaaaa..', '...aaa...', '....a....'],
  // 연필 레이피어: 지우개 손잡이, 긴 노란 연필, 나무 끝과 심
  study: ['...ppp...', '...ggg...', '...aaa...', '...ada...', '...aaa...', '...ada...', '...aaa...', '...ada...', '...aaa...', '...ada...', '...aaa...', '...www...', '...ww....', '....k....'],
}

export const weaponRows = (key) => WEAPON_ART[key] ?? null

const INK = '#14152b'
const darken = (hex, k = 0.62) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (shift) => Math.round(((n >> shift) & 255) * k)
  return `rgb(${c(16)},${c(8)},${c(0)})`
}
const paletteOf = (key) => {
  const color = weaponOf(key).color
  return { k: INK, w: '#ffffff', a: color, d: darken(color), b: '#8a5a3c', g: '#9aa3b8', p: '#ff8fb1', y: '#ffd84a' }
}

// 무기를 (x, y)에 cell 크기로 그린다(손잡이 가운데 위가 (x, y)). 외곽선을 먼저 칠하고 색을 얹는다.
export function paintWeapon(ctx, key, x, y, cell = 1) {
  const rows = weaponRows(key)
  if (!rows) return
  const palette = paletteOf(key)
  const left = x - (rows[0].length * cell) / 2
  ctx.fillStyle = INK
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) if (row[c] !== '.') ctx.fillRect(left + (c - 1) * cell, y + (r - 1) * cell, cell * 3, cell * 3)
  })
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] === '.') continue
      ctx.fillStyle = palette[row[c]]
      ctx.fillRect(left + c * cell, y + r * cell, cell, cell)
    }
  })
}

// 무기 한 장을 캔버스로(손잡이 위 가운데가 캔버스 위쪽 가운데). 테두리 1칸씩 여유. 같은 무기는 캔버스 만드는 함수마다 한 번만 만든다.
const caches = new WeakMap()
export function weaponImage(key, makeCanvas, cell = 1) {
  const rows = weaponRows(key)
  if (!rows || !makeCanvas) return null
  if (!caches.has(makeCanvas)) caches.set(makeCanvas, new Map())
  const cache = caches.get(makeCanvas)
  const id = `${key}:${cell}`
  if (cache.has(id)) return cache.get(id)
  const canvas = makeCanvas((rows[0].length + 2) * cell, (rows.length + 2) * cell)
  const ctx = canvas.getContext('2d')
  paintWeapon(ctx, key, canvas.width / 2, cell, cell)
  cache.set(id, canvas)
  return canvas
}
