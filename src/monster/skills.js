import { THEMES, themeCounts } from './anatomy'

// 부위별 기술 (설계안 4-2 기술 사전을 부위 조립 방식으로 확장)
// 수치 단위: 피해(체력 100 기준), 재사용 대기(초), 사거리(아레나 800×500 기준 픽셀), 지속(초)
// 대전을 만들 때 이 값을 그대로 써서 기술 객체를 만든다.
export const SKILL_KINDS = {
  projectile: '발사체',
  dash: '돌진',
  melee: '근접',
  area: '범위',
  buff: '강화',
  debuff: '약화',
  heal: '회복',
  trap: '설치',
  passive: '패시브',
}

export const SKILLS = {
  // 다리
  kick: { name: '발차기', kind: 'melee', damage: 10, cooldown: 3, range: 60, desc: '앞의 상대를 걷어찬다.' },
  charge: { name: '돌진', kind: 'dash', damage: 14, cooldown: 5, range: 220, effect: { knockback: 60 }, desc: '네 발로 달려들어 부딪치고 밀쳐낸다.' },
  web: { name: '거미줄', kind: 'projectile', damage: 4, cooldown: 6, range: 300, effect: { slow: 0.5, duration: 2 }, desc: '맞은 상대가 2초 동안 절반 속도로 느려진다.' },
  hop: { name: '날쌘 도약', kind: 'dash', damage: 0, cooldown: 4, range: 160, effect: { invulnerable: 0.3 }, desc: '재빨리 뛰어올라 0.3초 동안 맞지 않는다.' },
  grab: { name: '휘감기', kind: 'projectile', damage: 8, cooldown: 7, range: 200, effect: { pull: 120 }, desc: '촉수로 감아 상대를 끌어당긴다.' },
  phase: { name: '유령 통과', kind: 'dash', damage: 0, cooldown: 6, range: 200, effect: { invulnerable: 0.6, throughWalls: true }, desc: '벽과 공격을 통과해 미끄러진다.' },
  leap: { name: '착지 충격', kind: 'area', damage: 12, cooldown: 6, range: 180, effect: { radius: 60 }, desc: '높이 뛰었다 내려앉으며 주변에 충격을 준다.' },
  goo: { name: '끈적 웅덩이', kind: 'trap', damage: 0, cooldown: 8, range: 120, effect: { slow: 0.6, duration: 4 }, desc: '밟은 상대가 4초 동안 느려지는 웅덩이를 남긴다.' },
  // 날개
  screech: { name: '초음파', kind: 'area', damage: 6, cooldown: 9, range: 140, effect: { stun: 0.6 }, desc: '가까운 상대를 0.6초 동안 기절시킨다.' },
  gust: { name: '돌풍', kind: 'area', damage: 6, cooldown: 7, range: 180, effect: { knockback: 120 }, desc: '날갯짓으로 상대와 발사체를 밀어낸다.' },
  flutter: { name: '날갯짓 가속', kind: 'buff', damage: 0, cooldown: 10, range: 0, effect: { speed: 0.4, duration: 3 }, desc: '3초 동안 이동 속도가 40% 빨라진다.' },
  fireBreath: { name: '불 뿜기', kind: 'area', damage: 18, cooldown: 8, range: 160, effect: { burn: 3, duration: 2 }, desc: '부채꼴로 불을 뿜고 2초 동안 불태운다.' },
  // 꼬리
  tailSlap: { name: '꼬리 치기', kind: 'melee', damage: 8, cooldown: 3, range: 50, desc: '꼬리로 툭 친다.' },
  tailSweep: { name: '꼬리 휩쓸기', kind: 'area', damage: 14, cooldown: 6, range: 80, effect: { knockback: 80 }, desc: '몸을 돌려 주변을 휩쓸고 밀쳐낸다.' },
  sting: { name: '독침', kind: 'projectile', damage: 6, cooldown: 7, range: 260, effect: { poison: 4, duration: 3 }, desc: '맞으면 3초 동안 독 피해를 입는다.' },
  cuddle: { name: '포근한 꼬리', kind: 'heal', damage: 0, cooldown: 12, range: 0, effect: { heal: 15 }, desc: '꼬리를 감싸 안고 체력을 15 회복한다.' },
  splash: { name: '물보라', kind: 'projectile', damage: 5, cooldown: 6, range: 220, effect: { spread: 3 }, desc: '물방울 3개를 부채꼴로 쏜다.' },
  boltTail: { name: '번개 꼬리', kind: 'projectile', damage: 16, cooldown: 8, range: 320, effect: { firstStrike: 1.5 }, desc: '빠른 번개. 대전 첫 명중은 1.5배.' },
  // 입·턱
  bite: { name: '물기', kind: 'melee', damage: 9, cooldown: 2.5, range: 50, desc: '앙 문다.' },
  peck: { name: '쪼기 연타', kind: 'melee', damage: 4, cooldown: 4, range: 50, effect: { hits: 3 }, desc: '부리로 세 번 빠르게 쫀다.' },
  vampBite: { name: '흡혈 물기', kind: 'melee', damage: 12, cooldown: 6, range: 50, effect: { lifesteal: 0.5 }, desc: '준 피해의 절반만큼 회복한다.' },
  pinch: { name: '집게 붙잡기', kind: 'melee', damage: 8, cooldown: 8, range: 55, effect: { stun: 0.8 }, desc: '집게로 붙잡아 0.8초 동안 묶는다.' },
  ember: { name: '불씨 숨결', kind: 'projectile', damage: 12, cooldown: 6, range: 240, effect: { burn: 2, duration: 2 }, desc: '불씨를 뱉어 맞은 상대를 불태운다.' },
  gulp: { name: '삼키기', kind: 'melee', damage: 20, cooldown: 12, range: 50, desc: '큰 입으로 한입에 크게 문다. 재사용이 길다.' },
  // 등(패시브)
  thorns: { name: '가시 갑옷', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { reflect: 0.2 }, desc: '근접 공격을 받으면 20%를 되돌려 준다.' },
  shellGuard: { name: '단단한 등껍질', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { damageTaken: -0.15 }, desc: '받는 피해가 15% 줄어든다.' },
  photosynthesis: { name: '광합성', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { regen: 1 }, desc: '1초마다 체력을 1 회복한다.' },
  resonance: { name: '수정 공명', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { cooldown: -0.15 }, desc: '모든 기술의 재사용 대기가 15% 짧아진다.' },
  finRush: { name: '물결 질주', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { speed: 0.1 }, desc: '이동 속도가 10% 빨라진다.' },
  // 뿔(과목) 보조
  homing: { name: '유도 탄', kind: 'projectile', damage: 10, cooldown: 7, range: 360, effect: { homing: true }, desc: '상대를 천천히 따라가는 탄을 쏜다.' },
  laser: { name: '프리즘 레이저', kind: 'projectile', damage: 14, cooldown: 9, range: 400, effect: { pierce: true }, desc: '벽 앞까지 꿰뚫는 직선 광선.' },
  taunt: { name: '도발', kind: 'debuff', damage: 0, cooldown: 10, range: 200, effect: { attack: -0.2, duration: 3 }, desc: '상대의 공격력을 3초 동안 20% 낮춘다.' },
  potion: { name: '물약', kind: 'heal', damage: 0, cooldown: 11, range: 0, effect: { heal: 12 }, desc: '체력을 12 회복한다.' },
  paint: { name: '물감 뿌리기', kind: 'area', damage: 3, cooldown: 8, range: 150, effect: { slow: 0.3, duration: 2 }, desc: '물감을 뿌려 상대를 느리게 한다.' },
  shapeWall: { name: '도형 방벽', kind: 'buff', damage: 0, cooldown: 10, range: 0, effect: { block: 1 }, desc: '다음 발사체 하나를 막는다.' },
  // 추가 다리
  frogJump: { name: '개구리 점프', kind: 'area', damage: 12, cooldown: 6, range: 200, effect: { radius: 50 }, desc: '높이 뛰어 내려앉으며 주변에 충격을 준다.' },
  crabGrip: { name: '집게 잡기', kind: 'melee', damage: 9, cooldown: 7, range: 60, effect: { stun: 0.7 }, desc: '집게로 붙잡아 0.7초 동안 묶는다.' },
  rootBind: { name: '뿌리 묶기', kind: 'trap', damage: 4, cooldown: 9, range: 160, effect: { root: 1.2 }, desc: '밟은 상대를 뿌리가 1.2초 동안 붙잡는다.' },
  cloudGlide: { name: '구름 미끄럼', kind: 'dash', damage: 0, cooldown: 5, range: 240, effect: { invulnerable: 0.2 }, desc: '구름을 타고 멀리 미끄러진다.' },
  // 추가 날개
  dust: { name: '인분 가루', kind: 'area', damage: 4, cooldown: 9, range: 150, effect: { confuse: 1 }, desc: '반짝이는 가루로 상대의 조작을 1초 동안 뒤바꾼다.' },
  bless: { name: '축복', kind: 'buff', damage: 0, cooldown: 11, range: 0, effect: { shield: 10 }, desc: '피해를 10만큼 막는 보호막을 두른다.' },
  leafBlade: { name: '잎 칼날', kind: 'projectile', damage: 11, cooldown: 6, range: 320, effect: { pierce: true }, desc: '날카로운 잎이 상대를 꿰뚫고 날아간다.' },
  whirl: { name: '회오리', kind: 'area', damage: 6, cooldown: 9, range: 180, effect: { pull: 100 }, desc: '프로펠러 바람으로 상대를 끌어당긴다.' },
  // 추가 꼬리
  fanDisplay: { name: '깃 펼치기', kind: 'debuff', damage: 0, cooldown: 10, range: 200, effect: { attack: -0.25, duration: 3 }, desc: '화려한 깃을 펼쳐 상대 공격력을 3초 동안 25% 낮춘다.' },
  roll: { name: '뒹굴기', kind: 'heal', damage: 0, cooldown: 10, range: 0, effect: { heal: 8, invulnerable: 0.4 }, desc: '데굴데굴 굴러 체력 8을 회복하고 잠깐 맞지 않는다.' },
  flameTail: { name: '불꽃 꼬리', kind: 'melee', damage: 12, cooldown: 5, range: 70, effect: { burn: 3, duration: 2 }, desc: '불붙은 꼬리로 쳐서 2초 동안 불태운다.' },
  sunbathe: { name: '햇볕 쬐기', kind: 'heal', damage: 0, cooldown: 12, range: 0, effect: { heal: 14 }, desc: '잎 꼬리로 햇볕을 모아 체력 14를 회복한다.' },
  // 추가 입·턱
  gore: { name: '들이받기', kind: 'dash', damage: 15, cooldown: 7, range: 120, effect: { knockback: 140 }, desc: '엄니로 들이받아 크게 밀쳐낸다.' },
  sense: { name: '수염 감지', kind: 'buff', damage: 0, cooldown: 10, range: 0, effect: { reveal: 4 }, desc: '4초 동안 상대 위치가 늘 보인다.' },
  tongueWhip: { name: '혀 채찍', kind: 'projectile', damage: 7, cooldown: 5, range: 180, effect: { pull: 80 }, desc: '혀를 쭉 뻗어 상대를 끌어온다.' },
  spray: { name: '물 뿌리기', kind: 'area', damage: 5, cooldown: 7, range: 160, effect: { knockback: 100 }, desc: '코로 물을 뿜어 상대를 밀어낸다.' },
  // 추가 등(패시브)
  roarAura: { name: '포효의 기운', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { enemySpeed: -0.1 }, desc: '가까운 상대의 이동 속도가 10% 느려진다.' },
  autoLoad: { name: '자동 장전', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { basicCooldown: -0.2 }, desc: '기본 공격 재사용 대기가 20% 짧아진다.' },
  spores: { name: '포자 구름', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { retaliatePoison: 1 }, desc: '맞으면 공격한 상대에게 1초 동안 독을 남긴다.' },
  starlight: { name: '별빛', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { crit: 0.15 }, desc: '치명타 확률이 15% 오른다.' },
  // 체질(피부 무늬)
  nimble: { name: '날렵한 몸', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { dodgeInvulnerable: 0.1 }, desc: '회피 대시의 무적 시간이 0.1초 늘어난다.' },
  sturdy: { name: '든든한 몸', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { maxHp: 8 }, desc: '최대 체력이 8 늘어난다.' },
  scaleArmor: { name: '단단한 비늘', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { projectileTaken: -0.15 }, desc: '발사체 피해가 15% 줄어든다.' },
  warmFur: { name: '포근한 털', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { slowResist: 0.4 }, desc: '감속 효과를 40% 덜 받는다.' },
  nightEyes: { name: '밤의 눈', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { darkVision: 0.5 }, desc: '어두운 아레나에서 시야가 50% 넓다.' },
  steelBody: { name: '강철 몸', kind: 'passive', damage: 0, cooldown: 0, range: 0, effect: { meleeTaken: -0.15 }, desc: '근접 피해가 15% 줄어든다.' },
}

// 부위 계열 → 기술
export const PART_SKILLS = {
  legs: {
    biped: 'kick',
    beast: 'charge',
    spider: 'web',
    insect: 'hop',
    tentacle: 'grab',
    ghost: 'phase',
    bird: 'leap',
    slime: 'goo',
    frog: 'frogJump',
    crab: 'crabGrip',
    roots: 'rootBind',
    cloud: 'cloudGlide',
  },
  wings: {
    none: null,
    bat: 'screech',
    feather: 'gust',
    insect: 'flutter',
    dragon: 'fireBreath',
    butterfly: 'dust',
    angel: 'bless',
    leaf: 'leafBlade',
    propeller: 'whirl',
  },
  tail: {
    stub: 'tailSlap',
    dragon: 'tailSweep',
    stinger: 'sting',
    fluffy: 'cuddle',
    fish: 'splash',
    bolt: 'boltTail',
    peacock: 'fanDisplay',
    curly: 'roll',
    flame: 'flameTail',
    leaf: 'sunbathe',
    none: null,
  },
  jaw: {
    plain: 'bite',
    beak: 'peck',
    fangs: 'vampBite',
    mandible: 'pinch',
    snout: 'ember',
    maw: 'gulp',
    tusks: 'gore',
    whiskers: 'sense',
    tongue: 'tongueWhip',
    trunk: 'spray',
  },
  back: {
    none: null,
    spikes: 'thorns',
    shell: 'shellGuard',
    sprout: 'photosynthesis',
    crystal: 'resonance',
    sail: 'finRush',
    mane: 'roarAura',
    gears: 'autoLoad',
    mushrooms: 'spores',
    stars: 'starlight',
  },
  skin: { plain: null, stripes: 'nimble', spots: 'sturdy', scales: 'scaleArmor', fur: 'warmFur', galaxy: 'nightEyes', plates: 'steelBody' },
}

export const HORN_SKILLS = { code: 'homing', prism: 'laser', bubble: 'taunt', flask: 'potion', brush: 'paint', poly: 'shapeWall' }

// 세트 효과: 같은 테마 부위가 2개면 반쪽, 3개 이상이면 완전한
export const SET_BONUSES = {
  dragon: { effect: '불 계열 피해', unit: '%', values: [20, 40] },
  bug: { effect: '감속·독 지속 시간', unit: '%', values: [30, 60] },
  bird: { effect: '이동 속도', unit: '%', values: [10, 20] },
  ghost: { effect: '무적 시간', unit: '초', values: [0.2, 0.4] },
  sea: { effect: '회복량', unit: '%', values: [20, 40] },
  beast: { effect: '근접 피해', unit: '%', values: [15, 30] },
  forest: { effect: '초당 회복', unit: '', values: [1, 2] },
  sky: { effect: '대시·점프 거리', unit: '%', values: [15, 30] },
  machine: { effect: '기술 재사용 대기 단축', unit: '%', values: [10, 20] },
}

const ACTIVE_SLOTS = ['wings', 'tail', 'legs', 'jaw'] // 세기가 같을 때 이 순서로 앞선다

// 부위 조합 → 장착 기술 { q, e, passive, trait, assist, sets }
export function buildLoadout(life) {
  const anatomy = life.anatomy
  const actives = ACTIVE_SLOTS.map((slot, order) => ({
    slot,
    order,
    id: PART_SKILLS[slot][anatomy[slot].kind],
    strength: anatomy[slot].strength,
  }))
    .filter((entry) => entry.id)
    .sort((a, b) => b.strength - a.strength || a.order - b.order)
  const [q, e] = actives.filter((entry, i, list) => list.findIndex((other) => other.id === entry.id) === i)
  const passiveId = PART_SKILLS.back[anatomy.back.kind]
  const traitId = anatomy.skin ? PART_SKILLS.skin[anatomy.skin.kind] : null
  const hornId = life.horns[0] ? HORN_SKILLS[life.horns[0].kind] : null
  const taken = new Set([q?.id, e?.id])

  const counts = themeCounts(anatomy)
  const sets = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([theme, count]) => {
      const level = count >= 3 ? 2 : 1
      const bonus = SET_BONUSES[theme]
      return {
        theme,
        level,
        name: `${level === 2 ? '완전한' : '반쪽'} ${THEMES[theme].label}`,
        desc: `${bonus.effect} +${bonus.values[level - 1]}${bonus.unit}`,
      }
    })
    .sort((a, b) => b.level - a.level || a.theme.localeCompare(b.theme))

  const slot = (id, from) => (id ? { id, from, ...SKILLS[id] } : null)
  return {
    q: slot(q?.id, q?.slot),
    e: slot(e?.id, e?.slot),
    passive: slot(passiveId, 'back'),
    trait: slot(traitId, 'skin'),
    assist: hornId && !taken.has(hornId) ? slot(hornId, 'horn') : null,
    sets,
  }
}
