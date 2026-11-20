// 불러오기 실패 안내 + 다시 불러오기 버튼(실패를 숨기지 않고, 새로고침 없이 다시 시도할 수 있게)
function LoadError({ message, onRetry }) {
  return (
    <div className="panel load-error" role="alert">
      <p className="form-error">{message}</p>
      {onRetry && (
        <button type="button" className="secondary" onClick={onRetry}>
          다시 불러오기
        </button>
      )}
    </div>
  )
}

export default LoadError
