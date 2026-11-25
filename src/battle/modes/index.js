import { ad } from './ad'
import { boss } from './boss'
import { rhythm } from './rhythm'
import { shorts } from './shorts'
import { mirrorPoint, rotatePoint } from './transforms'
import { update } from './update'

// "앱 속으로" 모드 등록부(Strategy). 세계·입력·렌더러는 지금 모드 객체의 아래 값만 본다. 없는 것은 기본 동작이다.
//   key, label, icon(앱 그림), color, hint { touch, pc }: 이름과 안내
//   steer: 'top'(기본) | 'look'(보는 방향 기준) | 'call'(상대가 보는 화면 기준)
//   camera: 'eyes' | 'call' | 'chase' — 3D로 그리는 모드
//   rules { enter, step, leave, move, power, truce, hitShot }: 세계 규칙(결정적). world는 이것만 부른다
//   pointer(x, y, { t, left, reduced }): 화면에 보이는 자리 → 경기장 자리(뒤집히거나 돌아간 화면에서 마우스 조준)
const mode = (key, label, icon, color, touch, pc, rest = {}) => ({ key, label, icon, color, hint: { touch, pc }, steer: 'top', rules: {}, ...rest })

export const MODES = Object.fromEntries(
  [
    mode('first', '폰 속으로', 'video', '#ff5fa8', '화면을 밀어 둘러봐요', '마우스로 둘러보기 · WASD 이동', { steer: 'look', camera: 'eyes' }),
    mode('call', '영상통화', 'messenger', '#4cc96b', '상대 눈으로 나를 봐요', '상대 눈으로 나를 봐요', { steer: 'call', camera: 'call' }),
    mode('chase', '추격 카메라', 'game', '#ffb21e', '화면을 밀어 둘러봐요', '마우스로 둘러보기 · WASD 이동', { steer: 'look', camera: 'chase' }),
    mode('rotate', '자동 회전', 'study', '#7fd3ff', '화면이 돌아가요!', '화면이 돌아가요!', { pointer: (x, y, { t, left, reduced }) => rotatePoint(x, y, t, { left, reduced }) }),
    mode('selfie', '셀카', 'instagram', '#e1306c', '좌우가 뒤집혀요', '좌우가 뒤집혀요', { pointer: (x, y) => ({ x: mirrorPoint(x), y }) }),
    mode('torch', '손전등', 'finance', '#ffe9a8', '비추는 곳만 보여요', '비추는 곳만 보여요'),
    mode('lowpower', '저전력 모드', 'everytime', '#8bac0f', '화질을 아끼는 중', '화질을 아끼는 중'),
    mode('shorts', '짧은 영상', 'tiktok', '#fe2c55', '위로 밀면 점프!', 'W로 점프!', { rules: shorts }),
    mode('ad', '광고', 'youtube', '#ff1f3d', '5초 뒤 건너뛰기를 먼저 밟아요', '5초 뒤 건너뛰기를 먼저 밟아요', { rules: ad }),
    mode('rhythm', '음악', 'music', '#b06be0', '박자에 맞춰 쏘면 2배!', '박자에 맞춰 쏘면 2배!', { rules: rhythm }),
    mode('update', '앱 업데이트', 'toss', '#2f6bff', '공격과 기술이 바뀌었어요', '공격과 기술이 바뀌었어요', { rules: update }),
    mode('boss', '알고리즘 보스', 'netflix', '#e50914', '서로 쏘지 말고 보스를 때려요', '서로 쏘지 말고 보스를 때려요', { rules: boss }),
  ].map((item) => [item.key, item]),
)

export const modeOf = (world) => MODES[world.mode] ?? null
export const rulesOf = (world) => MODES[world.mode]?.rules ?? null
