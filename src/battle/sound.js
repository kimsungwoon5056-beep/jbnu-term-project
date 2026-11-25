import { play } from '../audio/player'

// Observer: 대결 신호 → 효과음. world.signals.subscribe(soundBoard(내 id))로 붙인다. sound는 시험할 때 바꿔 끼울 수 있다.
export const BIG_HIT = 8 // 이만큼 이상이면 크게 맞은 것

// 신호 → 낼 소리 이름(없으면 null). mine: 내 캐릭터에 생긴 일
function soundOf(signal, mine) {
  switch (signal.kind) {
    case 'shot':
    case 'dash':
    case 'skill':
      return mine ? signal.kind : null
    case 'hit':
      if (Math.abs(Number(signal.text)) >= BIG_HIT) return 'boom'
      return mine ? 'hurt' : 'hit'
    case 'down':
      return mine ? 'down' : 'ko'
    case 'item':
      return 'pick'
    case 'focus':
      return 'shield'
    case 'alarm':
      return 'alarm'
    case 'block':
    case 'shield':
    case 'storm':
    case 'tick':
    case 'go':
    case 'glitch':
    case 'dive':
    case 'surface':
    case 'heart':
    case 'crack':
    case 'splat':
      return signal.kind
    default:
      return null
  }
}

export function soundBoard(meId, sound = play) {
  return (signal) => {
    const name = soundOf(signal, signal.who === meId)
    if (name) sound(name)
  }
}
