import { useId } from 'react'
import './monster.css'
import { bodyShape } from './parts/bodies'
import { Arms, Aura, Belly, Ears, Eyes, Horns, Legs, Moss, Mouth, MushroomCap, Patterns, Tail } from './parts/features'
import { legLength, STROKE } from './parts/layout'
import { polygonPath, starPoints } from './parts/geometry'
import { hsl, monsterPalette } from './parts/palette'

// 유전자 → SVG (설계안 3-5-1)
// 캔버스 200×200, 몸 중심 (100, 120). 그리는 순서는 아래에서 위로:
// 그림자 → 오라 → 꼬리 → 뒷다리 → 몸통 → 배 → 등 문양 → 다리·팔 → 귀·머리 → 뿔 → 눈 → 입 → 이끼
function MonsterSvg({ genome, label }) {
  const idPrefix = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg className="monster-svg" viewBox="0 0 200 200" role="img" aria-label={label}>
      {genome.life ? <Creature genome={genome} idPrefix={idPrefix} /> : <Egg innate={genome.innate} idPrefix={idPrefix} />}
    </svg>
  )
}

function Creature({ genome, idPrefix }) {
  const { innate, life, sizeScale } = genome
  const palette = monsterPalette(innate, life)
  const R = 30 + ((life.bodyRadius - 40) / 30) * 18
  const body = bodyShape(innate.bodyType, R, innate)
  const headR = R * life.headRatio * 0.78
  const head = { x: body.cx, y: body.top - headR * 0.45, r: headR }
  const ground = body.bottom + legLength(life) + 6
  const wobbleId = `${idPrefix}-wobble`

  return (
    <g transform={`translate(100 ${ground}) scale(${sizeScale}) translate(-100 ${-ground})`}>
      <ellipse cx={100} cy={ground} rx={body.rx * 0.95} ry={6} fill="hsl(0 0% 0% / 0.12)" />
      <g className="monster-breathe">
        {life.aura !== 'crown' && <Aura life={life} palette={palette} head={head} />}
        <Tail body={body} life={life} palette={palette} />
        <Legs body={body} life={life} palette={palette} back />
        {life.wobble > 0.25 && (
          <filter id={wobbleId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={innate.hue}>
              <animate attributeName="baseFrequency" values="0.03;0.045;0.03" dur="5s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale={life.wobble * 6} />
          </filter>
        )}
        <g filter={life.wobble > 0.25 ? `url(#${wobbleId})` : undefined}>
          <path d={body.path} fill={palette.body} stroke={palette.outline} strokeWidth={STROKE} strokeLinejoin="round" />
          <Belly body={body} life={life} palette={palette} />
          <Patterns body={body} life={life} palette={palette} />
        </g>
        <Legs body={body} life={life} palette={palette} />
        <Arms body={body} life={life} palette={palette} />
        <Ears head={head} type={innate.earType} palette={palette} />
        <circle cx={head.x} cy={head.y} r={head.r} fill={palette.body} stroke={palette.outline} strokeWidth={STROKE} />
        {body.cap && <MushroomCap head={head} palette={palette} />}
        <Horns head={head} horns={life.horns} palette={palette} capLift={body.cap ? head.r * 0.9 : 0} />
        <Eyes head={head} innate={innate} life={life} palette={palette} idPrefix={idPrefix} />
        <Mouth head={head} life={life} palette={palette} />
        <Moss body={body} life={life} />
        {life.aura === 'crown' && <Aura life={life} palette={palette} head={body.cap ? { ...head, r: head.r * 1.9 } : head} />}
      </g>
    </g>
  )
}

// 알 단계: 타고난 색과 껍질 무늬만 보인다.
function Egg({ innate, idPrefix }) {
  const palette = monsterPalette(innate, null)
  const [cx, cy, rx, ry] = [100, 118, 44, 56]
  const shell = `M${cx},${cy - ry} C${cx + rx * 1.05},${cy - ry} ${cx + rx},${cy + ry} ${cx},${cy + ry} C${cx - rx},${cy + ry} ${cx - rx * 1.05},${cy - ry} ${cx},${cy - ry} Z`
  const clipId = `${idPrefix}-egg`
  const mark = hsl(innate.hue, 45, 55)
  return (
    <g>
      <ellipse cx={cx} cy={cy + ry + 4} rx={rx * 0.85} ry={6} fill="hsl(0 0% 0% / 0.12)" />
      <g className="monster-egg">
        <clipPath id={clipId}>
          <path d={shell} />
        </clipPath>
        <path d={shell} fill={palette.body} />
        <g clipPath={`url(#${clipId})`} fill={mark} stroke={mark}>
          {innate.shellPattern === 'spots' &&
            [
              [-18, -24, 7],
              [14, -8, 9],
              [-10, 16, 6],
              [20, 26, 5],
              [-26, 34, 4],
            ].map(([dx, dy, r]) => <circle key={`${dx}${dy}`} cx={cx + dx} cy={cy + dy} r={r} stroke="none" />)}
          {innate.shellPattern === 'zigzag' && (
            <path d={`M${cx - rx},${cy} l11,-9 l11,9 l11,-9 l11,9 l11,-9 l11,9 l11,-9 l11,9`} fill="none" strokeWidth={5} strokeLinejoin="round" />
          )}
          {innate.shellPattern === 'stripes' &&
            [-30, -6, 18, 42].map((dy) => <rect key={dy} x={cx - rx} y={cy + dy} width={rx * 2} height={8} stroke="none" />)}
          {innate.shellPattern === 'stars' &&
            [
              [-16, -20],
              [14, 2],
              [-8, 28],
            ].map(([dx, dy]) => <path key={`${dx}${dy}`} d={polygonPath(starPoints(cx + dx, cy + dy, 8, 3.5))} stroke="none" />)}
        </g>
        <path d={shell} fill="none" stroke={palette.outline} strokeWidth={STROKE} />
      </g>
    </g>
  )
}

export default MonsterSvg
