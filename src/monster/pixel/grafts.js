import { drawLine, fillEllipse, fillPolygon, fillRect, getCell, setCell, stamp } from './grid'

// 앱 조각 도트. 머리는 19×17 앱 아이콘 모양으로 몸 위에 얹는다(작은 몬스터일수록 머리가 커 보이는 "앱에 먹힌" 느낌).
// 많이 쓰는 앱 12개는 실제 앱 아이콘을 닮게 그린다(비상업 교육용, 앱 이름·로고의 권리는 각 회사에 있음).
export const HEAD_W = 19
export const HEAD_H = 17

// 둥근 네모(모서리 2칸 깎기)
function roundedRect(grid, x0, y0, w, h, color) {
  fillRect(grid, x0, y0, w, h, color)
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
  ]) {
    setCell(grid, x0 + dx, y0 + dy, null)
    setCell(grid, x0 + w - 1 - dx, y0 + dy, null)
    setCell(grid, x0 + dx, y0 + h - 1 - dy, null)
    setCell(grid, x0 + w - 1 - dx, y0 + h - 1 - dy, null)
  }
}

// 3×5 도트 글자(카카오톡 TALK)
const FONT = {
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  K: ['#.#', '##.', '#..', '##.', '#.#'],
}
function text(grid, word, x, y, color) {
  ;[...word].forEach((char, i) => stamp(grid, FONT[char], x + i * 4, y, { legend: { '#': color } }))
}

// 원 둘레(고리)
function ring(grid, cx, cy, inner, outer, color) {
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y += 1) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x += 1) {
      const d = Math.hypot(x - cx, y - cy)
      if (d >= inner && d <= outer) setCell(grid, x, y, color)
    }
  }
}

// 머리 그리기: (x0, y0)은 19×17 칸의 왼쪽 위. 좌표는 그 안의 상대 위치로 적는다.
const HEADS = {
  // ----- 앱 아이콘을 닮은 머리 -----
  kakaotalk(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'y')
    fillEllipse(g, x + 9, y + 7, 8.6, 5.4, 'b')
    fillPolygon(g, [[x + 4, y + 10], [x + 8, y + 11], [x + 3, y + 15]], 'b')
    text(g, 'TALK', x + 2, y + 5, 'y')
  },
  instagram(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'Q')
    for (let dy = 0; dy < HEAD_H; dy += 1) {
      for (let dx = 0; dx < HEAD_W; dx += 1) {
        if (getCell(g, x + dx, y + dy) === null) continue
        const d = dx + (HEAD_H - 1 - dy) // 왼쪽 아래(노랑) → 오른쪽 위(보라)
        setCell(g, x + dx, y + dy, d < 9 ? 'A' : d < 16 ? 'O' : d < 24 ? 'i' : 'Q')
      }
    }
    // 흰 둥근 네모 테두리(카메라 몸체)
    for (let i = 4; i <= 14; i += 1) {
      setCell(g, x + i, y + 3, 'W')
      setCell(g, x + i, y + 13, 'W')
    }
    for (let i = 4; i <= 12; i += 1) {
      setCell(g, x + 3, y + i, 'W')
      setCell(g, x + 15, y + i, 'W')
    }
    ring(g, x + 9, y + 8, 2.4, 3.4, 'W')
    fillRect(g, x + 12, y + 5, 2, 1, 'W')
  },
  youtube(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'W')
    roundedRect(g, x + 2, y + 3, 15, 11, 'U')
    fillPolygon(g, [[x + 7, y + 5], [x + 7, y + 11.5], [x + 12.5, y + 8.2]], 'W')
  },
  tiktok(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'Z')
    const note = (ox, oy, color) => {
      fillRect(g, x + 9 + ox, y + 3 + oy, 2, 9, color)
      fillRect(g, x + 11 + ox, y + 3 + oy, 2, 2, color)
      fillRect(g, x + 12 + ox, y + 5 + oy, 2, 1, color)
      fillEllipse(g, x + 7.5 + ox, y + 11.5 + oy, 2.6, 2.2, color)
    }
    note(-1, -1, 't')
    note(1, 1, 'e')
    note(0, 0, 'W')
  },
  netflix(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'Z')
    fillRect(g, x + 5, y + 2, 2, 13, 'F')
    fillRect(g, x + 12, y + 2, 2, 13, 'F')
    drawLine(g, x + 5, y + 2, x + 13, y + 14, 'F')
    drawLine(g, x + 6, y + 2, x + 13, y + 13, 'F')
  },
  discord(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'I')
    fillEllipse(g, x + 9, y + 9, 6.5, 4.2, 'W')
    fillRect(g, x + 4, y + 4, 3, 3, 'W')
    fillRect(g, x + 12, y + 4, 3, 3, 'W')
  },
  x(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'Z')
    drawLine(g, x + 4, y + 3, x + 14, y + 13, 'W')
    drawLine(g, x + 5, y + 3, x + 15, y + 13, 'W')
    drawLine(g, x + 14, y + 3, x + 4, y + 13, 'W')
  },
  everytime(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'W')
    for (let a = 25; a <= 155; a += 5) {
      const rad = (a * Math.PI) / 180
      setCell(g, Math.round(x + 9 + Math.cos(rad) * 6), Math.round(y + 6 + Math.sin(rad) * 6), 'Z')
      setCell(g, Math.round(x + 9 + Math.cos(rad) * 5), Math.round(y + 6 + Math.sin(rad) * 5), 'Z')
    }
    fillEllipse(g, x + 10, y + 5, 1.6, 1.6, 'w')
  },
  coupang(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'W')
    fillEllipse(g, x + 9, y + 8, 6.6, 6.2, 'U')
    for (let a = 0; a < 360; a += 30) {
      const rad = (a * Math.PI) / 180
      setCell(g, Math.round(x + 9 + Math.cos(rad) * 7.6), Math.round(y + 8 + Math.sin(rad) * 7.2), 'U')
    }
    for (let i = 4; i <= 14; i += 2) fillRect(g, x + i, y + 7, 1, 3, 'W')
  },
  baemin(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'a')
    fillRect(g, x + 3, y + 3, 13, 1, 'W')
    for (const bx of [4, 8, 12]) fillRect(g, x + bx, y + 5, 2, 9, 'W')
    fillRect(g, x + 4, y + 9, 10, 1, 'a')
  },
  toss(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'W')
    fillPolygon(g, [[x + 4, y + 10], [x + 9, y + 3], [x + 14, y + 6], [x + 10, y + 13]], 's')
    fillPolygon(g, [[x + 8, y + 11], [x + 13, y + 7], [x + 14, y + 11], [x + 10, y + 14]], 'u')
  },
  webtoon(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'x')
    fillRect(g, x + 3, y + 3, 13, 8, 'W')
    fillPolygon(g, [[x + 5, y + 11], [x + 8, y + 11], [x + 5, y + 14]], 'W')
    fillRect(g, x + 5, y + 5, 9, 1, 'x')
    fillRect(g, x + 5, y + 8, 6, 1, 'x')
  },
  // ----- 유형 모양 머리(전용 아이콘이 없는 앱) -----
  messenger(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'l')
    fillEllipse(g, x + 9, y + 7, 7, 4.6, 'W')
    fillPolygon(g, [[x + 5, y + 10], [x + 8, y + 11], [x + 4, y + 14]], 'W')
    for (const dx of [6, 9, 12]) fillRect(g, x + dx - 1, y + 7, 2, 2, 'l')
  },
  feed(g, x, y) {
    HEADS.instagram(g, x, y)
    fillRect(g, x + 4, y + 4, 11, 9, 'i')
    stamp(g, ['.WW.WW.', 'WWWWWWW', 'WWWWWWW', '.WWWWW.', '..WWW..', '...W...'], x + 6, y + 5)
  },
  video(g, x, y) {
    drawLine(g, x + 6, y, x + 9, y + 3, 'k')
    drawLine(g, x + 13, y, x + 10, y + 3, 'k')
    roundedRect(g, x, y + 3, HEAD_W, HEAD_H - 3, 'Z')
    fillRect(g, x + 2, y + 5, 15, 9, 'u')
    fillPolygon(g, [[x + 7, y + 6.5], [x + 7, y + 12.5], [x + 12, y + 9.5]], 'W')
  },
  music(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'Q')
    fillRect(g, x + 7, y + 3, 2, 9, 'W')
    fillRect(g, x + 12, y + 2, 2, 9, 'W')
    fillRect(g, x + 7, y + 2, 7, 2, 'W')
    fillEllipse(g, x + 6, y + 12, 2.3, 1.8, 'W')
    fillEllipse(g, x + 11, y + 11, 2.3, 1.8, 'W')
  },
  game(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'd')
    fillRect(g, x + 3, y + 2, 13, 7, 'u')
    fillRect(g, x + 4, y + 12, 3, 1, 'Z')
    fillRect(g, x + 5, y + 11, 1, 3, 'Z')
    fillRect(g, x + 12, y + 11, 2, 2, 'N')
    fillRect(g, x + 14, y + 13, 2, 2, 'N')
  },
  webtoonGeneric(g, x, y) {
    roundedRect(g, x, y, HEAD_W, HEAD_H, 'j')
    fillRect(g, x + 2, y + 2, 7, 13, 'W')
    fillRect(g, x + 10, y + 2, 7, 13, 'W')
    for (const ly of [5, 8, 11]) {
      fillRect(g, x + 3, y + ly, 5, 1, 'k')
      fillRect(g, x + 11, y + ly, 5, 1, 'k')
    }
  },
  shopping(g, x, y) {
    fillRect(g, x, y + 1, HEAD_W, HEAD_H - 1, 'z')
    fillRect(g, x, y + 1, HEAD_W, 1, 'n')
    fillRect(g, x + 8, y + 1, 3, HEAD_H - 1, 'W')
    fillRect(g, x + 12, y + 10, 5, 3, 'W')
  },
  finance(g, x, y) {
    roundedRect(g, x, y + 2, HEAD_W, HEAD_H - 3, 's')
    fillRect(g, x, y + 5, HEAD_W, 2, 'Z')
    fillRect(g, x + 3, y + 9, 4, 3, 'A')
    fillRect(g, x + 10, y + 10, 6, 1, 'W')
  },
  study(g, x, y) {
    roundedRect(g, x + 1, y, HEAD_W - 1, HEAD_H, 'W')
    for (const ly of [4, 7, 10, 13]) fillRect(g, x + 4, y + ly, 13, 1, 'u')
    fillRect(g, x + 4, y + 1, 1, HEAD_H - 2, 'N')
    for (let ly = 2; ly < HEAD_H - 1; ly += 3) fillRect(g, x, y + ly, 2, 1, 'k')
  },
}

// 전용 아이콘(icon) 또는 유형(archetype)의 머리를 (hx, hy) 가운데에 그린다.
export function paintAppHead(grid, key, hx, hy) {
  const draw = HEADS[key] ?? HEADS.messenger
  draw(grid, hx - Math.floor(HEAD_W / 2), hy - Math.floor(HEAD_H / 2))
}

// 유형 머리 열쇠(웹툰 유형과 웹툰 아이콘은 이름이 같아 유형 쪽을 따로 둔다)
export const headKeyOf = (graft) => graft.icon ?? (graft.archetype === 'webtoon' ? 'webtoonGeneric' : graft.archetype)

// 눈 조각: 눈 자리 두 곳에 찍는다. 공부 유형은 눈을 그대로 두고 안경테만 씌운다.
export const EYE_GRAFTS = {
  messenger: ['P.P.P'],
  feed: ['.kk.', 'kuuk', 'kuuk', '.kk.'],
  video: ['UUUU', 'UWUU', 'UWWU', 'UWUU', 'UUUU'],
  music: ['..P', '..P', 'PPP', 'PP.'],
  game: ['.P.', 'PPP', '.P.'],
  webtoon: ['P', 'P', '.', 'P'],
  shopping: ['.jjj', 'jjWj', '.jjj'],
  finance: ['.AA.', 'AYYA', 'AYYA', '.AA.'],
  study: ['kkkkk', 'k...k', 'k...k', 'kkkkk'],
}

// 몸통 조각: 배 자리에 붙은 9×7 화면(테두리 + 무늬)
export const TORSO_GRAFTS = {
  messenger: ['WWWW...', 'WWWWW..', '.......', '...yyyy', '..yyyyy'],
  feed: ['.NN.NN.', 'NNNNNNN', '.NNNNN.', '..NNN..', '...N...'],
  video: ['uuuuuuu', 'uuWuuuu', 'uuWWuuu', 'uuWuuuu', 'NNNkkkk'],
  music: ['.....l.', '.l...l.', '.l.l.l.', 'll.l.ll', 'lllllll'],
  game: ['.......', '.P...N.', 'PPP.N.N', '.P...N.', '.......'],
  webtoon: ['WWW.WWW', 'WWW.WWW', '.......', 'WWWWWWW', 'WWWWWWW'],
  shopping: ['k......', '.kkkkkk', '.k.k.k.', '.kkkkkk', '..o..o.'],
  finance: ['sssssss', 'ZZZZZZZ', 'sssssss', 'sAAssss', 'sssssss'],
  study: ['g.kkkk.', '.......', 'g.kkkk.', '.......', 'N.kkkk.'],
}

export function paintTorsoGraft(grid, archetype, cx, top) {
  const x0 = cx - 4
  fillRect(grid, x0, top, 9, 7, 'k')
  fillRect(grid, x0 + 1, top + 1, 7, 5, archetype === 'webtoon' ? 'Z' : 'W')
  stamp(grid, TORSO_GRAFTS[archetype], x0 + 1, top + 1)
}
