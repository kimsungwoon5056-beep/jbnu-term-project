// Object Pool: 발사체 객체를 매번 새로 만들지 않고 다시 쓴다(초당 60번 도는 게임 루프의 쓰레기 수집을 줄임).
export class Pool {
  constructor(create) {
    this.create = create
    this.free = []
    this.active = []
  }

  acquire(values) {
    const item = this.free.pop() ?? this.create()
    Object.assign(item, values)
    this.active.push(item)
    return item
  }

  // keep(item)이 false인 것을 돌려놓는다.
  sweep(keep) {
    const next = []
    for (const item of this.active) {
      if (keep(item)) next.push(item)
      else this.free.push(item)
    }
    this.active = next
  }

  get size() {
    return this.active.length
  }
}

// 같은 씨앗이면 같은 수열(봇·조준 흔들림을 테스트할 수 있게)
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
