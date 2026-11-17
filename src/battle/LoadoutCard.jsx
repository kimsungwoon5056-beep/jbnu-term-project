import { useMemo } from 'react'
import PixelSprite from '../pixel/PixelSprite'
import './battle.css'
import { debuffLines, loadoutSprite, skillOf } from './loadout'

// 오늘의 대결 능력 카드: 캐릭터, 체력·속도·건강, 앱 기술, 디버프

function LoadoutCard({ loadout, compact = false }) {
  const skill = skillOf(loadout)
  const sprite = useMemo(() => loadoutSprite(loadout), [loadout])
  const debuffs = debuffLines(loadout.debuffs)
  return (
    <div className={compact ? 'loadout compact' : 'loadout'}>
      <PixelSprite sprite={sprite} label={`${loadout.name}의 캐릭터`} scale={compact ? 2 : 3} animate={!compact} />
      <div className="loadout-text">
        <p className="loadout-stats">
          <span>체력 {loadout.hp}</span>
          <span>속도 {loadout.speed}</span>
          <span>건강 {loadout.health}%</span>
        </p>
        <p>
          <strong>Q {skill.name}</strong> <span className="muted">{skill.desc}</span>
        </p>
        {!compact && (
          <ul className="debuffs">
            {debuffs.length ? debuffs.map((line) => <li key={line}>{line}</li>) : <li className="good">디버프 없음</li>}
          </ul>
        )}
      </div>
    </div>
  )
}

export default LoadoutCard
