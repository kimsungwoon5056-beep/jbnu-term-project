import { hashString } from './random'

// 부위 조립(키메라). 몸을 여섯 자리로 나누고, 자리마다 모양이 아예 다른 계열 중 하나를 고른다.
// 점수 = 생활 근거 점수 × 성장 특징 세기 + 계정별 작은 치우침(0~0.15). 기본 계열은 고정 점수 0.35.
// 생활 특징이 뚜렷해야 기본 계열을 이기고, 비슷한 생활이라도 계정마다 다른 계열이 나올 수 있다.

export const PART_FAMILIES = {
  legs: {
    biped: '두 발',
    beast: '네 발 짐승',
    spider: '거미 다리',
    insect: '곤충 다리',
    tentacle: '촉수',
    ghost: '유령 꼬리',
    bird: '새 발',
    slime: '슬라임 바닥',
    frog: '개구리 다리',
    crab: '게 다리',
    roots: '뿌리',
    cloud: '구름 타기',
  },
  wings: {
    none: '없음',
    bat: '박쥐 날개',
    feather: '깃털 날개',
    insect: '곤충 날개',
    dragon: '용 날개',
    butterfly: '나비 날개',
    angel: '천사 날개',
    leaf: '잎사귀 날개',
    propeller: '프로펠러',
  },
  tail: {
    stub: '짧은 꼬리',
    dragon: '용 꼬리',
    stinger: '전갈 침',
    fluffy: '복슬 꼬리',
    fish: '물고기 꼬리',
    bolt: '번개 꼬리',
    peacock: '공작 꼬리',
    curly: '돼지 꼬리',
    flame: '불꽃 꼬리',
    leaf: '잎사귀 꼬리',
    none: '없음',
  },
  jaw: {
    plain: '기본 입',
    beak: '부리',
    fangs: '송곳니',
    mandible: '집게 턱',
    snout: '용 주둥이',
    maw: '큰 입',
    tusks: '엄니',
    whiskers: '고양이 수염',
    tongue: '메롱 혀',
    trunk: '코끼리 코',
  },
  back: {
    none: '없음',
    spikes: '가시',
    shell: '등껍질',
    sprout: '새싹',
    crystal: '수정 결정',
    sail: '등지느러미',
    mane: '갈기',
    gears: '톱니바퀴',
    mushrooms: '버섯',
    stars: '별자리',
  },
  skin: {
    plain: '민무늬',
    stripes: '줄무늬',
    spots: '점박이',
    scales: '비늘',
    fur: '털',
    galaxy: '은하',
    plates: '금속판',
  },
}

export const SLOTS = Object.keys(PART_FAMILIES)

// 기본 계열(특징이 없을 때)
export const DEFAULT_FAMILY = { legs: 'biped', wings: 'none', tail: 'stub', jaw: 'plain', back: 'none', skin: 'plain' }
const BASE_SCORE = 0.35
const BIAS = 0.15

// 학명에 붙는 짧은 접두
export const PART_PREFIX = {
  legs: {
    beast: '네발',
    spider: '거미다리',
    insect: '곤충다리',
    tentacle: '촉수',
    ghost: '유령',
    bird: '새발',
    slime: '흐물',
    frog: '개구리다리',
    crab: '게다리',
    roots: '뿌리내린',
    cloud: '구름탄',
  },
  wings: {
    bat: '박쥐날개',
    feather: '깃털날개',
    insect: '잠자리날개',
    dragon: '용날개',
    butterfly: '나비날개',
    angel: '천사날개',
    leaf: '잎날개',
    propeller: '프로펠러',
  },
  tail: {
    dragon: '용꼬리',
    stinger: '전갈꼬리',
    fluffy: '복슬꼬리',
    fish: '물고기꼬리',
    bolt: '번개꼬리',
    peacock: '공작꼬리',
    curly: '돼지꼬리',
    flame: '불꽃꼬리',
    leaf: '잎꼬리',
  },
  jaw: {
    beak: '부리',
    fangs: '송곳니',
    mandible: '집게턱',
    snout: '용주둥이',
    maw: '큰입',
    tusks: '엄니',
    whiskers: '수염',
    tongue: '메롱',
    trunk: '코끼리코',
  },
  back: {
    spikes: '가시등',
    shell: '등껍질',
    sprout: '새싹',
    crystal: '수정등',
    sail: '돛지느러미',
    mane: '갈기',
    gears: '톱니',
    mushrooms: '버섯등',
    stars: '별자리',
  },
  skin: { stripes: '줄무늬', spots: '점박이', scales: '비늘', fur: '털북숭이', galaxy: '은하', plates: '강철' },
}

// 테마: 같은 테마 부위가 모이면 "반쪽 용", "완전한 용"이 된다(학명·세트 효과). 한 계열은 한 테마에만 속한다.
export const THEMES = {
  dragon: { label: '용', parts: [['wings', 'dragon'], ['tail', 'dragon'], ['jaw', 'snout'], ['back', 'spikes'], ['skin', 'scales']] },
  bug: {
    label: '벌레',
    parts: [['legs', 'spider'], ['legs', 'insect'], ['wings', 'insect'], ['jaw', 'mandible'], ['tail', 'stinger'], ['wings', 'butterfly']],
  },
  bird: { label: '새', parts: [['legs', 'bird'], ['wings', 'feather'], ['jaw', 'beak'], ['tail', 'peacock']] },
  ghost: { label: '유령', parts: [['legs', 'ghost'], ['wings', 'bat'], ['jaw', 'maw'], ['skin', 'galaxy']] },
  sea: { label: '바다', parts: [['tail', 'fish'], ['back', 'sail'], ['legs', 'tentacle'], ['back', 'shell'], ['legs', 'crab']] },
  beast: {
    label: '짐승',
    parts: [['legs', 'beast'], ['jaw', 'fangs'], ['tail', 'fluffy'], ['back', 'mane'], ['jaw', 'tusks'], ['skin', 'fur']],
  },
  forest: { label: '숲', parts: [['legs', 'roots'], ['wings', 'leaf'], ['tail', 'leaf'], ['back', 'sprout'], ['back', 'mushrooms']] },
  sky: { label: '하늘', parts: [['legs', 'cloud'], ['wings', 'angel'], ['back', 'stars']] },
  machine: { label: '기계', parts: [['wings', 'propeller'], ['back', 'gears'], ['skin', 'plates']] },
}

const clamp01 = (value) => Math.min(1, Math.max(0, value))

// 지표·세부 값 → 자리별 계열 근거 점수(0~1 근처)
export function partAffinities(m, details) {
  const workout = (...types) => types.reduce((sum, type) => sum + (details.workouts?.[type] ?? 0), 0)
  const subject = (...names) => names.reduce((sum, name) => sum + (details.subjects?.[name] ?? 0), 0)
  const swim = clamp01(workout('swimming') / 150)
  const ball = clamp01(workout('ball') / 150)
  const climb = clamp01(workout('climbing') / 150)
  const walk = clamp01(workout('walking') / 200)
  const run = clamp01(workout('running') / 200)
  const bend = clamp01(workout('yoga', 'stretching') / 150)
  const code = clamp01(subject('코딩', '프로그래밍') / 300)
  const art = clamp01(subject('예술', '미술', '음악') / 240)
  const lowExercise = 1 - clamp01(m.exTotal * 4)
  const rush = clamp01((m.weekendRush - 2 / 7) / (1 - 2 / 7))
  const morning = m.sleepReg * (1 - m.nightOwl)
  return {
    legs: {
      beast: m.exTotal * m.cardio * 1.2,
      spider: m.nightOwl * m.studyTotal * 1.3,
      insect: m.studySpread * m.studyTotal * 1.1,
      tentacle: m.moodSwing * 0.9,
      ghost: m.sleepLen < 0.35 ? (1 - m.sleepLen) * 0.8 : 0,
      bird: morning * m.moodAvg * 1.1,
      slime: Math.max(m.gap * 0.95, lowExercise * 0.36),
      frog: ball * 1.1,
      crab: climb * 1.1,
      roots: m.habitDone * m.mealReg * 0.95,
      cloud: m.sleepLen * m.moodAvg * 0.85,
    },
    wings: {
      bat: m.nightOwl * 0.75,
      feather: morning * 0.75,
      insect: m.studySpread * 0.6,
      dragon: m.exTotal * m.power * 0.6 + m.streak * 0.3,
      butterfly: Math.max(art, m.moodAvg * m.studySpread * 0.75),
      angel: m.streak * m.habitDone * 1.2,
      leaf: walk,
      propeller: code,
    },
    tail: {
      dragon: m.exTotal * m.power * 0.9,
      stinger: rush * 0.9,
      fluffy: m.moodAvg * 0.65,
      fish: swim,
      bolt: m.weekendRush * m.moodSwing,
      peacock: Math.max(art * 0.9, m.moodAvg * m.sleepReg * 0.7),
      curly: m.lateSnack * lowExercise * 0.95,
      flame: m.moodSwing * m.exTotal * 1.2,
      leaf: bend,
    },
    jaw: {
      beak: morning * 0.7,
      fangs: m.lateSnack * 0.8,
      mandible: m.studyTotal * 0.7,
      snout: m.exTotal * m.power * 0.85,
      maw: (1 - m.mealReg) * 0.7,
      tusks: clamp01(workout('strength') / 200),
      whiskers: m.nightOwl * (1 - m.studyTotal) * 0.9,
      tongue: m.moodAvg * m.moodSwing * 1.1,
      trunk: m.studySpread * morning * 1.0,
    },
    back: {
      spikes: m.exTotal * 0.7,
      shell: m.habitDone * 0.8,
      sprout: m.moodAvg * m.habitDone * 0.95,
      crystal: m.studyTotal * m.studySpread * 0.9,
      sail: swim * 0.9,
      mane: run,
      gears: code * 0.95,
      mushrooms: (1 - m.sleepReg) * 0.6,
      stars: m.nightOwl * m.streak * 1.2,
    },
    skin: {
      stripes: m.exTotal * m.sleepReg * 0.9,
      spots: m.lateSnack * 0.7,
      scales: m.power * m.exTotal * 0.8,
      fur: Math.max(walk, run) * 0.85,
      galaxy: m.nightOwl * 0.7,
      plates: code * 0.9,
    },
  }
}

// uid·자리·계열로 정해지는 작은 치우침
const biasOf = (uid, slot, family) => ((hashString(`part:${uid}:${slot}:${family}`) % 1000) / 1000) * BIAS

export function chooseAnatomy(uid, metrics, details, featureScale = 1) {
  const affinities = partAffinities(metrics, details)
  const anatomy = {}
  for (const slot of SLOTS) {
    const candidates = Object.keys(PART_FAMILIES[slot])
      .filter((family) => !(slot === 'tail' && family === 'none'))
      .map((family) => {
        const base = family === DEFAULT_FAMILY[slot] ? BASE_SCORE : (affinities[slot][family] ?? 0) * featureScale
        return { family, score: base + biasOf(uid, slot, family) }
      })
      .sort((a, b) => b.score - a.score || a.family.localeCompare(b.family))
    const best = candidates[0]
    const fallback = candidates.find((c) => c.family === DEFAULT_FAMILY[slot])
    anatomy[slot] = { kind: best.family, strength: Math.max(0, best.score - fallback.score) }
  }
  // 유령·슬라임·구름 하반신에는 꼬리가 붙지 않는다.
  if (['ghost', 'slime', 'cloud'].includes(anatomy.legs.kind)) anatomy.tail = { kind: 'none', strength: 0 }
  return anatomy
}

// 몬스터가 가진 테마별 부위 개수
export function themeCounts(anatomy) {
  const counts = {}
  for (const [theme, { parts }] of Object.entries(THEMES)) {
    counts[theme] = parts.filter(([slot, family]) => anatomy[slot]?.kind === family).length
  }
  return counts
}
