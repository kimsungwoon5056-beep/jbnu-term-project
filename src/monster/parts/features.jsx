import { polygonPath, regularPolygon, smoothPath, starPoints } from './geometry'
import { legLength, STROKE } from './layout'

// 몬스터 부품들. 모든 부품은 같은 굵기(3px)의 진한 외곽선을 쓴다(설계안 3-5-1).
const outlined = (color) => ({ stroke: color, strokeWidth: STROKE, strokeLinejoin: 'round', strokeLinecap: 'round' })

// 굵은 선 부품(꼬리·다리·팔)은 외곽선 색으로 한 번, 속 색으로 한 번 겹쳐 그린다.
function ThickLine({ d, width, color, outline }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={outline} strokeWidth={width + STROKE * 2} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  )
}

export function Tail({ body, life, palette }) {
  const ax = body.cx + body.rx * 0.82
  const ay = body.cy + body.ry * 0.35
  const joints = life.tailJoints
  const wave = ((joints - 2) / 6) * 7
  const points = [[ax - 6, ay]]
  for (let i = 1; i <= joints; i += 1) {
    const t = i / joints
    points.push([ax + 30 * t, ay - 34 * t * t + Math.sin(t * Math.PI * (joints / 2)) * wave])
  }
  const [tx, ty] = points[points.length - 1]
  return (
    <g>
      <ThickLine d={smoothPath(points, false)} width={7} color={palette.limb} outline={palette.outline} />
      {life.tailTip === 'bolt' ? (
        <path
          d={polygonPath([
            [tx - 2, ty - 13],
            [tx + 7, ty - 13],
            [tx + 2, ty - 4],
            [tx + 9, ty - 4],
            [tx - 4, ty + 10],
            [tx, ty + 1],
            [tx - 6, ty + 1],
          ])}
          fill="hsl(48 95% 60%)"
          {...outlined(palette.outline)}
        />
      ) : (
        <circle cx={tx} cy={ty} r={6.5} fill={palette.horn} {...outlined(palette.outline)} />
      )}
    </g>
  )
}

export function Legs({ body, life, palette, back = false }) {
  if (back && life.legCount < 4) return null
  const length = legLength(life)
  const spread = back ? 0.72 : 0.42
  const baseY = body.cy + body.ry * (back ? 0.6 : 0.78)
  const color = back ? palette.outline : palette.limb
  return (
    <g opacity={back ? 0.85 : 1}>
      {[-1, 1].map((side) => {
        const x = body.cx + side * body.rx * spread
        const footY = baseY + length
        return (
          <g key={side}>
            <ThickLine d={`M${x},${baseY} L${x},${footY}`} width={9} color={back ? palette.limb : color} outline={palette.outline} />
            <ellipse cx={x + side * 3} cy={footY + 2} rx={8} ry={4.5} fill={palette.limb} {...outlined(palette.outline)} />
          </g>
        )
      })}
    </g>
  )
}

export function Arms({ body, life, palette }) {
  const width = life.armWidth * 0.75
  return (
    <g>
      {[-1, 1].map((side) => {
        const ax = body.cx + side * body.rx * 0.88
        const ay = body.cy - body.ry * 0.05
        const ex = ax + side * (9 + width * 0.6)
        const ey = ay + 15
        return (
          <g key={side}>
            <ThickLine d={`M${ax - side * 4},${ay} Q${ax + side * 6},${ay - 4} ${ex},${ey}`} width={width} color={palette.limb} outline={palette.outline} />
            {life.glove && <circle cx={ex} cy={ey + 2} r={width * 0.7 + 4} fill="hsl(0 0% 97%)" {...outlined(palette.outline)} />}
          </g>
        )
      })}
    </g>
  )
}

export function Belly({ body, life, palette }) {
  const rx = body.rx * (0.5 + 0.15 * life.belly)
  const ry = body.ry * (0.42 + 0.14 * life.belly)
  const cy = body.cy + body.ry * 0.3
  return (
    <g>
      <ellipse cx={body.cx} cy={cy} rx={rx} ry={ry} fill={palette.belly} />
      {life.belly > 0.6 &&
        [0.35, 0.65].map((t) => (
          <path
            key={t}
            d={`M${body.cx - rx * 0.6},${cy - ry + ry * 2 * t} Q${body.cx},${cy - ry + ry * 2 * t + 5} ${body.cx + rx * 0.6},${cy - ry + ry * 2 * t}`}
            fill="none"
            stroke={palette.outline}
            strokeWidth={1.5}
            opacity={0.35}
          />
        ))}
    </g>
  )
}

// 나만의 습관 → 몸 윗부분의 무늬. 습관 이름이 같으면 무늬와 자리가 같다.
export function Patterns({ body, life, palette }) {
  return (
    <g>
      {life.patterns.map((pattern) => {
        const angle = Math.PI * (1.1 + 0.8 * pattern.spot)
        const x = body.cx + Math.cos(angle) * body.rx * 0.62
        const y = body.cy + Math.sin(angle) * body.ry * 0.55
        const common = { opacity: pattern.opacity, fill: palette.accent, stroke: palette.accent }
        switch (pattern.kind) {
          case 'dot':
            return <circle key={pattern.name} cx={x} cy={y} r={4} {...common} strokeWidth={0} />
          case 'stripe':
            return (
              <g key={pattern.name} {...common} strokeWidth={2} strokeLinecap="round">
                {[-4, 0, 4].map((dx) => (
                  <line key={dx} x1={x + dx} y1={y - 4} x2={x + dx - 2} y2={y + 4} />
                ))}
              </g>
            )
          case 'wave':
            return <path key={pattern.name} d={`M${x - 7},${y} q3.5,-5 7,0 t7,0`} {...common} fill="none" strokeWidth={2} />
          case 'check':
            return (
              <g key={pattern.name} {...common} strokeWidth={0}>
                <rect x={x - 5} y={y - 5} width={5} height={5} />
                <rect x={x} y={y} width={5} height={5} />
              </g>
            )
          default:
            return <path key={pattern.name} d={polygonPath(starPoints(x, y, 6, 2.6))} {...common} strokeWidth={0} />
        }
      })}
    </g>
  )
}

export function Moss({ body, life }) {
  const count = Math.min(7, life.moss)
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const angle = Math.PI * (1.15 + (0.7 * (i + 0.5)) / Math.max(1, count))
        const x = body.cx + Math.cos(angle) * body.rx * 0.92
        const y = body.cy + Math.sin(angle) * body.ry * 0.92
        return (
          <g key={i} fill="hsl(105 40% 42%)" opacity={0.9}>
            <circle cx={x - 3} cy={y} r={3.5} />
            <circle cx={x + 2} cy={y - 2} r={4} />
            <circle cx={x + 4} cy={y + 2} r={3} />
          </g>
        )
      })}
    </g>
  )
}

export function Aura({ life, palette, head }) {
  if (!life.aura) return null
  if (life.aura === 'crown') {
    const x = head.x
    const y = head.y - head.r - 6
    return (
      <path
        d={polygonPath([
          [x - 12, y + 6],
          [x - 12, y - 6],
          [x - 6, y],
          [x, y - 9],
          [x + 6, y],
          [x + 12, y - 6],
          [x + 12, y + 6],
        ])}
        fill="hsl(46 95% 58%)"
        {...outlined(palette.outline)}
      />
    )
  }
  return (
    <g fill="none" stroke={palette.aura} strokeWidth={3} strokeDasharray="6 7" opacity={0.6}>
      {Array.from({ length: life.aura }, (_, i) => (
        <circle key={i} cx={100} cy={112} r={84 + i * 9} />
      ))}
    </g>
  )
}

export function Ears({ head, type, palette }) {
  const { x, y, r } = head
  return (
    <g fill={palette.limb} {...outlined(palette.outline)}>
      {[-1, 1].map((side) => {
        const angle = (side * 48 * Math.PI) / 180
        const bx = x + Math.sin(angle) * r
        const by = y - Math.cos(angle) * r
        switch (type) {
          case 'pointy':
            return (
              <path
                key={side}
                d={polygonPath([
                  [bx - side * 9, by + 6],
                  [bx + side * 6, by - 16],
                  [bx + side * 9, by + 4],
                ])}
              />
            )
          case 'round':
            return <circle key={side} cx={bx + side * 2} cy={by - 2} r={r * 0.26} />
          case 'fin':
            return (
              <path
                key={side}
                d={`M${x + side * r * 0.92},${y - 6} q${side * 16},-10 ${side * 14},12 q${-side * 6},-2 ${-side * 13},4 Z`}
              />
            )
          default:
            return (
              <g key={side}>
                <path d={`M${bx},${by + 2} q${side * 4},-12 ${side * 10},-18`} fill="none" />
                <circle cx={bx + side * 10} cy={by - 17} r={3.5} fill={palette.horn} />
              </g>
            )
        }
      })}
    </g>
  )
}

export function MushroomCap({ head, palette }) {
  const { x, y, r } = head
  const w = r * 1.45
  const top = y - r * 1.25
  return (
    <g>
      <path d={`M${x - w},${y - r * 0.15} Q${x - w},${top} ${x},${top} Q${x + w},${top} ${x + w},${y - r * 0.15} Z`} fill={palette.accent} {...outlined(palette.outline)} />
      {[
        [-0.5, 0.55],
        [0.15, 0.75],
        [0.65, 0.5],
      ].map(([dx, dy]) => (
        <circle key={dx} cx={x + dx * w} cy={y - r * 0.15 - dy * (r * 1.1)} r={4} fill="hsl(0 0% 98%)" />
      ))}
    </g>
  )
}

// 과목별 뿔. 머리 위 둘레에 펼쳐 꽂는다.
export function Horns({ head, horns, palette, capLift = 0 }) {
  const count = horns.length
  return (
    <g>
      {horns.map((horn, i) => {
        const angle = count === 1 ? 0 : -55 + (110 * i) / (count - 1)
        const rad = (angle * Math.PI) / 180
        const reach = head.r + capLift
        const bx = head.x + Math.sin(rad) * reach
        const by = head.y - Math.cos(rad) * reach
        return (
          <g key={horn.subject} transform={`translate(${bx} ${by}) rotate(${angle})`}>
            <HornShape horn={horn} length={horn.length * 0.75} palette={palette} />
          </g>
        )
      })}
    </g>
  )
}

function HornShape({ horn, length: L, palette }) {
  const line = { stroke: palette.outline, strokeWidth: 2.5, strokeLinecap: 'round', fill: 'none' }
  const shell = { fill: palette.horn, ...outlined(palette.outline) }
  switch (horn.kind) {
    case 'prism':
      return (
        <g>
          <path d={polygonPath([[-6, 2], [6, 2], [0, -L]])} {...shell} />
          <path d={`M0,2 L0,${-L}`} stroke={palette.outline} strokeWidth={1.2} opacity={0.6} />
        </g>
      )
    case 'code':
      return (
        <g>
          <path d={`M0,2 L0,${-L + 6}`} {...line} />
          <rect x={-11} y={-L - 6} width={22} height={13} rx={4} {...shell} />
          <text x={0} y={-L + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill={palette.outline} fontFamily="monospace">
            {'</>'}
          </text>
        </g>
      )
    case 'bubble':
      return (
        <g>
          <path d={`M0,2 L0,${-L + 5}`} {...line} />
          <ellipse cx={0} cy={-L - 2} rx={11} ry={8} fill={palette.hornLight} {...outlined(palette.outline)} />
          {[-4, 0, 4].map((dx) => (
            <circle key={dx} cx={dx} cy={-L - 2} r={1.4} fill={palette.outline} />
          ))}
        </g>
      )
    case 'flask':
      return (
        <g>
          <path d={`M0,2 L0,${-L + 10}`} {...line} />
          <path
            d={polygonPath([[-8, -L + 10], [8, -L + 10], [2.5, -L], [2.5, -L - 6], [-2.5, -L - 6], [-2.5, -L]])}
            fill={palette.hornLight}
            {...outlined(palette.outline)}
          />
          <path d={polygonPath([[-6, -L + 8.5], [6, -L + 8.5], [3, -L + 3.5], [-3, -L + 3.5]])} fill={palette.horn} />
        </g>
      )
    case 'brush':
      return (
        <g>
          <path d={`M0,2 L0,${-L + 6}`} stroke="hsl(30 40% 40%)" strokeWidth={4} strokeLinecap="round" />
          <path d={`M-5,${-L + 7} Q-6,${-L - 2} 0,${-L - 10} Q6,${-L - 2} 5,${-L + 7} Z`} {...shell} />
        </g>
      )
    default:
      return (
        <g>
          <path d={`M0,2 L0,${-L + 6}`} {...line} />
          <path d={polygonPath(regularPolygon(0, -L, 8, horn.sides, horn.twist))} {...shell} />
        </g>
      )
  }
}

export function Eyes({ head, innate, life, palette, idPrefix }) {
  const { x, y, r } = head
  const ey = y + r * 0.02
  const size = Math.min(11, Math.max(5.5, r * 0.24))
  let eyes
  if (innate.eyeShape === 'cyclops') eyes = [[x, ey, size * 1.55]]
  else if (innate.eyeShape === 'compound')
    eyes = [-1, 1].flatMap((side) => [
      [x + side * r * 0.4, ey - size * 0.35, size * 0.55],
      [x + side * r * 0.28, ey + size * 0.45, size * 0.5],
      [x + side * r * 0.52, ey + size * 0.5, size * 0.48],
    ])
  else eyes = [-1, 1].map((side) => [x + side * r * 0.38, ey, size])

  return (
    <g>
      {life.darkCircle > 0.05 &&
        eyes.map(([ex, eyY, er], i) => (
          <ellipse key={`dark-${i}`} cx={ex} cy={eyY + er * 1.05} rx={er * 0.95} ry={er * 0.42} fill="hsl(270 30% 28%)" opacity={life.darkCircle * 0.75} />
        ))}
      <g className="monster-eyes" style={{ animationDuration: `${4 + (innate.hue % 30) / 10}s` }}>
        {eyes.map(([ex, eyY, er], i) => (
          <Eye key={i} x={ex} y={eyY} r={er} shape={innate.eyeShape} life={life} palette={palette} clipId={`${idPrefix}-eye${i}`} />
        ))}
      </g>
    </g>
  )
}

function Eye({ x, y, r, shape, life, palette, clipId }) {
  const pupil = (
    <g>
      <ellipse cx={x} cy={y + r * 0.08} rx={Math.max(0.9, r * 0.55 * (1 - 0.78 * life.pupilSlit))} ry={r * 0.62} fill="hsl(270 25% 15%)" />
      <circle cx={x + r * 0.22} cy={y - r * 0.25} r={Math.max(1, r * 0.18)} fill="#fff" />
    </g>
  )
  const white =
    shape === 'star' ? (
      <path d={polygonPath(starPoints(x, y, r * 1.2, r * 0.68))} fill="#fff" stroke={palette.outline} strokeWidth={2} strokeLinejoin="round" />
    ) : shape === 'halfMoon' ? (
      <path d={`M${x - r},${y - r * 0.15} A${r},${r} 0 0 0 ${x + r},${y - r * 0.15} Z`} fill="#fff" stroke={palette.outline} strokeWidth={2} strokeLinejoin="round" />
    ) : shape === 'dot' ? null : (
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={palette.outline} strokeWidth={2} />
    )
  const lidHeight = r * 2 * life.eyelid
  return (
    <g>
      <clipPath id={clipId}>
        <circle cx={x} cy={y} r={r + 1} />
      </clipPath>
      {white}
      {shape === 'dot' ? <circle cx={x} cy={y} r={r * 0.6} fill="hsl(270 25% 15%)" /> : <g clipPath={`url(#${clipId})`}>{pupil}</g>}
      {lidHeight > 0.5 && (
        <g>
          <rect x={x - r - 1} y={y - r - 1} width={r * 2 + 2} height={lidHeight + 1} fill={palette.limb} clipPath={`url(#${clipId})`} />
          <path d={`M${x - r * 0.95},${y - r + lidHeight} L${x + r * 0.95},${y - r + lidHeight}`} stroke={palette.outline} strokeWidth={2} strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

export function Mouth({ head, life, palette }) {
  const { x, y, r } = head
  const my = y + r * 0.5
  const w = r * 0.3
  const curve = life.mouth * r * 0.22
  const teethCount = life.teeth < 0.15 ? 2 : 3 + Math.round(life.teeth * 3)
  return (
    <g>
      {life.mouth > 0.4 &&
        [-1, 1].map((side) => <ellipse key={side} cx={x + side * r * 0.62} cy={my - r * 0.12} rx={r * 0.16} ry={r * 0.09} fill={palette.blush} />)}
      <g fill="#fff" stroke={palette.outline} strokeWidth={1.2} strokeLinejoin="round">
        {Array.from({ length: teethCount }, (_, i) => {
          const t = teethCount === 2 ? (i === 0 ? 0.3 : 0.7) : (i + 0.5) / teethCount
          const jag = life.teeth >= 0.15 ? life.teeth * 2.5 * ((i % 3) - 1) : 0
          const tx = x - w + 2 * w * t + jag * 0.6
          const baseY = my + curve * (1 - (2 * t - 1) ** 2) * 1.0
          const h = 3 + (life.teeth >= 0.15 && i % 2 ? life.teeth * 3 : 0)
          return <path key={i} d={polygonPath([[tx - 2.2, baseY], [tx + 2.2, baseY], [tx + jag * 0.3, baseY + h]])} />
        })}
      </g>
      <path d={`M${x - w},${my} Q${x},${my + curve * 2} ${x + w},${my}`} fill="none" stroke={palette.outline} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  )
}
