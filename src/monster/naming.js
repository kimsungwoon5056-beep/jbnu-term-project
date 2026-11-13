import { PART_PREFIX, THEMES, themeCounts } from './anatomy'
import { BODY_TYPES, HORN_LABELS } from './genome'

// 자동 학명 (설계안 3-5)
// [대표 특징 1개] + [두드러진 부위 접두 1~2개 또는 "완전한 ○"] + [몸통]
// 부위가 평범하면 가장 긴 뿔 이름을 대신 붙인다.
function traitCandidates(metrics, life) {
  const m = metrics
  return [
    { label: '새벽형', score: m.nightOwl, when: m.nightOwl > 0.6 },
    { label: '행복한', score: m.moodAvg, when: m.moodAvg > 0.7 },
    { label: '시무룩한', score: 1 - m.moodAvg, when: m.moodAvg < 0.3 },
    { label: '졸린', score: 1 - m.sleepLen, when: m.sleepLen < 0.3 },
    { label: '배 볼록한', score: m.lateSnack, when: m.lateSnack > 0.5 },
    { label: '박학다식', score: m.studySpread, when: m.studySpread > 0.8 },
    { label: '규칙적인', score: m.sleepReg - 0.1, when: m.sleepReg > 0.85 },
    { label: '팔 굵은', score: m.exTotal * m.power, when: life.armWidth > 11 },
    { label: '이끼 낀', score: m.gap, when: life.moss >= 3 },
  ]
}

function partWords(anatomy) {
  const counts = themeCounts(anatomy)
  const [theme, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (count >= 3) return [`완전한 ${THEMES[theme].label}`]
  return Object.entries(anatomy)
    .filter(([slot, part]) => PART_PREFIX[slot][part.kind])
    .sort((a, b) => b[1].strength - a[1].strength)
    .slice(0, 2)
    .map(([slot, part]) => PART_PREFIX[slot][part.kind])
}

export function speciesName(genome, metrics) {
  const body = BODY_TYPES[genome.innate.bodyType]
  if (!genome.life) return `${body} 알`
  const life = genome.life
  const trait = traitCandidates(metrics, life)
    .filter((candidate) => candidate.when)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)
    .map((candidate) => candidate.label)
  const parts = life.anatomy ? partWords(life.anatomy) : []
  const horn = parts.length === 0 && life.horns[0] ? [HORN_LABELS[life.horns[0].kind]] : []
  return [...trait, ...parts, ...horn, body].join(' ')
}
