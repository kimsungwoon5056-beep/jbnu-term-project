import { characterState } from '../character/state'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import { buildLoadout } from './loadout'

// 연습 상대: 시연 인물 3명의 하루(예시 데이터)로 만든 대결 능력
const DAY = '2026-11-15'
export const BOT_CAST = Object.values(PERSONAS).map((persona) => {
  const { metrics, details } = computeTodayMetrics(persona.make(DAY), DAY)
  return buildLoadout({ state: characterState(metrics, details), look: persona.look, nickname: persona.nickname })
})
