import { APP_ICONS, appIconOf, ARCHETYPES, archetypeOfApp, archetypeOfCategory } from '../capture/appArchetypes'
import { categoryOfApp } from '../capture/appCategories'

// 앱 조각: 많이 쓴 앱이 캐릭터의 머리·옷·손에 스며든다. 폰을 줄이면 하나씩 사라진다.
// 스마트폰 기록(입력값 그대로)만으로 정한다. 같은 사용이면 누구나 같은 조각이다.

export const GRAFT_SLOTS = ['hair', 'outfit', 'hand']
export const GRAFT_SLOT_LABELS = { hair: '머리', outfit: '옷', hand: '손' }
// 하루 평균 화면 시간(분)이 이 값 이상이면 조각이 1·2·3개
export const GRAFT_STEPS = [90, 180, 300]
// 앱 목록 밖에서 하루 10분 이상 쓴 종류만 조각 후보로 본다.
const MIN_LEFTOVER = 10

export function graftCount(dailyMinutes) {
  return GRAFT_STEPS.filter((minutes) => dailyMinutes >= minutes).length
}

// 조각 이름: 전용 아이콘이 있으면 "카톡", 없으면 유형 모양("말풍선")
export function graftLabel(graft) {
  return graft.icon ? APP_ICONS[graft.icon].label : ARCHETYPES[graft.archetype].head
}

// details: computeMetrics의 details. 스마트폰을 입력하지 않았으면 조각이 없다.
export function chooseGrafts(details) {
  const raw = details.raw
  if (!details.known?.phone || !raw) return []
  const count = graftCount(raw.phoneTotal)
  if (count === 0) return []
  const days = Math.max(1, raw.phoneDays)

  // 1) 앱 목록(7일 합)을 유형별로 묶는다. 같은 유형은 하나로(카톡·디스코드 → 메신저 한 조각).
  const byArchetype = new Map()
  for (const app of raw.topApps ?? []) {
    const archetype = archetypeOfApp(app.name)
    if (!archetype) continue
    const entry = byArchetype.get(archetype) ?? { archetype, minutes: 0, apps: [], icon: null }
    entry.minutes += app.minutes / days
    entry.apps.push(app.name)
    entry.icon ??= appIconOf(app.name)
    byArchetype.set(archetype, entry)
  }
  const fromApps = [...byArchetype.values()].sort((a, b) => b.minutes - a.minutes || a.archetype.localeCompare(b.archetype))

  // 2) 앱 목록으로 못 채운 자리는 종류별 시간 순서로 채운다. 앱 목록에서 이미 센 시간은 그 종류에서 뺀다.
  const counted = {}
  for (const app of raw.topApps ?? []) counted[categoryOfApp(app.name)] = (counted[categoryOfApp(app.name)] ?? 0) + app.minutes / days
  const fromCategories = new Map()
  for (const [category, total] of Object.entries(raw.phoneCategories ?? {})) {
    const archetype = archetypeOfCategory(category)
    const minutes = total - (counted[category] ?? 0)
    if (!archetype || minutes < MIN_LEFTOVER || byArchetype.has(archetype)) continue
    const entry = fromCategories.get(archetype) ?? { archetype, minutes: 0, apps: [], icon: null }
    entry.minutes += minutes
    fromCategories.set(archetype, entry)
  }
  const rest = [...fromCategories.values()].sort((a, b) => b.minutes - a.minutes || a.archetype.localeCompare(b.archetype))

  return [...fromApps, ...rest].slice(0, count).map((entry, i) => ({
    slot: GRAFT_SLOTS[i],
    archetype: entry.archetype,
    icon: entry.icon,
    apps: entry.apps,
    minutes: Math.round(entry.minutes),
  }))
}
