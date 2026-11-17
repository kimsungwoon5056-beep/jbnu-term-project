// 앱 이름 → 스마트폰 사용 종류. 아이폰이 상위 카테고리 3개만 보여 주거나,
// 안드로이드처럼 카테고리가 없는 화면에서 앱 목록으로 종류를 채울 때 쓴다.
// 이름은 소문자·공백 없이 비교한다. 모르는 앱은 other.
const DICTIONARY = {
  sns: ['instagram', '인스타그램', '카카오톡', 'kakaotalk', '메시지', 'messages', 'x', 'twitter', '트위터', 'threads', '스레드',
    'facebook', '페이스북', '에브리타임', 'everytime', 'discord', '디스코드', 'line', '라인', 'telegram', '텔레그램', 'snapchat',
    'band', '밴드', '네이버밴드', 'whatsapp', 'tiktok', '틱톡', 'bereal', 'pinterest', '핀터레스트', 'reddit'],
  video: ['youtube', '유튜브', 'netflix', '넷플릭스', '티빙', 'tving', '웨이브', 'wavve', '쿠팡플레이', '디즈니+', 'disney+', 'twitch',
    '치지직', '아프리카tv', 'soop', '왓챠', 'watcha', '라프텔', 'spotify', '스포티파이', '멜론', 'melon', '지니', 'youtubemusic', '유튜브뮤직',
    '네이버웹툰', '웹툰', '카카오페이지', '시리즈'],
  game: ['브롤스타즈', 'brawlstars', '클래시로얄', 'clashroyale', '리그오브레전드', '롤', '배틀그라운드', 'pubg', '원신', 'genshin',
    '메이플스토리', '로블록스', 'roblox', '마인크래프트', 'minecraft', '포켓몬go', '쿠키런', '애니팡', '피파모바일', 'fc모바일', '붕괴',
    '블루아카이브', '승리의여신', '니케'],
  study: ['gmail', '메일', 'mail', '노션', 'notion', '굿노트', 'goodnotes', '캘린더', 'calendar', '메모', 'notes', '토스', 'toss',
    '은행', 'kb스타뱅킹', '카카오뱅크', '신한sol', '파파고', 'papago', '듀오링고', 'duolingo', 'claude', 'chatgpt', '클래스101',
    '네이버사전', '사전', 'word', 'excel', 'powerpoint', 'teams', 'zoom', '줌', 'lms', 'e캠퍼스', '오아시스'],
  creative: ['카메라', 'camera', '사진', 'photos', 'snow', '스노우', '캡컷', 'capcut', '프로크리에이트', 'procreate', 'vllo',
    '블로', 'lightroom', '라이트룸', 'b612', '푸디'],
  shopping: ['쿠팡', 'coupang', '배달의민족', '배민', '요기요', '쿠팡이츠', '무신사', '지그재그', '에이블리', '29cm', '11번가',
    '지마켓', 'g마켓', '당근', '당근마켓', '네이버쇼핑', '올리브영', '컬리', '마켓컬리', '알리익스프레스', 'aliexpress', '테무', 'temu'],
}

const LOOKUP = new Map()
for (const [category, names] of Object.entries(DICTIONARY)) for (const name of names) LOOKUP.set(name, category)

export const normalizeAppName = (name) => name.toLowerCase().replace(/\s+/g, '')

export function categoryOfApp(name) {
  return LOOKUP.get(normalizeAppName(name)) ?? 'other'
}
