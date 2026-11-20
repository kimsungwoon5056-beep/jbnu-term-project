// 범위를 넘는 숫자는 최댓값으로 맞추고, 그 사실을 알려 줄 문구를 함께 돌려준다(말없이 바꾸지 않기).
export function clipNumber(value, max, label) {
  if (value > max) return { value: max, note: `${label}까지만 넣을 수 있어요. 최댓값으로 맞췄어요.` }
  return { value, note: '' }
}
