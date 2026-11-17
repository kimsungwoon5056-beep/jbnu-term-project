import { useMemo } from 'react'
import './pixel.css'
import { toRuns } from './runs'

function Rects({ pixels, palette }) {
  return toRuns(pixels).map((run) => (
    <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.width} height={1} fill={palette[run.color] ?? run.color} />
  ))
}

// 칸 좌표 → 그 칸을 칠한 부위 키
function ownerMap(parts) {
  const map = new Map()
  for (const [key, cells] of Object.entries(parts ?? {})) for (const [x, y] of cells) map.set(`${x},${y}`, key)
  return map
}

// sprite: { size, palette, layers: { backdrop?, shadow, body, blink, parts, fx? } }
// fx: { screen: 폰 화면 칸, badges: 배지별 칸 목록 } — 움직이게 할 칸(없으면 그냥 그린다)
// scale: 화면에서 1칸을 몇 픽셀로 보일지(정수여야 도트가 흐려지지 않는다)
// highlight: 강조할 부위 키(또는 키 목록, 나머지는 흐리게). onPick(key): 그림을 누르면 누른 칸의 부위 키로 부른다.
function PixelSprite({ sprite, label, scale = 4, animate = true, className = '', highlight = null, onPick = null }) {
  const { size, palette, layers } = sprite
  const blink = layers.blink ?? []
  const owners = useMemo(() => ownerMap(layers.parts), [layers.parts])
  const focusPixels = useMemo(() => {
    const keys = highlight === null ? [] : [highlight].flat()
    const cells = new Set(keys.flatMap((key) => layers.parts?.[key] ?? []).map(([x, y]) => `${x},${y}`))
    const all = [...(layers.backdrop ?? []), ...layers.body]
    return all.filter(([x, y]) => cells.has(`${x},${y}`))
  }, [highlight, layers.parts, layers.body, layers.backdrop])
  const focused = focusPixels.length > 0
  // 폰 화면 깜빡임·배지 통통: 부위를 고르는 동안에는 멈춘다(고른 칸이 제자리에서 깜빡이도록).
  const fx = animate && !focused ? layers.fx : null
  const badges = useMemo(() => (fx?.badges ?? []).filter((cells) => cells.length > 0), [fx])
  const still = useMemo(() => {
    if (badges.length === 0) return layers.body
    const moving = new Set(badges.flat().map(([x, y]) => `${x},${y}`))
    return layers.body.filter(([x, y]) => !moving.has(`${x},${y}`))
  }, [badges, layers.body])

  function handleClick(event) {
    if (!onPick) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - box.left) / box.width) * size)
    const y = Math.floor(((event.clientY - box.top) / box.height) * size)
    // 들썩임으로 1칸 어긋날 수 있으니 바로 옆 칸까지 찾아본다.
    for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const key = owners.get(`${x + dx},${y + dy}`)
      if (key) {
        onPick(key)
        return
      }
    }
  }

  return (
    <svg
      className={`pixel-sprite ${onPick ? 'pickable' : ''} ${badges.length ? 'has-badge' : ''} ${className}`}
      viewBox={`0 0 ${size} ${size}`}
      width={size * scale}
      height={size * scale}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      onClick={onPick ? handleClick : undefined}
    >
      {layers.backdrop && (
        <g className={focused ? 'sprite-dim' : undefined}>
          <Rects pixels={layers.backdrop} palette={palette} />
        </g>
      )}
      {layers.shadow && <Rects pixels={layers.shadow} palette={palette} />}
      <g className={animate ? 'sprite-bob' : undefined}>
        <g className={focused ? 'sprite-dim' : undefined}>
          <Rects pixels={still} palette={palette} />
          {badges.map((cells, i) => (
            <g key={i} className={`sprite-badge sprite-badge-${i}`}>
              <Rects pixels={cells} palette={palette} />
            </g>
          ))}
          {fx?.screen?.length > 0 && (
            <g className="sprite-screen">
              <Rects pixels={fx.screen} palette={palette} />
            </g>
          )}
          {animate && blink.length > 0 && (
            <g className="sprite-blink">
              <Rects pixels={blink} palette={palette} />
            </g>
          )}
        </g>
        {focused && (
          <g className="sprite-focus">
            <Rects pixels={focusPixels} palette={palette} />
          </g>
        )}
      </g>
    </svg>
  )
}

export default PixelSprite
