import { PART_FAMILIES } from './anatomy'
import { GEAR } from './gear'
import PixelIcon from '../ui/PixelIcon'
import { SKILL_KINDS } from './skills'

// 기술 종류 → 색 띠 묶음(공격·보조·회복·패시브)
const KIND_GROUP = {
  projectile: 'attack',
  dash: 'attack',
  melee: 'attack',
  area: 'attack',
  trap: 'attack',
  buff: 'support',
  debuff: 'support',
  heal: 'heal',
  passive: 'passive',
}

// 장착 기술 6칸(Q·E·패시브·체질·보조·장비)과 세트 효과. 칸을 누르면 설명이 펼쳐진다.
function SkillSlots({ loadout, anatomy, gearKind = 'none' }) {
  const slots = [
    ['Q', loadout.q],
    ['E', loadout.e],
    ['패시브', loadout.passive],
    ['체질', loadout.trait],
    ['보조', loadout.assist],
    ['장비', loadout.gear],
  ]
  const sourceOf = (skill) => {
    if (skill.from === 'horn') return '과목 뿔'
    if (skill.from === 'gear') return `장비: ${GEAR[gearKind].label}`
    return PART_FAMILIES[skill.from][anatomy[skill.from].kind]
  }

  return (
    <section className="panel skills" aria-label="기술">
      <h3 className="panel-title">
        <PixelIcon name="sparkle" /> 기술
      </h3>
      <ul className="skill-slots">
        {slots.map(([key, skill]) => (
          <li key={key}>
            {skill ? (
              <details className={`skill kind-${KIND_GROUP[skill.kind]}`}>
                <summary>
                  <span className="skill-key">{key}</span>
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-kind">{SKILL_KINDS[skill.kind]}</span>
                </summary>
                <p>
                  {skill.desc}
                  {skill.cooldown > 0 && ` 재사용 ${skill.cooldown}초.`} <span className="muted">({sourceOf(skill)})</span>
                </p>
              </details>
            ) : (
              <div className="skill empty">
                <span className="skill-key">{key}</span>
                <span className="skill-name">없음</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {loadout.sets.length > 0 && (
        <ul className="set-bonuses">
          {loadout.sets.map((set) => (
            <li key={set.theme}>
              ★ {set.name}: {set.desc}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default SkillSlots
