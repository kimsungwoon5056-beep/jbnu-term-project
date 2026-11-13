import { useEffect, useState } from 'react'
import { addDays } from '../records/dateKey'
import { countRecordsUntil, listRecordsBetween } from '../records/recordStore'
import { buildGenome } from '../monster/genome'
import PixelSprite from '../monster/PixelSprite'
import { drawMonster } from '../monster/pixel/drawMonster'
import { speciesName } from '../monster/naming'
import { computeMetrics, METRIC_LABELS } from './metrics'
import { computeStats, STAT_KEYS, STAT_LABELS, STAT_MAX } from './stats'

const STREAK_LOOKBACK_DAYS = 14

// 어제까지의 기록으로 계산한 "내 몬스터" 능력치 카드
function MonsterStats({ uid, todayKey }) {
  const [state, setState] = useState({ status: 'loading' })
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
      setState({ status: 'ready', metrics, result, sprite: drawMonster(genome), name: speciesName(genome, metrics) })
    })
    return () => {
      active = false
    }
  }, [uid, endKey])

  if (state.status === 'loading') return <p className="muted">몬스터 능력치를 계산하고 있습니다…</p>
  if (state.status === 'error') {
    return (
      <p className="form-error" role="alert">
        {state.message}
      </p>
    )
  }

  const { metrics, result, sprite, name } = state
  const { growth, total, stats, style, consistency } = result

  return (
    <section className="monster-card" aria-label="내 몬스터 능력치">
      <div className="monster-head">
        <h2>내 몬스터</h2>
        <span className="badge">{growth.label}</span>
        {growth.stage !== 'egg' && <span className="badge">{style}</span>}
      </div>
      <div className="monster-figure">
        <PixelSprite sprite={sprite} label={`${name} (${growth.label})`} scale={4} />
        <p className="monster-name">{name}</p>
      </div>
      {growth.stage === 'egg' && <p className="muted">하루만 기록해도 내일 알이 깨어나요.</p>}
      <p className="muted">
        총합 {total} · 꾸준함 {Math.round(consistency * 100)}% · 어제까지의 기록으로 계산해요. 오늘 기록은 내일 반영돼요.
      </p>
      <ul className="stat-bars">
        {STAT_KEYS.map((key) => (
          <li key={key}>
            <span className="stat-name">{STAT_LABELS[key]}</span>
            <span className="stat-track" aria-hidden="true">
              <span className="stat-fill" style={{ width: `${(stats[key] / STAT_MAX) * 100}%` }} />
            </span>
            <span className="stat-value">{stats[key]}</span>
          </li>
        ))}
      </ul>
      <details className="metric-details">
        <summary>생활 지표 보기</summary>
        <ul className="metric-list">
          {Object.entries(METRIC_LABELS).map(([key, label]) => (
            <li key={key}>
              <span>{label}</span>
              <span>{Math.round(metrics[key] * 100)}%</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

export default MonsterStats
