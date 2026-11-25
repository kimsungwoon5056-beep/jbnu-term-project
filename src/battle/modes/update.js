import { SKILLS } from '../skills'

// 앱 업데이트: 모두의 기본 공격과 기술이 서로 바뀐다. 참가자 순서와 씨앗만 쓰므로 모든 화면에서 같다.
const pool = () => Object.keys(SKILLS).filter((key) => key !== 'unrecorded')

// 지금 기술 열쇠들 → 바뀐 열쇠들. 한 칸씩 돌리고, 그대로이거나 기술이 없으면 씨앗으로 새것을 준다.
export function shuffleSkills(skills, seed) {
  const all = pool()
  return skills.map((skill, i) => {
    const next = skills[(i + 1) % skills.length]
    if (next !== 'unrecorded' && next !== skill) return next
    const start = (Math.abs(seed) + i * 7) % all.length
    const candidates = [...all.slice(start), ...all.slice(0, start)]
    return candidates.find((candidate) => candidate !== skill)
  })
}

export const update = {
  enter(world) {
    const next = shuffleSkills(
      world.players.map((player) => player.loadout.skill),
      world.schedule.seed,
    )
    world.players.forEach((player, i) => {
      player.skillOverride = next[i]
      player.cd.skill = 0
    })
  },

  leave(world) {
    for (const player of world.players) {
      player.skillOverride = null
      player.cd.skill = Math.min(player.cd.skill, 3)
    }
  },
}
