import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ITEMS } from './schedule'

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
        <button key={loadout.name} type="button" className={i < bots ? 'bot-card on' : 'bot-card'} aria-pressed={bots === i + 1} onClick={() => setBots(i + 1)}>
          <span className="sr-only">봇 {i + 1}명: </span>
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

// 조작법과 규칙(접어 둔다)
function HowTo() {
  return (
    <details className="panel how-to">
      <summary>처음이에요? 조작법과 규칙</summary>
      <dl>
        <dt>휴대폰</dt>
        <dd>왼쪽 스틱으로 움직이고 공격을 누르고 있으면 가까운 상대를 자동으로 조준해요. 대시는 짧은 무적이에요.</dd>
        <dt>PC</dt>
        <dd>WASD 이동, 마우스 조준·클릭 공격, Space 대시, Q 기술</dd>
        <dt>폰 속으로</dt>
        <dd>판마다 두 번, 갑자기 1인칭으로 바뀌어요. 화면을 밀거나 마우스로 둘러보고 보는 쪽으로 움직여요.</dd>
        <dt>알림 폭풍</dt>
        <dd>빨간 줄에 알림이 쏟아져요. 빈 줄로 피하세요.</dd>
        <dt>배터리 경고</dt>
        <dd>60초부터 가장자리가 꺼져요. 가운데로 모이세요.</dd>
        <dt>아이템</dt>
        <dd>
          {Object.values(ITEMS)
            .map((item) => `${item.label}: ${item.desc}`)
            .join(' / ')}
        </dd>
        <dt>이기는 법</dt>
        <dd>마지막까지 남거나, 90초 뒤 체력 비율이 가장 높으면 이겨요. 체력은 디지털 건강에서 나오니 폰을 줄일수록 유리해요.</dd>
      </dl>
    </details>
  )
}

// 최근 대결 5판
function RecentMatches({ recent }) {
  if (!recent) return null
  if (!recent.ok) return <p className="muted">최근 대결을 불러오지 못했어요.</p>
  if (recent.matches.length === 0) return <p className="muted">아직 대결 기록이 없어요. 연습 한 판으로 시작해 보세요.</p>
  return (
    <ul className="recent-matches" aria-label="최근 대결">
      {recent.matches.map((match) => (
        <li key={match.id}>
          <span className={match.rank === 1 ? 'rank-badge first' : 'rank-badge'}>{match.rank}위</span>
          <span className="recent-text">
            <strong>{match.mode === 'online' ? '온라인' : '연습'}</strong> {match.names.filter((_, i) => i !== match.rank - 1).join(', ')}
          </span>
          <span className="muted">{match.date.slice(5).replace('-', '.')}</span>
        </li>
      ))}
    </ul>
  )
}

function Lobby({ loadout, summary, recent, onRetrySummary, bots, setBots, onPractice, online, onCreate, onJoin, pending, message, setMessage, invite = null }) {
  const [code, setCode] = useState(invite ?? '')
  // 초대 링크로 왔으면 참가 칸을 보여 준다.
  const onlineRef = useRef(null)
  useEffect(() => {
    if (invite) onlineRef.current?.scrollIntoView?.({ block: 'center' })
  }, [invite])
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

      <HowTo />

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

      <section className="panel lobby-panel mode-online" ref={onlineRef}>
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
            {invite && code === invite && !message && <p className="invite-note">초대받은 방 코드를 채웠어요. "참가"를 누르면 들어가요.</p>}
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

      <section className="panel lobby-panel">
        <h3 className="panel-title">
          <PixelIcon name="star" /> 최근 대결
        </h3>
        <RecentMatches recent={recent} />
      </section>
    </div>
  )
}

export default Lobby
