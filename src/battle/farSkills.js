import { ATTACKS } from './attacks'
import { Projectile, Trap, Turret } from './skills'

// E 원거리 기술: 앱 유형마다 하나, 쿨다운이 길어(18초) 가끔만 쓴다. 판이 시작하고 FAR.lock초 뒤부터 쓸 수 있다.
// 예전의 원거리 기술과 원거리 기본 공격(attacks.js의 탄 모양 표)을 다듬어 다시 쓴다. 제품(Projectile·Trap·Turret)은 skills.js와 같다.
// (skills.js와 서로 가져오지만, 제품은 cast 안에서만 만들므로 불러오는 순서와 상관없다.)
export const FAR = { cooldown: 18, slow: 25, lock: 10 }

// Projectile.aimed는 이벤트의 배율(m)을 스스로 곱한다. 덫·재생기·터지는 조각처럼 따로 놓이는 것만 여기서 곱한다.
const power = (ev, damage) => Math.round(damage * (ev.m ?? 1))
const fan = (ev, count, gap, spec) => Array.from({ length: count }, (_, i) => Projectile.aimed(ev, ev.a + (i - (count - 1) / 2) * gap, spec))
const shot = (key) => ATTACKS[key].shots[0]

export const FAR_SKILLS = {
  detox: {
    name: '맑은 돌풍',
    desc: '곧고 빠른 바람 탄 3개가 부채꼴로 나간다',
    cooldown: FAR.cooldown,
    cast: (ev) => fan(ev, 3, 0.18, { ...shot('detox'), damage: 5, r: 6, life: 0.9 }),
  },
  unrecorded: {
    name: '돌 던지기',
    desc: '약한 탄 하나',
    cooldown: FAR.slow,
    cast: (ev) => [Projectile.aimed(ev, ev.a, { ...shot('unrecorded'), damage: 4 })],
  },
  messenger: {
    name: '단톡 폭탄',
    desc: '커다란 말풍선이 날아가 터지며 알림 8개로 흩어진다',
    cooldown: FAR.cooldown,
    cast: (ev) => [
      Projectile.aimed(ev, ev.a, {
        speed: 260,
        damage: 7,
        color: '#fee500',
        r: 10,
        life: 0.75,
        shape: 'bubble',
        burst: { count: 8, spec: { speed: 260, damage: power(ev, 4), color: '#fee500', r: 5, life: 0.6, shape: 'bubble' } },
      }),
    ],
  },
  feed: {
    name: '하트 부메랑',
    desc: '하트 3개가 날아갔다가 돌아온다',
    cooldown: FAR.cooldown,
    cast: (ev) => fan(ev, 3, 0.22, { ...shot('feed'), damage: 5 }),
  },
  video: {
    name: '자동 재생',
    desc: '조준한 곳에 재생 버튼 덫과, 4초 동안 스스로 쏘는 재생기를 놓는다',
    cooldown: FAR.cooldown,
    cast: (ev) => [
      new Trap({ owner: ev.o, x: ev.x + Math.cos(ev.a) * 120, y: ev.y + Math.sin(ev.a) * 120, r: 18, life: 8, damage: power(ev, 8), stun: 0.8, color: '#ff1f3d' }),
      new Turret({
        owner: ev.o,
        x: ev.x + Math.cos(ev.a) * 46,
        y: ev.y + Math.sin(ev.a) * 46,
        life: 4,
        every: 1,
        range: 260,
        color: '#ff1f3d',
        spec: { speed: 300, damage: power(ev, 3), color: '#ff1f3d', r: 5, life: 1, shape: 'play' },
      }),
    ],
  },
  music: {
    name: '음파',
    desc: '좌우로 출렁이는 음표 3개가 부채꼴로 퍼진다',
    cooldown: FAR.cooldown,
    cast: (ev) => fan(ev, 3, 0.3, { ...shot('music'), damage: 5 }),
  },
  game: {
    name: '탄막',
    desc: '8발을 부채처럼 쓸어 쏜다',
    cooldown: FAR.cooldown,
    cast: (ev) => Array.from({ length: 8 }, (_, i) => Projectile.aimed(ev, ev.a + Math.sin((i / 7) * Math.PI * 2) * 0.22, { speed: 430, damage: 3, color: '#6b5fd3', r: 5, shape: 'pixel', delay: i * 0.07 })),
  },
  webtoon: {
    name: '다음 화 광선',
    desc: '벽 전까지 꿰뚫는 빠른 광선',
    cooldown: FAR.cooldown,
    cast: (ev) => [Projectile.aimed(ev, ev.a, { speed: 700, damage: 11, color: '#00c85a', r: 8, pierce: true, life: 1, shape: 'page' })],
  },
  shopping: {
    name: '로켓 배송',
    desc: '택배 상자 2개가 양옆으로 나가 가장 가까운 상대를 쫓아간다',
    cooldown: FAR.cooldown,
    cast: (ev) => [-0.5, 0.5].map((turn) => Projectile.aimed(ev, ev.a + turn, { speed: 230, damage: 7, color: '#c58b54', r: 7, homing: 8, life: 1.6, shape: 'box' })),
  },
  finance: {
    name: '동전 산탄',
    desc: '날아갈수록 커지는 동전 6개가 부채꼴로 퍼진다',
    cooldown: FAR.cooldown,
    cast: (ev) => fan(ev, 6, 0.16, { ...shot('finance'), damage: 4, grow: 6 }),
  },
  study: {
    name: '연필 저격',
    desc: '꿰뚫는 빠른 연필 한 자루(피해 큼)',
    cooldown: FAR.cooldown,
    cast: (ev) => [Projectile.aimed(ev, ev.a, { ...shot('study'), speed: 640, damage: 12, pierce: true, life: 1 })],
  },
}

export const farOf = (key) => FAR_SKILLS[key] ?? FAR_SKILLS.unrecorded
