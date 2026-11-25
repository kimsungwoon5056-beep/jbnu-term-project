// 광고: 큰 광고가 화면을 가린다. 5초 뒤 "건너뛰기"(아이템으로 놓임, schedule.js)를 먼저 밟은 사람만 벗어나고 2초 무적이 된다.
// 밟았는지는 아이템 줍기 이벤트(pick)로 모든 화면에 알린다. 새 이벤트 종류를 만들지 않는다.
export const ad = {
  enter(world) {
    world.modeState.skippedBy = null
  },

  // 건너뛰기를 밟았다(world.pickItem이 부른다).
  skipped(world, id) {
    world.modeState.skippedBy ??= id
  },
}

// 이 사람의 화면에 떠 있는 광고 수
export function adCount(world, id) {
  const { skippedBy } = world.modeState
  if (skippedBy === id) return 0
  return skippedBy ? 2 : 1
}
