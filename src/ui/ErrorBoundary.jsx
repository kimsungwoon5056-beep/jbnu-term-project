import { Component } from 'react'
import { errorText } from './errorText'

// 오류 경계: 아래 화면이 그리다 터지거나, 열 때 불러오는 화면 묶음(대결장)을 받지 못해도 빈 화면 대신 이유와 다시 시도를 보여 준다.
// 저장은 각 화면이 끝난 것만 서버에 남으므로, 여기서는 "무엇이 실패했는지"만 알리고 성공처럼 보이게 하지 않는다.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.retry = () => {
      this.props.onReset?.()
      this.setState({ error: null })
    }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('화면 오류', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="notice" role="alert">
        <p className="form-error">{errorText(this.state.error)}</p>
        <p className="form-actions">
          <button type="button" onClick={this.retry}>
            다시 시도
          </button>
          <button type="button" className="secondary" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </p>
      </div>
    )
  }
}
