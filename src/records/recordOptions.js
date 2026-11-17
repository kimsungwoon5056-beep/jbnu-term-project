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

export const LIMITS = {
  maxNameLength: 20,
  createWindowDays: 1,
  editWindowDays: 7,
}
