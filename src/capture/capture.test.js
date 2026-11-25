import { describe, expect, it } from 'vitest'
import { validatePhone } from '../records/record'
import { categoryOfApp } from './appCategories'
import * as F from './fixtures'
import { binarize } from './ocr'
import { mergeReads, parseClock, parseCount, parseDuration, readCapture, splitLines } from './parsers'

const read = (...captures) => mergeReads(captures.flatMap((lines) => readCapture(lines)))

describe('글자 조각 읽기', () => {
  it('시간 표기', () => {
    expect(parseDuration('2시간 38분')).toBe(158)
    expect(parseDuration('45분')).toBe(45)
    expect(parseDuration('5시간 35')).toBe(335) // OCR이 "분"을 놓친 경우
    expect(parseDuration('1시간')).toBe(60)
    expect(parseDuration('29초')).toBe(0)
    expect(parseDuration('11조')).toBe(0) // "초"가 "조"로 읽힌 경우
    expect(parseDuration('1h 5m')).toBe(65)
    expect(parseDuration('오전 6시')).toBeNull()
    expect(parseDuration('2')).toBeNull()
    expect(parseDuration('25시간')).toBeNull()
  })

  it('횟수·시각 표기', () => {
    expect(parseCount('60번')).toEqual({ value: 60, unit: '번' })
    expect(parseCount('1,204개')).toEqual({ value: 1204, unit: '개' })
    expect(parseCount('6기')).toEqual({ value: 6, unit: '개' })
    expect(parseCount('97회')).toEqual({ value: 97, unit: '회' })
    expect(parseCount('3H')).toBeNull()
    expect(parseClock('소 오전 12:03')).toBe('00:03')
    expect(parseClock('오후 3:05')).toBe('15:05')
    expect(parseClock('3:32')).toBeNull()
  })

  it('넓은 칸 나누기와 앞쪽 아이콘 잡음 지우기', () => {
    expect(splitLines(['8    Instagram', '© 카카오톡', '@100개', '131개*'])).toEqual(['8', 'Instagram', '카카오톡', '100개', '131개'])
  })

  it('앱 이름 → 종류', () => {
    expect(categoryOfApp('Instagram')).toBe('sns')
    expect(categoryOfApp('You Tube')).toBe('video')
    expect(categoryOfApp('배달의민족')).toBe('shopping')
    expect(categoryOfApp('브롤스타즈')).toBe('game')
    expect(categoryOfApp('처음 보는 앱')).toBe('other')
  })
})

describe('화면별 읽기 규칙', () => {
  it('아이폰 스크린 타임: 총 시간, 상위 카테고리, 많이 쓴 앱(그래프 눈금은 무시)', () => {
    const { phone, filled } = read(F.IOS_SCREEN_TIME)
    expect(phone.total).toBe(192)
    expect(phone.categories).toMatchObject({ sns: 121, video: 50, study: 9 })
    expect(phone.topApps).toEqual([
      { name: 'Instagram', minutes: 74 },
      { name: '카카오톡', minutes: 41 },
      { name: 'YouTube', minutes: 33 },
    ])
    expect(filled).toEqual(expect.arrayContaining(['total', 'categories', 'topApps']))
  })

  it('한 줄에 붙어 읽힌 카테고리도 순서대로 짝짓는다', () => {
    expect(read(F.IOS_SCREEN_TIME_WIDE).phone.categories).toMatchObject({ sns: 121, video: 50, game: 9 })
  })

  it('최다 사용 목록: 잘못 읽은 줄("b=", "29=")은 건너뛴다', () => {
    expect(read(F.IOS_MOST_USED).phone.topApps.map((app) => app.name)).toEqual(['Instagram', '카카오톡', 'YouTube'])
  })

  it('화면 깨우기: 총 횟수와 처음 깨운 시각(오전 12시대 → 0시)', () => {
    const { phone } = read(F.IOS_PICKUPS)
    expect(phone.pickups).toBe(84)
    expect(phone.firstPickup).toBe('01:17')
  })

  it('깨운 뒤 처음 연 앱: 앞보다 큰 값(잘못 읽은 "7번")은 버린다', () => {
    const { phone } = read(F.IOS_PICKUP_APPS)
    expect(phone.pickupApps).toEqual([
      { name: '카카오톡', count: 22 },
      { name: 'Instagram', count: 15 },
      { name: '에브리타임', count: 9 },
    ])
    expect(phone.notifications).toBe(208)
  })

  it('알림: 총 개수와 앱별 개수("6기"는 6개, "1174"는 버림)', () => {
    const { phone } = read(F.IOS_NOTIFICATIONS)
    expect(phone.notifications).toBe(208)
    expect(phone.notifyApps).toEqual([
      { name: '카카오톡', count: 150 },
      { name: '배달의민족', count: 12 },
      { name: '메시지', count: 3 },
    ])
  })

  it('건강 앱: "오늘" 걸음만 고르고 평균은 고르지 않는다', () => {
    expect(read(F.IOS_HEALTH_STEPS).steps).toBe(1204)
    const averages = read(F.IOS_HEALTH_AVERAGES)
    expect(averages.steps).toBeNull()
    expect(averages.notes.join(' ')).toContain('오늘')
  })

  it('주간 화면(일일 평균)은 안내한다', () => {
    expect(read(F.IOS_SCREEN_TIME_WEEK).notes.join(' ')).toContain('일일 평균')
  })

  it('안드로이드 디지털 웰빙: 총 시간·잠금 해제·알림, 카테고리는 앱으로 채운다', () => {
    const { phone } = read(F.ANDROID_WELLBEING)
    expect(phone.total).toBe(288)
    expect(phone.pickups).toBe(97)
    expect(phone.notifications).toBe(186)
    expect(phone.categories).toMatchObject({ video: 125, sns: 62, game: 48 })
  })

  it('삼성 헬스 걸음', () => {
    expect(read(F.SAMSUNG_HEALTH_STEPS).steps).toBe(6532)
  })
})

describe('여러 장 합치기', () => {
  it('아이폰 캡처 7장을 합치면 모든 칸이 차고, 기록 검사를 통과한다', () => {
    const all = read(
      F.IOS_SCREEN_TIME,
      F.IOS_MOST_USED,
      F.IOS_PICKUPS,
      F.IOS_PICKUP_APPS,
      F.IOS_NOTIFICATIONS,
      F.IOS_HEALTH_STEPS,
      F.IOS_HEALTH_AVERAGES,
    )
    expect(all.filled.sort()).toEqual(
      ['categories', 'firstPickup', 'notifications', 'notifyApps', 'pickupApps', 'pickups', 'steps', 'topApps', 'total'].sort(),
    )
    expect(all.notes).toEqual([]) // 오늘 걸음을 찾았으니 평균 화면 안내는 지운다
    expect(validatePhone(all.phone)).toBeNull()
  })

  it('아무것도 못 읽으면 비어 있다', () => {
    expect(read(['3:32', 'ol', '-그'])).toEqual({ phone: null, steps: null, filled: [], derived: [], notes: [] })
  })
})

describe('잘못 읽기 막기', () => {
  it('날짜 머리말은 앱으로 읽지 않고, "X"와 "오늘의집"은 앱으로 읽는다', () => {
    const { phone } = read(['어제, 11월 16일', '4시간 2분', '최다 사용', 'X', '1시간 2분', '오늘의집', '40분', '11월 14일 토요일', '30분'])
    expect(phone.topApps.map((app) => app.name)).toEqual(['X', '오늘의집'])
  })

  it('총 시간을 못 읽으면 지어내지 않고 비워 두고 알린다', () => {
    const { phone, filled, notes } = read(['최다 사용', '카카오톡', '1시간 2분', '유튜브', '40분'])
    expect(phone.total).toBe(0)
    expect(filled).not.toContain('total')
    expect(notes.join(' ')).toContain('총 화면 시간은 읽지 못했어요')
    expect(validatePhone(phone)).toBeTruthy()
  })

  it('앱으로 짐작한 종류는 derived로 표시한다(직접 읽은 종류를 덮지 않게)', () => {
    expect(read(['최다 사용', '카카오톡', '1시간 2분', '유튜브', '40분']).derived).toEqual(['categories'])
    expect(read(F.IOS_SCREEN_TIME).derived).toEqual([])
  })

  it('종류 이름을 하나 놓치면 시간을 밀어 넣지 않고 알린다', () => {
    const { phone, notes } = read(['스크린 타임', '4시간', '소셜 미디어', '게임', '2시간', '1시간', '30분', '업데이트'])
    expect(phone.categories).toEqual(expect.objectContaining({ sns: 0, game: 0 }))
    expect(notes.join(' ')).toContain('종류별 시간을 정확히')
  })

  it('걸음: 윗줄이 평균이면 고르지 않고, 쉼표가 점으로 읽혀도 읽는다', () => {
    expect(read(['걸음', '일일 평균', '2,157 걸음']).steps).toBeNull()
    expect(read(['걸음', '오늘', '1.204 걸음']).steps).toBe(1204)
  })
})

describe('사진 다듬기', () => {
  it('다크 모드(어두운 바탕)는 뒤집어 글자를 검게, 흐린 회색 글자도 살린다', () => {
    // 바탕 28, 흰 글자 240, 흐린 회색 글자 85, 회색 막대 58
    const gray = Uint8ClampedArray.from([28, 28, 28, 28, 240, 85, 58, 28])
    const { pixels, dark } = binarize(gray)
    expect(dark).toBe(true)
    expect([...pixels]).toEqual([255, 255, 255, 255, 0, 0, 255, 255])
  })

  it('라이트 모드는 그대로 둔다', () => {
    const { pixels, dark } = binarize(Uint8ClampedArray.from([250, 250, 250, 20, 140]))
    expect(dark).toBe(false)
    expect([...pixels]).toEqual([255, 255, 255, 0, 0])
  })
})
