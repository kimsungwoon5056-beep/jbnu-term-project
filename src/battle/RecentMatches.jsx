import LoadError from '../ui/LoadError'

// 최근 대결 5판. 불러오는 중·실패(다시 불러오기)·빈 목록을 구분해 보여 준다.
export function RecentMatches({ recent, onRetry }) {
  if (!recent) return <p className="muted">최근 대결을 불러오는 중…</p>
  if (!recent.ok) return <LoadError message={`최근 대결을 불러오지 못했어요. ${recent.message ?? ''}`.trim()} onRetry={onRetry} />
  if (recent.matches.length === 0) return <p className="muted">아직 대결 기록이 없어요. 연습 한 판으로 시작해 보세요.</p>
  return (
    <ul className="recent-matches" aria-label="최근 대결">
      {recent.matches.map((match) => (
        <li key={match.id}>
          <span className={match.rank === 1 ? 'rank-badge first' : 'rank-badge'}>{match.rank}위</span>
          <span className="recent-text">
            <strong>{match.mode === 'online' ? '온라인' : '연습'}</strong> {match.names.filter((_, i) => i !== match.rank - 1).join(', ')}
          </span>
          <span className="muted">{match.date.slice(5).replace('-', '.')}</span>
        </li>
      ))}
    </ul>
  )
}

export default RecentMatches
