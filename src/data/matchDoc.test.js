import { describe, expect, it } from 'vitest'
import { rankedNames } from './matchDoc'

// 최근 대결 목록은 names[rank - 1]을 "나"로 보고 뺀다. 무승부(rank 2로 저장)에서도 내 이름이 그 자리에 있어야 한다(점검 3회차).
describe('전적에 남길 이름 순서', () => {
  it('무승부라 2위로 저장해도 내 이름이 두 번째 자리에 오고, 상대 이름은 남는다', () => {
    expect(rankedNames(['나', '봇A'], 0, 2)).toEqual(['봇A', '나'])
    expect(rankedNames(['봇A', '나', '봇B'], 1, 2)).toEqual(['봇A', '나', '봇B'])
  })

  it('보통 판은 순위 그대로', () => {
    expect(rankedNames(['봇A', '봇B', '나'], 2, 3)).toEqual(['봇A', '봇B', '나'])
    expect(rankedNames(['나', '봇A'], 0, 1)).toEqual(['나', '봇A'])
  })
})
