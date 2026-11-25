import { DASH, keepInside, speedOf } from '../world'

// 짧은 영상: 옆에서 보는 화면이 되고 중력이 생긴다. 앱 아이콘과 바닥이 발판이다.
// 내 화면에서 판정하는 사람(나·봇)만 계산하고, 위치는 평소처럼 보낸다.
export const GRAVITY = 1150
export const JUMP = 610 // 높이 약 162 — 발판 간격(144)보다 조금 높다
export const MAX_FALL = 620
const COYOTE = 0.1 // 발판 끝을 벗어난 직후에도 뛸 수 있는 시간(초)
const JUMP_STICK = -0.4 // 이만큼 위로 밀면 점프

export const shorts = {
  floorSafe: true, // 바닥에 설 수밖에 없으므로 배터리 경고의 아래쪽은 꺼지지 않은 것으로 본다

  enter(world) {
    for (const player of world.players) Object.assign(player, { vyG: 0, groundT: 0 })
  },

  leave(world) {
    for (const player of world.players) {
      delete player.vyG
      delete player.groundT
    }
  },

  // 상대 위치 예측: 떠 있으면 중력을 주고, 발판에 닿으면 멈춘다(step초 앞).
  predict(player, step) {
    const spot = { x: player.tx + player.vx * step, y: player.ty }
    if (Math.abs(player.vy) > 40) {
      player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * step)
      spot.y += player.vy * step
    }
    const wanted = spot.y
    keepInside(spot)
    if (Math.abs(spot.y - wanted) > 0.01) player.vy = 0
    player.tx = spot.x
    player.ty = spot.y
  },

  // 쓰러진 사람은 바닥까지 떨어진다.
  fallen(player, dt) {
    player.vyG = Math.min(MAX_FALL, (player.vyG ?? 0) + GRAVITY * dt)
    player.y += player.vyG * dt
    const wanted = player.y
    keepInside(player)
    if (player.y < wanted) player.vyG = 0
  },

  // 평소의 이동 대신 부른다.
  move(world, player, dt) {
    const speed = speedOf(player)
    player.vyG ??= 0
    player.groundT = Math.max(0, (player.groundT ?? 0) - dt)
    if (player.dashT > 0) {
      player.x += player.dashX * speed * DASH.mult * dt
      player.y += player.dashY * speed * DASH.mult * dt
      player.vyG = 0
    } else {
      const free = player.stunT <= 0
      if (free) player.x += player.moveX * speed * dt
      if (free && player.groundT > 0 && player.moveY < JUMP_STICK) {
        player.vyG = -JUMP
        player.groundT = 0
        world.signals.notify({ kind: 'jump', who: player.id, x: player.x, y: player.y })
      } else player.vyG = Math.min(MAX_FALL, player.vyG + GRAVITY * dt)
      player.y += player.vyG * dt
    }
    const wanted = player.y
    keepInside(player)
    if (player.y < wanted - 0.01 && player.vyG >= 0) {
      // 바닥이나 발판에 닿았다.
      player.vyG = 0
      player.groundT = COYOTE
    } else if (player.y > wanted + 0.01 && player.vyG < 0) player.vyG = 0 // 머리를 부딪혔다
  },
}
