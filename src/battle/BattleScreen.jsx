import { useEffect, useRef, useState } from 'react'
import { characterState } from '../character/state'
import { addDays } from '../records/dateKey'
import { listRecordsBetween } from '../records/recordStore'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import Loading from '../ui/Loading'
import './battle.css'
import { InputController } from './input'
import { buildLoadout } from './loadout'
import LoadoutCard from './LoadoutCard'
import { OnlineLoop, PracticeLoop } from './loop'
import { loadRecordSummary, saveMatch } from './matchStore'
import * as net from './net'
import { Renderer } from './renderer'
import { isRoomCode, MAX_PLAYERS } from './roomCode'
import { applyRemote, ARENA, createWorld, spawnEvent } from './world'

// 대결 화면: 오늘의 대결 능력 → 연습(봇 1~3명) 또는 온라인 방(최대 4명) → 한 판 → 결과
// 오늘 기록으로 정한 능력은 판이 시작하면 고정된다.

function useTodayLoadout(uid, profile, todayKey) {
  const [state, setState] = useState({ status: 'loading' })
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
  }, [uid, profile, todayKey])
  return state
}

// 휴대폰 조작: 왼쪽 조이스틱, 오른쪽 버튼
function TouchControls({ input }) {
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
        <button type="button" className="secondary" onPointerDown={() => input.tap('dash')}>
          대시 <kbd>Space</kbd>
        </button>
        <button type="button" className="secondary" onPointerDown={() => input.tap('skill')}>
          기술 <kbd>Q</kbd>
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
  // 판이 끝났을 때 부를 함수는 최신 것을 쓴다(판을 다시 만들지 않도록 ref로 들고 있음).
  const endRef = useRef(onEnd)
  useEffect(() => {
    endRef.current = onEnd
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const world = createWorld({ players: setup.players, seed: setup.seed ?? 1, mode: setup.mode })
    const renderer = new Renderer(canvas, world, meId)
    const controller = new InputController(canvas)
    setInput(controller)
    const unsubs = []
    let loop
    if (setup.mode === 'online') {
      let offset = 0
      unsubs.push(net.watchServerOffset((value) => (offset = value)))
      const serverNow = () => Date.now() + offset
      unsubs.push(net.watchEvents(setup.code, meId, (ev) => spawnEvent(world, ev)))
      unsubs.push(
        net.watchRoom(setup.code, ({ players }) => {
          for (const player of world.players) {
            if (player.id === meId) continue
            const remote = players[player.id]
            applyRemote(world, player.id, remote ? remote.s : { x: player.x, y: player.y, alive: false })
          }
        }),
      )
      loop = new OnlineLoop({
        world,
        renderer,
        input: controller,
        meId,
        startAt: setup.startAt,
        serverNow,
        net: { sendEvent: (ev) => net.sendEvent(setup.code, ev), sendState: (s) => net.sendState(setup.code, meId, s) },
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
      {input && <TouchControls input={input} />}
      <button type="button" className="link-button" onClick={onQuit}>
        나가기
      </button>
    </div>
  )
}

function Result({ result, meId, onAgain, onLobby }) {
  return (
    <section className="panel battle-result">
      <h3 className="panel-title">
        {result.ranking[0].id === meId ? '승리!' : `${result.ranking.findIndex((player) => player.id === meId) + 1}위`}
      </h3>
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
  const [bots, setBots] = useState(3)

  useEffect(() => {
    loadRecordSummary(uid).then(setSummary)
  }, [uid, result])

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
        setSetup({ mode: 'online', code: joined.code, startAt: next.meta.startAt + 3000, players })
        setPhase('game')
      }
    })
  }, [joined, uid])

  if (today.status === 'loading') return <Loading text="오늘의 대결 능력을 계산하고 있어요…" />
  if (today.status === 'error') {
    return (
      <p className="form-error" role="alert">
        {today.message}
      </p>
    )
  }
  const { loadout } = today

  async function handleEnd(ranking) {
    const mode = setup.mode
    const rank = ranking.findIndex((player) => player.id === uid) + 1
    setResult({ ranking: ranking.map(({ id, name, alive, hp, maxHp }) => ({ id, name, alive, hp, maxHp })) })
    setPhase('result')
    if (rank > 0) await saveMatch(uid, { mode, rank, names: ranking.map((player) => player.name), date: todayKey })
    if (mode === 'online' && room.meta?.host === uid) await net.endRoom(setup.code)
  }

  function startPractice() {
    setSetup(practiceSetup(uid, loadout, bots))
    setPhase('game')
  }

  async function leave() {
    if (joined) await net.leaveRoom(joined.code, uid, joined.slot)
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
        onReady={(ready) => net.setReady(joined.code, uid, ready)}
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
