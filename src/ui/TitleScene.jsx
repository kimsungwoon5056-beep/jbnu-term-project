import { buildGenome } from '../monster/genome'
import PixelSprite from '../monster/PixelSprite'
import { drawMonster } from '../monster/pixel/drawMonster'
import { computeMetrics } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'

// 로그인 화면 타이틀 장면: 시연 인물 3명의 몬스터가 풀밭에 서 있다(예시 데이터).
const END = '2026-11-15'
const CAST = [
  ['title-a', nightCoder],
  ['title-b', morningRunner],
  ['title-c', weekendRusher],
].map(([uid, make]) => {
  const { metrics, details } = computeMetrics(make(END), END)
  return drawMonster(buildGenome(uid, metrics, details, growthOf(30)))
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
