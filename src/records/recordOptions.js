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
