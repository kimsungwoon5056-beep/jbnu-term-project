import { BODY_TYPES, HORN_LABELS } from './genome'

// 자동 학명: [대표 특징 1~2개] + [가장 긴 뿔] + [몸통] (설계안 3-5)
// 각 후보는 { 이름, 세기 }이고, 기준을 넘은 것 중 센 순서로 고른다.
function traitCandidates(metrics, life) {
  const m = metrics
  return [
    { label: '새벽형', score: m.nightOwl, when: m.nightOwl > 0.6 },
    { label: '번개꼬리', score: m.weekendRush, when: life.tailTip === 'bolt' },
    { label: '다리 긴', score: m.exTotal * m.cardio + 0.1, when: life.legLength > 16 },
    { label: '팔 굵은', score: m.exTotal * m.power + 0.1, when: life.armWidth > 11 },
    { label: '행복한', score: m.moodAvg, when: m.moodAvg > 0.7 },
    { label: '시무룩한', score: 1 - m.moodAvg, when: m.moodAvg < 0.3 },
    { label: '졸린', score: 1 - m.sleepLen, when: m.sleepLen < 0.3 },
    { label: '배 볼록한', score: m.lateSnack, when: m.lateSnack > 0.5 },
    { label: '박학다식', score: m.studySpread, when: m.studySpread > 0.8 },
    { label: '규칙적인', score: m.sleepReg - 0.1, when: m.sleepReg > 0.85 },
    { label: '이끼 낀', score: m.gap, when: life.moss >= 3 },
  ]
}

export function speciesName(genome, metrics) {
  const body = BODY_TYPES[genome.innate.bodyType]
  if (!genome.life) return `${body} 알`
  const traits = traitCandidates(metrics, genome.life)
    .filter((candidate) => candidate.when)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((candidate) => candidate.label)
  const horn = genome.life.horns[0] ? HORN_LABELS[genome.life.horns[0].kind] : null
  return [...traits, horn, body].filter(Boolean).join(' ')
}
