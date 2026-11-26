import { describe, expect, it } from 'vitest'
import { reuseUntilFail } from './ocr'
import { captureErrorText, readAll } from './readAll'

// 캡처 여러 장 읽기: 한 장이 실패해도 읽은 값은 남기고, 못 읽은 이유(사진·엔진)를 나눠 알린다.
const imageError = () => Object.assign(new Error('bad image'), { kind: 'image' })
const engineError = () => Object.assign(new Error('worker died'), { kind: 'engine' })
const deps = (readImage) => ({
  readImage,
  readCapture: (lines) => lines.map((line) => ({ phone: { total: Number(line) } })),
  mergeReads: (reads) => ({ filled: reads.length ? ['total'] : [], notes: [], phone: { total: reads[0]?.phone.total }, steps: null }),
})
const file = (name) => ({ name })

describe('캡처 여러 장 읽기', () => {
  it('한 장을 못 읽어도 다른 장에서 읽은 값은 남기고, 못 읽은 사진 이름을 알려 준다', async () => {
    const readImage = async (f) => {
      if (f.name === 'broken.heic') throw imageError()
      return ['120']
    }
    const { result, failed } = await readAll([file('broken.heic'), file('screen.png')], deps(readImage))
    expect(result.filled).toEqual(['total'])
    expect(result.phone.total).toBe(120)
    expect(failed).toEqual([{ name: 'broken.heic', kind: 'image' }])
  })

  it('모두 실패하면 결과 없이 실패 목록만 돌려준다', async () => {
    const { result, failed } = await readAll([file('a.png')], deps(async () => Promise.reject(engineError())))
    expect(result).toBeNull()
    expect(failed[0].kind).toBe('engine')
  })

  it('사진 문제와 엔진(인터넷) 문제를 다른 문구로 안내한다', () => {
    expect(captureErrorText([{ name: 'a.heic', kind: 'image' }])).toContain('사진을 열 수 없어요')
    expect(captureErrorText([{ name: 'a.heic', kind: 'image' }])).toContain('a.heic')
    expect(captureErrorText([{ name: 'a.png', kind: 'engine' }])).toContain('인터넷')
  })
})

describe('읽기 엔진 다시 만들기', () => {
  it('엔진이 중간에 죽으면 reset으로 버리고 다음에 새로 만든다(새로고침 없이)', async () => {
    let made = 0
    const get = reuseUntilFail(async () => ({ id: (made += 1) }))
    expect((await get()).id).toBe(1)
    expect((await get()).id).toBe(1)
    get.reset()
    expect((await get()).id).toBe(2)
  })
})
