import './pixel.css'
import { toRuns } from './pixel/runs'

function Rects({ pixels, palette }) {
  return toRuns(pixels).map((run) => (
    <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.width} height={1} fill={palette[run.color] ?? run.color} />
  ))
}

// sprite: { size, palette, layers: { shadow, body, blink } }
// scale: 화면에서 1칸을 몇 픽셀로 보일지(정수여야 도트가 흐려지지 않는다)
function PixelSprite({ sprite, label, scale = 4, animate = true, className = '' }) {
  const { size, palette, layers } = sprite
  const blink = layers.blink ?? []
  return (
    <svg
      className={`pixel-sprite ${className}`}
      viewBox={`0 0 ${size} ${size}`}
      width={size * scale}
      height={size * scale}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      {layers.shadow && <Rects pixels={layers.shadow} palette={palette} />}
      <g className={animate ? 'sprite-bob' : undefined}>
        <Rects pixels={layers.body} palette={palette} />
        {animate && blink.length > 0 && (
          <g className="sprite-blink">
            <Rects pixels={blink} palette={palette} />
          </g>
        )}
      </g>
    </svg>
  )
}

export default PixelSprite
