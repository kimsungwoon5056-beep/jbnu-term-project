// Observer의 Subject: 구독자(Observer) 목록을 들고 있다가 신호가 생기면 모두에게 알린다.
// 신호를 내는 쪽은 누가 듣는지 모르고, 듣는 쪽은 언제든 붙었다 떨어질 수 있다.
export class Subject {
  constructor() {
    this.observers = new Set()
  }

  // observer(signal)를 등록하고, 해지 함수를 돌려준다.
  subscribe(observer) {
    this.observers.add(observer)
    return () => this.observers.delete(observer)
  }

  // 알리는 도중에 누가 해지하거나 새로 붙어도 이번 알림의 대상은 바뀌지 않는다.
  notify(signal) {
    for (const observer of [...this.observers]) observer(signal)
  }

  get size() {
    return this.observers.size
  }
}
