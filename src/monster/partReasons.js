import { formatMinutes } from '../records/recordFormat'
import { PHONE_CATEGORIES, WORKOUT_TYPES } from '../records/recordOptions'
import { wellnessOf } from '../stats/stats'
import { categoryOfApp } from '../capture/appCategories'
import { GEAR, GEAR_RULES } from './gear'
import { DEFAULT_FAMILY, PART_FAMILIES, SLOTS } from './anatomy'
import { BODY_TYPES, EYE_SHAPES, HORN_LABELS } from './genome'

// 부위 설명 (설계안 3-5): "이 부위가 왜 이렇게 생겼을까?"를 실제로 입력한 최근 7일 숫자로 보여 준다.
// 근거 문장은 anatomy.js partAffinities의 점수 공식과 같은 항을 쓰고, max·합으로 된 공식은 실제로 이긴 항을 고른다.

export const SLOT_TITLES = { legs: '다리', wings: '날개', tail: '꼬리', jaw: '입', back: '등', skin: '피부' }

const CODING = ['코딩', '프로그래밍']
const ART = ['예술', '미술', '음악']

// 2:10 (자정 넘은 시각도 그대로)
const clock = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

// 근거 사실 문장. 숫자가 0이라 근거가 될 수 없으면 null을 돌려준다.
function factsFrom(raw, known = {}) {
  const days = raw.recordedDays
  const workoutMinutes = (...types) => types.reduce((total, type) => total + (raw.workouts[type] ?? 0), 0)
  const subjectMinutes = (...names) => names.reduce((total, name) => total + (raw.subjects[name] ?? 0), 0)
  const categoryShare = (category) => {
    if (raw.exerciseWeek === 0) return 0
    const minutes = Object.entries(raw.workouts)
      .filter(([type]) => WORKOUT_TYPES[type]?.category === category)
      .reduce((total, [, value]) => total + value, 0)
    return Math.round((minutes / raw.exerciseWeek) * 100)
  }
  const subjectCount = Object.values(raw.subjects).filter((minutes) => minutes > 0).length
  return {
    sleep: () => (days ? `평균 수면 ${formatMinutes(raw.sleepMinutes)}` : null),
    bed: () => (raw.bedTime === null ? null : `평균 취침 ${clock(raw.bedTime)}`),
    bedSpread: () => (days < 2 ? `최근 7일 기록이 ${days === 0 ? '없어' : '하루뿐이라'} 잠드는 시각이 규칙적인지 아직 몰라요` : raw.bedSpread === 0 ? '매일 같은 시각에 잠' : `취침 시각 차이 약 ${formatMinutes(raw.bedSpread)}`),
    exercise: () => (raw.exerciseWeek === 0 ? '최근 7일 운동 기록 없음' : `운동 7일 ${formatMinutes(raw.exerciseWeek)}`),
    study: () => (raw.studyWeek === 0 ? null : `공부 7일 ${formatMinutes(raw.studyWeek)}`),
    subjectCount: () => (subjectCount < 2 ? null : `과목 ${subjectCount}개를 공부`),
    workout: (...types) => {
      const parts = types
        .filter((type) => (raw.workouts[type] ?? 0) > 0)
        .map((type) => `${WORKOUT_TYPES[type].label} 7일 ${formatMinutes(raw.workouts[type])}`)
      return parts.length ? parts.join(', ') : null
    },
    subject: (...names) => {
      const parts = names.filter((name) => (raw.subjects[name] ?? 0) > 0).map((name) => `${name} 7일 ${formatMinutes(raw.subjects[name])}`)
      return parts.length ? parts.join(', ') : null
    },
    share: (category) => {
      const percent = categoryShare(category)
      const label = { cardio: '유산소', power: '근력', flex: '유연성' }[category]
      return percent === 0 ? null : `운동 중 ${label} ${percent}%`
    },
    mood: () => (days ? `기분 평균 ${raw.moodAvg} / 5` : null),
    moodSwing: () => (raw.moodHigh > raw.moodLow ? `기분이 ${raw.moodLow}~${raw.moodHigh} 사이로 오르내림` : null),
    lateSnack: () => (raw.lateSnackDays ? `야식 ${days}일 중 ${raw.lateSnackDays}일` : null),
    fullMeals: () => (raw.fullMealDays ? `세 끼 챙긴 날 ${days}일 중 ${raw.fullMealDays}일` : null),
    skippedMeals: () => (days - raw.fullMealDays > 0 ? `끼니 거른 날 ${days}일 중 ${days - raw.fullMealDays}일` : null),
    habit: () => (raw.habitRate ? `습관 완료 ${raw.habitRate}%` : null),
    streak: () => (raw.streakDays ? `${raw.streakDays}일 연속 기록` : null),
    gap: () => (days < 7 ? `기록 안 한 날 7일 중 ${7 - days}일` : null),
    weekend: () => (raw.weekendShare ? `활동의 ${raw.weekendShare}%가 주말` : null),
    // 스마트폰·걸음(입력한 날의 하루 평균)
    phoneTotal: () => (known.phone && raw.phoneTotal ? `화면 시간 하루 평균 ${formatMinutes(raw.phoneTotal)}` : null),
    phoneCategory: (key) => {
      const minutes = known.phone ? (raw.phoneCategories?.[key] ?? 0) : 0
      return minutes ? `${PHONE_CATEGORIES[key].label} 앱 하루 ${formatMinutes(minutes)}` : null
    },
    pickups: () => (known.phone && raw.pickups ? `화면 깨우기 하루 ${raw.pickups}번` : null),
    notifications: () => (known.phone && raw.notifications ? `알림 하루 ${raw.notifications}개` : null),
    nightPhone: () =>
      known.phone && raw.nightPickupDays ? `밤 0~4시에 처음 폰을 깨운 날 ${raw.firstPickupDays}일 중 ${raw.nightPickupDays}일` : null,
    steps: () => (known.steps ? `걸음 하루 평균 ${raw.steps.toLocaleString('ko-KR')}걸음` : null),
    known,
    // 점수 공식에서 쓰는 값(0~1)도 함께 넘겨 이긴 항을 고를 수 있게 한다.
    minutesOf: { workout: workoutMinutes, subject: subjectMinutes },
  }
}

// 계열별 조건 문장(when)과 근거(facts). facts(f, m)는 사실 문장 목록을 돌려준다.
// 기본 계열은 근거 대신 "특징이 없어 기본 모양" 문장을 쓴다.
export const PART_REASONS = {
  legs: {
    biped: { when: '뚜렷한 생활 특징이 없으면' },
    beast: {
      when: '유산소 운동이나 걷기를 많이 하면',
      facts: (f, m) =>
        m.exTotal * m.cardio * 1.2 >= stepsOf(f, m) * 0.9 ? [f.exercise(), f.share('cardio')] : [f.steps()],
    },
    spider: { when: '밤늦게까지 공부하면', facts: (f) => [f.bed(), f.study()] },
    insect: { when: '여러 과목을 많이 공부하면', facts: (f) => [f.subjectCount(), f.study()] },
    tentacle: {
      when: '기분이 자주 오르내리거나 소셜 앱을 많이 쓰면',
      facts: (f, m) => (m.moodSwing * 0.9 >= ph(f, m.snsShare) * 0.8 ? [f.moodSwing()] : [f.phoneCategory('sns')]),
    },
    ghost: { when: '잠이 아주 부족하면', facts: (f) => [f.sleep()] },
    bird: { when: '일찍 규칙적으로 자고 기분이 좋으면', facts: (f) => [f.bed(), f.mood()] },
    slime: {
      when: '기록을 빠뜨리거나, 운동을 쉬거나, 폰만 보고 덜 걸으면',
      facts: (f, m) => {
        const terms = [
          [m.gap * 0.95, [f.gap()]],
          [(1 - Math.min(1, m.exTotal * 4)) * 0.36, [f.exercise()]],
          [ph(f, m.phoneTotal) * (1 - stepsOf(f, m)) * 0.7, [f.phoneTotal(), f.steps()]],
        ]
        return terms.reduce((best, term) => (term[0] > best[0] ? term : best))[1]
      },
    },
    frog: { when: '구기 운동을 하면', facts: (f) => [f.workout('ball')] },
    crab: { when: '클라이밍을 하면', facts: (f) => [f.workout('climbing')] },
    roots: { when: '습관을 지키고 세 끼를 챙기면', facts: (f) => [f.habit(), f.fullMeals()] },
    cloud: { when: '푹 자고 기분이 좋으면', facts: (f) => [f.sleep(), f.mood()] },
  },
  wings: {
    none: { when: '뚜렷한 생활 특징이 없으면' },
    bat: {
      when: '늦게 자거나 밤에 폰을 보면',
      facts: (f, m) => (m.nightOwl * 0.75 >= ph(f, m.lateNightPhone) * 0.7 ? [f.bed()] : [f.nightPhone()]),
    },
    feather: { when: '일찍 규칙적으로 자면', facts: (f) => [f.bed(), f.bedSpread()] },
    insect: { when: '여러 과목을 고르게 공부하면', facts: (f) => [f.subjectCount()] },
    dragon: {
      when: '근력 운동을 많이 하거나 꾸준히 기록하면',
      facts: (f, m) => (m.exTotal * m.power * 0.6 >= m.streak * 0.3 ? [f.exercise(), f.share('power')] : [f.streak()]),
    },
    butterfly: {
      when: '예술 과목을 하거나 기분 좋게 여러 과목을 하면',
      facts: (f, m) => {
        const art = Math.min(1, f.minutesOf.subject(...ART) / 240)
        return art >= m.moodAvg * m.studySpread * 0.75 ? [f.subject(...ART)] : [f.mood(), f.subjectCount()]
      },
    },
    angel: { when: '꾸준히 기록하며 습관을 지키면', facts: (f) => [f.streak(), f.habit()] },
    leaf: { when: '걷기를 많이 하면', facts: (f) => [f.workout('walking')] },
    propeller: {
      when: '코딩을 공부하거나 공부 앱을 많이 쓰면',
      facts: (f, m) =>
        Math.min(1, f.minutesOf.subject(...CODING) / 300) >= ph(f, m.studyAppShare) * 0.7
          ? [f.subject(...CODING)]
          : [f.phoneCategory('study')],
    },
  },
  tail: {
    stub: { when: '뚜렷한 생활 특징이 없으면' },
    none: { when: '하반신 모양 때문에' },
    dragon: { when: '근력 운동을 많이 하면', facts: (f) => [f.exercise(), f.share('power')] },
    stinger: { when: '주말에 몰아서 하면', facts: (f) => [f.weekend()] },
    fluffy: { when: '기분이 좋으면', facts: (f) => [f.mood()] },
    fish: { when: '수영을 하면', facts: (f) => [f.workout('swimming')] },
    bolt: { when: '주말에 몰아치고 기분이 오르내리면', facts: (f) => [f.weekend(), f.moodSwing()] },
    peacock: {
      when: '예술 과목을 하거나 규칙적으로 기분 좋게 지내면',
      facts: (f, m) => {
        const art = Math.min(1, f.minutesOf.subject(...ART) / 240)
        return art * 0.9 >= m.moodAvg * m.sleepReg * 0.7 ? [f.subject(...ART)] : [f.mood(), f.bedSpread()]
      },
    },
    curly: { when: '야식을 먹고 운동을 쉬면', facts: (f) => [f.lateSnack(), f.exercise()] },
    flame: {
      when: '운동을 많이 하고 기분이 오르내리거나 게임을 많이 하면',
      facts: (f, m) =>
        m.moodSwing * m.exTotal * 1.2 >= ph(f, m.gameShare) * 0.9 ? [f.exercise(), f.moodSwing()] : [f.phoneCategory('game')],
    },
    leaf: { when: '요가·스트레칭을 하면', facts: (f) => [f.workout('yoga', 'stretching')] },
  },
  jaw: {
    plain: { when: '뚜렷한 생활 특징이 없으면' },
    beak: { when: '일찍 규칙적으로 자면', facts: (f) => [f.bed(), f.bedSpread()] },
    fangs: { when: '야식을 자주 먹으면', facts: (f) => [f.lateSnack()] },
    mandible: { when: '공부를 많이 하면', facts: (f) => [f.study()] },
    snout: { when: '근력 운동을 많이 하면', facts: (f) => [f.exercise(), f.share('power')] },
    maw: { when: '끼니를 자주 거르면', facts: (f) => [f.skippedMeals()] },
    tusks: { when: '근력 운동(헬스)을 하면', facts: (f) => [f.workout('strength')] },
    whiskers: { when: '늦게 자고 공부는 적으면', facts: (f) => [f.bed()] },
    tongue: {
      when: '기분이 좋으면서 오르내리거나 알림이 많으면',
      facts: (f, m) =>
        m.moodAvg * m.moodSwing * 1.1 >= ph(f, m.notifications) * 0.8 ? [f.mood(), f.moodSwing()] : [f.notifications()],
    },
    trunk: { when: '일찍 자고 여러 과목을 공부하면', facts: (f) => [f.subjectCount(), f.bed()] },
  },
  back: {
    none: { when: '뚜렷한 생활 특징이 없으면' },
    spikes: { when: '운동을 많이 하면', facts: (f) => [f.exercise()] },
    shell: { when: '습관을 잘 지키면', facts: (f) => [f.habit()] },
    sprout: { when: '기분 좋게 습관을 지키면', facts: (f) => [f.mood(), f.habit()] },
    crystal: { when: '여러 과목을 많이 공부하면', facts: (f) => [f.study(), f.subjectCount()] },
    sail: { when: '수영을 하면', facts: (f) => [f.workout('swimming')] },
    mane: {
      when: '달리기나 걷기를 많이 하면',
      facts: (f, m) =>
        Math.min(1, f.minutesOf.workout('running') / 200) >= stepsOf(f, m) * 0.7 ? [f.workout('running')] : [f.steps()],
    },
    gears: { when: '코딩을 공부하면', facts: (f) => [f.subject(...CODING)] },
    mushrooms: { when: '자는 시각이 들쭉날쭉하면', facts: (f) => [f.bedSpread()] },
    stars: {
      when: '늦게 자면서 꾸준히 기록하거나 밤에 폰을 보면',
      facts: (f, m) => (m.nightOwl * m.streak * 1.2 >= ph(f, m.lateNightPhone) * 0.6 ? [f.bed(), f.streak()] : [f.nightPhone()]),
    },
  },
  skin: {
    plain: { when: '뚜렷한 생활 특징이 없으면' },
    stripes: { when: '운동하고 규칙적으로 자면', facts: (f) => [f.exercise(), f.bedSpread()] },
    spots: { when: '야식을 자주 먹으면', facts: (f) => [f.lateSnack()] },
    scales: { when: '근력 운동을 많이 하면', facts: (f) => [f.exercise(), f.share('power')] },
    fur: {
      when: '걷기·달리기를 많이 하면',
      facts: (f, m) => {
        const walkRun = Math.max(Math.min(1, f.minutesOf.workout('walking') / 200), Math.min(1, f.minutesOf.workout('running') / 200))
        return walkRun * 0.85 >= stepsOf(f, m) * 0.6 ? [f.workout('walking', 'running')] : [f.steps()]
      },
    },
    galaxy: {
      when: '늦게 자거나 영상을 많이 보면',
      facts: (f, m) => (m.nightOwl * 0.7 >= ph(f, m.videoShare) * 0.9 ? [f.bed()] : [f.phoneCategory('video')]),
    },
    plates: { when: '코딩을 공부하면', facts: (f) => [f.subject(...CODING)] },
  },
}

// 입력하지 않은 스마트폰·걸음은 0으로 본다(anatomy.js와 같은 규칙).
function ph(f, value) {
  return f.known.phone ? value : 0
}
function stepsOf(f, m) {
  return f.known.steps ? m.steps : 0
}

const listFacts = (items) => items.filter(Boolean).join(', ')
// "졸린 눈꺼풀 — 평균 수면 5시간" (근거 숫자가 없으면 이름만)
const note = (label, fact) => (fact ? `${label} — ${fact}` : label)

function slotEntry(slot, part, { f, metrics, stage, legsKind }) {
  const label = PART_FAMILIES[slot][part.kind]
  const entry = { key: slot, title: SLOT_TITLES[slot], label, strength: part.strength }
  if (part.forced) {
    return { ...entry, reason: `${PART_FAMILIES.legs[legsKind]} 하반신이라 꼬리가 붙지 않아요.` }
  }
  if (part.kind === DEFAULT_FAMILY[slot]) {
    entry.reason = stage === 'baby' ? '새끼라 아직 특징이 약하게 드러나요.' : '아직 눈에 띄는 생활 특징이 없어 기본 모양이에요.'
  } else {
    const reason = listFacts(PART_REASONS[slot][part.kind].facts(f, metrics))
    entry.reason = reason || '최근 생활이 조금씩 쌓여 생긴 모양이에요.'
    entry.facts = reason
  }
  if (part.next) entry.next = { label: PART_FAMILIES[slot][part.next], when: PART_REASONS[slot][part.next].when }
  return entry
}

// 몬스터 유전자 + 지표 → 부위 설명 목록 [{ key, title, label, reason, next? }]
export function explainParts(genome, metrics, details) {
  const life = genome.life
  if (!life) return []
  const raw = details.raw
  const known = details.known ?? {}
  const f = factsFrom(raw, known)
  const anatomy = life.anatomy
  const entries = SLOTS.map((slot) =>
    slotEntry(slot, anatomy[slot], { f, metrics, stage: genome.stage, legsKind: anatomy.legs.kind }),
  )

  // 건강: 몬스터를 약하게 만든 습관(총합에서 깎인 비율)과 그 근거
  const wellness = wellnessOf(metrics, raw.recordedDays, known)
  const causeFacts = {
    phoneTotal: f.phoneTotal,
    lateNightPhone: f.nightPhone,
    pickups: f.pickups,
    lowSteps: f.steps,
    lowSleep: f.sleep,
    notifications: f.notifications,
    lateSnack: f.lateSnack,
    skippedMeals: f.skippedMeals,
  }
  const causeText = wellness.causes
    .slice(0, 3)
    .map((cause) => {
      const fact = causeFacts[cause.key]()
      return `${fact ?? cause.label}(−${Math.max(1, Math.round(cause.amount * 100))}%)`
    })
    .join(', ')
  const healthReason = causeText ? `${causeText}. 줄이면 몬스터가 다시 강해져요.` : '몬스터를 약하게 만드는 습관이 보이지 않아요.'
  entries.unshift({
    key: 'health',
    title: '건강',
    label: `${Math.round(wellness.factor * 100)}%`,
    reason: known.phone ? healthReason : `${healthReason} 스마트폰 기록을 넣으면 더 정확해져요.`,
    strength: 0,
  })

  // 장비: 가장 많이 쓴 앱 종류가 눈에 보이는 물건이 된다. 그 종류의 실제 앱 이름도 함께 보여 준다.
  const gear = life.gear ?? { kind: 'none', category: null }
  let gearReason
  if (gear.kind === 'sneakers') gearReason = `${f.steps()}. 폰을 적게 쓰고 많이 걸어서 운동화를 신었어요.`
  else if (gear.kind === 'phone') gearReason = `${f.phoneTotal()}. 여러 앱을 고르게 써서 그냥 폰을 쥐고 있어요.`
  else if (gear.kind !== 'none') {
    const apps = (raw.topApps ?? []).filter((app) => categoryOfApp(app.name) === gear.category).map((app) => app.name)
    gearReason = `${f.phoneCategory(gear.category)}${apps.length ? `(${apps.join('·')})` : ''}. ${GEAR[gear.kind].desc}`
  } else if (known.phone) gearReason = '폰을 적게 써서 손이 비어 있어요.'
  else gearReason = '스마트폰 기록을 넣으면 가장 많이 쓴 앱이 장비로 보여요.'
  entries.push({
    key: 'gear',
    title: '장비',
    label: GEAR[gear.kind].label,
    reason: gearReason,
    next:
      gear.kind === 'none' || gear.kind === 'sneakers'
        ? null
        : { when: `화면 시간을 하루 ${Math.round(60 + GEAR_RULES.minPhoneTotal * 360)}분 아래로 줄이면`, label: '빈손(또는 운동화)' },
    strength: gear.kind === 'none' ? 0 : 0.08,
  })

  const status = life.status ?? { badge: 0, jitter: false, slouch: 0 }
  if (status.badge > 0) {
    entries.push({ key: 'badge', title: '알림 배지', label: status.badge > 1 ? '두 개' : '한 개', reason: f.notifications() ?? '알림이 많아요', strength: 0.05 })
  }
  if (status.jitter) {
    entries.push({ key: 'jitter', title: '떨림', label: '산만함', reason: `${f.pickups()}. 폰을 자꾸 확인해서 머리가 들썩여요.`, strength: 0.05 })
  }

  if (life.horns.length > 0) {
    entries.push({
      key: 'horns',
      title: '뿔',
      label: [...new Set(life.horns.map((horn) => HORN_LABELS[horn.kind]))].join('·'),
      reason: listFacts(life.horns.map((horn) => f.subject(horn.subject))),
      strength: 0.06,
    })
  }

  const eyeNotes = []
  if (life.eyelid > 0.2) eyeNotes.push(note('졸린 눈꺼풀', f.sleep()))
  if (life.pupilSlit > 0.55) eyeNotes.push(note('세로 동공', f.bed()))
  if (life.darkCircle > 0.25) eyeNotes.push(note('다크서클', '늦게 자고 적게 잠'))
  entries.push({
    key: 'eyes',
    title: '눈',
    label: EYE_SHAPES[genome.innate.eyeShape],
    reason: `${eyeNotes.length ? eyeNotes.join(', ') : note('또렷한 눈', f.sleep())}. 눈 모양은 타고났어요.`,
    strength: eyeNotes.length ? 0.04 : 0,
  })

  const bodyNotes = []
  if (life.bodyRadius > 55) bodyNotes.push(note('통통한 몸', listFacts([f.share('power'), f.lateSnack()])))
  if (life.belly > 0.5) bodyNotes.push(note('볼록한 배', f.lateSnack()))
  if (life.glove) bodyNotes.push(note('장갑 낀 주먹', listFacts([f.exercise(), f.share('power')])))
  else if (life.armWidth > 11) bodyNotes.push(note('굵은 팔', f.share('power')))
  if (life.legLength > 12 && ['biped', 'beast'].includes(anatomy.legs.kind)) bodyNotes.push(note('긴 다리', f.share('cardio')))
  if (status.slouch > 0) bodyNotes.push(note('거북목(고개가 숙여짐)', f.phoneTotal()))
  entries.push({
    key: 'body',
    title: '몸',
    label: BODY_TYPES[genome.innate.bodyType],
    reason: `${bodyNotes.length ? `${bodyNotes.join(', ')}. ` : ''}몸통 모양과 색은 타고났어요(계정마다 고정).`,
    strength: bodyNotes.length ? 0.03 : 0,
  })

  if (life.patterns.length > 0) {
    const habits = new Map(raw.habits.map((habit) => [habit.name, habit]))
    entries.push({
      key: 'patterns',
      title: '무늬',
      label: '습관 무늬',
      reason: life.patterns
        .map(({ name }) => {
          const habit = habits.get(name)
          return habit ? `'${name}' ${habit.days}일 중 ${habit.done}일 완료` : `'${name}'`
        })
        .join(', '),
      strength: 0.02,
    })
  }
  if (life.aura) {
    entries.push({ key: 'aura', title: '반짝이', label: life.aura === 'crown' ? '왕관' : '반짝이', reason: f.streak() ?? '꾸준한 기록', strength: 0.05 })
  }
  if (life.moss > 0) {
    entries.push({ key: 'moss', title: '이끼', label: '이끼', reason: f.gap() ?? '기록 공백', strength: 0.05 })
  }
  return entries
}

// 처음 보여 줄 부위: 특징이 가장 강한 것(같으면 목록 앞쪽).
// 생활로 고른 6자리 부위가 먼저 보이도록 뿔·눈·몸 같은 나머지는 작은 고정 점수를 쓴다.
export function featuredPart(entries) {
  const strongest = (list) => list.reduce((best, entry) => (entry.strength > (best?.strength ?? -1) ? entry : best), null)
  // 생활 근거로 고른 부위(facts가 있는 6자리)가 있으면 그중에서 고른다.
  return (strongest(entries.filter((entry) => entry.facts)) ?? strongest(entries))?.key ?? null
}
