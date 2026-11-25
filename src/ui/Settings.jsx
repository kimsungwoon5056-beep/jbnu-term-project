import { useEffect, useRef, useState } from 'react'
import { musicOn, setMusicOn } from '../audio/music'
import { play, setSoundOn, soundOn } from '../audio/player'
import MotionButton from './MotionButton'

// 설정: 소리·음악·움직임. 이 브라우저에만 기억한다. 바깥을 누르면 접힌다.
function Toggle({ on, onLabel, offLabel, onChange }) {
  return (
    <button type="button" className="link-button" aria-pressed={on} onClick={() => onChange(!on)}>
      {on ? offLabel : onLabel}
    </button>
  )
}

function Settings() {
  const ref = useRef(null)
  const [sound, setSound] = useState(soundOn)
  const [music, setMusic] = useState(musicOn)

  useEffect(() => {
    const close = (event) => {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  return (
    <details className="settings" ref={ref}>
      <summary>설정</summary>
      <div className="settings-menu">
        <Toggle
          on={sound}
          onLabel="소리 켜기"
          offLabel="소리 끄기"
          onChange={(next) => {
            setSoundOn(next)
            setSound(next)
            if (next) play('toast')
          }}
        />
        <Toggle
          on={music}
          onLabel="음악 켜기"
          offLabel="음악 끄기"
          onChange={(next) => {
            setMusicOn(next)
            setMusic(next)
          }}
        />
        <MotionButton />
      </div>
    </details>
  )
}

export default Settings
