import { APP_ICONS } from '../capture/appArchetypes'
import PixelSprite from '../pixel/PixelSprite'
import { DEFAULT_LOOK, LOOK_OPTIONS } from '../profile/look'
import { computeTodayMetrics } from '../stats/metrics'
import { PERSONAS } from '../stats/personas'
import { APP_LOOK_KEYS, lookLabel } from './appLook'
import { drawCharacter } from './drawCharacter'
import './gallery.css'
import { characterState } from './state'

// 개발용 견본 화면(개발 서버에서 ?gallery). 앱 21종 × 머리·옷·손, 모습, 상태 표시를 한눈에 본다.
// 배포 빌드에는 들어가지 않는다.
const END = '2026-11-15'
const CALM = { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' }
const graftOf = (slot, key) => (APP_ICONS[key] ? { slot, icon: key, archetype: 'feed' } : { slot, icon: null, archetype: key === 'webtoonGeneric' ? 'webtoon' : key })
const stateOf = (changes = {}) => ({ tier: 'mid', grafts: [], scene: 'home', ...changes, marks: { ...CALM, ...changes.marks } })

function Card({ title, look = DEFAULT_LOOK, state, scene = false, scale = 3 }) {
  return (
    <figure className="gallery-card">
      <PixelSprite sprite={drawCharacter(look, state, { scene })} label={title} scale={scale} />
      <figcaption>{title}</figcaption>
    </figure>
  )
}

function CharacterGallery() {
  const personas = Object.entries(PERSONAS).map(([key, persona]) => {
    const { metrics, details } = computeTodayMetrics(persona.make(END), END)
    return { key, persona, state: characterState(metrics, details) }
  })
  return (
    <main className="gallery">
      <h1>캐릭터 견본</h1>

      <h2>시연 인물(오늘 하루)</h2>
      <div className="gallery-grid">
        {personas.map(({ key, persona, state }) => (
          <Card key={key} title={`${persona.label} · ${state.title} · ${state.health.percent}%`} look={persona.look} state={state} scene scale={4} />
        ))}
      </div>

      <h2>머리(1위 앱)</h2>
      <div className="gallery-grid">
        {APP_LOOK_KEYS.map((key) => (
          <Card key={key} title={lookLabel(key)} state={stateOf({ grafts: [graftOf('hair', key)] })} />
        ))}
      </div>

      <h2>옷(2위 앱)과 손(3위 앱)</h2>
      <div className="gallery-grid">
        {APP_LOOK_KEYS.map((key, i) => (
          <Card
            key={key}
            title={`옷 ${lookLabel(key)} · 폰 ${lookLabel(APP_LOOK_KEYS[(i + 5) % APP_LOOK_KEYS.length])}`}
            state={stateOf({ grafts: [graftOf('outfit', key), graftOf('hand', APP_LOOK_KEYS[(i + 5) % APP_LOOK_KEYS.length])] })}
          />
        ))}
      </div>

      <h2>머리 모양 × 머리색</h2>
      <div className="gallery-grid">
        {Object.keys(LOOK_OPTIONS.hairStyle.choices).map((hairStyle, i) => {
          const hairColor = Object.keys(LOOK_OPTIONS.hairColor.choices)[i % 5]
          const skin = Object.keys(LOOK_OPTIONS.skin.choices)[i % 4]
          const glasses = Object.keys(LOOK_OPTIONS.glasses.choices)[i % 3]
          return <Card key={hairStyle} title={LOOK_OPTIONS.hairStyle.choices[hairStyle].label} look={{ skin, hairStyle, hairColor, glasses }} state={stateOf()} />
        })}
      </div>

      <h2>상태 표시</h2>
      <div className="gallery-grid">
        <Card title="건강 좋음(공원)" state={stateOf({ tier: 'good', scene: 'park', marks: { shoes: 'sneakers' } })} scene />
        <Card title="보통" state={stateOf({ scene: 'home' })} scene />
        <Card title="건강 낮음(어두운 방)" state={stateOf({ tier: 'low', scene: 'room' })} scene />
        <Card title="빙글 눈·배지 3" state={stateOf({ marks: { spiral: true, badges: 3 } })} />
        <Card title="거북목·다크서클" state={stateOf({ tier: 'low', marks: { slouch: true, darkCircles: true } })} />
        <Card title="화면 빛·폰 들어올림" state={stateOf({ tier: 'low', grafts: [graftOf('hair', 'youtube'), graftOf('outfit', 'kakaotalk'), graftOf('hand', 'netflix')], marks: { glow: true, raisePhone: true, slouch: true } })} scene />
        <Card title="슬리퍼" state={stateOf({ marks: { shoes: 'slippers' } })} />
      </div>
    </main>
  )
}

export default CharacterGallery
