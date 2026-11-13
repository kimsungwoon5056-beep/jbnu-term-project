// 칸 목록 → SVG 사각형. 같은 줄에서 이어진 같은 색 칸은 사각형 하나로 합친다.
export function toRuns(pixels) {
  const byRow = new Map()
  for (const [x, y, color] of pixels) {
    if (!byRow.has(y)) byRow.set(y, new Map())
    byRow.get(y).set(x, color)
  }
  const runs = []
  for (const [y, row] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    const xs = [...row.keys()].sort((a, b) => a - b)
    let start = xs[0]
    let previous = xs[0]
    for (const x of [...xs.slice(1), Infinity]) {
      if (x === previous + 1 && row.get(x) === row.get(start)) {
        previous = x
        continue
      }
      runs.push({ x: start, y, width: previous - start + 1, color: row.get(start) })
      start = x
      previous = x
    }
  }
  return runs
}
