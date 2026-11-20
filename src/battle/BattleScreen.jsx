import { useEffect, useMemo, useRef, useState } from 'react'
import { characterState } from '../character/state'
import { addDays } from '../records/dateKey'
import { listRecordsBetween } from '../records/recordStore'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import PixelSprite from '../pixel/PixelSprite'
import LoadError from '../ui/LoadError'
import Loading from '../ui/Loading'
import './battle.css'
import { InputController } from './input'
import { buildLoadout, loadoutSprite } from './loadout'
import LoadoutCard from './LoadoutCard'
import { FirebaseRoomChannel, linkWorld } from './channel'
import { OnlineLoop, PracticeLoop } from './loop'
import { ITEMS, seedOf } from './schedule'
import { loadRecordSummary, saveMatch } from './matchStore'
import * as net from './net'
import { Renderer } from './renderer'
import { play, setSoundOn, soundBoard, soundOn } from './sound'
import { matchSummary } from './summary'
import { isRoomCode, MAX_PLAYERS } from './roomCode'
import { ARENA, createWorld } from './world'

// 대결 화면: 오늘의 대결 능력 → 연습(봇 1~3명) 또는 온라인 방(최대 4명) → 한 판 → 결과
// 오늘 기록으로 정한 능력은 판이 시작하면 고정된다.

function useTodayLoadout(uid, profile, todayKey) {
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    listRecordsBetween(uid, addDays(todayKey, -13), todayKey).then((result) => {
      if (!active) return
      if (!result.ok) return setState({ status: 'error', message: result.message })
      const today = computeTodayMetrics(result.records, todayKey)
      const character = characterState(today.metrics, today.details, { hasRecord: today.hasRecord })
      setState({ status: 'ready', loadout: buildLoadout({ state: character, look: profile.look, nickname: profile.nickname }) })
    })
    return () => {
      active = false
    }
  }, [uid, profile, todayKey, attempt])
  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }
  return { ...state, retry }
}

// 휴대폰 조작: 왼쪽 조이스틱, 오른쪽 버튼
function TouchControls({ input, cooldown }) {
  const stickRef = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  function moveStick(event) {
    const box = stickRef.current.getBoundingClientRect()
    const r = box.width / 2
    let x = (event.clientX - box.left - r) / r
    let y = (event.clientY - box.top - r) / r
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    setKnob({ x, y })
    input.setStick(x, y)
  }
  function release() {
    setKnob({ x: 0, y: 0 })
    input.setStick(0, 0)
  }

  return (
    <div className="touch-controls">
      <div
        ref={stickRef}
        className="stick"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          moveStick(event)
        }}
        onPointerMove={(event) => event.buttons && moveStick(event)}
        onPointerUp={release}
        onPointerCancel={release}
        aria-label="이동 조이스틱"
        role="application"
      >
        <span style={{ transform: `translate(${knob.x * 28}px, ${knob.y * 28}px)` }} />
      </div>
      <div className="action-buttons">
        <button type="button" className={cooldown.dash > 0 ? 'secondary cooling' : 'secondary'} onPointerDown={() => input.tap('dash')}>
          {cooldown.dash > 0 ? `대시 ${cooldown.dash.toFixed(1)}` : '대시'} <kbd>Space</kbd>
        </button>
        <button type="button" className={cooldown.skill > 0 ? 'secondary cooling' : 'secondary'} onPointerDown={() => input.tap('skill')}>
          {cooldown.skill > 0 ? `기술 ${cooldown.skill.toFixed(1)}` : '기술'} <kbd>Q</kbd>
        </button>
        <button
          type="button"
          className="fire-button"
          onPointerDown={() => input.setFire(true)}
          onPointerUp={() => input.setFire(false)}
          onPointerLeave={() => input.setFire(false)}
        >
          공격
        </button>
      </div>
    </div>
  )
}

// 한 판: setup = { mode, players: [{ id, loadout, local, bot }], startAt?, code? }
function GameView({ setup, meId, onEnd, onQuit }) {
  const canvasRef = useRef(null)
  const [input, setInput] = useState(null)
  const [sound, setSound] = useState(soundOn)
  const [cooldown, setCooldown] = useState({ dash: 0, skill: 0 })
  // 판이 끝났을 때 부를 함수는 최신 것을 쓴다(판을 다시 만들지 않도록 ref로 들고 있음).
  const endRef = useRef(onEnd)
  useEffect(() => {
    endRef.current = onEnd
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const world = createWorld({ players: setup.players, seed: setup.seed ?? 1, mode: setup.mode })
    // 개발 서버에서만: 두 화면의 씨앗·아이템을 비교해 볼 수 있게 판 상태를 열어 둔다(배포 빌드에는 없음).
    if (import.meta.env.DEV) window.__battle = { world, seed: setup.seed }
    // Observer: 렌더러와 효과음 보드가 각자 world.signals를 구독한다(신호를 내는 world는 누가 듣는지 모른다).
    const renderer = new Renderer(canvas, world, meId)
    const controller = new InputController(canvas)
    setInput(controller)
    const me = world.players.find((player) => player.id === meId)
    const cdTimer = setInterval(() => setCooldown({ dash: me?.cd.dash ?? 0, skill: me?.cd.skill ?? 0 }), 150)
    const unsubs = [() => clearInterval(cdTimer), world.signals.subscribe(soundBoard(meId))]
    let loop
    if (setup.mode === 'online') {
      // Adapter: Firebase Realtime Database를 RoomChannel 모양으로 맞춘 창구를 만들고, 받은 것을 world에 잇는다.
      const channel = new FirebaseRoomChannel(setup.code, meId)
      unsubs.push(linkWorld(world, channel, meId), () => channel.close())
      loop = new OnlineLoop({
        world,
        renderer,
        input: controller,
        meId,
        startAt: setup.startAt,
        channel,
        onEnd: (ranking) => endRef.current(ranking, world),
      })
    } else {
      loop = new PracticeLoop({ world, renderer, input: controller, meId, onEnd: (ranking) => endRef.current(ranking, world) })
    }
    loop.start()
    return () => {
      loop.stop()
      for (const off of unsubs) off()
    }
    // setup이 바뀔 때만 새 판을 만든다.
  }, [setup, meId])

  return (
    <div className="game-view">
      <canvas ref={canvasRef} width={ARENA.w} height={ARENA.h} className="arena" aria-label="대결 화면" />
      <p className="muted game-help">PC: WASD 이동 · 마우스 조준·클릭 공격 · Space 대시 · Q 기술</p>
      <p className="muted game-items">
        {Object.values(ITEMS).map((item) => (
          <span key={item.label}>
            <strong>{item.label}</strong> {item.desc}
          </span>
        ))}
      </p>
      {input && <TouchControls input={input} cooldown={cooldown} />}
      <div className="game-actions">
        <button
          type="button"
          className="link-button"
          aria-pressed={sound}
          onClick={() => {
            setSoundOn(!sound)
            setSound(!sound)
          }}
        >
          {sound ? '소리 끄기' : '소리 켜기'}
        </button>
        <button type="button" className="link-button" onClick={onQuit}>
          나가기
        </button>
      </div>
    </div>
  )
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
          <div key={player.id} className={`podium-spot rank-${rank}${player.id === meId ? ' me' : ''}`}>
            <PodiumSprite loadout={player.loadout} label={`${rank}위 ${player.name}`} />
            <p className="podium-name">{player.name}</p>
            <div className="podium-block">{rank}</div>
          </div>
        )
      })}
    </div>
  )
}

function PodiumSprite({ loadout, label }) {
  const sprite = useMemo(() => loadoutSprite(loadout), [loadout])
  return <PixelSprite sprite={sprite} label={label} scale={2} />
}

export function Result({ result, meId, onAgain, onLobby }) {
  const mine = result.summary
  return (
    <section className="panel battle-result">
      <h3 className="panel-title">
        {result.ranking[0].id === meId ? '승리!' : `${result.ranking.findIndex((player) => player.id === meId) + 1}위`}
      </h3>
      <Podium ranking={result.ranking} meId={meId} />
      {mine && (
        <>
          <p className="result-tip">{mine.tip}</p>
          <dl className="result-stats">
            <div>
              <dt>남은 체력</dt>
              <dd>
                {mine.hp}/{mine.maxHp}
              </dd>
            </div>
            <div>
              <dt>버틴 시간</dt>
              <dd>{mine.survived}초</dd>
            </div>
            <div>
              <dt>주운 아이템</dt>
              <dd>{mine.items}개</dd>
            </div>
            <div>
              <dt>맞은 알림</dt>
              <dd>{mine.storm}번</dd>
            </div>
          </dl>
        </>
      )}
      {result.save === 'saving' && <p className="muted">전적을 저장하고 있어요…</p>}
      {result.save === 'saved' && <p className="muted">전적에 저장했어요.</p>}
      {result.save === 'failed' && (
        <p className="form-error" role="alert">
          {result.saveMessage} 이 판은 전적에 들어가지 않았어요.
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
            <span className="muted">{player.alive ? `체력 ${player.hp}/${player.maxHp}` : '아웃'}</span>
          </li>
        ))}
      </ol>
      <div className="form-actions">
        {onAgain && (
          <button type="button" onClick={onAgain}>
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

function practiceSetup(meId, loadout, bots) {
  const cast = Object.values(PERSONAS).slice(0, bots)
  return {
    mode: 'practice',
    seed: Date.now() % 100000,
    players: [
      { id: meId, loadout, local: true },
      ...cast.map((persona, i) => {
        const end = '2026-11-15'
        const { metrics, details } = computeTodayMetrics(persona.make(end), end)
        return { id: `bot${i}`, loadout: buildLoadout({ state: characterState(metrics, details), look: persona.look, nickname: persona.nickname }), local: true, bot: true }
      }),
    ],
  }
}

// 온라인 방(대기실)
function RoomView({ room, uid, code, onReady, onStart, onLeave, message }) {
  const players = Object.entries(room.players ?? {}).sort((a, b) => (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0))
  const host = room.meta?.host === uid
  const me = room.players?.[uid]
  const canStart = players.length >= 2 && players.every(([id, p]) => p.ready || id === uid)
  return (
    <section className="panel room">
      <h3 className="panel-title">대결 방</h3>
      <p className="room-code">
        코드 <strong>{code}</strong>
      </p>
      <p className="muted">친구에게 코드를 알려 주세요. 최대 {MAX_PLAYERS}명, 모두 준비하면 방장이 시작해요.</p>
      <ul className="room-players">
        {players.map(([id, player]) => (
          <li key={id}>
            {player.loadout && <LoadoutCard loadout={player.loadout} compact />}
            <span className={player.ready ? 'ready on' : 'ready'}>
              {room.meta?.host === id ? '방장' : player.ready ? '준비 완료' : '대기 중'}
            </span>
          </li>
        ))}
      </ul>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <div className="form-actions">
        {host ? (
          <button type="button" onClick={onStart} disabled={!canStart}>
            시작({players.length}명)
          </button>
        ) : (
          <button type="button" onClick={() => onReady(!me?.ready)}>
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

function BattleScreen({ uid, profile, todayKey }) {
  const today = useTodayLoadout(uid, profile, todayKey)
  const [phase, setPhase] = useState('lobby') // lobby | room | game | result
  const [setup, setSetup] = useState(null)
  const [result, setResult] = useState(null)
  const [room, setRoom] = useState({ meta: null, players: {} })
  const [joined, setJoined] = useState(null) // { code, slot }
  const [codeDraft, setCodeDraft] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryAttempt, setSummaryAttempt] = useState(0) // 전적을 저장했거나 다시 시도할 때 1씩
  const [bots, setBots] = useState(3)

  useEffect(() => {
    let active = true
    loadRecordSummary(uid).then((next) => active && setSummary(next))
    return () => {
      active = false
    }
  }, [uid, summaryAttempt])

  // 대결 화면을 떠나면(아래 독으로 다른 화면) 방에서도 나간다. 남아 있으면 상대 화면에 멈춘 채로 보인다.
  const joinedRef = useRef(null)
  useEffect(() => {
    joinedRef.current = joined
  }, [joined])
  useEffect(
    () => () => {
      const left = joinedRef.current
      if (left) net.leaveRoom(left.code, uid, left.slot)
    },
    [uid],
  )

  // 방 구독: 방장이 시작하면 모두 같은 시각(서버 시각 + 3초)에 시작한다. 한 방에서 한 번만 시작한다.
  const startedRef = useRef(null)
  useEffect(() => {
    if (!joined) return undefined
    return net.watchRoom(joined.code, (next) => {
      setRoom(next)
      if (startedRef.current === joined.code) return
      if (next.meta?.status === 'playing' && next.meta.startAt && next.players?.[uid]) {
        startedRef.current = joined.code
        const players = Object.entries(next.players)
          .filter(([, player]) => player.loadout)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([id, player]) => ({ id, loadout: player.loadout, local: id === uid }))
        // 씨앗 = 방 코드 + 방을 만든 시각: 모든 화면에서 아이템·알림 폭풍 일정이 같다.
        // 시작 시각(startAt)은 쓰지 않는다. 방장 화면은 서버 시각이 확정되기 전의 추정값을 먼저 받아서 참가자와 1ms만 달라도 일정이 갈린다.
        // 방을 만든 시각은 시작 훨씬 전에 확정되어 모두 같은 값을 갖는다.
        setSetup({ mode: 'online', code: joined.code, startAt: next.meta.startAt + 3000, seed: seedOf(joined.code, next.meta.createdAt ?? 0), players })
        setPhase('game')
      }
    })
  }, [joined, uid])

  if (today.status === 'loading') return <Loading text="오늘의 대결 능력을 계산하고 있어요…" />
  if (today.status === 'error') return <LoadError message={today.message} onRetry={today.retry} />
  const { loadout } = today

  async function handleEnd(ranking, world) {
    const mode = setup.mode
    const rank = ranking.findIndex((player) => player.id === uid) + 1
    const me = ranking.find((player) => player.id === uid)
    play(rank === 1 ? 'win' : 'lose')
    setResult({
      ranking: ranking.map(({ id, name, alive, hp, maxHp, loadout }) => ({ id, name, alive, hp, maxHp, loadout })),
      summary: me ? matchSummary(me, rank, world?.time) : null,
      save: rank > 0 ? 'saving' : null,
    })
    setPhase('result')
    // 전적 저장 결과를 결과 화면에 그대로 보여 준다(실패를 성공처럼 보이지 않게). 저장이 끝난 뒤 "N판 M승"을 다시 불러온다.
    if (rank > 0) {
      const saved = await saveMatch(uid, { mode, rank, names: ranking.map((player) => player.name), date: todayKey })
      setResult((prev) => prev && { ...prev, save: saved.ok ? 'saved' : 'failed', saveMessage: saved.message })
      setSummaryAttempt((n) => n + 1)
    }
    if (mode === 'online' && room.meta?.host === uid) {
      const ended = await net.endRoom(setup.code)
      if (!ended.ok) setResult((prev) => prev && { ...prev, roomMessage: `방을 닫지 못했어요. ${ended.message}` })
    }
  }

  function startPractice() {
    setSetup(practiceSetup(uid, loadout, bots))
    setPhase('game')
  }

  async function leave() {
    if (joined) {
      const left = await net.leaveRoom(joined.code, uid, joined.slot)
      setMessage(left.ok ? '' : `방에서 완전히 나가지 못했어요. ${left.message}`)
    }
    setJoined(null)
    setRoom({ meta: null, players: {} })
    setSetup(null)
    setPhase('lobby')
  }

  async function connect(action) {
    setPending(true)
    setMessage('')
    const res = await action()
    setPending(false)
    if (!res.ok) return setMessage(res.message)
    setJoined({ code: res.code, slot: res.slot })
    setPhase('room')
  }

  if (phase === 'game' && setup) {
    return <GameView setup={setup} meId={uid} onEnd={handleEnd} onQuit={leave} />
  }

  if (phase === 'result' && result) {
    return (
      <Result
        result={result}
        meId={uid}
        onAgain={setup?.mode === 'practice' ? startPractice : null}
        onLobby={leave}
      />
    )
  }

  if (phase === 'room' && joined) {
    return (
      <RoomView
        room={room}
        uid={uid}
        code={joined.code}
        message={message}
        onReady={async (ready) => {
          const res = await net.setReady(joined.code, uid, ready)
          setMessage(res.ok ? '' : res.message)
        }}
        onStart={async () => {
          const res = await net.startRoom(joined.code)
          if (!res.ok) setMessage(res.message)
        }}
        onLeave={leave}
      />
    )
  }

  return (
    <div className="battle-lobby">
      <section className="panel">
        <h3 className="panel-title">오늘의 대결 능력</h3>
        <LoadoutCard loadout={loadout} />
        {summary?.ok && (
          <p className="muted">
            전적 {summary.plays}판 {summary.wins}승
          </p>
        )}
        {summary && !summary.ok && (
          <p className="form-error" role="alert">
            {summary.message}{' '}
            <button type="button" className="link-button" onClick={() => setSummaryAttempt((n) => n + 1)}>
              다시 시도
            </button>
          </p>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">연습(혼자)</h3>
        <p className="muted">시연 인물 캐릭터 봇과 겨뤄요. 인터넷 연결 없이도 돼요.</p>
        <div className="chips" role="group" aria-label="봇 수">
          {[1, 2, 3].map((count) => (
            <button key={count} type="button" className="chip look-chip" aria-pressed={bots === count} onClick={() => setBots(count)}>
              봇 {count}명
            </button>
          ))}
        </div>
        <button type="button" onClick={startPractice}>
          연습 시작
        </button>
      </section>

      <section className="panel">
        <h3 className="panel-title">친구와 실시간 대결(최대 4명)</h3>
        {net.onlineAvailable ? (
          <>
            <button type="button" onClick={() => connect(() => net.createRoom(uid, loadout))} disabled={pending}>
              방 만들기
            </button>
            <form
              className="row join-row"
              onSubmit={(event) => {
                event.preventDefault()
                const code = codeDraft.trim().toUpperCase()
                if (!isRoomCode(code)) return setMessage('방 코드 4자리를 확인해 주세요.')
                connect(() => net.joinRoom(code, uid, loadout))
              }}
            >
              <input
                type="text"
                value={codeDraft}
                onChange={(event) => setCodeDraft(event.target.value.toUpperCase())}
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

export default BattleScreen
