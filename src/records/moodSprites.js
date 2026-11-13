import { addOutline, createGrid, fillEllipse, stamp, toPixels } from '../monster/pixel/grid'

// 기분 5단계 도트 얼굴(12×12). 얼굴색과 눈·입 모양이 함께 바뀐다(색만으로 구분하지 않음).
const FACE_COLORS = { 1: '#8a9bd6', 2: '#b49be0', 3: '#7fdcc4', 4: '#ffd65a', 5: '#ff9fbc' }
const FEATURES = {
  1: { eyes: ['o...o', '.o.o.', 'o...o'], mouth: ['.ooo.', 'o.o.o'] }, // 찡그린 눈
  2: { eyes: ['o...o', 'o...o'], mouth: ['.ooo.', 'o...o'] },
  3: { eyes: ['o...o', 'o...o'], mouth: ['ooooo'] },
  4: { eyes: ['o...o', 'o...o'], mouth: ['o...o', '.ooo.'] },
  5: { eyes: ['.o.o.', 'o.o.o'], mouth: ['ooooo', 'orrro', '.ooo.'] }, // 웃는 눈, 활짝
}

const cache = new Map()

export function moodSprite(value) {
  if (cache.has(value)) return cache.get(value)
  const grid = createGrid(12)
  fillEllipse(grid, 6, 6, 5, 5, 'F')
  addOutline(grid)
  const { eyes, mouth } = FEATURES[value]
  stamp(grid, eyes, 3, 3)
  stamp(grid, mouth, 3, eyes.length === 3 ? 7 : 7)
  const sprite = {
    size: 12,
    palette: { F: FACE_COLORS[value], o: '#151a3a', r: '#ff5d7a' },
    layers: { body: toPixels(grid) },
  }
  cache.set(value, sprite)
  return sprite
}
