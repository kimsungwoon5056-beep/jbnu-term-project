import { useEffect, useMemo, useState } from 'react'
import { isReduced } from '../lib/motion'
import PixelSprite from '../pixel/PixelSprite'
import { loadoutSprite } from './loadout'

// 결과 화면: 단상, 총평, 기록. 이기면 색종이가 터진다.

// 이기면 색종이(canvas-confetti, 이겼을 때만 불러온다)
function useConfetti(on) {
  useEffect(() => {
    if (!on || isReduced()) return undefined
    let active = true
    const timers = []
    let reset = null
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (!active) return
        reset = () => confetti.reset()
        const colors = ['#ffcb3b', '#ff5a5f', '#4cc96b', '#5fb4ff', '#ff7eb6']
        const fire = (angle, x) => confetti({ particleCount: 60, angle, spread: 62, startVelocity: 48, origin: { x, y: 0.75 }, colors, shapes: ['square'], scalar: 1.3, flat: true })
        fire(62, 0.05)
        fire(118, 0.95)
        timers.push(setTimeout(() => fire(90, 0.5), 450))
      })
      .catch(() => {}) // 색종이가 없어도 결과는 그대로 보인다.
    return () => {
      active = false
      timers.forEach(clearTimeout)
      reset?.()
    }
  }, [on])
}

// 0부터 올라가는 숫자. 서버 렌더링·동작 줄이기에서는 바로 보인다.
function CountUp({ value }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (isReduced() || value <= 0) return undefined
    let raf = 0
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - start) / 700))
      setShown(Math.round(value * p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setShown(value)
    }
  }, [value])
  return shown
}

function PodiumSprite({ loadout, label }) {
  const sprite = useMemo(() => loadoutSprite(loadout), [loadout])
  return <PixelSprite sprite={sprite} label={label} scale={2} />
}

// 단상 위 캐릭터(1~3위): 가운데가 1위
function Podium({ ranking, meId }) {
  const top = ranking.slice(0, 3)
  const order = [top[1], top[0], top[2]].filter(Boolean)
  return (
    <div className="podium" aria-label="1~3위">
      {order.map((player) => {
        const rank = ranking.indexOf(player) + 1
        return (
          <div key={player.id} className={`podium-spot rank-${rank}${player.id === meId ? ' me' : ''}${player.alive ? '' : ' out'}`}>
            <PodiumSprite loadout={player.loadout} label={`${rank}위 ${player.name}`} />
            <p className="podium-name">{player.name}</p>
            <div className="podium-block">{rank}</div>
          </div>
        )
      })}
    </div>
  )
}

export function Result({ result, meId, onAgain, onLobby }) {
  const mine = result.summary
  const won = !result.draw && result.ranking[0]?.id === meId
  useConfetti(won)
  return (
    <section className={won ? 'panel battle-result won' : 'panel battle-result'}>
      <h3 className="panel-title result-title">
        {result.draw ? '무승부' : won ? '승리!' : `${result.ranking.findIndex((player) => player.id === meId) + 1}위`}
      </h3>
      <Podium ranking={result.ranking} meId={meId} />
      {result.disconnected && <p className="form-error">연결이 끊겨 아웃되었어요. 다른 사람의 체력은 끊긴 때의 것이에요.</p>}
      {mine && (
        <>
          <p className="result-tip">{mine.tip}</p>
          <dl className="result-stats">
            <div>
              <dt>남은 체력</dt>
              <dd>
                <CountUp value={mine.hp} />/{mine.maxHp}
              </dd>
            </div>
            <div>
              <dt>버틴 시간</dt>
              <dd>
                <CountUp value={mine.survived} />초
              </dd>
            </div>
            <div>
              <dt>주운 아이템</dt>
              <dd>
                <CountUp value={mine.items} />개
              </dd>
            </div>
            <div>
              <dt>맞은 알림</dt>
              <dd>
                <CountUp value={mine.storm} />번
              </dd>
            </div>
          </dl>
        </>
      )}
      {result.album?.length > 0 && (
        <div className="album" aria-label="굴욕 사진첩">
          <p className="album-title">굴욕 사진첩</p>
          <ul>
            {result.album.map((photo, i) => (
              <li key={i}>
                <img src={photo.url} alt={photo.caption} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.save === 'saving' && <p className="muted">전적을 저장하고 있어요…</p>}
      {result.save === 'saved' && <p className="muted">전적에 저장했어요.</p>}
      {result.save === 'failed' && (
        <p className="form-error" role="alert">
          {result.saveMessage} {result.saveLate ? '이 화면을 닫지 않으면, 인터넷이 다시 연결될 때 저장될 수 있어요.' : '이 판은 전적에 들어가지 않았어요.'}
        </p>
      )}
      {result.roomMessage && (
        <p className="form-error" role="alert">
          {result.roomMessage}
        </p>
      )}
      <p className="muted">체력은 디지털 건강에서 나와요. 오늘 폰을 줄이면 다음 판 체력이 늘어요.</p>
      <ol className="ranking">
        {result.ranking.map((player) => (
          <li key={player.id} className={player.id === meId ? 'me' : undefined}>
            <span>{player.name}</span>
            <span className="muted">{player.alive ? `체력 ${player.hp}/${player.maxHp}` : '로그아웃'}</span>
          </li>
        ))}
      </ol>
      <div className="form-actions">
        {onAgain && (
          <button type="button" className="cta" onClick={onAgain}>
            다시 하기
          </button>
        )}
        <button type="button" className="secondary" onClick={onLobby}>
          대결 처음으로
        </button>
      </div>
    </section>
  )
}

export default Result
