// 12×12 도트 아이콘. 글자 하나가 칸 하나이고 '.'은 빈 칸이다.
// 아이콘은 꾸밈용이라 화면에는 항상 글자를 함께 쓴다.
export const ICON_PALETTE = {
  k: '#23264a', // 외곽선
  w: '#ffffff',
  r: '#ff5a7a',
  y: '#ffc928',
  b: '#5fb4ff',
  g: '#3fc06a',
  o: '#ff9a3c',
  n: '#8a5a2b',
  s: '#c4cbd8',
}

export const ICONS = {
  heart: [
    '............',
    '..kk....kk..',
    '.krrk..krrk.',
    'krwrrkkrrrrk',
    'krrrrrrrrrrk',
    'krrrrrrrrrrk',
    '.krrrrrrrrk.',
    '..krrrrrrk..',
    '...krrrrk...',
    '....krrk....',
    '.....kk.....',
    '............',
  ],
  sword: [
    '..........kk',
    '.........kwk',
    '........kwsk',
    '.......kwsk.',
    '......kwsk..',
    '..k..kwsk...',
    '..kkkwsk....',
    '...kosk.....',
    '..kokkk.....',
    '.kok..k.....',
    'kkk.........',
    '............',
  ],
  boot: [
    '............',
    '...kkkk.....',
    '...kbbk.....',
    '...kbbk.....',
    '...kbbk.....',
    '...kbbkkk...',
    '...kbbbbbk..',
    '..kbbbbbbbk.',
    '..kbwwbbbbbk',
    '..kkkkkkkkkk',
    '............',
    '............',
  ],
  star: [
    '.....kk.....',
    '.....kk.....',
    '....kyyk....',
    'kkkkkyykkkkk',
    'kyyyywyyyyyk',
    '.kyyyyyyyyk.',
    '..kyyyyyyk..',
    '..kyyyyyyk..',
    '.kyyykkyyyk.',
    '.kyyk..kyyk.',
    '.kkk....kkk.',
    '............',
  ],
  shield: [
    '..kkkkkkkk..',
    '.kbbbbbbbbk.',
    '.kbwwbbbbbk.',
    '.kbwbbbbbbk.',
    '.kbbbbbbbbk.',
    '.kbbbbbbbbk.',
    '.kbbbbbbbbk.',
    '..kbbbbbbk..',
    '..kbbbbbbk..',
    '...kbbbbk...',
    '....kbbk....',
    '.....kk.....',
  ],
  moon: [
    '....kkkk....',
    '..kkyyyyk...',
    '.kyyykkk....',
    '.kyyk.......',
    'kyyk........',
    'kyyk.....k..',
    'kyyk....kyk.',
    'kyyyk....k..',
    '.kyyykkk..k.',
    '.kyyyyyykkk.',
    '..kkyyyyk...',
    '....kkkk....',
  ],
  shoe: [
    '............',
    '............',
    '....kkk.....',
    '...krrrk....',
    '...krwrrk...',
    '..krrwrrrk..',
    '..krrrrrrrkk',
    '.krrrrrrrrrk',
    '.kwwwwwwwwwk',
    '.kkkkkkkkkkk',
    '............',
    '............',
  ],
  book: [
    '............',
    '.kkkk..kkkk.',
    'kwwwwkkwwwwk',
    'kwkkwkkwkkwk',
    'kwwwwkkwwwwk',
    'kwkkwkkwkkwk',
    'kwwwwkkwwwwk',
    'kwkkwkkwkkwk',
    'kwwwwkkwwwwk',
    'kbbbbkkbbbbk',
    '.kkkkkkkkkk.',
    '............',
  ],
  bowl: [
    '............',
    '............',
    '...kkkkkk...',
    '..kwwwwwwk..',
    '.kwwwwwwwwk.',
    'kkkkkkkkkkkk',
    'kooooooooook',
    '.koowooooook',
    '..koooooook.',
    '...kkkkkkk..',
    '....koook...',
    '...kkkkkkk..',
  ],
  check: [
    '............',
    '..........kk',
    '.........kgk',
    '........kggk',
    '.kk....kggk.',
    'kggk..kggk..',
    'kgggkkggk...',
    '.kgggggk....',
    '..kgggk.....',
    '...kgk......',
    '....k.......',
    '............',
  ],
  egg: [
    '....kkkk....',
    '...kwwwwk...',
    '..kwwwwwwk..',
    '..kwyywwwk..',
    '.kwwwwwwwwk.',
    '.kwwwwwyywk.',
    '.kyywwwwwwk.',
    '.kwwwwwwwwk.',
    '..kwwwwwwk..',
    '..kwwwwwwk..',
    '...kkkkkk...',
    '............',
  ],
  sparkle: [
    '.....k......',
    '.....y......',
    '.....y......',
    '..k..y..k...',
    '...yyyyy....',
    'kyyyywyyyyk.',
    '...yyyyy....',
    '..k..y..k...',
    '.....y......',
    '.....y......',
    '.....k......',
    '............',
  ],
}

const cache = new Map()

// 아이콘 이름 → PixelSprite가 그릴 수 있는 스프라이트
export function iconSprite(name) {
  if (cache.has(name)) return cache.get(name)
  const rows = ICONS[name]
  const pixels = rows.flatMap((row, y) => [...row].flatMap((char, x) => (char === '.' ? [] : [[x, y, char]])))
  const sprite = { size: 12, palette: ICON_PALETTE, layers: { body: pixels } }
  cache.set(name, sprite)
  return sprite
}

// 한국 시간 기준 시간대: 무대 하늘 색에 쓴다.
export function timeOfDay(date) {
  const hour = (date.getUTCHours() + 9) % 24
  if (hour >= 5 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}
