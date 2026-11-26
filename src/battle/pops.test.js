// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { WORDS } from './fx'
import { buildLoadout } from './loadout'
import { Renderer } from './renderer'
import { applyDamage, createWorld } from './world'

// 1인칭 의성어("퍽!")도 피해 숫자·이름표처럼 앱 아이콘(벽) 뒤에 있으면 가린다(점검 7회차).
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const loadout = (name) => buildLoadout({ state: { tier: 'mid', grafts: [], scene: 'home', health: { percent: 50 }, marks: CALM }, look: DEFAULT_LOOK, nickname: name })

// 그린 글자만 모으는 가짜 캔버스
const texts = []
function fakeContext(canvas) {
  return new Proxy(
    { canvas },
    {
      get(target, key) {
        if (key in target) return target[key]
        if (key === 'getImageData' || key === 'createImageData')
          return (a, b, w, h) => {
            const W = typeof a === 'object' ? a.width : (w ?? a)
            const H = typeof a === 'object' ? a.height : (h ?? b)
            return { width: W, height: H, data: new Uint8ClampedArray(Math.max(1, W * H * 4)) }
          }
        if (key === 'measureText') return () => ({ width: 10 })
        if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') return () => ({ addColorStop() {} })
        if (key === 'fillText') return (text) => canvas.main && texts.push(text)
        return () => undefined
      },
      set(target, key, value) {
        target[key] = value
        return true
      },
    },
  )
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return (this.fake ??= fakeContext(this))
  }
  window.matchMedia = () => ({ matches: false })
})

function hitAndRead({ me, bot }) {
  const world = createWorld({ events: false, players: ['me', 'bot0', 'bot1'].map((id) => ({ id, loadout: loadout(id), local: true })) })
  const [mine, target, other] = world.players
  Object.assign(mine, { x: me[0], y: me[1], tx: me[0], ty: me[1], aim: -Math.PI / 2 })
  Object.assign(target, { x: bot[0], y: bot[1], tx: bot[0], ty: bot[1] })
  Object.assign(other, { x: 20, y: 60, tx: 20, ty: 60 })
  const canvas = Object.assign(document.createElement('canvas'), { width: 360, height: 600, main: true })
  const renderer = new Renderer(canvas, world, 'me', { reduced: true })
  renderer.draw(world)
  texts.length = 0
  applyDamage(world, target, 3, null, 'bot1')
  renderer.draw(world)
  return { pop: texts.some((text) => WORDS.hit.includes(text)), label: texts.some((text) => /^-\d+$/.test(text)) }
}

describe('1인칭 의성어 가리기', () => {
  it('앱 아이콘 뒤에서 맞은 상대의 의성어는 그리지 않는다(피해 숫자처럼)', () => {
    expect(hitAndRead({ me: [180, 450], bot: [180, 200] })).toEqual({ pop: false, label: false })
  })

  it('사이에 아무것도 없으면 의성어와 피해 숫자를 모두 그린다', () => {
    expect(hitAndRead({ me: [300, 450], bot: [300, 250] })).toEqual({ pop: true, label: true })
  })
})