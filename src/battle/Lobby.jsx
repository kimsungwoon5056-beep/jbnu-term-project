import { useMemo, useState } from 'react'
import { play } from '../audio/player'
import PixelSprite from '../pixel/PixelSprite'
import AppRain from '../ui/AppRain'
import MotionButton from '../ui/MotionButton'
import PixelIcon from '../ui/PixelIcon'
import { strategyFor } from './bot'
import { BOT_CAST } from './botCast'
import { loadoutSprite } from './loadout'
import LoadoutCard from './LoadoutCard'
import { isRoomCode, MAX_PLAYERS } from './roomCode'

// 대결 로비: 앱이 쏟아지는 히어로 → 오늘의 대결 능력 → 연습 / 친구와 대결

// 히어로: 앱 비를 맞으며 선 내 캐릭터와 제목
function Hero({ loadout, summary }) {
  const sprite = useMemo(() => loadoutSprite(loadout), [loadout])
  return (
    <AppRain className="lobby-hero" sprite={sprite} height={300} label="쏟아지는 앱" onPop={() => play('pop')} onLand={() => play('thud')}>
      <div className="hero-title">
        <h2>폰 내려놔!</h2>
        <MotionButton onlyOff className="motion-button" />
        {summary?.ok && (
          <p className="hero-record">
            <PixelIcon name="star" /> {summary.plays}판 {summary.wins}승
          </p>
        )}
      </div>
    </AppRain>
  )
}

const STYLE_LABEL = { kiter: '거리형', rusher: '돌진형' }

// 봇 고르기: 1~3명. 고른 수만큼 앞에서부터 나온다.
function BotPicker({ bots, setBots }) {
  const sprites = useMemo(() => BOT_CAST.map((loadout) => loadoutSprite(loadout)), [])
  return (
    <div className="bot-picker" role="group" aria-label="봇 수">
      {BOT_CAST.map((loadout, i) => (
        <button key={loadout.name} type="button" className={i < bots ? 'bot-card on' : 'bot-card'} aria-pressed={bots === i + 1} aria-label={`봇 ${i + 1}명`} onClick={() => setBots(i + 1)}>
          <span className="bot-face">
            <PixelSprite sprite={sprites[i]} label="" scale={2} animate={i < bots} />
          </span>
          <strong>{loadout.name}</strong>
          <span className="bot-tag">
            {STYLE_LABEL[strategyFor(loadout).name]} · 체력 {loadout.hp}
          </span>
        </button>
      ))}
    </div>
  )
}

function Lobby({ loadout, summary, onRetrySummary, bots, setBots, onPractice, online, onCreate, onJoin, pending, message, setMessage }) {
  const [code, setCode] = useState('')
  return (
    <div className="battle-lobby">
      <Hero loadout={loadout} summary={summary} />

      <section className="panel lobby-panel">
        <h3 className="panel-title">
          <PixelIcon name="shield" /> 오늘의 대결 능력
        </h3>
        <LoadoutCard loadout={loadout} />
        {summary && !summary.ok && (
          <p className="form-error" role="alert">
            {summary.message}{' '}
            <button type="button" className="link-button" onClick={onRetrySummary}>
              다시 시도
            </button>
          </p>
        )}
      </section>

      <section className="panel lobby-panel mode-practice">
        <h3 className="panel-title">
          <PixelIcon name="sword" /> 연습(혼자)
        </h3>
        <p className="muted">누구와 겨룰까요? 누른 사람까지 함께 나와요.</p>
        <BotPicker bots={bots} setBots={setBots} />
        <button type="button" className="cta" onClick={onPractice} disabled={pending}>
          연습 시작
        </button>
      </section>

      <section className="panel lobby-panel mode-online">
        <h3 className="panel-title">
          <PixelIcon name="bell" /> 친구와 실시간 대결(최대 {MAX_PLAYERS}명)
        </h3>
        {online ? (
          <>
            <button type="button" className="cta" onClick={onCreate} disabled={pending}>
              {pending ? '연결하는 중…' : '방 만들기'}
            </button>
            <form
              className="row join-row"
              onSubmit={(event) => {
                event.preventDefault()
                const clean = code.trim().toUpperCase()
                if (!isRoomCode(clean)) return setMessage('방 코드 4자리를 확인해 주세요.')
                return onJoin(clean)
              }}
            >
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={4}
                placeholder="방 코드"
                aria-label="방 코드"
                autoCapitalize="characters"
              />
              <button type="submit" className="secondary" disabled={pending}>
                참가
              </button>
            </form>
            {message && (
              <p className="form-error" role="alert">
                {message}
              </p>
            )}
          </>
        ) : (
          <p className="muted">실시간 대결 서버 설정(VITE_FIREBASE_DATABASE_URL)이 없어 연습만 할 수 있어요.</p>
        )}
      </section>
    </div>
  )
}

export default Lobby
