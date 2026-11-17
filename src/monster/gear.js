// 장비: 가장 많이 쓴 앱 종류가 몬스터 몸에 "눈으로 보이게" 붙는다.
// 부위 조립(키메라)과 달리 계정별 치우침 없이 생활 숫자만으로 정한다. 같은 사용이면 누구나 같은 장비가 붙는다.

export const GEAR = {
  none: { label: '없음' },
  heartPhone: { label: '하트 폰', prefix: '하트폰', category: 'sns', desc: '소셜 앱을 많이 쓰면 하트 말풍선이 뜬 폰을 손에 쥔다.' },
  headphones: { label: '헤드폰', prefix: '헤드폰', category: 'video', desc: '영상·음악을 많이 보면 헤드폰을 쓴다.' },
  gamepad: { label: '게임패드', prefix: '게임패드', category: 'game', desc: '게임을 많이 하면 게임패드를 쥔다.' },
  glasses: { label: '안경', prefix: '안경 쓴', category: 'study', desc: '공부·생산성 앱을 많이 쓰면 안경을 쓴다.' },
  camera: { label: '카메라', prefix: '카메라', category: 'creative', desc: '사진·창작 앱을 많이 쓰면 카메라를 든다.' },
  shoppingBag: { label: '쇼핑백', prefix: '쇼핑백', category: 'shopping', desc: '쇼핑·배달 앱을 많이 쓰면 쇼핑백을 든다.' },
  phone: { label: '스마트폰', prefix: '폰 든', category: 'other', desc: '화면 시간이 길면 폰을 손에서 놓지 못한다.' },
  sneakers: { label: '운동화', prefix: '운동화', desc: '많이 걸으면 운동화를 신는다.' },
}

const CATEGORY_GEAR = Object.fromEntries(
  Object.entries(GEAR)
    .filter(([, gear]) => gear.category)
    .map(([kind, gear]) => [gear.category, kind]),
)
const SHARE_KEYS = {
  sns: 'snsShare',
  video: 'videoShare',
  game: 'gameShare',
  study: 'studyAppShare',
  creative: 'creativeShare',
  shopping: 'shoppingShare',
}

// 기준: 화면 시간이 하루 약 2시간(phoneTotal 0.15) 이상이고, 한 종류가 30% 이상이면 그 종류의 장비.
// 종류가 고르게 퍼졌으면 그냥 스마트폰. 폰을 적게 쓰고 많이 걸으면(8,000보 이상) 운동화.
export const GEAR_RULES = { minPhoneTotal: 0.15, minShare: 0.3, minSteps: 0.6 }

export function chooseGear(m, known = {}) {
  if (known.phone && m.phoneTotal >= GEAR_RULES.minPhoneTotal) {
    const [category, share] = Object.entries(SHARE_KEYS)
      .map(([key, metric]) => [key, m[metric] ?? 0])
      .sort((a, b) => b[1] - a[1])[0]
    if (share >= GEAR_RULES.minShare) return { kind: CATEGORY_GEAR[category], category }
    return { kind: 'phone', category: 'other' }
  }
  if (known.steps && m.steps >= GEAR_RULES.minSteps) return { kind: 'sneakers', category: null }
  return { kind: 'none', category: null }
}

// 상태 표시: 알림 배지(0~2), 산만함 떨림(화면 깨우기), 거북목(화면 시간, 0~2칸)
export function phoneStatus(m, known = {}) {
  if (!known.phone) return { badge: 0, jitter: false, slouch: 0 }
  return {
    badge: m.notifications >= 0.6 ? 2 : m.notifications >= 0.25 ? 1 : 0,
    jitter: m.pickups >= 0.4,
    slouch: m.phoneTotal >= 0.6 ? 2 : m.phoneTotal >= 0.35 ? 1 : 0,
  }
}
