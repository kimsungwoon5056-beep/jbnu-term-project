// @vitest-environment jsdom
import { fireEvent, render as mount } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, validateNickname } from '../profile/look'
import { buildLoadout } from '../battle/loadout'
import { TouchControls } from '../battle/BattleScreen'
import { replayAfterStart } from '../battle/net'
import { RecentMatches } from '../battle/RecentMatches'
import { Result } from '../battle/Result'
import { clipNumber } from '../records/clip'
import { firestoreErrorMessage } from '../records/recordDoc'
import { PhoneFields } from '../records/PhoneFields'
import { createEmptyPhone } from '../records/record'
import LoadError from './LoadError'

// 실패한 작업을 성공한 것처럼 보이지 않게: 화면에 실패가 드러나는지 확인한다.

const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: '나' })
const resultWith = (changes) => ({
  ranking: [
    { id: 'a', name: '나', alive: true, hp: 50, maxHp: 80, loadout },
    { id: 'b', name: '봇', alive: false, hp: 0, maxHp: 80, loadout },
  ],
  summary: null,
  ...changes,
})
const render = (changes) => renderToString(<Result result={resultWith(changes)} meId="a" onLobby={() => {}} />)

describe('결과 화면의 전적 저장 상태', () => {
  it('저장 중·저장됨을 구분해 보여 준다', () => {
    expect(render({ save: 'saving' })).toContain('전적을 저장하고 있어요')
    expect(render({ save: 'saved' })).toContain('전적에 저장했어요')
  })

  it('저장에 실패하면 이유와 함께 "전적에 들어가지 않았어요"를 경고로 보여 준다', () => {
    const html = render({ save: 'failed', saveMessage: '전적을 저장하거나 불러올 권한이 없어요.' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('권한이 없어요')
    expect(html).toContain('전적에 들어가지 않았어요')
    expect(html).not.toContain('전적에 저장했어요')
  })

  it('저장하는 동안에는 다시 하기·처음으로 버튼을 잠가, 저장 결과를 못 보고 떠나지 않게 한다', () => {
    const saving = renderToString(<Result result={resultWith({ save: 'saving' })} meId="a" onLobby={() => {}} onAgain={() => {}} />)
    expect(saving.match(/disabled=""/g)?.length).toBe(2)
    const saved = renderToString(<Result result={resultWith({ save: 'saved' })} meId="a" onLobby={() => {}} onAgain={() => {}} />)
    expect(saved).not.toContain('disabled=""')
  })

  it('방을 닫지 못하면 그것도 알린다', () => {
    expect(render({ save: 'saved', roomMessage: '방을 닫지 못했어요.' })).toContain('방을 닫지 못했어요')
  })
})

describe('기다리는 동안에도 버튼 이름이 남는다(점검 3회차)', () => {
  it('근접 기술·원거리·대시·막기 버튼은 재사용 대기 숫자만 보일 때도 이름(aria-label)이 있다', () => {
    const html = renderToString(<TouchControls input={{}} cooldown={{ skill: 3.2, far: 12, dash: 1.1, guard: 0.6 }} />)
    for (const name of ['근접 기술', '원거리 기술', '대시', '막기', '점프']) expect(html).toContain(`aria-label="${name}`)
  })
})

describe('대결 첫 화면의 전적', () => {
  it('불러오는 동안은 불러오는 중이라고 보여 주고, 최근 대결만 실패해도 다시 불러올 수 있다', () => {
    expect(renderToString(<RecentMatches recent={null} />)).toContain('불러오는 중')
    const failed = renderToString(<RecentMatches recent={{ ok: false, message: '서버에 연결할 수 없습니다.' }} onRetry={() => {}} />)
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('다시 불러오기')
    expect(renderToString(<RecentMatches recent={{ ok: true, matches: [] }} />)).toContain('아직 대결 기록이 없어요')
  })
})

describe('불러오기 실패와 숫자 범위', () => {
  it('불러오기 실패는 경고와 다시 불러오기 버튼으로 보여 준다', () => {
    const html = renderToString(<LoadError message="서버에 연결할 수 없습니다." onRetry={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('서버에 연결할 수 없습니다.')
    expect(html).toContain('다시 불러오기')
  })

  it('범위를 넘는 숫자는 최댓값으로 맞추고 안내 문구를 만든다', () => {
    expect(clipNumber(120000, 100000, '100,000보')).toEqual({ value: 100000, note: '100,000보까지만 넣을 수 있어요. 최댓값으로 맞췄어요.' })
    expect(clipNumber(5000, 100000, '100,000보')).toEqual({ value: 5000, note: '' })
  })

  it('소수는 말없이 버리지 않고 반올림했다고 알린다(점검 3회차)', () => {
    expect(clipNumber(30.6, 59, '분은 59')).toEqual({ value: 31, note: '정수만 넣을 수 있어 반올림했어요.' })
  })

  it('시간 칸에 1.5를 넣으면 1시간 30분이 된다(소수 시간을 60분으로 자르지 않음)', () => {
    let total = null
    const phone = { ...createEmptyPhone(), total: 0 }
    const { container } = mount(<PhoneFields phone={phone} onChange={(next) => (total = next.total)} />)
    const hours = container.querySelector('.duration input')
    fireEvent.change(hours, { target: { value: '1.5' } })
    expect(total).toBe(90)
  })

  it('0보다 작은 숫자도 말없이 바꾸지 않고 0으로 맞췄다고 알린다', () => {
    expect(clipNumber(-5, 100, '100번')).toEqual({ value: 0, note: '0보다 작은 수는 넣을 수 없어요. 0으로 맞췄어요.' })
  })

  it('앱 목록 숫자 칸에도 최댓값이 있다(많이 쓴 앱은 하루 분, 깨우기·알림 앱은 3,000)', () => {
    const phone = { ...createEmptyPhone(), topApps: [{ name: '유튜브', minutes: 30 }], notifyApps: [{ name: '카톡', count: 10 }] }
    const html = renderToString(<PhoneFields phone={phone} onChange={() => {}} />)
    expect(html).toContain('max="1440"')
    expect(html).toContain('max="3000"')
  })
})

describe('방장이 시작을 누른 뒤 서버의 답(점검 2회차)', () => {
  const playing = { meta: { status: 'playing', startAt: 1 }, players: {} }
  const waiting = { meta: { status: 'waiting' }, players: {} }
  it('시작이 확인되면 기다려 둔 방 소식을 다시 본다', () => {
    expect(replayAfterStart({ ok: true }, playing)).toBe(playing)
  })
  it('시간 초과로 실패했는데 기다린 소식이 진행 중이면, 서버가 확인하지 않은 추정값이라 다시 보지 않는다(나 혼자 시작하지 않게)', () => {
    expect(replayAfterStart({ ok: false }, playing)).toBe(null)
  })
  it('실패해 대기로 되돌아온 소식은 다시 본다(끊긴 내 칸 되살리기 등)', () => {
    expect(replayAfterStart({ ok: false }, waiting)).toBe(waiting)
    expect(replayAfterStart({ ok: true }, null)).toBe(null)
  })
})

describe('앱과 서버 규칙이 같은 값을 받는다(점검 10회차)', () => {
  it('"-0"은 0으로 맞춘다(Firestore가 -0을 정수가 아닌 값으로 보내 규칙이 거절)', () => {
    expect(Object.is(clipNumber(-0, 100, '100').value, 0)).toBe(true)
    expect(clipNumber(-0, 100, '100').note).toBe('')
  })

  it('닉네임 글자 수는 보안 규칙의 size()처럼 UTF-16 단위로 센다(이모지 하나 = 2, CI 규칙 시험과 같은 값)', () => {
    expect(validateNickname('😀')).toBe(null)
    expect(validateNickname('😀😀😀😀😀')).toBe(null)
    expect(validateNickname('😀😀😀😀😀😀')).not.toBe(null)
  })

  it('기록 저장이 날짜 창 때문에 거절되면 기기 시계도 확인하라고 알린다(앱은 기기 시계, 규칙은 서버 시각)', () => {
    expect(firestoreErrorMessage('permission-denied', 'record', 'save')).toContain('시계')
  })
})
