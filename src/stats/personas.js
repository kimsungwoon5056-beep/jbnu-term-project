import { addDays, weekdayOf } from '../records/dateKey'

// 설계안 3-5-2의 시연용 인물 3명. endKey까지 7일치 기록을 만든다.
// 테스트와 시연 계정 데이터에 같이 쓴다.

const isWeekend = (dateKey) => [0, 6].includes(weekdayOf(dateKey))

function week(endKey, makeDay) {
  return Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDays(endKey, index - 6)
    return { date: dateKey, customHabits: [], ...makeDay(dateKey, index) }
  })
}

// A. 새벽 코더: 새벽 2~3시 취침·평균 5시간 20분, 코딩 주 14시간 + 수학 3시간, 야식 5일
export function nightCoder(endKey) {
  const beds = ['01:00', '03:30', '02:00', '00:40', '03:40', '01:30', '02:50']
  const wakes = ['06:20', '08:50', '07:20', '06:00', '09:00', '06:50', '08:10']
  return week(endKey, (_, i) => ({
    sleep: { bedTime: beds[i], wakeTime: wakes[i] },
    workouts: i === 3 ? [{ type: 'walking', minutes: 20 }] : [],
    studies: [
      { subject: '코딩', minutes: 120 },
      ...(i === 1 || i === 4 ? [{ subject: '수학', minutes: 90 }] : []),
    ],
    meals: { count: 2, lateSnack: i !== 2 && i !== 5 },
    mood: i === 4 ? 4 : 3,
  }))
}

// B. 아침 러너: 매일 23시 ±10분 취침·7시간 40분, 달리기 주 5회 × 40분, 영어 주 4시간, 기분 상승
export function morningRunner(endKey) {
  const beds = ['22:55', '23:05', '23:00', '23:10', '22:50', '23:00', '23:05']
  const moods = [3, 3, 4, 4, 4, 5, 5]
  return week(endKey, (_, i) => ({
    sleep: { bedTime: beds[i], wakeTime: '06:40' },
    workouts: i % 7 < 5 ? [{ type: 'running', minutes: 40 }] : [],
    studies: [{ subject: '영어', minutes: 35 }],
    meals: { count: 3, lateSnack: false },
    mood: moods[i],
    customHabits: [{ name: '스트레칭 5분', done: true }],
  }))
}

// C. 주말 몰아치기: 평일 6시간·주말 10시간, 주말에 근력 2시간·시험공부 5시간(과목 4개), 기분 변동 큼
export function weekendRusher(endKey) {
  const moods = [1, 5, 2, 5, 1, 4, 5]
  return week(endKey, (dateKey, i) =>
    isWeekend(dateKey)
      ? {
          sleep: { bedTime: '01:00', wakeTime: '11:00' },
          workouts: [{ type: 'strength', minutes: 120 }],
          studies: ['수학', '영어', '과학', '코딩'].map((subject) => ({ subject, minutes: 75 })),
          meals: { count: 3, lateSnack: true },
          mood: moods[i],
        }
      : {
          sleep: { bedTime: '00:30', wakeTime: '06:30' },
          workouts: [],
          studies: [],
          meals: { count: 2, lateSnack: false },
          mood: moods[i],
        },
  )
}

export const PERSONAS = { nightCoder, morningRunner, weekendRusher }
