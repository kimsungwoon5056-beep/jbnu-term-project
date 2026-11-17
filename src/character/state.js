import { isNightPickup } from '../stats/metrics'
import { healthOf, healthTier } from '../stats/health'
import { chooseGrafts } from './appGrafts'
import { lookKeyOf, lookLabel } from './appLook'

// 오늘의 사용 → 캐릭터 상태. 모습(look)과 따로 정하고, 그리기(drawCharacter)는 둘을 합친다.
// 기준은 입력값 그대로의 숫자(raw)로 둔다. 부위 설명에 같은 숫자를 보여 주기 위해서다.
export const MARKS = {
  slouchMinutes: 240, // 화면 시간 4시간 이상 → 거북목
  raiseMinutes: 360, // 6시간 이상 → 폰을 얼굴 앞까지 들어 올림
  spiralPickups: 100, // 화면 깨우기 100번 이상 → 빙글빙글 눈
  badgeSteps: [100, 200, 300], // 알림 100·200·300개 이상 → 배지 1·2·3개
  glowMinutes: 180, // 화면 시간 3시간 이상이고
  glowVideoGame: 60, // 영상·게임 앱 1시간 이상 → 얼굴에 화면 빛
  sneakerSteps: 8000, // 8,000보 이상 → 운동화·걷는 자세
  slipperSteps: 3000, // 3,000보 미만 → 슬리퍼
}

const badgeCount = (notifications) => MARKS.badgeSteps.filter((count) => notifications >= count).length

function shoesOf(details) {
  if (!details.known.steps) return 'plain'
  if (details.raw.steps >= MARKS.sneakerSteps) return 'sneakers'
  if (details.raw.steps < MARKS.slipperSteps) return 'slippers'
  return 'plain'
}

function sceneOf(tier, nightPhone) {
  if (tier === 'low' || nightPhone) return 'room'
  return tier === 'good' ? 'park' : 'home'
}

// 칭호: 가장 큰 문제 하나로 정한다.
function titleOf(health, grafts, hasRecord) {
  if (!hasRecord) return '오늘을 기다리는 나'
  if (health.percent >= 90) return '폰 내려놓기 고수'
  const top = health.causes[0]
  if (!top || top.amount < 0.05) return '균형 잡힌 하루'
  const hair = grafts.find((graft) => graft.slot === 'hair')
  switch (top.key) {
    case 'phoneTotal':
      return hair ? `${lookLabel(lookKeyOf(hair))}에 잠긴 나` : '화면에 잠긴 나'
    case 'lateNightPhone':
      return '새벽 폰 탐험가'
    case 'pickups':
      return '1분마다 폰 확인러'
    case 'notifications':
      return '알림에 끌려다니는 중'
    default:
      return '방콕 생활자'
  }
}

// metrics·details: computeMetrics(또는 computeTodayMetrics) 결과
export function characterState(metrics, details, { hasRecord = true } = {}) {
  const raw = details.raw
  const known = details.known
  const health = healthOf(metrics, known)
  const tier = hasRecord ? healthTier(health.percent) : 'mid'
  const grafts = chooseGrafts(details)
  const phone = known.phone
  const videoGame = (raw.phoneCategories?.video ?? 0) + (raw.phoneCategories?.game ?? 0)
  const nightPhone = phone && (raw.span === 'today' ? isNightPickup(raw.firstPickup) : raw.nightPickupDays > 0)
  const marks = {
    slouch: phone && raw.phoneTotal >= MARKS.slouchMinutes,
    raisePhone: phone && raw.phoneTotal >= MARKS.raiseMinutes,
    spiral: phone && raw.pickups >= MARKS.spiralPickups,
    darkCircles: Boolean(nightPhone),
    glow: phone && raw.phoneTotal >= MARKS.glowMinutes && videoGame >= MARKS.glowVideoGame,
    badges: phone ? badgeCount(raw.notifications) : 0,
    shoes: shoesOf(details),
  }
  return { health, tier, grafts, marks, scene: sceneOf(tier, nightPhone), title: titleOf(health, grafts, hasRecord) }
}

// 기록이 없을 때의 기본 상태(앱 조각·상태 표시 없음). 내 모습 만들기 미리보기에 쓴다.
export const PLAIN_STATE = {
  tier: 'good',
  grafts: [],
  scene: 'park',
  title: '',
  marks: { slouch: false, raisePhone: false, spiral: false, darkCircles: false, glow: false, badges: 0, shoes: 'plain' },
}
