// 범위를 벗어나거나 정수가 아닌 숫자는 가장 가까운 값(0·최댓값·반올림)으로 맞추고, 그 사실을 알려 줄 문구를 함께 돌려준다(말없이 바꾸지 않기).
export function clipNumber(value, max, label) {
  value += 0 // -0 → 0(Firestore는 -0을 정수가 아닌 값으로 보내 규칙이 거절한다)
  if (value < 0) return { value: 0, note: '0보다 작은 수는 넣을 수 없어요. 0으로 맞췄어요.' }
  if (value > max) return { value: max, note: `${label}까지만 넣을 수 있어요. 최댓값으로 맞췄어요.` }
  if (!Number.isInteger(value)) return { value: Math.round(value), note: '정수만 넣을 수 있어 반올림했어요.' }
  return { value, note: '' }
}
