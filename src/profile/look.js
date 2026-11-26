// 나를 닮은 기본 캐릭터: 가입할 때 고르는 모습(언제든 고칠 수 있다).
// 그림에 쓰는 것만 받는다. 실명·생년월일·키·몸무게는 받지 않는다.
// 같은 모습 + 같은 사용이면 누구나 같은 캐릭터다(계정 ID는 그림에 쓰지 않는다).

export const LOOK_OPTIONS = {
  skin: {
    label: '피부색',
    choices: {
      light: { label: '밝은', color: '#ffe3cf', shade: '#f2c3a5' },
      fair: { label: '보통', color: '#f7cfa8', shade: '#e2a97f' },
      tan: { label: '구릿빛', color: '#d9a073', shade: '#b97c50' },
      deep: { label: '짙은', color: '#9c6644', shade: '#7a4b2f' },
    },
  },
  hairStyle: {
    label: '머리 모양',
    choices: {
      short: { label: '짧은 머리' },
      bangs: { label: '앞머리' },
      side: { label: '옆 가르마' },
      bob: { label: '단발' },
      long: { label: '긴 머리' },
      ponytail: { label: '묶은 머리' },
      curly: { label: '곱슬' },
      buzz: { label: '아주 짧게' },
    },
  },
  hairColor: {
    label: '머리색',
    choices: {
      black: { label: '검정', color: '#2b2730' },
      brown: { label: '짙은 갈색', color: '#5a3a26' },
      chestnut: { label: '밝은 갈색', color: '#9a6236' },
      blonde: { label: '금발', color: '#e3bd62' },
      ash: { label: '애쉬 회색', color: '#9aa0ab' },
    },
  },
  glasses: {
    label: '안경',
    choices: {
      none: { label: '없음' },
      round: { label: '동그란 안경' },
      square: { label: '네모 안경' },
    },
  },
}

export const LOOK_KEYS = Object.keys(LOOK_OPTIONS)
export const NICKNAME_RANGE = { min: 2, max: 10 }

export const DEFAULT_LOOK = { skin: 'fair', hairStyle: 'short', hairColor: 'black', glasses: 'none' }

// 모르는 값은 기본값으로(예전 버전·잘못 저장된 값 대비)
export function normalizeLook(look) {
  return Object.fromEntries(
    LOOK_KEYS.map((key) => [key, LOOK_OPTIONS[key].choices[look?.[key]] ? look[key] : DEFAULT_LOOK[key]]),
  )
}

// 닉네임: 대결에서 상대에게 보인다. 2~10자, 앞뒤 공백 제외
export function validateNickname(value) {
  const name = typeof value === 'string' ? value.trim() : ''
  // 글자 수는 보안 규칙의 size()처럼 UTF-16 단위로 센다(이모지 하나 = 2). 둘이 다르게 세면 앱은 되는데 서버가 거절한다.
  if (name.length < NICKNAME_RANGE.min || name.length > NICKNAME_RANGE.max) {
    return `닉네임은 ${NICKNAME_RANGE.min}~${NICKNAME_RANGE.max}자로 입력해 주세요.`
  }
  return null
}

// 프로필 검사. 문제가 있는 항목만 { 항목: 안내 문구 }
export function validateProfile(profile) {
  const errors = {}
  const nicknameError = validateNickname(profile?.nickname)
  if (nicknameError) errors.nickname = nicknameError
  for (const key of LOOK_KEYS) {
    if (!LOOK_OPTIONS[key].choices[profile?.look?.[key]]) errors[key] = `${LOOK_OPTIONS[key].label}을(를) 골라 주세요.`
  }
  return errors
}
