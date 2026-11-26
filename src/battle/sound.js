import { play } from '../audio/player'
import { MODES } from './modes'

// Observer: 대결 신호 → 효과음. world.signals.subscribe(soundBoard(내 id))로 붙인다. sound는 시험할 때 바꿔 끼울 수 있다.
export const BIG_HIT = 8 // 이만큼 이상이면 크게 맞은 것

// 신호 → 낼 소리 이름(없으면 null). mine: 내 캐릭터에 생긴 일
function soundOf(signal, mine) {
  switch (signal.kind) {
    case 'shot':
      return mine ? 'swing' : null // 근접 공격: 휘두르는 소리
    case 'clash':
      return mine ? 'clash' : null // 내 공격이 상대에게 닿음(예측)
    case 'dash':
    case 'skill':
      return mine ? signal.kind : null
    case 'hit':
      if (Math.abs(Number(signal.text)) >= BIG_HIT) return 'boom'
      return mine ? 'hurt' : 'hit'
    case 'down':
      return mine ? 'down' : 'ko'
    case 'item':
      return signal.text === '광고 건너뛰기' ? 'adskip' : 'pick'
    case 'focus':
      return 'shield'
    case 'alarm':
      return 'alarm'
    // 모드마다 여는 소리: 3D는 지지직·슈우웅, 영상통화는 벨, 나머지는 앱 열리는 소리
    case 'glitch':
      return signal.text === 'call' ? 'ring' : MODES[signal.text]?.camera || !signal.text ? 'glitch' : 'appopen'
    case 'dive':
      return MODES[signal.text]?.camera || !signal.text ? 'dive' : signal.text === 'update' ? 'install' : null
    case 'beat':
      return Number(signal.text) % 2 === 0 ? 'kickbeat' : 'hatbeat'
    case 'respawn':
      return mine ? 'shield' : null
    case 'jump':
    case 'perfect':
    case 'photo':
      return mine ? { jump: 'jump', perfect: 'perfect', photo: 'shutter' }[signal.kind] : null
    case 'bosshit':
      return mine ? 'bosshit' : null
    case 'reward':
      return mine ? 'reward' : null
    case 'bossshot':
    case 'bossdown':
    case 'block':
    case 'shield':
    case 'storm':
    case 'tick':
    case 'go':
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
