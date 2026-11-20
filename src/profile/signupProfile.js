// 가입 2단계에서 고른 모습. 계정이 만들어지면 로그인 화면이 바로 바뀌므로, 저장은 로그인 뒤(ProfileGate)에 한다.
let pendingProfile = null

export function rememberSignupProfile(profile) {
  pendingProfile = profile
}

export function takeSignupProfile() {
  const profile = pendingProfile
  pendingProfile = null
  return profile
}
