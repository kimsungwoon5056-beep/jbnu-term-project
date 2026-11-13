import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Loading from './Loading'
import TitleScene from './TitleScene'

describe('화면 조각', () => {
  it('불러오는 중 안내는 스크린리더에 상태로 알린다', () => {
    const html = renderToString(<Loading text="불러오는 중" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('불러오는 중')
  })

  it('타이틀 장면에 몬스터 3마리를 그린다', () => {
    const html = renderToString(<TitleScene />)
    expect(html.match(/<svg/g)).toHaveLength(3)
    expect(html).not.toContain('NaN')
  })
})
