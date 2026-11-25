// 광고: 큰 광고가 화면을 가린다. 5초 뒤 "건너뛰기"(아이템으로 놓임, schedule.js)를 먼저 밟은 사람만 벗어나고 2초 무적이 된다.
// 밟았는지는 아이템 줍기 이벤트(pick)로 모든 화면에 알린다. 거의 동시에 밟으면 먼저 밟은 시각(같으면 열쇠)으로 정해 모든 화면이 같다.
export const ad = {}

const skipOf = (world) => world.items.find((item) => item.kind === 'skip' && item.until === world.modeDive?.end) ?? null

// 건너뛴 사람(없으면 null)
export const skippedBy = (world) => skipOf(world)?.by ?? null

// 이 사람의 화면에 떠 있는 광고 수
export function adCount(world, id) {
  const winner = skippedBy(world)
  if (winner === id) return 0
  return winner ? 2 : 1
}
