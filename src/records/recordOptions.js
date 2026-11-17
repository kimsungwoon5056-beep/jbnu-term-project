// 운동 종류는 몬스터 유전자(다리·팔·꼬리)에 쓰이는 세 갈래로 묶는다.
export const WORKOUT_TYPES = {
  running: { label: '달리기', category: 'cardio' },
  walking: { label: '걷기', category: 'cardio' },
  cycling: { label: '자전거', category: 'cardio' },
  swimming: { label: '수영', category: 'cardio' },
  strength: { label: '근력', category: 'power' },
  climbing: { label: '클라이밍', category: 'power' },
  ball: { label: '구기', category: 'power' },
  yoga: { label: '요가', category: 'flex' },
  stretching: { label: '스트레칭', category: 'flex' },
}

// 스마트폰 사용 종류. ios는 아이폰 스크린 타임의 카테고리 이름(캡처 읽기에 쓴다).
export const PHONE_CATEGORIES = {
  sns: { label: '소셜', ios: ['소셜 미디어', '소셜 네트워킹'] },
  video: { label: '영상·엔터', ios: ['엔터테인먼트'] },
  game: { label: '게임', ios: ['게임'] },
  study: { label: '공부·생산성', ios: ['교육', '정보 및 도서', '생산성 및 금융', '생산성'] },
  creative: { label: '창작', ios: ['크리에이티비티'] },
  shopping: { label: '쇼핑·음식', ios: ['쇼핑 및 음식'] },
  other: { label: '기타', ios: ['유틸리티', '건강 및 피트니스', '여행', '기타'] },
}

export const PHONE_LIMITS = {
  maxMinutes: 24 * 60,
  categorySlack: 5, // 종류별 합이 총 시간을 넘어도 되는 오차(분). 캡처 반올림 때문
  maxPickups: 1000,
  maxNotifications: 3000,
  maxSteps: 100000,
  maxApps: 3,
  maxAppCount: 3000,
}

// 자주 쓰는 과목 태그. 이 밖의 과목도 직접 입력할 수 있다.
export const SUGGESTED_SUBJECTS = ['코딩', '수학', '영어', '과학', '예술']

export const LIMITS = {
  sleepMaxMinutes: 16 * 60,
  dailyMaxMinutes: 600,
  maxEntries: 10,
  maxCustomHabits: 5,
  maxNameLength: 20,
  maxMeals: 5,
  createWindowDays: 1,
  editWindowDays: 7,
}

export const MOOD_RANGE = { min: 1, max: 5 }
