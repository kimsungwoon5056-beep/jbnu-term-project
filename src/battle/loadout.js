import { SKILLS } from './skills'

// 오늘의 기록 → 대결 능력(순수 함수). 폰을 덜 쓴 사람이 유리하다.
// 체력 = 60 + 40 × 디지털 건강, 속도 = 기본 + 걸음 보너스, 앱 기술 = 머리(1위 앱) 유형, 디버프 = 상태 표시
export const BASE_HP = 60
export const BASE_SPEED = 150
export const SNEAKER_BONUS = 1.2

// state: characterState() 결과, look: 모습, nickname: 닉네임
// 오늘 스마트폰 기록이 없으면 건강을 중간(50%)으로 보고 앱 기술도 없다(기록하지 않는 쪽이 유리하지 않게).
export const UNKNOWN_HEALTH = 50

export function buildLoadout({ state, look, nickname }) {
  const hair = state.grafts.find((graft) => graft.slot === 'hair')
  const recorded = state.health.known?.phone ?? true
  const skill = !recorded ? 'unrecorded' : hair ? hair.archetype : 'detox'
  const health = recorded ? state.health.percent : UNKNOWN_HEALTH
  const { marks } = state
  return {
    name: nickname,
    look,
    // 상대 화면에서 같은 캐릭터를 그리는 데 필요한 것만
    grafts: state.grafts.map(({ slot, icon, archetype }) => ({ slot, icon: icon ?? null, archetype })),
    marks: { ...marks },
    tier: state.tier,
    health,
    hp: Math.round(BASE_HP + 0.4 * health),
    speed: Math.round(BASE_SPEED * (marks.shoes === 'sneakers' ? SNEAKER_BONUS : 1)),
    skill,
    debuffs: { badges: marks.badges, jitter: marks.spiral, darkCircles: marks.darkCircles, slouch: marks.slouch },
  }
}

// 화면에 보일 디버프 설명
export function debuffLines(debuffs) {
  const lines = []
  if (debuffs.badges) lines.push(`알림 배지 ${debuffs.badges}개: 10초마다 ${(debuffs.badges * 0.3).toFixed(1)}초 멈칫`)
  if (debuffs.jitter) lines.push('빙글 눈: 조준이 흔들림')
  if (debuffs.darkCircles) lines.push('다크서클: 시야가 좁아짐')
  if (debuffs.slouch) lines.push('거북목: 대시 거리 감소')
  return lines
}

export const skillOf = (loadout) => SKILLS[loadout.skill] ?? SKILLS.detox
