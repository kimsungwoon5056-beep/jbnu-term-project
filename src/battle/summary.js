import { DRAIN, ITEMS } from './schedule'
import { MATCH_SECONDS } from './world'

// 판이 끝난 뒤 내 기록과 한 줄 총평(순수 함수). 다음 판에 무엇을 바꾸면 좋을지 알려 준다.
// player: 판이 끝난 world의 내 플레이어, rank: 1부터, time: 판이 끝난 시각(초)
export function matchSummary(player, rank, time = MATCH_SECONDS) {
  const { stats, loadout } = player
  // 끝날 때 재부팅 중이던 사람(목숨이 남음)은 끝까지 버틴 것이다.
  const survived = Math.round(Math.min(MATCH_SECONDS, player.alive || player.lives > 0 ? time : (player.downAt ?? time)))
  return {
    rank,
    hp: player.hp,
    maxHp: player.maxHp,
    items: stats.items,
    storm: stats.storm,
    drain: stats.drain,
    survived,
    tip: tipOf({ rank, stats, loadout }),
  }
}

function tipOf({ rank, stats, loadout }) {
  if (rank === 1) return loadout.health >= 80 ? '폰을 내려놓은 사람이 이겼어요!' : '이겼어요! 폰을 줄이면 다음 판 체력이 더 늘어요.'
  if (stats.storm >= 3) return `알림 폭풍에 ${stats.storm}번 맞았어요. ${ITEMS.dnd.label}를 주우면 말풍선을 막아요.`
  if (stats.drain >= 8) return `배터리 경고 때 가장자리에 오래 있었어요. ${DRAIN.start / 60}분부터는 가운데로 모이세요.`
  if (stats.items === 0) return `아이템을 하나도 못 주웠어요. ${ITEMS.charger.label}는 체력 +${ITEMS.charger.heal}예요.`
  if (loadout.health < 55) return `오늘 디지털 건강 ${loadout.health}%라 체력이 ${loadout.hp}였어요. 폰을 줄이면 다음 판 체력이 늘어요.`
  return '아까워요! 대시(짧은 무적)로 공격을 피해 보세요.'
}
