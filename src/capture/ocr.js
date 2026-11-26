// 캡처 사진 → 글자(OCR). 사진은 브라우저 안에서만 읽고 어디에도 올리지 않는다.
// tesseract.js는 무거우므로 "캡처로 불러오기"를 누를 때 처음 불러온다(동적 import).

import { withTimeout } from '../lib/withTimeout'

const SCALE = 2
// 엔진 준비(언어 데이터 받기 포함)·한 장 읽기를 기다리는 최대 시간
export const ENGINE_TIMEOUT_MS = 60000
// 다듬은 뒤 이 밝기보다 어두우면 글자로 본다. 다크 모드의 흐린 회색 글자(앱별 시간)까지 살리려면 높게 둔다.
export const THRESHOLD = 185

// 한 번 만든 것을 다시 쓰되, 만들기에 실패하면 기억하지 않는다(다음에 누르면 다시 시도한다).
// 실패한 약속을 들고 있으면 네트워크가 잠깐 끊겼을 뿐인데도 새로고침 전까지 캡처 읽기가 계속 실패한다.
// 만든 뒤에 고장 나면(읽다가 엔진이 죽음) reset()으로 버려, 다음에 새로 만든다.
export function reuseUntilFail(create) {
  let promise = null
  const get = (...args) => {
    if (!promise) {
      promise = Promise.resolve()
        .then(() => create(...args))
        .catch((error) => {
          promise = null
          throw error
        })
    }
    return promise
  }
  get.reset = () => {
    const old = promise
    promise = null
    old?.then((worker) => worker?.terminate?.()).catch(() => {})
  }
  return get
}

// 실패 종류를 붙인다: image(사진을 열 수 없음) | engine(읽기 엔진·인터넷). 화면이 다른 안내를 보여 준다.
const tagged = (error, kind) => Object.assign(error instanceof Error ? error : new Error(String(error)), { kind })

let progressListener = null
const getWorkerOnce = reuseUntilFail(() =>
  import('tesseract.js').then(({ createWorker }) =>
    createWorker(['kor', 'eng'], 1, {
      logger: (message) => {
        if (message.status === 'recognizing text') progressListener?.(message.progress)
      },
    }),
  ),
)

function getWorker(onProgress) {
  progressListener = onProgress
  return getWorkerOnce()
}

// 회색조 값 배열을 받아 글자는 검게, 바탕은 희게 만든다. 다크 모드(평균이 어두움)면 뒤집는다.
// 캔버스 없이도 시험할 수 있게 순수 함수로 둔다.
export function binarize(gray, threshold = THRESHOLD) {
  let total = 0
  for (const value of gray) total += value
  const dark = total / gray.length < 128
  const out = new Uint8ClampedArray(gray.length)
  for (let i = 0; i < gray.length; i += 1) {
    const value = dark ? 255 - gray[i] : gray[i]
    out[i] = value < threshold ? 0 : 255
  }
  return { pixels: out, dark }
}

// 이미지 파일 → 다듬은 캔버스(2배 확대, 흑백)
export async function preprocess(file, { threshold = THRESHOLD } = {}) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width * SCALE
  canvas.height = bitmap.height * SCALE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = true
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = image
  const gray = new Uint8ClampedArray(canvas.width * canvas.height)
  for (let i = 0; i < gray.length; i += 1) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  const { pixels } = binarize(gray, threshold)
  for (let i = 0; i < pixels.length; i += 1) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = pixels[i]
    data[i * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
  return canvas
}

// 화면 UI처럼 글자가 흩어진 사진은 "흩어진 글자" 모드(11)가 잘 읽는다.
const DEFAULT_PARAMETERS = { tessedit_pageseg_mode: '11' }

// 파일 하나 → 줄 단위 글자 목록
export async function readImage(file, { onProgress, parameters = DEFAULT_PARAMETERS, threshold } = {}) {
  const canvas = await preprocess(file, { threshold }).catch((error) => {
    throw tagged(error, 'image')
  })
  let data
  try {
    // 언어 데이터 받기가 멈추거나 엔진이 응답하지 않으면 끝없이 기다리지 않고 엔진 오류로 본다(저장 버튼이 "읽는 중"에 묶이지 않게).
    const worker = await withTimeout(getWorker(onProgress), ENGINE_TIMEOUT_MS)
    await worker.setParameters(parameters)
    ;({ data } = await withTimeout(worker.recognize(canvas), ENGINE_TIMEOUT_MS))
  } catch (error) {
    getWorkerOnce.reset() // 고장 난 엔진을 들고 있지 않는다
    throw tagged(error, 'engine')
  }
  return data.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}
