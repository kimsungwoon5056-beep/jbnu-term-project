import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { buildLoadout } from '../battle/loadout'
import { Result } from '../battle/BattleScreen'
import { clipNumber } from '../records/clip'
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

  it('방을 닫지 못하면 그것도 알린다', () => {
    expect(render({ save: 'saved', roomMessage: '방을 닫지 못했어요.' })).toContain('방을 닫지 못했어요')
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
})
