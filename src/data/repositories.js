import { createContext, useContext } from 'react'
import { FirestoreMatchRepository, FirestoreProfileRepository, FirestoreRecordRepository } from './firestoreRepositories'

// Repository: 화면(클라이언트)은 기록·프로필·전적을 "어디에 어떻게" 저장하는지 모르고, 아래 인터페이스만 쓴다.
// 구현은 둘이다: Firestore 구현(firestoreRepositories.js, 실제 앱)과 메모리 구현(memoryRepositories.js, 테스트·시연).
// 모든 메서드는 Promise<{ ok, message, ... }>를 돌려준다(실패해도 던지지 않는다).
//
// RecordRepository  load(dateKey) → { record }       listRecent(count) → { records }
//                   listBetween(from, to) → { records }
//                   save(record, todayKey) → { errors, action }   remove(dateKey, todayKey)
// ProfileRepository load() → { profile }             save(profile) → { errors, profile }
// MatchRepository   save(match)                      summary() → { plays, wins }

export const RECORD_METHODS = ['load', 'listRecent', 'listBetween', 'save', 'remove']
export const PROFILE_METHODS = ['load', 'save']
export const MATCH_METHODS = ['save', 'summary']

// 로그인한 사람의 Firestore 저장소 묶음(App이 만들어 내려준다)
export function createFirestoreRepositories(uid) {
  return {
    records: new FirestoreRecordRepository(uid),
    profile: new FirestoreProfileRepository(uid),
    matches: new FirestoreMatchRepository(uid),
  }
}

// 화면은 이 훅으로 저장소를 받는다. 어떤 구현이 들어올지는 위에서(App·테스트) 정한다.
export const RepositoryContext = createContext(null)

export function useRepositories() {
  const repositories = useContext(RepositoryContext)
  if (!repositories) throw new Error('RepositoryContext.Provider 안에서만 쓸 수 있어요.')
  return repositories
}
