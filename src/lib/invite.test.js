import { describe, expect, it } from 'vitest'
import { clearInvite, hasInvite, inviteLink, peekInvite, readInvite } from './invite'

const open = (search) => {
  let url = null
  readInvite({ search, pathname: '/', hash: '' }, { replaceState: (a, b, next) => (url = next) })
  return url
}

describe('방 초대 링크', () => {
  it('주소의 방 코드를 한 번만 꺼내 쓰고, 주소에서 지운다', () => {
    expect(open('?room=abcd&x=1')).toBe('/?x=1')
    expect(hasInvite()).toBe(true)
    expect(peekInvite()).toBe('ABCD')
    clearInvite()
    expect(hasInvite()).toBe(false)
  })

  it('방 코드 모양이 아니면 쓰지 않고 주소만 지운다. 없으면 주소를 건드리지 않는다', () => {
    expect(open('?room=<script>')).toBe('/')
    expect(hasInvite()).toBe(false)
    expect(open('?x=1')).toBeNull()
  })

  it('링크를 만들면 다시 읽을 수 있다', () => {
    const link = inviteLink('AB23', { origin: 'http://host', pathname: '/' })
    expect(link).toBe('http://host/?room=AB23')
    open(new URL(link).search)
    expect(peekInvite()).toBe('AB23')
  })
})
