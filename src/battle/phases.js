import { rankPlayers, stepWorld } from './world'

// State: 한 판의 단계. 루프(Context)는 지금 단계에 프레임을 맡기고, 단계 객체가 "이번 프레임에 할 일"과 "다음 단계"를 정한다.
//   단계 인터페이스: { name, done?, enter?(loop), frame(loop, dt) → 다음 단계 }
//   카운트다운 → 진행 → 끝. 일시정지·재경기 같은 단계가 늘어도 새 객체만 더하면 되고 루프의 분기는 늘지 않는다.
// 단계 객체는 루프의 Template Method 훅(countdown·collectCommands·afterStep·finish)을 불러 연습·온라인 차이를 루프에 맡긴다.
export const STEP = 1 / 60 // 고정 걸음(초당 60번)

export const Countdown = {
  name: 'countdown',
  frame(loop) {
    const left = loop.countdown()
    if (left <= 0) return Playing
    loop.renderer.draw(loop.world, { countdown: left })
    return Countdown
  },
}

export const Playing = {
  name: 'playing',
  enter(loop) {
    loop.acc = 0 // 카운트다운 동안 흐른 시간은 걸음으로 치지 않는다.
  },
  frame(loop, dt) {
    loop.acc += dt
    while (loop.acc >= STEP) {
      stepWorld(loop.world, loop.collectCommands(), STEP)
      loop.afterStep(STEP)
      loop.acc -= STEP
    }
    loop.renderer.draw(loop.world, { countdown: 0 })
    return loop.world.over ? Over : Playing
  },
}

export const Over = {
  name: 'over',
  done: true, // 루프가 다음 프레임을 예약하지 않는다.
  enter(loop) {
    loop.finish()
    loop.onEnd?.(rankPlayers(loop.world))
  },
  frame() {
    return Over
  },
}
