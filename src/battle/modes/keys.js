// 모드 열쇠와 묶음. 시간표(schedule.js)가 씨앗으로 고를 때 쓴다(그리기·규칙 코드와 떨어져 있어 어디서나 불러도 된다).
export const VIEW_MODES = ['map', 'call', 'chase', 'rotate', 'selfie', 'torch', 'lowpower'] // 보는 법만 바뀜
export const RULE_MODES = ['shorts', 'ad', 'rhythm', 'update', 'boss'] // 규칙이 바뀜
export const MODE_KEYS = [...VIEW_MODES, ...RULE_MODES]
