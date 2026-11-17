import { appIconOf, archetypeOfApp } from '../capture/appArchetypes'

// 스크린 타임 앱 막대 한 줄: 많이 쓴 앱(하루 평균, 분) + 나머지는 "기타"
// 막대 조각 = { name, type(앱 색 종류), minutes }. 합이 화면 시간보다 크면(입력 오차) 기타는 없다.
export function usageSegments(raw, limit = 3) {
  const days = Math.max(1, raw.phoneDays ?? 1)
  const apps = (raw.topApps ?? [])
    .slice(0, limit)
    .map((app) => ({ name: app.name, type: appIconOf(app.name) ?? archetypeOfApp(app.name) ?? 'other', minutes: Math.round(app.minutes / days) }))
    .filter((app) => app.minutes > 0)
  const rest = (raw.phoneTotal ?? 0) - apps.reduce((total, app) => total + app.minutes, 0)
  return rest > 0 ? [...apps, { name: '기타', type: 'other', minutes: rest }] : apps
}
