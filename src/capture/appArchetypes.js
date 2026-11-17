import { categoryOfApp, normalizeAppName } from './appCategories'

// 앱 유형(캐릭터에 스며드는 "앱 조각" 모양). 많이 쓴 앱이 캐릭터의 머리·옷·손에 스며들고, 유형마다 모양이 다르다.
export const ARCHETYPES = {
  messenger: { label: '메신저', head: '말풍선', prefix: '말풍선머리' },
  feed: { label: '사진 SNS', head: '카메라', prefix: '카메라머리' },
  video: { label: '영상', head: 'TV', prefix: 'TV머리' },
  music: { label: '음악', head: '스피커', prefix: '스피커머리' },
  game: { label: '게임', head: '게임기', prefix: '게임기머리' },
  webtoon: { label: '웹툰·읽기', head: '책', prefix: '책머리' },
  shopping: { label: '쇼핑·배달', head: '택배 상자', prefix: '상자머리' },
  finance: { label: '금융', head: '카드', prefix: '카드머리' },
  study: { label: '공부·생산성', head: '공책', prefix: '공책머리' },
}

const ARCHETYPE_APPS = {
  messenger: [
    '카카오톡', 'kakaotalk', '메시지', 'messages', '디스코드', 'discord', '라인', 'line', '텔레그램', 'telegram', 'whatsapp',
    '밴드', 'band', '네이버밴드', '페이스타임', 'facetime',
  ],
  feed: [
    'instagram', '인스타그램', 'facebook', '페이스북', 'x', 'twitter', '트위터', 'threads', '스레드', '에브리타임', 'everytime',
    'bereal', 'pinterest', '핀터레스트', 'reddit', 'snapchat', '카메라', 'camera', '사진', 'photos', 'snow', '스노우', 'b612',
  ],
  video: [
    'youtube', '유튜브', 'tiktok', '틱톡', 'netflix', '넷플릭스', '티빙', 'tving', '웨이브', 'wavve', '쿠팡플레이', '디즈니+',
    'disney+', 'twitch', '치지직', '아프리카tv', 'soop', '왓챠', 'watcha', '라프텔', '캡컷', 'capcut',
  ],
  music: [
    'spotify', '스포티파이', '멜론', 'melon', '지니', 'youtubemusic', '유튜브뮤직', '플로', 'flo', '바이브', 'vibe', 'applemusic',
    '음악', 'music',
  ],
  game: [
    '브롤스타즈', 'brawlstars', '클래시로얄', 'clashroyale', '리그오브레전드', '롤', '배틀그라운드', 'pubg', '원신', 'genshin',
    '메이플스토리', '로블록스', 'roblox', '마인크래프트', 'minecraft', '포켓몬go', '쿠키런', '애니팡', '피파모바일', 'fc모바일',
    '붕괴', '블루아카이브', '승리의여신', '니케',
  ],
  webtoon: ['네이버웹툰', '웹툰', 'webtoon', '카카오웹툰', '카카오페이지', '시리즈', '레진코믹스', '리디', 'ridi', '밀리의서재', '책'],
  shopping: [
    '쿠팡', 'coupang', '배달의민족', '배민', '요기요', '쿠팡이츠', '무신사', '지그재그', '에이블리', '29cm', '11번가', '지마켓',
    'g마켓', '당근', '당근마켓', '네이버쇼핑', '올리브영', '컬리', '마켓컬리', '알리익스프레스', 'aliexpress', '테무', 'temu',
  ],
  finance: [
    '토스', 'toss', '은행', 'kb스타뱅킹', '카카오뱅크', '신한sol', '국민은행', '우리은행', '하나은행', '페이코', 'payco',
    '카카오페이', '네이버페이', '삼성페이', '지갑', 'wallet', '업비트', 'upbit',
  ],
  study: [
    'gmail', '메일', 'mail', '노션', 'notion', '굿노트', 'goodnotes', '캘린더', 'calendar', '메모', 'notes', '파파고', 'papago',
    '듀오링고', 'duolingo', 'claude', 'chatgpt', 'gemini', '클래스101', '네이버사전', '사전', 'word', 'excel', 'powerpoint',
    'teams', 'zoom', '줌', 'lms', 'e캠퍼스', '오아시스', '사파리', 'safari', 'chrome', '크롬', '네이버', 'naver',
  ],
}
const ARCHETYPE_LOOKUP = new Map()
for (const [archetype, names] of Object.entries(ARCHETYPE_APPS)) for (const name of names) ARCHETYPE_LOOKUP.set(name, archetype)

// 사전에 없는 앱은 스마트폰 사용 종류로 대신 정한다(종류가 기타면 정하지 않음).
const CATEGORY_ARCHETYPE = { sns: 'feed', video: 'video', game: 'game', study: 'study', creative: 'feed', shopping: 'shopping', other: null }

export function archetypeOfCategory(category) {
  return CATEGORY_ARCHETYPE[category] ?? null
}

export function archetypeOfApp(name) {
  return ARCHETYPE_LOOKUP.get(normalizeAppName(name)) ?? archetypeOfCategory(categoryOfApp(name))
}

// 많이 쓰는 앱 12개는 그 앱 아이콘을 닮은 전용 머리를 그린다.
// 비상업 교육용 과제이며, 앱 이름·로고의 권리는 각 회사에 있다.
export const APP_ICONS = {
  kakaotalk: { label: '카톡', names: ['카카오톡', 'kakaotalk'] },
  instagram: { label: '인스타', names: ['instagram', '인스타그램'] },
  youtube: { label: '유튜브', names: ['youtube', '유튜브'] },
  tiktok: { label: '틱톡', names: ['tiktok', '틱톡'] },
  netflix: { label: '넷플', names: ['netflix', '넷플릭스'] },
  discord: { label: '디코', names: ['discord', '디스코드'] },
  x: { label: 'X', names: ['x', 'twitter', '트위터'] },
  everytime: { label: '에타', names: ['everytime', '에브리타임'] },
  coupang: { label: '쿠팡', names: ['coupang', '쿠팡'] },
  baemin: { label: '배민', names: ['배달의민족', '배민'] },
  toss: { label: '토스', names: ['toss', '토스'] },
  webtoon: { label: '웹툰', names: ['네이버웹툰', '웹툰', 'webtoon'] },
}
const ICON_LOOKUP = new Map()
for (const [icon, { names }] of Object.entries(APP_ICONS)) for (const name of names) ICON_LOOKUP.set(name, icon)

export function appIconOf(name) {
  return ICON_LOOKUP.get(normalizeAppName(name)) ?? null
}
