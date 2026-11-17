import { useState } from 'react'
import { computeMetrics, METRIC_LABELS } from '../stats/metrics'
import { morningRunner, nightCoder, weekendRusher } from '../stats/personas'
import { growthOf } from '../stats/stats'
import { DEFAULT_FAMILY, PART_FAMILIES } from './anatomy'
import { buildGenome } from './genome'
import { APP_ICONS, ARCHETYPES } from '../capture/appArchetypes'
import { GRAFT_SLOTS } from './appGrafts'
import PixelSprite from './PixelSprite'
import { drawMonster } from './pixel/drawMonster'
import './gallery.css'
import { speciesName } from './naming'
import PartGuide from './PartGuide'
import { explainParts, featuredPart } from './partReasons'
import { seededRandom } from './random'

// 개발용 견본 화면(개발 서버에서 ?gallery). 다양성 확인과 보고서 캡처용이며 배포 빌드에는 들어가지 않는다.
const END = '2026-11-15'
const SUBJECTS = ['수학', '코딩', '영어', '과학', '예술', '경제학', '철학', '역사']
const HABITS = ['물 2L', '일기', '스트레칭', '독서 20쪽', '명상', '영양제']

function fromRecords(uid, records, totalDays = 30) {
  const { metrics, details } = computeMetrics(records, END)
  return { uid, metrics, details, genome: buildGenome(uid, metrics, details, growthOf(totalDays)) }
}

// 부위 설명 견본: 홈 카드와 같이 그림·버튼을 누르면 부위가 강조되고 설명이 바뀐다.
function GuideCard({ title, item }) {
  const entries = explainParts(item.genome, item.metrics, item.details)
  const [picked, setPicked] = useState(null)
  const selected = picked ?? featuredPart(entries)
  const highlight = picked === null ? null : selected === 'skin' ? 'body' : selected
  return (
    <figure className="gallery-card guide-card">
      <PixelSprite
        sprite={drawMonster(item.genome)}
        label={title}
        scale={4}
        highlight={highlight}
        onPick={(key) => setPicked(entries.some((entry) => entry.key === key) ? key : 'body')}
      />
      <figcaption>
        <strong>{title}</strong>
        <span>{speciesName(item.genome, item.metrics)}</span>
      </figcaption>
      <PartGuide entries={entries} selected={selected} onSelect={setPicked} />
    </figure>
  )
}

// 무작위 생활(같은 uid면 항상 같음)
function randomLife(uid) {
  const random = seededRandom(uid.length * 7919 + uid.charCodeAt(uid.length - 1))
  const metrics = Object.fromEntries(Object.keys(METRIC_LABELS).map((key) => [key, random()]))
  const parts = [random(), random(), random()]
  const sum = parts[0] + parts[1] + parts[2]
  ;[metrics.cardio, metrics.power, metrics.flex] = parts.map((part) => part / sum)
  metrics.gap = random() < 0.7 ? 0 : random() * 0.7
  const details = {
    subjects: Object.fromEntries(SUBJECTS.filter(() => random() < 0.35).map((subject) => [subject, random() * 700])),
    habits: HABITS.filter(() => random() < 0.3).map((name) => ({ name, rate: random() })),
    workouts: Object.fromEntries(
      ['running', 'walking', 'swimming', 'strength', 'climbing', 'ball', 'yoga'].filter(() => random() < 0.2).map((t) => [t, random() * 300]),
    ),
    streakDays: Math.floor(random() * 35),
  }
  return { uid, metrics, genome: buildGenome(uid, metrics, details, growthOf(30)) }
}

function Card({ title, item }) {
  const name = speciesName(item.genome, item.metrics)
  return (
    <figure className="gallery-card">
      <PixelSprite sprite={drawMonster(item.genome)} label={name} scale={3} />
      <figcaption>
        <strong>{title}</strong>
        <span>{name}</span>
      </figcaption>
    </figure>
  )
}

function MonsterGallery() {
  const personas = [
    ['A. 새벽 코더', fromRecords('persona-a', nightCoder(END))],
    ['B. 아침 러너', fromRecords('persona-b', morningRunner(END))],
    ['C. 주말 몰아치기', fromRecords('persona-c', weekendRusher(END))],
  ]
  const stages = [0, 1, 4, 30].map((days) => [`성장 ${days}일`, fromRecords('persona-a', nightCoder(END), days)])
  const randoms = Array.from({ length: 20 }, (_, i) => [`무작위 ${i + 1}`, randomLife(`random-user-${i + 1}`)])
  // 부위 계열별 견본: 기본 부위만 가진 몬스터에서 한 자리만 바꿔 본다.
  const base = fromRecords('persona-b', morningRunner(END))
  const plain = Object.fromEntries(Object.entries(DEFAULT_FAMILY).map(([slot, kind]) => [slot, { kind, strength: 0 }]))
  const slotNames = { legs: '다리', wings: '날개', tail: '꼬리', jaw: '입·턱', back: '등', skin: '피부' }
  const families = Object.entries(PART_FAMILIES).flatMap(([slot, kinds]) =>
    Object.entries(kinds).map(([kind, label]) => [
      `${slotNames[slot]}: ${label}`,
      {
        ...base,
        genome: {
          ...base.genome,
          life: { ...base.genome.life, aura: 0, anatomy: { ...plain, [slot]: { kind, strength: 1 } } },
        },
      },
    ]),
  )

  // 앱 조각 견본: 머리(앱 아이콘 12 + 유형 9), 조각 0~3개 단계, 상태 표시
  const noPhone = { ...base.genome.life, aura: 0, anatomy: plain, grafts: [], gear: { kind: 'none' } }
  const withLife = (life) => ({ ...base, genome: { ...base.genome, life: { ...noPhone, ...life } } })
  const graft = (slot, archetype, icon = null) => ({ slot, archetype, icon, apps: [], minutes: 100 })
  const heads = [
    ...Object.entries(APP_ICONS).map(([icon, { label }]) => [`머리: ${label}`, withLife({ grafts: [graft('head', 'feed', icon)] })]),
    ...Object.entries(ARCHETYPES).map(([archetype, { head }]) => [`머리: ${head}`, withLife({ grafts: [graft('head', archetype)] })]),
  ]
  const userGrafts = [graft('head', 'feed', 'instagram'), graft('eyes', 'messenger'), graft('torso', 'video')]
  const graftStages = [0, 1, 2, 3].map((count) => [`조각 ${count}개`, withLife({ grafts: userGrafts.slice(0, count) })])
  const fullSets = Object.keys(ARCHETYPES).map((archetype) => [
    `${ARCHETYPES[archetype].label} 3조각`,
    withLife({ grafts: GRAFT_SLOTS.map((slot) => graft(slot, archetype)) }),
  ])
  const statuses = [
    ['알림 배지 1', { badge: 1, jitter: false, slouch: 0 }],
    ['알림 배지 2 + 떨림', { badge: 2, jitter: true, slouch: 0 }],
    ['거북목 2칸', { badge: 0, jitter: false, slouch: 2 }],
  ].map(([title, status]) => [title, withLife({ grafts: userGrafts.slice(0, 1), status })])
  const healthy = [['운동화(많이 걸음)', withLife({ gear: { kind: 'sneakers' } })]]

  return (
    <main className="gallery">
      <h1>몬스터 견본</h1>
      <section>
        <h2>부위 설명 (시연 인물)</h2>
        <div className="gallery-grid guide-grid">
          {personas.map(([title, item]) => (
            <GuideCard key={title} title={title} item={item} />
          ))}
        </div>
      </section>
      {[
        ['시연 인물', personas],
        ['성장 단계 (새벽 코더)', stages],
        ['무작위 계정·생활', randoms],
        ['앱 조각 단계 (사용자 캡처와 같은 하루: 인스타·카톡·유튜브)', graftStages],
        ['머리 조각 (앱 아이콘 12 + 유형 9)', heads],
        ['유형별 3조각 (머리·눈·몸통)', fullSets],
        ['스마트폰 상태 표시', statuses],
        ['건강한 습관', healthy],
        ['부위 계열별 견본 (기본 몸에서 한 자리씩 바꿈)', families],
      ].map(([heading, items]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          <div className="gallery-grid">
            {items.map(([title, item]) => (
              <Card key={title} title={title} item={item} />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

export default MonsterGallery
