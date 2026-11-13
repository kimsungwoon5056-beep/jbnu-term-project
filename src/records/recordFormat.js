import { daysBetween, weekdayOf } from './dateKey'

export const MOODS = [
  { value: 1, face: '😫', label: '아주 나쁨' },
  { value: 2, face: '😕', label: '나쁨' },
  { value: 3, face: '😐', label: '보통' },
  { value: 4, face: '🙂', label: '좋음' },
  { value: 5, face: '😄', label: '아주 좋음' },
]

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 450 → "7시간 30분", 60 → "1시간", 0 → "0분"
export function formatMinutes(total) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}분`
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`
}

// "2026-11-14" → "11월 14일 (토) · 오늘"
export function formatDateLabel(dateKey, todayKey) {
  const [, month, day] = dateKey.split('-').map(Number)
  const base = `${month}월 ${day}일 (${WEEKDAYS[weekdayOf(dateKey)]})`
  const age = daysBetween(dateKey, todayKey)
  if (age === 0) return `${base} · 오늘`
  if (age === 1) return `${base} · 어제`
  return base
}
