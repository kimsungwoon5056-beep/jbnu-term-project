import { appIconOf, ARCHETYPES, archetypeOfApp } from '../capture/appArchetypes'
import { formatMinutes } from '../records/recordFormat'
import { featuredPart } from './reasons'

// 잠금 화면 알림: 부위 설명(explainParts)을 잠금 화면 푸시 알림처럼 보여 준다.
// 알림 한 장 = { key, title, sender, icon, headline, effect, loud, reason, next, highlight }
//   sender: 알림을 보낸 쪽(앱 이름·"걸음" 등), headline: "Instagram · 2시간 38분"·"걸음 38보", effect: "머리에 스며들었어요"
//   icon: { dot: 앱 색 종류 } 또는 { pixel: 아이콘 이름 }, loud: 오늘 눈에 띄게 바뀐 부위인지
// 순서: 처음 보여 줄 부위(featuredPart) → 바뀐 부위 → 그대로인 부위(부위 설명 순서 그대로)

export const VISIBLE_NOTICES = 3 // 처음에 펼쳐 둘 알림 수, 나머지는 "알림 N개 더"

const count = (value) => value.toLocaleString('ko-KR')

function appsOf(graft) {
  return graft.apps.length ? graft.apps.join('·') : `${ARCHETYPES[graft.archetype].label} 앱`
}

function dotOf(graft) {
  const name = graft.apps[0]
  return (name && (appIconOf(name) ?? archetypeOfApp(name))) || graft.archetype || 'other'
}

function graftNotice(state, slot) {
  const graft = state.grafts.find((item) => item.slot === slot)
  if (!graft) return null
  const effect = {
    hair: '머리에 스며들었어요',
    outfit: '후드티가 됐어요',
    hand: state.marks.raisePhone ? '폰을 얼굴 옆까지 들었어요' : '손에 폰이 들렸어요',
  }[slot]
  return { sender: appsOf(graft), value: formatMinutes(graft.minutes), effect, icon: { dot: dotOf(graft) }, loud: true }
}

// 부위마다 알림의 보낸 쪽·숫자·바뀐 점
function noticeOf(entry, state, details) {
  const { raw, known } = details
  const { marks, health, tier } = state
  const measured = health.measured !== false
  const phoneTime = known.phone ? formatMinutes(raw.phoneTotal) : '기록 없음'
  const healthValue = measured ? `${health.percent}%` : '?%'
  switch (entry.key) {
    case 'hair':
    case 'outfit':
    case 'hand':
      return graftNotice(state, entry.key) ?? { sender: '화면 시간', value: phoneTime, effect: entry.label, icon: { pixel: 'phone' }, loud: false }
    case 'badge':
      return {
        sender: '알림',
        value: `${count(raw.notifications)}개`,
        effect: marks.badges ? `머리 위 배지 ${marks.badges}개` : '배지 없음',
        icon: { pixel: 'bell' },
        loud: marks.badges > 0,
      }
    case 'eyes':
      return marks.spiral
        ? { sender: '화면 깨우기', value: `${count(raw.pickups)}번`, effect: entry.label, icon: { pixel: 'phone' }, loud: true }
        : { sender: '디지털 건강', value: healthValue, effect: entry.label, icon: { pixel: 'heart' }, loud: measured && tier !== 'mid' }
    case 'undereye':
      return { sender: '밤 폰', value: raw.firstPickup ? `${raw.firstPickup}에 깨움` : '밤 0~4시', effect: entry.label, icon: { pixel: 'moon' }, loud: true }
    case 'face':
      return { sender: '디지털 건강', value: healthValue, effect: entry.label, icon: { pixel: 'heart' }, loud: measured && (tier !== 'mid' || marks.glow) }
    case 'posture':
      return { sender: '화면 시간', value: phoneTime, effect: entry.label, icon: { pixel: 'phone' }, loud: marks.slouch }
    case 'shoes':
      return {
        sender: '걸음',
        value: known.steps ? `${count(raw.steps)}보` : '기록 없음',
        effect: entry.label,
        icon: { pixel: 'foot' },
        loud: marks.shoes !== 'plain',
      }
    case 'scene':
      return { sender: '디지털 건강', value: healthValue, effect: `배경: ${entry.label}`, icon: { pixel: 'star' }, loud: measured && state.scene !== 'home' }
    default:
      return { sender: entry.title, value: '', effect: entry.label, icon: { pixel: 'sparkle' }, loud: false }
  }
}

export function lockNotices(entries, state, details) {
  const notices = entries.map((entry) => {
    const { sender, value, effect, icon, loud } = noticeOf(entry, state, details)
    return {
      key: entry.key,
      title: entry.title,
      sender,
      icon,
      // 앱이 보낸 알림은 "Instagram · 2시간 38분", 나머지는 "알림 131개"·"걸음 38보"
      headline: value ? `${sender}${icon.dot ? ' · ' : ' '}${value}` : sender,
      effect,
      loud,
      reason: entry.reason,
      next: entry.next,
      highlight: entry.highlight,
    }
  })
  const first = featuredPart(entries, state)
  // 같은 제목(예: "디지털 건강 97%")이 앞에 또 있으면 그대로인 부위처럼 뒤로 보낸다(앞 알림이 겹치지 않게).
  const firstHeadline = notices.find((notice) => notice.key === first)?.headline
  const seen = new Set([firstHeadline])
  const loudRank = new Map(
    notices
      .filter((notice) => notice.key !== first && notice.loud)
      .map((notice) => {
        const repeat = seen.has(notice.headline)
        seen.add(notice.headline)
        return [notice.key, repeat ? 2 : 1]
      }),
  )
  const rank = (notice) => (notice.key === first ? 0 : (loudRank.get(notice.key) ?? 2))
  // sort는 안정 정렬이라 같은 무리 안에서는 부위 설명 순서가 유지된다.
  return notices.sort((a, b) => rank(a) - rank(b))
}
