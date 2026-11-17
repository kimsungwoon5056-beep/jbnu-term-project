import { APP_ICONS, ARCHETYPES } from '../capture/appArchetypes'

// 앱이 캐릭터에 스며드는 모양: 앱마다 주색·보조색, 5×5 미니 로고, 머리에 올 때의 모양(gear)
// 많이 쓰는 앱 12개는 앱 아이콘을 닮게 그린다(비상업 교육용 과제, 앱 이름·로고의 권리는 각 회사에 있음).
// 로고 글자 → 색(아래 C). '.'은 빈 칸

export const C = {
  W: '#ffffff',
  k: '#2d2f3a', // 기기 몸체
  y: '#fee500', // 카카오 노랑
  b: '#3c1e1e', // 말풍선 갈색
  i: '#e1306c', // 인스타 분홍
  O: '#f77737', // 주황
  Q: '#833ab4', // 보라
  A: '#ffc928', // 노랑(금색)
  U: '#ff1f3d', // 유튜브 빨강
  Z: '#141414', // 검정
  F: '#e50914', // 넷플릭스 빨강
  I: '#5865f2', // 디스코드 남보라
  t: '#25f4ee', // 틱톡 청록
  e: '#fe2c55', // 틱톡 다홍
  a: '#2ac1bc', // 배민 민트
  s: '#2f6bff', // 토스 파랑
  w: '#e5332a', // 에타 빨강
  x: '#00c85a', // 웹툰 초록
  l: '#22b14c', // 메신저 초록
  d: '#6b5fd3', // 게임 보라
  z: '#c58b54', // 상자 갈색
  j: '#ffb21e', // 테이프 주황
  u: '#7fd3ff', // 화면 하늘
  g: '#dfe6f2', // 밝은 회색
}

// gear: 머리 1위일 때의 모양. dye(머리를 앱 색으로 물들이고 로고 핀), cap(모자), helmet(헬멧), headset(헤드셋), hood(후드)
export const APP_LOOKS = {
  kakaotalk: { main: C.y, sub: C.b, gear: 'dye', logo: ['.yyy.', 'ybbby', 'ybbby', 'ybyyy', '.yyy.'] },
  instagram: { main: C.i, sub: C.Q, gear: 'dye', gradient: [C.A, C.O, C.i, C.Q], logo: ['iWWWQ', 'WOiQW', 'WiWiW', 'WAOiW', 'AWWWi'] },
  youtube: { main: C.U, sub: C.W, gear: 'cap', logo: ['UUUUU', 'UWUUU', 'UWWUU', 'UWUUU', 'UUUUU'] },
  tiktok: { main: C.Z, sub: C.t, gear: 'hood', logo: ['ZZWZZ', 'ZZWWZ', 'ZZWZZ', 'tWWZZ', 'ZWWeZ'] },
  netflix: { main: C.Z, sub: C.F, gear: 'hood', logo: ['FZZZF', 'FFZZF', 'FZFZF', 'FZZFF', 'FZZZF'] },
  discord: { main: C.I, sub: C.W, gear: 'headset', logo: ['IIIII', 'IWWWI', 'WIWIW', 'WWWWW', 'IWIWI'] },
  x: { main: C.Z, sub: C.W, gear: 'dye', logo: ['WZZZW', 'ZWZWZ', 'ZZWZZ', 'ZWZWZ', 'WZZZW'] },
  everytime: { main: C.w, sub: C.W, gear: 'dye', logo: ['wWWWw', 'wWwww', 'wWWww', 'wWwww', 'wWWWw'] },
  coupang: { main: C.W, sub: C.U, gear: 'cap', logo: ['WjUiW', 'jWWWW', 'AWWWW', 'xWWWW', 'WsxsW'] },
  baemin: { main: C.a, sub: C.W, gear: 'helmet', logo: ['aWWaa', 'aWaWa', 'aWWaa', 'aWaWa', 'aWWaa'] },
  toss: { main: C.s, sub: C.W, gear: 'dye', logo: ['WWWWW', 'WsssW', 'WWsWW', 'WWsWW', 'WWWWW'] },
  webtoon: { main: C.x, sub: C.W, gear: 'dye', logo: ['WxxxW', 'WxxxW', 'WxWxW', 'WWxWW', 'WxxxW'] },
  // 전용 아이콘이 없는 앱은 유형 모양
  messenger: { main: C.l, sub: C.W, gear: 'dye', logo: ['lllll', 'lWWWl', 'lWWWl', 'lWlll', 'lllll'] },
  feed: { main: C.i, sub: C.W, gear: 'dye', logo: ['iiiii', 'iWWWi', 'iWiWi', 'iWWWi', 'iiiii'] },
  video: { main: C.U, sub: C.W, gear: 'hood', logo: ['kkkkk', 'kuuuk', 'kuWuk', 'kkkkk', '.k.k.'] },
  music: { main: C.Q, sub: C.W, gear: 'headset', logo: ['QQWWQ', 'QQWQW', 'QQWQQ', 'QWWQQ', 'QWWQQ'] },
  game: { main: C.d, sub: C.A, gear: 'headset', logo: ['ddddd', 'dWddA', 'WWWdd', 'dWdAd', 'ddddd'] },
  webtoonGeneric: { main: C.O, sub: C.W, gear: 'dye', logo: ['OOOOO', 'OWOWO', 'OWOWO', 'OWOWO', 'OOOOO'] },
  shopping: { main: C.z, sub: C.j, gear: 'cap', logo: ['zzjzz', 'zzjzz', 'jjjjj', 'zzjzz', 'zzjzz'] },
  finance: { main: C.s, sub: C.A, gear: 'dye', logo: ['sssss', 'sAAss', 'sssss', 'sWWWs', 'sssss'] },
  study: { main: C.u, sub: C.s, gear: 'dye', logo: ['WWWWW', 'sssss', 'WWWWW', 'sssss', 'WWWWW'] },
}

export const APP_LOOK_KEYS = Object.keys(APP_LOOKS)

// 조각 → 모양 키(21개 중 하나)
export const lookKeyOf = (graft) => graft.icon ?? (graft.archetype === 'webtoon' ? 'webtoonGeneric' : graft.archetype)

// 화면에 보일 이름: "인스타", "말풍선"
export function lookLabel(key) {
  if (APP_ICONS[key]) return APP_ICONS[key].label
  if (key === 'webtoonGeneric') return ARCHETYPES.webtoon.head
  return ARCHETYPES[key]?.head ?? key
}

export const GEAR_LABELS = {
  dye: '물든 머리',
  cap: '모자',
  helmet: '배달 헬멧',
  headset: '헤드셋',
  hood: '후드',
}
