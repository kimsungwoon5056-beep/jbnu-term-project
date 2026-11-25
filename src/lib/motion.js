import { useSyncExternalStore } from 'react'

// 움직임 설정: 고르지 않았으면 기기의 "동작 줄이기"를 따르고, 앱에서 켜거나 끄면 그것을 따른다(이 브라우저에만 기억).
// 윈도우의 "애니메이션 효과"를 꺼 둔 PC에서도 앱 안에서 켤 수 있게 한다.
const KEY = 'detox-pvp-motion'
const listeners = new Set()
const query = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null

function chosen() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function isReduced() {
  const choice = chosen()
  if (choice === 'on') return false
  if (choice === 'off') return true
  return Boolean(query()?.matches)
}

// CSS는 <html data-motion="reduce">를 보고 움직임을 멈춘다.
export function applyMotion() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.motion = isReduced() ? 'reduce' : 'full'
}

export function setMotionOn(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // 저장하지 못하면 기기 설정을 따른다.
  }
  applyMotion()
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  const media = query()
  const change = () => {
    applyMotion()
    listener()
  }
  media?.addEventListener?.('change', change)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener?.('change', change)
  }
}

export const useReducedMotion = () => useSyncExternalStore(subscribe, isReduced, () => false)
