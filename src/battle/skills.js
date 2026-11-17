// 앱 기술(Q): 머리에 스며든 1위 앱 유형마다 하나. 앱 조각이 없으면 가장 강한 "디톡스 실드".
// Factory: 시전 이벤트(누가·어디서·어느 방향) → 만들어질 발사체·덫·충격파·자기 효과 목록.
// 같은 이벤트면 어느 화면에서도 같은 결과가 나오도록 무작위를 쓰지 않는다.

const shot = (ev, angle, spec) => ({
  type: 'proj',
  owner: ev.o,
  x: ev.x + Math.cos(angle) * 18,
  y: ev.y + Math.sin(angle) * 18,
  vx: Math.cos(angle) * spec.speed,
  vy: Math.sin(angle) * spec.speed,
  r: spec.r ?? 4,
  damage: Math.round(spec.damage * (ev.m ?? 1)),
  life: spec.life ?? 1.1,
  color: spec.color,
  pierce: spec.pierce ?? false,
  homing: spec.homing ?? 0,
  delay: spec.delay ?? 0,
})

const spread = (ev, count, gap, spec) =>
  Array.from({ length: count }, (_, i) => shot(ev, ev.a + (i - (count - 1) / 2) * gap, spec))

export const BASIC_SHOT = { speed: 380, damage: 8, color: '#ffd84a' }

export const SKILLS = {
  detox: {
    name: '디톡스 실드',
    desc: '3초 동안 무적 + 체력 20 회복. 폰을 줄인 사람만 쓰는 가장 강한 기술',
    cooldown: 10,
    cast: (ev) => [{ type: 'self', owner: ev.o, effect: 'shield', time: 3, heal: 20 }],
  },
  unrecorded: {
    name: '기술 없음',
    desc: '오늘 스크린 타임을 기록하면 앱 기술이 생겨요',
    cooldown: 99,
    cast: () => [],
  },
  messenger: {
    name: '단톡 폭탄',
    desc: '말풍선 3갈래를 두 번 던진다',
    cooldown: 6,
    cast: (ev) => [
      ...spread(ev, 3, 0.22, { speed: 320, damage: 6, color: '#fee500', r: 5 }),
      ...spread(ev, 3, 0.22, { speed: 320, damage: 6, color: '#fee500', r: 5, delay: 0.2 }),
    ],
  },
  feed: {
    name: '좋아요 폭발',
    desc: '하트 8개가 사방으로 터진다',
    cooldown: 7,
    cast: (ev) => spread(ev, 8, (Math.PI * 2) / 8, { speed: 300, damage: 7, color: '#e1306c', r: 5, life: 0.9 }),
  },
  video: {
    name: '자동 재생',
    desc: '조준한 곳에 재생 버튼 덫. 밟으면 0.8초 멈춤 + 피해 12',
    cooldown: 8,
    cast: (ev) => [
      { type: 'trap', owner: ev.o, x: ev.x + Math.cos(ev.a) * 120, y: ev.y + Math.sin(ev.a) * 120, r: 18, life: 6, damage: 12, stun: 0.8, color: '#ff1f3d' },
    ],
  },
  music: {
    name: '볼륨 최대',
    desc: '주변을 밀어내는 충격파(피해 10)',
    cooldown: 7,
    cast: (ev) => [{ type: 'ring', owner: ev.o, x: ev.x, y: ev.y, r: 95, damage: Math.round(10 * (ev.m ?? 1)), push: 70, color: '#833ab4' }],
  },
  game: {
    name: '연타',
    desc: '0.5초 동안 5발을 빠르게 쏜다',
    cooldown: 6,
    cast: (ev) => Array.from({ length: 5 }, (_, i) => shot(ev, ev.a, { speed: 420, damage: 6, color: '#6b5fd3', delay: i * 0.1 })),
  },
  webtoon: {
    name: '다음 화 보기',
    desc: '벽 전까지 꿰뚫는 빠른 광선(피해 14)',
    cooldown: 7,
    cast: (ev) => [shot(ev, ev.a, { speed: 700, damage: 14, color: '#00c85a', r: 6, pierce: true, life: 1 })],
  },
  shopping: {
    name: '로켓 배송',
    desc: '가장 가까운 상대를 쫓아가는 택배 상자(피해 16)',
    cooldown: 8,
    cast: (ev) => [shot(ev, ev.a, { speed: 230, damage: 16, color: '#c58b54', r: 7, homing: 3, life: 2.4 })],
  },
  finance: {
    name: '잔액 보호',
    desc: '2초 동안 무적',
    cooldown: 9,
    cast: (ev) => [{ type: 'self', owner: ev.o, effect: 'shield', time: 2, heal: 0 }],
  },
  study: {
    name: '집중 모드',
    desc: '3초 동안 빨라지고 공격이 1.3배',
    cooldown: 9,
    cast: (ev) => [{ type: 'self', owner: ev.o, effect: 'focus', time: 3, heal: 0 }],
  },
}

// 시전 이벤트 → 만들어질 것들. ev: { k: 'shot'|'skill', o, x, y, a, s?, m? } (아이템 줍기 'pick'은 world.js가 따로 처리)
export function expandEvent(ev) {
  if (ev.k === 'shot') return [shot(ev, ev.a, BASIC_SHOT)]
  return (SKILLS[ev.s] ?? SKILLS.detox).cast(ev)
}
