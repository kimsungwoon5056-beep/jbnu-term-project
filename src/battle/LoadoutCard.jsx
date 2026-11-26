import { useMemo } from 'react'
import { lookKeyOf } from '../character/appLook'
import PixelSprite from '../pixel/PixelSprite'
import AppIcon from '../ui/AppIcon'
import PixelIcon from '../ui/PixelIcon'
import './battle.css'
import { farOf } from './farSkills'
import { BASE_HP, BASE_SPEED, debuffLines, loadoutSprite, skillOf, SNEAKER_BONUS } from './loadout'
import { weaponOf } from './melee'

// 오늘의 대결 능력 카드: 캐릭터, 체력·속도·건강 게이지, 무기(근접 연속기)·Q 근접 기술·E 원거리 기술, 디버프

// 게이지 하나: 값이 차오르며 나타난다.
function Gauge({ icon, label, value, text, min, max, tone }) {
  const percent = Math.round(Math.min(100, Math.max(6, ((value - min) / (max - min)) * 100)))
  return (
    <div className={`gauge gauge-${tone}`}>
      <span className="gauge-label">
        <PixelIcon name={icon} /> {label}
      </span>
      <span className="gauge-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
      <strong>{text ?? value}</strong>
    </div>
  )
}

function LoadoutCard({ loadout, compact = false }) {
  const skill = skillOf(loadout)
  const weapon = weaponOf(loadout.skill)
  const far = farOf(loadout.skill)
  const sprite = useMemo(() => loadoutSprite(loadout), [loadout])
  const debuffs = debuffLines(loadout.debuffs)
  const hair = loadout.grafts?.find((graft) => graft.slot === 'hair')
  return (
    <div className={compact ? 'loadout compact' : 'loadout'}>
      <div className="loadout-stage">
        <PixelSprite sprite={sprite} label={`${loadout.name}의 캐릭터`} scale={compact ? 2 : 3} animate={!compact} />
      </div>
      <div className="loadout-text">
        <Gauge icon="heart" label="체력" value={loadout.hp} min={BASE_HP - 20} max={BASE_HP + 40} tone="hp" />
        <Gauge icon="shoe" label="속도" value={loadout.speed} min={BASE_SPEED * 0.6} max={BASE_SPEED * SNEAKER_BONUS} tone="speed" />
        <Gauge icon="phone" label="건강" value={loadout.health} text={`${loadout.health}%`} min={0} max={100} tone="health" />
        <p className="loadout-skill">
          <PixelIcon name="sword" scale={2} />
          <span>
            <strong>무기 {weapon.name}</strong> <span className="muted">{weapon.desc}</span>
          </span>
        </p>
        <p className="loadout-skill">
          {hair && loadout.skill !== 'unrecorded' ? <AppIcon look={lookKeyOf(hair)} size={26} /> : <PixelIcon name={loadout.skill === 'detox' ? 'shield' : 'egg'} scale={2} />}
          <span>
            <strong>Q {skill.name}</strong> <span className="muted">{skill.desc}</span>
          </span>
        </p>
        <p className="loadout-skill">
          <PixelIcon name="phone" scale={2} />
          <span>
            <strong>E {far.name}</strong> <span className="muted">{far.desc} · {far.cooldown}초마다</span>
          </span>
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
