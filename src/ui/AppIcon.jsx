import { APP_LOOKS, C } from '../character/appLook'

// 도트 앱 아이콘(앱 색 바탕 + 5×5 로고). 꾸밈용이라 스크린리더에는 읽히지 않는다.
function AppIcon({ look, size = 28, className = '' }) {
  const app = APP_LOOKS[look] ?? APP_LOOKS.study
  return (
    <svg className={`app-icon-svg ${className}`} viewBox="0 0 11 11" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 0h7v1h1v1h1v7h-1v1h-1v1h-7v-1h-1v-1h-1v-7h1v-1h1z" fill="#14152b" />
      <path d="M2 1h7v1h1v7h-1v1h-7v-1h-1v-7h1z" fill={app.main} />
      <rect x="2" y="1" width="7" height="1" fill="#ffffff" opacity="0.35" />
      {app.logo.map((row, y) => [...row].map((ch, x) => ch !== '.' && <rect key={`${x}-${y}`} x={x + 3} y={y + 3} width="1" height="1" fill={C[ch] ?? ch} />))}
    </svg>
  )
}

export default AppIcon
