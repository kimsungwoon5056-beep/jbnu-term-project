import { addDays } from '../records/dateKey'

// 시연 인물 3명(설계안 3-5-2). endKey까지 7일치 스마트폰·걸음 기록과 모습(look)을 만든다.
// 테스트, 로그인 화면 타이틀, 견본 화면, 연습 대결의 봇에 같이 쓴다.

function week(endKey, makeDay) {
  return Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDays(endKey, index - 6)
    return { date: dateKey, phone: null, steps: null, ...makeDay(index) }
  })
}

// 스마트폰 사용 하루치. categories는 종류별 분, 나머지는 기타로 둔다.
export function phoneDay({ total, categories, pickups, firstPickup, notifications, topApps = [], pickupApps = [], notifyApps = [] }) {
  const all = { sns: 0, video: 0, game: 0, study: 0, creative: 0, shopping: 0, other: 0, ...categories }
  const used = Object.values(all).reduce((sum, minutes) => sum + minutes, 0)
  all.other += Math.max(0, total - used)
  return { total, categories: all, topApps, pickups, firstPickup, pickupApps, notifications, notifyApps }
}

// A. 새벽 게이머: 하루 5시간 반 넘게, 인스타·브롤스타즈·디스코드, 자정 넘어 폰을 깨움, 알림 200개 넘음, 걸음 2천
export function nightCoder(endKey) {
  return week(endKey, (i) => ({
    phone: phoneDay({
      total: 330 + i * 10,
      categories: { sns: 150, game: 110, video: 30, study: 25 },
      pickups: 130 + i * 3,
      firstPickup: `00:${String(5 + i * 7).padStart(2, '0')}`,
      notifications: 210 + i * 5,
      topApps: [
        { name: 'Instagram', minutes: 120 },
        { name: '브롤스타즈', minutes: 110 },
        { name: '디스코드', minutes: 30 },
      ],
      pickupApps: [{ name: 'Instagram', count: 40 }],
      notifyApps: [{ name: '디스코드', count: 120 }],
    }),
    steps: 2300 + i * 60,
  }))
}

// B. 아침 러너: 하루 1시간 20분, 공부 앱 위주, 아침에 처음 폰을 깨움, 걸음 1만
export function morningRunner(endKey) {
  return week(endKey, (i) => ({
    phone: phoneDay({
      total: 80,
      categories: { sns: 30, study: 35, video: 10 },
      pickups: 35,
      firstPickup: '06:45',
      notifications: 40,
      topApps: [{ name: '듀오링고', minutes: 30 }],
    }),
    steps: 10500 + i * 150,
  }))
}

// C. 유튜브 정주행: 평일 4시간, 주말 7시간 유튜브·쿠팡, 걸음 3천~5천
export function weekendRusher(endKey) {
  return week(endKey, (i) => {
    const weekend = i >= 5
    return {
      phone: phoneDay({
        total: weekend ? 420 : 240,
        categories: weekend ? { video: 240, sns: 80, shopping: 30 } : { video: 120, sns: 70, shopping: 20 },
        pickups: weekend ? 90 : 80,
        firstPickup: weekend ? '00:40' : '06:20',
        notifications: weekend ? 260 : 250,
        topApps: [
          { name: 'YouTube', minutes: weekend ? 200 : 110 },
          { name: '카카오톡', minutes: weekend ? 70 : 60 },
          { name: '쿠팡', minutes: 30 },
        ],
      }),
      steps: weekend ? 3000 : 5000,
    }
  })
}

export const PERSONAS = {
  nightCoder: {
    label: '새벽 게이머',
    nickname: '새벽게이머',
    make: nightCoder,
    look: { skin: 'light', hairStyle: 'bangs', hairColor: 'black', glasses: 'round' },
  },
  morningRunner: {
    label: '아침 러너',
    nickname: '아침러너',
    make: morningRunner,
    look: { skin: 'tan', hairStyle: 'ponytail', hairColor: 'brown', glasses: 'none' },
  },
  weekendRusher: {
    label: '유튜브 정주행',
    nickname: '정주행러',
    make: weekendRusher,
    look: { skin: 'fair', hairStyle: 'curly', hairColor: 'chestnut', glasses: 'square' },
  },
}
