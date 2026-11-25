// 경기장 = 세로 폰 화면. 맨 위 상태 표시줄과 맨 아래 독은 벽이고, 그 사이 홈 화면에서 싸운다.
export const ARENA = { w: 360, h: 600 }
export const AREA = { x0: 0, y0: 36, x1: 360, y1: 548 }
// 장애물: 홈 화면의 앱 아이콘(app: 그릴 앱 모양 키, appLook.js)
export const OBSTACLES = [
  { x: 52, y: 120, w: 56, h: 56, app: 'kakaotalk' },
  { x: 252, y: 120, w: 56, h: 56, app: 'instagram' },
  { x: 152, y: 264, w: 56, h: 56, app: 'youtube' },
  { x: 52, y: 408, w: 56, h: 56, app: 'tiktok' },
  { x: 252, y: 408, w: 56, h: 56, app: 'baemin' },
]
export const SPAWNS = [
  [40, 72],
  [320, 512],
  [320, 72],
  [40, 512],
]
export const RADIUS = 14
export const MATCH_SECONDS = 90
