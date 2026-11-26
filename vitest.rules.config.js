import { defineConfig } from 'vitest/config'

// Firebase 보안 규칙 테스트만 돈다. 에뮬레이터 안에서 돌려야 한다: npm run test:rules
export default defineConfig({
  test: {
    include: ['rules/*.test.js'],
    environment: 'node',
    // 두 파일이 같은 에뮬레이터 허브를 쓰므로 차례로 돈다.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
