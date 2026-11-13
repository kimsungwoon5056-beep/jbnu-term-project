// 손으로 찍은 작은 도트 그림들. 글자 하나가 칸 하나이고, 글자는 팔레트 색 이름이다('.'은 빈 칸).
// 왼쪽 방향 그림은 오른쪽에 쓸 때 좌우로 뒤집어 찍는다.

// 뿔 머리 부분(아래 가운데가 뿔 대에 붙는 자리)
export const HORN_TOPS = {
  code: ['HHHHHHHHH', 'HhohhoohH', 'HohhohhoH', 'HhoohhohH', 'HHHHHHHHH'],
  bubble: ['.hhhhh.', 'hhhhhhh', 'hohohoh', 'hhhhhhh', '.hhhhh.', '...h...'],
  flask: ['.hhh.', '..h..', '.hhh.', 'hHHHh', 'HHHHH', '.HHH.'],
  brush: ['.H.', 'HHH', 'HHH', 'HHH', '.T.'],
}

// 뿔이 3개 이상이면 머리 위가 붐비므로 작은 그림을 쓴다.
export const HORN_TOPS_MINI = {
  code: ['HHHHH', 'HohoH', 'HHHHH'],
  bubble: ['.hhh.', 'hohoh', '.hhh.'],
  flask: ['.h.', 'hHh', 'HHH'],
  brush: ['.H.', 'HHH', 'HHH'],
}

// 눈 흰자 모양. 눈동자는 따로 그린다.
export const EYE_WHITES = {
  round: { big: ['.WW.', 'WWWW', 'WWWW', '.WW.'], small: ['WWW', 'WWW', 'WWW'] },
  halfMoon: { big: ['WWWW', 'WWWW', '.WW.'], small: ['WWW', '.W.'] },
  star: { big: ['..W..', '.WWW.', 'WWWWW', '.WWW.', 'W...W'], small: ['.W.', 'WWW', 'W.W'] },
  cyclops: { big: ['.WWWW.', 'WWWWWW', 'WWWWWW', 'WWWWWW', '.WWWW.'], small: ['.WWW.', 'WWWWW', 'WWWWW', '.WWW.'] },
  compound: { big: ['WW', 'WW'], small: ['WW', 'WW'] },
}

// 귀·지느러미(왼쪽 기준). 오른쪽 아래 칸이 머리에 붙는다.
export const EARS = {
  pointy: ['M...', 'MM..', 'MMM.', 'MMMM'],
  round: ['.MM.', 'MMMM', 'MMMM', '.MM.'],
  fin: ['MM...', '.MMM.', '..MMM', '...MM'],
  antenna: ['H...', '.o..', '..o.', '...o'],
}

export const TAIL_TIPS = {
  bolt: ['..YY', '.YY.', 'YYYY', '.YY.', 'YY..', 'Y...'],
  round: ['.H.', 'HHH', '.H.'],
}

export const CROWN = ['G.G.G', 'GGGGG', 'GGGGG']
export const GLOVE = ['.WW.', 'WWWW', 'WWWW', '.WW.'] // 주먹
export const MOSS = ['.g.', 'ggg']
export const SPARKLE = ['.A.', 'AAA', '.A.']

export const HABIT_PATTERNS = {
  dot: ['XX', 'XX'],
  stripe: ['X.X', 'X.X'],
  wave: ['.X.X', 'X.X.'],
  check: ['X.X', '.X.', 'X.X'],
  star: ['.X.', 'XXX', '.X.'],
}

// 입: 기분이 좋으면 웃고, 나쁘면 입꼬리가 처진다.
export const MOUTHS = {
  smile: { big: ['o...o', '.ooo.'], small: ['o.o', '.o.'] },
  flat: { big: ['.ooo.'], small: ['ooo'] },
  frown: { big: ['.ooo.', 'o...o'], small: ['.o.', 'o.o'] },
}
