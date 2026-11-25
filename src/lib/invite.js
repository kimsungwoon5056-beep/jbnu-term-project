import { isRoomCode } from '../battle/roomCode'

// 방 초대 링크(…/?room=ABCD). 열면 대결 화면으로 가고 코드가 채워진다. 로그인 전이면 로그인한 뒤에 쓴다.
let invited = null

// 주소에서 방 코드를 꺼내고 주소를 깨끗이 한다(새로고침하면 다시 초대되지 않게).
export function readInvite(location = window.location, history = window.history) {
  const params = new URLSearchParams(location.search)
  const code = params.get('room')?.trim().toUpperCase()
  if (code === undefined) return
  if (isRoomCode(code)) invited = code
  params.delete('room')
  const rest = params.toString()
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash ?? ''}`)
}

export const hasInvite = () => invited !== null
export const peekInvite = () => invited
// 대결 화면이 받아 갔으면 지운다(다시 들어와도 또 초대되지 않게).
export function clearInvite() {
  invited = null
}

export const inviteLink = (code, location = window.location) => `${location.origin}${location.pathname}?room=${code}`

// 공유 창(휴대폰) → 클립보드 → 옛 방식 복사. 'shared' | 'copied' | 'failed'
// 배포 주소가 http라 공유·클립보드 기능이 막혀 있을 수 있어 옛 방식까지 시도한다.
export async function shareRoom(code) {
  const url = inviteLink(code)
  const text = `디톡스 PVP에서 한 판! 방 코드 ${code}`
  if (navigator.share) {
    try {
      await navigator.share({ title: '디톡스 PVP', text, url })
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled'
    }
  }
  const full = `${text}\n${url}`
  try {
    await navigator.clipboard.writeText(full)
    return 'copied'
  } catch {
    return legacyCopy(full) ? 'copied' : 'failed'
  }
}

function legacyCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.style.cssText = 'position:fixed;top:0;opacity:0'
  document.body.append(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}
