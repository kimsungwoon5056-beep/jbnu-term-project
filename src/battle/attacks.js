// 기본 공격: 머리에 스며든 1위 앱 유형마다 다르다(기술과 같은 열쇠). 앱 조각이 없으면(디톡스) 또렷한 바람 탄.
// 값은 skills.js의 Projectile.aimed가 그대로 쓴다. 무작위가 없어 같은 이벤트면 어느 화면에서나 같은 탄이 나간다.
//   cooldown: 쏘는 간격(초), shots: 한 번에 나가는 탄들 [{ angle: 조준에서 벗어난 각, …탄 값 }]
//   탄 값: speed·damage·r·life, accel(앞으로 빨라짐/음수면 되돌아옴), wave(옆으로 흔들림), bounce(벽에 튕기는 횟수), grow(커지는 속도), shape(그림)

export const ATTACKS = {
  detox: {
    name: '맑은 바람',
    desc: '곧고 빠른 바람 탄',
    cooldown: 0.5,
    shots: [{ speed: 380, damage: 3, color: '#7fe7ff', r: 5, shape: 'leaf' }],
  },
  unrecorded: {
    name: '맨손 던지기',
    desc: '평범한 탄',
    cooldown: 0.5,
    shots: [{ speed: 360, damage: 3, color: '#ffd84a', shape: 'orb' }],
  },
  messenger: {
    name: '읽씹 말풍선',
    desc: '말풍선 두 개가 나란히 나간다',
    cooldown: 0.6,
    shots: [
      { angle: -0.09, speed: 330, damage: 2, color: '#fee500', r: 5, shape: 'bubble' },
      { angle: 0.09, speed: 330, damage: 2, color: '#fee500', r: 5, shape: 'bubble' },
    ],
  },
  feed: {
    name: '하트 부메랑',
    desc: '날아갔다가 돌아오는 하트',
    cooldown: 0.62,
    shots: [{ speed: 420, damage: 5, color: '#e1306c', r: 7, accel: -560, life: 1.5, shape: 'heart' }],
  },
  video: {
    name: '배속 재생',
    desc: '처음엔 느리다가 점점 빨라진다',
    cooldown: 0.62,
    shots: [{ speed: 190, damage: 4, color: '#ff1f3d', r: 5, accel: 620, life: 1.2, shape: 'play' }],
  },
  music: {
    name: '음표 물결',
    desc: '좌우로 출렁이며 날아간다',
    cooldown: 0.48,
    shots: [{ speed: 340, damage: 4, color: '#b06be0', r: 7, wave: { amp: 14, freq: 12 }, life: 1.3, shape: 'note' }],
  },
  game: {
    name: '버튼 연타',
    desc: '약하지만 아주 빠르게 쏜다',
    cooldown: 0.32,
    shots: [{ speed: 440, damage: 2, color: '#8f7cff', r: 4, life: 0.9, shape: 'pixel' }],
  },
  webtoon: {
    name: '컷 부채',
    desc: '가까이에서 세 갈래로 퍼진다',
    cooldown: 0.66,
    shots: [-0.22, 0, 0.22].map((angle) => ({ angle, speed: 400, damage: 2, color: '#00c85a', r: 6, life: 0.6, shape: 'page' })),
  },
  shopping: {
    name: '택배 던지기',
    desc: '벽과 앱 아이콘에 두 번 튕긴다',
    cooldown: 0.66,
    shots: [{ speed: 290, damage: 4, color: '#c58b54', r: 6, bounce: 2, life: 1.9, shape: 'box' }],
  },
  finance: {
    name: '복리 동전',
    desc: '날아갈수록 커진다',
    cooldown: 0.52,
    shots: [{ speed: 290, damage: 4, color: '#ffc928', r: 4, grow: 8, life: 1.5, shape: 'coin' }],
  },
  study: {
    name: '연필 저격',
    desc: '느리게 쏘지만 빠르고 아프다',
    cooldown: 0.85,
    shots: [{ speed: 580, damage: 5, color: '#ffb21e', r: 4, life: 1, shape: 'pencil' }],
  },
}

export const attackOf = (skill) => ATTACKS[skill] ?? ATTACKS.unrecorded
