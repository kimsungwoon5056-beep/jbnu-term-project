import { useEffect, useMemo, useRef } from 'react'
import { play } from '../audio/player'
import PixelSprite from '../pixel/PixelSprite'
import { loadoutSprite } from './loadout'
import { MAX_PLAYERS } from './roomCode'

// 온라인 대기실: 자리 4칸. 들어온 사람은 위에서 떨어져 앉고, 빈 자리는 깜빡인다.
function Seat({ player, state, mine }) {
  const loadout = player?.loadout ?? null
  const sprite = useMemo(() => (loadout ? loadoutSprite(loadout) : null), [loadout])
  if (!player) {
    return (
      <li className="seat empty">
        <span className="seat-plus" aria-hidden="true">
          +
        </span>
        <span className="muted">빈 자리</span>
      </li>
    )
  }
  return (
    <li className={`seat${mine ? ' me' : ''}${player.ready ? ' on' : ''}`}>
      <span className="seat-stage">{sprite ? <PixelSprite sprite={sprite} label="" scale={2} /> : <span className="muted">연결 중…</span>}</span>
      <strong>{player.name ?? '참가자'}</strong>
      {player.loadout && (
        <span className="seat-stat">
          체력 {player.loadout.hp} · 건강 {player.loadout.health}%
        </span>
      )}
      <span className={state === '대기 중' ? 'ready' : 'ready on'}>{state}</span>
    </li>
  )
}

function RoomView({ room, uid, code, onReady, onStart, onLeave, message }) {
  const players = Object.entries(room.players ?? {}).sort((a, b) => (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0))
  const host = room.meta?.host === uid
  const me = room.players?.[uid]
  // 능력(loadout)이 아직 안 온 사람이 있으면 시작하지 않는다.
  const canStart = players.length >= 2 && players.every(([id, p]) => p.loadout && (p.ready || id === uid))
  const hostGone = room.meta?.status === 'waiting' && !room.players?.[room.meta.host]

  // 누가 들어오거나 준비하면 소리로 알린다.
  const mark = players.map(([id, p]) => `${id}${p.ready ? 1 : 0}`).join()
  const first = useRef(true)
  useEffect(() => {
    if (!first.current) play('toast')
    first.current = false
  }, [mark])

  return (
    <section className="panel room">
      <h3 className="panel-title">대결 방</h3>
      <p className="room-code">
        코드 <strong>{code}</strong>
      </p>
      <p className="muted">친구에게 코드를 알려 주세요. 최대 {MAX_PLAYERS}명, 모두 준비하면 방장이 시작해요.</p>
      <ul className="seats">
        {Array.from({ length: MAX_PLAYERS }, (_, i) => {
          const [id, player] = players[i] ?? [`empty-${i}`, null]
          const state = room.meta?.host === id ? '방장' : player?.ready ? '준비 완료' : '대기 중'
          return <Seat key={id} player={player} state={state} mine={id === uid} />
        })}
      </ul>
      {hostGone && (
        <p className="form-error" role="alert">
          방장 연결이 끊겼어요. 돌아오지 않으면 나가서 새 방을 만들어 주세요.
        </p>
      )}
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <div className="form-actions">
        {host ? (
          <button type="button" className="cta" onClick={onStart} disabled={!canStart}>
            시작({players.length}명)
          </button>
        ) : (
          <button type="button" className="cta" onClick={() => onReady(!me?.ready)} disabled={!me?.loadout}>
            {me?.ready ? '준비 취소' : '준비'}
          </button>
        )}
        <button type="button" className="secondary" onClick={onLeave}>
          나가기
        </button>
      </div>
    </section>
  )
}

export default RoomView
