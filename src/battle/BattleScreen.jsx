import { useEffect, useRef, useState } from 'react'
import { characterState } from '../character/state'
import { addDays } from '../records/dateKey'
import { rankedNames } from '../data/matchDoc'
import { useRepositories } from '../data/repositories'
import { useScrollTop } from '../ui/useScrollTop'
import { onBeforeLogout } from '../lib/beforeLogout'
import { clearInvite, peekInvite } from '../lib/invite'
import { computeTodayMetrics } from '../stats/metrics'
import LoadError from '../ui/LoadError'
import Loading from '../ui/Loading'
import './battle.css'
import { InputController } from './input'
import { buildLoadout } from './loadout'
import Lobby from './Lobby'
import { BOT_CAST } from './botCast'
import { FirebaseRoomChannel, linkWorld } from './channel'
import { FAR } from './farSkills'
import { MODES } from './modes'
import { OnlineLoop, PracticeLoop } from './loop'
import { ITEMS, seedOf } from './schedule'
import * as net from './net'
import { Renderer } from './renderer'
import { music, useMusic } from '../audio/music'
import { play, setSoundOn, soundOn } from '../audio/player'
import { soundBoard } from './sound'
import { Result } from './Result'
import RoomView from './RoomView'
import { matchSummary } from './summary'
import { ARENA, createWorld, drawIds, isOut } from './world'

// 대결 화면: 오늘의 대결 능력 → 연습(봇 1~3명) 또는 온라인 방(최대 4명) → 한 판 → 결과
// 오늘 기록으로 정한 능력은 판이 시작하면 고정된다.

function useTodayLoadout(profile, todayKey) {
  const { records } = useRepositories()
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    records.listBetween(addDays(todayKey, -13), todayKey).then((result) => {
      if (!active) return
      // 이미 계산해 둔 능력이 있으면(자정에 다시 불러오다 실패) 그대로 쓴다. 판 도중에 오류 화면으로 바뀌지 않게.
      if (!result.ok) return setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: result.message }))
      const today = computeTodayMetrics(result.records, todayKey)
      const character = characterState(today.metrics, today.details, { hasRecord: today.hasRecord })
      setState({ status: 'ready', loadout: buildLoadout({ state: character, look: profile.look, nickname: profile.nickname }) })
    })
    return () => {
      active = false
    }
  }, [records, profile, todayKey, attempt])
  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }
  return { ...state, retry }
}

// 손가락을 이 요소에 붙잡아 둔다(밖으로 나가도 떼기 전까지 이어지게). 붙잡지 못해도 조작은 그대로 받는다.
function capture(event) {
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  } catch {
    // 이미 뗀 손가락 등: 붙잡기만 건너뛴다.
  }
}

// 휴대폰 조작: 왼쪽 조이스틱, 가운데 밀어서 둘러보기, 오른쪽 버튼
export function TouchControls({ input, cooldown }) {
  // 재사용 대기 중에는 버튼에 남은 초만 보이므로, 읽어 주는 이름(aria-label)에 기술 이름과 남은 시간을 함께 둔다.
  const label = (name, left) => (left > 0 ? `${name}, ${left}초 남음` : name)
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

  // 공격 버튼: 누르면 쏘고, 누른 채 밀면 둘러본다. 손가락이 버튼 밖으로 나가도 떼기 전까지 이어진다.
  function fireDown(event) {
    input.setFire(true)
    input.lookStart(event.pointerId, event.clientX)
    capture(event)
  }
  function fireUp(event) {
    input.setFire(false)
    input.lookEnd(event.pointerId)
  }
  // 조작 칸의 빈 곳(스틱과 버튼 사이)을 밀어도 둘러본다. 버튼·스틱에서 시작한 손가락은 각자 처리한다.
  function padDown(event) {
    if (event.target !== event.currentTarget) return
    input.lookStart(event.pointerId, event.clientX)
    capture(event)
  }

  return (
    <div
      className="touch-controls"
      onPointerDown={padDown}
      onPointerMove={(event) => input.lookMove(event.pointerId, event.clientX)}
      onPointerUp={(event) => input.lookEnd(event.pointerId)}
      onPointerCancel={(event) => input.lookEnd(event.pointerId)}
    >
      <div
        ref={stickRef}
        className="stick"
        onPointerDown={(event) => {
          moveStick(event)
          capture(event)
        }}
        onPointerMove={(event) => event.buttons && moveStick(event)}
        onPointerUp={release}
        onPointerCancel={release}
        aria-label="이동 조이스틱"
        role="application"
      >
        <span style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
      </div>
      <span className="look-hint" aria-hidden="true">
        ↔ 밀어서
        <br />
        둘러보기
      </span>
      <div className="action-buttons">
        <button type="button" className={cooldown.skill > 0 ? 'secondary skill-button cooling' : 'secondary skill-button'} onPointerDown={() => input.tap('skill')} aria-label={label('근접 기술', cooldown.skill)}>
          {cooldown.skill > 0 ? cooldown.skill.toFixed(1) : '근접 기술'} <kbd>Q</kbd>
        </button>
        <button type="button" className={cooldown.far > 0 ? 'secondary far-button cooling' : 'secondary far-button'} onPointerDown={() => input.tap('far')} aria-label={label('원거리 기술', cooldown.far)}>
          {cooldown.far > 0 ? cooldown.far : '원거리'} <kbd>E</kbd>
        </button>
        <button type="button" className={cooldown.dash > 0 ? 'secondary dash-button cooling' : 'secondary dash-button'} onPointerDown={() => input.tap('dash')} aria-label={label('대시', cooldown.dash)}>
          {cooldown.dash > 0 ? cooldown.dash.toFixed(1) : '대시'} <kbd>Shift</kbd>
        </button>
        <button type="button" className="secondary jump-button" onPointerDown={() => input.tap('jump')} aria-label="점프">
          점프 <kbd>Space</kbd>
        </button>
        <button type="button" className={cooldown.guard > 0 ? 'secondary guard-button cooling' : 'secondary guard-button'} onPointerDown={() => input.tap('guard')} aria-label={label('막기', cooldown.guard)}>
          막기 <kbd>F</kbd>
        </button>
        <button
          type="button"
          className="fire-button"
          onPointerDown={fireDown}
          onPointerUp={fireUp}
          onPointerCancel={fireUp}
          onLostPointerCapture={fireUp}
        >
          공격
          <small>밀면 둘러보기</small>
        </button>
      </div>
    </div>
  )
}

// 한 판: setup = { mode, players: [{ id, loadout, local, bot }], startAt?, code? }
export function GameView({ setup, meId, onEnd, onQuit }) {
  const canvasRef = useRef(null)
  const [input, setInput] = useState(null)
  const [sound, setSound] = useState(soundOn)
  const [cooldown, setCooldown] = useState({ guard: 0, dash: 0, skill: 0, far: 0 })
  // 판이 끝났을 때 부를 함수는 최신 것을 쓴다(판을 다시 만들지 않도록 ref로 들고 있음).
  const endRef = useRef(onEnd)
  useEffect(() => {
    endRef.current = onEnd
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const world = createWorld({ players: setup.players, seed: setup.seed ?? 1, mode: setup.mode, modes: setup.modes ?? null })
    // 개발 서버에서만: 두 화면의 씨앗·아이템을 비교해 볼 수 있게 판 상태를 열어 둔다(배포 빌드에는 없음).
    if (import.meta.env.DEV) window.__battle = { world, seed: setup.seed }
    // Observer: 렌더러와 효과음 보드가 각자 world.signals를 구독한다(신호를 내는 world는 누가 듣는지 모른다).
    const controller = new InputController(canvas)
    const renderer = new Renderer(canvas, world, meId, { input: controller })
    setInput(controller)
    const me = world.players.find((player) => player.id === meId)
    // 값이 그대로면 다시 그리지 않는다.
    const cdTimer = setInterval(() => {
      const far = Math.max(me?.cd.far ?? 0, FAR.lock - world.time) // E: 판 시작 잠금 포함
      const next = { guard: Number((me?.cd.guard ?? 0).toFixed(1)), dash: Number((me?.cd.dash ?? 0).toFixed(1)), skill: Number((me?.cd.skill ?? 0).toFixed(1)), far: Math.max(0, Math.ceil(far)) }
      setCooldown((prev) => (prev.guard === next.guard && prev.dash === next.dash && prev.skill === next.skill && prev.far === next.far ? prev : next))
    }, 150)
    // 배경음악: 시작하면 대결 곡, 모드에 들어가면 그 모드의 곡(음악 모드는 박자 소리만 나게 끈다)
    const tuneOf = (signal) => {
      if (signal.kind === 'go' || signal.kind === 'surface') return 'battle'
      if (signal.kind !== 'dive') return undefined
      return signal.text === 'rhythm' ? null : MODES[signal.text]?.camera || signal.text === 'boss' ? 'dive' : 'battle'
    }
    const unsubs = [
      () => clearInterval(cdTimer),
      world.signals.subscribe(soundBoard(meId)),
      world.signals.subscribe((signal) => {
        const tune = tuneOf(signal)
        if (tune !== undefined) music.play(tune)
      }),
    ]
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
        onEnd: (ranking) => endRef.current(ranking, world, renderer),
      })
    } else {
      loop = new PracticeLoop({ world, renderer, input: controller, meId, onEnd: (ranking) => endRef.current(ranking, world, renderer) })
    }
    loop.start()
    return () => {
      music.play(null) // 결과 화면에 대결 곡이 이어지지 않게
      loop.stop()
      for (const off of unsubs) off()
    }
    // setup이 바뀔 때만 새 판을 만든다.
  }, [setup, meId])

  return (
    <div className="game-view">
      <canvas ref={canvasRef} width={ARENA.w} height={ARENA.h} className="arena" aria-label="대결 화면" />
      <p className="muted game-help">PC: WASD 이동 · 마우스로 둘러보기(지도 앱에서는 조준) · 클릭 근접 공격(누르고 있으면 연속기) · 오른쪽 클릭·F 막기 · Space 점프 · Shift 대시 · Q 근접 기술 · E 원거리 기술</p>
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

// pick: 보고 싶은 "앱 속으로" 모드(없으면 무작위)
function practiceSetup(meId, loadout, bots, pick) {
  return {
    mode: 'practice',
    modes: pick ? [pick] : null,
    seed: Date.now() % 100000,
    players: [{ id: meId, loadout, local: true }, ...BOT_CAST.slice(0, bots).map((bot, i) => ({ id: `bot${i}`, loadout: bot, local: true, bot: true }))],
  }
}

function BattleScreen({ uid, profile, todayKey }) {
  const today = useTodayLoadout(profile, todayKey)
  const { matches } = useRepositories()
  const [phase, setPhase] = useState('lobby') // lobby | room | game | result
  const [setup, setSetup] = useState(null)
  const [result, setResult] = useState(null)
  const [room, setRoom] = useState({ meta: null, players: {} })
  const [joined, setJoined] = useState(null) // { code, slot }
  const [invite] = useState(peekInvite) // 초대 링크의 방 코드
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [summary, setSummary] = useState(null)
  const [recent, setRecent] = useState(null)
  const [summaryAttempt, setSummaryAttempt] = useState(0) // 전적을 저장했거나 다시 시도할 때 1씩
  // 다시 불러오는 동안은 "불러오는 중"으로(예전 값·예전 실패가 남아 보이지 않게)
  const reloadSummary = () => {
    setSummary(null)
    setRecent(null)
    setSummaryAttempt((n) => n + 1)
  }
  const [bots, setBots] = useState(3)
  const [pick, setPick] = useState(null) // 연습에서 볼 모드(null = 무작위)
  const resultIdRef = useRef(0)
  useEffect(clearInvite, [])
  useScrollTop(phase)
  useMusic(phase === 'lobby' || phase === 'room' ? 'lobby' : null)

  useEffect(() => {
    let active = true
    matches.summary().then((next) => active && setSummary(next))
    matches.recent(5).then((next) => active && setRecent(next))
    return () => {
      active = false
    }
  }, [matches, summaryAttempt])

  // 대결 화면을 떠나면(아래 독으로 다른 화면) 방에서도 나간다. 남아 있으면 상대 화면에 멈춘 채로 보인다.
  // 로그아웃할 때는 권한이 사라지기 전에 먼저 나간다.
  const joinedRef = useRef(null)
  const aliveRef = useRef(true)
  const connectingRef = useRef(null) // 방에 들어가는 중인 일(나가기가 기다릴 수 있게)
  const leavingRef = useRef(false) // 스스로 나가는 중(끊긴 것으로 보고 다시 들어가지 않게)
  useEffect(() => {
    joinedRef.current = joined
  }, [joined])
  useEffect(() => {
    aliveRef.current = true
    const exit = () => {
      const left = joinedRef.current
      joinedRef.current = null
      leavingRef.current = true
      return left ? net.leaveRoom(left.code, uid, left.slot) : connectingRef.current
    }
    const offLogout = onBeforeLogout(() => {
      // 로그아웃이 안 되더라도 나온 방에 머물러 있지 않게 처음 화면으로 돌아간다(대결 중이면 루프도 멈춘다).
      const done = exit()
      if (joinedRef.current === null) {
        setJoined(null)
        setRoom({ meta: null, players: {} })
        setSetup(null)
        setPhase('lobby')
      }
      return done
    })
    return () => {
      aliveRef.current = false
      offLogout()
      exit()
    }
  }, [uid])

  // 방 구독: 방장이 시작하면 모두 같은 시각(서버 시각 + 3초)에 시작한다. 한 방에서 한 번만 시작한다.
  const startedRef = useRef(null)
  const startingRef = useRef(null) // 내가 시작을 눌러 서버의 답을 기다리는 중: 답이 온 뒤 다시 볼 일
  const loadoutRef = useRef(null)
  useEffect(() => {
    loadoutRef.current = today.loadout ?? null
  }, [today.loadout])
  useEffect(() => {
    if (!joined) return undefined
    let healing = false
    let closed = false
    const onRoom = (next) => {
      setRoom(next)
      // 방장 화면에는 서버보다 먼저 추정한 시작 시각과 참가자 목록이 보인다. 서버의 답이 온 뒤의 값으로 시작해야 모두 같다.
      if (startingRef.current) {
        startingRef.current = Object.assign(() => onRoom(next), { next })
        return
      }
      if (startedRef.current === joined.code || leavingRef.current) return
      const here = Boolean(next.players?.[uid]?.loadout)
      // 대기 중에 연결이 끊기면 서버가 내 칸을 지운다. 다시 이어지면 스스로 다시 들어간다.
      if (!here && next.meta?.status === 'waiting' && loadoutRef.current && !healing) {
        healing = true
        net.reenterRoom(joined.code, uid, loadoutRef.current).then((res) => {
          healing = false
          if (closed) {
            if (res.ok) net.leaveRoom(joined.code, uid, res.slot) // 다시 들어가는 사이에 나갔다
            return
          }
          setMessage(res.ok ? '연결이 잠깐 끊겼다가 다시 들어왔어요.' : res.message)
        })
      }
      if (!here && next.meta?.status === 'playing') setMessage('연결이 끊긴 사이에 대결이 시작됐어요. 나가서 새 방을 만들어 주세요.')
      if (next.meta?.status === 'playing' && next.meta.startAt && here) {
        startedRef.current = joined.code
        const players = Object.entries(next.players)
          .filter(([, player]) => player.loadout)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([id, player]) => ({ id, loadout: player.loadout, local: id === uid }))
        // 시작을 누르는 사이에 모두 나갔다: 혼자 90초를 버티고 이기는 판이 되지 않게 시작하지 않는다.
        if (players.length < 2) {
          setMessage('상대가 나가서 시작하지 못했어요. 나가서 새 방을 만들어 주세요.')
          return
        }
        // 씨앗 = 방 코드 + 방을 만든 시각: 모든 화면에서 아이템·알림 폭풍 일정이 같다.
        // 시작 시각(startAt)은 쓰지 않는다. 방장 화면은 서버 시각이 확정되기 전의 추정값을 먼저 받아서 참가자와 1ms만 달라도 일정이 갈린다.
        // 방을 만든 시각은 시작 훨씬 전에 확정되어 모두 같은 값을 갖는다.
        setSetup({ mode: 'online', code: joined.code, startAt: next.meta.startAt + 3000, seed: seedOf(joined.code, next.meta.createdAt ?? 0), players })
        setPhase('game')
      }
    }
    // 구독이 서버에서 끊기면(권한·로그인 만료) 빈 자리가 그대로 남아 보이지 않게 알린다.
    const off = net.watchRoom(joined.code, onRoom, (lost) => !closed && setMessage(lost))
    return () => {
      closed = true
      startingRef.current = null
      off()
    }
  }, [joined, uid])

  if (today.status === 'loading') return <Loading text="오늘의 대결 능력을 계산하고 있어요…" />
  if (today.status === 'error') return <LoadError message={today.message} onRetry={today.retry} />
  const { loadout } = today

  async function handleEnd(ranking, world, renderer) {
    renderer?.closeEffect()
    const mode = setup.mode
    const place = ranking.findIndex((player) => player.id === uid) + 1
    const draw = drawIds(ranking).includes(uid)
    const rank = draw ? 2 : place // 무승부는 승으로 세지 않는다.
    const id = (resultIdRef.current += 1) // 늦게 끝난 저장이 다음 판의 결과를 바꾸지 않게
    const patch = (changes) => setResult((prev) => (prev?.id === id ? { ...prev, ...changes } : prev))
    const me = ranking.find((player) => player.id === uid)
    play(rank === 1 ? 'win' : 'lose')
    setResult({
      id,
      draw,
      disconnected: Boolean(world?.disconnected),
      album: renderer?.album ?? [],
      ranking: ranking.map((player) => {
        const { id, name, alive, hp, maxHp, loadout, lives } = player
        return { id, name, alive, hp, maxHp, loadout, lives, out: isOut(player) }
      }),
      summary: me ? matchSummary(me, rank, world?.time) : null,
      save: rank > 0 ? 'saving' : null,
    })
    setPhase('result')
    // 전적 저장 결과를 결과 화면에 그대로 보여 준다(실패를 성공처럼 보이지 않게). 저장이 끝난 뒤 "N판 M승"을 다시 불러온다.
    if (rank > 0) {
      const names = rankedNames(ranking.map((player) => player.name), place - 1, rank) // 무승부에서도 내 이름이 등수 자리에
      const saved = await matches.save({ mode, rank, names, date: todayKey })
      patch({ save: saved.ok ? 'saved' : 'failed', saveMessage: saved.message, saveLate: saved.code === 'deadline-exceeded' })
      reloadSummary()
    }
    if (mode === 'online' && room.meta?.host === uid) {
      const ended = await net.endRoom(setup.code)
      if (!ended.ok) patch({ roomMessage: `방을 닫지 못했어요. ${ended.message}` })
    }
  }

  function startPractice() {
    setSetup(practiceSetup(uid, loadout, bots, pick))
    setPhase('game')
  }

  // 화면을 먼저 바꾸고 방에서는 뒤에서 나간다(인터넷이 끊겨 있으면 서버 답이 오지 않아 나가기가 멈춘다).
  function leave() {
    setMessage('')
    if (joined) {
      leavingRef.current = true
      net.leaveRoom(joined.code, uid, joined.slot).then((left) => {
        if (!left.ok && aliveRef.current) setMessage(`방에서 완전히 나가지 못했어요. ${left.message}`)
      })
    }
    setJoined(null)
    setRoom({ meta: null, players: {} })
    setSetup(null)
    setPhase('lobby')
  }

  async function connect(action) {
    setPending(true)
    setMessage('')
    leavingRef.current = false
    const work = enterRoom(action)
    connectingRef.current = work
    await work
    if (connectingRef.current === work) connectingRef.current = null
  }

  async function enterRoom(action) {
    const res = await action()
    if (!aliveRef.current || leavingRef.current) {
      // 들어가는 동안 다른 화면으로 갔거나 로그아웃했다: 빈 캐릭터가 방에 남지 않게 나온다.
      if (aliveRef.current) setPending(false)
      if (res.ok) await net.leaveRoom(res.code, uid, res.slot)
      return
    }
    setPending(false)
    if (!res.ok) {
      setMessage(res.message)
      return
    }
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
          if (startingRef.current) return // 두 번 누르면 시작 시각이 두 번 정해진다
          startingRef.current = () => {}
          const res = await net.startRoom(joined.code)
          const resume = startingRef.current
          startingRef.current = null
          if (!res.ok) setMessage(res.message)
          if (resume && net.replayAfterStart(res, resume.next ?? null)) resume()
        }}
        onLeave={leave}
      />
    )
  }

  return (
    <Lobby
      loadout={loadout}
      summary={summary}
      recent={recent}
      onRetrySummary={reloadSummary}
      bots={bots}
      setBots={setBots}
      pick={pick}
      setPick={setPick}
      onPractice={startPractice}
      online={net.onlineAvailable}
      onCreate={() => connect(() => net.createRoom(uid, loadout))}
      onJoin={(code) => connect(() => net.joinRoom(code, uid, loadout))}
      pending={pending}
      message={message}
      setMessage={setMessage}
      invite={invite}
    />
  )
}

export default BattleScreen
