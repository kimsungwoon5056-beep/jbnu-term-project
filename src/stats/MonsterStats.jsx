import { useEffect, useState } from 'react'
import { addDays } from '../records/dateKey'
import { countRecordsUntil, listRecordsBetween } from '../records/recordStore'
import { buildGenome } from '../monster/genome'
import PixelSprite from '../monster/PixelSprite'
import { drawMonster } from '../monster/pixel/drawMonster'
import { speciesName } from '../monster/naming'
import { buildLoadout } from '../monster/skills'
import SkillSlots from '../monster/SkillSlots'
import { timeOfDay } from '../ui/icons'
import Loading from '../ui/Loading'
import PixelIcon from '../ui/PixelIcon'
import { computeMetrics, METRIC_LABELS } from './metrics'
import { computeStats, STAT_KEYS, STAT_LABELS, STAT_MAX } from './stats'

const STREAK_LOOKBACK_DAYS = 14
const STAT_SEGMENTS = 10 // HP 바처럼 10칸
const STAT_ICONS = { hp: 'heart', atk: 'sword', spd: 'boot', skill: 'star', def: 'shield' }

// 어제까지의 기록으로 계산한 "내 몬스터" 능력치 카드
function MonsterStats({ uid, todayKey }) {
  const [state, setState] = useState({ status: 'loading' })
  // 무대 하늘: 화면을 연 시각(한국 시간)의 아침·낮·저녁·밤
  const [sky] = useState(() => timeOfDay(new Date()))
  const endKey = addDays(todayKey, -1)

  useEffect(() => {
    let active = true
    Promise.all([
      listRecordsBetween(uid, addDays(endKey, -(STREAK_LOOKBACK_DAYS - 1)), endKey),
      countRecordsUntil(uid, endKey),
    ]).then(([recent, count]) => {
      if (!active) return
      if (!recent.ok || !count.ok) {
        setState({ status: 'error', message: recent.ok ? count.message : recent.message })
        return
      }
      const { metrics, details, recordedDays } = computeMetrics(recent.records, endKey)
      const result = computeStats(metrics, recordedDays, count.count)
      const genome = buildGenome(uid, metrics, details, result.growth)
      setState({
        status: 'ready',
        metrics,
        result,
        sprite: drawMonster(genome),
        name: speciesName(genome, metrics),
        anatomy: genome.life?.anatomy ?? null,
        loadout: genome.life ? buildLoadout(genome.life) : null,
      })
    })
    return () => {
      active = false
    }
  }, [uid, endKey])

  if (state.status === 'loading') return <Loading text="몬스터를 깨우고 있어요…" />
  if (state.status === 'error') {
    return (
      <p className="form-error" role="alert">
        {state.message}
      </p>
    )
  }

  const { metrics, result, sprite, name, anatomy, loadout } = state
  const { growth, total, stats, style, consistency } = result

  return (
    <>
      <section className="monster-card" aria-label="내 몬스터">
        <div className="monster-head">
          <h2>내 몬스터</h2>
          <span className="badge">{growth.label}</span>
          {growth.stage !== 'egg' && <span className="badge">{style}</span>}
        </div>
        <div className={`monster-figure sky-${sky}`}>
          <div className="stage">
            <PixelSprite sprite={sprite} label={`${name} (${growth.label})`} scale={4} />
          </div>
          <p className="monster-name">
            <span>{name}</span>
          </p>
        </div>
        {growth.stage === 'egg' && <p className="muted">하루만 기록해도 내일 알이 깨어나요. 깨어나면 부위에 따라 기술이 생겨요.</p>}
        <p className="muted summary-line">
          총합 <strong>{total}</strong> · 꾸준함 <strong>{Math.round(consistency * 100)}%</strong> · 어제까지의 기록으로 계산해요.
        </p>
      </section>

      <section className="panel" aria-label="능력치">
        <h3 className="panel-title">
          <PixelIcon name="heart" /> 능력치
        </h3>
        <ul className="stat-bars">
          {STAT_KEYS.map((key) => (
            <li key={key}>
              <PixelIcon name={STAT_ICONS[key]} />
              <span className="stat-name">{STAT_LABELS[key]}</span>
              <span className={`stat-track stat-${key}`} aria-hidden="true">
                {Array.from({ length: STAT_SEGMENTS }, (_, i) => (
                  <span key={i} className={i < Math.round((stats[key] / STAT_MAX) * STAT_SEGMENTS) ? 'seg on' : 'seg'} />
                ))}
              </span>
              <span className="stat-value">{stats[key]}</span>
            </li>
          ))}
        </ul>
      </section>

      {loadout && <SkillSlots loadout={loadout} anatomy={anatomy} />}

      <details className="panel metric-details">
        <summary className="panel-title">
          <PixelIcon name="book" /> 생활 지표 보기
        </summary>
        <ul className="metric-list">
          {Object.entries(METRIC_LABELS).map(([key, label]) => (
            <li key={key}>
              <span>{label}</span>
              <span>{Math.round(metrics[key] * 100)}%</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}

export default MonsterStats
