import { useState } from 'react'
import { logOut as signOut } from '../auth/authService'
import { rememberSignupProfile } from '../profile/signupProfile'

// 프로필을 못 불러왔거나 아직 없을 때의 로그아웃. 가입 중 기억해 둔 모습이 다른 계정에 저장되지 않게 지우고, 실패하면 이유를 보여 준다.
export default function LogoutButton({ logOut = signOut, forget = () => rememberSignupProfile(null) }) {
  const [message, setMessage] = useState('')
  async function leave() {
    forget()
    const result = await logOut()
    setMessage(result.ok ? '' : result.message)
  }
  return (
    <>
      <button type="button" className="secondary" onClick={leave}>
        로그아웃
      </button>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </>
  )
}
