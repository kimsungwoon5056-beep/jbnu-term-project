// 부품 배치에 쓰는 공통 값
export const STROKE = 3 // 모든 부품의 외곽선 굵기(설계안 3-5-1)

// 그림 속 다리 길이: 유전자 다리 길이(0~36)를 캔버스에 맞게 줄인다.
export function legLength(life) {
  return 4 + life.legLength * 0.45
}
