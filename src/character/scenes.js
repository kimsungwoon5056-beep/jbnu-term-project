import { createGrid, fillEllipse, fillRect, setCell, toPixels } from '../pixel/grid'

// 캐릭터 뒤 배경(48×48). 건강하면 햇살 공원, 보통이면 낮의 방, 폰을 많이 쓰거나 밤 폰이면 어두운 방에 화면 빛
export const SCENE_LABELS = { park: '햇살 공원', home: '낮의 방', room: '어두운 방' }

const PALETTE = {
  skyTop: '#9fd8ff',
  sky: '#c9ecff',
  sun: '#ffd84a',
  cloud: '#ffffff',
  hill: '#8fd47e',
  grass: '#6cc35a',
  tuft: '#4fa645',
  trunk: '#8a5a2b',
  leaf: '#3f9b4a',
  leafLight: '#5cb85f',
  wall: '#f6e7c8',
  wallLine: '#ecd7ae',
  frame: '#b98a5a',
  glass: '#bfe6ff',
  floor: '#d1a36f',
  plank: '#b98a5a',
  darkWall: '#262849',
  darkFrame: '#3d3f6b',
  night: '#141533',
  moon: '#ffe9a3',
  star: '#ffffff',
  darkFloor: '#1d1b33',
  glowWall: '#323a6b',
  glowFloor: '#27325a',
}

function park(g) {
  fillRect(g, 0, 0, 48, 14, 'skyTop')
  fillRect(g, 0, 14, 48, 22, 'sky')
  fillEllipse(g, 7, 7, 3.6, 3.6, 'sun')
  fillEllipse(g, 36, 9, 5, 1.8, 'cloud')
  fillEllipse(g, 40, 7.6, 3, 1.8, 'cloud')
  fillEllipse(g, 10, 37, 15, 6, 'hill')
  fillEllipse(g, 41, 38, 13, 5, 'hill')
  fillRect(g, 0, 36, 48, 12, 'grass')
  for (const [x, y] of [[4, 39], [12, 44], [33, 41], [42, 45], [8, 46], [38, 38]]) {
    setCell(g, x, y, 'tuft')
    setCell(g, x + 1, y - 1, 'tuft')
  }
  fillRect(g, 3, 25, 2, 12, 'trunk')
  fillEllipse(g, 4, 21, 5, 5.5, 'leaf')
  fillEllipse(g, 3, 19, 2.4, 2.2, 'leafLight')
}

function home(g) {
  fillRect(g, 0, 0, 48, 36, 'wall')
  for (let y = 4; y < 36; y += 8) fillRect(g, 0, y, 48, 1, 'wallLine')
  fillRect(g, 34, 5, 11, 12, 'frame')
  fillRect(g, 35, 6, 9, 10, 'glass')
  fillRect(g, 39, 6, 1, 10, 'frame')
  fillRect(g, 35, 10, 9, 1, 'frame')
  fillRect(g, 0, 36, 48, 12, 'floor')
  for (let y = 39; y < 48; y += 4) fillRect(g, 0, y, 48, 1, 'plank')
}

function room(g, glow) {
  fillRect(g, 0, 0, 48, 36, 'darkWall')
  fillRect(g, 3, 5, 12, 11, 'darkFrame')
  fillRect(g, 4, 6, 10, 9, 'night')
  fillEllipse(g, 11, 9, 2, 2, 'moon')
  fillEllipse(g, 12, 8.4, 1.4, 1.4, 'night')
  for (const [x, y] of [[6, 8], [8, 12], [12, 13], [5, 14]]) setCell(g, x, y, 'star')
  fillRect(g, 0, 36, 48, 12, 'darkFloor')
  // 폰 화면 빛: 벽·바닥 색을 조금 밝힌다(겹쳐 칠하지 않고 칸 색을 바꿈).
  if (glow) {
    for (let y = 20; y < 46; y += 1) {
      for (let x = 20; x < 48; x += 1) {
        if (((x + 0.5 - 35) / 13) ** 2 + ((y + 0.5 - 32) / 12) ** 2 > 1) continue
        setCell(g, x, y, y < 36 ? 'glowWall' : 'glowFloor')
      }
    }
  }
}

const SCENES = { park, home, room }

export function paintScene(kind, { glow = false } = {}) {
  const g = createGrid()
  ;(SCENES[kind] ?? home)(g, glow)
  return { pixels: toPixels(g), palette: PALETTE }
}
