import PixelSprite from '../monster/PixelSprite'
import { iconSprite } from './icons'

// 꾸밈용 도트 아이콘(스크린리더는 읽지 않는다)
function PixelIcon({ name, scale = 2, className = '' }) {
  return <PixelSprite sprite={iconSprite(name)} label="" scale={scale} animate={false} className={`pixel-icon ${className}`} />
}

export default PixelIcon
