import { drawCharacter } from '../character/drawCharacter'
import { characterState } from '../character/state'
import PixelSprite from '../pixel/PixelSprite'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'

// 로그인 화면 타이틀 장면: 시연 인물 3명의 오늘 캐릭터가 나란히 서 있다(예시 데이터).
const END = '2026-11-15'
const CAST = Object.values(PERSONAS).map((persona) => {
  const { metrics, details } = computeTodayMetrics(persona.make(END), END)
  return drawCharacter(persona.look, characterState(metrics, details))
})

function TitleScene() {
  return (
    <div className="title-scene" aria-hidden="true">
      {CAST.map((sprite, i) => (
        <PixelSprite key={i} sprite={sprite} label="" scale={2} />
      ))}
    </div>
  )
}

export default TitleScene
