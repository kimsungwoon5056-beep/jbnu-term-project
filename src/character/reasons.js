import { ARCHETYPES } from '../capture/appArchetypes'
import { LOOK_OPTIONS, normalizeLook } from '../profile/look'
import { formatMinutes } from '../records/recordFormat'
import { GRAFT_STEPS } from './appGrafts'
import { APP_LOOKS, GEAR_LABELS, lookKeyOf, lookLabel } from './appLook'
import { SCENE_LABELS } from './scenes'
import { MARKS } from './state'

// 부위 설명: 부위마다 왜 이렇게 생겼는지(오늘 숫자)와 다음 목표를 문장으로 만든다.
// entry: { key, title, label, reason, next: { when, label } | null, highlight }

const steps = (value) => `${value.toLocaleString('ko-KR')}걸음`

function appsOf(graft) {
  return graft.apps.length ? graft.apps.join('·') : `${ARCHETYPES[graft.archetype].label} 앱`
}

function graftEntry(state, raw, day, slot) {
  const graft = state.grafts.find((item) => item.slot === slot)
  const rank = { hair: 1, outfit: 2, hand: 3 }[slot]
  const limit = formatMinutes(GRAFT_STEPS[rank - 1])
  if (!graft) return null
  const key = lookKeyOf(graft)
  const name = lookLabel(key)
  const label = {
    hair: `${name} ${GEAR_LABELS[APP_LOOKS[key].gear]}`,
    outfit: `${name} 후드티`,
    hand: state.marks.raisePhone ? `${name} 켜진 폰(얼굴 옆까지)` : `${name} 켜진 폰`,
  }[slot]
  const where = { hair: '머리에 스며들었어요', outfit: '옷이 됐어요', hand: '손에 들렸어요' }[slot]
  let reason = `${appsOf(graft)} ${day} ${formatMinutes(graft.minutes)}. 화면 시간이 ${limit}을 넘어 많이 쓴 앱 ${rank}위가 ${where}.`
  if (slot === 'hand' && state.marks.raisePhone) reason += ` ${day} ${formatMinutes(MARKS.raiseMinutes)} 넘게 봐서 폰을 얼굴 옆까지 들고 있어요.`
  const back = { hair: '내 머리로 돌아와요', outfit: '흰 티셔츠로 돌아와요', hand: '폰을 내려놓아요' }[slot]
  return { label, reason, next: { when: `화면 시간을 ${limit} 아래로 줄이면`, label: back } }
}

export function explainParts(state, details, lookInput, { isToday = true } = {}) {
  const look = normalizeLook(lookInput)
  const raw = details.raw
  const known = details.known
  const day = isToday ? '오늘' : '어제'
  const { marks, health, tier } = state
  const unmeasured = health.measured === false
  const UNMEASURED = '아직 스크린 타임 기록이 없어 디지털 건강을 알 수 없어요.'
  const afterRecord = (label) => ({ when: '스크린 타임을 기록하면', label })
  const entries = []
  const add = (key, title, body, highlight = key) => entries.push({ key, title, highlight, next: null, ...body })

  // 머리·옷·손: 많이 쓴 앱 1·2·3위
  add(
    'hair',
    '머리',
    graftEntry(state, raw, day, 'hair') ?? {
      label: `내 머리(${LOOK_OPTIONS.hairStyle.choices[look.hairStyle].label})`,
      reason: known.phone
        ? `${day} 화면 시간 ${formatMinutes(raw.phoneTotal)}. ${formatMinutes(GRAFT_STEPS[0])}을 넘지 않아 앱이 머리에 스며들지 않았어요.`
        : '스크린 타임을 넣으면 많이 쓴 앱이 머리에 스며들어요.',
      next: { when: `화면 시간이 ${formatMinutes(GRAFT_STEPS[0])}을 넘으면`, label: '1위 앱 색으로 물들어요' },
    },
  )
  add(
    'outfit',
    '옷',
    graftEntry(state, raw, day, 'outfit') ?? {
      label: '흰 티셔츠',
      reason: known.phone ? `화면 시간이 ${formatMinutes(GRAFT_STEPS[1])} 아래라 앱이 옷에 스며들지 않았어요.` : '아직 스마트폰 기록이 없어요.',
      next: null,
    },
  )
  add(
    'hand',
    '손',
    graftEntry(state, raw, day, 'hand') ?? {
      label: '빈손',
      reason: known.phone ? `화면 시간이 ${formatMinutes(GRAFT_STEPS[2])} 아래라 손에 폰을 들고 있지 않아요.` : '아직 스마트폰 기록이 없어요.',
      next: null,
    },
  )

  // 눈: 화면 깨우기 / 건강
  const eyeBody = marks.spiral
    ? {
        label: '빙글빙글 눈',
        reason: `화면 깨우기 ${day} ${raw.pickups}번(${MARKS.spiralPickups}번 이상). 폰을 자꾸 확인해 눈이 핑핑 돌아요.`,
        next: { when: `화면 깨우기를 ${MARKS.spiralPickups}번 아래로 줄이면`, label: '눈이 또렷해져요' },
      }
    : tier === 'low'
      ? { label: '반쯤 감긴 눈', reason: `디지털 건강 ${health.percent}%(55% 미만)라 눈이 풀렸어요.`, next: { when: '건강이 55% 이상이면', label: '눈을 떠요' } }
      : tier === 'good'
        ? { label: '반짝 눈', reason: `디지털 건강 ${health.percent}%(80% 이상)라 눈이 반짝여요.` }
        : unmeasured
          ? { label: '보통 눈', reason: UNMEASURED, next: afterRecord('건강에 따라 눈이 바뀌어요') }
          : { label: '보통 눈', reason: `디지털 건강 ${health.percent}%.`, next: { when: '건강이 80% 이상이면', label: '눈이 반짝여요' } }
  add('eyes', '눈', eyeBody)

  if (marks.darkCircles) {
    add('undereye', '다크서클', {
      label: '보라 다크서클',
      reason: raw.firstPickup ? `${day} ${raw.firstPickup}에 처음 폰을 깨웠어요(밤 0~4시).` : '밤 0~4시에 처음 폰을 깨웠어요.',
      next: { when: '처음 깨우는 시각이 새벽 5시 이후면', label: '다크서클이 사라져요' },
    })
  }

  // 얼굴: 건강 %와 원인, 화면 빛
  const causes = health.causes.slice(0, 2).map((cause) => `${cause.label} −${Math.max(1, Math.round(cause.amount * 100))}%`)
  const faceLabel = { good: '발그레한 얼굴', mid: '보통 얼굴', low: '칙칙한 얼굴' }[tier]
  let faceReason = unmeasured ? UNMEASURED : `디지털 건강 ${health.percent}%.${causes.length ? ` 많이 깎은 것: ${causes.join(', ')}.` : ''}`
  if (marks.glow) {
    const videoGame = (raw.phoneCategories?.video ?? 0) + (raw.phoneCategories?.game ?? 0)
    faceReason += ` 영상·게임 앱 ${formatMinutes(videoGame)}이라 볼에 화면 빛이 비쳐요.`
  }
  add('face', '얼굴', {
    label: marks.glow ? `${faceLabel} + 화면 빛` : faceLabel,
    reason: faceReason,
    next: unmeasured ? afterRecord('건강에 따라 얼굴색이 바뀌어요') : tier === 'good' ? null : { when: '건강이 80% 이상이면', label: '볼이 발그레해져요' },
  })

  // 자세: 화면 시간
  add(
    'posture',
    '자세',
    marks.slouch
      ? {
          label: '거북목',
          reason: `${day} 화면 시간 ${formatMinutes(raw.phoneTotal)}(${formatMinutes(MARKS.slouchMinutes)} 이상). 고개가 아래로 내려왔어요.`,
          next: { when: `${formatMinutes(MARKS.slouchMinutes)} 아래로 줄이면`, label: '고개를 들어요' },
        }
      : { label: '바른 자세', reason: known.phone ? `화면 시간이 ${formatMinutes(MARKS.slouchMinutes)} 아래예요.` : '아직 스마트폰 기록이 없어요.' },
    ['hair', 'face', 'eyes'],
  )

  // 알림 배지
  if (known.phone) {
    const nextStep = MARKS.badgeSteps[marks.badges - 1]
    const topNotify = raw.notifyApps?.[0]
    add('badge', '알림', {
      label: marks.badges ? `알림 배지 ${marks.badges}개` : '알림 배지 없음',
      reason: `알림 ${day} ${raw.notifications}개${topNotify ? `(가장 많은 앱: ${topNotify.name} ${topNotify.count}개)` : ''}.${marks.badges ? ` ${MARKS.badgeSteps[0]}개마다 머리 위 배지가 하나씩 늘어요.` : ''}`,
      next: marks.badges ? { when: `알림을 ${nextStep}개 아래로 줄이면`, label: '배지가 하나 줄어요' } : null,
    })
  }

  // 신발: 걸음
  const shoeBody = {
    sneakers: { label: '운동화·걷는 자세', reason: `${day} ${steps(raw.steps)}(${MARKS.sneakerSteps.toLocaleString('ko-KR')}보 이상).` },
    slippers: {
      label: '슬리퍼',
      reason: `${day} ${steps(raw.steps)}(${MARKS.slipperSteps.toLocaleString('ko-KR')}보 미만). 거의 밖에 나가지 않았어요.`,
      next: { when: `${MARKS.sneakerSteps.toLocaleString('ko-KR')}보 이상 걸으면`, label: '운동화를 신어요' },
    },
    plain: {
      label: '보통 신발',
      reason: known.steps ? `${day} ${steps(raw.steps)}.` : '걸음 수를 넣으면 신발이 바뀌어요.',
      next: { when: `${MARKS.sneakerSteps.toLocaleString('ko-KR')}보 이상 걸으면`, label: '운동화를 신어요' },
    },
  }[marks.shoes]
  add('shoes', '신발', shoeBody)

  // 배경
  const sceneReason = {
    park: `디지털 건강 ${health.percent}%(80% 이상). 폰을 내려놓고 밖에 나왔어요.`,
    home: unmeasured ? UNMEASURED : `디지털 건강 ${health.percent}%.`,
    room: marks.darkCircles ? '밤에 폰을 켜서 방이 어두워요.' : `디지털 건강 ${health.percent}%(55% 미만). 어두운 방에서 화면만 빛나요.`,
  }[state.scene]
  add('scene', '배경', {
    label: SCENE_LABELS[state.scene],
    reason: sceneReason,
    next: state.scene === 'park' ? null : { when: '건강 80% 이상, 밤 폰 없이', label: '햇살 공원으로 나가요' },
  })
  return entries
}

// 처음 보여 줄 부위: 가장 눈에 띄는 변화
export function featuredPart(entries, state) {
  const order = [
    state.grafts.length ? 'hair' : null,
    state.marks.badges ? 'badge' : null,
    state.marks.spiral ? 'eyes' : null,
    state.marks.darkCircles ? 'undereye' : null,
    state.marks.slouch ? 'posture' : null,
    state.marks.shoes === 'sneakers' ? 'shoes' : null,
    'face',
  ].filter(Boolean)
  return order.find((key) => entries.some((entry) => entry.key === key)) ?? entries[0]?.key ?? null
}
