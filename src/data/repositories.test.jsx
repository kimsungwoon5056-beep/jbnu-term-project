// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../profile/look'
import { createEmptyPhone, createEmptyRecord } from '../records/record'
import RecordForm from '../records/RecordForm'
import RecordsHome from '../records/RecordsHome'
import { FirestoreMatchRepository, FirestoreProfileRepository, FirestoreRecordRepository } from './firestoreRepositories'
import { MemoryMatchRepository, MemoryProfileRepository, MemoryRecordRepository } from './memoryRepositories'
import { MATCH_METHODS, PROFILE_METHODS, RECORD_METHODS, RepositoryContext } from './repositories'

// Repository: 화면은 인터페이스만 알고, 구현(Firestore·메모리)은 바꿔 끼울 수 있다.

afterEach(cleanup)

const TODAY = '2026-11-21'
const dayRecord = (date, minutes = 200, steps = 5000) => ({
  ...createEmptyRecord(date),
  phone: { ...createEmptyPhone(), total: minutes, topApps: [{ name: 'Instagram', minutes: Math.min(minutes, 120) }] },
  steps,
})

describe('Repository 인터페이스', () => {
  it('Firestore 구현과 메모리 구현이 같은 메서드를 가진다', () => {
    const pairs = [
      [FirestoreRecordRepository, MemoryRecordRepository, RECORD_METHODS],
      [FirestoreProfileRepository, MemoryProfileRepository, PROFILE_METHODS],
      [FirestoreMatchRepository, MemoryMatchRepository, MATCH_METHODS],
    ]
    for (const [firestore, memory, methods] of pairs) {
      for (const name of methods) {
        expect(typeof firestore.prototype[name]).toBe('function')
        expect(typeof memory.prototype[name]).toBe('function')
      }
    }
  })
})

describe('기록 저장소 계약(메모리 구현으로 확인)', () => {
  it('저장 → 목록 → 수정 → 삭제, 최근 것부터 count개', async () => {
    const repo = new MemoryRecordRepository()
    expect((await repo.save(dayRecord(TODAY), TODAY)).action).toBe('create')
    expect((await repo.save(dayRecord('2026-11-20', 300), TODAY)).ok).toBe(true)
    expect((await repo.listRecent(7)).records.map((r) => r.date)).toEqual([TODAY, '2026-11-20'])
    expect((await repo.listRecent(1)).records).toHaveLength(1)
    const updated = await repo.save(dayRecord(TODAY, 90), TODAY)
    expect(updated.action).toBe('update')
    expect((await repo.load(TODAY)).record.phone.total).toBe(90)
    expect((await repo.remove('2026-11-20', TODAY)).ok).toBe(true)
    expect((await repo.listBetween('2026-11-01', TODAY)).records.map((r) => r.date)).toEqual([TODAY])
  })

  it('서비스 규칙(날짜 창)은 구현과 상관없이 같다: 사흘 전 새 기록·8일 지난 기록 삭제는 거절', async () => {
    const repo = new MemoryRecordRepository({ records: [dayRecord('2026-11-12')] })
    const tooOld = await repo.save(dayRecord('2026-11-18'), TODAY)
    expect(tooOld.ok).toBe(false)
    const oldDelete = await repo.remove('2026-11-12', TODAY)
    expect(oldDelete.ok).toBe(false)
    expect((await repo.load('2026-11-12')).record).not.toBeNull()
  })

  it('저장소가 실패하면 { ok: false, message }로 돌려준다(던지지 않는다)', async () => {
    const repo = new MemoryRecordRepository({ fail: ['save', 'listRecent'] })
    expect(await repo.save(dayRecord(TODAY), TODAY)).toMatchObject({ ok: false })
    expect((await repo.listRecent()).message).toContain('인터넷')
  })
})

describe('프로필·전적 저장소 계약', () => {
  it('프로필: 잘못된 닉네임은 거절, 맞으면 다듬어 저장', async () => {
    const repo = new MemoryProfileRepository()
    expect((await repo.save({ nickname: 'a', look: DEFAULT_LOOK })).ok).toBe(false)
    const saved = await repo.save({ nickname: '  시험C  ', look: DEFAULT_LOOK })
    expect(saved.profile.nickname).toBe('시험C')
    expect((await repo.load()).profile.nickname).toBe('시험C')
  })

  it('전적: 저장한 만큼 판 수와 1등 수를 센다', async () => {
    const repo = new MemoryMatchRepository()
    await repo.save({ mode: 'practice', rank: 1, names: ['나', '봇'], date: TODAY })
    await repo.save({ mode: 'online', rank: 2, names: ['나', '친구'], date: TODAY })
    expect(await repo.summary()).toMatchObject({ ok: true, plays: 2, wins: 1 })
    const recent = await repo.recent(1)
    expect(recent.matches).toHaveLength(1)
    expect(recent.matches[0]).toMatchObject({ mode: 'online', rank: 2, names: ['나', '친구'] })
    expect(await new MemoryMatchRepository({ fail: ['recent'] }).recent()).toMatchObject({ ok: false, matches: [] })
  })
})

describe('화면은 저장소를 바꿔 끼워도 동작한다(메모리 저장소로 홈 그리기)', () => {
  const profile = { nickname: '시험', look: DEFAULT_LOOK }
  const renderHome = (repositories) =>
    render(
      <RepositoryContext.Provider value={repositories}>
        <RecordsHome profile={profile} todayKey={TODAY} onEdit={() => {}} />
      </RepositoryContext.Provider>,
    )
  const repos = (records) => ({ records, profile: new MemoryProfileRepository({ profile }), matches: new MemoryMatchRepository() })

  it('기록이 있으면 최근 기록 목록을 보여 준다', async () => {
    renderHome(repos(new MemoryRecordRepository({ records: [dayRecord(TODAY), dayRecord('2026-11-20')] })))
    expect(await screen.findByText(/11월 21일/)).toBeTruthy()
    expect(screen.getByText(/11월 20일/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '오늘 기록 고치기' })).toBeTruthy()
  })

  it('기록이 없으면 빈 목록 안내를 보여 준다', async () => {
    renderHome(repos(new MemoryRecordRepository()))
    expect(await screen.findByText(/아직 기록이 없어요\./)).toBeTruthy()
  })

  it('불러오기에 실패하면 이유와 다시 불러오기를 보여 주고, 다시 시도해 성공하면 목록을 보여 준다', async () => {
    const records = new MemoryRecordRepository({ records: [dayRecord(TODAY)], fail: ['listRecent'] })
    renderHome(repos(records))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((node) => node.textContent.includes('인터넷'))).toBe(true)
    records.fail.delete('listRecent')
    fireEvent.click(screen.getAllByRole('button', { name: '다시 불러오기' }).at(-1))
    await waitFor(() => expect(screen.getByText(/11월 21일/)).toBeTruthy())
  })

  it('기록 입력 화면도 불러오기에 실패하면 다시 불러오기로 이어 갈 수 있다(홈으로 돌아가지 않아도)', async () => {
    const records = new MemoryRecordRepository({ records: [dayRecord(TODAY, 90)], fail: ['load'] })
    render(
      <RepositoryContext.Provider value={repos(records)}>
        <RecordForm dateKey={TODAY} todayKey={TODAY} onDone={() => {}} />
      </RepositoryContext.Provider>,
    )
    expect((await screen.findByRole('alert')).textContent).toContain('인터넷')
    records.fail.delete('load')
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /저장/ })).toBeTruthy())
  })
})
