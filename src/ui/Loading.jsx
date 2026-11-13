import PixelIcon from './PixelIcon'

// 불러오는 중: 통통 튀는 도트 알 + 안내 글
function Loading({ text }) {
  return (
    <p className="loading" role="status">
      <PixelIcon name="egg" className="bounce" />
      <span>{text}</span>
    </p>
  )
}

export default Loading
