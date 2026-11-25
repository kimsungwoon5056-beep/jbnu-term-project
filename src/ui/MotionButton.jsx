import { setMotionOn, useReducedMotion } from '../lib/motion'

// 움직임 켜기·끄기. onlyOff: 꺼져 있을 때만 보인다(화면이 멈춰 보이는 이유를 알리고 켤 수 있게).
function MotionButton({ onlyOff = false, className = 'link-button' }) {
  const reduced = useReducedMotion()
  if (onlyOff && !reduced) return null
  return (
    <button type="button" className={className} onClick={() => setMotionOn(reduced)}>
      {reduced ? '움직임 켜기' : '움직임 끄기'}
    </button>
  )
}

export default MotionButton
