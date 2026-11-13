import { PART_FAMILIES } from './anatomy'
import { SKILL_KINDS } from './skills'

// 장착 기술 5칸(Q·E·패시브·체질·보조)과 세트 효과. 칸을 누르면 설명이 펼쳐진다.
function SkillSlots({ loadout, anatomy }) {
  const slots = [
    ['Q', loadout.q],
    ['E', loadout.e],
    ['패시브', loadout.passive],
    ['체질', loadout.trait],
    ['보조', loadout.assist],
  ]
  const sourceOf = (skill) => (skill.from === 'horn' ? '과목 뿔' : PART_FAMILIES[skill.from][anatomy[skill.from].kind])

  return (
    <section className="skills" aria-label="기술">
      <h3>기술</h3>
      <ul className="skill-slots">
        {slots.map(([key, skill]) => (
          <li key={key}>
            {skill ? (
              <details className="skill">
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
