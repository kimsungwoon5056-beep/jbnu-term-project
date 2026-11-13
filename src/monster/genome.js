import { chooseAnatomy } from './anatomy'
import { hashString, pick, seededRandom } from './random'

// 몬스터 유전자 (설계안 3-2)
// 타고난 유전자: 계정(uid)마다 고정. 생활 유전자: 최근 7일 생활 지표에서 매일 다시 계산.

export const BODY_TYPES = {
  jelly: '말랑이',
  rock: '돌덩이',
  spiky: '가시 공',
  snake: '뱀형',
  cloud: '구름',
  mushroom: '버섯',
  drop: '물방울',
  box: '상자',
}
export const EYE_SHAPES = { round: '둥근 눈', halfMoon: '반달 눈', dot: '점 눈', star: '별 눈', cyclops: '외눈', compound: '겹눈' }
export const EAR_TYPES = { pointy: '뾰족귀', round: '둥근귀', fin: '지느러미', antenna: '더듬이' }
export const SHELL_PATTERNS = ['spots', 'zigzag', 'stripes', 'stars']
export const BACK_PATTERNS = ['dot', 'stripe', 'wave', 'check', 'star']

// 과목 이름 → 뿔 모양. 사전에 없는 과목은 이름 해시로 만든 다각형 뿔
const HORN_BY_SUBJECT = {
  수학: 'prism',
  코딩: 'code',
  프로그래밍: 'code',
  영어: 'bubble',
  국어: 'bubble',
  일본어: 'bubble',
  중국어: 'bubble',
  과학: 'flask',
  물리: 'flask',
  화학: 'flask',
  생물: 'flask',
  예술: 'brush',
  미술: 'brush',
  음악: 'brush',
}
export const HORN_LABELS = {
  prism: '프리즘뿔',
  code: '</>뿔',
  bubble: '말풍선뿔',
  flask: '플라스크뿔',
  brush: '붓뿔',
  poly: '각진뿔',
}
const MAX_HORNS = 5
const MAX_PATTERNS = 5

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const lerp = (from, to, t) => from + (to - from) * clamp01(t)

export function innateGenes(uid) {
  const random = seededRandom(hashString(`innate:${uid}`))
  return {
    bodyType: pick(random, Object.keys(BODY_TYPES)),
    hue: Math.floor(random() * 360),
    eyeShape: pick(random, Object.keys(EYE_SHAPES)),
    earType: pick(random, Object.keys(EAR_TYPES)),
    asymmetry: random() * 0.15,
    shellPattern: pick(random, SHELL_PATTERNS),
    // 보조 색: 날개·꼬리·등·무늬에 쓰는 두 번째 색. 기본 색과 떨어진 정도를 계정마다 다르게 한다.
    accentOffset: pick(random, [45, 90, 150, 180, 210, 270, 315]),
  }
}

export function hornFor(subject) {
  const kind = HORN_BY_SUBJECT[subject.trim()] ?? 'poly'
  const hash = hashString(`horn:${subject}`)
  return { kind, sides: 3 + (hash % 5), twist: (hash >>> 3) % 360 }
}

// 성장 단계가 낮을수록 몸이 작고 특징이 약하게 드러난다.
export function growthScales(growth) {
  if (growth.stage === 'adult') return { size: 1, feature: 1, neglect: 1 }
  const t = (growth.factor - 0.6) / 0.4 // 새끼 0 → 완전체 직전 1
  if (growth.stage === 'baby') return { size: 0.7, feature: 0.5, neglect: 0 }
  return { size: 0.85 + 0.15 * t, feature: 0.5 + 0.5 * t, neglect: t }
}

export function lifeGenes(metrics, details, growth, uid = '') {
  const m = metrics
  const { feature: f, neglect } = growthScales(growth)
  const legs = f * m.exTotal * m.cardio
  const arms = f * m.exTotal * m.power
  // 아직 다 자라지 않은 몬스터는 기록한 날이 적은 것을 "방치"로 보지 않는다.
  const dull = m.gap * neglect

  const subjects = Object.entries(details.subjects)
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_HORNS)
  const horns = subjects.map(([subject, minutes]) => ({
    subject,
    ...hornFor(subject),
    length: lerp(8, 34, f * Math.min(1, minutes / 600)),
  }))

  const patterns = details.habits.slice(0, MAX_PATTERNS).map(({ name, rate }) => {
    const hash = hashString(`habit:${name}`)
    return {
      name,
      kind: BACK_PATTERNS[hash % BACK_PATTERNS.length],
      spot: (hash >>> 4) % 1000 / 1000, // 몸 위 자리(0~1)
      opacity: 0.25 + 0.75 * rate,
    }
  })

  const streakDays = details.streakDays
  return {
    // 부위 계열(다리·날개·꼬리·입·등). 덜 자란 몬스터는 특징이 약해 기본 계열이 많다.
    anatomy: chooseAnatomy(uid, m, details, f),
    bodyRadius: lerp(40, 70, f * (0.6 * m.power + 0.4 * m.lateSnack)),
    legLength: lerp(0, 36, legs),
    legCount: legs > 0.8 ? 4 : 2,
    armWidth: lerp(4, 18, arms),
    glove: arms > 0.7,
    tailJoints: Math.round(lerp(2, 8, f * m.exTotal * m.flex)),
    eyelid: lerp(0, 0.7, f * (1 - m.sleepLen)),
    pupilSlit: clamp01(f * m.nightOwl),
    darkCircle: lerp(0, 0.8, f * m.nightOwl * (1 - m.sleepLen)),
    horns,
    headRatio: lerp(0.5, 0.9, f * m.studyTotal),
    belly: clamp01(f * m.lateSnack),
    teeth: clamp01(f * (1 - m.mealReg)),
    mouth: (2 * m.moodAvg - 1) * f,
    wobble: clamp01(f * m.moodSwing),
    hueShift: (m.moodAvg - 0.5) * 60 * f,
    // 밝고 선명하게. 오래 방치하면(공백) 조금 칙칙해진다.
    saturation: lerp(60, 95, 0.4 * m.sleepReg + 0.6 * (1 - dull)),
    lightness: lerp(70, 56, dull),
    patterns,
    tailTip: m.weekendRush > 0.45 ? 'bolt' : 'round',
    aura: streakDays >= 30 ? 'crown' : streakDays >= 14 ? 2 : streakDays >= 7 ? 1 : 0,
    moss: Math.round(m.gap * 7 * neglect),
  }
}

// 알 단계에는 생활 유전자가 없다(타고난 바탕만 껍질 무늬로 보임).
export function buildGenome(uid, metrics, details, growth) {
  const innate = innateGenes(uid)
  const scales = growthScales(growth)
  return {
    stage: growth.stage,
    innate,
    life: growth.stage === 'egg' ? null : lifeGenes(metrics, details, growth, uid),
    sizeScale: growth.stage === 'egg' ? 1 : scales.size,
  }
}
