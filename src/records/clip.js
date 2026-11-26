// 범위를 벗어난 숫자는 가장 가까운 끝값(0 또는 최댓값)으로 맞추고, 그 사실을 알려 줄 문구를 함께 돌려준다(말없이 바꾸지 않기).
export function clipNumber(value, max, label) {
  if (value < 0) return { value: 0, note: '0보다 작은 수는 넣을 수 없어요. 0으로 맞췄어요.' }
  if (value > max) return { value: max, note: `${label}까지만 넣을 수 있어요. 최댓값으로 맞췄어요.` }
  return { value, note: '' }
}
