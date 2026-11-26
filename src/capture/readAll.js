// 캡처 여러 장 → 하나의 읽은 결과. 사진마다 따로 읽어, 한 장이 실패해도 나머지에서 읽은 값은 남긴다.
// 못 읽은 사진은 { name, kind }로 돌려준다. kind: image(사진을 열 수 없음) | engine(읽기 엔진·인터넷 문제)
// readImage·readCapture·mergeReads를 받아 쓰므로(무거운 OCR 없이) 시험할 수 있다.

// 첫 번째로 읽어 볼 흑백 기준(흐린 회색 글자까지 살림). 숫자를 하나도 못 읽으면 두 번째 기준으로 다시 읽는다.
const THRESHOLDS = [185, 165]
const NUMBER_FIELDS = ['total', 'pickups', 'notifications']
const hasNumber = (found) => found.some((part) => part.steps !== undefined || NUMBER_FIELDS.some((field) => part.phone?.[field] !== undefined))

export async function readAll(files, { readImage, readCapture, mergeReads, onProgress = () => {} }) {
  const reads = []
  const failed = []
  let opened = 0
  for (const [index, file] of files.entries()) {
    try {
      for (const threshold of THRESHOLDS) {
        const found = readCapture(await readImage(file, { threshold, onProgress: (progress) => onProgress(index, progress) }))
        reads.push(...found)
        if (hasNumber(found) || found.length > 1) break
      }
      opened += 1
    } catch (error) {
      failed.push({ name: file.name, kind: error?.kind === 'image' ? 'image' : 'engine' })
    }
    onProgress(index + 1, 0)
  }
  return { result: opened > 0 ? mergeReads(reads) : null, failed }
}

// 못 읽은 사진 안내. 사진 문제면 이름을 들어 다른 사진을, 엔진 문제면 인터넷을 확인하라고 한다.
export function captureErrorText(failed) {
  const images = failed.filter((item) => item.kind === 'image').map((item) => item.name)
  const parts = []
  if (images.length) parts.push(`사진을 열 수 없어요(${images.join(', ')}). PNG·JPG 캡처를 골라 주세요.`)
  if (failed.some((item) => item.kind === 'engine')) parts.push('글자 읽기 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도하거나 직접 입력해 주세요.')
  return parts.join(' ')
}
